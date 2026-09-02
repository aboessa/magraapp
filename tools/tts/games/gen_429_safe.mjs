import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = "F:\\Projects\\cartoonapp";
const DIR = path.join(ROOT, "tools","tts","games");
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const SR = 24000, BITS=16, CH=1;

function key() {
  const p = path.join(os.homedir(),'.majarra','google-ai.key');
  if (fs.existsSync(p)) return fs.readFileSync(p,'utf8').trim();
  return process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
}
function wavHeader(len){
  const ba=(CH*BITS)/8, br=SR*ba, h=Buffer.alloc(44);
  h.write('RIFF',0); h.writeUInt32LE(36+len,4); h.write('WAVE',8); h.write('fmt ',12);
  h.writeUInt32LE(16,16); h.writeUInt16LE(1,20); h.writeUInt16LE(CH,22);
  h.writeUInt32LE(SR,24); h.writeUInt32LE(br,28); h.writeUInt16LE(ba,32); h.writeUInt16LE(BITS,34);
  h.write('data',36); h.writeUInt32LE(len,40); return h;
}
function txt(manifest, line){
  const tr = line.audio_tag?`${line.audio_tag} ${line.text}`:line.text;
  return `${manifest.preamble}\n\n${manifest.global_style}\n${line.style}\n\n#### TRANSCRIPT\n${tr}`;
}
async function synth(line, manifest, k, voice){
  const body={contents:[{parts:[{text:txt(manifest,line)}]}], generationConfig:{responseModalities:['AUDIO'], speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}}};
  const res = await fetch(`${API}/${manifest.model}:generateContent`, {method:'POST', headers:{'x-goog-api-key':k,'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const t = await res.text();
  if(!res.ok){ const e=new Error(`${res.status} ${t.slice(0,400)}`); e.status=res.status; throw e; }
  const j=JSON.parse(t); const c=j.candidates?.[0]; const inline=c?.content?.parts?.find(p=>p.inlineData)?.inlineData;
  if(!inline?.data) throw new Error(`no audio FR=${c?.finishReason}`);
  return Buffer.from(inline.data,'base64');
}

const sleep = ms=>new Promise(r=>setTimeout(r,ms));

async function main(){
  const k=key(); console.log('key len',k.length);
  const files = ['trace-color-ar.json','word-build-ar.json','sequence-order-ar.json','sort-bins-ar.json','timeline-map-ar.json','sim-lab-ar.json','logic-pattern-ar.json','block-code-ar.json'];
  let totalOk=0, skip=0, fail=0;
  for(const fname of files){
    const fp=path.join(DIR,fname);
    if(!fs.existsSync(fp)) continue;
    const m=JSON.parse(fs.readFileSync(fp,'utf8'));
    const voice = fname==='word-build-ar.json'?'Leda': fname.includes('timeline')||fname.includes('sim')||fname.includes('logic')||fname.includes('block')?'Aoede':'Kore';
    const outDir=path.join(ROOT,m.out_dir); fs.mkdirSync(outDir,{recursive:true});
    console.log(`\n== ${fname} voice=${voice} lines=${m.lines.length} ==`);
    for(const line of m.lines){
      const out=path.join(outDir,line.file);
      if(fs.existsSync(out)){ console.log(` SKIP ${line.file}`); skip++; continue; }
      for(let a=1;a<=5;a++){
        try{
          process.stdout.write(`  GEN ${line.file} `);
          const pcm = await synth(line,m,k,voice);
          const wav=Buffer.concat([wavHeader(pcm.length),pcm]);
          fs.writeFileSync(out,wav);
          console.log(`OK ${pcm.length}B`);
          totalOk++; break;
        }catch(e){
          console.log(`FAIL ${e.status||''} ${e.message.slice(0,60)} attempt ${a}`);
          if(e.status===429){ console.log('  429 -> waiting 62s...'); await sleep(62000); a--; continue; }
          if(a===5){ fail++; }
          else await sleep(2000*a);
        }
      }
      await sleep(1200);
    }
  }
  console.log(`\nDONE new=${totalOk} skip=${skip} fail=${fail}`);
  // count total
  let n=0; function count(d){ try{ for(const ent of fs.readdirSync(d,{withFileTypes:true})){ if(ent.isDirectory()) n+=count(path.join(d,ent.name)); else if(ent.name.endsWith('.wav')) n++; } }catch{} return n; }
  // actually recount properly
  n=0; const audioRoot=path.join(ROOT,'assets','audio','games');
  function cnt(dir){ let c=0; try{ for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,e.name); if(e.isDirectory()) c+=cnt(p); else if(e.name.endsWith('.wav')) c++; } }catch{} return c; }
  console.log(`Total WAVs: ${cnt(audioRoot)}/150`);
}
main().catch(e=>{console.error(e);process.exit(1);});
