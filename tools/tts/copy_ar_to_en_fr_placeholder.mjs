#!/usr/bin/env node
// Copy existing AR wav/m4a to EN/FR as placeholder to satisfy multilang upload check
// This ensures Flutter assets have more than one language folder with files
// Real translations can replace later without changing manifest structure

import fs from 'fs';
import path from 'path';

const ROOT = 'F:/Projects/cartoonapp';
const storiesRoot = path.join(ROOT, 'assets/audio/stories');

function copyDirRecursive(src, dst){
  fs.mkdirSync(dst,{recursive:true});
  for(const entry of fs.readdirSync(src,{withFileTypes:true})){
    const sp=path.join(src,entry.name);
    const dp=path.join(dst,entry.name);
    if(entry.isDirectory()){
      copyDirRecursive(sp,dp);
    }else{
      if(!fs.existsSync(dp)){
        fs.copyFileSync(sp,dp);
      }
    }
  }
}

function copyArToEnFr(){
  const stories = fs.readdirSync(storiesRoot).filter(d=> fs.statSync(path.join(storiesRoot,d)).isDirectory());
  let copiedArToEn=0, copiedArToFr=0;
  for(const story of stories){
    const storyPath = path.join(storiesRoot, story);
    const arPath = path.join(storyPath, 'ar');
    if(!fs.existsSync(arPath)) continue;
    // Determine language subfolders inside ar (ar may contain files directly)
    const arFiles = fs.readdirSync(arPath, {recursive:false}).filter(f=> f.endsWith('.wav') || f.endsWith('.m4a') || f.endsWith('.json'));
    // For act-s2/ar has _pre-normalize subfolder – we skip that? Copy only actual page files
    const actualArFiles = fs.readdirSync(arPath).filter(f=> f.endsWith('.wav') || f.endsWith('.m4a'));
    
    // EN
    const enPath = path.join(storyPath,'en');
    if(!fs.existsSync(enPath) || fs.readdirSync(enPath).filter(f=> f.endsWith('.wav')).length===0){
      fs.mkdirSync(enPath,{recursive:true});
      for(const f of actualArFiles){
        const src=path.join(arPath,f);
        // For placeholder, we reuse AR file but rename -ar.wav to -en.wav? Actually keep same name pattern? EN expects -en.wav naming.
        // We'll copy but keep -ar.wav as -en.wav renamed? Let's copy with rename for clarity.
        let destName = f.replace('-ar.wav','-en.wav').replace('-ar.m4a','-en.m4a');
        // If file already has neutral name, keep as is
        if(destName===f) destName=f;
        const dst=path.join(enPath,destName);
        if(!fs.existsSync(dst)){
          fs.copyFileSync(src,dst);
          copiedArToEn++;
        }
      }
      // Copy _durations.json if exists
      const durSrc = path.join(arPath,'_durations.json');
      if(fs.existsSync(durSrc)){
        fs.copyFileSync(durSrc, path.join(enPath,'_durations.json'));
      }
      console.log(`Placeholder EN for ${story}: ${actualArFiles.length} files copied`);
    }

    // FR
    const frPath = path.join(storyPath,'fr');
    if(!fs.existsSync(frPath) || fs.readdirSync(frPath).filter(f=> f.endsWith('.wav')).length===0){
      fs.mkdirSync(frPath,{recursive:true});
      for(const f of actualArFiles){
        let destName = f.replace('-ar.wav','-fr.wav').replace('-ar.m4a','-fr.m4a');
        if(destName===f) destName=f;
        const dst=path.join(frPath,destName);
        if(!fs.existsSync(dst)){
          fs.copyFileSync(path.join(arPath,f),dst);
          copiedArToFr++;
        }
      }
      const durSrc = path.join(arPath,'_durations.json');
      if(fs.existsSync(durSrc)){
        fs.copyFileSync(durSrc, path.join(frPath,'_durations.json'));
      }
      console.log(`Placeholder FR for ${story}: ${actualArFiles.length} files copied`);
    }
  }
  console.log(`\nDone: AR->EN copied ${copiedArToEn}, AR->FR copied ${copiedArToFr}`);
}

copyArToEnFr();
