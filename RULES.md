# Coalition 1939 — The Rules

The complete rules of play, as implemented. The design document is
`docs/GDD.md`; where it left something open, the decision and its reason are
here. The engine in `src/engine/` is the authoritative arbiter; these rules
describe exactly what it does.

## 0. The table

2–8 human players; the AI plays every empty seat. A full solo game (you
against seven AI) works, and so does the intended form: eight people, one
link, and a war. The China and Independent States seats are the natural ones
to hand to the system first if you are short of players.

You win **as a side** — Axis or Allied — and then rank **within** the winning
side by national objectives met ("honors"). Nobody on the losing side ranks
at all. Read that twice before you farm your own objective while Moscow burns.

## 1. The pieces

- **The board**: 96 territories and sea zones in 9 theatres. Each territory
  has terrain, a supply value (0–4), an owner, and a strength stack. 27
  territories carry a weighted victory city (★1–3). Some are capitals; some
  are industrial (build sites).
- **Strength**: one number per territory, one owner per territory. Armies and
  fleets are both "strength"; what a stack can do depends on where it is and
  the owner's sea rating.
- **Forts** (0–2 per territory), **entrenchment** (one round), **supply**
  (traced each round).
- **Three decks**: Strategy (110, in three era piles), Operations (28,
  shared), Doctrines (16, drafted before round 1).
- **The Coalition pools**: one per side. **The coin**: one per round.

## 2. The calendar

12 rounds of a half-year each: Autumn 1939 → Summer 1945. Strategy cards deal
from the **early** pile in rounds 1–3, **mid** in 4–9, **late** in 10–12.

## 3. The powers

Eight seats; ratings 1–5 in industry, manpower, sea, intelligence
(`src/data/powers.js`). Each has a signature doctrine (always on) and drafts
two more from the doctrine pool before round 1 (public knowledge).

| Power | Side | At war | Signature |
|---|---|---|---|
| UK & Commonwealth | Allied | round 1 | **Ultra** — once per round, before the reveal, read one opponent's orders for one theatre |
| China | Allied | round 1 | **Protracted war** — cannot be eliminated while holding an interior territory; Japanese-held Chinese soil bleeds Japan every round |
| USSR | Allied | Pressure track | **Deep battle** — offensives may draw from two territories; losses return as fresh strength (up to 3/round) while 2+ Soviet industrial cities stand |
| USA | Allied | Pressure track | **Arsenal** — lend-lease costs 0 CP, works while neutral; production climbs every round from Spring 1942 |
| Germany | Axis | round 1 | **Interior lines** — west↔east moves at half cost; successful offensives earn a free advance |
| Japan | Axis | vs China round 1 | **Carrier doctrine** — naval first strike; one Decisive Battle per game doubles its dice in one sea zone |
| Italy | Axis | round 2 (or earlier by choice) | **Mare nostrum** — Mediterranean naval ops are free; at Home Front 0, Italy flips |
| Independent States | Axis | per nation | **Client sovereignty** — plays Hungary, Romania, Croatia, Finland, Slovakia, Bulgaria (Thailand from 1942); sells commitments, defects nations |

**France** is an Allied minor: the UK seat commands French units. If Paris is
Axis-held at any reckoning, France falls — occupied territory goes German,
the south and colonies become neutral Vichy (attackable; see Torch).

## 4. The round — six phases, always in this order

**4.1 Intelligence.** Hands refresh: strategy cards to a hand of 4 from the
era pile; operations cards to 2 + ⌊intel/2⌋ (+1 with the Signals doctrine).
The UK declares its Ultra read (target power + theatre).

**4.2 Council.** Open negotiation, unbounded and non-binding. The default
timer is soft — the table moves on when it moves on; groups that want a hard
clock set one themselves (settled from GDD §13: soft by default). Each side
elects a **Supreme Commander** for each theatre where it has 3+ powers with
strength present: the commander gains 3 CP spendable **only on other powers'
orders in that theatre** (+2 Coalition pool for the election itself).

**4.3 Orders — secret and simultaneous.** Every power writes its whole round
against its command-point budget:

> CP = 3 + industry + ⌊Home Front / 3⌋ + 1 if ≥90% of your territory is
> supplied, clamped to 3–12. Halved while in forced negotiation.

| Order | CP | Notes |
|---|---|---|
| Move | 1 | Between adjacent friendly territories. German west↔east moves cost ½. |
| Offensive | 3 | One adjacent territory; **max 8 strength per power**. USSR may use two source territories. Amphibious: +2 CP, via a friendly/empty sea zone (−1 with Amphibious Command). |
| Naval operation | 2 | Contest, escort, or raid a sea zone; dice capped at 2×sea rating. Free for Italy in the Med. With the Strategic Bombing doctrine, a naval op may instead **bomb** an enemy industrial territory within two steps of your ground: 1–4 dice at 5+, each hit −1 production (−2 under a bombing surge), 2+ hits −1 Home Front. |
| Entrench | 1 | Defender threshold −1 this round. Needs supply. With Fortress Engineering, +1 CP also raises a fort level. |
| Operations card | printed 1–3 | Declared now, resolves in 4.5 attached to a battle. |
| Intelligence op | 2 | Shift one Pressure track ±1, or seed deception (blinds Ultra). |
| Lend-lease | 1 (USA: 0) | 1–4 production to an ally along an open lane. |
| Build | 0 CP | Spends banked production in 4.6: strength 2 (manpower ≥3) or 3, fort 2, at supplied industrial territories. |
| Strategy card | 0 | One per round: play for the **event**, or for **+ops CP**. An opponent-aligned card played for ops fires its event *for them*. |

Neutral powers may not attack or send fleets abroad, but build, entrench, run
intelligence, and (the USA) lend-lease.

**4.4 Reveal.** All sheets turn face up at once. Strategy events fire
(initiative side first). Offensives naming the same target from powers on the
same side merge into a **joint order**: +1 Coalition pool per power beyond
the first. Attacking any neutral power or nation snaps its Pressure to 10 and
buys the attacker a one-round first strike. Broken promises become visible
here and nowhere else.

**4.5 Resolution.**
1. **Initiative**: each side rolls a d6, +1 per 2 coalition pool bid in the
   order sheets; ties go to the coin.
2. **The coin**: the initiative side names one contested land battle — before
   any dice. Heads: the attack carries — the defenders (the losers) lose half
   rounded up, the remnant retreats if it can, and the ground falls. Tails:
   the line holds — the attackers lose half and march home. The winner is
   untouched. Nothing modifies the coin.
3. **Moves** execute, entrenchments dig in, committed strength marches out.
4. **Battles**, theatre by theatre (Atlantic → Scandinavia → West → East →
   Balkans → Med → China → SE Asia → Pacific), naval before land:
   - Attacker rolls one d6 per committed strength. Base hit **5+**, improved
     by 1 per allied power beyond the first (**floor 3**), by doctrine, cards
     and events; worsened by winter, grounded air, and the defender's tricks.
   - Defender rolls back at 5+, improved by terrain (mountain, urban, jungle,
     island), fort, entrenchment, doctrine; worsened by being out of supply.
   - Hits land simultaneously — except carrier/first-strike attacks, which
     kill before the defender rolls.
   - Defender destroyed and attackers alive → the territory falls to the
     biggest surviving contributor (a stormed fort drops a level); Germany
     (or Storm Troops doctrine) may advance reinforcements in free. Otherwise
     the survivors march home.
   - The pool at war: 2 points reroll a victory-city attack; escorts hold
     corridors; raiders sink production (double against unescorted convoys).

**4.6 Reckoning**, in order: partisans bleed Japan (1 per 3 Japanese-held
Chinese territories, doubled by surges); out-of-supply stacks wither (−1);
production = supply values of supplied territory (+US arsenal ramp, − closed
corridors: Arctic −2 USSR, Suez −2 UK, Burma −1 China) into each power's bank
(cap: 6 + this round's take); lend-lease arrives (+1 pool each); builds
muster; Soviet replacements return (≤3) while 2 of Moscow/Leningrad/
Stalingrad/Urals stand; Home Front moves (wins +1; 2+ failed offensives −1;
6+ losses −1; a lost victory city −1; enemies at the capital's gates −1);
Italy flips at HF 0; France falls if Paris is Axis; Pressure drifts (USSR
from round 3, USA from round 4, +1 with a 3+ Axis stack on the border, +2
for the USA once Japan goes global; client nations +1 with 2+ Allied strength
next door, +1 while German HF ≤ 3); nations defect (chosen at 7+, automatic
at 10); neutrals enter (chosen at 7+, automatic at 10); Thailand joins the
Axis in Spring 1942; flags expire; corridors and supply retrace; objectives
score; **victory is checked**; the calendar turns.

## 5. Corridors and supply

Three lifelines only function while two listed powers keep them open —
endpoints friendly or uncontested **and** two of the listed at-war powers
present in or adjacent to them (one suffices while only one is at war):

- **Arctic convoy** (UK + USSR): Norwegian Sea ↔ Murmansk
- **Gibraltar & Suez** (UK + USA): Gibraltar ↔ W. Med, E. Med ↔ Egypt
- **Burma Road** (UK/USA + China): Burma ↔ Yunnan

Supply traces from your industrial cities and capitals through friendly
territory and uncontested seas (Allied tracing uses corridor edges only while
the corridor is open). Out of supply: no production, worse defense, attrition.
Cutting a corridor is often worth more than winning a battle.

## 6. The Coalition pool

Earn: +1 per extra power in a joint order · +1 per completed lend-lease ·
+2 per Supreme Commander elected in a 3+-power theatre.
Spend: **2** reroll a battle · **2** per +1 on the initiative roll · **3**
emergency resupply (2 strength in a supplied friendly territory, ordered on
the sheet) · **4** cancel an opponent's event. Any member spends it. A team
that never coordinates never has any.

## 7. Neutrality (GDD §9, settled)

A neutral human seat sees only two rings beyond its own territory — the
entry decision is supposed to depend on somebody *telling* you how bad it is.
(The UK can simply talk to the neutral in council; the fog is the reason that
conversation matters.) At Pressure 7+ a neutral may enter at the start of any
round; at 10 it must. Barbarossa and Pearl Harbor are always available to the
Axis — at the price printed on them.

## 8. Victory

Checked every reckoning:

1. **Total** — one side holds every enemy major capital (London, Moscow*,
   Chongqing, Washington* vs Berlin, Tokyo, Rome*; asterisks only while that
   power is actually at war). Immediate.
2. **Collapse** — a side's at-war powers' combined Home Front falls below 6:
   it sues for peace.
3. **Strategic** — after Summer 1945: victory cities (weighted) + ⌊HF/2⌋ per
   at-war power. Margin under 5 is a **contested peace**: nobody won this war,
   and nobody ranks.

Winners rank by honors — objectives currently met. **The losing side's honors
are void.** Both sentences are printed on the player aid, and on the victory
screen, because they are the design.

## 9. Open questions from GDD §13 — settled

1. **How many players?** 2–8; AI seats are first-class (they coordinate, keep
   corridors, play cards, and defect nations). China and the Independent
   States are the recommended system-run seats at small tables.
2. **Council timer?** Soft. The commit-reveal mechanism makes stalling
   pointless — your sheet is sealed before you learn anything.
3. **Is the Italy flip fun for Italy?** The seat keeps playing: the
   co-belligerent south fights on the Allied side, the objective slate still
   scores, and the player gets the rarest experience in the game — a second
   act on the other team. The flip is a change of employer, not an execution.
4. **Are 12 rounds right?** Kept at 12. In play the early war resolves fast
   (few contested fronts, cheap rounds); compressing 1939–40 proved
   unnecessary once round length was dominated by the number of contested
   theatres rather than the calendar.

## 10. Playing it online

Open the published page; every player claims a seat on their own device. Your
orders are hashed (SHA-256, salted) and only the hash is published at commit.
At the reveal everyone publishes text + salt and every device re-checks every
hash — a changed sheet is caught by the table, not by trust. The round's dice
are seeded from the hash of *all* reveals together, so no one — host included
— can know a die before the last sheet is sealed. Cadence is yours: a round
per sitting live, or a round per day with the council in your group chat.
