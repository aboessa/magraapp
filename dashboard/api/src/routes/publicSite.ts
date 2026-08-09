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
/// ## What this does not do
///
/// It does not render HTML. The public site is a client-rendered application, so these
/// payloads still need a renderer that puts them in the initial document; that gap is
/// recorded rather than papered over. What is fixed here is the harder half: there is now
/// a single server-side answer for what every public URL should say.

import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { cachedPublicJson } from '../lib/publicCache';
import { CMS_LANGUAGES, direction, type CmsLanguage } from '../lib/cmsContent.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

/// Absolute site origin, used for canonical URLs and the sitemap.
///
/// Derived from the request rather than configured: the same Worker serves preview and
/// production hostnames, and a hard-coded origin would put production URLs into a preview
/// sitemap.
const origin = (request: Request) => new URL(request.url).origin;

interface SeoRow {
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
function head(input: {
  site: string;
  path: string;
  language: CmsLanguage;
  title: string;
  description: string | null;
  seo: SeoRow | null;
  alternates: Array<{ language: string; path: string }>;
  indexable: boolean;
  structured: unknown[];
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
      type: 'website',
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

siteFiles.get('/sitemap.xml', async (c) => {
  const site = origin(c.req.raw);
  const [pages, posts] = await Promise.all([
    queryAll<{ path: string; updated_at: string; language: string; translation_group: string }>(c.env.DB, `
      SELECT path, updated_at, language, translation_group FROM web_pages
       WHERE status = 'published' AND is_indexable = 1 ORDER BY path
    `),
    queryAll<{ path: string; updated_at: string; language: string; translation_group: string }>(c.env.DB, `
      SELECT b.path, b.updated_at, b.language, b.translation_group FROM blog_posts b
        LEFT JOIN seo_meta m ON m.entity_type = 'blog_post' AND m.entity_id = b.id
       WHERE b.status = 'published' AND COALESCE(m.robots_index, 1) = 1
       ORDER BY b.published_at DESC
    `),
  ]);

  // hreflang inside the sitemap as well as in the document: a crawler that finds a URL
  // here should learn about its alternates without fetching the page first.
  const byGroup = new Map<string, Array<{ language: string; path: string }>>();
  for (const entry of [...pages, ...posts]) {
    byGroup.set(entry.translation_group, [
      ...(byGroup.get(entry.translation_group) ?? []),
      { language: entry.language, path: entry.path },
    ]);
  }

  const entries = [...pages, ...posts].map((entry) => {
    const alternates = byGroup.get(entry.translation_group) ?? [];
    const links = alternates.map((alternate) =>
      `    <xhtml:link rel="alternate" hreflang="${alternate.language}" href="${site}${alternate.path}"/>`).join('\n');
    return `  <url>\n    <loc>${site}${entry.path}</loc>\n`
      + `    <lastmod>${(entry.updated_at ?? '').slice(0, 10)}</lastmod>\n`
      + (links ? `${links}\n` : '')
      + '  </url>';
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`
    + `${entries}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
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
