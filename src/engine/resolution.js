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
          && game.map[order.target].theatre === 'pacific') c = Math.min(c, 4);
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
    case 'entrench': return COSTS.entrench;
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
// Returns { orders, spent, budget, dropped }.
export function validateSheet(game, state, powerId, sheet) {
  const p = state.powers[powerId];
  const tags = ownedTagsOf(state, powerId);
  const dropped = [];
  const kept = [];
  let budget = p.cp;
  let commanderBudget = 0;
  // Commanders are keyed `${theatre}|${side}`; the office's 3 CP may only be
  // spent on OTHER powers' orders in that theatre — never your own.
  const cmdTheatres = Object.entries(state.commanders)
    .filter(([, c]) => c && c.power !== powerId && c.side === sideOfPower(state, powerId))
    .map(([key]) => key.split('|')[0]);
  if (cmdTheatres.length) commanderBudget = 3; // spendable only inside those theatres

  // Strategy cards played for ops add to the budget first.
  for (const o of sheet.orders) {
    if (o.type === 'strat_card' && o.forOps && p.stratHand.includes(o.cardId)) {
      budget += game.cards[o.cardId]?.ops ?? 0;
    }
  }

  let spent = 0, freeMoveUsed = false; // spent may hold halves (interior lines)
  const committedFrom = {}; // territory -> strength already pledged
  for (const o of sheet.orders) {
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
      const mySide = sideOfPower(state, powerId);
      const friendly = tags.includes(to.owner) || toSide === mySide
        || (game.map[o.to].type === 'sea' && (to.owner === 'none' || to.strength === 0));
      if (!friendly) { fail('destination not friendly'); continue; }
      if (game.map[o.to].type === 'sea' && game.map[o.from].type === 'land'
        && p.ratings.sea < 2) { fail('no fleet capacity'); continue; }
      if (!p.atWar && !tags.includes(to.owner) && to.owner !== 'none') { fail('neutral cannot move abroad'); continue; }
      committedFrom[o.from] = (committedFrom[o.from] || 0) + o.strength;
      if (cost === 1 && !freeMoveUsed && hasDoctrine(game, state, powerId, 'move_discount')) {
        freeMoveUsed = true; cost = 0;
      }
    } else if (o.type === 'offensive') {
      const t = state.t[o.target];
      if (!t) { fail('unknown target'); continue; }
      if (!p.atWar) { fail('neutral cannot attack'); continue; }
      const targetSide = sideOfOwner(state, t.owner);
      const mySide = sideOfPower(state, powerId);
      if (tags.includes(t.owner) || targetSide === mySide) { fail('target friendly'); continue; }
      let total = 0; let ok = true;
      const maxSources = powerId === 'ussr' ? 2 : 1; // deep battle
      if (!o.sources || o.sources.length < 1 || o.sources.length > maxSources) { fail('bad sources'); continue; }
      for (const s of o.sources) {
        const st = state.t[s.from];
        if (!st || !tags.includes(st.owner)
          || (powerId === 'germany' && o.germanClient && st.owner === o.germanClient)) ok = false;
        else if (s.strength < 1 || s.strength > st.strength - (committedFrom[s.from] || 0)) ok = false;
        else if (!o.amphibious && !game.map[s.from].adjacent.includes(o.target)) ok = false;
        else if (o.amphibious) {
          const via = o.via;
          if (!via || !game.map[via] || game.map[via].type !== 'sea') ok = false;
          else if (!game.map[s.from].adjacent.includes(via) || !game.map[via].adjacent.includes(o.target)) ok = false;
          else if (enemies(sideOfOwner(state, state.t[via].owner), mySide)) ok = false;
        }
        total += s.strength;
      }
      if (!ok) { fail('illegal sources'); continue; }
      if (total > MAX_COMMIT_PER_POWER) { fail('over the 8-strength ceiling'); continue; }
      for (const s of o.sources) committedFrom[s.from] = (committedFrom[s.from] || 0) + s.strength;
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
      const side = sideOfPower(state, powerId);
      if (o.points < 1 || o.points > state.pool[side]) { fail('pool too small'); continue; }
    } else if (o.type === 'enter_war') {
      if (p.atWar || p.pressure === null || p.pressure < 7) { fail('cannot enter yet'); continue; }
    } else if (o.type === 'defect') {
      const n = state.nations[o.nation];
      if (powerId !== 'indies' || !n || n.allegiance !== 'axis' || n.pressure < 7) { fail('cannot defect'); continue; }
    } else if (o.type === 'sell_commitment') {
      const n = state.nations[o.nation];
      if (powerId !== 'indies' || !n || n.allegiance !== 'axis') { fail('not a client'); continue; }
    }

    // Budget check: commander budget usable only inside commanded theatres.
    // `spent` may carry a half point from interior-lines moves; the budget
    // comparison rounds up so a stray half never buys a full extra order.
    const th = orderTheatre(game, o);
    let fromCmd = 0;
    if (cost >= 1 && th && cmdTheatres.includes(th)) fromCmd = Math.min(Math.floor(cost), commanderBudget);
    if (Math.ceil(spent + cost - fromCmd) > budget) { fail('over command point budget'); continue; }
    commanderBudget -= fromCmd;
    spent += cost - fromCmd;
    kept.push(o);
  }
  spent = Math.ceil(spent);
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
    applyEffects(game, state, ev.card.effects, { by: ev.by });
    if (ev.card.remove) state.decks.strat.removed.push(ev.card.id);
    else state.decks.strat.discard.push(ev.card.id);
  }

  // 2. Intel ops.
  for (const [pid, sheet] of Object.entries(sheets)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type === 'intel_op' && o.kind === 'pressure' && o.track) {
        const delta = Math.sign(o.delta || 1);
        applyEffects(game, state, [{ op: 'pressure', track: o.track, delta }]);
      } else if (o.type === 'intel_op' && o.kind === 'deception') {
        state.activeFlags.push({ name: 'deception', rounds: 1, power: pid });
      } else if (o.type === 'sell_commitment') {
        state.powers.indies.cp += 2;
        applyEffects(game, state, [{ op: 'pressure', track: o.nation, delta: 1 }]);
        state.roundLog.push(`Independent States sell ${o.nation}'s commitment for 2 CP`);
      } else if (o.type === 'decisive_battle') {
        state.powers.japan.decisiveUsed = true;
        state.decisiveZone = o.zone;
        state.roundLog.push(`Japan declares a Decisive Battle in ${game.map[o.zone]?.name ?? o.zone}`);
      }
    }
  }

  // 3. Collect offensives into battles; detect joint orders; pay the pool.
  const byTarget = {};
  for (const [pid, sheet] of Object.entries(sheets)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type !== 'offensive') continue;
      (byTarget[o.target] = byTarget[o.target] || []).push({ power: pid, order: o });
    }
  }
  for (const [target, attacks] of Object.entries(byTarget)) {
    const bySide = { axis: [], allied: [] };
    for (const a of attacks) bySide[sideOfPower(state, a.power)].push(a);
    for (const side of ['axis', 'allied']) {
      if (!bySide[side].length) continue;
      const attackers = bySide[side];
      if (attackers.length > 1) {
        state.pool[side] += attackers.length - 1;
        state.roundLog.push(
          `Joint order on ${game.map[target].name}: ${attackers.map(a => a.power).join(' + ')} ` +
          `(+${attackers.length - 1} ${side} coalition pool)`);
      }
      state.battles.push({ kind: 'land', target, side, attackers, opsCards: [] });
    }
  }

  // 4. Naval orders become naval battles / escorts / raids.
  for (const [pid, sheet] of Object.entries(sheets)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type !== 'naval') continue;
      state.battles.push({
        kind: 'naval', target: o.zone, side: sideOfPower(state, pid),
        attackers: [{ power: pid, order: { sources: [{ from: o.from, strength: o.strength }] } }],
        mission: o.mission ?? 'contest', opsCards: [],
      });
    }
  }

  // 5. Attach declared ops cards to their battles.
  for (const [pid, sheet] of Object.entries(sheets)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type !== 'ops_card') continue;
      const p = state.powers[pid];
      p.opsHand = p.opsHand.filter(c => c !== o.cardId);
      state.decks.opsDiscard.push(o.cardId);
      const card = game.opsCards[o.cardId];
      const battle = state.battles.find(b => b.target === (o.battle ?? ''));
      if (battle) battle.opsCards.push({ power: pid, card });
      else state.roundLog.push(`${pid}'s "${card.title}" finds no battle and is discarded`);
    }
  }

  // 6. Attacking a neutral: pressure to 10, first strike for one round.
  for (const b of state.battles) {
    if (b.kind !== 'land') continue;
    const owner = state.t[b.target].owner;
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
  // Initiative: d6 per side + pool bids.
  const bids = { axis: 0, allied: 0 };
  for (const [pid, sheet] of Object.entries(state.orders)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type === 'initiative_bid') {
        const side = sideOfPower(state, pid);
        const pts = Math.min(o.points, state.pool[side]);
        state.pool[side] -= pts;
        bids[side] += pts;
      }
    }
  }
  let a = rng.d6() + bids.axis, b = rng.d6() + bids.allied;
  if (a === b) state.initiative = rng.coin() === 'heads' ? 'axis' : 'allied';
  else state.initiative = a > b ? 'axis' : 'allied';
  state.roundLog.push(`Initiative: ${state.initiative} (axis ${a} vs allied ${b})`);

  // Moves execute first (all sides simultaneously).
  for (const [pid, sheet] of Object.entries(state.orders)) {
    if (!sheet) continue;
    for (const o of sheet.orders) {
      if (o.type !== 'move') continue;
      const from = state.t[o.from], to = state.t[o.to];
      const amount = Math.min(o.strength, from.strength);
      if (amount <= 0) continue;
      from.strength -= amount;
      if (to.strength === 0 || to.owner === 'none') { to.owner = ownerTagForMove(state, pid, to.owner); }
      to.strength += amount;
      to.entrenched = false;
    }
    for (const o of sheet.orders) {
      if (o.type === 'entrench') state.t[o.territory].entrenched = true;
    }
  }

  // Commit offensive strength out of its source territories.
  for (const bt of state.battles) {
    for (const at of bt.attackers) {
      at.committed = 0;
      for (const s of at.order.sources) {
        const src = state.t[s.from];
        const take = Math.min(s.strength, src.strength);
        src.strength -= take;
        at.committed += take;
        s.taken = take;
      }
    }
  }

  // The coin: initiative side settles exactly one contested battle without dice.
  const coinTarget = options.coinBattle ?? pickCoinBattle(game, state);
  state.coinBattle = coinTarget;

  // Resolve theatre by theatre, naval first.
  for (const theatre of THEATRE_ORDER) {
    const here = state.battles
      .filter(bt => game.map[bt.target].theatre === theatre)
      .sort((x, y) => (x.kind === y.kind ? x.target.localeCompare(y.target) : x.kind === 'naval' ? -1 : 1));
    for (const bt of here) resolveBattle(game, state, rng, bt, bt.target === coinTarget);
  }

  traceSupply(game, state);
}

function ownerTagForMove(state, pid, currentOwner) {
  // Moving into an empty/none territory claims it for the moving power.
  return pid;
}

function pickCoinBattle(game, state) {
  // Auto policy: the initiative side flips the contested battle where it is the
  // defender with the worst odds, or its own riskiest attack. Simple heuristic:
  // biggest battle involving the initiative side as defender.
  let best = null, bestSize = -1;
  for (const bt of state.battles) {
    if (bt.kind !== 'land') continue;
    const defOwner = state.t[bt.target].owner;
    const defSide = sideOfOwner(state, defOwner);
    const atkStrength = bt.attackers.reduce((s, x) => s + (x.committed || 0), 0);
    if (defSide === state.initiative && atkStrength > bestSize && atkStrength > state.t[bt.target].strength) {
      best = bt.target; bestSize = atkStrength;
    }
  }
  return best;
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

  // Uncontested sea zone: occupy it.
  if (bt.kind === 'naval' && (ts.strength === 0 || defSide === 'none' || defSide === 'neutral')) {
    const lead = bt.attackers[0];
    ts.owner = lead.power; ts.strength += lead.committed;
    state.roundLog.push(`${lead.power} ${bt.mission === 'escort' ? 'escorts convoys in' : 'takes station in'} ${t.name}`);
    if (bt.mission === 'raid') resolveConvoyRaid(game, state, rng, bt);
    return;
  }

  // Neutral minor land defends itself; a neutral power's territory defends too.
  const record = { target: bt.target, name: t.name, kind: bt.kind, attackers: [], result: '' };

  if (isCoinBattle) {
    const flip = rng.coin();
    state.coinUsedRound = state.round;
    const atkStr = totalCommitted, defStr = ts.strength;
    if (flip === 'heads') {
      const survivors = Math.max(1, atkStr - Math.ceil(atkStr / 2));
      captureTerritory(game, state, bt, survivors);
      state.roundLog.push(`THE COIN on ${t.name}: heads — the attack carries. ${defOwner} loses the territory.`);
      addLosses(state, defOwner, defStr);
    } else {
      ts.strength = Math.max(1, defStr - Math.ceil(defStr / 2));
      addLosses(state, defOwner, defStr - ts.strength);
      for (const a of bt.attackers) {
        const lost = Math.ceil((a.committed || 0) / 2);
        addLosses(state, a.power, lost);
        a.committed = (a.committed || 0) - lost; // survivors head home
      }
      returnCommitted(game, state, bt);
      state.roundLog.push(`THE COIN on ${t.name}: tails — the line holds. Both sides bleed.`);
    }
    state.battleRecords = state.battleRecords || [];
    state.battleRecords.push({ ...record, result: flip === 'heads' ? 'captured-by-coin' : 'held-by-coin', side: atkSide });
    return;
  }

  // Dice pools & thresholds.
  const battleCtx = { target: bt.target, attackers: bt.attackers, mods: { attacker: 0, defender: 0 } };
  for (const oc of bt.opsCards) {
    const k = oc.card.effect;
    const ocSide = sideOfPower(state, oc.power);
    if (k.kind === 'ambush' && ocSide === defSide) battleCtx.mods.attacker += k.delta ?? 1;
    if (k.kind === 'entrench_bonus' && ocSide === defSide) battleCtx.mods.defender -= k.delta ?? 1;
    if (k.kind === 'threshold') {
      if (ocSide === atkSide && k.role === 'attack') battleCtx.mods.attacker -= k.delta;
      if (ocSide === defSide && k.role === 'defense') battleCtx.mods.defender -= k.delta;
    }
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
  if (hasFlag(state, 'winter_freeze') && t.theatre === 'eastern' && atkSide === 'axis') {
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

  // First strike: carrier doctrine (naval), Pearl-Harbor-style flags, neutral ambush.
  const firstStrike = (bt.kind === 'naval'
    && (bt.attackers.some(x => x.power === 'japan') || hasFlag(state, 'first_strike_pacific')))
    || bt.attackers.some(x => (state.firstStrike[x.power] || 0) > 0);

  let atkHits = rollPool(atkDice, atkTh);
  // Coalition pool reroll (auto policy): a losing VC attack rerolls once for 2.
  const poolSide = atkSide;
  if (t.victoryCity && atkHits < ts.strength && state.pool[poolSide] >= 4
    && state.poolPolicy?.[poolSide]?.reroll !== false) {
    state.pool[poolSide] -= 2;
    const re = rollPool(atkDice, atkTh);
    if (re > atkHits) atkHits = re;
    state.roundLog.push(`${poolSide} spends 2 coalition pool to reroll the attack on ${t.name}`);
  }

  let defStrength = ts.strength;
  let defHits;
  if (firstStrike) {
    defStrength = Math.max(0, defStrength - atkHits);
    defHits = rollPool(defStrength, defTh);
  } else {
    defHits = rollPool(defStrength, defTh);
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
    captureTerritory(game, state, bt, survivors);
    state.roundLog.push(
      `${powers} take ${t.name} (${atkDice} dice on ${atkTh}+ → ${atkHits} hits; defense ${defHits} hits back)`);
    recordBattle(state, bt, 'captured');
  } else {
    returnCommitted(game, state, bt);
    if (ts.strength <= 0) { ts.strength = 0; }
    state.roundLog.push(
      `${powers} fail before ${t.name} (${atkHits} hits vs ${defStrength ? defHits : 0} back; defender holds)`);
    recordBattle(state, bt, 'held');
  }
}

function recordBattle(state, bt, result) {
  state.battleRecords = state.battleRecords || [];
  state.battleRecords.push({
    target: bt.target, side: bt.side, kind: bt.kind, result,
    powers: bt.attackers.map(a => a.power),
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

function captureTerritory(game, state, bt, survivors) {
  const ts = state.t[bt.target];
  const lead = [...bt.attackers].sort((x, y) => y.committed - x.committed)[0];
  ts.owner = lead.power;
  ts.strength = Math.max(1, lead.committed);
  ts.entrenched = false;
  ts.fort = Math.max(0, ts.fort - 1); // storming damages the works
  // Other powers' survivors go home.
  for (const a of bt.attackers) {
    if (a === lead) continue;
    returnOne(game, state, a);
  }
  // Interior lines / storm troops: free advance from an adjacent friendly territory.
  const adv = lead.power === 'germany' || hasDoctrineSafe(game, state, lead.power, 'extra_advance');
  if (adv && bt.kind === 'land') {
    const tags = ownedTagsOf(state, lead.power);
    let bestAdj = null;
    for (const n of game.map[bt.target].adjacent) {
      const ns = state.t[n];
      if (tags.includes(ns.owner) && ns.strength > 1 && (!bestAdj || ns.strength > state.t[bestAdj].strength)) bestAdj = n;
    }
    if (bestAdj) {
      const mv = Math.min(hasFlag(state, 'blitz_bonus') ? 3 : 2, state.t[bestAdj].strength - 1);
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
  let remaining = a.committed || 0;
  for (const s of a.order.sources) {
    if (remaining <= 0) break;
    const back = Math.min(remaining, s.taken ?? s.strength);
    state.t[s.from].strength += back;
    remaining -= back;
  }
  // Any overflow (advances etc.) goes to the first source.
  if (remaining > 0 && a.order.sources[0]) state.t[a.order.sources[0].from].strength += remaining;
  a.committed = 0;
}

function resolveConvoyRaid(game, state, rng, bt) {
  const raider = bt.attackers[0];
  const th = 5;
  let dice = raider.committed;
  if (hasFlag(state, 'uboat_surge') && raider.power === 'germany') dice += 2;
  let hits = 0;
  for (let i = 0; i < dice; i++) if (rng.d6() >= th) hits++;
  if (hasFlag(state, 'convoy_raid_double')) hits *= 2;
  if (hits > 0) {
    const victim = sideOfPower(state, raider.power) === 'axis' ? 'uk' : 'germany';
    state.productionDelta[victim] = state.productionDelta[victim] || [];
    state.productionDelta[victim].push({ delta: -hits, rounds: 1 });
    state.roundLog.push(`Convoy raid in ${game.map[bt.target].name}: ${victim} loses ${hits} production`);
  }
}
