// Harvests learning-objective codes declared in docs/content/planets/*/game-packs.md and any
// other source doc, and reports which are missing from learning_objectives.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'F:\\Projects\\cartoonapp\\docs\\content\\planets';
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const qr = (p) => { const j = rd(p); return (Array.isArray(j) ? j : [j]).flatMap((x) => x.results ?? []); };

const known = new Set(qr('_ref_objectives.json').map((r) => r.code));
const DOMAINS = ['lang', 'math', 'sci', 'world', 'val', 'skill', 'hist'];
const CODE = new RegExp(`\\b(${DOMAINS.join('|')})\\.[a-z_]+\\.[a-z_]+\\b`, 'g');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const found = new Map(); // code -> { files:Set, contexts:[] }
for (const f of walk(ROOT)) {
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    for (const m of lines[i].matchAll(CODE)) {
      const code = m[0];
      if (!found.has(code)) found.set(code, { files: new Set(), contexts: [] });
      const rec = found.get(code);
      rec.files.add(path.relative(ROOT, f).replace(/\\/g, '/'));
      if (rec.contexts.length < 3) rec.contexts.push(lines[i].replace(/\s+/g, ' ').trim().slice(0, 200));
    }
  }
}

const missing = [...found.entries()].filter(([c]) => !known.has(c));
const planetOf = (files) => {
  const f = [...files][0] ?? '';
  const m = /^(\d\d-[a-z]+)/.exec(f);
  return m ? m[1] : '?';
};

console.log(`objective codes referenced anywhere in the sources: ${found.size}`);
console.log(`already in learning_objectives:                     ${found.size - missing.length}`);
console.log(`MISSING from learning_objectives:                   ${missing.length}`);
console.log('');
const byPlanet = {};
for (const [code, rec] of missing) (byPlanet[planetOf(rec.files)] ||= []).push([code, rec]);
for (const p of Object.keys(byPlanet).sort()) {
  console.log(`  ${p}`);
  for (const [code, rec] of byPlanet[p].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`    ${code.padEnd(38)} in ${[...rec.files].slice(0, 2).join(', ')}`);
  }
}
fs.writeFileSync(process.argv[2], JSON.stringify(
  missing.map(([code, rec]) => ({ code, planet_dir: planetOf(rec.files), files: [...rec.files], contexts: rec.contexts })),
  null, 2), 'utf8');
