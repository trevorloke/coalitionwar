// Small HTTP toolkit: a path router, JSON bodies, static files, rate limits.

import fs from 'node:fs';
import path from 'node:path';

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const bad = (msg, extra) => new HttpError(400, msg, extra);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, ...handlers) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    this.routes.push({ method, re, keys, handlers });
  }
  get(p, ...h) { this.add('GET', p, ...h); }
  post(p, ...h) { this.add('POST', p, ...h); }
  patch(p, ...h) { this.add('PATCH', p, ...h); }
  delete(p, ...h) { this.add('DELETE', p, ...h); }
  match(method, pathname) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      return { handlers: r.handlers, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}

export function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function parseBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const raw = await readBody(req);
  if (!raw) return {};
  const type = req.headers['content-type'] || '';
  if (type.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  if (type.includes('text/csv') || type.includes('text/plain')) return { csv: raw };
  try { return JSON.parse(raw); } catch { throw bad('Body is not valid JSON'); }
}

export function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

export function sendText(res, status, text, type, headers = {}) {
  res.writeHead(status, { 'Content-Type': type, ...headers });
  res.end(text);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

export function serveStatic(root, req, res, pathname, fallback = 'index.html') {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '') || fallback;
  let file = path.resolve(root, rel);
  if (!file.startsWith(path.resolve(root) + path.sep) && file !== path.resolve(root)) return false;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(rel)) return false;
    file = path.join(root, fallback); // SPA fallback for client routes
    if (!fs.existsSync(file)) return false;
  }
  const ext = path.extname(file);
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  // The service worker and HTML must revalidate so a deploy reaches phones.
  headers['Cache-Control'] = ext === '.html' || file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=300';
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
  return true;
}

// Fixed-window in-memory rate limiter, keyed by e.g. IP + route.
export function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || now - h.start > windowMs) { h = { start: now, n: 0 }; hits.set(key, h); }
    h.n++;
    if (hits.size > 10000) for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
    return h.n <= max;
  };
}

export function clientIp(req) {
  // Trust X-Forwarded-For only when explicitly behind a proxy (TRUST_PROXY=1).
  if (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-for']) {
    return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// Input coercion helpers. Each returns null for empty input.
export const v = {
  str(x, max = 500) {
    if (x == null) return null;
    const s = String(x).trim();
    return s ? s.slice(0, max) : null;
  },
  int(x, min = -Infinity, max = Infinity) {
    if (x === '' || x == null) return null;
    const n = Number(x);
    if (!Number.isInteger(n) || n < min || n > max) return null;
    return n;
  },
  num(x) {
    if (x === '' || x == null) return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  },
  bool(x) {
    if (typeof x === 'boolean') return x ? 1 : 0;
    if (x == null) return 0;
    return /^(1|true|yes|y|on|x)$/i.test(String(x).trim()) ? 1 : 0;
  },
  list(x, max = 20) {
    if (x == null || x === '') return [];
    const arr = Array.isArray(x) ? x : String(x).split(/[;,|]/);
    return [...new Set(arr.map(s => String(s).trim().slice(0, 60)).filter(Boolean))].slice(0, max);
  },
  email(x) {
    const s = v.str(x, 254);
    if (!s) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.toLowerCase() : null;
  },
};
