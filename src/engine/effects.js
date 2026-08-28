// Interpreter for the card-effect DSL (docs/CONTRACT.md §3). Every strategy
// card event resolves through here. Ops needing a human choice fall back to a
// sensible deterministic pick so AI seats and simulations never stall.

import { sideOfOwner, ownedTagsOf, controllerOf } from './rules.js';
import { NATIONS } from './data.js';

function powersOf(state, spec) {
  if (spec === 'axis' || spec === 'allied') {
    return Object.values(state.powers).filter(p => p.side === spec && p.atWar).map(p => p.id);
  }
  // Independent State nations are legal targets: their units carry their own
  // tag and their seat is the Indies.
  if (state.nations[spec]) return [spec];
  return state.powers[spec] ? [spec] : [];
}

function tagsFor(game, state, id) {
  if (state.nations[id]) return [id];
  return ownedTagsOf(state, id);
}

function homeOf(game, state, id) {
  if (state.nations[id]) {
    return NATIONS[id].home;
  }
  for (const [tid, t] of Object.entries(game.map)) {
    if (t.capitalOf === id) return tid;
  }
  return null;
}

function clampTrack(v) { return Math.max(0, Math.min(10, v)); }

function biggestOwned(game, state, powerId, pred = () => true) {
  const tags = ownedTagsOf(state, powerId);
  let best = null;
  for (const [tid, ts] of Object.entries(state.t)) {
    if (!tags.includes(ts.owner) || game.map[tid].type === 'sea' || !pred(tid, ts)) continue;
    if (!best || ts.strength > state.t[best].strength) best = tid;
  }
  return best;
}

export function applyEffects(game, state, effects, ctx = {}) {
  for (const e of effects) applyEffect(game, state, e, ctx);
}

export function applyEffect(game, state, e, ctx = {}) {
  const log = msg => state.roundLog.push(`[event] ${msg}`);
  switch (e.op) {
    case 'pressure': {
      const tr = trackRef(state, e.track);
      if (!tr || tr.locked > 0) return;
      tr.obj.pressure = clampTrack(tr.obj.pressure + e.delta);
      log(`${e.track} pressure ${e.delta > 0 ? '+' : ''}${e.delta} → ${tr.obj.pressure}`);
      break;
    }
    case 'pressureLock': {
      const tr = trackRef(state, e.track);
      if (!tr) return;
      tr.obj.pressureLock = { rounds: e.rounds, releaseDelta: e.releaseDelta ?? 0 };
      log(`${e.track} pressure track locked for ${e.rounds} rounds`);
      break;
    }
    case 'placeStrength': {
      for (const pid of powersOf(state, e.power)) {
        const tags = tagsFor(game, state, pid);
        const isNation = !!state.nations[pid];
        const mySide = isNation ? state.nations[pid].allegiance : state.powers[pid].side;
        let tid = null;
        let sameSideAdd = false;
        if (e.where === 'owned_industrial') {
          tid = isNation ? null : biggestOwned(game, state, pid, t => game.map[t].industrial);
        } else if (e.where === 'capital') {
          tid = homeOf(game, state, pid);
        } else if (state.t[e.where]) {
          const ts = state.t[e.where];
          const whereSide = sideOfOwner(state, ts.owner);
          if (tags.includes(ts.owner) || ts.owner === 'neutral' || ts.strength === 0) {
            tid = e.where;
          } else if (whereSide === mySide) {
            // Reinforcing an ally's territory: the strength joins the stack
            // that is already there (Afrika Korps into Italian Libya).
            tid = e.where;
            sameSideAdd = true;
          }
        }
        if (!tid && isNation) tid = homeOf(game, state, pid);
        if (!tid) tid = biggestOwned(game, state, pid);
        if (!tid) continue;
        const ts = state.t[tid];
        if (!sameSideAdd && !tags.includes(ts.owner)) {
          ts.owner = isNation ? pid : pid;
          ts.fort = 0;
        }
        ts.strength += e.amount;
        log(`${pid} places ${e.amount} strength in ${game.map[tid].name}`);
      }
      break;
    }
    case 'removeStrength': {
      for (const pid of powersOf(state, e.power)) {
        const tags = tagsFor(game, state, pid);
        let remaining = e.amount;
        while (remaining > 0) {
          let tid = null;
          if (e.where && e.where !== 'choose' && state.t[e.where]) {
            // A named territory only bleeds if the named power's units hold it.
            tid = tags.includes(state.t[e.where].owner) ? e.where : null;
          } else {
            tid = state.nations[pid]
              ? (state.t[NATIONS[pid].home] && tags.includes(state.t[NATIONS[pid].home].owner)
                && state.t[NATIONS[pid].home].strength > 0 ? NATIONS[pid].home : null)
              : biggestOwned(game, state, pid, (t, ts2) => ts2.strength > 0);
          }
          if (!tid || state.t[tid].strength === 0) break;
          const take = Math.min(remaining, state.t[tid].strength);
          state.t[tid].strength -= take;
          remaining -= take;
          log(`${pid} loses ${take} strength in ${game.map[tid].name}`);
          if (e.where && e.where !== 'choose') break;
        }
      }
      break;
    }
    case 'homeFront': {
      for (const pid of powersOf(state, e.power)) {
        const p = state.powers[pid];
        if (!p) continue; // nations have pressure tracks, not home fronts
        p.homeFront = clampTrack(p.homeFront + e.delta);
        log(`${pid} home front ${e.delta > 0 ? '+' : ''}${e.delta} → ${p.homeFront}`);
      }
      break;
    }
    case 'commandPoints': {
      // Events fire after sheets are sealed, so CP from an event pays out on
      // the NEXT round's budget (a penalty still bites the sealed budget
      // indirectly by carrying forward too).
      for (const pid of powersOf(state, e.power)) {
        const p = state.powers[pid];
        if (p) p.cpCarry = (p.cpCarry ?? 0) + e.delta;
      }
      break;
    }
    case 'coalitionPool':
      state.pool[e.side] = Math.max(0, state.pool[e.side] + e.delta);
      log(`${e.side} coalition pool ${e.delta > 0 ? '+' : ''}${e.delta}`);
      break;
    case 'production': {
      for (const pid of powersOf(state, e.power)) {
        state.productionDelta[pid] = state.productionDelta[pid] || [];
        state.productionDelta[pid].push({ delta: e.delta, rounds: e.rounds ?? 1 });
      }
      break;
    }
    case 'thresholdMod':
      state.thresholdMods.push({
        who: e.power ?? e.side, theatre: e.theatre ?? null,
        role: e.role, delta: e.delta, rounds: e.rounds ?? 1,
      });
      break;
    case 'drawOps': {
      for (const pid of powersOf(state, e.power)) {
        if (!state.powers[pid]) continue;
        for (let i = 0; i < e.n; i++) {
          if (!state.decks.ops.length) {
            const back = state.decks.opsDiscard.splice(0);
            state.decks.ops = ctx.rng ? ctx.rng.shuffle(back) : back;
          }
          const c = state.decks.ops.pop();
          if (c) state.powers[pid].opsHand.push(c);
        }
      }
      break;
    }
    case 'control': {
      const ts = state.t[e.territory];
      if (!ts) return;
      ts.owner = e.power; ts.entrenched = false;
      log(`${e.power} takes control of ${game.map[e.territory].name}`);
      break;
    }
    case 'fort': {
      const ts = state.t[e.territory];
      if (ts) ts.fort = Math.max(0, Math.min(2, ts.fort + e.delta));
      break;
    }
    case 'entry': {
      const p = state.powers[e.power];
      if (p && !p.atWar) { p.pressure = 10; }
      break;
    }
    case 'corridor': {
      const c = state.corridors[e.corridor];
      if (c && e.state === 'closed') { c.forcedClosed = e.rounds; c.open = false; }
      break;
    }
    case 'flag':
      state.activeFlags.push({ name: e.name, rounds: e.rounds ?? 1, power: e.power ?? null });
      break;
    default:
      state.roundLog.push(`[event] unknown op ${e.op} ignored`);
  }
}

function trackRef(state, track) {
  if (state.powers[track] && state.powers[track].pressure !== null) {
    const p = state.powers[track];
    return { obj: p, locked: p.pressureLock?.rounds ?? 0 };
  }
  if (state.nations[track]) {
    const n = state.nations[track];
    return { obj: n, locked: n.pressureLock?.rounds ?? 0 };
  }
  return null;
}

// Threshold modifier applicable to a battle participant.
export function thresholdModFor(state, powerId, theatre, role) {
  let delta = 0;
  const side = state.powers[powerId]?.side;
  for (const m of state.thresholdMods) {
    if (m.role !== role) continue;
    if (m.theatre && m.theatre !== theatre) continue;
    if (m.who === powerId || m.who === side) delta += m.delta;
  }
  return delta;
}
