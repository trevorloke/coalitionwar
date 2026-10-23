// Domain logic shared by the staff API, the canvassing API and the website
// integration: merging people, recording door knocks, and reporting.

import crypto from 'node:crypto';
import { tx, audit, parseJsonCols, OUTCOMES } from './db.js';
import { v, bad, notFound } from './http.js';

export const ISSUES = [
  'Public safety', 'Housing affordability', 'Transit & SkyTrain', 'Traffic & roads',
  'Taxes & city spending', 'Parks & recreation', 'Development & density', 'Healthcare & hospital',
  'Schools', 'Environment & trees', 'Local business', 'Accountability at City Hall',
];

const PERSON_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'address_id', 'street_address',
  'postal_code', 'support_level', 'volunteer', 'sign_request', 'donor', 'email_opt_in', 'tags', 'issues',
  'notes'];

export function normalizePhone(p) {
  const s = v.str(p, 40);
  if (!s) return null;
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return s;
}

export function normalizePostal(p) {
  const s = v.str(p, 10);
  if (!s) return null;
  const c = s.toUpperCase().replace(/\s+/g, '');
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(c) ? `${c.slice(0, 3)} ${c.slice(3)}` : s.toUpperCase();
}

// Coerce untrusted input into person columns. Only keys present in `input`
// are returned, so a PATCH touches only what it names.
export function cleanPerson(input) {
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);
  if (has('first_name')) out.first_name = v.str(input.first_name, 80) ?? '';
  if (has('last_name')) out.last_name = v.str(input.last_name, 80) ?? '';
  if (has('email')) {
    out.email = v.email(input.email);
    if (input.email && !out.email) throw bad('Invalid email address');
  }
  if (has('phone')) out.phone = normalizePhone(input.phone);
  if (has('address_id')) out.address_id = v.int(input.address_id, 1);
  if (has('street_address')) out.street_address = v.str(input.street_address, 200);
  if (has('postal_code')) out.postal_code = normalizePostal(input.postal_code);
  if (has('support_level')) out.support_level = v.int(input.support_level, 1, 5);
  for (const k of ['volunteer', 'sign_request', 'donor', 'email_opt_in']) if (has(k)) out[k] = v.bool(input[k]);
  if (has('tags')) out.tags = JSON.stringify(v.list(input.tags));
  if (has('issues')) out.issues = JSON.stringify(v.list(input.issues));
  if (has('notes')) out.notes = v.str(input.notes, 4000);
  return out;
}

export function getPerson(db, id) {
  const p = db.prepare(`
    SELECT p.*, a.street_number, a.street_name, a.unit, a.neighbourhood
    FROM people p LEFT JOIN addresses a ON a.id = p.address_id WHERE p.id = ?`).get(id);
  return p ? parseJsonCols(p) : null;
}

export function insertPerson(db, data, source) {
  const cols = Object.keys(data).filter(k => PERSON_FIELDS.includes(k));
  const info = db.prepare(`INSERT INTO people (${[...cols, 'source'].join(', ')})
                           VALUES (${[...cols, 'source'].map(() => '?').join(', ')})`)
    .run(...cols.map(k => data[k]), source);
  return Number(info.lastInsertRowid);
}

export function updatePerson(db, id, data) {
  const cols = Object.keys(data).filter(k => PERSON_FIELDS.includes(k));
  if (!cols.length) return;
  db.prepare(`UPDATE people SET ${cols.map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .run(...cols.map(k => data[k]), id);
}

// Find an existing record for this person: email first, then phone, then
// (name + same address). Website sign-ups and door knocks for the same
// person collapse into one record instead of piling up duplicates.
export function findMatch(db, data) {
  if (data.email) {
    const r = db.prepare('SELECT id FROM people WHERE email = ? ORDER BY id LIMIT 1').get(data.email);
    if (r) return r.id;
  }
  if (data.phone) {
    const r = db.prepare('SELECT id FROM people WHERE phone = ? ORDER BY id LIMIT 1').get(data.phone);
    if (r) return r.id;
  }
  if (data.address_id && data.first_name) {
    const r = db.prepare(`SELECT id FROM people WHERE address_id = ? AND lower(first_name) = lower(?)
                          AND lower(last_name) = lower(?) ORDER BY id LIMIT 1`)
      .get(data.address_id, data.first_name, data.last_name ?? '');
    if (r) return r.id;
  }
  return null;
}

// Merge rules: blank incoming values never erase existing ones; yes/no flags
// only ever turn on (a later "no" doesn't un-volunteer someone — staff do
// that by editing); tags and issues are unioned; support level takes the
// newest non-empty value.
export function mergePerson(existing, incoming) {
  const out = {};
  for (const [k, val] of Object.entries(incoming)) {
    if (['volunteer', 'sign_request', 'donor', 'email_opt_in'].includes(k)) {
      if (val && !existing[k]) out[k] = 1;
    } else if (k === 'tags' || k === 'issues') {
      const prev = Array.isArray(existing[k]) ? existing[k] : JSON.parse(existing[k] || '[]');
      const merged = [...new Set([...prev, ...JSON.parse(val)])];
      if (merged.length !== prev.length) out[k] = JSON.stringify(merged);
    } else if (k === 'notes') {
      if (val && val !== existing.notes) out.notes = existing.notes ? `${existing.notes}\n${val}` : val;
    } else if (val != null && val !== '' && val !== existing[k]) {
      out[k] = val;
    }
  }
  return out;
}

export function upsertPerson(db, input, source) {
  const data = cleanPerson(input);
  const id = findMatch(db, data);
  if (id) {
    const existing = db.prepare('SELECT * FROM people WHERE id = ?').get(id);
    const changes = mergePerson(existing, data);
    updatePerson(db, id, changes);
    return { id, created: false, changed: Object.keys(changes) };
  }
  return { id: insertPerson(db, data, source), created: true, changed: Object.keys(data) };
}

// ---- Canvassing -----------------------------------------------------------

export function markerStatus(a) {
  if (a.do_not_contact) return 'dnc';
  if (!a.visit_count) return 'unvisited';
  if (a.last_outcome === 'spoke') return a.last_support_level ? `support${a.last_support_level}` : 'spoke';
  if (a.last_outcome === 'not_home' || a.last_outcome === 'come_back') return 'retry';
  return 'closed';
}

export function cleanResult(input) {
  const outcome = v.str(input.outcome, 30);
  if (!OUTCOMES.includes(outcome)) throw bad(`outcome must be one of: ${OUTCOMES.join(', ')}`);
  const addressId = v.int(input.address_id, 1);
  if (!addressId) throw bad('address_id is required');
  const visitedAt = v.str(input.visited_at, 40);
  let visited = null;
  if (visitedAt) {
    const d = new Date(visitedAt);
    // Offline entries keep the time they were taken, but not a future time.
    if (!Number.isNaN(d.getTime())) visited = new Date(Math.min(d.getTime(), Date.now())).toISOString().replace('T', ' ').slice(0, 19);
  }
  return {
    client_id: v.str(input.client_id, 80),
    address_id: addressId,
    outcome,
    support_level: outcome === 'spoke' ? v.int(input.support_level, 1, 5) : null,
    issues: JSON.stringify(outcome === 'spoke' ? v.list(input.issues) : []),
    sign_request: outcome === 'spoke' ? v.bool(input.sign_request) : 0,
    volunteer: outcome === 'spoke' ? v.bool(input.volunteer) : 0,
    notes: v.str(input.notes, 2000),
    visited_at: visited,
  };
}

// Record one door knock. Idempotent on client_id so a phone that retries an
// offline upload never double-counts a door.
export function recordResult(db, user, input) {
  const r = cleanResult(input);
  if (r.client_id) {
    const dup = db.prepare('SELECT id, person_id FROM canvass_results WHERE client_id = ?').get(r.client_id);
    if (dup) return { id: dup.id, person_id: dup.person_id, duplicate: true };
  }
  const address = db.prepare('SELECT * FROM addresses WHERE id = ?').get(r.address_id);
  if (!address) throw notFound('Address not found');

  return tx(db, () => {
    let personId = null;
    const p = input.person;
    if (r.outcome === 'spoke' && p && (p.id || p.first_name || p.last_name || p.email || p.phone)) {
      const personInput = {
        ...p,
        address_id: address.id,
        street_address: `${address.unit ? address.unit + '-' : ''}${address.street_number} ${address.street_name}`,
        postal_code: address.postal_code,
        support_level: r.support_level,
        issues: JSON.parse(r.issues),
        sign_request: r.sign_request,
        volunteer: r.volunteer,
      };
      const pid = v.int(p.id, 1);
      if (pid && db.prepare('SELECT 1 FROM people WHERE id = ? AND address_id = ?').get(pid, address.id)) {
        const existing = db.prepare('SELECT * FROM people WHERE id = ?').get(pid);
        updatePerson(db, pid, mergePerson(existing, cleanPerson(personInput)));
        personId = pid;
      } else {
        delete personInput.id;
        personId = upsertPerson(db, personInput, 'canvass').id;
      }
    }

    const info = db.prepare(`INSERT INTO canvass_results
      (client_id, address_id, person_id, user_id, outcome, support_level, issues, sign_request, volunteer, notes, visited_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`)
      .run(r.client_id, address.id, personId, user?.id ?? null, r.outcome, r.support_level, r.issues,
        r.sign_request, r.volunteer, r.notes, r.visited_at);

    db.prepare(`UPDATE addresses SET
        visit_count = visit_count + 1,
        last_outcome = ?,
        last_support_level = CASE WHEN ? IS NOT NULL THEN ? ELSE last_support_level END,
        last_visited_at = COALESCE(?, datetime('now')),
        do_not_contact = CASE WHEN ? = 'do_not_contact' THEN 1 ELSE do_not_contact END
      WHERE id = ?`)
      .run(r.outcome, r.support_level, r.support_level, r.visited_at, r.outcome, address.id);

    const id = Number(info.lastInsertRowid);
    audit(db, { user, action: 'canvass.result', entity: 'address', entityId: address.id, detail: { result: id, outcome: r.outcome } });
    return { id, person_id: personId, duplicate: false };
  });
}

export function addressDetail(db, id) {
  const a = db.prepare(`SELECT a.*, t.name AS turf_name, t.color AS turf_color
                        FROM addresses a LEFT JOIN turfs t ON t.id = a.turf_id WHERE a.id = ?`).get(id);
  if (!a) return null;
  const people = db.prepare(`SELECT id, first_name, last_name, phone, email, support_level, volunteer,
                             sign_request, email_opt_in, issues, tags FROM people WHERE address_id = ? ORDER BY id`)
    .all(id).map(p => parseJsonCols(p));
  const history = db.prepare(`
    SELECT r.id, r.outcome, r.support_level, r.issues, r.sign_request, r.volunteer, r.notes, r.visited_at,
           u.name AS canvasser, p.first_name, p.last_name
    FROM canvass_results r LEFT JOIN users u ON u.id = r.user_id LEFT JOIN people p ON p.id = r.person_id
    WHERE r.address_id = ? ORDER BY r.visited_at DESC, r.id DESC LIMIT 50`).all(id).map(r => parseJsonCols(r, ['issues']));
  return { ...a, status: markerStatus(a), people, history };
}

// ---- Reporting ------------------------------------------------------------

export function stats(db, { since } = {}) {
  const one = (sql, ...args) => Object.values(db.prepare(sql).get(...args))[0] ?? 0;
  const sinceClause = since ? 'AND visited_at >= ?' : '';
  const sinceArgs = since ? [since] : [];
  const supportRows = db.prepare(`SELECT support_level AS level, COUNT(*) AS n FROM people
                                  WHERE support_level IS NOT NULL GROUP BY support_level`).all();
  const byTurf = db.prepare(`
    SELECT t.id, t.name, t.color, t.neighbourhood, u.name AS canvasser,
      COUNT(a.id) AS doors,
      SUM(CASE WHEN a.visit_count > 0 THEN 1 ELSE 0 END) AS knocked,
      SUM(CASE WHEN a.last_outcome = 'spoke' THEN 1 ELSE 0 END) AS contacted,
      SUM(CASE WHEN a.last_support_level IN (1,2) THEN 1 ELSE 0 END) AS supporters
    FROM turfs t LEFT JOIN addresses a ON a.turf_id = t.id LEFT JOIN users u ON u.id = t.assigned_user_id
    GROUP BY t.id ORDER BY t.name`).all();
  const leaderboard = db.prepare(`
    SELECT u.id, u.name, COUNT(r.id) AS doors,
      SUM(CASE WHEN r.outcome = 'spoke' THEN 1 ELSE 0 END) AS conversations
    FROM canvass_results r JOIN users u ON u.id = r.user_id
    WHERE 1=1 ${sinceClause.replace('visited_at', 'r.visited_at')}
    GROUP BY u.id ORDER BY doors DESC LIMIT 10`).all(...sinceArgs);
  const daily = db.prepare(`
    SELECT date(visited_at) AS day, COUNT(*) AS doors,
      SUM(CASE WHEN outcome = 'spoke' THEN 1 ELSE 0 END) AS conversations
    FROM canvass_results WHERE visited_at >= date('now', '-29 days')
    GROUP BY day ORDER BY day`).all();
  const issues = db.prepare(`
    SELECT j.value AS issue, COUNT(*) AS n FROM canvass_results r, json_each(r.issues) j
    GROUP BY j.value ORDER BY n DESC LIMIT 12`).all();
  return {
    people: one('SELECT COUNT(*) FROM people'),
    supporters: one('SELECT COUNT(*) FROM people WHERE support_level IN (1,2)'),
    volunteers: one('SELECT COUNT(*) FROM people WHERE volunteer = 1'),
    sign_requests: one('SELECT COUNT(*) FROM people WHERE sign_request = 1'),
    email_opt_ins: one('SELECT COUNT(*) FROM people WHERE email_opt_in = 1'),
    addresses: one('SELECT COUNT(*) FROM addresses'),
    addresses_geocoded: one("SELECT COUNT(*) FROM addresses WHERE lat IS NOT NULL"),
    addresses_pending_geocode: one("SELECT COUNT(*) FROM addresses WHERE geocode_status = 'pending'"),
    doors_knocked: one(`SELECT COUNT(*) FROM canvass_results WHERE 1=1 ${sinceClause}`, ...sinceArgs),
    conversations: one(`SELECT COUNT(*) FROM canvass_results WHERE outcome = 'spoke' ${sinceClause}`, ...sinceArgs),
    unique_doors: one('SELECT COUNT(*) FROM addresses WHERE visit_count > 0'),
    website_submissions: one('SELECT COUNT(*) FROM submissions'),
    support: Object.fromEntries([1, 2, 3, 4, 5].map(l => [l, supportRows.find(r => r.level === l)?.n ?? 0])),
    by_turf: byTurf,
    leaderboard,
    daily,
    issues,
  };
}

// Only aggregate, non-identifying numbers — safe for a public website counter.
export function publicStats(db) {
  const s = stats(db);
  return {
    doors_knocked: s.doors_knocked,
    conversations: s.conversations,
    volunteers: s.volunteers,
    sign_requests: s.sign_requests,
    supporters: s.supporters,
  };
}

// ---- Outbound webhook (Starbase → website/CRM) -----------------------------
// If STARBASE_WEBHOOK_URL is set, person changes are POSTed there, signed with
// HMAC-SHA256 of the raw body in the X-Starbase-Signature header.

export function emitWebhook(event, data, env = process.env, fetchImpl = fetch) {
  const url = env.STARBASE_WEBHOOK_URL;
  if (!url) return Promise.resolve(false);
  const body = JSON.stringify({ event, data, sent_at: new Date().toISOString() });
  const sig = crypto.createHmac('sha256', env.STARBASE_WEBHOOK_SECRET || '').update(body).digest('hex');
  return fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Starbase-Event': event, 'X-Starbase-Signature': `sha256=${sig}` },
    body,
  }).then(r => r.ok, () => false);
}
