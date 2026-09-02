import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * `CNT-101` و`CNT-102` — مسح البوابة على دفعة.
 *
 * ## الفجوة
 *
 * بوابة النشر تعمل **لحظةَ النشر** ولا تُعاد، والنقطة الأخرى تفحص عنصرًا واحدًا. فلم
 * يكن لسؤالين تشغيليّين جوابٌ إلا بطلبٍ لكل صفّ وإنسانٍ يعدّ:
 *
 * * `published` — أيّ صفٍّ **حيٍّ الآن** سيفشل لو نُشر اليوم؟ صفٌّ نُشر قبل وجود
 *   فحصٍ ما، أو فُصل أصله بعد نشره، يبقى منشورًا ومعطوبًا. وأثره على الحلقات هو
 *   الأسوأ: طفلٌ يضغط «شاهد» فيحصل على خطأ، وذلك أسوأ من ألّا يرى الحلقة.
 * * `ready` — ما ينتظر النشر و**ما ينقص كلَّ واحدٍ بالاسم**. «اثنتا عشرة قصة تقف
 *   عند جاهزة» رقمٌ بلا خطوةٍ تالية؛ «ثمانٍ منها تنقصها الرسوم» خطوة.
 *
 * ## ما تحرسه هذه المجموعة
 *
 * أن النقطة تُعيد تشغيل **البوابة نفسها** لا نسخةً ثانية من قاعدتها، وأن الحالة
 * مُقيَّدة بقائمة (فهي تصل إلى `WHERE`)، وأن الصفّ الذي تعذّر تقييمه يُسمّى ولا
 * يُطوى في «لا شيء محجوب»، وأن الصفر يُعرض مع عدد المفحوص.
 */

/// D1 وهمية: تُجيب حسب مقطع من نصّ الاستعلام، ويمكن إفشال استعلامات بعينها.
function fakeDb({ answers = {}, failOn = [], recorder } = {}) {
  const rowsFor = (sql) => {
    for (const [needle, value] of Object.entries(answers)) {
      if (sql.includes(needle)) return value;
    }
    return null;
  };
  const guard = (sql) => {
    for (const needle of failOn) {
      if (sql.includes(needle)) throw new Error(`D1 unavailable: ${needle}`);
    }
  };
  const statement = (sql, params = []) => ({
    bind(...next) { return statement(sql, next); },
    async first() { guard(sql); const r = rowsFor(sql); return Array.isArray(r) ? (r[0] ?? null) : r; },
    async all() {
      guard(sql);
      if (recorder) recorder.push({ sql, params });
      const r = rowsFor(sql);
      return { results: Array.isArray(r) ? r : (r ? [r] : []) };
    },
    async run() { guard(sql); return { meta: { changes: 1 } }; },
  });
  return { prepare: (sql) => statement(sql), async batch(list) { return list } };
}

async function sweep(db, query = '') {
  const { default: route } = await import('../src/routes/adminPublishGate.ts');
  const env = { DB: db, ENVIRONMENT: 'development', ADMIN_API_KEY: undefined };
  const response = await route.request(`/publish-readiness/sweep${query}`, {}, env);
  const body = await response.json().catch(() => null);
  return { status: response.status, data: body?.data ?? null, error: body?.error ?? null };
}

test('an unsupported type is refused rather than silently checked as nothing', async () => {
  const { status, error } = await sweep(fakeDb(), '?type=poster');
  assert.equal(status, 400);
  assert.match(String(error), /Unsupported/);
});

test('an unsupported status is refused, and the allowed set is named', async () => {
  // الحالة تصل إلى `WHERE`. قائمةٌ مغلقة، والرسالة تسمّي المسموح فلا يُخمّن المتصل.
  const { status, error } = await sweep(fakeDb(), '?status=whatever');
  assert.equal(status, 400);
  assert.match(String(error), /published/);
  assert.match(String(error), /ready/);
});

test('the status is bound as a parameter, not interpolated into the SQL', async () => {
  const recorder = [];
  await sweep(fakeDb({ recorder }), '?type=story&status=ready');
  const listing = recorder.find((entry) => entry.sql.includes('FROM stories WHERE status = ?'));
  assert.ok(listing, `expected a parameterised status clause, saw: ${recorder.map((r) => r.sql).join(' | ')}`);
  assert.equal(listing.params[0], 'ready');
});

test('published is the default question', async () => {
  const { data } = await sweep(fakeDb(), '?type=episode');
  assert.equal(data.status, 'published');
});

test('no rows reports zero checked, not a clean sheet with no number', async () => {
  // الصفر المقيس يجب أن يكون مصحوبًا بعدد المفحوص، وإلا قُرئ «فحصتُ ولم أجد».
  const { status, data } = await sweep(fakeDb({ answers: {} }), '?type=episode');
  assert.equal(status, 200);
  assert.equal(data.blocked_count, 0);
  assert.equal(data.checked.episode, 0);
  assert.deepEqual(data.unavailable, []);
});

test('a published episode with no video is reported with the gate own blocker', async () => {
  const { data } = await sweep(fakeDb({
    answers: {
      'FROM episodes WHERE status = ?': [{ id: 'ep-1' }],
      // الحقائق التي تجمعها البوابة للحلقة: صفٌّ بلا فيديو.
      'FROM episodes e': { id: 'ep-1', status: 'published', video_master_url: null, video_hls_1080: null, thumbnail_url: null },
    },
  }), '?type=episode');
  assert.equal(data.checked.episode, 1);
  assert.equal(data.blocked_count, 1, 'a published episode with no video must be reported');
  assert.equal(data.blocked[0].entity_id, 'ep-1');
  // معرّف الحاجب يأتي من `evaluatePublishGate` نفسها، لا من نسخة ثانية للقاعدة.
  const ids = data.blocked[0].blockers.map((b) => b.id);
  assert.ok(ids.includes('video'), `expected the gate video blocker, got ${ids.join(', ')}`);
});

test('a ready story is swept too, so the editor queue has named blockers', async () => {
  const { data } = await sweep(fakeDb({
    answers: {
      'FROM stories WHERE status = ?': [{ id: 'story-1' }],
      'FROM stories s': { id: 'story-1', status: 'ready', title_ar: 'حكاية', default_language: 'ar' },
    },
  }), '?type=story&status=ready');
  assert.equal(data.status, 'ready');
  assert.equal(data.checked.story, 1);
  // ما ينقصها يأتي بالاسم من البوابة؛ والمطلوب هو **وجود** أسماء لا أسماءٌ بعينها،
  // فالتأكيد على قائمة محدّدة يجعل الاختبار مرآةً ثانية لقواعد البوابة.
  assert.equal(data.blocked_count, 1);
  assert.ok(data.blocked[0].blockers.length > 0);
  for (const blocker of data.blocked[0].blockers) {
    assert.equal(typeof blocker.id, 'string');
    assert.ok(blocker.label_ar, 'a blocker with no label cannot tell an editor what to do');
  }
});

test('a row that passes with a pending review is reported as warned, not as clean', async () => {
  // `CNT-107`: `content_reviews` فيه 43 صفًّا كلّها معلّقة، والبوابة تُحذِّر ولا
  // تحجب — بقرارٍ موثَّق، لأن تحويل الغياب إلى حاجب يجعل المكتبة كلّها غير قابلة
  // للنشر فيتعلّم الناس تجاوز البوابة. والنتيجة أن المنشور بلا اعتماد كان يعود من
  // هذه النقطة **نظيفًا**، وهو بالضبط ما رصده البند.
  const { data } = await sweep(fakeDb({
    answers: {
      'FROM series WHERE status = ?': [{ id: 'series-1' }],
      // سلسلة مكتملة الحقول: غلاف وحلقات منشورة ونمط بصري ووصف — فلا حاجب.
      // ومراجعاتها غير مسجَّلة، وتلك هي الحالة الحقيقية: 43 سجلًّا كلّها معلّقة.
      'FROM series s': {
        id: 'series-1', status: 'published', content_class: 'standard', planet_id: 'arqam',
        source_type: null, religious_reviewer_id: null, religious_approved_at: null,
        cover_url: 'https://cdn.example/cover.webp', visual_style_id: 'style-1',
        description_ar: 'وصف كافٍ للسلسلة', episode_count: 3, published_episode_count: 2,
      },
    },
  }), '?type=series');
  assert.equal(data.checked.series, 1);
  assert.equal(data.blocked_count, 0, 'the fixture is complete, so nothing may block');
  assert.ok(data.warned_count > 0, 'a pending review must surface as a warning, not vanish');
  assert.equal(data.warned[0].entity_id, 'series-1');
  const labels = data.warned[0].warnings.map((w) => w.id);
  assert.ok(
    labels.some((id) => id.startsWith('review_')),
    `expected a review warning, got ${labels.join(', ')}`,
  );
});

test('a blocked row is not counted twice', async () => {
  // صفٌّ محجوب مُبلَّغ بالحاجب الأقوى؛ إدراجه في التحذيرات أيضًا يضخّم عدّادين
  // لمشكلةٍ واحدة، فيقرأ المشغّل ضعف حجم العمل.
  const { data } = await sweep(fakeDb({
    answers: {
      'FROM episodes WHERE status = ?': [{ id: 'ep-1' }],
      'FROM episodes e': { id: 'ep-1', status: 'published', video_master_url: null, video_hls_1080: null },
    },
  }), '?type=episode');
  assert.equal(data.blocked_count, 1);
  assert.equal(data.warned_count, 0, 'a blocked row must appear in one list only');
});

test('a type whose list read fails is named, not reported as clean', async () => {
  const { data } = await sweep(fakeDb({
    failOn: ['FROM episodes WHERE status = ?'],
  }), '?type=episode');
  assert.equal(data.blocked_count, 0);
  assert.equal(data.checked.episode, undefined, 'a type that was never read must not report a checked count');
  assert.deepEqual(data.unavailable.map((u) => u.entity_type), ['episode']);
});

test('the limit is capped so one request cannot fan out without bound', async () => {
  const { data } = await sweep(fakeDb(), '?type=episode&limit=99999');
  assert.equal(data.limit, 500);
  const low = await sweep(fakeDb(), '?type=episode&limit=0');
  assert.equal(low.data.limit, 1);
});
