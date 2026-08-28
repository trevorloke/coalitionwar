// Validates every piece of generated content against docs/CONTRACT.md:
// map integrity, effect-DSL conformance, id references, deck sizes, doctrine
// pool coverage. Run: npm run validate

import { buildMap, validateMap } from '../src/engine/data.js';
import { POWERS, NATIONS } from '../src/data/powers.js';
import { STRATEGY_CARDS } from '../src/data/generated/cards-strategy.js';
import { OPS_CARDS } from '../src/data/generated/cards-operations.js';
import { DOCTRINES } from '../src/data/generated/doctrines.js';

const DSL_OPS = new Set([
  'pressure', 'pressureLock', 'placeStrength', 'removeStrength', 'homeFront',
  'commandPoints', 'coalitionPool', 'production', 'thresholdMod', 'drawOps',
  'control', 'fort', 'entry', 'corridor', 'flag',
]);
const FLAGS = new Set([
  'convoy_raid_double', 'uboat_surge', 'winter_freeze', 'monsoon', 'partisan_surge',
  'strategic_bombing', 'luftwaffe_grounded', 'war_production', 'first_strike_pacific',
  'no_lend_lease', 'blitz_bonus', 'fortress_europe', 'island_hopping', 'deception',
]);
const OPS_KINDS = new Set([
  'reroll', 'extra_dice', 'ambush', 'entrench_bonus', 'convoy_strike', 'cancel_advance',
  'retreat', 'intel_peek', 'repair', 'naval_reroll', 'threshold', 'exhaust_enemy',
]);
const DOCTRINE_KINDS = new Set([
  'threshold', 'move_discount', 'extra_advance', 'partisans', 'convoy_escort',
  'bombing', 'amphib', 'replacements', 'intel', 'sub_war', 'fortification',
]);
const CORRIDOR_IDS = new Set(['arctic_convoy', 'gib_suez', 'burma_road']);

const errors = [];
const err = m => errors.push(m);

let map;
try {
  map = buildMap();
  for (const e of validateMap(map)) err(`map: ${e}`);
} catch (e) {
  err(`map build failed: ${e.message}`);
}

const powerRef = v => v === 'axis' || v === 'allied' || POWERS[v] || NATIONS[v];
const trackRef = v => v === 'ussr' || v === 'usa' || NATIONS[v];
const terrRef = v => map && (map[v] || ['owned_industrial', 'capital', 'choose'].includes(v));

function checkEffect(id, e) {
  if (!DSL_OPS.has(e.op)) return err(`${id}: unknown op ${e.op}`);
  if (['pressure', 'pressureLock'].includes(e.op) && !trackRef(e.track)) err(`${id}: bad track ${e.track}`);
  if (['placeStrength', 'removeStrength', 'homeFront', 'commandPoints', 'production', 'drawOps'].includes(e.op)
    && !powerRef(e.power)) err(`${id}: bad power ${e.power}`);
  if (e.op === 'placeStrength' && !terrRef(e.where)) err(`${id}: bad where ${e.where}`);
  if (e.op === 'removeStrength' && e.where && !terrRef(e.where)) err(`${id}: bad where ${e.where}`);
  if (['control', 'fort'].includes(e.op) && map && !map[e.territory]) err(`${id}: bad territory ${e.territory}`);
  if (e.op === 'control' && !powerRef(e.power) && !['neutral', 'vichy', 'france'].includes(e.power)) err(`${id}: bad power ${e.power}`);
  if (e.op === 'entry' && !['ussr', 'usa'].includes(e.power)) err(`${id}: entry must target ussr/usa`);
  if (e.op === 'corridor' && !CORRIDOR_IDS.has(e.corridor)) err(`${id}: bad corridor ${e.corridor}`);
  if (e.op === 'flag' && !FLAGS.has(e.name)) err(`${id}: unknown flag ${e.name}`);
  if (e.op === 'thresholdMod' && !['attack', 'defense'].includes(e.role)) err(`${id}: bad role`);
  if (e.op === 'coalitionPool' && !['axis', 'allied'].includes(e.side)) err(`${id}: bad side`);
}

// Strategy deck.
const ids = new Set();
const eras = { early: 0, mid: 0, late: 0 };
for (const c of STRATEGY_CARDS) {
  if (ids.has(c.id)) err(`duplicate card id ${c.id}`);
  ids.add(c.id);
  if (!['early', 'mid', 'late'].includes(c.era)) err(`${c.id}: bad era`);
  else eras[c.era]++;
  if (c.ops < 1 || c.ops > 4) err(`${c.id}: ops ${c.ops}`);
  if (!['axis', 'allied', 'neutral'].includes(c.side)) err(`${c.id}: bad side`);
  for (const e of c.effects) checkEffect(c.id, e);
}
if (STRATEGY_CARDS.length < 100) err(`strategy deck ${STRATEGY_CARDS.length} < 100 cards`);
console.log(`strategy deck: ${STRATEGY_CARDS.length} cards (early ${eras.early} / mid ${eras.mid} / late ${eras.late})`);

// Operations deck.
for (const c of OPS_CARDS) {
  if (ids.has(c.id)) err(`duplicate id ${c.id}`);
  ids.add(c.id);
  if (!OPS_KINDS.has(c.effect.kind)) err(`${c.id}: unknown ops kind ${c.effect.kind}`);
  if (c.cost < 1 || c.cost > 3) err(`${c.id}: bad cost`);
  if (!['resolution', 'orders'].includes(c.timing)) err(`${c.id}: bad timing`);
  if (c.powers !== 'any' && !c.powers.every(p => POWERS[p])) err(`${c.id}: bad powers`);
}
console.log(`operations deck: ${OPS_CARDS.length} cards`);

// Doctrines.
const poolCount = Object.fromEntries(Object.keys(POWERS).map(p => [p, 0]));
for (const d of DOCTRINES) {
  if (ids.has(d.id)) err(`duplicate id ${d.id}`);
  ids.add(d.id);
  if (!DOCTRINE_KINDS.has(d.passive.kind)) err(`${d.id}: unknown passive ${d.passive.kind}`);
  for (const p of d.pool) {
    if (!POWERS[p]) err(`${d.id}: bad pool power ${p}`);
    else poolCount[p]++;
  }
}
for (const [p, n] of Object.entries(poolCount)) {
  if (n < 4) err(`doctrine pool: ${p} eligible for only ${n} doctrines (< 4)`);
}
console.log(`doctrine pool: ${DOCTRINES.length} doctrines`);

if (errors.length) {
  console.error(`\n${errors.length} validation errors:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('\nAll content valid.');
