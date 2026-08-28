// The game facade: one object that walks a round through its six phases.
// UI, AI, and simulation all drive the game exclusively through this API.

import { createGame, STRAT_HAND_SIZE, opsHandSize, eraForRound, hasDoctrine } from './state.js';
import { makeRng } from './rng.js';
import { validateSheet, reveal, resolveRound } from './resolution.js';
import { reckon } from './reckoning.js';
import { computeCP, powersActiveInTheatre, sideOfPower, PHASES } from './rules.js';
import { POWERS } from './data.js';
import { CALENDAR } from '../data/powers.js';

export class Coalition1939 {
  constructor(options = {}) {
    const { game, state } = createGame(options);
    this.game = game;
    this.state = state;
    this.options = options;
  }

  rng() {
    const r = makeRng(this.state.rngState || this.game.seed);
    return r;
  }
  saveRng(r) { this.state.rngState = r.state(); }

  calendar() { return CALENDAR[Math.min(this.state.round, 12)]; }

  // ——— phase 4.1: intelligence ———
  intel() {
    const s = this.state;
    if (s.phase !== 'intel') return;
    const rng = this.rng();
    const era = eraForRound(s.round);
    const eras = [era, era === 'early' ? 'mid' : era === 'mid' ? 'late' : 'mid'];
    for (const pid of Object.keys(POWERS)) {
      const p = s.powers[pid];
      // Strategy hand.
      while (p.stratHand.length < STRAT_HAND_SIZE) {
        let drew = null;
        for (const e of eras) {
          if (s.decks.strat[e].length) { drew = s.decks.strat[e].pop(); break; }
          const back = s.decks.strat.discard.filter(id => this.game.cards[id].era === e);
          if (back.length) {
            s.decks.strat.discard = s.decks.strat.discard.filter(id => this.game.cards[id].era !== e);
            s.decks.strat[e] = rng.shuffle(back);
            drew = s.decks.strat[e].pop();
            break;
          }
        }
        if (!drew) break;
        p.stratHand.push(drew);
      }
      // Operations hand.
      let handSize = opsHandSize(pid);
      if (hasDoctrine(this.game, s, pid, 'intel')) handSize += 1;
      while (p.opsHand.length < handSize) {
        if (!s.decks.ops.length) s.decks.ops = rng.shuffle(s.decks.opsDiscard.splice(0));
        const c = s.decks.ops.pop();
        if (!c) break;
        p.opsHand.push(c);
      }
    }
    this.saveRng(rng);
    s.phase = 'council';
  }

  // ——— phase 4.2: council ———
  // input: { commanders: [{ theatre, power }...], ultra: { target, theatre } }
  council(input = {}) {
    const s = this.state;
    if (s.phase !== 'council') return;
    for (const pick of input.commanders ?? []) {
      const theatre = pick.theatre;
      const side = sideOfPower(s, pick.power);
      const active = powersActiveInTheatre(this.game, s, theatre, side);
      if (!active.includes(pick.power)) continue;
      if (s.commanders[`${theatre}|${side}`]) continue; // one election per office
      s.commanders[`${theatre}|${side}`] = { power: pick.power, side };
      if (active.length >= 3) {
        s.pool[side] += 2;
        s.roundLog.push(`${pick.power} elected Supreme Commander of ${theatre} (+2 ${side} coalition pool)`);
      } else {
        s.roundLog.push(`${pick.power} elected Supreme Commander of ${theatre}`);
      }
    }
    if (input.ultra && s.powers.uk.ultraUsedRound !== s.round) {
      s.powers.uk.ultraUsedRound = s.round;
      s.ultra = { target: input.ultra.target, theatre: input.ultra.theatre };
      s.roundLog.push(`Ultra: Bletchley reads ${input.ultra.target}'s ${input.ultra.theatre} traffic`);
    }
    s.phase = 'orders';
  }

  // ——— phase 4.3: orders (secret, simultaneous) ———
  submitOrders(powerId, sheet) {
    const s = this.state;
    if (s.phase !== 'orders') throw new Error('not the orders phase');
    const v = validateSheet(this.game, s, powerId, sheet, { commit: true });
    s.orders[powerId] = { power: powerId, orders: v.orders, spent: v.spent, dropped: v.dropped };
    return v;
  }

  allSubmitted() {
    return Object.keys(POWERS).every(pid => this.state.orders[pid]);
  }

  // ——— phases 4.4 + 4.5 + 4.6 ———
  runReveal() {
    const s = this.state;
    if (s.phase !== 'orders') return;
    s.phase = 'reveal';
    const rng = this.rng();
    reveal(this.game, s, rng);
    this.saveRng(rng);
    s.phase = 'resolution';
  }

  runResolution(options = {}) {
    const s = this.state;
    if (s.phase !== 'resolution') return;
    const rng = this.rng();
    resolveRound(this.game, s, rng, options);
    this.saveRng(rng);
    s.phase = 'reckoning';
  }

  runReckoning() {
    const s = this.state;
    if (s.phase !== 'reckoning') return;
    const rng = this.rng();
    reckon(this.game, s, rng);
    this.saveRng(rng);
  }

  save() { return JSON.stringify(this.state); }
  load(json) { this.state = JSON.parse(json); }
}

export { PHASES };
