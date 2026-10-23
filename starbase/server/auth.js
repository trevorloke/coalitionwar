// Passwords (scrypt), session tokens, and API keys. Only hashes are stored:
// a leaked database never yields a usable session or key.

import crypto from 'node:crypto';

const SESSION_DAYS = 14;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sha256(token), userId, expires);
  return { token, expires };
}

export function destroySession(db, token) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function userForToken(db, token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.email, u.name, u.phone, u.role, u.active, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?`).get(sha256(token));
  if (!row || !row.active) return null;
  if (row.expires_at < new Date().toISOString()) {
    destroySession(db, token);
    return null;
  }
  const { expires_at, ...user } = row;
  return user;
}

// Public keys (pk_) are safe to embed in the website's HTML: they can only
// submit forms and read aggregate stats, and are origin-restricted.
// Secret keys (sk_) are for server-to-server sync and can read/write people.
export function createApiKey(db, { name, kind, allowedOrigins = [] }) {
  const prefix = kind === 'public' ? 'pk_' : 'sk_';
  const key = prefix + crypto.randomBytes(24).toString('base64url');
  const info = db.prepare(`INSERT INTO api_keys (name, kind, prefix, key_hash, allowed_origins)
                           VALUES (?, ?, ?, ?, ?)`)
    .run(name, kind, key.slice(0, 10), sha256(key), JSON.stringify(allowedOrigins));
  return { id: Number(info.lastInsertRowid), key };
}

export function lookupApiKey(db, key) {
  if (!key || !/^(pk|sk)_/.test(key)) return null;
  const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0').get(sha256(key));
  if (!row) return null;
  db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(row.id);
  return { ...row, allowed_origins: JSON.parse(row.allowed_origins) };
}

export const ROLE_RANK = { canvasser: 1, organizer: 2, admin: 3 };

export function hasRole(user, min) {
  return !!user && ROLE_RANK[user.role] >= ROLE_RANK[min];
}
