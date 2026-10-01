import React from 'react';
import { AbsoluteFill, Img, interpolate, interpolateColors, random, staticFile, useCurrentFrame } from 'remotion';
import { FONT } from '../theme';
import {
  Confetti, INK, POP, PopBg, Phone, Rings, Sfx, Shake, Stamp, Sticker, Sunburst, clamp01, inkText, lin, outCubic,
  toArabicDigits, useSpr,
} from './pop';
import { BEAT, type EgyScene } from './timeline';

type P = { t: EgyScene };
const poster = (n: string) => staticFile(`posters/${n}.webp`);

// ───────────────────────── 1. Hook: «ابنك مش راضي يسيب الموبايل؟» ─────────────────────────
export const HookE: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const w = t.words; // ابنك مش راضي يسيب الموبايل؟
  const phone = useSpr(0, 8, 160, 0.8);
  const landed = f > 10;
  // The phone is "clutched": nervous wobble, then a tug up that snaps back.
  const tug = lin(f, 55, 62) - outCubic(f, 62, 74);
  const wob = landed ? Math.sin(f * 0.9) * 3 : 0;
  const impacts = [10, ...w];
  return (
    <AbsoluteFill>
      <PopBg color={POP.yellow} stripes />
      <Shake impacts={impacts} amp={16}>
        <Stamp text="ابنك" at={w[0]} top={170} size={170} color={POP.white} rot={-4} />
        <Stamp text="مش راضي" at={w[1]} top={380} size={170} color={POP.coral} rot={3} />
        <Stamp text="يسيب" at={w[3]} top={590} size={130} color={POP.white} rot={-2} />
        <Stamp text="الموبايل؟" at={w[4]} top={1600} size={150} color={POP.cyan} rot={-3} />
        <Phone w={430} h={800} style={{
          left: 325, top: 820 - tug * 120,
          transform: `translateY(${(1 - phone) * 1200}px) rotate(${(1 - phone) * -25 + wob}deg) scaleY(${1 - tug * 0.06 + (landed ? 0 : 0.1)})`,
        }} screen={POP.coral}>
          {/* hypnotic screen: flashing play buttons */}
          <AbsoluteFill style={{ background: `repeating-radial-gradient(circle at 50% 50%, ${POP.coral} 0 40px, ${POP.magenta} 40px 80px)`, transform: `scale(${1 + (f % 10) / 40})` }} />
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 150, height: 150, margin: -75, borderRadius: '50%', background: POP.white, border: `8px solid ${INK}`,
            transform: `scale(${1 + 0.15 * Math.sin(f * 0.8)})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="70" height="70" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill={INK} /></svg>
          </div>
        </Phone>
        {/* two tiny hands gripping the phone edges */}
        {[300, 750].map((x, i) => (
          <div key={x} style={{ position: 'absolute', left: x - 55, top: 1260 - tug * 120 + (1 - phone) * 1200, width: 110, height: 150, borderRadius: 55,
            background: '#E9A97E', border: `7px solid ${INK}`, transform: `rotate(${i ? -18 : 18}deg) translateY(${Math.sin(f * 0.9 + i) * 4}px)` }} />
        ))}
        {/* tug motion lines */}
        {tug > 0.05 ? [0, 1, 2].map((k) => (
          <div key={k} style={{ position: 'absolute', left: 380 + k * 110, top: 700 - tug * 160, width: 14, height: 90 * tug, borderRadius: 8, background: INK }} />
        )) : null}
      </Shake>
      <Sfx at={8} name="impact" volume={0.5} />
      {w.filter((_, i) => i !== 2).map((x) => <Sfx key={x} at={x} name="stamp" volume={0.35} />)}
      <Sfx at={55} name="swish" volume={0.4} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 2. Flip: «خلاص.. سيبُه! بس بدل الفيديوهات اللي ملهاش لازمة..» ─────────────────────────
const FEED = ['فيديو عشوائي', 'إعلان', 'تشغيل تلقائي', 'فيديو عشوائي', 'إعلان', 'تخطَّ الإعلان', 'تشغيل تلقائي', 'فيديو عشوائي'];
export const FlipE: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const [b0, b1, b2] = t.beats;
  const xAt = t.dur - 30; // big X slash
  const dull = lin(f, b2, b2 + 10);
  const bg = interpolateColors(dull, [0, 1], [POP.coral, POP.gray]);
  const zoom = outCubic(f, b2, b2 + 12);
  const scroll = f < b2 ? 0 : Math.pow(f - b2, 1.6) * 6; // accelerating doom-scroll
  const glitch = f > b2 && random(`gl${Math.floor(f / 2)}`) > 0.72;
  const gx = glitch ? (random(`gx${f}`) - 0.5) * 40 : 0;
  const x1 = lin(f, xAt, xAt + 5), x2 = lin(f, xAt + 4, xAt + 9);
  const crush = outCubic(f, xAt + 9, xAt + 16);
  return (
    <AbsoluteFill>
      <PopBg color={bg} dot={dull > 0.5 ? 'rgba(16,22,47,0.18)' : 'rgba(255,255,255,0.18)'} />
      <Shake impacts={[b0, b1, xAt + 2, xAt + 7]} amp={20}>
        <Stamp text="خلاص.." at={b0} top={200} size={150} color={POP.yellow} rot={-5} exitAt={b2} />
        <Stamp text="سيبُه!" at={b1} top={400} size={210} color={POP.white} rot={4} exitAt={b2 + 2} />
        {/* the phone glides centre-stage and turns into a grey doom-scroll */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
          transform: `translate(${gx}px, ${interpolate(zoom, [0, 1], [260, -40])}px) scale(${interpolate(zoom, [0, 1], [0.8, 1.08]) * (1 - crush * 0.15)}) rotate(${interpolate(zoom, [0, 1], [8, 0]) + crush * -6}deg)` }}>
          <Phone w={520} h={980} style={{ left: 280, top: 560 }} screen="#3A3F52">
            <div style={{ position: 'absolute', left: 0, right: 0, top: -((scroll % 1600)) }}>
              {[...FEED, ...FEED].map((label, i) => (
                <div key={i} style={{ margin: '26px 22px', height: 170, borderRadius: 22, background: i % 2 ? '#5B6178' : '#4A4F63', display: 'flex', alignItems: 'center', gap: 20, padding: '0 26px', direction: 'rtl' }}>
                  <div style={{ width: 80, height: 80, borderRadius: 16, background: '#737A93', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="#A9AFC4" /></svg>
                  </div>
                  <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 40, color: '#C9CEDD' }}>{label}</span>
                </div>
              ))}
            </div>
            {glitch ? <AbsoluteFill style={{ background: 'rgba(255,111,174,0.25)', mixBlendMode: 'screen', transform: `translateX(${-gx}px)` }} /> : null}
          </Phone>
          {/* the big X */}
          <svg width="1080" height="1920" style={{ position: 'absolute', left: 0, top: 0 }}>
            {[[220, 520, 860, 1560, x1], [860, 520, 220, 1560, x2]].map(([ax, ay, bx, by, p], i) => (
              <g key={i}>
                <line x1={ax} y1={ay} x2={ax + (bx - ax) * p} y2={ay + (by - ay) * p} stroke={INK} strokeWidth={120} strokeLinecap="round" opacity={p > 0 ? 1 : 0} />
                <line x1={ax} y1={ay} x2={ax + (bx - ax) * p} y2={ay + (by - ay) * p} stroke={POP.coral} strokeWidth={80} strokeLinecap="round" opacity={p > 0 ? 1 : 0} />
              </g>
            ))}
          </svg>
        </div>
        <Stamp text="فيديوهات ملهاش لازمة" at={b2 + 12} top={1620} size={78} tape={POP.white} rot={-4} />
      </Shake>
      <Sfx at={b0} name="stamp" volume={0.35} />
      <Sfx at={b1} name="stamp" volume={0.45} />
      <Sfx at={b2} name="glitch" volume={0.35} />
      <Sfx at={xAt} name="swish" volume={0.5} />
      <Sfx at={xAt + 4} name="stamp" volume={0.55} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 3. Logo: «خلّيه يدخل مَجَرّة!» ─────────────────────────
export const LogoE: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const [b0, b1] = t.beats;
  const land = useSpr(b1 - 4, 7, 240, 0.7);
  const since = f - b1;
  // squash & stretch on impact
  const squash = since >= 0 && since < 10 ? Math.sin((since / 10) * Math.PI) * Math.exp(-since / 6) : 0;
  const sx = 1 + squash * 0.28, sy = 1 - squash * 0.24;
  const flash = since >= 0 && since < 3 ? 1 - since / 3 : 0;
  return (
    <AbsoluteFill>
      <Sunburst a={POP.purple} b="#5A2FD8" speed={f > b1 ? 1.6 : 0.6} />
      <PopBg color="transparent" dot="rgba(255,255,255,0.12)" />
      <Shake impacts={[b0, b1, b1 + 2]} amp={30}>
        <Stamp text="خلّيه يدخل" at={b0} top={330} size={96} tape={POP.yellow} rot={-4} />
        <Rings at={b1} x={540} y={1060} />
        <Confetti at={b1} x={540} y={1060} radius={820} seed="logo" />
        {f >= b1 - 4 ? (
          <div style={{ position: 'absolute', left: 540 - 420, top: 1060 - 420, width: 840, height: 840,
            transform: `scale(${interpolate(land, [0, 1], [3.2, 1]) * sx}, ${interpolate(land, [0, 1], [3.2, 1]) * sy}) rotate(${(1 - land) * 20 + Math.sin(f / 12) * 2}deg)` }}>
            <Img src={staticFile('brand/logo.png')} style={{ width: '100%', filter: `drop-shadow(18px 18px 0 ${INK})` }} />
          </div>
        ) : null}
      </Shake>
      <AbsoluteFill style={{ background: POP.white, opacity: flash }} />
      <Sfx at={b0} name="stamp" volume={0.35} />
      <Sfx at={b1 - 22} name="riser" volume={0.35} />
      <Sfx at={b1} name="impact" volume={0.9} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 4. Worlds: «حواديت.. أرقام.. علوم.. وقيم! لكل سن، من تلاتة لاتناشر سنة» ─────────────────────────
const WORLDS = [
  { word: 'حواديت', poster: 'bedtime-stories', bg: POP.purple, text: POP.yellow, pos: '50% 70%' },
  { word: 'أرقام', poster: 'preschool-count-with-me', bg: POP.orange, text: POP.white, pos: '50% 80%' },
  { word: 'علوم', poster: 'junior-science-in-a-minute', bg: POP.cyan, text: POP.white, pos: '50% 62%' },
  { word: 'قيم', poster: 'qiyami-alsaghira', bg: POP.coral, text: POP.yellow, pos: '50% 70%' },
];
const GRID = [[290, 520], [790, 520], [290, 1080], [790, 1080]];
export const WorldsE: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const b = t.beats; // 4 words + «لكل سن»
  const g = b[4];
  const gridP = (i: number) => outCubic(f, g + i * 3, g + i * 3 + 12);
  const badge = useSpr(g + 16, 8, 170, 0.8);
  return (
    <AbsoluteFill>
      {WORLDS.map((w, i) => {
        const start = b[i];
        const end = i < 3 ? b[i + 1] + 8 : g + 8;
        if (f < start || f > end) return null;
        const dir = i % 2 ? -1 : 1;
        const e = outCubic(f, start, start + 7);
        const s = clamp01((f - start - 2) / 10);
        const pop = 1 + 0.25 * Math.sin(s * Math.PI) * (1 - s);
        return (
          <AbsoluteFill key={w.word} style={{ transform: `translateX(${(1 - e) * 1200 * dir}px) skewX(${(1 - e) * -14 * dir}deg)` }}>
            <PopBg color={w.bg} stripes drift={2} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 170, textAlign: 'center', transform: `scale(${pop}) rotate(${dir * -3}deg)` }}>
              <span style={inkText(260, w.text)}>{w.word}</span>
            </div>
            <div style={{ position: 'absolute', left: 540 - 350, top: 640, transform: `rotate(${dir * 5 + Math.sin(f / 5) * 1.5}deg) scale(${0.9 + 0.1 * e})` }}>
              <Sticker src={poster(w.poster)} w={700} h={900} pos={w.pos} />
            </div>
          </AbsoluteFill>
        );
      })}
      {f >= g ? (
        <AbsoluteFill>
          <AbsoluteFill style={{ clipPath: `circle(${outCubic(f, g, g + 9) * 120}% at 50% 40%)` }}>
            <PopBg color={POP.yellow} stripes />
          </AbsoluteFill>
          <Shake impacts={[g + 16]} amp={18}>
            {WORLDS.map((w, i) => {
              const p = gridP(i);
              const [x, y] = GRID[i];
              const wob = Math.sin(f / 7 + i) * 3;
              return (
                <div key={w.word} style={{ position: 'absolute', left: interpolate(p, [0, 1], [540, x]) - 210, top: interpolate(p, [0, 1], [1000, y]) - 250,
                  transform: `scale(${interpolate(p, [0, 1], [0.2, 1])}) rotate(${(i % 2 ? 6 : -6) + wob}deg)` }}>
                  <Sticker src={poster(w.poster)} w={420} h={500} pos={w.pos} style={{ boxShadow: `12px 12px 0 ${INK}` }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: -40, textAlign: 'center' }}>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 56, color: INK, background: w.bg, border: `5px solid ${INK}`, borderRadius: 40, padding: '4px 34px' }}>{w.word}</span>
                  </div>
                </div>
              );
            })}
            {/* age badge: spiky starburst */}
            <div style={{ position: 'absolute', left: 540 - 360, top: 1440, width: 720, height: 330,
              transform: `scale(${badge}) rotate(${(1 - badge) * -180 - 4}deg)` }}>
              <div style={{ position: 'absolute', inset: 0, background: POP.coral, border: `8px solid ${INK}`, borderRadius: 60, boxShadow: `14px 14px 0 ${INK}` }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ ...inkText(60, POP.white, 5, 4) }}>لكل سن</span>
                <span style={{ ...inkText(76, POP.yellow, 7, 6) }}>{`من ${toArabicDigits(3)} لحد ${toArabicDigits(12)} سنة`}</span>
              </div>
            </div>
          </Shake>
        </AbsoluteFill>
      ) : null}
      {b.slice(0, 4).map((x) => <Sfx key={x} at={x} name="swish" volume={0.45} />)}
      {b.slice(0, 4).map((x) => <Sfx key={`s${x}`} at={x + 2} name="stamp" volume={0.3} />)}
      <Sfx at={g} name="swish" volume={0.5} />
      {[0, 1, 2, 3].map((i) => <Sfx key={`p${i}`} at={g + i * 3 + 10} name="pop" volume={0.35} />)}
      <Sfx at={g + 16} name="stamp" volume={0.5} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 5. Parents: «ومن غير ولا إعلان.. وإنت متابع كل حاجة بنفسك» ─────────────────────────
const Toggle: React.FC<{ on: number }> = ({ on }) => (
  <div style={{ width: 130, height: 72, borderRadius: 40, border: `6px solid ${INK}`, background: interpolateColors(on, [0, 1], ['#C9CEDD', POP.green]), position: 'relative' }}>
    <div style={{ position: 'absolute', top: 5, right: 6 + on * 52, width: 50, height: 50, borderRadius: '50%', background: POP.white, border: `5px solid ${INK}` }} />
  </div>
);
export const ParentsE: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const [b0, b1, b2] = t.beats;
  const countEnd = b0 + 26;
  const n = Math.round(interpolate(f, [b0, countEnd], [99, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 2) }));
  const zero = f >= countEnd;
  const up = outCubic(f, b1 - 4, b1 + 8);
  const card = useSpr(b1, 11, 150, 0.8);
  const tog = outCubic(f, b1 + 10, b1 + 16);
  const bars = [0.55, 0.8, 0.65, 1];
  return (
    <AbsoluteFill>
      <PopBg color={POP.blue} dot="rgba(255,255,255,0.12)" stripes />
      <Shake impacts={[countEnd, countEnd + 6, b2]} amp={20}>
        {/* ad counter crashing to zero */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 230, display: 'flex', flexDirection: 'column', alignItems: 'center',
          transform: `translateY(${-up * 180}px) scale(${1 - up * 0.35})` }}>
          <span style={inkText(96, POP.white)}>إعلانات</span>
          <div style={{ marginTop: 20, width: 560, height: 330, borderRadius: 40, background: INK, border: `8px solid ${POP.white}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 260, lineHeight: 1, color: zero ? POP.green : POP.coral,
              transform: `translateY(${zero ? 0 : ((f % 2) - 0.5) * 30}px) scale(${zero ? 1 + 0.3 * Math.exp(-(f - countEnd) / 4) : 1})` }}>{n}</span>
          </div>
        </div>
        <Stamp text="ولا إعلان!" at={countEnd + 4} top={740} size={120} tape={POP.yellow} rot={-6} exitAt={b1 - 4} exit="pop" />
        {/* parent dashboard card */}
        <div style={{ position: 'absolute', left: 90, width: 900, top: 760, transform: `translateY(${(1 - card) * 1300}px) rotate(${(1 - card) * 10 - 1.5}deg)`,
          background: POP.paper, border: `8px solid ${INK}`, borderRadius: 50, boxShadow: `20px 20px 0 ${INK}`, padding: '44px 56px', direction: 'rtl' }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 64, color: INK }}>لوحة الأهل</div>
          <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 56, color: INK }}>رقابة أبوية</span>
            <Toggle on={tog} />
          </div>
          <div style={{ marginTop: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 56, color: INK }}>تقارير تعلّم</span>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', height: 170 }}>
              {bars.map((h, i) => (
                <div key={i} style={{ width: 46, height: 170 * h * outCubic(f, b1 + 14 + i * 3, b1 + 26 + i * 3), background: [POP.coral, POP.yellow, POP.cyan, POP.green][i],
                  border: `5px solid ${INK}`, borderRadius: 12 }} />
              ))}
            </div>
          </div>
        </div>
        <Stamp text="كل حاجة تحت عينك" at={b2} top={1560} size={96} color={POP.yellow} rot={-3} />
      </Shake>
      {Array.from({ length: 9 }).map((_, i) => <Sfx key={i} at={b0 + i * 3} name="tick" volume={0.35} />)}
      <Sfx at={countEnd} name="stamp" volume={0.55} />
      <Sfx at={b1} name="swish" volume={0.45} />
      <Sfx at={b1 + 12} name="pop" volume={0.4} />
      <Sfx at={b2} name="stamp" volume={0.4} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 6. CTA: «مَجَرّة.. وقت الشاشة بقى وقت مفيد. نزّلها دلوقتي!» ─────────────────────────
const RIBBON = ['bedtime-stories', 'preschool-count-with-me', 'junior-science-in-a-minute', 'qiyami-alsaghira', 'abni-kalima', 'kids-explorers-adventures', 'hekaya-wa-hikma', 'junior-robo-codes'];
export const CtaE: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const [b0, b1, b2] = t.beats;
  const logo = useSpr(b0, 8, 180, 0.8);
  const line2 = b1 + 16;
  const mark = outCubic(f, line2 + 6, line2 + 14);
  const btn = useSpr(b2, 8, 200, 0.7);
  // button "press" on every other beat after it lands
  const ph = f > b2 + 10 ? ((f - b2) % (BEAT * 2)) : 99;
  const press = ph < 6 ? Math.sin((ph / 6) * Math.PI) : 0;
  const diag = 50 + Math.sin(f / 30) * 3;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: POP.purple }} />
      <AbsoluteFill style={{ clipPath: `polygon(0 0, 100% 0, 100% ${diag - 6}%, 0 ${diag + 6}%)` }}>
        <PopBg color={POP.yellow} stripes />
      </AbsoluteFill>
      <Shake impacts={[b0 + 6, b1, line2, b2 + 4]} amp={14}>
        <div style={{ position: 'absolute', left: 540 - 300, top: 40, width: 600, transform: `translateY(${(1 - logo) * -700}px) rotate(${Math.sin(f / 14) * 3}deg)` }}>
          <Img src={staticFile('brand/logo.png')} style={{ width: '100%', filter: `drop-shadow(14px 14px 0 ${INK})` }} />
        </div>
        <Stamp text="وقت الشاشة" at={b1} top={640} size={120} color={POP.white} rot={-3} />
        {/* RTL line: «بقى وقت» on the right, «مفيد» (with a marker swipe) on the left */}
        <div style={{ position: 'absolute', left: 50, width: 360, top: 850, height: 130, background: POP.coral, border: `6px solid ${INK}`, borderRadius: 24,
          transform: `scaleX(${mark}) rotate(-3deg)`, transformOrigin: 'right center', opacity: mark > 0 ? 1 : 0 }} />
        <Stamp text="بقى وقت" at={line2} top={810} size={120} color={POP.white} rot={2} left={420} right={0} />
        <Stamp text="مفيد" at={line2 + 5} top={800} size={140} color={POP.yellow} rot={-4} left={0} right={620} />
        {/* tilted poster ribbon */}
        <div style={{ position: 'absolute', left: -200, right: -200, top: 1060, height: 330, transform: 'rotate(-6deg)', background: INK, borderTop: `8px solid ${POP.white}`, borderBottom: `8px solid ${POP.white}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 26, position: 'absolute', top: 25, left: -((f * 9) % (RIBBON.length * 226)) }}>
            {[...RIBBON, ...RIBBON, ...RIBBON].map((p, i) => (
              <div key={i} style={{ width: 200, height: 264, borderRadius: 20, overflow: 'hidden', border: `5px solid ${POP.white}`, flex: 'none' }}>
                <Img src={poster(p)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 75%' }} />
              </div>
            ))}
          </div>
        </div>
        {/* download button */}
        <div style={{ position: 'absolute', left: 540 - 400, top: 1500, width: 800, transform: `scale(${btn}) rotate(${(1 - btn) * 12}deg)` }}>
          <div style={{ height: 190, borderRadius: 100, background: POP.yellow, border: `9px solid ${INK}`, boxShadow: `${16 - press * 12}px ${16 - press * 12}px 0 ${INK}`,
            transform: `translate(${press * 12}px, ${press * 12}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 96, color: INK, direction: 'rtl' }}>نزّلها دلوقتي</span>
          </div>
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 24, opacity: lin(f, b2 + 8, b2 + 14) }}>
            {['App Store', 'Google Play'].map((s) => (
              <span key={s} style={{ fontFamily: FONT, fontWeight: 600, fontSize: 44, color: INK, background: POP.white, border: `5px solid ${INK}`, borderRadius: 30, padding: '8px 34px' }}>{s}</span>
            ))}
          </div>
        </div>
        <Confetti at={b2 + 2} x={540} y={1590} radius={620} seed="cta" />
      </Shake>
      <Sfx at={b0 + 4} name="impact" volume={0.5} />
      <Sfx at={b1} name="stamp" volume={0.4} />
      <Sfx at={line2} name="stamp" volume={0.4} />
      <Sfx at={b2} name="pop" volume={0.6} />
      <Sfx at={b2 + 4} name="chime" volume={0.35} />
    </AbsoluteFill>
  );
};
