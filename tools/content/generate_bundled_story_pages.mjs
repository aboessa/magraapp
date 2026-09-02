#!/usr/bin/env node
// Generate bundled JSON envelopes for reader pages directly from markdown manifests
// so that stories work offline even if API doesn't have them yet.
// This fixes "القصة غير موجودة" for all stories except bird-home.

import fs from 'fs';
import path from 'path';

const ROOT = 'F:/Projects/cartoonapp';
const storiesRoot = path.join(ROOT, 'docs/content/planets/05-qisas');

// Mapping of story IDs to their asset pack name in Flutter
const storyMap = [
  // a-calm-tale
  { id: 'story-bird-home', title: 'بيت الطائر', title_en: 'Bird Home', slug: 'story-01-bird-home', dir: 'a-calm-tale', pack: 'act-s1-playveo', pages: 8 },
  { id: 'story-goodnight-toys', title: 'تصبح على خير يا ألعاب', title_en: 'Goodnight Toys', slug: 'story-02-goodnight-toys', dir: 'a-calm-tale', pack: 'act-s2-playveo', pages: 8 },
  { id: 'story-moon-sleeps', title: 'القمر ينام', title_en: 'Moon Sleeps', slug: 'story-03-moon-sleeps', dir: 'a-calm-tale', pack: 'act-s3-playveo', pages: 8 },
  { id: 'story-warm-hugs', title: 'أحضان الدفء', title_en: 'Warm Hugs', slug: 'story-04-warm-hugs', dir: 'a-calm-tale', pack: 'act-s4-playveo', pages: 8 },
  // bedtime-stories
  { id: 'story-ant-journey', title: 'رحلة النملة', title_en: 'Ant Journey', slug: 'story-01-ant-journey', dir: 'bedtime-stories', pack: 'bs-s1-playveo', pages: 12 },
  { id: 'story-garden-secret', title: 'سر الحدائق', title_en: 'Garden Secret', slug: 'story-02-garden-secret', dir: 'bedtime-stories', pack: 'bs-s2-playveo', pages: 12 },
  { id: 'story-new-friend', title: 'صديق جديد', title_en: 'New Friend', slug: 'story-03-new-friend', dir: 'bedtime-stories', pack: 'bs-s3-playveo', pages: 12 },
  { id: 'story-rainy-night', title: 'ليلة المطر', title_en: 'Rainy Night', slug: 'story-04-rainy-night', dir: 'bedtime-stories', pack: 'bs-s4-playveo', pages: 12 },
  { id: 'story-old-lantern', title: 'الفانوس القديم', title_en: 'Old Lantern', slug: 'story-05-old-lantern', dir: 'bedtime-stories', pack: 'bs-s5-playveo', pages: 12 },
  { id: 'story-lost-star', title: 'نجمة تائهة', title_en: 'Lost Star', slug: 'story-06-lost-star', dir: 'bedtime-stories', pack: 'bs-s6-playveo', pages: 12 },
  // qisas-min-alhayat junior
  { id: 'story-promised-friday', title: 'الجمعة الموعودة', title_en: 'Promised Friday', dir: 'qisas-min-alhayat', manifest: '_manifest-qisas-min-alhayat.json', slug: 'the-promised-friday', pack: 'qml-the-promised-friday-playveo', pages: 18 },
  { id: 'story-nine-metres', title: 'تسعة أمتار', title_en: 'Nine Metres', dir: 'qisas-min-alhayat', manifest: '_manifest-qisas-min-alhayat.json', slug: 'nine-metres', pack: 'qml-nine-metres-playveo', pages: 18 },
  { id: 'story-taller-than-me', title: 'أطول منّي', title_en: 'Taller Than Me', dir: 'qisas-min-alhayat', manifest: '_manifest-qisas-min-alhayat.json', slug: 'taller-than-me', pack: 'qml-taller-than-me-playveo', pages: 20 },
  { id: 'story-key-left', title: 'المفتاح الذي بقي', title_en: 'Key Left', dir: 'qisas-min-alhayat', manifest: '_manifest-qisas-min-alhayat.json', slug: 'the-key-that-was-left', pack: 'qml-the-key-that-was-left-playveo', pages: 16 },
  { id: 'story-extra-page', title: 'الورقة الزائدة', title_en: 'Extra Page', dir: 'qisas-min-alhayat', manifest: '_manifest-qisas-min-alhayat.json', slug: 'the-extra-page', pack: 'qml-the-extra-page-playveo', pages: 18 },
];

function parsePagesFromMarkdown(mdPath){
  if(!fs.existsSync(mdPath)) return [];
  const text = fs.readFileSync(mdPath,'utf8');
  const pages=[];
  // Try to parse | # | الوظيفة | brightness | motion | النص |
  const lines=text.split('\n');
  let inTable=false;
  for(const line of lines){
    if(line.includes('| #') && line.includes('النص')){ inTable=true; continue; }
    if(!inTable) continue;
    if(!line.trim().startsWith('|')){ if(pages.length>0) break; continue; }
    if(line.includes('---')) continue;
    const parts=line.split('|').map(s=>s.trim()).filter(Boolean);
    if(parts.length<5) continue;
    const num=parseInt(parts[0]);
    if(isNaN(num)) continue;
    const brightness=parseFloat(parts[2])||1.0;
    const motion=parts[3];
    let narration=parts[4].replace(/·/g,' ').trim();
    // Remove markdown bold etc
    narration = narration.replace(/\*\*/g,'').trim();
    // Keep only first 2 sentences? Keep all
    pages.push({ num, brightness, motion, text: narration });
  }
  // Fallback: extract from "نص السرد للتسجيل" code block
  if(pages.length===0){
    const m=text.match(/## نص السرد للتسجيل[\s\S]*?```([\s\S]*?)```/);
    if(m){
      const block=m[1];
      const regex=/ص(\d+)\.\s+([^\n]+)\n\s*([^\n]*)/g;
      let match;
      while((match=regex.exec(block))!==null){
        const num=parseInt(match[1]);
        const line1=match[2].trim();
        const line2=match[3].trim();
        const combined = line2 ? `${line1} ${line2}` : line1;
        if(num) pages.push({ num, text: combined, brightness: 1 - (num-1)*0.025, motion: num>=11?'static':'kenburns_slow' });
      }
    }
  }
  pages.sort((a,b)=>a.num-b.num);
  return pages;
}

function parsePagesFromQisasManifest(manifestPath, slug){
  if(!fs.existsSync(manifestPath)) return [];
  const j=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const story = j.stories.find(s=> s.slug===slug);
  if(!story) return [];
  return (story.pages||[]).map(p=>({
    num: p.page_number,
    brightness: p.brightness||1.0,
    motion: p.motion||'kenburns_slow',
    text: p.text_ar || '',
    layout: p.layout||'full_bleed'
  }));
}

function buildBundledEnvelope(storyDef, pages){
  // Build envelope similar to API: { data: [ pages ], meta: { language, default_language, languages } }
  const imageBase = `https://cdn.majarra.app/public/catalog/assets/images/stories/${storyDef.pack}`;
  const data = pages.map((p, idx)=>{
    const pageNum = p.num || idx+1;
    const file = `page-${String(pageNum).padStart(3,'0')}.jpg`;
    const audioFile = `page-${String(pageNum).padStart(3,'0')}-ar.wav`;
    // Check if bundled asset exists? Use cdn URL; bundled resolver will map to local asset
    const imageUrl = `${imageBase}/${file}`;
    // For audio, we use local asset path for now? API returns audio_url – use bundled audio path? Actually reader uses audioUrl from page DTO – we can point to local? For simplicity, use cdn audio URL if available, otherwise null
    // Check if we have audio file in assets/audio/stories/<story-id>/ar – we actually have qml-* etc – but story ids mapped to folders
    // Map story id to folder: story-bird-home -> act-s1, story-goodnight-toys -> act-s2, etc.
    // We'll leave audio_url null for now – narration will be loaded via separate logic? Reader auto-turn uses duration_ms + dwell_ms
    return {
      id: `page-${storyDef.id}-${String(pageNum).padStart(3,'0')}`,
      page_number: pageNum,
      layout: p.layout||'full_bleed',
      transition: 'fade',
      body_text: p.text||'',
      alt_text: null,
      image_url: imageUrl,
      image_width: 1920,
      image_height: 1080,
      audio_url: null, // will be resolved via local audio assets if needed
      duration_ms: p.duration_ms || 8000,
      dwell_ms: 1000,
      translation_available: false,
      audio_available: true,
      audio_access: 'public',
      timing_cues: [],
      bubbles: [],
      tracks: []
    };
  });

  const envelope = {
    data,
    meta: {
      language: 'ar',
      default_language: 'ar',
      languages: [
        { code: 'ar', declared: true, translated_pages: data.length, narrated_pages: data.length, total_pages: data.length, translation_available: true, translation_complete: true }
      ],
      translation_available: true,
      translation_complete: true
    }
  };
  return envelope;
}

function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }

const outBase = path.join(ROOT, 'app_main/assets/data/bundled_stories');
ensureDir(outBase);

let generated=0;
for(const story of storyMap){
  let pages=[];
  if(story.dir==='qisas-min-alhayat'){
    const manifestPath = path.join(ROOT, 'docs/content/planets/05-qisas', story.manifest);
    pages = parsePagesFromQisasManifest(manifestPath, story.slug);
  }else{
    // a-calm-tale or bedtime-stories
    const mdFile = path.join(ROOT, `docs/content/planets/05-qisas/${story.dir}/${story.slug}.md`);
    pages = parsePagesFromMarkdown(mdFile);
    // fallback: if not found, generate generic pages from count
    if(pages.length===0){
      console.warn(`No pages parsed for ${story.id} from ${mdFile} – generating placeholder ${story.pages} pages`);
      for(let i=1;i<=story.pages;i++){
        pages.push({ num: i, text: `${story.title} – صفحة ${i}`, brightness: 1 - (i-1)*0.02, motion: i>=story.pages-1?'static':'kenburns_slow' });
      }
    }
  }
  if(pages.length===0){
    console.warn(`Skipping ${story.id}: no pages`);
    continue;
  }
  const envelope = buildBundledEnvelope(story, pages);
  const outPath = path.join(outBase, `${story.id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(envelope,null,2),'utf8');
  console.log(`Generated ${outPath} with ${pages.length} pages for ${story.title}`);
  generated++;
}

console.log(`\nDone: ${generated} bundled story envelopes generated in ${outBase}`);
