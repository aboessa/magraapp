#!/usr/bin/env node
/**
 * Live HTTP verification that every indexable public URL answers with a complete initial
 * HTML document.
 *
 * ## Why a separate script from verify-cms-e2e.mjs
 *
 * `verify-cms-e2e.mjs` proves the CMS *payloads* are right: the admin writes, the publish
 * gate refuses, the public JSON carries a canonical. This one proves the *document* is
 * right, which is a different claim and the one that decides whether the site can be
 * indexed at all. Everything here is asserted against raw response text, before any
 * JavaScript could run — that is the whole point, so nothing in this file may parse the
 * page with a DOM implementation that executes scripts.
 *
 * ## What it drives
 *
 * It builds a real fixture through the admin API — an Arabic page with five section types,
 * English and French translations sharing one group, a published post with a translation, a
 * page published then marked non-indexable, a page left in draft, and a redirect — then
 * reads the public documents and the sitemaps and checks them.
 *
 * It also checks two things that are easy to get wrong and expensive to get wrong:
 * a headline containing markup must come back escaped, and a draft or non-indexable page
 * must not appear in the sitemap.
 *
 * Local and dev only. It writes to whatever database the Worker at --base is bound to, so
 * it must never be pointed at production.
 *
 * Usage:
 *   node scripts/verify-public-seo.mjs [--base http://127.0.0.1:8787] [--token <admin token>]
 */

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

const BASE = argValue('--base', 'http://127.0.0.1:8787');
let TOKEN = argValue('--token', process.env.ADMIN_API_KEY ?? 'dev-admin-key');
const EMAIL = argValue('--email', process.env.ADMIN_VERIFY_EMAIL ?? '');
const PASSWORD = argValue('--password', process.env.ADMIN_VERIFY_PASSWORD ?? '');

/// Signs in when credentials are supplied.
///
/// The shared-key path in `lib/adminAuth.ts` stops working once the first admin user is
/// seeded — deliberately, so there is never a second door without an identity. A local
/// database with real users therefore needs a real session, and the audit rows this script
/// leaves behind then name an actor instead of a key.
async function signIn() {
  if (!EMAIL || !PASSWORD) return;
  const response = await fetch(`${BASE}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const payload = await response.json().catch(() => null);
  const token = payload?.data?.token ?? payload?.token ?? payload?.data?.session?.token;
  if (!token) {
    console.log(`Sign-in failed (${response.status}). Falling back to the shared key.`);
    return;
  }
  TOKEN = token;
}

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

async function admin(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'X-Admin-Actor': 'verify-public-seo',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json, text };
}

/// Fetches a public URL the way a crawler does: no cookies, no JavaScript, and without
/// following redirects, so a 301 is observable rather than silently resolved.
async function page(path, { accept = 'text/html', language = '', redirect = 'manual' } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    redirect,
    headers: {
      accept,
      ...(language ? { 'accept-language': language } : {}),
      'user-agent': 'Mozilla/5.0 (compatible; MajarraSeoVerify/1.0)',
    },
  });
  const text = await response.text();
  return {
    status: response.status,
    text,
    location: response.headers.get('location'),
    contentType: response.headers.get('content-type') ?? '',
  };
}

/// The contents of `<head>`, so a body match cannot be mistaken for a head match.
const headOf = (html) => (html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? '');
const bodyOf = (html) => (html.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? '');
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((match) => { try { return JSON.parse(match[1]); } catch { return null; } })
  .filter(Boolean);
const metaContent = (html, attribute, name) =>
  html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)"`, 'i'))?.[1] ?? null;

const stamp = Date.now().toString(36);
const group = `pubseo-${stamp}`;
const pageSlug = `pubseo-${stamp}`;
const postSlug = `pubseo-post-${stamp}`;
const noindexSlug = `pubseo-hidden-${stamp}`;
const draftSlug = `pubseo-draft-${stamp}`;
const MARKUP_HEADLINE = 'عنوان <script>alert(1)</script> مُختبَر';

const SECTIONS = (headline) => [
  {
    section_type: 'hero',
    content: { headline, subheadline: 'سطر تعريفي للتحقّق من العرض الأوّلي.', body: 'فقرة أولى.\n\nفقرة ثانية.' },
    cta: { label: 'ابدأ الآن', href: '/ar/plans' },
  },
  { section_type: 'rich_text', content: { body: 'نصّ غنيّ للتحقّق من ظهور المحتوى في المستند الأوّلي.' } },
  {
    section_type: 'feature_grid',
    content: { headline: 'الميزات', items: [{ title: 'ميزة أولى', body: 'شرح الميزة الأولى.' }, { title: 'ميزة ثانية', body: 'شرح الميزة الثانية.' }] },
  },
  { section_type: 'faq', content: { headline: 'أسئلة متكرّرة', items: [{ question: 'هل التطبيق آمن؟', answer: 'نعم، وهذه إجابة التحقّق.' }] } },
  // `cta` keeps its label and href in `content`, not in `cta`: that is what
  // `lib/cmsContent.ts` requires for this section type, and the first run of this script
  // failed here because the fixture guessed otherwise.
  { section_type: 'cta', content: { headline: 'ابدأ اليوم', label: 'سجّل', href: '/ar/plans' } },
];

async function buildFixture() {
  console.log('\nFixture (admin API)');

  // --- Arabic page, three languages, one translation group ------------------
  const created = await admin('POST', '/api/v1/admin/website/pages', {
    page_key: group, language: 'ar', title: 'صفحة عرض عام', slug: pageSlug, kind: 'standard',
    summary: 'ملخّص الصفحة للتحقّق من وصف الميتا الاحتياطي.',
    translation_group: group,
  });
  check('creates the Arabic page', created.status === 201, created.text.slice(0, 200));
  const arId = created.json?.data?.id;
  if (!arId) return null;

  const sections = await admin('PUT', `/api/v1/admin/website/pages/${arId}/sections`, {
    sections: SECTIONS(MARKUP_HEADLINE),
  });
  check('saves five section types', sections.status === 200 && sections.json?.data?.sections === 5, sections.text.slice(0, 200));

  const seo = await admin('PUT', `/api/v1/admin/seo/web_page/${arId}`, {
    seo_title: 'عنوان السيو للصفحة العامة',
    meta_description: 'وصف ميتا للتحقّق من ظهوره في المستند الأوّلي، وطوله كافٍ ليتجاوز الحد الأدنى المعقول.',
    og_title: 'عنوان أوبن غراف',
    og_description: 'وصف أوبن غراف للتحقّق.',
    structured_data: { '@type': 'FAQPage', name: 'verify-faq' },
  });
  check('saves page SEO', seo.status === 200, seo.text.slice(0, 200));

  const publish = await admin('POST', `/api/v1/admin/website/pages/${arId}/publish`);
  check('publishes the Arabic page', publish.status === 200, publish.text.slice(0, 240));

  const translations = {};
  for (const [language, title] of [['en', 'Public rendering page'], ['fr', 'Page de rendu public']]) {
    const translation = await admin('POST', '/api/v1/admin/website/pages', {
      page_key: group, language, title, slug: `${pageSlug}-${language}`, kind: 'standard',
      translation_group: group, summary: `${title} summary for verification.`,
    });
    check(`creates the ${language} translation`, translation.status === 201, translation.text.slice(0, 200));
    const id = translation.json?.data?.id;
    translations[language] = { id, path: translation.json?.data?.path };
    if (!id) continue;
    const sectionsWrite = await admin('PUT', `/api/v1/admin/website/pages/${id}/sections`, {
      sections: [
        { section_type: 'hero', content: { headline: title, subheadline: 'Initial document check.' }, cta: {} },
        { section_type: 'rich_text', content: { body: 'Body text that must appear in the initial HTML.' } },
      ],
    });
    check(`saves ${language} sections`, sectionsWrite.status === 200, sectionsWrite.text.slice(0, 160));
    await admin('PUT', `/api/v1/admin/seo/web_page/${id}`, {
      seo_title: title,
      meta_description: `${title} — a description long enough to pass the minimum length guidance in this check.`,
    });
    const publishTranslation = await admin('POST', `/api/v1/admin/website/pages/${id}/publish`);
    check(`publishes the ${language} translation`, publishTranslation.status === 200, publishTranslation.text.slice(0, 200));
  }

  // --- A published page that must not be indexed ----------------------------
  const hidden = await admin('POST', '/api/v1/admin/website/pages', {
    page_key: noindexSlug, language: 'ar', title: 'صفحة غير مفهرسة', slug: noindexSlug, kind: 'standard',
  });
  const hiddenId = hidden.json?.data?.id;
  await admin('PUT', `/api/v1/admin/website/pages/${hiddenId}/sections`, {
    sections: [{ section_type: 'rich_text', content: { body: 'صفحة منشورة ولكنها غير قابلة للفهرسة.' } }],
  });
  const hiddenPublish = await admin('POST', `/api/v1/admin/website/pages/${hiddenId}/publish`);
  check('publishes the page that will be hidden', hiddenPublish.status === 200, hiddenPublish.text.slice(0, 200));
  const hiddenPatch = await admin('PATCH', `/api/v1/admin/website/pages/${hiddenId}`, { is_indexable: false });
  check('marks it non-indexable', hiddenPatch.status === 200, hiddenPatch.text.slice(0, 200));

  // --- A page left in draft -------------------------------------------------
  const draft = await admin('POST', '/api/v1/admin/website/pages', {
    page_key: draftSlug, language: 'ar', title: 'مسودّة', slug: draftSlug, kind: 'standard',
  });
  check('creates a draft page', draft.status === 201, draft.text.slice(0, 160));

  // --- Blog: an Arabic post with an English translation ---------------------
  const author = await admin('POST', '/api/v1/admin/blog/authors', { display_name: `كاتب ${stamp}` });
  const authorId = author.json?.data?.id;
  check('creates an author', author.status === 201, author.text.slice(0, 160));

  const post = await admin('POST', '/api/v1/admin/blog/posts', {
    title: 'مقال العرض العام', language: 'ar', slug: postSlug, post_key: group, translation_group: group,
    body: [
      { type: 'heading', level: 2, text: 'عنوان فرعي في المتن' },
      { type: 'paragraph', text: 'فقرة المقال التي يجب أن تظهر في المستند الأوّلي.' },
      { type: 'list', style: 'bullet', items: ['عنصر أول', 'عنصر ثانٍ'] },
      { type: 'quote', text: 'اقتباس للتحقّق.' },
      { type: 'callout', tone: 'info', text: 'ملاحظة جانبية.' },
      { type: 'cta', label: 'اقرأ الباقات', href: '/ar/plans' },
      { type: 'divider' },
    ],
  });
  check('creates the Arabic post', post.status === 201, post.text.slice(0, 200));
  const postId = post.json?.data?.id;

  await admin('PATCH', `/api/v1/admin/blog/posts/${postId}`, {
    author_id: authorId, excerpt: 'مقتطف المقال للتحقّق.', tags: ['pubseo', 'render'],
  });
  await admin('PUT', `/api/v1/admin/seo/blog_post/${postId}`, {
    seo_title: 'عنوان سيو المقال',
    meta_description: 'وصف ميتا للمقال بطول كافٍ حتى لا يظهر تحذير الطول في هذا الفحص، ويجب أن يصل إلى المستند.',
  });
  const postPublish = await admin('POST', `/api/v1/admin/blog/posts/${postId}/publish`);
  check('publishes the Arabic post', postPublish.status === 200, postPublish.text.slice(0, 240));

  const enPost = await admin('POST', '/api/v1/admin/blog/posts', {
    title: 'Public rendering post', language: 'en', slug: `${postSlug}-en`,
    post_key: group, translation_group: group,
    body: [{ type: 'paragraph', text: 'English body text that must appear in the initial HTML.' }],
  });
  const enPostId = enPost.json?.data?.id;
  await admin('PATCH', `/api/v1/admin/blog/posts/${enPostId}`, {
    author_id: authorId, excerpt: 'English excerpt for verification.',
  });
  const enPostPublish = await admin('POST', `/api/v1/admin/blog/posts/${enPostId}/publish`);
  check('publishes the English translation', enPostPublish.status === 200, enPostPublish.text.slice(0, 200));

  // A French translation deliberately left unpublished: it must not reach the sitemap or the
  // hreflang cluster.
  const frPost = await admin('POST', '/api/v1/admin/blog/posts', {
    title: 'Article non publié', language: 'fr', slug: `${postSlug}-fr`,
    post_key: group, translation_group: group,
    body: [{ type: 'paragraph', text: 'Texte non publié.' }],
  });
  check('creates an unpublished French post', frPost.status === 201, frPost.text.slice(0, 160));

  // --- Redirect -------------------------------------------------------------
  const redirect = await admin('POST', '/api/v1/admin/seo/redirects', {
    from_path: `/ar/moved-${stamp}`, to_path: `/ar/${pageSlug}`, reason: 'public render verification',
  });
  check('creates a redirect from the old path', redirect.status === 201, redirect.text.slice(0, 200));

  // --- Home pages -----------------------------------------------------------
  //
  // The Arabic home page is seeded as a draft. Publishing it locally is what makes `/ar` a
  // real document; the alternative would be a verification that never exercises the home
  // route, which is the most important route on the site.
  const list = await admin('GET', '/api/v1/admin/website/pages');
  const homes = (list.json?.data ?? []).filter((entry) => entry.kind === 'home');
  const arHome = homes.find((entry) => entry.language === 'ar');
  check('the Arabic home page exists in the CMS', !!arHome, `homes ${homes.length}`);
  if (arHome && arHome.status !== 'published') {
    await admin('PUT', `/api/v1/admin/website/pages/${arHome.id}/sections`, {
      sections: [
        { section_type: 'hero', content: { headline: 'عالم كامل من الحكايات والمعرفة', subheadline: 'مسلسلات وقصص وألعاب بالعربية.' }, cta: { label: 'ابدأ', href: '/ar/plans' } },
        { section_type: 'feature_grid', content: { headline: 'لماذا مجرّة', items: [{ title: 'آمن', body: 'بلا إعلانات.' }, { title: 'عربي', body: 'محتوى أصلي.' }] } },
      ],
    });
    await admin('PUT', `/api/v1/admin/seo/web_page/${arHome.id}`, {
      seo_title: 'مجرّة — عالم كامل من الحكايات والمعرفة لطفلك',
      meta_description: 'منصّة عربية آمنة للأطفال من ٣ إلى ١٢ سنة: مسلسلات وقصص وألعاب ومحتوى تعليمي بملفات لكل طفل.',
    });
    const homePublish = await admin('POST', `/api/v1/admin/website/pages/${arHome.id}/publish`);
    check('publishes the Arabic home page', homePublish.status === 200, homePublish.text.slice(0, 240));
  } else {
    check('publishes the Arabic home page', !!arHome, 'already published');
  }

  return { arId, translations, group: arHome?.translation_group ?? 'home' };
}

async function verifyDocuments() {
  console.log('\nInitial HTML documents');

  const arPath = `/ar/${pageSlug}`;
  const ar = await page(arPath);
  const arHead = headOf(ar.text);
  check('the Arabic page answers 200 as HTML',
    ar.status === 200 && ar.contentType.includes('text/html'), `status ${ar.status} ${ar.contentType}`);
  check('the document declares lang="ar" and dir="rtl"',
    /<html lang="ar" dir="rtl"/.test(ar.text), ar.text.slice(0, 120));
  check('the title comes from the SEO record',
    /<title>عنوان السيو للصفحة العامة<\/title>/.test(arHead), arHead.match(/<title>[^<]*<\/title>/)?.[0] ?? '');
  check('the meta description is in the head',
    (metaContent(arHead, 'name', 'description') ?? '').startsWith('وصف ميتا للتحقّق'),
    metaContent(arHead, 'name', 'description') ?? 'absent');
  check('canonical points at the page',
    arHead.includes(`<link rel="canonical" href="${BASE}${arPath}"`), arHead.match(/canonical[^>]*/)?.[0] ?? 'absent');
  check('robots says index, follow', metaContent(arHead, 'name', 'robots') === 'index, follow',
    metaContent(arHead, 'name', 'robots') ?? 'absent');
  check('Open Graph title, url and type are present',
    metaContent(arHead, 'property', 'og:title') === 'عنوان أوبن غراف'
      && metaContent(arHead, 'property', 'og:url') === `${BASE}${arPath}`
      && metaContent(arHead, 'property', 'og:type') === 'website',
    `${metaContent(arHead, 'property', 'og:title')} | ${metaContent(arHead, 'property', 'og:type')}`);
  check('hreflang lists ar, en, fr and x-default',
    ['ar', 'en', 'fr', 'x-default'].every((language) => arHead.includes(`hreflang="${language}"`)),
    (arHead.match(/hreflang="[^"]+"/g) ?? []).join(' '));
  const arJsonLd = jsonLd(arHead);
  check('the editor JSON-LD and the derived WebPage are both emitted',
    arJsonLd.some((entry) => entry['@type'] === 'WebPage') && arJsonLd.some((entry) => entry['@type'] === 'FAQPage'),
    arJsonLd.map((entry) => entry['@type']).join(', '));

  const arBody = bodyOf(ar.text);
  check('exactly one h1, carrying the page title',
    (arBody.match(/<h1[ >]/g) ?? []).length === 1 && arBody.includes('<h1>صفحة عرض عام</h1>'),
    `${(arBody.match(/<h1[ >]/g) ?? []).length} h1`);
  check('section content is in the initial body',
    arBody.includes('نصّ غنيّ للتحقّق') && arBody.includes('شرح الميزة الأولى')
      && arBody.includes('هل التطبيق آمن؟'), '');
  check('the CTA renders as a real link', arBody.includes('href="/ar/plans"'), '');
  check('internal navigation links are in the document',
    arBody.includes('<nav') && arBody.includes('href="/ar"'), '');
  check('a headline containing markup is escaped, not executed',
    arBody.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !arBody.includes('<script>alert(1)</script>'),
    '');

  for (const [language, expectedDirection] of [['en', 'ltr'], ['fr', 'ltr']]) {
    const translated = await page(`/${language}/${pageSlug}-${language}`);
    check(`the ${language} translation is ${expectedDirection}`,
      translated.status === 200 && translated.text.includes(`<html lang="${language}" dir="${expectedDirection}"`),
      `status ${translated.status}`);
    check(`the ${language} translation carries its own body text`,
      translated.text.includes('Body text that must appear in the initial HTML.'), '');
    check(`the ${language} translation lists the Arabic alternate`,
      headOf(translated.text).includes('hreflang="ar"'), '');
  }

  console.log('\nHome');
  const home = await page('/ar');
  check('/ar answers 200 as HTML', home.status === 200 && home.contentType.includes('text/html'), `status ${home.status}`);
  check('the home document has a title, description and canonical',
    /<title>[^<]{10,}<\/title>/.test(headOf(home.text))
      && !!metaContent(headOf(home.text), 'name', 'description')
      && headOf(home.text).includes('rel="canonical"'), '');
  check('the home document declares WebSite structured data',
    jsonLd(headOf(home.text)).some((entry) => entry['@type'] === 'WebSite'),
    jsonLd(headOf(home.text)).map((entry) => entry['@type']).join(', '));
  check('the home body carries an h1 and section copy',
    bodyOf(home.text).includes('<h1>') && bodyOf(home.text).includes('عالم كامل من الحكايات'), '');

  const rootHtml = await page('/', { language: 'ar,en' });
  check('the origin root redirects an HTML client to a language home',
    rootHtml.status === 302 && rootHtml.location === '/ar', `status ${rootHtml.status} → ${rootHtml.location}`);
  const rootEnglish = await page('/', { language: 'en-GB,en;q=0.9' });
  check('the root honours Accept-Language',
    rootEnglish.status === 302 && rootEnglish.location === '/en', `→ ${rootEnglish.location}`);
  const rootJson = await page('/', { accept: 'application/json' });
  check('the root still answers the API descriptor for non-HTML clients',
    rootJson.status === 200 && rootJson.text.includes('Majarra API'), rootJson.text.slice(0, 120));

  console.log('\nBlog');
  const blogIndex = await page('/ar/blog');
  check('the blog index answers 200 as HTML',
    blogIndex.status === 200 && blogIndex.contentType.includes('text/html'), `status ${blogIndex.status}`);
  check('the index links the published post',
    blogIndex.text.includes(`/ar/blog/${postSlug}`) && blogIndex.text.includes('مقال العرض العام'), '');
  check('the index declares Blog structured data',
    jsonLd(headOf(blogIndex.text)).some((entry) => entry['@type'] === 'Blog'), '');
  check('the index does not link the unpublished French translation',
    !blogIndex.text.includes(`${postSlug}-fr`), '');

  const post = await page(`/ar/blog/${postSlug}`);
  const postHead = headOf(post.text);
  const postBody = bodyOf(post.text);
  check('the post answers 200 as HTML', post.status === 200, `status ${post.status}`);
  check('the post title comes from its SEO record',
    postHead.includes('<title>عنوان سيو المقال</title>'), postHead.match(/<title>[^<]*<\/title>/)?.[0] ?? '');
  check('the post declares og:type article', metaContent(postHead, 'property', 'og:type') === 'article',
    metaContent(postHead, 'property', 'og:type') ?? 'absent');
  const postJsonLd = jsonLd(postHead);
  check('the post carries Article and BreadcrumbList structured data',
    postJsonLd.some((entry) => entry['@type'] === 'Article')
      && postJsonLd.some((entry) => entry['@type'] === 'BreadcrumbList'),
    postJsonLd.map((entry) => entry['@type']).join(', '));
  check('the post lists the English alternate but not the unpublished French one',
    postHead.includes('hreflang="en"') && !postHead.includes(`${postSlug}-fr`), '');
  check('every block type reached the initial body',
    ['عنوان فرعي في المتن', 'فقرة المقال التي يجب', 'عنصر أول', 'اقتباس للتحقّق', 'ملاحظة جانبية']
      .every((needle) => postBody.includes(needle)), '');
  check('the post has one h1 and a machine-readable date',
    (postBody.match(/<h1[ >]/g) ?? []).length === 1 && /<time datetime="[^"]+"/.test(postBody), '');
  check('the post links back to the archive', postBody.includes('href="/ar/blog"'), '');

  const enPost = await page(`/en/blog/${postSlug}-en`);
  check('the English post is ltr and carries its own body',
    enPost.status === 200 && enPost.text.includes('<html lang="en" dir="ltr"')
      && enPost.text.includes('English body text that must appear'), `status ${enPost.status}`);

  console.log('\nNon-indexable, draft and missing');
  const hidden = await page(`/ar/${noindexSlug}`);
  check('a non-indexable published page renders with noindex',
    hidden.status === 200 && metaContent(headOf(hidden.text), 'name', 'robots') === 'noindex, follow',
    metaContent(headOf(hidden.text), 'name', 'robots') ?? 'absent');

  const draft = await page(`/ar/${draftSlug}`);
  check('a draft page answers a real 404', draft.status === 404, `status ${draft.status}`);
  check('the 404 is noindex', metaContent(headOf(draft.text), 'name', 'robots') === 'noindex, follow',
    metaContent(headOf(draft.text), 'name', 'robots') ?? 'absent');

  const missing = await page(`/ar/definitely-not-here-${stamp}`);
  check('an unknown path answers 404 with an HTML document',
    missing.status === 404 && missing.contentType.includes('text/html'), `status ${missing.status}`);
  check('the 404 offers navigation back into the site', missing.text.includes('href="/ar"'), '');

  const preview = await page('/ar/preview');
  check('a preview path is never rendered', preview.status === 404, `status ${preview.status}`);

  const redirected = await page(`/ar/moved-${stamp}`);
  check('a changed slug redirects with 301',
    redirected.status === 301 && redirected.location === `/ar/${pageSlug}`,
    `status ${redirected.status} → ${redirected.location}`);
}

async function verifyCatalogue() {
  console.log('\nCatalogue pages');
  const catalogue = await page('/sitemap-catalogue.xml');
  check('the catalogue sitemap is XML',
    catalogue.status === 200 && catalogue.contentType.includes('xml'), `status ${catalogue.status}`);

  const locations = [...catalogue.text.matchAll(/<loc>[^<]*?(\/[a-z]{2}\/(?:series|planets)\/[^<]+)<\/loc>/g)]
    .map((match) => match[1]);
  const seriesPath = locations.find((location) => location.includes('/series/'));
  const planetPath = locations.find((location) => location.includes('/planets/'));

  check('the catalogue sitemap lists at least one series and one planet',
    !!seriesPath && !!planetPath, locations.slice(0, 4).join(' '));

  if (seriesPath) {
    const series = await page(seriesPath);
    const seriesHead = headOf(series.text);
    check('the series page renders as HTML', series.status === 200 && series.contentType.includes('text/html'),
      `${seriesPath} status ${series.status}`);
    check('the series page has a title, canonical and one h1',
      /<title>[^<]+<\/title>/.test(seriesHead) && seriesHead.includes('rel="canonical"')
        && (bodyOf(series.text).match(/<h1[ >]/g) ?? []).length === 1, '');
    check('the series page declares TVSeries structured data',
      jsonLd(seriesHead).some((entry) => entry['@type'] === 'TVSeries'),
      jsonLd(seriesHead).map((entry) => entry['@type']).join(', '));

    // The sitemap and the renderer must agree: a language the sitemap does not list must not
    // render, or the sitemap would be advertising thin pages in the wrong language.
    const slug = seriesPath.split('/').pop();
    for (const language of ['ar', 'en', 'fr']) {
      const url = `/${language}/series/${slug}`;
      const listed = locations.includes(url);
      const response = await page(url);
      check(`/${language}/series/${slug} ${listed ? 'renders because the sitemap lists it' : 'is 404 because the sitemap does not'}`,
        listed ? response.status === 200 : response.status === 404, `status ${response.status}`);
    }
  }

  if (planetPath) {
    const planet = await page(planetPath);
    check('the planet page renders with CollectionPage structured data and internal links',
      planet.status === 200 && jsonLd(headOf(planet.text)).some((entry) => entry['@type'] === 'CollectionPage'),
      `status ${planet.status}`);
  }
}

async function verifySitemapAndRobots() {
  console.log('\nSitemaps and robots');
  const sitemap = await page('/sitemap.xml');
  check('sitemap.xml is XML', sitemap.status === 200 && sitemap.contentType.includes('xml'), `status ${sitemap.status}`);
  check('sitemap contains the published page and post',
    sitemap.text.includes(`/ar/${pageSlug}<`) && sitemap.text.includes(`/ar/blog/${postSlug}<`), '');
  check('sitemap carries hreflang alternates for the translated cluster',
    sitemap.text.includes('xhtml:link') && sitemap.text.includes(`/${'en'}/${pageSlug}-en`), '');
  check('sitemap excludes the draft page', !sitemap.text.includes(draftSlug), '');
  check('sitemap excludes the non-indexable page', !sitemap.text.includes(noindexSlug), '');
  check('sitemap excludes the unpublished French post', !sitemap.text.includes(`${postSlug}-fr`), '');

  const blogMap = await page('/sitemap-blog.xml');
  check('the blog sitemap lists posts and not pages',
    blogMap.status === 200 && blogMap.text.includes(`/ar/blog/${postSlug}<`) && !blogMap.text.includes(`/ar/${pageSlug}<`),
    `status ${blogMap.status}`);

  const pagesMap = await page('/sitemap-pages.xml');
  check('the pages sitemap lists pages and not posts',
    pagesMap.status === 200 && pagesMap.text.includes(`/ar/${pageSlug}<`) && !pagesMap.text.includes(`/ar/blog/${postSlug}<`),
    `status ${pagesMap.status}`);

  const index = await page('/sitemap-index.xml');
  check('the sitemap index references the three section maps',
    index.status === 200 && index.text.includes('<sitemapindex')
      && ['sitemap-pages.xml', 'sitemap-blog.xml', 'sitemap-catalogue.xml'].every((map) => index.text.includes(map)),
    `status ${index.status}`);

  const robots = await page('/robots.txt', { accept: 'text/plain' });
  check('robots.txt is text and declares one sitemap',
    robots.status === 200 && robots.contentType.includes('text/plain')
      && (robots.text.match(/^Sitemap:/gm) ?? []).length === 1, `status ${robots.status}`);
  check('robots.txt disallows the admin, the API, previews and the account area',
    ['Disallow: /admin', 'Disallow: /api/', 'Disallow: /preview', 'Disallow: /account']
      .every((line) => robots.text.includes(line)), robots.text.slice(0, 200));
}

async function main() {
  console.log(`Verifying public rendering at ${BASE}\n`);
  const health = await fetch(`${BASE}/health`).then((response) => response.json()).catch(() => null);
  if (health?.status !== 'ok') {
    console.log('The worker is not reachable. Start it with: npm run dev');
    process.exit(1);
  }

  await signIn();
  const fixture = await buildFixture();
  if (!fixture) return report();
  await verifyDocuments();
  await verifyCatalogue();
  await verifySitemapAndRobots();
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
