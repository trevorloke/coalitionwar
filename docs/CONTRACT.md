# Coalition 1939 — Data & Engine Contract (v1)

This file is the binding contract between the game data, the rules engine, and the UI.
Content (map detail, cards, doctrines) MUST conform to these schemas exactly. The engine
implements exactly these semantics. IDs are lowercase snake_case and stable.

## 1. Identifiers

### Powers (8 seats)
| id | name | side | atWar from |
|----|------|------|-----------|
| `uk` | United Kingdom & Commonwealth | allied | round 1 |
| `china` | China | allied | round 1 (vs Japan) |
| `ussr` | Soviet Union | allied | neutral, Pressure track |
| `usa` | United States | allied | neutral, Pressure track |
| `germany` | Germany | axis | round 1 |
| `japan` | Japan | axis | vs China round 1; global on Pacific initiation |
| `italy` | Italy | axis | round 2, or earlier by choice |
| `indies` | The Independent States | axis (conditional) | per nation |

### Independent State nations (owned/played by the `indies` seat)
`hungary`, `romania`, `croatia`, `finland`, `slovakia`, `bulgaria`, `thailand` (from 1942).
Each nation has its own Pressure track (0–10) for defection to the Allies.

### Minors (non-player, engine-controlled ownership tags)
`france` (Allied minor; UK seat commands its units), `vichy` (neutral after French collapse),
`neutral` (true neutrals: Sweden, Spain-adjacent abstractions, Low Countries, Norway, Denmark,
Greece, Serbia, Dutch East Indies).

### Theatres (9)
| id | name | territories |
|----|------|-------------|
| `eastern` | The Eastern Front | 18 |
| `med` | Mediterranean & North Africa | 13 |
| `china_manchuria` | China & Manchuria | 12 |
| `west` | Western Europe & the Atlantic Wall | 11 |
| `pacific` | The Pacific | 10 |
| `balkans` | Balkans & the Independent States | 9 |
| `atlantic` | The Atlantic & home waters | 8 (all sea) |
| `seasia` | Southeast Asia & the Indian Ocean | 8 |
| `scandinavia` | Scandinavia & the Baltic | 7 |

Total 96 territories, 27 victory cities.

### Terrain enum
`clear`, `forest`, `mountain`, `desert`, `jungle`, `urban`, `island`, `steppe`, `sea`.
Terrain defense bonus (+1 hit threshold for defender): `mountain`, `urban`, `jungle`, `island`.

### Corridors (two-power lifelines; heavy edges on the theatre graph)
| id | name | powers required | edge(s) |
|----|------|-----------------|---------|
| `arctic_convoy` | Arctic convoy | uk + ussr | `norwegian_sea` ↔ `murmansk` |
| `gib_suez` | Gibraltar & Suez | uk + usa | `gibraltar` ↔ `west_med`, `east_med` ↔ `egypt` |
| `burma_road` | Burma Road | (uk or usa) + china | `burma` ↔ `yunnan` |

Special graph features: `interior_lines` (Germany: west ↔ eastern shifts at half cost),
`siberian_frontier` (edge `siberia` ↔ `manchuria`).

## 2. Territory schema

```js
{
  id: 'moscow',
  name: 'Moscow',
  theatre: 'eastern',
  type: 'land' | 'sea',
  terrain: <terrain enum>,          // 'sea' iff type === 'sea'
  supply: 0..4,                     // production value; sea zones are 0
  victoryCity: null | { name: 'Moscow', weight: 1|2|3 },
  capitalOf: null | <power id> | <nation id>,
  industrial: true|false,           // build site; USSR replacement rule keys off these
  interior: true|false,             // China's protracted-war interior (china_manchuria only)
  adjacent: ['smolensk', ...],      // MUST be symmetric across the whole map
  coords: { x: <int>, y: <int> },   // world space 1600x900, inside the theatre's box
  setup: { owner: <power|nation|'france'|'neutral'>, strength: 0..5, fort: 0|1 }
}
```

Theatre bounding boxes (coords must fall inside, with ≥18px spacing between nodes):

| theatre | x range | y range |
|---------|---------|---------|
| atlantic | 40–360 | 40–430 |
| west | 370–650 | 130–390 |
| scandinavia | 550–830 | 20–125 |
| eastern | 720–1090 | 130–450 |
| balkans | 570–830 | 400–545 |
| med | 270–770 | 560–790 |
| china_manchuria | 1100–1390 | 200–490 |
| seasia | 990–1330 | 560–800 |
| pacific | 1400–1580 | 60–840 |

## 3. Effect DSL (cards & events)

An effect is an array of ops. The engine interprets ONLY these ops. Any `power` field may
also be `'axis'`/`'allied'` (applies to every at-war power on that side).

```js
{ op:'pressure', track:'ussr'|'usa'|<nation id>, delta:int }        // clamp 0..10
{ op:'pressureLock', track, rounds:int, releaseDelta:int }
{ op:'placeStrength', power, where:<territory id>|'owned_industrial'|'capital', amount:int }
{ op:'removeStrength', power, where:<territory id>|'choose', amount:int }
{ op:'homeFront', power, delta:int }                                 // clamp 0..10
{ op:'commandPoints', power, delta:int }                             // next round's budget (events fire after sheets seal)
{ op:'coalitionPool', side:'axis'|'allied', delta:int }
{ op:'production', power, delta:int, rounds:int }
{ op:'thresholdMod', power|side, theatre:<id>|null, role:'attack'|'defense', delta:int, rounds:1 }
{ op:'drawOps', power, n:int }
{ op:'control', territory:<id>, power }
{ op:'fort', territory:<id>, delta:int }
{ op:'entry', power:'ussr'|'usa' }                                   // set pressure to 10
{ op:'corridor', corridor:<id>, state:'closed', rounds:int }
{ op:'flag', name:<flag id>, rounds:int, power?:power }
```

### Engine flags (closed list — cards may reference ONLY these)
| flag | semantics |
|------|-----------|
| `convoy_raid_double` | Axis naval ops in `atlantic` score double hits vs convoys this round |
| `uboat_surge` | Germany gets +2 dice in each atlantic sea-zone battle |
| `winter_freeze` | In `eastern`: attacker threshold −1 (worse), defenders +1 |
| `monsoon` | In `seasia`/`china_manchuria`: all offensives cost +1 CP |
| `partisan_surge` | China partisan attrition doubles this round |
| `strategic_bombing` | Bombing raids reduce target production by 2 instead of 1 |
| `luftwaffe_grounded` | Germany loses terrain/entrench bonuses when attacking this round |
| `war_production` | Named power's builds cost 1 less production each (min 1) |
| `first_strike_pacific` | Japan applies hits before defender rolls in ALL naval battles this round |
| `no_lend_lease` | Lend-lease orders cannot be executed this round |
| `blitz_bonus` | Germany's free advance may move 2 territories this round |
| `fortress_europe` | Axis defenders in `west` get +1 fort level this round |
| `island_hopping` | USA amphibious offensives in `pacific` cost 2 CP less (minimum 2) |
| `deception` | Named power's written orders are hidden from Ultra this round |

## 4. Strategy cards (~110, shared deck in 3 era piles)

```js
{
  id: 'mid_barbarossa', era: 'early'|'mid'|'late',
  title: 'Case Blue', ops: 1..4, side: 'axis'|'allied'|'neutral',
  text: '<exact rules text, one or two sentences>',
  effects: [ <DSL ops> ],
  remove: true|false,        // removed from game after event is played
  persistent: true|false     // stays in play (engine keeps flags active)
}
```
Era targets: early (1939–40) 34 cards, mid (1941–43) 40 cards, late (1944–45) 36 cards.
Play a card for ops OR event; an opponent-aligned card played for ops fires its event for them.

## 5. Operations cards (shared tactical deck, ~28)

```js
{
  id: 'op_forced_march', title: 'Forced march', cost: 1..3,
  timing: 'resolution'|'orders',
  powers: 'any' | [<power ids>],
  text: '...',
  effect: { kind: <see below>, ... }
}
```
Allowed `kind`s (closed set):
`reroll {dice}` · `extra_dice {dice, exhaustion}` · `ambush {delta}` (attacker threshold worse) ·
`entrench_bonus {delta}` · `convoy_strike {}` · `cancel_advance {}` · `retreat {}` (withdraw before combat) ·
`intel_peek {}` (the signals desk: draw 1 operations card at the reveal) · `repair {strength}` · `naval_reroll {dice}` ·
`threshold {role, delta}` · `exhaust_enemy {strength}`.

## 6. Doctrine draft pool (2 drafted per power before round 1; public)

```js
{
  id: 'doc_blitzkrieg', name: 'Blitzkrieg', pool: [<power ids eligible>],
  text: '...',
  passive: { kind: <see below>, ... }
}
```
Allowed passive `kind`s:
`threshold {domain:'land'|'naval'|'any', role:'attack'|'defense', delta:1}` ·
`move_discount {}` (Move costs 0 for 1 order per round) ·
`extra_advance {}` · `partisans {rate:1}` · `convoy_escort {}` (+1 threshold defending sea zones) ·
`bombing {}` (may run strategic bombing raids as naval op) ·
`amphib {}` (amphibious offensives cost −1 CP) ·
`replacements {rate:1}` (recover 1 strength/round at industrial city) ·
`intel {}` (+1 ops card hand size) · `sub_war {}` (+1 die in atlantic sea zones) ·
`fortification {}` (Entrench also adds a fort on 1 CP extra).

Signature doctrines (Ultra, Protracted War, Deep Battle, Arsenal, Interior Lines,
Carrier Doctrine, Mare Nostrum, Client Sovereignty) are hard-coded per seat in the engine,
NOT part of the draft pool.

## 7. Round structure & core numbers (engine constants)

- 12 rounds: 1939H2 … 1945H1 (autumn 1939 → summer 1945). Round n ↔ calendar in `engine/calendar.js`.
- Phases: `intel → council → orders → reveal → resolution → reckoning`.
- Command points: `clamp(3 + industry + floor(homeFront/3) + supplyBonus, 3, 12)`.
- Combat: d6 per strength point, hit on 5+; −1 threshold (better) per allied power beyond the
  first committing ≥1 strength to the same offensive, floor 3. Max 8 strength committed per
  power per offensive. Defender hits on 5+, +1 threshold shift for terrain/fort/entrench.
- The coin: once per round, the initiative holder picks one contested land battle before any
  dice; a coin decides it. Heads: the attack carries — the defender (the loser) loses half its
  strength rounded up, the remnant retreats to an adjacent friendly territory (destroyed if
  none), and the attackers take the ground intact. Tails: the line holds — the attackers (the
  losers) each lose half rounded up and the rest march home. The winner is untouched. No card,
  doctrine, reroll, or pool spend modifies the coin.
- Coalition pool: +1 per extra power in a joint order, +1 per completed lend-lease,
  +2 for electing a Supreme Commander in a theatre with ≥3 active powers of that side.
  Spend: 2 = reroll a battle's dice once; 2 = +1 on your side's initiative roll (bid in the
  order sheet); 3 = emergency resupply (place 2 strength in a supplied friendly territory);
  4 = cancel an opponent event card.
- Pressure: 0–10. At 7+ may enter at start of round; at 10 auto-enters. Attacked while
  neutral → 10 immediately + attacker first-strike for one round.
- Home Front 0–10. At 0: Italy flips (north stays Axis under Germany, south co-belligerent
  Allied, seat changes sides); an Independent nation defects when ITS track breaks;
  majors enter forced negotiation (halved CP until HF ≥ 2).
- Victory: total (hold every enemy capital), strategic (VP at end of R12: VC weights + HF/2,
  margin <5 = contested peace), collapse (side's combined HF below 6 → sues for peace).
