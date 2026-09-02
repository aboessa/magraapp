import fs from 'node:fs';
import path from 'node:path';

const ROOT = "F:\\Projects\\cartoonapp";
const API_BASE = "http://127.0.0.1:8787"; // wrangler dev local — or https://api.majarra.app for remote

const GAMES_DIR = path.join(ROOT, 'tools','tts','games');

function wavHeader(dataBytes, sampleRate=24000, channels=1, bits=16) {
  const blockAlign=(channels*bits)/8; const byteRate=sampleRate*blockAlign;
  const h=Buffer.alloc(44);
  h.write('RIFF',0,'ascii'); h.writeUInt32LE(36+dataBytes,4);
  h.write('WAVE',8,'ascii'); h.write('fmt ',12,'ascii');
  h.writeUInt32LE(16,16); h.writeUInt16LE(1,20); h.writeUInt16LE(channels,22);
  h.writeUInt32LE(sampleRate,24); h.writeUInt32LE(byteRate,28);
  h.writeUInt16LE(blockAlign,32); h.writeUInt16LE(bits,34);
  h.write('data',36,'ascii'); h.writeUInt32LE(dataBytes,40);
  return h;
}

async function main() {
  const manifests = fs.readdirSync(GAMES_DIR).filter(f=>f.endsWith('-ar.json'));
  console.log(`Found ${manifests.length} manifests`);

  // Try local API first to see if it serves TTS config
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/tts/config`);
    console.log(`API /tts/config status ${res.status}`);
    console.log((await res.text()).slice(0,500));
  } catch (e) {
    console.log(`API not reachable ${API_BASE}: ${e.message}`);
    console.log('Run: cd dashboard/api && npx wrangler dev --local --port 8787');
    console.log('Or use remote: https://api.majarra.app/api/v1/admin/tts/config (needs auth)');
  }

  // List missing
  for (const mf of manifests) {
    const data = JSON.parse(fs.readFileSync(path.join(GAMES_DIR, mf),'utf8'));
    const outDir = path.join(ROOT, data.out_dir);
    let exist=0; try{exist=fs.readdirSync(outDir).filter(x=>x.endsWith('.wav')).length;}catch{}
    if (exist < data.lines.length) {
      console.log(`  MISSING ${mf}: ${exist}/${data.lines.length} missing ${data.lines.length-exist}`);
    }
  }
}

main();
