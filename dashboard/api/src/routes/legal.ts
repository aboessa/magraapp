import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { cachedPublicJson } from '../lib/publicCache.ts';
import { isLegalSlug } from '../lib/legalDocuments.ts';

/// Public, read-only: the published version of each legal document.
///
///   GET /api/v1/legal          which documents are published, and their versions
///   GET /api/v1/legal/:slug    one published document (404 while it is a draft)
///
/// Only the published copy is ever served; a draft being edited in the admin
/// never reaches the website or the app.

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

route.get('/', async (c) => cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
  const rows = await queryAll<{ slug: string; title: string; version: number; published_at: string }>(c.env.DB, `
    SELECT slug, published_title_ar AS title, version, published_at FROM legal_documents
     WHERE status = 'published' AND published_body_ar IS NOT NULL ORDER BY slug
  `).catch(() => []);
  return { success: true, data: rows };
}, 120));

route.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!isLegalSlug(slug)) return c.json({ success: false, error: 'Unknown document' }, 404);
  const row = await queryFirst<{ title: string; body: string; version: number; published_at: string }>(c.env.DB, `
    SELECT published_title_ar AS title, published_body_ar AS body, version, published_at FROM legal_documents
     WHERE slug = ? AND status = 'published' AND published_body_ar IS NOT NULL
  `, [slug]).catch(() => null);
  if (!row) return c.json({ success: false, error: 'Not published yet', code: 'not_published' }, 404);
  // One indexed D1 read, not edge-cached, so a publish shows up at once.
  return c.json({
    success: true,
    data: { slug, title: row.title, body: row.body, version: Number(row.version), published_at: row.published_at },
  }, 200, { 'Cache-Control': 'public, max-age=60' });
});

export default route;
