// Single-file bundler. Resolves the ES-module graph from src/ui/app.js,
// converts each module to a registry entry, and emits:
//   dist/index.html    — complete standalone document (open it in a browser)
//   dist/artifact.html — content-only version for publishing as an Artifact
// The transform understands exactly the module syntax this codebase uses:
// `import { a, b } from './x.js'`, `export const/function/class`, `export { a }`.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const ENTRY = 'src/ui/app.js';

const modules = new Map(); // id -> { source, deps }

function moduleId(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }

function load(file) {
  const id = moduleId(file);
  if (modules.has(id)) return id;
  let src = fs.readFileSync(file, 'utf8');
  const deps = [];
  // import { a, b as c } from './x.js';  (possibly multiline)
  src = src.replace(/import\s*\{([\s\S]*?)\}\s*from\s*['"](.+?)['"];?/g, (m, names, rel) => {
    const target = load(path.resolve(path.dirname(file), rel));
    deps.push(target);
    const bindings = names.split(',').map(s => s.trim()).filter(Boolean)
      .map(n => n.includes(' as ') ? n.replace(' as ', ': ') : n).join(', ');
    return `const { ${bindings} } = __req('${target}');`;
  });
  src = src.replace(/import\s*\*\s*as\s+(\w+)\s+from\s*['"](.+?)['"];?/g, (m, name, rel) => {
    const target = load(path.resolve(path.dirname(file), rel));
    deps.push(target);
    return `const ${name} = __req('${target}');`;
  });
  // exports
  const exported = [];
  src = src.replace(/export\s+const\s+(\w+)/g, (m, n) => { exported.push(n); return `const ${n}`; });
  src = src.replace(/export\s+async\s+function\s+(\w+)/g, (m, n) => { exported.push(n); return `async function ${n}`; });
  src = src.replace(/export\s+function\s+(\w+)/g, (m, n) => { exported.push(n); return `function ${n}`; });
  src = src.replace(/export\s+class\s+(\w+)/g, (m, n) => { exported.push(n); return `class ${n}`; });
  src = src.replace(/export\s*\{([^}]*)\};?/g, (m, names) => {
    for (const n of names.split(',').map(s => s.trim()).filter(Boolean)) exported.push(n);
    return '';
  });
  src += `\n${[...new Set(exported)].map(n => `__exp.${n} = ${n};`).join(' ')}\n`;
  modules.set(id, { source: src, deps });
  return id;
}

const entryId = load(path.resolve(ROOT, ENTRY));

let code = `'use strict';
const __mods = {}, __cache = {};
function __def(id, fn) { __mods[id] = fn; }
function __req(id) {
  if (__cache[id]) return __cache[id];
  const __exp = (__cache[id] = {});
  __mods[id](__exp);
  return __exp;
}
`;
for (const [id, m] of modules) {
  code += `__def('${id}', (__exp) => {\n${m.source}\n});\n`;
}
code += `__req('${entryId}');\n`;

if (code.includes('</' + 'script')) {
  throw new Error('bundle contains a literal </' + 'script> terminator — escape it in source');
}

const css = fs.readFileSync(path.join(ROOT, 'src/ui/style.css'), 'utf8');
const fonts = 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600&display=swap';

const body = `<div id="app"></div>
<script id="game-state" type="application/json"></script>
<script id="app-code">${code}</script>`;

const standalone = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coalition 1939</title>
<link rel="stylesheet" href="${fonts}">
<style id="app-style">${css}</style>
</head><body>
${body}
</body></html>`;

const artifact = `<title>Coalition 1939</title>
<link rel="stylesheet" href="${fonts}">
<style id="app-style">${css}</style>
${body}`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/index.html'), standalone);
fs.writeFileSync(path.join(ROOT, 'dist/artifact.html'), artifact);
console.log(`bundled ${modules.size} modules → dist/index.html (${(standalone.length / 1024).toFixed(0)} KB), dist/artifact.html`);
