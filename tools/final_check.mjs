import fs from 'node:fs';
import path from 'node:path';

const ROOT = "F:\\Projects\\cartoonapp";

console.log('=== WAVs 150/150 ===');
const audioRoot = path.join(ROOT,'assets','audio','games');
let n=0, bytes=0;
function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(p.endsWith('.wav')){ n++; try{bytes+=fs.statSync(p).size;}catch{} } } }
walk(audioRoot);
console.log(`WAV count: ${n}, size ${(bytes/1024/1024).toFixed(1)} MB`);
for (const d of fs.readdirSync(audioRoot)) {
  const dp=path.join(audioRoot,d);
  if (!fs.statSync(dp).isDirectory()) continue;
  for (const sub of fs.readdirSync(dp)) {
    const sp=path.join(dp,sub);
    try{ if(fs.statSync(sp).isDirectory()){ const files=fs.readdirSync(sp).filter(f=>f.endsWith('.wav')); if(files.length) console.log(`  ${d}/${sub}: ${files.length} wavs`); } }catch{}
  }
}

console.log('\n=== TTS Manifests missing ===');
const ttsDir = path.join(ROOT,'tools','tts','games');
let totalMissing=0;
for (const f of fs.readdirSync(ttsDir).filter(x=>x.endsWith('-ar.json'))) {
  const data=JSON.parse(fs.readFileSync(path.join(ttsDir,f),'utf8'));
  let exist=0; try{exist=fs.readdirSync(path.join(ROOT,data.out_dir)).filter(x=>x.endsWith('.wav')).length;}catch{}
  const miss=data.lines.length-exist;
  totalMissing+=miss;
  console.log(`  ${f}: ${exist}/${data.lines.length} missing ${miss}`);
}
console.log(`Total missing: ${totalMissing}`);

console.log('\n=== Wave4 covers CDN upload check ===');
const wave4Out = path.join(ROOT,'tools','playveo','output','wave4');
let covers=0;
function walkW(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walkW(p); else if(p.endsWith('.jpg')) covers++; } }
try{ walkW(wave4Out); }catch{}
console.log(`Wave4 covers local source: ${covers}`);

console.log('\n=== app_main/assets/games should NOT contain wave4 (APK size) ===');
const gamesAssets = path.join(ROOT,'app_main','assets','images','games');
const dirs=fs.readdirSync(gamesAssets).filter(x=>{ try{return fs.statSync(path.join(gamesAssets,x)).isDirectory();}catch{return false;}});
console.log(`  Directories: ${dirs.join(', ')}`);
console.log(`  wave4 exists in app_main? ${fs.existsSync(path.join(gamesAssets,'wave4'))} — should be FALSE (CDN only)`);

console.log('\n=== local_catalog ExperienceItem count ===');
const catalogPath = path.join(ROOT,'app_main','lib','features','home','data','local_catalog.dart');
const content=fs.readFileSync(catalogPath,'utf8');
const matches=content.match(/ExperienceItem\(/g);
console.log(`  ExperienceItem count: ${matches?.length ?? 0} (should be 44: 5 legacy + 9 wave1 + 6 wave2 + 3 wave3 + 18 wave4 + 3 extra?)`);
const cdnMatches=content.match(/cdn\.majarra\.app.*wave4/g);
console.log(`  CDN wave4 entries: ${cdnMatches?.length ?? 0} (should be 11)`);
const emptyImageAsset=content.match(/imageAsset:\s*''/g);
console.log(`  Empty imageAsset (CDN only, no local): ${emptyImageAsset?.length ?? 0} (should be 11 for wave4)`);

console.log('\n=== play_page.dart uses LocalCatalog direct + CDN ===');
const playPagePath = path.join(ROOT,'app_main','lib','features','home','presentation','pages','play_page.dart');
const playContent=fs.readFileSync(playPagePath,'utf8');
console.log(`  Uses LocalCatalog.experiences direct: ${playContent.includes('LocalCatalog.experiences')}`);
console.log(`  Has hardcoded fallback: ${playContent.includes('shape-trace-3') && playContent.includes('Hard fallback') || playContent.includes('Absolute fallback')}`);
console.log(`  Merges server + local: ${playContent.includes('serverGames') && playContent.includes('localGames')}`);

console.log('\n=== First 3 games direct URLs (bypass PlayPage) ===');
console.log('  /#/game/game-shape-trace-3');
console.log('  /#/game/game-match-nature-3');
console.log('  /#/game/game-memory-shapes-3');

console.log('\nDone final_check');
