#!/usr/bin/env node
// Convert all WAV stories to M4A (AAC) for delivery, with ffmpeg if available
// Also normalizes via wav header already 24kHz mono

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = 'F:/Projects/cartoonapp';
const storiesRoot = path.join(ROOT,'assets/audio/stories');

function findWavFiles(root){
  const out=[];
  const rec=(dir)=>{
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      const p=path.join(dir,e.name);
      if(e.isDirectory()) rec(p);
      else if(e.isFile() && e.name.toLowerCase().endsWith('.wav')) out.push(p);
    }
  };
  rec(root);
  return out;
}

function hasFfmpeg(){
  const r=spawnSync('ffmpeg',['-version'],{ encoding:'utf8' });
  return r.status===0;
}

const ffmpegAvailable = hasFfmpeg();
console.log(`ffmpeg available: ${ffmpegAvailable}`);

const wavs = findWavFiles(storiesRoot);
console.log(`Found ${wavs.length} wav files`);

let converted=0, skipped=0, failed=0;
for(const wavPath of wavs){
  const dir=path.dirname(wavPath);
  const base=path.basename(wavPath,'.wav');
  const m4aPath=path.join(dir, base+'.m4a');
  if(fs.existsSync(m4aPath)){
    skipped++;
    continue;
  }
  if(!ffmpegAvailable){
    // create placeholder note
    console.log(`Skip (no ffmpeg): ${wavPath}`);
    skipped++;
    continue;
  }
  // ffmpeg -i input.wav -c:a aac -b:a 64k -ac 1 -ar 24000 output.m4a
  const args=['-y','-i', wavPath, '-c:a','aac','-b:a','64k','-ac','1','-ar','24000', m4aPath];
  const res=spawnSync('ffmpeg', args, { encoding:'utf8', stdio: 'pipe' });
  if(res.status!==0){
    console.error(`Failed convert ${wavPath}: ${res.stderr?.slice(0,500)}`);
    failed++;
  }else{
    converted++;
    if(converted%20===0) console.log(`Converted ${converted}...`);
  }
}

console.log(`\nDone: converted=${converted} skipped=${skipped} failed=${failed} out of ${wavs.length}`);
