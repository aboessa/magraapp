/// Public delivery for the website and blog: page and post payloads, hreflang, redirects,
/// `sitemap.xml` and `robots.txt`.
///
/// ## Why the metadata is assembled here and not in the client
///
/// A crawler that has to execute JavaScript to find a title is a crawler that may not.
/// Every SEO-critical value — title, description, canonical, robots directives, Open
/// Graph, JSON-LD, the `hreflang` alternates, `lang` and `dir` — is computed server-side
/// and returned with the page, so the renderer emits it into the document rather than
/// deriving it. The sitemap and robots are served as XML and text from the same source of
/// truth, which is the only way they cannot disagree with what is actually published.
///
/// ## Where the HTML is
///
/// `routes/publicRender.ts` renders these same payloads into a complete initial document.
/// It imports [head] from this file rather than recomputing anything, so the JSON a client
/// reads and the markup a crawler reads cannot disagree about a canonical or a robots
/// directive.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { cachedPublicJson } from '../lib/publicCache.ts';
import { CMS_LANGUAGES, direction, type CmsLanguage } from '../lib/cmsContent.ts';
import { planetLanguages, planetPath, seriesLanguages, seriesPath } from '../lib/publicRoutes.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

/// Absolute site origin, used for canonical URLs and the sitemap.
///
/// Derived from the request rather than configured: the same Worker serves preview and
/// production hostnames, and a hard-coded origin would put production URLs into a preview
/// sitemap.
export const origin = (request: Request) => new URL(request.url).origin;

export interface SeoRow {
  seo_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  robots_index: number;
  robots_follow: number;
  og_title: string | null;
  og_description: string | null;
  og_image_asset_id: string | null;
  structured_data_json: string | null;
}

/// The head block for one public URL.
///
/// `robots` is emitted as a directive string because that is what the meta tag takes, and
/// building it here keeps one place responsible for the noindex decision.
export function head(input: {
  site: string;
  path: string;
  language: CmsLanguage;
  title: string;
  description: string | null;
  seo: SeoRow | null;
  alternates: Array<{ language: string; path: string }>;
  indexable: boolean;
  structured: unknown[];
  /// `article` for a blog post, `website` for everything else. Open Graph uses the type to
  /// decide which card to build, and a post shared as `website` loses its byline and date.
  ogType?: string;
}) {
  const seo = input.seo;
  const canonical = seo?.canonical_url ?? `${input.site}${input.path}`;
  const index = input.indexable && (seo?.robots_index ?? 1) === 1;
  const follow = (seo?.robots_follow ?? 1) === 1;

  return {
    title: seo?.seo_title ?? input.title,
    description: seo?.meta_description ?? input.description,
    canonical,
    lang: input.language,
    dir: direction(input.language),
    robots: `${index ? 'index' : 'noindex'}, ${follow ? 'follow' : 'nofollow'}`,
    og: {
      title: seo?.og_title ?? seo?.seo_title ?? input.title,
      description: seo?.og_description ?? seo?.meta_description ?? input.description,
      url: canonical,
      type: input.ogType ?? 'website',
      locale: input.language,
      image_asset_id: seo?.og_image_asset_id ?? null,
    },
    // Only published alternates are listed. An hreflang pointing at an unpublished URL
    // sends a crawler to a 404 and invalidates the whole cluster.
    alternates: [
      ...input.alternates.map((alternate) => ({
        hreflang: alternate.language,
        href: `${input.site}${alternate.path}`,
      })),
      // x-default points at Arabic: it is the product's primary language, and omitting
      // x-default leaves the choice for unmatched locales to the crawler.
      ...(input.alternates.some((alternate) => alternate.language === 'ar')
        ? [{
            hreflang: 'x-default',
            href: `${input.site}${input.alternates.find((alternate) => alternate.language === 'ar')!.path}`,
          }]
        : []),
    ],
    structured_data: input.structured,
  };
}

const parseStructured = (raw: string | null): unknown[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
};

/// `GET /api/v1/site/resolve?path=/ar/plans`
///
/// One lookup that answers what a URL is: a page, a post, a redirect, or nothing. The
/// renderer needs exactly this before it can choose a status code, and doing it in one
/// call is what lets a redirect return 301 instead of a 404 followed by a client-side
/// bounce.
route.get('/resolve', async (c) => {
  const path = c.req.query('path')?.trim() ?? '';
  if (!path.startsWith('/')) return c.json({ success: false, error: 'path is required' }, 400);

  const redirect = await queryFirst<{ to_path: string; status_code: number }>(c.env.DB, `
    SELECT to_path, status_code FROM web_redirects WHERE from_path = ?
  `, [path]);
  if (redirect) {
    return c.json({
      success: true,
      data: { kind: 'redirect', to: redirect.to_path, status: redirect.status_code },
    });
  }

  const page = await queryFirst<{ id: string }>(c.env.DB, `
    SELECT id FROM web_pages WHERE path = ? AND status = 'published'
  `, [path]);
  if (page) return c.json({ success: true, data: { kind: 'page', id: page.id } });

  const post = await queryFirst<{ id: string }>(c.env.DB, `
    SELECT id FROM blog_posts WHERE path = ? AND status = 'published'
  `, [path]);
  if (post) return c.json({ success: true, data: { kind: 'post', id: post.id } });

  // 404 as a status, not as an error envelope: the renderer must serve a real 404 page.
  return c.json({ success: true, data: { kind: 'not_found' } }, 404);
});

/// `GET /api/v1/site/page?path=/ar/plans`
route.get('/page', async (c) => {
  const path = c.req.query('path')?.trim() ?? '';
  if (!path.startsWith('/')) return c.json({ success: false, error: 'path is required' }, 400);

  const page = await queryFirst<{
    id: string; page_key: string; language: CmsLanguage; path: string; title: string;
    summary: string | null; kind: string; translation_group: string; is_indexable: number;
    published_at: string | null; updated_at: string;
  }>(c.env.DB, `
    SELECT id, page_key, language, path, title, summary, kind, translation_group,
           is_indexable, published_at, updated_at
      FROM web_pages WHERE path = ? AND status = 'published'
  `, [path]);
  if (!page) return c.json({ success: false, error: 'Page not found' }, 404);

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const [sections, seo, alternates] = await Promise.all([
      queryAll(c.env.DB, `
        SELECT s.section_type, s.sort_order, s.content_json, s.cta_json,
               s.media_asset_id, ca.r2_key AS media_key, ca.bucket AS media_bucket
          FROM web_page_sections s
          LEFT JOIN content_assets ca ON ca.id = s.media_asset_id AND ca.status = 'ready'
         WHERE s.page_id = ? AND s.is_active = 1
         ORDER BY s.sort_order
      `, [page.id]),
      queryFirst<SeoRow>(c.env.DB, `
        SELECT seo_title, meta_description, canonical_url, robots_index, robots_follow,
               og_title, og_description, og_image_asset_id, structured_data_json
          FROM seo_meta WHERE entity_type = 'web_page' AND entity_id = ?
      `, [page.id]),
      queryAll<{ language: string; path: string }>(c.env.DB, `
        SELECT language, path FROM web_pages
         WHERE translation_group = ? AND status = 'published'
         ORDER BY language
      `, [page.translation_group]),
    ]);

    return {
      success: true,
      data: {
        page: {
          id: page.id, page_key: page.page_key, language: page.language, path: page.path,
          title: page.title, summary: page.summary, kind: page.kind,
          published_at: page.published_at, updated_at: page.updated_at,
        },
        sections,
        head: head({
          site: origin(c.req.raw),
          path: page.path,
          language: page.language,
          title: page.title,
          description: page.summary,
          seo,
          alternates,
          indexable: page.is_indexable === 1,
          structured: parseStructured(seo?.structured_data_json ?? null),
        }),
      },
    };
  });
});

/// `GET /api/v1/site/blog?language=ar&limit=12&offset=0`
route.get('/blog', async (c) => {
  const language = CMS_LANGUAGES.includes(c.req.query('language') as CmsLanguage)
    ? c.req.query('language') as CmsLanguage
    : 'ar';
  const limit = Math.min(Math.max(Number.parseInt(c.req.query('limit') ?? '12', 10) || 12, 1), 50);
  const offset = Math.max(Number.parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  const category = c.req.query('category');
  const tag = c.req.query('tag');

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const clauses = ["b.status = 'published'", 'b.language = ?'];
    const params: unknown[] = [language];
    if (category) { clauses.push('cat.slug = ?'); params.push(category); }
    if (tag) {
      clauses.push('EXISTS (SELECT 1 FROM blog_post_tags pt WHERE pt.post_id = b.id AND pt.tag_slug = ?)');
      params.push(tag);
    }
    const where = `WHERE ${clauses.join(' AND ')}`;

    const total = await queryFirst<{ total: number }>(c.env.DB, `
      SELECT COUNT(*) AS total FROM blog_posts b
        LEFT JOIN blog_categories cat ON cat.id = b.category_id ${where}
    `, params);
    const posts = await queryAll(c.env.DB, `
      SELECT b.id, b.slug, b.path, b.title, b.excerpt, b.published_at, b.hero_asset_id,
             a.display_name AS author_name, cat.name AS category_name, cat.slug AS category_slug
        FROM blog_posts b
        LEFT JOIN blog_authors a ON a.id = b.author_id
        LEFT JOIN blog_categories cat ON cat.id = b.category_id
        ${where}
       ORDER BY b.published_at DESC
       LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return {
      success: true,
      data: posts,
      meta: {
        total: Number(total?.total ?? 0), limit, offset, language,
        // Pagination for crawlers: without these a paginated archive either looks like
        // duplicate content or hides everything past page one.
        has_next: offset + limit < Number(total?.total ?? 0),
        has_previous: offset > 0,
      },
    };
  });
});

/// `GET /api/v1/site/blog/post?path=/ar/blog/slug`
route.get('/blog/post', async (c) => {
  const path = c.req.query('path')?.trim() ?? '';
  if (!path.startsWith('/')) return c.json({ success: false, error: 'path is required' }, 400);

  const post = await queryFirst<{
    id: string; language: CmsLanguage; path: string; title: string; excerpt: string | null;
    body_json: string; hero_asset_id: string | null; translation_group: string;
    published_at: string | null; updated_at: string;
    author_name: string | null; author_bio: string | null;
    category_name: string | null; category_slug: string | null;
  }>(c.env.DB, `
    SELECT b.id, b.language, b.path, b.title, b.excerpt, b.body_json, b.hero_asset_id,
           b.translation_group, b.published_at, b.updated_at,
           a.display_name AS author_name, a.bio AS author_bio,
           cat.name AS category_name, cat.slug AS category_slug
      FROM blog_posts b
      LEFT JOIN blog_authors a ON a.id = b.author_id
      LEFT JOIN blog_categories cat ON cat.id = b.category_id
     WHERE b.path = ? AND b.status = 'published'
  `, [path]);
  if (!post) return c.json({ success: false, error: 'Post not found' }, 404);

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const [seo, alternates, tags] = await Promise.all([
      queryFirst<SeoRow>(c.env.DB, `
        SELECT seo_title, meta_description, canonical_url, robots_index, robots_follow,
               og_title, og_description, og_image_asset_id, structured_data_json
          FROM seo_meta WHERE entity_type = 'blog_post' AND entity_id = ?
      `, [post.id]),
      queryAll<{ language: string; path: string }>(c.env.DB, `
        SELECT language, path FROM blog_posts
         WHERE translation_group = ? AND status = 'published' ORDER BY language
      `, [post.translation_group]),
      queryAll<{ tag_slug: string }>(c.env.DB, 'SELECT tag_slug FROM blog_post_tags WHERE post_id = ?', [post.id]),
    ]);

    const site = origin(c.req.raw);
    const editorStructured = parseStructured(seo?.structured_data_json ?? null);
    // A derived Article plus BreadcrumbList, with the editor's JSON-LD appended rather
    // than replaced: hand-written structured data is usually an addition, and dropping the
    // derived pair because someone added an FAQ block would lose the article markup.
    const derived = [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: seo?.meta_description ?? post.excerpt,
        inLanguage: post.language,
        datePublished: post.published_at,
        dateModified: post.updated_at,
        author: post.author_name ? { '@type': 'Person', name: post.author_name } : undefined,
        mainEntityOfPage: `${site}${post.path}`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Majarra', item: `${site}/${post.language}` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${site}/${post.language}/blog` },
          { '@type': 'ListItem', position: 3, name: post.title, item: `${site}${post.path}` },
        ],
      },
    ];

    return {
      success: true,
      data: {
        post: {
          id: post.id, language: post.language, path: post.path, title: post.title,
          excerpt: post.excerpt, body: JSON.parse(post.body_json || '[]'),
          hero_asset_id: post.hero_asset_id, published_at: post.published_at,
          updated_at: post.updated_at,
          author: post.author_name ? { name: post.author_name, bio: post.author_bio } : null,
          category: post.category_slug ? { name: post.category_name, slug: post.category_slug } : null,
          tags: tags.map((tag) => tag.tag_slug),
        },
        head: head({
          site,
          path: post.path,
          language: post.language,
          title: post.title,
          description: post.excerpt,
          seo,
          alternates,
          indexable: true,
          structured: [...derived, ...editorStructured],
          ogType: 'article',
        }),
      },
    };
  });
});

export default route;

/// `GET /sitemap.xml` and `GET /robots.txt`, mounted at the root in `index.ts`.
///
/// Served as real XML and text rather than JSON a client transforms: a crawler fetches
/// these directly and never runs the application.
export const siteFiles = new Hono<AppEnv>();

interface SitemapEntry {
  path: string;
  updated_at: string;
  language: string;
  translation_group: string;
}

/// Published, indexable website pages.
///
/// The `seo_meta` join is the fix for a real disagreement: the previous query filtered on
/// `web_pages.is_indexable` alone, so a page whose SEO record set `robots_index = 0` was
/// advertised in the sitemap while its own document said `noindex`. A sitemap that lists a
/// URL the page asks not to index is a contradiction a crawler resolves by trusting neither.
const sitemapPages = (db: D1Database) => queryAll<SitemapEntry>(db, `
  SELECT p.path, p.updated_at, p.language, p.translation_group
    FROM web_pages p
    LEFT JOIN seo_meta m ON m.entity_type = 'web_page' AND m.entity_id = p.id
   WHERE p.status = 'published' AND p.is_indexable = 1 AND COALESCE(m.robots_index, 1) = 1
   ORDER BY p.path
`);

const sitemapPosts = (db: D1Database) => queryAll<SitemapEntry>(db, `
  SELECT b.path, b.updated_at, b.language, b.translation_group
    FROM blog_posts b
    LEFT JOIN seo_meta m ON m.entity_type = 'blog_post' AND m.entity_id = b.id
   WHERE b.status = 'published' AND COALESCE(m.robots_index, 1) = 1
   ORDER BY b.published_at DESC
`);

/// Catalogue pages, one entry per language the copy actually exists in.
///
/// `lib/publicRoutes.ts` owns that decision so the renderer cannot 404 a URL listed here.
async function sitemapCatalogue(db: D1Database): Promise<SitemapEntry[]> {
  const [series, planets] = await Promise.all([
    queryAll<{
      slug: string; updated_at: string; title_ar: string | null; title_en: string | null;
      description_ar: string | null; description_en: string | null;
    }>(db, `
      SELECT s.slug, s.updated_at, s.title_ar, s.title_en, s.description_ar, s.description_en
        FROM series s
        LEFT JOIN seo_meta m ON m.entity_type = 'series' AND m.entity_id = s.id
       WHERE s.status = 'published' AND COALESCE(m.robots_index, 1) = 1
       ORDER BY s.slug
    `),
    queryAll<{ id: string; created_at: string; name_ar: string | null; name_en: string | null; description_ar: string | null }>(db, `
      SELECT p.id, p.created_at, p.name_ar, p.name_en, p.description_ar
        FROM planets p
        LEFT JOIN seo_meta m ON m.entity_type = 'planet' AND m.entity_id = p.id
       WHERE p.is_active = 1 AND COALESCE(m.robots_index, 1) = 1
       ORDER BY p.sort_order, p.id
    `),
  ]);

  const entries: SitemapEntry[] = [];
  for (const row of series) {
    for (const language of seriesLanguages(row)) {
      entries.push({
        path: seriesPath(language, row.slug),
        updated_at: row.updated_at,
        language,
        translation_group: `series:${row.slug}`,
      });
    }
  }
  for (const row of planets) {
    for (const language of planetLanguages(row)) {
      entries.push({
        path: planetPath(language, row.id),
        updated_at: row.created_at,
        language,
        translation_group: `planet:${row.id}`,
      });
    }
  }
  return entries;
}

/// One `<urlset>`, with `hreflang` alternates grouped by translation group.
///
/// Alternates appear here as well as in the document: a crawler that finds a URL in a
/// sitemap should learn about its translations without fetching the page first.
function urlset(site: string, entries: SitemapEntry[]): string {
  const byGroup = new Map<string, Array<{ language: string; path: string }>>();
  for (const entry of entries) {
    byGroup.set(entry.translation_group, [
      ...(byGroup.get(entry.translation_group) ?? []),
      { language: entry.language, path: entry.path },
    ]);
  }

  const body = entries.map((entry) => {
    const alternates = byGroup.get(entry.translation_group) ?? [];
    // A single-language group needs no alternates: one `xhtml:link` pointing at the URL
    // itself is noise, and a cluster of one is not a cluster.
    const links = alternates.length > 1
      ? alternates.map((alternate) =>
          `    <xhtml:link rel="alternate" hreflang="${alternate.language}" href="${site}${alternate.path}"/>`).join('\n')
      : '';
    return `  <url>\n    <loc>${site}${entry.path}</loc>\n`
      + `    <lastmod>${(entry.updated_at ?? '').slice(0, 10)}</lastmod>\n`
      + (links ? `${links}\n` : '')
      + '  </url>';
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`
    + `${body}\n</urlset>\n`;
}

const xmlResponse = (xml: string) => new Response(xml, {
  headers: {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=300, s-maxage=3600',
  },
});

/// The complete sitemap, and the one `robots.txt` declares.
///
/// Declaring exactly one map keeps discovery unambiguous. The section maps below exist for
/// operators and for the SEO screen's sitemap state, not as a second discovery path.
siteFiles.get('/sitemap.xml', async (c) => {
  const site = origin(c.req.raw);
  const [pages, posts, catalogue] = await Promise.all([
    sitemapPages(c.env.DB),
    sitemapPosts(c.env.DB),
    sitemapCatalogue(c.env.DB),
  ]);
  return xmlResponse(urlset(site, [...pages, ...posts, ...catalogue]));
});

siteFiles.get('/sitemap-pages.xml', async (c) =>
  xmlResponse(urlset(origin(c.req.raw), await sitemapPages(c.env.DB))));

siteFiles.get('/sitemap-blog.xml', async (c) =>
  xmlResponse(urlset(origin(c.req.raw), await sitemapPosts(c.env.DB))));

siteFiles.get('/sitemap-catalogue.xml', async (c) =>
  xmlResponse(urlset(origin(c.req.raw), await sitemapCatalogue(c.env.DB))));

/// A sitemap index over the three section maps.
///
/// No `lastmod`: every map is built per request from the database, so any date here would
/// be the time of this request rather than the time the content changed, and a `lastmod`
/// that always says "now" trains a crawler to ignore it.
siteFiles.get('/sitemap-index.xml', (c) => {
  const site = origin(c.req.raw);
  const maps = ['/sitemap-pages.xml', '/sitemap-blog.xml', '/sitemap-catalogue.xml']
    .map((path) => `  <sitemap>\n    <loc>${site}${path}</loc>\n  </sitemap>`).join('\n');
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${maps}\n</sitemapindex>\n`);
});


siteFiles.get('/robots.txt', (c) => {
  const site = origin(c.req.raw);
  // The disallow list is explicit rather than trusting a noindex tag the crawler only sees
  // after fetching the page: the admin and the authenticated app must not be crawled at
  // all, and preview URLs must never be discoverable.
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /preview',
    'Disallow: /app',
    'Disallow: /account',
    '',
    `Sitemap: ${site}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
