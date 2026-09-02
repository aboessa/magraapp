#!/usr/bin/env node
// Produce all bs-s1..bs-s6 audio via Google AI Studio TTS
// Uses narrate.mjs logic but batch

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const stories = ['bs-s1','bs-s2','bs-s3','bs-s4','bs-s5','bs-s6'];

async function run(cmd, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${cmd} ${args.join(' ')}`);
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd: path.resolve('f:/Projects/cartoonapp') });
    p.on('close', code => code===0?resolve():reject(new Error(`exit ${code}`)));
    p.on('error', reject);
  });
}

async function main() {
  for (const story of stories) {
    console.log(`\n\n━━━━━━━━━━━━ ${story} ━━━━━━━━━━━━`);
    try {
      await run('node', [`tools/tts/narrate.mjs`, '--all', '--manifest', `${story}.narration.json`]);
    } catch (e) {
      console.error(`❌ ${story} failed: ${e.message} – continuing`);
    }
  }
  console.log('\n\n🎉 All BS audio done');
  // inventory
  for (const s of stories) {
    const dir = path.resolve(`f:/Projects/cartoonapp/assets/audio/stories/${s}/ar`);
    const count = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f=>f.endsWith('.wav')).length : 0;
    console.log(`${s}: ${count} wav files in ${dir}`);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
