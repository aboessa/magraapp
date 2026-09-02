#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
const ROOT = 'F:/Projects/cartoonapp';

function countJpg(dir){
  const full = path.join(ROOT, dir);
  if(!fs.existsSync(full)) return 0;
  return fs.readdirSync(full).filter(f=>f.toLowerCase().endsWith('.jpg')).length;
}
function countWebp(dir){
  const full = path.join(ROOT, dir);
  if(!fs.existsSync(full)) return 0;
  return fs.readdirSync(full).filter(f=>f.toLowerCase().endsWith('.webp')).length;
}
function countWav(dir){
  const full = path.join(ROOT, dir);
  if(!fs.existsSync(full)) return 0;
  const rec = (d)=>{
    let c=0;
    for(const e of fs.readdirSync(d,{withFileTypes:true})){
      const p=path.join(d,e.name);
      if(e.isFile() && e.name.endsWith('.wav')) c++;
      else if(e.isDirectory()) c+=rec(p);
    }
    return c;
  };
  return rec(full);
}

console.log('=== A-CALM-TALE (preschool) 4 stories, 8 pages each + cover/hero/thumb = 11 ===');
for(const s of ['act-s1','act-s2','act-s3','act-s4']){
  const outCount = countJpg(`tools/playveo/output/${s}`);
  const appJpg = countJpg(`app_main/assets/images/stories/${s}-playveo`);
  const appWebp = countWebp(`app_main/assets/images/stories/${s}-playveo`);
  const wav = countWav(`assets/audio/stories/${s}`);
  console.log(`${s}: output=${outCount}/11 app jpg=${appJpg} webp=${appWebp} audio wav=${wav}`);
}

console.log('\n=== BEDTIME-STORIES (kids) 6 stories, 12 pages each + cover/hero/thumb = 15 ===');
for(const s of ['bs-s1','bs-s2','bs-s3','bs-s4','bs-s5','bs-s6']){
  const outCount = countJpg(`tools/playveo/output/${s}`);
  const appJpg = countJpg(`app_main/assets/images/stories/${s}-playveo`);
  const appWebp = countWebp(`app_main/assets/images/stories/${s}-playveo`);
  const wav = countWav(`assets/audio/stories/${s}`);
  console.log(`${s}: output=${outCount}/15 app jpg=${appJpg} webp=${appWebp} audio wav=${wav}`);
}

console.log('\n=== QISAS-MIN-ALHAYAT (junior) 5 stories, 18 pages each (~21 with assets) ===');
const qManifestPath = path.join(ROOT,'docs/content/planets/05-qisas/_manifest-qisas-min-alhayat.json');
if(fs.existsSync(qManifestPath)){
  const j = JSON.parse(fs.readFileSync(qManifestPath,'utf8'));
  console.log(`manifest stories: ${j.stories.length}`);
  for(const story of j.stories){
    const slug = story.slug;
    const pages = story.pages?.length || 0;
    // check if output exists
    const outDir = `tools/playveo/output/qml-${slug}`;
    const outCount = countJpg(outDir);
    console.log(`  ${slug}: pages=${pages} output=${outCount} (expected ~${pages+3}) title=${story.title_ar}`);
  }
}else{
  console.log('no manifest');
}

console.log('\n=== BOOKS ===');
const booksDir = path.join(ROOT,'docs/content/planets/05-qisas/books');
if(fs.existsSync(booksDir)){
  for(const f of fs.readdirSync(booksDir)){
    if(f.endsWith('.md')) console.log(`  ${f}`);
  }
}
console.log('\n=== REMAINING-ARTWORK (game engines + prompts) 20 assets ===');
console.log(`output remaining-artwork jpg=${countJpg('tools/playveo/output/remaining-artwork')} / 20`);

console.log('\n=== AUDIO DETAILS ===');
for(const d of fs.readdirSync(path.join(ROOT,'assets/audio/stories'))){
  const full = path.join(ROOT,'assets/audio/stories',d);
  if(fs.statSync(full).isDirectory()){
    const wavCount = countWav(`assets/audio/stories/${d}`);
    const hasDur = fs.existsSync(path.join(full,'ar/_durations.json')) || fs.existsSync(path.join(full,'_durations.json'));
    console.log(`${d}: wav=${wavCount} has_durations=${hasDur}`);
  }
}

console.log('\n=== PLAYVEO CREDITS & BULK STATE ===');
const statePath = path.join(ROOT,'tools/playveo/.produce-missing-bulk-state.json');
if(fs.existsSync(statePath)){
  const st = JSON.parse(fs.readFileSync(statePath,'utf8'));
  const last = st.batches?.slice(-1)[0];
  console.log(`batches total: ${st.batches?.length} last remainingCredits: ${last?.remainingCredits}`);
}
