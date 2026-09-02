#!/usr/bin/env node
// Majarra — Fix avatar generation PROPERLY.
// The old generate_avatars.mjs had wrong coordinates — face was cut.
// This properly extracts HEAD+SHOULDERS (not full body) and centers face for circular avatar.

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ROOT = 'F:/Projects/cartoonapp';
const srcDir = `${ROOT}/majarra_images/assets/images/characters`;
const outDir = `${ROOT}/app_main/assets/avatars/characters`;
const outPlanets = `${ROOT}/app_main/assets/avatars/planets`;

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(outPlanets, { recursive: true });

// Carefully tuned FACE crops from sheets (x,y,size) – focusing on HEAD only
// Sheets are 1376x768. Bottom row is expressions (6 heads). Top is full body.
// We use BOTTOM row for avatar – it's already head+shoulders!

const configs = [
  {
    file: 'luna-preschool-character-sheet.png',
    desc: 'Luna bottom row = 6 expressions',
    faces: [
      // Luna bottom row – y ~ 420-760, each ~200px wide, centered head
      { x: 18, y: 425, size: 210, name: 'luna-happy', note: 'happy wave' },
      { x: 228, y: 425, size: 210, name: 'luna-smile', note: 'smile' },
      { x: 438, y: 425, size: 210, name: 'luna-curious', note: 'curious' },
      { x: 648, y: 425, size: 210, name: 'luna-point', note: 'pointing' },
      { x: 858, y: 425, size: 210, name: 'luna-calm', note: 'calm' },
      { x: 1070, y: 425, size: 210, name: 'luna-excited', note: 'excited' },
      // Full body for luna-full – use top left large
      { x: 25, y: 15, size: 260, name: 'luna-full', note: 'full body top' },
    ],
  },
  {
    file: 'nouma-character-sheet.png',
    desc: 'Nouma bottom 6 heads',
    faces: [
      { x: 15, y: 435, size: 205, name: 'nouma-smile', note: 'smile' },
      { x: 222, y: 435, size: 205, name: 'nouma-happy', note: 'happy' },
      { x: 429, y: 435, size: 205, name: 'nouma-thinking', note: 'thinking' },
      { x: 636, y: 435, size: 205, name: 'nouma-surprised', note: 'surprised' },
      { x: 843, y: 435, size: 205, name: 'nouma-angry', note: 'angry' },
      { x: 1050, y: 435, size: 205, name: 'nouma-like', note: 'like thumbs up' },
      { x: 18, y: 12, size: 250, name: 'nouma-full', note: 'full body' },
    ],
  },
  {
    file: 'zaina-yasin-kids-character-sheet (1).png',
    desc: 'Zaina top row, Yaseen bottom row',
    faces: [
      // Zaina top
      { x: 20, y: 10, size: 230, name: 'zaina-front', note: 'zaina front' },
      { x: 260, y: 10, size: 220, name: 'zaina-side', note: 'zaina side' },
      { x: 500, y: 15, size: 220, name: 'zaina-magnify', note: 'magnify' },
      { x: 730, y: 15, size: 220, name: 'zaina-map', note: 'map' },
      { x: 1075, y: 10, size: 235, name: 'zaina-jump', note: 'jump' },
      { x: 20, y: 10, size: 230, name: 'zaina-full', note: 'full as front good' },
      // Yaseen bottom
      { x: 20, y: 380, size: 210, name: 'yaseen-front', note: 'yaseen front' },
      { x: 250, y: 380, size: 210, name: 'yaseen-magnify', note: 'magnify bottom' },
      { x: 480, y: 380, size: 210, name: 'yaseen-surprised', note: 'surprised' },
      { x: 710, y: 380, size: 210, name: 'yaseen-map', note: 'map' },
      { x: 970, y: 380, size: 245, name: 'yaseen-highfive', note: 'highfive' },
      { x: 20, y: 380, size: 210, name: 'yaseen-full', note: 'full' },
    ],
  },
  {
    file: 'addaad-robot-character-sheet.png',
    desc: 'Addaad bottom 6 heads',
    faces: [
      { x: 15, y: 440, size: 200, name: 'addaad-happy' },
      { x: 220, y: 440, size: 200, name: 'addaad-confused' },
      { x: 425, y: 440, size: 200, name: 'addaad-thinking' },
      { x: 630, y: 440, size: 200, name: 'addaad-learning' },
      { x: 835, y: 440, size: 200, name: 'addaad-celebrating' },
      { x: 1040, y: 440, size: 200, name: 'addaad-help' },
    ],
  },
  {
    file: 'robo-junior-character-sheet.png',
    desc: 'Robo bottom 6 heads',
    faces: [
      { x: 12, y: 440, size: 200, name: 'robo-analytical' },
      { x: 218, y: 440, size: 200, name: 'robo-curious' },
      { x: 424, y: 440, size: 200, name: 'robo-explaining' },
      { x: 630, y: 440, size: 200, name: 'robo-debugging' },
      { x: 836, y: 440, size: 200, name: 'robo-success' },
      { x: 1042, y: 440, size: 200, name: 'robo-warning' },
    ],
  },
  {
    file: 'salma-presenter-reference.png',
    desc: 'Salma single',
    faces: [
      // Salma sheet is different – head is around middle
      { x: 480, y: 45, size: 340, name: 'salma-full', note: 'salma head' },
    ],
  },
];

async function createPremiumAvatar(inputPath, extract, outputPath) {
  // Extract then:
  // 1. Resize to 1024x1024 but KEEP face centered with padding
  // 2. Add premium deep-navy radial background behind character (remove white)
  // 3. Make circular mask but KEEP background, not transparent – solid

  const SIZE = 1024;
  const BG_COLOR = { r: 11, g: 16, b: 38 }; // deep navy #0B1026

  // First, extract region
  let img = sharp(inputPath).extract({
    left: Math.max(0, extract.x),
    top: Math.max(0, extract.y),
    width: extract.size,
    height: extract.size,
  });

  // Remove white/light background – make it have navy background
  // Approach: create a new canvas with navy, composite character on top with multiply/screen logic
  // Simpler: keep character as is but place on navy background with nice blending

  // Resize with contain to preserve entire head, add navy background for padding
  const resized = await img
    .resize(SIZE * 0.88, SIZE * 0.88, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Create circular navy background with subtle radial gradient effect via SVG
  const backgroundSvg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0%" stop-color="#1a2450" />
          <stop offset="35%" stop-color="#111A3A" />
          <stop offset="75%" stop-color="#0B1026" />
          <stop offset="100%" stop-color="#080E26" />
        </radialGradient>
      </defs>
      <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
    </svg>
  `;

  const bg = await sharp(Buffer.from(backgroundSvg)).png().toBuffer();

  // Composite face on background, centered
  const withBg = await sharp(bg)
    .composite([
      {
        input: resized,
        gravity: 'center',
        blend: 'over',
      },
    ])
    .png()
    .toBuffer();

  // Now apply circular mask to make it perfect circle with navy background kept inside circle
  // Create a circular mask SVG white on black
  const circleMaskSvg = `<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE/2}" cy="${SIZE/2}" r="${SIZE/2 - 6}" fill="white"/></svg>`;
  const mask = await sharp(Buffer.from(circleMaskSvg)).png().toBuffer();

  // For app – we want circle image with navy background visible, but corners should be transparent? No, Flutter ClipOval will clip.
  // Best: produce full square with character on navy, and let ClipOval handle circular裁切.
  // So we DON'T apply dest-in, we keep square. ClipOval in Flutter will make it circle.

  // Actually for better look, we keep square but with face centered on navy.
  // That way when ClipOval cuts it, background is navy, not white, so edges clean.

  // Save as PNG with good compression
  await sharp(withBg).png({ compressionLevel: 9, quality: 90 }).toFile(outputPath);
  console.log(`✅ ${path.basename(outputPath)} from ${path.basename(inputPath)} [${extract.name}]`);
}

async function main() {
  console.log('🎨 Fixing Majarra Avatars – Proper head+shoulders crops\n');
  for (const cfg of configs) {
    const inputPath = path.join(srcDir, cfg.file);
    if (!fs.existsSync(inputPath)) {
      console.log(`⏭️  Skip missing ${inputPath}`);
      continue;
    }
    const meta = await sharp(inputPath).metadata();
    console.log(`\n📄 ${cfg.file} ${meta.width}x${meta.height} – ${cfg.desc}`);
    for (const face of cfg.faces) {
      // Avoid duplicate overwrites for full as same name – last wins is OK
      const outPath = path.join(outDir, `${face.name}.png`);
      try {
        // bounds check
        if (face.x < 0 || face.y < 0 || face.x + face.size > meta.width || face.y + face.size > meta.height) {
          console.log(`  ⚠️  ${face.name} out of bounds, adjusting...`);
          face.x = Math.max(0, Math.min(face.x, meta.width - face.size));
          face.y = Math.max(0, Math.min(face.y, meta.height - face.size));
        }
        await createPremiumAvatar(inputPath, face, outPath);
      } catch (e) {
        console.error(`  ❌ Failed ${face.name}:`, e.message);
      }
    }
  }

  // Create planet avatars as fallback/premium gradient circles
  const planets = [
    { id: 'abjad', label: 'أ', colors: ['#FF6B6B', '#FF8E8E'] },
    { id: 'arqam', label: '٣', colors: ['#4ECDC4', '#2A9D8F'] },
    { id: 'oloom', label: '◐', colors: ['#45B7D1', '#6A82FB'] },
    { id: 'qiyam', label: '♥', colors: ['#96CEB4', '#2FBF8F'] },
    { id: 'qisas', label: '✧', colors: ['#FECA57', '#FF9F45'] },
    { id: 'maharat', label: '⚡', colors: ['#A29BFE', '#6C5CE7'] },
  ];
  console.log('\n🪐 Planet avatars:');
  for (const p of planets) {
    const size = 1024;
    const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="0.32" cy="0.30" r="0.85">
          <stop offset="0%" stop-color="${p.colors[0]}" />
          <stop offset="100%" stop-color="${p.colors[1]}" />
        </radialGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="${p.colors[1]}" flood-opacity="0.45"/></filter>
      </defs>
      <rect width="${size}" height="${size}" fill="#0B1026"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 40}" fill="url(#g)" filter="url(#shadow)" />
      <text x="${size/2}" y="${size/2 + 70}" font-family="Arial, sans-serif" font-size="380" font-weight="900" fill="white" text-anchor="middle" opacity="0.94">${p.label}</text>
    </svg>`;
    const outPath = path.join(outPlanets, `${p.id}.png`);
    try {
      await sharp(Buffer.from(svg)).png().toFile(outPath);
      console.log(`  ✅ ${p.id}.png`);
    } catch (e) {
      console.error(`  ❌ ${p.id} failed`, e.message);
    }
  }

  console.log('\n✨ All avatars fixed! Now they are head+shoulders centered on deep-navy, ready for ClipOval circle.');
  console.log('   Flutter ChildAvatarView will show them perfectly.');
}

main();
