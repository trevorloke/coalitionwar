// Map adapters for the canvass screen. Both expose the same interface:
//   setAddresses(list) · updateAddress(a) · select(id) · fitTo(list)
//   showUser(pos) · panTo(pos) · setPickMode(on) · getBbox() · getZoom()
//
// GoogleMap uses the Google Maps JavaScript API (needs GOOGLE_MAPS_BROWSER_KEY).
// GridMap is a built-in offline fallback drawn on <canvas> over Surrey's
// numbered street grid — used when there's no key or no signal.

import { STATUS_HEX } from './ui.js';

let mapsPromise = null;

export function loadGoogleMaps(key) {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const cb = '__starbaseMapsReady';
    const timer = setTimeout(() => reject(new Error('Google Maps took too long to load')), 15000);
    window[cb] = () => { clearTimeout(timer); resolve(window.google.maps); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => { clearTimeout(timer); mapsPromise = null; reject(new Error('Could not reach Google Maps')); };
    document.head.append(s);
  });
  return mapsPromise;
}

function pinElement(a, selected) {
  const el = document.createElement('div');
  el.className = `house-pin ${a.status}${selected ? ' selected' : ''}`;
  el.style.background = STATUS_HEX[a.status] ?? '#ccc';
  if (a.status === 'unvisited') el.style.borderColor = a.turf_color || '#6d4aff';
  el.title = a.label;
  return el;
}

// ---- Google Maps ---------------------------------------------------------------

export async function createGoogleMap(container, config, handlers) {
  const maps = await loadGoogleMaps(config.google_maps_browser_key);
  const { Map } = await maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await maps.importLibrary('marker');

  const b = config.bounds;
  const map = new Map(container, {
    center: config.center,
    zoom: 13,
    // Advanced markers need a Map ID; DEMO_MAP_ID works for testing.
    mapId: config.google_maps_map_id || 'DEMO_MAP_ID',
    clickableIcons: false,
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'greedy',
    restriction: { latLngBounds: { south: b.south - 0.05, west: b.west - 0.08, north: b.north + 0.05, east: b.east + 0.08 } },
  });

  const markers = new Map_();
  let selectedId = null;
  let pickMode = false;
  let userMarker = null;

  map.addListener('idle', () => handlers.onIdle?.());
  map.addListener('click', (e) => {
    if (pickMode && e.latLng) handlers.onPick?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  });

  function add(a) {
    const m = new AdvancedMarkerElement({
      map, position: { lat: a.lat, lng: a.lng }, content: pinElement(a, a.id === selectedId), title: a.label,
      gmpClickable: true,
    });
    m.addListener('click', () => { if (!pickMode) handlers.onSelect?.(a.id); });
    markers.set(a.id, { marker: m, data: a });
  }

  return {
    kind: 'google',
    setAddresses(list) {
      const keep = new Set(list.map(a => a.id));
      for (const [id, { marker }] of markers) if (!keep.has(id)) { marker.map = null; markers.delete(id); }
      for (const a of list) {
        const cur = markers.get(a.id);
        if (!cur) add(a);
        else if (cur.data.status !== a.status) this.updateAddress(a);
      }
    },
    updateAddress(a) {
      const cur = markers.get(a.id);
      if (!cur) { if (a.lat != null) add(a); return; }
      cur.data = { ...cur.data, ...a };
      cur.marker.content = pinElement(cur.data, a.id === selectedId);
    },
    select(id) {
      const prev = markers.get(selectedId);
      selectedId = id;
      if (prev) prev.marker.content = pinElement(prev.data, false);
      const cur = markers.get(id);
      if (cur) { cur.marker.content = pinElement(cur.data, true); cur.marker.zIndex = 1000; }
    },
    fitTo(list) {
      if (!list.length) return;
      const bounds = new maps.LatLngBounds();
      list.forEach(a => bounds.extend({ lat: a.lat, lng: a.lng }));
      map.fitBounds(bounds, 40);
    },
    showUser(pos) {
      if (!userMarker) {
        const el = document.createElement('div');
        el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#2f7cf6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,124,246,.25)';
        userMarker = new AdvancedMarkerElement({ map, position: pos, content: el, zIndex: 2000 });
      } else userMarker.position = pos;
    },
    panTo(pos, zoom) { map.panTo(pos); if (zoom) map.setZoom(zoom); },
    setPickMode(on) { pickMode = on; map.setOptions({ draggableCursor: on ? 'crosshair' : null }); },
    getBbox() {
      const bb = map.getBounds();
      if (!bb) return null;
      const sw = bb.getSouthWest(), ne = bb.getNorthEast();
      return [sw.lat(), sw.lng(), ne.lat(), ne.lng()];
    },
    getZoom() { return map.getZoom(); },
  };
}
// The name `Map` is taken by google.maps.Map inside createGoogleMap.
const Map_ = globalThis.Map;

// ---- Offline grid map ------------------------------------------------------------

const gridLat = (ave) => 49.0020 + ave * 0.0018173;
const gridLng = (st) => -122.8890 + (st - 120) * 0.002735;

export function createGridMap(container, config, handlers) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;background:#eef1f6';
  container.replaceChildren(canvas);
  const ctx = canvas.getContext('2d');
  const cosLat = Math.cos(config.center.lat * Math.PI / 180);

  let center = { ...config.center };
  let scale = 9000; // pixels per degree of longitude
  let list = [];
  let selectedId = null;
  let user = null;
  let pickMode = false;
  let dpr = 1, W = 0, H = 0;

  const toPx = (lat, lng) => [W / 2 + (lng - center.lng) * scale, H / 2 - (lat - center.lat) * scale / cosLat];
  const toLatLng = (x, y) => ({ lng: center.lng + (x - W / 2) / scale, lat: center.lat - (y - H / 2) * cosLat / scale });

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = container.clientWidth; H = container.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    draw();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Surrey's numbered grid: Avenues (E–W) and Streets (N–S).
    const zoomed = scale > 30000;
    const step = scale > 60000 ? 1 : scale > 15000 ? 4 : 8;
    ctx.lineWidth = 1;
    ctx.font = '11px system-ui, sans-serif';
    for (let ave = 0; ave <= 112; ave += step) {
      const [, y] = toPx(gridLat(ave), center.lng);
      if (y < -20 || y > H + 20) continue;
      ctx.strokeStyle = ave % 8 === 0 ? '#c9cfdd' : '#dde2ec';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      if (zoomed || ave % 8 === 0) { ctx.fillStyle = '#7b839e'; ctx.fillText(`${ave} Ave`, 6, y - 3); }
    }
    for (let st = 120; st <= 196; st += step) {
      const [x] = toPx(center.lat, gridLng(st));
      if (x < -20 || x > W + 20) continue;
      ctx.strokeStyle = st % 8 === 0 ? '#c9cfdd' : '#dde2ec';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      if (zoomed || st % 8 === 0) {
        ctx.save(); ctx.translate(x + 3, H - 6); ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#7b839e'; ctx.fillText(`${st} St`, 0, 0); ctx.restore();
      }
    }
    const r = scale > 40000 ? 8 : scale > 15000 ? 6 : 4;
    for (const a of list) {
      const [x, y] = toPx(a.lat, a.lng);
      if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
      const sel = a.id === selectedId;
      ctx.beginPath(); ctx.arc(x, y, sel ? r * 1.6 : r, 0, Math.PI * 2);
      ctx.fillStyle = STATUS_HEX[a.status] ?? '#ccc'; ctx.fill();
      ctx.lineWidth = a.status === 'unvisited' ? 2.5 : 1.5;
      ctx.strokeStyle = a.status === 'unvisited' ? (a.turf_color || '#6d4aff') : '#fff';
      ctx.stroke();
      if (sel) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(109,74,255,.6)'; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (user) {
      const [x, y] = toPx(user.lat, user.lng);
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fillStyle = 'rgba(47,124,246,.2)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = '#2f7cf6'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  }

  // Pointer handling: drag to pan, pinch or wheel to zoom, tap to select.
  const pointers = new Map_();
  let moved = 0, pinchDist = 0;
  const idle = debounceIdle(() => handlers.onIdle?.());
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); moved = 0; pinchDist = 0; });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 1) {
      const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
      moved += Math.abs(dx) + Math.abs(dy);
      center.lng -= dx / scale; center.lat += dy * cosLat / scale;
    }
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchDist);
      pinchDist = d; moved += 10;
    }
    draw();
  });
  const up = (e) => {
    const wasTap = pointers.size === 1 && moved < 8;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (wasTap) tap(e.offsetX, e.offsetY); else idle();
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.25 : 0.8); draw(); idle(); }, { passive: false });

  function zoomAt(x, y, f) {
    const before = toLatLng(x, y);
    scale = Math.min(400000, Math.max(3000, scale * f));
    const after = toLatLng(x, y);
    center.lng += before.lng - after.lng; center.lat += before.lat - after.lat;
  }

  function tap(x, y) {
    if (pickMode) { handlers.onPick?.(toLatLng(x, y)); return; }
    let best = null, bestD = 24;
    for (const a of list) {
      const [px, py] = toPx(a.lat, a.lng);
      const d = Math.hypot(px - x, py - y);
      if (d < bestD) { best = a; bestD = d; }
    }
    if (best) handlers.onSelect?.(best.id);
  }

  new ResizeObserver(resize).observe(container);
  resize();

  return {
    kind: 'grid',
    setAddresses(l) { list = l; draw(); },
    updateAddress(a) { const i = list.findIndex(x => x.id === a.id); if (i >= 0) list[i] = { ...list[i], ...a }; else if (a.lat != null) list.push(a); draw(); },
    select(id) { selectedId = id; draw(); },
    fitTo(l) {
      if (!l.length) return;
      const lats = l.map(a => a.lat), lngs = l.map(a => a.lng);
      const [s, n, w, e] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
      center = { lat: (s + n) / 2, lng: (w + e) / 2 };
      const sx = (W - 60) / Math.max(e - w, 0.0005), sy = (H - 60) * cosLat / Math.max(n - s, 0.0005);
      scale = Math.min(400000, Math.max(3000, Math.min(sx, sy)));
      draw();
    },
    showUser(pos) { user = pos; draw(); },
    panTo(pos, zoom) { center = { lat: pos.lat, lng: pos.lng }; if (zoom) scale = Math.max(scale, 60000); draw(); idle(); },
    setPickMode(on) { pickMode = on; canvas.style.cursor = on ? 'crosshair' : ''; },
    getBbox() { const a = toLatLng(0, H), b = toLatLng(W, 0); return [a.lat, a.lng, b.lat, b.lng]; },
    getZoom() { return Math.log2(scale / 9000) + 13; },
  };
}

function debounceIdle(fn) {
  let t;
  return () => { clearTimeout(t); t = setTimeout(fn, 250); };
}
