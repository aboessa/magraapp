/// Blog CMS admin routes: posts, blocks, taxonomy, revisions, autosave, publication.
///
/// Same publication discipline as the website pages and the catalogue: create and patch
/// refuse `published`, publication is its own operation behind the `publish` permission
/// and runs the readiness check first. Religious posts are gated by the existing
/// `lib/islamicContent.ts` predicate rather than a new one.
///
/// ## Autosave and revisions are the same table with a flag
///
/// An editor looking for "the version before I broke it" must not scroll through sixty
/// autosaves, and an autosave must not overwrite the checkpoint someone deliberately
/// created. `is_autosave` separates them; autosaves are pruned, manual revisions are not.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';
import { isIslamicContent } from '../lib/islamicContent.ts';
import {
  blocksToText,
  isCmsLanguage,
  isValidSlug,
  postPath,
  postPublishBlockers,
  slugify,
  validateBlocks,
  type Block,
  type CmsLanguage,
} from '../lib/cmsContent.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

/// Autosaves kept per post. Enough to recover a session, few enough that the history
/// list stays readable.
const AUTOSAVE_KEEP = 10;

interface PostRow {
  id: string; post_key: string; language: CmsLanguage; slug: string; path: string;
  title: string; excerpt: string | null; body_json: string; hero_asset_id: string | null;
  author_id: string | null; category_id: string | null; translation_group: string;
  status: string; scheduled_at: string | null; published_at: string | null;
  related_posts_json: string; related_content_json: string; cta_json: string;
  source_type: string | null; source_reference: string | null;
  religious_reviewer_id: string | null; religious_approved_at: string | null;
  created_at: string; updated_at: string;
}

const loadPost = (db: D1Database, id: string) =>
  queryFirst<PostRow>(db, 'SELECT * FROM blog_posts WHERE id = ?', [id]);

const parseBlocks = (raw: string): Block[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Block[] : [];
  } catch {
    return [];
  }
};

async function loadSeo(db: D1Database, postId: string) {
  return queryFirst<{ seo_title: string | null; meta_description: string | null }>(db, `
    SELECT seo_title, meta_description FROM seo_meta WHERE entity_type = 'blog_post' AND entity_id = ?
  `, [postId]);
}

/// A post is religious when the same predicate that governs series and episodes says so.
const isReligious = (post: { category_id: string | null; source_type: string | null }, categoryKey: string | null) =>
  isIslamicContent(categoryKey === 'islamic' ? 'islamic' : null, post.source_type);

async function revisionStatement(
  db: D1Database,
  post: PostRow,
  actor: string,
  options: { autosave: boolean; note?: string },
) {
  const latest = await queryFirst<{ version: number }>(db, `
    SELECT COALESCE(MAX(version), 0) AS version FROM blog_post_revisions WHERE post_id = ?
  `, [post.id]);
  return db.prepare(`
    INSERT INTO blog_post_revisions (id, post_id, version, snapshot_json, is_autosave, note, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), post.id, Number(latest?.version ?? 0) + 1,
    JSON.stringify(post), options.autosave ? 1 : 0, options.note ?? null, actor,
  );
}

// --- Taxonomy --------------------------------------------------------------

route.get('/blog/taxonomy', requireAdmin, async (c) => {
  const [authors, categories, tags] = await Promise.all([
    queryAll(c.env.DB, 'SELECT id, display_name, bio, avatar_asset_id, is_active FROM blog_authors ORDER BY display_name'),
    queryAll(c.env.DB, 'SELECT id, category_key, language, name, slug, sort_order FROM blog_categories ORDER BY sort_order, name'),
    queryAll(c.env.DB, `
      SELECT t.slug, t.name_ar, t.name_en, t.name_fr,
             (SELECT COUNT(*) FROM blog_post_tags pt WHERE pt.tag_slug = t.slug) AS post_count
        FROM blog_tags t ORDER BY t.slug
    `),
  ]);
  return c.json({ success: true, data: { authors, categories, tags } });
});

route.post('/blog/authors', requirePermission('create'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const displayName = typeof body?.display_name === 'string' ? body.display_name.trim().slice(0, 120) : '';
  if (!displayName) return c.json({ success: false, error: 'display_name is required' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO blog_authors (id, admin_user_id, display_name, bio, avatar_asset_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      id,
      typeof body?.admin_user_id === 'string' && body.admin_user_id ? body.admin_user_id : null,
      displayName,
      typeof body?.bio === 'string' ? body.bio.trim().slice(0, 1_000) : null,
      typeof body?.avatar_asset_id === 'string' && body.avatar_asset_id ? body.avatar_asset_id : null,
    ),
    auditStatement(c.env.DB, actorId(c), 'create', 'blog_author', id, { display_name: displayName }),
  ]);
  return c.json({ success: true, data: { id } }, 201);
});

route.post('/blog/categories', requirePermission('create'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const key = typeof body?.category_key === 'string' ? slugify(body.category_key) : '';
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const language = body?.language;
  if (!key || !name || !isCmsLanguage(language)) {
    return c.json({ success: false, error: 'category_key, name and language (ar|en|fr) are required' }, 400);
  }
  const slug = typeof body?.slug === 'string' && isValidSlug(body.slug) ? body.slug : key;
  const id = crypto.randomUUID();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO blog_categories (id, category_key, language, name, slug, description, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(id, key, language, name, slug,
        typeof body?.description === 'string' ? body.description.trim().slice(0, 500) : null,
        Number.isFinite(Number(body?.sort_order)) ? Math.trunc(Number(body?.sort_order)) : 0),
      auditStatement(c.env.DB, actorId(c), 'create', 'blog_category', id, { key, language, slug }),
    ]);
  } catch {
    // The UNIQUE constraints are on (category_key, language) and (language, slug); either
    // collision means the category already exists in that language.
    return c.json({ success: false, error: 'A category with that key or slug already exists in this language' }, 409);
  }
  return c.json({ success: true, data: { id } }, 201);
});

route.post('/blog/tags', requirePermission('create'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const slug = typeof body?.slug === 'string' && isValidSlug(body.slug) ? body.slug : '';
  const nameAr = typeof body?.name_ar === 'string' ? body.name_ar.trim().slice(0, 80) : '';
  if (!slug || !nameAr) return c.json({ success: false, error: 'slug and name_ar are required' }, 400);
  await c.env.DB.prepare(`
    INSERT INTO blog_tags (slug, name_ar, name_en, name_fr) VALUES (?, ?, ?, ?)
    ON CONFLICT (slug) DO UPDATE SET name_ar = excluded.name_ar, name_en = excluded.name_en, name_fr = excluded.name_fr
  `).bind(
    slug, nameAr,
    typeof body?.name_en === 'string' ? body.name_en.trim().slice(0, 80) : null,
    typeof body?.name_fr === 'string' ? body.name_fr.trim().slice(0, 80) : null,
  ).run();
  return c.json({ success: true, data: { slug } }, 201);
});

// --- Posts -----------------------------------------------------------------

route.get('/blog/posts', requireAdmin, async (c) => {
  const language = c.req.query('language');
  const status = c.req.query('status');
  const category = c.req.query('category_id');
  const search = c.req.query('q')?.trim();

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (language && isCmsLanguage(language)) { clauses.push('p.language = ?'); params.push(language); }
  if (status) { clauses.push('p.status = ?'); params.push(status); }
  if (category) { clauses.push('p.category_id = ?'); params.push(category); }
  if (search) { clauses.push('(p.title LIKE ? OR p.slug LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = await queryAll(c.env.DB, `
    SELECT p.id, p.post_key, p.language, p.slug, p.path, p.title, p.status,
           p.scheduled_at, p.published_at, p.updated_at, p.translation_group,
           p.hero_asset_id, p.source_type, p.religious_approved_at,
           a.display_name AS author_name, cat.name AS category_name, cat.category_key,
           (SELECT COUNT(*) FROM blog_posts t WHERE t.translation_group = p.translation_group) AS language_variants,
           (SELECT COUNT(*) FROM seo_meta m WHERE m.entity_type = 'blog_post' AND m.entity_id = p.id) AS has_seo
      FROM blog_posts p
      LEFT JOIN blog_authors a ON a.id = p.author_id
      LEFT JOIN blog_categories cat ON cat.id = p.category_id
      ${where}
     ORDER BY COALESCE(p.published_at, p.updated_at) DESC
     LIMIT 100
  `, params);
  return c.json({ success: true, data: rows, meta: { total: rows.length } });
});

route.get('/blog/posts/:id', requireAdmin, async (c) => {
  const post = await loadPost(c.env.DB, c.req.param('id') ?? '');
  if (!post) return c.json({ success: false, error: 'Post not found' }, 404);

  const category = post.category_id
    ? await queryFirst<{ category_key: string }>(c.env.DB, 'SELECT category_key FROM blog_categories WHERE id = ?', [post.category_id])
    : null;
  const [tags, translations, revisions, seo] = await Promise.all([
    queryAll<{ tag_slug: string }>(c.env.DB, 'SELECT tag_slug FROM blog_post_tags WHERE post_id = ?', [post.id]),
    queryAll(c.env.DB, `
      SELECT id, language, path, status FROM blog_posts
       WHERE translation_group = ? AND id != ? ORDER BY language
    `, [post.translation_group, post.id]),
    queryAll(c.env.DB, `
      SELECT r.id, r.version, r.is_autosave, r.note, r.created_at, au.display_name AS created_by_name
        FROM blog_post_revisions r LEFT JOIN admin_users au ON au.id = r.created_by
       WHERE r.post_id = ? ORDER BY r.version DESC LIMIT 30
    `, [post.id]),
    loadSeo(c.env.DB, post.id),
  ]);

  const blocks = parseBlocks(post.body_json);
  return c.json({
    success: true,
    data: {
      post: { ...post, body: blocks },
      tags: tags.map((tag) => tag.tag_slug),
      translations,
      revisions,
      seo,
      word_count: blocksToText(blocks).split(/\s+/).filter(Boolean).length,
      is_religious: isReligious(post, category?.category_key ?? null),
      readiness: postPublishBlockers({
        title: post.title,
        excerpt: post.excerpt,
        blocks,
        hero_asset_id: post.hero_asset_id,
        author_id: post.author_id,
        category_id: post.category_id,
        is_religious: isReligious(post, category?.category_key ?? null),
        religious_reviewer_id: post.religious_reviewer_id,
        religious_approved_at: post.religious_approved_at,
        seo,
      }),
    },
  });
});

route.post('/blog/posts', requirePermission('create'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const language = body.language;
  if (!title) return c.json({ success: false, error: 'title is required' }, 400);
  if (!isCmsLanguage(language)) return c.json({ success: false, error: 'language must be ar, en or fr' }, 400);
  if (body.status === 'published') {
    return c.json({ success: false, error: 'Create the post unpublished, then use the publish operation' }, 400);
  }

  const rawSlug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : slugify(title);
  const slug = isValidSlug(rawSlug) ? rawSlug : slugify(rawSlug);
  // A title with no Latin characters slugifies to nothing, which is the normal case for
  // Arabic. Refusing is better than generating a random slug the editor cannot predict.
  if (!isValidSlug(slug)) {
    return c.json({ success: false, error: 'A latin slug is required (the Arabic title cannot produce one)' }, 400);
  }

  const path = postPath(language, slug);
  const clash = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM blog_posts WHERE path = ?', [path]);
  if (clash) return c.json({ success: false, error: `The path ${path} is already used` }, 409);

  const blocksResult = body.body === undefined ? { blocks: [] as Block[] } : validateBlocks(body.body);
  if ('error' in blocksResult) return c.json({ success: false, error: blocksResult.error }, 400);

  const postKey = typeof body.post_key === 'string' && body.post_key.trim() ? slugify(body.post_key) : slug;
  const group = typeof body.translation_group === 'string' && body.translation_group.trim()
    ? body.translation_group.trim()
    : postKey;

  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO blog_posts (id, post_key, language, slug, path, title, excerpt, body_json,
                              hero_asset_id, author_id, category_id, translation_group,
                              source_type, source_reference, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, postKey, language, slug, path, title,
      typeof body.excerpt === 'string' ? body.excerpt.trim().slice(0, 500) : null,
      JSON.stringify(blocksResult.blocks),
      typeof body.hero_asset_id === 'string' && body.hero_asset_id ? body.hero_asset_id : null,
      typeof body.author_id === 'string' && body.author_id ? body.author_id : null,
      typeof body.category_id === 'string' && body.category_id ? body.category_id : null,
      group,
      typeof body.source_type === 'string' && body.source_type ? body.source_type : null,
      typeof body.source_reference === 'string' ? body.source_reference.trim().slice(0, 300) : null,
      actorId(c), actorId(c),
    ),
    auditStatement(c.env.DB, actorId(c), 'create', 'blog_post', id, { language, path, title }),
  ]);
  return c.json({ success: true, data: { id, path } }, 201);
});

/// `PATCH /admin/blog/posts/:id`
///
/// `autosave: true` writes the revision as an autosave and skips the audit row: an
/// autosave every thirty seconds would bury every real action in the audit log.
route.patch('/blog/posts/:id', requirePermission('edit_text'), async (c) => {
  const post = await loadPost(c.env.DB, c.req.param('id') ?? '');
  if (!post) return c.json({ success: false, error: 'Post not found' }, 404);
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);
  if (body.status === 'published') {
    return c.json({ success: false, error: 'Use the publish operation to publish a post' }, 400);
  }

  const autosave = body.autosave === true;
  const sets: string[] = [];
  const params: unknown[] = [];
  const statements: D1PreparedStatement[] = [
    await revisionStatement(c.env.DB, post, actorId(c), { autosave, note: autosave ? 'autosave' : 'before update' }),
  ];

  if (typeof body.title === 'string' && body.title.trim()) { sets.push('title = ?'); params.push(body.title.trim().slice(0, 200)); }
  if (body.excerpt !== undefined) {
    sets.push('excerpt = ?');
    params.push(typeof body.excerpt === 'string' && body.excerpt.trim() ? body.excerpt.trim().slice(0, 500) : null);
  }
  if (body.body !== undefined) {
    const result = validateBlocks(body.body);
    if ('error' in result) return c.json({ success: false, error: result.error }, 400);
    sets.push('body_json = ?'); params.push(JSON.stringify(result.blocks));
  }
  for (const [field, key] of [['hero_asset_id', 'hero_asset_id'], ['author_id', 'author_id'], ['category_id', 'category_id']] as const) {
    if (body[key] !== undefined) {
      sets.push(`${field} = ?`);
      params.push(typeof body[key] === 'string' && body[key] ? body[key] : null);
    }
  }
  if (body.source_type !== undefined) {
    const value = typeof body.source_type === 'string' && body.source_type ? body.source_type : null;
    if (value && !['quran', 'hadith', 'sira', 'adab', 'general'].includes(value)) {
      return c.json({ success: false, error: 'Invalid source_type' }, 400);
    }
    sets.push('source_type = ?'); params.push(value);
  }
  if (body.source_reference !== undefined) {
    sets.push('source_reference = ?');
    params.push(typeof body.source_reference === 'string' ? body.source_reference.trim().slice(0, 300) : null);
  }
  // The religious approval is recorded as reviewer plus date, never as a boolean: the two
  // together are what makes the approval attributable, and the publish gate requires both.
  if (body.religious_reviewer_id !== undefined) {
    sets.push('religious_reviewer_id = ?');
    params.push(typeof body.religious_reviewer_id === 'string' && body.religious_reviewer_id ? body.religious_reviewer_id : null);
  }
  if (body.religious_approved_at !== undefined) {
    const value = typeof body.religious_approved_at === 'string' && body.religious_approved_at ? body.religious_approved_at : null;
    if (value && Number.isNaN(Date.parse(value))) {
      return c.json({ success: false, error: 'religious_approved_at must be a timestamp' }, 400);
    }
    sets.push('religious_approved_at = ?'); params.push(value);
  }
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!['draft', 'review', 'scheduled', 'archived'].includes(status)) {
      return c.json({ success: false, error: 'status must be draft, review, scheduled or archived here' }, 400);
    }
    if (status === 'scheduled') {
      const scheduledAt = typeof body.scheduled_at === 'string' ? body.scheduled_at : '';
      if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
        return c.json({ success: false, error: 'scheduled_at is required when status is scheduled' }, 400);
      }
      sets.push('scheduled_at = ?'); params.push(scheduledAt);
    }
    sets.push('status = ?'); params.push(status);
  }
  if (typeof body.slug === 'string' && body.slug.trim() && body.slug.trim() !== post.slug) {
    const slug = isValidSlug(body.slug.trim()) ? body.slug.trim() : slugify(body.slug);
    if (!isValidSlug(slug)) return c.json({ success: false, error: 'Invalid slug' }, 400);
    const path = postPath(post.language, slug);
    const clash = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM blog_posts WHERE path = ? AND id != ?', [path, post.id]);
    if (clash) return c.json({ success: false, error: `The path ${path} is already used` }, 409);
    sets.push('slug = ?', 'path = ?'); params.push(slug, path);
    if (post.status === 'published') {
      statements.push(c.env.DB.prepare(`
        INSERT OR IGNORE INTO web_redirects (id, from_path, to_path, status_code, reason, created_by)
        VALUES (?, ?, ?, 301, ?, ?)
      `).bind(crypto.randomUUID(), post.path, path, 'blog slug change', actorId(c)));
    }
  }

  if (Array.isArray(body.tags)) {
    const tags = [...new Set(body.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim().toLowerCase()).filter(isValidSlug))];
    statements.push(c.env.DB.prepare('DELETE FROM blog_post_tags WHERE post_id = ?').bind(post.id));
    for (const tag of tags) {
      // The tag row is created if missing: an editor typing a new tag in the post editor
      // should not have to visit a taxonomy screen first.
      statements.push(c.env.DB.prepare('INSERT OR IGNORE INTO blog_tags (slug, name_ar) VALUES (?, ?)').bind(tag, tag));
      statements.push(c.env.DB.prepare('INSERT OR IGNORE INTO blog_post_tags (post_id, tag_slug) VALUES (?, ?)').bind(post.id, tag));
    }
  }

  if (!sets.length && !Array.isArray(body.tags)) {
    return c.json({ success: false, error: 'No supported fields supplied' }, 400);
  }
  if (sets.length) {
    sets.push("updated_at = datetime('now')", 'updated_by = ?');
    params.push(actorId(c));
    statements.push(c.env.DB.prepare(`UPDATE blog_posts SET ${sets.join(', ')} WHERE id = ?`).bind(...params, post.id));
  }
  if (!autosave) {
    statements.push(auditStatement(c.env.DB, actorId(c), 'update', 'blog_post', post.id, body));
  }

  await c.env.DB.batch(statements);

  // Autosaves are pruned here rather than by a cron: the write that creates them is the
  // only moment their count is known to be over the limit.
  if (autosave) {
    await c.env.DB.prepare(`
      DELETE FROM blog_post_revisions
       WHERE post_id = ? AND is_autosave = 1
         AND version NOT IN (
           SELECT version FROM blog_post_revisions
            WHERE post_id = ? AND is_autosave = 1 ORDER BY version DESC LIMIT ?
         )
    `).bind(post.id, post.id, AUTOSAVE_KEEP).run();
  }

  return c.json({ success: true, data: { id: post.id, autosave } });
});

route.post('/blog/posts/:id/publish', requirePermission('publish'), async (c) => {
  const post = await loadPost(c.env.DB, c.req.param('id') ?? '');
  if (!post) return c.json({ success: false, error: 'Post not found' }, 404);
  if (post.status === 'archived') return c.json({ success: false, error: 'An archived post cannot be published' }, 409);

  const category = post.category_id
    ? await queryFirst<{ category_key: string }>(c.env.DB, 'SELECT category_key FROM blog_categories WHERE id = ?', [post.category_id])
    : null;
  const seo = await loadSeo(c.env.DB, post.id);
  const blocks = parseBlocks(post.body_json);
  const findings = postPublishBlockers({
    title: post.title,
    excerpt: post.excerpt,
    blocks,
    hero_asset_id: post.hero_asset_id,
    author_id: post.author_id,
    category_id: post.category_id,
    is_religious: isReligious(post, category?.category_key ?? null),
    religious_reviewer_id: post.religious_reviewer_id,
    religious_approved_at: post.religious_approved_at,
    seo,
  });
  const blockers = findings.filter((finding) => finding.severity === 'blocker');
  if (blockers.length) {
    await auditStatement(c.env.DB, actorId(c), 'publish_blocked', 'blog_post', post.id, {
      blockers: blockers.map((blocker) => blocker.id),
    }).run();
    return c.json({
      success: false,
      error: `Publish blocked by ${blockers.length} check(s)`,
      data: { blockers, warnings: findings.filter((finding) => finding.severity === 'warning') },
    }, 409);
  }

  await c.env.DB.batch([
    await revisionStatement(c.env.DB, post, actorId(c), { autosave: false, note: 'before publish' }),
    c.env.DB.prepare(`
      UPDATE blog_posts SET status = 'published', published_at = COALESCE(published_at, ?),
             updated_at = datetime('now'), updated_by = ? WHERE id = ?
    `).bind(new Date().toISOString(), actorId(c), post.id),
    auditStatement(c.env.DB, actorId(c), 'publish', 'blog_post', post.id, {
      path: post.path,
      warnings: findings.filter((finding) => finding.severity === 'warning').map((finding) => finding.id),
    }),
  ]);
  return c.json({
    success: true,
    data: { id: post.id, path: post.path, warnings: findings.filter((finding) => finding.severity === 'warning') },
  });
});

route.post('/blog/posts/:id/rollback', requirePermission('edit_text'), async (c) => {
  const post = await loadPost(c.env.DB, c.req.param('id') ?? '');
  if (!post) return c.json({ success: false, error: 'Post not found' }, 404);
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const version = Number(body?.version);
  if (!Number.isInteger(version) || version < 1) return c.json({ success: false, error: 'version is required' }, 400);

  const revision = await queryFirst<{ snapshot_json: string }>(c.env.DB, `
    SELECT snapshot_json FROM blog_post_revisions WHERE post_id = ? AND version = ?
  `, [post.id, version]);
  if (!revision) return c.json({ success: false, error: 'Revision not found' }, 404);
  const snapshot = JSON.parse(revision.snapshot_json) as PostRow;

  await c.env.DB.batch([
    await revisionStatement(c.env.DB, post, actorId(c), { autosave: false, note: `before rollback to v${version}` }),
    // Content only. Status, path and publication timestamps are not restored: rolling text
    // back must not republish a post someone unpublished or move a live URL.
    c.env.DB.prepare(`
      UPDATE blog_posts SET title = ?, excerpt = ?, body_json = ?, hero_asset_id = ?,
             updated_at = datetime('now'), updated_by = ? WHERE id = ?
    `).bind(snapshot.title, snapshot.excerpt, snapshot.body_json, snapshot.hero_asset_id, actorId(c), post.id),
    auditStatement(c.env.DB, actorId(c), 'rollback', 'blog_post', post.id, { version }),
  ]);
  return c.json({ success: true, data: { id: post.id, restored_version: version } });
});

export default route;
