// GENERATED CONTENT — produced by the content workflow, validated by sim/validate-data.js.
// Regenerate rather than hand-editing structure; tuning numbers by hand is fine.
export const STRATEGY_CARDS = [
 {
  "id": "early_molotov_ribbentrop",
  "title": "Molotov-Ribbentrop Pact",
  "ops": 3,
  "side": "axis",
  "text": "The USSR Pressure track is locked for 4 rounds: no Pressure changes apply to it. When the lock expires, USSR Pressure +2.",
  "effects": [
   {
    "op": "pressureLock",
    "track": "ussr",
    "rounds": 4,
    "releaseDelta": 2
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_sickle_cut",
  "title": "Sickle Cut",
  "ops": 4,
  "side": "axis",
  "text": "This round, German offensives in Western Europe & the Atlantic Wall hit at -1 threshold (better), and Germany's free advance may move 2 territories.",
  "effects": [
   {
    "op": "thresholdMod",
    "power": "germany",
    "theatre": "west",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   },
   {
    "op": "flag",
    "name": "blitz_bonus",
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_dunkirk",
  "title": "Operation Dynamo",
  "ops": 3,
  "side": "allied",
  "text": "Remove 2 UK strength from one territory of the UK player's choice and place 2 UK strength in Britain. UK Home Front +1.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "uk",
    "where": "choose",
    "amount": 2
   },
   {
    "op": "placeStrength",
    "power": "uk",
    "where": "britain",
    "amount": 2
   },
   {
    "op": "homeFront",
    "power": "uk",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_battle_of_britain",
  "title": "Battle of Britain",
  "ops": 4,
  "side": "allied",
  "text": "This round, Germany loses terrain and entrench bonuses when attacking. UK Home Front +1.",
  "effects": [
   {
    "op": "flag",
    "name": "luftwaffe_grounded",
    "rounds": 1
   },
   {
    "op": "homeFront",
    "power": "uk",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_the_blitz",
  "title": "The Blitz",
  "ops": 3,
  "side": "axis",
  "text": "This round, bombing raids reduce target production by 2 instead of 1. UK Home Front -1.",
  "effects": [
   {
    "op": "flag",
    "name": "strategic_bombing",
    "rounds": 1
   },
   {
    "op": "homeFront",
    "power": "uk",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_weserubung",
  "title": "Weserübung",
  "ops": 3,
  "side": "axis",
  "text": "Germany takes control of Norway and Denmark and places 1 strength in Norway.",
  "effects": [
   {
    "op": "control",
    "territory": "norway",
    "power": "germany"
   },
   {
    "op": "control",
    "territory": "denmark",
    "power": "germany"
   },
   {
    "op": "placeStrength",
    "power": "germany",
    "where": "norway",
    "amount": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_parallel_war",
  "title": "The Parallel War",
  "ops": 3,
  "side": "axis",
  "text": "Italy gains +2 Command Points this round and places 1 strength in Northern Italy.",
  "effects": [
   {
    "op": "commandPoints",
    "power": "italy",
    "delta": 2
   },
   {
    "op": "placeStrength",
    "power": "italy",
    "where": "n_italy",
    "amount": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_tripartite_pact",
  "title": "Tripartite Pact",
  "ops": 3,
  "side": "axis",
  "text": "Axis Coalition pool +2. Every at-war Axis power's Home Front +1.",
  "effects": [
   {
    "op": "coalitionPool",
    "side": "axis",
    "delta": 2
   },
   {
    "op": "homeFront",
    "power": "axis",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_destroyers_for_bases",
  "title": "Destroyers for Bases",
  "ops": 2,
  "side": "allied",
  "text": "USA Pressure +1; Allied Coalition pool +1.",
  "effects": [
   {
    "op": "pressure",
    "track": "usa",
    "delta": 1
   },
   {
    "op": "coalitionPool",
    "side": "allied",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_vienna_award",
  "title": "First Vienna Award",
  "ops": 2,
  "side": "axis",
  "text": "Hungary Pressure -2; Slovakia Pressure +1.",
  "effects": [
   {
    "op": "pressure",
    "track": "hungary",
    "delta": -2
   },
   {
    "op": "pressure",
    "track": "slovakia",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_happy_time",
  "title": "The Happy Time",
  "ops": 3,
  "side": "axis",
  "text": "Germany gets +2 dice in each Atlantic sea-zone battle this round and next round. Axis naval ops in the Atlantic score double hits against convoys this round.",
  "effects": [
   {
    "op": "flag",
    "name": "uboat_surge",
    "rounds": 2
   },
   {
    "op": "flag",
    "name": "convoy_raid_double",
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "early"
 },
 {
  "id": "early_maginot_line",
  "title": "Maginot Mentality",
  "ops": 2,
  "side": "allied",
  "text": "Add 1 fort level to Paris. The UK seat loses 1 Command Point this round.",
  "effects": [
   {
    "op": "fort",
    "territory": "paris",
    "delta": 1
   },
   {
    "op": "commandPoints",
    "power": "uk",
    "delta": -1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_katyn",
  "title": "Katyn Forest",
  "ops": 2,
  "side": "axis",
  "text": "USSR Home Front -1; USSR Pressure -1.",
  "effects": [
   {
    "op": "homeFront",
    "power": "ussr",
    "delta": -1
   },
   {
    "op": "pressure",
    "track": "ussr",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_churchill",
  "title": "Churchill Takes Office",
  "ops": 3,
  "side": "allied",
  "text": "UK Home Front +2. UK gains +1 Command Point this round and draws 1 Operations card.",
  "effects": [
   {
    "op": "homeFront",
    "power": "uk",
    "delta": 2
   },
   {
    "op": "commandPoints",
    "power": "uk",
    "delta": 1
   },
   {
    "op": "drawOps",
    "power": "uk",
    "n": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_taranto",
  "title": "Taranto Raid",
  "ops": 3,
  "side": "allied",
  "text": "Remove 2 Italian strength from one territory of the firing player's choice. Italy Home Front -1.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "italy",
    "where": "choose",
    "amount": 2
   },
   {
    "op": "homeFront",
    "power": "italy",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_compass",
  "title": "Operation Compass",
  "ops": 3,
  "side": "allied",
  "text": "Remove 2 Italian strength from Cyrenaica. This round, UK offensives in the Mediterranean & North Africa hit at -1 threshold (better).",
  "effects": [
   {
    "op": "removeStrength",
    "power": "italy",
    "where": "cyrenaica",
    "amount": 2
   },
   {
    "op": "thresholdMod",
    "power": "uk",
    "theatre": "med",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_oxi_day",
  "title": "Oxi Day",
  "ops": 2,
  "side": "allied",
  "text": "Add 1 fort level to Greece. Italy Home Front -1.",
  "effects": [
   {
    "op": "fort",
    "territory": "greece",
    "delta": 1
   },
   {
    "op": "homeFront",
    "power": "italy",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_cash_and_carry",
  "title": "Cash and Carry",
  "ops": 2,
  "side": "allied",
  "text": "USA Pressure +1; UK production +1 for 2 rounds.",
  "effects": [
   {
    "op": "pressure",
    "track": "usa",
    "delta": 1
   },
   {
    "op": "production",
    "power": "uk",
    "delta": 1,
    "rounds": 2
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_america_first",
  "title": "America First Committee",
  "ops": 2,
  "side": "neutral",
  "text": "USA Pressure -2.",
  "effects": [
   {
    "op": "pressure",
    "track": "usa",
    "delta": -2
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_soviet_japanese_truce",
  "title": "Truce on the Khalkha",
  "ops": 2,
  "side": "neutral",
  "text": "USSR Pressure -1. The USSR places 1 strength in Siberia.",
  "effects": [
   {
    "op": "pressure",
    "track": "ussr",
    "delta": -1
   },
   {
    "op": "placeStrength",
    "power": "ussr",
    "where": "siberia",
    "amount": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_winter_war",
  "title": "The Winter War",
  "ops": 3,
  "side": "neutral",
  "text": "Remove 2 USSR strength from one territory of the USSR player's choice. Finland Pressure -2; USSR Home Front -1.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "ussr",
    "where": "choose",
    "amount": 2
   },
   {
    "op": "pressure",
    "track": "finland",
    "delta": -2
   },
   {
    "op": "homeFront",
    "power": "ussr",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_changsha",
  "title": "Chiang Holds at Changsha",
  "ops": 2,
  "side": "allied",
  "text": "China Home Front +1. China partisan attrition doubles this round.",
  "effects": [
   {
    "op": "homeFront",
    "power": "china",
    "delta": 1
   },
   {
    "op": "flag",
    "name": "partisan_surge",
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_wang_jingwei",
  "title": "Wang Jingwei Regime",
  "ops": 2,
  "side": "axis",
  "text": "China Home Front -1. Japan places 1 strength in Shanghai.",
  "effects": [
   {
    "op": "homeFront",
    "power": "china",
    "delta": -1
   },
   {
    "op": "placeStrength",
    "power": "japan",
    "where": "shanghai",
    "amount": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_river_plate",
  "title": "Battle of the River Plate",
  "ops": 2,
  "side": "allied",
  "text": "Remove 1 German strength from one territory of the firing player's choice. UK Home Front +1.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "germany",
    "where": "choose",
    "amount": 1
   },
   {
    "op": "homeFront",
    "power": "uk",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_shadow_factories",
  "title": "Shadow Factories",
  "ops": 3,
  "side": "allied",
  "text": "UK builds cost 1 less production each (minimum 1) this round and next round.",
  "effects": [
   {
    "op": "flag",
    "name": "war_production",
    "rounds": 2,
    "power": "uk"
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "early"
 },
 {
  "id": "early_convoy_escorts",
  "title": "Convoy Escort Groups",
  "ops": 2,
  "side": "allied",
  "text": "This round, UK defenders in the Atlantic & home waters get a +1 threshold shift (as for terrain).",
  "effects": [
   {
    "op": "thresholdMod",
    "power": "uk",
    "theatre": "atlantic",
    "role": "defense",
    "delta": 1,
    "rounds": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_condor_patrols",
  "title": "Condor Patrols",
  "ops": 2,
  "side": "axis",
  "text": "Axis naval ops in the Atlantic score double hits against convoys this round.",
  "effects": [
   {
    "op": "flag",
    "name": "convoy_raid_double",
    "rounds": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_westwall",
  "title": "The Westwall",
  "ops": 2,
  "side": "axis",
  "text": "Add 1 fort level to the Rhineland.",
  "effects": [
   {
    "op": "fort",
    "territory": "rhineland",
    "delta": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_funkspiel",
  "title": "Funkspiel",
  "ops": 1,
  "side": "axis",
  "text": "Germany's written orders are hidden from Ultra this round.",
  "effects": [
   {
    "op": "flag",
    "name": "deception",
    "rounds": 1,
    "power": "germany"
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_phoney_war",
  "title": "The Phoney War",
  "ops": 1,
  "side": "neutral",
  "text": "Germany and the UK each lose 1 Command Point this round.",
  "effects": [
   {
    "op": "commandPoints",
    "power": "germany",
    "delta": -1
   },
   {
    "op": "commandPoints",
    "power": "uk",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_swedish_iron_ore",
  "title": "Swedish Iron Ore",
  "ops": 2,
  "side": "neutral",
  "text": "Germany production +1 for 2 rounds.",
  "effects": [
   {
    "op": "production",
    "power": "germany",
    "delta": 1,
    "rounds": 2
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_hendaye",
  "title": "Franco Demurs at Hendaye",
  "ops": 2,
  "side": "neutral",
  "text": "Add 1 fort level to Gibraltar.",
  "effects": [
   {
    "op": "fort",
    "territory": "gibraltar",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_monsoon",
  "title": "Monsoon Season",
  "ops": 1,
  "side": "neutral",
  "text": "In Southeast Asia and China & Manchuria, all offensives cost +1 Command Point this round.",
  "effects": [
   {
    "op": "flag",
    "name": "monsoon",
    "rounds": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "early_bessarabia",
  "title": "Bessarabia Ultimatum",
  "ops": 2,
  "side": "neutral",
  "text": "Romania Pressure -2; USSR Pressure +1.",
  "effects": [
   {
    "op": "pressure",
    "track": "romania",
    "delta": -2
   },
   {
    "op": "pressure",
    "track": "ussr",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "early"
 },
 {
  "id": "mid_barbarossa",
  "title": "Operation Barbarossa",
  "ops": 4,
  "side": "axis",
  "text": "Germany invades the Soviet Union: the USSR enters the war at once (Pressure to 10). German attacks in the Eastern Front hit one better this round, and Germany's free advance may move 2 territories.",
  "effects": [
   {
    "op": "entry",
    "power": "ussr"
   },
   {
    "op": "thresholdMod",
    "power": "germany",
    "theatre": "eastern",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   },
   {
    "op": "flag",
    "name": "blitz_bonus",
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_pearl_harbor",
  "title": "Pearl Harbor",
  "ops": 4,
  "side": "axis",
  "text": "Japan strikes the Pacific Fleet at anchor: remove 2 US strength in Hawaii, and Japan applies hits before defenders roll in all naval battles this round. The United States enters the war at once (Pressure to 10).",
  "effects": [
   {
    "op": "removeStrength",
    "power": "usa",
    "where": "hawaii",
    "amount": 2
   },
   {
    "op": "flag",
    "name": "first_strike_pacific",
    "rounds": 1
   },
   {
    "op": "entry",
    "power": "usa"
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_lend_lease",
  "title": "Lend-Lease Act",
  "ops": 3,
  "side": "allied",
  "text": "The arsenal of democracy opens its depots: US production +1 for 3 rounds, US Pressure +2, and the Allied coalition pool gains 1.",
  "effects": [
   {
    "op": "production",
    "power": "usa",
    "delta": 1,
    "rounds": 3
   },
   {
    "op": "pressure",
    "track": "usa",
    "delta": 2
   },
   {
    "op": "coalitionPool",
    "side": "allied",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "mid"
 },
 {
  "id": "mid_siege_of_leningrad",
  "title": "Siege of Leningrad",
  "ops": 3,
  "side": "axis",
  "text": "The city is cut off and starved through the winter: remove 2 Soviet strength in Leningrad and Soviet Home Front −1.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "ussr",
    "where": "leningrad",
    "amount": 2
   },
   {
    "op": "homeFront",
    "power": "ussr",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_moscow_counterblow",
  "title": "Winter Counterblow at Moscow",
  "ops": 4,
  "side": "allied",
  "text": "Zhukov counterattacks before Moscow in deep snow: winter freeze grips the Eastern Front this round, place 2 Soviet strength in Moscow, and Soviet attacks in the Eastern Front hit one better.",
  "effects": [
   {
    "op": "flag",
    "name": "winter_freeze",
    "rounds": 1
   },
   {
    "op": "placeStrength",
    "power": "ussr",
    "where": "moscow",
    "amount": 2
   },
   {
    "op": "thresholdMod",
    "power": "ussr",
    "theatre": "eastern",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_operation_uranus",
  "title": "Operation Uranus",
  "ops": 4,
  "side": "allied",
  "text": "Pincers close behind Sixth Army at Stalingrad: remove 3 German strength in Stalingrad, place 2 Soviet strength there, Romanian Pressure +2, and German Home Front −1.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "germany",
    "where": "stalingrad",
    "amount": 3
   },
   {
    "op": "placeStrength",
    "power": "ussr",
    "where": "stalingrad",
    "amount": 2
   },
   {
    "op": "pressure",
    "track": "romania",
    "delta": 2
   },
   {
    "op": "homeFront",
    "power": "germany",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_case_blue",
  "title": "Case Blue",
  "ops": 4,
  "side": "axis",
  "text": "The summer offensive drives for the Volga and the Caucasus oil: Germany gains 2 command points this round and German attacks in the Eastern Front hit one better.",
  "effects": [
   {
    "op": "commandPoints",
    "power": "germany",
    "delta": 2
   },
   {
    "op": "thresholdMod",
    "power": "germany",
    "theatre": "eastern",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_convoy_pq17",
  "title": "Convoy PQ-17 Scatters",
  "ops": 3,
  "side": "axis",
  "text": "'Convoy is to scatter': the Arctic convoy corridor is closed this round, and Axis naval operations in the Atlantic score double hits against convoys.",
  "effects": [
   {
    "op": "corridor",
    "corridor": "arctic_convoy",
    "state": "closed",
    "rounds": 1
   },
   {
    "op": "flag",
    "name": "convoy_raid_double",
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_operation_torch",
  "title": "Operation Torch",
  "ops": 4,
  "side": "allied",
  "text": "Anglo-American landings in French North Africa: the USA takes control of French North Africa, placing 2 US strength and 1 British strength there.",
  "effects": [
   {
    "op": "control",
    "territory": "fr_n_africa",
    "power": "usa"
   },
   {
    "op": "placeStrength",
    "power": "usa",
    "where": "fr_n_africa",
    "amount": 2
   },
   {
    "op": "placeStrength",
    "power": "uk",
    "where": "fr_n_africa",
    "amount": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_el_alamein",
  "title": "El Alamein",
  "ops": 3,
  "side": "allied",
  "text": "Montgomery attacks at the Alamein line: place 2 British strength in Egypt, British attacks in the Mediterranean hit one better this round, and Italy removes 1 strength of its choice.",
  "effects": [
   {
    "op": "placeStrength",
    "power": "uk",
    "where": "egypt",
    "amount": 2
   },
   {
    "op": "thresholdMod",
    "power": "uk",
    "theatre": "med",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   },
   {
    "op": "removeStrength",
    "power": "italy",
    "where": "choose",
    "amount": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_midway",
  "title": "Miracle at Midway",
  "ops": 4,
  "side": "allied",
  "text": "Four carriers burn in five minutes: Japan removes 3 strength of its choice, US attacks in the Pacific hit one better this round, and Japanese Home Front −1.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "japan",
    "where": "choose",
    "amount": 3
   },
   {
    "op": "thresholdMod",
    "power": "usa",
    "theatre": "pacific",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   },
   {
    "op": "homeFront",
    "power": "japan",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_guadalcanal",
  "title": "Guadalcanal",
  "ops": 3,
  "side": "allied",
  "text": "The Marines seize the unfinished airfield: the USA takes control of the Solomon Islands and places 2 strength there, and US amphibious offensives in the Pacific cost 2 CP this round.",
  "effects": [
   {
    "op": "control",
    "territory": "solomons",
    "power": "usa"
   },
   {
    "op": "placeStrength",
    "power": "usa",
    "where": "solomons",
    "amount": 2
   },
   {
    "op": "flag",
    "name": "island_hopping",
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_fall_of_singapore",
  "title": "Fall of Singapore",
  "ops": 3,
  "side": "axis",
  "text": "The fortress guns face the sea: remove 2 British strength in Malaya, Japanese attacks in Southeast Asia hit one better this round, and British Home Front −1.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "uk",
    "where": "malaya",
    "amount": 2
   },
   {
    "op": "thresholdMod",
    "power": "japan",
    "theatre": "seasia",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   },
   {
    "op": "homeFront",
    "power": "uk",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_burma_road_cut",
  "title": "Burma Road Cut",
  "ops": 2,
  "side": "axis",
  "text": "Japanese columns take Lashio and sever China's lifeline: the Burma Road corridor is closed for 2 rounds and Chinese Home Front −1.",
  "effects": [
   {
    "op": "corridor",
    "corridor": "burma_road",
    "state": "closed",
    "rounds": 2
   },
   {
    "op": "homeFront",
    "power": "china",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "mid"
 },
 {
  "id": "mid_over_the_hump",
  "title": "Over the Hump",
  "ops": 2,
  "side": "allied",
  "text": "Transports climb the Himalayas while engineers cut the Ledo Road to reopen the way into China: Chinese Home Front +1, place 1 Chinese strength in Yunnan, and the Allied coalition pool gains 1.",
  "effects": [
   {
    "op": "homeFront",
    "power": "china",
    "delta": 1
   },
   {
    "op": "placeStrength",
    "power": "china",
    "where": "yunnan",
    "amount": 1
   },
   {
    "op": "coalitionPool",
    "side": "allied",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_doolittle_raid",
  "title": "Doolittle Raid",
  "ops": 2,
  "side": "allied",
  "text": "Sixteen Mitchells lift off a carrier deck for Tokyo: US Home Front +1 and Japanese Home Front −1.",
  "effects": [
   {
    "op": "homeFront",
    "power": "usa",
    "delta": 1
   },
   {
    "op": "homeFront",
    "power": "japan",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_tojo_consolidates",
  "title": "Tojo Consolidates",
  "ops": 2,
  "side": "axis",
  "text": "The war cabinet tightens its grip on the ministries and the press: Japanese Home Front +2 and Japan gains 1 command point this round.",
  "effects": [
   {
    "op": "homeFront",
    "power": "japan",
    "delta": 2
   },
   {
    "op": "commandPoints",
    "power": "japan",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_speer_armaments",
  "title": "Speer Takes Armaments",
  "ops": 3,
  "side": "axis",
  "text": "The ministries are rationalized and the factories rationed by output: for 2 rounds German builds cost 1 less production each and German production +1.",
  "effects": [
   {
    "op": "flag",
    "name": "war_production",
    "rounds": 2,
    "power": "germany"
   },
   {
    "op": "production",
    "power": "germany",
    "delta": 1,
    "rounds": 2
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "mid"
 },
 {
  "id": "mid_shark_broken",
  "title": "Shark Cipher Broken",
  "ops": 3,
  "side": "allied",
  "text": "Bletchley reads the U-boat traffic again: British defense in the Atlantic improves by one this round, Germany removes 1 strength of its choice, and Britain draws 1 operations card.",
  "effects": [
   {
    "op": "thresholdMod",
    "power": "uk",
    "theatre": "atlantic",
    "role": "defense",
    "delta": 1,
    "rounds": 1
   },
   {
    "op": "removeStrength",
    "power": "germany",
    "where": "choose",
    "amount": 1
   },
   {
    "op": "drawOps",
    "power": "uk",
    "n": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_occupation_terror",
  "title": "Terror in the Occupied East",
  "ops": 2,
  "side": "neutral",
  "text": "Word of the regime's crimes in the occupied territories spreads across every border: German Home Front −1, and the Allied coalition pool gains 1 as resistance hardens.",
  "effects": [
   {
    "op": "homeFront",
    "power": "germany",
    "delta": -1
   },
   {
    "op": "coalitionPool",
    "side": "allied",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_balkan_partisans",
  "title": "Partisans in the Balkans",
  "ops": 3,
  "side": "allied",
  "text": "Ambush and sabotage in the mountains: Germany and Italy each remove 1 strength of their choice, and Axis attacks in the Balkans hit one worse this round.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "germany",
    "where": "choose",
    "amount": 1
   },
   {
    "op": "removeStrength",
    "power": "italy",
    "where": "choose",
    "amount": 1
   },
   {
    "op": "thresholdMod",
    "power": "axis",
    "theatre": "balkans",
    "role": "attack",
    "delta": 1,
    "rounds": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_chindits",
  "title": "The Chindits",
  "ops": 2,
  "side": "allied",
  "text": "Long-range columns slip behind Japanese lines in Burma: remove 1 Japanese strength in Burma and Japanese defense in Southeast Asia is one worse this round.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "japan",
    "where": "burma",
    "amount": 1
   },
   {
    "op": "thresholdMod",
    "power": "japan",
    "theatre": "seasia",
    "role": "defense",
    "delta": -1,
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_ichigo_groundwork",
  "title": "Ichi-Go Groundwork",
  "ops": 3,
  "side": "axis",
  "text": "Japan masses rail, fuel, and divisions for a great blow through China: place 2 Japanese strength in Shanghai and Japanese attacks in China & Manchuria hit one better this round.",
  "effects": [
   {
    "op": "placeStrength",
    "power": "japan",
    "where": "shanghai",
    "amount": 2
   },
   {
    "op": "thresholdMod",
    "power": "japan",
    "theatre": "china_manchuria",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_kursk_preparations",
  "title": "Preparations at Kursk",
  "ops": 3,
  "side": "allied",
  "text": "Defensive belts, minefields, and guns laid grid by grid: add 1 fort in Orel, Soviet defense in the Eastern Front improves by one this round, and the USSR draws 1 operations card.",
  "effects": [
   {
    "op": "fort",
    "territory": "orel",
    "delta": 1
   },
   {
    "op": "thresholdMod",
    "power": "ussr",
    "theatre": "eastern",
    "role": "defense",
    "delta": 1,
    "rounds": 1
   },
   {
    "op": "drawOps",
    "power": "ussr",
    "n": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_free_french",
  "title": "The Free French Rally",
  "ops": 2,
  "side": "allied",
  "text": "Bir Hakeim proves that France fights on: place 1 strength under British command in Egypt and the Allied coalition pool gains 1.",
  "effects": [
   {
    "op": "placeStrength",
    "power": "uk",
    "where": "egypt",
    "amount": 1
   },
   {
    "op": "coalitionPool",
    "side": "allied",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_commando_raids",
  "title": "Commando Raids",
  "ops": 2,
  "side": "allied",
  "text": "Raids from Vaagso to St-Nazaire keep the whole coastline garrisoned: Germany loses 1 command point this round and British Home Front +1.",
  "effects": [
   {
    "op": "commandPoints",
    "power": "germany",
    "delta": -1
   },
   {
    "op": "homeFront",
    "power": "uk",
    "delta": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_rosie_the_riveter",
  "title": "Rosie the Riveter",
  "ops": 3,
  "side": "allied",
  "text": "The assembly lines run around the clock: for 2 rounds US builds cost 1 less production each and US production +1.",
  "effects": [
   {
    "op": "flag",
    "name": "war_production",
    "rounds": 2,
    "power": "usa"
   },
   {
    "op": "production",
    "power": "usa",
    "delta": 1,
    "rounds": 2
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "mid"
 },
 {
  "id": "mid_siberian_divisions",
  "title": "The Siberian Divisions",
  "ops": 3,
  "side": "allied",
  "text": "Sorge signals that Japan strikes south, and the Far Eastern divisions entrain west: place 3 Soviet strength in Moscow.",
  "effects": [
   {
    "op": "placeStrength",
    "power": "ussr",
    "where": "moscow",
    "amount": 3
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_satellites_to_the_front",
  "title": "Satellite Armies East",
  "ops": 3,
  "side": "axis",
  "text": "Budapest and Bucharest send their armies to the Eastern Front: place 2 Hungarian strength in Hungary and 2 Romanian strength in Romania; Hungarian and Romanian Pressure each +1.",
  "effects": [
   {
    "op": "placeStrength",
    "power": "hungary",
    "where": "hungary",
    "amount": 2
   },
   {
    "op": "placeStrength",
    "power": "romania",
    "where": "romania",
    "amount": 2
   },
   {
    "op": "pressure",
    "track": "hungary",
    "delta": 1
   },
   {
    "op": "pressure",
    "track": "romania",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_finlands_separate_war",
  "title": "Finland's Separate War",
  "ops": 2,
  "side": "neutral",
  "text": "Helsinki insists it fights its own war and halts at the old border while Washington keeps a door open: Finnish Pressure +2.",
  "effects": [
   {
    "op": "pressure",
    "track": "finland",
    "delta": 2
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_second_happy_time",
  "title": "The Second Happy Time",
  "ops": 3,
  "side": "axis",
  "text": "U-boats feast on unescorted shipping in the western Atlantic: Germany gains +2 dice in each Atlantic sea-zone battle and Axis naval operations in the Atlantic score double hits against convoys this round.",
  "effects": [
   {
    "op": "flag",
    "name": "uboat_surge",
    "rounds": 1
   },
   {
    "op": "flag",
    "name": "convoy_raid_double",
    "rounds": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_afrika_korps",
  "title": "Rommel Reinforced",
  "ops": 3,
  "side": "axis",
  "text": "Panzers come ashore at Tripoli: place 2 German strength in Tripolitania and German attacks in the Mediterranean hit one better this round.",
  "effects": [
   {
    "op": "placeStrength",
    "power": "germany",
    "where": "tripolitania",
    "amount": 2
   },
   {
    "op": "thresholdMod",
    "power": "germany",
    "theatre": "med",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_atlantic_wall",
  "title": "The Atlantic Wall",
  "ops": 3,
  "side": "axis",
  "text": "Todt Organisation concrete rises along the Channel coast: add 1 fort in Normandy and Axis defenders in Western Europe gain +1 fort level this round.",
  "effects": [
   {
    "op": "fort",
    "territory": "normandy",
    "delta": 1
   },
   {
    "op": "flag",
    "name": "fortress_europe",
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_southern_resource_area",
  "title": "Southern Resource Area",
  "ops": 3,
  "side": "axis",
  "text": "Oil and rubber from the conquered south reach the home islands at last: Japanese production +2 for 2 rounds.",
  "effects": [
   {
    "op": "production",
    "power": "japan",
    "delta": 2,
    "rounds": 2
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "mid"
 },
 {
  "id": "mid_rasputitsa",
  "title": "Rasputitsa",
  "ops": 2,
  "side": "neutral",
  "text": "The roads of the East dissolve into mud and then freeze solid: attackers in the Eastern Front are one worse and defenders one better this round.",
  "effects": [
   {
    "op": "flag",
    "name": "winter_freeze",
    "rounds": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_monsoon_season",
  "title": "Monsoon Season",
  "ops": 2,
  "side": "neutral",
  "text": "Sheets of rain ground the aircraft and drown the tracks: all offensives in Southeast Asia and China & Manchuria cost +1 CP this round.",
  "effects": [
   {
    "op": "flag",
    "name": "monsoon",
    "rounds": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_swedish_ore",
  "title": "Swedish Iron Ore",
  "ops": 2,
  "side": "neutral",
  "text": "The ore keeps moving from Kiruna through the Baltic in neutral bottoms: German production +1 for 2 rounds.",
  "effects": [
   {
    "op": "production",
    "power": "germany",
    "delta": 1,
    "rounds": 2
   }
  ],
  "remove": false,
  "persistent": true,
  "era": "mid"
 },
 {
  "id": "mid_franco_demurs",
  "title": "Franco Demurs",
  "ops": 2,
  "side": "neutral",
  "text": "Madrid names an impossible price for joining the Axis and the Rock is left unmolested: add 1 fort in Gibraltar.",
  "effects": [
   {
    "op": "fort",
    "territory": "gibraltar",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_war_weariness",
  "title": "The Casualty Lists",
  "ops": 2,
  "side": "neutral",
  "text": "A third year of telegrams and rationing wears on every belligerent: every at-war power's Home Front −1.",
  "effects": [
   {
    "op": "homeFront",
    "power": "axis",
    "delta": -1
   },
   {
    "op": "homeFront",
    "power": "allied",
    "delta": -1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "mid_bern_channels",
  "title": "Back Channels in Bern",
  "ops": 2,
  "side": "neutral",
  "text": "Diplomats, bankers, and spies trade favors in the neutral capitals: the Axis and Allied coalition pools each gain 1.",
  "effects": [
   {
    "op": "coalitionPool",
    "side": "axis",
    "delta": 1
   },
   {
    "op": "coalitionPool",
    "side": "allied",
    "delta": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "mid"
 },
 {
  "id": "late_overlord",
  "title": "Overlord",
  "ops": 4,
  "side": "allied",
  "text": "The Allies land in Normandy: place 3 US and 2 UK strength in Normandy, and Allied offensives in the West hit on 4+ this round.",
  "effects": [
   {
    "op": "placeStrength",
    "power": "usa",
    "where": "normandy",
    "amount": 3
   },
   {
    "op": "placeStrength",
    "power": "uk",
    "where": "normandy",
    "amount": 2
   },
   {
    "op": "thresholdMod",
    "power": "allied",
    "theatre": "west",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_bagration",
  "title": "Bagration",
  "ops": 4,
  "side": "allied",
  "text": "Army Group Centre is destroyed: Germany removes 3 strength of its choice, the USSR gains +2 CP, and Soviet offensives in the East hit on 4+ this round.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "germany",
    "where": "choose",
    "amount": 3
   },
   {
    "op": "commandPoints",
    "power": "ussr",
    "delta": 2
   },
   {
    "op": "thresholdMod",
    "power": "ussr",
    "theatre": "eastern",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_market_garden",
  "title": "Market Garden",
  "ops": 3,
  "side": "allied",
  "text": "A bridge too far: the UK gains +3 CP and its offensives in the West hit on 4+ this round, then loses 2 strength of its choice.",
  "effects": [
   {
    "op": "commandPoints",
    "power": "uk",
    "delta": 3
   },
   {
    "op": "thresholdMod",
    "power": "uk",
    "theatre": "west",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   },
   {
    "op": "removeStrength",
    "power": "uk",
    "where": "choose",
    "amount": 2
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_king_michaels_coup",
  "title": "King Michael's Coup",
  "ops": 3,
  "side": "allied",
  "text": "Bucharest turns on the Axis: Romania's Pressure track rises 4 and Bulgaria's rises 1.",
  "effects": [
   {
    "op": "pressure",
    "track": "romania",
    "delta": 4
   },
   {
    "op": "pressure",
    "track": "bulgaria",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_moscow_armistice",
  "title": "The Moscow Armistice",
  "ops": 2,
  "side": "allied",
  "text": "Finland signs terms and turns on its former ally: Finland's Pressure track rises 4.",
  "effects": [
   {
    "op": "pressure",
    "track": "finland",
    "delta": 4
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_bomber_offensive",
  "title": "Round-the-Clock Bombing",
  "ops": 4,
  "side": "allied",
  "text": "The Combined Bomber Offensive peaks: strategic bombing raids reduce target production by 2 instead of 1 for two rounds, and German production drops 1 for two rounds.",
  "effects": [
   {
    "op": "flag",
    "name": "strategic_bombing",
    "rounds": 2
   },
   {
    "op": "production",
    "power": "germany",
    "delta": -1,
    "rounds": 2
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "late"
 },
 {
  "id": "late_dresden",
  "title": "Dresden",
  "ops": 3,
  "side": "allied",
  "text": "Firestorm: strategic bombing raids reduce target production by 2 instead of 1 this round, and Germany's Home Front drops 2.",
  "effects": [
   {
    "op": "flag",
    "name": "strategic_bombing",
    "rounds": 1
   },
   {
    "op": "homeFront",
    "power": "germany",
    "delta": -2
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_iwo_jima",
  "title": "Iwo Jima",
  "ops": 3,
  "side": "allied",
  "text": "The flag rises on Suribachi: US amphibious offensives in the Pacific cost 2 CP instead of 3 this round, and US offensives there hit on 4+.",
  "effects": [
   {
    "op": "flag",
    "name": "island_hopping",
    "rounds": 1
   },
   {
    "op": "thresholdMod",
    "power": "usa",
    "theatre": "pacific",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_okinawa",
  "title": "Okinawa",
  "ops": 4,
  "side": "allied",
  "text": "The typhoon of steel: US offensives in the Pacific hit on 4+ this round; Japan removes 2 strength of its choice and the USA removes 1.",
  "effects": [
   {
    "op": "thresholdMod",
    "power": "usa",
    "theatre": "pacific",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   },
   {
    "op": "removeStrength",
    "power": "japan",
    "where": "choose",
    "amount": 2
   },
   {
    "op": "removeStrength",
    "power": "usa",
    "where": "choose",
    "amount": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_leyte_gulf",
  "title": "Leyte Gulf",
  "ops": 4,
  "side": "allied",
  "text": "The Combined Fleet takes the decisive-battle bait and is broken: Japan removes 3 strength of its choice and the Allied coalition pool gains 1.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "japan",
    "where": "choose",
    "amount": 3
   },
   {
    "op": "coalitionPool",
    "side": "allied",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_road_to_rangoon",
  "title": "The Road Back to Rangoon",
  "ops": 3,
  "side": "allied",
  "text": "Fourteenth Army strikes across the Chindwin: place 2 UK strength in India, and UK offensives in Southeast Asia hit on 4+ this round.",
  "effects": [
   {
    "op": "placeStrength",
    "power": "uk",
    "where": "india",
    "amount": 2
   },
   {
    "op": "thresholdMod",
    "power": "uk",
    "theatre": "seasia",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_yalta",
  "title": "Yalta",
  "ops": 3,
  "side": "allied",
  "text": "The Big Three settle the endgame: the Allied coalition pool gains 3.",
  "effects": [
   {
    "op": "coalitionPool",
    "side": "allied",
    "delta": 3
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_starvation_blockade",
  "title": "Operation Starvation",
  "ops": 3,
  "side": "allied",
  "text": "Mines, submarines, and the silent siege of the Home Islands: Japanese production drops 2 for two rounds.",
  "effects": [
   {
    "op": "production",
    "power": "japan",
    "delta": -2,
    "rounds": 2
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "late"
 },
 {
  "id": "late_co_belligerents",
  "title": "Italy Co-Belligerent",
  "ops": 2,
  "side": "allied",
  "text": "The Kingdom of the South finds its footing: Italy's Home Front rises 2, place 1 Italian strength in Southern Italy, and the Allied coalition pool gains 1.",
  "effects": [
   {
    "op": "homeFront",
    "power": "italy",
    "delta": 2
   },
   {
    "op": "placeStrength",
    "power": "italy",
    "where": "s_italy",
    "amount": 1
   },
   {
    "op": "coalitionPool",
    "side": "allied",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_atomic_bombs",
  "title": "Atomic Bombs",
  "ops": 4,
  "side": "allied",
  "text": "The Manhattan Project delivers: Japan's Home Front drops 4.",
  "effects": [
   {
    "op": "homeFront",
    "power": "japan",
    "delta": -4
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_red_army_logistics",
  "title": "Red Army Logistics",
  "ops": 3,
  "side": "allied",
  "text": "American trucks and re-gauged rails: Soviet builds cost 1 less production each for two rounds, and the USSR gains +1 CP this round.",
  "effects": [
   {
    "op": "flag",
    "name": "war_production",
    "rounds": 2,
    "power": "ussr"
   },
   {
    "op": "commandPoints",
    "power": "ussr",
    "delta": 1
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "late"
 },
 {
  "id": "late_zhukovs_fronts",
  "title": "Zhukov's Fronts",
  "ops": 4,
  "side": "allied",
  "text": "Deep Battle comes of age: the USSR gains +2 CP, places 2 strength at an owned industrial city, and Soviet offensives in the East hit on 4+ this round.",
  "effects": [
   {
    "op": "commandPoints",
    "power": "ussr",
    "delta": 2
   },
   {
    "op": "placeStrength",
    "power": "ussr",
    "where": "owned_industrial",
    "amount": 2
   },
   {
    "op": "thresholdMod",
    "power": "ussr",
    "theatre": "eastern",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_percentages",
  "title": "The Percentages Agreement",
  "ops": 3,
  "side": "allied",
  "text": "Churchill's half-sheet of paper divides the Balkans: Bulgaria's Pressure track rises 3 and Hungary's rises 2.",
  "effects": [
   {
    "op": "pressure",
    "track": "bulgaria",
    "delta": 3
   },
   {
    "op": "pressure",
    "track": "hungary",
    "delta": 2
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_wacht_am_rhein",
  "title": "Wacht am Rhein",
  "ops": 4,
  "side": "axis",
  "text": "The last gamble in the Ardennes: place 3 German strength in the Rhineland, German offensives in the West hit on 4+ and Germany's free advance may move 2 territories this round; Germany's Home Front drops 1.",
  "effects": [
   {
    "op": "placeStrength",
    "power": "germany",
    "where": "rhineland",
    "amount": 3
   },
   {
    "op": "thresholdMod",
    "power": "germany",
    "theatre": "west",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   },
   {
    "op": "flag",
    "name": "blitz_bonus",
    "rounds": 1
   },
   {
    "op": "homeFront",
    "power": "germany",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_v_weapons",
  "title": "Vengeance Weapons",
  "ops": 3,
  "side": "axis",
  "text": "V-1s and V-2s fall on London: the UK's Home Front drops 1 and UK production drops 1 for two rounds.",
  "effects": [
   {
    "op": "homeFront",
    "power": "uk",
    "delta": -1
   },
   {
    "op": "production",
    "power": "uk",
    "delta": -1,
    "rounds": 2
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "late"
 },
 {
  "id": "late_volkssturm",
  "title": "Volkssturm",
  "ops": 3,
  "side": "axis",
  "text": "Old men and boys with Panzerfäuste: place 3 German strength in Berlin, and Germany's Home Front drops 2.",
  "effects": [
   {
    "op": "placeStrength",
    "power": "germany",
    "where": "capital",
    "amount": 3
   },
   {
    "op": "homeFront",
    "power": "germany",
    "delta": -2
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_divine_wind",
  "title": "Divine Wind",
  "ops": 3,
  "side": "axis",
  "text": "Kamikaze: Japanese defenders in the Pacific hit on 4+ this round, then Japan removes 1 strength of its choice as the special attack corps expends itself.",
  "effects": [
   {
    "op": "thresholdMod",
    "power": "japan",
    "theatre": "pacific",
    "role": "defense",
    "delta": -1,
    "rounds": 1
   },
   {
    "op": "removeStrength",
    "power": "japan",
    "where": "choose",
    "amount": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_ichi_go",
  "title": "Operation Ichi-Gō",
  "ops": 4,
  "side": "axis",
  "text": "Japan's largest land offensive lunges for the airfields: Japan gains +2 CP, its offensives in China & Manchuria hit on 4+ this round, and China's Home Front drops 1.",
  "effects": [
   {
    "op": "commandPoints",
    "power": "japan",
    "delta": 2
   },
   {
    "op": "thresholdMod",
    "power": "japan",
    "theatre": "china_manchuria",
    "role": "attack",
    "delta": -1,
    "rounds": 1
   },
   {
    "op": "homeFront",
    "power": "china",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_werwolf",
  "title": "Werwolf",
  "ops": 2,
  "side": "axis",
  "text": "Stay-behind fanatics harry the occupiers: the USA and the USSR each remove 1 strength of their choice.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "usa",
    "where": "choose",
    "amount": 1
   },
   {
    "op": "removeStrength",
    "power": "ussr",
    "where": "choose",
    "amount": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_sho_go",
  "title": "Operation Shō-Gō",
  "ops": 3,
  "side": "axis",
  "text": "The decisive-battle plan is executed: Japan applies hits before the defender rolls in all naval battles this round.",
  "effects": [
   {
    "op": "flag",
    "name": "first_strike_pacific",
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_type_xxi",
  "title": "Type XXI Boats",
  "ops": 3,
  "side": "axis",
  "text": "The Elektroboote put to sea: Germany gets +2 dice in each Atlantic sea-zone battle, and Axis naval ops in the Atlantic score double hits against convoys this round.",
  "effects": [
   {
    "op": "flag",
    "name": "uboat_surge",
    "rounds": 1
   },
   {
    "op": "flag",
    "name": "convoy_raid_double",
    "rounds": 1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_fortress_europe",
  "title": "Führer Directive 51",
  "ops": 3,
  "side": "axis",
  "text": "The Atlantic Wall is thickened: Axis defenders in the West get +1 fort level this round, and Normandy's fort rises 1.",
  "effects": [
   {
    "op": "flag",
    "name": "fortress_europe",
    "rounds": 1
   },
   {
    "op": "fort",
    "territory": "normandy",
    "delta": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_speers_miracle",
  "title": "Speer's Miracle",
  "ops": 3,
  "side": "axis",
  "text": "Dispersed factories push output to its wartime peak: German production rises 2 for two rounds, and Germany's Home Front drops 1.",
  "effects": [
   {
    "op": "production",
    "power": "germany",
    "delta": 2,
    "rounds": 2
   },
   {
    "op": "homeFront",
    "power": "germany",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": true,
  "era": "late"
 },
 {
  "id": "late_total_war",
  "title": "Total War",
  "ops": 3,
  "side": "axis",
  "text": "'Wollt ihr den totalen Krieg?' Germany gains +2 CP this round, and its Home Front drops 1.",
  "effects": [
   {
    "op": "commandPoints",
    "power": "germany",
    "delta": 2
   },
   {
    "op": "homeFront",
    "power": "germany",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_ketsu_go",
  "title": "Ketsu-Gō",
  "ops": 3,
  "side": "axis",
  "text": "The Home Islands brace for invasion: Japan's fort rises 1, place 2 Japanese strength in Japan, and Japan's Home Front drops 1.",
  "effects": [
   {
    "op": "fort",
    "territory": "japan",
    "delta": 1
   },
   {
    "op": "placeStrength",
    "power": "japan",
    "where": "japan",
    "amount": 2
   },
   {
    "op": "homeFront",
    "power": "japan",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_warsaw_rising",
  "title": "The Warsaw Rising",
  "ops": 3,
  "side": "neutral",
  "text": "The Home Army rises while the Red Army halts on the Vistula: Germany removes 1 strength from Western Poland, the USSR loses 1 CP, and the Allied coalition pool drops 1.",
  "effects": [
   {
    "op": "removeStrength",
    "power": "germany",
    "where": "w_poland",
    "amount": 1
   },
   {
    "op": "commandPoints",
    "power": "ussr",
    "delta": -1
   },
   {
    "op": "coalitionPool",
    "side": "allied",
    "delta": -1
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_valkyrie",
  "title": "Valkyrie",
  "ops": 3,
  "side": "neutral",
  "text": "The bomb under the map table fails and the purge begins: Germany's Home Front drops 2 and it loses 2 CP this round.",
  "effects": [
   {
    "op": "homeFront",
    "power": "germany",
    "delta": -2
   },
   {
    "op": "commandPoints",
    "power": "germany",
    "delta": -2
   }
  ],
  "remove": true,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_bring_the_boys_home",
  "title": "Bring the Boys Home",
  "ops": 2,
  "side": "neutral",
  "text": "Six years of war tell on the democracies: the UK's and the USA's Home Fronts each drop 1.",
  "effects": [
   {
    "op": "homeFront",
    "power": "uk",
    "delta": -1
   },
   {
    "op": "homeFront",
    "power": "usa",
    "delta": -1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_bled_white",
  "title": "Bled White",
  "ops": 2,
  "side": "neutral",
  "text": "The Axis war economies pass the breaking point: Germany's and Japan's Home Fronts each drop 1.",
  "effects": [
   {
    "op": "homeFront",
    "power": "germany",
    "delta": -1
   },
   {
    "op": "homeFront",
    "power": "japan",
    "delta": -1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_last_winter",
  "title": "The Last Winter",
  "ops": 2,
  "side": "neutral",
  "text": "Snow buries the Eastern Front: attacker threshold −1 (worse) and defenders +1 in the East this round.",
  "effects": [
   {
    "op": "flag",
    "name": "winter_freeze",
    "rounds": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "late"
 },
 {
  "id": "late_monsoon",
  "title": "Monsoon",
  "ops": 2,
  "side": "neutral",
  "text": "The rains close the roads: all offensives in Southeast Asia and China & Manchuria cost +1 CP this round.",
  "effects": [
   {
    "op": "flag",
    "name": "monsoon",
    "rounds": 1
   }
  ],
  "remove": false,
  "persistent": false,
  "era": "late"
 }
];
