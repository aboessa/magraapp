import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const srcDir = 'F:/Projects/cartoonapp/majarra_images/assets/images/characters';
const outDir = 'F:/Projects/cartoonapp/app_main/assets/avatars/characters';

fs.mkdirSync(outDir, { recursive: true });

// For each sheet, extract circular face crops from bottom row
// Sheets are 1376x768, bottom row ~ y 500-760, 6 faces equally spaced

const configs = [
  {
    file: 'luna-preschool-character-sheet.png',
    id: 'luna',
    faces: [
      { x: 35, y: 460, size: 200, name: 'luna-happy' },
      { x: 210, y: 460, size: 190, name: 'luna-smile' },
      { x: 390, y: 460, size: 190, name: 'luna-curious' },
      { x: 575, y: 460, size: 195, name: 'luna-point' },
      { x: 765, y: 460, size: 190, name: 'luna-calm' },
      { x: 955, y: 460, size: 200, name: 'luna-excited' },
    ],
  },
  {
    file: 'nouma-character-sheet.png',
    id: 'nouma',
    faces: [
      { x: 25, y: 470, size: 185, name: 'nouma-smile' },
      { x: 210, y: 470, size: 185, name: 'nouma-happy' },
      { x: 395, y: 470, size: 185, name: 'nouma-thinking' },
      { x: 580, y: 470, size: 185, name: 'nouma-surprised' },
      { x: 765, y: 470, size: 185, name: 'nouma-angry' },
      { x: 950, y: 470, size: 185, name: 'nouma-like' },
    ],
  },
  {
    file: 'zaina-yasin-kids-character-sheet (1).png',
    id: 'zaina-yasin',
    // Top row zaina 5 + action, bottom row yasin
    // We'll extract zaina happy + yasin smile etc plus combined
    faces: [
      // Zaina top left
      { x: 30, y: 5, size: 160, name: 'zaina-front' },
      { x: 180, y: 5, size: 155, name: 'zaina-side' },
      { x: 545, y: 10, size: 145, name: 'zaina-magnify' },
      { x: 760, y: 110, size: 145, name: 'zaina-map' },
      { x: 1130, y: 20, size: 170, name: 'zaina-jump' },
      // Yasin bottom
      { x: 20, y: 380, size: 155, name: 'yaseen-front' },
      { x: 390, y: 380, size: 150, name: 'yaseen-magnify' },
      { x: 580, y: 480, size: 150, name: 'yaseen-surprised' },
      { x: 760, y: 440, size: 160, name: 'yaseen-map' },
      { x: 980, y: 440, size: 170, name: 'yaseen-highfive' },
    ],
  },
  {
    file: 'addaad-robot-character-sheet.png',
    id: 'addaad',
    faces: [
      { x: 30, y: 460, size: 185, name: 'addaad-happy' },
      { x: 225, y: 460, size: 185, name: 'addaad-confused' },
      { x: 420, y: 460, size: 185, name: 'addaad-thinking' },
      { x: 615, y: 460, size: 185, name: 'addaad-learning' },
      { x: 810, y: 460, size: 185, name: 'addaad-celebrating' },
      { x: 1005, y: 460, size: 185, name: 'addaad-help' },
    ],
  },
  {
    file: 'robo-junior-character-sheet.png',
    id: 'robo',
    faces: [
      { x: 15, y: 430, size: 190, name: 'robo-analytical' },
      { x: 215, y: 430, size: 185, name: 'robo-curious' },
      { x: 410, y: 430, size: 185, name: 'robo-explaining' },
      { x: 605, y: 430, size: 185, name: 'robo-debugging' },
      { x: 800, y: 430, size: 185, name: 'robo-success' },
      { x: 1000, y: 430, size: 185, name: 'robo-warning' },
    ],
  },
];

async function createCircularAvatar(inputPath, extract, outputPath) {
  // Extract square then resize to 512 and apply circular mask with background
  const size = 512;
  const circleSvg = `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`;

  // Extract region and resize to 512
  const cropped = await sharp(inputPath)
    .extract({ left: extract.x, top: extract.y, width: extract.size, height: extract.size })
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer();

  // Create circular mask
  const mask = await sharp(Buffer.from(circleSvg)).png().toBuffer();

  await sharp(cropped)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(outputPath);

  console.log(`Created ${outputPath}`);
}

async function createPlanetAvatars() {
  // Also create planet-based avatars using gradients + icons concept but as images
  const planets = [
    { id: 'abjad', label: 'كوكب أبجد', colors: ['#FF6B6B', '#FF8E8E'], char: 'أ' },
    { id: 'arqam', label: 'كوكب أرقام', colors: ['#4ECDC4', '#2A9D8F'], char: '٣' },
    { id: 'oloom', label: 'كوكب علوم', colors: ['#45B7D1', '#6A82FB'], char: '◐' },
    { id: 'qiyam', label: 'كوكب قيم', colors: ['#96CEB4', '#2FBF8F'], char: '♥' },
    { id: 'qisas', label: 'كوكب قصص', colors: ['#FECA57', '#FF9F45'], char: '✧' },
    { id: 'maharat', label: 'كوكب مهارات', colors: ['#A29BFE', '#6C5CE7'], char: '⚡' },
    { id: 'tarikh', label: 'كوكب تاريخ', colors: ['#E17055', '#D63031'], char: '⌛' },
    { id: 'alam', label: 'كوكب العالم', colors: ['#00B894', '#00CEC9'], char: '◍' },
    { id: 'islamic', label: 'كوكب القيم الإسلامية', colors: ['#2FBF8F', '#00A86B'], char: '☪' },
  ];

  for (const planet of planets) {
    const size = 512;
    const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="0.3" cy="0.3" r="0.8">
          <stop offset="0%" stop-color="${planet.colors[0]}" />
          <stop offset="100%" stop-color="${planet.colors[1]}" />
        </radialGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="20" stdDeviation="20" flood-color="${planet.colors[1]}" flood-opacity="0.4"/></filter>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 10}" fill="url(#g)" filter="url(#shadow)"/>
      <text x="${size/2}" y="${size/2 + 30}" font-family="Arial" font-size="200" font-weight="900" fill="white" text-anchor="middle" opacity="0.92">${planet.char}</text>
    </svg>`;
    const outPath = path.join(outDir, `../planets/${planet.id}.png`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await sharp(Buffer.from(svg)).png().toFile(outPath);
    console.log(`Planet ${outPath}`);
  }
}

async function main() {
  for (const cfg of configs) {
    const inputPath = path.join(srcDir, cfg.file);
    if (!fs.existsSync(inputPath)) {
      console.log(`Skip missing ${inputPath}`);
      continue;
    }
    for (const face of cfg.faces) {
      const outPath = path.join(outDir, `${face.name}.png`);
      try {
        await createCircularAvatar(inputPath, face, outPath);
      } catch (e) {
        console.error(`Failed ${face.name}`, e.message);
      }
    }
  }
  await createPlanetAvatars();

  // Also copy original sheets front faces as full-body avatars (center crop)
  const fullFaces = [
    { file: 'luna-preschool-character-sheet.png', name: 'luna-full', x: 20, y: 10, size: 210 },
    { file: 'nouma-character-sheet.png', name: 'nouma-full', x: 35, y: 10, size: 180 },
    { file: 'zaina-yasin-kids-character-sheet (1).png', name: 'zaina-full', x: 25, y: 5, size: 165 },
    { file: 'zaina-yasin-kids-character-sheet (1).png', name: 'yaseen-full', x: 20, y: 375, size: 165 },
    { file: 'salma-presenter-reference.png', name: 'salma-full', x: 10, y: 10, size: 220 },
  ];

  // Salma sheet is different dimensions, handle separately
  const salmaMeta = await sharp(path.join(srcDir, 'salma-presenter-reference.png')).metadata().catch(()=>({width:1376,height:768}));
  console.log('salma meta', salmaMeta.width, salmaMeta.height);

  for (const f of fullFaces) {
    const input = path.join(srcDir, f.file);
    if (!fs.existsSync(input)) continue;
    // For salma, sheet is taller, use top-left
    const actualX = f.file.includes('salma') ? 20 : f.x;
    const actualY = f.file.includes('salma') ? 20 : f.y;
    const actualSize = f.file.includes('salma') ? 300 : f.size;
    const outPath = path.join(outDir, `${f.name}.png`);
    try {
      await createCircularAvatar(input, { x: actualX, y: actualY, size: actualSize }, outPath);
    } catch (e) {
      console.error(`full ${f.name} failed`, e.message);
    }
  }

  console.log('All avatars generated');
}

main();
