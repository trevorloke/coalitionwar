import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createServer, loadConfig } from '../server/index.js';
import { hashPassword, createApiKey } from '../server/auth.js';
import { splitAddress } from '../server/api.js';
import { parseCsv, toCsv } from '../server/csv.js';
import { geocodePending } from '../server/geocode.js';
import { seedDemo, gridLat, gridLng } from '../server/seed.js';

let server, base, db;
const tokens = {};
let publicKey, secretKey;

async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

before(async () => {
  db = openDb(':memory:');
  for (const [email, role] of [['admin@t.ca', 'admin'], ['org@t.ca', 'organizer'], ['can@t.ca', 'canvasser']]) {
    db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(email, role, hashPassword('password123'), role);
  }
  publicKey = createApiKey(db, { name: 'site', kind: 'public', allowedOrigins: ['https://imaginesurrey.ca'] }).key;
  secretKey = createApiKey(db, { name: 'sync', kind: 'secret' }).key;
  const config = { ...loadConfig({}), env: {} };
  server = createServer({ db, config });
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, email] of [['admin', 'admin@t.ca'], ['org', 'org@t.ca'], ['can', 'can@t.ca']]) {
    const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'password123' } });
    assert.equal(r.status, 200);
    tokens[k] = r.data.token;
  }
});

after(() => server.close());

test('login rejects a wrong password and unknown users', async () => {
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'org@t.ca', password: 'nope' } })).status, 401);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'x@t.ca', password: 'password123' } })).status, 401);
  assert.equal((await call('/api/me')).status, 401);
});

test('roles: canvassers cannot read the people database or manage the team', async () => {
  assert.equal((await call('/api/people', { token: tokens.can })).status, 403);
  assert.equal((await call('/api/stats', { token: tokens.can })).status, 403);
  assert.equal((await call('/api/users', { method: 'POST', token: tokens.org, body: {} })).status, 403);
  assert.equal((await call('/api/keys', { token: tokens.org })).status, 403);
  assert.equal((await call('/api/people', { token: tokens.org })).status, 200);
});

test('address import parses Surrey addresses, dedupes, and keeps coordinates', async () => {
  const csv = 'address,postal_code,neighbourhood,lat,lng\n'
    + '14250 104 ave,v3t1x1,City Centre / Whalley,49.191,-122.83\n'
    + '305-10180 153 St,,Guildford,,\n'
    + '14250 104 Ave,,,,\n'
    + 'no number here,,,,\n';
  const r = await call('/api/addresses/import', { method: 'POST', token: tokens.org, body: { csv } });
  assert.equal(r.status, 200);
  assert.equal(r.data.created, 2);
  assert.equal(r.data.skipped, 1);
  assert.equal(r.data.error_count, 1);
  assert.equal(r.data.pending_geocode, 1);
  const list = await call('/api/addresses?q=104', { token: tokens.org });
  assert.equal(list.data.addresses[0].street_name, '104 Ave');
  assert.equal(list.data.addresses[0].postal_code, 'V3T 1X1');
  assert.deepEqual(splitAddress({ address: '305-10180 153 st' }), { street_number: '10180', street_name: '153 St', unit: '305' });
});

test('canvassing: record a conversation, create the resident, update the map status', async () => {
  const addr = db.prepare("SELECT id FROM addresses WHERE street_number = '14250'").get();
  const entry = {
    client_id: 'phone-abc-1', address_id: addr.id, outcome: 'spoke', support_level: 1,
    issues: ['Public safety'], sign_request: true,
    person: { first_name: 'Aman', last_name: 'Gill', phone: '604 555 1234', email: 'aman@example.com' },
  };
  const r = await call('/api/canvass/results', { method: 'POST', token: tokens.can, body: entry });
  assert.equal(r.status, 200);
  assert.equal(r.data.address.status, 'support1');
  // Canvassers see the resident's name but not their contact details.
  assert.equal(r.data.address.people[0].first_name, 'Aman');
  assert.equal(r.data.address.people[0].email, undefined);
  assert.equal(r.data.address.people[0].phone, undefined);
  // Retried upload from a flaky connection is not double-counted.
  const again = await call('/api/canvass/results', { method: 'POST', token: tokens.can, body: entry });
  assert.equal(again.data.result.duplicate, true);
  const p = db.prepare('SELECT * FROM people WHERE email = ?').get('aman@example.com');
  assert.equal(p.phone, '(604) 555-1234');
  assert.equal(p.sign_request, 1);
  assert.equal(p.support_level, 1);
  assert.equal(db.prepare('SELECT visit_count FROM addresses WHERE id = ?').get(addr.id).visit_count, 1);
  // Organizers do see contact details.
  const org = await call(`/api/addresses/${addr.id}`, { token: tokens.org });
  assert.equal(org.data.address.people[0].email, 'aman@example.com');
});

test('offline batch: good entries land, bad ones are reported without blocking', async () => {
  const addr = db.prepare("SELECT id FROM addresses WHERE street_number = '14250'").get();
  const r = await call('/api/canvass/results/batch', { method: 'POST', token: tokens.can, body: { results: [
    { client_id: 'q1', address_id: addr.id, outcome: 'not_home', visited_at: '2026-01-02T18:00:00Z' },
    { client_id: 'q2', address_id: addr.id, outcome: 'teleported' },
    { client_id: 'q3', address_id: 999999, outcome: 'not_home' },
  ] } });
  assert.deepEqual(r.data.results.map(x => x.ok), [true, false, false]);
  assert.equal(r.data.results[1].retry, false);
  const row = db.prepare("SELECT visited_at FROM canvass_results WHERE client_id = 'q1'").get();
  assert.equal(row.visited_at, '2026-01-02 18:00:00');
});

test('do-not-contact flags the address', async () => {
  const addr = db.prepare("SELECT id FROM addresses WHERE street_number = '10180'").get();
  db.prepare('UPDATE addresses SET lat = 49.18, lng = -122.80 WHERE id = ?').run(addr.id);
  const r = await call('/api/canvass/results', { method: 'POST', token: tokens.can, body: { address_id: addr.id, outcome: 'do_not_contact' } });
  assert.equal(r.data.address.status, 'dnc');
  const map = await call('/api/canvass/addresses?bbox=49.1,-122.9,49.2,-122.7', { token: tokens.can });
  assert.equal(map.data.addresses.find(a => a.id === addr.id).status, 'dnc');
});

test('website form merges into the person the canvasser met (by email)', async () => {
  const r = await call('/api/public/forms/volunteer', { method: 'POST',
    headers: { 'X-Starbase-Key': publicKey, Origin: 'https://imaginesurrey.ca' },
    body: { name: 'Aman Gill', email: 'AMAN@example.com', message: 'Can help weekends' } });
  assert.equal(r.status, 200);
  // CORS follows the origins configured on the public key.
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://imaginesurrey.ca');
  const pre = await fetch(`${base}/api/public/forms/signup`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
  assert.equal(pre.headers.get('access-control-allow-origin'), null);
  const people = db.prepare("SELECT * FROM people WHERE email = 'aman@example.com'").all();
  assert.equal(people.length, 1);
  assert.equal(people[0].volunteer, 1);
  assert.equal(people[0].sign_request, 1, 'existing flags are kept');
  assert.match(people[0].notes, /Can help weekends/);
  assert.ok(JSON.parse(people[0].tags).includes('web:volunteer'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n, 1);
});

test('website forms: origin lock, key required, honeypot, validation', async () => {
  const body = { email: 'x@example.com' };
  assert.equal((await call('/api/public/forms/signup', { method: 'POST', body })).status, 401);
  assert.equal((await call('/api/public/forms/signup', { method: 'POST', body, headers: { 'X-Starbase-Key': publicKey, Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await call('/api/public/forms/nope', { method: 'POST', body, headers: { 'X-Starbase-Key': publicKey } })).status, 404);
  assert.equal((await call('/api/public/forms/signup', { method: 'POST', body: { name: 'No contact' }, headers: { 'X-Starbase-Key': publicKey } })).status, 400);
  const before = db.prepare('SELECT COUNT(*) AS n FROM people').get().n;
  const bot = await call('/api/public/forms/signup', { method: 'POST', body: { email: 'bot@spam.com', website: 'http://spam' }, headers: { 'X-Starbase-Key': publicKey } });
  assert.equal(bot.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM people').get().n, before);
  // Public keys can't use the server-to-server API.
  assert.equal((await call('/api/v1/people', { headers: { Authorization: `Bearer ${publicKey}` } })).status, 401);
  const stats = await call('/api/public/stats', { headers: { 'X-Starbase-Key': publicKey } });
  assert.deepEqual(Object.keys(stats.data).sort(), ['conversations', 'doors_knocked', 'sign_requests', 'supporters', 'volunteers']);
});

test('secret key sync: upsert and read people', async () => {
  const auth = { Authorization: `Bearer ${secretKey}` };
  const r = await call('/api/v1/people', { method: 'POST', headers: auth, body: { people: [
    { email: 'new@example.com', first_name: 'New', donor: true }, { email: 'not-an-email' },
  ] } });
  assert.equal(r.data.results[0].created, true);
  assert.equal(r.data.results[1].ok, false);
  const list = await call('/api/v1/people?page_size=500', { headers: auth });
  assert.ok(list.data.people.some(p => p.email === 'new@example.com' && p.donor === 1));
  const s = await call('/api/v1/stats', { headers: auth });
  assert.equal(s.data.leaderboard, undefined);
});

test('people CSV round trip, with spreadsheet formula injection neutralised', async () => {
  const csv = 'first_name,last_name,email,phone,support_level,volunteer,tags\n'
    + 'Priya,Sandhu,priya@example.com,6045550000,2,yes,"donor-prospect;newton"\n'
    + '=HYPERLINK("x"),Evil,evil@example.com,,,,\n';
  const r = await call('/api/people/import', { method: 'POST', token: tokens.org, body: { csv } });
  assert.equal(r.data.created, 2);
  const res = await fetch(`${base}/api/people/export.csv`, { headers: { Authorization: `Bearer ${tokens.org}` } });
  const text = await res.text();
  assert.match(text, /Priya,Sandhu,priya@example.com,\(604\) 555-0000/);
  assert.match(text, /"'=HYPERLINK\(""x""\)"/);
  const rows = parseCsv(toCsv([{ a: 'x, "y"\nz' }]));
  assert.equal(rows[0].a, 'x, "y"\nz');
});

test('people API: create, conflict on duplicate email, patch, admin-only delete', async () => {
  const c = await call('/api/people', { method: 'POST', token: tokens.org, body: { first_name: 'Mei', email: 'mei@example.com' } });
  assert.equal(c.status, 200);
  assert.equal((await call('/api/people', { method: 'POST', token: tokens.org, body: { email: 'MEI@example.com' } })).status, 409);
  const p = await call(`/api/people/${c.data.person.id}`, { method: 'PATCH', token: tokens.org, body: { support_level: 3, tags: 'a, b' } });
  assert.equal(p.data.person.support_level, 3);
  assert.deepEqual(p.data.person.tags, ['a', 'b']);
  assert.equal((await call(`/api/people/${c.data.person.id}`, { method: 'DELETE', token: tokens.org })).status, 403);
  assert.equal((await call(`/api/people/${c.data.person.id}`, { method: 'DELETE', token: tokens.admin })).status, 200);
});

test('turfs and bulk assignment', async () => {
  const t = await call('/api/turfs', { method: 'POST', token: tokens.org, body: { name: 'Whalley North', neighbourhood: 'City Centre / Whalley', color: '#123456' } });
  const a = await call('/api/addresses/assign', { method: 'POST', token: tokens.org, body: { turf_id: t.data.turf.id, neighbourhood: 'City Centre / Whalley' } });
  assert.equal(a.data.updated, 1);
  const map = await call(`/api/canvass/addresses?turf=${t.data.turf.id}`, { token: tokens.can });
  assert.equal(map.data.addresses.length, 1);
  assert.equal(map.data.addresses[0].turf_color, '#123456');
});

test('users: admin creates canvassers; deactivation ends their sessions', async () => {
  const u = await call('/api/users', { method: 'POST', token: tokens.admin, body: { email: 'vol@t.ca', name: 'Vol', password: 'password123' } });
  assert.equal(u.data.user.role, 'canvasser');
  const login = await call('/api/auth/login', { method: 'POST', body: { email: 'vol@t.ca', password: 'password123' } });
  await call(`/api/users/${u.data.user.id}`, { method: 'PATCH', token: tokens.admin, body: { active: false } });
  assert.equal((await call('/api/me', { token: login.data.token })).status, 401);
  assert.equal((await call('/api/users/1', { method: 'PATCH', token: tokens.admin, body: { role: 'canvasser' } })).status, 400);
});

test('geocoding uses the Google response and rejects results outside Surrey', async () => {
  const gdb = openDb(':memory:');
  gdb.prepare("INSERT INTO addresses (street_number, street_name) VALUES ('14250', '104 Ave'), ('1', 'Elsewhere Rd'), ('2', 'Nowhere St')").run();
  const fakeFetch = async (url) => {
    const u = new URL(url);
    assert.equal(u.searchParams.get('key'), 'server-key');
    const addr = u.searchParams.get('address');
    const body = addr.startsWith('14250') ? { status: 'OK', results: [{ geometry: { location: { lat: 49.19, lng: -122.83 } }, address_components: [{ types: ['postal_code'], long_name: 'V3T 1X1' }], formatted_address: '' }] }
      : addr.startsWith('1 ') ? { status: 'OK', results: [{ geometry: { location: { lat: 49.28, lng: -123.12 } }, address_components: [] }] } // Vancouver
        : { status: 'ZERO_RESULTS', results: [] };
    return { json: async () => body };
  };
  const out = await geocodePending(gdb, 'server-key', { fetchImpl: fakeFetch });
  assert.deepEqual({ geocoded: out.geocoded, failed: out.failed }, { geocoded: 1, failed: 2 });
  const row = gdb.prepare("SELECT * FROM addresses WHERE street_number = '14250'").get();
  assert.equal(row.postal_code, 'V3T 1X1');
  assert.equal(row.geocode_status, 'ok');
  // A quota error stops the batch and leaves rows pending for a retry.
  gdb.prepare("UPDATE addresses SET geocode_status = 'pending'").run();
  const denied = await geocodePending(gdb, 'server-key', { concurrency: 1, fetchImpl: async () => ({ json: async () => ({ status: 'OVER_QUERY_LIMIT' }) }) });
  assert.match(denied.error, /OVER_QUERY_LIMIT/);
  assert.equal(gdb.prepare("SELECT COUNT(*) AS n FROM addresses WHERE geocode_status = 'pending'").get().n, 3);
});

test('demo data follows the Surrey grid and lands inside the city', () => {
  const ddb = openDb(':memory:');
  const out = seedDemo(ddb);
  assert.ok(out.addresses > 300);
  const b = ddb.prepare('SELECT MIN(lat) s, MAX(lat) n, MIN(lng) w, MAX(lng) e FROM addresses').get();
  assert.ok(b.s > 49.0 && b.n < 49.23 && b.w > -122.93 && b.e < -122.67);
  // 104 Ave & 152 St is Guildford — roughly 49.191, -122.80.
  assert.ok(Math.abs(gridLat(104) - 49.191) < 0.005);
  assert.ok(Math.abs(gridLng(152) - (-122.801)) < 0.005);
});

test('static files cannot escape the public directory', async () => {
  const res = await fetch(`${base}/%2e%2e/server/db.js`);
  assert.notEqual(await res.text().then(t => t.includes('CREATE TABLE')), true);
  assert.equal((await fetch(`${base}/embed/starbase.js`)).status, 200);
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
});
