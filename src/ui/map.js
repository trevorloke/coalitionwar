// The board: a pannable, zoomable SVG of the 96-territory graph. Land is a
// disc, sea a diamond; the wire between them is the adjacency graph, with the
// three two-power corridors in lamp amber.

import { POWERS } from '../engine/data.js';
import { THEATRES, CORRIDORS } from '../data/skeleton.js';

const OWNER_COLORS = {
  france: '#456a94', vichy: '#7a7456', neutral: '#4a5462', none: '#22303f',
};
const NATION_COLOR = '#7f5539';

export function ownerColor(owner) {
  if (POWERS[owner]) return POWERS[owner].color;
  if (OWNER_COLORS[owner]) return OWNER_COLORS[owner];
  return NATION_COLOR; // the Independent State nations
}

export class BoardMap {
  constructor(container, game, callbacks = {}) {
    this.container = container;
    this.game = game;
    this.cb = callbacks;
    this.view = { x: 0, y: 0, w: 1650, h: 900 };
    this.selected = null;
    this.highlights = new Set();
    this.dimUnknown = null; // set of visible tids for fog, or null for full view
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'The war map');
    container.appendChild(this.svg);
    this.bindPanZoom();
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
      const w = Math.min(2200, Math.max(220, this.view.w * factor));
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
    const box = THEATRES[tid].box;
    const pad = 60;
    this.view = {
      x: box.x[0] - pad, y: box.y[0] - pad,
      w: box.x[1] - box.x[0] + pad * 2, h: box.y[1] - box.y[0] + pad * 2,
    };
    // keep aspect sane
    const aspect = 16 / 9;
    if (this.view.w / this.view.h < aspect) this.view.w = this.view.h * aspect;
    else this.view.h = this.view.w / aspect;
    this.applyView();
  }

  focusWorld() {
    this.view = { x: 0, y: 0, w: 1650, h: 900 };
    this.applyView();
  }

  render(state) {
    const { map } = this.game;
    const S = [];
    S.push(`<rect x="-400" y="-400" width="2600" height="1800" fill="#131820"/>`);

    // Theatre labels.
    for (const [tid, th] of Object.entries(THEATRES)) {
      const cx = (th.box.x[0] + th.box.x[1]) / 2, cy = th.box.y[0] - 8;
      S.push(`<text x="${cx}" y="${cy}" text-anchor="middle" font-family="Oswald, sans-serif"
        font-size="13" letter-spacing="2" fill="#3d4856">${th.name.toUpperCase()}</text>`);
    }

    // Edges (dedup), corridors in amber.
    const corridorEdges = new Set();
    for (const c of Object.values(CORRIDORS)) {
      for (const [a, b] of c.edges) corridorEdges.add([a, b].sort().join('|'));
    }
    const drawn = new Set();
    for (const [tid, t] of Object.entries(map)) {
      for (const n of t.adjacent) {
        const key = [tid, n].sort().join('|');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const a = map[tid].coords, b = map[n].coords;
        if (corridorEdges.has(key)) {
          const open = Object.entries(CORRIDORS).some(([cid, c]) =>
            c.edges.some(([x, y]) => [x, y].sort().join('|') === key) && state.corridors[cid].open);
          S.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
            stroke="${open ? '#d9a441' : '#8a4a3a'}" stroke-width="2.4" stroke-dasharray="7 4" opacity="0.85"/>`);
        } else {
          S.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#2e3947" stroke-width="1"/>`);
        }
      }
    }

    // Nodes.
    for (const [tid, t] of Object.entries(map)) {
      const ts = state.t[tid];
      const { x, y } = t.coords;
      const color = ts.owner === 'none' ? '#22303f' : ownerColor(ts.owner);
      const r = 9 + Math.min(7, ts.strength);
      const sel = this.selected === tid;
      const hi = this.highlights.has(tid);
      const fogged = this.dimUnknown && !this.dimUnknown.has(tid);
      const stroke = sel ? '#ffffff' : hi ? '#d9a441' : t.capitalOf ? '#e8e0cd' : '#0c0f14';
      const sw = sel || hi ? 2.5 : t.capitalOf ? 2 : 1;
      const op = fogged ? 0.18 : 1;
      S.push(`<g class="node" data-tid="${tid}" opacity="${op}" style="cursor:pointer">`);
      if (t.type === 'sea') {
        S.push(`<rect x="${x - r * 0.85}" y="${y - r * 0.85}" width="${r * 1.7}" height="${r * 1.7}"
          transform="rotate(45 ${x} ${y})" fill="${ts.strength > 0 ? color : '#1b2836'}"
          stroke="${stroke}" stroke-width="${sw}" rx="2"/>`);
      } else {
        S.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>`);
      }
      if (!fogged) {
        if (t.victoryCity) {
          S.push(`<text x="${x}" y="${y - r - 5}" text-anchor="middle" font-size="11" fill="#d9a441">★</text>`);
        }
        if (ts.fort > 0) {
          S.push(`<text x="${x + r + 2}" y="${y + 4}" font-size="9" fill="#9aa5b1">${'▲'.repeat(ts.fort)}</text>`);
        }
        if (ts.entrenched) {
          S.push(`<circle cx="${x}" cy="${y}" r="${r + 3}" fill="none" stroke="#9aa5b1" stroke-width="1" stroke-dasharray="2 3"/>`);
        }
        if (!ts.supplied && t.type === 'land' && ts.owner !== 'neutral' && ts.owner !== 'none') {
          S.push(`<circle cx="${x - r - 4}" cy="${y - r + 2}" r="3" fill="#c25b4e"/>`);
        }
        if (ts.strength > 0) {
          S.push(`<text x="${x}" y="${y + 4}" text-anchor="middle" font-family="'IBM Plex Mono', monospace"
            font-size="11" font-weight="600" fill="#f2efe4">${ts.strength}</text>`);
        }
        S.push(`<text x="${x}" y="${y + r + 11}" text-anchor="middle" font-size="8.5"
          fill="#7d8794" font-family="'IBM Plex Sans', sans-serif">${t.name}</text>`);
      }
      S.push('</g>');
    }
    this.svg.innerHTML = S.join('');
    this.applyView();

    for (const g of this.svg.querySelectorAll('.node')) {
      g.addEventListener('pointerenter', () => {
        if (this.cb.onHover) this.cb.onHover(g.dataset.tid);
      });
    }
  }
}
