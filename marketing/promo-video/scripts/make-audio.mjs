// Synthesises a license-free ambient music bed and a few SFX with FFmpeg only
// (no samples, no third-party audio). Replace public/music/bed.wav with a
// licensed track any time; the video picks it up automatically.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(join(pub, 'music'), { recursive: true });
mkdirSync(join(pub, 'sfx'), { recursive: true });

// loudnorm upsamples to 192 kHz internally, so force 48 kHz on every output.
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args.slice(0, -1), '-ar', '48000', args.at(-1)]);

// ── Music bed: Cmaj9 → Am9 → Fmaj9 → G6/9, 4 s per chord, two voices offset by
// half a chord with sin² envelopes so chord changes crossfade without clicks.
const CHORDS = [
  [130.81, 196.0, 246.94, 293.66, 329.63],
  [110.0, 164.81, 196.0, 246.94, 261.63],
  [87.31, 130.81, 164.81, 196.0, 261.63],
  [98.0, 146.83, 196.0, 220.0, 293.66],
];
const LEN = 4;
function voice(shift) {
  const k = `mod(floor((t+${shift})/${LEN}),4)`;
  const env = `pow(sin(PI*mod(t+${shift},${LEN})/${LEN}),2)`;
  const chord = CHORDS.map((notes, c) =>
    `eq(${k},${c})*(${notes.map((f, i) => `${(0.9 - i * 0.12).toFixed(2)}*sin(2*PI*${f}*t)+0.35*sin(2*PI*${(f * 2.003).toFixed(3)}*t)`).join('+')})`,
  ).join('+');
  return `(${chord})*${env}`;
}
const shimmer = '0.06*sin(2*PI*1046.5*t)*pow(sin(PI*t/2),8)+0.05*sin(2*PI*1318.5*t)*pow(sin(PI*(t+1)/2),8)';
const bedExpr = `0.05*(${voice(0)}+${voice(LEN / 2)})*(0.85+0.15*sin(2*PI*0.2*t))+${shimmer}`;
ff('-f', 'lavfi', '-i', `aevalsrc=exprs='${bedExpr}':s=48000:d=70`,
  '-af', 'lowpass=f=2400,aecho=0.8:0.6:90|230:0.35|0.22,afade=t=in:d=2,loudnorm=I=-26:TP=-3',
  '-ac', '2', '-c:a', 'pcm_s16le', join(pub, 'music', 'bed.wav'));

// ── SFX
ff('-f', 'lavfi', '-i', 'anoisesrc=d=0.8:c=pink:a=0.6',
  '-af', 'highpass=f=500,lowpass=f=6000,afade=t=in:d=0.35:curve=exp,afade=t=out:st=0.35:d=0.45,aecho=0.7:0.5:40:0.3,loudnorm=I=-20',
  join(pub, 'sfx', 'whoosh.wav'));
ff('-f', 'lavfi', '-i', "aevalsrc=exprs='0.3*(sin(2*PI*1318.5*t)+0.6*sin(2*PI*1975.5*t)+0.35*sin(2*PI*2637*t))*exp(-3.5*t)':s=48000:d=1.6",
  '-af', 'aecho=0.8:0.6:120|260:0.3|0.2,loudnorm=I=-20', join(pub, 'sfx', 'chime.wav'));
ff('-f', 'lavfi', '-i', "aevalsrc=exprs='0.6*sin(2*PI*(700-1400*t)*t)*exp(-16*t)':s=48000:d=0.3",
  '-af', 'loudnorm=I=-22', join(pub, 'sfx', 'pop.wav'));
ff('-f', 'lavfi', '-i', 'anoisesrc=d=1.4:c=white:a=0.4',
  '-af', 'highpass=f=2500,afade=t=in:d=1.3:curve=exp,afade=t=out:st=1.3:d=0.1,loudnorm=I=-24', join(pub, 'sfx', 'riser.wav'));
ff('-f', 'lavfi', '-i', "aevalsrc=exprs='0.9*sin(2*PI*(90-60*t)*t)*exp(-7*t)':s=48000:d=0.6",
  '-af', 'lowpass=f=300,loudnorm=I=-18', join(pub, 'sfx', 'boom.wav'));
console.log('audio ready');
