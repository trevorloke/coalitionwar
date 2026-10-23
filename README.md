# Coalition 1939

An eight-player WWII grand-strategy game where **the side that coordinates
beats the side that has the best player on it**. Eight powers, 96 territories,
12 rounds from autumn 1939 to summer 1945; three decks, dice, and one coin.

Built from the design document in [`docs/GDD.md`](docs/GDD.md). The complete
rules are in [`RULES.md`](RULES.md).

## Play it

```sh
npm run build          # → dist/index.html, a single self-contained file
```

Open `dist/index.html` in any browser. Pick which of the eight seats are
human; the AI plays the rest. One human against seven AI is a full game;
hot-seat passes one device around the table with cover screens between
secret order sheets.

**Online**: the same page, published as a Claude artifact, becomes the table —
every player opens the link, claims a seat, and writes orders on their own
device. Secret orders use commit-then-reveal (SHA-256 + salt, checked by
every device at the reveal), and each round's dice are seeded from the hash
of all the reveals, so they are provably unknowable before the sheets are
sealed. See GDD §12 and RULES §10.

## The thesis, mechanically

- **Combined operations**: 12 dice alone hit on 5+ (≈4 hits). The same 12
  dice from two powers hit on 4+ (≈6). From three, 3+ (≈8). No power may
  commit more than 8 strength to one offensive: the biggest attacks are
  structurally impossible alone.
- **The Coalition pool** is earned only by coordinating (joint orders,
  lend-lease, electing theatre commanders) and buys rerolls, initiative,
  resupply, and event cancellations.
- **Glory is conditional**: national objectives are tracked all game and
  are void if your side loses.

Run the design's own falsification test (GDD §13.4):

```sh
node sim/run.js thesis 20   # coordinated vs uncoordinated, mirrored seeds
```

## Development

```sh
npm test               # engine test suite (node --test)
npm run validate       # map + deck content validation against docs/CONTRACT.md
npm run sim            # five quick AI-vs-AI games
node sim/run.js game 7 # one verbose game, full log
```

| Path | What |
|---|---|
| `docs/GDD.md` | The design document (v0.1) |
| `docs/CONTRACT.md` | Data schemas, the card-effect DSL, engine constants |
| `RULES.md` | The complete rulebook, open questions settled |
| `src/data/` | Powers, map skeleton, generated content (territories, 110 strategy cards, 28 ops cards, 16 doctrines) |
| `src/engine/` | Deterministic rules engine (no DOM, fully testable) |
| `src/ui/` | The war-room UI (SVG board, order sheets, commit-reveal) |
| `sim/` | AI-vs-AI simulation and content validators |
| `tools/` | Map geometry builder (`npm run map`): real coastlines and boundaries from world-atlas 50m data, Miller-projected Pacific-right |
| `build.js` | Bundles everything into one HTML file |

The engine is deterministic from its seed: every die, draw, and the coin come
from one RNG stream, so a game replays identically and online players can
verify each other's rounds.

## Also in this repository: Starbase

[`starbase/`](starbase/) is a separate app: a supporter database and
door-to-door canvassing tool with a Google Maps phone view, piloting with
Imagine Surrey. See [`starbase/README.md`](starbase/README.md).
