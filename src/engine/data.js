// Assembles the final map from the skeleton + generated content and validates
// the whole board. The merged territory list is the single map object the
// engine and UI consume.

import { SKELETON, CROSS_EDGES, CORRIDORS, THEATRES, SETUP_BUDGETS } from '../data/skeleton.js';
import { POWERS, NATIONS } from '../data/powers.js';
import { GEN_TERRITORIES } from '../data/generated/territories.js';

export { CORRIDORS, THEATRES, POWERS, NATIONS };

export const TERRAIN_DEFENSE = new Set(['mountain', 'urban', 'jungle', 'island']);

export function buildMap() {
  const map = {};
  for (const sk of SKELETON) {
    const gen = GEN_TERRITORIES[sk.id];
    if (!gen) throw new Error(`missing generated data for territory ${sk.id}`);
    map[sk.id] = {
      ...sk,
      terrain: gen.terrain,
      supply: gen.supply,
      adjacent: new Set(gen.adjacent),
      coords: gen.coords,
      setup: { ...gen.setup },
    };
  }
  // Merge fixed cross-theatre edges, then symmetrize everything.
  for (const [a, b] of CROSS_EDGES) {
    if (!map[a] || !map[b]) throw new Error(`cross edge references unknown territory ${a}-${b}`);
    map[a].adjacent.add(b);
    map[b].adjacent.add(a);
  }
  for (const t of Object.values(map)) {
    for (const n of t.adjacent) {
      if (!map[n]) throw new Error(`${t.id} adjacent to unknown ${n}`);
      map[n].adjacent.add(t.id);
    }
  }
  for (const t of Object.values(map)) t.adjacent = [...t.adjacent].sort();
  return map;
}

export function validateMap(map) {
  const errors = [];
  const ids = Object.keys(map);
  if (ids.length !== 96) errors.push(`territory count ${ids.length} != 96`);
  let vcs = 0;
  for (const t of Object.values(map)) {
    if (t.victoryCity) vcs++;
    if (t.type === 'sea' && t.terrain !== 'sea') errors.push(`${t.id}: sea zone with terrain ${t.terrain}`);
    if (t.type === 'land' && t.terrain === 'sea') errors.push(`${t.id}: land with sea terrain`);
    if (t.type === 'sea' && t.supply !== 0) errors.push(`${t.id}: sea zone with supply ${t.supply}`);
    if (t.adjacent.length === 0) errors.push(`${t.id}: isolated`);
    const box = THEATRES[t.theatre].box;
    if (t.coords.x < box.x[0] || t.coords.x > box.x[1] || t.coords.y < box.y[0] || t.coords.y > box.y[1]) {
      errors.push(`${t.id}: coords ${t.coords.x},${t.coords.y} outside ${t.theatre} box`);
    }
    const owner = t.setup.owner;
    const valid = owner === 'none' || owner === 'neutral' || owner === 'france'
      || POWERS[owner] || NATIONS[owner];
    if (!valid) errors.push(`${t.id}: unknown setup owner ${owner}`);
    if (t.type === 'sea' && owner === 'neutral') errors.push(`${t.id}: sea zone owned by neutral`);
  }
  if (vcs !== 27) errors.push(`victory city count ${vcs} != 27`);
  // Connectivity of the whole graph.
  const seen = new Set([ids[0]]);
  const stack = [ids[0]];
  while (stack.length) {
    for (const n of map[stack.pop()].adjacent) {
      if (!seen.has(n)) { seen.add(n); stack.push(n); }
    }
  }
  if (seen.size !== ids.length) {
    errors.push(`graph not connected: ${ids.filter(i => !seen.has(i)).join(', ')} unreachable`);
  }
  // Setup budgets.
  for (const [theatre, budgets] of Object.entries(SETUP_BUDGETS)) {
    const totals = {};
    for (const t of Object.values(map)) {
      if (t.theatre !== theatre || t.setup.owner === 'none') continue;
      totals[t.setup.owner] = (totals[t.setup.owner] || 0) + t.setup.strength;
    }
    for (const [owner, want] of Object.entries(budgets)) {
      const got = totals[owner] || 0;
      if (got !== want) errors.push(`${theatre}: ${owner} setup strength ${got} != budget ${want}`);
    }
  }
  return errors;
}
