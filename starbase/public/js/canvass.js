// The canvasser's phone screen: a map of houses, tap one, record the door.

import { h, mount, toast, field, relTime, fmtDate, STATUS, STATUS_HEX, SUPPORT_HEX, OUTCOME_LABELS, debounce } from './ui.js';
import { api, submitResult, flushQueue, queue, newClientId } from './api.js';
import { createGoogleMap, createGridMap } from './maps.js';

const MIN_ZOOM_FOR_HOUSES = 15;
const TURF_KEY = 'starbase.turf';

export async function canvassView(root, { config, user }) {
  const state = {
    turfId: loadTurf(),
    addresses: [],
    byId: new Map(),
    selected: null,
    map: null,
    listMode: false,
    pickMode: false,
    userPos: null,
  };
  let bannerSticky = false; // a sticky banner (e.g. a map error) isn't replaced by soft hints

  // ---- layout ----
  const mapEl = h('div', { class: 'map' });
  const turfSelect = h('select', { 'aria-label': 'Turf', onchange: () => { state.turfId = turfSelect.value || null; saveTurf(state.turfId); load(true); } },
    h('option', { value: '' }, 'All addresses in view'));
  const statsChip = h('div', { class: 'chip', title: 'Your doors today' }, '…');
  const syncChip = h('button', { class: 'chip warn hidden', onclick: sync });
  const banner = h('div', { class: 'banner hidden' });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'House details' });
  const listView = h('div', { class: 'list-view hidden' });
  const listBtn = h('button', { class: 'fab', title: 'List of houses', 'aria-label': 'List of houses', onclick: toggleList }, '☰');
  const pickBtn = h('button', { class: 'fab', title: 'Add a missing house', 'aria-label': 'Add a missing house', onclick: togglePick }, '＋');
  const locateBtn = h('button', { class: 'fab', title: 'Show my location', 'aria-label': 'Show my location', onclick: locate }, '◎');
  const nextBtn = h('button', { class: 'fab', title: 'Nearest house not yet knocked', 'aria-label': 'Nearest house not yet knocked', onclick: nextDoor }, '➜');

  const legend = h('div', { class: 'map-legend' },
    ['unvisited', 'retry', 'support1', 'support2', 'support3', 'support4', 'support5', 'closed'].map(s =>
      h('span', {}, h('span', { class: 'dot', style: { background: STATUS_HEX[s], borderColor: s === 'unvisited' ? '#6d4aff' : '#fff' } }), ' ', STATUS[s].label.replace('Not home / come back', 'Try again'))));

  mount(root, h('div', { class: 'canvass' },
    h('div', { class: 'canvass-top' }, turfSelect, statsChip, syncChip),
    banner, mapEl, legend,
    h('div', { class: 'fabs' }, nextBtn, pickBtn, listBtn, locateBtn),
    listView, sheet));

  // ---- map ----
  const handlers = {
    onSelect: (id) => openHouse(id),
    onIdle: debounce(() => { if (!state.turfId) load(false); }, 200),
    onPick: (pos) => addHouseAt(pos),
  };
  if (config.google_maps_browser_key) {
    try {
      state.map = await createGoogleMap(mapEl, config, handlers);
    } catch (e) {
      showBanner(`${e.message}. Using the offline street grid instead.`);
    }
  } else if (user.role === 'admin') {
    showBanner('Google Maps isn’t connected yet (set GOOGLE_MAPS_BROWSER_KEY). Showing the offline street grid.');
  }
  if (!state.map) state.map = createGridMap(mapEl, config, handlers);

  // ---- data ----
  await loadTurfs();
  refreshStats();
  updateSyncChip(queue.size());
  window.addEventListener('starbase:queue', onQueue);
  flushQueue().then(r => { if (r.sent) { toast(`Uploaded ${r.sent} saved door${r.sent === 1 ? '' : 's'}`, 'ok'); load(false); } });
  await load(true);

  function onQueue(e) { if (!root.isConnected) { window.removeEventListener('starbase:queue', onQueue); return; } updateSyncChip(e.detail); }

  async function loadTurfs() {
    try {
      const { turfs } = await api('/api/canvass/turfs');
      const mine = turfs.filter(t => t.mine), others = turfs.filter(t => !t.mine);
      const opt = (t) => h('option', { value: t.id, selected: String(t.id) === String(state.turfId) },
        `${t.name} (${t.knocked ?? 0}/${t.doors})`);
      if (mine.length) turfSelect.append(h('optgroup', { label: 'My turfs' }, mine.map(opt)));
      if (others.length) turfSelect.append(h('optgroup', { label: 'Other turfs' }, others.map(opt)));
      // First visit: default to the canvasser's own turf.
      if (!state.turfId && mine.length && localStorage.getItem(TURF_KEY) == null) {
        state.turfId = String(mine[0].id); turfSelect.value = state.turfId;
      }
      if (state.turfId && ![...turfSelect.options].some(o => o.value === String(state.turfId))) {
        state.turfId = null; turfSelect.value = '';
      }
    } catch (e) { toast(e.message, 'error'); }
  }

  async function load(fit) {
    let url;
    if (state.turfId) url = `/api/canvass/addresses?turf=${state.turfId}&limit=5000`;
    else {
      const bb = state.map.getBbox();
      if (state.map.kind === 'google' && (!bb || state.map.getZoom() < MIN_ZOOM_FOR_HOUSES)) {
        state.map.setAddresses([]);
        state.addresses = []; state.byId.clear();
        showBanner('Pick a turf above, or zoom in to see houses.', true);
        return;
      }
      url = state.map.kind === 'grid' && fit ? '/api/canvass/addresses?limit=5000' : `/api/canvass/addresses?bbox=${bb.map(n => n.toFixed(5)).join(',')}`;
    }
    try {
      const data = await api(url);
      state.addresses = data.addresses;
      state.byId = new Map(data.addresses.map(a => [a.id, a]));
      state.map.setAddresses(state.addresses);
      if (fit && state.addresses.length) state.map.fitTo(state.addresses);
      if (data.truncated) showBanner('Showing the first houses only — zoom in or pick a turf to see all.', true);
      else hideBanner(true);
      if (!state.addresses.length && state.turfId) showBanner('This turf has no mapped houses yet.', true);
      if (state.listMode) renderList();
    } catch (e) {
      if (e.status === 0) showBanner('Offline — showing what was already loaded. Results will be saved and uploaded later.', true);
      else toast(e.message, 'error');
    }
  }

  async function refreshStats() {
    try {
      const s = await api('/api/canvass/me');
      mount(statsChip, `🚪 ${s.doors_today}`, h('span', { class: 'muted' }, ' · '), `💬 ${s.conversations_today}`);
    } catch { mount(statsChip, '—'); }
  }

  function updateSyncChip(n) {
    syncChip.classList.toggle('hidden', !n);
    mount(syncChip, `⇪ ${n} to upload`);
  }

  async function sync() {
    const r = await flushQueue();
    if (r.sent) { toast(`Uploaded ${r.sent} door${r.sent === 1 ? '' : 's'}`, 'ok'); load(false); refreshStats(); }
    else if (queue.size()) toast('Still offline — will retry automatically', 'error');
    if (r.rejected?.length) toast(`${r.rejected.length} entr${r.rejected.length === 1 ? 'y was' : 'ies were'} rejected: ${r.rejected[0].error}`, 'error');
  }

  function showBanner(text, soft = false) { if (bannerSticky && soft) return; bannerSticky = !soft; mount(banner, text); banner.classList.remove('hidden'); }
  function hideBanner(soft) { if (soft && bannerSticky) return; banner.classList.add('hidden'); }

  // ---- location & navigation ----
  function locate() {
    if (!navigator.geolocation) { toast('Location is not available on this device', 'error'); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      state.userPos = { lat: p.coords.latitude, lng: p.coords.longitude };
      state.map.showUser(state.userPos);
      state.map.panTo(state.userPos, 17);
    }, (err) => toast(err.code === 1 ? 'Allow location access to see where you are' : 'Could not get your location', 'error'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
  }

  function nextDoor() {
    const from = state.userPos || (state.selected && state.byId.get(state.selected.id)) || null;
    const todo = state.addresses.filter(a => a.status === 'unvisited' || a.status === 'retry');
    if (!todo.length) { toast('No houses left to knock here 🎉', 'ok'); return; }
    const pick = from
      ? todo.reduce((best, a) => (dist(from, a) < dist(from, best) ? a : best))
      : todo[0];
    state.map.panTo(pick, 18);
    openHouse(pick.id);
  }

  function toggleList() {
    state.listMode = !state.listMode;
    listBtn.classList.toggle('active', state.listMode);
    listView.classList.toggle('hidden', !state.listMode);
    if (state.listMode) renderList();
  }

  function renderList() {
    const from = state.userPos;
    const rows = [...state.addresses].sort((a, b) => from ? dist(from, a) - dist(from, b) : a.label.localeCompare(b.label, undefined, { numeric: true }));
    mount(listView, rows.length ? rows.map(a => h('button', { class: 'item', onclick: () => { toggleList(); state.map.panTo(a, 18); openHouse(a.id); } },
      h('span', { class: 'dot', style: { background: STATUS_HEX[a.status], borderColor: a.status === 'unvisited' ? (a.turf_color || '#6d4aff') : '#fff' } }),
      h('div', {}, h('b', {}, a.label), h('div', { class: 'small muted' }, STATUS[a.status]?.label, a.last_visited_at ? ` · ${relTime(a.last_visited_at)}` : '')),
      from ? h('span', { class: 'spacer' }) : null,
      from ? h('span', { class: 'small muted' }, `${Math.round(dist(from, a))} m`) : null))
      : h('div', { class: 'empty' }, 'No houses loaded. Pick a turf or move the map.'));
  }

  function togglePick() {
    state.pickMode = !state.pickMode;
    pickBtn.classList.toggle('active', state.pickMode);
    state.map.setPickMode(state.pickMode);
    if (state.pickMode) showBanner('Tap the map where the missing house is.'); else { bannerSticky = false; hideBanner(); }
  }

  async function addHouseAt(pos) {
    togglePick();
    const num = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'e.g. 14250', required: true });
    const street = h('input', { type: 'text', placeholder: 'e.g. 104 Ave' });
    const unit = h('input', { type: 'text', placeholder: 'optional' });
    openSheet(h('div', {},
      h('div', { class: 'sheet-head' }, h('h2', {}, 'Add a house'), h('span', { class: 'spacer' }), closeBtn()),
      h('p', { class: 'small muted' }, 'For a house that’s missing from the canvass list. It’s added where you tapped.'),
      field('House number', num), field('Street', street), field('Unit (optional)', unit),
      h('button', { class: 'btn primary block', onclick: async (e) => {
        e.target.disabled = true;
        try {
          const { address } = await api('/api/canvass/addresses', { method: 'POST',
            body: { street_number: num.value, street_name: street.value, unit: unit.value, lat: pos.lat, lng: pos.lng, turf_id: state.turfId } });
          const marker = toMarker(address);
          state.addresses.push(marker); state.byId.set(marker.id, marker);
          state.map.updateAddress(marker);
          toast('House added', 'ok');
          openHouse(address.id, address);
        } catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
      } }, 'Add house')));
    num.focus();
  }

  // ---- the house sheet ----
  function openSheet(content) { mount(sheet, h('div', { class: 'grab' }), content); sheet.classList.add('open'); sheet.scrollTop = 0; }
  function closeSheet() { sheet.classList.remove('open'); state.selected = null; state.map.select(null); }
  function closeBtn() { return h('button', { class: 'btn ghost small', 'aria-label': 'Close', onclick: closeSheet }, '✕'); }

  async function openHouse(id, preloaded) {
    state.map.select(id);
    const marker = state.byId.get(id);
    openSheet(h('div', {}, h('div', { class: 'sheet-head' }, h('h2', {}, marker?.label ?? 'Loading…'), h('span', { class: 'spacer' }), closeBtn()),
      h('p', { class: 'muted' }, 'Loading…')));
    let address = preloaded;
    if (!address) {
      try { address = (await api(`/api/canvass/addresses/${id}`)).address; }
      catch (e) {
        if (e.status !== 0 || !marker) { toast(e.message, 'error'); closeSheet(); return; }
        // Offline: we can still record a knock against what's on the map.
        address = { id, street_number: '', street_name: marker.label, unit: '', status: marker.status, people: [], history: [], offline: true };
      }
    }
    state.selected = address;
    renderHouse(address);
  }

  function renderHouse(a) {
    const label = a.offline ? a.street_name : `${a.unit ? a.unit + '-' : ''}${a.street_number} ${a.street_name}`;
    const form = { outcome: null, support_level: null, issues: new Set(), sign_request: false, volunteer: false, email_opt_in: false, personId: a.people[0]?.id ?? null };

    const outcomeBox = h('div', { class: 'outcomes' });
    const spokeBox = h('div', { class: 'hidden' });
    const notes = h('textarea', { placeholder: 'Anything the next canvasser should know (optional)', maxlength: 2000 });
    const saveBtn = h('button', { class: 'btn primary block', disabled: true, onclick: save }, 'Save');

    // Outcome buttons
    const outcomeBtns = config.outcomes.map(o => h('button', {
      class: `btn ${o === 'spoke' ? 'wide' : ''} ${o === 'do_not_contact' ? 'danger wide' : ''}`, type: 'button',
      onclick: () => {
        form.outcome = o;
        outcomeBtns.forEach(b => b.classList.toggle('sel', b.dataset.o === o));
        spokeBox.classList.toggle('hidden', o !== 'spoke');
        saveBtn.disabled = false;
        mount(saveBtn, o === 'spoke' ? 'Save conversation' : `Save: ${OUTCOME_LABELS[o]}`);
      },
    }, o === 'spoke' ? '💬 ' : '', OUTCOME_LABELS[o]));
    outcomeBtns.forEach((b, i) => { b.dataset.o = config.outcomes[i]; });
    outcomeBox.append(...outcomeBtns);

    // Who they spoke with
    const first = h('input', { type: 'text', placeholder: 'First name', autocomplete: 'off' });
    const last = h('input', { type: 'text', placeholder: 'Last name', autocomplete: 'off' });
    const phone = h('input', { type: 'tel', placeholder: 'Phone (optional)', autocomplete: 'off' });
    const email = h('input', { type: 'email', placeholder: 'Email (optional)', autocomplete: 'off' });
    const newPersonBox = h('div', { class: a.people.length ? 'hidden' : '' },
      h('div', { class: 'row' }, h('div', { style: { flex: 1 } }, first), h('div', { style: { flex: 1 } }, last)),
      h('div', { style: { height: '8px' } }), phone, h('div', { style: { height: '8px' } }), email);
    const residentBtns = [];
    const selectResident = (id) => {
      form.personId = id;
      residentBtns.forEach(b => b.classList.toggle('sel', b.dataset.id === String(id ?? 'new')));
      newPersonBox.classList.toggle('hidden', id != null);
    };
    for (const p of a.people) {
      residentBtns.push(h('button', { type: 'button', class: 'resident', 'data-id': p.id, onclick: () => selectResident(p.id) },
        h('span', { class: 'dot', style: { background: p.support_level ? SUPPORT_HEX[p.support_level] : '#ddd' } }),
        h('div', {}, h('b', {}, `${p.first_name} ${p.last_name}`.trim() || 'Unnamed resident'),
          h('div', { class: 'small muted' }, [p.support_level ? config.support_levels[p.support_level] : 'No ID yet',
            p.volunteer ? 'Volunteer' : null, p.sign_request ? 'Sign' : null].filter(Boolean).join(' · ')))));
    }
    if (a.people.length) {
      residentBtns.push(h('button', { type: 'button', class: 'resident', 'data-id': 'new', onclick: () => selectResident(null) }, '＋ Someone else'));
    }

    // Support level 1–5
    const supportBtns = [1, 2, 3, 4, 5].map(l => h('button', { type: 'button', style: { background: SUPPORT_HEX[l], color: l === 3 ? '#161a2e' : '#fff' },
      title: config.support_levels[l], 'aria-label': config.support_levels[l],
      onclick: () => { form.support_level = form.support_level === l ? null : l; supportBtns.forEach((b, i) => b.classList.toggle('sel', form.support_level === i + 1)); } }, String(l)));

    const issueBtns = config.issues.map(i => h('button', { type: 'button',
      onclick: (e) => { form.issues.has(i) ? form.issues.delete(i) : form.issues.add(i); e.target.classList.toggle('sel', form.issues.has(i)); } }, i));

    const toggle = (key, text) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', onchange: (e) => { form[key] = e.target.checked; } }), text);

    spokeBox.append(
      h('div', { class: 'section-label' }, 'Who did you speak with?'),
      residentBtns.length ? h('div', { class: 'residents' }, residentBtns) : null,
      newPersonBox,
      h('div', { class: 'section-label' }, 'Support for Imagine Surrey'),
      h('div', { class: 'support' }, supportBtns),
      h('div', { class: 'support-labels' }, h('span', {}, 'Strong support'), h('span', {}, 'Undecided'), h('span', {}, 'Strong against')),
      h('div', { class: 'section-label' }, 'Issues they raised'),
      h('div', { class: 'chips' }, issueBtns),
      toggle('sign_request', '🪧 Wants a lawn sign'),
      toggle('volunteer', '🙋 Wants to volunteer'),
      toggle('email_opt_in', '✉️ OK to email them updates'));

    if (residentBtns.length) selectResident(a.people[0].id);

    const status = a.status ?? 'unvisited';
    openSheet(h('div', {},
      h('div', { class: 'sheet-head' },
        h('div', {}, h('h2', {}, label),
          h('div', { class: 'small muted' }, h('span', { class: 'dot', style: { background: STATUS_HEX[status] } }), ' ', STATUS[status]?.label,
            a.visit_count ? ` · ${a.visit_count} visit${a.visit_count === 1 ? '' : 's'}, last ${relTime(a.last_visited_at)}` : '',
            a.turf_name ? ` · ${a.turf_name}` : '')),
        h('span', { class: 'spacer' }), closeBtn()),
      a.do_not_contact ? h('div', { class: 'banner', style: { position: 'static', background: 'var(--danger)', marginBottom: '10px' } },
        'This address asked not to be contacted. Please skip it.') : null,
      a.notes && a.notes !== 'DEMO DATA' ? h('p', { class: 'small' }, '📝 ', a.notes) : null,
      a.offline ? h('p', { class: 'small muted' }, 'Offline — this result will upload when you reconnect.') : null,
      h('div', { class: 'section-label' }, 'What happened at the door?'),
      outcomeBox, spokeBox,
      h('div', { class: 'section-label' }, 'Notes'), notes,
      h('div', { class: 'sticky-save' }, saveBtn),
      a.history?.length ? h('div', { class: 'history' }, h('div', { class: 'section-label' }, 'Previous visits'),
        h('ul', {}, a.history.slice(0, 8).map(r => h('li', {}, h('b', {}, OUTCOME_LABELS[r.outcome] ?? r.outcome),
          r.support_level ? ` · ${config.support_levels[r.support_level]}` : '',
          ` — ${fmtDate(r.visited_at)}${r.canvasser ? ` by ${r.canvasser}` : ''}`,
          r.notes ? h('div', { class: 'muted' }, r.notes) : null)))) : null));

    async function save() {
      if (!form.outcome) return;
      saveBtn.disabled = true;
      const entry = {
        client_id: newClientId(),
        address_id: a.id,
        outcome: form.outcome,
        support_level: form.support_level,
        issues: [...form.issues],
        sign_request: form.sign_request,
        volunteer: form.volunteer,
        notes: notes.value,
        visited_at: new Date().toISOString(),
      };
      if (form.outcome === 'spoke') {
        entry.person = form.personId
          ? { id: form.personId, email_opt_in: form.email_opt_in }
          : { first_name: first.value, last_name: last.value, phone: phone.value, email: email.value, email_opt_in: form.email_opt_in };
      }
      try {
        const out = await submitResult(entry);
        const newStatus = statusAfter(entry);
        const marker = out.address ? toMarker(out.address) : { ...state.byId.get(a.id), status: newStatus };
        if (marker?.id) { state.byId.set(marker.id, marker); state.addresses = state.addresses.map(x => x.id === marker.id ? marker : x); state.map.updateAddress(marker); }
        toast(out.queued ? 'Saved on this phone — will upload when back online' : 'Saved ✓', out.queued ? '' : 'ok');
        refreshStats();
        closeSheet();
      } catch (e) {
        toast(e.message, 'error');
        saveBtn.disabled = false;
      }
    }
  }
}

// Mirrors markerStatus() on the server, for results saved while offline.
function statusAfter(entry) {
  if (entry.outcome === 'do_not_contact') return 'dnc';
  if (entry.outcome === 'spoke') return entry.support_level ? `support${entry.support_level}` : 'spoke';
  if (entry.outcome === 'not_home' || entry.outcome === 'come_back') return 'retry';
  return 'closed';
}

function toMarker(a) {
  return { id: a.id, lat: a.lat, lng: a.lng, turf_id: a.turf_id, turf_color: a.turf_color, status: a.status,
    last_visited_at: a.last_visited_at, label: `${a.unit ? a.unit + '-' : ''}${a.street_number} ${a.street_name}` };
}

// Metres between two lat/lng points (equirectangular — fine at street scale).
function dist(a, b) {
  const x = (b.lng - a.lng) * Math.cos((a.lat + b.lat) * Math.PI / 360);
  const y = b.lat - a.lat;
  return Math.sqrt(x * x + y * y) * 111320;
}

function loadTurf() { try { return localStorage.getItem(TURF_KEY) || null; } catch { return null; } }
function saveTurf(id) { try { localStorage.setItem(TURF_KEY, id ?? ''); } catch { /* ignore */ } }
