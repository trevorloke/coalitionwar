// API client with an offline queue for door knocks. A canvasser can keep
// entering results with no signal; they upload when the phone reconnects.

const TOKEN_KEY = 'starbase.token';
const QUEUE_KEY = 'starbase.queue';

const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const session = {
  get token() { return store.get(TOKEN_KEY, null); },
  set token(t) { t ? store.set(TOKEN_KEY, t) : store.del(TOKEN_KEY); },
};

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'You appear to be offline');
  }
  if (res.status === 401 && session.token) {
    session.token = null;
    window.dispatchEvent(new Event('starbase:signed-out'));
  }
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data;
}

// Download a CSV export (needs the auth header, so a plain link won't do).
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- offline queue ----------------------------------------------------------

export const queue = {
  list() { return store.get(QUEUE_KEY, []); },
  add(entry) { const q = this.list(); q.push(entry); store.set(QUEUE_KEY, q); notify(); },
  size() { return this.list().length; },
};

function notify() { window.dispatchEvent(new CustomEvent('starbase:queue', { detail: queue.size() })); }

export function newClientId() {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

// Save a door knock: straight to the server when online, else queued.
export async function submitResult(entry) {
  try {
    const out = await api('/api/canvass/results', { method: 'POST', body: entry });
    return { ...out, queued: false };
  } catch (e) {
    if (e.status === 0) { queue.add(entry); return { queued: true }; }
    throw e;
  }
}

let flushing = false;
export async function flushQueue() {
  if (flushing || !session.token) return { sent: 0 };
  const pending = queue.list();
  if (!pending.length) return { sent: 0 };
  flushing = true;
  try {
    const { results } = await api('/api/canvass/results/batch', { method: 'POST', body: { results: pending } });
    // Drop entries the server accepted or permanently rejected; keep retryable ones.
    const keep = new Set(results.filter(r => !r.ok && r.retry).map(r => r.client_id));
    const rejected = results.filter(r => !r.ok && !r.retry);
    store.set(QUEUE_KEY, queue.list().filter(e => keep.has(e.client_id) || !results.some(r => r.client_id === e.client_id)));
    notify();
    return { sent: results.filter(r => r.ok).length, rejected };
  } catch {
    return { sent: 0 };
  } finally {
    flushing = false;
  }
}

window.addEventListener('online', () => flushQueue());
