import React from 'react';
import { AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Burst, C, FONT, GRADIENTS, Kinetic, Orb, Rays, Sfx, ShinyImage, ease } from './theme';
import type { TimedScene } from './timeline';

type P = { t: TimedScene };

const useSpring = (start: number, damping = 12, stiffness = 140) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - start, fps, config: { damping, stiffness, mass: 0.8 } });
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ───────────────────────── Designed planets (same art + copy as the app's LocalCatalog) ─────────────────────────
type PlanetDef = { file: string; name: string; desc: string; color: string };
const PL: Record<string, PlanetDef> = {
  stories: { file: 'planet-stories', name: 'كوكب القصص', desc: 'حكايات دافئة قبل النوم وفي كل وقت', color: '#9D68FF' },
  numbers: { file: 'planet-numbers', name: 'كوكب الأرقام', desc: 'ألغاز وعدّ ومغامرات منطقية', color: '#FFB52E' },
  science: { file: 'planet-science', name: 'كوكب العلوم', desc: 'اكتشافات وتجارب آمنة من حولنا', color: '#32C979' },
  abjad: { file: 'planet-abjad', name: 'كوكب أبجد', desc: 'حروف وكلمات وحكايات عربية ممتعة', color: '#2580FF' },
  values: { file: 'planet-values-islamic', name: 'كوكب القيم', desc: 'مواقف تساعدنا أن نختار بلطف وحكمة', color: '#FF6FAE' },
  alam: { file: 'planet-alamna', name: 'عالمنا', desc: '', color: '#6A3DF2' },
  maharat: { file: 'planet-maharat', name: 'كوكب المهارات', desc: '', color: '#00BFA6' },
  tarikh: { file: 'planet-tarikh', name: 'كوكب التاريخ', desc: '', color: '#D9903D' },
  iman: { file: 'planet-iman', name: 'كوكب الإيمان', desc: '', color: '#2FBF8F' },
};
const planetSrc = (k: string) => staticFile(`planets3d/${PL[k].file}.png`);
const ALL = ['abjad', 'numbers', 'science', 'values', 'stories', 'alam', 'maharat', 'tarikh', 'iman'];

/** Planets on a tilted 3D ellipse; items behind the centre are smaller/darker. */
const Galaxy: React.FC<{
  keys: string[]; cx: number; cy: number; rx: number; ry: number; size: number; speed?: number;
  enterAt?: number; stagger?: number; front?: React.ReactNode;
}> = ({ keys, cx, cy, rx, ry, size, speed = 1 / 150, enterAt = 0, stagger = 3, front }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = keys.map((k, i) => {
    const a = (i / keys.length) * Math.PI * 2 + f * speed;
    const depth = Math.sin(a); // -1 back … 1 front
    const p = spring({ frame: f - enterAt - i * stagger, fps, config: { damping: 14, stiffness: 110 } });
    const scale = (0.55 + 0.45 * (depth + 1) / 2) * p;
    const fromX = cx + Math.cos(a) * rx * 3, fromY = cy - 900;
    const x = interpolate(p, [0, 1], [fromX, cx + Math.cos(a) * rx]);
    const y = interpolate(p, [0, 1], [fromY, cy + depth * ry]);
    return { k, x, y, scale, depth, o: clamp01(p * 1.4) * (0.55 + 0.45 * (depth + 1) / 2) };
  });
  const render = (list: typeof items) => list.map((it) => (
    <Img key={it.k} src={planetSrc(it.k)} style={{
      position: 'absolute', left: it.x - size / 2, top: it.y - size / 2 + Math.sin(f / 15 + it.depth) * 6, width: size, height: size,
      transform: `scale(${it.scale})`, opacity: it.o, filter: `brightness(${0.6 + 0.4 * (it.depth + 1) / 2}) drop-shadow(0 0 22px ${PL[it.k].color}88)`,
    }} />
  ));
  return (
    <>
      {render(items.filter((i) => i.depth < 0))}
      {front}
      {render(items.filter((i) => i.depth >= 0))}
    </>
  );
};

// ───────────────────────── Icons (simple, license-free SVG) ─────────────────────────
type IconName = 'play' | 'book' | 'audio' | 'game' | 'noads' | 'shield' | 'chart' | 'offline';
const Icon: React.FC<{ name: IconName; size?: number; color?: string }> = ({ name, size = 56, color = C.white }) => {
  const s = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<IconName, React.ReactNode> = {
    play: <path d="M8 5.5v13l11-6.5z" fill={color} stroke="none" />,
    book: <><path {...s} d="M3 5.5c3-1.3 6-1.3 9 .8 3-2.1 6-2.1 9-.8v13c-3-1.3-6-1.3-9 .8-3-2.1-6-2.1-9-.8z" /><path {...s} d="M12 6.3v13" /></>,
    audio: <><path {...s} d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect {...s} x="3" y="13" width="4.5" height="7" rx="1.8" /><rect {...s} x="16.5" y="13" width="4.5" height="7" rx="1.8" /></>,
    game: <><rect {...s} x="2.5" y="7" width="19" height="11" rx="5" /><path {...s} d="M7.5 10.5v4M5.5 12.5h4" /><circle cx="15.5" cy="11.5" r="1.2" fill={color} /><circle cx="18" cy="13.8" r="1.2" fill={color} /></>,
    noads: <><rect {...s} x="3" y="6" width="18" height="12" rx="3" /><path {...s} d="M4 20 20 4" /></>,
    shield: <><path {...s} d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6z" /><path {...s} d="m9 12 2.2 2.2L15.5 10" /></>,
    chart: <><path {...s} d="M4 20V4M4 20h16" /><path {...s} d="M8 16v-4M12 16V8M16 16v-6" /></>,
    offline: <><path {...s} d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path {...s} d="M5 19.5h14" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24">{paths[name]}</svg>;
};

// ───────────────────────── 1. Hook ─────────────────────────
export const HookScene: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const [b0, b1] = t.beats;
  const phone = useSpring(0, 14);
  const lit = ease(f, b1, b1 + 14); // screen "lights up" into a journey
  const zoomOut = ease(f, t.durationInFrames - 16, t.durationInFrames);
  const PW = 520, PH = 980, cx = 540, cy = 1130;
  return (
    <AbsoluteFill>
      <Kinetic text="وقتُ الشاشة..." top={250} size={100} start={b0} stagger={6} />
      <Kinetic text="رحلةُ تعلُّم؟" top={390} size={124} start={b1} stagger={6} gradient={GRADIENTS.button} />
      <div style={{ position: 'absolute', left: cx - PW / 2, top: cy - PH / 2, width: PW, height: PH, borderRadius: 76, overflow: 'hidden',
        border: '7px solid rgba(242,246,255,0.9)', transform: `scale(${phone * (1 + zoomOut * 1.8)}) rotate(${(1 - phone) * -8}deg)`,
        boxShadow: `0 0 ${40 + 90 * lit}px rgba(0,214,245,${0.3 + 0.4 * lit}), 0 40px 120px rgba(0,0,0,0.6)`, background: '#05070f' }}>
        {/* before: grey flickering static = aimless screen time */}
        <AbsoluteFill style={{ opacity: 1 - lit }}>
          {Array.from({ length: 26 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: random(`n${i}${Math.floor(f / 2)}`) * PH, height: 4 + random(`h${i}`) * 26,
              background: `rgba(170,181,209,${0.05 + random(`o${i}${Math.floor(f / 2)}`) * 0.18})` }} />
          ))}
        </AbsoluteFill>
        {/* after: the screen becomes space with the app's planets */}
        <AbsoluteFill style={{ opacity: lit, background: GRADIENTS.space }}>
          <Rays x={PW / 2} y={PH / 2} size={900} color="rgba(0,214,245,0.14)" />
          <div style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH, transform: `scale(${0.6 + 0.4 * lit})` }}>
            <Galaxy keys={['stories', 'numbers', 'science', 'abjad', 'values']} cx={PW / 2} cy={PH / 2} rx={150} ry={280} size={290} speed={1 / 40} enterAt={b1} stagger={2} />
          </div>
        </AbsoluteFill>
      </div>
      <Burst at={b1} x={cx} y={cy} radius={620} seed="hook" />
      <Sfx at={b1} name="chime" volume={0.4} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 2. Problem ─────────────────────────
const NOISE = [
  { label: 'إعلان', x: 110, y: 470, r: -8 },
  { label: 'تشغيل تلقائي', x: 630, y: 430, r: 6 },
  { label: 'فيديو عشوائي', x: 150, y: 780, r: 5 },
  { label: 'إعلان', x: 650, y: 760, r: -5 },
  { label: 'محتوى غير مناسب', x: 120, y: 1090, r: -4 },
  { label: 'إعلان', x: 660, y: 1070, r: 9 },
  { label: 'تخطَّ الإعلان ٥', x: 380, y: 1330, r: -3 },
];
export const ProblemScene: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const blast = t.beats[4];
  const wave = ease(f, blast, blast + 20);
  return (
    <AbsoluteFill>
      {NOISE.map((n, i) => {
        const appear = t.beats[Math.min(3, Math.floor(i / 2))] + (i % 2) * 5;
        const inP = ease(f, appear, appear + 8);
        const cxCard = n.x + 160, cyCard = n.y + 100;
        const dx = cxCard - 540, dy = cyCard - 960, len = Math.hypot(dx, dy) || 1;
        const push = wave * 900;
        const glitch = f % 7 === i % 7 ? (random(`g${i}${f}`) - 0.5) * 30 : 0;
        const jitter = Math.sin(f * 1.7 + i) * 5 * (1 - wave);
        return (
          <div key={i} style={{
            position: 'absolute', left: n.x + (dx / len) * push + glitch, top: n.y + (dy / len) * push, width: 320, height: 200, borderRadius: 26,
            background: 'rgba(52,58,90,0.9)', border: '2px solid rgba(170,181,209,0.35)',
            transform: `rotate(${n.r + jitter + wave * 90 * (i % 2 ? 1 : -1)}deg) scale(${inP * (1 - wave * 0.5)})`, opacity: inP * (1 - wave),
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10,
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          }}>
            <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="play" size={40} color={C.gray} />
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 36, color: C.white,
              textShadow: `${3 + glitch / 6}px 0 rgba(255,60,120,0.8), ${-3 - glitch / 6}px 0 rgba(0,214,245,0.8)` }}>{n.label}</div>
            {n.label.startsWith('إعلان') || n.label.startsWith('تخط') ? (
              <div style={{ position: 'absolute', top: 14, left: 14, padding: '2px 12px', borderRadius: 8, background: '#FFB52E', color: C.textOnYellow,
                fontFamily: FONT, fontWeight: 700, fontSize: 22 }}>AD</div>
            ) : null}
          </div>
        );
      })}
      {/* cosmic shockwave that clears the noise */}
      <div style={{ display: f < blast ? 'none' : 'block', position: 'absolute', left: 540 - 1400 * wave, top: 960 - 1400 * wave, width: 2800 * wave, height: 2800 * wave, borderRadius: '50%',
        border: `${30 * (1 - wave) + 4}px solid transparent`, backgroundImage: `linear-gradient(#0000, #0000), ${GRADIENTS.orbit}`,
        backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box', opacity: 1 - wave, filter: 'blur(2px)' }} />
      <Kinetic text="وداعًا للعشوائية" top={880} size={112} start={blast + 6} stagger={5} />
      <Sfx at={blast} name="boom" volume={0.7} />
      <Sfx at={t.durationInFrames - 40} name="riser" volume={0.6} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 3. Logo reveal ─────────────────────────
export const LogoScene: React.FC<P> = () => {
  const f = useCurrentFrame();
  const pop = useSpring(3, 9, 150);
  return (
    <AbsoluteFill>
      <Rays x={540} y={860} size={1700} opacity={ease(f, 0, 15)} />
      <div style={{ position: 'absolute', left: 540 - 600, top: 860 - 600, width: 1200, height: 1200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,211,77,0.35), rgba(106,61,242,0.2) 40%, transparent 68%)', transform: `scale(${0.4 + 0.6 * pop})` }} />
      <svg width={1080} height={1920} style={{ position: 'absolute', opacity: pop }}>
        <defs>
          <linearGradient id="orb" x1="0" x2="1"><stop offset="0" stopColor={C.cyan} /><stop offset="0.5" stopColor={C.purple} /><stop offset="1" stopColor={C.coral} /></linearGradient>
        </defs>
        <g transform="rotate(-16 540 860)">
          <ellipse cx={540} cy={860} rx={470} ry={150} fill="none" stroke="url(#orb)" strokeWidth={7} strokeDasharray="34 16" strokeDashoffset={-f * 4} />
          <circle cx={540 + 470 * Math.cos(f / 9)} cy={860 + 150 * Math.sin(f / 9)} r={16} fill={C.yellow} style={{ filter: 'drop-shadow(0 0 14px #FFD34D)' }} />
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 540 - 400, top: 860 - 400, perspective: 1200 }}>
        <div style={{ transform: `scale(${pop}) rotateY(${(1 - pop) * 70}deg)` }}>
          <ShinyImage src={staticFile('brand/logo.png')} width={800} sweepAt={18} />
        </div>
      </div>
      <Burst at={4} x={540} y={860} count={48} radius={700} seed="logo" />
      <Kinetic text="عالمُ الطفلِ العربيِّ للتعلُّمِ والمرح" top={1370} size={56} start={24} stagger={3} color={C.gray} weight={600} />
      <Sfx at={2} name="boom" volume={0.6} />
      <Sfx at={8} name="chime" volume={0.45} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 4. Planets ─────────────────────────
const HEROES = ['stories', 'numbers', 'science', 'abjad', 'values'];
export const PlanetsScene: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = t.beats; // 0-4 heroes, 5 galaxy, 6 age badge, 7 tracks
  const galaxy = ease(f, b[5] - 4, b[5] + 10);
  const badge = spring({ frame: f - b[6], fps, config: { damping: 10 } });
  return (
    <AbsoluteFill>
      {/* Hero montage: each named planet flies in, then zooms past the camera. */}
      {HEROES.map((k, i) => {
        const s = b[i];
        const e = i < HEROES.length - 1 ? b[i + 1] : b[5];
        if (f < s - 2 || f > e + 12) return null;
        const p = spring({ frame: f - s, fps, config: { damping: 13, stiffness: 120 } });
        const out = ease(f, e - 3, e + 10);
        const pl = PL[k];
        const txt = ease(f, s + 3, s + 12) * (1 - out);
        return (
          <AbsoluteFill key={k}>
            <div style={{ position: 'absolute', left: 540 - 700, top: 820 - 700, width: 1400, height: 1400, borderRadius: '50%',
              background: `radial-gradient(circle, ${pl.color}55, transparent 62%)`, opacity: p * (1 - out) }} />
            <Rays x={540} y={820} size={1500} color={`${pl.color}30`} opacity={p * (1 - out)} />
            <Img src={planetSrc(k)} style={{
              position: 'absolute', left: 540 - 400, top: 820 - 400, width: 800, height: 800,
              transform: `translateY(${(1 - p) * 500 + Math.sin(f / 10) * 10}px) scale(${(0.3 + 0.7 * p) * (1 + out * 2.2)}) rotate(${(1 - p) * -30 + (f - s) * 0.25}deg)`,
              opacity: clamp01(p * 2) * (1 - out), filter: `drop-shadow(0 0 50px ${pl.color}aa) blur(${out * 12}px)`,
            }} />
            <div style={{ position: 'absolute', top: 1290, left: 40, right: 40, textAlign: 'center', opacity: txt, transform: `translateY(${(1 - txt) * 40}px)` }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 118, color: pl.color, textShadow: `0 0 40px ${pl.color}88, 0 6px 20px rgba(0,0,0,0.6)` }}>{pl.name}</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 48, color: C.white, marginTop: 6, opacity: 0.92 }}>{pl.desc}</div>
            </div>
            <Burst at={s + 2} x={540} y={820} count={22} radius={520} colors={[pl.color, C.white, C.yellow]} seed={k} />
            <Sfx at={s} name="pop" volume={0.45} />
          </AbsoluteFill>
        );
      })}

      {/* Galaxy: all the app's planets orbit the age badge. */}
      <AbsoluteFill style={{ opacity: galaxy }}>
        <Kinetic text="لكلِّ عمرٍ رحلتُه" top={260} size={104} start={b[5]} stagger={5} />
        <Galaxy keys={ALL} cx={540} cy={1000} rx={430} ry={170} size={250} enterAt={b[5]} stagger={2}
          front={
            <div style={{ position: 'absolute', left: 540 - 190, top: 1000 - 125, width: 380, height: 250, borderRadius: 48,
              background: GRADIENTS.purpleCard, border: '3px solid rgba(255,211,77,0.7)', transform: `scale(${badge})`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(255,211,77,0.45), 0 0 70px rgba(255,211,77,0.25)' }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 104, color: C.yellow, lineHeight: 1.05 }}>٣–١٢</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 48, color: C.white }}>سنة</div>
            </div>
          } />
        <Burst at={b[6]} x={540} y={1000} count={40} radius={620} seed="age" />
        <div style={{ position: 'absolute', top: 1420, left: 40, right: 40, display: 'flex', justifyContent: 'center', gap: 20 }}>
          {[['البراعم', '٣–٥'], ['المستكشفون', '٦–٨'], ['الروّاد', '٩–١٢']].map(([n, a], i) => {
            const p = spring({ frame: f - b[6] - 6 - i * 6, fps, config: { damping: 12 } });
            return (
              <div key={n} style={{ padding: '16px 26px', borderRadius: 30, background: 'rgba(22,31,69,0.85)', border: `2px solid ${[C.yellow, C.cyan, C.purple][i]}`,
                transform: `scale(${p}) translateY(${(1 - p) * 30}px)`, textAlign: 'center', minWidth: 250 }}>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 42, color: C.white }}>{n}</div>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 34, color: [C.yellow, C.cyan, '#B79BFF'][i] }}>{a} سنوات</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <Sfx at={b[5]} name="whoosh" volume={0.35} />
      <Sfx at={b[6]} name="chime" volume={0.4} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 5. Formats (app library mock) ─────────────────────────
const ROWS = [
  ['adventures-of-numbers', 'bedtime-stories', 'junior-robo-codes', 'kids-explorers-adventures', 'hekaya-wa-hikma', 'try-it-at-home', 'preschool-count-with-me'],
  ['junior-science-in-a-minute', 'abni-kalima', 'qiyami-alsaghira', 'ashyaa-laha-hikaya', 'junior-future-lab', 'preschool-colors-around-us', 'aalami-akbar'],
  ['preschool-luna-discovers-words', 'mawaqif-wa-qararat', 'al-arqam-fi-hayati', 'junior-journey-civilizations', 'ufakkir-khutwa-khutwa', 'alahiz-wa-ataajjab', 'qisas-min-alhayat'],
];
const CHIPS: { label: string; icon: IconName; color: string; x: number; y: number }[] = [
  { label: 'شاهِد', icon: 'play', color: C.purple, x: 850, y: 470 },
  { label: 'اقرأ', icon: 'book', color: C.blue, x: 230, y: 760 },
  { label: 'استمع', icon: 'audio', color: C.coral, x: 850, y: 1060 },
  { label: 'العب', icon: 'game', color: C.orange, x: 230, y: 1350 },
];
export const FormatsScene: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = spring({ frame: f, fps, config: { damping: 15 } });
  const PW = 560, PH = 1060, PX = 540 - PW / 2, PY = 360;
  const posterW = 180, posterH = 240, gap = 16;
  const journey = ease(f, t.beats[4] - 4, t.beats[4] + 22);
  const pathD = `M ${CHIPS.map((c) => `${c.x} ${c.y}`).join(' L ')}`;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, perspective: 1800 }}>
        <div style={{ position: 'absolute', left: PX, top: PY, width: PW, height: PH, borderRadius: 64, overflow: 'hidden',
          background: C.midnight, border: '8px solid #2B3767',
          transform: `translateY(${(1 - phone) * 500}px) rotateY(${-28 + 18 * phone + Math.sin(f / 30) * 4}deg) rotateX(${6}deg)`,
          boxShadow: '0 40px 140px rgba(0,0,0,0.7), 0 0 70px rgba(0,214,245,0.3)' }}>
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '26px 30px 0', background: '#101735' }}>
            <Img src={staticFile('brand/logo.png')} style={{ height: 90 }} />
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 32, color: C.white }}>مكتبتي</div>
          </div>
          {ROWS.map((row, r) => {
            const half = (posterW + gap) * row.length;
            const shift = (f * (2.2 + r * 0.6)) % half;
            const x = r % 2 ? -shift : -half + shift;
            return (
              <div key={r} style={{ marginTop: 26, height: posterH + 42, position: 'relative' }}>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 27, color: C.gray, padding: '0 30px 8px' }}>
                  {['برامج مميزة', 'اكتشف وتعلّم', 'قصص وحكايات'][r]}
                </div>
                <div style={{ position: 'absolute', top: 42, left: 0, direction: 'ltr', display: 'flex', gap, transform: `translateX(${x}px)` }}>
                  {[...row, ...row].map((id, i) => (
                    <Img key={i} src={staticFile(`posters/${id}.webp`)} style={{ width: posterW, height: posterH, objectFit: 'cover', borderRadius: 20, border: '2px solid rgba(255,255,255,0.08)' }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* the "one journey" path linking every format */}
      <svg width={1080} height={1920} style={{ position: 'absolute' }}>
        <path d={pathD} fill="none" stroke={C.yellow} strokeWidth={8} strokeLinecap="round"
          pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 1 - journey, filter: 'drop-shadow(0 0 12px #FFD34D)' }} />
      </svg>
      {CHIPS.map((c, i) => {
        const s = t.beats[i];
        const p = spring({ frame: f - s, fps, config: { damping: 11, stiffness: 150 } });
        const x = interpolate(p, [0, 1], [540, c.x]), y = interpolate(p, [0, 1], [900, c.y]);
        const glow = journey > (i + 0.5) / CHIPS.length ? 1 : 0.5;
        return (
          <React.Fragment key={c.label}>
            <div style={{ position: 'absolute', left: x - 125, top: y - 105, width: 250, height: 210, borderRadius: 38,
              background: 'rgba(22,31,69,0.9)', border: `3px solid ${c.color}`, transform: `scale(${p})`,
              boxShadow: `0 0 ${30 + 40 * glow}px ${c.color}${glow === 1 ? 'cc' : '66'}, 0 20px 50px rgba(0,0,0,0.5)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 92, height: 92, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: `scale(${1 + 0.12 * Math.max(0, Math.sin((f - s) / 4)) * (f - s < 20 ? 1 : 0)})` }}>
                <Icon name={c.icon} size={56} />
              </div>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 48, color: C.white }}>{c.label}</div>
            </div>
            <Sfx at={s} name="pop" volume={0.5} />
          </React.Fragment>
        );
      })}
      <Kinetic text="في رحلةٍ واحدة" top={1560} size={96} start={t.beats[4]} stagger={5} gradient={GRADIENTS.button} />
      <Sfx at={t.beats[4]} name="chime" volume={0.35} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 6. Characters (gated) ─────────────────────────
// Images must match the approved Character Sheet (src/CharacterSheet.tsx).
const FRIENDS = [
  { id: 'zaina-front', name: 'زينة', glow: 'rgba(106,61,242,0.8)', x: 300, y: 950 },
  { id: 'yaseen-front', name: 'ياسين', glow: 'rgba(40,86,216,0.85)', x: 780, y: 950 },
];
export const CharactersScene: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Kinetic text="أصدقاءُ في كلِّ مغامرة" top={330} size={96} start={t.beats[0]} stagger={5} />
      {FRIENDS.map((c, i) => {
        const s = t.beats[1] - 18 + i * 10;
        const pop = spring({ frame: f - s, fps, config: { damping: 9, stiffness: 140 } });
        const bob = Math.sin(f / 12 + i * 2) * 10;
        return (
          <React.Fragment key={c.id}>
            <Rays x={c.x} y={c.y} size={700} color={c.glow.replace('0.8', '0.18').replace('0.85', '0.18')} opacity={pop} />
            <div style={{ position: 'absolute', left: c.x - 200, top: c.y - 200 + bob, width: 400, transform: `scale(${pop})`,
              display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Orb src={staticFile(`characters/${c.id}.png`)} size={400} glow={c.glow} zoom={1.0} />
              <div style={{ marginTop: 18, padding: '8px 34px', borderRadius: 40, background: C.card, border: `2px solid ${C.border}`,
                fontFamily: FONT, fontWeight: 700, fontSize: 44, color: C.white }}>{c.name}</div>
            </div>
            <Burst at={s + 3} x={c.x} y={c.y} count={20} radius={360} seed={c.id} />
            <Sfx at={s} name="pop" volume={0.5} />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ───────────────────────── 7. Parents ─────────────────────────
const TRUST: { label: string; icon: IconName; color: string }[] = [
  { label: 'بلا إعلانات', icon: 'noads', color: C.coral },
  { label: 'رقابة أبويّة', icon: 'shield', color: C.blue },
  { label: 'تقارير تعلُّم', icon: 'chart', color: C.purple },
  { label: 'مشاهدة بلا إنترنت', icon: 'offline', color: '#00BFA6' },
];
export const ParentsScene: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 540 - 520, top: 1020 - 560, opacity: 0.1 + 0.04 * Math.sin(f / 10), transform: `scale(${1 + 0.02 * Math.sin(f / 10)})` }}>
        <Icon name="shield" size={1040} color={C.cyan} />
      </div>
      <Kinetic text="راحةُ بالٍ للأهل" top={280} size={104} start={0} stagger={5} />
      {TRUST.map((c, i) => {
        const s = t.beats[i];
        const inP = spring({ frame: f - s, fps, config: { damping: 14, stiffness: 130 } });
        const check = ease(f, s + 8, s + 20);
        const sweep = interpolate(f, [s + 10, s + 30], [-0.3, 1.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <React.Fragment key={c.label}>
            <div style={{ position: 'absolute', left: 80, right: 80, top: 540 + i * 255, height: 210, borderRadius: 44, overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(29,40,85,0.92), rgba(22,31,69,0.92))', border: `2px solid ${c.color}88`,
              display: 'flex', alignItems: 'center', gap: 34, padding: '0 40px',
              transform: `translateX(${(1 - inP) * 900}px) rotate(${(1 - inP) * 4}deg)`, opacity: clamp01(inP * 1.5),
              boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${c.color}33` }}>
              <div style={{ width: 126, height: 126, borderRadius: 34, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: `0 0 30px ${c.color}aa` }}>
                <Icon name={c.icon} size={74} />
              </div>
              <div style={{ flex: 1, fontFamily: FONT, fontWeight: 700, fontSize: 58, color: C.white }}>{c.label}</div>
              <svg width={92} height={92} viewBox="0 0 92 92">
                <circle cx={46} cy={46} r={42} fill={C.green} opacity={check} style={{ filter: `drop-shadow(0 0 14px ${C.green})` }} />
                <path d="M26 47 l13 13 l27 -28" fill="none" stroke={C.textOnYellow} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round"
                  pathLength={1} strokeDasharray={1} strokeDashoffset={1 - check} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(110deg, transparent ${sweep * 100 - 10}%, rgba(255,255,255,0.18) ${sweep * 100}%, transparent ${sweep * 100 + 10}%)` }} />
            </div>
            <Sfx at={s + 8} name="pop" volume={0.4} />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ───────────────────────── 8. CTA ─────────────────────────
export const CtaScene: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [b0, b1, b2, b3] = t.beats;
  const logo = spring({ frame: f - b0, fps, config: { damping: 11 } });
  const btn = spring({ frame: f - b3, fps, config: { damping: 9 } });
  const pulse = f > b3 + 15 ? 1 + 0.035 * Math.sin((f - b3) / 5) : 1;
  const shimmer = ((f - b3) % 45) / 45;
  return (
    <AbsoluteFill>
      <Rays x={540} y={560} size={1500} color="rgba(0,214,245,0.12)" opacity={logo} />
      <Galaxy keys={ALL} cx={540} cy={560} rx={460} ry={140} size={170} speed={1 / 90} enterAt={b0} stagger={2}
        front={
          <div style={{ position: 'absolute', left: 540 - 320, top: 560 - 320, transform: `scale(${logo})` }}>
            <ShinyImage src={staticFile('brand/logo.png')} width={640} sweepAt={b0 + 16} />
          </div>
        } />
      <Kinetic text="يكتشفُ العالم…" top={960} size={84} start={b1} stagger={5} />
      <Kinetic text="ويحافظُ على لغتِه وقيمِه" top={1075} size={84} start={b2} stagger={4} gradient={GRADIENTS.orbit} />
      <Burst at={b3} x={540} y={1390} count={40} radius={560} seed="cta" />
      <div style={{ position: 'absolute', left: 540 - 340, top: 1315, width: 680, height: 156, borderRadius: 80, background: GRADIENTS.button, overflow: 'hidden',
        transform: `scale(${btn * pulse})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 16px rgba(255,211,77,0.45), 0 0 70px rgba(255,211,77,0.4)',
        fontFamily: FONT, fontWeight: 700, fontSize: 64, color: C.textOnYellow }}>
        حمِّل مجرّة الآن
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(110deg, transparent ${shimmer * 140 - 30}%, rgba(255,255,255,0.65) ${shimmer * 140 - 20}%, transparent ${shimmer * 140 - 10}%)` }} />
      </div>
      <div style={{ position: 'absolute', top: 1520, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 24, direction: 'ltr',
        opacity: ease(f, b3 + 8, b3 + 22), transform: `translateY(${(1 - ease(f, b3 + 8, b3 + 22)) * 20}px)` }}>
        {['App Store', 'Google Play'].map((s) => (
          <div key={s} style={{ padding: '14px 36px', borderRadius: 22, background: 'rgba(255,255,255,0.06)', border: '2px solid #3B4878',
            fontFamily: FONT, fontWeight: 600, fontSize: 38, color: C.white }}>{s}</div>
        ))}
      </div>
      <Sfx at={b3} name="chime" volume={0.5} />
    </AbsoluteFill>
  );
};
