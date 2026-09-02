import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = "F:\\Projects\\cartoonapp";
const home = os.homedir();

// Keys
console.log('=== KEYS ===');
for (const [name, fp] of [['playveo', path.join(home, '.majarra','playveo.key')], ['google-ai', path.join(home,'.majarra','google-ai.key')]]) {
  const ex = fs.existsSync(fp);
  console.log(`${name}: ${ex ? 'EXISTS len='+fs.readFileSync(fp,'utf8').trim().length : 'MISSING'}`);
}

// WAVs
console.log('\n=== WAVs ===');
const audioRoot = path.join(ROOT, 'assets','audio','games');
function countWavs(dir) {
  let n=0, bytes=0;
  try {
    for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { const sub = countWavs(p); n+=sub.n; bytes+=sub.bytes; }
      else if (e.name.endsWith('.wav')) { n++; try{bytes+=fs.statSync(p).size;}catch{}
      }
    }
  } catch {}
  return { n, bytes };
}
const wav = countWavs(audioRoot);
console.log(`WAV count: ${wav.n}, size ${(wav.bytes/1024/1024).toFixed(1)} MB`);

try {
  for (const d of fs.readdirSync(audioRoot)) {
    const dp = path.join(audioRoot, d);
    if (!fs.statSync(dp).isDirectory()) continue;
    for (const sub of fs.readdirSync(dp)) {
      const sp = path.join(dp, sub);
      try {
        if (fs.statSync(sp).isDirectory()) {
          const files = fs.readdirSync(sp).filter(f=>f.endsWith('.wav'));
          if (files.length) console.log(`  ${d}/${sub}: ${files.length} wavs`);
        }
      } catch {}
    }
  }
} catch {}

// Manifests
console.log('\n=== TTS Manifests missing ===');
const ttsDir = path.join(ROOT, 'tools','tts','games');
for (const f of fs.readdirSync(ttsDir).filter(x=>x.endsWith('-ar.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(ttsDir,f),'utf8'));
  const outDir = path.join(ROOT, data.out_dir);
  let exist=0; try{exist=fs.readdirSync(outDir).filter(x=>x.endsWith('.wav')).length;}catch{}
  console.log(`  ${f}: ${exist}/${data.lines.length} missing ${data.lines.length-exist}`);
}

// Wave4 output
console.log('\n=== Wave4 output ===');
const wave4out = path.join(ROOT,'tools','playveo','output','wave4');
function walk(dir, depth=0) {
  if (depth>4) return;
  try {
    for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth+1);
      else { const s=fs.statSync(p).size; console.log(`  ${p.replace(ROOT,'')} ${s}B`); }
    }
  } catch { if(depth===0) console.log('  (no output yet)'); }
}
walk(wave4out);

// Games list
console.log('\n=== Easiest 3 games to try ===');
console.log('  game-shape-trace-3 (5 levels) — تتبع أشكال هندسية + تلوين + free_draw');
console.log('  game-match-nature-3 (5 levels) — مطابقة identical→part_whole');
console.log('  game-memory-shapes-3 (5 levels) — memory 2x2→3x4');
console.log('');
console.log('Flutter: cd app_main && flutter run -d chrome');
console.log('Route:  /#/game/game-shape-trace-3');

console.log('\n=== pubspec just_audio ===');
const pubspec = fs.readFileSync(path.join(ROOT,'app_main','pubspec.yaml'),'utf8');
for (const line of pubspec.split('\n')) if (line.includes('just_audio')||line.includes('audio_session')) console.log('  '+line.trim());
