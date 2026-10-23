// Every Starbase HTTP endpoint. Three audiences:
//   /api/*         staff app (session token): canvassers, organizers, admins
//   /api/public/*  Imagine Surrey website forms + counters (public pk_ key)
//   /api/v1/*      server-to-server sync for the website/CRM (secret sk_ key)

import { Router, HttpError, bad, notFound, v, rateLimiter, clientIp } from './http.js';
import { tx, audit, parseJsonCols, SUPPORT_LEVELS, OUTCOMES, NEIGHBOURHOODS } from './db.js';
import {
  hashPassword, verifyPassword, createSession, destroySession, userForToken,
  createApiKey, lookupApiKey, hasRole,
} from './auth.js';
import {
  ISSUES, cleanPerson, getPerson, insertPerson, updatePerson, upsertPerson, recordResult,
  addressDetail, markerStatus, stats, publicStats, emitWebhook, normalizePostal,
} from './services.js';
import { parseCsv, toCsv } from './csv.js';
import { geocodePending, SURREY_CENTER, SURREY_BOUNDS } from './geocode.js';

const PUBLIC_FORMS = ['signup', 'volunteer', 'sign', 'contact', 'pledge', 'endorse'];

export function buildApi({ db, config }) {
  const r = new Router();
  const loginLimit = rateLimiter({ windowMs: 15 * 60e3, max: 20 });
  const formLimit = rateLimiter({ windowMs: 60e3, max: 10 });

  // ---- middleware ---------------------------------------------------------
  const auth = (min = 'canvasser') => (ctx) => {
    const header = ctx.req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const user = userForToken(db, token);
    if (!user) throw new HttpError(401, 'Please sign in');
    if (!hasRole(user, min)) throw new HttpError(403, 'You do not have permission to do that');
    ctx.user = user;
    ctx.token = token;
  };

  const apiKey = (kind) => (ctx) => {
    const header = ctx.req.headers.authorization || '';
    const key = (header.startsWith('Bearer ') ? header.slice(7) : null)
      || ctx.req.headers['x-starbase-key'] || ctx.query.get('key');
    const k = lookupApiKey(db, key);
    if (!k || (kind === 'secret' && k.kind !== 'secret')) throw new HttpError(401, 'Invalid API key');
    const origin = ctx.req.headers.origin;
    if (k.kind === 'public' && origin && k.allowed_origins.length && !k.allowed_origins.includes(origin)) {
      throw new HttpError(403, 'Origin not allowed for this key');
    }
    ctx.apiKey = k;
  };

  const page = (q) => {
    const size = Math.min(v.int(q.get('page_size'), 1, 500) ?? 50, 500);
    const p = v.int(q.get('page'), 1) ?? 1;
    return { limit: size, offset: (p - 1) * size, page: p, page_size: size };
  };

  // ---- auth ---------------------------------------------------------------
  r.post('/api/auth/login', ({ req, body }) => {
    if (!loginLimit(clientIp(req))) throw new HttpError(429, 'Too many sign-in attempts. Try again in 15 minutes.');
    const email = v.str(body.email, 254);
    const password = String(body.password ?? '');
    const user = email && db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, 'Email or password is incorrect');
    }
    const s = createSession(db, user.id);
    audit(db, { user, action: 'auth.login' });
    return { token: s.token, expires: s.expires, user: publicUser(user) };
  });

  r.post('/api/auth/logout', auth(), ({ token }) => { destroySession(db, token); return { ok: true }; });

  r.get('/api/me', auth(), ({ user }) => ({ user }));

  r.post('/api/me/password', auth(), ({ user, body }) => {
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
    if (!verifyPassword(String(body.current_password ?? ''), row.password_hash)) throw bad('Current password is incorrect');
    const next = String(body.new_password ?? '');
    if (next.length < 10) throw bad('New password must be at least 10 characters');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    return { ok: true };
  });

  r.get('/api/config', auth(), () => ({
    app: 'Starbase',
    organization: config.orgName,
    google_maps_browser_key: config.mapsBrowserKey || null,
    google_maps_map_id: config.mapsMapId || null,
    geocoding_enabled: !!config.mapsServerKey,
    center: SURREY_CENTER,
    bounds: SURREY_BOUNDS,
    outcomes: OUTCOMES,
    support_levels: SUPPORT_LEVELS,
    neighbourhoods: NEIGHBOURHOODS,
    issues: ISSUES,
  }));

  // ---- canvassing (phone app) ---------------------------------------------
  r.get('/api/canvass/turfs', auth(), ({ user }) => {
    const rows = db.prepare(`
      SELECT t.id, t.name, t.color, t.neighbourhood, t.assigned_user_id,
        COUNT(a.id) AS doors, SUM(CASE WHEN a.visit_count > 0 THEN 1 ELSE 0 END) AS knocked
      FROM turfs t LEFT JOIN addresses a ON a.turf_id = t.id GROUP BY t.id ORDER BY t.name`).all();
    return { turfs: rows.map(t => ({ ...t, mine: t.assigned_user_id === user.id })) };
  });

  r.get('/api/canvass/addresses', auth(), ({ query }) => {
    const where = ['a.lat IS NOT NULL'];
    const args = [];
    const bbox = (query.get('bbox') || '').split(',').map(Number);
    if (bbox.length === 4 && bbox.every(Number.isFinite)) {
      where.push('a.lat BETWEEN ? AND ?', 'a.lng BETWEEN ? AND ?');
      args.push(bbox[0], bbox[2], bbox[1], bbox[3]);
    }
    const turf = v.int(query.get('turf'), 1);
    if (turf) { where.push('a.turf_id = ?'); args.push(turf); }
    const limit = Math.min(v.int(query.get('limit'), 1, 5000) ?? 2000, 5000);
    const rows = db.prepare(`
      SELECT a.id, a.street_number, a.street_name, a.unit, a.lat, a.lng, a.turf_id, a.do_not_contact,
             a.visit_count, a.last_outcome, a.last_support_level, a.last_visited_at, t.color AS turf_color
      FROM addresses a LEFT JOIN turfs t ON t.id = a.turf_id
      WHERE ${where.join(' AND ')} ORDER BY a.street_name, CAST(a.street_number AS INTEGER), a.unit LIMIT ?`)
      .all(...args, limit + 1);
    return {
      truncated: rows.length > limit,
      addresses: rows.slice(0, limit).map(a => ({
        id: a.id, lat: a.lat, lng: a.lng, turf_id: a.turf_id, turf_color: a.turf_color,
        label: `${a.unit ? a.unit + '-' : ''}${a.street_number} ${a.street_name}`,
        status: markerStatus(a), last_visited_at: a.last_visited_at,
      })),
    };
  });

  r.get('/api/canvass/addresses/:id', auth(), ({ user, params }) => {
    const a = addressDetail(db, Number(params.id));
    if (!a) throw notFound('Address not found');
    return { address: forRole(user, a) };
  });

  // Canvassers can drop a pin for a house that's missing from the list.
  r.post('/api/canvass/addresses', auth(), ({ user, body }) => {
    const lat = v.num(body.lat), lng = v.num(body.lng);
    if (lat == null || lng == null) throw bad('lat and lng are required');
    const id = insertAddress(db, { ...body, lat, lng, geocode_status: 'manual' });
    audit(db, { user, action: 'address.create', entity: 'address', entityId: id, detail: { via: 'map' } });
    return { address: forRole(user, addressDetail(db, id)) };
  });

  r.post('/api/canvass/results', auth(), async ({ user, body }) => {
    const out = recordResult(db, user, body);
    if (out.person_id && !out.duplicate) emitWebhook('person.updated', getPerson(db, out.person_id), config.env);
    return { result: out, address: forRole(user, addressDetail(db, Number(body.address_id))) };
  });

  // Offline queue flush: each entry succeeds or fails on its own.
  r.post('/api/canvass/results/batch', auth(), ({ user, body }) => {
    const list = Array.isArray(body.results) ? body.results.slice(0, 500) : [];
    const results = list.map((item) => {
      try { return { client_id: item.client_id, ok: true, ...recordResult(db, user, item) }; }
      catch (e) { return { client_id: item.client_id, ok: false, error: e.message, retry: !(e instanceof HttpError) }; }
    });
    return { results };
  });

  r.get('/api/canvass/me', auth(), ({ user }) => {
    const row = db.prepare(`
      SELECT COUNT(*) AS doors_today, SUM(CASE WHEN outcome = 'spoke' THEN 1 ELSE 0 END) AS conversations_today,
        SUM(CASE WHEN support_level IN (1,2) THEN 1 ELSE 0 END) AS supporters_today
      FROM canvass_results WHERE user_id = ? AND date(visited_at, 'localtime') = date('now', 'localtime')`).get(user.id);
    const total = db.prepare('SELECT COUNT(*) AS n FROM canvass_results WHERE user_id = ?').get(user.id).n;
    return { doors_today: row.doors_today ?? 0, conversations_today: row.conversations_today ?? 0,
      supporters_today: row.supporters_today ?? 0, doors_total: total };
  });

  // ---- dashboard -----------------------------------------------------------
  r.get('/api/stats', auth('organizer'), ({ query }) => stats(db, { since: v.str(query.get('since'), 30) }));

  // ---- people ---------------------------------------------------------------
  function peopleQuery(query) {
    const where = [], args = [];
    const q = v.str(query.get('q'), 100);
    if (q) {
      where.push(`(p.first_name || ' ' || p.last_name LIKE ? OR p.email LIKE ? OR p.phone LIKE ? OR p.street_address LIKE ?)`);
      const like = `%${q}%`;
      args.push(like, like, like, like);
    }
    const support = v.str(query.get('support'), 20);
    if (support === 'none') where.push('p.support_level IS NULL');
    else if (support) {
      const levels = support.split(',').map(Number).filter(n => n >= 1 && n <= 5);
      if (levels.length) where.push(`p.support_level IN (${levels.join(',')})`);
    }
    for (const flag of ['volunteer', 'sign_request', 'donor', 'email_opt_in']) {
      if (query.get(flag) === '1') where.push(`p.${flag} = 1`);
    }
    const tag = v.str(query.get('tag'), 60);
    if (tag) { where.push('EXISTS (SELECT 1 FROM json_each(p.tags) WHERE value = ?)'); args.push(tag); }
    const source = v.str(query.get('source'), 30);
    if (source) { where.push('p.source = ?'); args.push(source); }
    const hood = v.str(query.get('neighbourhood'), 60);
    if (hood) { where.push('a.neighbourhood = ?'); args.push(hood); }
    const turf = v.int(query.get('turf'), 1);
    if (turf) { where.push('a.turf_id = ?'); args.push(turf); }
    return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', args };
  }

  r.get('/api/people', auth('organizer'), ({ query }) => {
    const { sql, args } = peopleQuery(query);
    const pg = page(query);
    const total = db.prepare(`SELECT COUNT(*) AS n FROM people p LEFT JOIN addresses a ON a.id = p.address_id ${sql}`).get(...args).n;
    const rows = db.prepare(`
      SELECT p.*, a.neighbourhood FROM people p LEFT JOIN addresses a ON a.id = p.address_id
      ${sql} ORDER BY p.updated_at DESC, p.id DESC LIMIT ? OFFSET ?`).all(...args, pg.limit, pg.offset);
    return { total, page: pg.page, page_size: pg.page_size, people: rows.map(p => parseJsonCols(p)) };
  });

  r.get('/api/people/export.csv', auth('organizer'), ({ query, user, res }) => {
    const { sql, args } = peopleQuery(query);
    const rows = db.prepare(`SELECT p.*, a.neighbourhood FROM people p LEFT JOIN addresses a ON a.id = p.address_id
                             ${sql} ORDER BY p.last_name, p.first_name`).all(...args).map(p => parseJsonCols(p));
    audit(db, { user, action: 'people.export', detail: { count: rows.length } });
    return csvResponse(res, 'starbase-people.csv', toCsv(rows, ['id', 'first_name', 'last_name', 'email', 'phone',
      'street_address', 'postal_code', 'neighbourhood', 'support_level', 'volunteer', 'sign_request', 'donor',
      'email_opt_in', 'tags', 'issues', 'source', 'notes', 'created_at', 'updated_at']));
  });

  r.post('/api/people/import', auth('organizer'), ({ user, body }) => {
    const rows = parseCsv(body.csv ?? '');
    if (!rows.length) throw bad('CSV is empty or has no data rows');
    let created = 0, updated = 0;
    const errors = [];
    tx(db, () => rows.forEach((row, i) => {
      try {
        const input = {
          first_name: row.first_name ?? row.first ?? row.given_name,
          last_name: row.last_name ?? row.last ?? row.surname,
          email: row.email, phone: row.phone ?? row.mobile,
          street_address: row.street_address ?? row.address, postal_code: row.postal_code ?? row.postal,
          support_level: row.support_level, volunteer: row.volunteer, sign_request: row.sign_request ?? row.lawn_sign,
          donor: row.donor, email_opt_in: row.email_opt_in, tags: row.tags, issues: row.issues, notes: row.notes,
        };
        for (const k of Object.keys(input)) if (input[k] === undefined) delete input[k];
        const res = upsertPerson(db, input, v.str(body.source, 30) || 'import');
        res.created ? created++ : updated++;
      } catch (e) { errors.push({ row: i + 2, error: e.message }); }
    }));
    audit(db, { user, action: 'people.import', detail: { created, updated, errors: errors.length } });
    return { created, updated, errors: errors.slice(0, 50), error_count: errors.length };
  });

  r.get('/api/people/:id', auth('organizer'), ({ params }) => {
    const p = getPerson(db, Number(params.id));
    if (!p) throw notFound('Person not found');
    const history = db.prepare(`
      SELECT r.*, u.name AS canvasser FROM canvass_results r LEFT JOIN users u ON u.id = r.user_id
      WHERE r.person_id = ? ORDER BY r.visited_at DESC`).all(p.id).map(x => parseJsonCols(x, ['issues']));
    const submissions = db.prepare('SELECT id, form, created_at FROM submissions WHERE person_id = ? ORDER BY id DESC').all(p.id);
    return { person: p, history, submissions };
  });

  r.post('/api/people', auth('organizer'), ({ user, body }) => {
    const data = cleanPerson(body);
    if (!data.first_name && !data.last_name && !data.email) throw bad('A name or email is required');
    if (data.email && db.prepare('SELECT 1 FROM people WHERE email = ?').get(data.email)) {
      throw new HttpError(409, 'Someone with that email is already in the database');
    }
    const id = insertPerson(db, data, 'manual');
    audit(db, { user, action: 'person.create', entity: 'person', entityId: id });
    const person = getPerson(db, id);
    emitWebhook('person.created', person, config.env);
    return { person };
  });

  r.patch('/api/people/:id', auth('organizer'), ({ user, params, body }) => {
    const id = Number(params.id);
    if (!db.prepare('SELECT 1 FROM people WHERE id = ?').get(id)) throw notFound('Person not found');
    const data = cleanPerson(body);
    if (data.email && db.prepare('SELECT 1 FROM people WHERE email = ? AND id != ?').get(data.email, id)) {
      throw new HttpError(409, 'Someone else already has that email');
    }
    updatePerson(db, id, data);
    audit(db, { user, action: 'person.update', entity: 'person', entityId: id, detail: Object.keys(data) });
    const person = getPerson(db, id);
    emitWebhook('person.updated', person, config.env);
    return { person };
  });

  r.delete('/api/people/:id', auth('admin'), ({ user, params }) => {
    const id = Number(params.id);
    const info = db.prepare('DELETE FROM people WHERE id = ?').run(id);
    if (!info.changes) throw notFound('Person not found');
    audit(db, { user, action: 'person.delete', entity: 'person', entityId: id });
    emitWebhook('person.deleted', { id }, config.env);
    return { ok: true };
  });

  // ---- addresses (the canvass list) ----------------------------------------
  function addressQuery(query) {
    const where = [], args = [];
    const q = v.str(query.get('q'), 100);
    if (q) {
      where.push(`(a.street_number || ' ' || a.street_name LIKE ? OR a.postal_code LIKE ? OR a.unit || '-' || a.street_number || ' ' || a.street_name LIKE ?)`);
      args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const turf = query.get('turf');
    if (turf === 'none') where.push('a.turf_id IS NULL');
    else if (v.int(turf, 1)) { where.push('a.turf_id = ?'); args.push(Number(turf)); }
    const hood = v.str(query.get('neighbourhood'), 60);
    if (hood) { where.push('a.neighbourhood = ?'); args.push(hood); }
    const status = v.str(query.get('status'), 20);
    if (status === 'unvisited') where.push('a.visit_count = 0 AND a.do_not_contact = 0');
    else if (status === 'visited') where.push('a.visit_count > 0');
    else if (status === 'retry') where.push("a.last_outcome IN ('not_home','come_back') AND a.do_not_contact = 0");
    else if (status === 'supporters') where.push('a.last_support_level IN (1,2)');
    else if (status === 'dnc') where.push('a.do_not_contact = 1');
    const geo = v.str(query.get('geocode'), 20);
    if (geo) { where.push('a.geocode_status = ?'); args.push(geo); }
    return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', args };
  }

  r.get('/api/addresses', auth('organizer'), ({ query }) => {
    const { sql, args } = addressQuery(query);
    const pg = page(query);
    const total = db.prepare(`SELECT COUNT(*) AS n FROM addresses a ${sql}`).get(...args).n;
    const rows = db.prepare(`
      SELECT a.*, t.name AS turf_name, t.color AS turf_color,
        (SELECT COUNT(*) FROM people p WHERE p.address_id = a.id) AS residents
      FROM addresses a LEFT JOIN turfs t ON t.id = a.turf_id ${sql}
      ORDER BY a.street_name, CAST(a.street_number AS INTEGER), a.unit LIMIT ? OFFSET ?`).all(...args, pg.limit, pg.offset);
    return { total, page: pg.page, page_size: pg.page_size, addresses: rows.map(a => ({ ...a, status: markerStatus(a) })) };
  });

  r.get('/api/addresses/export.csv', auth('organizer'), ({ query, res }) => {
    const { sql, args } = addressQuery(query);
    const rows = db.prepare(`SELECT a.*, t.name AS turf FROM addresses a LEFT JOIN turfs t ON t.id = a.turf_id ${sql}
                             ORDER BY a.street_name, CAST(a.street_number AS INTEGER), a.unit`).all(...args);
    return csvResponse(res, 'starbase-canvass-list.csv', toCsv(rows, ['id', 'unit', 'street_number', 'street_name',
      'city', 'postal_code', 'neighbourhood', 'turf', 'lat', 'lng', 'visit_count', 'last_outcome',
      'last_support_level', 'last_visited_at', 'do_not_contact', 'notes']));
  });

  r.post('/api/addresses/import', auth('organizer'), ({ user, body }) => {
    const rows = parseCsv(body.csv ?? '');
    if (!rows.length) throw bad('CSV is empty or has no data rows');
    const turfId = v.int(body.turf_id, 1);
    let created = 0, skipped = 0;
    const errors = [];
    tx(db, () => rows.forEach((row, i) => {
      try {
        const parsed = splitAddress(row);
        if (!parsed) throw new Error('Needs street_number + street_name, or an address column');
        const exists = db.prepare('SELECT id FROM addresses WHERE street_number = ? AND street_name = ? AND unit = ?')
          .get(parsed.street_number, parsed.street_name, parsed.unit);
        if (exists) { skipped++; return; }
        const lat = v.num(row.lat ?? row.latitude), lng = v.num(row.lng ?? row.lon ?? row.longitude);
        insertAddress(db, {
          ...parsed, postal_code: row.postal_code ?? row.postal, neighbourhood: row.neighbourhood ?? row.community,
          lat, lng, geocode_status: lat != null && lng != null ? 'ok' : 'pending', turf_id: turfId,
        });
        created++;
      } catch (e) { errors.push({ row: i + 2, error: e.message }); }
    }));
    audit(db, { user, action: 'addresses.import', detail: { created, skipped, errors: errors.length } });
    return { created, skipped, errors: errors.slice(0, 50), error_count: errors.length,
      pending_geocode: db.prepare("SELECT COUNT(*) AS n FROM addresses WHERE geocode_status = 'pending'").get().n };
  });

  r.post('/api/addresses/geocode', auth('organizer'), async ({ user, body }) => {
    if (!config.mapsServerKey) throw bad('Set GOOGLE_MAPS_SERVER_KEY to geocode addresses with Google Maps');
    if (body.retry_failed) db.prepare("UPDATE addresses SET geocode_status = 'pending' WHERE geocode_status = 'failed'").run();
    const out = await geocodePending(db, config.mapsServerKey, { limit: v.int(body.limit, 1, 2500) ?? 500 });
    audit(db, { user, action: 'addresses.geocode', detail: out });
    return { ...out, remaining: db.prepare("SELECT COUNT(*) AS n FROM addresses WHERE geocode_status = 'pending'").get().n };
  });

  // Bulk-assign addresses to a turf: by explicit ids, a neighbourhood, or a
  // map rectangle (bbox = south,west,north,east).
  r.post('/api/addresses/assign', auth('organizer'), ({ user, body }) => {
    const turfId = body.turf_id === null ? null : v.int(body.turf_id, 1);
    if (body.turf_id !== null && !turfId) throw bad('turf_id is required (or null to unassign)');
    if (turfId && !db.prepare('SELECT 1 FROM turfs WHERE id = ?').get(turfId)) throw notFound('Turf not found');
    let info;
    if (Array.isArray(body.ids) && body.ids.length) {
      const ids = body.ids.map(Number).filter(Number.isInteger).slice(0, 5000);
      info = db.prepare(`UPDATE addresses SET turf_id = ? WHERE id IN (${ids.map(() => '?').join(',')})`).run(turfId, ...ids);
    } else if (Array.isArray(body.bbox) && body.bbox.length === 4) {
      const [s, w, n, e] = body.bbox.map(Number);
      info = db.prepare('UPDATE addresses SET turf_id = ? WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?').run(turfId, s, n, w, e);
    } else if (v.str(body.neighbourhood, 60)) {
      info = db.prepare(`UPDATE addresses SET turf_id = ? WHERE neighbourhood = ? ${body.only_unassigned ? 'AND turf_id IS NULL' : ''}`)
        .run(turfId, body.neighbourhood);
    } else throw bad('Provide ids, bbox, or neighbourhood');
    audit(db, { user, action: 'addresses.assign', entity: 'turf', entityId: turfId, detail: { count: Number(info.changes) } });
    return { updated: Number(info.changes) };
  });

  r.post('/api/addresses', auth('organizer'), ({ user, body }) => {
    const parsed = splitAddress(body);
    if (!parsed) throw bad('street_number and street_name are required');
    const lat = v.num(body.lat), lng = v.num(body.lng);
    const id = insertAddress(db, { ...body, ...parsed, lat, lng,
      geocode_status: lat != null && lng != null ? 'manual' : 'pending' });
    audit(db, { user, action: 'address.create', entity: 'address', entityId: id });
    return { address: addressDetail(db, id) };
  });

  r.get('/api/addresses/:id', auth('organizer'), ({ params }) => {
    const a = addressDetail(db, Number(params.id));
    if (!a) throw notFound('Address not found');
    return { address: a };
  });

  r.patch('/api/addresses/:id', auth('organizer'), ({ user, params, body }) => {
    const id = Number(params.id);
    if (!db.prepare('SELECT 1 FROM addresses WHERE id = ?').get(id)) throw notFound('Address not found');
    const set = {};
    if ('unit' in body) set.unit = v.str(body.unit, 20) ?? '';
    if ('street_number' in body) set.street_number = v.str(body.street_number, 20);
    if ('street_name' in body) set.street_name = v.str(body.street_name, 120);
    if ('postal_code' in body) set.postal_code = normalizePostal(body.postal_code);
    if ('neighbourhood' in body) set.neighbourhood = v.str(body.neighbourhood, 60);
    if ('turf_id' in body) set.turf_id = v.int(body.turf_id, 1);
    if ('do_not_contact' in body) set.do_not_contact = v.bool(body.do_not_contact);
    if ('notes' in body) set.notes = v.str(body.notes, 2000);
    if ('lat' in body && 'lng' in body) {
      set.lat = v.num(body.lat); set.lng = v.num(body.lng);
      set.geocode_status = set.lat != null && set.lng != null ? 'manual' : 'pending';
    }
    if (set.street_number === null || set.street_name === null) throw bad('Street number and name cannot be blank');
    const cols = Object.keys(set);
    if (cols.length) {
      try {
        db.prepare(`UPDATE addresses SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map(c => set[c]), id);
      } catch (e) {
        if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'That address already exists');
        throw e;
      }
    }
    audit(db, { user, action: 'address.update', entity: 'address', entityId: id, detail: cols });
    return { address: addressDetail(db, id) };
  });

  r.delete('/api/addresses/:id', auth('admin'), ({ user, params }) => {
    const id = Number(params.id);
    const info = db.prepare('DELETE FROM addresses WHERE id = ?').run(id);
    if (!info.changes) throw notFound('Address not found');
    audit(db, { user, action: 'address.delete', entity: 'address', entityId: id });
    return { ok: true };
  });

  // ---- turfs ----------------------------------------------------------------
  r.get('/api/turfs', auth('organizer'), () => ({ turfs: stats(db).by_turf.map(t => ({
    ...t, ...db.prepare('SELECT assigned_user_id, notes FROM turfs WHERE id = ?').get(t.id) })) }));

  r.post('/api/turfs', auth('organizer'), ({ user, body }) => {
    const name = v.str(body.name, 80);
    if (!name) throw bad('Turf name is required');
    const info = db.prepare('INSERT INTO turfs (name, neighbourhood, color, assigned_user_id, notes) VALUES (?, ?, ?, ?, ?)')
      .run(name, v.str(body.neighbourhood, 60), color(body.color), v.int(body.assigned_user_id, 1), v.str(body.notes, 1000));
    const id = Number(info.lastInsertRowid);
    audit(db, { user, action: 'turf.create', entity: 'turf', entityId: id });
    return { turf: db.prepare('SELECT * FROM turfs WHERE id = ?').get(id) };
  });

  r.patch('/api/turfs/:id', auth('organizer'), ({ user, params, body }) => {
    const id = Number(params.id);
    const t = db.prepare('SELECT * FROM turfs WHERE id = ?').get(id);
    if (!t) throw notFound('Turf not found');
    db.prepare('UPDATE turfs SET name = ?, neighbourhood = ?, color = ?, assigned_user_id = ?, notes = ? WHERE id = ?').run(
      'name' in body ? (v.str(body.name, 80) ?? t.name) : t.name,
      'neighbourhood' in body ? v.str(body.neighbourhood, 60) : t.neighbourhood,
      'color' in body ? color(body.color) : t.color,
      'assigned_user_id' in body ? v.int(body.assigned_user_id, 1) : t.assigned_user_id,
      'notes' in body ? v.str(body.notes, 1000) : t.notes, id);
    audit(db, { user, action: 'turf.update', entity: 'turf', entityId: id });
    return { turf: db.prepare('SELECT * FROM turfs WHERE id = ?').get(id) };
  });

  r.delete('/api/turfs/:id', auth('organizer'), ({ user, params }) => {
    const id = Number(params.id);
    if (!db.prepare('DELETE FROM turfs WHERE id = ?').run(id).changes) throw notFound('Turf not found');
    audit(db, { user, action: 'turf.delete', entity: 'turf', entityId: id });
    return { ok: true };
  });

  // ---- canvass results log ---------------------------------------------------
  function resultsQuery(query) {
    const where = [], args = [];
    const uid = v.int(query.get('user'), 1);
    if (uid) { where.push('r.user_id = ?'); args.push(uid); }
    const turf = v.int(query.get('turf'), 1);
    if (turf) { where.push('a.turf_id = ?'); args.push(turf); }
    const outcome = v.str(query.get('outcome'), 30);
    if (outcome) { where.push('r.outcome = ?'); args.push(outcome); }
    const since = v.str(query.get('since'), 30);
    if (since) { where.push('r.visited_at >= ?'); args.push(since); }
    return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', args };
  }
  const RESULTS_SELECT = `
    SELECT r.*, u.name AS canvasser, a.unit, a.street_number, a.street_name, a.neighbourhood, t.name AS turf,
           p.first_name, p.last_name
    FROM canvass_results r JOIN addresses a ON a.id = r.address_id LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN turfs t ON t.id = a.turf_id LEFT JOIN people p ON p.id = r.person_id`;

  r.get('/api/results', auth('organizer'), ({ query }) => {
    const { sql, args } = resultsQuery(query);
    const pg = page(query);
    const total = db.prepare(`SELECT COUNT(*) AS n FROM canvass_results r JOIN addresses a ON a.id = r.address_id ${sql}`).get(...args).n;
    const rows = db.prepare(`${RESULTS_SELECT} ${sql} ORDER BY r.visited_at DESC, r.id DESC LIMIT ? OFFSET ?`)
      .all(...args, pg.limit, pg.offset).map(x => parseJsonCols(x, ['issues']));
    return { total, page: pg.page, page_size: pg.page_size, results: rows };
  });

  r.get('/api/results/export.csv', auth('organizer'), ({ query, res }) => {
    const { sql, args } = resultsQuery(query);
    const rows = db.prepare(`${RESULTS_SELECT} ${sql} ORDER BY r.visited_at DESC`).all(...args).map(x => parseJsonCols(x, ['issues']));
    return csvResponse(res, 'starbase-canvass-results.csv', toCsv(rows, ['id', 'visited_at', 'canvasser', 'unit',
      'street_number', 'street_name', 'neighbourhood', 'turf', 'outcome', 'support_level', 'first_name', 'last_name',
      'issues', 'sign_request', 'volunteer', 'notes']));
  });

  // ---- website submissions ---------------------------------------------------
  r.get('/api/submissions', auth('organizer'), ({ query }) => {
    const pg = page(query);
    const total = db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n;
    const rows = db.prepare(`SELECT s.*, p.first_name, p.last_name, p.email FROM submissions s
                             LEFT JOIN people p ON p.id = s.person_id ORDER BY s.id DESC LIMIT ? OFFSET ?`)
      .all(pg.limit, pg.offset).map(s => ({ ...s, payload: JSON.parse(s.payload) }));
    return { total, submissions: rows };
  });

  // ---- users (admin) ---------------------------------------------------------
  r.get('/api/users', auth('organizer'), () => ({
    users: db.prepare(`SELECT u.id, u.email, u.name, u.phone, u.role, u.active, u.created_at,
      (SELECT COUNT(*) FROM canvass_results r WHERE r.user_id = u.id) AS doors
      FROM users u ORDER BY u.active DESC, u.name`).all(),
  }));

  r.post('/api/users', auth('admin'), ({ user, body }) => {
    const email = v.email(body.email);
    const name = v.str(body.name, 80);
    const role = ['admin', 'organizer', 'canvasser'].includes(body.role) ? body.role : 'canvasser';
    const password = String(body.password ?? '');
    if (!email || !name) throw bad('Name and a valid email are required');
    if (password.length < 10) throw bad('Password must be at least 10 characters');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'A user with that email already exists');
    const info = db.prepare('INSERT INTO users (email, name, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(email, name, v.str(body.phone, 40), hashPassword(password), role);
    const id = Number(info.lastInsertRowid);
    audit(db, { user, action: 'user.create', entity: 'user', entityId: id, detail: { role } });
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
  });

  r.patch('/api/users/:id', auth('admin'), ({ user, params, body }) => {
    const id = Number(params.id);
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) throw notFound('User not found');
    if (id === user.id && (body.active === false || (body.role && body.role !== 'admin'))) {
      throw bad("You can't deactivate or demote your own account");
    }
    const role = ['admin', 'organizer', 'canvasser'].includes(body.role) ? body.role : target.role;
    const active = 'active' in body ? v.bool(body.active) : target.active;
    db.prepare('UPDATE users SET name = ?, phone = ?, role = ?, active = ? WHERE id = ?').run(
      v.str(body.name, 80) ?? target.name, 'phone' in body ? v.str(body.phone, 40) : target.phone, role, active, id);
    if (body.password) {
      if (String(body.password).length < 10) throw bad('Password must be at least 10 characters');
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(body.password)), id);
    }
    if (!active || body.password) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    audit(db, { user, action: 'user.update', entity: 'user', entityId: id, detail: { role, active, password_reset: !!body.password } });
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
  });

  // ---- API keys for the website (admin) --------------------------------------
  r.get('/api/keys', auth('admin'), () => ({
    keys: db.prepare('SELECT id, name, kind, prefix, allowed_origins, revoked, last_used_at, created_at FROM api_keys ORDER BY id DESC')
      .all().map(k => ({ ...k, allowed_origins: JSON.parse(k.allowed_origins) })),
  }));

  r.post('/api/keys', auth('admin'), ({ user, body }) => {
    const name = v.str(body.name, 80);
    if (!name) throw bad('Key name is required');
    const kind = body.kind === 'secret' ? 'secret' : 'public';
    const origins = v.list(body.allowed_origins).map(o => o.replace(/\/+$/, ''));
    for (const o of origins) if (!/^https?:\/\/[^/\s]+$/.test(o)) throw bad(`Not a valid origin: ${o} (use e.g. https://imaginesurrey.ca)`);
    const k = createApiKey(db, { name, kind, allowedOrigins: origins });
    audit(db, { user, action: 'apikey.create', entity: 'api_key', entityId: k.id, detail: { kind } });
    return { id: k.id, key: k.key, kind, note: 'Copy this key now — it will not be shown again.' };
  });

  r.delete('/api/keys/:id', auth('admin'), ({ user, params }) => {
    const id = Number(params.id);
    if (!db.prepare('UPDATE api_keys SET revoked = 1 WHERE id = ?').run(id).changes) throw notFound('Key not found');
    audit(db, { user, action: 'apikey.revoke', entity: 'api_key', entityId: id });
    return { ok: true };
  });

  r.get('/api/audit', auth('admin'), ({ query }) => {
    const pg = page(query);
    return { entries: db.prepare(`SELECT l.*, u.name AS user_name FROM audit_log l LEFT JOIN users u ON u.id = l.user_id
                                  ORDER BY l.id DESC LIMIT ? OFFSET ?`).all(pg.limit, pg.offset) };
  });

  // ---- website: public forms and counters (pk_ key) --------------------------
  r.post('/api/public/forms/:form', apiKey('public'), ({ req, params, body, apiKey: key }) => {
    const form = params.form;
    if (!PUBLIC_FORMS.includes(form)) throw notFound(`Unknown form. Use one of: ${PUBLIC_FORMS.join(', ')}`);
    if (!formLimit(clientIp(req) + form)) throw new HttpError(429, 'Too many submissions. Please try again shortly.');
    // Honeypot: a field humans never see. Bots that fill it get a fake success.
    if (v.str(body.website ?? body._hp, 200)) return { ok: true };
    const email = v.email(body.email);
    if (!email && !v.str(body.phone, 40)) throw bad('Please include an email address or phone number');
    const name = splitName(body);
    const input = {
      ...name, email: email ?? undefined, phone: body.phone, postal_code: body.postal_code ?? body.postal,
      street_address: body.address ?? body.street_address,
      email_opt_in: body.email_opt_in ?? body.subscribe ?? (form === 'signup' ? 1 : 0),
      volunteer: form === 'volunteer' || v.bool(body.volunteer),
      sign_request: form === 'sign' || v.bool(body.sign_request),
      donor: form === 'pledge' ? 1 : undefined,
      tags: [`web:${form}`, ...v.list(body.tags, 5)],
      issues: body.issues,
      notes: v.str(body.message ?? body.notes, 2000) ? `[website ${form}] ${v.str(body.message ?? body.notes, 2000)}` : undefined,
    };
    for (const k of Object.keys(input)) if (input[k] === undefined) delete input[k];
    const out = tx(db, () => {
      const res = upsertPerson(db, input, 'website');
      db.prepare('INSERT INTO submissions (form, person_id, payload, origin) VALUES (?, ?, ?, ?)')
        .run(form, res.id, JSON.stringify(redactPayload(body)), v.str(req.headers.origin, 200));
      audit(db, { actor: `apikey:${key.prefix}`, action: 'website.submit', entity: 'person', entityId: res.id, detail: { form } });
      return res;
    });
    emitWebhook(out.created ? 'person.created' : 'person.updated', getPerson(db, out.id), config.env);
    return { ok: true, message: 'Thanks! We’ll be in touch.' };
  });

  r.get('/api/public/stats', apiKey('public'), () => publicStats(db));

  // ---- server-to-server sync (sk_ key) ----------------------------------------
  r.get('/api/v1/people', apiKey('secret'), ({ query }) => {
    const pg = page(query);
    const since = v.str(query.get('updated_since'), 30);
    const rows = db.prepare(`SELECT * FROM people ${since ? 'WHERE updated_at >= ?' : ''} ORDER BY updated_at, id LIMIT ? OFFSET ?`)
      .all(...(since ? [since] : []), pg.limit, pg.offset).map(p => parseJsonCols(p));
    return { page: pg.page, page_size: pg.page_size, people: rows };
  });

  r.post('/api/v1/people', apiKey('secret'), ({ body, apiKey: key }) => {
    const list = Array.isArray(body.people) ? body.people.slice(0, 1000) : [body];
    const results = tx(db, () => list.map((p) => {
      try { return { ok: true, ...upsertPerson(db, p, v.str(p.source, 30) || 'website') }; }
      catch (e) { return { ok: false, error: e.message }; }
    }));
    audit(db, { actor: `apikey:${key.prefix}`, action: 'v1.people.upsert', detail: { count: list.length } });
    return { results };
  });

  r.get('/api/v1/stats', apiKey('secret'), () => {
    const s = stats(db);
    delete s.leaderboard; // names of volunteers stay inside Starbase
    return s;
  });

  r.get('/api/health', () => ({ ok: true, app: 'Starbase' }));

  return r;
}

// ---- helpers -----------------------------------------------------------------

// Canvassers see who lives at a door and how they lean, but not residents'
// email addresses or phone numbers — the contact list stays with organizers.
function forRole(user, address) {
  if (hasRole(user, 'organizer')) return address;
  return { ...address, people: address.people.map(({ email, phone, ...p }) => ({ ...p, has_email: !!email, has_phone: !!phone })) };
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, active: u.active };
}

function color(c) {
  return /^#[0-9a-f]{6}$/i.test(String(c ?? '')) ? c : '#6d28d9';
}

function csvResponse(res, filename, text) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  res.end(text);
  return undefined;
}

function splitName(body) {
  if (body.first_name || body.last_name) return { first_name: body.first_name, last_name: body.last_name };
  const full = v.str(body.name, 160);
  if (!full) return {};
  const parts = full.split(/\s+/);
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

function redactPayload(body) {
  const out = {};
  for (const [k, val] of Object.entries(body ?? {})) {
    if (/pass|token|key|card|cvv/i.test(k)) continue;
    out[k] = typeof val === 'string' ? val.slice(0, 2000) : val;
  }
  return out;
}

// Accepts either split columns or one "address" column like "14250 104 Ave"
// or "305-10180 153 St". Street names are title-cased so imports dedupe.
export function splitAddress(row) {
  let num = v.str(row.street_number ?? row.number ?? row.house_number, 20);
  let street = v.str(row.street_name ?? row.street, 120);
  let unit = v.str(row.unit ?? row.suite ?? row.apt, 20) ?? '';
  const full = v.str(row.address ?? row.street_address ?? row.full_address, 200);
  if ((!num || !street) && full) {
    const m = /^(?:(?:unit|suite|apt|#)\s*)?(?:([\w]+)\s*-\s*)?(\d+[A-Za-z]?)\s+(.+?)(?:,.*)?$/i.exec(full);
    if (!m) return null;
    unit = unit || m[1] || '';
    num = m[2];
    street = m[3];
  }
  if (!num || !street) return null;
  street = street.replace(/\s+/g, ' ').replace(/\b([a-z])([a-z]*)/gi, (_, a, b) => a.toUpperCase() + b.toLowerCase())
    .replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, n, s) => n + s.toLowerCase())
    .replace(/\b([NSEW])([ew])\b/gi, (m) => m.toUpperCase());
  return { street_number: num.toUpperCase(), street_name: street, unit: unit.toUpperCase() };
}

export function insertAddress(db, a) {
  const parsed = a.street_number && a.street_name ? { street_number: String(a.street_number).toUpperCase(),
    street_name: a.street_name, unit: String(a.unit ?? '').toUpperCase() } : splitAddress(a);
  if (!parsed) throw bad('street_number and street_name are required');
  try {
    const info = db.prepare(`INSERT INTO addresses
      (street_number, street_name, unit, postal_code, neighbourhood, lat, lng, geocode_status, turf_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      parsed.street_number, parsed.street_name, parsed.unit, normalizePostal(a.postal_code),
      v.str(a.neighbourhood, 60), a.lat ?? null, a.lng ?? null, a.geocode_status ?? 'pending',
      v.int(a.turf_id, 1), v.str(a.notes, 2000));
    return Number(info.lastInsertRowid);
  } catch (e) {
    if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'That address is already in the canvass list');
    throw e;
  }
}
