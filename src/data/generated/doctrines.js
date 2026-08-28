// GENERATED CONTENT — produced by the content workflow, validated by sim/validate-data.js.
// Regenerate rather than hand-editing structure; tuning numbers by hand is fine.
export const DOCTRINES = [
 {
  "id": "doc_blitzkrieg",
  "name": "Blitzkrieg",
  "pool": [
   "germany",
   "ussr",
   "japan",
   "italy"
  ],
  "text": "In land battles you initiate, your attacking units hit on 4+ instead of 5+ (attack threshold shifted 1 in your favour, land only).",
  "passive": {
   "kind": "threshold",
   "domain": "land",
   "role": "attack",
   "delta": 1
  }
 },
 {
  "id": "doc_strategic_bombing",
  "name": "Strategic bombing",
  "pool": [
   "uk",
   "usa",
   "germany"
  ],
  "text": "You may run strategic bombing raids as a naval op, reducing the target power's production by 1 (by 2 while the strategic_bombing flag is active).",
  "passive": {
   "kind": "bombing"
  }
 },
 {
  "id": "doc_convoy_escort",
  "name": "Convoy escort",
  "pool": [
   "uk",
   "usa",
   "japan",
   "italy"
  ],
  "text": "When defending a sea zone, your units hit on 4+ instead of 5+ (+1 threshold defending sea zones).",
  "passive": {
   "kind": "convoy_escort"
  }
 },
 {
  "id": "doc_partisan_warfare",
  "name": "Partisan warfare",
  "pool": [
   "china",
   "ussr",
   "indies",
   "uk"
  ],
  "text": "During each reckoning phase, remove 1 enemy strength from one enemy-occupied home territory of yours (rate 1 per round).",
  "passive": {
   "kind": "partisans",
   "rate": 1
  }
 },
 {
  "id": "doc_unrestricted_sub_warfare",
  "name": "Unrestricted submarine warfare",
  "pool": [
   "germany",
   "usa",
   "japan",
   "italy"
  ],
  "text": "You roll +1 die in every atlantic sea-zone battle you fight.",
  "passive": {
   "kind": "sub_war"
  }
 },
 {
  "id": "doc_amphibious_command",
  "name": "Amphibious command",
  "pool": [
   "usa",
   "uk",
   "japan"
  ],
  "text": "Your amphibious offensives cost 1 CP less.",
  "passive": {
   "kind": "amphib"
  }
 },
 {
  "id": "doc_mass_mobilization",
  "name": "Mass mobilization",
  "pool": [
   "ussr",
   "china",
   "germany",
   "usa"
  ],
  "text": "Each round, recover 1 strength at one industrial territory you control.",
  "passive": {
   "kind": "replacements",
   "rate": 1
  }
 },
 {
  "id": "doc_fortress_engineering",
  "name": "Fortress engineering",
  "pool": [
   "germany",
   "ussr",
   "indies",
   "japan"
  ],
  "text": "When you Entrench, you may pay 1 CP extra to also add a fort level (fort +1) in that territory.",
  "passive": {
   "kind": "fortification"
  }
 },
 {
  "id": "doc_signals_intelligence",
  "name": "Signals intelligence",
  "pool": [
   "usa",
   "germany",
   "italy",
   "china"
  ],
  "text": "Your operations card hand size is increased by 1.",
  "passive": {
   "kind": "intel"
  }
 },
 {
  "id": "doc_cavalry_screens",
  "name": "Cavalry screens",
  "pool": [
   "ussr",
   "china",
   "indies",
   "japan"
  ],
  "text": "Once per round, one of your Move orders costs 0 CP.",
  "passive": {
   "kind": "move_discount"
  }
 },
 {
  "id": "doc_storm_troops",
  "name": "Storm troops",
  "pool": [
   "germany",
   "ussr",
   "japan",
   "italy"
  ],
  "text": "After winning an offensive, your free advance may move 1 additional territory.",
  "passive": {
   "kind": "extra_advance"
  }
 },
 {
  "id": "doc_naval_aviation",
  "name": "Naval aviation",
  "pool": [
   "japan",
   "usa",
   "uk",
   "italy"
  ],
  "text": "In naval battles you initiate, your attacking units hit on 4+ instead of 5+ (attack threshold shifted 1 in your favour, naval only).",
  "passive": {
   "kind": "threshold",
   "domain": "naval",
   "role": "attack",
   "delta": 1
  }
 },
 {
  "id": "doc_elastic_defense",
  "name": "Elastic defense",
  "pool": [
   "germany",
   "ussr",
   "china",
   "indies"
  ],
  "text": "When defending in land battles, your units hit on 4+ instead of 5+ (defense threshold shifted 1 in your favour, land only).",
  "passive": {
   "kind": "threshold",
   "domain": "land",
   "role": "defense",
   "delta": 1
  }
 },
 {
  "id": "doc_jungle_warfare",
  "name": "Jungle warfare",
  "pool": [
   "japan",
   "uk",
   "usa",
   "china",
   "indies"
  ],
  "text": "Once per round, one of your Move orders costs 0 CP.",
  "passive": {
   "kind": "move_discount"
  }
 },
 {
  "id": "doc_mountain_warfare",
  "name": "Mountain warfare",
  "pool": [
   "italy",
   "germany",
   "indies",
   "china"
  ],
  "text": "When defending in land battles, your units hit on 4+ instead of 5+ (defense threshold shifted 1 in your favour, land only).",
  "passive": {
   "kind": "threshold",
   "domain": "land",
   "role": "defense",
   "delta": 1
  }
 },
 {
  "id": "doc_combined_bombardment",
  "name": "Combined bombardment",
  "pool": [
   "usa",
   "uk",
   "ussr"
  ],
  "text": "In all battles you initiate, land or naval, your attacking units hit on 4+ instead of 5+ (attack threshold shifted 1 in your favour, any domain).",
  "passive": {
   "kind": "threshold",
   "domain": "any",
   "role": "attack",
   "delta": 1
  }
 }
];
