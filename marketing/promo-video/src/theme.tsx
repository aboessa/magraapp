import React from 'react';
import {
  AbsoluteFill, Audio, Img, Sequence, continueRender, delayRender, interpolate, random, spring,
  staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';

// Brand palette from brandcolor.md.
export const C = {
  deep: '#06091A',
  midnight: '#0B1026',
  indigo: '#1B236B',
  card: '#161F45',
  cardHi: '#1D2855',
  border: '#2B3767',
  blue: '#2856D8',
  purple: '#6A3DF2',
  cyan: '#00D6F5',
  yellow: '#FFD34D',
  orange: '#FF9F1C',
  coral: '#FF6FAE',
  magenta: '#C84BFF',
  white: '#F2F6FF',
  gray: '#AAB5D1',
  green: '#38D996',
  textOnYellow: '#10162F',
};

export const GRADIENTS = {
  space: 'linear-gradient(160deg, #06091A 0%, #0B1026 35%, #1B236B 72%, #351A68 100%)',
  button: 'linear-gradient(90deg, #FFD34D 0%, #FFB52E 55%, #FF9F1C 100%)',
  orbit: 'linear-gradient(90deg, #00D6F5 0%, #2856D8 25%, #6A3DF2 50%, #C84BFF 72%, #FF6FAE 100%)',
  purpleCard: 'linear-gradient(145deg, #1B236B 0%, #352272 55%, #6A3DF2 100%)',
};

export const FONT = 'Readex';

// Load the app's own Arabic font before any frame is captured.
const fontHandle = delayRender('Loading Readex Pro');
Promise.all(
  ([['Regular', 400], ['SemiBold', 600], ['Bold', 700]] as const).map(async ([name, weight]) => {
    const face = new FontFace(FONT, `url(${staticFile(`fonts/ReadexPro-${name}.ttf`)})`, { weight: String(weight) });
    await face.load();
    document.fonts.add(face);
  }),
).then(() => continueRender(fontHandle)).catch((e) => {
  console.error(e);
  continueRender(fontHandle);
});

export const ease = (f: number, from: number, to: number, a = 0, b = 1) =>
  interpolate(f, [from, to], [a, b], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

/** Persistent cosmic background with slow parallax stars. */
export const SpaceBackground: React.FC<{ cuts?: number[] }> = ({ cuts = [] }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // Warp: stars rush past around every cut (smooth step in travelled distance).
  const sig = (x: number) => 1 / (1 + Math.exp(-x));
  const travel = frame * 0.35 + cuts.reduce((acc, c) => acc + 90 * sig((frame - c) / 3), 0);
  const speed = 0.35 + cuts.reduce((acc, c) => { const s = sig((frame - c) / 3); return acc + 30 * s * (1 - s); }, 0);
  const stars = React.useMemo(
    () => Array.from({ length: 140 }, (_, i) => ({
      x: random(`x${i}`) * width,
      y: random(`y${i}`) * height,
      r: 0.8 + random(`r${i}`) * 2.4,
      layer: 1 + Math.floor(random(`l${i}`) * 3),
      tw: random(`t${i}`) * Math.PI * 2,
    })),
    [width, height],
  );
  return (
    <AbsoluteFill style={{ background: GRADIENTS.space }}>
      {/* soft nebula glows */}
      <div style={{ position: 'absolute', width: 900, height: 900, left: -300, top: 200 + Math.sin(frame / 90) * 40,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(106,61,242,0.35), transparent 65%)' }} />
      <div style={{ position: 'absolute', width: 800, height: 800, right: -320, bottom: 180 + Math.cos(frame / 80) * 40,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,214,245,0.22), transparent 65%)' }} />
      <svg width={width} height={height} style={{ position: 'absolute' }}>
        {stars.map((s, i) => {
          const y = (((s.y - travel * s.layer) % height) + height) % height;
          const o = 0.35 + 0.65 * Math.abs(Math.sin(frame / 25 + s.tw));
          const streak = Math.min(260, speed * s.layer * 2.2);
          const fill = i % 9 === 0 ? C.yellow : C.white;
          return streak > 6
            ? <line key={i} x1={s.x} y1={y} x2={s.x} y2={y + streak} stroke={fill} strokeWidth={s.r * 1.4} strokeLinecap="round" opacity={o} />
            : <circle key={i} cx={s.x} cy={y} r={s.r} fill={fill} opacity={o} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * Camera-style scene wrapper: each scene punches in from a blurred zoom and
 * leaves by zooming through the camera, with a slow push-in in between.
 */
export const SceneFrame: React.FC<{ duration: number; last?: boolean; children: React.ReactNode }> = ({ duration, last, children }) => {
  const f = useCurrentFrame();
  const inP = ease(f, 0, 12);
  const outP = last ? 0 : ease(f, duration - 9, duration);
  const push = interpolate(f, [0, duration], [0, 0.04]);
  const scale = (1.18 - 0.18 * inP) * (1 + 0.35 * outP) + push;
  const blur = 14 * (1 - inP) + 18 * outP;
  return (
    <AbsoluteFill style={{
      opacity: inP * (1 - outP), transform: `scale(${scale})`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
      direction: 'rtl', fontFamily: FONT,
    }}>
      {children}
    </AbsoluteFill>
  );
};

/** Light streak + flash that hides every cut (rendered on top, centred on the cut frame). */
export const CutFlash: React.FC = () => {
  const f = useCurrentFrame(); // 0..16, cut at 8
  const p = interpolate(f, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const flash = Math.max(0, 1 - Math.abs(f - 8) / 6) * 0.35;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: -600 + p * 2300, top: -200, width: 260, height: 2400,
        transform: 'rotate(24deg)', background: 'linear-gradient(90deg, transparent, rgba(0,214,245,0.55), rgba(255,255,255,0.9), rgba(200,75,255,0.55), transparent)',
        filter: 'blur(18px)', opacity: Math.sin(p * Math.PI) }} />
      <AbsoluteFill style={{ background: '#ffffff', opacity: flash }} />
    </AbsoluteFill>
  );
};

/**
 * Word-by-word kinetic headline. Each word springs up out of a blur; pass
 * `starts` (local frames) to land specific words on the narration.
 */
export const Kinetic: React.FC<{
  text: string; top: number; size?: number; start?: number; starts?: number[]; stagger?: number;
  color?: string; gradient?: string; weight?: number; exitAt?: number;
}> = ({ text, top, size = 92, start = 0, starts, stagger = 4, color = C.white, gradient, weight = 700, exitAt }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  const exit = exitAt === undefined ? 0 : ease(f, exitAt, exitAt + 10);
  return (
    <div style={{ position: 'absolute', top, left: 50, right: 50, display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
      gap: `0 ${size * 0.28}px`, direction: 'rtl', opacity: 1 - exit, transform: `translateY(${-exit * 40}px)` }}>
      {words.map((w, i) => {
        const s = starts?.[i] ?? start + i * stagger;
        const p = spring({ frame: f - s, fps, config: { damping: 13, stiffness: 170, mass: 0.7 } });
        const o = interpolate(f - s, [0, 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <span key={i} style={{
            display: 'inline-block', fontFamily: FONT, fontWeight: weight, fontSize: size, lineHeight: 1.3,
            opacity: o, transform: `translateY(${(1 - p) * size * 0.7}px) scale(${0.7 + 0.3 * p})`,
            ...(gradient
              ? { background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: `drop-shadow(0 6px 24px rgba(0,0,0,0.5)) blur(${(1 - o) * 8}px)` }
              : { color, textShadow: '0 6px 30px rgba(0,0,0,0.55)', filter: `blur(${(1 - o) * 8}px)` }),
          }}>{w}</span>
        );
      })}
    </div>
  );
};

/** Radial particle burst triggered at `at`. */
export const Burst: React.FC<{ at: number; x: number; y: number; count?: number; radius?: number; colors?: string[]; seed?: string }> =
  ({ at, x, y, count = 36, radius = 520, colors = [C.yellow, C.cyan, C.coral, C.magenta, C.white], seed = 'b' }) => {
    const f = useCurrentFrame() - at;
    if (f < 0 || f > 45) return null;
    const p = 1 - Math.pow(1 - f / 45, 3);
    return (
      <>
        {Array.from({ length: count }).map((_, i) => {
          const a = (i / count) * Math.PI * 2 + random(`${seed}a${i}`) * 0.4;
          const d = radius * (0.5 + random(`${seed}d${i}`) * 0.6) * p;
          const s = 6 + random(`${seed}s${i}`) * 14;
          const c = colors[i % colors.length];
          return <div key={i} style={{ position: 'absolute', left: x + Math.cos(a) * d - s / 2, top: y + Math.sin(a) * d - s / 2,
            width: s, height: s, borderRadius: i % 3 ? '50%' : 3, background: c, boxShadow: `0 0 ${s * 1.6}px ${c}`,
            opacity: 1 - p, transform: `rotate(${f * 8}deg)` }} />;
        })}
      </>
    );
  };

/** Slowly rotating god-rays behind a hero element. */
export const Rays: React.FC<{ x: number; y: number; size: number; color?: string; opacity?: number }> = ({ x, y, size, color = 'rgba(255,211,77,0.22)', opacity = 1 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: '50%', opacity,
      background: `repeating-conic-gradient(from ${f * 0.6}deg, ${color} 0deg 7deg, transparent 7deg 22deg)`,
      WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 68%)' }} />
  );
};

/** A glossy light sweep masked to an image's own alpha (for the logo). */
export const ShinyImage: React.FC<{ src: string; width: number; sweepAt: number; style?: React.CSSProperties }> = ({ src, width, sweepAt, style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [sweepAt, sweepAt + 22], [-0.4, 1.4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'relative', width, ...style }}>
      <Img src={src} style={{ width, display: 'block' }} />
      <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: `url(${src})`, WebkitMaskSize: '100% 100%',
        background: `linear-gradient(110deg, transparent ${p * 100 - 12}%, rgba(255,255,255,0.85) ${p * 100}%, transparent ${p * 100 + 12}%)`,
        mixBlendMode: 'screen' }} />
    </div>
  );
};

export const Headline: React.FC<{
  children: React.ReactNode; top: number; size?: number; color?: string; opacity?: number; y?: number; gradient?: string;
}> = ({ children, top, size = 92, color = C.white, opacity = 1, y = 0, gradient }) => (
  <div style={{
    position: 'absolute', top, left: 60, right: 60, textAlign: 'center', fontFamily: FONT, fontWeight: 700,
    fontSize: size, lineHeight: 1.35, color, opacity, transform: `translateY(${y}px)`,
    textShadow: gradient ? undefined : '0 6px 30px rgba(0,0,0,0.45)',
    ...(gradient ? { background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : {}),
  }}>{children}</div>
);

/** Circular crop for square artwork that has a baked-in dark background. */
export const Orb: React.FC<{ src: string; size: number; glow: string; zoom?: number }> = ({ src, size, glow, zoom = 1.12 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', overflow: 'hidden',
    boxShadow: `0 0 ${size * 0.25}px ${glow}, 0 0 0 4px rgba(255,255,255,0.08)`,
  }}>
    <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})` }} />
  </div>
);

/** One-shot sound effect at a local frame. */
export const Sfx: React.FC<{ at: number; name: 'pop' | 'chime' | 'whoosh' | 'riser' | 'boom'; volume?: number }> = ({ at, name, volume = 0.5 }) => (
  <Sequence from={Math.max(0, at)} durationInFrames={60} name={`sfx ${name}`} layout="none">
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);
