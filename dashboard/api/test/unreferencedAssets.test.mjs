import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * `CNT-104` — تقرير الأصول التي لا يشير إليها شيء.
 *
 * ## العلّة، وما كان ناقصًا في وصفها
 *
 * البند يقول إن **مسارَي ربط** يتعايشان (`asset_links` للحلقات، وعمودٌ مباشر
 * للقصص)، وإن أي تقرير «أصول غير مستخدمة» يجب أن يعرف الاثنين وإلّا أعطى نتيجة
 * خاطئة. وبالقياس: **ستة عشر مفتاحًا أجنبيًّا في ثلاثة عشر جدولًا**.
 *
 * فتقريرٌ يُبنى على وصف البند نفسه يبقى خاطئًا — وخاطئًا في الاتجاه الذي يُحذَف فيه
 * أصلٌ مستخدَم. ولذلك تُقرأ المسارات من كتالوج SQLite في كل نداء: عمودٌ جديد
 * يُغطّى لحظةَ وصول ترحيله، بلا ما يُتذكَّر.
 *
 * ## ما تحرسه هذه المجموعة
 *
 * أن الاكتشاف يقرأ الأعمدة من نصّ المخطَّط لا من قائمة مكتوبة · وأن **صفر مسارات
 * يعني رفضًا** لا تقريرًا يسمّي كل أصل يتيمًا (وهي دعوةٌ إلى حذفٍ جماعي) · وأن
 * أصلًا مربوطًا بأي مسارٍ لا يُبلَّغ عنه · وأن `archived` مستثنًى افتراضًا لأنه قرارٌ
 * اتُّخذ لا طرفٌ سائب.
 */

/// D1 وهمية تُجيب حسب مقطع من نصّ الاستعلام، وتسجّل الاستعلامات المُنفَّذة.
function fakeDb({ answers = {}, recorder } = {}) {
  const rowsFor = (sql) => {
    for (const [needle, value] of Object.entries(answers)) {
      if (sql.includes(needle)) return value;
    }
    return null;
  };
  const statement = (sql, params = []) => ({
    bind(...next) { return statement(sql, next); },
    async first() {
      if (recorder) recorder.push({ sql, params });
      const r = rowsFor(sql);
      return Array.isArray(r) ? (r[0] ?? null) : r;
    },
    async all() {
      if (recorder) recorder.push({ sql, params });
      const r = rowsFor(sql);
      return { results: Array.isArray(r) ? r : (r ? [r] : []) };
    },
    async run() { return { meta: { changes: 1 } }; },
  });
  return { prepare: (sql) => statement(sql), async batch(list) { return list } };
}

/// مخطَّطٌ مصغَّر يشبه الحقيقي: عمودٌ باسم `asset_id` وآخر بلاحقة مختلفة.
const SCHEMA = [
  { name: 'asset_links', sql: 'CREATE TABLE asset_links (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE, entity_type TEXT)' },
  { name: 'story_page_localizations', sql: 'CREATE TABLE story_page_localizations (id TEXT PRIMARY KEY, narration_asset_id TEXT REFERENCES content_assets(id) ON DELETE SET NULL)' },
  { name: 'story_pages', sql: 'CREATE TABLE story_pages (id TEXT PRIMARY KEY, image_asset_id TEXT REFERENCES content_assets(id) ON DELETE SET NULL, background_asset_id TEXT REFERENCES content_assets(id) ON DELETE SET NULL)' },
];

async function unreferenced(db, query = '') {
  const { default: route } = await import('../src/routes/adminAssets.ts');
  const env = { DB: db, ENVIRONMENT: 'development', ADMIN_API_KEY: undefined };
  const response = await route.request(`/assets/unreferenced${query}`, {}, env);
  const body = await response.json().catch(() => null);
  return { status: response.status, data: body?.data ?? null, error: body?.error ?? null };
}

test('the reference paths are discovered from the schema, not from a written list', async () => {
  const { status, data } = await unreferenced(fakeDb({
    answers: { 'FROM sqlite_master': SCHEMA },
  }));
  assert.equal(status, 200);
  const pairs = data.checked_paths.map((p) => `${p.table}.${p.column}`).sort();
  // العمودان في `story_pages` كلاهما يُكتشَف: قاعدةٌ على لاحقة `_asset_id` وحدها
  // كانت تُسقط `asset_id`، وقائمةٌ مكتوبة تُسقط ما يأتي بعدها.
  assert.deepEqual(pairs, [
    'asset_links.asset_id',
    'story_page_localizations.narration_asset_id',
    'story_pages.background_asset_id',
    'story_pages.image_asset_id',
  ]);
});

test('every discovered path becomes a NOT EXISTS clause', async () => {
  const recorder = [];
  await unreferenced(fakeDb({ answers: { 'FROM sqlite_master': SCHEMA }, recorder }));
  const listing = recorder.find((entry) => entry.sql.includes('FROM content_assets ca') && entry.sql.includes('LIMIT'));
  assert.ok(listing, 'the asset listing query was never issued');
  for (const pair of [
    'FROM asset_links t WHERE t.asset_id = ca.id',
    'FROM story_page_localizations t WHERE t.narration_asset_id = ca.id',
    'FROM story_pages t WHERE t.image_asset_id = ca.id',
    'FROM story_pages t WHERE t.background_asset_id = ca.id',
  ]) {
    assert.ok(listing.sql.includes(pair), `missing clause: ${pair}`);
  }
});

test('archived assets are excluded by default and shown on request', async () => {
  const recorder = [];
  await unreferenced(fakeDb({ answers: { 'FROM sqlite_master': SCHEMA }, recorder }));
  const first = recorder.find((entry) => entry.sql.includes('FROM content_assets ca'));
  assert.ok(first.sql.includes("ca.status <> 'archived'"), 'archived must be excluded by default');

  const recorder2 = [];
  await unreferenced(fakeDb({ answers: { 'FROM sqlite_master': SCHEMA }, recorder: recorder2 }), '?include_archived=1');
  const second = recorder2.find((entry) => entry.sql.includes('FROM content_assets ca'));
  assert.ok(!second.sql.includes("ca.status <> 'archived'"), 'include_archived=1 must widen the report');
});

test('discovering no reference path is refused, not reported as everything unused', async () => {
  // أخطر حالة في هذا التقرير: لو فشل الاكتشاف لظهر كل أصل يتيمًا، فتُدعى إلى حذف
  // جماعي بثقةٍ كاملة. الرفض هو الجواب الصادق الوحيد.
  const { status, error } = await unreferenced(fakeDb({ answers: { 'FROM sqlite_master': [] } }));
  assert.equal(status, 500);
  assert.match(String(error), /refusing/i);
});

test('the limit is capped, and a kind filter is passed as a parameter', async () => {
  const recorder = [];
  const { data } = await unreferenced(
    fakeDb({ answers: { 'FROM sqlite_master': SCHEMA }, recorder }),
    '?kind=audio&limit=99999',
  );
  assert.equal(data.limit, 1000);
  const listing = recorder.find((entry) => entry.sql.includes('FROM content_assets ca') && entry.sql.includes('LIMIT'));
  assert.ok(listing.sql.includes('ca.kind = ?'), 'the kind must be bound, not interpolated');
  assert.equal(listing.params[0], 'audio');
});

test('the report says what it checked, so its coverage is not invisible', async () => {
  // تقريرٌ لا تُرى تغطيته لا يُوثَق به — وغياب الرؤية هو كيف صار «مسارَان» وصفًا
  // مقبولًا لثلاثة عشر جدولًا.
  const { data } = await unreferenced(fakeDb({ answers: { 'FROM sqlite_master': SCHEMA } }));
  assert.ok(Array.isArray(data.checked_paths));
  assert.equal(data.checked_paths.length, 4);
});
