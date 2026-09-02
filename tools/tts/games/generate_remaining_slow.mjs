import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = "F:\\Projects\\cartoonapp";
const GAMES_TTS_DIR = path.join(ROOT, "tools", "tts", "games");
const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const SAMPLE_RATE = 24000, BITS = 16, CHANNELS = 1;

function loadKey() {
  const p = path.join(os.homedir(), '.majarra', 'google-ai.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  const env = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (env) return env.trim();
  throw new Error('No Google AI key');
}

function wavHeader(dataBytes) {
  const blockAlign = (CHANNELS * BITS) / 8;
  const byteRate = SAMPLE_RATE * blockAlign;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + dataBytes, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(CHANNELS, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(BITS, 34);
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(dataBytes, 40);
  return h;
}

function buildRequestText(manifest, line) {
  const transcript = line.audio_tag ? `${line.audio_tag} ${line.text}` : line.text;
  return `${manifest.preamble}\n\n${manifest.global_style}\n${line.style}\n\n#### TRANSCRIPT\n${transcript}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
  if (!res.ok) {
    if (res.status === 429) {
      const err = new Error(`429 quota exceeded`);
      err.is429 = true;
      err.detail = text.slice(0, 300);
      throw err;
    }
    throw new Error(`${res.status} ${text.slice(0,500)}`);
  }
  const json = JSON.parse(text);
  const cand = json.candidates?.[0];
  const inline = cand?.content?.parts?.find(p => p.inlineData)?.inlineData;
  if (!inline?.data) throw new Error(`no audio finishReason=${cand?.finishReason}`);
  return Buffer.from(inline.data, 'base64');
}

async function main() {
  const key = loadKey();
  console.log('Google AI key loaded len', key.length);

  // Order: smallest missing first to unblock first game
  const order = [
    'trace-color-ar.json',
    'word-build-ar.json',
    'sequence-order-ar.json',
    'sort-bins-ar.json',
    'timeline-map-ar.json',
    'sim-lab-ar.json',
    'logic-pattern-ar.json',
    'block-code-ar.json'
  ];

  let totalDone = 0, totalFail = 0, totalSkip = 0;

  for (const fname of order) {
    const fp = path.join(GAMES_TTS_DIR, fname);
    if (!fs.existsSync(fp)) { console.log(`skip missing manifest ${fname}`); continue; }
    const manifest = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const voice = fname === 'word-build-ar.json' ? 'Leda' : 
                  fname.includes('timeline') || fname.includes('sim') || fname.includes('logic') || fname.includes('block') ? 'Aoede' : 'Kore';
    const outDir = path.join(ROOT, manifest.out_dir);
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`\n=== ${fname} voice=${voice} total lines=${manifest.lines.length} ===`);

    for (const line of manifest.lines) {
      const outPath = path.join(outDir, line.file);
      if (fs.existsSync(outPath)) {
        console.log(`  SKIP exists ${line.file}`);
        totalSkip++;
        continue;
      }

      let done = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          process.stdout.write(`  GEN ${line.file} "${line.text.slice(0,30)}..." attempt ${attempt} `);
          const pcm = await synthesize(line, manifest, key, voice);
          const wav = Buffer.concat([wavHeader(pcm.length), pcm]);
          fs.writeFileSync(outPath, wav);
          const ms = Math.round(pcm.length / ((SAMPLE_RATE * CHANNELS * BITS / 8)) * 1000);
          console.log(`-> OK ${pcm.length}B ${ms}ms`);
          totalDone++;
          done = true;
          break;
        } catch (e) {
          if (e.is429) {
            console.log(`-> 429 quota, waiting 65s...`);
            await sleep(65000);
            // retry same attempt without counting
            attempt--;
            continue;
          } else {
            console.log(`-> FAIL ${e.message.slice(0,80)}`);
            if (attempt < 5) {
              console.log(`     retry in ${attempt*2}s`);
              await sleep(attempt * 2000);
            } else {
              totalFail++;
            }
          }
        }
      }
      if (!done) {
        console.log(`  FINAL FAIL ${line.file}`);
      }
      // pacing 1.5s between requests
      await sleep(1500);
    }
  }

  console.log(`\n=== FINAL SUMMARY === Done new=${totalDone} Skip=${totalSkip} Fail=${totalFail}`);
  // Count total wavs
  const audioRoot = path.join(ROOT, 'assets', 'audio', 'games');
  let totalWavs = 0;
  function countDir(dir) {
    let n=0;
    try {
      for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
        if (ent.isDirectory()) n+=countDir(path.join(dir, ent.name));
        else if (ent.name.endsWith('.wav')) n++;
      }
    } catch {}
    return n;
  }
  totalWavs = countDir(audioRoot);
  console.log(`Total WAVs in assets/audio/games: ${totalWavs}/150`);
}

main().catch(e => { console.error(e); process.exit(1); });
