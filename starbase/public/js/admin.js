// Organizer and admin screens: dashboard, people, canvass list, turfs,
// results, website integration, team and account.

import { h, mount, toast, modal, confirmDialog, field, fmtDate, relTime, STATUS, statusDot, supportPill, SUPPORT_HEX, OUTCOME_LABELS, debounce, readFile } from './ui.js';
import { api, download } from './api.js';

const qs = (obj) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== '' && v != null && v !== false)).toString();

function pageHead(title, ...actions) {
  return h('div', { class: 'page-head' }, h('h1', {}, title), h('span', { class: 'spacer' }), ...actions);
}

function pager(state, total, reload) {
  const pages = Math.max(1, Math.ceil(total / state.page_size));
  return h('div', { class: 'pager' },
    h('span', { class: 'small muted' }, `${total.toLocaleString()} total · page ${state.page} of ${pages}`),
    h('button', { class: 'btn small', disabled: state.page <= 1, onclick: () => { state.page--; reload(); } }, '‹ Prev'),
    h('button', { class: 'btn small', disabled: state.page >= pages, onclick: () => { state.page++; reload(); } }, 'Next ›'));
}

function select(options, value, onchange, attrs = {}) {
  return h('select', { onchange: (e) => onchange(e.target.value), ...attrs },
    options.map(([v, label]) => h('option', { value: v, selected: String(v) === String(value ?? '') }, label)));
}

// ---- Dashboard -----------------------------------------------------------------

export async function dashboardView(root, { config }) {
  mount(root, pageHead('Dashboard'), h('p', { class: 'muted' }, 'Loading…'));
  const s = await api('/api/stats');
  const supportTotal = Object.values(s.support).reduce((a, b) => a + b, 0) || 1;
  const maxDay = Math.max(1, ...s.daily.map(d => d.doors));
  const kpi = (n, l) => h('div', { class: 'kpi' }, h('div', { class: 'n' }, typeof n === 'number' ? n.toLocaleString() : n), h('div', { class: 'l' }, l));

  mount(root,
    pageHead(`${config.organization} — Dashboard`, h('a', { class: 'btn primary', href: '#/canvass' }, '🗺 Open canvass map')),
    h('div', { class: 'kpis' },
      kpi(s.doors_knocked, 'Doors knocked'), kpi(s.conversations, 'Conversations'),
      kpi(s.supporters, 'Identified supporters'), kpi(s.volunteers, 'Volunteers'),
      kpi(s.sign_requests, 'Lawn sign requests'), kpi(s.people, 'People in database'),
      kpi(s.website_submissions, 'Website sign-ups'),
      kpi(`${s.addresses ? Math.round(100 * s.unique_doors / s.addresses) : 0}%`, `of ${s.addresses.toLocaleString()} doors reached`)),
    s.addresses_pending_geocode ? h('div', { class: 'card', style: { marginBottom: '16px', borderColor: '#f5a524' } },
      `⚠️ ${s.addresses_pending_geocode} canvass addresses aren't on the map yet. `, h('a', { href: '#/addresses' }, 'Geocode them →')) : null,
    h('div', { class: 'two-col' },
      h('div', { class: 'card' }, h('h2', {}, 'Support among identified voters'),
        h('div', { class: 'stack' }, [1, 2, 3, 4, 5].map(l => h('i', { style: { width: `${100 * s.support[l] / supportTotal}%`, background: SUPPORT_HEX[l] }, title: `${config.support_levels[l]}: ${s.support[l]}` }))),
        h('div', { class: 'legend', style: { marginTop: '10px' } }, [1, 2, 3, 4, 5].map(l =>
          h('span', {}, h('span', { class: 'dot', style: { background: SUPPORT_HEX[l] } }), ` ${config.support_levels[l]}: ${s.support[l]}`)))),
      h('div', { class: 'card' }, h('h2', {}, 'Doors per day (last 30 days)'),
        s.daily.length ? h('div', { class: 'chart' }, s.daily.map(d => h('div', { style: { height: `${100 * d.doors / maxDay}%` }, title: `${d.day}: ${d.doors} doors, ${d.conversations} conversations` },
          h('i', { style: { height: `${d.doors ? 100 * d.conversations / d.doors : 0}%` } }))))
          : h('p', { class: 'muted' }, 'No door knocks yet.'),
        h('div', { class: 'legend', style: { marginTop: '8px' } }, h('span', {}, h('span', { class: 'dot', style: { background: 'var(--accent)' } }), ' Doors'),
          h('span', {}, h('span', { class: 'dot', style: { background: 'var(--gold)' } }), ' Conversations')))),
    h('div', { style: { height: '16px' } }),
    h('div', { class: 'two-col' },
      h('div', { class: 'card' }, h('h2', {}, 'Turf progress'),
        s.by_turf.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Turf'), h('th', {}, 'Canvasser'), h('th', {}, 'Reached'), h('th', {}, 'Supporters'))),
          h('tbody', {}, s.by_turf.map(t => h('tr', {},
            h('td', {}, h('span', { class: 'dot', style: { background: t.color } }), ' ', t.name),
            h('td', {}, t.canvasser ?? h('span', { class: 'muted' }, 'Unassigned')),
            h('td', { style: { minWidth: '120px' } }, h('div', { class: 'bar' }, h('i', { style: { width: `${t.doors ? 100 * t.knocked / t.doors : 0}%` } })),
              h('span', { class: 'small muted' }, `${t.knocked ?? 0} / ${t.doors}`)),
            h('td', {}, t.supporters ?? 0)))))
          : h('p', { class: 'muted' }, 'No turfs yet. ', h('a', { href: '#/turfs' }, 'Create one →'))),
      h('div', { class: 'grid' },
        h('div', { class: 'card' }, h('h2', {}, 'Top issues at the door'),
          s.issues.length ? s.issues.map(i => h('div', { class: 'row', style: { marginBottom: '6px' } },
            h('span', { style: { width: '170px' }, class: 'small' }, i.issue),
            h('div', { class: 'bar', style: { flex: 1 } }, h('i', { style: { width: `${100 * i.n / s.issues[0].n}%` } })),
            h('span', { class: 'small muted' }, i.n))) : h('p', { class: 'muted' }, 'No issues recorded yet.')),
        h('div', { class: 'card' }, h('h2', {}, 'Top canvassers'),
          s.leaderboard.length ? h('ol', {}, s.leaderboard.map(u => h('li', {}, h('b', {}, u.name), ` — ${u.doors} doors, ${u.conversations} conversations`)))
            : h('p', { class: 'muted' }, 'No door knocks yet.')))));
}

// ---- People ------------------------------------------------------------------------

export async function peopleView(root, { config, user }) {
  const state = { q: '', support: '', volunteer: '', sign_request: '', email_opt_in: '', source: '', neighbourhood: '', page: 1, page_size: 50 };
  const tableBox = h('div', {});
  const search = h('input', { type: 'search', placeholder: 'Search name, email, phone, address…', oninput: debounce((e) => { state.q = e.target.value; state.page = 1; load(); }, 250) });
  const set = (k) => (v) => { state[k] = v; state.page = 1; load(); };

  mount(root,
    pageHead('People',
      h('button', { class: 'btn', onclick: () => importCsv('/api/people/import', 'Import people', 'Columns: first_name, last_name, email, phone, address, postal_code, support_level (1–5), volunteer, sign_request, donor, email_opt_in, tags, issues, notes. Matches existing people by email, then phone.', load) }, '⇪ Import CSV'),
      h('button', { class: 'btn', onclick: () => download(`/api/people/export.csv?${qs({ ...state, page: null, page_size: null })}`, 'starbase-people.csv').catch(e => toast(e.message, 'error')) }, '⇩ Export'),
      h('button', { class: 'btn primary', onclick: () => editPerson(null) }, '＋ Add person')),
    h('div', { class: 'filters' }, search,
      select([['', 'Any support'], ['1,2', 'Supporters (1–2)'], ['1', '1 · Strong support'], ['2', '2 · Leaning support'], ['3', '3 · Undecided'], ['4', '4 · Leaning against'], ['5', '5 · Strong against'], ['none', 'Not yet identified']], '', set('support')),
      select([['', 'Everyone'], ['volunteer', 'Volunteers'], ['sign_request', 'Lawn sign requests'], ['email_opt_in', 'Email opt-ins']], '', (v) => {
        state.volunteer = v === 'volunteer' ? '1' : ''; state.sign_request = v === 'sign_request' ? '1' : ''; state.email_opt_in = v === 'email_opt_in' ? '1' : ''; state.page = 1; load();
      }),
      select([['', 'Any source'], ['canvass', 'Canvassing'], ['website', 'Website'], ['import', 'Import'], ['manual', 'Added by staff']], '', set('source')),
      select([['', 'All of Surrey'], ...config.neighbourhoods.map(n => [n, n])], '', set('neighbourhood'))),
    tableBox);

  async function load() {
    try {
      const data = await api(`/api/people?${qs(state)}`);
      mount(tableBox, data.people.length ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Name', 'Contact', 'Address', 'Support', 'Flags', 'Source', 'Updated'].map(t => h('th', {}, t)))),
        h('tbody', {}, data.people.map(p => h('tr', { class: 'clickable', onclick: () => editPerson(p.id) },
          h('td', {}, h('b', {}, `${p.first_name} ${p.last_name}`.trim() || '(no name)')),
          h('td', { class: 'small' }, p.email ?? '', p.email && p.phone ? h('br') : null, p.phone ?? ''),
          h('td', { class: 'small' }, p.street_address ?? '', p.neighbourhood ? h('div', { class: 'muted' }, p.neighbourhood) : (p.postal_code ? h('div', { class: 'muted' }, p.postal_code) : null)),
          h('td', {}, supportPill(p.support_level, config.support_levels)),
          h('td', {}, h('div', { class: 'row', style: { gap: '4px' } },
            p.volunteer ? h('span', { class: 'pill on' }, 'Volunteer') : null,
            p.sign_request ? h('span', { class: 'pill on' }, 'Sign') : null,
            p.donor ? h('span', { class: 'pill on' }, 'Donor') : null,
            p.email_opt_in ? h('span', { class: 'pill' }, 'Email ✓') : null)),
          h('td', { class: 'small muted' }, p.source),
          h('td', { class: 'small muted' }, relTime(p.updated_at))))))) : h('div', { class: 'card empty' }, 'No people match these filters.'),
      pager(state, data.total, load));
    } catch (e) { toast(e.message, 'error'); }
  }

  async function editPerson(id) {
    let p = { first_name: '', last_name: '', email: '', phone: '', street_address: '', postal_code: '', support_level: null, tags: [], issues: [], notes: '' };
    let history = [], submissions = [];
    if (id) ({ person: p, history, submissions } = await api(`/api/people/${id}`));
    const inp = (k, type = 'text') => h('input', { type, value: p[k] ?? '' });
    const f = {
      first_name: inp('first_name'), last_name: inp('last_name'), email: inp('email', 'email'), phone: inp('phone', 'tel'),
      street_address: inp('street_address'), postal_code: inp('postal_code'),
      support_level: select([['', 'Not identified'], ...[1, 2, 3, 4, 5].map(l => [l, `${l} · ${config.support_levels[l]}`])], p.support_level, () => {}),
      tags: h('input', { type: 'text', value: (p.tags || []).join(', '), placeholder: 'comma separated' }),
      issues: h('input', { type: 'text', value: (p.issues || []).join(', '), placeholder: 'comma separated' }),
      notes: h('textarea', {}, p.notes ?? ''),
    };
    const checks = Object.fromEntries(['volunteer', 'sign_request', 'donor', 'email_opt_in'].map(k => [k, h('input', { type: 'checkbox', checked: !!p[k] })]));
    const body = h('div', {},
      h('div', { class: 'two-col', style: { gap: '0 12px' } },
        field('First name', f.first_name), field('Last name', f.last_name), field('Email', f.email), field('Phone', f.phone),
        field('Street address', f.street_address), field('Postal code', f.postal_code)),
      field('Support level', f.support_level),
      h('div', { class: 'row', style: { gap: '4px 18px', marginBottom: '12px' } },
        h('label', { class: 'check' }, checks.volunteer, 'Volunteer'), h('label', { class: 'check' }, checks.sign_request, 'Lawn sign'),
        h('label', { class: 'check' }, checks.donor, 'Donor'), h('label', { class: 'check' }, checks.email_opt_in, 'Email opt-in')),
      field('Tags', f.tags), field('Issues', f.issues), field('Notes', f.notes),
      id ? h('p', { class: 'small muted' }, `Source: ${p.source} · added ${fmtDate(p.created_at)}${p.neighbourhood ? ` · ${p.neighbourhood}` : ''}`) : null,
      history.length ? h('div', {}, h('h3', {}, 'Door conversations'), h('ul', { class: 'small' }, history.map(r => h('li', {},
        `${fmtDate(r.visited_at)} — ${OUTCOME_LABELS[r.outcome] ?? r.outcome}`, r.support_level ? ` · support ${r.support_level}` : '',
        r.canvasser ? ` · ${r.canvasser}` : '', r.notes ? h('div', { class: 'muted' }, r.notes) : null)))) : null,
      submissions.length ? h('div', {}, h('h3', {}, 'Website forms'), h('ul', { class: 'small' }, submissions.map(s => h('li', {}, `${s.form} — ${fmtDate(s.created_at)}`)))) : null);
    const actions = [{ label: 'Cancel' }];
    if (id && user.role === 'admin') actions.unshift({ label: 'Delete', class: 'danger', run: async () => {
      if (!(await confirmDialog('Delete person?', 'This permanently removes their record. Door-knock history at their address is kept.', 'Delete', 'danger'))) return false;
      await api(`/api/people/${id}`, { method: 'DELETE' }); toast('Deleted', 'ok'); load();
    } });
    actions.push({ label: 'Save', class: 'primary', run: async () => {
      const payload = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value]));
      for (const [k, el] of Object.entries(checks)) payload[k] = el.checked;
      await api(id ? `/api/people/${id}` : '/api/people', { method: id ? 'PATCH' : 'POST', body: payload });
      toast('Saved', 'ok'); load();
    } });
    await modal(id ? `${p.first_name} ${p.last_name}`.trim() || 'Person' : 'Add person', body, actions);
  }

  load();
}

// ---- Canvass list (addresses) -----------------------------------------------------

export async function addressesView(root, { config, user }) {
  const state = { q: '', turf: '', neighbourhood: '', status: '', geocode: '', page: 1, page_size: 50 };
  const selected = new Set();
  const tableBox = h('div', {});
  const geoBox = h('div', {});
  let turfs = [];
  const set = (k) => (v) => { state[k] = v; state.page = 1; load(); };

  try { turfs = (await api('/api/turfs')).turfs; } catch (e) { toast(e.message, 'error'); }
  const turfOptions = [['', 'All turfs'], ['none', 'No turf'], ...turfs.map(t => [t.id, t.name])];

  mount(root,
    pageHead('Canvass list',
      h('button', { class: 'btn', onclick: () => importCsv('/api/addresses/import', 'Import addresses',
        'One row per door. Either an "address" column ("14250 104 Ave", "305-10180 153 St") or street_number + street_name (+ unit). Optional: postal_code, neighbourhood, lat, lng. Rows without lat/lng are geocoded with Google Maps.',
        () => { load(); loadGeo(); }, turfs) }, '⇪ Import CSV'),
      h('button', { class: 'btn', onclick: () => download(`/api/addresses/export.csv?${qs({ ...state, page: null, page_size: null })}`, 'starbase-canvass-list.csv').catch(e => toast(e.message, 'error')) }, '⇩ Export'),
      h('button', { class: 'btn primary', onclick: addAddress }, '＋ Add address')),
    geoBox,
    h('div', { class: 'filters' },
      h('input', { type: 'search', placeholder: 'Search address or postal code…', oninput: debounce((e) => { state.q = e.target.value; state.page = 1; load(); }, 250) }),
      select(turfOptions, '', set('turf')),
      select([['', 'All of Surrey'], ...config.neighbourhoods.map(n => [n, n])], '', set('neighbourhood')),
      select([['', 'Any status'], ['unvisited', 'Not yet knocked'], ['retry', 'Not home / come back'], ['visited', 'Visited'], ['supporters', 'Supporters'], ['dnc', 'Do not contact']], '', set('status')),
      select([['', 'Any map status'], ['pending', 'Not yet geocoded'], ['failed', 'Geocoding failed'], ['ok', 'Geocoded'], ['manual', 'Placed by hand']], '', set('geocode'))),
    tableBox);

  async function loadGeo() {
    const s = await api('/api/stats');
    if (!s.addresses_pending_geocode) { mount(geoBox); return; }
    const btn = h('button', { class: 'btn primary small', disabled: !config.geocoding_enabled, onclick: async () => {
      btn.disabled = true; mount(btn, 'Geocoding…');
      try {
        const r = await api('/api/addresses/geocode', { method: 'POST', body: { limit: 1000 } });
        toast(`Placed ${r.geocoded} on the map${r.failed ? `, ${r.failed} not found` : ''}${r.error ? ` — stopped: ${r.error}` : ''}`, r.error ? 'error' : 'ok');
      } catch (e) { toast(e.message, 'error'); }
      load(); loadGeo();
    } }, 'Geocode with Google Maps');
    mount(geoBox, h('div', { class: 'card row', style: { marginBottom: '12px', borderColor: '#f5a524' } },
      h('span', {}, `📍 ${s.addresses_pending_geocode.toLocaleString()} addresses need map coordinates before canvassers can see them.`),
      h('span', { class: 'spacer' }),
      config.geocoding_enabled ? btn : h('span', { class: 'small muted' }, 'Set GOOGLE_MAPS_SERVER_KEY on the server to enable geocoding.')));
  }

  async function load() {
    try {
      const data = await api(`/api/addresses?${qs(state)}`);
      selected.clear();
      const bulk = h('div', { class: 'row hidden', style: { marginBottom: '8px' } });
      const updateBulk = () => {
        bulk.classList.toggle('hidden', !selected.size);
        mount(bulk, h('b', {}, `${selected.size} selected`),
          select([['', 'Assign to turf…'], ['null', '— Remove from turf —'], ...turfs.map(t => [t.id, t.name])], '', async (v) => {
            if (!v) return;
            const r = await api('/api/addresses/assign', { method: 'POST', body: { ids: [...selected], turf_id: v === 'null' ? null : Number(v) } });
            toast(`Updated ${r.updated} addresses`, 'ok'); load();
          }, { style: { width: 'auto' } }));
      };
      const all = h('input', { type: 'checkbox', 'aria-label': 'Select all', onchange: (e) => {
        data.addresses.forEach(a => e.target.checked ? selected.add(a.id) : selected.delete(a.id));
        tableBox.querySelectorAll('tbody input[type=checkbox]').forEach(c => { c.checked = e.target.checked; });
        updateBulk();
      } });
      mount(tableBox, bulk, data.addresses.length ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, all), ['Address', 'Community', 'Turf', 'Status', 'Residents', 'Last visit', 'Map'].map(t => h('th', {}, t)))),
        h('tbody', {}, data.addresses.map(a => h('tr', { class: 'clickable', onclick: (e) => { if (e.target.type !== 'checkbox') editAddress(a.id); } },
          h('td', {}, h('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? selected.add(a.id) : selected.delete(a.id); updateBulk(); } })),
          h('td', {}, h('b', {}, `${a.unit ? a.unit + '-' : ''}${a.street_number} ${a.street_name}`), a.postal_code ? h('div', { class: 'small muted' }, a.postal_code) : null),
          h('td', { class: 'small' }, a.neighbourhood ?? '—'),
          h('td', { class: 'small' }, a.turf_name ? [h('span', { class: 'dot', style: { background: a.turf_color } }), ' ', a.turf_name] : h('span', { class: 'muted' }, '—')),
          h('td', { class: 'small' }, statusDot(a.status), ' ', STATUS[a.status]?.label),
          h('td', {}, a.residents),
          h('td', { class: 'small muted' }, a.last_visited_at ? relTime(a.last_visited_at) : '—'),
          h('td', { class: 'small' }, a.geocode_status === 'ok' || a.geocode_status === 'manual' ? '✓' : h('span', { class: 'pill' }, a.geocode_status))))))) :
        h('div', { class: 'card empty' }, 'No addresses match. Import your canvass list to get started.'),
      pager(state, data.total, load));
    } catch (e) { toast(e.message, 'error'); }
  }

  async function addAddress() {
    const f = { address: h('input', { type: 'text', placeholder: '14250 104 Ave' }), unit: h('input', { type: 'text' }), postal_code: h('input', { type: 'text' }),
      neighbourhood: select([['', '—'], ...config.neighbourhoods.map(n => [n, n])], '', () => {}),
      turf_id: select([['', 'No turf'], ...turfs.map(t => [t.id, t.name])], '', () => {}) };
    await modal('Add address', h('div', {}, field('Street address', f.address), field('Unit', f.unit), field('Postal code', f.postal_code),
      field('Community', f.neighbourhood), field('Turf', f.turf_id),
      h('p', { class: 'small muted' }, config.geocoding_enabled ? 'It will be placed on the map with Google geocoding.' : 'Geocoding is off; canvassers can place it by hand from the map.')),
    [{ label: 'Cancel' }, { label: 'Add', class: 'primary', run: async () => {
      await api('/api/addresses', { method: 'POST', body: Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])) });
      if (config.geocoding_enabled) await api('/api/addresses/geocode', { method: 'POST', body: { limit: 5 } }).catch(() => {});
      toast('Address added', 'ok'); load(); loadGeo();
    } }]);
  }

  async function editAddress(id) {
    const { address: a } = await api(`/api/addresses/${id}`);
    const f = {
      unit: h('input', { type: 'text', value: a.unit }), street_number: h('input', { type: 'text', value: a.street_number }),
      street_name: h('input', { type: 'text', value: a.street_name }), postal_code: h('input', { type: 'text', value: a.postal_code ?? '' }),
      neighbourhood: select([['', '—'], ...config.neighbourhoods.map(n => [n, n])], a.neighbourhood, () => {}),
      turf_id: select([['', 'No turf'], ...turfs.map(t => [t.id, t.name])], a.turf_id, () => {}),
      notes: h('textarea', {}, a.notes ?? ''),
    };
    const dnc = h('input', { type: 'checkbox', checked: !!a.do_not_contact });
    const actions = [{ label: 'Cancel' }];
    if (user.role === 'admin') actions.unshift({ label: 'Delete', class: 'danger', run: async () => {
      if (!(await confirmDialog('Delete address?', 'This removes the address and its door-knock history.', 'Delete', 'danger'))) return false;
      await api(`/api/addresses/${id}`, { method: 'DELETE' }); toast('Deleted', 'ok'); load();
    } });
    actions.push({ label: 'Save', class: 'primary', run: async () => {
      const body = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value]));
      body.do_not_contact = dnc.checked;
      await api(`/api/addresses/${id}`, { method: 'PATCH', body }); toast('Saved', 'ok'); load();
    } });
    await modal(`${a.unit ? a.unit + '-' : ''}${a.street_number} ${a.street_name}`, h('div', {},
      h('div', { class: 'two-col', style: { gap: '0 12px' } }, field('Unit', f.unit), field('Number', f.street_number), field('Street', f.street_name),
        field('Postal code', f.postal_code), field('Community', f.neighbourhood), field('Turf', f.turf_id)),
      h('label', { class: 'check' }, dnc, 'Do not contact'), field('Notes', f.notes),
      a.lat != null ? h('p', { class: 'small' }, h('a', { href: `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`, target: '_blank', rel: 'noopener' }, 'Open in Google Maps ↗'))
        : h('p', { class: 'small muted' }, 'Not on the map yet.'),
      a.people.length ? h('div', {}, h('h3', {}, 'Residents'), h('ul', {}, a.people.map(p => h('li', {}, `${p.first_name} ${p.last_name}`, p.support_level ? ` — ${config.support_levels[p.support_level]}` : '')))) : null,
      a.history.length ? h('div', {}, h('h3', {}, 'Visits'), h('ul', { class: 'small' }, a.history.map(r => h('li', {}, `${fmtDate(r.visited_at)} — ${OUTCOME_LABELS[r.outcome]}${r.canvasser ? ` · ${r.canvasser}` : ''}`, r.notes ? h('div', { class: 'muted' }, r.notes) : null)))) : null),
    actions);
  }

  loadGeo().catch(() => {});
  load();
}

// ---- Turfs -----------------------------------------------------------------------------

export async function turfsView(root, { config }) {
  const [{ turfs }, { users }] = await Promise.all([api('/api/turfs'), api('/api/users')]);
  const canvassers = users.filter(u => u.active);
  mount(root,
    pageHead('Turfs', h('button', { class: 'btn primary', onclick: () => edit(null) }, '＋ New turf')),
    h('p', { class: 'muted' }, 'A turf is a walkable group of doors assigned to a canvasser. Add doors to a turf from the Canvass list (select rows → Assign), or fill a turf with a whole community below.'),
    turfs.length ? h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Turf', 'Community', 'Canvasser', 'Progress', 'Supporters', ''].map(t => h('th', {}, t)))),
      h('tbody', {}, turfs.map(t => h('tr', {},
        h('td', {}, h('span', { class: 'dot', style: { background: t.color } }), ' ', h('b', {}, t.name), t.notes ? h('div', { class: 'small muted' }, t.notes) : null),
        h('td', { class: 'small' }, t.neighbourhood ?? '—'),
        h('td', {}, t.canvasser ?? h('span', { class: 'muted' }, 'Unassigned')),
        h('td', { style: { minWidth: '140px' } }, h('div', { class: 'bar' }, h('i', { style: { width: `${t.doors ? 100 * t.knocked / t.doors : 0}%` } })),
          h('span', { class: 'small muted' }, `${t.knocked ?? 0} of ${t.doors} doors · ${t.contacted ?? 0} conversations`)),
        h('td', {}, t.supporters ?? 0),
        h('td', {}, h('div', { class: 'row' },
          h('a', { class: 'btn small', href: `#/canvass`, onclick: () => { try { localStorage.setItem('starbase.turf', t.id); } catch { /* ignore */ } } }, 'Map'),
          h('button', { class: 'btn small', onclick: () => edit(t) }, 'Edit')))))))) :
      h('div', { class: 'card empty' }, 'No turfs yet.'));

  async function edit(t) {
    const f = {
      name: h('input', { type: 'text', value: t?.name ?? '' }),
      neighbourhood: select([['', '—'], ...config.neighbourhoods.map(n => [n, n])], t?.neighbourhood, () => {}),
      color: h('input', { type: 'color', value: t?.color ?? '#6d28d9', style: { height: '42px', width: '80px', padding: '2px' } }),
      assigned_user_id: select([['', 'Unassigned'], ...canvassers.map(u => [u.id, `${u.name} (${u.role})`])], t?.assigned_user_id, () => {}),
      notes: h('textarea', {}, t?.notes ?? ''),
    };
    const fill = h('input', { type: 'checkbox' });
    const actions = [{ label: 'Cancel' }];
    if (t) actions.unshift({ label: 'Delete', class: 'danger', run: async () => {
      if (!(await confirmDialog('Delete turf?', 'Its addresses stay in the canvass list, unassigned.', 'Delete', 'danger'))) return false;
      await api(`/api/turfs/${t.id}`, { method: 'DELETE' }); toast('Turf deleted', 'ok'); turfsView(root, { config });
    } });
    actions.push({ label: 'Save', class: 'primary', run: async () => {
      const body = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value]));
      const { turf } = await api(t ? `/api/turfs/${t.id}` : '/api/turfs', { method: t ? 'PATCH' : 'POST', body });
      if (fill.checked && body.neighbourhood) {
        const r = await api('/api/addresses/assign', { method: 'POST', body: { turf_id: turf.id, neighbourhood: body.neighbourhood, only_unassigned: true } });
        toast(`Added ${r.updated} unassigned doors from ${body.neighbourhood}`, 'ok');
      } else toast('Turf saved', 'ok');
      turfsView(root, { config });
    } });
    await modal(t ? 'Edit turf' : 'New turf', h('div', {}, field('Name', f.name), field('Community', f.neighbourhood),
      h('label', { class: 'check' }, fill, 'Add every unassigned door in this community to the turf'),
      field('Colour on the map', f.color), field('Canvasser', f.assigned_user_id), field('Notes', f.notes)), actions);
  }
}

// ---- Results log -------------------------------------------------------------------------

export async function resultsView(root, { config }) {
  const state = { outcome: '', turf: '', user: '', page: 1, page_size: 50 };
  const tableBox = h('div', {});
  const [{ turfs }, { users }] = await Promise.all([api('/api/turfs'), api('/api/users')]);
  const set = (k) => (v) => { state[k] = v; state.page = 1; load(); };
  mount(root,
    pageHead('Door knocks', h('button', { class: 'btn', onclick: () => download(`/api/results/export.csv?${qs({ ...state, page: null, page_size: null })}`, 'starbase-canvass-results.csv').catch(e => toast(e.message, 'error')) }, '⇩ Export')),
    h('div', { class: 'filters' },
      select([['', 'Any outcome'], ...config.outcomes.map(o => [o, OUTCOME_LABELS[o]])], '', set('outcome')),
      select([['', 'All turfs'], ...turfs.map(t => [t.id, t.name])], '', set('turf')),
      select([['', 'All canvassers'], ...users.map(u => [u.id, u.name])], '', set('user'))),
    tableBox);
  async function load() {
    const data = await api(`/api/results?${qs(state)}`);
    mount(tableBox, data.results.length ? h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['When', 'Address', 'Outcome', 'Spoke with', 'Support', 'Issues', 'Canvasser', 'Notes'].map(t => h('th', {}, t)))),
      h('tbody', {}, data.results.map(r => h('tr', {},
        h('td', { class: 'small' }, fmtDate(r.visited_at)),
        h('td', {}, `${r.unit ? r.unit + '-' : ''}${r.street_number} ${r.street_name}`, r.turf ? h('div', { class: 'small muted' }, r.turf) : null),
        h('td', { class: 'small' }, OUTCOME_LABELS[r.outcome] ?? r.outcome),
        h('td', { class: 'small' }, r.first_name ? `${r.first_name} ${r.last_name}` : '—'),
        h('td', {}, supportPill(r.support_level, config.support_levels)),
        h('td', { class: 'small' }, (r.issues || []).join(', '), r.sign_request ? h('div', {}, h('span', { class: 'pill on' }, 'Sign')) : null, r.volunteer ? h('span', { class: 'pill on' }, 'Volunteer') : null),
        h('td', { class: 'small' }, r.canvasser ?? '—'),
        h('td', { class: 'small' }, r.notes ?? '')))))) : h('div', { class: 'card empty' }, 'No door knocks match.'),
    pager(state, data.total, load));
  }
  load().catch(e => toast(e.message, 'error'));
}

// ---- Website integration ----------------------------------------------------------------

export async function websiteView(root, { user }) {
  const origin = location.origin;
  const [{ submissions, total }, keys] = await Promise.all([
    api('/api/submissions?page_size=25'),
    user.role === 'admin' ? api('/api/keys').then(r => r.keys) : Promise.resolve(null),
  ]);
  const snippet = `<!-- Starbase: sends Imagine Surrey website forms into the database -->
<script src="${origin}/embed/starbase.js" data-key="pk_YOUR_PUBLIC_KEY" defer></script>

<!-- Any form with data-starbase-form posts to Starbase.
     Forms: signup · volunteer · sign · contact · pledge · endorse -->
<form data-starbase-form="volunteer">
  <input name="first_name" placeholder="First name" required>
  <input name="last_name" placeholder="Last name">
  <input name="email" type="email" placeholder="Email" required>
  <input name="phone" placeholder="Phone">
  <input name="postal_code" placeholder="Postal code">
  <label><input type="checkbox" name="email_opt_in" value="1"> Send me updates</label>
  <button>Volunteer with us</button>
</form>

<!-- Live counters (aggregate numbers only) -->
<p><span data-starbase-stat="doors_knocked">0</span> doors knocked ·
   <span data-starbase-stat="volunteers">0</span> volunteers</p>`;

  mount(root,
    pageHead('Website integration'),
    h('p', { class: 'muted' }, 'Everything people submit on the Imagine Surrey website lands in Starbase’s People database — merged with anyone canvassers have already met (matched by email, then phone).'),
    h('div', { class: 'two-col' },
      h('div', { class: 'card' }, h('h2', {}, '1 · Add the snippet to the website'),
        h('p', { class: 'small' }, 'Paste into any page (WordPress, Squarespace, Webflow, NationBuilder custom HTML…). Replace the key with a public key from the right.'),
        h('pre', { class: 'code' }, snippet),
        h('button', { class: 'btn small', onclick: () => navigator.clipboard.writeText(snippet).then(() => toast('Copied', 'ok')) }, 'Copy snippet'),
        h('h3', { style: { marginTop: '16px' } }, 'Server-to-server sync'),
        h('p', { class: 'small' }, 'With a secret key, the website’s backend (or Zapier/Make) can read and write people:'),
        h('pre', { class: 'code' }, `GET  ${origin}/api/v1/people?updated_since=2026-01-01
POST ${origin}/api/v1/people      {"people":[{"email":"…","first_name":"…"}]}
GET  ${origin}/api/v1/stats
Header: Authorization: Bearer sk_…`),
        h('p', { class: 'small' }, 'Starbase can also push every change to the website: set STARBASE_WEBHOOK_URL (and STARBASE_WEBHOOK_SECRET for an HMAC signature) on the server.')),
      h('div', { class: 'card' }, h('h2', {}, '2 · API keys'),
        keys == null ? h('p', { class: 'muted' }, 'Only admins can manage keys.') : [
          h('p', { class: 'small' }, h('b', {}, 'Public keys (pk_)'), ' go in the website’s HTML; they can only submit forms and read counters, and only from the origins you list. ', h('b', {}, 'Secret keys (sk_)'), ' must never be put in a web page.'),
          keys.length ? h('table', {}, h('tbody', {}, keys.map(k => h('tr', {},
            h('td', {}, h('b', {}, k.name), h('div', { class: 'small muted mono' }, `${k.prefix}…`), k.allowed_origins.length ? h('div', { class: 'small muted' }, k.allowed_origins.join(', ')) : null),
            h('td', {}, h('span', { class: `pill ${k.kind === 'secret' ? '' : 'on'}` }, k.kind)),
            h('td', { class: 'small muted' }, k.revoked ? 'Revoked' : `Used ${relTime(k.last_used_at)}`),
            h('td', {}, k.revoked ? null : h('button', { class: 'btn small danger', onclick: async () => {
              if (!(await confirmDialog('Revoke key?', 'Anything using this key will stop working immediately.', 'Revoke', 'danger'))) return;
              await api(`/api/keys/${k.id}`, { method: 'DELETE' }); websiteView(root, { user });
            } }, 'Revoke')))))) : h('p', { class: 'muted' }, 'No keys yet.'),
          h('button', { class: 'btn primary', style: { marginTop: '10px' }, onclick: newKey }, '＋ New key')])),
    h('div', { style: { height: '16px' } }),
    h('div', { class: 'card' }, h('h2', {}, `Recent website submissions (${total})`),
      submissions.length ? h('table', {}, h('thead', {}, h('tr', {}, ['When', 'Form', 'Person', 'From'].map(t => h('th', {}, t)))),
        h('tbody', {}, submissions.map(s => h('tr', {}, h('td', { class: 'small' }, fmtDate(s.created_at)), h('td', {}, h('span', { class: 'pill on' }, s.form)),
          h('td', {}, `${s.first_name ?? ''} ${s.last_name ?? ''}`, h('div', { class: 'small muted' }, s.email ?? '')), h('td', { class: 'small muted' }, s.origin ?? '')))))
        : h('p', { class: 'muted' }, 'Nothing yet. Once the snippet is live, sign-ups appear here.')));

  async function newKey() {
    const name = h('input', { type: 'text', placeholder: 'e.g. imaginesurrey.ca forms' });
    const kind = select([['public', 'Public — for website forms & counters'], ['secret', 'Secret — server-to-server sync']], 'public', () => {});
    const origins = h('input', { type: 'text', placeholder: 'https://imaginesurrey.ca, https://www.imaginesurrey.ca' });
    const created = await modal('New API key', h('div', {}, field('Name', name), field('Type', kind), field('Allowed website origins (public keys)', origins)),
      [{ label: 'Cancel' }, { label: 'Create', class: 'primary', run: () => api('/api/keys', { method: 'POST', body: { name: name.value, kind: kind.value, allowed_origins: origins.value } }) }]);
    if (!created?.key) return;
    await modal('Copy your key', h('div', {}, h('p', {}, 'This is the only time the full key is shown.'), h('pre', { class: 'code' }, created.key),
      h('button', { class: 'btn small', onclick: () => navigator.clipboard.writeText(created.key).then(() => toast('Copied', 'ok')) }, 'Copy')), [{ label: 'Done', class: 'primary' }]);
    websiteView(root, { user });
  }
}

// ---- Team --------------------------------------------------------------------------------

export async function teamView(root, { user }) {
  const { users } = await api('/api/users');
  const isAdmin = user.role === 'admin';
  mount(root,
    pageHead('Team', isAdmin ? h('button', { class: 'btn primary', onclick: () => edit(null) }, '＋ Add teammate') : null),
    h('p', { class: 'muted' }, h('b', {}, 'Canvassers'), ' use the map and see residents’ names at their door (not emails or phone numbers). ',
      h('b', {}, 'Organizers'), ' manage people, turfs and the canvass list. ', h('b', {}, 'Admins'), ' also manage the team and website keys.'),
    h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Name', 'Email', 'Role', 'Doors', 'Status', ''].map(t => h('th', {}, t)))),
      h('tbody', {}, users.map(u => h('tr', {},
        h('td', {}, h('b', {}, u.name), u.phone ? h('div', { class: 'small muted' }, u.phone) : null),
        h('td', { class: 'small' }, u.email), h('td', {}, h('span', { class: 'pill on' }, u.role)), h('td', {}, u.doors),
        h('td', { class: 'small' }, u.active ? 'Active' : h('span', { class: 'muted' }, 'Deactivated')),
        h('td', {}, isAdmin ? h('button', { class: 'btn small', onclick: () => edit(u) }, 'Edit') : null)))))));

  async function edit(u) {
    const f = {
      name: h('input', { type: 'text', value: u?.name ?? '' }), email: h('input', { type: 'email', value: u?.email ?? '', disabled: !!u }),
      phone: h('input', { type: 'tel', value: u?.phone ?? '' }),
      role: select([['canvasser', 'Canvasser'], ['organizer', 'Organizer'], ['admin', 'Admin']], u?.role ?? 'canvasser', () => {}),
      password: h('input', { type: 'text', placeholder: u ? 'Leave blank to keep current password' : 'At least 10 characters', autocomplete: 'new-password' }),
    };
    const active = h('input', { type: 'checkbox', checked: u ? !!u.active : true });
    await modal(u ? `Edit ${u.name}` : 'Add teammate', h('div', {}, field('Name', f.name), field('Email (their sign-in)', f.email), field('Phone', f.phone),
      field('Role', f.role), field(u ? 'Reset password' : 'Temporary password', f.password), u ? h('label', { class: 'check' }, active, 'Active (can sign in)') : null,
      h('p', { class: 'small muted' }, 'Share the password with them privately; they can change it under Account.')),
    [{ label: 'Cancel' }, { label: 'Save', class: 'primary', run: async () => {
      const body = { name: f.name.value, phone: f.phone.value, role: f.role.value };
      if (f.password.value) body.password = f.password.value;
      if (u) { body.active = active.checked; await api(`/api/users/${u.id}`, { method: 'PATCH', body }); }
      else await api('/api/users', { method: 'POST', body: { ...body, email: f.email.value } });
      toast('Saved', 'ok'); teamView(root, { user });
    } }]);
  }
}

// ---- Account -----------------------------------------------------------------------------

export function accountView(root, { user, signOut }) {
  const cur = h('input', { type: 'password', autocomplete: 'current-password' });
  const next = h('input', { type: 'password', autocomplete: 'new-password' });
  mount(root, pageHead('Account'),
    h('div', { class: 'card', style: { maxWidth: '480px' } },
      h('p', {}, h('b', {}, user.name), h('br'), h('span', { class: 'muted' }, `${user.email} · ${user.role}`)),
      h('h3', {}, 'Change password'), field('Current password', cur), field('New password (10+ characters)', next),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: async () => {
          try { await api('/api/me/password', { method: 'POST', body: { current_password: cur.value, new_password: next.value } }); toast('Password changed — please sign in again', 'ok'); signOut(); }
          catch (e) { toast(e.message, 'error'); }
        } }, 'Change password'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn danger', onclick: signOut }, 'Sign out'))),
    h('p', { class: 'small muted', style: { marginTop: '16px' } }, 'Tip: on your phone, use “Add to Home Screen” to install Starbase like an app.'));
}

// ---- shared: CSV import dialog -------------------------------------------------------------

async function importCsv(endpoint, title, help, done, turfs) {
  const file = h('input', { type: 'file', accept: '.csv,text/csv' });
  const turf = turfs ? select([['', 'No turf'], ...turfs.map(t => [t.id, t.name])], '', () => {}) : null;
  const result = await modal(title, h('div', {}, h('p', { class: 'small' }, help), field('CSV file', file), turf ? field('Put new addresses in turf', turf) : null),
    [{ label: 'Cancel' }, { label: 'Import', class: 'primary', run: async () => {
      if (!file.files[0]) throw new Error('Choose a CSV file first');
      return api(endpoint, { method: 'POST', body: { csv: await readFile(file.files[0]), turf_id: turf?.value || undefined } });
    } }]);
  if (!result || result === true) return;
  const parts = [`${result.created} added`];
  if (result.updated != null) parts.push(`${result.updated} merged into existing records`);
  if (result.skipped) parts.push(`${result.skipped} already in the list`);
  if (result.error_count) parts.push(`${result.error_count} rows had problems`);
  toast(parts.join(' · '), result.error_count ? 'error' : 'ok');
  if (result.error_count) {
    await modal('Rows that could not be imported', h('ul', { class: 'small' }, result.errors.map(e => h('li', {}, `Row ${e.row}: ${e.error}`))), [{ label: 'OK', class: 'primary' }]);
  }
  done();
}
