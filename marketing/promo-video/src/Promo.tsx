import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from 'remotion';
import { CutFlash, SceneFrame, Sfx, SpaceBackground } from './theme';
import { buildTimeline, totalFrames, type Cut, type SceneId, type TimedScene } from './timeline';
import {
  CharactersScene, CtaScene, FormatsScene, HookScene, LogoScene, ParentsScene, PlanetsScene, ProblemScene,
} from './scenes';

export type PromoProps = {
  /** Keep false until the Character Sheet for the 3D avatars is approved. */
  includeCharacters: boolean;
  /** 'full' (~55 s) or '30' (30 s cut with its own shorter narration). */
  cut?: Cut;
};

const SCENES: Record<SceneId, React.FC<{ t: TimedScene }>> = {
  's1-hook': HookScene,
  's2-problem': ProblemScene,
  's3-logo': LogoScene,
  's4-planets': PlanetsScene,
  's5-formats': FormatsScene,
  's6-characters': CharactersScene,
  's7-parents': ParentsScene,
  's8-cta': CtaScene,
};

const MUSIC = 0.55; // bed level with no narration
const DUCKED = 0.22; // bed level under narration

export const Promo: React.FC<PromoProps> = ({ includeCharacters, cut = 'full' }) => {
  const timeline = buildTimeline(includeCharacters, cut);
  const total = totalFrames(timeline);
  const cuts = timeline.slice(1).map((t) => t.from);

  // Duck the music bed under each narration line (6-frame ramps).
  const musicVolume = (f: number) => {
    let v = MUSIC;
    for (const t of timeline) {
      const s = t.from + t.voFrom, e = s + t.voFrames;
      const d = interpolate(f, [s - 6, s, e, e + 8], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      v = Math.min(v, MUSIC - (MUSIC - DUCKED) * d);
    }
    const fadeOut = interpolate(f, [total - 45, total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return v * fadeOut;
  };

  return (
    <AbsoluteFill>
      <SpaceBackground cuts={cuts} />
      <Audio src={staticFile('music/bed.wav')} volume={musicVolume} />
      {timeline.map((t) => {
        const Scene = SCENES[t.id];
        return (
          <Sequence key={t.id} from={t.from} durationInFrames={t.durationInFrames} name={t.id}>
            <SceneFrame duration={t.durationInFrames} last={t === timeline[timeline.length - 1]}>
              <Scene t={t} />
            </SceneFrame>
            {t.voFile ? (
              <Sequence from={t.voFrom} name={`${t.id} VO`} layout="none">
                <Audio src={staticFile(t.voFile)} volume={1} />
              </Sequence>
            ) : null}
          </Sequence>
        );
      })}
      {cuts.map((c) => (
        <Sequence key={c} from={c - 8} durationInFrames={17} name="cut">
          <CutFlash />
          <Sfx at={0} name="whoosh" volume={0.45} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
