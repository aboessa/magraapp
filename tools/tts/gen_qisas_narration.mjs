#!/usr/bin/env node
// Generate narration manifests for qisas-min-alhayat (junior 9-12) – 5 stories, 16-20 pages each
import fs from 'fs';
import path from 'path';
const ROOT = 'F:/Projects/cartoonapp';
const manifestPath = path.join(ROOT,'docs/content/planets/05-qisas/_manifest-qisas-min-alhayat.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const stories = manifest.stories;

function buildNarrationManifest(story){
  const outDir = `assets/audio/stories/qml-${story.slug}/ar`;
  const lines = (story.pages||[]).map(p=>{
    const idNum = String(p.page_number).padStart(3,'0');
    return {
      page: p.page_number,
      id: `asset-qml-${story.slug}-vo-ar-${idNum}`,
      file: `page-${idNum}-ar.wav`,
      text: p.text_ar,
      style: `Junior 9-12 independent reading narration, clear, steady, unhurried, slightly mature tone for 11-year-old, no drama, no babyish voice, constant loudness. Page ${p.page_number} role: ${p.role || ''}.`
    };
  });

  return {
    story: `qml-${story.slug}`,
    story_file: `docs/content/planets/05-qisas/qisas-min-alhayat/${story.slug}.md`,
    language: 'ar',
    out_dir: outDir,
    model: 'gemini-2.5-flash-preview-tts',
    voice: 'Leda',
    voice_locked_because: 'Same youthful voice used for preschool and bedtime for consistency, bright soft clear.',
    voice_alternatives: ['Vindemiatrix','Sulafat','Aoede','Kore'],
    language_code: 'ar-EG',
    notes: ['Arabic verbatim from manifest','read_myself default is fine, but audio needed for accessibility and read_to_me option'],
    preamble: "Synthesize speech. Read aloud only the text under TRANSCRIPT. Everything above it is direction for how to perform, and must never be spoken.",
    global_style: `# AUDIO PROFILE: Salma – junior 9-12
## "The Kind Older Sister, slightly more mature for 11-year-old"
Salma is a young Arab woman early twenties, light bright feminine voice, reading a junior story for 9-12 independent readers. Clear, steady, unhurried, warm but not babyish, slightly more mature than preschool bedtime, but still kind.
## THE SCENE
Child's room, afternoon or evening, quiet, child reading independently but with option to listen.
### DIRECTOR'S NOTES
Style: Bright, soft, clear, steady, warm, unhurried, mature enough for 11-year-old, never breathy, never babyish, never cartoon.
Pacing: ~100 words/min, natural pause at full stop.
Accent: Clear Modern Standard Arabic.
Loudness: Constant, no escalation, no drama.
Page is part of a literary story with no explicit moral at end.
`,
    lines
  };
}

for(const story of stories){
  const m = buildNarrationManifest(story);
  const outPath = path.join(ROOT, `tools/tts/qml-${story.slug}.narration.json`);
  fs.writeFileSync(outPath, JSON.stringify(m,null,2)+'\n','utf8');
  console.log(`wrote ${outPath} with ${m.lines.length} pages`);
}
console.log('All qisas narration manifests generated');
