/// SEO admin: metadata per public entity, redirects, and the internal audit.
///
/// ## The distinction this file is built around
///
/// An **internal audit** and a **live index status** are different claims. This code can
/// prove that a page has no meta description, that two pages share a title, that a
/// canonical points at a 404, that an `hreflang` pair is one-directional. It cannot say
/// whether Google has indexed anything, because no search-engine integration exists.
///
/// The audit therefore reports `source: 'internal_audit'` and states the limit in its own
/// payload. A dashboard that shows "SEO: healthy" without that distinction is telling an
/// operator something it does not know.

import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { requireAdmin, requirePermission } from '../lib/adminAuth';
import { actorId, auditStatement } from '../lib/auditLog';
import {
  isValidSlug,
  SEO_DESCRIPTION_MAX,
  SEO_DESCRIPTION_MIN,
  SEO_TITLE_MAX,
  validateSeo,
} from '../lib/cmsContent.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

/// Entity types `seo_meta` accepts, and the table each one lives in.
const SEO_ENTITIES: Record<string, string> = {
  web_page: 'web_pages',
  blog_post: 'blog_posts',
  series: 'series',
  story: 'stories',
  planet: 'planets',
};

/// `GET /admin/seo/:type/:id`
route.get('/seo/:type/:id', requireAdmin, async (c) => {
  const type = c.req.param('type') ?? '';
  const id = c.req.param('id') ?? '';
  const table = SEO_ENTITIES[type];
  if (!table) return c.json({ success: false, error: 'Unsupported SEO entity type' }, 400);
  const exists = await queryFirst<{ id: string }>(c.env.DB, `SELECT id FROM ${table} WHERE id = ?`, [id]);
  if (!exists) return c.json({ success: false, error: 'Entity not found' }, 404);

  const meta = await queryFirst(c.env.DB, `
    SELECT seo_title, meta_description, canonical_url, robots_index, robots_follow,
           og_title, og_description, og_image_asset_id, structured_data_json, updated_at
      FROM seo_meta WHERE entity_type = ? AND entity_id = ?
  `, [type, id]);

  return c.json({
    success: true,
    data: {
      entity_type: type,
      entity_id: id,
      seo: meta,
      // Sent so the editor shows the same limits the audit applies, rather than a second
      // set of numbers that drifts from it.
      guidance: {
        title_max: SEO_TITLE_MAX,
        description_min: SEO_DESCRIPTION_MIN,
        description_max: SEO_DESCRIPTION_MAX,
      },
    },
  });
});

/// `PUT /admin/seo/:type/:id`
route.put('/seo/:type/:id', requirePermission('edit_metadata'), async (c) => {
  const type = c.req.param('type') ?? '';
  const id = c.req.param('id') ?? '';
  const table = SEO_ENTITIES[type];
  if (!table) return c.json({ success: false, error: 'Unsupported SEO entity type' }, 400);
  const exists = await queryFirst<{ id: string }>(c.env.DB, `SELECT id FROM ${table} WHERE id = ?`, [id]);
  if (!exists) return c.json({ success: false, error: 'Entity not found' }, 404);

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);
  const result = validateSeo(body);
  if ('error' in result) return c.json({ success: false, error: result.error }, 400);
  const { seo, warnings } = result;

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO seo_meta (entity_type, entity_id, seo_title, meta_description, canonical_url,
                            robots_index, robots_follow, og_title, og_description,
                            og_image_asset_id, structured_data_json, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        seo_title = excluded.seo_title,
        meta_description = excluded.meta_description,
        canonical_url = excluded.canonical_url,
        robots_index = excluded.robots_index,
        robots_follow = excluded.robots_follow,
        og_title = excluded.og_title,
        og_description = excluded.og_description,
        og_image_asset_id = excluded.og_image_asset_id,
        structured_data_json = excluded.structured_data_json,
        updated_by = excluded.updated_by,
        updated_at = datetime('now')
    `).bind(
      type, id, seo.seo_title, seo.meta_description, seo.canonical_url,
      seo.robots_index ? 1 : 0, seo.robots_follow ? 1 : 0,
      seo.og_title, seo.og_description, seo.og_image_asset_id,
      seo.structured_data === null ? null : JSON.stringify(seo.structured_data),
      actorId(c),
    ),
    auditStatement(c.env.DB, actorId(c), 'seo_update', type, id, {
      robots_index: seo.robots_index,
      has_canonical: !!seo.canonical_url,
      has_structured_data: seo.structured_data !== null,
    }),
  ]);

  // Warnings are returned rather than enforced: these are display limits, not acceptance
  // rules, and refusing a 65-character title would be inventing a policy.
  return c.json({ success: true, data: { entity_type: type, entity_id: id, warnings } });
});

// --- Redirects -------------------------------------------------------------

route.get('/seo/redirects', requireAdmin, async (c) => {
  const rows = await queryAll(c.env.DB, `
    SELECT r.id, r.from_path, r.to_path, r.status_code, r.reason, r.created_at,
           au.display_name AS created_by_name
      FROM web_redirects r LEFT JOIN admin_users au ON au.id = r.created_by
     ORDER BY r.created_at DESC LIMIT 200
  `);
  return c.json({ success: true, data: rows, meta: { total: rows.length } });
});

route.post('/seo/redirects', requirePermission('publish'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const fromPath = typeof body?.from_path === 'string' ? body.from_path.trim() : '';
  const toPath = typeof body?.to_path === 'string' ? body.to_path.trim() : '';
  if (!fromPath.startsWith('/') || !toPath.startsWith('/')) {
    return c.json({ success: false, error: 'from_path and to_path must be site-relative paths starting with /' }, 400);
  }
  // A redirect to itself is an infinite loop served with a 301, which takes the page down
  // rather than moving it.
  if (fromPath === toPath) return c.json({ success: false, error: 'A redirect cannot point at itself' }, 400);
  const statusCode = Number(body?.status_code ?? 301);
  if (![301, 302, 308].includes(statusCode)) {
    return c.json({ success: false, error: 'status_code must be 301, 302 or 308' }, 400);
  }

  // A live page at from_path would be shadowed by the redirect and become unreachable.
  const live = await queryFirst<{ id: string }>(c.env.DB, `
    SELECT id FROM web_pages WHERE path = ? AND status = 'published'
    UNION ALL
    SELECT id FROM blog_posts WHERE path = ? AND status = 'published'
  `, [fromPath, fromPath]);
  if (live) return c.json({ success: false, error: 'A published page already serves that path' }, 409);

  const id = crypto.randomUUID();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO web_redirects (id, from_path, to_path, status_code, reason, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, fromPath, toPath, statusCode,
        typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : null, actorId(c)),
      auditStatement(c.env.DB, actorId(c), 'redirect_create', 'web_redirect', id, { fromPath, toPath, statusCode }),
    ]);
  } catch {
    return c.json({ success: false, error: 'A redirect already exists for that path' }, 409);
  }
  return c.json({ success: true, data: { id } }, 201);
});

route.delete('/seo/redirects/:id', requirePermission('publish'), async (c) => {
  const id = c.req.param('id') ?? '';
  const row = await queryFirst<{ from_path: string }>(c.env.DB, 'SELECT from_path FROM web_redirects WHERE id = ?', [id]);
  if (!row) return c.json({ success: false, error: 'Redirect not found' }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM web_redirects WHERE id = ?').bind(id),
    auditStatement(c.env.DB, actorId(c), 'redirect_delete', 'web_redirect', id, { from_path: row.from_path }),
  ]);
  return c.json({ success: true, data: { id, deleted: true } });
});

// --- The audit -------------------------------------------------------------

interface Issue {
  id: string;
  severity: 'error' | 'warning';
  entity_type: string;
  entity_id: string;
  path: string | null;
  detail: string;
}

/// `GET /admin/seo/audit`
///
/// Deterministic checks over what is in the database. Every issue names the entity and
/// the exact problem, because "12 SEO issues" is not something anyone can act on.
route.get('/seo/audit', requireAdmin, async (c) => {
  const issues: Issue[] = [];

  const pages = await queryAll<{
    id: string; path: string; title: string; language: string; status: string;
    translation_group: string; is_indexable: number;
    seo_title: string | null; meta_description: string | null; canonical_url: string | null;
    robots_index: number | null;
  }>(c.env.DB, `
    SELECT p.id, p.path, p.title, p.language, p.status, p.translation_group, p.is_indexable,
           m.seo_title, m.meta_description, m.canonical_url, m.robots_index
      FROM web_pages p
      LEFT JOIN seo_meta m ON m.entity_type = 'web_page' AND m.entity_id = p.id
  `);
  const posts = await queryAll<{
    id: string; path: string; title: string; language: string; status: string;
    translation_group: string;
    seo_title: string | null; meta_description: string | null; canonical_url: string | null;
    robots_index: number | null;
  }>(c.env.DB, `
    SELECT b.id, b.path, b.title, b.language, b.status, b.translation_group,
           m.seo_title, m.meta_description, m.canonical_url, m.robots_index
      FROM blog_posts b
      LEFT JOIN seo_meta m ON m.entity_type = 'blog_post' AND m.entity_id = b.id
  `);

  // Only published entities are audited. A draft with no meta description is not a defect;
  // reporting it as one buries the real issues under work nobody has started.
  const publicEntities = [
    ...pages.filter((page) => page.status === 'published').map((page) => ({ ...page, entity_type: 'web_page' })),
    ...posts.filter((post) => post.status === 'published').map((post) => ({ ...post, entity_type: 'blog_post', is_indexable: 1 })),
  ];

  for (const entity of publicEntities) {
    if (!entity.seo_title) {
      issues.push({
        id: 'missing_title', severity: 'error', entity_type: entity.entity_type, entity_id: entity.id,
        path: entity.path, detail: 'لا عنوان SEO؛ ستستخدم نتيجة البحث عنوان الصفحة الخام.',
      });
    } else if (entity.seo_title.length > SEO_TITLE_MAX) {
      issues.push({
        id: 'title_too_long', severity: 'warning', entity_type: entity.entity_type, entity_id: entity.id,
        path: entity.path, detail: `العنوان ${entity.seo_title.length} حرفًا؛ يُقتطع بعد ${SEO_TITLE_MAX}.`,
      });
    }
    if (!entity.meta_description) {
      issues.push({
        id: 'missing_description', severity: 'error', entity_type: entity.entity_type, entity_id: entity.id,
        path: entity.path, detail: 'لا وصف ميتا؛ محرّك البحث سيقتطع نصًّا عشوائيًا من الصفحة.',
      });
    } else if (entity.meta_description.length > SEO_DESCRIPTION_MAX) {
      issues.push({
        id: 'description_too_long', severity: 'warning', entity_type: entity.entity_type, entity_id: entity.id,
        path: entity.path, detail: `الوصف ${entity.meta_description.length} حرفًا؛ يُقتطع بعد ${SEO_DESCRIPTION_MAX}.`,
      });
    }
    // A published page marked noindex is not necessarily wrong, but it is never accidental
    // on purpose: it silently removes the page from search.
    if (entity.robots_index === 0) {
      issues.push({
        id: 'published_noindex', severity: 'warning', entity_type: entity.entity_type, entity_id: entity.id,
        path: entity.path, detail: 'الصفحة منشورة ومُعلَّمة noindex، فلن تظهر في البحث.',
      });
    }
  }

  // Duplicate titles and descriptions, within a language. Across languages a shared title
  // is normal and flagging it would train people to ignore the report.
  for (const field of ['seo_title', 'meta_description'] as const) {
    const groups = new Map<string, typeof publicEntities>();
    for (const entity of publicEntities) {
      const value = entity[field];
      if (!value) continue;
      const key = `${entity.language}::${value.trim().toLowerCase()}`;
      groups.set(key, [...(groups.get(key) ?? []), entity]);
    }
    for (const [key, entries] of groups) {
      if (entries.length < 2) continue;
      for (const entity of entries) {
        issues.push({
          id: field === 'seo_title' ? 'duplicate_title' : 'duplicate_description',
          severity: 'error',
          entity_type: entity.entity_type,
          entity_id: entity.id,
          path: entity.path,
          detail: `${entries.length} صفحات تتقاسم نفس ${field === 'seo_title' ? 'العنوان' : 'الوصف'} في اللغة ${key.split('::')[0]}.`,
        });
      }
    }
  }

  // A canonical pointing at a path nothing serves tells search engines to index a 404.
  const knownPaths = new Set([...pages.map((page) => page.path), ...posts.map((post) => post.path)]);
  for (const entity of publicEntities) {
    if (!entity.canonical_url) continue;
    try {
      const parsed = new URL(entity.canonical_url);
      if (!knownPaths.has(parsed.pathname)) {
        issues.push({
          id: 'canonical_unknown', severity: 'error', entity_type: entity.entity_type, entity_id: entity.id,
          path: entity.path, detail: `الرابط المعياري يشير إلى ${parsed.pathname} ولا صفحة تخدمه.`,
        });
      }
    } catch {
      issues.push({
        id: 'canonical_invalid', severity: 'error', entity_type: entity.entity_type, entity_id: entity.id,
        path: entity.path, detail: 'الرابط المعياري غير صالح.',
      });
    }
  }

  // hreflang: a group with one published language is a normal state, not an issue. A group
  // where a *published* variant points at an unpublished one is, because the tag would send
  // a crawler to a page that does not exist.
  const groups = new Map<string, Array<{ language: string; status: string; path: string; entity_type: string; id: string }>>();
  for (const entity of [...pages, ...posts.map((post) => ({ ...post, is_indexable: 1 }))]) {
    const list = groups.get(entity.translation_group) ?? [];
    list.push({
      language: entity.language,
      status: entity.status,
      path: entity.path,
      entity_type: 'seo_title' in entity ? (('excerpt' in entity) ? 'blog_post' : 'web_page') : 'web_page',
      id: entity.id,
    });
    groups.set(entity.translation_group, list);
  }
  for (const [group, entries] of groups) {
    const published = entries.filter((entry) => entry.status === 'published');
    const unpublished = entries.filter((entry) => entry.status !== 'published');
    if (published.length && unpublished.length) {
      for (const entry of published) {
        issues.push({
          id: 'hreflang_incomplete', severity: 'warning', entity_type: entry.entity_type, entity_id: entry.id,
          path: entry.path,
          detail: `مجموعة الترجمة «${group}» فيها ${unpublished.length} نسخة غير منشورة `
            + `(${unpublished.map((item) => item.language).join(', ')})، فلا تُدرَج في hreflang.`,
        });
      }
    }
  }

  // Duplicate paths would be a UNIQUE violation, so instead the audit checks the thing the
  // constraint cannot see: a redirect shadowing a live page.
  const redirects = await queryAll<{ id: string; from_path: string; to_path: string }>(
    c.env.DB, 'SELECT id, from_path, to_path FROM web_redirects',
  );
  for (const redirect of redirects) {
    if (knownPaths.has(redirect.from_path)) {
      issues.push({
        id: 'redirect_shadows_page', severity: 'error', entity_type: 'web_redirect', entity_id: redirect.id,
        path: redirect.from_path, detail: 'تحويل يحجب صفحة قائمة على نفس المسار.',
      });
    }
    if (!knownPaths.has(redirect.to_path) && !redirect.to_path.startsWith('http')) {
      issues.push({
        id: 'redirect_target_missing', severity: 'warning', entity_type: 'web_redirect', entity_id: redirect.id,
        path: redirect.from_path, detail: `هدف التحويل ${redirect.to_path} لا تخدمه أي صفحة.`,
      });
    }
  }

  // Blog images without alt text. Alt is required at write time, so this catches posts
  // created before that rule and any row edited directly in the database.
  const postBodies = await queryAll<{ id: string; path: string; body_json: string }>(
    c.env.DB, "SELECT id, path, body_json FROM blog_posts WHERE status = 'published'",
  );
  for (const post of postBodies) {
    try {
      const blocks = JSON.parse(post.body_json) as Array<Record<string, unknown>>;
      const missing = blocks.filter((block) => block.type === 'image' && !String(block.alt ?? '').trim()).length;
      if (missing) {
        issues.push({
          id: 'missing_alt', severity: 'error', entity_type: 'blog_post', entity_id: post.id,
          path: post.path, detail: `${missing} صورة بلا نصّ بديل.`,
        });
      }
    } catch {
      issues.push({
        id: 'body_unparseable', severity: 'error', entity_type: 'blog_post', entity_id: post.id,
        path: post.path, detail: 'جسم المقال غير قابل للتحليل.',
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  return c.json({
    success: true,
    data: {
      issues,
      summary: {
        errors: errors.length,
        warnings: issues.length - errors.length,
        audited_pages: pages.filter((page) => page.status === 'published').length,
        audited_posts: posts.filter((post) => post.status === 'published').length,
        redirects: redirects.length,
      },
      // The limit, stated in the payload rather than left to a screen to remember.
      source: 'internal_audit',
      index_status_available: false,
      index_status_note:
        'هذا تدقيق داخلي على قاعدة البيانات فقط. حالة الفهرسة الفعلية في محركات البحث '
        + 'غير متاحة: لا تكامل مع Search Console أو ما يعادله.',
    },
  });
});

/// `GET /admin/seo/slug-check` — is this slug free before an editor commits to it.
route.get('/seo/slug-check', requireAdmin, async (c) => {
  const path = c.req.query('path')?.trim() ?? '';
  const slug = c.req.query('slug')?.trim() ?? '';
  if (slug && !isValidSlug(slug)) {
    return c.json({ success: true, data: { available: false, reason: 'صيغة الاختصار غير صالحة (أحرف لاتينية صغيرة وأرقام وشُرَط).' } });
  }
  if (!path) return c.json({ success: false, error: 'path is required' }, 400);
  const taken = await queryFirst<{ id: string }>(c.env.DB, `
    SELECT id FROM web_pages WHERE path = ?
    UNION ALL SELECT id FROM blog_posts WHERE path = ?
    UNION ALL SELECT id FROM web_redirects WHERE from_path = ?
  `, [path, path, path]);
  return c.json({
    success: true,
    data: {
      available: !taken,
      // A redirect occupying the path counts as taken: publishing over it would make the
      // redirect unreachable and silently change what the old URL does.
      reason: taken ? 'المسار مستخدم بصفحة أو مقال أو تحويل قائم.' : null,
    },
  });
});

export default route;
