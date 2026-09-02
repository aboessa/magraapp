import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..','..');
const v2Dir = path.join(root, 'assets/images/coloring/v2');
fs.mkdirSync(v2Dir, {recursive:true});

// List existing files
const files = fs.existsSync(v2Dir) ? fs.readdirSync(v2Dir) : [];
console.log('Existing v2 files:', files);

// Ensure we have placeholders (copy bird.png as fallback for each category if not exist)
const fallback = path.join(root, 'assets/images/coloring/bird.png');
const cats = ['cat','dino','fish','animals','birds','vehicles','space','flowers','sea','fruits','toys'];
for (const c of cats) {
  const dstJpg = path.join(v2Dir, `${c}.png`);
  if (!fs.existsSync(dstJpg)) {
    if (fs.existsSync(fallback)) {
      fs.copyFileSync(fallback, dstJpg);
      console.log(`fallback copied bird → ${c}.png`);
    }
  }
}

const heroDir = path.join(root, 'assets/images/studio/v2');
fs.mkdirSync(heroDir, {recursive:true});
const heroSrc = path.join(root,'assets/images/studio/hero-start-drawing.webp');
const heroDst = path.join(heroDir, 'coloring-hero.png');
if (!fs.existsSync(heroDst) && fs.existsSync(heroSrc)) {
  fs.copyFileSync(heroSrc, heroDst);
  console.log('hero fallback copied');
}
console.log('prepare-coloring-v2 done');
