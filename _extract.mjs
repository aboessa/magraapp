import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'docs/content/planets';
const used = new Map(); // id -> {files:[], tracks:Set}

function trackOf(txt) {
  const m = txt.match(/`age_min`\s*\/\s*`age_max`\s*\|\s*(\d+)\s*\/\s*(\d+)/);
  if (!m) return '?';
  const lo = +m[1];
  if (lo <= 5) return 'preschool';
  if (lo <= 8) return 'kids';
  return 'junior';
}

function walk(dir) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f);
    else if (e.endsWith('.md')) {
      const txt = readFileSync(f, 'utf8');
      const rel = relative(ROOT, f).replace(/\\/g, '/');
      for (const m of txt.matchAll(/learning_objective_id[^\n]*?\|\s*`([^`\s|]+)`/g)) {
        const id = m[1];
        if (!used.has(id)) used.set(id, { files: [], tracks: new Set() });
        used.get(id).files.push(rel);
        used.get(id).tracks.add(trackOf(txt));
      }
    }
  }
}
walk(ROOT);

console.log('UNIQUE IDS USED IN CONTENT:', used.size);
for (const [id, v] of [...used].sort()) {
  console.log(id.padEnd(36) + [...v.tracks].join('+').padEnd(11) + v.files.length + ' ep');
}

// catalog ids
const cat = readFileSync('docs/content/90-learning-objectives.md', 'utf8');
const catIds = new Set([...cat.matchAll(/^\|\s*`([a-z][a-z0-9_.]+)`\s*\|/gm)].map(m => m[1]));
console.log('\nCATALOG IDS:', catIds.size);

const inCatNotUsed = [...catIds].filter(i => !used.has(i)).sort();
const usedNotInCat = [...used.keys()].filter(i => !catIds.has(i)).sort();

console.log('\n--- DEAD in catalog (no episode uses them): ' + inCatNotUsed.length);
inCatNotUsed.forEach(i => console.log('   ' + i));
console.log('\n--- MISSING from catalog (used but not catalogued): ' + usedNotInCat.length);
usedNotInCat.forEach(i => console.log('   ' + i));

// planets with zero objective refs
const planets = readdirSync(ROOT).filter(d => statSync(join(ROOT, d)).isDirectory());
const perPlanet = {};
for (const [, v] of used) for (const f of v.files) {
  const pl = f.split('/')[0];
  perPlanet[pl] = (perPlanet[pl] || 0) + 1;
}
console.log('\nrefs per planet:');
planets.forEach(pl => console.log('   ' + pl.padEnd(12) + (perPlanet[pl] || 0)));

// does qisas have the field at all?
const q = readFileSync('docs/content/planets/05-qisas/a-calm-tale/story-01-bird-home.md', 'utf8');
console.log('\nqisas story has learning_objective_id field:', /learning_objective_id/.test(q));
