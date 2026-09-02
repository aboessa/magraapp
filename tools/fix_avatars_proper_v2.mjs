#!/usr/bin/env node
// Majarra – Proper Avatar Fix v2
// Extracts HEAD only, removes white bg, places on premium navy, circular safe.

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ROOT = 'F:/Projects/cartoonapp';
const srcDir = `${ROOT}/majarra_images/assets/images/characters`;
const outDir = `${ROOT}/app_main/assets/avatars/characters`;
const outPlanets = `${ROOT}/app_main/assets/avatars/planets`;
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(outPlanets, { recursive: true });

async function removeWhiteBgAndResize(inputBuffer, targetSize) {
  // inputBuffer is PNG of extracted head
  // 1. Get raw RGBA
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i*4];
    const g = data[i*4+1];
    const b = data[i*4+2];
    const a = data[i*4+3];
    // White threshold: if very close to white, make transparent
    // Use 240 threshold, and also check max-min < 20 to avoid removing light skin
    const isWhite = r > 235 && g > 235 && b > 235;
    const isNearWhite = r > 225 && g > 225 && b > 225 && Math.max(r,g,b) - Math.min(r,g,b) < 18;
    if (isWhite || isNearWhite) {
      out[i*4] = 0; out[i*4+1]=0; out[i*4+2]=0; out[i*4+3]=0;
    } else {
      // Keep but slightly clean light halo: if r>200,g>200,b>200 and not skin, feather
      // Skin has more red; keep if r significantly > b
      if (r>210 && g>210 && b>210 && (r - b) < 15 && (g - b) < 15) {
        // very light gray halo -> semi-transparent
        out[i*4]=r; out[i*4+1]=g; out[i*4+2]=b; out[i*4+3]= Math.round(a*0.15);
      } else {
        out[i*4]=r; out[i*4+1]=g; out[i*4+2]=b; out[i*4+3]=a;
      }
    }
  }
  // Rebuild sharp from raw
  const noBg = await sharp(out, { raw:{ width: info.width, height: info.height, channels:4 } })
    .png()
    .toBuffer();

  // Trim transparent border then resize to contain within targetSize*0.82
  const trimmed = await sharp(noBg).trim({ threshold: 10 }).png().toBuffer();
  const inner = Math.floor(targetSize * 0.88);
  const resized = await sharp(trimmed)
    .resize(inner, inner, { fit:'contain', background:{r:0,g:0,b:0,alpha:0} })
    .png()
    .toBuffer();
  return resized;
}

async function createPremiumAvatar(inputPath, extract, outputPath) {
  const SIZE = 1024;

  // 1. Extract raw crop from sheet
  const extracted = await sharp(inputPath)
    .extract({ left: extract.x, top: extract.y, width: extract.size, height: extract.size })
    .png()
    .toBuffer();

  // 2. Remove white bg + resize head
  const character = await removeWhiteBgAndResize(extracted, SIZE);

  // 3. Navy radial background
  const bgSvg = `
  <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g" cx="0.5" cy="0.42" r="0.78">
        <stop offset="0%" stop-color="#1E2A5A"/>
        <stop offset="25%" stop-color="#162040"/>
        <stop offset="55%" stop-color="#0F1733"/>
        <stop offset="100%" stop-color="#0A1028"/>
      </radialGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  </svg>`;
  const bg = await sharp(Buffer.from(bgSvg)).png().toBuffer();

  const composed = await sharp(bg)
    .composite([{ input: character, gravity:'center', blend:'over' }])
    .png()
    .toBuffer();

  await sharp(composed).png({ compressionLevel:9 }).toFile(outputPath);
  console.log(`✅ ${path.basename(outputPath)} [${extract.name}] ${extract.desc||''}`);
}

const configs = [
  {
    file: 'luna-preschool-character-sheet.png',
    items: [
      { x:22, y:430, size:208, name:'luna-happy', desc:'happy wave bottom 1' },
      { x:232, y:430, size:208, name:'luna-smile', desc:'smile 2' },
      { x:442, y:430, size:208, name:'luna-curious', desc:'curious 3' },
      { x:652, y:430, size:208, name:'luna-point', desc:'pointing 4' },
      { x:862, y:430, size:208, name:'luna-calm', desc:'calm 5' },
      { x:1072, y:430, size:208, name:'luna-excited', desc:'excited 6' },
      // Full portrait top – take bigger crop but same face focused
      { x:18, y:8, size:215, name:'luna-full', desc:'full top-left portrait' },
      // Add missing that picker expects
      { x:232, y:430, size:208, name:'luna', desc:'alias luna' },
    ]
  },
  {
    file: 'nouma-character-sheet.png',
    items: [
      { x:18, y:438, size:203, name:'nouma-smile', desc:'smile 1' },
      { x:226, y:438, size:203, name:'nouma-happy', desc:'happy 2' },
      { x:433, y:438, size:203, name:'nouma-thinking', desc:'thinking 3' },
      { x:640, y:438, size:203, name:'nouma-surprised', desc:'surprised 4' },
      { x:847, y:438, size:203, name:'nouma-angry', desc:'angry 5' },
      { x:1054, y:438, size:203, name:'nouma-like', desc:'like 6' },
      { x:22, y:10, size:208, name:'nouma-full', desc:'full' },
      { x:226, y:438, size:203, name:'nouma', desc:'alias nouma' },
    ]
  },
  {
    file: 'zaina-yasin-kids-character-sheet (1).png',
    items: [
      // Zaina top row
      { x:16, y:6, size:210, name:'zaina-front', desc:'zaina front top-left' },
      { x:238, y:6, size:205, name:'zaina-side', desc:'zaina side' },
      { x:470, y:10, size:205, name:'zaina-magnify', desc:'zaina magnify' },
      { x:698, y:10, size:205, name:'zaina-map', desc:'zaina map' },
      { x:1070, y:8, size:218, name:'zaina-jump', desc:'zaina jump top-right' },
      { x:16, y:6, size:210, name:'zaina-full', desc:'zaina full alias' },
      { x:16, y:6, size:210, name:'zaina', desc:'alias zaina' },
      // Yaseen bottom row ~ y 380
      { x:20, y:382, size:200, name:'yaseen-front', desc:'yaseen front bottom' },
      { x:238, y:382, size:200, name:'yaseen-magnify', desc:'yaseen magnify' },
      { x:456, y:382, size:200, name:'yaseen-surprised', desc:'yaseen surprised' },
      { x:688, y:384, size:200, name:'yaseen-map', desc:'yaseen map' },
      { x:980, y:382, size:230, name:'yaseen-highfive', desc:'yaseen highfive' },
      { x:20, y:382, size:200, name:'yaseen-full', desc:'yaseen full alias' },
      { x:20, y:382, size:200, name:'yaseen', desc:'alias yaseen' },
    ]
  },
  {
    file: 'addaad-robot-character-sheet.png',
    items: [
      { x:20, y:445, size:195, name:'addaad-happy', desc:'happy 1' },
      { x:225, y:445, size:195, name:'addaad-confused', desc:'confused 2' },
      { x:430, y:445, size:195, name:'addaad-thinking', desc:'thinking 3' },
      { x:635, y:445, size:195, name:'addaad-learning', desc:'learning 4' },
      { x:840, y:445, size:195, name:'addaad-celebrating', desc:'celebrating 5' },
      { x:1045, y:445, size:195, name:'addaad-help', desc:'help 6' },
      { x:20, y:445, size:195, name:'addaad', desc:'alias addaad' },
    ]
  },
  {
    file: 'robo-junior-character-sheet.png',
    items: [
      { x:18, y:445, size:195, name:'robo-analytical', desc:'analytical' },
      { x:223, y:445, size:195, name:'robo-curious', desc:'curious' },
      { x:428, y:445, size:195, name:'robo-explaining', desc:'explaining' },
      { x:633, y:445, size:195, name:'robo-debugging', desc:'debugging' },
      { x:838, y:445, size:195, name:'robo-success', desc:'success' },
      { x:1043, y:445, size:195, name:'robo-warning', desc:'warning' },
      { x:18, y:445, size:195, name:'robo', desc:'alias robo' },
    ]
  },
  {
    file: 'salma-presenter-reference.png',
    items: [
      { x:460, y:28, size:330, name:'salma-full', desc:'salma head close' },
      { x:460, y:28, size:330, name:'salma', desc:'alias salma' },
    ]
  },
];

async function main(){
  console.log('🎨 Majarra Avatar Fix v2 – face-centered, white removed, navy bg\n');
  for(const cfg of configs){
    const inputPath = path.join(srcDir, cfg.file);
    if(!fs.existsSync(inputPath)){ console.log('skip',cfg.file); continue; }
    console.log(`\n📄 ${cfg.file} – ${cfg.items.length} avatars`);
    for(const item of cfg.items){
      const outPath = path.join(outDir, `${item.name}.png`);
      try{
        await createPremiumAvatar(inputPath, item, outPath);
      }catch(e){
        console.error(`❌ ${item.name}`, e.message, e.stack?.split('\n')[0]);
      }
    }
  }
  console.log('\n✅ Done. Check app_main/assets/avatars/characters/');
}

main();
