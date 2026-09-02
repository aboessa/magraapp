#!/usr/bin/env node
/**
 * Fix 2 issues:
 * 1) 404 on games because series draft -> will be fixed by deploying API route change
 * 2) Duplicate covers: every 3-4 games share same imageAsset. Generate unique PlayVeo cover per game-id
 * 
 * This script generates unique covers for ALL 44 games via PlayVeo API.
 * Uses same pattern as generate_wave4_assets.mjs but covers entire catalog.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
const ROOT = 'F:\\Projects\\cartoonapp';

// Read API key
let apiKey = '';
try {
  const keyPath = path.join(os.homedir(), '.majarra', 'playveo.key');
  apiKey = fs.readFileSync(keyPath, 'utf8').trim();
} catch {}
if (!apiKey) {
  apiKey = process.env.PLAYVEO_API_KEY?.trim() || '';
}
if (!apiKey) {
  console.error('No PlayVeo API key found at ~/.majarra/playveo.key nor PLAYVEO_API_KEY env');
  process.exit(1);
}

const PLAYVEO_BASE = 'https://playveo-api.aboessa101.workers.dev';

async function submitImage(prompt, opts = {}) {
  const { aspect_ratio = '4:3', count = 1 } = opts;
  const res = await fetch(`${PLAYVEO_BASE}/v1/images/text-to-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ prompt, aspect_ratio, count })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`PlayVeo submit failed ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function pollImage(id, maxAttempts = 40, intervalMs = 4000) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${PLAYVEO_BASE}/v1/images/${id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await res.json();
    if (data.status === 'completed') return data;
    if (data.status === 'failed') throw new Error(`Image ${id} failed: ${JSON.stringify(data)}`);
    console.log(`  [poll ${i + 1}/${maxAttempts}] ${id} status=${data.status}`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout polling ${id}`);
}

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

// All games needing unique covers — prompt per game so no repeats
// Wave1-3 legacy reused 3 covers for 9 games; Wave4 had 11 covers already but still need per-game uniqueness
const GAME_COVER_PROMPTS = {
  // Wave1 — previously all mapped to 3 shared local assets
  'game-wave1-memory-animals': "Friendly preschool memory game cover: 2x2 rounded flip cards with distinct animal faces ginger cat blue bird from above soft sunrise meadow, warm discovery, 4:3 child-friendly premium, no text.",
  'game-wave1-picture-match': "Preschool picture matching game cover: bright table with cat photo and framed silhouette target on top shelf bird matching, cozy playroom, clear pairing concept 4:3, no text.",
  'game-wave1-color-sort': "Sorting colors game cover: red bucket blue bucket with color-coordinated toys red apple blue block moving to correct basket, simple cream classroom 4:3 no text.",
  'game-wave1-count-place': "Counting game cover: 3 golden star tokens arc above numbered pebble slots, soft night-sky picnic, gentle counting story, 4:3 no digits no text.",
  'game-wave1-sequence-kids': "Sequence order game cover: terracotta pot lifecycle seed sprout flower 3 cards in row, watering can persistent, sunny garden storybook 4:3 no text.",
  'game-wave1-logic-kids': "Logic pattern game cover: clean 2x2 grid alternating golden moon teal rocket puzzle with empty glowing cell, observatory clean logic 4:3 no text.",
  'game-wave1-word-kids': "Word building Arabic game cover: preschool tray with soft 3D Arabic letter blocks أ ب forming بيت, gentle glow, warm wooden classroom, 4:3 no text (letters as objects not typography).",
  'game-wave1-block-code': "Block coding robot maze cover: friendly robot on teal circuit garden grid 4x4 with golden crystal goal, rounded obstacles safe, junior workshop 4:3 no text.",
  'game-wave1-sim-lab': "Science sim lab game cover: child-friendly plant lab with sunlight water sliders watering can thermometer, tiny plant growing, 4:3 no text.",

  // Wave2-3 — also duplicated
  'game-wave2-memory-2': "Memory game level 2 cover: 3x4 grid preview lion turtle faces upside down cards sunrise savanna, slightly more challenging, 4:3 no text.",
  'game-wave2-match-2': "Matching game level 2 cover: crescent moon and star paired silhouettes on night table with constellation frame targets, 6-8 age magical 4:3 no text.",
  'game-wave2-sort-junior': "Advanced sorting cover: circle star hexagon shapes sorting into labelled baskets primary colors geometric classroom, 9-12 clean 4:3 no text.",
  'game-wave2-count-drag': "Count and drag game cover: child hand dragging 4 red apples into basket with number pebbles, warm kitchen counter, interactive dragging concept 4:3 no digits no text.",
  'game-wave2-timeline': "Timeline map cover: ancient Egyptian timeline pyramid -2600 next to Egyptian temple map with Nile, desert sand papyrus texture educational 4:3 no text.",
  'game-wave2-rhythm': "Rhythm tap game cover: colorful music lanes 2 lanes with falling musical notes tap glowing buttons nature soundtrack, fun 4:3 no text.",
  'game-wave3-timeline-detail': "Detailed timeline cover: Egypt through time pyramid pharaoh temple detailed chronological path with map markers, 4:3 no text.",
  'game-wave3-block-advanced': "Advanced coding cover: 5x5 maze with function blocks loop blocks robot path optimizer 8 steps, junior coder workshop darker teal 4:3 no text.",
  'game-wave3-sim-saturating': "Water balancing lab cover: beaker with water level saturation concept overflow plant experiment supervision badge, science classroom 4:3 no text.",

  // Wave4 — already unique but re-generate to ensure CDN distinctness (keep existing if wanted, but skip here if already exist)
  // We will generate only if not already uploaded (check presence via manifest)
  'game-match-nature-3': null, // already has PlayVeo cover
  'game-count-nature-3': null,
  'game-sort-animals-3': null,
  'game-memory-shapes-3': null,
  'game-sequence-story-3a': "Sequence story growth cover: seed sprout flower story cards terracotta pot watering can same across 3 cards bright garden, 4:3 no text.",
  'game-sequence-daily-3b': "Daily routine sequence cover: child morning routine cards bed toothbrush school bag in order warm bedroom, 4:3 no text.",
  'game-logic-colors-3a': null,
  'game-logic-sequence-3b': "Logic sequence checkerboard cover: red blue checkerboard pattern with missing tile glow logical reasoning 9-12, 4:3 no text.",
  'game-block-maze-3': null,
  'game-rhythm-nature-3a': null,
  'game-rhythm-festive-3b': "Festive rhythm cover: celebration drums confetti musical notes lanes 3 lanes happy party rhythm 4:3 no text.",
  'game-sim-plant-3': null,
  'game-timeline-egypt-3': null,
  'game-shape-trace-3': null,
  'game-number-trace-3': null,
  'game-word-family-3a': "Word family cover: cozy home scene with Arabic word family أب أم بيت soft 3D letter toys on shelf father mother house icons, 6-8 warm 4:3 no text (letters as objects).",
  'game-word-animals-3b': "Animal words Arabic cover: forest animals cat bird with Arabic letter blocks forming animal names child-friendly, 4:3 no text.",

  // Legacy 5 demo
  'game-letter-tracing': "Arabic letter tracing cover: large dotted Arabic letter in moonlight with glowing dots child hand tracing luminous path, 4:3 no text.",
  'game-number-maze': "Number maze cover: friendly maze with numbers pathway 1 to 5 stars collect, playful 4:3 no text.",
  'game-animal-memory': "Animal memory cover: original animal faces memory cards savanna, 4:3 no text.",
  'game-shape-matching': "Shape matching cover: bright shapes circle square triangle matching their silhouette frames, preschool table 4:3 no text.",
  'game-butterfly-sequence': "Butterfly lifecycle sequence cover: egg caterpillar chrysalis butterfly 4 stages cards garden, 4:3 no text.",
};

const outDir = path.join(ROOT, 'majarra_images', 'assets', 'games');
const jobsPath = path.join(ROOT, 'tools', 'playveo', 'games-unique-covers-jobs.json');

async function main() {
  const args = process.argv.slice(2);
  const submitOnly = args.includes('--submit');
  const pollOnly = args.includes('--poll');
  const onlyId = args.find(a => a.startsWith('--only='))?.split('=')[1];

  let jobs = {};
  if (fs.existsSync(jobsPath)) {
    try { jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8')); } catch {}
  }

  const entries = Object.entries(GAME_COVER_PROMPTS).filter(([id, prompt]) =>
    prompt !== null && (!onlyId || id === onlyId)
  );

  console.log(`Processing ${entries.length} unique covers (only=${onlyId || 'all'})`);

  if (!pollOnly) {
    for (const [gameId, prompt] of entries) {
      if (jobs[gameId]?.status === 'completed') {
        console.log(`SKIP ${gameId} already completed`);
        continue;
      }
      if (jobs[gameId]?.id) {
        console.log(`RESUME ${gameId} existing job ${jobs[gameId].id}`);
        continue;
      }
      console.log(`SUBMIT ${gameId}`);
      try {
        const res = await submitImage(prompt, { aspect_ratio: '4:3', count: 1 });
        jobs[gameId] = { id: res.id, status: res.status || 'pending', prompt, submittedAt: new Date().toISOString() };
        fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2));
        console.log(`  -> ${res.id} status=${res.status} cost=${res.cost ?? '?'}`);
        // Throttle to avoid rate limit
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.error(`  FAILED ${gameId}: ${e.message}`);
        jobs[gameId] = { status: 'failed', error: e.message, prompt };
        fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2));
      }
    }
    if (submitOnly) {
      console.log('Submit-only done. Run without --submit to poll & download.');
      return;
    }
  }

  // Poll & download
  for (const [gameId, prompt] of entries) {
    const job = jobs[gameId];
    if (!job?.id) { console.log(`NO JOB for ${gameId}`); continue; }
    if (job.status === 'completed' && job.localPath && fs.existsSync(job.localPath)) {
      console.log(`SKIP ${gameId} already downloaded ${job.localPath}`);
      continue;
    }
    console.log(`POLL ${gameId} job ${job.id}`);
    try {
      const result = await pollImage(job.id);
      console.log(`COMPLETED ${gameId} urls=${result.resultUrls?.length ?? 0}`);
      if (result.resultUrls && result.resultUrls[0]) {
        const dest = path.join(outDir, gameId, 'cover.jpg');
        const size = await downloadImage(result.resultUrls[0], dest);
        console.log(`  DOWNLOADED ${dest} ${size}B`);
        jobs[gameId].status = 'completed';
        jobs[gameId].resultUrls = result.resultUrls;
        jobs[gameId].localPath = dest;
        fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2));
      }
    } catch (e) {
      console.error(`  FAILED POLL ${gameId}: ${e.message}`);
    }
  }

  console.log('Done. Jobs file:', jobsPath);
}

main().catch(e => { console.error(e); process.exit(1); });
