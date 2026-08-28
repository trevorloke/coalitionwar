// Phase 4.6 — the reckoning. Production, attrition, Home Front, Pressure
// tracks, defections, seat flips, the victory check, and the calendar.

import { POWERS, NATIONS } from './data.js';
import {
  sideOfOwner, sideOfPower, controllerOf, ownedTagsOf, traceSupply,
  recomputeCorridors, computeCP, BUILD_COSTS, MAX_PRODUCTION_BANK,
} from './rules.js';
import { hasDoctrine, hasFlag, eraForRound } from './state.js';

const USSR_INDUSTRIAL = ['moscow', 'leningrad', 'stalingrad', 'urals'];

export function reckon(game, state, rng) {
  const log = m => state.roundLog.push(`[reckoning] ${m}`);

  // 1. Partisans: China bleeds Japan for every stolen province; partisan doctrines too.
  let jpHeld = 0;
  for (const tid of state.partisanBase) {
    if (state.t[tid].owner === 'japan') jpHeld++;
  }
  let partisanHits = Math.floor(jpHeld / 3);
  if (hasDoctrine(game, state, 'china', 'partisans')) partisanHits += jpHeld >= 1 ? 1 : 0;
  if (hasFlag(state, 'partisan_surge')) partisanHits *= 2;
  if (partisanHits > 0 && state.powers.china.atWar) {
    bleedPower(game, state, 'japan', partisanHits, 'china_manchuria');
    log(`Chinese partisans cost Japan ${partisanHits} strength`);
  }

  // 2. Out-of-supply attrition.
  traceSupply(game, state);
  for (const [tid, ts] of Object.entries(state.t)) {
    if (game.map[tid].type === 'sea' || ts.supplied || ts.strength === 0) continue;
    ts.strength -= 1;
    const ctrl = controllerOf(state, ts.owner);
    if (ctrl) state.powers[ctrl].lossesLastRound += 1;
    log(`${game.map[tid].name} is out of supply (-1 strength)`);
  }

  // 3. Production.
  const production = {};
  for (const pid of Object.keys(POWERS)) production[pid] = 0;
  for (const [tid, ts] of Object.entries(state.t)) {
    if (!ts.supplied) continue;
    const ctrl = controllerOf(state, ts.owner);
    if (ctrl) production[ctrl] += game.map[tid].supply;
  }
  // Arsenal of democracy: the US curve bends upward from 1942.
  if (state.round >= 6) state.powers.usa.arsenalBonus += 1;
  production.usa += state.powers.usa.arsenalBonus;
  // Corridor starvation.
  if (!state.corridors.arctic_convoy.open && state.powers.ussr.atWar) {
    production.ussr = Math.max(0, production.ussr - 2);
    log('Arctic convoy closed: Soviet production stalls (-2)');
  }
  if (!state.corridors.gib_suez.open) {
    production.uk = Math.max(0, production.uk - 2);
    log('Suez route closed: UK production -2');
  }
  if (!state.corridors.burma_road.open && state.powers.china.atWar) {
    production.china = Math.max(0, production.china - 1);
    log('Burma Road cut: China starves (-1 production)');
  }
  // Card-driven production deltas.
  for (const [pid, deltas] of Object.entries(state.productionDelta)) {
    for (const d of deltas) {
      if (d.rounds > 0) { production[pid] = Math.max(0, production[pid] + d.delta); d.rounds--; }
    }
    state.productionDelta[pid] = deltas.filter(d => d.rounds > 0);
  }
  for (const pid of Object.keys(POWERS)) {
    state.powers[pid].production = Math.min(
      MAX_PRODUCTION_BANK + production[pid],
      state.powers[pid].production + production[pid]);
  }

  // 4. Lend-lease transfers (declared in orders; they arrive now, and pay the pool).
  for (const [pid, sheet] of Object.entries(state.orders)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type !== 'lend_lease') continue;
      if (!lendLeaseRouteOpen(game, state, pid, o.to)) {
        log(`${pid} lend-lease to ${o.to} fails: no open route`);
        continue;
      }
      const amount = Math.min(o.amount, state.powers[pid].production);
      if (amount <= 0) continue;
      state.powers[pid].production -= amount;
      state.powers[o.to].production += amount;
      state.pool[sideOfPower(state, pid)] += 1;
      log(`${pid} lend-leases ${amount} production to ${o.to} (+1 coalition pool)`);
    }
  }

  // 5. Builds (declared in orders, paid from the bank now).
  for (const [pid, sheet] of Object.entries(state.orders)) {
    if (!sheet) continue;
    const p = state.powers[pid];
    for (const o of sheet.orders) {
      if (o.type !== 'build') continue;
      const perStrength = p.ratings.manpower >= 3 ? BUILD_COSTS.strength : BUILD_COSTS.strength_low_manpower;
      let unitCost = o.what === 'fort' ? BUILD_COSTS.fort : o.what === 'ship' ? BUILD_COSTS.ship : perStrength;
      if (hasFlag(state, 'war_production', pid)) unitCost = Math.max(1, unitCost - 1);
      const want = Math.max(1, o.amount ?? 1);
      const afford = Math.min(want, Math.floor(p.production / unitCost));
      if (afford <= 0) continue;
      p.production -= afford * unitCost;
      const ts = state.t[o.territory];
      if (o.what === 'fort') ts.fort = Math.min(2, ts.fort + afford);
      else ts.strength += afford;
      log(`${pid} builds ${afford} ${o.what} in ${game.map[o.territory].name}`);
    }
  }

  // 6. Deep battle replacements: Soviet losses come back while the industry stands.
  const ussr = state.powers.ussr;
  if (ussr.atWar && ussr.lossesLastRound > 0) {
    const held = USSR_INDUSTRIAL.filter(t => state.t[t].owner === 'ussr' && state.t[t].supplied);
    if (held.length >= 2) {
      const back = Math.min(3, ussr.lossesLastRound);
      const site = held.sort((a, b) => state.t[b].strength - state.t[a].strength)[0];
      state.t[site].strength += back;
      log(`Deep battle: USSR raises ${back} fresh strength at ${game.map[site].name}`);
    }
  }
  for (const pid of Object.keys(POWERS)) {
    if (hasDoctrine(game, state, pid, 'replacements') && state.powers[pid].lossesLastRound > 0) {
      const tags = ownedTagsOf(state, pid);
      const site = Object.keys(state.t).find(t =>
        game.map[t].industrial && tags.includes(state.t[t].owner) && state.t[t].supplied);
      if (site) { state.t[site].strength += 1; log(`${pid} replacements: +1 at ${game.map[site].name}`); }
    }
  }

  // 7. Home Front movement.
  const records = state.battleRecords || [];
  for (const pid of Object.keys(POWERS)) {
    const p = state.powers[pid];
    if (!p.atWar) continue;
    let delta = 0;
    const wins = records.filter(r => r.result === 'captured' && r.powers?.includes(pid)).length;
    const fails = records.filter(r => r.result === 'held' && r.powers?.includes(pid)).length;
    if (wins > 0) delta += 1;
    if (fails >= 2) delta -= 1;
    if (p.lossesLastRound >= 6) delta -= 1;
    // Losing a victory city you held at the start of the round.
    const lostVC = records.some(r => {
      const t = game.map[r.target];
      return r.result?.startsWith('captured') && t.victoryCity
        && r.side !== p.side && r.defenderController === pid;
    });
    if (lostVC) delta -= 1;
    // Capital under threat.
    const cap = capitalTid(game, pid);
    if (cap && game.map[cap].adjacent.some(n => {
      const s = sideOfOwner(state, state.t[n].owner);
      return s !== 'none' && s !== 'neutral' && s !== p.side && state.t[n].strength > 0;
    })) delta -= 1;
    p.homeFront = Math.max(0, Math.min(10, p.homeFront + delta));
    if (delta !== 0) log(`${pid} home front ${delta > 0 ? '+' : ''}${delta} → ${p.homeFront}`);
    p.forcedNegotiation = p.homeFront === 0 && pid !== 'italy';
  }

  // 8. Seat changes: Italy flips, France falls.
  if (!state.italyFlipped && state.powers.italy.atWar && state.powers.italy.homeFront === 0) {
    flipItaly(game, state);
  }
  if (!state.franceFallen && sideOfOwner(state, state.t.paris.owner) === 'axis') {
    fallOfFrance(game, state);
  }

  // 9. Pressure tracks.
  advancePressure(game, state);

  // 10. Nation defections: automatic at 10, voluntary at 7+ if ordered.
  for (const [pid, sheet] of Object.entries(state.orders)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type === 'defect' && state.nations[o.nation]?.pressure >= 7) defectNation(game, state, o.nation, log);
      if (o.type === 'enter_war') tryEnter(game, state, pid, log);
    }
  }
  for (const [nid, n] of Object.entries(state.nations)) {
    if (n.allegiance === 'axis' && n.pressure >= 10) defectNation(game, state, nid, log);
  }
  // Thailand joins the Axis when its round comes (unless already defected).
  const thai = state.nations.thailand;
  if (state.round + 1 >= thai.joins && thai.allegiance === 'neutral') {
    thai.allegiance = 'axis';
    log('Thailand joins the Axis coalition');
  }
  // Automatic entry at pressure 10.
  for (const pid of ['ussr', 'usa']) {
    if (!state.powers[pid].atWar && (state.powers[pid].pressure ?? 0) >= 10) {
      enterWar(game, state, pid, log);
    }
  }
  // Italy enters by schedule.
  if (!state.powers.italy.atWar && state.round + 1 >= 2) {
    state.powers.italy.atWar = true;
    log('Italy declares war — the Mediterranean ignites');
  }

  // 11. Flags, mods, corridor force-closures tick down.
  for (const f of state.activeFlags) f.rounds--;
  state.activeFlags = state.activeFlags.filter(f => f.rounds > 0);
  for (const m of state.thresholdMods) m.rounds--;
  state.thresholdMods = state.thresholdMods.filter(m => m.rounds > 0);
  for (const c of Object.values(state.corridors)) if (c.forcedClosed > 0) c.forcedClosed--;
  for (const p of Object.values(state.powers)) {
    if (p.pressureLock?.rounds > 0) {
      p.pressureLock.rounds--;
      if (p.pressureLock.rounds === 0) {
        p.pressure = Math.min(10, p.pressure + (p.pressureLock.releaseDelta ?? 0));
        p.pressureLock = null;
      }
    }
  }

  // 12. Entrenchment expires; supply & corridors recompute.
  for (const ts of Object.values(state.t)) ts.entrenched = false;
  recomputeCorridors(game, state);
  traceSupply(game, state);

  // 13. Objectives.
  scoreObjectives(game, state);

  // 14. Victory checks.
  checkVictory(game, state);

  // 15. Advance the calendar.
  for (const p of Object.values(state.powers)) p.lossesLastRound = 0;
  state.battleRecords = [];
  state.orders = {};
  state.commits = {};
  state.commanders = {};
  state.decisiveZone = null;
  state.gameLog.push(...state.roundLog);
  state.roundLog = [];
  if (!state.victory) {
    state.round += 1;
    state.phase = 'intel';
    for (const pid of Object.keys(POWERS)) {
      state.powers[pid].cp = computeCP(game, state, pid);
    }
  }
}

function capitalTid(game, pid) {
  for (const [tid, t] of Object.entries(game.map)) if (t.capitalOf === pid) return tid;
  return null;
}

function bleedPower(game, state, pid, hits, theatre) {
  const stacks = Object.entries(state.t)
    .filter(([tid, ts]) => ts.owner === pid && ts.strength > 0
      && (!theatre || game.map[tid].theatre === theatre))
    .sort((a, b) => b[1].strength - a[1].strength);
  let left = hits;
  for (const [, ts] of stacks) {
    if (left <= 0) break;
    const take = Math.min(left, ts.strength, 1);
    ts.strength -= take; left -= take;
    state.powers[pid].lossesLastRound += take;
  }
}

function lendLeaseRouteOpen(game, state, from, to) {
  // Abstracted convoy lanes: each pairing needs its lifeline open.
  if (to === 'ussr') return state.corridors.arctic_convoy.open;
  if (to === 'china') return state.corridors.burma_road.open;
  if (to === 'uk' || from === 'uk' || from === 'usa') {
    // North Atlantic lane: closed if the Axis holds 2+ of the three convoy zones.
    const lanes = ['north_atlantic', 'mid_atlantic', 'western_approaches'];
    const axisHeld = lanes.filter(z => sideOfOwner(state, state.t[z].owner) === 'axis').length;
    return axisHeld < 2;
  }
  return true;
}

function flipItaly(game, state) {
  state.italyFlipped = true;
  const italy = state.powers.italy;
  italy.side = 'allied';
  italy.homeFront = 3;
  // The north becomes a German puppet; the south co-belligerent.
  for (const tid of ['n_italy']) {
    if (state.t[tid].owner === 'italy') {
      state.t[tid].owner = 'germany';
      state.t[tid].strength = Math.max(1, Math.floor(state.t[tid].strength / 2));
    }
  }
  // Italian troops outside the home peninsula are interned (halved, stay Axis-less).
  for (const [tid, ts] of Object.entries(state.t)) {
    if (ts.owner !== 'italy') continue;
    if (!['s_italy', 'sicily'].includes(tid)) ts.strength = Math.floor(ts.strength / 2);
  }
  state.roundLog.push('[reckoning] ITALY FLIPS: the north is occupied, the south is co-belligerent, and the seat changes sides.');
}

function fallOfFrance(game, state) {
  state.franceFallen = true;
  const vichyLands = ['s_france', 'fr_n_africa', 'tunisia', 'indochina'];
  for (const [tid, ts] of Object.entries(state.t)) {
    if (ts.owner !== 'france') continue;
    if (vichyLands.includes(tid)) {
      ts.owner = 'vichy';
      ts.strength = Math.max(1, Math.floor(ts.strength / 2));
    } else {
      ts.owner = 'germany';
      ts.strength = 0;
    }
  }
  state.roundLog.push('[reckoning] FRANCE FALLS. Vichy takes the south and the colonies; the Germans take the rest.');
}

function defectNation(game, state, nid, log) {
  const n = state.nations[nid];
  if (n.allegiance !== 'axis') return;
  n.allegiance = 'allied';
  n.pressure = 0;
  log(`${NATIONS[nid].name.toUpperCase()} DEFECTS to the Allies`);
}

function tryEnter(game, state, pid, log) {
  const p = state.powers[pid];
  if (!p.atWar && (p.pressure ?? 0) >= 7) enterWar(game, state, pid, log);
}

function enterWar(game, state, pid, log) {
  const p = state.powers[pid];
  p.atWar = true;
  if (pid === 'usa') state.japanGlobal = true;
  log(`${POWERS[pid].name.toUpperCase()} ENTERS THE WAR`);
}

function advancePressure(game, state) {
  // Historical drift plus the map talking: aggression raises the neutral's alarm.
  const drift = (pid, from) => {
    const p = state.powers[pid];
    if (p.atWar || p.pressure === null || p.pressureLock) return;
    let d = state.round >= from ? 1 : 0;
    // Axis strength on the border.
    const tags = ownedTagsOf(state, pid);
    const border = Object.entries(state.t).some(([tid, ts]) =>
      tags.includes(ts.owner) && game.map[tid].adjacent.some(n =>
        sideOfOwner(state, state.t[n].owner) === 'axis' && state.t[n].strength >= 3));
    if (border) d += 1;
    if (pid === 'usa' && state.japanGlobal) d += 2;
    p.pressure = Math.min(10, p.pressure + d);
  };
  drift('ussr', 3);
  drift('usa', 4);
  // Client nations feel the Red Army coming, and abandon a failing Reich.
  for (const [nid, n] of Object.entries(state.nations)) {
    if (n.allegiance !== 'axis') continue;
    const home = NATIONS[nid].home;
    let d = 0;
    if (game.map[home].adjacent.some(t =>
      sideOfOwner(state, state.t[t].owner) === 'allied' && state.t[t].strength >= 2)) d += 1;
    if (state.powers.germany.homeFront <= 3) d += 1;
    n.pressure = Math.min(10, Math.max(0, n.pressure + d));
  }
}

function scoreObjectives(game, state) {
  const met = (pid, key, val = true) => { state.powers[pid].objectivesMet[key] = val; };
  const held = (tid, side) => sideOfOwner(state, state.t[tid].owner) === side;
  const ownerIs = (tid, tags) => tags.includes(state.t[tid].owner);

  // UK: corridors open + home islands, tracked as good rounds.
  const ukGood = state.corridors.gib_suez.open && state.t.britain.owner === 'uk'
    && ['north_atlantic', 'mid_atlantic', 'western_approaches']
      .filter(z => sideOfOwner(state, state.t[z].owner) === 'axis').length <= 1;
  state.powers.uk.objectivesMet.goodRounds = (state.powers.uk.objectivesMet.goodRounds || 0) + (ukGood ? 1 : 0);
  if (state.round >= 12) met('uk', 'lifelines', state.powers.uk.objectivesMet.goodRounds >= 8 && state.t.britain.owner === 'uk');

  // China: survive at Chongqing; tie down Japan from 1942.
  met('china', 'hold_chongqing', state.t.chongqing.owner === 'china');
  if (state.round >= 6) {
    const jp = Object.entries(state.t)
      .filter(([tid, ts]) => ts.owner === 'japan' && game.map[tid].theatre === 'china_manchuria')
      .reduce((s, [, ts]) => s + ts.strength, 0);
    const prev = state.powers.china.objectivesMet.tieRounds || 0;
    state.powers.china.objectivesMet.tieRounds = prev + (jp >= 8 ? 1 : 0);
    met('china', 'tie_down_japan', state.powers.china.objectivesMet.tieRounds >= 4);
  }

  // USSR: Moscow & Baku through 1942 (round 7); reach the Vistula.
  if (state.round <= 7 && (state.t.moscow.owner !== 'ussr' || state.t.baku.owner !== 'ussr')) {
    state.powers.ussr.objectivesMet.lostCore = true;
  }
  if (state.round >= 7) met('ussr', 'hold_core_1942', !state.powers.ussr.objectivesMet.lostCore);
  met('ussr', 'reach_vistula', state.t.w_poland.owner === 'ussr' || state.t.e_poland.owner === 'ussr');

  // USA: Rhine and two island chains.
  met('usa', 'reach_rhine', ['rhineland', 'ruhr'].some(t => state.t[t].owner === 'usa'));
  const chains = ['marianas', 'philippines', 'solomons'].filter(t => state.t[t].owner === 'usa').length
    + (state.t.new_guinea.owner === 'usa' ? 1 : 0);
  met('usa', 'two_island_chains', chains >= 2);

  // Germany.
  if (held('paris', 'axis')) met('germany', 'take_paris');
  if (held('moscow', 'axis')) met('germany', 'take_moscow');
  if (held('baku', 'axis')) met('germany', 'take_baku');
  met('germany', 'protect_ruhr', held('ruhr', 'axis'));

  // Japan: southern resources; closed perimeter by end of 1943 (round 9).
  const resources = ['dei', 'malaya'].every(t => state.t[t].owner === 'japan');
  const prevRes = state.powers.japan.objectivesMet.resRounds || 0;
  state.powers.japan.objectivesMet.resRounds = resources ? prevRes + 1 : 0;
  if (state.powers.japan.objectivesMet.resRounds >= 2) met('japan', 'southern_resources');
  if (state.round === 9) {
    const perimeter = ['philippines', 'dei', 'malaya', 'burma', 'solomons', 'new_guinea', 'marianas']
      .filter(t => state.t[t].owner === 'japan').length;
    met('japan', 'closed_perimeter_1943', perimeter >= 5);
  }

  // Italy: Malta + Suez + the African coast, two consecutive rounds.
  const coast = ['malta', 'egypt', 'tunisia', 'tripolitania', 'cyrenaica']
    .every(t => held(t, 'axis'));
  const prevMare = state.powers.italy.objectivesMet.mareRounds || 0;
  state.powers.italy.objectivesMet.mareRounds = coast ? prevMare + 1 : 0;
  if (state.powers.italy.objectivesMet.mareRounds >= 2) met('italy', 'mare_nostrum_hold');

  // Independent States: sovereign nations at the end.
  if (state.round >= 12) {
    const sovereign = Object.entries(state.nations)
      .filter(([nid, n]) => n.sovereign && ownerIs(NATIONS[nid].home, [nid])).length;
    state.powers.indies.objectivesMet.sovereign = sovereign;
  }

  // Honors = objectives currently satisfied (booleans only).
  for (const p of Object.values(state.powers)) {
    p.honors = Object.values(p.objectivesMet).filter(v => v === true).length;
  }
}

export function sideVP(game, state, side) {
  let vp = 0;
  for (const [tid, t] of Object.entries(game.map)) {
    if (t.victoryCity && sideOfOwner(state, state.t[tid].owner) === side) vp += t.victoryCity.weight;
  }
  for (const p of Object.values(state.powers)) {
    if (p.side === side && p.atWar) vp += Math.floor(p.homeFront / 2);
  }
  return vp;
}

function checkVictory(game, state) {
  const alliedCaps = ['britain', 'moscow', 'chongqing', 'united_states']
    .filter(tid => {
      const pid = game.map[tid].capitalOf;
      return state.powers[pid].atWar; // a neutral's capital cannot be a war goal yet
    });
  const axisCaps = ['berlin', 'japan'].concat(
    state.powers.italy.atWar && state.powers.italy.side === 'axis' ? ['s_italy'] : []);

  const axisHoldsAll = alliedCaps.length > 0 && alliedCaps.every(t => sideOfOwner(state, state.t[t].owner) === 'axis');
  const alliesHoldAll = axisCaps.every(t => sideOfOwner(state, state.t[t].owner) === 'allied');
  if (axisHoldsAll || alliesHoldAll) {
    state.victory = {
      type: 'total', winner: axisHoldsAll ? 'axis' : 'allied',
      text: `${axisHoldsAll ? 'The Axis' : 'The Allied coalition'} holds every enemy capital. Total victory.`,
    };
    return finishScoring(game, state);
  }

  // Collapse: a coalition whose combined Home Front crumbles sues for peace.
  for (const side of ['axis', 'allied']) {
    const hf = Object.values(state.powers)
      .filter(p => p.side === side && p.atWar)
      .reduce((s, p) => s + p.homeFront, 0);
    const count = Object.values(state.powers).filter(p => p.side === side && p.atWar).length;
    if (count >= 2 && hf < 6) {
      state.victory = {
        type: 'collapse', winner: side === 'axis' ? 'allied' : 'axis',
        text: `The ${side} home fronts collapse. Their governments sue for peace.`,
      };
      return finishScoring(game, state);
    }
  }

  if (state.round >= 12) {
    const a = sideVP(game, state, 'axis'), b = sideVP(game, state, 'allied');
    const margin = Math.abs(a - b);
    state.victory = margin < 5
      ? { type: 'contested', winner: null, text: `Contested peace: axis ${a} vs allied ${b} — nobody won this war.`, vp: { axis: a, allied: b } }
      : { type: 'strategic', winner: a > b ? 'axis' : 'allied', text: `Strategic victory ${a > b ? 'Axis' : 'Allies'}: ${a} vs ${b} victory points.`, vp: { axis: a, allied: b } };
    return finishScoring(game, state);
  }
}

function finishScoring(game, state) {
  // Within the winning team, rank by honors. Within the losing team, nobody ranks.
  const v = state.victory;
  if (!v) return;
  const ranked = Object.values(state.powers)
    .filter(p => v.winner === null || p.side === v.winner)
    .sort((x, y) => y.honors - x.honors)
    .map(p => ({ power: p.id, honors: p.honors }));
  v.ranking = v.winner === null ? [] : ranked;
  v.footnote = v.winner === null
    ? 'A contested peace ranks nobody.'
    : 'Glory is conditional: the losing side’s honors are void.';
}
