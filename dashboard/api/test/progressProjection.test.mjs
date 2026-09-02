import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { processFamilyEvent } from '../src/queue/familyEvents.ts';

/// API-105 — جداول تُقرأ ولا يكتبها شيء.
///
/// ## العطل
///
/// `children_profiles` و`watch_progress` و`child_screen_time_daily`: صفر صفًّا،
/// وصفر `INSERT` في المصدر. سلطة الحقيقة في الكائن الدائم والإسقاط لم يُكتب. فكل
/// شاشة تقرؤها تعرض **صفرًا يُقرأ «لا نشاط» ومعناه «لا بيانات»** — وهذا سبب إخفاء
/// بلوكات كاملة في التطبيق.

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relative) => readFileSync(root + relative, 'utf8');

/// D1 وهمية: تسجّل كل بيان، وتُجيب «لم يُرَ» على فحص التكرار.
function fakeDb() {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      const statement = {
        bind(...params) {
          return {
            sql,
            params,
            async run() { writes.push({ sql, params }); return { meta: { changes: 1 } }; },
            async first() { return null; },
            async all() { return { results: [] }; },
          };
        },
        async first() { return null; },
        async all() { return { results: [] }; },
      };
      return statement;
    },
    async batch(statements) {
      for (const statement of statements) writes.push({ sql: statement.sql, params: statement.params });
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
}

const event = (type, payload, occurredAt = 1_700_000_000_000) => ({
  eventId: `event_${type}_${occurredAt}`,
  type,
  schemaVersion: 1,
  parentId: 'parent_12345678',
  occurredAt,
  payload,
});

const progressWrites = (db) => db.writes.filter(
  (write) => /INSERT INTO child_progress_projection/.test(write.sql),
);

const PROGRESS = {
  childId: 'child_12345678',
  contentType: 'episode',
  contentId: 'ep-1',
  positionMs: 90_000,
  durationMs: 600_000,
  completed: false,
  sequence: 3,
};

/* ------------------------------------------------------------ إسقاط التقدّم */

test('تقدّم الطفل يُسقَط في صفّ حقيقي', async () => {
  // معيار القبول الأول. الحدث كان يُفكّ ويُعَدّ في `processed_family_events` ثم
  // يُرمى: لا جدول يستقبله.
  const db = fakeDb();
  const result = await processFamilyEvent({ DB: db }, event('progress.updated', PROGRESS));
  assert.equal(result.accepted, true);

  const writes = progressWrites(db);
  assert.equal(writes.length, 1);
  const [childId, contentType, contentId, parentId, positionMs, durationMs, completed] = writes[0].params;
  assert.equal(childId, 'child_12345678');
  assert.equal(contentType, 'episode');
  assert.equal(contentId, 'ep-1');
  assert.equal(parentId, 'parent_12345678');
  assert.equal(positionMs, 90_000, 'المللي كما هي: التخزين بدقّة أقل يُفقد الاستكمال');
  assert.equal(durationMs, 600_000);
  assert.equal(completed, 0);
});

test('الإكمال يُسجَّل ويُعَدّ', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('content.completed', { ...PROGRESS, completed: true }));
  const [, , , , , , completed, completions, , completedAt] = progressWrites(db)[0].params;
  assert.equal(completed, 1);
  assert.equal(completions, 1, 'عدّاد الإكمال هو ما كان `watch_count` يعنيه');
  assert.equal(completedAt, 1_700_000_000_000);
});

test('نوع المحتوى جزء من الهوية لا صفة', async () => {
  // `watch_progress` القديم مفتاحه `(child_id, episode_id)`، فالكتب والقصص
  // والألعاب لا موضع لها فيه — وقد صارت نصف المحتوى.
  const db = fakeDb();
  for (const contentType of ['episode', 'game', 'story', 'book']) {
    await processFamilyEvent({ DB: db }, event('progress.updated', { ...PROGRESS, contentType }, 1_700_000_000_001));
  }
  const types = progressWrites(db).map((write) => write.params[1]);
  assert.deepEqual(types, ['episode', 'game', 'story', 'book']);
  assert.match(progressWrites(db)[0].sql, /ON CONFLICT\(child_id, content_type, content_id\)/);
});

test('حدث أقدم لا يُرجِع الموضع إلى الوراء', async () => {
  // الطابور لا يضمن ترتيبًا. ونبضةٌ متأخّرة كانت ستُرجع الطفل إلى حيث كان قبل
  // دقيقة، فيبدأ من أوّل الحلقة بعد أن شاهد نصفها.
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('progress.updated', PROGRESS));
  const sql = progressWrites(db)[0].sql;
  assert.match(sql, /WHERE excluded\.last_event_at_ms >= child_progress_projection\.last_event_at_ms/);
  // والمدّة والإكمال يُثبَّتان بالأكبر لا بالأحدث.
  assert.match(sql, /duration_ms = MAX\(/);
  assert.match(sql, /completed = MAX\(/);
});

test('الإسقاط يحترم علامات الحذف', async () => {
  // طفل محذوف أو أسرة محذوفة: صفٌّ جديد بعد الحذف يُعيد بناء ما طُلب محوه.
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('progress.updated', PROGRESS));
  const sql = progressWrites(db)[0].sql;
  assert.match(sql, /NOT EXISTS \(\s*SELECT 1 FROM child_deletion_watermarks/);
  assert.match(sql, /NOT EXISTS \(\s*SELECT 1 FROM family_deletion_watermarks/);
});

test('حدث تقدّم بلا هوية محتوى يُرفَض بصوت', async () => {
  // الرفض يرفع، فيُعيد الطابور المحاولة ويظهر في الـDLQ — لا يُكتب صفًّا ناقصًا.
  const db = fakeDb();
  await assert.rejects(
    processFamilyEvent({ DB: db }, event('progress.updated', { childId: 'child_1' })),
    /invalid_progress_event/,
  );
});

test('التكرار لا يُضاعف عدّاد الإكمال', async () => {
  // مفتاح الحدث هو `event_id` الذي أرسله العميل — نفسه مفتاح عدم التكرار في
  // الكائن — فالتكرار مُستبعَد من طرف إلى طرف.
  const seen = {
    ...fakeDb(),
    prepare(sql) {
      const isSeenCheck = /FROM processed_family_events WHERE event_id/.test(sql);
      return {
        bind: () => ({
          async first() { return isSeenCheck ? { seen: 1 } : null; },
          async run() { return { meta: { changes: 1 } }; },
        }),
      };
    },
    writes: [],
  };
  const result = await processFamilyEvent({ DB: seen }, event('content.completed', PROGRESS));
  assert.equal(result.duplicate, true);
  assert.equal(seen.writes.length, 0);
});

/* ------------------------------------------- تعديل الطفل يصل إلى الإسقاط */

test('تعديل الاسم المستعار يصل إلى الإسقاط', async () => {
  // كان `child.updated` يُصدَر ويُدقَّق **ولا يصل إلى الإسقاط إطلاقًا**، فتبقى
  // اللوحة تعرض الاسم القديم إلى الأبد.
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('child.updated', {
    childId: 'child_12345678',
    fields: ['nickname'],
    nickname: 'ليان',
  }));
  const update = db.writes.find((write) => /UPDATE child_projection/.test(write.sql));
  assert.ok(update, 'تعديل الطفل يجب أن يُطبَّق');
  assert.equal(update.params[0], 'ليان');
  // `COALESCE` لا إسناد: الحدث جزئيّ، وإسناد `NULL` لما لم يُرسَل يمحو حقلًا
  // لم يُطلَب تعديله.
  assert.match(update.sql, /nickname = COALESCE\(\?, nickname\)/);
});

test('انتقال المسار العمري يصل إلى الإسقاط', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('child.track_transitioned', {
    childId: 'child_12345678',
    previousTrack: 'kids',
    ageTrack: 'junior',
  }));
  const update = db.writes.find((write) => /UPDATE child_projection/.test(write.sql));
  assert.equal(update.params[1], 'junior');
});

test('مسار عمري غير معروف لا يُكتب', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('child.track_transitioned', {
    childId: 'child_12345678',
    ageTrack: 'teen',
  }));
  const update = db.writes.find((write) => /UPDATE child_projection/.test(write.sql));
  assert.equal(update.params[1], null, 'قيمة خارج القائمة تصير NULL فيحفظها COALESCE');
});

/* --------------------------------------------- لا قارئ لجدول بلا كاتب */

test('لا مسار يقرأ جدولًا بلا كاتب', () => {
  // معيار القبول الثالث. الجدولان مُسقَطان، و`children_profiles` بلا قارئ — وهذا
  // ما يجعل إسقاطه لاحقًا تنظيفًا لا تغييرًا في السلوك.
  const dead = ['children_profiles', 'watch_progress', 'child_screen_time_daily'];
  const offenders = [];
  const walk = (relative) => {
    for (const entry of readdirSync(root + relative, { withFileTypes: true })) {
      const next = `${relative}${entry.name}`;
      if (entry.isDirectory()) walk(`${next}/`);
      else if (entry.name.endsWith('.ts')) {
        // التعليقات تُحيَّد: شرحُ سبب الهجر يذكر الأسماء.
        const code = read(next).split('\n')
          .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*')
            && !line.trimStart().startsWith('/*') && !line.trimStart().startsWith('///'))
          .join('\n');
        for (const table of dead) {
          if (new RegExp(`(FROM|JOIN|INTO|UPDATE)\\s+${table}\\b`).test(code)) {
            offenders.push(`${next}: ${table}`);
          }
        }
      }
    }
  };
  walk('src/');
  assert.deepEqual(offenders, [], 'جدول بلا كاتب لا يُقرأ');
});

test('الجدولان بلا قارئ أُسقطا بمهاجرة', () => {
  const migration = read('migrations/0086_child_progress_projection.sql');
  assert.match(migration, /DROP TABLE IF EXISTS watch_progress/);
  assert.match(migration, /DROP TABLE IF EXISTS child_screen_time_daily/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS child_progress_projection/);
  // بلا مفاتيح أجنبية: نمط الإسقاط في 0008. المفتاح الأجنبي إلى جدول بلا كاتب
  // هو ما جعل إحياء `watch_progress` يحتاج إحياء سلسلة كاملة.
  assert.equal(/REFERENCES/.test(migration), false);
});
