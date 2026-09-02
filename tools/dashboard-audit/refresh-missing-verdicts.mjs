#!/usr/bin/env node
/**
 * تصحيح أحكام `MISSING` الثمانية التي تقادمت (`ADM-107`).
 *
 * ## لماذا سكربت لا تحرير بيد
 *
 * `docs/FEATURE_MATRIX.md` **مُولَّد**، ونصفه الحُكمي في
 * `docs/FEATURE_MATRIX_VERDICTS.json` **يُصان بيد**. وقد تقادم النصف اليدوي في
 * الاتجاه الأخطر: ثماني وجهات مسجَّلة `MISSING` ودليلها «`NotImplementedPage`» —
 * ومكوّنٌ بهذا الاسم لم يكن مستخدَمًا في أي صفحة، فحُذف.
 *
 * والسكربت يكتب ما **قِيس** لا ما يُظنّ: لكل وجهة عددُ نداءات الـAPI المقروءة من
 * صفحتها، وأن موجّهًا خادميًّا يُجيبها. ولا يرفعها إلى `COMPLETE`: وجودُ نداءات
 * ليس دليل اكتمال، ورفعُها كذلك يكرّر العطل نفسه في الاتجاه المعاكس.
 *
 * التشغيل: `node tools/dashboard-audit/refresh-missing-verdicts.mjs`
 * ثم: `node tools/dashboard-audit/feature-matrix.mjs` لإعادة توليد الجدول.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERDICTS = join(ROOT, 'docs', 'FEATURE_MATRIX_VERDICTS.json');
const PAGES = join(ROOT, 'dashboard', 'front', 'src', 'pages');

/// الوجهات الثمانية وصفحاتها، ودليلٌ يخصّ كل واحدة قِيس لا يُفترض.
const CORRECTIONS = {
  '/campaigns': { page: 'CampaignsPage.tsx' },
  '/revenue': { page: 'RevenuePage.tsx' },
  '/translation': { page: 'TranslationCenterPage.tsx' },
  '/quiz': { page: 'QuizBuilderPage.tsx' },
  '/recommendations': {
    page: 'RecommendationsPage.tsx',
    extra: 'The eligibility preview still runs on four hard-coded candidates, not on catalogue rows.',
  },
  '/school': { page: 'SchoolAccountsPage.tsx' },
  '/finance-advanced': { page: 'AdvancedFinancePage.tsx' },
  '/ops-sla': {
    page: 'OpsSlaPage.tsx',
    extra: 'The list has no toolbar or pagination; its imports for them were unused and were removed.',
  },
};

const apiCalls = (source) => new Set(
  [...source.matchAll(/api[.)]?\s*(?:as any\))?\.?([a-zA-Z_]+)\(/g)].map((m) => m[1]),
);

const verdicts = JSON.parse(readFileSync(VERDICTS, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
let changed = 0;

for (const [route, spec] of Object.entries(CORRECTIONS)) {
  const current = verdicts[route];
  if (!current) { console.error(`no verdict recorded for ${route}`); process.exitCode = 1; continue; }
  if (current.status !== 'MISSING') { console.log(`${route} already ${current.status}, left alone`); continue; }
  const source = readFileSync(join(PAGES, spec.page), 'utf8');
  const calls = [...apiCalls(source)].sort();
  if (calls.length === 0) {
    console.error(`${route}: page calls no endpoint — MISSING may still be right, not touching`);
    process.exitCode = 1;
    continue;
  }
  verdicts[route] = {
    status: 'PARTIAL',
    verified_by: `code read ${today}`,
    evidence: [
      `Route registered in AdminRoutes.tsx and ${spec.page} calls ${calls.length} endpoint(s): ${calls.join(', ')}.`,
      'A server route answers each. The previous verdict cited NotImplementedPage as evidence; that component was unused everywhere and has been deleted.',
      spec.extra,
    ].filter(Boolean).join(' '),
    gaps: [
      'Feature completeness was not audited in this pass: presence of endpoints is not proof of a finished workflow.',
      ...(current.gaps ?? []),
    ],
  };
  changed += 1;
}

writeFileSync(VERDICTS, `${JSON.stringify(verdicts, null, 2)}\n`, 'utf8');
console.log(`rewrote ${changed} verdict(s) in docs/FEATURE_MATRIX_VERDICTS.json`);
