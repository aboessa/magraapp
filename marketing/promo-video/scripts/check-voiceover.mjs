// QA: transcribes each generated clip with Gemini and prints it next to the
// intended script line, so mispronounced or skipped words are caught before render.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const envFile = join(root, '..', '..', '.env.local');
const key = process.env.GEMINI_API_KEY ??
  readFileSync(envFile, 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/m)?.[1];
const flag = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const model = flag('model') ?? 'gemini-3.8-flash';
const script = JSON.parse(readFileSync(resolve(root, flag('script') ?? 'src/script.json'), 'utf8'));

for (const scene of script.scenes) {
  const file = join(root, 'public', script.voDir ?? 'vo', `${scene.id}.wav`);
  if (!existsSync(file)) { console.log(`${scene.id}: missing`); continue; }
  const body = {
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: 'audio/wav', data: readFileSync(file).toString('base64') } },
      { text: 'Transcribe this Arabic audio exactly, with diacritics where audible. Then on a new line starting with "NOTES:" list any mispronounced, unclear or unnatural words (or "none"). Finally, on a line starting with "DIALECT:", name the Arabic dialect/accent you hear (e.g. Egyptian colloquial, Gulf, MSA) and how natural it sounds.' },
    ] }],
  };
  let res;
  for (let i = 0; i < 4; i++) {
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
      });
    } catch (e) { // transient network reset: retry
      if (i === 3) throw e;
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (res.status !== 429 && res.status !== 503) break;
    await new Promise((r) => setTimeout(r, 15000));
  }
  const json = await res.json();
  const out = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? JSON.stringify(json).slice(0, 300);
  console.log(`\n[${scene.id}]\n  script: ${scene.vo}\n  heard : ${out.trim().replace(/\n/g, '\n          ')}`);
}
