#!/usr/bin/env node
/**
 * Live HTTP verification for the website CMS, blog CMS, SEO and the public delivery.
 *
 * ## Why this exists
 *
 * Every previous report on this work ended with the same admission: "no live HTTP request
 * was made against a running Worker". Unit tests and static wiring assertions catch a great
 * deal, and they cannot catch a route that is mounted at the wrong prefix, a SQL statement
 * that only fails against real D1, or a response shape that differs from the type that
 * describes it. Those are exactly the defects that reach an operator.
 *
 * So this drives the real endpoints over HTTP against `wrangler dev` and a local D1, in the
 * order an editor would: create a page, add sections, try to publish it before it is ready,
 * fix it, publish, create an Arabic post, refuse to publish it without an author, add a
 * translation, set SEO, run the audit, and read the public payloads plus `sitemap.xml` and
 * `robots.txt`.
 *
 * ## What it deliberately does not do
 *
 * It does not run against production, it does not create a session (it uses the break-glass
 * key path that `lib/adminAuth.ts` permits before the first admin user is seeded, or a token
 * passed in), and it cleans up nothing: the local database is a scratch database, and leaving
 * the rows behind makes a failure inspectable afterwards.
 *
 * Usage:
 *   node scripts/verify-cms-e2e.mjs [--base http://127.0.0.1:8787] [--token <admin token>]
 */

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

const BASE = argValue('--base', 'http://127.0.0.1:8787');
const TOKEN = argValue('--token', process.env.ADMIN_API_KEY ?? 'dev-admin-key');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'X-Admin-Actor': 'verify-cms-e2e',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON: sitemap and robots */ }
  return { status: response.status, json, text, headers: response.headers };
}

const stamp = Date.now().toString(36);
const pageSlug = `verify-page-${stamp}`;
const postSlug = `verify-post-${stamp}`;

async function main() {
  console.log(`Verifying ${BASE}\n`);

  const health = await call('GET', '/health');
  check('worker responds to /health', health.status === 200 && health.json?.status === 'ok', `status ${health.status}`);
  if (health.status !== 200) {
    console.log('\nThe worker is not reachable. Start it with: npm run dev');
    process.exit(1);
  }

  // --- Website CMS ---------------------------------------------------------
  console.log('\nWebsite CMS');

  const created = await call('POST', '/api/v1/admin/website/pages', {
    page_key: pageSlug, language: 'ar', title: 'صفحة تحقّق', slug: pageSlug, kind: 'standard',
  });
  check('creates a page', created.status === 201 && !!created.json?.data?.id, `status ${created.status} ${created.text.slice(0, 160)}`);
  const pageId = created.json?.data?.id;
  if (!pageId) { report(); return; }

  const publishedState = await call('POST', '/api/v1/admin/website/pages', {
    page_key: `${pageSlug}-x`, language: 'ar', title: 'x', slug: `${pageSlug}-x`, status: 'published',
  });
  check('refuses to create a page already published', publishedState.status === 400, `status ${publishedState.status}`);

  const earlyPublish = await call('POST', `/api/v1/admin/website/pages/${pageId}/publish`);
  check('refuses to publish a page with no sections', earlyPublish.status === 409, `status ${earlyPublish.status}`);
  check('the refusal lists the blocker', Array.isArray(earlyPublish.json?.data?.blockers)
    && earlyPublish.json.data.blockers.some((blocker) => blocker.id === 'sections'), earlyPublish.text.slice(0, 200));

  const badSection = await call('PUT', `/api/v1/admin/website/pages/${pageId}/sections`, {
    sections: [{ section_type: 'hero', content: {} }],
  });
  check('rejects a hero with no headline', badSection.status === 400, `status ${badSection.status}`);

  const sections = await call('PUT', `/api/v1/admin/website/pages/${pageId}/sections`, {
    sections: [
      { section_type: 'hero', content: { headline: 'عنوان التحقّق' }, cta: { label: 'ابدأ', href: '/ar/plans' } },
      { section_type: 'rich_text', content: { body: 'نصّ تجريبي للتحقّق.' } },
    ],
  });
  check('saves valid sections', sections.status === 200 && sections.json?.data?.sections === 2, sections.text.slice(0, 160));

  const seoWrite = await call('PUT', `/api/v1/admin/seo/web_page/${pageId}`, {
    seo_title: 'صفحة تحقّق مجرّة',
    meta_description: 'وصف تحقّق طويل بما يكفي ليتجاوز الحد الأدنى المعقول لوصف نتيجة البحث في الاختبار.',
    structured_data: { '@type': 'WebPage', name: 'verify' },
  });
  check('saves SEO metadata', seoWrite.status === 200, seoWrite.text.slice(0, 160));

  const badStructured = await call('PUT', `/api/v1/admin/seo/web_page/${pageId}`, {
    seo_title: 'x', structured_data: 'not json',
  });
  check('rejects invalid structured data', badStructured.status === 400, `status ${badStructured.status}`);

  const publish = await call('POST', `/api/v1/admin/website/pages/${pageId}/publish`);
  check('publishes the page once it is ready', publish.status === 200, publish.text.slice(0, 200));

  const detail = await call('GET', `/api/v1/admin/website/pages/${pageId}`);
  check('page detail returns sections, seo and revisions',
    detail.status === 200 && detail.json?.data?.sections?.length === 2 && Array.isArray(detail.json?.data?.revisions),
    detail.text.slice(0, 160));
  const revisions = detail.json?.data?.revisions ?? [];
  check('a revision was recorded before each mutation', revisions.length >= 2, `revisions ${revisions.length}`);

  // --- Blog CMS ------------------------------------------------------------
  console.log('\nBlog CMS');

  const taxonomy = await call('GET', '/api/v1/admin/blog/taxonomy');
  check('taxonomy loads with the seeded categories',
    taxonomy.status === 200 && (taxonomy.json?.data?.categories?.length ?? 0) >= 5, taxonomy.text.slice(0, 160));

  const author = await call('POST', '/api/v1/admin/blog/authors', { display_name: 'محرّر التحقّق' });
  check('creates an author', author.status === 201, author.text.slice(0, 160));
  const authorId = author.json?.data?.id;

  const post = await call('POST', '/api/v1/admin/blog/posts', {
    title: 'مقال تحقّق', language: 'ar', slug: postSlug,
    body: [
      { type: 'heading', level: 2, text: 'عنوان فرعي' },
      { type: 'paragraph', text: 'نصّ المقال للتحقّق.' },
    ],
  });
  check('creates an Arabic post', post.status === 201, post.text.slice(0, 200));
  const postId = post.json?.data?.id;

  const badBlock = await call('PATCH', `/api/v1/admin/blog/posts/${postId}`, {
    body: [{ type: 'image', asset_id: 'asset-x' }],
  });
  check('rejects an image block with no alt text', badBlock.status === 400, `status ${badBlock.status}`);

  const badEmbed = await call('PATCH', `/api/v1/admin/blog/posts/${postId}`, {
    body: [{ type: 'embed', url: 'https://evil.example.com/x' }],
  });
  check('rejects an embed from a host outside the allow-list', badEmbed.status === 400, `status ${badEmbed.status}`);

  const badHeading = await call('PATCH', `/api/v1/admin/blog/posts/${postId}`, {
    body: [{ type: 'heading', level: 1, text: 'x' }],
  });
  check('rejects an h1 in the body', badHeading.status === 400, `status ${badHeading.status}`);

  const noAuthor = await call('POST', `/api/v1/admin/blog/posts/${postId}/publish`);
  check('refuses to publish a post with no author', noAuthor.status === 409, `status ${noAuthor.status}`);
  check('the refusal names the author blocker',
    noAuthor.json?.data?.blockers?.some((blocker) => blocker.id === 'author'), noAuthor.text.slice(0, 200));

  const assign = await call('PATCH', `/api/v1/admin/blog/posts/${postId}`, {
    author_id: authorId, excerpt: 'مقتطف التحقّق.', tags: ['verify', 'cms'],
  });
  check('assigns the author and tags', assign.status === 200, assign.text.slice(0, 160));

  const autosave = await call('PATCH', `/api/v1/admin/blog/posts/${postId}`, {
    body: [{ type: 'paragraph', text: 'نصّ محدَّث تلقائيًا.' }], autosave: true,
  });
  check('accepts an autosave', autosave.status === 200 && autosave.json?.data?.autosave === true, autosave.text.slice(0, 160));

  const postSeo = await call('PUT', `/api/v1/admin/seo/blog_post/${postId}`, {
    seo_title: 'مقال تحقّق مجرّة',
    meta_description: 'وصف كافٍ لمقال التحقّق حتى لا يظهر تحذير طول الوصف في تدقيق السيو أثناء هذا الفحص.',
  });
  check('saves post SEO', postSeo.status === 200, postSeo.text.slice(0, 160));

  const publishPost = await call('POST', `/api/v1/admin/blog/posts/${postId}/publish`);
  check('publishes the post', publishPost.status === 200, publishPost.text.slice(0, 200));

  // A French translation sharing the group is what hreflang needs.
  const translation = await call('POST', '/api/v1/admin/blog/posts', {
    title: 'Article de vérification', language: 'fr', slug: `${postSlug}-fr`,
    post_key: postSlug, translation_group: postSlug,
    body: [{ type: 'paragraph', text: 'Texte de vérification.' }],
  });
  check('creates a French translation in the same group', translation.status === 201, translation.text.slice(0, 200));

  const postDetail = await call('GET', `/api/v1/admin/blog/posts/${postId}`);
  check('post detail links the translation',
    (postDetail.json?.data?.translations?.length ?? 0) >= 1, postDetail.text.slice(0, 200));

  // --- SEO -----------------------------------------------------------------
  console.log('\nSEO');

  const audit = await call('GET', '/api/v1/admin/seo/audit');
  check('audit runs', audit.status === 200 && Array.isArray(audit.json?.data?.issues), audit.text.slice(0, 160));
  check('audit declares it is internal only',
    audit.json?.data?.source === 'internal_audit' && audit.json?.data?.index_status_available === false,
    JSON.stringify(audit.json?.data?.summary ?? {}));
  // The French translation is unpublished, so the published Arabic post must be reported as
  // an incomplete hreflang cluster. This is the audit finding a real state, not a fixture.
  check('audit reports the incomplete hreflang cluster',
    audit.json?.data?.issues?.some((issue) => issue.id === 'hreflang_incomplete'),
    `issues ${audit.json?.data?.issues?.length ?? 0}`);

  const redirect = await call('POST', '/api/v1/admin/seo/redirects', {
    from_path: `/ar/old-${stamp}`, to_path: `/ar/${pageSlug}`, reason: 'verification',
  });
  check('creates a redirect', redirect.status === 201, redirect.text.slice(0, 160));

  const selfRedirect = await call('POST', '/api/v1/admin/seo/redirects', {
    from_path: `/ar/loop-${stamp}`, to_path: `/ar/loop-${stamp}`,
  });
  check('refuses a self-redirect', selfRedirect.status === 400, `status ${selfRedirect.status}`);

  const shadowRedirect = await call('POST', '/api/v1/admin/seo/redirects', {
    from_path: `/ar/${pageSlug}`, to_path: '/ar',
  });
  check('refuses a redirect over a published page', shadowRedirect.status === 409, `status ${shadowRedirect.status}`);

  const slugCheck = await call('GET', `/api/v1/admin/seo/slug-check?path=/ar/${pageSlug}`);
  check('slug-check reports a taken path', slugCheck.json?.data?.available === false, slugCheck.text.slice(0, 160));

  // --- Public delivery -----------------------------------------------------
  console.log('\nPublic delivery');

  const resolvePage = await call('GET', `/api/v1/site/resolve?path=/ar/${pageSlug}`);
  check('resolve finds the published page', resolvePage.json?.data?.kind === 'page', resolvePage.text.slice(0, 160));

  const resolveRedirect = await call('GET', `/api/v1/site/resolve?path=/ar/old-${stamp}`);
  check('resolve returns the redirect with its status',
    resolveRedirect.json?.data?.kind === 'redirect' && resolveRedirect.json.data.status === 301,
    resolveRedirect.text.slice(0, 160));

  const resolveMissing = await call('GET', '/api/v1/site/resolve?path=/ar/definitely-not-here');
  check('resolve answers 404 for an unknown path', resolveMissing.status === 404, `status ${resolveMissing.status}`);

  const publicPage = await call('GET', `/api/v1/site/page?path=/ar/${pageSlug}`);
  check('public page returns sections and head',
    publicPage.status === 200 && publicPage.json?.data?.sections?.length === 2 && !!publicPage.json?.data?.head,
    publicPage.text.slice(0, 200));
  const pageHead = publicPage.json?.data?.head ?? {};
  check('head carries a canonical, robots, lang and dir',
    typeof pageHead.canonical === 'string' && pageHead.canonical.includes(pageSlug)
      && pageHead.robots === 'index, follow' && pageHead.lang === 'ar' && pageHead.dir === 'rtl',
    JSON.stringify(pageHead).slice(0, 240));

  // Blog paths are `/{language}/blog/{slug}` (see postPath in lib/cmsContent.ts). The first
  // run of this script asserted `/ar/{slug}` and reported four failures against correct
  // behaviour, which is exactly the kind of mistake a live check is supposed to surface —
  // in this case in the check itself.
  const publicPostPath = `/ar/blog/${postSlug}`;
  const publicPost = await call('GET', `/api/v1/site/blog/post?path=${publicPostPath}`);
  check('public post returns the body and head', publicPost.status === 200
    && Array.isArray(publicPost.json?.data?.post?.body), publicPost.text.slice(0, 200));
  const postHead = publicPost.json?.data?.head ?? {};
  check('post head carries derived Article and BreadcrumbList JSON-LD',
    Array.isArray(postHead.structured_data)
      && postHead.structured_data.some((entry) => entry['@type'] === 'Article')
      && postHead.structured_data.some((entry) => entry['@type'] === 'BreadcrumbList'),
    JSON.stringify(postHead.structured_data ?? []).slice(0, 240));
  check('post head lists the Arabic alternate and x-default',
    postHead.alternates?.some((alternate) => alternate.hreflang === 'ar')
      && postHead.alternates?.some((alternate) => alternate.hreflang === 'x-default'),
    JSON.stringify(postHead.alternates ?? []));

  const blogList = await call('GET', '/api/v1/site/blog?language=ar');
  check('public blog list includes the published post',
    blogList.status === 200 && blogList.json?.data?.some((entry) => entry.slug === postSlug),
    blogList.text.slice(0, 200));

  const sitemap = await call('GET', '/sitemap.xml');
  check('sitemap is served as XML', sitemap.status === 200
    && sitemap.headers.get('content-type')?.includes('xml'), `status ${sitemap.status}`);
  check('sitemap contains the published page and post',
    sitemap.text.includes(`/ar/${pageSlug}`) && sitemap.text.includes(publicPostPath),
    sitemap.text.slice(0, 200));
  check('sitemap carries hreflang alternates', sitemap.text.includes('xhtml:link'), '');
  // An unpublished translation must not appear: it would send a crawler to a 404.
  check('sitemap excludes the unpublished French translation',
    !sitemap.text.includes(`/fr/blog/${postSlug}-fr`), '');

  const robots = await call('GET', '/robots.txt');
  check('robots.txt is served as text', robots.status === 200
    && robots.headers.get('content-type')?.includes('text/plain'), `status ${robots.status}`);
  check('robots.txt disallows the admin and the API and points at the sitemap',
    robots.text.includes('Disallow: /admin') && robots.text.includes('Disallow: /api/')
      && robots.text.includes('Sitemap:'), robots.text.slice(0, 200));

  report();
}

function report() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  process.exit(failed ? 1 : 0);
}

await main();
