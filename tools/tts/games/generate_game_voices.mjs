// Unified games voice generation using Google AI Studio TTS directly
// No dependency on dashboard API — generates locally then ready for R2 upload
//
// Usage from repo root:
//   node tools/tts/games/generate_game_voices.mjs --dry
//   node tools/tts/games/generate_game_voices.mjs --all
//   node tools/tts/games/generate_game_voices.mjs --only count-quantity
//   node tools/tts/games/generate_game_voices.mjs --only count-quantity --voice Leda

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const GAMES_TTS_DIR = path.resolve(import.meta.dirname);

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const SAMPLE_RATE = 24000, BITS = 16, CHANNELS = 1;

function loadKey() {
  const env = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (env) return env.trim();
  const p = path.join(os.homedir(), '.majarra', 'google-ai.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('No Google AI Studio key. Set GOOGLE_AI_API_KEY or ~/.majarra/google-ai.key — https://aistudio.google.com/apikey');
}

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const OPT = {
  dry: !!arg('dry'),
  all: !!arg('all'),
  only: typeof arg('only') === 'string' ? arg('only') : undefined,
  voice: typeof arg('voice') === 'string' ? arg('voice') : undefined,
};

function wavHeader(dataBytes) {
  const blockAlign = (CHANNELS * BITS) / 8;
  const byteRate = SAMPLE_RATE * blockAlign;
  const h = Buffer.alloc(44);
  h.write('RIFF',0,'ascii'); h.writeUInt32LE(36+dataBytes,4);
  h.write('WAVE',8,'ascii'); h.write('fmt ',12,'ascii');
  h.writeUInt32LE(16,16); h.writeUInt16LE(1,20); h.writeUInt16LE(CHANNELS,22);
  h.writeUInt32LE(SAMPLE_RATE,24); h.writeUInt32LE(byteRate,28);
  h.writeUInt16LE(blockAlign,32); h.writeUInt16LE(BITS,34);
  h.write('data',36,'ascii'); h.writeUInt32LE(dataBytes,40);
  return h;
}

function buildRequestText(manifest, line) {
  if (manifest.preamble) {
    const transcript = line.audio_tag ? `${line.audio_tag} ${line.text}` : line.text;
    return `${manifest.preamble}\n\n${manifest.global_style}\n${line.style}\n\n#### TRANSCRIPT\n${transcript}`;
  }
  return `${manifest.global_style}\n\n${line.style}\n\nRead exactly this and nothing else:\n${line.text}`;
}

async function synthesize(line, manifest, key, voice) {
  const requestText = buildRequestText(manifest, line);
  const body = {
    contents: [{ parts: [{ text: requestText }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
  const res = await fetch(`${API_ROOT}/${manifest.model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0,500)}`);
  const json = JSON.parse(text);
  const cand = json.candidates?.[0];
  const inline = cand?.content?.parts?.find(p => p.inlineData)?.inlineData;
  if (!inline?.data) throw new Error(`no audio finishReason=${cand?.finishReason}`);
  return Buffer.from(inline.data, 'base64');
}

async function main() {
  const files = fs.readdirSync(GAMES_TTS_DIR).filter(f => f.endsWith('-ar.json')).map(f => path.join(GAMES_TTS_DIR,f));
  let targets = files;
  if (OPT.only) targets = files.filter(f => path.basename(f).includes(OPT.only));
  if (!OPT.all && !OPT.dry && !OPT.only) {
    console.log('Use --dry, --all, or --only <engine-name>. Example: --only count-quantity');
    return;
  }

  const key = OPT.dry ? null : loadKey();
  console.log(`model global voices: ${OPT.voice ? 'override '+OPT.voice : 'from manifests'}`);
  console.log(`found ${files.length} manifests, selected ${targets.length}`);

  if (OPT.dry) {
    for (const fp of targets) {
      const m = JSON.parse(fs.readFileSync(fp,'utf8'));
      const v = OPT.voice ?? m.voice;
      console.log(`\n${path.basename(fp)}: voice=${v} model=${m.model} lines=${m.lines.length} out=${m.out_dir}`);
      for (const l of m.lines.slice(0,2)) console.log(`  ${l.file}: "${l.text}"`);
    }
    console.log('\nDry run — no key needed, no credits spent.');
    return;
  }

  let total = 0, done = 0, failed = 0;
  for (const fp of targets) {
    const m = JSON.parse(fs.readFileSync(fp,'utf8'));
    const voice = OPT.voice ?? m.voice;
    const outDir = path.resolve(ROOT, m.out_dir);
    fs.mkdirSync(outDir, {recursive:true});
    console.log(`\n[${path.basename(fp)}] voice=${voice} -> ${m.out_dir} (${m.lines.length} lines)`);

    for (const line of m.lines) {
      total++;
      const outPath = path.join(outDir, line.file);
      if (fs.existsSync(outPath)) { console.log(`  skip exists ${line.file}`); done++; continue; }
      process.stdout.write(`  generating ${line.file} "${line.text.slice(0,40)}..." `);
      for (let attempt=1; attempt<=3; attempt++) {
        try {
          const pcm = await synthesize(line, m, key, voice);
          const wav = Buffer.concat([wavHeader(pcm.length), pcm]);
          fs.writeFileSync(outPath, wav);
          const ms = Math.round(pcm.length / ((SAMPLE_RATE*CHANNELS*BITS/8))*1000);
          console.log(` OK ${pcm.length}B ${ms}ms`);
          done++; break;
        } catch (e) {
          if (attempt===3) { console.log(` FAIL ${e.message.slice(0,80)}`); failed++; }
          else { console.log(` retry ${attempt}...`); await new Promise(r=>setTimeout(r,1500*attempt)); }
        }
      }
      await new Promise(r=>setTimeout(r,400));
    }
  }
  console.log(`\nDone: ${done}/${total} ok, ${failed} failed, ${total-done-failed} skipped.`);
  console.log('Upload via: wrangler r2 object put majarra-media --file ... --key private/audio/games/...');
  console.log('Or via dashboard POST /admin/tts/assets with assetBlob.');
}

main().catch(e=>{ console.error(e); process.exit(1); });
