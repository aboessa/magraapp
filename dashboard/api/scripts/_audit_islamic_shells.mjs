// Extracts the Islamic planet's declared series/unit STRUCTURE from series-shells.md.
// Structure only. No religious text is read out, generated or inferred: every unit title in
// the source is `<pending_sharia_review>` and stays that way.
import fs from 'node:fs';

const SRC = 'F:\\Projects\\cartoonapp\\docs\\content\\planets\\09-islamic\\series-shells.md';
const L = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

const clean = (s) => s.replace(/[`*🔴✅❌⏳⚠️]/g, '').trim();

// The summary table at the top is authoritative for the series list.
const summary = [];
for (const raw of L) {
  const cells = raw.split('|').map(clean);
  if (cells.length < 8) continue;
  if (!/^\d+$/.test(cells[1])) continue;
  const slug = cells[3];
  if (!/^[a-z-]+$/.test(slug)) continue;
  summary.push({
    n: Number(cells[1]),
    title_ar: cells[2],
    slug,
    track: cells[4],
    type: cells[5],
    units: Number(cells[6]),
    in_db: /✅|⚠/.test(raw.split('|')[7] ?? '') ? (/⚠/.test(raw.split('|')[7]) ? 'merged' : 'yes') : 'no',
  });
}

// Per-series section cards give unit type and per-unit durations.
const sections = [];
let cur = null;
for (const raw of L) {
  const m = /^##\s+(\d+)\s*—\s*(.+?)\s*·\s*`([a-z-]+)`/.exec(raw);
  if (m) { cur = { n: Number(m[1]), slug: m[3], card: {}, durations: [], unit_rows: 0 }; sections.push(cur); continue; }
  if (!cur) continue;
  const c = raw.replace(/`/g, '');
  const cm = /^\|\s*([^|]{1,30}?)\s*\|\s*([^|]+?)\s*\|/.exec(c);
  if (cm && !/^-+$/.test(cm[2].trim()) && !(cm[1].trim() in cur.card)) cur.card[cm[1].trim()] = clean(cm[2]);
  const cells = raw.split('|').map(clean);
  if (cells.length >= 3 && /^\d+(?:[–-]\d+)?$/.test(cells[1])) {
    cur.unit_rows += 1;
    for (const x of cells) if (/^\d+:\d\d$/.test(x)) cur.durations.push(x);
    for (const x of cells) {
      const r = /^(\d+:\d\d)[–-](\d+:\d\d)$/.exec(x);
      if (r) cur.durations.push(r[1]);
    }
  }
}
const bySlug = new Map(sections.map((s) => [s.slug, s]));

const toSeconds = (mmss) => { const [m, s] = mmss.split(':').map(Number); return m * 60 + s; };

const out = summary.map((s) => {
  const sec = bySlug.get(s.slug);
  const durs = sec?.durations.map(toSeconds) ?? [];
  return {
    ...s,
    unit_type: sec?.card['نوع الوحدة'] ?? sec?.card['نوع المحتوى'] ?? null,
    measurement: sec?.card['القياس'] ?? null,
    production_level: sec?.card['مستوى الإنتاج'] ?? null,
    duration_min: durs.length ? Math.min(...durs) : null,
    duration_max: durs.length ? Math.max(...durs) : null,
    duration_avg: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null,
    parsed_unit_rows: sec?.unit_rows ?? 0,
  };
});

const ages = { preschool: [3, 5], kids: [6, 8], junior: [9, 12] };
console.log('=== Islamic planet declared slate (structure only) ===');
console.log('   #  slug                              track      type        units  in_db   unit duration');
for (const s of out) {
  console.log(`  ${String(s.n).padStart(2)}  ${s.slug.padEnd(34)}${String(s.track).padEnd(11)}${String(s.type).padEnd(12)}${String(s.units).padStart(4)}   ${String(s.in_db).padEnd(8)}${s.duration_min ? `${s.duration_min}-${s.duration_max}s (avg ${s.duration_avg})` : 'n/a'}`);
}
console.log(`\n  series declared: ${out.length}   units declared: ${out.reduce((a, s) => a + s.units, 0)}`);
console.log(`  series already in D1: ${out.filter((s) => s.in_db === 'yes').length}   merged: ${out.filter((s) => s.in_db === 'merged').length}   missing: ${out.filter((s) => s.in_db === 'no').length}`);
console.log(`\n  age bands applied: ${JSON.stringify(ages)}`);
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2), 'utf8');
