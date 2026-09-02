import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const home = os.homedir();
const keyPath = path.join(home, '.majarra','google-ai.key');
const key = fs.readFileSync(keyPath,'utf8').trim();
console.log('google-ai key len', key.length, 'prefix', key.slice(0,8));
const devVarsPath = path.join("F:\\Projects\\cartoonapp","dashboard","api",".dev.vars");
let content = '';
try { content = fs.readFileSync(devVarsPath,'utf8'); } catch {}
if (content.includes('GOOGLE_TTS_API_KEY')) {
  content = content.replace(/GOOGLE_TTS_API_KEY=.*/g, `GOOGLE_TTS_API_KEY=${key}`);
  console.log('UPDATED existing GOOGLE_TTS_API_KEY');
} else {
  content += `\nGOOGLE_TTS_API_KEY=${key}\n`;
  console.log('ADDED GOOGLE_TTS_API_KEY');
}
if (content.includes('GOOGLE_AI_API_KEY')) {
  content = content.replace(/GOOGLE_AI_API_KEY=.*/g, `GOOGLE_AI_API_KEY=${key}`);
} else {
  content += `GOOGLE_AI_API_KEY=${key}\n`;
}
fs.writeFileSync(devVarsPath, content);
console.log('Written .dev.vars, check:');
const out = fs.readFileSync(devVarsPath,'utf8').split('\n').filter(l=>l.includes('GOOGLE')||l.includes('PLAYVEO')).map(l=>l.slice(0,40)+'...');
console.log(out.join('\n'));
