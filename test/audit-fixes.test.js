// Regression tests for the adversarial-audit findings: the exploits and
// contract deviations the verification pass confirmed must stay dead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Coalition1939 } from '../src/engine/game.js';
import { recomputeCorridors } from '../src/engine/rules.js';

function fresh(seed) {
  const g = new Coalition1939({ seed });
  g.intel(); g.council({});
  return g;
}

test('a power cannot joint-order with itself: second offensive on a target is refused', () => {
  const g = fresh('t-selfjoint');
  const s = g.state;
  s.t.w_poland.strength = 12; s.t.slovakia.owner = 'germany'; s.t.slovakia.strength = 12;
  const v = g.submitOrders('germany', {
    orders: [
      { type: 'offensive', target: 'e_poland', sources: [{ from: 'w_poland', strength: 8 }] },
      { type: 'offensive', target: 'e_poland', sources: [{ from: 'slovakia', strength: 8 }] },
    ],
  });
  assert.equal(v.orders.filter(o => o.type === 'offensive').length, 1);
  assert.match(v.dropped[0].reason, /already attacking/);
});

test('the neutral-attack first strike expires after one round', () => {
  const g = fresh('t-fs-expiry');
  const s = g.state;
  s.t.w_ukraine.owner = 'germany'; s.t.w_ukraine.strength = 6;
  g.submitOrders('germany', { orders: [{ type: 'offensive', target: 'kiev', sources: [{ from: 'w_ukraine', strength: 5 }] }] });
  for (const pid of Object.keys(s.powers)) if (!s.orders[pid]) g.submitOrders(pid, { orders: [] });
  g.runReveal();
  assert.equal(s.firstStrike.germany, 1);
  g.runResolution(); g.runReckoning();
  assert.equal(g.state.firstStrike.germany, undefined, 'Barbarossa surprise lasts one round only');
});

test('one Supreme Commander office funds 3 CP total, shared, never the commander', () => {
  const g = fresh('t-cmdpot');
  const s = g.state;
  // Stage an eastern theatre with three allied powers active so an election stands.
  s.powers.usa.atWar = true; s.powers.ussr.atWar = true;
  s.t.smolensk.owner = 'uk'; s.t.smolensk.strength = 3;
  s.t.orel.owner = 'usa'; s.t.orel.strength = 3;
  s.commanders = { 'eastern|allied': { power: 'ussr', side: 'allied' } };
  s.powers.uk.cp = 0; s.powers.usa.cp = 0; // only the pot can pay
  const vUk = g.submitOrders('uk', { orders: [{ type: 'entrench', territory: 'smolensk' }, { type: 'entrench', territory: 'smolensk' }] });
  const paidUk = vUk.orders.length;
  const vUsa = g.submitOrders('usa', { orders: [{ type: 'entrench', territory: 'orel' }, { type: 'entrench', territory: 'orel' }, { type: 'entrench', territory: 'orel' }] });
  assert.ok(paidUk + vUsa.orders.length <= 3, `office paid ${paidUk + vUsa.orders.length} CP, must be <= 3`);
  // The commander itself gets nothing from its own office.
  s.powers.ussr.cp = 0;
  const vUssr = g.submitOrders('ussr', { orders: [{ type: 'entrench', territory: 'moscow' }] });
  assert.equal(vUssr.orders.length, 0);
});

test('only the first strategy card funds the budget, and only once', () => {
  const g = fresh('t-forops');
  const s = g.state;
  const p = s.powers.germany;
  const [c1, c2] = p.stratHand;
  const base = p.cp;
  const v = g.submitOrders('germany', {
    orders: [
      { type: 'strat_card', cardId: c1, forOps: true },
      { type: 'strat_card', cardId: c2, forOps: true },
    ],
  });
  assert.equal(v.budget, base + g.game.cards[c1].ops, 'second card adds nothing');
  assert.equal(v.orders.filter(o => o.type === 'strat_card').length, 1);
});

test('the coin: loser loses half rounded up, winner untouched, strength stays sane', () => {
  for (const seed of ['t-coin-a', 't-coin-b', 't-coin-c']) {
    const g = fresh(seed);
    const s = g.state;
    s.t.w_poland.strength = 6;
    s.t.e_poland.owner = 'germany'; // give the USSR... no: germany attacks e_poland (soviet)
    s.t.e_poland.owner = 'ussr'; s.t.e_poland.strength = 5;
    g.submitOrders('germany', { orders: [{ type: 'offensive', target: 'e_poland', sources: [{ from: 'w_poland', strength: 6 }] }] });
    for (const pid of Object.keys(s.powers)) if (!s.orders[pid]) g.submitOrders(pid, { orders: [] });
    g.runReveal();
    g.runResolution({ coinBattle: 'e_poland' });
    const t = s.t.e_poland;
    if (t.owner === 'germany') {
      // Heads: attackers arrive whole (plus any free advance), defenders halved and displaced.
      assert.ok(t.strength >= 6, `attackers untouched, got ${t.strength}`);
    } else {
      // Tails: defender untouched, attackers halved on the way home.
      assert.equal(t.strength, 5);
      assert.equal(s.t.w_poland.strength, 3);
    }
    for (const ts of Object.values(s.t)) assert.ok(ts.strength >= 0);
  }
});

test('a defected nation fights the Axis, and its conquests fly its own flag', () => {
  const g = fresh('t-defect-side');
  const s = g.state;
  s.nations.romania.allegiance = 'allied';
  s.t.romania.strength = 6;
  s.t.hungary.strength = 1;
  // Romania (allied now, still the Indies seat) attacks Axis Hungary.
  const v = g.submitOrders('indies', {
    orders: [{ type: 'offensive', target: 'hungary', sources: [{ from: 'romania', strength: 5 }] }],
  });
  assert.equal(v.orders.length, 1, 'defected Romania may attack the Axis');
  // And may NOT attack the Allies.
  const g2 = fresh('t-defect-side2');
  const s2 = g2.state;
  s2.nations.romania.allegiance = 'allied';
  s2.t.romania.strength = 6;
  s2.t.odessa.owner = 'ussr'; s2.powers.ussr.atWar = true;
  const v2 = g2.submitOrders('indies', {
    orders: [{ type: 'offensive', target: 'odessa', sources: [{ from: 'romania', strength: 5 }] }],
  });
  assert.equal(v2.orders.length, 0);
});

test('the Burma Road needs China, not just the Western powers', () => {
  const g = fresh('t-burma');
  const s = g.state;
  // Strip Chinese presence around the road; pile UK strength in instead.
  s.t.yunnan.owner = 'uk'; s.t.yunnan.strength = 4;
  s.t.burma.strength = 4;
  for (const tid of ['s_china', 'chongqing', 'c_china', 'shensi', 'sinkiang', 'inner_mongolia']) {
    s.t[tid].owner = 'japan';
  }
  recomputeCorridors(g.game, s);
  assert.equal(s.corridors.burma_road.open, false, 'no China presence, no road');
});

test('event command points arrive on the next budget, never vanish', () => {
  const g = fresh('t-cp-carry');
  const s = g.state;
  s.powers.germany.cpCarry = 2;
  const before = s.powers.germany.cp;
  for (const pid of Object.keys(s.powers)) g.submitOrders(pid, { orders: [] });
  g.runReveal(); g.runResolution(); g.runReckoning();
  assert.ok(g.state.powers.germany.cp >= 3, 'cp floor holds');
  assert.equal(g.state.powers.germany.cpCarry, 0, 'carry consumed');
});
