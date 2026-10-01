// Synthesises a license-free 120 BPM pop/trap-lite beat and punchy SFX for the
// Egyptian 30 s cut, with FFmpeg only (no samples). One beat = 0.5 s = 15
// frames at 30 fps, so scene cuts in the video land exactly on the kick.
// Output: public/music/beat120.wav + public/sfx/{stamp,swish,glitch,tick,impact}.wav
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const tmp = join(root, 'out', 'beat-tmp');
mkdirSync(join(pub, 'music'), { recursive: true });
mkdirSync(join(pub, 'sfx'), { recursive: true });
mkdirSync(tmp, { recursive: true });

const D = 32; // seconds (video is 30 s)
const ff = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
const gen = (name, expr, filters = 'anull', d = D) => {
  const out = join(tmp, `${name}.wav`);
  ff('-f', 'lavfi', '-i', `aevalsrc=exprs='${expr}':s=48000:d=${d}`, '-af', filters, '-ar', '48000', '-ac', '1', out);
  return out;
};

// Kick on every beat: pitch-swept sine (45 Hz + 110 Hz drop), phase integrated.
const kt = 'mod(t,0.5)';
const kick = gen('kick', `0.95*sin(2*PI*(45*${kt}+3.667*(1-exp(-30*${kt}))))*exp(-9*${kt})`, 'lowpass=f=900');
// Clap on beats 2 and 4 (noise burst with a short double-hit).
const ct = 'mod(t+0.5,1)';
const clap = gen('clap', `(random(0)*2-1)*(exp(-22*${ct})+0.6*exp(-60*abs(${ct}-0.012)))*0.7`, 'bandpass=f=1600:w=1400');
// Hats on 8ths, accented off-beats.
const ht = 'mod(t,0.25)';
const hat = gen('hat', `(random(0)*2-1)*exp(-80*${ht})*(0.35+0.25*gte(mod(t,0.5),0.25))`, 'highpass=f=7000');
// Bass: 8th-note plucks following C – Am – F – G (one chord per bar = 2 s).
const bar = 'mod(floor(t/2),4)';
const root_ = `(eq(${bar},0)*65.41+eq(${bar},1)*55+eq(${bar},2)*43.65+eq(${bar},3)*49)`;
const benv = `sqrt(sin(PI*${ht}/0.25))*exp(-5*${ht})`;
const bass = gen('bass', `(sin(2*PI*${root_}*t)+0.35*sin(4*PI*${root_}*t))*${benv}*0.9`, 'lowpass=f=420');
// Chord stabs on the "and" of each beat.
const CH = [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]];
const st = 'mod(t+0.25,0.5)';
const tone = (f) => `(sin(2*PI*${f}*t)+0.5*sin(4*PI*${f}*t)+0.25*sin(6*PI*${f}*t))`;
const stabExpr = CH.map((c, i) => `eq(${bar},${i})*(${c.map(tone).join('+')})`).join('+');
const stab = gen('stab', `0.16*(${stabExpr})*exp(-10*${st})`, 'lowpass=f=3200,aecho=0.8:0.5:125:0.25');

ff('-i', kick, '-i', clap, '-i', hat, '-i', bass, '-i', stab,
  '-filter_complex', '[0][1][2][3][4]amix=inputs=5:weights=1.0 0.55 0.35 0.8 0.6:normalize=0,acompressor=threshold=0.25:ratio=3:attack=5:release=80,loudnorm=I=-15:TP=-1.5,afade=t=out:st=29.2:d=2.3',
  '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', join(pub, 'music', 'beat120.wav'));

// ── SFX
const sfx = (name, expr, d, filters) => ff('-f', 'lavfi', '-i', `aevalsrc=exprs='${expr}':s=48000:d=${d}`,
  '-af', `${filters},loudnorm=I=-18`, '-ar', '48000', join(pub, 'sfx', `${name}.wav`));
sfx('stamp', '0.9*sin(2*PI*(60*t+2.5*(1-exp(-40*t))))*exp(-10*t)+0.5*(random(0)*2-1)*exp(-45*t)', 0.45, 'lowpass=f=2500');
sfx('swish', '(random(0)*2-1)*pow(sin(PI*t/0.28),2)', 0.28, 'bandpass=f=3000:w=4000,highpass=f=800');
sfx('glitch', '(random(0)*2-1)*gt(sin(2*PI*23*t),0.2)*0.8+0.4*sin(2*PI*180*t)*gt(sin(2*PI*11*t),0)', 0.5, 'acrusher=bits=4:samples=12,highpass=f=300');
sfx('tick', 'sin(2*PI*2200*t)*exp(-90*t)', 0.08, 'anull');
sfx('impact', '1.0*sin(2*PI*(38*t+3*(1-exp(-18*t))))*exp(-3.5*t)+0.6*(random(0)*2-1)*exp(-14*t)', 1.4, 'lowpass=f=1800,aecho=0.8:0.4:60:0.3');

rmSync(tmp, { recursive: true, force: true });
console.log('beat + sfx ready');
