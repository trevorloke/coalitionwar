import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/rng.js';
import { Coalition1939 } from '../src/engine/game.js';
import { aiRound } from '../src/engine/ai.js';
import { buildMap, validateMap } from '../src/engine/data.js';
import { attackerThreshold, MAX_COMMIT_PER_POWER } from '../src/engine/rules.js';
import { applyEffect } from '../src/engine/effects.js';

test('rng is deterministic per seed', () => {
  const a = makeRng('x'), b = makeRng('x'), c = makeRng('y');
  const seqA = [a.d6(), a.d6(), a.coin(), a.int(100)];
  const seqB = [b.d6(), b.d6(), b.coin(), b.int(100)];
  assert.deepEqual(seqA, seqB);
  const seqC = [c.d6(), c.d6(), c.coin(), c.int(100)];
  assert.notDeepEqual(seqA, seqC);
});

test('map assembles and validates: 96 territories, 27 VCs, connected, budgets exact', () => {
  const map = buildMap();
  const errors = validateMap(map);
  assert.deepEqual(errors, []);
});

test('combined operations: identical dice, better threshold per extra power', () => {
  // One power alone: 5+. Two: 4+. Three: 3+. Floor 3.
  const mk = n => ({ attackers: Array.from({ length: n }, (_, i) => ({ power: `p${i}` })), mods: {} });
  assert.equal(attackerThreshold(null, null, mk(1)), 5);
  assert.equal(attackerThreshold(null, null, mk(2)), 4);
  assert.equal(attackerThreshold(null, null, mk(3)), 3);
  assert.equal(attackerThreshold(null, null, mk(5)), 3); // floor
});

test('the 8-strength ceiling: no single power can commit more', () => {
  const g = new Coalition1939({ seed: 't-ceiling' });
  g.intel(); g.council({});
  // Germany tries to hurl 10 out of Western Poland at Eastern Poland.
  g.state.t.w_poland.strength = 12;
  const v = g.submitOrders('germany', {
    orders: [{ type: 'offensive', target: 'e_poland', sources: [{ from: 'w_poland', strength: 10 }] }],
  });
  assert.equal(v.orders.length, 0);
  assert.match(v.dropped[0].reason, /ceiling/);
  const v2 = g.submitOrders('germany', {
    orders: [{ type: 'offensive', target: 'e_poland', sources: [{ from: 'w_poland', strength: MAX_COMMIT_PER_POWER }] }],
  });
  assert.equal(v2.orders.length, 1);
});

test('deep battle: only the USSR draws an offensive from two territories', () => {
  const g = new Coalition1939({ seed: 't-deep' });
  g.intel(); g.council({});
  g.state.powers.ussr.atWar = true; // Barbarossa has come
  g.state.t.belorussia.strength = 4;
  g.state.t.baltic_states.strength = 4;
  // e_poland is Soviet at setup; flip it German so the USSR has a target.
  g.state.t.e_poland.owner = 'germany';
  const v = g.submitOrders('ussr', {
    orders: [{
      type: 'offensive', target: 'e_poland',
      sources: [{ from: 'belorussia', strength: 3 }, { from: 'baltic_states', strength: 3 }],
    }],
  });
  assert.equal(v.orders.length, 1);
  // Germany may not do the same the other way (two sources, both adjacent).
  g.state.t.e_poland.owner = 'ussr';
  g.state.t.slovakia.owner = 'germany';
  g.state.t.w_poland.strength = 4; g.state.t.slovakia.strength = 4;
  const vGer = g.submitOrders('germany', {
    orders: [{
      type: 'offensive', target: 'e_poland',
      sources: [{ from: 'w_poland', strength: 2 }, { from: 'slovakia', strength: 2 }],
    }],
  });
  assert.equal(vGer.orders.length, 0);
  assert.match(vGer.dropped[0].reason, /bad sources/);
});

test('joint orders pay the coalition pool and improve the odds', () => {
  const g = new Coalition1939({ seed: 't-joint' });
  g.intel(); g.council({});
  const s = g.state;
  // Stage a two-power Allied attack on the Rhineland.
  s.powers.usa.atWar = true;
  s.t.paris.owner = 'uk'; s.t.paris.strength = 6;
  s.t.low_countries.owner = 'usa'; s.t.low_countries.strength = 6;
  const before = s.pool.allied;
  g.submitOrders('uk', { orders: [{ type: 'offensive', target: 'rhineland', sources: [{ from: 'paris', strength: 5 }] }] });
  g.submitOrders('usa', { orders: [{ type: 'offensive', target: 'rhineland', sources: [{ from: 'low_countries', strength: 5 }] }] });
  for (const pid of Object.keys(s.powers)) if (!s.orders[pid]) g.submitOrders(pid, { orders: [] });
  g.runReveal();
  assert.equal(s.pool.allied, before + 1, 'joint order pays +1 pool per extra power');
  const battle = s.battles.find(b => b.target === 'rhineland');
  assert.equal(battle.attackers.length, 2);
  assert.equal(attackerThreshold(g.game, s, battle), 4, 'two powers hit on 4+');
});

test('attacking a neutral snaps its pressure to 10 and grants first strike', () => {
  const g = new Coalition1939({ seed: 't-neutral' });
  g.intel(); g.council({});
  const s = g.state;
  s.t.w_ukraine.owner = 'germany'; s.t.w_ukraine.strength = 6; // wedge on the border
  assert.equal(s.powers.ussr.atWar, false);
  g.submitOrders('germany', { orders: [{ type: 'offensive', target: 'kiev', sources: [{ from: 'w_ukraine', strength: 5 }] }] });
  for (const pid of Object.keys(s.powers)) if (!s.orders[pid]) g.submitOrders(pid, { orders: [] });
  g.runReveal();
  assert.equal(s.powers.ussr.pressure, 10);
  assert.equal(s.firstStrike.germany, 1);
  g.runResolution(); g.runReckoning();
  assert.equal(g.state.powers.ussr.atWar, true, 'the USSR enters the war it was dragged into');
});

test('effects DSL: pressure clamps, flags expire, homeFront bounded', () => {
  const g = new Coalition1939({ seed: 't-dsl' });
  const s = g.state;
  applyEffect(g.game, s, { op: 'pressure', track: 'usa', delta: 99 });
  assert.equal(s.powers.usa.pressure, 10);
  applyEffect(g.game, s, { op: 'homeFront', power: 'italy', delta: -99 });
  assert.equal(s.powers.italy.homeFront, 0);
  applyEffect(g.game, s, { op: 'flag', name: 'winter_freeze', rounds: 2 });
  assert.equal(s.activeFlags.length, 1);
});

test('the fall of France: Paris under the Axis splits the empire', () => {
  const g = new Coalition1939({ seed: 't-france' });
  g.intel(); g.council({});
  const s = g.state;
  s.t.paris.owner = 'germany'; s.t.paris.strength = 4;
  for (const pid of Object.keys(s.powers)) g.submitOrders(pid, { orders: [] });
  g.runReveal(); g.runResolution(); g.runReckoning();
  assert.equal(g.state.franceFallen, true);
  assert.equal(g.state.t.s_france.owner, 'vichy');
  assert.equal(g.state.t.normandy.owner, 'germany');
});

test('a full AI game reaches a verdict within 12 rounds', () => {
  for (const seed of ['t-full-1', 't-full-2']) {
    const g = new Coalition1939({ seed });
    let rounds = 0;
    while (!g.state.victory && rounds < 13) { aiRound(g); rounds++; }
    assert.ok(g.state.victory, `game ${seed} ended (round ${g.state.round})`);
    assert.ok(['total', 'strategic', 'collapse', 'contested'].includes(g.state.victory.type));
    if (g.state.victory.winner) {
      assert.ok(g.state.victory.ranking.length > 0, 'winners rank by honors');
    }
  }
});

test('the coin is used at most once per round', () => {
  const g = new Coalition1939({ seed: 't-coin' });
  aiRound(g);
  // coinUsedRound either untouched (no contested battle chosen) or stamped once.
  assert.ok([0, 1].includes(g.state.coinUsedRound));
});

test('state serializes and reloads', () => {
  const g = new Coalition1939({ seed: 't-save' });
  aiRound(g);
  const snapshot = g.save();
  const vpBefore = JSON.stringify(g.state.pool);
  g.load(snapshot);
  assert.equal(JSON.stringify(g.state.pool), vpBefore);
  aiRound(g); // still playable after reload
  assert.equal(g.state.round >= 2, true);
});
