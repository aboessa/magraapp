#!/usr/bin/env node
// Generate narration manifests for bedtime stories bs-s1..bs-s6 from MD files
// Format matches act-s1.narration.json / act-s1.narration.locked.json pattern

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const stories = [
  { id: 'bs-s1', file: 'docs/content/planets/05-qisas/bedtime-stories/story-01-ant-journey.md', title: 'رحلة النملة' },
  { id: 'bs-s2', file: 'docs/content/planets/05-qisas/bedtime-stories/story-02-garden-secret.md', title: 'سر الحدائق' },
  { id: 'bs-s3', file: 'docs/content/planets/05-qisas/bedtime-stories/story-03-new-friend.md', title: 'صديق جديد' },
  { id: 'bs-s4', file: 'docs/content/planets/05-qisas/bedtime-stories/story-04-rainy-night.md', title: 'ليلة المطر' },
  { id: 'bs-s5', file: 'docs/content/planets/05-qisas/bedtime-stories/story-05-old-lantern.md', title: 'الفانوس القديم' },
  { id: 'bs-s6', file: 'docs/content/planets/05-qisas/bedtime-stories/story-06-lost-star.md', title: 'نجمة تائهة' },
];

function parsePagesFromMD(mdText) {
  // Look for ## الصفحات table
  // Extract | # | ... | النص |
  // Approach: find table rows with format | 1 | ... | نص...
  const lines = mdText.split('\n');
  let inTable = false;
  const pages = [];
  for (const line of lines) {
    if (line.includes('| #') && line.includes('النص')) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.trim().startsWith('|')) { if (pages.length>0) break; else continue; }
    if (line.includes('---')) continue;
    // Row: | 1 | وظيفة | brightness | motion | النص |
    const parts = line.split('|').map(s=>s.trim()).filter(Boolean);
    if (parts.length < 5) continue;
    const num = parseInt(parts[0]);
    if (isNaN(num)) continue;
    const brightness = parts[2];
    const motion = parts[3];
    const narrationText = parts[4];
    // narrationText may include · separator for two sentences
    // Keep as is for TTS, but we need verbatim Arabic
    pages.push({ num, brightness: parseFloat(brightness)||1.0, motion, text: narrationText });
  }
  // Fallback: extract from ## نص السرد للتسجيل code block
  if (pages.length === 0) {
    const m = mdText.match(/## نص السرد للتسجيل[\s\S]*?```([\s\S]*?)```/);
    if (m) {
      const block = m[1];
      const pageBlocks = block.split(/ص\d+\./);
      // ... but easier parse ص1. ... ص2.
      const regex = /ص(\d+)\.\s+([^\n]+)\n\s*([^\n]*)/g;
      let match;
      while ((match = regex.exec(block)) !== null) {
        const num = parseInt(match[1]);
        const line1 = match[2].trim();
        const line2 = match[3].trim();
        const combined = line2 ? line1 + ' ' + line2 : line1;
        if (num) pages.push({ num, text: combined, brightness: 1 - (num-1)*0.025, motion: num>=11?'static':'kenburns_slow' });
      }
    }
  }
  // Ensure sorted and continuous 1..12
  pages.sort((a,b)=>a.num-b.num);
  return pages;
}

function parsePronunciationNotes(mdText) {
  // Extract ### ملاحظات النطق table for hints
  const notes = {};
  const m = mdText.match(/### ملاحظات النطق([\s\S]*?)(?:\n## |\n> |\n---|\n$)/);
  if (!m) return notes;
  const block = m[1];
  for (const line of block.split('\n')) {
    if (!line.includes('|')) continue;
    if (line.includes('---') || line.includes('الصفحة')) continue;
    const parts = line.split('|').map(s=>s.trim()).filter(Boolean);
    if (parts.length>=2) {
      const pageKey = parts[0];
      const note = parts[1];
      notes[pageKey] = note;
    }
  }
  return notes;
}

function buildManifest(storyId, mdPath, pages, pronNotes) {
  const voice = 'Leda'; // same as locked act-s1, youthful
  const model = 'gemini-2.5-flash-preview-tts'; // current available, fallback gemini-3.1-flash-tts-preview not yet public? use flash preview

  // We'll use model from existing act-s1 locked: gemini-3.1-flash-tts-preview but fallback
  const outDir = `assets/audio/stories/${storyId}/ar`;

  // global style from act-s1 locked pattern – adapt per story title
  const preamble = "Synthesize speech. Read aloud only the text under TRANSCRIPT. Everything above it is direction for how to perform, and must never be spoken.";

  const global_style = `# AUDIO PROFILE: Salma – bedtime
## "The Kind Older Sister" for ${storyId}
Salma is a young Arab woman in her early twenties with a light, bright, distinctly feminine voice. She is reading a bedtime story (${storyId}) for children 6-8. Warm, calm, unhurried, affectionate.
## THE SCENE
Child's bedroom late evening, one warm lamp on. Child sleepy under blanket. Salma sits on floor beside bed.
### DIRECTOR'S NOTES
Style: Bright, soft, affectionate, gentle vocal smile. Youthful timbre, never breathy, never babyish, never cartoon. Warm and reassuring.
Pacing: Slow ~90 words/min, small natural pause at every full stop. For pages 11-12 slower ~80 wpm.
Accent: Clear Modern Standard Arabic.
Loudness: Constant, no escalation, no drama even on climax pages. Climax quieter not louder for bedtime.`;

  const lines = pages.map(p => {
    const idNum = String(p.num).padStart(3,'0');
    const file = `page-${idNum}-ar.wav`;
    // Build per-page style from pron notes + generic bedtime
    let style = `Calm bedtime narration for page ${p.num}. Steady, warm, unhurried.`;
    if (p.num === 12) style += " Slowest page of story, sleepy, soft ending.";
    // Append pronunciation hint if any
    const noteKey = String(p.num);
    if (pronNotes[noteKey]) {
      style += ` Note: ${pronNotes[noteKey].replace(/🔴/g,'').trim()}`;
    }
    // Duration estimate: Arabic avg 12 chars/sec? Rough: count chars
    const charCount = p.text.length;
    const estimatedMs = Math.round((charCount/8.5)*1000); // ~8.5 chars per second for 90 wpm Arabic? Adjust from act-s1: page had ~40 chars and 5000ms => 8 chars/sec
    // Apply clamps from spec: we have duration table but for now compute
    return {
      page: p.num,
      id: `asset-${storyId}-vo-ar-${idNum}`,
      file,
      text: p.text.replace(/·/g,'').trim(), // remove dot separator
      style,
      planned_duration_ms: estimatedMs,
    };
  });

  return {
    story: storyId,
    story_file: mdPath,
    language: "ar",
    out_dir: outDir,
    model: "gemini-2.5-flash-preview-tts", // will fallback inside narrate.mjs if needed, but we use same pattern
    voice,
    voice_locked_because: "Leda youthful feminine voice for bedtime stories, same as act-s1 locked – bright soft affectionate, closest to young female for children.",
    voice_alternatives: ["Vindemiatrix","Sulafat","Aoede","Achernar","Kore"],
    language_code: "ar-EG",
    notes: [
      "Arabic text verbatim from story file.",
      "Uses same prompt structure as act-s1 locked (preamble + TRANSCRIPT boundary) to avoid PROHIBITED_CONTENT or reading director notes aloud."
    ],
    preamble,
    global_style,
    lines
  };
}

for (const s of stories) {
  const fullPath = path.join(ROOT, s.file);
  if (!fs.existsSync(fullPath)) {
    console.warn(`Missing ${fullPath}`);
    continue;
  }
  const text = fs.readFileSync(fullPath,'utf8');
  const pages = parsePagesFromMD(text);
  const pron = parsePronunciationNotes(text);
  console.log(`${s.id} ${s.title} – parsed ${pages.length} pages`);
  if (pages.length===0) {
    console.warn(`  ⚠️ No pages parsed for ${s.id}, check table format`);
    continue;
  }
  // For bs stories page count is 12
  const manifest = buildManifest(s.id, s.file, pages, pron);
  const outPath = path.join(__dirname, `${s.id}.narration.json`);
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`  ✅ wrote ${outPath} with ${manifest.lines.length} lines`);
}
console.log('\nDone – manifests for bs-s1..bs-s6 generated in tools/tts/');
