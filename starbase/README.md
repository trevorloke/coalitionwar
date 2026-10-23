# Starbase

Supporter database and door-to-door canvassing app, piloting with
**Imagine Surrey**.

- **People database**: everyone the campaign knows (supporters, volunteers,
  lawn-sign requests, donors, email opt-ins), filled from canvassing, the
  website and CSV imports, de-duplicated automatically.
- **Canvass list**: every door in Surrey that you plan to knock, grouped into
  turfs and placed on the map with Google geocoding.
- **Phone app**: a map of houses. Tap a house, tap what happened, save. It
  works with no signal and uploads when the phone reconnects.
- **Website integration**: forms on the Imagine Surrey website feed straight
  into the database, and live counters on the website show doors knocked and
  volunteers.

It needs Node.js 22.5 or newer and nothing else: no npm packages, no
separate database server. The data lives in one SQLite file.

## Try it in two minutes

```sh
cd starbase
npm run demo     # loads demo turfs, ~460 addresses and some door knocks
npm start        # → http://localhost:8080
```

Sign in with `canvasser@starbase.demo`, `organizer@starbase.demo` or
`admin@starbase.demo`. The password for all three is `starbase-demo`. The demo
addresses follow Surrey's numbered street grid but are **made up**. They're
for training, not for knocking on real doors.

Without Google keys the map runs in **offline grid mode**, a built-in drawing
of Surrey's numbered Avenues and Streets. Everything else works the same.

## Connecting Google Maps

Starbase uses two Google keys, so each one can be locked down separately.

| Setting | Google API | Used for | Restrict it to |
|---|---|---|---|
| `GOOGLE_MAPS_BROWSER_KEY` | Maps JavaScript API | The canvass map on phones | **Website referrers**: your Starbase domain, e.g. `https://starbase.imaginesurrey.ca/*` |
| `GOOGLE_MAPS_SERVER_KEY` | Geocoding API | Turning imported addresses into map pins | **IP addresses**: your server's IP |
| `GOOGLE_MAPS_MAP_ID` (optional) | Map Management | Custom map styling. Without it, Google's `DEMO_MAP_ID` is used | — |

1. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project (e.g. "Starbase – Imagine Surrey") and attach billing. The Maps
   Platform free monthly usage is generous for a municipal campaign, but set
   a budget alert anyway.
2. Under **APIs & Services → Library**, enable **Maps JavaScript API** and
   **Geocoding API**.
3. Under **APIs & Services → Credentials**, create two API keys and restrict
   them as shown in the table above.
4. Optional: under **Google Maps Platform → Map Management**, create a
   JavaScript vector Map ID and set `GOOGLE_MAPS_MAP_ID`.
5. Set the variables and restart Starbase. Then go to **Canvass list** and
   press **Geocode with Google Maps** to place imported addresses on the map.

## Loading Imagine Surrey's canvass list

On **Canvass list → Import CSV**, upload one row per door. Either of these
formats works:

```csv
address,postal_code,neighbourhood
14250 104 Ave,V3T 1X1,City Centre / Whalley
305-10180 153 St,V3R 0Y5,Guildford
```

or `street_number,street_name,unit,...`. If you already have `lat` and `lng`
columns, the rows skip geocoding. Duplicate addresses are skipped, so it's
safe to re-import an updated list.

Next, create **Turfs** (walkable groups of doors), assign each one to a
canvasser, and add doors to them. You can fill a turf with a whole community,
or select rows in the canvass list and assign them.

People (supporter lists, past volunteers) are imported separately from
**People → Import CSV**. Existing records are matched by email, then phone,
and merged.

## Canvassing on a phone

Open Starbase in the phone's browser, sign in, and use **Add to Home Screen**
so it opens like an app.

- Houses are coloured by status: purple ring = not knocked yet, amber = not
  home / try again, green → red = support level, grey = refused, moved or no
  access, black ✕ = do not contact.
- **Tap a house**, then choose what happened. For a conversation, choose who
  you spoke with (or add them), their support level (1–5), the issues they
  raised, and whether they want a lawn sign, want to volunteer, or are OK with
  email. Then save.
- **➜** jumps to the nearest house you haven't knocked yet. **◎** shows where
  you are. **☰** lists the houses, nearest first. **＋** adds a house that's
  missing from the list: tap the spot on the map.
- With no signal, saves are kept on the phone. A "⇪ N to upload" chip appears
  at the top, and the results upload when the phone reconnects.

Canvassers see residents' names and how they lean, but **not** their email
addresses or phone numbers. Only organizers and admins see contact details.

## Website integration

In **Website**, an admin creates a **public key** (`pk_…`) and lists the
website's origins (e.g. `https://imaginesurrey.ca`). Then paste this into the
website:

```html
<script src="https://YOUR-STARBASE/embed/starbase.js" data-key="pk_..." defer></script>

<form data-starbase-form="volunteer">
  <input name="first_name" required> <input name="last_name">
  <input name="email" type="email" required> <input name="phone">
  <input name="postal_code">
  <label><input type="checkbox" name="email_opt_in" value="1"> Send me updates</label>
  <button>Volunteer</button>
</form>

<span data-starbase-stat="doors_knocked">0</span> doors knocked
```

The available forms are `signup`, `volunteer`, `sign` (lawn sign), `contact`,
`pledge` and `endorse`. The counters are `doors_knocked`, `conversations`,
`volunteers`, `sign_requests` and `supporters`. A full working page is in
[`website/example.html`](website/example.html). While Starbase is running, open
it at `/embed/example.html?key=pk_...`.

Each submission is merged into the People database: it updates the existing
person if the email or phone matches, and creates a new one otherwise. The
person is tagged `web:<form>`. Every submission is also logged under
**Website → Recent submissions**. Spam is blocked by a hidden honeypot
field, a per-IP rate limit, and the key's origin lock.

**Server-to-server sync.** For a website backend, Zapier/Make, or a mailing
tool, use a **secret key** (`sk_…`). Never put a secret key in a web page.

```
GET  /api/v1/people?updated_since=2026-01-01&page=1&page_size=500
POST /api/v1/people            {"people":[{"email":"…","first_name":"…","tags":["donor"]}]}
GET  /api/v1/stats
Authorization: Bearer sk_…
```

**Webhooks.** Set `STARBASE_WEBHOOK_URL` and Starbase will POST
`person.created`, `person.updated` and `person.deleted` events there. If
`STARBASE_WEBHOOK_SECRET` is also set, each request is signed with
`X-Starbase-Signature: sha256=<HMAC of the body>`.

## Roles

| | Canvasser | Organizer | Admin |
|---|:-:|:-:|:-:|
| Canvass map, record doors | ✓ | ✓ | ✓ |
| Dashboard, people, canvass list, turfs, door-knock log, CSV import/export | | ✓ | ✓ |
| Add teammates, reset passwords, website API keys, delete records | | | ✓ |

On first start, Starbase creates an admin account and prints the password
once. To choose it yourself, set `STARBASE_ADMIN_EMAIL` and
`STARBASE_ADMIN_PASSWORD`.

## Deploying

Starbase is a single Node process plus a data folder. It must be served over
**HTTPS**, because phones only allow location access and offline mode on
secure sites.

```sh
docker build -t starbase starbase/
docker run -p 8080:8080 -v starbase-data:/app/data \
  -e GOOGLE_MAPS_BROWSER_KEY=... -e GOOGLE_MAPS_SERVER_KEY=... \
  -e STARBASE_ADMIN_EMAIL=you@imaginesurrey.ca -e STARBASE_ADMIN_PASSWORD=... starbase
```

Any host with a persistent disk will run it, for example Render, Fly.io,
Railway, or a small VPS behind Caddy or nginx. Back up `data/starbase.db`, for
example with a nightly `sqlite3 data/starbase.db ".backup backup.db"`.

| Variable | Default | |
|---|---|---|
| `PORT` | `8080` | |
| `STARBASE_DB` | `data/starbase.db` | Database file |
| `STARBASE_ORG` | `Imagine Surrey` | Organization name shown in the app |
| `GOOGLE_MAPS_BROWSER_KEY` / `GOOGLE_MAPS_SERVER_KEY` / `GOOGLE_MAPS_MAP_ID` | — | See above |
| `STARBASE_CORS_ORIGINS` | — | Extra origins allowed to call the website API, in addition to those set on public keys |
| `STARBASE_WEBHOOK_URL` / `STARBASE_WEBHOOK_SECRET` | — | Outbound webhooks |
| `TRUST_PROXY` | — | Set to `1` behind a reverse proxy, so rate limits see real client IPs |

## Privacy and data handling

Starbase holds personal information, so treat it like a membership list:

- Collect only what the campaign needs, and honour **Do not contact** at once.
  It flags the address on every canvasser's map.
- If you import the voters list or other regulated data, check the
  permitted-use rules that came with it, and BC's *Personal Information
  Protection Act*, before loading it.
- Exports are recorded in the audit log, and only organizers and admins can
  export.
- Passwords are hashed with scrypt. Session tokens and API keys are stored
  only as SHA-256 hashes.

## Development

```sh
npm test         # API test suite (node --test, in-memory database)
```

| Path | What |
|---|---|
| `server/index.js` | HTTP server, static files, CORS |
| `server/api.js` | Every endpoint: staff app, `/api/public`, `/api/v1` |
| `server/services.js` | Person matching and merging, recording door knocks, stats, webhooks |
| `server/db.js` | SQLite schema |
| `server/geocode.js` | Google Geocoding, limited to Surrey's bounds |
| `server/seed.js` | First-run admin and demo data |
| `public/` | The app (no build step): `js/canvass.js` is the phone map, `js/admin.js` the organizer screens, `js/maps.js` the Google Maps and offline grid maps |
| `website/` | The embed script and example page for the Imagine Surrey website |
