// Majarra — builds a single-file HTML proof sheet for a generated illustrated story.
//
// Purpose: let a human check in one place the things no script can check —
// character identity across pages, whether the art matches the Arabic line, and
// whether the narration sounds like a young woman reading to a small child.
//
// Generated rather than hand-written so it cannot drift from the pipeline. Page
// text comes from the narration manifest (which copies the story file verbatim),
// durations come from the measured _durations.json, and image paths come from the
// image manifest. If any of those change, rebuild and the sheet follows.
//
// The story text is rendered as HTML on purpose. The story file requires narration
// text to be a separate layer with no burnt-in text in the artwork, so overlaying
// it here mirrors how the app composes a page.
//
// Usage:
//   node tools/build-story-preview.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const IMAGE_MANIFEST = path.join(ROOT, 'tools/playveo/act-s1.manifest.json');
const NARRATION_MANIFEST = path.join(ROOT, 'tools/tts/act-s1.narration.locked.json');
const EN_MANIFEST = path.join(ROOT, 'tools/tts/act-s1.narration.en.json');
const OUT = path.join(ROOT, 'act-s1-preview.html');

const img = JSON.parse(fs.readFileSync(IMAGE_MANIFEST, 'utf8'));
const nar = JSON.parse(fs.readFileSync(NARRATION_MANIFEST, 'utf8'));

/// English is optional so the preview still builds before it exists.
///
/// Both languages share ONE artwork image per page, which is the architectural decision
/// the page model is built on: text and audio are separate layers, so adding a language
/// costs text plus audio and no re-illustration. Showing them side by side against the
/// same picture is the fastest way to see whether that actually holds.
const en = fs.existsSync(EN_MANIFEST) ? JSON.parse(fs.readFileSync(EN_MANIFEST, 'utf8')) : null;

const loadDurations = (dir) => {
  const p = path.join(ROOT, dir, '_durations.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { pages: [] };
};
const durations = loadDurations(nar.out_dir);
const enDurations = en ? loadDurations(en.out_dir) : { pages: [] };
const durationFor = (page) => durations.pages.find((p) => p.page === page);
const enDurationFor = (page) => enDurations.pages.find((p) => p.page === page);
const enLineFor = (page) => en?.lines.find((l) => l.page === page);

/// Reports whether a referenced file is actually on disk.
///
/// A preview that silently shows a broken image is worse than no preview: it looks
/// like a generation failure when it is a path problem, or hides a missing asset
/// behind a plausible-looking layout.
function check(relPath) {
  const abs = path.join(ROOT, relPath);
  return fs.existsSync(abs) ? { ok: true, kb: Math.round(fs.statSync(abs).size / 1024) } : { ok: false, kb: 0 };
}

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pageAssets = img.assets.filter((a) => /page-\d+$/.test(a.id));
const extras = img.assets.filter((a) => !/page-\d+$/.test(a.id));

const missing = [];

const pageCards = nar.lines.map((line) => {
  const asset = pageAssets.find((a) => a.order === line.page);
  const imgRel = asset ? `${img.out_dir}/${asset.file}` : null;
  const audRel = `${nar.out_dir}/${line.file}`;
  const imgState = imgRel ? check(imgRel) : { ok: false, kb: 0 };
  const audState = check(audRel);
  if (!imgState.ok && imgRel) missing.push(imgRel);
  if (!audState.ok) missing.push(audRel);
  const d = durationFor(line.page);

  return `
  <article class="page">
    <header>
      <span class="num">صفحة ${line.page}</span>
      <span class="meta">سطوع ${asset?.brightness ?? '—'}</span>
      <span class="meta">${d ? `سرد ${(d.measuredDurationMs / 1000).toFixed(2)} ث` : 'بلا مدة'}</span>
      <!-- Turn timing is not a narration property: the reader turns on the real
           audio completion event plus the page's authored `dwellMs`.
           See docs/content/planets/05-qisas/00-story-page-model.md -->
      <span class="meta">${d?.autoTurnAfterMs === null ? 'بلا تقليب تلقائي' : 'التقليب = اكتمال الصوت + dwell الصفحة'}</span>
    </header>
    ${imgState.ok
      ? `<div class="art"><img src="${imgRel}" alt="${escapeHtml(line.text)}" loading="lazy"><p class="overlay">${escapeHtml(line.text)}</p></div>`
      : `<div class="art missing">صورة مفقودة: ${escapeHtml(imgRel ?? 'غير معروفة')}</div>`}
    <p class="text">${escapeHtml(line.text)}</p>
    ${audState.ok
      ? `<audio controls preload="none" src="${audRel}"></audio>`
      : `<p class="missing">صوت مفقود: ${escapeHtml(audRel)}</p>`}
    ${enBlock(line.page)}
    <details><summary>توجيه الأداء</summary><p class="dir">${escapeHtml(line.style)}</p></details>
  </article>`;
}).join('\n');

/// The English layer for a page, against the same artwork.
function enBlock(page) {
  const line = enLineFor(page);
  if (!line) return '';
  const rel = `${en.out_dir}/${line.file}`;
  const state = check(rel);
  if (!state.ok) missing.push(rel);
  const d = enDurationFor(page);
  return `
    <div class="en" dir="ltr">
      <p class="text">${escapeHtml(line.text)}</p>
      ${state.ok
      ? `<audio controls preload="none" src="${rel}"></audio>`
      : `<p class="missing">missing: ${escapeHtml(rel)}</p>`}
      <span class="meta">${d ? `${(d.measuredDurationMs / 1000).toFixed(2)}s` : ''}${line.pre_roll_ms ? ` + ${line.pre_roll_ms}ms beat` : ''}</span>
    </div>`;
}

const extraCards = extras.map((a) => {
  const rel = `${img.out_dir}/${a.file}`;
  const state = check(rel);
  if (!state.ok) missing.push(rel);
  return `
  <article class="page">
    <header><span class="num">${escapeHtml(a.id.replace('asset-act-s1-', ''))}</span><span class="meta">${a.aspect_ratio}</span><span class="meta">${state.kb} KB</span></header>
    ${state.ok ? `<div class="art"><img src="${rel}" alt="${escapeHtml(a.id)}" loading="lazy"></div>` : `<div class="art missing">مفقودة</div>`}
  </article>`;
}).join('\n');

const totalMs = durations.pages.reduce((s, p) => s + (p.measuredDurationMs ?? 0), 0);

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>معاينة — ${escapeHtml(nar.story)} · بيت الطائر</title>
<style>
  :root {
    --deep: #06091A; --navy: #0B1026; --royal: #2856D8;
    --cyan: #00D6F5; --star: #FFD34D; --ink: #E8ECF8; --muted: #8E99BC;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem 1.25rem 4rem;
    background: linear-gradient(180deg, var(--deep), var(--navy));
    color: var(--ink);
    font-family: "Readex Pro", "Segoe UI", system-ui, sans-serif;
    line-height: 1.7;
  }
  h1 { font-size: 1.6rem; margin: 0 0 .35rem; }
  .sub { color: var(--muted); margin: 0 0 1.5rem; font-size: .9rem; }
  .facts { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 2rem; }
  .facts span {
    background: rgba(40,86,216,.18); border: 1px solid rgba(0,214,245,.28);
    padding: .3rem .7rem; border-radius: 999px; font-size: .8rem;
  }
  .warn {
    background: rgba(255,211,77,.12); border: 1px solid var(--star);
    padding: .9rem 1.1rem; border-radius: .6rem; margin-bottom: 2rem; font-size: .88rem;
  }
  .warn strong { color: var(--star); }
  h2 { font-size: 1.05rem; margin: 2.5rem 0 1rem; color: var(--cyan); }
  .grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }
  .page {
    background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09);
    border-radius: .8rem; padding: .9rem; display: flex; flex-direction: column; gap: .6rem;
  }
  .page header { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
  .num { font-weight: 600; color: var(--star); font-size: .9rem; }
  .meta { color: var(--muted); font-size: .75rem; }
  .art { position: relative; border-radius: .5rem; overflow: hidden; background: #000; }
  .art img { width: 100%; display: block; }
  .overlay {
    position: absolute; inset-inline: 0; bottom: 0; margin: 0; padding: 1.6rem .9rem .8rem;
    background: linear-gradient(transparent, rgba(6,9,26,.88));
    font-size: 1.05rem; font-weight: 500;
  }
  .art.missing, .missing { color: #FF9C9C; font-size: .85rem; padding: 1rem; }
  .text { margin: 0; font-size: 1.1rem; }
  .en {
    border-top: 1px solid rgba(0,214,245,.22); padding-top: .6rem;
    display: flex; flex-direction: column; gap: .4rem;
  }
  .en .text { font-size: .98rem; color: #CFE0FF; }
  audio { width: 100%; }
  details { font-size: .8rem; color: var(--muted); }
  summary { cursor: pointer; }
  .dir { margin: .4rem 0 0; }
  footer { margin-top: 3rem; color: var(--muted); font-size: .8rem; border-top: 1px solid rgba(255,255,255,.1); padding-top: 1rem; }
</style>
</head>
<body>
  <h1>بيت الطائر — معاينة الإنتاج</h1>
  <p class="sub">صور من PlayVeo (${escapeHtml(img.model)}) · سرد من ${escapeHtml(nar.model)} بصوت ${escapeHtml(nar.voice)}</p>

  <div class="facts">
    <span>${nar.lines.length} صفحات</span>
    <span>سرد عربي ${(totalMs / 1000).toFixed(1)} ث</span>
    ${en ? `<span>سرد إنجليزي ${(enDurations.pages.reduce((s, p) => s + (p.measuredDurationMs ?? 0), 0) / 1000).toFixed(1)} ث</span>` : ''}
    <span>الصوت ${escapeHtml(nar.voice)}</span>
    <span>صورة واحدة لكل صفحة · لغتان</span>
    <span>جهارة موحّدة داخل كل لغة</span>
  </div>

  <div class="warn">
    <strong>ما لم يُتحقّق منه آليًا.</strong> النبرة والتيمبر ونطق العربية تحتاج سماعًا بشريًا.
    وفيه ثلاث ملاحظات مقيسة تحتاج قرارك: إيقاع السرد أبطأ من هدف ~90 كلمة/دقيقة في الملف التحريري،
    والصفحة 8 ليست أبطأ صفحة كما يفرض الملف، والصفحة 7 فيها 860 ملّي ثانية صمت ابتدائي مقابل 240–380 في الباقي.
    كما أن المخرجات JPEG لا PNG، فهي براهين إنتاج لا ماسترز نهائية.
  </div>

  <h2>الصفحات</h2>
  <div class="grid">${pageCards}</div>

  <h2>أصول إضافية</h2>
  <div class="grid">${extraCards}</div>

  <footer>
    وُلِّد بـ tools/build-story-preview.mjs — لا تُحرَّر هذه الصفحة يدويًا، أعِد بناءها.
    ${missing.length ? `<br><span class="missing">${missing.length} ملف مفقود.</span>` : '<br>كل الملفات المرجعية موجودة على القرص.'}
  </footer>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`wrote ${path.relative(ROOT, OUT)}`);
console.log(`pages ${nar.lines.length}   extras ${extras.length}   narration ${(totalMs / 1000).toFixed(1)}s`);
if (missing.length) {
  console.log(`\n${missing.length} referenced file(s) missing:`);
  for (const m of missing) console.log(`  - ${m}`);
  process.exitCode = 1;
} else {
  console.log('All referenced images and audio exist on disk.');
}
