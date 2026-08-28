// Online play, exactly as GDD §12 prescribes: the page holds the board state,
// each action publishes a new version, and secret orders are commit-then-reveal.
// The commit is SHA-256(canonical orders + salt); the reveal is the text and
// the salt; every device re-hashes and checks. The round's dice seed derives
// from the hash of ALL reveals, so nobody can know the dice before the commit.

import { hashString } from '../engine/rng.js';

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function randomSalt() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Canonical serialization: stable key order so the same sheet always hashes
// the same on every device.
export function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort()
      .map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export async function commitFor(orders, salt) {
  return sha256Hex(canonicalJson(orders) + '|' + salt);
}

export async function verifyReveal(orders, salt, hash) {
  return (await commitFor(orders, salt)) === hash;
}

// Derive the round's RNG seed from every revealed sheet: provably fair dice.
export function roundSeed(reveals, round, gameSeed) {
  const material = Object.keys(reveals).sort()
    .map(p => p + ':' + canonicalJson(reveals[p].orders) + ':' + reveals[p].salt)
    .join('||');
  return hashString(`${gameSeed}|round${round}|${material}`);
}

export function readShared() {
  const el = document.getElementById('game-state');
  if (!el || !el.textContent.trim()) return null;
  try { return JSON.parse(el.textContent); } catch { return null; }
}

// Rebuild the full page document from static parts + fresh shared state.
// The live DOM is never serialized: #app is rendered from state on load.
export function pageSource(sharedJson) {
  const style = document.getElementById('app-style')?.textContent ?? '';
  const code = document.getElementById('app-code')?.textContent ?? '';
  const fonts = 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600&display=swap';
  const esc = s => s.replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coalition 1939</title>
<link rel="stylesheet" href="${fonts}">
<style id="app-style">${style}</style>
</head><body>
<div id="app"></div>
<script id="game-state" type="application/json">${esc(sharedJson)}</${'script'}>
<script id="app-code">${code}</${'script'}>
</body></html>`;
}

export class OnlineSync {
  constructor() {
    this.artifact = null;
    this.ready = this.initPromise();
  }
  async initPromise() {
    try {
      if (typeof window !== 'undefined' && window.claude?.use) {
        this.artifact = await window.claude.use('artifact');
      }
    } catch { this.artifact = null; }
    return this.artifact !== null;
  }
  available() { return this.artifact !== null; }

  // Publish the new shared state as a new version of this page.
  // A conflict means someone else published first; every view (this one
  // included) reloads to the winner, so the caller just stops.
  async publish(shared) {
    if (!this.artifact) return { ok: false, readonly: true };
    const html = pageSource(JSON.stringify(shared));
    try {
      await this.artifact.publish(html);
      return { ok: true };
    } catch (e) {
      const code = e?.code ?? e?.message ?? 'error';
      if (String(code).includes('conflict')) return { ok: false, conflict: true };
      if (String(code).includes('not_granted') || String(code).includes('not_writer')) {
        return { ok: false, readonly: true };
      }
      return { ok: false, error: String(code) };
    }
  }
}

// Per-device seat identity (honor system, backed by the commit-reveal check).
export function deviceToken() {
  try {
    let t = localStorage.getItem('c39-token');
    if (!t) { t = randomSalt(); localStorage.setItem('c39-token', t); }
    return t;
  } catch { return 'anonymous-' + Math.floor(Math.random() * 1e9); }
}

export function storeSalt(round, power, salt) {
  try { localStorage.setItem(`c39-salt-${round}-${power}`, salt); } catch { /* private mode */ }
}
export function loadSalt(round, power) {
  try { return localStorage.getItem(`c39-salt-${round}-${power}`); } catch { return null; }
}
export function storeOrders(round, power, orders) {
  try { localStorage.setItem(`c39-orders-${round}-${power}`, JSON.stringify(orders)); } catch { /* ok */ }
}
export function loadOrders(round, power) {
  try {
    const s = localStorage.getItem(`c39-orders-${round}-${power}`);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
