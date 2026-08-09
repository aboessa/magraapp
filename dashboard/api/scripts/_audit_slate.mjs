// Extracts the DECLARED content slate from docs/content/planets/*/README.md.
// These READMEs are the canonical plan: each declares its planet's series and, per series,
// the episode/unit list with objective, duration and free flag.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'F:\\Projects\\cartoonapp\\docs\\content\\planets';
const out = [];

for (const dir of fs.readdirSync(ROOT).filter((d) => /^\d\d-/.test(d))) {
  const readme = path.join(ROOT, dir, 'README.md');
  if (!fs.existsSync(readme)) continue;
  const text = fs.readFileSync(readme, 'utf8');
  const L = text.split(/\r?\n/);

  const planet = { dir, id: null, name: null, series: [], decisions: [], other: [] };
  // planet id from the header card
  for (const l of L) {
    const m = /^\|\s*`id`\s*\|\s*`?([a-z-]+)`?\s*\|/.exec(l);
    if (m) { planet.id = m[1]; break; }
  }
  const nm = L.find((l) => /^\|\s*الاسم\s*\|/.test(l));
  if (nm) planet.name = nm.split('|')[2]?.trim() ?? null;

  let cur = null;
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    // "## السلسلة N — <title>" or "## <n> — <title> · `slug`"
    const sm = /^##\s+(?:السلسلة\s*)?(\d+)?\s*[—-]?\s*(.+)$/.exec(l);
    if (/^##\s/.test(l)) {
      const heading = l.replace(/^##\s*/, '').replace(/[*`🔴✅❌⏳⚠️]/g, '').trim();
      // a series section is one whose next few lines carry a slug + type descriptor line
      const look = L.slice(i + 1, i + 6).join('\n');
      const desc = /`([a-z0-9-]+)`\s*·\s*`(continuous|anthology|knowledge|presenter|standalone)`\s*·\s*([0-9]+)[–-]([0-9]+)\s*·\s*`(preschool|kids|junior)`(?:\s*·\s*`([a-z0-9_]+)`)?(?:\s*·\s*`?([a-z_]+)`?)?/.exec(look);
      if (desc && sm) {
        cur = {
          n: sm[1] ? Number(sm[1]) : null,
          title_ar: heading.replace(/^السلسلة\s*\d+\s*[—-]\s*/, '').trim(),
          slug: desc[1], type: desc[2], age_min: Number(desc[3]), age_max: Number(desc[4]),
          track: desc[5], production_level: desc[6] ?? null, price_tier: desc[7] ?? null,
          items: [],
        };
        planet.series.push(cur);
        continue;
      }
      if (/قرار|القرارات|الحالة|الإنتاج|المحتوى/.test(heading)) { cur = null; planet.other.push(heading); continue; }
      cur = null;
      continue;
    }
    // episode table row: | 1 | title | objective | 3:00 | ✅ | [ep-01](...) |
    if (cur) {
      const cells = l.split('|').map((c) => c.trim());
      if (cells.length >= 5 && /^\d+$/.test(cells[1])) {
        const dur = cells.find((c) => /^\d+:\d\d$/.test(c.replace(/[*`]/g, '')));
        const script = /\((\.\/[^)]+\.md)\)/.exec(l);
        cur.items.push({
          number: Number(cells[1]),
          title_ar: cells[2].replace(/[*`]/g, '').trim(),
          objective: cells[3]?.replace(/[*`]/g, '').trim() ?? null,
          duration: dur ? dur.replace(/[*`]/g, '') : null,
          is_free: /✅/.test(cells[5] ?? '') ? 1 : 0,
          script: script ? script[1] : null,
        });
      }
    }
  }
  out.push(planet);
}

fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2), 'utf8');

let tSeries = 0; let tItems = 0; let tScripted = 0;
for (const p of out) {
  console.log(`\n${p.dir}   id=${p.id}   ${p.name ?? ''}`);
  if (!p.series.length) { console.log('   (no series tables parsed — check format)'); }
  for (const s of p.series) {
    tSeries += 1; tItems += s.items.length;
    const scripted = s.items.filter((i) => i.script).length;
    tScripted += scripted;
    console.log(`   ${String(s.slug).padEnd(32)} ${String(s.type).padEnd(11)} ${s.age_min}-${s.age_max} ${String(s.track).padEnd(10)} items=${String(s.items.length).padStart(2)}  scripts=${scripted}`);
  }
  if (p.other.length) console.log(`   sections: ${p.other.join(' | ')}`);
}
console.log(`\nDECLARED TOTAL: series ${tSeries}   items ${tItems}   items with a script file ${tScripted}`);
