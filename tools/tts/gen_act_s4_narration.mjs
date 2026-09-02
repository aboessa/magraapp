#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const md = fs.readFileSync('docs/content/planets/05-qisas/a-calm-tale/story-04-warm-hugs.md','utf8');

function parsePages(mdText){
  const lines = mdText.split('\n');
  let inTable=false;
  const pages=[];
  for(const line of lines){
    if(line.includes('| #') && line.includes('| النص |')){ inTable=true; continue; }
    if(!inTable) continue;
    if(!line.trim().startsWith('|')){ if(pages.length>0) break; continue; }
    if(line.includes('---')) continue;
    const parts=line.split('|').map(s=>s.trim()).filter(Boolean);
    if(parts.length<5) continue;
    const num=parseInt(parts[0]);
    if(isNaN(num)) continue;
    const text=parts[4];
    if(!text) continue;
    pages.push({num, text});
  }
  // fallback code block
  if(pages.length===0){
    const m=mdText.match(/## نص السرد للتسجيل\s+```([\s\S]*?)```/);
    if(m){
      const block=m[1];
      const regex=/\s*(\d+)\.\s+([^\n]+)/g;
      let match;
      while((match=regex.exec(block))!==null){
        const n=parseInt(match[1]);
        const t=match[2].trim();
        if(n&&t) pages.push({num:n, text:t});
      }
    }
  }
  pages.sort((a,b)=>a.num-b.num);
  return pages;
}

const pages=parsePages(md);
console.log(`Parsed ${pages.length} pages for act-s4:`, pages.map(p=>`${p.num}:${p.text.slice(0,30)}`));

const preamble = "Synthesize speech. Read aloud only the text under TRANSCRIPT. Everything above it is direction for how to perform, and must never be spoken.";
const global_style = `# AUDIO PROFILE: Salma – a-calm-tale warm-hugs
## "The Kind Older Sister" for act-s4
Salma is a young Arab woman in her early twenties with a light, bright, feminine voice. She reads to a 3-5 year old child in bedtime track. Warm, calm, unhurried, gentle.
## THE SCENE
Bedroom late evening, one warm lamp on, child under blanket feels cold then warm. Grandmother present every page.
### DIRECTOR'S NOTES
Style: Bright, soft, affectionate, gentle vocal smile. Youthful timbre, never breathy, never babyish. Warm reassuring.
Pacing: Slow ~53 words/min (~3.51 letters/sec) for pages 1-7, page 8 slowest ~2.92 letters/sec with softest ending.
Accent: Clear Modern Standard Arabic.
Loudness: Constant, no escalation, no drama even on page 4 tiny climax (blanket missing is ordinary not frightening).
`;

const manifest={
 story: "act-s4",
 story_file: "docs/content/planets/05-qisas/a-calm-tale/story-04-warm-hugs.md",
 language: "ar",
 out_dir: "assets/audio/stories/act-s4/ar",
 model: "gemini-2.5-flash-preview-tts",
 voice: "Leda",
 voice_locked_because: "Leda youthful feminine voice for preschool bedtime, same as act-s1..act-s3 locked.",
 voice_alternatives: ["Vindemiatrix","Sulafat","Aoede"],
 language_code: "ar-EG",
 preamble,
 global_style,
 lines: pages.map(p=>{
   const idNum=String(p.num).padStart(3,'0');
   return {
     page: p.num,
     id: `asset-act-s4-vo-ar-${idNum}`,
     file: `page-${idNum}-ar.wav`,
     text: p.text,
     style: p.num===8 ? "Slowest page, sleepy soft ending, 'تصبح على خير' slowest phrase." : p.num===4 ? "Tiny practical climax, no worry, ordinary tone, no fear, 'لم تجد' without problem tone." : "Calm bedtime, soft, warm, unhurried.",
     planned_duration_ms: Math.round((p.text.length/8.5)*1000)
   };
 })
};

fs.writeFileSync('tools/tts/act-s4.narration.json', JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(`Wrote tools/tts/act-s4.narration.json with ${manifest.lines.length} lines`);
