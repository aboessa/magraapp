// Extracts the documented game-engine contracts from docs/games/engines/*.md
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'F:\\Projects\\cartoonapp\\docs\\games\\engines';
const rows = [];

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.md')).sort()) {
  const text = fs.readFileSync(path.join(DIR, f), 'utf8');
  const L = text.split(/\r?\n/);
  const h1 = (L.find((l) => /^#\s/.test(l)) ?? '').replace(/^#\s*/, '').replace(/`/g, '').trim();
  const idFromH1 = /^\d+\s*—\s*([a-z_]+)/.exec(h1)?.[1] ?? null;

  // card rows: | key | value |
  const card = {};
  for (const raw of L) {
    const line = raw.replace(/`/g, '');
    const m = /^\|\s*([^|]{1,40}?)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    const k = m[1].trim();
    if (/^-+$/.test(m[2])) continue;
    if (!(k in card)) card[k] = m[2].replace(/\*\*/g, '').trim();
  }
  const ageLine = Object.entries(card).find(([k]) => /الفئة|الفئات|العمر|المسار/.test(k));
  rows.push({
    file: f,
    engine_id: idFromH1,
    title: h1,
    ages: ageLine ? ageLine[1] : null,
    ageKey: ageLine ? ageLine[0] : null,
    mechanic: card['الميكانيكا'] ?? card['الميكانيك'] ?? card['النمط'] ?? null,
    packs: Object.entries(card).filter(([k]) => /حزم|حزمة/.test(k)).map(([, v]) => v),
  });
}

console.log('=== documented game engines ===');
for (const r of rows) {
  console.log(`  ${String(r.engine_id ?? '?').padEnd(18)} ${r.file.padEnd(24)} ages=${String(r.ages ?? '?').slice(0, 34).padEnd(34)} ${r.title.slice(0, 40)}`);
}
console.log(`\ntotal documented: ${rows.length}`);
fs.writeFileSync(process.argv[2], JSON.stringify(rows, null, 2), 'utf8');
