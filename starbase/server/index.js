// Starbase server: serves the staff app (public/) and the JSON API.
//   node server/index.js            → http://localhost:8080

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { buildApi } from './api.js';
import { HttpError, parseBody, sendJson, serveStatic } from './http.js';
import { ensureAdmin } from './seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 8080),
    dbFile: env.STARBASE_DB || path.join(ROOT, 'data', 'starbase.db'),
    orgName: env.STARBASE_ORG || 'Imagine Surrey',
    mapsBrowserKey: env.GOOGLE_MAPS_BROWSER_KEY || '',
    mapsServerKey: env.GOOGLE_MAPS_SERVER_KEY || '',
    mapsMapId: env.GOOGLE_MAPS_MAP_ID || '',
    // Origins allowed to call /api/public and /api/v1 from a browser.
    corsOrigins: (env.STARBASE_CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
    env,
  };
}

export function createServer({ db, config }) {
  const api = buildApi({ db, config });
  const publicDir = path.join(ROOT, 'public');
  const websiteDir = path.join(ROOT, 'website');

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // The website talks to /api/public (and optionally /api/v1) cross-origin.
    const crossOrigin = pathname.startsWith('/api/public/') || pathname.startsWith('/api/v1/');
    if (crossOrigin) {
      const origin = req.headers.origin;
      if (origin && originAllowed(db, config, origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Starbase-Key');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Max-Age', '600');
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    } else {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    if (pathname.startsWith('/api/')) {
      try {
        const match = api.match(req.method, pathname);
        if (!match) throw new HttpError(404, 'No such endpoint');
        if (match.methodNotAllowed) throw new HttpError(405, 'Method not allowed');
        const ctx = { req, res, params: match.params, query: url.searchParams, body: await parseBody(req) };
        let out;
        for (const h of match.handlers) out = await h(ctx);
        if (out !== undefined && !res.headersSent) sendJson(res, 200, out);
      } catch (e) {
        if (res.headersSent) { res.end(); return; }
        if (e instanceof HttpError) sendJson(res, e.status, { error: e.message, ...(e.extra || {}) });
        else {
          console.error(`[starbase] ${req.method} ${pathname}:`, e);
          sendJson(res, 500, { error: 'Something went wrong on the server' });
        }
      }
      return;
    }

    // Website embed script: <script src="https://starbase.../embed/starbase.js">
    if (pathname.startsWith('/embed/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (serveStatic(websiteDir, req, res, pathname.slice('/embed'.length), '__none__')) return;
      res.writeHead(404); res.end('Not found'); return;
    }

    if (!serveStatic(publicDir, req, res, pathname)) { res.writeHead(404); res.end('Not found'); }
  });
}

// A browser origin may call the website API if it's listed in
// STARBASE_CORS_ORIGINS or on any active public key (set in Website → API keys).
function originAllowed(db, config, origin) {
  if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) return true;
  return !!db.prepare(`SELECT 1 FROM api_keys, json_each(api_keys.allowed_origins) o
                       WHERE api_keys.revoked = 0 AND o.value = ? LIMIT 1`).get(origin);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const config = loadConfig();
  const db = openDb(config.dbFile);
  ensureAdmin(db, process.env);
  createServer({ db, config }).listen(config.port, () => {
    console.log(`Starbase for ${config.orgName} — http://localhost:${config.port}`);
    if (!config.mapsBrowserKey) console.log('  ! GOOGLE_MAPS_BROWSER_KEY not set: the canvass map runs in offline grid mode');
    if (!config.mapsServerKey) console.log('  ! GOOGLE_MAPS_SERVER_KEY not set: imported addresses cannot be geocoded');
  });
}
