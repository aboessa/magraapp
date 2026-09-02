import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GAMES_TTS_DIR = path.join(ROOT, 'tools', 'tts', 'games');
const WAVE4_MANIFEST = path.join(ROOT, 'tools', 'playveo', 'wave4-visual.manifest.json');

function readGamesCount() {
  try {
    const files = fs.readdirSync(path.join(ROOT, 'assets', 'audio', 'games'), { recursive: true });
    const wavs = files.filter(f => String(f).endsWith('.wav'));
    return wavs.length;
  } catch { return 0; }
}

console.log('=== FULL GENERATION START ===');
console.log('Root:', ROOT);
console.log('Current WAV count:', readGamesCount());

console.log('\n=== API keys ===');
const home = os.homedir();
const keys = [
  ['playveo', path.join(home, '.majarra', 'playveo.key')],
  ['google-ai', path.join(home, '.majarra', 'google-ai.key')],
];
for (const [name, p] of keys) {
  console.log(`${name}: ${fs.existsSync(p) ? 'EXISTS len='+fs.readFileSync(p,'utf8').trim().length : 'MISSING'} ${p}`);
}

console.log('\n=== Step 1: List missing voices ===');
const manifests = fs.readdirSync(GAMES_TTS_DIR).filter(f => f.endsWith('-ar.json'));
for (const mf of manifests) {
  const data = JSON.parse(fs.readFileSync(path.join(GAMES_TTS_DIR, mf), 'utf8'));
  const outDir = path.join(ROOT, data.out_dir);
  let existing = 0;
  try { existing = fs.readdirSync(outDir).filter(f => f.endsWith('.wav')).length; } catch { existing = 0; }
  const missing = data.lines.length - existing;
  console.log(`  ${mf}: ${existing}/${data.lines.length} exist, missing ${missing}, voice=${data.voice}`);
}

console.log('\n=== Step 2: Wave4 visual plan ===');
try {
  const m = JSON.parse(fs.readFileSync(WAVE4_MANIFEST,'utf8'));
  let totalAssets = 0;
  for (const g of m.games) for (const a of g.assets) if (a.action==='GENERATE') totalAssets++;
  console.log(`  Wave4: ${m.games.length} games, ~${totalAssets} GENERATE assets`);
  console.log(`  Estimated credits: ${(totalAssets * 0.1).toFixed(2)} t2i`);
} catch (e) {
  console.log('  Wave4 manifest read failed:', e.message);
}

console.log('\n=== Step 3: Try generate 1 cover (0.1 credit) ===');
// Delegate to wave4 runner
try {
  const out = execSync('node tools/playveo/generate_wave4_assets.mjs --plan', { cwd: ROOT, encoding: 'utf-8', timeout: 15000 });
  console.log(out.slice(0, 2000));
} catch (e) {
  console.log('plan failed', e.message.slice(0,500));
  console.log(e.stdout?.toString().slice(0,1000) ?? '');
  console.log(e.stderr?.toString().slice(0,1000) ?? '');
}

console.log('\n=== Step 4: Try one image submit/poll ===');
try {
  console.log('Submitting game-match-nature-3/cover...');
  const out = execSync('node tools/playveo/generate_wave4_assets.mjs --submit --only game-match-nature-3/cover --limit 1', { cwd: ROOT, encoding: 'utf-8', timeout: 30000 });
  console.log(out.slice(0, 5000));
  console.log('Polling...');
  // wait 40s for generation
  execSync('sleep 2 || ping -n 3 127.0.0.1 >nul', { cwd: ROOT, timeout: 5000 });
  const pollOut = execSync('node tools/playveo/generate_wave4_assets.mjs --poll --only game-match-nature-3/cover --limit 1', { cwd: ROOT, encoding: 'utf-8', timeout: 30000 });
  console.log(pollOut.slice(0, 5000));
} catch (e) {
  console.log('image gen failed:', e.message.slice(0,800));
  console.log('stdout:', e.stdout?.toString().slice(0,2000) ?? '');
}

console.log('\n=== Step 5: Check output files ===');
try {
  const outDir = path.join(ROOT, 'tools', 'playveo', 'output', 'wave4');
  if (fs.existsSync(outDir)) {
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else console.log(`  ${p.replace(ROOT,'')} ${fs.statSync(p).size} bytes`);
      }
    };
    walk(outDir);
  } else console.log('  output/wave4 not exists yet');
} catch (e) {
  console.log('check output failed', e.message);
}

console.log('\n=== Step 6: List 3 easiest games to play in Flutter ===');
console.log('  Best first games (no external assets needed for core logic):');
console.log('  1. game-shape-trace-3 — تتبع الأشكال — 5 مستويات trace_color geometric, توليد مسارات SVG normalized فقط');
console.log('  2. game-number-trace-3 — تتبع الأرقام — 1,2,3,8 + connect_dots');
console.log('  3. game-match-nature-3 — طابق الطبيعة — مطابقة identical/relation 3 targets');
console.log('  4. game-memory-shapes-3 — ذاكرة الأشكال — grid 2x2→3x4 placeholder يعرض id نصي حاليا');
console.log('  5. game-count-nature-3 — عدّ الطبيعة — 4 modes');
console.log('');
console.log('  Flutter run: cd app_main && flutter run -d chrome --dart-define=MAJARRA_ENV=development');
console.log('  Then open: /#/game/game-shape-trace-3  or  /#/game/game-match-nature-3');

console.log('\n=== FULL GENERATION CHECK DONE ===');
