/// Regression coverage for GET /admin/planets/:id (routes/adminPlanets.ts, moved there
/// from adminContent.ts when planets grew a workspace).
///
/// ## The defect these tests pin
///
/// Every admin list reads age tracks as `(SELECT GROUP_CONCAT(track_id) ...) AS
/// track_ids`, so a raw D1 row carries the string `'preschool,kids'` — or NULL
/// when the entity has no track rows at all. The dashboard declares the field
/// as `AgeTrack[]` (front/src/types/api.ts: PlanetSeriesSummary) and renders it
/// with `.map()`.
///
/// The series summaries embedded in this endpoint were returned straight from
/// the query, unlike the series rows from GET /admin/series which pass through
/// `serializeSeries`. Opening any planet therefore threw
/// `track_ids.map is not a function` inside the render, and React unmounted the
/// whole route: the planet drill-down was a blank screen for every planet, not
/// a missing badge.
///
/// The handler is reached through the router with a stubbed D1, so dispatch,
/// SQL shape and the serialization are all exercised together.

import assert from 'node:assert/strict';
import test from 'node:test';

/// Matches on the longest distinctive fragment of each statement. The planet
/// row's own SQL embeds `FROM series s WHERE s.planet_id = p.id` in its
/// series_count subquery, so the series list is keyed on its ORDER BY instead.
function fakeDb(matchers = []) {
  const ranked = [...matchers].sort((a, b) => b[0].length - a[0].length);
  const terminals = (sql) => {
    const run = () => {
      const hit = ranked.find(([needle]) => sql.includes(needle));
      return hit ? hit[1] : [];
    };
    return {
      async first() { const rows = run(); return rows.length ? rows[0] : null; },
      async all() { return { results: run() }; },
      async run() { run(); return { meta: { changes: 1 } }; },
    };
  };
  return {
    prepare(sql) {
      return { bind: () => terminals(sql), ...terminals(sql) };
    },
  };
}

const PLANET_ROW = {
  id: 'qisas', name_ar: 'كوكب القصص', name_en: 'Stories', color_hex: '#4ECDC4',
  sort_order: 1, is_active: 1, series_count: 2, assets_count: 4, icon_url: null, cover_url: null,
};

const seriesRow = (over = {}) => ({
  id: 'series-1', title_ar: 'نوما والأرقام', title_en: 'Noma', slug: 'noma',
  type: 'continuous', age_min: 6, age_max: 8, status: 'published',
  cover_url: null, sort_order: 1, episodes_count: 3, track_ids: 'kids',
  ...over,
});

function db(series) {
  return fakeDb([
    ['FROM planets p WHERE p.id = ?', [PLANET_ROW]],
    ['ORDER BY s.sort_order ASC, s.updated_at DESC', series],
    ['FROM categories c WHERE c.is_active = 1', [
      { id: 'letters', name_ar: 'حروف', name_en: 'Letters', color_hex: '#fff', series_count: 1 },
      { id: 'empty', name_ar: 'فارغ', name_en: 'Empty', color_hex: '#fff', series_count: 0 },
    ]],
  ]);
}

async function call(series) {
  const { default: route } = await import('../src/routes/adminPlanets.ts');
  const env = { DB: db(series), ENVIRONMENT: 'development', PUBLIC_ASSET_BASE_URL: undefined };
  const response = await route.request('/planets/qisas', {}, env);
  return { status: response.status, body: await response.json().catch(() => null) };
}

test('embedded series carry track_ids as an array the dashboard can map over', async () => {
  const { status, body } = await call([
    seriesRow({ id: 'series-1', track_ids: 'kids' }),
    seriesRow({ id: 'series-2', track_ids: 'preschool,kids' }),
  ]);

  assert.equal(status, 200);
  assert.equal(body.success, true);
  for (const item of body.data.series) {
    assert.ok(Array.isArray(item.track_ids), `${item.id} must expose an array, not ${typeof item.track_ids}`);
  }
  assert.deepEqual(body.data.series[0].track_ids, ['kids']);
  assert.deepEqual(body.data.series[1].track_ids, ['preschool', 'kids']);
});

test('a series with no track rows reads back as an empty array, never null', async () => {
  // GROUP_CONCAT over no rows returns NULL, which is the case that used to
  // throw on `.map` just as loudly as the populated one.
  const { body } = await call([seriesRow({ track_ids: null })]);
  assert.deepEqual(body.data.series[0].track_ids, []);
});

test('the planet payload keeps its own shape and drops empty categories', async () => {
  const { body } = await call([seriesRow()]);
  assert.equal(body.data.id, 'qisas');
  assert.equal(body.data.is_active, true);
  assert.deepEqual(body.data.categories.map((item) => item.id), ['letters']);
});

test('a missing planet is a 404, not an empty workspace', async () => {
  const { default: route } = await import('../src/routes/adminPlanets.ts');
  const env = { DB: fakeDb([]), ENVIRONMENT: 'development', PUBLIC_ASSET_BASE_URL: undefined };
  const response = await route.request('/planets/nope', {}, env);
  assert.equal(response.status, 404);
});
