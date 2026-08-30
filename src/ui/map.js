// The board: a real map. Genuine coastlines and boundaries from world-atlas
// 50m data, Miller-projected with the Pacific on the right so the USA sits
// between both oceans the way the game graph expects. Sea zones are charted
// regions under the land; neutral scenery is muted; the 96 playable
// territories carry their owner's color inside real borders.

import { POWERS } from '../engine/data.js';
import { THEATRES, CORRIDORS } from '../data/skeleton.js';
import { GEO, SEA_GEO, BACKDROP, MAP_W, MAP_H, THEATRE_BOXES } from '../data/generated/geometry.js';

const OWNER_COLORS = {
  france: '#456a94', vichy: '#7a7456', neutral: '#55606d', none: '#22303f',
};
const NATION_COLOR = '#7f5539';

export function ownerColor(owner) {
  if (POWERS[owner]) return POWERS[owner].color;
  if (OWNER_COLORS[owner]) return OWNER_COLORS[owner];
  return NATION_COLOR; // the Independent State nations
}

const OCEAN = '#0e1319';
const LAND_BASE = '#242c35';
const BACKDROP_FILL = '#1a2029';
const BORDER = '#0a0d12';

const d = poly => 'M' + poly.map(p => p.join(' ')).join('L') + 'Z';

export class BoardMap {
  constructor(container, game, callbacks = {}) {
    this.container = container;
    this.game = game;
    this.cb = callbacks;
    // Open on Europe, autumn 1939 — the World button steps back out.
    this.view = { x: -15, y: -25, w: 1180, h: MAP_H + 55 };
    this.selected = null;
    this.highlights = new Set();
    this.dimUnknown = null; // set of visible tids for fog, or null for full view
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'The war map');
    container.appendChild(this.svg);
    this.buildStatic();
    this.bindPanZoom();
  }

  anchor(tid) {
    return GEO[tid]?.anchor ?? SEA_GEO[tid]?.anchor
      ?? [this.game.map[tid].coords.x, this.game.map[tid].coords.y];
  }

  // Everything that never changes: ocean, graticule, sea charts, scenery,
  // land base, borders, names. Rebuilt once; per-render work is only fills,
  // overlays and badges.
  buildStatic() {
    const S = [];
    S.push(`<rect x="-2000" y="-2000" width="${MAP_W + 4000}" height="${MAP_H + 4000}" fill="${OCEAN}"/>`);
    // Faint graticule.
    for (let x = 0; x <= MAP_W; x += MAP_W / 18) {
      S.push(`<line x1="${x}" y1="0" x2="${x}" y2="${MAP_H}" stroke="#182029" stroke-width="0.7"/>`);
    }
    for (let y = 0; y <= MAP_H; y += MAP_H / 8) {
      S.push(`<line x1="0" y1="${y}" x2="${MAP_W}" y2="${y}" stroke="#182029" stroke-width="0.7"/>`);
    }
    this.staticBase = S.join('');

    // Sea zone charts: boundaries sit under the land, names float above it.
    const seaLines = [];
    const seaNames = [];
    for (const [sid, g] of Object.entries(SEA_GEO)) {
      const [x0, y0, x1, y1] = g.rect;
      seaLines.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"
        fill="none" stroke="#25313f" stroke-width="1" stroke-dasharray="6 5"/>`);
      const t = this.game.map[sid];
      seaNames.push(`<text x="${g.anchor[0]}" y="${y0 + 14}" text-anchor="middle"
        font-family="Oswald, sans-serif" font-size="11" letter-spacing="2.5"
        fill="#3d4c5e" paint-order="stroke" stroke="#0e1319" stroke-width="2.5"
        pointer-events="none">${t ? t.name.toUpperCase() : sid}</text>`);
    }
    this.staticSeaLines = seaLines.join('');
    this.staticSeaNames = '<g pointer-events="none">' + seaNames.join('') + '</g>';

    this.staticBackdrop = '<g pointer-events="none">' + BACKDROP.map(p =>
      `<path d="${d(p)}" fill="${BACKDROP_FILL}" stroke="#0d1218" stroke-width="0.6"/>`).join('') + '</g>';

    // Per-territory path data, cached.
    this.dCache = {};
    for (const [tid, g] of Object.entries(GEO)) {
      this.dCache[tid] = g.polys.map(d);
    }

    // Land base + name labels (names move with anchors, never change).
    const base = [];
    const names = [];
    for (const [tid, g] of Object.entries(GEO)) {
      for (const dd of this.dCache[tid]) {
        base.push(`<path d="${dd}" fill="${LAND_BASE}"/>`);
      }
      const t = this.game.map[tid];
      if (!t) continue;
      const [ax, ay] = g.anchor;
      names.push(`<text x="${ax}" y="${ay + 17}" text-anchor="middle" font-size="8.5"
        fill="#96a0ad" font-family="'IBM Plex Sans', sans-serif" paint-order="stroke"
        stroke="#0e1319" stroke-width="2.5">${t.name}</text>`);
    }
    this.staticLandBase = '<g pointer-events="none">' + base.join('') + '</g>';
    this.staticNames = '<g pointer-events="none">' + names.join('') + '</g>';

    // Corridor routes.
    const cor = [];
    for (const c of Object.values(CORRIDORS)) {
      for (const [a, b] of c.edges) {
        const [ax, ay] = this.anchor(a), [bx, by] = this.anchor(b);
        cor.push({ a, b, ax, ay, bx, by });
      }
    }
    this.corridorEdges = cor;
  }

  bindPanZoom() {
    let drag = null;
    this.svg.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y, moved: false };
      this.svg.classList.add('dragging');
      this.svg.setPointerCapture(e.pointerId);
    });
    this.svg.addEventListener('pointermove', e => {
      if (!drag) return;
      const scale = this.view.w / this.svg.clientWidth;
      const dx = (e.clientX - drag.x) * scale, dy = (e.clientY - drag.y) * scale;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      this.view.x = drag.vx - dx; this.view.y = drag.vy - dy;
      this.applyView();
    });
    this.svg.addEventListener('pointerup', e => {
      // Pointer capture redirects events to the svg, so clicks are resolved by
      // hit-testing under the cursor rather than per-node listeners.
      const wasDrag = drag && drag.moved;
      drag = null;
      this.svg.classList.remove('dragging');
      if (wasDrag) return;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const node = under && under.closest ? under.closest('.node') : null;
      if (node && this.cb.onTerritoryClick) this.cb.onTerritoryClick(node.dataset.tid);
      else if (this.cb.onBackgroundClick) this.cb.onBackgroundClick();
    });
    this.svg.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      const rect = this.svg.getBoundingClientRect();
      const mx = this.view.x + (e.clientX - rect.left) / rect.width * this.view.w;
      const my = this.view.y + (e.clientY - rect.top) / rect.height * this.view.h;
      const w = Math.min(MAP_W + 800, Math.max(180, this.view.w * factor));
      const h = w * (this.view.h / this.view.w);
      this.view.x = mx - (mx - this.view.x) * (w / this.view.w);
      this.view.y = my - (my - this.view.y) * (h / this.view.h);
      this.view.w = w; this.view.h = h;
      this.applyView();
    }, { passive: false });
  }

  applyView() {
    this.svg.setAttribute('viewBox', `${this.view.x} ${this.view.y} ${this.view.w} ${this.view.h}`);
  }

  focusTheatre(tid) {
    const b = THEATRE_BOXES[tid];
    const box = b
      ? { x: [b[0], b[2]], y: [b[1], b[3]] }
      : THEATRES[tid].box;
    const pad = 40;
    this.view = {
      x: box.x[0] - pad, y: box.y[0] - pad,
      w: box.x[1] - box.x[0] + pad * 2, h: box.y[1] - box.y[0] + pad * 2,
    };
    const aspect = 16 / 9;
    if (this.view.w / this.view.h < aspect) this.view.w = this.view.h * aspect;
    else this.view.h = this.view.w / aspect;
    this.applyView();
  }

  focusWorld() {
    this.view = { x: -20, y: -60, w: MAP_W + 40, h: MAP_H + 140 };
    this.applyView();
  }

  render(state) {
    const { map } = this.game;
    const S = [this.staticBase];

    // Sea zones: owner-tinted charts, clickable.
    for (const [sid, g] of Object.entries(SEA_GEO)) {
      const ts = state.t[sid];
      const [x0, y0, x1, y1] = g.rect;
      const held = ts && ts.owner !== 'none' && ts.strength > 0;
      const fill = held ? ownerColor(ts.owner) : '#3d5a7a';
      const fogged = this.dimUnknown && !this.dimUnknown.has(sid);
      S.push(`<g class="node" data-tid="${sid}" opacity="${fogged ? 0.25 : 1}" style="cursor:pointer">
        <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"
          fill="${fill}" fill-opacity="${held ? 0.14 : 0.05}"/></g>`);
    }
    S.push(this.staticSeaLines);
    S.push(this.staticBackdrop);
    S.push(this.staticLandBase);

    // Territories: owner wash inside real borders.
    for (const [tid, g] of Object.entries(GEO)) {
      const ts = state.t[tid];
      if (!ts) continue;
      const color = ownerColor(ts.owner);
      const sel = this.selected === tid;
      const hi = this.highlights.has(tid);
      const fogged = this.dimUnknown && !this.dimUnknown.has(tid);
      const stroke = sel ? '#f2efe4' : hi ? '#d9a441' : BORDER;
      const sw = sel ? 2.4 : hi ? 2 : 1;
      S.push(`<g class="node" data-tid="${tid}" opacity="${fogged ? 0.22 : 1}" style="cursor:pointer">`);
      for (const dd of this.dCache[tid]) {
        S.push(`<path d="${dd}" fill="${color}" fill-opacity="0.5" stroke="${stroke}"
          stroke-width="${sw}" stroke-linejoin="round"/>`);
      }
      if (g.chip) {
        const [ax, ay] = g.anchor;
        S.push(`<circle cx="${ax}" cy="${ay}" r="8" fill="${color}" fill-opacity="0.75"
          stroke="${stroke}" stroke-width="${sel || hi ? 2 : 1.2}"/>`);
      }
      S.push('</g>');
    }

    // Corridors: lamp-amber convoy routes.
    for (const e of this.corridorEdges) {
      const open = Object.entries(CORRIDORS).some(([cid, c]) =>
        c.edges.some(([x, y]) => (x === e.a && y === e.b) || (x === e.b && y === e.a))
        && state.corridors[cid].open);
      S.push(`<line x1="${e.ax}" y1="${e.ay}" x2="${e.bx}" y2="${e.by}"
        stroke="${open ? '#d9a441' : '#8a4a3a'}" stroke-width="2.2" stroke-dasharray="8 5"
        opacity="0.8" pointer-events="none"/>`);
    }

    // Spokes from the selected territory to its neighbours (replaces the old
    // always-on wire graph; a real map doesn't need it until you're aiming).
    if (this.selected && map[this.selected]) {
      const [ax, ay] = this.anchor(this.selected);
      for (const n of map[this.selected].adjacent) {
        const [bx, by] = this.anchor(n);
        if (Math.abs(bx - ax) > 1400) {
          // The two-ocean link: draw stubs exiting the map edges.
          const dir = bx > ax ? 1 : -1;
          S.push(`<line x1="${ax}" y1="${ay}" x2="${ax + dir * 60}" y2="${ay}"
            stroke="#8b93a0" stroke-width="1.3" stroke-dasharray="3 4" pointer-events="none"/>`);
          continue;
        }
        S.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"
          stroke="#8b93a0" stroke-width="1.1" stroke-dasharray="3 4" opacity="0.7"
          pointer-events="none"/>`);
      }
    }

    S.push(this.staticSeaNames);
    S.push(this.staticNames);

    // Badges: strength, stars, forts, supply, entrenchment.
    S.push('<g pointer-events="none">');
    for (const [tid, t] of Object.entries(map)) {
      const ts = state.t[tid];
      const [ax, ay] = this.anchor(tid);
      const fogged = this.dimUnknown && !this.dimUnknown.has(tid);
      if (fogged) continue;
      const color = ts.owner === 'none' ? '#22303f' : ownerColor(ts.owner);
      if (ts.strength > 0) {
        if (t.type === 'sea') {
          S.push(`<rect x="${ax - 8}" y="${ay - 8}" width="16" height="16" rx="2"
            transform="rotate(45 ${ax} ${ay})" fill="${color}" stroke="#0c0f14" stroke-width="1.2"/>`);
        } else {
          S.push(`<circle cx="${ax}" cy="${ay}" r="${8 + Math.min(4, ts.strength * 0.5)}"
            fill="${color}" stroke="#0c0f14" stroke-width="1.4"/>`);
        }
        S.push(`<text x="${ax}" y="${ay + 3.8}" text-anchor="middle"
          font-family="'IBM Plex Mono', monospace" font-size="10.5" font-weight="600"
          fill="#f2efe4">${ts.strength}</text>`);
      } else if (t.victoryCity || t.capitalOf) {
        S.push(`<circle cx="${ax}" cy="${ay}" r="3.5" fill="${color}" stroke="#0c0f14" stroke-width="1"/>`);
      }
      if (t.victoryCity) {
        S.push(`<text x="${ax}" y="${ay - 11}" text-anchor="middle" font-size="11"
          fill="#d9a441" paint-order="stroke" stroke="#0e1319" stroke-width="2">★</text>`);
      }
      if (t.capitalOf) {
        S.push(`<circle cx="${ax}" cy="${ay}" r="${ts.strength > 0 ? 13 : 6.5}" fill="none"
          stroke="#e8e0cd" stroke-width="1" opacity="0.8"/>`);
      }
      if (ts.fort > 0) {
        S.push(`<text x="${ax + 12}" y="${ay + 4}" font-size="9" fill="#c9d2dc"
          paint-order="stroke" stroke="#0e1319" stroke-width="2">${'▲'.repeat(ts.fort)}</text>`);
      }
      if (ts.entrenched) {
        S.push(`<circle cx="${ax}" cy="${ay}" r="${11 + Math.min(4, ts.strength * 0.5)}" fill="none"
          stroke="#9aa5b1" stroke-width="1" stroke-dasharray="2 3"/>`);
      }
      if (!ts.supplied && t.type === 'land' && ts.owner !== 'neutral' && ts.owner !== 'none') {
        S.push(`<circle cx="${ax - 12}" cy="${ay - 8}" r="3" fill="#c25b4e" stroke="#0e1319" stroke-width="1"/>`);
      }
    }
    S.push('</g>');

    this.svg.innerHTML = S.join('');
    this.applyView();

    for (const g of this.svg.querySelectorAll('.node')) {
      g.addEventListener('pointerenter', () => {
        if (this.cb.onHover) this.cb.onHover(g.dataset.tid);
      });
    }
  }
}
