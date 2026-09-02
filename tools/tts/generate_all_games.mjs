// Generate all games voice-over via Google AI Studio
// Usage:
//   node tools/tts/generate_all_games.mjs --dry
//   node tools/tts/generate_all_games.mjs --all
//   node tools/tts/generate_all_games.mjs --engine count_quantity

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const GAMES_DIR = path.join(__dirname, 'games');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const OPT = {
  dry: !!arg('dry'),
  all: !!arg('all'),
  engine: typeof arg('engine') === 'string' ? arg('engine') : undefined,
};

const manifests = fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.json')).map(f => path.join(GAMES_DIR, f));

console.log(`Found ${manifests.length} game TTS manifests`);
console.log(`Options: dry=${OPT.dry} all=${OPT.all} engine=${OPT.engine ?? 'all'}`);

let filtered = manifests;
if (OPT.engine) {
  filtered = manifests.filter(p => path.basename(p).includes(OPT.engine));
}

for (const m of filtered) {
  const data = JSON.parse(fs.readFileSync(m, 'utf8'));
  console.log(`\n--- ${path.basename(m)}: ${data.lines.length} lines, voice=${data.voice}, model=${data.model}`);
  if (OPT.dry) {
    for (const line of data.lines.slice(0, 3)) {
      console.log(`  ${line.id}: "${line.text.slice(0, 60)}"`);
    }
    if (data.lines.length > 3) console.log(`  ... and ${data.lines.length - 3} more`);
  }
}

if (OPT.dry) {
  console.log('\nDry run — no API calls. Pass --all to generate real audio via narrate.mjs logic.');
  process.exit(0);
}

if (!OPT.all && !OPT.engine) {
  console.log('\nNothing to do. Use --dry or --all or --engine <name>');
  process.exit(0);
}

// Delegate to narrate.mjs pattern but for each game manifest
console.log('\nTo generate real audio, run for each manifest:');
for (const m of filtered) {
  console.log(`  node tools/tts/narrate.mjs --all --manifest ${path.relative(ROOT, m)}`);
}

console.log('\nOr via admin dashboard: upload pre-generated WAVs via POST /admin/tts/assets');
console.log('Each WAV becomes private/audio/games/<engine>/ar/<file>.wav with status ready.');
