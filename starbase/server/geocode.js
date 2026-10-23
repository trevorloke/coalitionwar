// Google Maps Geocoding API (server side). Uses GOOGLE_MAPS_SERVER_KEY, which
// should be restricted to the Geocoding API and the server's IP — never the
// browser key, which is referrer-restricted and would be rejected here.

const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

// Surrey, BC bounding box: biases results and rejects out-of-city hits.
export const SURREY_BOUNDS = { south: 49.002, west: -122.92, north: 49.222, east: -122.67 };
export const SURREY_CENTER = { lat: 49.1913, lng: -122.849 };

export function formatAddress(a) {
  const unit = a.unit ? `${a.unit}-` : '';
  return `${unit}${a.street_number} ${a.street_name}, ${a.city || 'Surrey'}, ${a.province || 'BC'}${a.postal_code ? ' ' + a.postal_code : ''}, Canada`;
}

export function inSurrey({ lat, lng }) {
  const b = SURREY_BOUNDS;
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

export async function geocode(address, key, fetchImpl = fetch) {
  if (!key) throw new Error('GOOGLE_MAPS_SERVER_KEY is not set');
  const b = SURREY_BOUNDS;
  const url = `${ENDPOINT}?address=${encodeURIComponent(formatAddress(address))}`
    + `&bounds=${b.south},${b.west}|${b.north},${b.east}&region=ca&key=${encodeURIComponent(key)}`;
  const res = await fetchImpl(url);
  const body = await res.json();
  if (body.status === 'ZERO_RESULTS') return null;
  if (body.status !== 'OK') throw new Error(`Geocoding failed: ${body.status}${body.error_message ? ' — ' + body.error_message : ''}`);
  const top = body.results[0];
  const loc = top.geometry.location;
  if (!inSurrey(loc)) return null;
  const postal = top.address_components.find(c => c.types.includes('postal_code'))?.long_name;
  return { lat: loc.lat, lng: loc.lng, postal_code: postal ?? null, formatted: top.formatted_address };
}

// Geocode every pending address, a few at a time to stay under quota.
export async function geocodePending(db, key, { limit = 500, concurrency = 5, fetchImpl } = {}) {
  const rows = db.prepare(`SELECT * FROM addresses WHERE geocode_status = 'pending' LIMIT ?`).all(limit);
  const ok = db.prepare(`UPDATE addresses SET lat = ?, lng = ?, postal_code = COALESCE(postal_code, ?),
                         geocode_status = 'ok' WHERE id = ?`);
  const fail = db.prepare(`UPDATE addresses SET geocode_status = 'failed' WHERE id = ?`);
  let done = 0, failed = 0, error = null;
  const queue = [...rows];
  async function worker() {
    while (queue.length && !error) {
      const a = queue.shift();
      try {
        const r = await geocode(a, key, fetchImpl);
        if (r) { ok.run(r.lat, r.lng, r.postal_code, a.id); done++; }
        else { fail.run(a.id); failed++; }
      } catch (e) {
        // Quota/key errors stop the batch; the rows stay pending for a retry.
        error = e.message;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { attempted: rows.length, geocoded: done, failed, error };
}
