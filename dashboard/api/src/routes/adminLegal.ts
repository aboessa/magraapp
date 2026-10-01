import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { requireAdmin, requirePermission, type AdminVariables } from '../lib/adminAuth.ts'
import { actorId, auditStatement, claimedActor } from '../lib/auditLog.ts'
import { bumpPublicContentCacheVersion } from '../lib/publicCache.ts'
import { isLegalSlug, MAX_LEGAL_BODY, MAX_LEGAL_TITLE, placeholdersIn } from '../lib/legalDocuments.ts'

/// Admin «الصفحات القانونية» (migration 0105).
///
///   GET  /admin/legal                 every document: draft and published copy
///   PUT  /admin/legal/:slug           save the draft { title_ar, body_ar }
///   POST /admin/legal/:slug/publish   copy the draft to the public copy, version + 1
///   POST /admin/legal/:slug/unpublish take it off the website and the app
///
/// Editing and publishing need `publish`, like every public-facing text.
/// Publishing refuses a draft that still has a `{{placeholder}}`.

type AppEnv = { Bindings: Env; Variables: AdminVariables }
const route = new Hono<AppEnv>()
route.use('*', requireAdmin)

type Row = {
  slug: string; title_ar: string; body_ar: string; status: string; version: number
  published_title_ar: string | null; published_body_ar: string | null; published_at: string | null
  updated_by: string | null; updated_at: string
}

const view = (row: Row) => ({
  ...row,
  version: Number(row.version),
  placeholders: placeholdersIn(`${row.title_ar}\n${row.body_ar}`),
  draft_differs: row.published_body_ar !== row.body_ar || row.published_title_ar !== row.title_ar,
})

route.get('/', async (c) => {
  const rows = await queryAll<Row>(c.env.DB, 'SELECT * FROM legal_documents ORDER BY slug')
  return c.json({ success: true, data: rows.map(view) })
})

route.put('/:slug', requirePermission('publish'), async (c) => {
  const slug = c.req.param('slug')
  if (!isLegalSlug(slug)) return c.json({ success: false, error: 'Unknown document' }, 404)
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const title = typeof body?.title_ar === 'string' ? body.title_ar.trim() : ''
  const text = typeof body?.body_ar === 'string' ? body.body_ar.replace(/\r\n/g, '\n').trim() : ''
  if (!title || title.length > MAX_LEGAL_TITLE) return c.json({ success: false, error: `title_ar (1-${MAX_LEGAL_TITLE} chars) required` }, 400)
  if (text.length < 20 || text.length > MAX_LEGAL_BODY) return c.json({ success: false, error: `body_ar (20-${MAX_LEGAL_BODY} chars) required` }, 400)
  const actor = actorId(c)
  const before = await queryFirst<Row>(c.env.DB, 'SELECT * FROM legal_documents WHERE slug = ?', [slug])
  if (!before) return c.json({ success: false, error: 'Unknown document' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE legal_documents SET title_ar = ?, body_ar = ?, updated_by = ?, updated_at = datetime('now') WHERE slug = ?`)
      .bind(title, text, actor, slug),
    auditStatement(c.env.DB, actor, 'update', 'legal_document', slug, {
      before: { title_ar: before.title_ar, body_ar: before.body_ar },
      after: { title_ar: title, body_ar: text },
      claimed_actor: claimedActor(c),
    }),
  ])
  const row = await queryFirst<Row>(c.env.DB, 'SELECT * FROM legal_documents WHERE slug = ?', [slug])
  return c.json({ success: true, data: row ? view(row) : null })
})

route.post('/:slug/publish', requirePermission('publish'), async (c) => {
  const slug = c.req.param('slug')
  if (!isLegalSlug(slug)) return c.json({ success: false, error: 'Unknown document' }, 404)
  const row = await queryFirst<Row>(c.env.DB, 'SELECT * FROM legal_documents WHERE slug = ?', [slug])
  if (!row) return c.json({ success: false, error: 'Unknown document' }, 404)
  const missing = placeholdersIn(`${row.title_ar}\n${row.body_ar}`)
  if (missing.length) {
    return c.json({ success: false, error: 'Fill in every {{placeholder}} before publishing', code: 'placeholders', data: { placeholders: missing } }, 422)
  }
  const actor = actorId(c)
  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE legal_documents SET status = 'published', version = version + 1,
        published_title_ar = title_ar, published_body_ar = body_ar, published_at = datetime('now'), updated_by = ?
       WHERE slug = ?
    `).bind(actor, slug),
    auditStatement(c.env.DB, actor, 'publish', 'legal_document', slug, {
      version_to: Number(row.version) + 1,
      previous_body_ar: row.published_body_ar,
      claimed_actor: claimedActor(c),
    }),
  ])
  await bumpPublicContentCacheVersion(c.env.CACHE)
  const next = await queryFirst<Row>(c.env.DB, 'SELECT * FROM legal_documents WHERE slug = ?', [slug])
  return c.json({ success: true, data: next ? view(next) : null })
})

route.post('/:slug/unpublish', requirePermission('publish'), async (c) => {
  const slug = c.req.param('slug')
  if (!isLegalSlug(slug)) return c.json({ success: false, error: 'Unknown document' }, 404)
  const actor = actorId(c)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE legal_documents SET status = 'draft', updated_by = ? WHERE slug = ?`).bind(actor, slug),
    auditStatement(c.env.DB, actor, 'unpublish', 'legal_document', slug, { claimed_actor: claimedActor(c) }),
  ])
  await bumpPublicContentCacheVersion(c.env.CACHE)
  return c.json({ success: true, data: { slug, status: 'draft' } })
})

export default route
