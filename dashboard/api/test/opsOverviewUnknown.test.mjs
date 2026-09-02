import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * `ADM-106` — قراءةٌ فاشلة تُعرض «غير معروف» لا صفرًا.
 *
 * ## العطل
 *
 * عدّادات `/admin/ops/overview` كانت تبدأ من `0` وكل استعلام محاطًا بـ`catch {}`
 * فارغة. فقراءةٌ فاشلة تُبقي الصفر ويُشحَن **كأنه قياس**: «صفر تنبيهات نشطة»
 * بينما الحقيقة أن الجدول لم يُقرأ. وأخطر منه أن `overall_health` يبقى
 * `'healthy'`، فتُعلن الشاشة سلامةً مبنيّة على فشلٍ صامت — في الشاشة التي لا
 * تُفتَح إلا حين يُشتبه في وجود خلل.
 *
 * ## ما تحرسه هذه المجموعة
 *
 * أن الفرق بين «لا يوجد» و«لا نعرف» يصل إلى العميل: `null` مع اسم المسبار الفاشل،
 * وحالةٌ عامّة لا تُعلن السلامة. وأن الصفر الحقيقي يبقى صفرًا — فحرسٌ يحوّل كل
 * صفر إلى شرطة يُخفي الحقيقة من الجهة الأخرى.
 */

/// D1 وهمية تُجيب حسب مقطع من نصّ الاستعلام، ويمكن إفشال استعلامات بعينها.
function fakeDb({ answers = {}, failOn = [] } = {}) {
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
  const statement = (sql) => ({
    bind() { return statement(sql); },
    async first() { guard(sql); return rowsFor(sql); },
    async all() { guard(sql); const r = rowsFor(sql); return { results: Array.isArray(r) ? r : [] }; },
    async run() { guard(sql); return { meta: { changes: 1 } }; },
  });
  return { prepare: (sql) => statement(sql), async batch(list) { return list } };
}

async function overview(db) {
  const { default: route } = await import('../src/routes/adminOpsReliability.ts');
  const env = { DB: db, ENVIRONMENT: 'development', ADMIN_API_KEY: undefined };
  const response = await route.request('/ops/overview', {}, env);
  const body = await response.json().catch(() => null);
  return { status: response.status, data: body?.data ?? null };
}

const HEALTHY_ANSWERS = {
  "FROM failed_family_events WHERE status='pending'": { cnt: 0 },
  "FROM ops_alerts WHERE status IN ('open','acknowledged')": { cnt: 0 },
  'FROM ops_incidents': { cnt: 0 },
  'FROM queue_health': { pending: 0 },
};

test('a real zero stays a zero', async () => {
  // الحرس يجب أن يفرّق في الاتجاهين: تحويل كل صفر إلى شرطة يُخفي الحقيقة أيضًا.
  const { status, data } = await overview(fakeDb({ answers: HEALTHY_ANSWERS }));
  assert.equal(status, 200);
  assert.equal(data.active_alerts, 0);
  assert.equal(data.failed_queue_events, 0);
  assert.equal(data.critical_incidents, 0);
  assert.deepEqual(data.unavailable_probes, []);
  assert.equal(data.overall_health, 'healthy');
});

test('a failed read is null, not zero, and names its probe', async () => {
  const { data } = await overview(fakeDb({
    answers: HEALTHY_ANSWERS,
    failOn: ["FROM ops_alerts WHERE status IN ('open','acknowledged')"],
  }));
  assert.equal(data.active_alerts, null, 'a table that was not read must not report zero');
  assert.equal(data.failed_queue_events, 0, 'the probes that did succeed keep their values');
  const named = data.unavailable_probes.map((p) => p.probe);
  assert.deepEqual(named, ['ops_alerts'], 'the reason must name the probe, or the dash is unexplained');
});

test('health is not declared when a probe failed', async () => {
  const { data } = await overview(fakeDb({
    answers: HEALTHY_ANSWERS,
    failOn: ['FROM ops_incidents'],
  }));
  assert.equal(data.critical_incidents, null);
  assert.equal(data.overall_health, 'unknown', 'silence on a failed probe must not read as healthy');
});

test('a measured problem outranks an unknown', async () => {
  // ما قِيس وظهر سيّئًا أقوى دليلًا من قراءةٍ لم تنجح، فلا يُخفَّف إلى «غير معروف».
  const { data } = await overview(fakeDb({
    answers: { ...HEALTHY_ANSWERS, "FROM failed_family_events WHERE status='pending'": { cnt: 24 } },
    failOn: ["FROM ops_alerts WHERE status IN ('open','acknowledged')"],
  }));
  assert.equal(data.failed_queue_events, 24);
  assert.equal(data.active_alerts, null);
  assert.equal(data.overall_health, 'degraded');
});
