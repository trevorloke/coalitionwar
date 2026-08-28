// Core rules helpers: allegiance, supply tracing, corridors, command points,
// hit thresholds. Pure functions over (game, state); no mutation here.

import { TERRAIN_DEFENSE } from './data.js';

export const PHASES = ['intel', 'council', 'orders', 'reveal', 'resolution', 'reckoning'];

export const COSTS = {
  move: 1, offensive: 3, naval: 2, entrench: 1, intel_op: 2, lend_lease: 1,
};

export const POOL_SPENDS = {
  reroll: 2, initiative: 2, resupply: 3, cancel_event: 4,
};

export const BUILD_COSTS = { strength: 2, strength_low_manpower: 3, ship: 3, fort: 2 };
export const MAX_COMMIT_PER_POWER = 8; // the 8-strength ceiling
export const THRESHOLD_FLOOR = 3;
export const THRESHOLD_CEIL = 6;
export const MAX_PRODUCTION_BANK = 6;

// ——— allegiance ———

export function sideOfPower(state, powerId) {
  return state.powers[powerId].side;
}

// Side of a territory owner tag. Returns 'axis' | 'allied' | 'neutral' | 'none'.
export function sideOfOwner(state, owner) {
  if (owner === 'none') return 'none';
  if (owner === 'neutral' || owner === 'vichy') return 'neutral';
  if (owner === 'france') return state.franceFallen ? 'neutral' : 'allied';
  if (state.powers[owner]) {
    const p = state.powers[owner];
    return p.atWar ? p.side : 'neutral';
  }
  if (state.nations[owner]) {
    const n = state.nations[owner];
    return n.allegiance; // 'axis' | 'allied' | 'neutral'
  }
  return 'neutral';
}

// The power seat that commands a territory's units.
export function controllerOf(state, owner) {
  if (state.powers[owner]) return owner;
  if (state.nations[owner]) return 'indies';
  if (owner === 'france' && !state.franceFallen) return 'uk';
  return null; // true neutrals, vichy, empty seas
}

export function enemies(sideA, sideB) {
  return (sideA === 'axis' && sideB === 'allied') || (sideA === 'allied' && sideB === 'axis');
}

export function atWar(state, powerId) {
  return state.powers[powerId].atWar;
}

// Powers a seat currently commands units for (indies → nation tags too).
export function ownedTagsOf(state, powerId) {
  const tags = [powerId];
  if (powerId === 'indies') {
    for (const [nid, n] of Object.entries(state.nations)) {
      if (n.sovereign) tags.push(nid);
    }
  }
  if (powerId === 'uk' && !state.franceFallen) tags.push('france');
  return tags;
}

// ——— supply ———

function passableFor(game, state, tid, side) {
  const t = game.map[tid];
  if (t.type === 'sea') {
    const os = sideOfOwner(state, state.t[tid].owner);
    return os === 'none' || os === side || os === 'neutral';
  }
  const os = sideOfOwner(state, state.t[tid].owner);
  return os === side;
}

function corridorEdgeBlocked(game, state, a, b, side) {
  for (const [cid, c] of Object.entries(game.corridors)) {
    for (const [ea, eb] of c.edges) {
      if ((ea === a && eb === b) || (ea === b && eb === a)) {
        // Allied lifeline edges gate on the corridor being open (for the allies).
        if (side === 'allied' && !state.corridors[cid].open) return true;
      }
    }
  }
  return false;
}

// Recompute the `supplied` flag for every land territory.
export function traceSupply(game, state) {
  const bySide = { axis: new Set(), allied: new Set() };
  // Sources: industrial territories + capitals, per owning side.
  for (const [tid, ts] of Object.entries(state.t)) {
    const t = game.map[tid];
    const side = sideOfOwner(state, ts.owner);
    if (side !== 'axis' && side !== 'allied') continue;
    if (t.industrial || t.capitalOf) bySide[side].add(tid);
  }
  const reach = { axis: new Set(), allied: new Set() };
  for (const side of ['axis', 'allied']) {
    const stack = [...bySide[side]];
    for (const s of stack) reach[side].add(s);
    while (stack.length) {
      const cur = stack.pop();
      for (const n of game.map[cur].adjacent) {
        if (reach[side].has(n)) continue;
        if (corridorEdgeBlocked(game, state, cur, n, side)) continue;
        if (!passableFor(game, state, n, side)) continue;
        reach[side].add(n);
        stack.push(n);
      }
    }
  }
  for (const [tid, ts] of Object.entries(state.t)) {
    const t = game.map[tid];
    if (t.type === 'sea') { ts.supplied = true; continue; }
    const side = sideOfOwner(state, ts.owner);
    if (side === 'neutral' || side === 'none') { ts.supplied = true; continue; }
    ts.supplied = reach[side].has(tid);
  }
}

// ——— corridors ———

export function recomputeCorridors(game, state) {
  for (const [cid, c] of Object.entries(game.corridors)) {
    const endpoints = new Set(c.edges.flat());
    let blocked = false;
    for (const tid of endpoints) {
      const t = game.map[tid];
      const os = sideOfOwner(state, state.t[tid].owner);
      if (t.type === 'sea') { if (os === 'axis') blocked = true; }
      else if (os !== 'allied') blocked = true;
    }
    // Presence: listed powers with strength in or adjacent to an endpoint.
    const present = new Set();
    for (const tid of endpoints) {
      const zone = [tid, ...game.map[tid].adjacent];
      for (const z of zone) {
        const ts = state.t[z];
        if (ts.strength > 0 && c.powers.includes(ts.owner)) present.add(ts.owner);
        // UK commands France; French presence doesn't count for a corridor.
      }
    }
    const listedAtWar = c.powers.filter(p => state.powers[p] && state.powers[p].atWar);
    const need = listedAtWar.length >= 2 ? 2 : 1;
    let open = !blocked && present.size >= need && state.corridors[cid].forcedClosed === 0;
    // The Burma Road is China's lifeline: it needs China's own presence plus
    // one Western partner — the UK and USA cannot hold it open by themselves.
    if (cid === 'burma_road' && open && state.powers.china.atWar) {
      open = present.has('china') && (present.has('uk') || present.has('usa') || listedAtWar.length === 1);
    }
    state.corridors[cid].open = open;
  }
}

// ——— command points ———

export function computeCP(game, state, powerId) {
  const p = state.powers[powerId];
  let supplied = 0, total = 0;
  const tags = ownedTagsOf(state, powerId);
  for (const [tid, ts] of Object.entries(state.t)) {
    if (!tags.includes(ts.owner) || game.map[tid].type === 'sea') continue;
    total++;
    if (ts.supplied) supplied++;
  }
  const supplyBonus = total > 0 && supplied / total >= 0.9 ? 1 : 0;
  let cp = 3 + p.ratings.industry + Math.floor(p.homeFront / 3) + supplyBonus;
  if (p.forcedNegotiation) cp = Math.ceil(cp / 2);
  return Math.max(3, Math.min(12, cp));
}

// ——— thresholds ———

// Attacker hit threshold for a battle (lower = better). Combined operations:
// -1 per allied power beyond the first committing >=1 strength, floor 3.
export function attackerThreshold(game, state, battle) {
  let th = 5;
  th -= Math.max(0, battle.attackers.length - 1);
  th += battle.mods?.attacker ?? 0;
  return Math.max(THRESHOLD_FLOOR, Math.min(THRESHOLD_CEIL, th));
}

export function defenderThreshold(game, state, battle) {
  const t = game.map[battle.target];
  const ts = state.t[battle.target];
  let th = 5;
  if (TERRAIN_DEFENSE.has(t.terrain)) th -= 1;
  if (ts.fort > 0) th -= 1;
  if (ts.entrenched) th -= 1;
  if (!ts.supplied) th += 1;
  th += battle.mods?.defender ?? 0;
  return Math.max(THRESHOLD_FLOOR, Math.min(THRESHOLD_CEIL, th));
}

export function powersActiveInTheatre(game, state, theatre, side) {
  const active = new Set();
  for (const [tid, ts] of Object.entries(state.t)) {
    if (game.map[tid].theatre !== theatre || ts.strength === 0) continue;
    const ctrl = controllerOf(state, ts.owner);
    if (!ctrl) continue;
    if (sideOfOwner(state, ts.owner) === side && state.powers[ctrl].atWar) active.add(ctrl);
  }
  return [...active];
}
