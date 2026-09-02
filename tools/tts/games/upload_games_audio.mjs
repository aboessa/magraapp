// Upload generated game voices to R2 + register in content_assets
// Workflow: generate Game voices via Google AI Studio => WAV 24kHz 16-bit
//   => convert to MP3 via cloud_tts or ffmpeg if available
//   => PUT to R2 private/audio/games/<engine>/ar/<file> via wrangler r2 object put --remote
//   => INSERT into content_assets via admin API or direct D1
//
// Usage:
//   node tools/tts/games/upload_games_audio.mjs --dry
//   node tools/tts/games/upload_games_audio.mjs --upload --engine count-quantity

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const GAMES_DIR = path.resolve(import.meta.dirname);

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return undefined;
  const n = process.argv[i + 1];
  return n && !n.startsWith('--') ? n : true;
}

const OPT = {
  dry: !!arg('dry'),
  upload: !!arg('upload'),
  engine: typeof arg('engine') === 'string' ? arg('engine') : undefined,
};

const manifests = fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('-ar.json'));

let filtered = manifests;
if (OPT.engine) filtered = manifests.filter(f => f.includes(OPT.engine));

console.log(`Found ${manifests.length} manifests, selected ${filtered.length}`);
console.log(`dry=${OPT.dry} upload=${OPT.upload}`);

for (const mfName of filtered) {
  const mfPath = path.join(GAMES_DIR, mfName);
  const m = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
  const outDir = path.resolve(ROOT, m.out_dir);
  console.log(`\n--- ${mfName}: ${m.lines.length} lines -> ${m.out_dir}`);
  if (!fs.existsSync(outDir)) {
    console.log(`  outDir missing, skip (generate voices first)`);
    continue;
  }
  const wavs = fs.readdirSync(outDir).filter(f => f.endsWith('.wav'));
  console.log(`  found ${wavs.length}/${m.lines.length} wavs`);

  for (const wav of wavs.slice(0, 3)) {
    const fp = path.join(outDir, wav);
    const stat = fs.statSync(fp);
    console.log(`    ${wav} ${stat.size} bytes`);
  }
  if (wavs.length > 3) console.log(`    ... +${wavs.length - 3} more`);

  if (OPT.upload) {
    console.log(`  uploading to R2 private/audio/games/...`);
    for (const wav of wavs) {
      const local = path.join(outDir, wav);
      const remoteKey = `private/audio/games/${mfName.replace('-ar.json','')}/ar/${wav}`;
      const cmd = `npx wrangler r2 object put majarra-media/${remoteKey} --file="${local}" --content-type="audio/wav" --remote`;
      if (OPT.dry) {
        console.log(`    DRY would run: ${cmd.slice(0,120)}...`);
      } else {
        console.log(`    uploading ${remoteKey}`);
        try {
          execSync(cmd, { cwd: path.join(ROOT,'dashboard/api'), stdio: 'inherit' });
        } catch (e) {
          console.log(`    FAIL ${wav}: ${e.message.slice(0,200)}`);
        }
      }
    }
  }
}

console.log('\nNext steps:');
console.log('1. Generate voices: node tools/tts/games/generate_game_voices.mjs --all');
console.log('2. Inspect quality: node tools/tts/inspect-wav.mjs assets/audio/games/*/ar/*.wav');
console.log('3. Upload: node tools/tts/games/upload_games_audio.mjs --upload');
console.log('4. Register in D1: INSERT INTO content_assets (id, kind, status, visibility, ...) for each file');
console.log('5. Link to pack: update games.content_pack voice_manifest assetIds');
