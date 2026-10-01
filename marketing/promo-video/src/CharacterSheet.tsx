import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { C, FONT } from './theme';

// Review sheet for the 3D app avatars used in the ad. Built only from existing
// app assets (no new generation), so the ad cannot drift from the app.
const CHARS = [
  {
    name: 'زينة',
    views: [['zaina-front', 'أمامي · هادئة'], ['zaina-full', 'ابتسامة'], ['zaina-jump', 'فرحة / حماس']],
    lock: [
      'بنت عربية بعمر 7–8 سنوات تقريبًا، أسلوب 3D ناعم',
      'حجاب بنفسجي فاتح (lavender) يغطي الشعر والرقبة بالكامل',
      'سترة بنفسجية بسحّاب وخطوط تطريز بيضاء',
      'بشرة قمحية دافئة، عيون بنية واسعة، خدود وردية خفيفة',
      'توهج خلفي بنفسجي/سماوي على خلفية Midnight Navy',
    ],
    ring: C.purple,
  },
  {
    name: 'ياسين',
    views: [['yaseen-front', 'أمامي · هادئ'], ['yaseen-full', 'ابتسامة'], ['yaseen-surprised', '«surprised» (شبه مطابق للأمامي)']],
    lock: [
      'ولد عربي بعمر 7–8 سنوات تقريبًا، نفس حجم زينة ونفس الأسلوب',
      'شعر أسود قصير مجعّد',
      'هودي أزرق ملكي بحبال ذهبية، وتيشيرت رمادي فاتح تحته',
      'بشرة سمراء دافئة، عيون بنية، أذنان ظاهرتان',
      'توهج خلفي سماوي على خلفية Midnight Navy',
    ],
    ring: C.blue,
  },
];

export const CharacterSheet: React.FC = () => (
  <AbsoluteFill style={{ background: C.midnight, direction: 'rtl', fontFamily: FONT, color: C.white, padding: 50 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontSize: 38, fontWeight: 700 }}>Character Sheet · إعلان مجرة (نسخة 3D من التطبيق)</div>
      <div style={{ fontSize: 24, color: C.gray }}>المصدر: app_main/assets/avatars/characters</div>
    </div>
    {CHARS.map((c) => (
      <div key={c.name} style={{ marginTop: 24, display: 'flex', gap: 28, background: C.card, borderRadius: 28, padding: 22, border: `2px solid ${C.border}` }}>
        <div style={{ width: 400 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: C.yellow }}>{c.name}</div>
          <ul style={{ margin: '8px 0 0', paddingRight: 26, fontSize: 22, lineHeight: 1.5, color: C.white }}>
            {c.lock.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
        <div style={{ display: 'flex', gap: 22 }}>
          {c.views.map(([file, label]) => (
            <div key={file} style={{ textAlign: 'center' }}>
              <Img src={staticFile(`characters/${file}.png`)} style={{ width: 280, height: 280, borderRadius: 24, border: `3px solid ${c.ring}` }} />
              <div style={{ fontSize: 24, marginTop: 8, color: C.gray }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ))}
    <div style={{ marginTop: 26, fontSize: 22, color: C.gray, lineHeight: 1.6 }}>
      الاستخدام في الإعلان: لقطة نصفية أمامية فقط (مشهد 6)، والشخصيتان بنفس الحجم. مفيش توليد صور جديدة؛ نفس ملفات التطبيق من غير أي تعديل.
    </div>
  </AbsoluteFill>
);
