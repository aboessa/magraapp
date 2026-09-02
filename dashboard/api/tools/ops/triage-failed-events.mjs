#!/usr/bin/env node
/**
 * تشخيص أحداث الأسرة الفاشلة وتصنيفها (`OPS-106`، معيار القبول الثالث).
 *
 * ## لماذا أداة لا استعلام في وثيقة
 *
 * السؤال «ما هذه الأربعة والعشرون صفًّا؟» يُطرَح مرّة كل حادثة، وجوابه يحتاج
 * أربعة استعلامات وقراءة حمولات. ووثيقة تشرح كيف يُطرَح تتقادم؛ أداة تُشغَّل لا.
 *
 * ## ما تفعله
 *
 * تقرأ المعلَّق، تجمعه بالنوع وبسبب الفشل الظاهر من الحمولة، ثم تصنّف كل مجموعة
 * إلى واحد من ثلاثة:
 *
 *   * `replayable` — حمولة سليمة الشكل ونوعها معروف. الأرجح أن السبب زال.
 *   * `placeholder` — حمولة مقتطعة أو غير قابلة للترميز. **لا تُعاد أبدًا**:
 *     ليست حدثًا، وإعادتها تُنتج 422 كل مرة.
 *   * `unknown_type` — نوع لا يعرفه `FAMILY_EVENT_TYPES` اليوم. إمّا حدث نسخة
 *     أقدم، وإمّا ضجيج تطوير.
 *
 * وتطبع لكل مجموعة **الأمر الجاهز** لتنفيذ القرار.
 *
 * ## ما لا تفعله
 *
 * لا تكتب شيئًا. الإعادة والاستبعاد يمرّان بمسارَي الإدارة اللذين يفرضان
 * الصلاحية ويكتبان `resolved_by` — أداةٌ تكتب مباشرة في القاعدة كانت ستتجاوز
 * ذلك وتُنتج صفوفًا بلا فاعل معروف.
 *
 * ## التشغيل
 *
 *   node tools/ops/triage-failed-events.mjs --remote     # الإنتاج
 *   node tools/ops/triage-failed-events.mjs --local      # قاعدة التطوير
 */

import { execFileSync } from 'node:child_process';

const remote = process.argv.includes('--remote');
const local = process.argv.includes('--local');
if (remote === local) {
  console.error('اختر --remote أو --local، لا كليهما ولا لا شيء.');
  process.exit(2);
}

const QUERY = `
  SELECT id, event_id, event_type, parent_id, attempts, failed_at, payload
    FROM failed_family_events
   WHERE status = 'pending'
   ORDER BY failed_at ASC
`.replace(/\s+/g, ' ').trim();

function query() {
  // `--json` حتى لا يُحلَّل جدول نصّي: تنسيق العرض يتغيّر بين إصدارات wrangler.
  //
  // ولا `shell: true` على Windows: يُشغَّل `npx.cmd` مباشرةً فيصل الاستعلام
  // وسيطًا واحدًا. المرور بـ`cmd.exe` كان يقتضي اقتباسًا يدويًّا يُفسد أي
  // استعلام فيه سطر جديد. (كلفة ذلك ظهرت في تشخيص `DB-104`.)
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const output = execFileSync(npx, [
    'wrangler', 'd1', 'execute', 'majarra-db',
    remote ? '--remote' : '--local',
    '--json', '--command', QUERY,
  ], { encoding: 'utf8' });
  const parsed = JSON.parse(output);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return first?.results ?? [];
}

/// سبب الفشل كما يظهر من الحمولة نفسها.
function classify(row) {
  let body;
  try {
    body = JSON.parse(row.payload);
  } catch {
    return { kind: 'placeholder', reason: 'الحمولة ليست JSON صالحًا' };
  }
  if (body && typeof body === 'object' && typeof body.error === 'string') {
    return { kind: 'placeholder', reason: `بديل التقاط: ${body.error}` };
  }
  if (!row.event_type) {
    return { kind: 'unknown_type', reason: 'بلا نوع — جسم لم يُقرَأ عند الالتقاط' };
  }
  if (!body || typeof body !== 'object' || typeof body.type !== 'string') {
    return { kind: 'placeholder', reason: 'جسم بلا حقل `type`، فلا يقبله المعالِج' };
  }
  return { kind: 'replayable', reason: 'حمولة سليمة الشكل' };
}

const rows = query();
if (rows.length === 0) {
  console.log('لا أحداث معلَّقة. لا شيء يُشخَّص.');
  process.exit(0);
}

const groups = new Map();
for (const row of rows) {
  const verdict = classify(row);
  const key = `${verdict.kind}|${row.event_type ?? 'null'}|${verdict.reason}`;
  const group = groups.get(key) ?? { ...verdict, eventType: row.event_type, ids: [], oldest: row.failed_at };
  group.ids.push(row.id);
  groups.set(key, group);
}

console.log(`\n${rows.length} حدثًا معلَّقًا في ${groups.size} مجموعة\n${'='.repeat(60)}`);

for (const group of [...groups.values()].sort((a, b) => b.ids.length - a.ids.length)) {
  console.log(`\n[${group.kind}] ${group.eventType ?? '(بلا نوع)'} — ${group.ids.length} صفًّا`);
  console.log(`  السبب: ${group.reason}`);
  console.log(`  الأقدم: ${group.oldest}`);
  if (group.kind === 'replayable') {
    console.log('  القرار: أعِد التشغيل بعد التأكّد من زوال السبب. المسار يفحص');
    console.log('          `processed_family_events` أوّلًا فلا يُطبَّق حدث مرتين.');
    console.log(`  POST /api/v1/admin/failed-family-events/${group.ids[0]}/replay`);
  } else {
    console.log('  القرار: استبعاد بسبب مكتوب. الإعادة ستفشل بـ422 في كل مرة.');
    console.log(`  POST /api/v1/admin/failed-family-events/${group.ids[0]}/discard`);
    console.log(`       {"note":"${group.reason}"}`);
  }
  if (group.ids.length > 1) {
    console.log(`  وبقيّة المجموعة (${group.ids.length - 1}): ${group.ids.slice(1, 6).join(', ')}${group.ids.length > 6 ? ' …' : ''}`);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log('التصنيف لا يكتب شيئًا. القرار والتنفيذ عبر مسارَي الإدارة، ليُسجَّل فاعله.');
