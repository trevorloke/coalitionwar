// Coalition 1939 — the table. Setup, the six-phase round flow, the order-sheet
// builder, hot-seat and solo play against AI seats, and online play with
// commit-reveal secret orders (GDD §12).

import { Coalition1939 } from '../engine/game.js';
import { aiCouncil, aiOrders, makeTeamPlan } from '../engine/ai.js';
import { POWERS, NATIONS } from '../engine/data.js';
import { CALENDAR } from '../data/powers.js';
import { THEATRES } from '../data/skeleton.js';
import { sideOfPower, powersActiveInTheatre, PHASES } from '../engine/rules.js';
import { validateSheet } from '../engine/resolution.js';
import { BoardMap, ownerColor } from './map.js';
import * as net from './online.js';

const PHASE_NAMES = {
  intel: 'Intelligence', council: 'Council', orders: 'Orders',
  reveal: 'Reveal', resolution: 'Resolution', reckoning: 'Reckoning',
};

const app = {
  screen: 'setup',
  mode: 'solo',
  seats: {}, names: {},
  g: null, board: null,
  stage: 'intel',           // UI stage within the round
  humanQueue: [], current: null,
  cover: null,
  draft: [],                // current human's order lines
  pending: null,            // in-progress click order
  selected: null,
  councilDraft: { commanders: [], ultra: null },
  coinChoice: { axis: null, allied: null },
  sync: null, shared: null, myToken: null,
  revealShown: false,
};

const $ = sel => document.querySelector(sel);
const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function tname(tid) { return app.g ? app.g.game.map[tid]?.name ?? tid : tid; }
function pname(pid) { return POWERS[pid]?.short ?? NATIONS[pid]?.name ?? pid; }

// ————————————————————————————— boot —————————————————————————————

export function boot() {
  app.sync = new net.OnlineSync();
  app.myToken = net.deviceToken();
  const shared = net.readShared();
  if (shared && shared.mode === 'online' && shared.stateJson) {
    app.sync.ready.then(() => { app.shared = shared; resumeOnline(); });
    // While the capability resolves, show a loading shell; if it never
    // resolves we fall back to a local copy of the shared game.
    renderLoading();
    setTimeout(() => { if (app.screen === 'loading') { app.shared = shared; resumeOnline(); } }, 11000);
  } else {
    renderSetup();
  }
}

function renderLoading() {
  app.screen = 'loading';
  $('#app').innerHTML = `<div class="cover"><h2>Coalition 1939</h2>
    <div class="mono dim">Opening the war room…</div></div>`;
}

// ————————————————————————————— setup —————————————————————————————

function renderSetup() {
  app.screen = 'setup';
  const root = $('#app');
  root.innerHTML = '';
  const seatRows = Object.values(POWERS).map(p => `
    <tr>
      <td><span class="power-chip" style="background:${p.color}"></span><strong>${p.name}</strong>
        <div class="ratings">IND ${p.ratings.industry} · MAN ${p.ratings.manpower} · SEA ${p.ratings.sea} · INT ${p.ratings.intel}</div>
        <div class="small dim">${esc(p.signatureText.split(':')[0])}: ${esc(p.objective.text)}</div></td>
      <td>
        <select data-seat="${p.id}">
          <option value="ai">AI</option>
          <option value="human">Human</option>
        </select>
      </td>
    </tr>`).join('');
  root.appendChild(el(`
  <div class="setup">
    <div class="masthead">
      <h1>Coalition 1939</h1>
      <div class="sub">Eight powers · 96 territories · 12 rounds · three decks, dice, and one coin.<br>
      The side that coordinates beats the side that has the best player on it.</div>
    </div>
    <section>
      <h2>Seats</h2>
      <p class="dim small">Any seat can be human or AI. One human against seven AI is a full game;
      eight humans around one screen (or one link) is the real one.</p>
      <table class="seat-table">
        <tr><th>Power</th><th>Seat</th></tr>${seatRows}
      </table>
    </section>
    <section>
      <h2>Table</h2>
      <div class="row">
        <label>Mode
          <select id="mode-sel">
            <option value="solo">Solo / hot-seat (this device)</option>
            <option value="online">Online (this page is the table)</option>
          </select>
        </label>
        <label>Seed <input id="seed-inp" value="" placeholder="random" size="12"></label>
      </div>
      <div id="online-note" class="notice" style="display:none">
        Online play uses commit-then-reveal: your device hashes your secret orders with a random
        salt and publishes only the hash; at the reveal every device re-checks every hash. The
        round's dice are seeded from all the reveals together, so nobody — host included — can
        know them early. Each player opens this same page's link and claims a seat.
      </div>
      <div id="online-missing" class="notice grim" style="display:none">
        This copy of the page can't publish shared versions (it's running outside the
        claude.ai viewer, or you're not an editor). Solo and hot-seat play work fully.
      </div>
    </section>
    <section>
      <div class="row">
        <button class="primary" id="start-btn" style="font-size:17px;padding:10px 26px">Open the war room</button>
        <button id="aid-btn">Player aid</button>
      </div>
      <p class="dim small">Within the winning team, players rank by national objectives met.
      Within the losing team, nobody ranks at all. That asymmetry is the point.</p>
    </section>
  </div>`));
  $('#mode-sel').addEventListener('change', e => {
    const online = e.target.value === 'online';
    $('#online-note').style.display = online ? '' : 'none';
    app.sync.ready.then(ok => {
      $('#online-missing').style.display = online && !ok ? '' : 'none';
    });
  });
  $('#aid-btn').addEventListener('click', showPlayerAid);
  $('#start-btn').addEventListener('click', () => {
    const seats = {};
    for (const sel of root.querySelectorAll('[data-seat]')) seats[sel.dataset.seat] = sel.value;
    const seed = $('#seed-inp').value.trim() || `war-${Math.floor(Math.random() * 1e9)}`;
    const mode = $('#mode-sel').value;
    if (mode === 'online' && app.sync.available()) startOnline(seats, seed);
    else startLocal(seats, seed);
  });
}

function showPlayerAid() {
  showModal(`<h3>Player aid</h3>
  <div class="mono small">
  <p><strong>Combat.</strong> One die per strength. Hit on 5+. Every allied power beyond the
  first in the same offensive improves the whole pool's threshold by 1 (floor 3).
  No power commits more than 8 strength to one offensive. Terrain, forts, entrenchment
  and supply shift the defender's threshold.</p>
  <p><strong>12 strength, three ways:</strong> alone → 5+, 4.0 hits · two powers → 4+, 6.0 hits ·
  three powers → 3+, 8.0 hits. Same dice. The difference is who agreed to show up.</p>
  <p><strong>Orders.</strong> Move 1 · Offensive 3 · Naval 2 · Entrench 1 · Ops card 1–3 ·
  Intel op 2 · Lend-lease 1 (USA free) · Build costs production.</p>
  <p><strong>Coalition pool.</strong> Earn: +1 per extra power in a joint order, +1 per
  lend-lease, +2 per Supreme Commander elected in a 3-power theatre.
  Spend: 2 reroll · 2 initiative · 3 emergency resupply · 4 cancel an event.</p>
  <p><strong>The coin.</strong> Once per round the initiative holder picks one contested
  battle: it is settled by coin flip. Nothing modifies it.</p>
  <p><strong>Victory.</strong> Hold every enemy capital, outscore at summer 1945 (margin
  under 5 is a contested peace), or break the enemy's Home Front.</p>
  <p style="border-top:1px solid var(--line);padding-top:8px"><strong>Winners rank by
  objectives met. Losers do not rank at all.</strong></p>
  </div>
  <div class="row"><button class="primary" data-close>Close</button></div>`);
}

// ————————————————————————— local game flow —————————————————————————

function startLocal(seats, seed) {
  app.mode = 'solo';
  app.seats = seats;
  app.g = new Coalition1939({ seed });
  app.screen = 'game';
  renderChrome();
  stageIntel();
}

function humanSeats() {
  return Object.keys(POWERS).filter(p => app.seats[p] === 'human');
}
function isHuman(pid) { return app.seats[pid] === 'human'; }

function stageIntel() {
  const g = app.g;
  g.intel();
  app.stage = 'council';
  app.councilDraft = { commanders: [], ultra: null };
  refresh();
}

function submitCouncil() {
  const g = app.g;
  const ai = aiCouncil(g);
  // AI fills every election a human didn't make; ultra defaults to AI pick if UK is AI.
  const chosen = new Set(app.councilDraft.commanders.map(c => `${c.theatre}|${sideOfPower(g.state, c.power)}`));
  const commanders = [...app.councilDraft.commanders];
  for (const c of ai.commanders) {
    const key = `${c.theatre}|${sideOfPower(g.state, c.power)}`;
    const humanSide = humanSeats().some(h => sideOfPower(g.state, h) === sideOfPower(g.state, c.power));
    if (!chosen.has(key) && !humanSide) commanders.push(c);
  }
  const ultra = isHuman('uk') ? app.councilDraft.ultra : ai.ultra;
  g.council({ commanders, ultra });
  // AI seats submit immediately; humans queue.
  const plans = {
    axis: makeTeamPlan(g, 'axis'),
    allied: makeTeamPlan(g, 'allied'),
  };
  for (const pid of Object.keys(POWERS)) {
    if (!isHuman(pid)) g.submitOrders(pid, aiOrders(g, pid, plans[sideOfPower(g.state, pid)]));
  }
  app.humanQueue = humanSeats();
  app.stage = 'orders';
  nextHumanOrders();
}

function nextHumanOrders() {
  const g = app.g;
  app.current = app.humanQueue.shift() ?? null;
  app.draft = [];
  app.pending = null;
  if (!app.current) {
    g.runReveal();
    app.stage = 'reveal';
    app.coinChoice = { axis: null, allied: null };
    refresh();
    return;
  }
  if (humanSeats().length > 1) {
    app.cover = app.current;
  }
  refresh();
}

function submitCurrentOrders() {
  const g = app.g;
  const v = g.submitOrders(app.current, { orders: app.draft });
  if (v.dropped.length) {
    showModal(`<h3>${v.dropped.length} order(s) refused</h3>
      <div class="small mono">${v.dropped.map(d => `· ${esc(describeOrder(d.order))} — ${esc(d.reason)}`).join('<br>')}</div>
      <p class="small dim">The rest of the sheet stands. Command points spent: ${v.spent}/${v.budget}.</p>
      <div class="row"><button class="primary" data-close>Understood</button></div>`);
  }
  nextHumanOrders();
}

function runResolutionStage() {
  const g = app.g;
  g.runResolution({ coinBattleBySide: app.coinChoice });
  app.stage = 'resolution';
  refresh();
}

function runReckoningStage() {
  const g = app.g;
  g.runReckoning();
  if (g.state.victory) {
    app.stage = 'victory';
    refresh();
    return;
  }
  app.stage = 'intel';
  stageIntel();
}

// ————————————————————————— chrome & rendering —————————————————————————

function renderChrome() {
  const root = $('#app');
  root.innerHTML = '';
  root.appendChild(el(`
  <div style="display:flex;flex-direction:column;height:100vh">
    <div class="topbar">
      <div class="brand">Coalition 1939 <span class="calendar" id="cal"></span></div>
      <div class="phase-rail" id="phase-rail"></div>
      <div class="pools" id="pools"></div>
    </div>
    <div class="main">
      <div class="map-wrap" id="map-wrap">
        <div class="theatre-nav" id="theatre-nav"></div>
        <div class="map-hint" id="map-hint">Wheel to zoom · drag to pan · click a territory</div>
      </div>
      <div class="sidebar">
        <div class="panel-head"><h2 id="panel-title"></h2><span class="mono small dim" id="panel-sub"></span></div>
        <div class="panel-body" id="panel-body"></div>
        <div class="panel-foot" id="panel-foot"></div>
      </div>
    </div>
    <div class="ticker" id="ticker"></div>
  </div>`));
  app.board = new BoardMap($('#map-wrap'), app.g.game, {
    onTerritoryClick: onTerritoryClick,
    onHover: tid => {
      const t = app.g.game.map[tid], ts = app.g.state.t[tid];
      $('#map-hint').textContent =
        `${t.name} · ${t.theatre.replace('_', ' ')} · ${t.terrain} · supply ${t.supply}` +
        ` · ${ts.owner === 'none' ? 'open sea' : pname(ts.owner) + ' ' + ts.strength}` +
        (t.victoryCity ? ` · ★${t.victoryCity.weight}` : '') + (ts.supplied ? '' : ' · OUT OF SUPPLY');
    },
  });
  const nav = $('#theatre-nav');
  nav.appendChild(el(`<button data-th="world">World</button>`));
  for (const [tid, th] of Object.entries(THEATRES)) {
    nav.appendChild(el(`<button data-th="${tid}">${th.name.split(' ')[0].replace('The', '').trim() || th.name}</button>`));
  }
  nav.addEventListener('click', e => {
    const th = e.target.dataset?.th;
    if (!th) return;
    if (th === 'world') app.board.focusWorld(); else app.board.focusTheatre(th);
  });
}

function refresh() {
  if (app.screen !== 'game') return;
  const g = app.g, s = g.state;
  $('#cal').textContent = `${g.calendar().label} · round ${Math.min(s.round, 12)}/12`;
  const rail = $('#phase-rail');
  rail.innerHTML = PHASES.map(ph => {
    const idx = PHASES.indexOf(ph), cur = PHASES.indexOf(uiPhase());
    return `<div class="phase ${idx === cur ? 'active' : idx < cur ? 'done' : ''}">${PHASE_NAMES[ph]}</div>`;
  }).join('');
  $('#pools').innerHTML =
    `<span class="allied">ALLIED POOL ${s.pool.allied}</span><span class="axis">AXIS POOL ${s.pool.axis}</span>`;
  renderTicker();
  applyFog();
  app.board.render(s);
  renderPanel();
  renderCover();
}

function uiPhase() {
  return app.stage === 'victory' ? 'reckoning'
    : app.stage === 'council' ? 'council'
    : app.stage === 'orders' ? 'orders'
    : app.stage === 'reveal' ? 'reveal'
    : app.stage === 'resolution' ? 'resolution'
    : 'intel';
}

function applyFog() {
  // GDD §9, settled: a neutral human seat sees only two rings out from its
  // own territory. Everyone at war sees the world.
  const g = app.g, s = g.state;
  const pid = app.current;
  if (app.stage === 'orders' && pid && isHuman(pid) && !s.powers[pid].atWar) {
    const visible = new Set();
    const mine = Object.entries(s.t).filter(([, ts]) => ts.owner === pid).map(([tid]) => tid);
    let ring = mine;
    for (const t of ring) visible.add(t);
    for (let d = 0; d < 2; d++) {
      const next = [];
      for (const t of ring) for (const n of g.game.map[t].adjacent) {
        if (!visible.has(n)) { visible.add(n); next.push(n); }
      }
      ring = next;
    }
    app.board.dimUnknown = visible;
  } else {
    app.board.dimUnknown = null;
  }
}

function renderTicker() {
  const s = app.g.state;
  const lines = [...s.gameLog.slice(-14), ...s.roundLog].slice(-60);
  $('#ticker').innerHTML = lines.map(l => {
    const cls = l.startsWith('[event]') || l.startsWith('Event') ? 'event'
      : /take |fail |COIN|FLIPS|FALLS|ENTERS|DEFECTS/.test(l) ? 'battle' : '';
    return `<div class="line ${cls}">${esc(l)}</div>`;
  }).join('');
  $('#ticker').scrollTop = 1e6;
}

function renderCover() {
  document.querySelectorAll('.cover').forEach(c => c.remove());
  if (!app.cover) return;
  const pid = app.cover;
  const cover = el(`<div class="cover">
    <h2>Pass the device</h2>
    <div>Hand it to <strong style="color:${POWERS[pid].color}">${POWERS[pid].name}</strong>.
    Everyone else looks away — these orders are secret.</div>
    <button class="primary">I am ${esc(POWERS[pid].short)} — open my sheet</button>
  </div>`);
  cover.querySelector('button').addEventListener('click', () => { app.cover = null; renderCover(); });
  document.body.appendChild(cover);
}

// ————————————————————————— side panel per stage —————————————————————————

function renderPanel() {
  const body = $('#panel-body'), foot = $('#panel-foot');
  body.innerHTML = ''; foot.innerHTML = '';
  const fns = {
    council: panelCouncil, orders: panelOrders, reveal: panelReveal,
    resolution: panelResolution, victory: panelVictory,
  };
  (fns[app.stage] ?? panelCouncil)(body, foot);
}

function powerDashboard() {
  const s = app.g.state;
  return `<div style="margin-bottom:12px">` + Object.values(POWERS).map(p => {
    const ps = s.powers[p.id];
    const status = ps.atWar ? (ps.side === 'allied' ? 'ALLIED' : 'AXIS')
      : `NEUTRAL${ps.pressure !== null ? ' · pressure ' + ps.pressure : ''}`;
    return `<div class="power-row">
      <span class="power-chip" style="background:${p.color}"></span>
      <span>${p.short} <span class="dim small">${status}${app.seats[p.id] === 'human' ? ' · human' : ''}</span></span>
      <span title="command points">CP ${ps.cp}</span>
      <span title="production bank">PR ${ps.production}</span>
      <span title="home front">HF ${ps.homeFront}</span>
    </div>`;
  }).join('') + `</div>`;
}

function panelCouncil(body, foot) {
  const g = app.g, s = g.state;
  $('#panel-title').textContent = 'Council';
  $('#panel-sub').textContent = 'nothing agreed here binds anyone';
  body.innerHTML = powerDashboard();
  // Supreme commander elections for theatres with 3+ active same-side powers.
  const humanSides = new Set(humanSeats().map(h => sideOfPower(s, h)));
  let any = false;
  for (const theatre of Object.keys(THEATRES)) {
    for (const side of ['axis', 'allied']) {
      if (!humanSides.has(side)) continue;
      const active = powersActiveInTheatre(g.game, s, theatre, side);
      if (active.length < 3) continue;
      any = true;
      body.appendChild(el(`<div class="kv"><span class="k">${THEATRES[theatre].name} (${side})</span>
        <select data-cmd="${theatre}|${side}">
          <option value="">no commander</option>
          ${active.map(p => `<option value="${p}">${pname(p)}</option>`).join('')}
        </select></div>`));
    }
  }
  if (isHuman('uk') && s.powers.uk.atWar) {
    body.appendChild(el(`<div class="notice">Ultra: read one opponent's orders for a single theatre this round.
      <div class="row" style="display:flex;gap:8px;margin-top:6px">
        <select id="ultra-target">${['germany', 'japan', 'italy', 'indies'].map(p => `<option>${p}</option>`).join('')}</select>
        <select id="ultra-theatre">${Object.keys(THEATRES).map(t => `<option>${t}</option>`).join('')}</select>
      </div></div>`));
  }
  if (!any && !isHuman('uk')) {
    body.appendChild(el(`<div class="dim small">Talk it over. Who is carrying which theatre this round?
      Which target do you all write down? A promise here costs nothing — which is the point.</div>`));
  }
  foot.appendChild(el(`<button class="primary" id="council-go">Write orders</button>`));
  $('#council-go').addEventListener('click', () => {
    app.councilDraft.commanders = [...body.querySelectorAll('[data-cmd]')]
      .filter(sel => sel.value)
      .map(sel => ({ theatre: sel.dataset.cmd.split('|')[0], power: sel.value }));
    const ut = $('#ultra-target'), uth = $('#ultra-theatre');
    if (ut) app.councilDraft.ultra = { target: ut.value, theatre: uth.value };
    submitCouncil();
    refresh();
  });
}

const ORDER_TOOLS = [
  ['offensive', 'Offensive · 3'], ['move', 'Move · 1'], ['naval', 'Naval op · 2'],
  ['entrench', 'Entrench · 1'], ['build', 'Build'], ['lend_lease', 'Lend-lease'],
  ['intel_op', 'Intel op · 2'],
];

function panelOrders(body, foot) {
  const g = app.g, s = g.state, pid = app.current;
  if (!pid) return;
  const p = s.powers[pid];
  $('#panel-title').textContent = `${POWERS[pid].short} — secret orders`;
  $('#panel-sub').textContent = POWERS[pid].name;

  // Ultra intercept: if the UK is writing after its target has… no — sheets are
  // simultaneous. Ultra shows the TARGET's already-submitted AI sheet, or, in
  // hot-seat, the sheet if the target wrote earlier in the pass order.
  if (pid === 'uk' && s.ultra?.target && s.orders[s.ultra.target]) {
    const deceived = s.activeFlags.some(f => f.name === 'deception' && f.power === s.ultra.target);
    const lines = deceived ? [] : s.orders[s.ultra.target].orders
      .filter(o => orderInTheatre(o, s.ultra.theatre));
    body.appendChild(el(`<div class="notice">ULTRA — ${pname(s.ultra.target)}, ${s.ultra.theatre}:
      <div class="mono small">${deceived ? 'Nothing. The traffic reads wrong — deception.'
        : lines.length ? lines.map(o => esc(describeOrder(o))).join('<br>') : 'No orders in that theatre.'}</div></div>`));
  }

  const tools = el(`<div class="card-row" style="gap:5px">${ORDER_TOOLS.map(([k, label]) =>
    `<button data-tool="${k}" class="small" style="font-size:11px">${label}</button>`).join('')}
    ${specialButtons(pid)}</div>`);
  body.appendChild(tools);
  tools.addEventListener('click', e => {
    const tool = e.target.dataset?.tool;
    if (tool) startTool(tool);
    const sp = e.target.dataset?.special;
    if (sp) startSpecial(sp);
  });

  const sheet = el(`<div class="order-sheet" id="sheet"></div>`);
  body.appendChild(sheet);
  renderSheet();

  // Hands.
  body.appendChild(el(`<h3 class="display" style="font-size:13px;margin:12px 0 4px">Strategy hand</h3>`));
  const srow = el(`<div class="card-row"></div>`);
  for (const cid of p.stratHand) {
    const c = app.g.game.cards[cid];
    const played = app.draft.some(o => o.type === 'strat_card');
    srow.appendChild(el(`<div class="card ${c.side}">
      <div class="ops-pip">${c.ops}</div>
      <div class="card-title">${esc(c.title)}</div>
      <div class="card-text">${esc(c.text)}</div>
      <div class="card-actions">
        <button data-play="${cid}" data-forops="0" ${played ? 'disabled' : ''}>Event</button>
        <button data-play="${cid}" data-forops="1" ${played ? 'disabled' : ''}>+${c.ops} CP</button>
      </div></div>`));
  }
  srow.addEventListener('click', e => {
    const cid = e.target.dataset?.play;
    if (!cid) return;
    app.draft.push({ type: 'strat_card', cardId: cid, forOps: e.target.dataset.forops === '1' });
    refresh();
  });
  body.appendChild(srow);

  body.appendChild(el(`<h3 class="display" style="font-size:13px;margin:12px 0 4px">Operations hand</h3>`));
  const orow = el(`<div class="card-row"></div>`);
  for (const cid of p.opsHand) {
    const c = app.g.game.opsCards[cid];
    orow.appendChild(el(`<div class="card">
      <div class="ops-pip">${c.cost}</div>
      <div class="card-title">${esc(c.title)}</div>
      <div class="card-text">${esc(c.text)}</div>
      <div class="card-actions"><button data-ops="${cid}">Declare → pick battle</button></div></div>`));
  }
  orow.addEventListener('click', e => {
    const cid = e.target.dataset?.ops;
    if (!cid) return;
    app.pending = { type: 'ops_card', cardId: cid, step: 'battle' };
    $('#map-hint').textContent = 'Click the territory whose battle this card joins.';
  });
  body.appendChild(orow);

  foot.appendChild(el(`<button id="clear-orders">Clear</button>`));
  foot.appendChild(el(`<button class="primary" id="submit-orders">Seal the sheet</button>`));
  $('#clear-orders').addEventListener('click', () => { app.draft = []; refresh(); });
  $('#submit-orders').addEventListener('click', () => {
    if (app.mode === 'online') commitOnline();
    else submitCurrentOrders();
  });
}

function specialButtons(pid) {
  const s = app.g.state;
  const b = [];
  if (pid === 'japan' && !s.powers.japan.decisiveUsed) b.push(`<button data-special="decisive" style="font-size:11px">Decisive battle</button>`);
  if (!s.powers[pid].atWar && (s.powers[pid].pressure ?? 0) >= 7) b.push(`<button data-special="enter" style="font-size:11px">Enter the war</button>`);
  if (pid === 'indies') {
    b.push(`<button data-special="sell" style="font-size:11px">Sell commitment</button>`);
    if (Object.values(s.nations).some(n => n.allegiance === 'axis' && n.pressure >= 7)) {
      b.push(`<button data-special="defect" style="font-size:11px">Defect a nation</button>`);
    }
  }
  const side = sideOfPower(s, pid);
  if (s.pool[side] > 0) b.push(`<button data-special="bid" style="font-size:11px">Bid initiative (pool)</button>`);
  return b.join('');
}

function startSpecial(kind) {
  const s = app.g.state, pid = app.current;
  if (kind === 'decisive') {
    app.pending = { type: 'decisive_battle', step: 'zone' };
    $('#map-hint').textContent = 'Click the sea zone for the Decisive Battle.';
  } else if (kind === 'enter') {
    app.draft.push({ type: 'enter_war' }); refresh();
  } else if (kind === 'sell') {
    const clients = Object.entries(s.nations).filter(([, n]) => n.allegiance === 'axis').map(([id]) => id);
    pickModal('Sell whose commitment? (+2 CP now, +1 pressure on them)', clients,
      nid => { app.draft.push({ type: 'sell_commitment', nation: nid, buyer: 'germany' }); refresh(); });
  } else if (kind === 'defect') {
    const ready = Object.entries(s.nations).filter(([, n]) => n.allegiance === 'axis' && n.pressure >= 7).map(([id]) => id);
    pickModal('Defect which nation to the Allies?', ready,
      nid => { app.draft.push({ type: 'defect', nation: nid }); refresh(); });
  } else if (kind === 'bid') {
    const side = sideOfPower(s, pid);
    pickModal(`Spend how much of the ${side} pool on initiative?`,
      Array.from({ length: Math.min(4, s.pool[side]) }, (_, i) => String(i + 1)),
      n => { app.draft.push({ type: 'initiative_bid', points: parseInt(n, 10) }); refresh(); });
  }
}

function startTool(tool) {
  app.pending = { type: tool, step: 'source' };
  const hints = {
    offensive: 'Click the territory your attack starts from.',
    move: 'Click the territory to move strength out of.',
    naval: 'Click the territory or zone your fleet sails from.',
    entrench: 'Click your territory to entrench.',
    build: 'Click your industrial territory (or any territory for a fort).',
    lend_lease: '', intel_op: '',
  };
  if (tool === 'lend_lease') {
    const s = app.g.state, pid = app.current;
    const allies = Object.keys(POWERS).filter(p2 => p2 !== pid && sideOfPower(s, p2) === sideOfPower(s, pid));
    pickModal('Lend-lease production to whom?', allies, to => {
      pickModal('How much?', ['1', '2', '3', '4'], amt => {
        app.draft.push({ type: 'lend_lease', to, amount: parseInt(amt, 10) }); refresh();
      });
    });
    app.pending = null;
    return;
  }
  if (tool === 'intel_op') {
    const s = app.g.state, pid = app.current;
    const tracks = ['usa', 'ussr', ...Object.keys(NATIONS)].filter(t =>
      (t === 'usa' || t === 'ussr') ? !s.powers[t].atWar : s.nations[t].allegiance === 'axis');
    pickModal('Shift which pressure track?', tracks, track => {
      const dir = sideOfPower(s, pid) === 'allied' ? 1 : -1;
      app.draft.push({ type: 'intel_op', kind: 'pressure', track, delta: track in NATIONS ? 1 : dir });
      refresh();
    });
    app.pending = null;
    return;
  }
  $('#map-hint').textContent = hints[tool] ?? 'Click the map.';
}

function onTerritoryClick(tid) {
  const g = app.g, s = g.state;
  if (app.stage !== 'orders' || !app.pending) {
    app.selected = tid;
    app.board.selected = tid;
    app.board.render(s);
    return;
  }
  const p = app.pending;
  if (p.type === 'ops_card' && p.step === 'battle') {
    app.draft.push({ type: 'ops_card', cardId: p.cardId, battle: tid });
    app.pending = null; refresh(); return;
  }
  if (p.type === 'decisive_battle') {
    app.draft.push({ type: 'decisive_battle', zone: tid });
    app.pending = null; refresh(); return;
  }
  if (p.step === 'source') {
    if (p.type === 'entrench') { app.draft.push({ type: 'entrench', territory: tid }); app.pending = null; refresh(); return; }
    if (p.type === 'build') {
      pickModal(`Build what in ${tname(tid)}?`, ['strength', 'fort'], what => {
        pickModal('How many?', ['1', '2', '3'], amt => {
          app.draft.push({ type: 'build', territory: tid, what, amount: parseInt(amt, 10) }); refresh();
        });
      });
      app.pending = null; return;
    }
    p.source = tid; p.step = 'target';
    $('#map-hint').textContent = p.type === 'offensive' ? `Attacking from ${tname(tid)} — click the target.`
      : p.type === 'naval' ? `Fleet from ${tname(tid)} — click the sea zone.`
        : `Moving from ${tname(tid)} — click the destination.`;
    app.board.highlights = new Set(g.game.map[tid].adjacent);
    app.board.render(s);
    return;
  }
  if (p.step === 'target') {
    const max = Math.min(8, Math.max(1, s.t[p.source].strength - (p.type === 'offensive' ? 0 : 0)));
    const opts = Array.from({ length: Math.min(8, s.t[p.source].strength) }, (_, i) => String(i + 1));
    if (!opts.length) { app.pending = null; refresh(); return; }
    pickModal(`${p.type === 'offensive' ? 'Commit' : p.type === 'naval' ? 'Sail' : 'Move'} how much strength (${tname(p.source)} → ${tname(tid)})?`, opts, amt => {
      const n = parseInt(amt, 10);
      if (p.type === 'offensive') {
        // Deep battle: a second Soviet click on the same target adds a source.
        const existing = app.current === 'ussr' && app.draft.find(o => o.type === 'offensive' && o.target === tid);
        if (existing && existing.sources.length < 2) existing.sources.push({ from: p.source, strength: n });
        else {
          const amphib = !g.game.map[p.source].adjacent.includes(tid);
          let via = null;
          if (amphib) {
            via = g.game.map[p.source].adjacent.find(z =>
              g.game.map[z].type === 'sea' && g.game.map[z].adjacent.includes(tid));
          }
          app.draft.push({
            type: 'offensive', target: tid, sources: [{ from: p.source, strength: n }],
            ...(amphib && via ? { amphibious: true, via } : {}),
          });
        }
      } else if (p.type === 'naval') {
        pickModal('Mission?', ['contest', 'escort', 'raid'], mission => {
          app.draft.push({ type: 'naval', zone: tid, from: p.source, strength: n, mission });
          refresh();
        });
      } else {
        app.draft.push({ type: 'move', from: p.source, to: tid, strength: n });
      }
      app.pending = null;
      app.board.highlights = new Set();
      refresh();
    });
  }
}

function orderInTheatre(o, theatre) {
  const g = app.g;
  const tid = o.target ?? o.zone ?? o.territory ?? o.to ?? o.from ?? null;
  return tid && g.game.map[tid]?.theatre === theatre;
}

function describeOrder(o) {
  switch (o.type) {
    case 'move': return `MOVE ${o.strength} ${tname(o.from)} → ${tname(o.to)}`;
    case 'offensive': return `OFFENSIVE → ${tname(o.target)} (${o.sources.map(s2 => `${s2.strength} from ${tname(s2.from)}`).join(' + ')})${o.amphibious ? ' amphibious' : ''}`;
    case 'naval': return `NAVAL ${o.mission.toUpperCase()} ${tname(o.zone)} (${o.strength} from ${tname(o.from)})`;
    case 'entrench': return `ENTRENCH ${tname(o.territory)}`;
    case 'strat_card': return `CARD "${app.g.game.cards[o.cardId]?.title}" ${o.forOps ? 'for ops' : 'for the event'}`;
    case 'ops_card': return `OPS CARD "${app.g.game.opsCards[o.cardId]?.title}" on ${tname(o.battle)}`;
    case 'intel_op': return `INTEL: pressure ${o.track} ${o.delta > 0 ? '+1' : '-1'}`;
    case 'lend_lease': return `LEND-LEASE ${o.amount} → ${pname(o.to)}`;
    case 'build': return `BUILD ${o.amount} ${o.what} in ${tname(o.territory)}`;
    case 'enter_war': return `DECLARE WAR`;
    case 'defect': return `DEFECT ${pname(o.nation)}`;
    case 'sell_commitment': return `SELL ${pname(o.nation)}'s commitment`;
    case 'decisive_battle': return `DECISIVE BATTLE in ${tname(o.zone)}`;
    case 'initiative_bid': return `BID ${o.points} pool on initiative`;
    case 'ultra': return `ULTRA on ${pname(o.targetPower)}`;
    default: return o.type;
  }
}

function renderSheet() {
  const sheet = $('#sheet');
  if (!sheet) return;
  const g = app.g, pid = app.current;
  const v = validateSheet(g.game, g.state, pid, { orders: app.draft });
  sheet.innerHTML = `<h3>Order sheet — ${g.calendar().label}</h3>` +
    (app.draft.length ? app.draft.map((o, i) =>
      `<div class="order-line"><span>${esc(describeOrder(o))}</span>
       <span><span class="x" data-rm="${i}" title="strike this order"> ✕</span></span></div>`).join('')
      : `<div class="dim">No orders written.</div>`) +
    `<div class="budget ${v.spent > v.budget ? 'over' : ''}">
       <span>COMMAND POINTS</span><span>${v.spent} / ${v.budget}</span></div>` +
    (v.dropped.length ? `<div class="small" style="color:#8a2f22">${v.dropped.length} line(s) will be refused — ${esc(v.dropped[0].reason)}${v.dropped.length > 1 ? '…' : ''}</div>` : '') +
    `<div class="stamp">MOST SECRET</div>`;
  sheet.addEventListener('click', e => {
    const i = e.target.dataset?.rm;
    if (i !== undefined) { app.draft.splice(parseInt(i, 10), 1); refresh(); }
  }, { once: true });
}

function panelReveal(body, foot) {
  const g = app.g, s = g.state;
  $('#panel-title').textContent = 'The reveal';
  $('#panel-sub').textContent = 'all sheets turn face up together';
  // Joint orders and events are already in the round log; show the sheets.
  const grid = el(`<div class="sheet-grid"></div>`);
  for (const pid of Object.keys(POWERS)) {
    const sheet = s.orders[pid];
    if (!sheet || !sheet.orders.length) continue;
    grid.appendChild(el(`<div class="order-sheet">
      <h3><span class="power-chip" style="background:${POWERS[pid].color}"></span>${POWERS[pid].short}</h3>
      ${sheet.orders.map(o => `<div class="order-line"><span>${esc(describeOrder(o))}</span></div>`).join('')}
    </div>`));
  }
  body.appendChild(grid);
  // Conditional coin declaration.
  const battles = s.battles.filter(b => b.kind === 'land' &&
    s.t[b.target].strength > 0);
  const humanSides = new Set(humanSeats().map(h => sideOfPower(s, h)));
  for (const side of humanSides) {
    if (!battles.length) break;
    body.appendChild(el(`<div class="notice">If ${side.toUpperCase()} wins initiative, the coin falls on:
      <select data-coin="${side}">
        <option value="">let the staff choose</option>
        ${battles.map(b => `<option value="${b.target}">${tname(b.target)}</option>`).join('')}
      </select></div>`));
  }
  foot.appendChild(el(`<button class="primary" id="resolve-btn">Roll the dice</button>`));
  $('#resolve-btn').addEventListener('click', () => {
    for (const sel of body.querySelectorAll('[data-coin]')) {
      if (sel.value) app.coinChoice[sel.dataset.coin] = sel.value;
    }
    runResolutionStage();
  });
}

function panelResolution(body, foot) {
  const s = app.g.state;
  $('#panel-title').textContent = 'Resolution';
  $('#panel-sub').textContent = `initiative: ${s.initiative}`;
  const lines = s.roundLog.filter(l =>
    /take |fail |THE COIN|Initiative|advances|Convoy|Decisive|escorts|station/.test(l));
  body.innerHTML = `<div class="mono small">${lines.map(l =>
    `<div class="line" style="padding:3px 0;border-bottom:1px solid var(--line)">${esc(l)}</div>`).join('')
    || '<div class="dim">A quiet round. No battles.</div>'}</div>`;
  foot.appendChild(el(`<button class="primary" id="reckon-btn">The reckoning</button>`));
  $('#reckon-btn').addEventListener('click', () => {
    runReckoningStage();
    if (app.mode === 'online') publishAfterResolve();
  });
}

function panelVictory() {
  const s = app.g.state, v = s.victory;
  $('#panel-title').textContent = 'The war is over';
  $('#panel-sub').textContent = v.type;
  const root = $('#app');
  const winnerColor = v.winner === 'axis' ? 'var(--axis)' : v.winner === 'allied' ? 'var(--allied)' : 'var(--ink-dim)';
  root.innerHTML = '';
  root.appendChild(el(`<div style="overflow-y:auto;height:100vh"><div class="victory">
    <h1 style="color:${winnerColor}">${v.winner ? (v.winner === 'axis' ? 'Axis victory' : 'Allied victory') : 'Contested peace'}</h1>
    <p>${esc(v.text)}</p>
    ${v.vp ? `<p class="mono">Victory points — Axis ${v.vp.axis} · Allied ${v.vp.allied}</p>` : ''}
    ${v.ranking?.length ? `<h3 style="margin-top:18px">The winners rank by honors</h3>` +
      v.ranking.map((r, i) => `<div class="rank-row"><span>${i + 1}. ${POWERS[r.power].name}</span><span>${r.honors} objectives met</span></div>`).join('') : ''}
    <p class="footnote">${esc(v.footnote ?? '')} The fastest way to lose this game is to play it well by yourself.</p>
    <div class="row" style="margin-top:20px;display:flex;gap:10px">
      <button class="primary" onclick="location.reload()">New war</button>
    </div>
  </div></div>`));
}

// ————————————————————————— modals —————————————————————————

function showModal(innerHtml) {
  const back = el(`<div class="modal-back"><div class="modal">${innerHtml}</div></div>`);
  back.addEventListener('click', e => {
    if (e.target === back || e.target.dataset?.close !== undefined && e.target.dataset.close !== null && e.target.hasAttribute('data-close')) back.remove();
  });
  document.body.appendChild(back);
  return back;
}

function pickModal(title, options, onPick) {
  const back = showModal(`<h3>${esc(title)}</h3>
    <div class="row">${options.map(o => `<button data-pick="${esc(o)}">${esc(pname(o) !== o ? pname(o) : o)}</button>`).join('')}</div>
    <div class="row"><button data-close class="small">Cancel</button></div>`);
  back.querySelector('.modal').addEventListener('click', e => {
    const v = e.target.dataset?.pick;
    if (v !== undefined) { back.remove(); onPick(v); }
  });
}

// ————————————————————————— online mode —————————————————————————

function newShared(seats, seed) {
  const g = new Coalition1939({ seed });
  return {
    mode: 'online', seed,
    seats: Object.fromEntries(Object.keys(POWERS).map(p =>
      [p, { kind: seats[p], claimedBy: null, name: '' }])),
    stateJson: g.save(),
    commits: {}, reveals: {}, stage: 'council', councilInput: null,
  };
}

async function startOnline(seats, seed) {
  app.mode = 'online';
  app.shared = newShared(seats, seed);
  const res = await app.sync.publish(app.shared);
  if (!res.ok) {
    showModal(`<h3>Could not open the table</h3><p class="small">${esc(res.error ?? 'publish refused')} —
      falling back to local play.</p><div class="row"><button class="primary" data-close>OK</button></div>`);
    startLocal(seats, seed);
    return;
  }
  resumeOnline();
}

function mySeat() {
  if (!app.shared) return null;
  for (const [pid, seat] of Object.entries(app.shared.seats)) {
    if (seat.kind === 'human' && seat.claimedBy === app.myToken) return pid;
  }
  return null;
}

function resumeOnline() {
  app.mode = 'online';
  app.screen = 'game';
  app.g = new Coalition1939({ seed: app.shared.seed });
  app.g.load(app.shared.stateJson);
  app.seats = Object.fromEntries(Object.entries(app.shared.seats).map(([p, s2]) => [p, s2.kind]));
  renderChrome();
  const seat = mySeat();
  const unclaimed = Object.entries(app.shared.seats).filter(([, s2]) => s2.kind === 'human' && !s2.claimedBy);
  if (!seat && unclaimed.length) {
    pickModal('Claim your seat', unclaimed.map(([p]) => p), async pid => {
      app.shared.seats[pid].claimedBy = app.myToken;
      await app.sync.publish(app.shared);
      onlineStep();
    });
  }
  onlineStep();
}

// Online round driver: advance whatever the shared state allows.
async function onlineStep() {
  const g = app.g, s = g.state, sh = app.shared;
  const seat = mySeat();
  if (s.victory) { app.stage = 'victory'; refresh(); return; }

  if (sh.stage === 'council') {
    // First device to arrive runs intel+council deterministically (AI council
    // stands in for the table's talk; the talk itself happens wherever the
    // players are talking).
    g.intel();
    g.council(aiCouncil(g));
    const plans = { axis: makeTeamPlan(g, 'axis'), allied: makeTeamPlan(g, 'allied') };
    for (const pid of Object.keys(POWERS)) {
      if (sh.seats[pid].kind !== 'human') g.submitOrders(pid, aiOrders(g, pid, plans[sideOfPower(g.state, pid)]));
    }
    sh.stage = 'orders';
    sh.stateJson = g.save();
    await app.sync.publish(sh);
  } else {
    g.load(sh.stateJson);
  }

  app.stage = 'orders';
  app.current = seat;
  app.draft = net.loadOrders(s.round, seat) ?? [];
  refresh();
  renderOnlineStatus();
}

function renderOnlineStatus() {
  const sh = app.shared, s = app.g.state;
  const humans = Object.entries(sh.seats).filter(([, x]) => x.kind === 'human').map(([p]) => p);
  const committed = humans.filter(p => sh.commits[p]);
  const revealed = humans.filter(p => sh.reveals[p]);
  const seat = mySeat();
  const body = $('#panel-body');
  const status = el(`<div class="notice">
    <div class="mono small">COMMITTED ${committed.length}/${humans.length} · REVEALED ${revealed.length}/${humans.length}</div>
    <div class="small dim">${humans.map(p => `${pname(p)}: ${sh.reveals[p] ? 'revealed' : sh.commits[p] ? 'committed' : 'writing…'}`).join(' · ')}</div>
    ${seat && sh.commits[seat] && !sh.reveals[seat] && committed.length === humans.length
      ? '<button class="primary" id="reveal-mine" style="margin-top:6px">Reveal my orders</button>' : ''}
    ${revealed.length === humans.length && humans.length > 0
      ? '<button class="primary" id="resolve-online" style="margin-top:6px">Resolve the round</button>' : ''}
    <button id="refresh-online" style="margin-top:6px">Check the table</button>
  </div>`);
  body.prepend(status);
  $('#refresh-online')?.addEventListener('click', () => location.reload());
  $('#reveal-mine')?.addEventListener('click', revealOnline);
  $('#resolve-online')?.addEventListener('click', resolveOnline);
}

async function commitOnline() {
  const s = app.g.state, seat = mySeat();
  if (!seat) return;
  const salt = net.randomSalt();
  net.storeSalt(s.round, seat, salt);
  net.storeOrders(s.round, seat, app.draft);
  const hash = await net.commitFor(app.draft, salt);
  app.shared.commits[seat] = { hash };
  // Ultra disclosure: the device honors Bletchley automatically.
  if (s.ultra?.target === seat) {
    app.shared.commits[seat].ultraLines = app.draft.filter(o => orderInTheatre(o, s.ultra.theatre));
  }
  const res = await app.sync.publish(app.shared);
  if (res.conflict) location.reload();
  else location.reload();
}

async function revealOnline() {
  const s = app.g.state, seat = mySeat();
  const salt = net.loadSalt(s.round, seat);
  const orders = net.loadOrders(s.round, seat);
  if (!salt || !orders) {
    showModal(`<h3>Salt lost</h3><p class="small">This device no longer holds the salt for the commit
      (storage was cleared). The table sees a broken reveal — submit an empty sheet.</p>
      <div class="row"><button data-close class="primary">OK</button></div>`);
    app.shared.reveals[seat] = { orders: [], salt: 'lost' };
  } else {
    app.shared.reveals[seat] = { orders, salt };
  }
  await app.sync.publish(app.shared);
  location.reload();
}

async function resolveOnline() {
  const g = app.g, s = g.state, sh = app.shared;
  // Verify every reveal against its commit; a mismatch is shown to the table.
  const broken = [];
  for (const [pid, rev] of Object.entries(sh.reveals)) {
    const ok = await net.verifyReveal(rev.orders, rev.salt, sh.commits[pid]?.hash ?? '');
    if (!ok) broken.push(pid);
  }
  for (const [pid, rev] of Object.entries(sh.reveals)) {
    const sheet = broken.includes(pid) ? { orders: [] } : { orders: rev.orders };
    g.submitOrders(pid, sheet);
    if (broken.includes(pid)) s.roundLog.push(`${pname(pid)}'s reveal FAILED the hash check — the sheet is void and the table knows.`);
  }
  // Provably fair dice: the round's seed is the hash of everyone's reveals.
  s.rngState = net.roundSeed(sh.reveals, s.round, sh.seed);
  g.runReveal();
  g.runResolution();
  g.runReckoning();
  sh.stateJson = g.save();
  sh.commits = {}; sh.reveals = {};
  sh.stage = 'council';
  await app.sync.publish(sh);
  location.reload();
}

async function publishAfterResolve() { /* local mode no-op */ }

// ————————————————————————— go —————————————————————————

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
