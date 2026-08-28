// Phases 4.3–4.5: order validation, the reveal, and resolution.
// Combat implements the design thesis directly: hit thresholds improve by 1
// for every allied power beyond the first committing to the same offensive
// (floor 3), and no single power may commit more than 8 strength.

import {
  COSTS, MAX_COMMIT_PER_POWER, sideOfOwner, sideOfPower, controllerOf,
  ownedTagsOf, enemies, attackerThreshold, defenderThreshold, traceSupply,
} from './rules.js';
import { applyEffects, thresholdModFor } from './effects.js';
import { hasDoctrine, hasFlag } from './state.js';

const THEATRE_ORDER = [
  'atlantic', 'scandinavia', 'west', 'eastern', 'balkans',
  'med', 'china_manchuria', 'seasia', 'pacific',
];

// ——— order costing & validation ———

export function orderCost(game, state, powerId, order) {
  const p = state.powers[powerId];
  switch (order.type) {
    case 'move': {
      const a = game.map[order.from], b = game.map[order.to];
      if (powerId === 'germany'
        && ['west', 'eastern'].includes(a?.theatre) && ['west', 'eastern'].includes(b?.theatre)
        && a.theatre !== b.theatre) return 0.5; // interior lines
      return COSTS.move;
    }
    case 'offensive': {
      let c = COSTS.offensive;
      if (order.amphibious) {
        c += 2;
        if (hasDoctrine(game, state, powerId, 'amphib')) c -= 1;
        if (powerId === 'usa' && hasFlag(state, 'island_hopping')
          && game.map[order.target].theatre === 'pacific') c = Math.max(2, c - 2);
      }
      if (hasFlag(state, 'monsoon')
        && ['seasia', 'china_manchuria'].includes(game.map[order.target]?.theatre)) c += 1;
      return c;
    }
    case 'naval': {
      if (powerId === 'italy' && game.map[order.zone]?.theatre === 'med') return 0; // mare nostrum
      let c = COSTS.naval;
      if (sideOfPower(state, powerId) === 'allied' && !state.corridors.gib_suez.open
        && game.map[order.zone]?.theatre === 'med') c += 1;
      return c;
    }
    case 'entrench': return COSTS.entrench + (order.withFort ? 1 : 0);
    case 'strat_card': return 0; // ops value ADDS budget; events are free to declare
    case 'ops_card': return game.opsCards[order.cardId]?.cost ?? 1;
    case 'intel_op': return COSTS.intel_op;
    case 'lend_lease': return powerId === 'usa' ? 0 : COSTS.lend_lease; // arsenal
    case 'build': return 0; // paid in production at reckoning
    case 'ultra': return 0;
    case 'decisive_battle': return 0;
    case 'initiative_bid': return 0; // paid from coalition pool
    case 'enter_war': return 0;
    case 'defect': return 0;
    case 'sell_commitment': return 0;
    default: return 0;
  }
}

// Validate a sheet, drop what the budget or the rules don't allow.
// Returns { orders, spent, budget, dropped }. Pass opts.commit = true only
// when actually filing the sheet: it records the power's draw on the shared
// Supreme Commander pots (a dry run for UI costing must not).
export function validateSheet(game, state, powerId, sheet, opts = {}) {
  const p = state.powers[powerId];
  const tags = ownedTagsOf(state, powerId);
  const dropped = [];
  const kept = [];
  let budget = p.cp;
  // Commanders are keyed `${theatre}|${side}`. Each office holds ONE pot of
  // 3 CP, shared by the side's OTHER powers for orders in that theatre —
  // never the commander's own.
  const pots = {};
  for (const [key, c] of Object.entries(state.commanders)) {
    if (!c || c.power === powerId || c.side !== sideOfPower(state, powerId)) continue;
    const used = state.commanderSpent?.[key] ?? {};
    const usedByOthers = Object.entries(used)
      .filter(([pid]) => pid !== powerId)
      .reduce((s, [, n]) => s + n, 0);
    pots[key] = { theatre: key.split('|')[0], remaining: Math.max(0, 3 - usedByOthers), used: 0 };
  }

  // At most one strategy card per round; only THAT card's ops can fund the
  // sheet, and only when it is played for ops.
  const firstStrat = sheet.orders.find(o => o.type === 'strat_card' && p.stratHand.includes(o.cardId));
  if (firstStrat?.forOps) budget += game.cards[firstStrat.cardId]?.ops ?? 0;

  let spent = 0, freeMoveUsed = false; // spent may hold halves (interior lines)
  const committedFrom = {}; // territory -> strength already pledged
  for (let o of sheet.orders) {
    const fail = reason => dropped.push({ order: o, reason });
    let cost = orderCost(game, state, powerId, o);

    // Legality checks per type.
    if (o.type === 'move') {
      const from = state.t[o.from], to = state.t[o.to];
      if (!from || !to) { fail('unknown territory'); continue; }
      if (!tags.includes(from.owner)) { fail('not your territory'); continue; }
      const avail = from.strength - (committedFrom[o.from] || 0);
      if (o.strength < 1 || o.strength > avail) { fail('not enough strength'); continue; }
      if (!game.map[o.from].adjacent.includes(o.to)) { fail('not adjacent'); continue; }
      const toSide = sideOfOwner(state, to.owner);
      // A stack's allegiance follows its owner tag (a defected nation fights
      // for the Allies even though the Indies seat writes its orders).
      const moveSide = sideOfOwner(state, from.owner);
      const friendly = to.owner === from.owner || toSide === moveSide
        || (game.map[o.to].type === 'sea' && (to.owner === 'none' || to.strength === 0));
      if (!friendly) { fail('destination not friendly'); continue; }
      if (game.map[o.to].type === 'sea' && game.map[o.from].type === 'land'
        && p.ratings.sea < 2) { fail('no fleet capacity'); continue; }
      if (moveSide === 'neutral' && !tags.includes(to.owner) && to.owner !== 'none') { fail('neutral units stay home'); continue; }
      committedFrom[o.from] = (committedFrom[o.from] || 0) + o.strength;
      if (cost === 1 && !freeMoveUsed && hasDoctrine(game, state, powerId, 'move_discount')) {
        freeMoveUsed = true; cost = 0;
      }
    } else if (o.type === 'offensive') {
      const t = state.t[o.target];
      if (!t) { fail('unknown target'); continue; }
      if (!p.atWar) { fail('neutral cannot attack'); continue; }
      if (kept.some(k => k.type === 'offensive' && k.target === o.target)) {
        fail('already attacking that territory'); continue;
      }
      let total = 0; let ok = true;
      const maxSources = powerId === 'ussr' ? 2 : 1; // deep battle
      if (!o.sources || o.sources.length < 1 || o.sources.length > maxSources) { fail('bad sources'); continue; }
      // The offensive's side is its SOURCES' allegiance, so a defected nation
      // under the Indies seat attacks the Axis, never its new allies.
      const orderSide = o.sources[0] && state.t[o.sources[0].from]
        ? sideOfOwner(state, state.t[o.sources[0].from].owner) : 'none';
      if (orderSide !== 'axis' && orderSide !== 'allied') { fail('those units are not at war'); continue; }
      const targetSide = sideOfOwner(state, t.owner);
      if (targetSide === orderSide) { fail('target friendly'); continue; }
      for (const s of o.sources) {
        const st = state.t[s.from];
        if (!st || !tags.includes(st.owner)
          || sideOfOwner(state, st.owner) !== orderSide) ok = false;
        else if (s.strength < 1 || s.strength > st.strength - (committedFrom[s.from] || 0)) ok = false;
        else if (!o.amphibious && !game.map[s.from].adjacent.includes(o.target)) ok = false;
        else if (o.amphibious) {
          const via = o.via;
          if (!via || !game.map[via] || game.map[via].type !== 'sea') ok = false;
          else if (!game.map[s.from].adjacent.includes(via) || !game.map[via].adjacent.includes(o.target)) ok = false;
          else if (enemies(sideOfOwner(state, state.t[via].owner), orderSide)) ok = false;
        }
        total += s.strength;
      }
      if (!ok) { fail('illegal sources'); continue; }
      if (total > MAX_COMMIT_PER_POWER) { fail('over the 8-strength ceiling'); continue; }
      for (const s of o.sources) committedFrom[s.from] = (committedFrom[s.from] || 0) + s.strength;
      o = { ...o, _side: orderSide };
    } else if (o.type === 'naval' && o.mission === 'bomb') {
      // Strategic bombing: needs the doctrine; hits an enemy industrial
      // territory within two steps of your own ground. Aircraft don't move.
      if (!hasDoctrine(game, state, powerId, 'bombing')) { fail('no bomber command'); continue; }
      const t = game.map[o.zone];
      const ts = state.t[o.zone];
      if (!t || t.type !== 'land' || !t.industrial) { fail('not an industrial target'); continue; }
      if (!enemies(sideOfOwner(state, ts.owner), sideOfPower(state, powerId))) { fail('not an enemy target'); continue; }
      const from = state.t[o.from];
      if (!from || !tags.includes(from.owner) || from.strength < 1) { fail('no air base'); continue; }
      const near = game.map[o.from].adjacent.includes(o.zone)
        || game.map[o.from].adjacent.some(n => game.map[n].adjacent.includes(o.zone));
      if (!near) { fail('out of bombing range'); continue; }
      if (o.strength < 1 || o.strength > 4) { fail('1-4 bomber strength'); continue; }
    } else if (o.type === 'naval') {
      const z = game.map[o.zone];
      if (!z || z.type !== 'sea') { fail('not a sea zone'); continue; }
      const from = state.t[o.from];
      if (!from || !tags.includes(from.owner)) { fail('no fleet source'); continue; }
      const avail = from.strength - (committedFrom[o.from] || 0);
      if (o.strength < 1 || o.strength > avail) { fail('not enough strength'); continue; }
      if (!game.map[o.from].adjacent.includes(o.zone) && o.from !== o.zone) { fail('zone not adjacent'); continue; }
      if (o.strength > p.ratings.sea * 2) { fail('over naval capacity'); continue; }
      if (!p.atWar && o.mission !== 'escort') { fail('neutral fleet stays home'); continue; }
      committedFrom[o.from] = (committedFrom[o.from] || 0) + o.strength;
      o = { ...o, _side: sideOfOwner(state, from.owner) };
    } else if (o.type === 'entrench') {
      const t = state.t[o.territory];
      if (!t || !tags.includes(t.owner)) { fail('not yours'); continue; }
      if (!t.supplied) { fail('out of supply'); continue; }
    } else if (o.type === 'strat_card') {
      if (!p.stratHand.includes(o.cardId)) { fail('card not in hand'); continue; }
      if (kept.some(k => k.type === 'strat_card')) { fail('one strategy card per round'); continue; }
    } else if (o.type === 'ops_card') {
      if (!p.opsHand.includes(o.cardId)) { fail('card not in hand'); continue; }
      const card = game.opsCards[o.cardId];
      if (card.powers !== 'any' && !card.powers.includes(powerId)) { fail('wrong power'); continue; }
    } else if (o.type === 'lend_lease') {
      if (!state.powers[o.to] || o.to === powerId) { fail('bad recipient'); continue; }
      if (sideOfPower(state, o.to) !== sideOfPower(state, powerId)) { fail('not an ally'); continue; }
      if (hasFlag(state, 'no_lend_lease')) { fail('lend-lease blocked'); continue; }
      if (o.amount < 1 || o.amount > 4) { fail('amount 1-4'); continue; }
      if (powerId !== 'usa' && !p.atWar) { fail('neutral cannot lend-lease'); continue; }
    } else if (o.type === 'build') {
      const t = state.t[o.territory];
      if (!t || !tags.includes(t.owner)) { fail('not yours'); continue; }
      if (o.what !== 'fort' && !game.map[o.territory].industrial) { fail('not industrial'); continue; }
      if (!t.supplied) { fail('out of supply'); continue; }
    } else if (o.type === 'ultra') {
      if (powerId !== 'uk') { fail('uk only'); continue; }
    } else if (o.type === 'decisive_battle') {
      if (powerId !== 'japan' || p.decisiveUsed) { fail('unavailable'); continue; }
    } else if (o.type === 'initiative_bid') {
      // Each +1 on the side's initiative roll costs 2 coalition pool.
      const side = sideOfPower(state, powerId);
      if (o.points < 1 || o.points * 2 > state.pool[side]) { fail('pool too small (2 per point)'); continue; }
    } else if (o.type === 'pool_resupply') {
      const side = sideOfPower(state, powerId);
      const t = state.t[o.territory];
      if (state.pool[side] < 3) { fail('needs 3 coalition pool'); continue; }
      if (!t || !tags.includes(t.owner) || !t.supplied) { fail('not a supplied friendly territory'); continue; }
    } else if (o.type === 'enter_war') {
      const italyEarly = powerId === 'italy' && !p.atWar;
      if (!italyEarly && (p.atWar || p.pressure === null || p.pressure < 7)) { fail('cannot enter yet'); continue; }
    } else if (o.type === 'defect') {
      const n = state.nations[o.nation];
      if (powerId !== 'indies' || !n || n.allegiance !== 'axis' || n.pressure < 7) { fail('cannot defect'); continue; }
    } else if (o.type === 'sell_commitment') {
      const n = state.nations[o.nation];
      if (powerId !== 'indies' || !n || n.allegiance !== 'axis') { fail('not a client'); continue; }
    }

    // Budget check: a commander pot funds only orders inside its theatre.
    // `spent` may carry a half point from interior-lines moves; the budget
    // comparison rounds up so a stray half never buys a full extra order.
    const th = orderTheatre(game, o);
    let fromCmd = 0, fundingPot = null;
    if (cost >= 1 && th) {
      fundingPot = Object.values(pots).find(pot => pot.theatre === th && pot.remaining > 0) ?? null;
      if (fundingPot) fromCmd = Math.min(Math.floor(cost), fundingPot.remaining);
    }
    if (Math.ceil(spent + cost - fromCmd) > budget) { fail('over command point budget'); continue; }
    if (fundingPot) { fundingPot.remaining -= fromCmd; fundingPot.used += fromCmd; }
    spent += cost - fromCmd;
    kept.push(o);
  }
  spent = Math.ceil(spent);
  if (opts.commit) {
    state.commanderSpent = state.commanderSpent || {};
    for (const [key, pot] of Object.entries(pots)) {
      state.commanderSpent[key] = { ...(state.commanderSpent[key] || {}), [powerId]: pot.used };
    }
  }
  return { orders: kept, spent, budget, dropped };
}

function orderTheatre(game, o) {
  const tid = o.target ?? o.zone ?? o.territory ?? o.to ?? o.from ?? null;
  return tid && game.map[tid] ? game.map[tid].theatre : null;
}

// ——— the reveal (phase 4.4) ———

export function reveal(game, state, rng) {
  state.battles = [];
  state.roundLog.push(`— Reveal: all order sheets turn face up —`);
  const sheets = state.orders;

  // 1. Strategy cards: ops plays give away opponent-aligned events; event plays fire.
  const eventQueue = [];
  for (const [pid, sheet] of Object.entries(sheets)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type !== 'strat_card') continue;
      const card = game.cards[o.cardId];
      const p = state.powers[pid];
      p.stratHand = p.stratHand.filter(c => c !== o.cardId);
      const mySide = sideOfPower(state, pid);
      const opponentAligned = card.side !== 'neutral' && card.side !== mySide;
      if (o.forOps) {
        state.roundLog.push(`${pid} plays "${card.title}" for ${card.ops} ops`);
        if (opponentAligned) eventQueue.push({ card, beneficiary: card.side, by: pid });
        else state.decks.strat.discard.push(card.id);
      } else {
        eventQueue.push({ card, beneficiary: card.side === 'neutral' ? mySide : card.side, by: pid });
      }
    }
  }
  // Events fire in initiative order (initiative side's events first).
  eventQueue.sort((a, b) =>
    (a.beneficiary === state.initiative ? 0 : 1) - (b.beneficiary === state.initiative ? 0 : 1));
  for (const ev of eventQueue) {
    // A side may cancel an opponent event for 4 pool (auto policy: cancel events
    // that hurt it most — entry/pressure bombs — if it can afford it).
    const victimSide = ev.beneficiary === 'axis' ? 'allied' : 'axis';
    const dangerous = ev.card.effects.some(e =>
      e.op === 'entry' || (e.op === 'pressure' && Math.abs(e.delta) >= 2) || e.op === 'corridor');
    if (dangerous && state.pool[victimSide] >= 6 && state.poolPolicy?.[victimSide]?.cancel !== false) {
      state.pool[victimSide] -= 4;
      state.roundLog.push(`${victimSide} spends 4 coalition pool to cancel "${ev.card.title}"`);
      state.decks.strat.discard.push(ev.card.id);
      continue;
    }
    state.roundLog.push(`Event: "${ev.card.title}" (${ev.card.side}) — ${ev.card.text}`);
    applyEffects(game, state, ev.card.effects, { by: ev.by, rng });
    if (ev.card.remove) state.decks.strat.removed.push(ev.card.id);
    else state.decks.strat.discard.push(ev.card.id);
  }

  // 2. Intel ops, pool spends, and seat specials.
  for (const [pid, sheet] of Object.entries(sheets)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type === 'intel_op' && o.kind === 'pressure' && o.track) {
        const delta = Math.sign(o.delta || 1);
        applyEffects(game, state, [{ op: 'pressure', track: o.track, delta }]);
      } else if (o.type === 'intel_op' && o.kind === 'deception') {
        // Two rounds: it must still be live when next round's Ultra reads.
        state.activeFlags.push({ name: 'deception', rounds: 2, power: pid });
      } else if (o.type === 'sell_commitment') {
        state.powers.indies.cpCarry = (state.powers.indies.cpCarry ?? 0) + 2;
        applyEffects(game, state, [{ op: 'pressure', track: o.nation, delta: 1 }]);
        state.roundLog.push(`Independent States sell ${o.nation}'s commitment for 2 CP (next round)`);
      } else if (o.type === 'pool_resupply') {
        const side = sideOfPower(state, pid);
        const ts = state.t[o.territory];
        if (state.pool[side] >= 3 && ts && ts.supplied) {
          state.pool[side] -= 3;
          ts.strength += 2;
          state.roundLog.push(`${pid} spends 3 ${side} coalition pool on emergency resupply at ${game.map[o.territory].name}`);
        }
      } else if (o.type === 'decisive_battle') {
        state.powers.japan.decisiveUsed = true;
        state.decisiveZone = o.zone;
        state.roundLog.push(`Japan declares a Decisive Battle in ${game.map[o.zone]?.name ?? o.zone}`);
      }
    }
  }

  // 3. Collect offensives into battles; detect joint orders; pay the pool.
  // A battle's side is its sources' allegiance (validated per order), and the
  // joint-order bonus counts DISTINCT powers — a power cannot ally with itself.
  const byTarget = {};
  for (const [pid, sheet] of Object.entries(sheets)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type !== 'offensive') continue;
      const side = o._side ?? sideOfPower(state, pid);
      (byTarget[o.target] = byTarget[o.target] || []).push({ power: pid, order: o, side });
    }
  }
  for (const [target, attacks] of Object.entries(byTarget)) {
    for (const side of ['axis', 'allied']) {
      const attackers = attacks.filter(a => a.side === side);
      if (!attackers.length) continue;
      const distinct = new Set(attackers.map(a => a.power)).size;
      if (distinct > 1) {
        state.pool[side] += distinct - 1;
        state.roundLog.push(
          `Joint order on ${game.map[target].name}: ${attackers.map(a => a.power).join(' + ')} ` +
          `(+${distinct - 1} ${side} coalition pool)`);
      }
      state.battles.push({ kind: 'land', target, side, attackers, opsCards: [] });
      // Japan striking south ignites the global Pacific war.
      if (side === 'axis' && attackers.some(a => a.power === 'japan')
        && ['pacific', 'seasia'].includes(game.map[target].theatre)) {
        state.japanGlobal = true;
      }
    }
  }

  // 4. Naval orders become naval battles / escorts / raids / bombing raids.
  for (const [pid, sheet] of Object.entries(sheets)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type !== 'naval') continue;
      state.battles.push({
        kind: o.mission === 'bomb' ? 'bomb' : 'naval',
        target: o.zone, side: o._side ?? sideOfPower(state, pid),
        attackers: [{ power: pid, order: { sources: o.mission === 'bomb' ? [] : [{ from: o.from, strength: o.strength }] }, dice: o.strength }],
        mission: o.mission ?? 'contest', opsCards: [],
      });
      if (pid === 'japan' && o.mission !== 'escort'
        && ['pacific', 'seasia'].includes(game.map[o.zone]?.theatre)) state.japanGlobal = true;
    }
  }

  // 5. Attach declared ops cards to their battles. Battle-free tradecraft
  // (intel_peek) fires immediately instead.
  for (const [pid, sheet] of Object.entries(sheets)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type !== 'ops_card') continue;
      const p = state.powers[pid];
      p.opsHand = p.opsHand.filter(c => c !== o.cardId);
      state.decks.opsDiscard.push(o.cardId);
      const card = game.opsCards[o.cardId];
      if (card.effect.kind === 'intel_peek') {
        applyEffects(game, state, [{ op: 'drawOps', power: pid, n: 1 }], { rng });
        state.roundLog.push(`${pid} plays "${card.title}": the signals desk pays off (+1 operations card)`);
        continue;
      }
      const battle = state.battles.find(b => b.target === (o.battle ?? ''));
      if (battle) battle.opsCards.push({ power: pid, card });
      else state.roundLog.push(`${pid}'s "${card.title}" finds no battle and is discarded`);
    }
  }

  // 6. Attacking a neutral — on land or at sea: pressure to 10, first strike
  // for one round (the counter is cleared at the reckoning).
  for (const b of state.battles) {
    if (b.kind !== 'land' && !(b.kind === 'naval' && b.mission !== 'escort')) continue;
    const owner = state.t[b.target].owner;
    if (b.kind === 'naval' && state.t[b.target].strength === 0) continue;
    const os = sideOfOwner(state, owner);
    if (os === 'neutral' && (state.powers[owner] || state.nations[owner])) {
      if (state.powers[owner]?.pressure !== null && state.powers[owner]) {
        state.powers[owner].pressure = 10;
        state.powers[owner].pressureLock = null;
      }
      if (state.nations[owner]) state.nations[owner].pressure = 10;
      for (const a of b.attackers) state.firstStrike[a.power] = 1;
      state.roundLog.push(`${b.attackers.map(a => a.power).join('+')} attack neutral ${game.map[b.target].name}: its pressure snaps to 10`);
    }
  }
}

// ——— resolution (phase 4.5) ———

export function resolveRound(game, state, rng, options = {}) {
  // Initiative: d6 per side, +1 per 2 coalition pool bid.
  const bids = { axis: 0, allied: 0 };
  for (const [pid, sheet] of Object.entries(state.orders)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type === 'initiative_bid') {
        const side = sideOfPower(state, pid);
        const pts = Math.min(o.points, Math.floor(state.pool[side] / 2));
        state.pool[side] -= pts * 2;
        bids[side] += pts;
      }
    }
  }
  let a = rng.d6() + bids.axis, b = rng.d6() + bids.allied;
  if (a === b) state.initiative = rng.coin() === 'heads' ? 'axis' : 'allied';
  else state.initiative = a > b ? 'axis' : 'allied';
  state.roundLog.push(`Initiative: ${state.initiative} (axis ${a} vs allied ${b})`);

  // Moves execute first (all sides simultaneously). A stack keeps its owner
  // tag: French troops stay French, a defected nation's troops stay its own.
  for (const [pid, sheet] of Object.entries(state.orders)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type !== 'move') continue;
      const from = state.t[o.from], to = state.t[o.to];
      const amount = Math.min(o.strength, from.strength);
      if (amount <= 0) continue;
      from.strength -= amount;
      if (to.strength === 0 || to.owner === 'none') { to.owner = from.owner; }
      to.strength += amount;
      to.entrenched = false;
    }
    for (const o of sheet.orders) {
      if (o.type === 'entrench') {
        state.t[o.territory].entrenched = true;
        // Fortress engineering: entrenching can also raise a fort (+1 CP,
        // priced in orderCost via o.withFort).
        if (o.withFort && hasDoctrine(game, state, pid, 'fortification')) {
          state.t[o.territory].fort = Math.min(2, state.t[o.territory].fort + 1);
        }
      }
    }
  }

  // Commit offensive strength out of its source territories, remembering
  // whose flag the force marches under.
  for (const bt of state.battles) {
    for (const at of bt.attackers) {
      at.committed = 0;
      for (const s of at.order.sources) {
        const src = state.t[s.from];
        if (at.ownerTag === undefined) at.ownerTag = src.owner;
        const take = Math.min(s.strength, src.strength);
        src.strength -= take;
        at.committed += take;
        s.taken = take;
      }
    }
  }

  // The coin: initiative side settles exactly one contested battle without
  // dice. Each side may pre-declare its choice before any dice; the initiative
  // holder's declaration counts. The flip is marked on ONE battle object, so
  // two battles over the same territory can never both be coin-settled.
  const coinTarget = options.coinBattleBySide?.[state.initiative]
    ?? options.coinBattle ?? pickCoinBattle(game, state);
  state.coinBattle = coinTarget;
  const coinBt = state.battles.find(bt => bt.kind === 'land' && bt.target === coinTarget
    && state.t[bt.target].strength > 0);
  if (coinBt) coinBt._coin = true;

  // Resolve theatre by theatre, naval first (bombing raids after the fleets).
  for (const theatre of THEATRE_ORDER) {
    const rank = { naval: 0, bomb: 1, land: 2 };
    const here = state.battles
      .filter(bt => game.map[bt.target].theatre === theatre)
      .sort((x, y) => (rank[x.kind] - rank[y.kind]) || x.target.localeCompare(y.target));
    for (const bt of here) {
      if (bt.kind === 'bomb') resolveBombing(game, state, rng, bt);
      else resolveBattle(game, state, rng, bt, bt._coin === true);
    }
  }

  traceSupply(game, state);
}

function pickCoinBattle(game, state) {
  // Auto policy: the initiative side flips the contested battle where it
  // defends against the worst odds; failing that, the biggest contested
  // battle on the board — the GDD wants exactly one coin whenever there is
  // a contested resolution to spend it on.
  let best = null, bestSize = -1;
  let fallback = null, fallbackSize = -1;
  for (const bt of state.battles) {
    if (bt.kind !== 'land' || state.t[bt.target].strength === 0) continue;
    const defSide = sideOfOwner(state, state.t[bt.target].owner);
    const atkStrength = bt.attackers.reduce((s, x) => s + (x.committed || 0), 0);
    if (atkStrength <= 0) continue;
    if (defSide === state.initiative && atkStrength > bestSize && atkStrength > state.t[bt.target].strength) {
      best = bt.target; bestSize = atkStrength;
    }
    if (atkStrength > fallbackSize) { fallback = bt.target; fallbackSize = atkStrength; }
  }
  return best ?? fallback;
}

function resolveBombing(game, state, rng, bt) {
  const t = game.map[bt.target];
  const ts = state.t[bt.target];
  const raider = bt.attackers[0];
  const ctrl = controllerOf(state, ts.owner);
  if (!ctrl || !enemies(sideOfPower(state, raider.power), sideOfOwner(state, ts.owner))) return;
  let hits = 0;
  const dice = Math.min(raider.dice ?? 0, 4);
  for (let i = 0; i < dice; i++) if (rng.d6() >= 5) hits++;
  const perHit = hasFlag(state, 'strategic_bombing') ? 2 : 1;
  if (hits > 0) {
    state.productionDelta[ctrl] = state.productionDelta[ctrl] || [];
    state.productionDelta[ctrl].push({ delta: -hits * perHit, rounds: 1 });
    state.bombedThisRound = state.bombedThisRound || {};
    state.bombedThisRound[bt.target] = true;
    if (hits >= 2) {
      state.powers[ctrl].homeFront = Math.max(0, state.powers[ctrl].homeFront - 1);
    }
    state.roundLog.push(`${raider.power} bombs ${t.name}: ${ctrl} loses ${hits * perHit} production${hits >= 2 ? ' and 1 home front' : ''}`);
  } else {
    state.roundLog.push(`${raider.power}'s bombers miss over ${t.name}`);
  }
}

function resolveBattle(game, state, rng, bt, isCoinBattle) {
  const t = game.map[bt.target];
  const ts = state.t[bt.target];
  const defOwner = ts.owner;
  const defSide = sideOfOwner(state, defOwner);
  const atkSide = bt.side;
  const totalCommitted = bt.attackers.reduce((s, a) => s + (a.committed || 0), 0);
  if (totalCommitted <= 0) return;

  // Target already friendly (an ally took it, or it defected): strength returns.
  if (defSide === atkSide || (bt.kind === 'land' && defSide === 'none')) {
    returnCommitted(game, state, bt);
    return;
  }

  // Uncontested sea zone: occupy it. A NEUTRAL POWER's fleet is not
  // uncontested — attacking it is Pearl Harbor, and it fights back below.
  if (bt.kind === 'naval' && (ts.strength === 0 || defSide === 'none')) {
    const lead = bt.attackers[0];
    ts.owner = lead.ownerTag ?? lead.power; ts.strength += lead.committed;
    state.roundLog.push(`${lead.power} ${bt.mission === 'escort' ? 'escorts convoys in' : 'takes station in'} ${t.name}`);
    if (bt.mission === 'raid') resolveConvoyRaid(game, state, rng, bt);
    return;
  }

  if (isCoinBattle) {
    // The coin, exactly as printed: heads the attack carries, tails the line
    // holds; the LOSER loses half its strength, rounded up; the winner is
    // untouched. Nothing modifies it.
    const flip = rng.coin();
    state.coinUsedRound = state.round;
    const defStr = ts.strength;
    if (flip === 'heads') {
      const defLoss = Math.ceil(defStr / 2);
      addLosses(state, defOwner, defLoss);
      // The defeated half retreats to an adjacent friendly territory if one
      // exists; otherwise it is destroyed with the position.
      const remnant = defStr - defLoss;
      const haven = game.map[bt.target].adjacent.find(n =>
        game.map[n].type === 'land' && state.t[n].owner === defOwner);
      if (remnant > 0 && haven) state.t[haven].strength += remnant;
      else if (remnant > 0) addLosses(state, defOwner, remnant);
      ts.strength = 0;
      captureTerritory(game, state, bt, totalCommitted);
      state.roundLog.push(`THE COIN on ${t.name}: heads — the attack carries. The defenders lose half and the ground.`);
      recordBattle(state, bt, 'captured', defOwner);
    } else {
      for (const a of bt.attackers) {
        const lost = Math.ceil((a.committed || 0) / 2);
        addLosses(state, a.power, lost);
        a.committed = (a.committed || 0) - lost; // survivors head home
      }
      returnCommitted(game, state, bt);
      state.roundLog.push(`THE COIN on ${t.name}: tails — the line holds. The attackers lose half.`);
      recordBattle(state, bt, 'held', defOwner);
    }
    return;
  }

  // Ops cards that reshape the battle before any dice.
  const battleCtx = { target: bt.target, attackers: bt.attackers, mods: { attacker: 0, defender: 0 } };
  let noAdvance = false;
  for (const oc of bt.opsCards) {
    const k = oc.card.effect;
    const ocSide = sideOfPower(state, oc.power);
    if (k.kind === 'ambush' && ocSide === defSide) battleCtx.mods.attacker += k.delta ?? 1;
    if (k.kind === 'entrench_bonus' && ocSide === defSide) battleCtx.mods.defender -= k.delta ?? 1;
    if (k.kind === 'threshold') {
      // delta > 0 always IMPROVES the card holder's side.
      const d = Math.abs(k.delta ?? 1);
      if (ocSide === atkSide && k.role === 'attack') battleCtx.mods.attacker -= d;
      if (ocSide === defSide && k.role === 'defense') battleCtx.mods.defender -= d;
    }
    if (k.kind === 'cancel_advance' && ocSide === defSide) noAdvance = true;
    if (k.kind === 'repair' && ocSide === defSide) {
      ts.strength += k.strength ?? 1;
      state.roundLog.push(`${oc.power}'s "${oc.card.title}" patches the line at ${t.name} (+${k.strength ?? 1})`);
    }
    if (k.kind === 'exhaust_enemy') {
      if (ocSide === atkSide) {
        const take = Math.min(ts.strength, k.strength ?? 1);
        ts.strength -= take;
        addLosses(state, defOwner, take);
        state.roundLog.push(`${oc.power}'s "${oc.card.title}" wears down ${t.name}'s garrison (-${take})`);
      } else {
        distributeAttackerLosses(state, bt, k.strength ?? 1);
      }
    }
    if (k.kind === 'retreat' && ocSide === defSide && bt.kind === 'land') {
      const haven = game.map[bt.target].adjacent.find(n =>
        game.map[n].type === 'land' && state.t[n].owner === defOwner);
      if (haven) {
        state.t[haven].strength += ts.strength;
        ts.strength = 0;
        state.roundLog.push(`${oc.power}'s "${oc.card.title}": the garrison of ${t.name} slips away before the blow lands`);
        captureTerritory(game, state, bt, totalCommitted, { noAdvance });
        recordBattle(state, bt, 'captured', defOwner);
        return;
      }
    }
  }
  if (ts.strength <= 0) {
    // Pre-battle attrition emptied the position.
    captureTerritory(game, state, bt, totalCommitted, { noAdvance });
    recordBattle(state, bt, 'captured', defOwner);
    return;
  }
  // Card/doctrine threshold modifiers.
  for (const a of bt.attackers) {
    battleCtx.mods.attacker += thresholdModFor(state, a.power, t.theatre, 'attack');
    const dom = bt.kind === 'naval' ? 'naval' : 'land';
    if (hasDoctrine(game, state, a.power, 'threshold', { domain: dom, role: 'attack' })) battleCtx.mods.attacker -= 1;
  }
  const defController = controllerOf(state, defOwner);
  if (defController) {
    battleCtx.mods.defender += thresholdModFor(state, defController, t.theatre, 'defense');
    const dom = bt.kind === 'naval' ? 'naval' : 'land';
    if (hasDoctrine(game, state, defController, 'threshold', { domain: dom, role: 'defense' })) battleCtx.mods.defender -= 1;
    if (bt.kind === 'naval' && hasDoctrine(game, state, defController, 'convoy_escort')) battleCtx.mods.defender -= 1;
  }
  if (hasFlag(state, 'winter_freeze') && t.theatre === 'eastern') {
    // The freeze is impartial: any attacker in the East suffers, any defender digs in.
    battleCtx.mods.attacker += 1; battleCtx.mods.defender -= 1;
  }
  if (hasFlag(state, 'fortress_europe') && t.theatre === 'west' && defSide === 'axis') battleCtx.mods.defender -= 1;
  if (hasFlag(state, 'luftwaffe_grounded') && bt.attackers.some(x => x.power === 'germany')) battleCtx.mods.attacker += 1;

  const atkTh = attackerThreshold(game, state, battleCtx);
  const defTh = defenderThreshold(game, state, battleCtx);

  // Extra dice from ops cards / doctrines / decisive battle.
  let extraAtkDice = 0, exhaustion = 0;
  for (const oc of bt.opsCards) {
    if (oc.card.effect.kind === 'extra_dice' && sideOfPower(state, oc.power) === atkSide) {
      extraAtkDice += oc.card.effect.dice; exhaustion += oc.card.effect.exhaustion ?? 0;
    }
  }
  let atkDice = totalCommitted + extraAtkDice;
  if (bt.kind === 'naval') {
    if (hasFlag(state, 'uboat_surge') && t.theatre === 'atlantic'
      && bt.attackers.some(x => x.power === 'germany')) atkDice += 2;
    if (state.decisiveZone === bt.target && bt.attackers.some(x => x.power === 'japan')) {
      atkDice *= 2;
      state.roundLog.push(`Decisive Battle: Japan doubles its dice in ${t.name}`);
    }
    for (const a of bt.attackers) {
      if (hasDoctrine(game, state, a.power, 'sub_war') && t.theatre === 'atlantic') atkDice += 1;
    }
  }

  const rollPool = (n, th) => {
    let hits = 0;
    for (let i = 0; i < n; i++) if (rng.d6() >= th) hits++;
    return hits;
  };

  // Defender dice bonuses mirror the attacker's: U-boat aces and extra-dice
  // cards fight on the defense too.
  let defDiceBonus = 0, defExhaustion = 0;
  if (bt.kind === 'naval' && t.theatre === 'atlantic' && defController) {
    if (hasFlag(state, 'uboat_surge') && defController === 'germany') defDiceBonus += 2;
    if (hasDoctrine(game, state, defController, 'sub_war')) defDiceBonus += 1;
  }
  for (const oc of bt.opsCards) {
    if (oc.card.effect.kind === 'extra_dice' && sideOfPower(state, oc.power) === defSide) {
      defDiceBonus += oc.card.effect.dice; defExhaustion += oc.card.effect.exhaustion ?? 0;
    }
  }

  // First strike. Attacker side: Japan's carriers in naval offensives, or the
  // one-round bonus for jumping a neutral. Defender side: first_strike_pacific
  // lets Japan strike first even when its fleets are the ones attacked.
  const atkFirstStrike = (bt.kind === 'naval' && bt.attackers.some(x => x.power === 'japan'))
    || bt.attackers.some(x => (state.firstStrike[x.power] || 0) > 0);
  const defFirstStrike = !atkFirstStrike && bt.kind === 'naval'
    && hasFlag(state, 'first_strike_pacific') && defController === 'japan';

  const rerollFor = (side, naval) => bt.opsCards
    .filter(oc => sideOfPower(state, oc.power) === side
      && (oc.card.effect.kind === 'reroll' || (naval && oc.card.effect.kind === 'naval_reroll')))
    .reduce((s, oc) => s + (oc.card.effect.dice ?? 2), 0);

  let atkDicePool = atkDice;
  let defStrength = ts.strength;
  let atkHits, defHits;
  if (defFirstStrike) {
    defHits = rollPool(defStrength + defDiceBonus, defTh);
    atkDicePool = Math.max(0, atkDice - Math.min(totalCommitted, defHits));
    atkHits = rollPool(atkDicePool, atkTh);
  } else {
    atkHits = rollPool(atkDicePool, atkTh);
  }
  // Rerolls: throw again for up to N dice that missed.
  const atkReroll = rerollFor(atkSide, bt.kind === 'naval');
  if (atkReroll > 0 && atkHits < atkDicePool) {
    atkHits += rollPool(Math.min(atkReroll, atkDicePool - atkHits), atkTh);
  }
  // Coalition pool reroll (auto policy): a losing VC attack rerolls once for 2.
  const poolSide = atkSide;
  if (t.victoryCity && atkHits < ts.strength && state.pool[poolSide] >= 4
    && state.poolPolicy?.[poolSide]?.reroll !== false) {
    state.pool[poolSide] -= 2;
    const re = rollPool(atkDicePool, atkTh);
    if (re > atkHits) atkHits = re;
    state.roundLog.push(`${poolSide} spends 2 coalition pool to reroll the attack on ${t.name}`);
  }

  if (defHits === undefined) {
    if (atkFirstStrike) defStrength = Math.max(0, defStrength - atkHits);
    defHits = rollPool(defStrength + (defStrength > 0 ? defDiceBonus : 0), defTh);
  }
  const defReroll = rerollFor(defSide, bt.kind === 'naval');
  if (defReroll > 0 && defHits < defStrength + defDiceBonus) {
    defHits += rollPool(Math.min(defReroll, defStrength + defDiceBonus - defHits), defTh);
  }
  if (defExhaustion) {
    const take = Math.min(ts.strength, defExhaustion);
    ts.strength -= take;
    addLosses(state, defOwner, take);
  }

  // Apply losses.
  const defLoss = Math.min(ts.strength, atkHits);
  ts.strength -= defLoss;
  addLosses(state, defOwner, defLoss);
  let atkLoss = Math.min(totalCommitted, defHits);
  distributeAttackerLosses(state, bt, atkLoss);
  // Exhaustion from forced-march style cards.
  if (exhaustion) distributeAttackerLosses(state, bt, exhaustion);

  const survivors = bt.attackers.reduce((s, a) => s + a.committed, 0);
  const powers = bt.attackers.map(x => x.power).join('+');
  if (ts.strength <= 0 && survivors > 0) {
    captureTerritory(game, state, bt, survivors, { noAdvance });
    state.roundLog.push(
      `${powers} take ${t.name} (${atkDicePool} dice on ${atkTh}+ → ${atkHits} hits; defense ${defHits} hits back)`);
    recordBattle(state, bt, 'captured', defOwner);
  } else {
    returnCommitted(game, state, bt);
    if (ts.strength <= 0) { ts.strength = 0; }
    state.roundLog.push(
      `${powers} fail before ${t.name} (${atkHits} hits vs ${defStrength ? defHits : 0} back; defender holds)`);
    recordBattle(state, bt, 'held', defOwner);
  }
  // Wolf packs slip past the escorts: a convoy strike raids after the battle,
  // win or lose.
  if (bt.kind === 'naval') {
    for (const oc of bt.opsCards) {
      if (oc.card.effect.kind === 'convoy_strike' && sideOfPower(state, oc.power) === atkSide) {
        resolveConvoyRaid(game, state, rng, bt, bt.attackers.find(x => x.power === oc.power) ?? bt.attackers[0]);
      }
    }
  }
}

function recordBattle(state, bt, result, defOwner) {
  state.battleRecords = state.battleRecords || [];
  state.battleRecords.push({
    target: bt.target, side: bt.side, kind: bt.kind, result,
    powers: bt.attackers.map(a => a.power),
    defenderController: defOwner != null ? controllerOf(state, defOwner) : null,
  });
}

function addLosses(state, ownerTag, n) {
  const ctrl = controllerOf(state, ownerTag);
  if (ctrl && state.powers[ctrl]) state.powers[ctrl].lossesLastRound += n;
}

function distributeAttackerLosses(state, bt, losses) {
  const order = [...bt.attackers].sort((x, y) => y.committed - x.committed);
  let i = 0;
  while (losses > 0 && order.some(a => a.committed > 0)) {
    const a = order[i % order.length];
    if (a.committed > 0) {
      a.committed--; losses--;
      addLosses(state, a.power, 1);
    }
    i++;
  }
}

function captureTerritory(game, state, bt, survivors, opts = {}) {
  const ts = state.t[bt.target];
  const lead = [...bt.attackers].sort((x, y) => y.committed - x.committed)[0];
  // The conquest belongs to the units that made it: a French-sourced attack
  // plants a French flag, a defected nation's attack plants its own.
  ts.owner = lead.ownerTag ?? lead.power;
  ts.strength = Math.max(1, lead.committed);
  ts.entrenched = false;
  ts.fort = Math.max(0, ts.fort - 1); // storming damages the works
  // Other powers' survivors go home.
  for (const a of bt.attackers) {
    if (a === lead) continue;
    returnOne(game, state, a);
  }
  // Interior lines / storm troops: free advance into the captured territory.
  // Blitz extends the reach: reinforcements may come from two territories away.
  const adv = lead.power === 'germany' || hasDoctrineSafe(game, state, lead.power, 'extra_advance');
  if (adv && bt.kind === 'land' && !opts.noAdvance && !bt.opsCards?.some(oc =>
    oc.card.effect.kind === 'cancel_advance'
    && sideOfPower(state, oc.power) !== bt.side)) {
    const tags = ownedTagsOf(state, lead.power);
    const blitz = lead.power === 'germany' && hasFlag(state, 'blitz_bonus');
    const reach = new Set(game.map[bt.target].adjacent);
    if (blitz) {
      for (const n of [...reach]) {
        if (tags.includes(state.t[n].owner)) {
          for (const n2 of game.map[n].adjacent) reach.add(n2);
        }
      }
    }
    reach.delete(bt.target);
    let bestAdj = null;
    for (const n of reach) {
      const ns = state.t[n];
      if (game.map[n].type === 'land' && tags.includes(ns.owner) && ns.strength > 1
        && (!bestAdj || ns.strength > state.t[bestAdj].strength)) bestAdj = n;
    }
    if (bestAdj) {
      const mv = Math.min(2, state.t[bestAdj].strength - 1);
      state.t[bestAdj].strength -= mv;
      ts.strength += mv;
      if (mv > 0) state.roundLog.push(`${lead.power} advances ${mv} strength into ${game.map[bt.target].name}`);
    }
  }
}

function hasDoctrineSafe(game, state, pid, kind) {
  try { return !!hasDoctrine(game, state, pid, kind); } catch { return false; }
}

function returnCommitted(game, state, bt) {
  for (const a of bt.attackers) returnOne(game, state, a);
}

function returnOne(game, state, a) {
  // Survivors march home — unless home fell while they were away. A source
  // the enemy now holds cannot take them back; they route to an adjacent
  // friendly territory, or are cut off and lost.
  const tags = ownedTagsOf(state, a.power);
  let remaining = a.committed || 0;
  const receive = (tid, n) => { state.t[tid].strength += n; };
  for (const s of a.order.sources) {
    if (remaining <= 0) break;
    const back = Math.min(remaining, s.taken ?? s.strength);
    if (tags.includes(state.t[s.from].owner)) {
      receive(s.from, back);
      remaining -= back;
    } else {
      const haven = game.map[s.from].adjacent.find(n =>
        game.map[n].type === 'land' && tags.includes(state.t[n].owner));
      if (haven) { receive(haven, back); remaining -= back; }
      else {
        addLosses(state, a.power, back);
        remaining -= back;
        state.roundLog.push(`${a.power}'s force from ${game.map[s.from].name} is cut off and destroyed`);
      }
    }
  }
  if (remaining > 0 && a.order.sources[0]) {
    const first = a.order.sources[0].from;
    if (tags.includes(state.t[first].owner)) receive(first, remaining);
    else addLosses(state, a.power, remaining);
  }
  a.committed = 0;
}

function resolveConvoyRaid(game, state, rng, bt, raiderOverride = null) {
  const raider = raiderOverride ?? bt.attackers[0];
  const th = 5;
  let dice = raider.committed || raider.dice || 0;
  if (hasFlag(state, 'uboat_surge') && raider.power === 'germany') dice += 2;
  let hits = 0;
  for (let i = 0; i < dice; i++) if (rng.d6() >= th) hits++;
  // Condor patrols and their kin double AXIS raiding in the ATLANTIC only.
  if (hasFlag(state, 'convoy_raid_double') && game.map[bt.target].theatre === 'atlantic'
    && sideOfPower(state, raider.power) === 'axis') hits *= 2;
  if (hits > 0) {
    const victim = sideOfPower(state, raider.power) === 'axis' ? 'uk' : 'germany';
    state.productionDelta[victim] = state.productionDelta[victim] || [];
    state.productionDelta[victim].push({ delta: -hits, rounds: 1 });
    state.roundLog.push(`Convoy raid in ${game.map[bt.target].name}: ${victim} loses ${hits} production`);
  }
}
