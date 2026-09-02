import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = "F:\\Projects\\cartoonapp";
const GAMES_DIR = path.join(ROOT, "tools","tts","games");
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
const SAMPLE_RATE=24000, BITS=16, CHANNELS=1;

function loadKey() {
  const env = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (env) return env.trim();
  const p = path.join(os.homedir(), '.majarra','google-ai.key');
  if (fs.existsSync(p)) return fs.readFileSync(p,'utf8').trim();
  throw new Error('No key');
}
function wavHeader(dataBytes) {
  const blockAlign=(CHANNELS*BITS)/8; const byteRate=SAMPLE_RATE*blockAlign;
  const h=Buffer.alloc(44);
  h.write('RIFF',0,'ascii'); h.writeUInt32LE(36+dataBytes,4);
  h.write('WAVE',8,'ascii'); h.write('fmt ',12,'ascii');
  h.writeUInt32LE(16,16); h.writeUInt16LE(1,20); h.writeUInt16LE(CHANNELS,22);
  h.writeUInt32LE(SAMPLE_RATE,24); h.writeUInt32LE(byteRate,28);
  h.writeUInt16LE(blockAlign,32); h.writeUInt16LE(BITS,34);
  h.write('data',36,'ascii'); h.writeUInt32LE(dataBytes,40);
  return h;
}
function buildText(m, line) {
  if (m.preamble) {
    const tr = line.audio_tag ? `${line.audio_tag} ${line.text}` : line.text;
    return `${m.preamble}\n\n${m.global_style}\n${line.style}\n\n#### TRANSCRIPT\n${tr}`;
  }
  return `${m.global_style}\n\n${line.style}\n\nRead exactly this and nothing else:\n${line.text}`;
}
async function synthesize(line, manifest, key, voice) {
  const body={ contents:[{parts:[{text:buildText(manifest,line)}]}], generationConfig:{ responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName:voice } } } } };
  const res=await fetch(`${API_ROOT}/${manifest.model}:generateContent`, { method:'POST', headers:{'x-goog-api-key':key,'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const t=await res.text();
  if (!res.ok) throw new Error(`${res.status} ${t.slice(0,600)}`);
  const j=JSON.parse(t); const cand=j.candidates?.[0]; const inline=cand?.content?.parts?.find(p=>p.inlineData)?.inlineData;
  if (!inline?.data) throw new Error(`no audio finishReason=${cand?.finishReason}`);
  return Buffer.from(inline.data,'base64');
}

async function main() {
  const key=loadKey();
  const files=fs.readdirSync(GAMES_DIR).filter(f=>f.endsWith('-ar.json')).map(f=>path.join(GAMES_DIR,f));
  let totalMissing=0, done=0, failed=0;

  // gather all missing lines across all manifests
  const allMissing = [];
  for (const fp of files) {
    const m=JSON.parse(fs.readFileSync(fp,'utf8'));
    const voice = m.voice;
    const outDir=path.join(ROOT, m.out_dir);
    fs.mkdirSync(outDir,{recursive:true});
    for (const line of m.lines) {
      const outPath=path.join(outDir, line.file);
      if (fs.existsSync(outPath)) continue;
      allMissing.push({ fp, manifest:m, voice, line, outPath });
    }
  }
  totalMissing = allMissing.length;
  console.log(`Total missing: ${totalMissing} wavs to generate`);
  if (!totalMissing) { console.log('All done!'); return; }

  for (let i=0;i<allMissing.length;i++) {
    const { manifest, voice, line, outPath } = allMissing[i];
    const base = path.basename(outPath);
    process.stdout.write(`[${i+1}/${totalMissing}] ${voice} ${base} "${line.text.slice(0,35)}..." `);
    // smart backoff: 2.5s between calls + exponential on 429
    let lastErr=null;
    for (let attempt=1; attempt<=5; attempt++) {
      try {
        const pcm=await synthesize(line, manifest, key, voice);
        const wav=Buffer.concat([wavHeader(pcm.length), pcm]);
        fs.writeFileSync(outPath, wav);
        const ms=Math.round(pcm.length/((SAMPLE_RATE*CHANNELS*BITS/8))*1000);
        console.log(`OK ${pcm.length}B ${ms}ms`);
        done++; break;
      } catch (e) {
        lastErr=e;
        const msg=e.message;
        const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
        if (is429) {
          const wait = Math.min(15000, 3000 * attempt);
          console.log(` 429 quota attempt ${attempt}/5 wait ${wait}ms`);
          await new Promise(r=>setTimeout(r, wait));
          if (attempt===5) { console.log(` FAIL ${msg.slice(0,120)}`); failed++; }
        } else {
          if (attempt===3) { console.log(` FAIL ${msg.slice(0,120)}`); failed++; break; }
          console.log(` retry ${attempt}: ${msg.slice(0,80)}`);
          await new Promise(r=>setTimeout(r, 1500*attempt));
        }
      }
    }
    // polite delay to avoid spamming quota
    await new Promise(r=>setTimeout(r, 2500));
  }

  console.log(`\nDone: ${done}/${totalMissing} ok, ${failed} failed`);
  const finalCount = fs.readdirSync(path.join(ROOT,'assets','audio','games'),{recursive:true});
  // recalc
  let n=0; try{ n=fs.readdirSync(path.join(ROOT,'assets','audio','games'),{recursive:true}).filter(f=>String(f).endsWith('.wav')).length; }catch{ n=done; }
  console.log(`Total wav files now ~ ${n} (may need second fs walk)`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
