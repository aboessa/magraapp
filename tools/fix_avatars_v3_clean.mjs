#!/usr/bin/env node
// Majarra Avatar v3 – Clean professional avatar
// Uses aggressive white removal + edge feather + premium background
// Produces perfect 1:1 square navy avatar safe for circular ClipOval

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ROOT = 'F:/Projects/cartoonapp';
const srcDir = `${ROOT}/majarra_images/assets/images/characters`;
const outDir = `${ROOT}/app_main/assets/avatars/characters`;
fs.mkdirSync(outDir, {recursive:true});

async function createAvatar(inputPath, box, outPath) {
  const SIZE = 1024;
  const extract = await sharp(inputPath).extract({left:box.x, top:box.y, width:box.size, height:box.size}).png().toBuffer();
  // Remove white – more aggressive, also remove light gray up to 228
  const {data, info} = await sharp(extract).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const out = Buffer.alloc(data.length);
  for(let i=0;i<info.width*info.height;i++){
    const r=data[i*4], g=data[i*4+1], b=data[i*4+2], a=data[i*4+3];
    // bright near-white
    const avg=(r+g+b)/3;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    const diff=max-min;
    // background white/light gray – make transparent
    if((r>232&&g>232&&b>232) || (avg>215 && diff<20)){
      out[i*4]=0;out[i*4+1]=0;out[i*4+2]=0;out[i*4+3]=0;
    } else if(avg>195 && diff<25){
      // light halo – feather to 20% alpha
      out[i*4]=r;out[i*4+1]=g;out[i*4+2]=b;out[i*4+3]=Math.round(a*0.18);
    } else {
      // Keep but premultiply slightly darker halo around edges for clean look
      out[i*4]=r;out[i*4+1]=g;out[i*4+2]=b;out[i*4+3]=a;
    }
  }
  let cleaned = await sharp(out, {raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  // Trim then slightly dilate alpha to remove fringe? Use blur then threshold trick?
  // We'll trim tightly then remove any remaining halo with median + blur mask

  // Trim transparent border
  cleaned = await sharp(cleaned).trim({ threshold: 8 }).png().toBuffer();
  // Resize to 72% of canvas (face will be ~72%)
  const innerSize = Math.floor(SIZE*0.78);
  // For robots – slightly smaller
  const targetInner = box.isRobot ? Math.floor(SIZE*0.72) : innerSize;
  const resized = await sharp(cleaned).resize(targetInner, targetInner, {fit:'contain', background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();

  // Premium navy gradient background
  const bgSvg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
   <radialGradient id="g" cx="0.5" cy="0.45" r="0.9">
    <stop offset="0%" stop-color="#1E2E6B"/>
    <stop offset="18%" stop-color="#192656"/>
    <stop offset="40%" stop-color="#141F45"/>
    <stop offset="75%" stop-color="#0E1733"/>
    <stop offset="100%" stop-color="#0A1128"/>
   </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
</svg>`;
  const bg = await sharp(Buffer.from(bgSvg)).png().toBuffer();

  // Shadow under character – subtle
  const shadowSvg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="${SIZE/2}" cy="${SIZE*0.84}" rx="${targetInner*0.36}" ry="${targetInner*0.12}" fill="black" opacity="0.28"/>
  </svg>`;
  const shadow = await sharp(Buffer.from(shadowSvg)).png().toBuffer();

  const composed = await sharp(bg).composite([
    {input:shadow, blend:'over'},
    {input:resized, gravity:'center', blend:'over'},
  ]).png().toBuffer();

  await sharp(composed).png({compressionLevel:8}).toFile(outPath);
  console.log(`✅ ${path.basename(outPath)}`);
}

const jobs = [
  // Luna bottom row 6 expressions – Luna is from preschool series
  {file:'luna-preschool-character-sheet.png', x:22, y:430, size:208, out:'luna-happy.png'},
  {file:'luna-preschool-character-sheet.png', x:232, y:430, size:208, out:'luna-smile.png'},
  {file:'luna-preschool-character-sheet.png', x:442, y:430, size:208, out:'luna-curious.png'},
  {file:'luna-preschool-character-sheet.png', x:652, y:430, size:208, out:'luna-point.png'},
  {file:'luna-preschool-character-sheet.png', x:862, y:430, size:208, out:'luna-calm.png'},
  {file:'luna-preschool-character-sheet.png', x:1072, y:430, size:208, out:'luna-excited.png'},
  {file:'luna-preschool-character-sheet.png', x:18, y:8, size:245, out:'luna-full.png'},
  {file:'luna-preschool-character-sheet.png', x:18, y:8, size:245, out:'luna.png'},

  {file:'nouma-character-sheet.png', x:18, y:438, size:203, out:'nouma-smile.png'},
  {file:'nouma-character-sheet.png', x:226, y:438, size:203, out:'nouma-happy.png'},
  {file:'nouma-character-sheet.png', x:433, y:438, size:203, out:'nouma-thinking.png'},
  {file:'nouma-character-sheet.png', x:640, y:438, size:203, out:'nouma-surprised.png'},
  {file:'nouma-character-sheet.png', x:847, y:438, size:203, out:'nouma-angry.png'},
  {file:'nouma-character-sheet.png', x:1054, y:438, size:203, out:'nouma-like.png'},
  {file:'nouma-character-sheet.png', x:22, y:10, size:220, out:'nouma-full.png'},
  {file:'nouma-character-sheet.png', x:22, y:10, size:220, out:'nouma.png'},

  {file:'zaina-yasin-kids-character-sheet (1).png', x:16, y:6, size:228, out:'zaina-front.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:16, y:6, size:228, out:'zaina-full.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:16, y:6, size:228, out:'zaina.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:256, y:6, size:210, out:'zaina-side.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:484, y:14, size:208, out:'zaina-magnify.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:710, y:14, size:208, out:'zaina-map.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:1078, y:8, size:220, out:'zaina-jump.png'},

  {file:'zaina-yasin-kids-character-sheet (1).png', x:20, y:382, size:212, out:'yaseen-front.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:20, y:382, size:212, out:'yaseen-full.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:20, y:382, size:212, out:'yaseen.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:244, y:382, size:208, out:'yaseen-magnify.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:462, y:382, size:208, out:'yaseen-surprised.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:690, y:386, size:208, out:'yaseen-map.png'},
  {file:'zaina-yasin-kids-character-sheet (1).png', x:985, y:384, size:232, out:'yaseen-highfive.png'},

  // Addaad – isRobot
  {file:'addaad-robot-character-sheet.png', x:20, y:445, size:198, out:'addaad-happy.png', isRobot:true},
  {file:'addaad-robot-character-sheet.png', x:225, y:445, size:198, out:'addaad-confused.png', isRobot:true},
  {file:'addaad-robot-character-sheet.png', x:430, y:445, size:198, out:'addaad-thinking.png', isRobot:true},
  {file:'addaad-robot-character-sheet.png', x:635, y:445, size:198, out:'addaad-learning.png', isRobot:true},
  {file:'addaad-robot-character-sheet.png', x:840, y:445, size:198, out:'addaad-celebrating.png', isRobot:true},
  {file:'addaad-robot-character-sheet.png', x:1045, y:445, size:198, out:'addaad-help.png', isRobot:true},
  {file:'addaad-robot-character-sheet.png', x:20, y:445, size:198, out:'addaad.png', isRobot:true},

  {file:'robo-junior-character-sheet.png', x:18, y:445, size:198, out:'robo-analytical.png', isRobot:true},
  {file:'robo-junior-character-sheet.png', x:223, y:445, size:198, out:'robo-curious.png', isRobot:true},
  {file:'robo-junior-character-sheet.png', x:428, y:445, size:198, out:'robo-explaining.png', isRobot:true},
  {file:'robo-junior-character-sheet.png', x:633, y:445, size:198, out:'robo-debugging.png', isRobot:true},
  {file:'robo-junior-character-sheet.png', x:838, y:445, size:198, out:'robo-success.png', isRobot:true},
  {file:'robo-junior-character-sheet.png', x:1043, y:445, size:198, out:'robo-warning.png', isRobot:true},
  {file:'robo-junior-character-sheet.png', x:18, y:445, size:198, out:'robo.png', isRobot:true},

  {file:'salma-presenter-reference.png', x:462, y:28, size:342, out:'salma-full.png'},
  {file:'salma-presenter-reference.png', x:462, y:28, size:342, out:'salma.png'},
];

async function main(){
  console.log('🎨 Avatars v3 – clean\n');
  for(const j of jobs){
    const src = path.join(srcDir, j.file);
    if(!fs.existsSync(src)) continue;
    const out = path.join(outDir, j.out);
    try{
      await createAvatar(src, j, out);
    }catch(e){ console.error('❌', j.out, e.message); }
  }
  console.log('\n✅ v3 Done');
}
main();
