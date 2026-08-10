/// The initial HTML document for every indexable public URL.
///
/// ## The gap this closes
///
/// The public site is a client-rendered React application. `routes/publicSite.ts` computed
/// a complete server-side answer for what each public URL should say and said so in its own
/// header: *"these payloads still need a renderer that puts them in the initial document"*.
/// Until that renderer existed, every SEO-critical value — title, description, canonical,
/// robots, `hreflang`, Open Graph, JSON-LD, the `h1`, the page text — reached a crawler only
/// if the crawler executed JavaScript and waited for a fetch. This route removes that "if".
///
/// ## Why here and not in a build step
///
/// Three options were on the table: prerender at build time, static generation, or render at
/// the edge.
///
/// Prerendering is wrong for this content. Editors publish from the admin at any hour; a
/// document generated at the last deploy would show yesterday's copy, and the only fix would
/// be a deploy per publish. Static generation has the same problem with a different name.
///
/// Edge rendering is what fits, and this Worker is already where public delivery lives: it
/// owns `/sitemap.xml` and `/robots.txt` at the root and it holds the D1 binding. Adding a
/// second service with its own database access to render the same rows would mean two
/// answers for one canonical URL — the exact failure `publicSite.ts` was written to avoid.
///
/// ## What still has to happen outside this file
///
/// `majarra.app` is served by a Cloudflare Pages project; this Worker answers on
/// `api.majarra.app`. Pointing the apex at a renderer is a live-DNS change on a domain Pages
/// owns (`front/wrangler.jsonc` records the exact error it produces), so it is an owner
/// decision, not something to do implicitly. Everything below is verifiable today against
/// `wrangler dev` and local D1, and the routing switch is recorded as a blocker rather than
/// pretended away.
///
/// ## Rules
///
/// * Only `status = 'published'` rows render. A draft, a scheduled row that has not passed
///   its date, and a preview URL are all 404 with `noindex` — never a page a crawler can see.
/// * A redirect wins over everything, with the status code the editor stored.
/// * Every value comes from `head()` in `publicSite.ts`. Nothing is recomputed here, so the
///   JSON a client reads and the markup a crawler reads cannot disagree.

import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { CMS_LANGUAGES, direction, type CmsLanguage } from '../lib/cmsContent.ts';
import { publicAssetBaseUrl, publicAssetUrl } from '../lib/assetUrls.ts';
import {
  blogIndexPath, isNeverIndexable, planetLanguages, planetPath, seriesLanguages, seriesPath,
} from '../lib/publicRoutes.ts';
import { head, origin, type SeoRow } from './publicSite.ts';
import {
  renderBlogIndexBody, renderDocument, renderFooter, renderNav, renderNotFoundBody,
  renderPageBody, renderPostBody, escapeAttribute, escapeHtml,
  type NavLink, type RenderBlock, type RenderHead, type RenderSection,
} from '../lib/publicHtml.ts';

type AppEnv = { Bindings: Env };

/// Interface copy, per language.
///
/// Kept here rather than in the CMS because these are chrome, not content: a visitor never
/// needs an editor to change the word "Blog", and putting them in `web_pages` would mean a
/// missing row renders a page with blank navigation.
const COPY: Record<CmsLanguage, {
  brand: string; home: string; blog: string; series: string; planets: string;
  notFoundTitle: string; notFoundBody: string; emptyBlog: string;
  previous: string; next: string; languageName: string; episodes: string; seasons: string;
  ages: string; inPlanet: string; seriesInPlanet: string; noPublicCopy: string;
}> = {
  ar: {
    brand: 'مجرّة', home: 'الرئيسية', blog: 'المدوّنة', series: 'السلاسل', planets: 'الكواكب',
    notFoundTitle: 'الصفحة غير موجودة',
    notFoundBody: 'لا يوجد محتوى منشور على هذا الرابط. قد يكون الرابط قديمًا أو المحتوى غير منشور بعد.',
    emptyBlog: 'لا مقالات منشورة بعد.',
    previous: 'الأحدث', next: 'الأقدم', languageName: 'العربية',
    episodes: 'حلقة', seasons: 'موسم', ages: 'الأعمار',
    inPlanet: 'الكوكب', seriesInPlanet: 'سلاسل هذا الكوكب',
    noPublicCopy: 'لا نصّ منشور لهذه الصفحة بهذه اللغة.',
  },
  en: {
    brand: 'Majarra', home: 'Home', blog: 'Blog', series: 'Series', planets: 'Planets',
    notFoundTitle: 'Page not found',
    notFoundBody: 'Nothing is published at this address. The link may be out of date, or the content may not be published yet.',
    emptyBlog: 'No posts published yet.',
    previous: 'Newer', next: 'Older', languageName: 'English',
    episodes: 'episodes', seasons: 'seasons', ages: 'Ages',
    inPlanet: 'Planet', seriesInPlanet: 'Series on this planet',
    noPublicCopy: 'No published copy for this page in this language.',
  },
  fr: {
    brand: 'Majarra', home: 'Accueil', blog: 'Blog', series: 'Séries', planets: 'Planètes',
    notFoundTitle: 'Page introuvable',
    notFoundBody: "Aucun contenu n'est publié à cette adresse. Le lien est peut-être obsolète, ou le contenu n'est pas encore publié.",
    emptyBlog: 'Aucun article publié pour le moment.',
    previous: 'Plus récent', next: 'Plus ancien', languageName: 'Français',
    episodes: 'épisodes', seasons: 'saisons', ages: 'Âges',
    inPlanet: 'Planète', seriesInPlanet: 'Séries de cette planète',
    noPublicCopy: 'Aucun texte publié pour cette page dans cette langue.',
  },
};

const LANGUAGE_NAMES: Record<string, string> = {
  ar: COPY.ar.languageName, en: COPY.en.languageName, fr: COPY.fr.languageName,
};

const SEO_COLUMNS = `seo_title, meta_description, canonical_url, robots_index, robots_follow,
  og_title, og_description, og_image_asset_id, structured_data_json`;

const seoFor = (db: D1Database, entityType: string, entityId: string) =>
  queryFirst<SeoRow>(db, `SELECT ${SEO_COLUMNS} FROM seo_meta WHERE entity_type = ? AND entity_id = ?`,
    [entityType, entityId]);

const parseStructured = (raw: string | null | undefined): unknown[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
};

/// Resolves asset ids to public CDN URLs in one query.
///
/// `lib/assetUrls.ts` decides what may be served anonymously; this only batches the lookup.
/// A private or unready asset resolves to nothing, so a hero image that is still uploading
/// produces a page without an image rather than a page with a broken one.
async function assetUrls(
  env: Env,
  ids: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string' && !!id.trim()))];
  const resolved = new Map<string, string>();
  if (!unique.length) return resolved;
  const base = publicAssetBaseUrl(env);
  if (!base) return resolved;

  const placeholders = unique.map(() => '?').join(', ');
  const rows = await queryAll<{ id: string; r2_key: string | null; visibility: string | null; status: string | null; kind: string | null }>(
    env.DB,
    `SELECT id, r2_key, visibility, status, kind FROM content_assets WHERE id IN (${placeholders})`,
    unique,
  );
  for (const row of rows) {
    const url = publicAssetUrl(base, row);
    if (url) resolved.set(row.id, url);
  }
  return resolved;
}

/// Site navigation for one language, built only from pages that are actually published.
///
/// Linking to an unpublished page would send every crawler that reads the header straight to
/// a 404 on every page of the site, which is the most expensive kind of broken link there is.
async function navigation(db: D1Database, language: CmsLanguage, currentPath: string): Promise<{
  nav: string; footerLinks: NavLink[];
}> {
  const copy = COPY[language];
  const pages = await queryAll<{ path: string; title: string; kind: string; page_key: string }>(db, `
    SELECT path, title, kind, page_key FROM web_pages
     WHERE language = ? AND status = 'published' AND is_indexable = 1
     ORDER BY CASE kind WHEN 'home' THEN 0 WHEN 'index' THEN 1 WHEN 'landing' THEN 2
                        WHEN 'standard' THEN 3 WHEN 'help' THEN 4 ELSE 5 END, path
    LIMIT 40
  `, [language]);

  const home = `/${language}`;
  const primary = pages
    .filter((page) => page.path !== home && page.kind !== 'legal')
    .slice(0, 7)
    .map((page) => ({ href: page.path, label: page.title, current: page.path === currentPath }));

  // The blog link is added from post existence rather than from a CMS index page: the archive
  // is rendered by this route and exists whenever a post does, with or without a `web_pages`
  // row describing it.
  const hasPosts = await queryFirst<{ total: number }>(db,
    `SELECT COUNT(*) AS total FROM blog_posts WHERE language = ? AND status = 'published'`, [language]);
  const blogHref = blogIndexPath(language);
  if (Number(hasPosts?.total ?? 0) > 0 && !primary.some((link) => link.href === blogHref)) {
    primary.push({ href: blogHref, label: copy.blog, current: currentPath === blogHref });
  }

  const legal = pages.filter((page) => page.kind === 'legal')
    .map((page) => ({ href: page.path, label: page.title }));

  return {
    nav: renderNav({ home, brand: copy.brand, links: primary }),
    footerLinks: legal,
  };
}

function footerFor(language: CmsLanguage, alternates: RenderHead['alternates'], footerLinks: NavLink[]): string {
  return renderFooter({
    alternates: alternates
      .filter((alternate) => alternate.hreflang !== 'x-default')
      .map((alternate) => ({
        hreflang: alternate.hreflang,
        href: alternate.href,
        label: LANGUAGE_NAMES[alternate.hreflang] ?? alternate.hreflang,
      })),
    links: footerLinks,
    note: `© Majarra — ${COPY[language].brand}`,
  });
}

const htmlResponse = (body: string, status = 200, cacheSeconds = 300) => new Response(body, {
  status,
  headers: {
    'Content-Type': 'text/html; charset=UTF-8',
    // A public document with no personalisation, so it is cacheable. `noindex` documents get
    // no shared cache: they are error and refusal states, and caching them at the edge makes
    // a transient one look permanent.
    'Cache-Control': status === 200
      ? `public, max-age=60, s-maxage=${cacheSeconds}, stale-while-revalidate=60`
      : 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  },
});

/// A 404 document. Always `noindex`, always status 404.
///
/// Both halves matter: a soft 404 (status 200 with an apology) is indexed as a real page and
/// competes with the pages that do exist.
async function notFound(
  env: Env, site: string, language: CmsLanguage, path: string, message?: string,
): Promise<Response> {
  const copy = COPY[language];
  const { nav, footerLinks } = await navigation(env.DB, language, path);
  const links: NavLink[] = [{ href: `/${language}`, label: copy.home }];
  const hasPosts = await queryFirst<{ total: number }>(env.DB,
    `SELECT COUNT(*) AS total FROM blog_posts WHERE language = ? AND status = 'published'`, [language]);
  if (Number(hasPosts?.total ?? 0) > 0) links.push({ href: blogIndexPath(language), label: copy.blog });

  const renderHead: RenderHead = {
    title: `${copy.notFoundTitle} — ${copy.brand}`,
    description: null,
    canonical: `${site}${path}`,
    lang: language,
    dir: direction(language),
    robots: 'noindex, follow',
    og: { title: copy.notFoundTitle, description: null, url: `${site}${path}`, type: 'website', locale: language, image_url: null },
    alternates: [],
    structured_data: [],
  };

  return htmlResponse(renderDocument({
    head: renderHead,
    nav,
    main: renderNotFoundBody({ title: copy.notFoundTitle, message: message ?? copy.notFoundBody, links }),
    footer: footerFor(language, [], footerLinks),
  }), 404);
}

const route = new Hono<AppEnv>();

/// `GET /` — language negotiation, mounted ahead of the API descriptor.
///
/// Exported separately from [route] because it is the one public path that collides with an
/// API route: this Worker's root is also the API's own descriptor. `index.ts` mounts this
/// before that handler and mounts the rest of the renderer after every API route, so a
/// language segment can never shadow `/health`, `/robots.txt` or `/api/*`.
///
/// 302, never 301. The destination depends on the visitor's `Accept-Language`, and a
/// permanent redirect would be cached by browsers and intermediaries and then serve one
/// language to everyone.
export const rootNegotiation = new Hono<AppEnv>();

rootNegotiation.get('/', async (c, next) => {
  const accept = c.req.header('accept') ?? '';
  if (!accept.includes('text/html')) return next();

  const requested = (c.req.header('accept-language') ?? '')
    .split(',')
    .map((part) => part.split(';')[0]?.trim().slice(0, 2).toLowerCase())
    .filter((part): part is string => !!part);
  const language = (CMS_LANGUAGES as readonly string[]).includes(requested[0] ?? '')
    ? requested[0] as CmsLanguage
    : 'ar';
  return c.redirect(`/${language}`, 302);
});

/// Narrows a path segment to a CMS language, or hands the request on.
///
/// A guard in the handler rather than a regex in the pattern. Hono's `:param{regex}` form
/// does not anchor a bare alternation, so `/:language{ar|en|fr}` also matched `/ar/plans` —
/// which made the home page answer for every second-level URL on the site. That defect was
/// found by the live check in `scripts/verify-public-seo.mjs`; a plain parameter with an
/// explicit test cannot fail that way.
const cmsLanguage = (value: string | undefined): CmsLanguage | null =>
  (value && (CMS_LANGUAGES as readonly string[]).includes(value)) ? value as CmsLanguage : null;

/// Redirects, checked before anything renders.
///
/// `web_redirects` is the record of a slug that changed. Honouring it here — with the stored
/// status code — is what keeps the old URL's accumulated links pointing somewhere, instead of
/// a 404 followed by a client-side bounce that no crawler follows.
route.use('/:language/*', async (c, next) => {
  if (!cmsLanguage(c.req.param('language'))) return next();
  const path = new URL(c.req.url).pathname;
  const redirect = await queryFirst<{ to_path: string; status_code: number }>(c.env.DB,
    'SELECT to_path, status_code FROM web_redirects WHERE from_path = ?', [path]);
  if (redirect) {
    const status = redirect.status_code === 302 || redirect.status_code === 308 ? redirect.status_code : 301;
    return c.redirect(redirect.to_path, status as 301 | 302 | 308);
  }
  return next();
});

// --- Blog ------------------------------------------------------------------

const BLOG_PAGE_SIZE = 12;

/// `GET /{language}/blog` — the archive.
route.get('/:language/blog', async (c, next) => {
  const language = cmsLanguage(c.req.param('language'));
  if (!language) return next();
  const copy = COPY[language];
  const site = origin(c.req.raw);
  const path = blogIndexPath(language);
  const page = Math.max(Number.parseInt(c.req.query('page') ?? '1', 10) || 1, 1);
  const offset = (page - 1) * BLOG_PAGE_SIZE;
  const tag = c.req.query('tag');

  const clauses = ["b.status = 'published'", 'b.language = ?'];
  const params: unknown[] = [language];
  if (tag) {
    clauses.push('EXISTS (SELECT 1 FROM blog_post_tags pt WHERE pt.post_id = b.id AND pt.tag_slug = ?)');
    params.push(tag);
  }
  const where = `WHERE ${clauses.join(' AND ')}`;

  const [total, posts, languagesWithPosts, indexPage] = await Promise.all([
    queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM blog_posts b ${where}`, params),
    queryAll<{
      path: string; title: string; excerpt: string | null; published_at: string | null;
      hero_asset_id: string | null; author_name: string | null; category_name: string | null;
    }>(c.env.DB, `
      SELECT b.path, b.title, b.excerpt, b.published_at, b.hero_asset_id,
             a.display_name AS author_name, cat.name AS category_name
        FROM blog_posts b
        LEFT JOIN blog_authors a ON a.id = b.author_id
        LEFT JOIN blog_categories cat ON cat.id = b.category_id
        ${where}
       ORDER BY b.published_at DESC
       LIMIT ? OFFSET ?
    `, [...params, BLOG_PAGE_SIZE, offset]),
    queryAll<{ language: string }>(c.env.DB,
      `SELECT DISTINCT language FROM blog_posts WHERE status = 'published' ORDER BY language`),
    // The CMS may also describe the archive as a page, which is where its title, summary and
    // SEO record live. When it does not, the archive still renders with its own copy.
    queryFirst<{ id: string; title: string; summary: string | null }>(c.env.DB,
      `SELECT id, title, summary FROM web_pages WHERE path = ? AND status = 'published'`, [path]),
  ]);

  const seo = indexPage ? await seoFor(c.env.DB, 'web_page', indexPage.id) : null;
  const heroes = await assetUrls(c.env, posts.map((post) => post.hero_asset_id));

  const totalCount = Number(total?.total ?? 0);
  const alternates = languagesWithPosts
    .filter((row): row is { language: CmsLanguage } => (CMS_LANGUAGES as readonly string[]).includes(row.language))
    .map((row) => ({ language: row.language, path: blogIndexPath(row.language) }));

  const pageQuery = (target: number) => {
    const parts = [tag ? `tag=${encodeURIComponent(tag)}` : '', target > 1 ? `page=${target}` : '']
      .filter(Boolean).join('&');
    return parts ? `${path}?${parts}` : path;
  };

  const renderHead = head({
    site, path,
    language,
    title: indexPage?.title ?? `${copy.blog} — ${copy.brand}`,
    description: indexPage?.summary ?? null,
    seo,
    alternates,
    // Only page one is canonical to itself and indexable; deeper pages point at themselves
    // but are marked `noindex, follow` below so the archive is crawled without competing
    // with the posts it lists.
    indexable: true,
    structured: [
      {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: indexPage?.title ?? copy.blog,
        inLanguage: language,
        url: `${site}${path}`,
      },
      ...parseStructured(seo?.structured_data_json),
    ],
  }) as RenderHead;

  if (page > 1) {
    renderHead.robots = 'noindex, follow';
    renderHead.canonical = `${site}${pageQuery(page)}`;
    renderHead.og.url = renderHead.canonical;
  }
  renderHead.og.image_url = null;

  const { nav, footerLinks } = await navigation(c.env.DB, language, path);

  return htmlResponse(renderDocument({
    head: renderHead,
    nav,
    main: renderBlogIndexBody({
      title: indexPage?.title ?? copy.blog,
      summary: indexPage?.summary ?? null,
      entries: posts.map((post) => ({
        title: post.title,
        href: post.path,
        excerpt: post.excerpt,
        publishedAt: post.published_at,
        authorName: post.author_name,
        categoryName: post.category_name,
        heroUrl: post.hero_asset_id ? heroes.get(post.hero_asset_id) ?? null : null,
      })),
      emptyNote: copy.emptyBlog,
      previousHref: page > 1 ? pageQuery(page - 1) : null,
      nextHref: offset + BLOG_PAGE_SIZE < totalCount ? pageQuery(page + 1) : null,
      previousLabel: copy.previous,
      nextLabel: copy.next,
    }),
    footer: footerFor(language, renderHead.alternates, footerLinks),
  }));
});

/// `GET /{language}/blog/{slug}` — one post.
route.get('/:language/blog/:slug', async (c, next) => {
  const language = cmsLanguage(c.req.param('language'));
  if (!language) return next();
  const slug = c.req.param('slug');
  const copy = COPY[language];
  const site = origin(c.req.raw);
  const path = `/${language}/blog/${slug}`;

  const post = await queryFirst<{
    id: string; title: string; excerpt: string | null; body_json: string; hero_asset_id: string | null;
    translation_group: string; published_at: string | null; updated_at: string;
    author_name: string | null; category_name: string | null; category_slug: string | null;
  }>(c.env.DB, `
    SELECT b.id, b.title, b.excerpt, b.body_json, b.hero_asset_id, b.translation_group,
           b.published_at, b.updated_at,
           a.display_name AS author_name, cat.name AS category_name, cat.slug AS category_slug
      FROM blog_posts b
      LEFT JOIN blog_authors a ON a.id = b.author_id
      LEFT JOIN blog_categories cat ON cat.id = b.category_id
     WHERE b.path = ? AND b.status = 'published'
  `, [path]);
  if (!post) return notFound(c.env, site, language, path);

  const [seo, alternateRows, tags] = await Promise.all([
    seoFor(c.env.DB, 'blog_post', post.id),
    queryAll<{ language: string; path: string }>(c.env.DB, `
      SELECT language, path FROM blog_posts
       WHERE translation_group = ? AND status = 'published' ORDER BY language
    `, [post.translation_group]),
    queryAll<{ tag_slug: string }>(c.env.DB, 'SELECT tag_slug FROM blog_post_tags WHERE post_id = ?', [post.id]),
  ]);

  let blocks: RenderBlock[] = [];
  try {
    const parsed = JSON.parse(post.body_json || '[]');
    blocks = Array.isArray(parsed) ? parsed as RenderBlock[] : [];
  } catch {
    blocks = [];
  }

  const imageIds = blocks.filter((block) => block.type === 'image').map((block) => block.asset_id as string);
  const urls = await assetUrls(c.env, [...imageIds, post.hero_asset_id, seo?.og_image_asset_id]);
  for (const block of blocks) {
    if (block.type === 'image' && typeof block.asset_id === 'string') {
      block.image_url = urls.get(block.asset_id) ?? null;
    }
  }

  const derived = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: seo?.meta_description ?? post.excerpt,
      inLanguage: language,
      datePublished: post.published_at,
      dateModified: post.updated_at,
      author: post.author_name ? { '@type': 'Person', name: post.author_name } : undefined,
      mainEntityOfPage: `${site}${path}`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: copy.brand, item: `${site}/${language}` },
        { '@type': 'ListItem', position: 2, name: copy.blog, item: `${site}${blogIndexPath(language)}` },
        { '@type': 'ListItem', position: 3, name: post.title, item: `${site}${path}` },
      ],
    },
  ];

  const renderHead = head({
    site, path, language,
    title: post.title,
    description: post.excerpt,
    seo,
    alternates: alternateRows,
    indexable: true,
    structured: [...derived, ...parseStructured(seo?.structured_data_json)],
    ogType: 'article',
  }) as RenderHead;
  renderHead.og.image_url = (seo?.og_image_asset_id ? urls.get(seo.og_image_asset_id) : null)
    ?? (post.hero_asset_id ? urls.get(post.hero_asset_id) ?? null : null);

  const { nav, footerLinks } = await navigation(c.env.DB, language, path);

  return htmlResponse(renderDocument({
    head: renderHead,
    nav,
    main: renderPostBody({
      title: post.title,
      excerpt: post.excerpt,
      publishedAt: post.published_at,
      updatedAt: post.updated_at,
      authorName: post.author_name,
      categoryName: post.category_name,
      categoryHref: post.category_slug
        ? `${blogIndexPath(language)}?category=${encodeURIComponent(post.category_slug)}`
        : null,
      heroUrl: post.hero_asset_id ? urls.get(post.hero_asset_id) ?? null : null,
      heroAlt: post.title,
      tags: tags.map((tag) => tag.tag_slug),
      blocks,
      blogHref: blogIndexPath(language),
      blogLabel: copy.blog,
    }),
    footer: footerFor(language, renderHead.alternates, footerLinks),
  }));
});

// --- Catalogue -------------------------------------------------------------

/// `GET /{language}/series/{slug}` — a series presentation page.
route.get('/:language/series/:slug', async (c, next) => {
  const language = cmsLanguage(c.req.param('language'));
  if (!language) return next();
  const slug = c.req.param('slug');
  const copy = COPY[language];
  const site = origin(c.req.raw);
  const path = seriesPath(language, slug);

  const series = await queryFirst<{
    id: string; slug: string; title_ar: string; title_en: string | null;
    description_ar: string | null; description_en: string | null;
    age_min: number; age_max: number; planet_id: string; updated_at: string; published_at: string | null;
    planet_name_ar: string | null; planet_name_en: string | null;
  }>(c.env.DB, `
    SELECT s.id, s.slug, s.title_ar, s.title_en, s.description_ar, s.description_en,
           s.age_min, s.age_max, s.planet_id, s.updated_at, s.published_at,
           p.name_ar AS planet_name_ar, p.name_en AS planet_name_en
      FROM series s
      LEFT JOIN planets p ON p.id = s.planet_id
     WHERE s.slug = ? AND s.status = 'published'
  `, [slug]);
  if (!series) return notFound(c.env, site, language, path);

  const languages = seriesLanguages(series);
  // The URL exists only in the languages whose copy exists. Answering 404 for the others is
  // what stops the sitemap and the renderer from disagreeing, and stops an English URL from
  // serving an Arabic body.
  if (!languages.includes(language)) return notFound(c.env, site, language, path, copy.noPublicCopy);

  const title = language === 'ar' ? series.title_ar : (series.title_en ?? series.title_ar);
  const description = language === 'ar' ? series.description_ar : (series.description_en ?? null);
  const planetName = language === 'ar' ? series.planet_name_ar : (series.planet_name_en ?? series.planet_name_ar);

  const [seo, counts, episodes] = await Promise.all([
    seoFor(c.env.DB, 'series', series.id),
    queryFirst<{ seasons: number; episodes: number }>(c.env.DB, `
      SELECT (SELECT COUNT(*) FROM seasons WHERE series_id = ?) AS seasons,
             (SELECT COUNT(*) FROM episodes WHERE series_id = ? AND status = 'published') AS episodes
    `, [series.id, series.id]),
    queryAll<{ title_ar: string; episode_number: number | null }>(c.env.DB, `
      SELECT title_ar, episode_number FROM episodes
       WHERE series_id = ? AND status = 'published'
       ORDER BY episode_number LIMIT 30
    `, [series.id]),
  ]);

  const urls = await assetUrls(c.env, [seo?.og_image_asset_id]);
  const planetIsPublic = planetLanguages({ name_ar: series.planet_name_ar, name_en: series.planet_name_en, description_ar: null })
    .includes(language);

  const renderHead = head({
    site, path, language,
    title,
    description,
    seo,
    alternates: languages.map((entry) => ({ language: entry, path: seriesPath(entry, slug) })),
    indexable: true,
    structured: [
      {
        '@context': 'https://schema.org',
        '@type': 'TVSeries',
        name: title,
        description: seo?.meta_description ?? description ?? undefined,
        inLanguage: language,
        numberOfEpisodes: Number(counts?.episodes ?? 0) || undefined,
        numberOfSeasons: Number(counts?.seasons ?? 0) || undefined,
        typicalAgeRange: `${series.age_min}-${series.age_max}`,
        url: `${site}${path}`,
      },
      ...parseStructured(seo?.structured_data_json),
    ],
  }) as RenderHead;
  renderHead.og.image_url = seo?.og_image_asset_id ? urls.get(seo.og_image_asset_id) ?? null : null;

  const facts = [
    `<li><strong>${escapeHtml(copy.ages)}</strong> ${escapeHtml(`${series.age_min}–${series.age_max}`)}</li>`,
    Number(counts?.seasons ?? 0) > 0
      ? `<li><strong>${escapeHtml(copy.seasons)}</strong> ${escapeHtml(String(counts?.seasons ?? 0))}</li>` : '',
    Number(counts?.episodes ?? 0) > 0
      ? `<li><strong>${escapeHtml(copy.episodes)}</strong> ${escapeHtml(String(counts?.episodes ?? 0))}</li>` : '',
    planetName
      ? `<li><strong>${escapeHtml(copy.inPlanet)}</strong> ${planetIsPublic
          ? `<a href="${escapeAttribute(planetPath(language, series.planet_id))}">${escapeHtml(planetName)}</a>`
          : escapeHtml(planetName)}</li>`
      : '',
  ].filter(Boolean).join('\n');

  const episodeList = episodes.length
    ? `<section><h2>${escapeHtml(copy.episodes)}</h2><ol>${episodes.map((episode) =>
        // Episode titles exist in Arabic only (`episodes` has no `title_en` column), so an
        // English series page lists the Arabic titles with an explicit `lang` rather than
        // pretending they are translated.
        `<li${language === 'ar' ? '' : ' lang="ar" dir="rtl"'}>${escapeHtml(episode.title_ar)}</li>`).join('')}</ol></section>`
    : '';

  const { nav, footerLinks } = await navigation(c.env.DB, language, path);

  return htmlResponse(renderDocument({
    head: renderHead,
    nav,
    main: renderPageBody({
      title,
      summary: description,
      sections: [],
      extra: `${facts ? `<section><ul class="cards">${facts}</ul></section>` : ''}${episodeList}`,
    }),
    footer: footerFor(language, renderHead.alternates, footerLinks),
  }));
});

/// `GET /{language}/planets/{id}` — a planet and the series on it.
route.get('/:language/planets/:planetId', async (c, next) => {
  const language = cmsLanguage(c.req.param('language'));
  if (!language) return next();
  const planetId = c.req.param('planetId');
  const copy = COPY[language];
  const site = origin(c.req.raw);
  const path = planetPath(language, planetId);

  const planet = await queryFirst<{
    id: string; name_ar: string; name_en: string | null; description_ar: string | null; created_at: string;
  }>(c.env.DB, `
    SELECT id, name_ar, name_en, description_ar, created_at FROM planets WHERE id = ? AND is_active = 1
  `, [planetId]);
  if (!planet) return notFound(c.env, site, language, path);

  const languages = planetLanguages(planet);
  if (!languages.includes(language)) return notFound(c.env, site, language, path, copy.noPublicCopy);

  const [seo, series] = await Promise.all([
    seoFor(c.env.DB, 'planet', planet.id),
    queryAll<{ slug: string; title_ar: string; title_en: string | null; description_ar: string | null; description_en: string | null }>(c.env.DB, `
      SELECT slug, title_ar, title_en, description_ar, description_en FROM series
       WHERE planet_id = ? AND status = 'published' ORDER BY sort_order, slug LIMIT 60
    `, [planet.id]),
  ]);
  const urls = await assetUrls(c.env, [seo?.og_image_asset_id]);

  const title = language === 'ar' ? planet.name_ar : (planet.name_en ?? planet.name_ar);
  const publicSeries = series.filter((row) => seriesLanguages(row).includes(language));

  const renderHead = head({
    site, path, language,
    title,
    description: planet.description_ar,
    seo,
    alternates: languages.map((entry) => ({ language: entry, path: planetPath(entry, planet.id) })),
    indexable: true,
    structured: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        description: seo?.meta_description ?? planet.description_ar ?? undefined,
        inLanguage: language,
        url: `${site}${path}`,
        hasPart: publicSeries.map((row) => ({
          '@type': 'TVSeries',
          name: language === 'ar' ? row.title_ar : (row.title_en ?? row.title_ar),
          url: `${site}${seriesPath(language, row.slug)}`,
        })),
      },
      ...parseStructured(seo?.structured_data_json),
    ],
  }) as RenderHead;
  renderHead.og.image_url = seo?.og_image_asset_id ? urls.get(seo.og_image_asset_id) ?? null : null;

  const list = publicSeries.length
    ? `<section><h2>${escapeHtml(copy.seriesInPlanet)}</h2><ul class="cards">${publicSeries.map((row) => {
        const name = language === 'ar' ? row.title_ar : (row.title_en ?? row.title_ar);
        const summary = language === 'ar' ? row.description_ar : row.description_en;
        return `<li><h3><a href="${escapeAttribute(seriesPath(language, row.slug))}">${escapeHtml(name)}</a></h3>`
          + (summary ? `<p>${escapeHtml(summary)}</p>` : '') + '</li>';
      }).join('')}</ul></section>`
    : '';

  const { nav, footerLinks } = await navigation(c.env.DB, language, path);

  return htmlResponse(renderDocument({
    head: renderHead,
    nav,
    main: renderPageBody({ title, summary: planet.description_ar, sections: [], extra: list }),
    footer: footerFor(language, renderHead.alternates, footerLinks),
  }));
});

// --- Website pages ---------------------------------------------------------

/// Catalogue listings appended to the CMS index pages that describe them.
///
/// `/{lang}/series` and `/{lang}/planets` are `web_pages` rows of kind `index`; their sections
/// are editorial copy, and the list of what they index lives in the catalogue tables. Joining
/// them here is what turns the index page from a heading into a page with internal links —
/// which is the only reason a crawler follows it.
async function indexExtras(env: Env, language: CmsLanguage, pageKey: string): Promise<string> {
  const copy = COPY[language];
  if (pageKey === 'series') {
    const rows = await queryAll<{ slug: string; title_ar: string; title_en: string | null; description_ar: string | null; description_en: string | null }>(env.DB, `
      SELECT slug, title_ar, title_en, description_ar, description_en FROM series
       WHERE status = 'published' ORDER BY sort_order, slug LIMIT 100
    `);
    const items = rows.filter((row) => seriesLanguages(row).includes(language)).map((row) => {
      const name = language === 'ar' ? row.title_ar : (row.title_en ?? row.title_ar);
      const summary = language === 'ar' ? row.description_ar : row.description_en;
      return `<li><h3><a href="${escapeAttribute(seriesPath(language, row.slug))}">${escapeHtml(name)}</a></h3>`
        + (summary ? `<p>${escapeHtml(summary)}</p>` : '') + '</li>';
    }).join('');
    return items ? `<section><h2>${escapeHtml(copy.series)}</h2><ul class="cards">${items}</ul></section>` : '';
  }
  if (pageKey === 'planets') {
    const rows = await queryAll<{ id: string; name_ar: string; name_en: string | null; description_ar: string | null }>(env.DB, `
      SELECT id, name_ar, name_en, description_ar FROM planets WHERE is_active = 1 ORDER BY sort_order, id
    `);
    const items = rows.filter((row) => planetLanguages(row).includes(language)).map((row) => {
      const name = language === 'ar' ? row.name_ar : (row.name_en ?? row.name_ar);
      return `<li><h3><a href="${escapeAttribute(planetPath(language, row.id))}">${escapeHtml(name)}</a></h3>`
        + (row.description_ar ? `<p>${escapeHtml(row.description_ar)}</p>` : '') + '</li>';
    }).join('');
    return items ? `<section><h2>${escapeHtml(copy.planets)}</h2><ul class="cards">${items}</ul></section>` : '';
  }
  return '';
}

async function renderWebPage(c: { env: Env; req: { raw: Request } }, language: CmsLanguage, path: string): Promise<Response> {
  const site = origin(c.req.raw);
  const page = await queryFirst<{
    id: string; page_key: string; path: string; title: string; summary: string | null;
    kind: string; translation_group: string; is_indexable: number;
    published_at: string | null; updated_at: string;
  }>(c.env.DB, `
    SELECT id, page_key, path, title, summary, kind, translation_group, is_indexable,
           published_at, updated_at
      FROM web_pages WHERE path = ? AND status = 'published'
  `, [path]);
  if (!page) return notFound(c.env, site, language, path);

  const [sections, seo, alternates] = await Promise.all([
    queryAll<{
      section_type: string; content_json: string; cta_json: string; media_asset_id: string | null;
    }>(c.env.DB, `
      SELECT section_type, content_json, cta_json, media_asset_id
        FROM web_page_sections
       WHERE page_id = ? AND is_active = 1
       ORDER BY sort_order
    `, [page.id]),
    seoFor(c.env.DB, 'web_page', page.id),
    queryAll<{ language: string; path: string }>(c.env.DB, `
      SELECT language, path FROM web_pages
       WHERE translation_group = ? AND status = 'published' ORDER BY language
    `, [page.translation_group]),
  ]);

  const urls = await assetUrls(c.env, [
    ...sections.map((section) => section.media_asset_id),
    seo?.og_image_asset_id,
  ]);

  const parsedSections: RenderSection[] = sections.map((section) => {
    const parse = (raw: string): Record<string, unknown> => {
      try {
        const value = JSON.parse(raw || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
      } catch {
        return {};
      }
    };
    return {
      section_type: section.section_type,
      content: parse(section.content_json),
      cta: parse(section.cta_json),
      media_url: section.media_asset_id ? urls.get(section.media_asset_id) ?? null : null,
      media_alt: null,
    };
  });

  const renderHead = head({
    site, path, language,
    title: page.title,
    description: page.summary,
    seo,
    alternates,
    indexable: page.is_indexable === 1,
    structured: [
      {
        '@context': 'https://schema.org',
        '@type': page.kind === 'home' ? 'WebSite' : 'WebPage',
        name: page.title,
        description: seo?.meta_description ?? page.summary ?? undefined,
        inLanguage: language,
        url: `${site}${path}`,
        dateModified: page.updated_at,
      },
      ...parseStructured(seo?.structured_data_json),
    ],
  }) as RenderHead;
  renderHead.og.image_url = seo?.og_image_asset_id ? urls.get(seo.og_image_asset_id) ?? null : null;

  const { nav, footerLinks } = await navigation(c.env.DB, language, path);
  const extra = await indexExtras(c.env, language, page.page_key);

  return htmlResponse(renderDocument({
    head: renderHead,
    nav,
    main: renderPageBody({
      title: page.title,
      summary: page.summary,
      sections: parsedSections,
      extra,
    }),
    footer: footerFor(language, renderHead.alternates, footerLinks),
  }), 200, page.kind === 'home' ? 300 : 600);
}

/// `GET /{language}` — the language home page.
route.get('/:language', (c, next) => {
  const language = cmsLanguage(c.req.param('language'));
  if (!language) return next();
  return renderWebPage(c, language, `/${language}`);
});

/// `GET /{language}/{slug}` — any other website page.
///
/// Registered last so `blog`, `series` and `planets` match their own handlers first.
route.get('/:language/:slug', (c, next) => {
  const language = cmsLanguage(c.req.param('language'));
  if (!language) return next();
  const slug = c.req.param('slug');
  const path = `/${language}/${slug}`;
  // Never-indexable areas are refused before a lookup, not tagged afterwards: `robots.txt`
  // asks crawlers not to fetch them, and this is the answer for the ones that ask anyway.
  if (isNeverIndexable(`/${slug}`)) return notFound(c.env, origin(c.req.raw), language, path);
  return renderWebPage(c, language, path);
});

export default route;
