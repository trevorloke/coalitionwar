// Builds real map geometry for the board from world-atlas 50m country data.
// Every playable territory becomes one or more genuine polygons (whole
// countries, merged groups, or lat/lon-tiled slices of split countries),
// projected Pacific-right so the USA sits between both oceans exactly as the
// game graph expects. Output: src/data/generated/geometry.js.
//
//   node tools/build-map-geometry.js /path/to/countries-50m.json

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = process.argv[2] ?? path.join(ROOT, 'tools/data/countries-50m.json');

// ——— canvas & projection ———
const WRAP_AT = -38;            // lon < -38 shifts +360 (Pacific-centered-ish)
const LON = [-38, 310];         // canvas longitude domain (wrapped)
const LAT = [-12.5, 72.5];
const W = 2600;
const millerY = lat => 1.25 * Math.asinh(Math.tan(0.8 * lat * Math.PI / 180));
const Y0 = millerY(LAT[1]), Y1 = millerY(LAT[0]);
const H = Math.round(W * (Y0 - Y1) / ((LON[1] - LON[0]) * Math.PI / 180));
const px = lon => (lon - LON[0]) / (LON[1] - LON[0]) * W;
const py = lat => (Y0 - millerY(lat)) / (Y0 - Y1) * H;

// ——— minimal TopoJSON decoding ———
const topo = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map(arc => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});
function ringFrom(arcIdxs) {
  const pts = [];
  for (const idx of arcIdxs) {
    const a = idx < 0 ? arcs[~idx].slice().reverse() : arcs[idx];
    for (let i = pts.length ? 1 : 0; i < a.length; i++) pts.push(a[i]);
  }
  return pts;
}
const countries = {};
for (const g of topo.objects.countries.geometries) {
  const polys = [];
  const raw = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
  for (const poly of raw) polys.push(ringFrom(poly[0])); // outer rings only
  countries[g.properties.name] = polys;
}

// ——— geometry helpers (lon/lat space, wrapped) ———
const wrapRing = ring => {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const shift = cx < WRAP_AT ? 360 : 0;
  return ring.map(([x, y]) => [x + shift, y]);
};
function clipHalf(ring, axis, limit, keepBelow) {
  // Sutherland–Hodgman against one axis-aligned half-plane.
  const inside = p => keepBelow ? p[axis] <= limit : p[axis] >= limit;
  const cross = (a, b) => {
    const t = (limit - a[axis]) / (b[axis] - a[axis]);
    return axis === 0
      ? [limit, a[1] + t * (b[1] - a[1])]
      : [a[0] + t * (b[0] - a[0]), limit];
  };
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (inside(a)) {
      out.push(a);
      if (!inside(b)) out.push(cross(a, b));
    } else if (inside(b)) {
      out.push(cross(a, b));
    }
  }
  return out;
}
function clipBox(ring, [x0, x1, y0, y1]) {
  let r = ring;
  r = clipHalf(r, 0, x0, false); if (r.length < 3) return null;
  r = clipHalf(r, 0, x1, true); if (r.length < 3) return null;
  r = clipHalf(r, 1, y0, false); if (r.length < 3) return null;
  r = clipHalf(r, 1, y1, true); if (r.length < 3) return null;
  return r;
}
const areaOf = ring => Math.abs(ring.reduce((s, p, i) => {
  const q = ring[(i + 1) % ring.length];
  return s + (p[0] * q[1] - q[0] * p[1]);
}, 0) / 2);
function simplify(ring, tol) {
  // Douglas–Peucker on a closed ring (canvas space).
  if (ring.length <= 8) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const [ax, ay] = ring[i], [bx, by] = ring[j];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    let worst = -1, wd = tol * tol;
    for (let k = i + 1; k < j; k++) {
      const t = Math.max(0, Math.min(1, ((ring[k][0] - ax) * dx + (ring[k][1] - ay) * dy) / len2));
      const ex = ax + t * dx - ring[k][0], ey = ay + t * dy - ring[k][1];
      const d = ex * ex + ey * ey;
      if (d > wd) { wd = d; worst = k; }
    }
    if (worst > 0) { keep[worst] = 1; stack.push([i, worst], [worst, j]); }
  }
  return ring.filter((_, i) => keep[i]);
}
const project = ring => ring.map(([lon, lat]) => [
  Math.round(px(lon) * 10) / 10, Math.round(py(lat) * 10) / 10,
]);

// ——— territory specification ———
// take(country) consumes it; slice(country, tiles) carves DISJOINT lat/lon
// boxes [lonMin, lonMax, latMin, latMax] — anything a box misses stays with
// the remainder owner.
const consumed = new Set();
const terrPolys = {};   // tid -> array of lon/lat rings
const add = (tid, ring) => {
  if (!ring || ring.length < 3 || areaOf(ring) < 0.02) return;
  (terrPolys[tid] = terrPolys[tid] || []).push(ring);
};
function take(tid, ...names) {
  for (const n of names) {
    if (!countries[n]) { console.warn(`missing country: ${n}`); continue; }
    consumed.add(n);
    for (const ring of countries[n]) add(tid, wrapRing(ring));
  }
}
function slice(name, tiles, remainderTid = null, dropRings = () => false) {
  if (!countries[name]) { console.warn(`missing country: ${name}`); return; }
  consumed.add(name);
  for (const raw of countries[name]) {
    const ring = wrapRing(raw);
    if (dropRings(ring)) continue;
    let claimed = 0;
    for (const [tid, boxes] of tiles) {
      for (const box of boxes) {
        const piece = clipBox(ring, box);
        if (piece) { add(tid, piece); claimed += areaOf(piece); }
      }
    }
    if (remainderTid && claimed < areaOf(ring) * 0.98) {
      // Uncovered slivers go to the remainder via the complement boxes trick:
      // clip against the whole domain, subtracting handled by drawing order is
      // not possible — instead, remainder tiles must be listed explicitly.
      // (Specs below always cover their country, so this is just a warning.)
      if (claimed < areaOf(ring) * 0.5) add(remainderTid, ring);
      else console.warn(`  ${name}: ring ~${Math.round((1 - claimed / areaOf(ring)) * 100)}% unclaimed`);
    }
  }
}

// Whole-country territories.
take('britain', 'United Kingdom');
take('low_countries', 'Belgium', 'Netherlands', 'Luxembourg');
take('bohemia', 'Czechia');
take('austria', 'Austria');
take('hungary', 'Hungary');
take('slovakia', 'Slovakia');
take('croatia', 'Croatia', 'Slovenia', 'Bosnia and Herz.');
take('serbia', 'Serbia', 'Kosovo', 'Montenegro', 'Macedonia');
take('romania', 'Romania', 'Moldova');
take('bulgaria', 'Bulgaria');
take('greece', 'Greece');
take('albania', 'Albania');
take('denmark', 'Denmark');
take('sweden', 'Sweden');
take('finland', 'Finland');
take('baltic_states', 'Estonia', 'Latvia', 'Lithuania');
take('belorussia', 'Belarus');
take('baku', 'Georgia', 'Armenia', 'Azerbaijan');
take('egypt', 'Egypt');
take('tunisia', 'Tunisia');
take('fr_n_africa', 'Morocco', 'Algeria');
take('malta', 'Malta');
take('korea', 'North Korea', 'South Korea');
take('japan', 'Japan', 'Taiwan');
take('burma', 'Myanmar');
take('thailand', 'Thailand');
take('indochina', 'Vietnam', 'Laos', 'Cambodia');
take('india', 'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan');
take('philippines', 'Philippines');
take('solomons', 'Solomon Is.');
take('marianas', 'Guam', 'N. Mariana Is.');
take('siberia', 'Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Mongolia');

// Split countries (disjoint tilings; boxes are [lonMin, lonMax, latMin, latMax]).
slice('France', [
  ['s_france', [[-10, 12, 30, 46.6]]],
  ['normandy', [[-10, 1.0, 47.8, 52]]],
  ['paris', [[1.0, 12, 46.6, 52], [-10, 1.0, 46.6, 47.8]]],
]);
slice('Germany', [
  ['s_germany', [[0, 20, 40, 49.8]]],
  ['rhineland', [[0, 10.2, 49.8, 51.2]]],
  ['ruhr', [[0, 10.2, 51.2, 60]]],
  ['berlin', [[10.2, 20, 49.8, 60]]],
]);
slice('Poland', [
  ['w_poland', [[10, 19.3, 45, 58]]],
  ['e_poland', [[19.3, 30, 45, 58]]],
]);
slice('Ukraine', [
  ['w_ukraine', [[20, 29.3, 42, 54]]],
  ['kiev', [[29.3, 33.8, 47.6, 54]]],
  ['odessa', [[29.3, 33.8, 46.5, 47.6], [29.3, 32.3, 42, 46.5]]],
  ['crimea', [[32.3, 37.2, 42, 46.5]]],
  ['kharkov', [[33.8, 42, 46.5, 54]]],
]);
slice('Norway', [
  ['norway', [[0, 40, 50, 65]]],
  ['n_norway', [[0, 40, 65, 90]]],
]);
slice('Italy', [
  ['sicily', [[10, 15.65, 30, 38.4]]],
  ['s_italy', [[5, 20, 38.4, 43.6], [15.65, 20, 30, 38.4], [5, 10, 30, 43.6]]],
  ['n_italy', [[5, 20, 43.6, 48]]],
]);
slice('Libya', [
  ['tripolitania', [[8, 17.5, 18, 34]]],
  ['cyrenaica', [[17.5, 26, 18, 34]]],
]);
slice('Russia', [
  ['murmansk', [[26, 44, 64.4, 90]]],
  ['karelia', [[26, 44, 60.5, 64.4]]],
  ['leningrad', [[26, 36.5, 56.9, 60.5]]],
  ['smolensk', [[30, 36.5, 52.4, 56.9]]],
  ['moscow', [[36.5, 44, 52.4, 60.5]]],
  ['orel', [[30, 40, 49.5, 52.4]]],
  ['rostov', [[36.5, 42.5, 43.5, 49.5]]],
  ['stalingrad', [[42.5, 50, 43.5, 52.4]]],
  ['kuban', [[36.5, 50, 40, 43.5]]],
  ['urals', [[44, 62, 52.4, 64.4], [50, 62, 40, 52.4]]],
  ['siberia', [[62, 200, 40, 90], [44, 62, 64.4, 90]]],
], 'siberia', ring => {
  // Kaliningrad exclave would land inside the Baltic theatre; drop it.
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return cx > 19 && cx < 24 && cy > 54 && cy < 56;
});
slice('China', [
  ['sinkiang', [[70, 97, 15, 55]]],
  ['manchuria', [[119.8, 140, 40.5, 55]]],
  ['inner_mongolia', [[97, 119.8, 41, 55], [110.5, 119.8, 40.5, 41]]],
  ['shensi', [[97, 110.5, 33, 41]]],
  ['chongqing', [[97, 110.5, 28.5, 33]]],
  ['yunnan', [[97, 106, 15, 28.5]]],
  ['n_china', [[110.5, 114.5, 35.5, 40.5], [114.5, 119.8, 38.3, 40.5]]],
  ['shantung', [[114.5, 118, 34.3, 38.3], [118, 126, 35.5, 38.3]]],
  ['shanghai', [[118, 126, 28.5, 35.5]]],
  ['c_china', [[110.5, 118, 28.5, 35.5], [110.5, 114.5, 34.3, 35.5]]],
  ['s_china', [[106, 126, 15, 28.5]]],
], 's_china');
if (countries['Hong Kong']) take('s_china', 'Hong Kong');
if (countries['Macao']) take('s_china', 'Macao');
slice('Malaysia', [
  ['malaya', [[95, 105.5, -5, 10]]],
  ['dei', [[105.5, 125, -5, 10]]],
]);
take('dei', 'Brunei', 'Timor-Leste');
slice('Indonesia', [
  ['dei', [[90, 130, -12.4, 10]]],
  ['new_guinea', [[130, 155, -12.4, 10]]],
]);
take('new_guinea', 'Papua New Guinea');
slice('United States of America', [
  ['hawaii', [[195, 212, 15, 25]]],
  ['united_states', [[170, 310, 25, 72.4], [212, 310, 15, 25]]],
]);

// Tiny outposts with no usable real footprint become island chips.
const SYNTH = {
  gibraltar: [-5.6, 36.05],
  midway: [182.6, 28.2],
  malta: [14.4, 35.9],
  marianas: [145.7, 15.2],
};

// Backdrop: real countries that are scenery, not play space.
const backdrop = [];
for (const [name, polys] of Object.entries(countries)) {
  if (consumed.has(name) || name === 'Greenland' || name === 'Antarctica') continue;
  for (const raw of polys) {
    let ring = wrapRing(raw);
    ring = clipBox(ring, [LON[0], LON[1], LAT[0], LAT[1]]);
    if (!ring || areaOf(ring) < 0.4) continue;
    backdrop.push(ring);
  }
}

// ——— sea zones (wrapped lon/lat boxes; land renders on top) ———
const SEAS = {
  eastern_seaboard: [293, 310, 24, 46],
  north_atlantic: [-38, -11, 50, 66.5],
  mid_atlantic: [-38, -11, 27, 50],
  western_approaches: [-11, -3.5, 46, 58.5],
  biscay: [-11, 0.5, 42.7, 46],
  north_sea: [-3.5, 9, 51, 61.5],
  norwegian_sea: [-11, 18, 61.5, 72.4],
  baltic_sea: [9, 30.5, 53.3, 66],
  west_med: [-6.5, 8.5, 35, 44.5],
  central_med: [8.5, 20.5, 30.2, 45.8],
  east_med: [20.5, 36.5, 30.2, 38.5],
  bay_of_bengal: [79.5, 99, 4, 22.5],
  indian_ocean: [43, 104, -12.4, 4],
  central_pacific: [133, 210, 9, 34],
  south_pacific: [133, 185, -12.4, 9],
};

// ——— project, simplify, assemble ———
const TOL = 1.1;             // px simplification tolerance
const MIN_AREA_PX = 22;      // rings smaller than this vanish (chips replace)
const out = {};
for (const [tid, rings] of Object.entries(terrPolys)) {
  const polys = [];
  for (const ring of rings) {
    const clipped = clipBox(ring, [LON[0], LON[1], LAT[0], LAT[1]]);
    if (!clipped) continue;
    const proj = simplify(project(clipped), TOL);
    if (proj.length >= 3 && areaOf(proj) >= MIN_AREA_PX) polys.push(proj);
  }
  polys.sort((a, b) => areaOf(b) - areaOf(a));
  if (polys.length) out[tid] = polys;
}
for (const [tid, [lon, lat]] of Object.entries(SYNTH)) {
  const cur = out[tid] ?? (out[tid] = []);
  // If real geometry survived the size filter, keep it AND mark as a chip so
  // the renderer still draws a legible island marker.
  cur.chip = true;
  cur.anchor = [px(lon), py(lat)];
}
// Territories whose real footprint is too small also become chips.
for (const [tid, polys] of Object.entries(out)) {
  const total = polys.reduce((s, p) => s + areaOf(p), 0);
  if (total > 0 && total < 55 && polys.length <= 2) out[tid].chip = true;
}

// Anchors: centroid of the largest ring, with hand overrides for sprawlers.
const ANCHOR_LL = {
  siberia: [86, 57], united_states: [258.5, 39.5], norway: [8.2, 60.8],
  n_norway: [15, 68.3], sweden: [15.5, 59.8], finland: [26, 62.5],
  japan: [138.5, 36.5], dei: [110, -2.5], new_guinea: [143.5, -5.5],
  india: [78, 22.5], egypt: [30.5, 27], fr_n_africa: [0, 31.5],
  britain: [-1.5, 52.7], greece: [22.2, 39.2], croatia: [17.5, 44.8],
  urals: [55, 56.5], kuban: [42.5, 42.3], stalingrad: [45.5, 49],
  manchuria: [125.5, 46], inner_mongolia: [108, 43.5], sinkiang: [85, 38],
  s_china: [112.5, 24], indochina: [105.5, 15], malaya: [102, 4.5],
  philippines: [122, 13], hawaii: [202.5, 20.5], marianas: [145.6, 16.5],
  solomons: [160, -9], tripolitania: [13.5, 28.5], cyrenaica: [21.5, 28.5],
  denmark: [9.2, 56], baltic_states: [24.5, 56.9], w_ukraine: [25.5, 49.8],
  s_italy: [14.6, 40.8], sicily: [13.4, 37.55], n_italy: [9.8, 44.8],
};
function centroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length];
    const c = x0 * y1 - x1 * y0;
    a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  }
  a /= 2;
  return a ? [cx / (6 * a), cy / (6 * a)] : ring[0];
}
const GEO = {};
for (const [tid, polys] of Object.entries(out)) {
  const anchor = ANCHOR_LL[tid]
    ? [px(ANCHOR_LL[tid][0]), py(ANCHOR_LL[tid][1])]
    : polys.anchor ?? (polys[0] ? centroid(polys[0]) : [0, 0]);
  GEO[tid] = {
    polys: polys.map(p => p.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])),
    anchor: [Math.round(anchor[0]), Math.round(anchor[1])],
    chip: polys.chip ?? false,
  };
}
const BACKDROP = backdrop
  .map(r => simplify(project(r), TOL * 1.6))
  .filter(r => r.length >= 3 && areaOf(r) >= 40)
  .map(p => p.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
const SEA_GEO = {};
for (const [sid, [x0, x1, y0, y1]] of Object.entries(SEAS)) {
  SEA_GEO[sid] = {
    rect: [Math.round(px(x0)), Math.round(py(y1)), Math.round(px(x1)), Math.round(py(y0))],
    anchor: [Math.round((px(x0) + px(x1)) / 2), Math.round((py(y0) + py(y1)) / 2)],
  };
}

// Sanity: every one of the 96 territories must be covered.
import('../src/data/skeleton.js').then(({ SKELETON, THEATRES }) => {
  const missing = SKELETON.filter(t =>
    t.type === 'sea' ? !SEA_GEO[t.id] : !GEO[t.id] || (!GEO[t.id].polys.length && !GEO[t.id].chip));
  if (missing.length) {
    console.error('MISSING geometry:', missing.map(t => t.id).join(', '));
    process.exit(1);
  }
  // Theatre view boxes from real geometry.
  const boxes = {};
  for (const t of SKELETON) {
    const g = t.type === 'sea' ? null : GEO[t.id];
    const pts = t.type === 'sea'
      ? [[SEA_GEO[t.id].rect[0], SEA_GEO[t.id].rect[1]], [SEA_GEO[t.id].rect[2], SEA_GEO[t.id].rect[3]]]
      : (g.polys.flat().length ? g.polys.flat() : [g.anchor]);
    const b = boxes[t.theatre] = boxes[t.theatre] || [1e9, 1e9, -1e9, -1e9];
    for (const [x, y] of pts) {
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
    }
  }
  // Siberia stretches the eastern theatre absurdly; trim sprawl for focus views.
  if (boxes.eastern) boxes.eastern[2] = Math.min(boxes.eastern[2], px(65));
  if (boxes.scandinavia) boxes.scandinavia[2] = Math.min(boxes.scandinavia[2], px(45));

  const hdr = '// GENERATED by tools/build-map-geometry.js from world-atlas 50m data.\n' +
    '// Real coastlines and boundaries, Miller projection, Pacific-right wrap.\n';
  const js = hdr +
    `export const MAP_W = ${W};\nexport const MAP_H = ${H};\n` +
    `export const GEO = ${JSON.stringify(GEO)};\n` +
    `export const SEA_GEO = ${JSON.stringify(SEA_GEO)};\n` +
    `export const BACKDROP = ${JSON.stringify(BACKDROP)};\n` +
    `export const THEATRE_BOXES = ${JSON.stringify(Object.fromEntries(
      Object.entries(boxes).map(([k, b]) => [k, b.map(Math.round)])))};\n`;
  fs.writeFileSync(path.join(ROOT, 'src/data/generated/geometry.js'), js);
  const kb = (js.length / 1024).toFixed(0);
  console.log(`geometry.js written: ${kb} KB, canvas ${W}x${H}, ` +
    `${Object.keys(GEO).length} land territories, ${BACKDROP.length} backdrop rings`);
});
