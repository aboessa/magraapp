#!/usr/bin/env node
// Resume qml audio production - only missing files, to be run after quota reset (next day)
// Usage: node tools/tts/resume_qml_audio.mjs
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const slugs = ['nine-metres','taller-than-me','the-key-that-was-left','the-extra-page']; // Friday done

function missingPages(slug){
  const manifestPath = path.join('F:/Projects/cartoonapp/tools/tts', `qml-${slug}.narration.json`);
  if(!fs.existsSync(manifestPath)) return [];
  const j = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const outDir = path.join('F:/Projects/cartoonapp/assets/audio/stories', `qml-${slug}/ar`);
  const existing = fs.existsSync(outDir) ? new Set(fs.readdirSync(outDir).filter(f=>f.endsWith('.wav'))) : new Set();
  return j.lines.filter(l=> !existing.has(l.file)).map(l=> l.page);
}

async function runForSlug(slug){
  const missing = missingPages(slug);
  if(!missing.length){
    console.log(`qml-${slug}: already complete`);
    return;
  }
  console.log(`\n\n=== RESUME qml-${slug}: missing pages ${missing.join(',')} (${missing.length}) ===`);
  for(const page of missing){
    await new Promise((resolve,reject)=>{
      const proc = spawn('node',['tools/tts/narrate.mjs','--manifest',`qml-${slug}.narration.json`,'--page',String(page)],{ stdio:'inherit', cwd:'F:/Projects/cartoonapp', shell:true });
      proc.on('close',code=> code===0? resolve(): reject(new Error(`page ${page} exit ${code}`)));
      proc.on('error',reject);
    });
  }
}

async function main(){
  for(const slug of slugs){
    try{ await runForSlug(slug); }catch(e){ console.error(`Failed ${slug}: ${e.message}`); }
  }
  console.log('\n\nAll qml resume done. Run convert script after.');
}

main().catch(e=>{console.error(e); process.exit(1);});
