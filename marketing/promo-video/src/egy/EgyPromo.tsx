import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FONT } from '../theme';
import { INK, POP, Sfx, outCubic, wipeClip, type Wipe } from './pop';
import { CtaE, FlipE, HookE, LogoE, ParentsE, WorldsE } from './scenes';
import { BEAT, buildEgyTimeline, egyTotal, type EgyId, type EgyScene } from './timeline';

const SCENES: Record<EgyId, { C: React.FC<{ t: EgyScene }>; wipe: Wipe; accent: string }> = {
  'e1-hook': { C: HookE, wipe: 'none', accent: POP.yellow },
  'e2-flip': { C: FlipE, wipe: 'slash', accent: INK },
  'e3-logo': { C: LogoE, wipe: 'iris', accent: POP.yellow },
  'e4-worlds': { C: WorldsE, wipe: 'whip', accent: POP.coral },
  'e5-parents': { C: ParentsE, wipe: 'bars', accent: POP.yellow },
  'e6-cta': { C: CtaE, wipe: 'iris', accent: POP.coral },
};
const OVERLAP = 10; // previous scene keeps playing under the incoming wipe
const WIPE = 9;

/** Each scene enters with a two-layer wipe (accent colour first, then the scene). */
const Enter: React.FC<{ kind: Wipe; accent: string; children: React.ReactNode }> = ({ kind, accent, children }) => {
  const f = useCurrentFrame();
  if (kind === 'none') return <>{children}</>;
  const lead = outCubic(f, 0, WIPE - 2);
  const main = outCubic(f, 2, WIPE);
  return (
    <AbsoluteFill>
      {main < 1 ? <AbsoluteFill style={{ background: accent, clipPath: wipeClip(kind, lead) }} /> : null}
      <AbsoluteFill style={{ clipPath: wipeClip(kind, main), transform: kind === 'whip' ? `translateX(${(1 - main) * 240}px)` : undefined }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Tiny zoom kick on every beat of the music: keeps the whole ad "bouncing". */
const BeatPulse: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const k = Math.exp(-(f % BEAT) / 3);
  return <AbsoluteFill style={{ transform: `scale(${1 + 0.014 * k})` }}>{children}</AbsoluteFill>;
};

const MUSIC = 0.6, DUCK = 0.3;

export const EgyPromo: React.FC = () => {
  const tl = buildEgyTimeline();
  const total = egyTotal(tl);
  const logo = tl.find((s) => s.id === 'e3-logo')!;
  const drop = logo.from + logo.beats[1]; // the logo slam
  const vol = (f: number) => {
    let v = MUSIC;
    for (const s of tl) {
      const a = s.from + s.voFrom, b = a + s.voFrames;
      const d = interpolate(f, [a - 4, a, b, b + 6], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      v = Math.min(v, MUSIC - (MUSIC - DUCK) * d);
    }
    // music "drop": a beat of silence right before the logo lands
    const gap = interpolate(f, [drop - 12, drop - 10, drop - 1, drop], [1, 0, 0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return v * gap * interpolate(f, [total - 30, total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  };
  return (
    <AbsoluteFill style={{ background: POP.yellow, fontFamily: FONT, direction: 'rtl' }}>
      <Audio src={staticFile('music/beat120.wav')} volume={vol} />
      <BeatPulse>
        {tl.map((s, i) => {
          const { C, wipe, accent } = SCENES[s.id];
          const last = i === tl.length - 1;
          return (
            <Sequence key={s.id} from={s.from} durationInFrames={s.dur + (last ? 0 : OVERLAP)} name={s.id}>
              <Enter kind={wipe} accent={accent}><C t={s} /></Enter>
            </Sequence>
          );
        })}
      </BeatPulse>
      {tl.map((s) => (s.voFile ? (
        <Sequence key={`vo-${s.id}`} from={s.from + s.voFrom} name={`${s.id} VO`} layout="none">
          <Audio src={staticFile(s.voFile)} volume={1} />
        </Sequence>
      ) : null))}
      {tl.slice(1).map((s) => <Sfx key={`w-${s.id}`} at={s.from} name="swish" volume={0.35} />)}
    </AbsoluteFill>
  );
};

export const egyDuration = () => egyTotal(buildEgyTimeline());
