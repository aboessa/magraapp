import { execSync } from 'child_process';

function q(sql) {
  const out = execSync(`npx wrangler d1 execute majarra-db --local --command "${sql.replace(/"/g,'\\"')}" --json`, { cwd: 'F:/Projects/cartoonapp/dashboard/api', encoding: 'utf8' });
  return JSON.parse(out)[0].results;
}

// Editorial targets (from docs/content/planets/05-qisas map)
// Bedtime stories use 240-280s target when narration ~66s (12 pages *5.5s) + dwell + 0.4*pages
// For now narration is null for bedtime, so use estimated narration for validation
const targets = {
  'bird-home': { min: 150, max: 170 },
  'goodnight-toys': { min: 150, max: 170 },
  'moon-sleeps': { min: 140, max: 170 },
  'warm-hugs': { min: 150, max: 170 },
  'ant-journey': { min: 240, max: 280 },
  'garden-secret': { min: 250, max: 290 },
  'new-friend': { min: 230, max: 270 },
  'rainy-night': { min: 240, max: 280 },
  'old-lantern': { min: 260, max: 300 },
  'lost-star': { min: 240, max: 280 },
  'the-promised-friday': { min: 340, max: 420 },
  'nine-metres': { min: 350, max: 430 },
  'taller-than-me': { min: 400, max: 490 },
  'the-key-that-was-left': { min: 320, max: 400 },
  'the-extra-page': { min: 360, max: 430 },
};

const rows = q(`SELECT s.slug, s.title_ar, count(sp.id) as pages, COALESCE(sum(sp.duration_ms),0)/1000.0 as narration, COALESCE(sum(sp.dwell_ms),0)/1000.0 as dwell FROM story_pages sp JOIN stories s ON s.id=sp.story_id GROUP BY s.slug ORDER BY s.slug`);

console.log('| Story | Pages | Narration(s) | Dwell(s) | Trans(s) | Est(s) | Target | Status |');
console.log('|---|---|---:|---:|---:|---:|---|---|');
for (const r of rows) {
  const t = targets[r.slug];
  if (!t) continue;
  const isJunior = ['the-promised-friday','nine-metres','taller-than-me','the-key-that-was-left','the-extra-page'].includes(r.slug);
  // for null narration stories, estimate 5.5s/page for validation display but report actual
  const narrActual = r.narration;
  const narrEst = narrActual === 0 ? r.pages * 5.5 : narrActual;
  const trans = r.pages * (isJunior ? 0.28 : 0.4);
  const est = narrEst + r.dwell + trans;
  const actualEst = narrActual + r.dwell + trans;
  // status based on estimated with narration
  const status = est >= t.min && est <= t.max ? 'PASS' : est < t.min ? 'BELOW' : 'ABOVE';
  const narrLabel = narrActual === 0 ? `${narrEst.toFixed(1)}*` : narrActual.toFixed(1);
  console.log(`| ${r.slug} | ${r.pages} | ${narrLabel} | ${r.dwell.toFixed(1)} | ${trans.toFixed(1)} | ${est.toFixed(1)} (${actualEst.toFixed(1)} actual) | ${t.min}-${t.max} | ${status} |`);
}
console.log('\n* estimated 5.5s/page where duration_ms is null (narration not yet produced)');
