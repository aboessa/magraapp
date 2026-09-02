import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * `CNT-106` — قائمة الكواكب تقول ما فيها.
 *
 * ## العطل
 *
 * `GET /api/v1/planets` كانت تُعيد كل كوكب نشِط بلا أي إشارة إلى وجود محتوى فيه.
 * فتسع بطاقات متشابهة تُعرض لطفل، وبعضها لا شيء فيه، والطفل يدفع ثمن النقر ليعرف.
 *
 * ## ما تحرسه هذه المجموعة
 *
 * أن الحقلين يُشحنان (فالعميل لا يستطيع قول الحقيقة بلا الحقيقة)، وأن العدّ هو
 * **ما يمكن فتحه** لا عدد السلاسل: السلسلة مجلَّد، ونشرها لا يفتح شيئًا. وهذه هي
 * الحالة التي أخطأ فيها دليل البند نفسه في الاتجاهين.
 */

/// D1 وهمية تُجيب حسب مقطع من نصّ الاستعلام.
function fakeDb(answers = {}) {
  const rowsFor = (sql) => {
    for (const [needle, value] of Object.entries(answers)) {
      if (sql.includes(needle)) return value;
    }
    return null;
  };
  const statement = (sql) => ({
    bind() { return statement(sql); },
    async first() { const r = rowsFor(sql); return Array.isArray(r) ? (r[0] ?? null) : r; },
    async all() { const r = rowsFor(sql); return { results: Array.isArray(r) ? r : (r ? [r] : []) }; },
    async run() { return { meta: { changes: 1 } }; },
  });
  return { prepare: (sql) => statement(sql) };
}

async function planets(db) {
  const { default: route } = await import('../src/routes/planets.ts');
  const env = {
    DB: db,
    CACHE: { async get() { return null; }, async put() {} },
    PUBLIC_ASSET_BASE_URL: 'https://cdn.example',
  };
  const response = await route.request('/', {}, env);
  const body = await response.json().catch(() => null);
  return { status: response.status, data: body?.data ?? null };
}

test('the list reports how much of each planet a child can open', async () => {
  const { status, data } = await planets(fakeDb({
    'FROM planets WHERE is_active = 1': [
      { id: 'arqam', name_ar: 'الأرقام', published_series: 3, published_openable: 11 },
      { id: 'islamic', name_ar: 'الإيمان', published_series: 0, published_openable: 0 },
    ],
  }));
  assert.equal(status, 200);
  assert.equal(data.length, 2);
  assert.equal(data[0].published_openable, 11);
  assert.equal(data[1].published_openable, 0, 'an empty planet must say so, not stay silent');
});

test('the query counts openable items, not published series', async () => {
  // السلسلة مجلَّد: نشرها لا يفتح شيئًا. ودليل البند عدّ الحلقات وحدها فوصف
  // `maharat` فارغًا وفيه ثلاثة عناصر تُفتح، ووصف `qiyam` ممتلئًا وليس فيه شيء.
  const { default: route } = await import('../src/routes/planets.ts');
  const seen = [];
  const db = {
    prepare(sql) {
      seen.push(sql);
      const statement = { bind() { return statement }, async all() { return { results: [] } }, async first() { return null } };
      return statement;
    },
  };
  await route.request('/', {}, {
    DB: db,
    CACHE: { async get() { return null; }, async put() {} },
  });
  const listing = seen.find((sql) => sql.includes('FROM planets WHERE is_active = 1'));
  assert.ok(listing, 'the planet listing query was never issued');
  assert.match(listing, /published_openable/);
  for (const table of ['FROM episodes', 'FROM stories', 'FROM games', 'FROM books']) {
    assert.ok(listing.includes(table), `the openable count ignores ${table}`);
  }
  // والسلاسل تبقى معروضة منفصلة، فلا تختلط بما يُفتح.
  assert.match(listing, /published_series/);
});
