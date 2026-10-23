// SQLite storage via Node's built-in node:sqlite (Node 22.5+). One file, no
// native dependencies. The schema is applied idempotently on every open.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const SUPPORT_LEVELS = {
  1: 'Strong support',
  2: 'Leaning support',
  3: 'Undecided',
  4: 'Leaning against',
  5: 'Strong against',
};

export const OUTCOMES = [
  'spoke',          // had a conversation at the door
  'not_home',
  'come_back',      // asked us to come back later
  'refused',
  'moved',          // resident no longer lives here
  'inaccessible',   // locked building, gate, dog, etc.
  'do_not_contact', // explicit request — address is flagged
];

// Surrey's six communities. Turfs and addresses are grouped by these.
export const NEIGHBOURHOODS = [
  'City Centre / Whalley',
  'Guildford',
  'Fleetwood',
  'Newton',
  'Cloverdale',
  'South Surrey',
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','organizer','canvasser')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS turfs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  neighbourhood TEXT,
  color TEXT NOT NULL DEFAULT '#6d28d9',
  assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY,
  street_number TEXT NOT NULL,
  street_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Surrey',
  province TEXT NOT NULL DEFAULT 'BC',
  postal_code TEXT,
  neighbourhood TEXT,
  lat REAL,
  lng REAL,
  geocode_status TEXT NOT NULL DEFAULT 'pending' CHECK (geocode_status IN ('pending','ok','failed','manual')),
  turf_id INTEGER REFERENCES turfs(id) ON DELETE SET NULL,
  do_not_contact INTEGER NOT NULL DEFAULT 0,
  last_outcome TEXT,
  last_support_level INTEGER,
  last_visited_at TEXT,
  visit_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (street_number, street_name, unit)
);
CREATE INDEX IF NOT EXISTS addresses_geo ON addresses(lat, lng);
CREATE INDEX IF NOT EXISTS addresses_turf ON addresses(turf_id);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT COLLATE NOCASE,
  phone TEXT,
  address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
  street_address TEXT,
  postal_code TEXT,
  support_level INTEGER CHECK (support_level BETWEEN 1 AND 5),
  volunteer INTEGER NOT NULL DEFAULT 0,
  sign_request INTEGER NOT NULL DEFAULT 0,
  donor INTEGER NOT NULL DEFAULT 0,
  email_opt_in INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  issues TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS people_email ON people(email);
CREATE INDEX IF NOT EXISTS people_address ON people(address_id);

CREATE TABLE IF NOT EXISTS canvass_results (
  id INTEGER PRIMARY KEY,
  client_id TEXT UNIQUE,
  address_id INTEGER NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL,
  support_level INTEGER CHECK (support_level BETWEEN 1 AND 5),
  issues TEXT NOT NULL DEFAULT '[]',
  sign_request INTEGER NOT NULL DEFAULT 0,
  volunteer INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  visited_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS results_address ON canvass_results(address_id);
CREATE INDEX IF NOT EXISTS results_user ON canvass_results(user_id);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY,
  form TEXT NOT NULL,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
  payload TEXT NOT NULL,
  origin TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('public','secret')),
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  allowed_origins TEXT NOT NULL DEFAULT '[]',
  revoked INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  actor TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

// Run fn inside a transaction; rolls back on throw. Uses savepoints so calls
// nest (an import that records door knocks wraps each in its own savepoint).
let savepointSeq = 0;
export function tx(db, fn) {
  const name = `sp${++savepointSeq}`;
  db.exec(`SAVEPOINT ${name}`);
  try {
    const out = fn();
    db.exec(`RELEASE ${name}`);
    return out;
  } catch (e) {
    db.exec(`ROLLBACK TO ${name}`);
    db.exec(`RELEASE ${name}`);
    throw e;
  }
}

export function audit(db, { user, actor, action, entity, entityId, detail }) {
  db.prepare(`INSERT INTO audit_log (user_id, actor, action, entity, entity_id, detail)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(user?.id ?? null, actor ?? user?.email ?? null, action, entity ?? null,
      entityId ?? null, detail == null ? null : JSON.stringify(detail));
}

// JSON-array columns come back as text; parse them for API output.
export function parseJsonCols(row, cols = ['tags', 'issues']) {
  if (!row) return row;
  const out = { ...row };
  for (const c of cols) {
    if (typeof out[c] === 'string') {
      try { out[c] = JSON.parse(out[c]); } catch { out[c] = []; }
    }
  }
  return out;
}
