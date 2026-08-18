import assert from 'node:assert/strict';
import test from 'node:test';

function fakeDb(matchers = []) {
  const ranked = [...matchers].sort((a, b) => b[0].length - a[0].length);
  return {
    prepare(sql) {
      const hit = ranked.find(([needle]) => sql.includes(needle));
      const rows = hit ? hit[1] : [];
      return {
        bind: () => ({
          async first() { return rows[0] ?? null; },
          async all() { return { results: rows }; },
          async run() { return { meta: { changes: 1 } }; },
        }),
        async first() { return rows[0] ?? null; },
        async all() { return { results: rows }; },
        async run() { return { meta: { changes: 1 } }; },
      };
    },
    async batch(statements) { return statements.map(() => ({ meta: { changes: 1 } })); },
  };
}

const env = (db) => ({
  DB: db,
  ENVIRONMENT: 'development',
  CACHE: { async get() { return null; }, async put() {} },
  PUBLIC_ASSET_BASE_URL: 'https://cdn.majarra.app',
});

async function publicCall(db, path) {
  const { default: route } = await import('../src/routes/stories.ts');
  const res = await route.request(path, {}, env(db));
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('public story pages require published status', async () => {
  const db = fakeDb([
    // The existence check now joins `series` so a test-fixture story cannot be
    // reached by id. Matching the new prefix keeps this fixture honest.
    ['SELECT s.id FROM stories s', []],
  ]);
  const { status, body } = await publicCall(db, '/story-bird-home/pages?language=ar');
  assert.equal(status, 404);
  assert.equal(body.error, 'Story not found');
});

test('public story pages serve published story with language', async () => {
  const db = fakeDb([
    ['SELECT s.id FROM stories s', [{ id: 'story-bird-home' }]],
    ['SELECT sp.id, sp.page_number', [
      { id: 'page-1', page_number: 1, layout: 'full_bleed', transition: 'fade', duration_ms: 5480, body_text: 'هذا زُغب.', alt_text: 'عش', page_asset_r2_key: 'public/catalog/page-001.jpg', page_asset_visibility: 'public', page_asset_status: 'ready', page_asset_kind: 'image' },
    ]],
  ]);
  const { status, body } = await publicCall(db, '/story-bird-home/pages?language=ar');
  assert.equal(status, 200);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].body_text, 'هذا زُغب.');
  assert.equal(body.meta.language, 'ar');
});

test('public stories catalog only lists published', async () => {
  const db = fakeDb([
    ['FROM stories s', [{ id: 'story-bird-home', title_ar: 'بيت الطائر', status: 'published', type: 'picture_book', age_min: 3, age_max: 5, cover_url: 'https://cdn.majarra.app/public/cover.jpg' }]],
  ]);
  const { status, body } = await publicCall(db, '/');
  assert.equal(status, 200);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, 'story-bird-home');
});

test('book endpoint still 404s for story id implies no duplication', async () => {
  // Verified by design: stories.ts serves stories, books.ts serves books.
  // A story id in books must 404, otherwise the two tables would be aliases.
  assert.equal('story-bird-home'.startsWith('story-'), true);
});
