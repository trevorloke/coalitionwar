// First-run admin account, plus an optional demo dataset for training and
// trying the app before Imagine Surrey's real canvass list is imported.
//
//   node server/seed.js --demo     load demo turfs, addresses and door knocks
//
// Demo addresses follow Surrey's numbered grid (Avenues run east–west and
// count up going north from the border; Streets run north–south and count up
// going east; a house number encodes the cross-street block, e.g. 14250 104 Ave
// sits between 142 St and 143 St). They are synthetic and tagged as demo
// data: they are for training, not for knocking on real doors.

import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, tx } from './db.js';
import { hashPassword } from './auth.js';
import { recordResult, upsertPerson } from './services.js';

export function ensureAdmin(db, env = process.env) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count) return null;
  const email = env.STARBASE_ADMIN_EMAIL || 'admin@imaginesurrey.local';
  const password = env.STARBASE_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  db.prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, 'Starbase Admin', ?, 'admin')")
    .run(email, hashPassword(password));
  if (!env.STARBASE_ADMIN_PASSWORD) {
    console.log(`\n  First run — created admin account:\n    email:    ${email}\n    password: ${password}\n  Sign in and change it under Account.\n`);
  }
  return { email, password };
}

// Approximate grid → lat/lng for Surrey (good to a block or so).
export const gridLat = (ave) => 49.0020 + ave * 0.0018173;
export const gridLng = (st) => -122.8890 + (st - 120) * 0.002735;

const DEMO_AREAS = [
  { hood: 'City Centre / Whalley', color: '#7c3aed', aves: [104, 106], sts: [134, 138] },
  { hood: 'Guildford', color: '#2563eb', aves: [101, 103], sts: [150, 154] },
  { hood: 'Fleetwood', color: '#059669', aves: [84, 86], sts: [158, 162] },
  { hood: 'Newton', color: '#d97706', aves: [70, 72], sts: [134, 138] },
  { hood: 'Cloverdale', color: '#db2777', aves: [60, 62], sts: [174, 177] },
  { hood: 'South Surrey', color: '#0891b2', aves: [22, 24], sts: [154, 158] },
];

const FIRST = ['Aman', 'Priya', 'Jas', 'Harpreet', 'Mei', 'Wei', 'Daniel', 'Sarah', 'Michael', 'Fatima', 'Omar',
  'Grace', 'Liam', 'Emma', 'Noah', 'Olivia', 'Raj', 'Simran', 'Tom', 'Linda', 'Kevin', 'Angela', 'Arjun', 'Hannah',
  'Jun', 'Maria', 'Jose', 'Nadia', 'Ben', 'Chloe', 'Gurpreet', 'Manpreet', 'Ali', 'Sofia', 'Ethan', 'Ava'];
const LAST = ['Sandhu', 'Gill', 'Dhillon', 'Grewal', 'Chen', 'Wong', 'Nguyen', 'Smith', 'Brown', 'Martin', 'Khan',
  'Singh', 'Lee', 'Park', 'Taylor', 'Wilson', 'Patel', 'Sharma', 'Kaur', 'Campbell', 'Anderson', 'Reyes', 'Garcia',
  'Ahmed', 'Thompson', 'MacDonald', 'Tran', 'Li', 'Johal', 'Bains'];

export function seedDemo(db, { seed = 1939 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  return tx(db, () => {
    const pw = hashPassword('starbase-demo');
    const mkUser = (email, name, role) => {
      const ex = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (ex) return ex.id;
      return Number(db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)')
        .run(email, name, pw, role).lastInsertRowid);
    };
    mkUser('admin@starbase.demo', 'Demo Admin', 'admin');
    mkUser('organizer@starbase.demo', 'Field Organizer', 'organizer');
    const canvassers = [
      mkUser('canvasser@starbase.demo', 'Demo Canvasser', 'canvasser'),
      mkUser('jas@starbase.demo', 'Jas (volunteer)', 'canvasser'),
      mkUser('mei@starbase.demo', 'Mei (volunteer)', 'canvasser'),
    ];
    const users = canvassers.map(id => db.prepare('SELECT * FROM users WHERE id = ?').get(id));

    const insAddr = db.prepare(`INSERT OR IGNORE INTO addresses
      (street_number, street_name, unit, postal_code, neighbourhood, lat, lng, geocode_status, turf_id, notes)
      VALUES (?, ?, '', NULL, ?, ?, ?, 'ok', ?, 'DEMO DATA')`);
    const addressIds = [];
    DEMO_AREAS.forEach((area, ai) => {
      const turfId = Number(db.prepare('INSERT INTO turfs (name, neighbourhood, color, assigned_user_id, notes) VALUES (?, ?, ?, ?, ?)')
        .run(`${area.hood} — Demo Turf`, area.hood, area.color, canvassers[ai % canvassers.length], 'Demo turf').lastInsertRowid);
      // Houses along each avenue, both sides, ~5 per side per block.
      for (const ave of area.aves) {
        for (let st = area.sts[0]; st < area.sts[1]; st++) {
          for (let k = 0; k < 10; k++) {
            const offset = 10 + k * 8 + (k % 2); // odd = north side, even = south side
            const num = st * 100 + offset;
            const lat = gridLat(ave) + (offset % 2 ? 0.00022 : -0.00022);
            const lng = gridLng(st) + (offset / 100) * 0.002735;
            const info = insAddr.run(String(num), `${ave} Ave`, area.hood, lat, lng, turfId);
            if (info.changes) addressIds.push(Number(info.lastInsertRowid));
          }
        }
      }
    });

    // Simulate a few weeks of canvassing on about 40% of doors.
    const outcomes = ['spoke', 'spoke', 'spoke', 'not_home', 'not_home', 'not_home', 'come_back', 'refused', 'inaccessible', 'moved'];
    const issues = ['Public safety', 'Housing affordability', 'Transit & SkyTrain', 'Traffic & roads',
      'Taxes & city spending', 'Healthcare & hospital', 'Parks & recreation', 'Development & density'];
    for (const id of addressIds) {
      if (rnd() > 0.42) continue;
      const outcome = rnd() < 0.01 ? 'do_not_contact' : pick(outcomes);
      const daysAgo = Math.floor(rnd() * 21);
      const visited = new Date(Date.now() - daysAgo * 864e5 - Math.floor(rnd() * 8) * 36e5).toISOString();
      const support = 1 + Math.min(4, Math.floor(rnd() * rnd() * 6));
      const first = pick(FIRST), last = pick(LAST);
      recordResult(db, pick(users), {
        client_id: `demo-${id}`,
        address_id: id,
        outcome,
        visited_at: visited,
        support_level: support,
        issues: [pick(issues), ...(rnd() < 0.4 ? [pick(issues)] : [])],
        sign_request: support <= 2 && rnd() < 0.3,
        volunteer: support === 1 && rnd() < 0.25,
        notes: outcome === 'spoke' && rnd() < 0.3 ? pick(['Wants more info on the transit plan.',
          'Concerned about speeding on this street.', 'Asked about property taxes.', 'Great conversation!',
          'Has a neighbour who wants a sign too.']) : null,
        person: outcome === 'spoke' ? {
          first_name: first, last_name: last,
          phone: rnd() < 0.5 ? `604-555-${String(1000 + Math.floor(rnd() * 8999))}` : null,
          email: rnd() < 0.35 ? `${first}.${last}.${id}@example.com`.toLowerCase() : null,
          email_opt_in: rnd() < 0.5,
        } : null,
      });
    }

    // A handful of website sign-ups that never met a canvasser.
    for (let i = 0; i < 25; i++) {
      const first = pick(FIRST), last = pick(LAST);
      const r = upsertPerson(db, {
        first_name: first, last_name: last, email: `${first}.${last}.web${i}@example.com`.toLowerCase(),
        postal_code: pick(['V3T 0A1', 'V3R 1B2', 'V4N 2C3', 'V3W 3D4', 'V3S 4E5', 'V4A 5F6']),
        email_opt_in: 1, volunteer: rnd() < 0.3, sign_request: rnd() < 0.2, tags: ['web:signup'],
      }, 'website');
      db.prepare('INSERT INTO submissions (form, person_id, payload, origin) VALUES (?, ?, ?, ?)')
        .run('signup', r.id, JSON.stringify({ demo: true }), 'https://imaginesurrey.example');
    }
    return { addresses: addressIds.length, turfs: DEMO_AREAS.length };
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const db = openDb(process.env.STARBASE_DB || path.join(root, 'data', 'starbase.db'));
  if (process.argv.includes('--demo')) {
    if (db.prepare("SELECT COUNT(*) AS n FROM addresses WHERE notes = 'DEMO DATA'").get().n) {
      console.log('Demo data is already loaded.');
    } else {
      const out = seedDemo(db);
      console.log(`Loaded demo data: ${out.addresses} addresses in ${out.turfs} turfs.`);
      console.log('Demo sign-ins (password "starbase-demo"): admin@starbase.demo, organizer@starbase.demo, canvasser@starbase.demo');
    }
  } else {
    ensureAdmin(db);
  }
}
