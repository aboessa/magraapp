import assert from 'node:assert/strict';
import test from 'node:test';

// Validates: Requirements 4.3, 4.4, 4.6
//
// Covers the fields added to `GET /stories/:id` by task 8 (narrators,
// listen_duration_ms, characters, similar, chapters, activities): a fully
// populated story, a story with none of those sources, the existing
// unpublished-story 404 behaviour, and a malformed `reference_images` value
// that must not crash the request.

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

test('story detail returns all extended fields when every source has data', async () => {
  const db = fakeDb([
    ['SELECT s.id FROM stories s', [{ id: 'story-bird-home' }]],
    ['SELECT s.id, s.slug, s.title_ar', [{
      id: 'story-bird-home', slug: 'bird-home', title_ar: 'بيت الطائر',
      default_language: 'ar', languages: null,
    }]],
    ['SELECT DISTINCT spl.language', [{ language: 'ar' }]],
    ['SELECT SUM(duration_ms) AS total FROM story_pages', [{ total: 5480 }]],
    ['SELECT DISTINCT ch.id, ch.name_ar, ch.reference_images', [
      { id: 'char-1', name_ar: 'زُغب', reference_images: '["https://cdn/img.jpg"]' },
    ]],
    ['SELECT s.id, s.title_ar,', [{ id: 'story-other', title_ar: 'قصة أخرى' }]],
  ]);

  const { status, body } = await publicCall(db, '/story-bird-home');
  assert.equal(status, 200);
  const { data } = body;

  assert.equal(data.narrators.length, 1);
  assert.equal(data.narrators[0].language, 'ar');

  assert.equal(data.listen_duration_ms, 5480);

  assert.equal(data.characters.length, 1);
  assert.equal(data.characters[0].avatar_url, 'https://cdn/img.jpg');

  assert.equal(data.similar.length, 1);
  assert.equal(data.similar[0].id, 'story-other');

  assert.deepEqual(data.chapters, []);
  assert.deepEqual(data.activities, []);
});

test('story detail returns explicit empty defaults when no source has data', async () => {
  const db = fakeDb([
    ['SELECT s.id FROM stories s', [{ id: 'story-bird-home' }]],
    ['SELECT s.id, s.slug, s.title_ar', [{
      id: 'story-bird-home', slug: 'bird-home', title_ar: 'بيت الطائر',
      default_language: 'ar', languages: null,
    }]],
    // All companion queries fall through to the default `[]` fakeDb rows.
  ]);

  const { status, body } = await publicCall(db, '/story-bird-home');
  assert.equal(status, 200);
  const { data } = body;

  assert.deepEqual(data.narrators, []);
  assert.equal(data.listen_duration_ms, null);
  assert.deepEqual(data.characters, []);
  assert.deepEqual(data.similar, []);
  assert.deepEqual(data.chapters, []);
  assert.deepEqual(data.activities, []);
});

test('unpublished story keeps the existing 404 behaviour', async () => {
  const db = fakeDb([
    ['SELECT s.id FROM stories s', []],
  ]);
  const { status, body } = await publicCall(db, '/story-bird-home');
  assert.equal(status, 404);
  assert.equal(body.error, 'Story not found');
});

test('malformed reference_images yields a null avatar_url without failing the request', async () => {
  const db = fakeDb([
    ['SELECT s.id FROM stories s', [{ id: 'story-bird-home' }]],
    ['SELECT s.id, s.slug, s.title_ar', [{
      id: 'story-bird-home', slug: 'bird-home', title_ar: 'بيت الطائر',
      default_language: 'ar', languages: null,
    }]],
    ['SELECT DISTINCT ch.id, ch.name_ar, ch.reference_images', [
      { id: 'char-1', name_ar: 'زُغب', reference_images: 'not-json' },
    ]],
  ]);

  const { status, body } = await publicCall(db, '/story-bird-home');
  assert.equal(status, 200);
  assert.equal(body.data.characters.length, 1);
  assert.equal(body.data.characters[0].avatar_url, null);
});
