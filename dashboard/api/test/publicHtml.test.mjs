/// Tests for the public HTML renderer.
///
/// ## The claim this file protects
///
/// Two claims, and they pull in opposite directions.
///
/// The first is that the initial document is complete: a crawler that never runs JavaScript
/// receives the title, the description, the canonical, the robots directive, the alternates,
/// the structured data, one `h1` and the page text. The live check in
/// `scripts/verify-public-seo.mjs` proves that end to end against a running Worker; these
/// tests pin the rules that make it true, one at a time, so a regression names itself.
///
/// The second is that nothing an editor types can become markup. Section content and blog
/// bodies are authored by people, `lib/cmsContent.ts` validates their *shape* rather than
/// their characters, and the output is HTML. Every escaping and URL rule below is therefore
/// asserted in both directions: the safe value survives, the hostile one does not.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  escapeHtml, escapeJsonLd, isSafeUrl, renderBlock, renderBlocks, renderBlogIndexBody,
  renderDocument, renderFooter, renderHeadTags, renderNav, renderNotFoundBody, renderPageBody,
  renderPostBody, renderProse, renderSection, renderSections,
} from '../src/lib/publicHtml.ts';
import {
  isNeverIndexable, planetLanguages, planetPath, seriesLanguages, seriesPath,
} from '../src/lib/publicRoutes.ts';

const head = (overrides = {}) => ({
  title: 'الباقات',
  description: 'وصف الباقات.',
  canonical: 'https://majarra.app/ar/plans',
  lang: 'ar',
  dir: 'rtl',
  robots: 'index, follow',
  og: {
    title: 'الباقات', description: 'وصف الباقات.', url: 'https://majarra.app/ar/plans',
    type: 'website', locale: 'ar', image_url: null,
  },
  alternates: [
    { hreflang: 'ar', href: 'https://majarra.app/ar/plans' },
    { hreflang: 'en', href: 'https://majarra.app/en/plans' },
    { hreflang: 'x-default', href: 'https://majarra.app/ar/plans' },
  ],
  structured_data: [{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'الباقات' }],
  ...overrides,
});

const section = (overrides = {}) => ({
  section_type: 'rich_text',
  content: { body: 'نصّ.' },
  cta: {},
  media_url: null,
  media_alt: null,
  ...overrides,
});

// --- Escaping ---------------------------------------------------------------

test('escapeHtml neutralises the five characters that change parsing', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('escapeHtml renders null and undefined as nothing rather than as the word', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('a section headline containing a script tag is escaped, not emitted', () => {
  const html = renderSection(section({
    section_type: 'hero',
    content: { headline: '<script>alert(1)</script>' },
  }));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
});

test('escapeJsonLd breaks a closing script tag inside a JSON string', () => {
  const encoded = escapeJsonLd({ '@type': 'WebPage', name: '</script><img onerror=1>' });
  assert.ok(!encoded.includes('</script>'));
  assert.ok(!encoded.includes('<img'));
  // Still valid JSON: the escape must not corrupt the payload it protects.
  assert.equal(JSON.parse(encoded).name, '</script><img onerror=1>');
});

test('a JSON-LD block round-trips through the head', () => {
  const html = renderHeadTags(head());
  const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(raw)['@type'], 'WebPage');
});

// --- URL safety -------------------------------------------------------------

test('only relative paths, fragments, https and mailto are safe URLs', () => {
  for (const safe of ['/ar/plans', '#faq', 'https://majarra.app', 'mailto:hello@majarra.app']) {
    assert.equal(isSafeUrl(safe), true, safe);
  }
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,<script>', '//evil.example.com', 'http://majarra.app', '', null]) {
    assert.equal(isSafeUrl(unsafe), false, String(unsafe));
  }
});

test('a CTA with a javascript href renders no link at all', () => {
  const html = renderSection(section({ cta: { label: 'اضغط', href: 'javascript:alert(1)' } }));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('class="cta"'));
});

test('a protocol-relative href is refused, because it leaves the origin silently', () => {
  assert.equal(renderBlock({ type: 'cta', label: 'go', href: '//evil.example.com' }), '');
});

// --- Head -------------------------------------------------------------------

test('the head carries title, description, canonical, robots and every alternate', () => {
  const html = renderHeadTags(head());
  assert.ok(html.includes('<title>الباقات</title>'));
  assert.ok(html.includes('<meta name="description" content="وصف الباقات." />'));
  assert.ok(html.includes('<link rel="canonical" href="https://majarra.app/ar/plans" />'));
  assert.ok(html.includes('<meta name="robots" content="index, follow" />'));
  for (const language of ['ar', 'en', 'x-default']) {
    assert.ok(html.includes(`hreflang="${language}"`), language);
  }
});

test('robots is emitted even when it permits indexing', () => {
  // An absent robots tag and an explicit `index` tag mean the same thing to a crawler and
  // different things to a person auditing the page. This document is the audit surface.
  assert.ok(renderHeadTags(head()).includes('name="robots"'));
});

test('a noindex head says so and nothing else contradicts it', () => {
  const html = renderHeadTags(head({ robots: 'noindex, follow' }));
  assert.ok(html.includes('content="noindex, follow"'));
  assert.equal(html.includes('content="index, follow"'), false);
});

test('the twitter card degrades to summary when there is no image', () => {
  assert.ok(renderHeadTags(head()).includes('name="twitter:card" content="summary"'));
  const withImage = renderHeadTags(head({
    og: { ...head().og, image_url: 'https://cdn.majarra.app/public/x.webp' },
  }));
  assert.ok(withImage.includes('summary_large_image'));
  assert.ok(withImage.includes('property="og:image" content="https://cdn.majarra.app/public/x.webp"'));
});

test('an unsafe og:image is dropped rather than emitted', () => {
  const html = renderHeadTags(head({ og: { ...head().og, image_url: 'javascript:alert(1)' } }));
  assert.ok(!html.includes('og:image'));
});

// --- Document ---------------------------------------------------------------

test('the document declares the content language and direction, not the reader’s', () => {
  const arabic = renderDocument({ head: head(), main: '<h1>x</h1>' });
  assert.ok(arabic.startsWith('<!doctype html>'));
  assert.ok(arabic.includes('<html lang="ar" dir="rtl">'));

  const french = renderDocument({
    head: head({ lang: 'fr', dir: 'ltr' }), main: '<h1>x</h1>',
  });
  assert.ok(french.includes('<html lang="fr" dir="ltr">'));
});

test('the stylesheet is inlined, so one request produces a legible page', () => {
  const html = renderDocument({ head: head(), main: '' });
  assert.ok(html.includes('<style>'));
  assert.ok(!html.includes('<link rel="stylesheet"'));
});

// --- Navigation -------------------------------------------------------------

test('navigation renders only safe links and marks the current page', () => {
  const html = renderNav({
    home: '/ar',
    brand: 'مجرّة',
    links: [
      { href: '/ar/plans', label: 'الباقات', current: true },
      { href: 'javascript:alert(1)', label: 'سيّئ' },
    ],
  });
  assert.ok(html.includes('href="/ar/plans" aria-current="page"'));
  assert.ok(!html.includes('سيّئ'));
});

test('the footer language switcher is built from the alternates and skips x-default', () => {
  const html = renderFooter({
    alternates: [
      { hreflang: 'ar', href: '/ar/plans', label: 'العربية' },
      { hreflang: 'en', href: '/en/plans', label: 'English' },
      { hreflang: 'x-default', href: '/ar/plans', label: 'x' },
    ],
  });
  assert.ok(html.includes('hreflang="en"'));
  assert.ok(html.includes('lang="ar"'));
  assert.ok(!html.includes('hreflang="x-default"'));
});

// --- Prose and sections -----------------------------------------------------

test('a body is split into paragraphs on blank lines and escaped', () => {
  const html = renderProse('أول\n\nثانٍ & <b>');
  assert.equal(html, '<p>أول</p>\n<p>ثانٍ &amp; &lt;b&gt;</p>');
});

test('a single newline stays inside one paragraph as a break', () => {
  assert.equal(renderProse('سطر\nآخر'), '<p>سطر<br />آخر</p>');
});

test('the hero headline is an h2, because the page title owns the h1', () => {
  const html = renderSection(section({ section_type: 'hero', content: { headline: 'عنوان' } }));
  assert.ok(html.includes('<h2>عنوان</h2>'));
  assert.ok(!html.includes('<h1'));
});

test('an faq section renders a definition list a crawler can read', () => {
  const html = renderSection(section({
    section_type: 'faq',
    content: { headline: 'أسئلة', items: [{ question: 'س؟', answer: 'ج.' }] },
  }));
  assert.ok(html.includes('<dt>س؟</dt>'));
  assert.ok(html.includes('<dd>ج.</dd>'));
});

test('an unknown section type still renders its headline and body', () => {
  // The type list in lib/cmsContent.ts can grow; a renderer that drops what it does not
  // recognise publishes a page with a hole in it.
  const html = renderSection(section({
    section_type: 'not_a_real_type',
    content: { headline: 'قسم جديد', body: 'نصّه.' },
  }));
  assert.ok(html.includes('قسم جديد'));
  assert.ok(html.includes('نصّه.'));
});

test('a section with no renderable content produces no empty element', () => {
  assert.equal(renderSection(section({ content: {}, cta: {} })), '');
  assert.equal(renderSections([section({ content: {} }), section({ content: {} })]), '');
});

test('a media section with no resolved asset renders no img', () => {
  const html = renderSection(section({
    section_type: 'media', content: { caption: 'تعليق' }, media_url: null,
  }));
  assert.ok(!html.includes('<img'));
});

// --- Blog blocks ------------------------------------------------------------

test('heading levels are clamped to h2, h3 and h4', () => {
  assert.ok(renderBlock({ type: 'heading', level: 2, text: 'x' }).startsWith('<h2>'));
  assert.ok(renderBlock({ type: 'heading', level: 3, text: 'x' }).startsWith('<h3>'));
  assert.ok(renderBlock({ type: 'heading', level: 4, text: 'x' }).startsWith('<h4>'));
  // A body h1 would compete with the post title for the document outline.
  assert.ok(renderBlock({ type: 'heading', level: 1, text: 'x' }).startsWith('<h2>'));
});

test('a list honours its style and escapes its items', () => {
  assert.ok(renderBlock({ type: 'list', style: 'number', items: ['<b>'] }).includes('<ol>'));
  assert.ok(renderBlock({ type: 'list', items: ['<b>'] }).includes('<li>&lt;b&gt;</li>'));
});

test('an image block with an unresolved asset states the alt text instead of a broken img', () => {
  const html = renderBlock({ type: 'image', asset_id: 'a1', alt: 'رسم', image_url: null });
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('رسم'));
});

test('an image block with a resolved asset carries its alt text', () => {
  const html = renderBlock({
    type: 'image', asset_id: 'a1', alt: 'رسم', image_url: 'https://cdn.majarra.app/public/a.webp',
  });
  assert.ok(html.includes('alt="رسم"'));
  assert.ok(html.includes('loading="lazy"'));
});

test('an embed carries a title and a fallback link', () => {
  const html = renderBlock({ type: 'embed', url: 'https://www.youtube.com/embed/x', title: 'مقطع' });
  assert.ok(html.includes('<iframe'));
  assert.ok(html.includes('title="مقطع"'));
  assert.ok(html.includes('<a href="https://www.youtube.com/embed/x"'));
});

test('a divider is the only block that renders without content', () => {
  assert.equal(renderBlock({ type: 'divider' }), '<hr />');
  assert.equal(renderBlock({ type: 'paragraph', text: '   ' }), '');
});

test('related content renders internal links when a path is present', () => {
  const html = renderBlock({
    type: 'related_content',
    items: [{ title: 'لونا', path: '/ar/series/luna' }, { title: 'بلا رابط' }],
  });
  assert.ok(html.includes('<a href="/ar/series/luna">لونا</a>'));
  assert.ok(html.includes('<li>بلا رابط</li>'));
});

test('renderBlocks drops empties rather than emitting blank lines of markup', () => {
  const html = renderBlocks([
    { type: 'paragraph', text: 'نصّ' },
    { type: 'paragraph', text: '' },
    { type: 'divider' },
  ]);
  assert.equal(html, '<p>نصّ</p>\n<hr />');
});

// --- Page bodies ------------------------------------------------------------

test('a page body has exactly one h1', () => {
  const html = renderPageBody({
    title: 'الباقات',
    summary: 'ملخّص',
    sections: [section({ section_type: 'hero', content: { headline: 'عنوان' } })],
  });
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
  assert.ok(html.includes('<h1>الباقات</h1>'));
});

test('a post body carries a machine-readable date and a breadcrumb back to the archive', () => {
  const html = renderPostBody({
    title: 'مقال',
    excerpt: 'مقتطف',
    publishedAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-02T10:00:00Z',
    authorName: 'كاتب',
    categoryName: 'تصنيف',
    categoryHref: '/ar/blog?category=x',
    heroUrl: null,
    heroAlt: null,
    tags: ['وسم'],
    blocks: [{ type: 'paragraph', text: 'نصّ' }],
    blogHref: '/ar/blog',
    blogLabel: 'المدوّنة',
  });
  assert.ok(html.includes('<time datetime="2026-08-01T10:00:00Z">2026-08-01</time>'));
  assert.ok(html.includes('<a href="/ar/blog">المدوّنة</a>'));
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
});

test('the blog index renders a real link per entry and a pager only when there is one', () => {
  const html = renderBlogIndexBody({
    title: 'المدوّنة',
    summary: null,
    entries: [{
      title: 'مقال', href: '/ar/blog/x', excerpt: 'مقتطف', publishedAt: '2026-08-01',
      authorName: 'كاتب', categoryName: null, heroUrl: null,
    }],
    emptyNote: 'لا مقالات.',
    previousHref: null,
    nextHref: '/ar/blog?page=2',
    previousLabel: 'الأحدث',
    nextLabel: 'الأقدم',
  });
  assert.ok(html.includes('<a href="/ar/blog/x">مقال</a>'));
  assert.ok(html.includes('rel="next"'));
  assert.ok(!html.includes('rel="prev"'));
});

test('an empty blog index says so rather than rendering an empty list', () => {
  const html = renderBlogIndexBody({
    title: 'المدوّنة', summary: null, entries: [], emptyNote: 'لا مقالات.',
    previousHref: null, nextHref: null, previousLabel: 'a', nextLabel: 'b',
  });
  assert.ok(html.includes('لا مقالات.'));
  assert.ok(!html.includes('<ul class="posts">'));
});

test('the 404 body offers navigation, so the page is not a dead end', () => {
  const html = renderNotFoundBody({
    title: 'غير موجودة', message: 'لا محتوى.', links: [{ href: '/ar', label: 'الرئيسية' }],
  });
  assert.ok(html.includes('<h1>غير موجودة</h1>'));
  assert.ok(html.includes('<a href="/ar">الرئيسية</a>'));
});

// --- Public route policy ----------------------------------------------------

test('a series is public in English only when both the title and the description exist', () => {
  assert.deepEqual(seriesLanguages({ title_ar: 'لونا', description_ar: 'وصف' }), ['ar']);
  assert.deepEqual(seriesLanguages({ title_ar: 'لونا', title_en: 'Luna', description_ar: 'وصف' }), ['ar']);
  assert.deepEqual(
    seriesLanguages({ title_ar: 'لونا', title_en: 'Luna', description_ar: 'وصف', description_en: 'About' }),
    ['ar', 'en'],
  );
});

test('a planet is public in Arabic only, because no English description column exists', () => {
  assert.deepEqual(planetLanguages({ name_ar: 'أبجد', name_en: 'Abjad' }), ['ar']);
  assert.deepEqual(planetLanguages({ name_ar: '' }), []);
});

test('catalogue paths are built in one place so the sitemap and the renderer agree', () => {
  assert.equal(seriesPath('ar', 'luna'), '/ar/series/luna');
  assert.equal(planetPath('en', 'abjad'), '/en/planets/abjad');
});

test('the never-indexable prefixes match the area and its children, not a lookalike', () => {
  assert.equal(isNeverIndexable('/admin'), true);
  assert.equal(isNeverIndexable('/admin/users'), true);
  assert.equal(isNeverIndexable('/preview'), true);
  assert.equal(isNeverIndexable('/administrative-guide'), false);
  assert.equal(isNeverIndexable('/plans'), false);
});
