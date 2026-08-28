// Game construction: the immutable `game` (map, decks, corridors, rng seed)
// and the mutable `state` (everything that changes round to round).

import { buildMap, CORRIDORS, POWERS, NATIONS } from './data.js';
import { makeRng } from './rng.js';
import { traceSupply, recomputeCorridors, computeCP } from './rules.js';
import { STRATEGY_CARDS } from '../data/generated/cards-strategy.js';
import { OPS_CARDS } from '../data/generated/cards-operations.js';
import { DOCTRINES } from '../data/generated/doctrines.js';

const START_HOME_FRONT = {
  uk: 7, china: 5, ussr: 7, usa: 8, germany: 8, japan: 8, italy: 5, indies: 6,
};

export const STRAT_HAND_SIZE = 4;

export function opsHandSize(power) {
  return 2 + Math.floor(POWERS[power].ratings.intel / 2);
}

export function eraForRound(round) {
  return round <= 3 ? 'early' : round <= 9 ? 'mid' : 'late';
}

export function createGame(options = {}) {
  const map = buildMap();
  const game = {
    map,
    corridors: CORRIDORS,
    cards: {},
    opsCards: {},
    doctrines: {},
    seed: options.seed ?? 'coalition-1939',
  };
  for (const c of STRATEGY_CARDS) game.cards[c.id] = c;
  for (const c of OPS_CARDS) game.opsCards[c.id] = c;
  for (const d of DOCTRINES) game.doctrines[d.id] = d;

  const rng = makeRng(game.seed);
  const state = {
    round: 1, phase: 'intel',
    rngState: 0,
    t: {}, powers: {}, nations: {},
    decks: {
      strat: {
        early: rng.shuffle(STRATEGY_CARDS.filter(c => c.era === 'early').map(c => c.id)),
        mid: rng.shuffle(STRATEGY_CARDS.filter(c => c.era === 'mid').map(c => c.id)),
        late: rng.shuffle(STRATEGY_CARDS.filter(c => c.era === 'late').map(c => c.id)),
        discard: [], removed: [],
      },
      ops: rng.shuffle(OPS_CARDS.map(c => c.id)),
      opsDiscard: [],
    },
    pool: { axis: 0, allied: 0 },
    initiative: 'axis',
    commanders: {},
    commanderSpent: {},
    bombedThisRound: {},
    activeFlags: [],
    thresholdMods: [],
    corridors: {},
    orders: {}, commits: {},
    roundLog: [], gameLog: [],
    battles: [],
    franceFallen: false, italyFlipped: false, japanGlobal: false,
    firstStrike: {},
    coinUsedRound: 0,
    victory: null,
    productionDelta: {},
    lendLeaseIncoming: {},
    partisanBase: [],
  };

  for (const cid of Object.keys(CORRIDORS)) {
    state.corridors[cid] = { open: true, forcedClosed: 0 };
  }

  for (const [pid, p] of Object.entries(POWERS)) {
    state.powers[pid] = {
      id: pid, side: p.side,
      atWar: pid === 'italy' ? false : !!p.atWar,
      entersRound: p.entersRound ?? null,
      pressure: p.pressureStart ?? null,
      homeFront: START_HOME_FRONT[pid],
      ratings: { ...p.ratings },
      production: 0, cp: 0,
      doctrines: [], stratHand: [], opsHand: [],
      decisiveUsed: false, ultraUsedRound: 0,
      arsenalBonus: 0,
      forcedNegotiation: false,
      objectivesMet: {}, honors: 0,
      lossesLastRound: 0,
    };
  }
  for (const [nid, n] of Object.entries(NATIONS)) {
    state.nations[nid] = {
      id: nid, allegiance: n.joins === 1 ? 'axis' : 'neutral',
      joins: n.joins, pressure: n.pressureStart, sovereign: true,
    };
  }

  for (const [tid, t] of Object.entries(map)) {
    state.t[tid] = {
      owner: t.setup.owner, strength: t.setup.strength, fort: t.setup.fort,
      entrenched: false, supplied: true,
    };
    if (t.setup.owner === 'china') state.partisanBase.push(tid);
  }
  // Chinese soil for partisan purposes = every China-owned land territory at start.
  state.partisanBase = Object.entries(map)
    .filter(([, t]) => t.setup.owner === 'china')
    .map(([tid]) => tid);

  // Doctrine draft: honor explicit picks (max two), then snake-fill so the
  // seats with the thinnest pools pick first — every power ends with two.
  const picks = options.doctrines ?? {};
  const taken = new Set();
  const chosenBy = Object.fromEntries(Object.keys(POWERS).map(p => [p, []]));
  for (const pid of Object.keys(POWERS)) {
    for (const id of (picks[pid] ?? []).slice(0, 2)) {
      const d = game.doctrines[id];
      if (d && d.pool.includes(pid) && !taken.has(id)) { chosenBy[pid].push(id); taken.add(id); }
    }
  }
  for (let round = 0; round < 2; round++) {
    const order = Object.keys(POWERS)
      .filter(pid => chosenBy[pid].length < 2)
      .sort((a, b) =>
        DOCTRINES.filter(d => d.pool.includes(a) && !taken.has(d.id)).length -
        DOCTRINES.filter(d => d.pool.includes(b) && !taken.has(d.id)).length);
    for (const pid of order) {
      if (chosenBy[pid].length >= round + 1) continue;
      const d = DOCTRINES.find(x => x.pool.includes(pid) && !taken.has(x.id));
      if (d) { chosenBy[pid].push(d.id); taken.add(d.id); }
    }
  }
  for (const pid of Object.keys(POWERS)) state.powers[pid].doctrines = chosenBy[pid];

  recomputeCorridors(game, state);
  traceSupply(game, state);
  for (const pid of Object.keys(POWERS)) {
    state.powers[pid].cp = computeCP(game, state, pid);
  }
  state.rngState = rng.state();
  return { game, state };
}

export function hasDoctrine(game, state, powerId, kind, filter = {}) {
  for (const id of state.powers[powerId].doctrines) {
    const d = game.doctrines[id];
    if (d.passive.kind !== kind) continue;
    let ok = true;
    for (const [k, v] of Object.entries(filter)) {
      if (d.passive[k] !== v && d.passive[k] !== 'any') ok = false;
    }
    if (ok) return d;
  }
  return null;
}

export function hasFlag(state, name, power = null) {
  return state.activeFlags.some(f => f.name === name && (power === null || f.power === power || !f.power));
}
