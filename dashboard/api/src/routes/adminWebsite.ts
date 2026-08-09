/// Website CMS admin routes: pages, sections, revisions, scheduling and publication.
///
/// ## The rule this router exists to enforce
///
/// A routine marketing change must not require a deployment. Everything an editor needs
/// — text, order, media, CTA, SEO, language, schedule — is data here, and the public
/// renderer reads it.
///
/// ## Publication follows the catalogue's shape deliberately
///
/// Create and update refuse `status = 'published'`; publication is a separate operation
/// behind the `publish` permission, it runs a readiness check first, and it records a
/// revision. That is the same separation the series and episode routes enforce, and
/// having two different publishing disciplines in one product is how one of them ends up
/// being the unguarded one.
///
/// ## Revisions
///
/// A full snapshot is written before every mutation, not after: the snapshot must capture
/// the state an editor is about to lose, and writing it afterwards records the mistake
/// instead of the thing they wanted back.

import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { requireAdmin, requirePermission } from '../lib/adminAuth';
import { actorId, auditStatement } from '../lib/auditLog';
import {
  isCmsLanguage,
  isValidSlug,
  pagePath,
  pagePublishBlockers,
  slugify,
  validateSection,
  type CmsLanguage,
} from '../lib/cmsContent.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

interface PageRow {
  id: string; page_key: string; language: CmsLanguage; path: string; slug: string;
  title: string; summary: string | null; translation_group: string; status: string;
  scheduled_at: string | null; published_at: string | null; kind: string;
  is_indexable: number; created_at: string; updated_at: string;
}

const PAGE_KINDS = ['home', 'standard', 'landing', 'legal', 'help', 'index'];

async function loadPage(db: D1Database, id: string): Promise<PageRow | null> {
  return queryFirst<PageRow>(db, 'SELECT * FROM web_pages WHERE id = ?', [id]);
}

async function loadSections(db: D1Database, pageId: string) {
  return queryAll(db, `
    SELECT s.id, s.section_type, s.sort_order, s.is_active, s.content_json, s.cta_json,
           s.media_asset_id, ca.status AS media_status, ca.title_ar AS media_title
      FROM web_page_sections s
      LEFT JOIN content_assets ca ON ca.id = s.media_asset_id
     WHERE s.page_id = ?
     ORDER BY s.sort_order, s.id
  `, [pageId]);
}

async function loadSeo(db: D1Database, entityType: string, entityId: string) {
  return queryFirst(db, `
    SELECT seo_title, meta_description, canonical_url, robots_index, robots_follow,
           og_title, og_description, og_image_asset_id, structured_data_json, updated_at
      FROM seo_meta WHERE entity_type = ? AND entity_id = ?
  `, [entityType, entityId]);
}

/// Writes a snapshot of the page as it is *now*, before the caller changes it.
async function revisionStatement(db: D1Database, page: PageRow, actor: string, note: string) {
  const sections = await loadSections(db, page.id);
  const seo = await loadSeo(db, 'web_page', page.id);
  const latest = await queryFirst<{ version: number }>(db, `
    SELECT COALESCE(MAX(version), 0) AS version FROM web_page_revisions WHERE page_id = ?
  `, [page.id]);
  return db.prepare(`
    INSERT INTO web_page_revisions (id, page_id, version, snapshot_json, note, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), page.id, Number(latest?.version ?? 0) + 1,
    JSON.stringify({ page, sections, seo }), note, actor,
  );
}

/// `GET /admin/website/pages`
route.get('/website/pages', requireAdmin, async (c) => {
  const language = c.req.query('language');
  const status = c.req.query('status');
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (language && isCmsLanguage(language)) { clauses.push('p.language = ?'); params.push(language); }
  if (status) { clauses.push('p.status = ?'); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = await queryAll(c.env.DB, `
    SELECT p.id, p.page_key, p.language, p.path, p.slug, p.title, p.status,
           p.scheduled_at, p.published_at, p.kind, p.is_indexable, p.translation_group,
           p.updated_at,
           (SELECT COUNT(*) FROM web_page_sections s WHERE s.page_id = p.id AND s.is_active = 1) AS active_sections,
           (SELECT COUNT(*) FROM web_pages t WHERE t.translation_group = p.translation_group) AS language_variants,
           (SELECT COUNT(*) FROM seo_meta m WHERE m.entity_type = 'web_page' AND m.entity_id = p.id) AS has_seo
      FROM web_pages p
      ${where}
     ORDER BY p.page_key, p.language
  `, params);
  return c.json({ success: true, data: rows, meta: { total: rows.length } });
});

/// `GET /admin/website/pages/:id` — page, sections, SEO, translations, revisions.
route.get('/website/pages/:id', requireAdmin, async (c) => {
  const page = await loadPage(c.env.DB, c.req.param('id') ?? '');
  if (!page) return c.json({ success: false, error: 'Page not found' }, 404);

  const [sections, seo, translations, revisions] = await Promise.all([
    loadSections(c.env.DB, page.id),
    loadSeo(c.env.DB, 'web_page', page.id),
    queryAll(c.env.DB, `
      SELECT id, language, path, status FROM web_pages
       WHERE translation_group = ? AND id != ? ORDER BY language
    `, [page.translation_group, page.id]),
    queryAll(c.env.DB, `
      SELECT r.id, r.version, r.note, r.created_at, au.display_name AS created_by_name
        FROM web_page_revisions r LEFT JOIN admin_users au ON au.id = r.created_by
       WHERE r.page_id = ? ORDER BY r.version DESC LIMIT 20
    `, [page.id]),
  ]);

  return c.json({
    success: true,
    data: {
      page,
      sections,
      seo,
      translations,
      revisions,
      readiness: pagePublishBlockers({
        title: page.title,
        sections: sections.map((section) => ({
          section_type: String((section as { section_type: string }).section_type),
          is_active: Number((section as { is_active: number }).is_active) === 1,
        })),
        seo: seo as { seo_title: string | null; meta_description: string | null } | null,
      }),
    },
  });
});

/// `POST /admin/website/pages` — creates a page, or a language variant of one.
route.post('/website/pages', requirePermission('create'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const pageKey = typeof body.page_key === 'string' ? slugify(body.page_key) : '';
  const language = body.language;
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  if (!pageKey) return c.json({ success: false, error: 'page_key is required' }, 400);
  if (!isCmsLanguage(language)) return c.json({ success: false, error: 'language must be ar, en or fr' }, 400);
  if (!title) return c.json({ success: false, error: 'title is required' }, 400);
  if (body.status === 'published') {
    return c.json({ success: false, error: 'Create the page unpublished, then use the publish operation' }, 400);
  }

  const kind = typeof body.kind === 'string' && PAGE_KINDS.includes(body.kind) ? body.kind : 'standard';
  const rawSlug = typeof body.slug === 'string' ? body.slug.trim() : pageKey;
  // The home page is the one page with an empty slug; everything else needs a valid one.
  const slug = kind === 'home' ? '' : (isValidSlug(rawSlug) ? rawSlug : slugify(rawSlug));
  if (kind !== 'home' && !isValidSlug(slug)) {
    return c.json({ success: false, error: 'slug must be lower-case letters, numbers and hyphens' }, 400);
  }

  const path = pagePath(language, slug);
  const clash = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM web_pages WHERE path = ?', [path]);
  if (clash) return c.json({ success: false, error: `The path ${path} is already used by another page` }, 409);

  // A translation of an existing page shares its group; a new page starts its own.
  const group = typeof body.translation_group === 'string' && body.translation_group.trim()
    ? body.translation_group.trim()
    : pageKey;

  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO web_pages (id, page_key, language, path, slug, title, summary,
                             translation_group, kind, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, pageKey, language, path, slug, title,
      typeof body.summary === 'string' ? body.summary.trim().slice(0, 500) : null,
      group, kind, actorId(c), actorId(c),
    ),
    auditStatement(c.env.DB, actorId(c), 'create', 'web_page', id, { page_key: pageKey, language, path }),
  ]);
  return c.json({ success: true, data: { id, path } }, 201);
});

/// `PATCH /admin/website/pages/:id`
route.patch('/website/pages/:id', requirePermission('edit_metadata'), async (c) => {
  const page = await loadPage(c.env.DB, c.req.param('id') ?? '');
  if (!page) return c.json({ success: false, error: 'Page not found' }, 404);
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);
  if (body.status === 'published') {
    return c.json({ success: false, error: 'Use the publish operation to publish a page' }, 400);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  const statements: D1PreparedStatement[] = [await revisionStatement(c.env.DB, page, actorId(c), 'before update')];

  if (typeof body.title === 'string' && body.title.trim()) { sets.push('title = ?'); params.push(body.title.trim().slice(0, 200)); }
  if (body.summary !== undefined) {
    sets.push('summary = ?');
    params.push(typeof body.summary === 'string' && body.summary.trim() ? body.summary.trim().slice(0, 500) : null);
  }
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!['draft', 'review', 'scheduled', 'archived'].includes(status)) {
      return c.json({ success: false, error: 'status must be draft, review, scheduled or archived here' }, 400);
    }
    // Scheduling without a time is a draft wearing a label: the scheduler has nothing to
    // act on and the editor believes the page will appear.
    if (status === 'scheduled') {
      const scheduledAt = typeof body.scheduled_at === 'string' ? body.scheduled_at : '';
      if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
        return c.json({ success: false, error: 'scheduled_at is required when status is scheduled' }, 400);
      }
      sets.push('scheduled_at = ?'); params.push(scheduledAt);
    }
    sets.push('status = ?'); params.push(status);
  }
  if (body.is_indexable !== undefined) { sets.push('is_indexable = ?'); params.push(body.is_indexable === false ? 0 : 1); }

  if (typeof body.slug === 'string' && page.kind !== 'home') {
    const slug = isValidSlug(body.slug.trim()) ? body.slug.trim() : slugify(body.slug);
    if (!isValidSlug(slug)) return c.json({ success: false, error: 'Invalid slug' }, 400);
    if (slug !== page.slug) {
      const path = pagePath(page.language, slug);
      const clash = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM web_pages WHERE path = ? AND id != ?', [path, page.id]);
      if (clash) return c.json({ success: false, error: `The path ${path} is already used` }, 409);
      sets.push('slug = ?', 'path = ?'); params.push(slug, path);
      // A slug change without a redirect discards whatever ranking and inbound links the
      // old URL had, which is the difference between renaming a page and deleting it.
      if (page.status === 'published') {
        statements.push(c.env.DB.prepare(`
          INSERT OR IGNORE INTO web_redirects (id, from_path, to_path, status_code, reason, created_by)
          VALUES (?, ?, ?, 301, ?, ?)
        `).bind(crypto.randomUUID(), page.path, path, 'slug change', actorId(c)));
      }
    }
  }

  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400);
  sets.push("updated_at = datetime('now')", 'updated_by = ?');
  params.push(actorId(c));
  statements.push(c.env.DB.prepare(`UPDATE web_pages SET ${sets.join(', ')} WHERE id = ?`).bind(...params, page.id));
  statements.push(auditStatement(c.env.DB, actorId(c), 'update', 'web_page', page.id, body));

  await c.env.DB.batch(statements);
  return c.json({ success: true, data: { id: page.id, updated: true } });
});

/// `PUT /admin/website/pages/:id/sections` — replaces the section list.
///
/// Whole-list replacement rather than per-section patching: reordering, adding and
/// removing normally happen together in one editing session, and three endpoints would
/// let a page end up half-saved between them.
route.put('/website/pages/:id/sections', requirePermission('edit_text'), async (c) => {
  const page = await loadPage(c.env.DB, c.req.param('id') ?? '');
  if (!page) return c.json({ success: false, error: 'Page not found' }, 404);
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!Array.isArray(body?.sections)) return c.json({ success: false, error: 'sections must be an array' }, 400);
  if (body.sections.length > 40) return c.json({ success: false, error: 'A page may hold 40 sections or fewer' }, 400);

  const validated = [];
  for (const [index, raw] of body.sections.entries()) {
    if (!raw || typeof raw !== 'object') return c.json({ success: false, error: `section ${index + 1} must be an object` }, 400);
    const result = validateSection(raw as Record<string, unknown>);
    if ('error' in result) return c.json({ success: false, error: `section ${index + 1}: ${result.error}` }, 400);
    validated.push(result.section);
  }

  const statements: D1PreparedStatement[] = [
    await revisionStatement(c.env.DB, page, actorId(c), 'before sections update'),
    c.env.DB.prepare('DELETE FROM web_page_sections WHERE page_id = ?').bind(page.id),
  ];
  for (const [index, section] of validated.entries()) {
    statements.push(c.env.DB.prepare(`
      INSERT INTO web_page_sections
        (id, page_id, section_type, sort_order, is_active, content_json, media_asset_id, cta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), page.id, section.section_type,
      // The array order is the truth, not a client-supplied sort_order that can arrive
      // with duplicates and produce a non-deterministic page.
      index, section.is_active ? 1 : 0,
      JSON.stringify(section.content), section.media_asset_id, JSON.stringify(section.cta),
    ));
  }
  statements.push(c.env.DB.prepare("UPDATE web_pages SET updated_at = datetime('now'), updated_by = ? WHERE id = ?").bind(actorId(c), page.id));
  statements.push(auditStatement(c.env.DB, actorId(c), 'update_sections', 'web_page', page.id, {
    count: validated.length, types: validated.map((section) => section.section_type),
  }));

  await c.env.DB.batch(statements);
  return c.json({ success: true, data: { id: page.id, sections: validated.length } });
});

/// `POST /admin/website/pages/:id/publish`
route.post('/website/pages/:id/publish', requirePermission('publish'), async (c) => {
  const page = await loadPage(c.env.DB, c.req.param('id') ?? '');
  if (!page) return c.json({ success: false, error: 'Page not found' }, 404);
  if (page.status === 'archived') return c.json({ success: false, error: 'An archived page cannot be published' }, 409);

  const sections = await loadSections(c.env.DB, page.id);
  const seo = await loadSeo(c.env.DB, 'web_page', page.id);
  const findings = pagePublishBlockers({
    title: page.title,
    sections: sections.map((section) => ({
      section_type: String((section as { section_type: string }).section_type),
      is_active: Number((section as { is_active: number }).is_active) === 1,
    })),
    seo: seo as { seo_title: string | null; meta_description: string | null } | null,
  });
  const blockers = findings.filter((finding) => finding.severity === 'blocker');
  if (blockers.length) {
    await auditStatement(c.env.DB, actorId(c), 'publish_blocked', 'web_page', page.id, {
      blockers: blockers.map((blocker) => blocker.id),
    }).run();
    return c.json({
      success: false,
      error: `Publish blocked by ${blockers.length} check(s)`,
      data: { blockers, warnings: findings.filter((finding) => finding.severity === 'warning') },
    }, 409);
  }

  await c.env.DB.batch([
    await revisionStatement(c.env.DB, page, actorId(c), 'before publish'),
    c.env.DB.prepare(`
      UPDATE web_pages
         SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = datetime('now'), updated_by = ?
       WHERE id = ?
    `).bind(new Date().toISOString(), actorId(c), page.id),
    auditStatement(c.env.DB, actorId(c), 'publish', 'web_page', page.id, {
      path: page.path,
      warnings: findings.filter((finding) => finding.severity === 'warning').map((finding) => finding.id),
    }),
  ]);
  return c.json({
    success: true,
    data: { id: page.id, path: page.path, warnings: findings.filter((finding) => finding.severity === 'warning') },
  });
});

/// `POST /admin/website/pages/:id/rollback` — restores a revision.
route.post('/website/pages/:id/rollback', requirePermission('publish'), async (c) => {
  const page = await loadPage(c.env.DB, c.req.param('id') ?? '');
  if (!page) return c.json({ success: false, error: 'Page not found' }, 404);
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const version = Number(body?.version);
  if (!Number.isInteger(version) || version < 1) return c.json({ success: false, error: 'version is required' }, 400);

  const revision = await queryFirst<{ snapshot_json: string }>(c.env.DB, `
    SELECT snapshot_json FROM web_page_revisions WHERE page_id = ? AND version = ?
  `, [page.id, version]);
  if (!revision) return c.json({ success: false, error: 'Revision not found' }, 404);

  const snapshot = JSON.parse(revision.snapshot_json) as {
    page: PageRow;
    sections: Array<Record<string, unknown>>;
  };

  const statements: D1PreparedStatement[] = [
    // The current state is snapshotted first, so a rollback is itself reversible.
    await revisionStatement(c.env.DB, page, actorId(c), `before rollback to v${version}`),
    c.env.DB.prepare(`
      UPDATE web_pages SET title = ?, summary = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?
    `).bind(snapshot.page.title, snapshot.page.summary, actorId(c), page.id),
    c.env.DB.prepare('DELETE FROM web_page_sections WHERE page_id = ?').bind(page.id),
  ];
  for (const [index, section] of (snapshot.sections ?? []).entries()) {
    statements.push(c.env.DB.prepare(`
      INSERT INTO web_page_sections
        (id, page_id, section_type, sort_order, is_active, content_json, media_asset_id, cta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), page.id, String(section.section_type), index,
      Number(section.is_active) === 1 ? 1 : 0,
      String(section.content_json ?? '{}'), section.media_asset_id ?? null,
      String(section.cta_json ?? '{}'),
    ));
  }
  // The status is not restored: rolling content back must not silently republish a page
  // an editor had unpublished, nor unpublish a live one.
  statements.push(auditStatement(c.env.DB, actorId(c), 'rollback', 'web_page', page.id, { version }));

  await c.env.DB.batch(statements);
  return c.json({ success: true, data: { id: page.id, restored_version: version } });
});

export default route;
