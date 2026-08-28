// GENERATED CONTENT — produced by the content workflow, validated by sim/validate-data.js.
// Regenerate rather than hand-editing structure; tuning numbers by hand is fine.
export const OPS_CARDS = [
 {
  "id": "op_forced_march",
  "title": "Forced march",
  "cost": 2,
  "timing": "resolution",
  "powers": "any",
  "text": "In one battle you are fighting, roll 3 extra dice. After the battle, your surviving force loses 2 strength to exhaustion.",
  "effect": {
   "kind": "extra_dice",
   "dice": 3,
   "exhaustion": 2
  }
 },
 {
  "id": "op_local_reserves",
  "title": "Local reserves",
  "cost": 1,
  "timing": "resolution",
  "powers": "any",
  "text": "In one battle you are fighting, roll 2 extra dice. After the battle, your surviving force loses 1 strength to exhaustion.",
  "effect": {
   "kind": "extra_dice",
   "dice": 2,
   "exhaustion": 1
  }
 },
 {
  "id": "op_second_effort",
  "title": "Second effort",
  "cost": 1,
  "timing": "resolution",
  "powers": "any",
  "text": "Reroll up to 2 of your dice in one battle you are fighting.",
  "effect": {
   "kind": "reroll",
   "dice": 2
  }
 },
 {
  "id": "op_veteran_cadres",
  "title": "Veteran cadres",
  "cost": 2,
  "timing": "resolution",
  "powers": "any",
  "text": "Reroll up to 3 of your dice in one battle you are fighting.",
  "effect": {
   "kind": "reroll",
   "dice": 3
  }
 },
 {
  "id": "op_dig_in",
  "title": "Dig in",
  "cost": 1,
  "timing": "resolution",
  "powers": "any",
  "text": "In one battle where you defend, the attacker's hit threshold worsens by 1 (a 5+ becomes 6), as if you were entrenched.",
  "effect": {
   "kind": "entrench_bonus",
   "delta": 1
  }
 },
 {
  "id": "op_hedgehog_defence",
  "title": "Hedgehog defence",
  "cost": 2,
  "timing": "resolution",
  "powers": "any",
  "text": "In one battle where you defend, the attacker's hit threshold worsens by 2, as if you were doubly entrenched.",
  "effect": {
   "kind": "entrench_bonus",
   "delta": 2
  }
 },
 {
  "id": "op_night_ambush",
  "title": "Night ambush",
  "cost": 1,
  "timing": "orders",
  "powers": "any",
  "text": "Play during orders, on a territory you hold. If it is attacked this round, the attacker's hit threshold worsens by 1.",
  "effect": {
   "kind": "ambush",
   "delta": 1
  }
 },
 {
  "id": "op_killing_ground",
  "title": "Killing ground",
  "cost": 2,
  "timing": "orders",
  "powers": "any",
  "text": "Play during orders, on a territory you hold. If it is attacked this round, the attacker's hit threshold worsens by 2.",
  "effect": {
   "kind": "ambush",
   "delta": 2
  }
 },
 {
  "id": "op_fighting_withdrawal",
  "title": "Fighting withdrawal",
  "cost": 1,
  "timing": "resolution",
  "powers": "any",
  "text": "Before any dice are rolled in one battle where you defend, withdraw your force to an adjacent friendly territory; the attacker takes the vacated territory unfought.",
  "effect": {
   "kind": "retreat"
  }
 },
 {
  "id": "op_break_contact",
  "title": "Break contact",
  "cost": 1,
  "timing": "resolution",
  "powers": "any",
  "text": "After one battle resolves this round, cancel the victor's free advance; their force stays in the territory where it fought.",
  "effect": {
   "kind": "cancel_advance"
  }
 },
 {
  "id": "op_signals_intercept",
  "title": "Signals intercept",
  "cost": 1,
  "timing": "orders",
  "powers": "any",
  "text": "Play during orders, before the reveal: read one line of one opponent's written orders.",
  "effect": {
   "kind": "intel_peek"
  }
 },
 {
  "id": "op_field_repairs",
  "title": "Field repairs",
  "cost": 1,
  "timing": "orders",
  "powers": "any",
  "text": "Play during orders: one of your forces in a supplied territory recovers 1 strength.",
  "effect": {
   "kind": "repair",
   "strength": 1
  }
 },
 {
  "id": "op_emergency_replacements",
  "title": "Emergency replacements",
  "cost": 3,
  "timing": "orders",
  "powers": "any",
  "text": "Play during orders: one of your forces in a supplied territory recovers 3 strength.",
  "effect": {
   "kind": "repair",
   "strength": 3
  }
 },
 {
  "id": "op_concentrated_barrage",
  "title": "Concentrated barrage",
  "cost": 2,
  "timing": "resolution",
  "powers": "any",
  "text": "In one battle where you attack, your hit threshold improves by 1 (a 5+ becomes 4+).",
  "effect": {
   "kind": "threshold",
   "role": "attack",
   "delta": -1
  }
 },
 {
  "id": "op_stubborn_defence",
  "title": "Stubborn defence",
  "cost": 2,
  "timing": "resolution",
  "powers": "any",
  "text": "In one battle where you defend, your hit threshold improves by 1 (a 5+ becomes 4+).",
  "effect": {
   "kind": "threshold",
   "role": "defense",
   "delta": -1
  }
 },
 {
  "id": "op_wolf_pack",
  "title": "Wolf pack",
  "cost": 2,
  "timing": "resolution",
  "powers": [
   "germany"
  ],
  "text": "Reroll up to 3 of your dice in one sea-zone battle.",
  "effect": {
   "kind": "naval_reroll",
   "dice": 3
  }
 },
 {
  "id": "op_schwerpunkt",
  "title": "Schwerpunkt",
  "cost": 1,
  "timing": "resolution",
  "powers": [
   "germany"
  ],
  "text": "In one battle where you attack, your hit threshold improves by 1 (a 5+ becomes 4+).",
  "effect": {
   "kind": "threshold",
   "role": "attack",
   "delta": -1
  }
 },
 {
  "id": "op_banzai_charge",
  "title": "Banzai charge",
  "cost": 1,
  "timing": "resolution",
  "powers": [
   "japan"
  ],
  "text": "In one battle you are fighting, roll 3 extra dice. After the battle, your surviving force loses 3 strength to exhaustion.",
  "effect": {
   "kind": "extra_dice",
   "dice": 3,
   "exhaustion": 3
  }
 },
 {
  "id": "op_long_lance",
  "title": "Long Lance torpedoes",
  "cost": 1,
  "timing": "resolution",
  "powers": [
   "japan"
  ],
  "text": "Reroll up to 2 of your dice in one sea-zone battle.",
  "effect": {
   "kind": "naval_reroll",
   "dice": 2
  }
 },
 {
  "id": "op_sappers",
  "title": "Sappers",
  "cost": 1,
  "timing": "resolution",
  "powers": [
   "ussr"
  ],
  "text": "In one battle where you defend, the attacker's hit threshold worsens by 2, as if you were entrenched behind prepared works.",
  "effect": {
   "kind": "entrench_bonus",
   "delta": 2
  }
 },
 {
  "id": "op_siberian_reserves",
  "title": "Siberian reserves",
  "cost": 1,
  "timing": "orders",
  "powers": [
   "ussr"
  ],
  "text": "Play during orders: one of your forces in a supplied territory recovers 2 strength.",
  "effect": {
   "kind": "repair",
   "strength": 2
  }
 },
 {
  "id": "op_desert_raiders",
  "title": "Desert raiders",
  "cost": 2,
  "timing": "orders",
  "powers": [
   "uk"
  ],
  "text": "Play during orders: one enemy force loses 2 strength before any battle it fights this round.",
  "effect": {
   "kind": "exhaust_enemy",
   "strength": 2
  }
 },
 {
  "id": "op_royal_navy_sweep",
  "title": "Royal Navy sweep",
  "cost": 2,
  "timing": "resolution",
  "powers": [
   "uk"
  ],
  "text": "Reroll up to 3 of your dice in one sea-zone battle.",
  "effect": {
   "kind": "naval_reroll",
   "dice": 3
  }
 },
 {
  "id": "op_seabees",
  "title": "Seabees",
  "cost": 1,
  "timing": "orders",
  "powers": [
   "usa"
  ],
  "text": "Play during orders: one of your forces in a supplied territory recovers 2 strength.",
  "effect": {
   "kind": "repair",
   "strength": 2
  }
 },
 {
  "id": "op_magic_decrypts",
  "title": "Magic decrypts",
  "cost": 1,
  "timing": "orders",
  "powers": [
   "usa"
  ],
  "text": "Play during orders, before the reveal: read one line of one opponent's written orders.",
  "effect": {
   "kind": "intel_peek"
  }
 },
 {
  "id": "op_decima_mas",
  "title": "Decima MAS",
  "cost": 1,
  "timing": "orders",
  "powers": [
   "italy"
  ],
  "text": "Play during orders: one enemy force loses 1 strength before any battle it fights this round.",
  "effect": {
   "kind": "exhaust_enemy",
   "strength": 1
  }
 },
 {
  "id": "op_mountain_ambush",
  "title": "Mountain ambush",
  "cost": 1,
  "timing": "orders",
  "powers": [
   "china"
  ],
  "text": "Play during orders, on a territory you hold. If it is attacked this round, the attacker's hit threshold worsens by 2.",
  "effect": {
   "kind": "ambush",
   "delta": 2
  }
 },
 {
  "id": "op_commerce_raiders",
  "title": "Commerce raiders",
  "cost": 2,
  "timing": "resolution",
  "powers": [
   "germany",
   "italy",
   "japan"
  ],
  "text": "Cancel one enemy lend-lease or convoy order as it resolves in a sea zone.",
  "effect": {
   "kind": "convoy_strike"
  }
 }
];
