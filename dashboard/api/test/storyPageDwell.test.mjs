import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// `duration_ms` is narration audio only; `dwell_ms` is the authored
// illustration viewing time that follows it. Both must reach the app, and
// neither may be invented server side.

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

async function call(module, db, path) {
  const { default: route } = await import(module);
  const res = await route.request(path, {}, env(db));
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('story pages expose dwell_ms alongside duration_ms', async () => {
  const db = fakeDb([
    ['SELECT s.id FROM stories s', [{ id: 'story-bird-home' }]],
    ['SELECT sp.id, sp.page_number', [
      { id: 'page-bird-home-001', page_number: 1, layout: 'full_bleed', transition: 'fade', duration_ms: 5480, dwell_ms: 13200, body_text: 'هذا زُغب.' },
      { id: 'page-bird-home-002', page_number: 2, layout: 'full_bleed', transition: 'fade', duration_ms: 4040, dwell_ms: null, body_text: 'اليوم يطير.' },
    ]],
  ]);
  const { status, body } = await call('../src/routes/stories.ts', db, '/story-bird-home/pages?language=ar');
  assert.equal(status, 200);
  assert.equal(body.data[0].duration_ms, 5480);
  assert.equal(body.data[0].dwell_ms, 13200);
  // A page with no authored dwell stays null: no arbitrary pause is invented.
  assert.equal(body.data[1].duration_ms, 4040);
  assert.equal(body.data[1].dwell_ms, null);
});

// `books.ts` eagerly imports the authenticated media helpers, so it cannot be
// instantiated under the plain node loader the way `stories.ts` can. The page
// query is asserted on the source instead: the reader loads book pages through
// this endpoint and must receive the same timing fields.
test('book pages query selects dwell_ms alongside duration_ms', () => {
  const source = readFileSync(path.join(ROOT, 'src/routes/books.ts'), 'utf8');
  const pageQuery = /SELECT sp\.id, sp\.page_number[\s\S]*?FROM story_pages sp/.exec(source);
  assert.ok(pageQuery, 'book page query not found');
  assert.match(pageQuery[0], /sp\.duration_ms/);
  assert.match(pageQuery[0], /sp\.dwell_ms/);
});

test('dwell schema migration is additive and nullable', () => {
  const sql = readFileSync(path.join(ROOT, 'migrations/0058_story_page_dwell.sql'), 'utf8');
  assert.match(sql, /ALTER TABLE story_pages ADD COLUMN dwell_ms INTEGER/);
  assert.match(sql, /dwell_ms IS NULL/, 'nullable for backward compatibility');
  assert.doesNotMatch(sql, /NOT NULL/);
  assert.doesNotMatch(sql, /DROP|DELETE FROM/i, 'must not be destructive');
});

test('dwell backfill is per page, never a blanket update', () => {
  const sql = readFileSync(path.join(ROOT, 'migrations/0060_story_page_dwell_recompute.sql'), 'utf8');
  const updates = sql
    .split('\n')
    .filter((line) => line.startsWith('UPDATE story_pages SET dwell_ms'));

  assert.ok(updates.length >= 80, `expected the affected page set, found ${updates.length}`);

  // Every statement must target one stable page id.
  for (const line of updates) {
    assert.match(line, /WHERE id = 'page-[a-z0-9-]+-\d{3}'/, `unscoped update: ${line}`);
  }

  // No `UPDATE ... SET dwell_ms = X` without a WHERE clause anywhere.
  assert.doesNotMatch(sql, /UPDATE story_pages SET dwell_ms = \d+;/);

  // Values must vary per page inside each story.
  const byStory = new Map();
  for (const line of updates) {
    const value = Number(/dwell_ms = (\d+)/.exec(line)[1]);
    const slug = /WHERE id = 'page-([a-z0-9-]+)-\d{3}'/.exec(line)[1];
    if (!byStory.has(slug)) byStory.set(slug, new Set());
    byStory.get(slug).add(value);
  }
  assert.equal(byStory.size, 10, 'the 10 affected stories');
  for (const [slug, values] of byStory) {
    assert.ok(values.size >= 4, `${slug} looks like a blanket value (${values.size} distinct)`);
  }
});

test('duration_ms is never rewritten by the dwell migrations', () => {
  for (const file of [
    'migrations/0058_story_page_dwell.sql',
    'migrations/0059_story_page_dwell_backfill.sql',
    'migrations/0060_story_page_dwell_recompute.sql',
  ]) {
    const sql = readFileSync(path.join(ROOT, file), 'utf8');
    const statements = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    assert.doesNotMatch(statements, /SET[^;]*duration_ms/, `${file} must not touch narration duration`);
  }
});

/// Stories and books carry no `content_class` of their own, so they are
/// classified through their parent series. These four public reads had no gate
/// at all, which was safe only by accident: nothing of either type is published
/// yet, so a fixture had nothing to leak through. The gate is asserted on the
/// source because it is interpolated into SQL rather than branched on at
/// runtime.
test('public story and book reads gate on the parent series content class', () => {
  const stories = readFileSync(path.join(ROOT, 'src/routes/stories.ts'), 'utf8');
  const books = readFileSync(path.join(ROOT, 'src/routes/books.ts'), 'utf8');

  for (const [name, source] of [['stories.ts', stories], ['books.ts', books]]) {
    const gates = source.match(/optionalContentClassPredicate\(/g) ?? [];
    assert.ok(
      gates.length >= 3,
      `${name} should gate its list, detail and pages reads; found ${gates.length}`,
    );
    assert.match(source, /shouldServeTestFixtures\(c\.env\)/, `${name} must resolve the flag from env`);
  }
});

test('the fixture gate tolerates content with no parent series', () => {
  // Using the strict predicate on a LEFT JOIN would compare NULL and hide every
  // unparented story and book, which is a different defect. The local database
  // does contain unparented stories.
  const source = readFileSync(path.join(ROOT, 'src/lib/contentClass.ts'), 'utf8');
  const helper = source.slice(source.indexOf('export function optionalContentClassPredicate'));
  assert.match(helper, /IS NULL OR/, 'unparented content must remain visible');
  assert.match(helper, /= 'production'/);
  assert.match(helper, /if \(serveTestFixtures\) return '';/, 'local development still opts in');
});
