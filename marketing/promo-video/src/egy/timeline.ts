import script from './script-egy.json';
import vo from './voiceover-egy.json';

export const FPS = 30;
type Vo = { file: string; durationSec: number; text: string };
type Scene = { id: string; vo: string; minSec: number; beats?: number[] };
type Script = { bpm: number; totalSec: number; pacing: { leadInSec: number; tailSec: number }; scenes: Scene[] };
const S = script as unknown as Script;
const V = vo as unknown as Record<string, Vo | undefined>;

/** Frames per musical beat (120 BPM at 30 fps = 15). */
export const BEAT = Math.round((60 / S.bpm) * FPS);
export const TOTAL = Math.round(S.totalSec * FPS);

export type EgyId = 'e1-hook' | 'e2-flip' | 'e3-logo' | 'e4-worlds' | 'e5-parents' | 'e6-cta';
export type EgyScene = {
  id: EgyId;
  from: number;
  dur: number;
  voFile?: string;
  voFrom: number;
  voFrames: number;
  /** Local frame where each spoken word starts (VO words split on spaces). */
  words: number[];
  /** Local frames of hand-checked phrase beats (from script `beats`, seconds from VO start). */
  beats: number[];
};

/** Rough per-word start times from letter counts (used where no hand beats exist). */
function wordStarts(text: string, sec: number): number[] {
  const w = text.split(/\s+/).filter(Boolean);
  const len = w.map((x) => x.replace(/[^\u0621-\u064A]/g, '').length + 1);
  const total = len.reduce((a, b) => a + b, 0);
  let acc = 0;
  return w.map((_, i) => { const s = (acc / total) * sec; acc += len[i]; return s; });
}

/**
 * Scenes are snapped to whole beats so every cut lands on a kick; the CTA
 * absorbs whatever is left of the 30 s.
 */
export function buildEgyTimeline(): EgyScene[] {
  const { leadInSec, tailSec } = S.pacing;
  const lead = Math.round(leadInSec * FPS);
  let cursor = 0;
  const out: EgyScene[] = S.scenes.map((s, i) => {
    const clip = V[s.id];
    const voSec = clip?.durationSec ?? 0;
    const need = Math.max(s.minSec, leadInSec + voSec + tailSec) * FPS;
    let dur = Math.ceil(need / BEAT) * BEAT;
    if (i === S.scenes.length - 1) dur = Math.max(dur, TOTAL - cursor);
    const scene: EgyScene = {
      id: s.id as EgyId,
      from: cursor,
      dur,
      voFile: clip?.file,
      voFrom: lead,
      voFrames: Math.round(voSec * FPS),
      words: wordStarts(s.vo, voSec).map((x) => lead + Math.round(x * FPS)),
      beats: (s.beats ?? [0]).map((b) => lead + Math.round(b * FPS)),
    };
    cursor += dur;
    return scene;
  });
  return out;
}

export const egyTotal = (t: EgyScene[]) => t[t.length - 1].from + t[t.length - 1].dur;
