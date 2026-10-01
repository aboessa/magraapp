import scriptFull from './script.json';
import voFull from './voiceover.json';
import script30 from './script-30.json';
import vo30 from './voiceover-30.json';
export const FPS = 30;

type VoEntry = { file: string; durationSec: number };
type Pacing = { leadInSec: number; tailSec: number; endHoldSec: number };
type ScriptScene = { id: string; minSec: number; beats?: number[]; requiresCharacters?: boolean };
type Script = { scenes: ScriptScene[]; pacing?: Pacing };

/** Which edit to build: the full ~55 s ad or the 30 s cut. */
export type Cut = 'full' | '30';

// Full cut keeps its original pacing; each script may override it.
const DEFAULT_PACING: Pacing = {
  leadInSec: 0.35, // silence before the narration starts in each scene
  tailSec: 0.55, // breathing room after the line ends
  endHoldSec: 1.2, // hold the CTA on screen after the last line
};
const CUTS: Record<Cut, { script: Script; vo: Record<string, VoEntry | undefined> }> = {
  full: { script: scriptFull as Script, vo: voFull as Record<string, VoEntry | undefined> },
  '30': { script: script30 as Script, vo: vo30 as Record<string, VoEntry | undefined> },
};

export type SceneId =
  | 's1-hook' | 's2-problem' | 's3-logo' | 's4-planets'
  | 's5-formats' | 's6-characters' | 's7-parents' | 's8-cta';
export type TimedScene = {
  id: SceneId;
  from: number;
  durationInFrames: number;
  voFile?: string;
  voFrom: number; // local frame the narration starts at
  voFrames: number; // narration length in frames (fallback: scene length)
  beats: number[]; // local frames where key spoken words start
};
export function buildTimeline(includeCharacters: boolean, cut: Cut = 'full'): TimedScene[] {
  const { script, vo } = CUTS[cut];
  const { leadInSec, tailSec, endHoldSec } = script.pacing ?? DEFAULT_PACING;
  let cursor = 0;
  const out: TimedScene[] = [];
  for (const s of script.scenes) {
    if (s.requiresCharacters && !includeCharacters) continue;
    const clip = vo[s.id];
    const voSec = clip?.durationSec ?? 0;
    const isLast = s === script.scenes[script.scenes.length - 1];
    const sec = Math.max(s.minSec, leadInSec + voSec + tailSec + (isLast ? endHoldSec : 0));
    const durationInFrames = Math.round(sec * FPS);
    out.push({
      id: s.id as SceneId,
      from: cursor,
      durationInFrames,
      voFile: clip?.file,
      voFrom: Math.round(leadInSec * FPS),
      voFrames: clip ? Math.round(voSec * FPS) : durationInFrames,
      beats: (s.beats ?? [0]).map((b) => Math.round((leadInSec + b) * FPS)),
    });
    cursor += durationInFrames;
  }
  return out;
}
export function totalFrames(t: TimedScene[]): number {
  const last = t[t.length - 1];
  return last.from + last.durationInFrames;
}
