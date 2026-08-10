/// Tests for the internal SEO audit.
///
/// ## The claim this file protects
///
/// The audit is allowed to say "your database is inconsistent". It is not allowed to imply
/// "your site is indexed", because no search-engine integration exists. The payload has to
/// carry that distinction itself — `source`, `index_status_available` and `coverage` — since
/// a screen that forgets it turns "0 errors" into "we are ranking".
///
/// ## Why the checks are asserted one at a time
///
/// A report that fires on a legitimate state is a report people learn to close. Each test
/// below pins both directions: the defect is found, and the normal case next to it is not
/// flagged. Drafts, single-language translation groups and the home page are the three
/// normal states that a naive version of each check gets wrong.

import assert from 'node:assert/strict';
import test from 'node:test';

const NO_ADMIN_USERS = ['FROM admin_credentials', [{ total: 0 }]];

function fakeDb(matchers = []) {
  const ranked = [...matchers, NO_ADMIN_USERS].sort((a, b) => b[0].length - a[0].length);
  const terminals = (sql, params) => {
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
      return { bind: (...params) => terminals(sql, params), ...terminals(sql, []) };
    },
    async batch(statements) { return statements.map(() => ({ meta: { changes: 1 } })); },
  };
}

const page = (overrides = {}) => ({
  id: 'page-1', path: '/ar/plans', slug: 'plans', kind: 'standard', title: 'الباقات',
  language: 'ar', status: 'published', translation_group: 'plans', is_indexable: 1,
  seo_title: 'الباقات', meta_description: 'وصف كافٍ للباقات يشرح ما تحتويه كل واحدة منها.',
  canonical_url: null, robots_index: 1,
  ...overrides,
});

const post = (overrides = {}) => ({
  id: 'post-1', path: '/ar/blog/hello', slug: 'hello', title: 'مرحبًا', language: 'ar',
  status: 'published', translation_group: 'hello',
  seo_title: 'مرحبًا', meta_description: 'وصف كافٍ للمقال يشرح موضوعه بما يكفي لنتيجة البحث.',
  canonical_url: null, robots_index: 1,
  ...overrides,
});

function db({ pages = [], posts = [], seoMeta = [], redirects = [], sections = [], bodies = [] } = {}) {
  return fakeDb([
    ['FROM web_pages p\n      LEFT JOIN seo_meta', pages],
    ['FROM blog_posts b\n      LEFT JOIN seo_meta', posts],
    ['FROM seo_meta WHERE structured_data_json', seoMeta],
    ['SELECT id, from_path, to_path FROM web_redirects', redirects],
    ['FROM web_page_sections s JOIN web_pages p', sections],
    ['SELECT id, path, body_json FROM blog_posts', bodies],
  ]);
}

async function audit(database) {
  const { default: route } = await import('../src/routes/adminSeo.ts');
  const env = { DB: database, ENVIRONMENT: 'development', ADMIN_API_KEY: undefined };
  const response = await route.request('/seo/audit', {}, env);
  const body = await response.json().catch(() => null);
  return { status: response.status, data: body?.data ?? null };
}

const ids = (data) => data.issues.map((issue) => issue.id);

// --- The distinction the audit exists to preserve ---------------------------

test('the audit declares itself internal and index status unavailable', async () => {
  const result = await audit(db({ pages: [page()] }));
  assert.equal(result.status, 200);
  assert.equal(result.data.source, 'internal_audit');
  assert.equal(result.data.index_status_available, false);
  assert.match(result.data.index_status_note, /Search Console/);
});

test('coverage names the checks that are not implemented and why', async () => {
  const result = await audit(db({ pages: [page()] }));
  const missing = result.data.coverage.filter((entry) => !entry.implemented);
  assert.ok(missing.length > 0, 'a coverage list with nothing unimplemented is a claim, not a list');
  for (const entry of missing) {
    assert.ok(entry.note && entry.note.length > 0, `${entry.id} is unimplemented with no reason`);
  }
  assert.ok(missing.some((entry) => entry.id === 'index_status'));
});

test('a clean database produces no issues, not a fabricated warning', async () => {
  const result = await audit(db({ pages: [page({ kind: 'home', slug: '', path: '/ar' })] }));
  assert.deepEqual(result.data.issues, []);
  assert.equal(result.data.summary.errors, 0);
});

// --- Only published entities -----------------------------------------------

test('a draft with no description is not a defect', async () => {
  const result = await audit(db({
    pages: [page({ status: 'draft', seo_title: null, meta_description: null })],
  }));
  assert.deepEqual(result.data.issues, []);
  assert.equal(result.data.summary.audited_pages, 0);
});

test('a published page with no title and no description is two errors', async () => {
  const result = await audit(db({ pages: [page({ seo_title: null, meta_description: null })] }));
  assert.ok(ids(result.data).includes('missing_title'));
  assert.ok(ids(result.data).includes('missing_description'));
});

// --- Structured data --------------------------------------------------------

test('unparseable structured data on a published page is an error', async () => {
  const result = await audit(db({
    pages: [page()],
    seoMeta: [{ entity_type: 'web_page', entity_id: 'page-1', structured_data_json: '{not json' }],
  }));
  assert.ok(ids(result.data).includes('structured_data_invalid'));
});

test('structured data without @type is an error, and with @type is not', async () => {
  const without = await audit(db({
    pages: [page()],
    seoMeta: [{ entity_type: 'web_page', entity_id: 'page-1', structured_data_json: '{"name":"x"}' }],
  }));
  assert.ok(ids(without.data).includes('structured_data_invalid'));

  const withType = await audit(db({
    pages: [page()],
    seoMeta: [{ entity_type: 'web_page', entity_id: 'page-1', structured_data_json: '[{"@type":"FAQPage"}]' }],
  }));
  assert.ok(!ids(withType.data).includes('structured_data_invalid'));
});

test('structured data on an unpublished entity is not audited', async () => {
  // The write path already validates; re-reporting a draft would add noise nobody acts on.
  const result = await audit(db({
    pages: [page({ status: 'draft' })],
    seoMeta: [{ entity_type: 'web_page', entity_id: 'page-1', structured_data_json: 'broken' }],
  }));
  assert.ok(!ids(result.data).includes('structured_data_invalid'));
});

// --- Internal links ---------------------------------------------------------

test('a section CTA pointing at a path nothing serves is a broken internal link', async () => {
  const result = await audit(db({
    pages: [page()],
    sections: [{ page_id: 'page-1', cta_json: '{"label":"اشترك","href":"/ar/missing"}', page_path: '/ar/plans', status: 'published' }],
  }));
  const broken = result.data.issues.filter((issue) => issue.id === 'internal_link_broken');
  assert.equal(broken.length, 1);
  assert.match(broken[0].detail, /\/ar\/missing/);
});

test('an internal link that a redirect serves is not broken', async () => {
  // A redirect is a working URL. Flagging it would push editors to remove the redirect,
  // which is the one thing keeping the old link alive.
  const result = await audit(db({
    pages: [page()],
    sections: [{ page_id: 'page-1', cta_json: '{"label":"اشترك","href":"/ar/old"}', page_path: '/ar/plans', status: 'published' }],
    redirects: [{ id: 'r-1', from_path: '/ar/old', to_path: '/ar/plans' }],
  }));
  assert.ok(!ids(result.data).includes('internal_link_broken'));
});

test('an external link is not checked', async () => {
  const result = await audit(db({
    pages: [page()],
    sections: [{ page_id: 'page-1', cta_json: '{"label":"x","href":"https://example.com/whatever"}', page_path: '/ar/plans', status: 'published' }],
  }));
  assert.ok(!ids(result.data).includes('internal_link_broken'));
  assert.ok(result.data.coverage.some((entry) => entry.id === 'external_link_broken' && !entry.implemented));
});

test('a blog CTA block is checked the same way as a section CTA', async () => {
  const result = await audit(db({
    posts: [post()],
    bodies: [{ id: 'post-1', path: '/ar/blog/hello', body_json: '[{"type":"cta","label":"x","href":"/ar/nowhere"}]' }],
  }));
  assert.ok(ids(result.data).includes('internal_link_broken'));
});

// --- Orphans ----------------------------------------------------------------

test('a published page nothing links to is an orphan warning', async () => {
  const result = await audit(db({ pages: [page()] }));
  const orphan = result.data.issues.find((issue) => issue.id === 'orphan_page');
  assert.ok(orphan);
  assert.equal(orphan.severity, 'warning');
});

test('the home page and index pages are never orphans', async () => {
  // They are reached from navigation the renderer emits, not from a section CTA.
  const result = await audit(db({
    pages: [
      page({ id: 'home-ar', kind: 'home', slug: '', path: '/ar', translation_group: 'home' }),
      page({ id: 'index-ar', kind: 'index', path: '/ar/explore', slug: 'explore', translation_group: 'explore' }),
    ],
  }));
  assert.ok(!ids(result.data).includes('orphan_page'));
});

test('a linked page is not an orphan', async () => {
  const result = await audit(db({
    pages: [
      page({ id: 'home-ar', kind: 'home', slug: '', path: '/ar', translation_group: 'home' }),
      page(),
    ],
    sections: [{ page_id: 'home-ar', cta_json: '{"label":"الباقات","href":"/ar/plans"}', page_path: '/ar', status: 'published' }],
  }));
  assert.ok(!ids(result.data).includes('orphan_page'));
});

// --- Slug reuse -------------------------------------------------------------

test('the same slug under two translation groups is a warning', async () => {
  const result = await audit(db({
    pages: [
      page({ id: 'a', path: '/ar/guide', slug: 'guide', translation_group: 'guide-parents' }),
      page({ id: 'b', path: '/en/guide', slug: 'guide', language: 'en', translation_group: 'guide-teachers', seo_title: 'Guide', meta_description: 'A description long enough to be a real meta description for a page.' }),
    ],
  }));
  const reused = result.data.issues.filter((issue) => issue.id === 'slug_reused');
  assert.equal(reused.length, 2);
});

test('the same slug across languages of one group is normal', async () => {
  // This is exactly what a translation is. Flagging it would flag every page.
  const result = await audit(db({
    pages: [
      page({ id: 'a', path: '/ar/plans', slug: 'plans', translation_group: 'plans' }),
      page({ id: 'b', path: '/en/plans', slug: 'plans', language: 'en', translation_group: 'plans', seo_title: 'Plans', meta_description: 'A description long enough to be a real meta description for a page.' }),
    ],
  }));
  assert.ok(!ids(result.data).includes('slug_reused'));
});

test('the coverage entry explains why duplicate paths are not a check', async () => {
  const result = await audit(db({ pages: [page()] }));
  const entry = result.data.coverage.find((item) => item.id === 'slug_reused');
  assert.match(entry.note, /UNIQUE/);
});

// --- hreflang ---------------------------------------------------------------

test('a group with one published and one unpublished variant warns', async () => {
  const result = await audit(db({
    pages: [
      page({ id: 'a', translation_group: 'plans' }),
      page({ id: 'b', path: '/fr/plans', language: 'fr', status: 'draft', translation_group: 'plans' }),
    ],
  }));
  assert.ok(ids(result.data).includes('hreflang_incomplete'));
});

test('a group with a single language is not an hreflang defect', async () => {
  const result = await audit(db({ pages: [page({ kind: 'home', slug: '', path: '/ar' })] }));
  assert.ok(!ids(result.data).includes('hreflang_incomplete'));
});

// --- Sitemap ----------------------------------------------------------------

test('the sitemap state counts what would be served and what is excluded', async () => {
  const result = await audit(db({
    pages: [
      page({ kind: 'home', slug: '', path: '/ar' }),
      page({ id: 'b', path: '/fr/plans', language: 'fr', status: 'draft', translation_group: 'plans-fr' }),
    ],
  }));
  assert.equal(result.data.sitemap.included_urls, 1);
  assert.equal(result.data.sitemap.excluded_unpublished, 1);
  // No "last generated" timestamp: the sitemap is built per request, so a date here
  // would send an operator looking for a cron job that does not exist.
  assert.equal(result.data.sitemap.generated_on_request, true);
  assert.ok(!('last_generated_at' in result.data.sitemap));
});

test('a published page marked noindex is counted and warned about', async () => {
  const result = await audit(db({ pages: [page({ kind: 'home', slug: '', path: '/ar', robots_index: 0 })] }));
  assert.equal(result.data.sitemap.noindex_published, 1);
  assert.ok(ids(result.data).includes('published_noindex'));
});

// --- Redirects --------------------------------------------------------------

test('a redirect shadowing a live page is an error', async () => {
  const result = await audit(db({
    pages: [page({ kind: 'home', slug: '', path: '/ar' })],
    redirects: [{ id: 'r-1', from_path: '/ar', to_path: '/ar/plans' }],
  }));
  assert.ok(ids(result.data).includes('redirect_shadows_page'));
});

// --- Blog images ------------------------------------------------------------

test('a published post image with no alt text is an error', async () => {
  const result = await audit(db({
    posts: [post()],
    bodies: [{ id: 'post-1', path: '/ar/blog/hello', body_json: '[{"type":"image","asset_id":"a1","alt":""}]' }],
  }));
  assert.ok(ids(result.data).includes('missing_alt'));
});

test('every issue names an entity and an actionable detail', async () => {
  const result = await audit(db({
    pages: [page({ seo_title: null, meta_description: null })],
    posts: [post()],
    bodies: [{ id: 'post-1', path: '/ar/blog/hello', body_json: 'broken' }],
  }));
  assert.ok(result.data.issues.length > 0);
  for (const issue of result.data.issues) {
    assert.ok(issue.entity_type, 'an issue with no entity type cannot be opened');
    assert.ok(issue.entity_id, 'an issue with no entity id cannot be opened');
    assert.ok(issue.detail && issue.detail.length > 10, `"${issue.id}" has no actionable detail`);
    assert.ok(['error', 'warning'].includes(issue.severity));
  }
});
