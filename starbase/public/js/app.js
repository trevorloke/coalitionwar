// Starbase app shell: sign-in, navigation, and hash routing.

import { h, mount, toast, field } from './ui.js';
import { api, session, flushQueue } from './api.js';
import { canvassView } from './canvass.js';
import { dashboardView, peopleView, addressesView, turfsView, resultsView, websiteView, teamView, accountView } from './admin.js';

const app = document.getElementById('app');

const ROUTES = [
  { path: 'canvass', label: 'Canvass', icon: '🗺', role: 'canvasser', view: canvassView, mobile: true },
  { path: 'dashboard', label: 'Dashboard', icon: '📊', role: 'organizer', view: dashboardView, mobile: true },
  { path: 'people', label: 'People', icon: '👥', role: 'organizer', view: peopleView, mobile: true },
  { path: 'addresses', label: 'Canvass list', icon: '🏠', role: 'organizer', view: addressesView },
  { path: 'turfs', label: 'Turfs', icon: '🧭', role: 'organizer', view: turfsView },
  { path: 'results', label: 'Door knocks', icon: '🚪', role: 'organizer', view: resultsView },
  { path: 'website', label: 'Website', icon: '🌐', role: 'organizer', view: websiteView },
  { path: 'team', label: 'Team', icon: '🛡', role: 'organizer', view: teamView },
  { path: 'account', label: 'Account', icon: '⚙️', role: 'canvasser', view: accountView, mobile: true },
];
const RANK = { canvasser: 1, organizer: 2, admin: 3 };

let ctx = null; // { user, config }

async function start() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  window.addEventListener('starbase:signed-out', () => { ctx = null; renderLogin('Your session ended — please sign in again.'); });
  window.addEventListener('hashchange', route);
  if (!session.token) return renderLogin();
  try {
    const [{ user }, config] = await Promise.all([api('/api/me'), api('/api/config')]);
    ctx = { user, config };
    flushQueue();
    route();
  } catch (e) {
    if (e.status === 0) {
      mount(app, h('div', { class: 'login' }, h('div', { class: 'card' }, h('h2', {}, 'You’re offline'),
        h('p', {}, 'Starbase needs a connection to start. Any doors you saved are kept on this phone and will upload once you’re back online.'),
        h('button', { class: 'btn primary block', onclick: () => location.reload() }, 'Try again'))));
    } else renderLogin();
  }
}

function renderLogin(message) {
  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const password = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Sign in');
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      const out = await api('/api/auth/login', { method: 'POST', body: { email: email.value, password: password.value } });
      session.token = out.token;
      ctx = { user: out.user, config: await api('/api/config') };
      if (!location.hash || location.hash === '#/') location.hash = defaultRoute(out.user);
      route();
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  } }, field('Email', email), field('Password', password), btn);
  mount(app, h('div', { class: 'login' }, h('div', { class: 'card' },
    h('div', { class: 'brand' }, h('img', { src: '/icons/icon.svg', alt: '' }), h('div', {}, h('b', {}, 'Starbase'), h('span', {}, 'Imagine Surrey'))),
    message ? h('p', { class: 'small muted' }, message) : null,
    form)));
  email.focus();
}

function defaultRoute(user) { return RANK[user.role] >= RANK.organizer ? '#/dashboard' : '#/canvass'; }

async function signOut() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* already gone */ }
  session.token = null;
  ctx = null;
  location.hash = '';
  renderLogin();
}

async function route() {
  if (!ctx) return;
  const name = (location.hash.replace(/^#\/?/, '').split('?')[0]) || defaultRoute(ctx.user).slice(2);
  const allowed = ROUTES.filter(r => RANK[ctx.user.role] >= RANK[r.role]);
  const r = allowed.find(x => x.path === name) ?? allowed.find(x => `#/${x.path}` === defaultRoute(ctx.user));
  const main = h('main', { class: 'main' });
  const link = (x) => h('a', { href: `#/${x.path}`, class: x === r ? 'active' : '' }, h('span', { class: 'ico' }, x.icon), x.label);
  mount(app, h('div', { class: 'shell' },
    h('nav', { class: 'sidebar' },
      h('div', { class: 'brand' }, h('img', { src: '/icons/icon.svg', alt: '' }), h('div', {}, h('b', {}, 'Starbase'), h('span', {}, ctx.config.organization))),
      h('div', { class: 'nav' }, allowed.map(link)),
      h('div', { class: 'who' }, `${ctx.user.name} · ${ctx.user.role}`)),
    main,
    h('nav', { class: 'mobile-nav' }, allowed.filter(x => x.mobile).map(link))));
  try {
    await r.view(main, { ...ctx, signOut });
  } catch (e) {
    mount(main, h('div', { class: 'card' }, h('h2', {}, 'Couldn’t load this page'), h('p', {}, e.message),
      h('button', { class: 'btn', onclick: route }, 'Try again')));
  }
}

start();
