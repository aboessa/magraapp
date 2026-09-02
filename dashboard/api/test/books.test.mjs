import assert from 'node:assert/strict';
import test from 'node:test';

// Validates: Requirements 4.3, 4.4, 4.6
//
// Covers the fields added to `GET /books/:id` by task 9 (narrators,
// listen_duration_ms, characters, similar, chapters, activities), mirroring
// `stories.test.mjs`, plus a case proving the task 9 `parseLanguages` fix
// actually reaches `/:id` for books.

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
  const { default: route } = await import('../src/routes/books.ts');
  const res = await route.request(path, {}, env(db));
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('book detail returns all extended fields when every source has data', async () => {
  const db = fakeDb([
    ['SELECT b.id FROM books b', [{ id: 'book-1' }]],
    ['SELECT b.id, b.series_id, b.title_ar', [{
      id: 'book-1', series_id: null, title_ar: 'كتاب', default_language: 'ar', languages: null,
    }]],
    ['SELECT DISTINCT spl.language', [{ language: 'ar' }]],
    ['SELECT SUM(duration_ms) AS total FROM story_pages', [{ total: 5480 }]],
    ['SELECT DISTINCT ch.id, ch.name_ar, ch.reference_images', [
      { id: 'char-1', name_ar: 'زُغب', reference_images: '["https://cdn/img.jpg"]' },
    ]],
    ['SELECT b2.id, b2.title_ar,', [{ id: 'book-2', title_ar: 'كتاب آخر' }]],
  ]);

  const { status, body } = await publicCall(db, '/book-1');
  assert.equal(status, 200);
  const { data } = body;

  assert.equal(data.narrators.length, 1);
  assert.equal(data.narrators[0].language, 'ar');

  assert.equal(data.listen_duration_ms, 5480);

  assert.equal(data.characters.length, 1);
  assert.equal(data.characters[0].avatar_url, 'https://cdn/img.jpg');

  assert.equal(data.similar.length, 1);
  assert.equal(data.similar[0].id, 'book-2');

  assert.deepEqual(data.chapters, []);
  assert.deepEqual(data.activities, []);
});

test('book detail returns explicit empty defaults when no source has data', async () => {
  const db = fakeDb([
    ['SELECT b.id FROM books b', [{ id: 'book-1' }]],
    ['SELECT b.id, b.series_id, b.title_ar', [{
      id: 'book-1', series_id: null, title_ar: 'كتاب', default_language: 'ar', languages: null,
    }]],
  ]);

  const { status, body } = await publicCall(db, '/book-1');
  assert.equal(status, 200);
  const { data } = body;

  assert.deepEqual(data.narrators, []);
  assert.equal(data.listen_duration_ms, null);
  assert.deepEqual(data.characters, []);
  assert.deepEqual(data.similar, []);
  assert.deepEqual(data.chapters, []);
  assert.deepEqual(data.activities, []);
});

test('unpublished book keeps the existing 404 behaviour', async () => {
  const db = fakeDb([
    ['SELECT b.id FROM books b', []],
  ]);
  const { status, body } = await publicCall(db, '/book-1');
  assert.equal(status, 404);
  assert.equal(body.error, 'Book not found');
});

test('malformed reference_images yields a null avatar_url without failing the request', async () => {
  const db = fakeDb([
    ['SELECT b.id FROM books b', [{ id: 'book-1' }]],
    ['SELECT b.id, b.series_id, b.title_ar', [{
      id: 'book-1', series_id: null, title_ar: 'كتاب', default_language: 'ar', languages: null,
    }]],
    ['SELECT DISTINCT ch.id, ch.name_ar, ch.reference_images', [
      { id: 'char-1', name_ar: 'زُغب', reference_images: 'not-json' },
    ]],
  ]);

  const { status, body } = await publicCall(db, '/book-1');
  assert.equal(status, 200);
  assert.equal(body.data.characters.length, 1);
  assert.equal(body.data.characters[0].avatar_url, null);
});

test('book detail exposes languages including the default language (task 9 fix)', async () => {
  const db = fakeDb([
    ['SELECT b.id FROM books b', [{ id: 'book-1' }]],
    ['SELECT b.id, b.series_id, b.title_ar', [{
      id: 'book-1', series_id: null, title_ar: 'كتاب', default_language: 'ar',
      languages: '["en"]',
    }]],
  ]);

  const { status, body } = await publicCall(db, '/book-1');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data.languages));
  assert.ok(body.data.languages.includes('ar'));
  assert.ok(body.data.languages.includes('en'));
});
