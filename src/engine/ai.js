// Heuristic AI seats. The point of the design is that coordination wins, so the
// AI has a coordination dial: a coordinated team builds a shared plan and
// writes joint orders; an uncoordinated seat plays greedy solo war. The
// simulation uses the dial to test the thesis, and solo human games use the
// coordinated AI as allies and enemies.

import { POWERS, NATIONS } from './data.js';
import { sideOfOwner, sideOfPower, controllerOf, ownedTagsOf, powersActiveInTheatre } from './rules.js';

function stacksOf(gameObj, powerId) {
  const { game, state } = gameObj;
  const tags = ownedTagsOf(state, powerId);
  return Object.entries(state.t)
    .filter(([, ts]) => tags.includes(ts.owner) && ts.strength > 0)
    .map(([tid, ts]) => ({ tid, ts }));
}

function targetValue(game, state, tid) {
  const t = game.map[tid];
  let v = (t.victoryCity?.weight ?? 0) * 4 + t.supply;
  if (t.capitalOf) v += 5;
  if (t.industrial) v += 2;
  for (const c of Object.values(game.corridors)) {
    if (c.edges.flat().includes(tid)) v += 3;
  }
  return v;
}

function defenseEstimate(game, state, tid) {
  const t = game.map[tid];
  const ts = state.t[tid];
  let d = ts.strength;
  if (['mountain', 'urban', 'jungle', 'island'].includes(t.terrain)) d += 2;
  d += ts.fort * 2;
  return d;
}

// Shared target list for a side. Coordinated planning prefers targets several
// powers can reach together — that is where the combined-operations math lives.
export function makeTeamPlan(gameObj, side, { coordinated = true } = {}) {
  const { game, state } = gameObj;
  const contributors = {}; // target -> { power -> {from, strength} }
  for (const pid of Object.keys(POWERS)) {
    const p = state.powers[pid];
    if (p.side !== side || !p.atWar) continue;
    for (const { tid, ts } of stacksOf(gameObj, pid)) {
      if (ts.strength < 2 || game.map[tid].type === 'sea') continue;
      for (const n of game.map[tid].adjacent) {
        const ns = sideOfOwner(state, state.t[n].owner);
        if (game.map[n].type === 'sea') continue;
        const isEnemy = (side === 'axis' && ns === 'allied') || (side === 'allied' && ns === 'axis');
        // The Axis also grinds neutral minors on its path (the 1939-41 playbook).
        const isMinorPrey = side === 'axis' && ns === 'neutral'
          && !state.powers[state.t[n].owner] && !state.nations[state.t[n].owner]
          && state.round <= 6;
        if (!isEnemy && !isMinorPrey) continue;
        contributors[n] = contributors[n] || {};
        const cur = contributors[n][pid];
        const spare = Math.min(8, ts.strength - 1);
        if (!cur || spare > cur.strength) contributors[n][pid] = { from: tid, strength: spare };
      }
    }
  }
  const scored = Object.entries(contributors).map(([target, byPower]) => {
    const powers = Object.entries(byPower).filter(([, c]) => c.strength >= 1);
    const totalPossible = powers.reduce((s, [, c]) => s + c.strength, 0);
    const def = defenseEstimate(game, state, target);
    const nPowers = powers.length;
    // Expected-hits sketch: dice * P(hit) with the combined-ops threshold.
    const th = Math.max(3, 5 - (nPowers - 1));
    const expHits = Math.min(totalPossible, 8 * nPowers) * (7 - th) / 6;
    let score = targetValue(game, state, target) + expHits - def * 1.2;
    if (coordinated && nPowers >= 2) score += 4; // the whole thesis, as a bonus
    if (!coordinated && nPowers >= 2) score -= 1; // solo players double-book by accident less
    return { target, byPower: Object.fromEntries(powers), score, def, nPowers };
  }).filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 6);
}

export function aiCouncil(gameObj) {
  const { game, state } = gameObj;
  const commanders = [];
  const theatres = new Set(Object.values(game.map).map(t => t.theatre));
  for (const theatre of theatres) {
    for (const side of ['axis', 'allied']) {
      const active = powersActiveInTheatre(game, state, theatre, side);
      if (active.length >= 3) {
        // Trust the strongest presence with the office.
        const best = active.sort((a, b) => theatreStrength(gameObj, b, theatre) - theatreStrength(gameObj, a, theatre))[0];
        commanders.push({ theatre, power: best });
      }
    }
  }
  const ultra = state.powers.uk.atWar
    ? { target: 'germany', theatre: state.round <= 4 ? 'west' : 'eastern' }
    : null;
  return { commanders, ultra };
}

function theatreStrength(gameObj, pid, theatre) {
  const { game, state } = gameObj;
  return stacksOf(gameObj, pid)
    .filter(({ tid }) => game.map[tid].theatre === theatre)
    .reduce((s, { ts }) => s + ts.strength, 0);
}

export function aiOrders(gameObj, powerId, plan, { coordinated = true } = {}) {
  const { game, state } = gameObj;
  const p = state.powers[powerId];
  const orders = [];
  let cp = p.cp;
  const committedFrom = {};

  // 1. Strategy card: own-side events fire; otherwise burn a cheap card for ops.
  if (p.stratHand.length) {
    const mySide = sideOfPower(state, powerId);
    const own = p.stratHand
      .map(id => game.cards[id])
      .filter(c => c.side === mySide || c.side === 'neutral')
      .sort((a, b) => b.ops - a.ops);
    const foes = p.stratHand
      .map(id => game.cards[id])
      .filter(c => c.side !== mySide && c.side !== 'neutral')
      .sort((a, b) => a.ops - b.ops);
    if (own.length && own[0].effects.length && own[0].side !== 'neutral') {
      orders.push({ type: 'strat_card', cardId: own[0].id, forOps: false });
    } else if (own.length) {
      orders.push({ type: 'strat_card', cardId: own[0].id, forOps: true });
      cp += own[0].ops;
    } else if (foes.length) {
      orders.push({ type: 'strat_card', cardId: foes[0].id, forOps: true });
      cp += foes[0].ops;
    }
  }

  // 2. Neutral powers build, posture, and watch the clock.
  if (!p.atWar) {
    if (p.pressure !== null && p.pressure >= 7) orders.push({ type: 'enter_war' });
    aiBuilds(gameObj, powerId, orders);
    if (powerId === 'usa') aiLendLease(gameObj, powerId, orders);
    return { power: powerId, orders };
  }

  // 3. Offensives from the team plan.
  let offensives = 0;
  for (const t of plan) {
    if (cp < 3 || offensives >= 3) break;
    const mine = t.byPower[powerId];
    if (!mine) continue;
    const avail = state.t[mine.from].strength - 1 - (committedFrom[mine.from] || 0);
    const commit = Math.min(8, mine.strength, avail);
    if (commit < 1) continue;
    // Solo players skip fights they can't win alone; coordinated ones trust the plan.
    if (!coordinated && commit * 0.33 < state.t[t.target].strength * 0.5) continue;
    orders.push({ type: 'offensive', target: t.target, sources: [{ from: mine.from, strength: commit }] });
    committedFrom[mine.from] = (committedFrom[mine.from] || 0) + commit;
    cp -= 3; offensives++;
    // Attach a punch card to the first big push.
    if (offensives === 1 && p.opsHand.length && cp >= 1) {
      const punch = p.opsHand.map(id => game.opsCards[id])
        .find(c => ['extra_dice', 'reroll', 'threshold'].includes(c.effect.kind) && c.cost <= cp);
      if (punch) { orders.push({ type: 'ops_card', cardId: punch.id, battle: t.target }); cp -= punch.cost; }
    }
  }

  // 4. Hold the line: entrench threatened victory cities.
  for (const { tid, ts } of stacksOf(gameObj, powerId)) {
    if (cp < 1) break;
    const t = game.map[tid];
    if (!t.victoryCity && !t.capitalOf) continue;
    const threat = t.adjacent.reduce((s, n) => {
      const ns = sideOfOwner(state, state.t[n].owner);
      const hostile = ns !== 'none' && ns !== 'neutral' && ns !== p.side;
      return s + (hostile ? state.t[n].strength : 0);
    }, 0);
    if (threat >= ts.strength && !ts.entrenched) {
      orders.push({ type: 'entrench', territory: tid });
      cp -= 1;
    }
  }

  // 5. Navies: hold the lifelines, contest the contested.
  if (p.ratings.sea >= 3 && cp >= 2) {
    for (const [cid, c] of Object.entries(game.corridors)) {
      if (cp < 2) break;
      if (!c.powers.includes(powerId)) continue;
      for (const [a, b] of c.edges) {
        const zone = game.map[a].type === 'sea' ? a : game.map[b].type === 'sea' ? b : null;
        if (!zone) continue;
        const zs = state.t[zone];
        const zSide = sideOfOwner(state, zs.owner);
        if (zSide === p.side && zs.strength > 0) continue;
        const src = stacksOf(gameObj, powerId)
          .filter(({ tid }) => game.map[tid].adjacent.includes(zone) || tid === zone)
          .sort((x, y) => y.ts.strength - x.ts.strength)[0];
        if (!src || src.ts.strength < 2) continue;
        const n = Math.min(p.ratings.sea, src.ts.strength - 1, 3);
        orders.push({ type: 'naval', zone, from: src.tid, strength: n, mission: zSide === p.side || zSide === 'none' ? 'escort' : 'contest' });
        cp -= powerId === 'italy' && game.map[zone].theatre === 'med' ? 0 : 2;
        break;
      }
    }
  }

  // 6. Reinforce the front with what's left.
  const frontline = new Set();
  for (const { tid } of stacksOf(gameObj, powerId)) {
    for (const n of game.map[tid].adjacent) {
      const ns = sideOfOwner(state, state.t[n].owner);
      if (ns !== 'none' && ns !== 'neutral' && ns !== p.side) frontline.add(tid);
    }
  }
  const rears = stacksOf(gameObj, powerId)
    .filter(({ tid, ts }) => !frontline.has(tid) && ts.strength > 2 && game.map[tid].type === 'land')
    .sort((a, b) => b.ts.strength - a.ts.strength);
  for (const rear of rears) {
    if (cp < 1) break;
    const toward = game.map[rear.tid].adjacent.find(n =>
      (frontline.has(n) || nearFront(gameObj, powerId, n, frontline))
      && ownedTagsOf(state, powerId).includes(state.t[n].owner));
    if (!toward) continue;
    const mv = Math.min(rear.ts.strength - 1 - (committedFrom[rear.tid] || 0), 4);
    if (mv < 1) continue;
    orders.push({ type: 'move', from: rear.tid, to: toward, strength: mv });
    committedFrom[rear.tid] = (committedFrom[rear.tid] || 0) + mv;
    cp -= 1;
  }

  // 7. Money: builds and lend-lease.
  aiBuilds(gameObj, powerId, orders);
  if (['usa', 'uk'].includes(powerId)) aiLendLease(gameObj, powerId, orders);

  // 8. Seat quirks.
  if (powerId === 'indies') {
    for (const [nid, n] of Object.entries(state.nations)) {
      if (n.allegiance === 'axis' && n.pressure >= 7 && state.powers.germany.homeFront <= 4) {
        orders.push({ type: 'defect', nation: nid });
        break;
      }
    }
    if (state.round <= 6) {
      const client = Object.entries(state.nations).find(([, n]) => n.allegiance === 'axis' && n.pressure < 5);
      if (client) orders.push({ type: 'sell_commitment', nation: client[0], buyer: 'germany' });
    }
  }
  if (powerId === 'japan' && !p.decisiveUsed) {
    const naval = orders.find(o => o.type === 'naval' && o.mission === 'contest' && o.strength >= 3);
    if (naval) orders.push({ type: 'decisive_battle', zone: naval.zone });
  }
  const side = sideOfPower(state, powerId);
  if (coordinated && state.pool[side] >= 3 && p.ratings.intel >= 3) {
    orders.push({ type: 'initiative_bid', points: 1 });
  }
  // Intelligence war over the neutral tracks.
  if (cp >= 2 && p.ratings.intel >= 3) {
    if (side === 'allied' && !state.powers.usa.atWar) {
      orders.push({ type: 'intel_op', kind: 'pressure', track: 'usa', delta: 1 }); cp -= 2;
    } else if (side === 'axis' && !state.powers.usa.atWar) {
      orders.push({ type: 'intel_op', kind: 'pressure', track: 'usa', delta: -1 }); cp -= 2;
    } else if (side === 'allied') {
      const client = Object.entries(state.nations).find(([, n]) => n.allegiance === 'axis');
      if (client) { orders.push({ type: 'intel_op', kind: 'pressure', track: client[0], delta: 1 }); cp -= 2; }
    }
  }

  return { power: powerId, orders };
}

function nearFront(gameObj, powerId, tid, frontline) {
  return gameObj.game.map[tid].adjacent.some(n => frontline.has(n));
}

function aiBuilds(gameObj, powerId, orders) {
  const { game, state } = gameObj;
  const p = state.powers[powerId];
  if (p.production < 2) return;
  const tags = ownedTagsOf(state, powerId);
  const sites = Object.entries(state.t)
    .filter(([tid, ts]) => game.map[tid].industrial && tags.includes(ts.owner) && ts.supplied)
    .sort((a, b) => frontDistanceScore(gameObj, powerId, a[0]) - frontDistanceScore(gameObj, powerId, b[0]));
  if (!sites.length) return;
  const per = p.ratings.manpower >= 3 ? 2 : 3;
  const n = Math.floor(p.production / per);
  if (n >= 1) orders.push({ type: 'build', territory: sites[0][0], what: 'strength', amount: n });
}

function frontDistanceScore(gameObj, powerId, tid) {
  const { game, state } = gameObj;
  const side = sideOfPower(state, powerId);
  const seen = new Set([tid]);
  let ring = [tid];
  for (let d = 0; d < 6; d++) {
    const next = [];
    for (const cur of ring) {
      for (const nb of game.map[cur].adjacent) {
        const ns = sideOfOwner(state, state.t[nb].owner);
        if (ns !== 'none' && ns !== 'neutral' && ns !== side) return d;
        if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
      }
    }
    ring = next;
  }
  return 9;
}

function aiLendLease(gameObj, powerId, orders) {
  const { state } = gameObj;
  const p = state.powers[powerId];
  if (p.production < 3) return;
  const wants = [];
  if (powerId === 'usa') {
    if (state.powers.ussr.atWar && state.corridors.arctic_convoy.open) wants.push('ussr');
    if (state.powers.uk.atWar) wants.push('uk');
    if (state.powers.china.atWar && state.corridors.burma_road.open) wants.push('china');
  } else if (powerId === 'uk') {
    if (state.powers.china.atWar && state.corridors.burma_road.open && p.production >= 5) wants.push('china');
  }
  if (wants.length) orders.push({ type: 'lend_lease', to: wants[0], amount: Math.min(3, p.production - 1) });
}

// Drive one full round with AI in every listed seat (default: all).
export function aiRound(gameObj, options = {}) {
  const coordination = options.coordination ?? { axis: true, allied: true };
  gameObj.intel();
  gameObj.council(aiCouncil(gameObj));
  const plans = {
    axis: makeTeamPlan(gameObj, 'axis', { coordinated: coordination.axis }),
    allied: makeTeamPlan(gameObj, 'allied', { coordinated: coordination.allied }),
  };
  for (const pid of Object.keys(POWERS)) {
    if (options.skip?.includes(pid)) continue;
    const side = sideOfPower(gameObj.state, pid);
    gameObj.submitOrders(pid, aiOrders(gameObj, pid, plans[side], { coordinated: coordination[side] }));
  }
  if (options.beforeReveal) options.beforeReveal();
  gameObj.runReveal();
  gameObj.runResolution();
  gameObj.runReckoning();
}
