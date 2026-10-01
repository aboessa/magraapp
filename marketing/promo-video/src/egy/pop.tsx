import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from '../theme';

// "Pop sticker" look for the Egyptian cut: flat brand colours, thick ink
// outlines, hard offset shadows, halftone dots. Deliberately the opposite of
// the glowing dark-space look of the MSA ads.
export const INK = C.textOnYellow; // #10162F
export const POP = {
  yellow: C.yellow, coral: C.coral, blue: C.blue, purple: C.purple, cyan: C.cyan, orange: C.orange,
  green: C.green, white: '#FFFFFF', paper: '#FFF7E0', gray: '#8A90A6', magenta: C.magenta,
};

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lin = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
export const outCubic = (f: number, a: number, b: number) => 1 - Math.pow(1 - lin(f, a, b), 3);
export const useSpr = (at: number, damping = 10, stiffness = 200, mass = 0.6) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - at, fps, config: { damping, stiffness, mass } });
};

/** Camera shake that decays after each impact frame. */
export const shakeAt = (f: number, impacts: number[], amp = 22, len = 12) => {
  let x = 0, y = 0, r = 0;
  for (const i of impacts) {
    const d = f - i;
    if (d < 0 || d >= len) continue;
    const k = amp * Math.pow(1 - d / len, 2);
    x += (random(`sx${i}-${f}`) - 0.5) * 2 * k;
    y += (random(`sy${i}-${f}`) - 0.5) * 2 * k;
    r += (random(`sr${i}-${f}`) - 0.5) * 0.12 * k;
  }
  return { x, y, r };
};
export const Shake: React.FC<{ impacts: number[]; amp?: number; children: React.ReactNode }> = ({ impacts, amp, children }) => {
  const f = useCurrentFrame();
  const s = shakeAt(f, impacts, amp);
  return <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) rotate(${s.r}deg)` }}>{children}</AbsoluteFill>;
};

/** Flat colour with drifting halftone dots and optional speed stripes. */
export const PopBg: React.FC<{ color: string; dot?: string; stripes?: boolean; drift?: number }> = ({ color, dot = 'rgba(16,22,47,0.12)', stripes, drift = 1 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: color }}>
      <AbsoluteFill style={{
        backgroundImage: `radial-gradient(${dot} 24%, transparent 26%)`, backgroundSize: '38px 38px',
        backgroundPosition: `${f * 1.2 * drift}px ${f * 0.8 * drift}px`,
        WebkitMaskImage: 'linear-gradient(160deg, black 0%, transparent 45%, transparent 60%, black 100%)',
      }} />
      {stripes ? (
        <AbsoluteFill style={{
          backgroundImage: `repeating-linear-gradient(-28deg, rgba(255,255,255,0.10) 0 26px, transparent 26px 120px)`,
          backgroundPosition: `${-f * 14}px 0`,
        }} />
      ) : null}
    </AbsoluteFill>
  );
};

/** Rotating flat sunburst (hard-edged, no glow). */
export const Sunburst: React.FC<{ a: string; b: string; speed?: number; x?: string; y?: string }> = ({ a, b, speed = 0.8, x = '50%', y = '50%' }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: `repeating-conic-gradient(from ${f * speed}deg at ${x} ${y}, ${a} 0deg 12deg, ${b} 12deg 24deg)` }} />;
};

export const inkText = (size: number, color: string, stroke = Math.max(6, size * 0.075), shadow = Math.max(6, size * 0.06)): React.CSSProperties => ({
  fontFamily: FONT, fontWeight: 700, fontSize: size, lineHeight: 1.25, color,
  WebkitTextStroke: `${stroke}px ${INK}`, paintOrder: 'stroke fill',
  textShadow: `${shadow}px ${shadow}px 0 ${INK}`,
  direction: 'rtl', whiteSpace: 'nowrap',
});

/**
 * A word that "stamps" onto the screen: appears oversized and slams down to
 * size with an overshoot. No fade: pop motion is about hard hits.
 */
export const Stamp: React.FC<{
  text: string; at: number; top: number; size?: number; color?: string; rot?: number; left?: number; right?: number;
  exitAt?: number; exit?: 'up' | 'down' | 'pop'; tape?: string; center?: boolean;
}> = ({ text, at, top, size = 150, color = POP.white, rot = 0, exitAt, exit = 'up', tape, left = 0, right = 0 }) => {
  const f = useCurrentFrame();
  const p = useSpr(at, 9, 260, 0.55);
  if (f < at) return null;
  const scale = interpolate(p, [0, 1], [2.6, 1]);
  const blur = f - at < 2 ? 6 : 0;
  const ex = exitAt === undefined ? 0 : outCubic(f, exitAt, exitAt + 8);
  const exT = exit === 'up' ? `translateY(${-ex * 700}px)` : exit === 'down' ? `translateY(${ex * 1400}px)` : `scale(${1 - ex})`;
  return (
    <div style={{ position: 'absolute', top, left, right, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{
        transform: `${exT} rotate(${rot + (1 - p) * rot * 2}deg) scale(${scale})`, filter: blur ? `blur(${blur}px)` : undefined,
        ...(tape ? { background: tape, padding: `${size * 0.08}px ${size * 0.3}px`, border: `6px solid ${INK}`, borderRadius: 18, boxShadow: `12px 12px 0 ${INK}` } : {}),
      }}>
        <span style={tape ? { fontFamily: FONT, fontWeight: 700, fontSize: size, color: INK, direction: 'rtl', whiteSpace: 'nowrap', lineHeight: 1.3 } : inkText(size, color)}>{text}</span>
      </div>
    </div>
  );
};

/** Poster "sticker": thick white border, ink shadow, cropped to the artwork. */
export const Sticker: React.FC<{ src: string; w: number; h: number; pos?: string; style?: React.CSSProperties }> = ({ src, w, h, pos = '50% 80%', style }) => (
  <div style={{ width: w, height: h, borderRadius: 34, border: `14px solid ${POP.white}`, outline: `6px solid ${INK}`,
    boxShadow: `18px 18px 0 ${INK}`, overflow: 'hidden', background: POP.white, ...style }}>
    <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, display: 'block' }} />
  </div>
);

/** Flat confetti burst (triangles, squiggles, dots) from a point. */
export const Confetti: React.FC<{ at: number; x: number; y: number; count?: number; radius?: number; seed?: string }> = ({ at, x, y, count = 34, radius = 700, seed = 'c' }) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > 40) return null;
  const p = 1 - Math.pow(1 - f / 40, 2.4);
  const cols = [POP.yellow, POP.coral, POP.cyan, POP.white, POP.green, POP.orange];
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2 + random(`${seed}a${i}`) * 0.5;
        const d = radius * (0.45 + random(`${seed}d${i}`) * 0.7) * p;
        const s = 22 + random(`${seed}s${i}`) * 26;
        const kind = i % 3;
        const gravity = f * f * 0.35;
        return (
          <div key={i} style={{
            position: 'absolute', left: x + Math.cos(a) * d - s / 2, top: y + Math.sin(a) * d - s / 2 + gravity,
            width: s, height: kind === 1 ? s * 0.4 : s, background: cols[i % cols.length], border: `4px solid ${INK}`,
            borderRadius: kind === 2 ? '50%' : 6, clipPath: kind === 0 ? 'polygon(50% 0, 100% 100%, 0 100%)' : undefined,
            transform: `rotate(${f * (10 + i)}deg)`, opacity: 1 - lin(f, 28, 40),
          }} />
        );
      })}
    </>
  );
};

/** Expanding ink rings (shockwave) at an impact. */
export const Rings: React.FC<{ at: number; x: number; y: number; color?: string }> = ({ at, x, y, color = POP.white }) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > 24) return null;
  return (
    <>
      {[0, 5].map((d) => {
        const p = outCubic(f, d, d + 18);
        const r = 80 + p * 900;
        return <div key={d} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%',
          border: `${Math.max(0, 26 * (1 - p))}px solid ${color}`, boxShadow: `0 0 0 ${Math.max(0, 8 * (1 - p))}px ${INK}`, opacity: f >= d ? 1 : 0 }} />;
      })}
    </>
  );
};

/** Simple flat phone: ink frame, custom screen content. */
export const Phone: React.FC<{ w: number; h: number; children: React.ReactNode; style?: React.CSSProperties; screen?: string }> = ({ w, h, children, style, screen = '#222838' }) => (
  <div style={{ position: 'absolute', width: w, height: h, borderRadius: w * 0.16, background: INK, padding: w * 0.045, boxShadow: `22px 22px 0 rgba(16,22,47,0.35)`, ...style }}>
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: w * 0.12, overflow: 'hidden', background: screen }}>
      {children}
      <div style={{ position: 'absolute', top: 16, left: '50%', width: w * 0.28, height: 30, marginLeft: -w * 0.14, borderRadius: 20, background: INK }} />
    </div>
  </div>
);

export type PopSfx = 'stamp' | 'swish' | 'glitch' | 'tick' | 'impact' | 'pop' | 'riser' | 'chime';
export const Sfx: React.FC<{ at: number; name: PopSfx; volume?: number }> = ({ at, name, volume = 0.5 }) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={50} name={`sfx ${name}`} layout="none">
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);

export const toArabicDigits = (n: number | string) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

/** Clip-path wipes used on scene entry (the previous scene stays underneath). */
export type Wipe = 'none' | 'slash' | 'iris' | 'whip' | 'bars';
export const wipeClip = (kind: Wipe, p: number): string | undefined => {
  if (kind === 'none' || p >= 1) return undefined;
  if (kind === 'iris') return `circle(${p * 120}% at 50% 50%)`;
  if (kind === 'whip') return `inset(0 0 0 ${(1 - p) * 100}%)`;
  if (kind === 'slash') { const a = -40 + p * 180; return `polygon(0 0, ${a + 40}% 0, ${a}% 100%, 0 100%)`; }
  // bars: 6 horizontal bands, each sliding in with a small stagger.
  const n = 6, h = 100 / n, pts: string[] = [];
  for (let k = 0; k < n; k++) {
    const w = clamp01(p * 1.6 - k * 0.12) * 100;
    pts.push(`0 ${k * h}%`, `${w}% ${k * h}%`, `${w}% ${(k + 1) * h}%`, `0 ${(k + 1) * h}%`);
  }
  return `polygon(${pts.join(',')})`;
};
