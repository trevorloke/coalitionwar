// Minimal RFC 4180 CSV: quoted fields, embedded commas/quotes/newlines.

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', i = 0, quoted = false;
  text = String(text).replace(/^﻿/, '');
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { quoted = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { quoted = true; i++; continue; } // quotes only open a field
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter(r => r.some(v => v.trim() !== ''));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  return nonEmpty.slice(1).map(r => Object.fromEntries(header.map((h, j) => [h, (r[j] ?? '').trim()])));
}

function cell(v) {
  if (v == null) return '';
  let s = Array.isArray(v) ? v.join('; ') : String(v);
  // Neutralise spreadsheet formula injection for values opened in Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows, columns) {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}
