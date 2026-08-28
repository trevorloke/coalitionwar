# Coalition 1939 — Game design document · version 0.1

> An eight-player war game where the side that coordinates beats the side that
> has the best player on it. 8 powers · 96 territories · 12 rounds, autumn 1939
> to summer 1945 · 3 decks, dice, and one coin.

This is the original design document the implementation is built against.
Where the implementation had to settle something the document leaves open, the
decision is recorded in RULES.md and flagged in §13 below.

## 01 The design thesis

Most war games reward the sharpest individual at the table. This one is built
so that a well-run team of average players beats one brilliant general
surrounded by allies who were not consulted.

That is a design constraint, not a slogan, and it has to show up in the math.
Three rules carry it. Offensives get dramatically better when more than one
power commits to them, so the biggest attacks are structurally impossible
alone. Every act of coordination pays into a shared pool that only the team can
spend. And personal glory is scored, tracked, and then voided if your side
loses the war.

The rest of the system exists to make coordination hard enough to be a skill.
Orders are written in secret and revealed at once, so an agreement is a
promise, not a mechanic. Production is asymmetric, so nobody holds industry,
manpower, sea power, and intelligence at the same time. And the Axis coalition
can come apart at the seams, because two of its seats are allowed to change
sides.

*A promise made in the negotiation phase is worth exactly what the person who
made it does when the orders are revealed.*

## 02 The eight powers

Each seat plays differently enough that no player learns one power and then
plays them all. Ratings run 1 to 5 and set the size of your dice pools, your
production, and how far your orders can reach. The signature doctrine is the
thing only that seat can do. (Rating values: `src/data/powers.js`.)

**United Kingdom and Commonwealth** — Allied, at war from round 1.
Doctrine *Ultra*: once per round, before the reveal, read one opponent's
written orders for a single theatre. Objective: keep the Atlantic and Suez
open every round; hold the home islands.

**China** — Allied, at war from round 1. Doctrine *Protracted war*: cannot be
eliminated while holding any interior territory; every territory Japan takes
from you generates partisan attrition against Japan each round. Objective:
survive holding Chongqing; tie down 8 or more Japanese strength from 1942
onward.

**Soviet Union** — Allied, neutral until the Pressure track breaks
(historically summer 1941). Doctrine *Deep battle*: an offensive may draw
strength from two adjacent territories for the cost of one; losses convert to
fresh strength at the start of the next round while you hold your industrial
cities. Objective: hold Moscow and Baku through 1942; reach the Vistula before
the war ends.

**United States** — Allied, neutral until the Pressure track breaks (entry
window winter 1941 to summer 1942). Doctrine *Arsenal*: lend-lease costs no
command points and may reach any ally along an open sea lane, including while
still neutral; production rises every round from 1942. Objective: land in
Europe and reach the Rhine; take two Pacific island chains.

**Germany** — Axis, at war from round 1. Doctrine *Interior lines*: shift
strength between the Western and Eastern fronts at half cost; a successful
offensive permits one free advance into the vacated territory. Objective:
Paris, Moscow, and the Caucasus oil; keep the Ruhr out of bombing range.

**Japan** — Axis, at war with China from round 1, global war on Pacific
initiation. Doctrine *Carrier doctrine*: in a naval offensive you roll and
apply hits before the defender rolls; once per game, declare a Decisive Battle
and double your dice for one sea zone. Objective: hold the oil, rubber, and
tin of the southern resource zone; have a closed perimeter by the end of 1943.

**Italy** — Axis, at war from round 2, or earlier by choice. Doctrine *Mare
nostrum*: contest any Mediterranean sea zone for free; but if your Home Front
reaches zero, Italy flips — the board splits into a co-belligerent north and
south, and your seat changes sides. Objective: hold Malta, Suez, and the North
African coast at the same time for two consecutive rounds.

**The Independent States** — Axis, conditional. Hungary, Romania, Croatia,
Finland, Slovakia, Bulgaria; Thailand from 1942. Doctrine *Client
sovereignty*: you play six or seven small nations with separate war aims; sell
a nation's commitment to Germany or Japan for command points, and defect it to
the Allies when its own Pressure track breaks. Objective: end the war holding
your own capitals; score for each nation still sovereign in 1945, whichever
side it finished on.

*Why the Independent States seat matters:* it is the hardest seat and the most
interesting one. Romania's oil is the reason Germany can fight past 1942,
Finland decides whether Leningrad is besieged, and every one of these nations
has a live incentive to leave the Axis once the Red Army reaches its border.
The Axis team has to keep paying for a coalition. The Allied team can spend
intelligence and diplomacy to break one. This is the thesis running in
reverse: a coalition that stops maintaining itself loses members, and losing
members loses the war.

## 03 The board

The map is the game. Ninety-six territories and sea zones across nine
theatres, sized so a phone can render one theatre legibly and a laptop can
hold the world. Territories carry a supply value, terrain, and in some cases a
victory city.

What matters more than the territory count is the shape of the graph. Theatres
connect through a small number of corridors, and three of those corridors only
function when two powers cooperate to keep them open. Those three are where
the war is decided:

- **Arctic convoy** — UK + USSR
- **Gibraltar and Suez** — UK + USA
- **Burma Road** — UK/USA + China

| Theatre | Territories | Victory cities | Who fights here |
|---|---|---|---|
| The Eastern Front | 18 | Moscow, Leningrad, Kiev, Stalingrad, Baku | Germany, USSR, Independent States |
| Mediterranean and North Africa | 13 | Cairo, Malta, Tunis, Gibraltar | UK, Italy, Germany, USA |
| China and Manchuria | 12 | Shanghai, Chongqing, Mukden | Japan, China, USSR |
| Western Europe and the Atlantic Wall | 11 | Paris, Berlin, the Ruhr | Germany, UK, USA |
| The Pacific | 10 | Tokyo, Manila, Midway | Japan, USA, UK |
| The Balkans and the Independent States | 9 | Ploiești, Budapest, Belgrade | Independent States, Germany, USSR, UK |
| The Atlantic and home waters | 8 | none · supply only | UK, USA, Germany |
| Southeast Asia and the Indian Ocean | 8 | Singapore, Rangoon, Batavia | Japan, UK, USA, Independent States |
| Scandinavia and the Baltic | 7 | Oslo, Helsinki, Murmansk | Germany, UK, USSR, Independent States |
| **Total** | **96** | **27 victory cities** | |

Germany's interior lines let one power fight two fronts cheaply, which is
exactly the advantage the Allied corridors are designed to cancel. Cut the
Arctic convoy and Soviet production stalls. Cut the Burma Road and China
starves, which frees Japanese strength for the Pacific.

## 04 The round

Twelve rounds, each a half-year, from autumn 1939 to summer 1945. A round has
six phases and always runs in the same order.

1. **Intelligence** (partly hidden) — draw and refresh hands. Intelligence
   ratings reveal a limited slice of the board and, for the UK, one opponent's
   written orders.
2. **Council** (open, timed) — open negotiation on a shared clock, plus
   private channels. Elect the Supreme Commander of each contested theatre.
   Nothing agreed here binds anyone.
3. **Orders** (secret, simultaneous) — every power writes its full round of
   orders at once, alone, against its command point budget. No one sees
   another sheet.
4. **Reveal** (open) — all sheets turn face up together. Joint orders are
   identified and pay into the Coalition pool. Broken promises become visible
   here and nowhere else.
5. **Resolution** (open) — initiative, then movement, then combat theatre by
   theatre. Operations cards, dice, and one coin flip settle it.
6. **Reckoning** (open) — production, attrition, Home Front, Pressure tracks,
   defections, and the victory check. Then the calendar advances.

The order of phases 2 and 3 is the whole game. You negotiate before you write,
and you write alone.

## 05 Orders

Each power receives command points at the start of the round, between 3 and
12, scaled by industry, supply, and Home Front. You will never have enough to
run your own theatre and help someone else's, which means the team has to
decide who is carrying what.

| Order | Cost | Effect |
|---|---|---|
| Move | 1 | Shift strength between adjacent friendly territories along a supply line. |
| Offensive | 3 | Attack one adjacent territory. Maximum 8 strength from any single power. |
| Naval operation | 2 | Contest a sea zone, escort a convoy, or carry an amphibious offensive. |
| Entrench | 1 | Defender's hit threshold improves by 1 in that territory for the round. |
| Play an operations card | 1–3 | As printed on the card, declared in the order sheet and revealed in 4.5. |
| Intelligence operation | 2 | Read a hand, seed a deception, or shift one Pressure track by 1. |
| Lend-lease | 1 | Transfer production to an ally along an open corridor. Free for the United States. |
| Build | varies | Convert production into strength, ships, or fortification at your industrial cities. |

**Joint orders.** Two or more powers may name the same territory in the same
round. When the sheets are revealed and the names match, it is a joint order:
the offensive resolves as a single combined attack, and the team adds 1 to its
Coalition pool for each additional power involved. Nobody can verify a joint
order in advance. That is deliberate.

## 06 Resolution

Combat runs on six-sided dice. Roll one die per point of committed strength.
Hits land on 5 or 6 by default, and the threshold improves with support,
terrain, doctrine, and cards. The defender rolls back with the same rules
unless a doctrine says otherwise.

**The combined operations rule.** Every allied power beyond the first that
commits at least 1 strength to the same offensive improves the hit threshold
by 1 for the entire pool, to a floor of 3. This is the single most important
number in the game.

| How 12 strength is committed | Dice | Hits on | Expected hits | Odds of taking a 6-hit objective |
|---|---|---|---|---|
| One power alone, 12 strength | 12 | 5+ | 4.0 | 18% |
| Two powers, 6 and 6 | 12 | 4+ | 6.0 | 61% |
| Three powers, 4 and 4 and 4 | 12 | 3+ | 8.0 | 93% |

Identical strength. Identical dice. The difference is entirely who agreed to
show up. The 8-strength ceiling on any one power's contribution finishes the
job: the largest offensives on the board cannot be launched by a single power
at all. If you want to take Berlin, you need someone else to write Berlin on
their sheet too.

**The coin.** Once per round, exactly one contested resolution is decided by a
coin flip instead of dice. The power holding Initiative chooses which one,
before the dice are rolled anywhere on the board. No card modifies it, no
doctrine touches it, no reroll applies, and the Coalition pool cannot buy it.
It is there for one reason: a dominant player can engineer almost everything
else in this system, and history did not work that way. The coin is the part
of the war nobody gets to plan. It also decides initiative ties, and a
neutral's entry when its Pressure track sits exactly on the threshold.

## 07 The three decks

**Strategy deck** — shared, roughly 110 cards. Historical events, dealt from
three era piles: early 1939–1940, middle 1941–1943, late 1944–1945. Each card
carries an operations value and an event aligned to one side. You may play a
card for its operations value or for its event. Play an opponent-aligned card
for the operations, and the event fires anyway, for them. With eight seats,
the card you cannot afford to hold is often one your teammate can safely play,
and working out who should eat which card is a genuine negotiation every
round.

**Operations deck** — per power, played during resolution. Small tactical
modifiers held in hand and declared in your order sheet: rerolls, ambushes,
extra dice paid for in attrition, convoy interception. They resolve after the
reveal, so they are how a coalition survives a plan that went wrong.

**Doctrine deck** — drafted once, persistent. Each power drafts two doctrines
before round 1 from a pool matched to its seat. Doctrines are public. They
tell your allies what you are good at, which is the information the team needs
before it can divide the work.

## 08 Why the coalition wins

**8.1 The Coalition pool.** Each joint order pays 1 into your team's pool for
every power beyond the first. Each successful lend-lease transfer pays 1.
Electing a Supreme Commander in a theatre where three or more powers are
active pays 2. The pool is spent by any member, on rerolls, on seizing
initiative for a theatre, on emergency resupply, or on cancelling an
opponent's event card. A team that never coordinates never has any.

**8.2 Theatre command.** Each round, the powers active in a contested theatre
elect a Supreme Commander for it. The commander receives 3 extra command
points that may only be spent on other powers' units in that theatre. You
cannot use the office to help yourself.

**8.3 Asymmetric production.** Nobody holds industry, manpower, sea power, and
intelligence at once. The United States has the factories and, for the first
two years, no way to use them. The USSR has the manpower and no navy. Britain
has the fleet and the intelligence and a shortage of everything else. China
has people and almost no industry at all. The Axis has the same problem in
reverse.

**8.4 Glory is conditional.** Every power scores its national objective, and
those honors are tracked openly all game. Then, at the end, honors count for
nothing at all if your side lost the war.

*The fastest way to lose this game is to play it well by yourself.*

## 09 Neutrality

Three powers start outside the war: the Soviet Union, the United States, and
Thailand within the Independent States seat. Neutrality is a position on a
track, not a pause.

**The Pressure track.** Each neutral sits on a track from 0 to 10. Events move
it. Axis aggression against its interests moves it up. Allied diplomacy and
intelligence operations move it up. Axis intelligence operations and certain
event cards hold it down. At 7 or higher the power may enter the war by
choice, at the start of any round. At 10 it enters automatically. Being
attacked while neutral moves the track straight to 10 and grants the attacker
a first-strike advantage for one round only — the Barbarossa and Pearl Harbor
trade: a real opening advantage bought at the price of a permanent new enemy.

A neutral power takes orders as normal but cannot launch offensives outside
its own borders. It can build, fortify, run intelligence, and lend-lease.

**Open question, settled:** should a neutral player see the whole board, or
only what its intelligence rating reveals? Recommendation adopted: restricted,
with the UK able to spend an intelligence operation to brief a neutral.

## 10 Production and attrition

Production comes from industrial cities, adjusted by supply, bombing, and
blockade. It converts into strength, ships, and fortification in phase 4.6.

**Supply.** A territory out of supply produces nothing and defends at a worse
threshold, and supply traces through the theatre corridors. Cutting a corridor
is often worth more than winning a battle.

**The Home Front.** A stability score from 0 to 10 per power. It falls with
losses, strategic bombing, occupation, and failed offensives, and it rises
with victories and with objectives met. It scales your command points. At
zero, a power's seat changes: Italy flips, an Independent State defects, and a
major power enters forced negotiation.

## 11 Victory

Three ways to end it, checked at the end of every round.

**Total victory.** One team holds every enemy capital. The game ends
immediately. This should be rare and it should feel like it.

**Strategic victory.** At the end of summer 1945, the team with more victory
points wins. Points come from the 27 victory cities, weighted, plus Home Front
stability, minus the cities you lost. A margin under 5 is a contested peace
rather than a win, and both teams score it as such.

**Collapse.** A team whose combined Home Front falls below a threshold sues
for peace. The other side wins on the terms available at that moment.

Within the winning team, players rank by national objectives met. Within the
losing team, nobody ranks at all. That asymmetry is the point, and it should
be printed on the player aid where everyone can see it in round 1.

## 12 Playing it online

Everyone opens the same link on their own device. The page holds the board
state, and each action publishes a new version that every open view picks up.
A published page is readable by everyone who has it, so a secret order sheet
cannot simply be stored in the page and marked private.

**The fix: commit, then reveal.** In phase 4.3, your device hashes your order
text together with a random salt and publishes only the hash. In phase 4.4,
everyone publishes the text and the salt, and every device re-hashes and
checks it against what was committed. If the orders were changed after the
commit, the check fails and the table sees it. This is a few lines of browser
cryptography, it needs no server, and it gives the game something better than
trust.

**Cadence.** One round per sitting for a live game, or one round per day for a
play-by-message campaign with a council window on a group chat.

## 13 What to build first

1. The map — all 96 territories. ✅
2. One theatre, hot — the Eastern Front alone, enough to feel whether combined
   operations, command points, and the coin produce the tension the thesis
   claims. ✅ (superseded: the whole board is simulated)
3. Commit and reveal. ✅
4. The Coalition pool and theatre command, tested with a deliberately
   unbalanced table. ✅ (`node sim/run.js thesis`)
5. Cards last. ✅ (three full decks shipped)

**Open questions, and how the implementation settles them** (full rationale in
RULES.md): players — 2 to 8 humans, AI plays every empty seat, and the China
and Independent States seats can be system-run; council timer — soft by
default, hard timer optional; Italy flipping — the seat keeps playing, from
the co-belligerent south, on the Allied side, with objectives intact; twelve
rounds — kept, and the early war moves fast enough in play that 1939–40 does
not drag.
