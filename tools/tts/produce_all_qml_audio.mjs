#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
const stories = ['the-promised-friday','nine-metres','taller-than-me','the-key-that-was-left','the-extra-page'];

function run(cmd, args){
  return new Promise((resolve,reject)=>{
    console.log(`\n>> ${cmd} ${args.join(' ')}`);
    const p=spawn(cmd, args, { stdio:'inherit', shell:true, cwd:'F:/Projects/cartoonapp' });
    p.on('close', code=> code===0? resolve(): reject(new Error(`exit ${code}`)));
    p.on('error', reject);
  });
}

async function main(){
  for(const slug of stories){
    console.log(`\n\n===== qml-${slug} =====`);
    try{
      await run('node',[`tools/tts/narrate.mjs`,`--all`,`--manifest`, `qml-${slug}.narration.json`]);
    }catch(e){
      console.error(`FAIL qml-${slug}: ${e.message}`);
    }
  }
  console.log('\n\n=== AUDIO INVENTORY AFTER ===');
  for(const slug of stories){
    const dir=path.join('F:/Projects/cartoonapp/assets/audio/stories',`qml-${slug}/ar`);
    const count=fs.existsSync(dir)? fs.readdirSync(dir).filter(f=>f.endsWith('.wav')).length: 0;
    console.log(`qml-${slug}: ${count} wav`);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
