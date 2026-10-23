// DOM helpers. Everything user-supplied goes through text nodes, never
// innerHTML, so names and notes can't inject markup.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, val] of Object.entries(attrs || {})) {
    if (val == null || val === false) continue;
    if (k === 'class') el.className = val;
    else if (k === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else if (k.startsWith('on') && typeof val === 'function') el.addEventListener(k.slice(2).toLowerCase(), val);
    else if (k === 'value') el.value = val;
    else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!val;
    else el.setAttribute(k, val === true ? '' : val);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function mount(target, ...children) {
  target.replaceChildren();
  append(target, children);
  return target;
}

export function toast(message, kind = '') {
  const box = document.getElementById('toasts');
  const t = h('div', { class: `toast ${kind}` }, message);
  box.append(t);
  setTimeout(() => t.remove(), kind === 'error' ? 5000 : 2600);
}

export function modal(title, body, actions = []) {
  return new Promise((resolve) => {
    const close = (val) => { back.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(null); } },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h2', {}, title),
        body,
        h('div', { class: 'actions' },
          actions.map(a => h('button', { class: `btn ${a.class || ''}`, type: 'button',
            onclick: async () => {
              if (!a.run) return close(a.value ?? null);
              try { const out = await a.run(); if (out !== false) close(out ?? a.value ?? true); }
              catch (e) { toast(e.message, 'error'); }
            } }, a.label)))));
    document.body.append(back);
    document.addEventListener('keydown', onKey);
    back.querySelector('input, select, textarea')?.focus();
  });
}

export const confirmDialog = (title, text, label = 'Confirm', cls = 'primary') =>
  modal(title, h('p', {}, text), [{ label: 'Cancel', value: false }, { label, class: cls, value: true }]);

export function field(labelText, input) {
  return h('div', { class: 'field' }, h('label', {}, labelText), input);
}

export function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function relTime(s) {
  if (!s) return 'never';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

export const STATUS = {
  unvisited: { label: 'Not yet knocked', color: 'var(--s-unvisited)' },
  retry: { label: 'Not home / come back', color: 'var(--s-retry)' },
  support1: { label: 'Strong support', color: 'var(--s-support1)' },
  support2: { label: 'Leaning support', color: 'var(--s-support2)' },
  support3: { label: 'Undecided', color: 'var(--s-support3)' },
  support4: { label: 'Leaning against', color: 'var(--s-support4)' },
  support5: { label: 'Strong against', color: 'var(--s-support5)' },
  spoke: { label: 'Spoke (no ID)', color: 'var(--s-spoke)' },
  closed: { label: 'Refused / moved / no access', color: 'var(--s-closed)' },
  dnc: { label: 'Do not contact', color: 'var(--s-dnc)' },
};

// Hex values for canvas drawing (CSS vars don't resolve on <canvas>).
export const STATUS_HEX = {
  unvisited: '#ffffff', retry: '#f5a524', support1: '#0f7a3d', support2: '#4cc27a', support3: '#f2d22e',
  support4: '#f08a3c', support5: '#d43c3c', spoke: '#3b82f6', closed: '#8a90a6', dnc: '#161a2e',
};

export const SUPPORT_HEX = { 1: '#0f7a3d', 2: '#4cc27a', 3: '#e0bd12', 4: '#f08a3c', 5: '#d43c3c' };

export const OUTCOME_LABELS = {
  spoke: 'Spoke with them',
  not_home: 'Not home',
  come_back: 'Come back later',
  refused: 'Refused',
  moved: 'Moved / vacant',
  inaccessible: 'Can’t access',
  do_not_contact: 'Do not contact',
};

export function statusDot(status) {
  return h('span', { class: 'dot', style: { background: STATUS[status]?.color ?? '#ccc' }, title: STATUS[status]?.label });
}

export function supportPill(level, labels) {
  if (!level) return h('span', { class: 'muted' }, '—');
  return h('span', { class: 'pill', style: { background: SUPPORT_HEX[level], color: level === 3 ? '#161a2e' : '#fff' } },
    `${level} · ${labels?.[level] ?? ''}`);
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsText(file);
  });
}
