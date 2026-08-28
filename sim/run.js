// Full-game AI-vs-AI simulation. Proves a 12-round game completes, prints the
// arc of each war, and runs the thesis experiment from GDD §13: a coordinated
// team must beat an uncoordinated one from the same position.
//
//   npm run sim               five quick games + the thesis experiment
//   node sim/run.js game 42   one verbose game with seed 42
//   node sim/run.js thesis 40 thesis experiment over 40 pairs of games

import { Coalition1939 } from '../src/engine/game.js';
import { aiRound } from '../src/engine/ai.js';
import { sideVP } from '../src/engine/reckoning.js';

function playGame(seed, coordination, verbose = false) {
  const g = new Coalition1939({ seed: `sim-${seed}` });
  let rounds = 0;
  while (!g.state.victory && rounds < 14) {
    aiRound(g, { coordination });
    rounds++;
    if (verbose) {
      const s = g.state;
      const vp = { axis: sideVP(g.game, s, 'axis'), allied: sideVP(g.game, s, 'allied') };
      console.log(`\n=== after ${g.calendar().label} (round ${rounds}) — VP axis ${vp.axis} / allied ${vp.allied} ===`);
      for (const line of s.gameLog.slice(-40)) console.log('  ' + line);
    }
  }
  return g;
}

function summarize(g) {
  const v = g.state.victory ?? { type: 'none', winner: null, text: 'war never ended (bug!)' };
  return { type: v.type, winner: v.winner, vp: v.vp ?? null, text: v.text, round: g.state.round };
}

const mode = process.argv[2] ?? 'quick';

if (mode === 'game') {
  const seed = process.argv[3] ?? '1';
  const g = playGame(seed, { axis: true, allied: true }, true);
  const v = summarize(g);
  console.log(`\nRESULT: ${v.text}`);
  if (g.state.victory?.ranking?.length) {
    console.log('Ranking within the winning team (by honors):');
    for (const r of g.state.victory.ranking) console.log(`  ${r.power}: ${r.honors} honors`);
  }
} else if (mode === 'thesis') {
  // The design constraint, run as an experiment: identical seeds, one side
  // loses its ability to coordinate. If coordination doesn't decide these
  // games, the numbers are wrong (GDD §13.4).
  const n = parseInt(process.argv[3] ?? '20', 10);
  let coordWins = 0, uncoordWins = 0, draws = 0;
  for (let i = 0; i < n; i++) {
    // Allied team coordinates, Axis does not…
    const a = summarize(playGame(`th-a-${i}`, { axis: false, allied: true }));
    // …and the mirror: Axis coordinates, Allies do not.
    const b = summarize(playGame(`th-b-${i}`, { axis: true, allied: false }));
    for (const [res, coordSide] of [[a, 'allied'], [b, 'axis']]) {
      if (res.winner === coordSide) coordWins++;
      else if (res.winner === null) draws++;
      else uncoordWins++;
    }
  }
  const total = coordWins + uncoordWins + draws;
  console.log(`\nTHESIS EXPERIMENT over ${total} games:`);
  console.log(`  coordinated side wins:   ${coordWins} (${Math.round(100 * coordWins / total)}%)`);
  console.log(`  uncoordinated side wins: ${uncoordWins}`);
  console.log(`  contested peaces:        ${draws}`);
  if (coordWins <= uncoordWins) {
    console.error('  ✗ THE DESIGN HAS FAILED ITS OWN TEST — the numbers need to move.');
    process.exit(1);
  }
  console.log('  ✓ the side that coordinates beats the side that does not.');
} else {
  for (let i = 1; i <= 5; i++) {
    const g = playGame(i, { axis: true, allied: true });
    const v = summarize(g);
    console.log(`game ${i}: round ${Math.min(v.round, 12)} — ${v.text}`);
  }
}
