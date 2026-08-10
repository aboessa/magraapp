import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { pathParam } from '../lib/routeParams.ts'
import { queryAll, queryFirst } from '../lib/db'
import { bucketForAsset, keyScopeForAsset, type BucketName } from '../lib/assetBuckets'
import { inferVisibilityFromPath } from '../lib/assetClassification'
import { requirePermission } from '../lib/adminAuth'

type AppEnv = { Bindings: Env }
type Row = Record<string, unknown>
type JsonObject = Record<string, unknown>

const route = new Hono<AppEnv>()

const ASSET_KINDS = ['image', 'audio', 'video', 'subtitle', 'document', 'manifest', 'archive']
const ASSET_STATUSES = ['planned', 'uploading', 'processing', 'ready', 'failed', 'archived']
const ASSET_SOURCES = ['catalog', 'upload', 'generated', 'import']
const VISIBILITIES = ['public', 'private']
// The bucket is no longer accepted as an input; it is derived from the asset's
// visibility and kind by lib/assetBuckets.ts.
const ENTITY_TYPES = ['landing', 'planet', 'category', 'series', 'season', 'episode', 'character', 'story', 'story_page', 'game', 'book', 'project']
const DIRECT_UPLOAD_LIMIT = 95 * 1024 * 1024
const MULTIPART_PART_SIZE = 8 * 1024 * 1024

const MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav',
  mp4: 'video/mp4', m4v: 'video/x-m4v', webm: 'video/webm',
  srt: 'application/x-subrip', vtt: 'text/vtt',
  json: 'application/json', m3u8: 'application/vnd.apple.mpegurl', pdf: 'application/pdf', zip: 'application/zip',
}

const MAX_BYTES: Record<string, number> = {
  image: 30 * 1024 * 1024,
  audio: 750 * 1024 * 1024,
  video: 15 * 1024 * 1024 * 1024,
  subtitle: 10 * 1024 * 1024,
  document: 150 * 1024 * 1024,
  manifest: 10 * 1024 * 1024,
  archive: 5 * 1024 * 1024 * 1024,
}

async function body(c: any): Promise<JsonObject | null> {
  const value = await c.req.json().catch(() => null)
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null || value === '') return null
  return typeof value === 'string' ? value.trim() || null : undefined
}

function integer(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function bool(value: unknown) {
  return value === true || value === 1 || value === '1'
}

function actor(c: any) {
  return c.req.header('X-Admin-Actor') || 'admin'
}

function audit(db: D1Database, c: any, action: string, entityType: string, entityId: string, details: unknown) {
  return db.prepare(`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), actor(c), action, entityType, entityId, JSON.stringify(details ?? {}))
}

function isConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /UNIQUE|constraint|FOREIGN KEY/i.test(message)
}

function parseJson(value: unknown, fallback: unknown) {
  if (typeof value !== 'string') return fallback
  try { return JSON.parse(value) } catch { return fallback }
}

function extension(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? ''
}

function normalizeMime(filename: string, provided?: string | null) {
  const clean = provided?.split(';')[0].trim().toLowerCase()
  return clean || MIME_BY_EXTENSION[extension(filename)] || 'application/octet-stream'
}

function kindFromMime(filename: string, mime: string): string | null {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  const ext = extension(filename)
  if (['srt', 'vtt'].includes(ext)) return 'subtitle'
  if (ext === 'm3u8' || mime.includes('mpegurl')) return 'manifest'
  if (['pdf', 'json'].includes(ext) || ['application/pdf', 'application/json'].includes(mime)) return 'document'
  if (ext === 'zip' || mime.includes('zip')) return 'archive'
  return null
}

function safeFilename(filename: string) {
  const ext = extension(filename)
  const base = filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'asset'
  return `${base}-${crypto.randomUUID().slice(0, 10)}${ext ? `.${ext}` : ''}`
}

function safeExpectedPath(value: string | null) {
  if (!value) return null
  const path = value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/')
  if (path.split('/').some((part) => part === '..')) return null
  return path.slice(0, 500)
}

function objectKey(visibility: string, kind: string, filename: string, expectedPath?: string | null) {
  // The scope prefix is derived from lib/assetBuckets so a key can never
  // disagree with the bucket the object is actually written to. Video and
  // archives are forced private there regardless of the visibility column.
  const scope = keyScopeForAsset({ visibility, kind })
  const expected = safeExpectedPath(expectedPath ?? null)
  if (expected) {
    const stem = expected.replace(/^assets\//, '').replace(/\.[^.\/]+$/, '')
    const ext = extension(filename)
    return `${scope}/catalog/${stem}-${crypto.randomUUID().slice(0, 8)}${ext ? `.${ext}` : ''}`
  }
  return `${scope}/${kind}/${new Date().toISOString().slice(0, 10)}/${safeFilename(filename)}`
}

function bucket(binding: Env, name: string) {
  return name === 'thumbs' ? binding.THUMBS_BUCKET : binding.MEDIA_BUCKET
}

/// Resolves the bucket an asset must live in from the asset row itself.
///
/// The `bucket` column is no longer trusted as an input: it used to be
/// caller-supplied and defaulted to `'media'`, which put public catalogue
/// artwork in the private bucket. See lib/assetBuckets.ts for the architecture.
function bucketForRow(asset: Row): BucketName {
  return bucketForAsset({
    visibility: asset.visibility as string | null,
    kind: asset.kind as string | null,
  })
}

function serializeAsset(row: Row) {
  return {
    ...row,
    metadata: parseJson(row.metadata, {}),
    content_url: row.status === 'ready' ? `/api/v1/admin/assets/${row.id}/content` : null,
  }
}

/// Catalogue artwork is served anonymously from the public CDN; only
/// entitlement-controlled media stays private.
///
/// The rule itself now lives in lib/assetClassification.ts, shared with
/// scripts/import-images.mjs and the bucket migration. It used to be duplicated
/// here and in the import script, and the two copies had already drifted: both
/// treated only `landing|marketing|worlds|store` as public, so every poster,
/// banner and episode still was minted `private/…` and could never resolve on
/// the CDN.
function inferVisibility(path: string) {
  return inferVisibilityFromPath(path)
}

function inferTitle(path: string) {
  const filename = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'asset'
  return filename.replace(/[-_]+/g, ' ')
}

function parseCatalog(catalog: string) {
  const records: Array<{ prompt: string; path: string; width: number | null; height: number | null; aspect: string | null }> = []
  const seen = new Set<string>()
  for (const raw of catalog.split(/\r?\n/)) {
    let line = raw.trim()
    if (!line.includes('|') || /^\|?\s*(prompt|[-: ]+)\s*\|/i.test(line)) continue
    if (line.startsWith('|')) line = line.slice(1)
    if (line.endsWith('|')) line = line.slice(0, -1)
    const last = line.lastIndexOf('|')
    if (last < 0) continue
    const sizeText = line.slice(last + 1).trim().replace(/`/g, '')
    const beforeSize = line.slice(0, last)
    const second = beforeSize.lastIndexOf('|')
    if (second < 0) continue
    const prompt = beforeSize.slice(0, second).trim()
    const path = safeExpectedPath(beforeSize.slice(second + 1).trim().replace(/`/g, ''))
    if (!path || !path.startsWith('assets/images/') || !/\.(?:avif|gif|jpe?g|png|webp|mp3|m4a|ogg|wav|mp4|webm|srt|vtt|json|pdf|zip)$/i.test(path) || seen.has(path)) continue
    const dimensions = sizeText.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i)
    const aspect = sizeText.match(/\((\d+\s*:\s*\d+)\)/)?.[1]?.replace(/\s/g, '') ?? null
    records.push({ prompt, path, width: dimensions ? Number(dimensions[1]) : null, height: dimensions ? Number(dimensions[2]) : null, aspect })
    seen.add(path)
  }
  return records
}

// Asset library -------------------------------------------------------------
route.get('/assets', async (c) => {
  const clauses: string[] = []
  const params: unknown[] = []
  const query = c.req.query('q')?.trim()
  const status = c.req.query('status')
  const kind = c.req.query('kind')
  const source = c.req.query('source')
  const visibility = c.req.query('visibility')
  if (query) { clauses.push('(ca.title_ar LIKE ? OR ca.original_filename LIKE ? OR ca.expected_path LIKE ?)'); params.push(`%${query}%`, `%${query}%`, `%${query}%`) }
  if (status && status !== 'all') { if (!ASSET_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400); clauses.push('ca.status = ?'); params.push(status) }
  if (!status) clauses.push(`ca.status <> 'archived'`)
  if (kind) { if (!ASSET_KINDS.includes(kind)) return c.json({ success: false, error: 'Invalid kind' }, 400); clauses.push('ca.kind = ?'); params.push(kind) }
  if (source) { if (!ASSET_SOURCES.includes(source)) return c.json({ success: false, error: 'Invalid source' }, 400); clauses.push('ca.source = ?'); params.push(source) }
  if (visibility) { if (!VISIBILITIES.includes(visibility)) return c.json({ success: false, error: 'Invalid visibility' }, 400); clauses.push('ca.visibility = ?'); params.push(visibility) }

  const limit = Math.min(Math.max(integer(c.req.query('limit')) ?? 60, 1), 200)
  const offset = Math.max(integer(c.req.query('offset')) ?? 0, 0)
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM content_assets ca ${where}`, params)
  const rows = await queryAll<Row>(c.env.DB, `
    SELECT ca.*, vs.name_ar AS visual_style_name,
      (SELECT COUNT(*) FROM asset_links al WHERE al.asset_id = ca.id) AS links_count
    FROM content_assets ca
    LEFT JOIN visual_styles vs ON vs.id = ca.visual_style_id
    ${where}
    ORDER BY CASE ca.status WHEN 'uploading' THEN 1 WHEN 'planned' THEN 2 WHEN 'failed' THEN 3 WHEN 'processing' THEN 4 ELSE 5 END, ca.updated_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])
  return c.json({ success: true, data: rows.map(serializeAsset), meta: { total: Number(total?.total ?? 0), limit, offset } })
})

route.get('/assets/stats', async (c) => {
  const [byStatus, byKind, storage] = await Promise.all([
    queryAll<Row>(c.env.DB, `SELECT status, COUNT(*) AS count FROM content_assets GROUP BY status ORDER BY count DESC`),
    queryAll<Row>(c.env.DB, `SELECT kind, COUNT(*) AS count FROM content_assets GROUP BY kind ORDER BY count DESC`),
    queryFirst<Row>(c.env.DB, `SELECT COUNT(*) AS ready_count, COALESCE(SUM(size_bytes), 0) AS total_bytes FROM content_assets WHERE status = 'ready'`),
  ])
  return c.json({ success: true, data: { by_status: byStatus, by_kind: byKind, storage: storage ?? { ready_count: 0, total_bytes: 0 } } })
})

route.get('/assets/:id', async (c) => {
  const asset = await queryFirst<Row>(c.env.DB, `SELECT ca.*, vs.name_ar AS visual_style_name FROM content_assets ca LEFT JOIN visual_styles vs ON vs.id = ca.visual_style_id WHERE ca.id = ?`, [pathParam(c, 'id')])
  if (!asset) return c.json({ success: false, error: 'Asset not found' }, 404)
  const links = await queryAll<Row>(c.env.DB, 'SELECT * FROM asset_links WHERE asset_id = ? ORDER BY entity_type, sort_order', [pathParam(c, 'id')])
  return c.json({ success: true, data: { ...serializeAsset(asset), links } })
})

route.post('/assets', requirePermission('create'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const title = text(value.title_ar)
  const filename = text(value.original_filename) ?? text(value.expected_path) ?? ''
  const mime = normalizeMime(filename, text(value.mime_type))
  const kind = text(value.kind) ?? kindFromMime(filename, mime)
  const source = text(value.source) ?? 'upload'
  const status = text(value.status) ?? 'planned'
  const visibility = text(value.visibility) ?? 'private'
  if (!title || !kind || !ASSET_KINDS.includes(kind) || !ASSET_SOURCES.includes(source) || !ASSET_STATUSES.includes(status) || !VISIBILITIES.includes(visibility)) return c.json({ success: false, error: 'Invalid or missing asset fields' }, 400)
  const id = crypto.randomUUID()
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO content_assets (id, title_ar, kind, source, status, original_filename, expected_path, mime_type, visibility, language, quality, expected_width, expected_height, aspect_ratio, prompt, visual_style_id, metadata, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, title, kind, source, status, nullableText(value.original_filename) ?? null, safeExpectedPath(text(value.expected_path)), mime, visibility, nullableText(value.language) ?? null, nullableText(value.quality) ?? null, integer(value.expected_width), integer(value.expected_height), nullableText(value.aspect_ratio) ?? null, nullableText(value.prompt) ?? null, nullableText(value.visual_style_id) ?? null, value.metadata && typeof value.metadata === 'object' ? JSON.stringify(value.metadata) : '{}', actor(c)),
      audit(c.env.DB, c, 'create', 'content_asset', id, { title_ar: title, kind, source, status }),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'An asset with this expected path already exists' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id } }, 201)
})

route.patch('/assets/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM content_assets WHERE id = ?', [id])) return c.json({ success: false, error: 'Asset not found' }, 404)
  const sets: string[] = []
  const params: unknown[] = []
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue) }
  for (const field of ['title_ar']) {
    if (value[field] === undefined) continue
    const parsed = text(value[field])
    if (!parsed) return c.json({ success: false, error: `${field} cannot be empty` }, 400)
    add(field, parsed)
  }
  for (const field of ['original_filename', 'language', 'quality', 'prompt', 'visual_style_id']) {
    if (value[field] === undefined) continue
    const parsed = nullableText(value[field])
    if (parsed === undefined) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  if (value.expected_path !== undefined) {
    const parsed = nullableText(value.expected_path)
    if (parsed === undefined) return c.json({ success: false, error: 'Invalid expected_path' }, 400)
    add('expected_path', parsed ? safeExpectedPath(parsed) : null)
  }
  for (const [field, allowed] of [['kind', ASSET_KINDS], ['source', ASSET_SOURCES], ['status', ASSET_STATUSES], ['visibility', VISIBILITIES]] as const) {
    if (value[field] === undefined) continue
    const parsed = text(value[field])
    if (!parsed || !allowed.includes(parsed)) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  for (const field of ['expected_width', 'expected_height']) {
    if (value[field] === undefined) continue
    if (value[field] === null || value[field] === '') add(field, null)
    else {
      const parsed = integer(value[field])
      if (parsed === null || parsed < 1) return c.json({ success: false, error: `Invalid ${field}` }, 400)
      add(field, parsed)
    }
  }
  if (value.aspect_ratio !== undefined) add('aspect_ratio', nullableText(value.aspect_ratio) ?? null)
  if (value.metadata !== undefined) {
    if (!value.metadata || typeof value.metadata !== 'object' || Array.isArray(value.metadata)) return c.json({ success: false, error: 'metadata must be an object' }, 400)
    add('metadata', JSON.stringify(value.metadata))
  }
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)
  sets.push(`updated_at = datetime('now')`)
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE content_assets SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(c.env.DB, c, 'update', 'content_asset', id, value),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Asset values conflict with an existing record' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, updated: true } })
})

route.delete('/assets/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  const asset = await queryFirst<Row>(c.env.DB, 'SELECT id FROM content_assets WHERE id = ?', [id])
  if (!asset) return c.json({ success: false, error: 'Asset not found' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE content_assets SET status = 'archived', updated_at = datetime('now') WHERE id = ?`).bind(id),
    audit(c.env.DB, c, 'archive', 'content_asset', id, {}),
  ])
  return c.json({ success: true, data: { id, status: 'archived' } })
})

route.post('/assets/import-catalog', requirePermission('create'), async (c) => {
  const value = await body(c)
  const catalog = value ? text(value.catalog) : null
  if (!catalog) return c.json({ success: false, error: 'catalog text is required' }, 400)
  const records = parseCatalog(catalog)
  if (!records.length) return c.json({ success: false, error: 'No valid prompt | filename | size rows were found' }, 400)
  let created = 0
  let updated = 0
  for (let index = 0; index < records.length; index += 40) {
    const chunk = records.slice(index, index + 40)
    const existing = await queryAll<{ expected_path: string }>(c.env.DB, `SELECT expected_path FROM content_assets WHERE expected_path IN (${chunk.map(() => '?').join(',')})`, chunk.map((item) => item.path))
    const existingSet = new Set(existing.map((item) => item.expected_path))
    created += chunk.filter((item) => !existingSet.has(item.path)).length
    updated += chunk.filter((item) => existingSet.has(item.path)).length
    await c.env.DB.batch(chunk.map((item) => {
      const filename = item.path.split('/').pop() ?? item.path
      const mime = normalizeMime(filename)
      const kind = kindFromMime(filename, mime) ?? 'document'
      return c.env.DB.prepare(`
        INSERT INTO content_assets (id, title_ar, kind, source, status, original_filename, expected_path, mime_type, visibility, expected_width, expected_height, aspect_ratio, prompt, metadata, uploaded_by)
        VALUES (?, ?, ?, 'catalog', 'planned', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(expected_path) DO UPDATE SET
          prompt = excluded.prompt,
          expected_width = excluded.expected_width,
          expected_height = excluded.expected_height,
          aspect_ratio = excluded.aspect_ratio,
          mime_type = CASE WHEN content_assets.status = 'planned' THEN excluded.mime_type ELSE content_assets.mime_type END,
          updated_at = datetime('now')
      `).bind(crypto.randomUUID(), inferTitle(item.path), kind, filename, item.path, mime, inferVisibility(item.path), item.width, item.height, item.aspect, item.prompt, JSON.stringify({ catalog_index: index }), actor(c))
    }))
  }
  await c.env.DB.batch([audit(c.env.DB, c, 'import_catalog', 'content_asset', 'catalog', { total: records.length, created, updated })])
  return c.json({ success: true, data: { total: records.length, created, updated } })
})

route.put('/assets/:id/links', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value || !Array.isArray(value.links)) return c.json({ success: false, error: 'links must be an array' }, 400)
  const assetId = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM content_assets WHERE id = ?', [assetId])) return c.json({ success: false, error: 'Asset not found' }, 404)
  const links = value.links.map((item) => item as JsonObject)
  for (const link of links) {
    const entityType = text(link.entity_type)
    if (!entityType || !ENTITY_TYPES.includes(entityType) || !text(link.entity_id) || !text(link.role)) return c.json({ success: false, error: 'Every link requires a valid entity_type, entity_id and role' }, 400)
  }
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM asset_links WHERE asset_id = ?').bind(assetId),
    ...links.map((link) => c.env.DB.prepare(`INSERT INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), assetId, text(link.entity_type), text(link.entity_id), text(link.role), text(link.language) ?? '', integer(link.sort_order) ?? 0)),
    audit(c.env.DB, c, 'replace_links', 'content_asset', assetId, { links }),
  ])
  return c.json({ success: true, data: { id: assetId, links_count: links.length } })
})

// Direct upload for images and other files below the Worker request limit ----
route.put('/assets/:id/content', requirePermission('upload_images'), async (c) => {
  const id = pathParam(c, 'id')
  const asset = await queryFirst<Row>(c.env.DB, 'SELECT * FROM content_assets WHERE id = ?', [id])
  if (!asset) return c.json({ success: false, error: 'Asset not found' }, 404)
  if (!c.req.raw.body) return c.json({ success: false, error: 'File body is required' }, 400)
  const size = integer(c.req.header('Content-Length') ?? c.req.header('X-File-Size'))
  if (size === null || size < 1) return c.json({ success: false, error: 'Content-Length or X-File-Size is required' }, 411)
  if (size > DIRECT_UPLOAD_LIMIT) return c.json({ success: false, error: 'Use multipart upload for files larger than 95 MiB' }, 413)
  const headerFilename = c.req.header('X-File-Name')
  let filename = headerFilename || String(asset.original_filename || asset.expected_path || `${id}.bin`)
  if (headerFilename) {
    try { filename = decodeURIComponent(headerFilename) } catch { /* keep the safe encoded header value */ }
  }
  const mime = normalizeMime(filename, c.req.header('Content-Type') || String(asset.mime_type || ''))
  const kind = kindFromMime(filename, mime)
  if (!kind || kind !== asset.kind) return c.json({ success: false, error: 'File type does not match the asset kind' }, 415)
  if (size > MAX_BYTES[kind]) return c.json({ success: false, error: `File exceeds the ${kind} size limit` }, 413)
  // Derived, never read from the row: the stored column was caller-supplied and
  // defaulted to 'media', which parked public catalogue artwork in the private
  // bucket. lib/assetBuckets.ts is the single authority.
  const bucketName = bucketForAsset({ visibility: asset.visibility as string | null, kind })
  const key = String(asset.r2_key || objectKey(String(asset.visibility), kind, filename, String(asset.expected_path || '')))
  const checksum = c.req.header('X-File-SHA256') || undefined
  const actualWidth = integer(c.req.header('X-Image-Width'))
  const actualHeight = integer(c.req.header('X-Image-Height'))
  const expectedWidth = asset.expected_width ? Number(asset.expected_width) : null
  const expectedHeight = asset.expected_height ? Number(asset.expected_height) : null
  const dimensionMismatch = kind === 'image' && actualWidth !== null && actualHeight !== null && expectedWidth !== null && expectedHeight !== null && (actualWidth !== expectedWidth || actualHeight !== expectedHeight)
  const quality = kind === 'image' && actualWidth !== null && actualHeight !== null
    ? (dimensionMismatch ? 'temporary_size_mismatch' : 'approved_size')
    : asset.quality
  const metadata = {
    ...(parseJson(asset.metadata, {}) as Record<string, unknown>),
    ...(actualWidth !== null && actualHeight !== null ? { actual_dimensions: { width: actualWidth, height: actualHeight }, dimension_match: !dimensionMismatch } : {}),
  }

  const result = await bucket(c.env, bucketName).put(key, c.req.raw.body, {
    httpMetadata: { contentType: mime, cacheControl: asset.visibility === 'public' ? 'public, max-age=31536000, immutable' : 'private, no-store' },
    customMetadata: { assetId: id, originalFilename: filename, visibility: String(asset.visibility), ...(checksum ? { sha256: checksum } : {}) },
  })
  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE content_assets SET status = 'ready', source = CASE WHEN source = 'catalog' THEN 'generated' ELSE source END,
        original_filename = ?, r2_key = ?, bucket = ?, mime_type = ?, size_bytes = ?, checksum_sha256 = ?, etag = ?,
        quality = ?, metadata = ?, uploaded_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(filename, key, bucketName, mime, size, checksum ?? null, result.etag, quality, JSON.stringify(metadata), actor(c), id),
    audit(c.env.DB, c, 'upload_complete', 'content_asset', id, { key, bucket: bucketName, size, mime }),
  ])
  return c.json({ success: true, data: { id, status: 'ready', r2_key: key, size_bytes: size, etag: result.etag } })
})

// Multipart upload for video/audio/archive files ----------------------------
route.post('/asset-upload-sessions', requirePermission('upload_images'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const assetId = text(value.asset_id)
  const filename = text(value.filename)
  const expectedSize = integer(value.size_bytes)
  if (!assetId || !filename || expectedSize === null || expectedSize < 1) return c.json({ success: false, error: 'asset_id, filename and size_bytes are required' }, 400)
  const asset = await queryFirst<Row>(c.env.DB, 'SELECT * FROM content_assets WHERE id = ?', [assetId])
  if (!asset) return c.json({ success: false, error: 'Asset not found' }, 404)
  const mime = normalizeMime(filename, text(value.mime_type))
  const kind = kindFromMime(filename, mime)
  if (!kind || kind !== asset.kind) return c.json({ success: false, error: 'File type does not match the asset kind' }, 415)
  if (expectedSize > MAX_BYTES[kind]) return c.json({ success: false, error: `File exceeds the ${kind} size limit` }, 413)
  // The requested bucket is ignored: it is derived from the asset itself so a
  // multipart stream upload cannot be steered into the CDN-fronted public
  // bucket. See lib/assetBuckets.ts.
  const bucketName = bucketForAsset({ visibility: asset.visibility as string | null, kind })
  const key = String(asset.r2_key || objectKey(String(asset.visibility), kind, filename, String(asset.expected_path || '')))
  const upload = await bucket(c.env, bucketName).createMultipartUpload(key, {
    httpMetadata: { contentType: mime, cacheControl: asset.visibility === 'public' ? 'public, max-age=31536000, immutable' : 'private, no-store' },
    customMetadata: { assetId, originalFilename: filename, visibility: String(asset.visibility) },
  })
  const id = crypto.randomUUID()
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO asset_uploads (id, asset_id, upload_id, bucket, r2_key, expected_size, status, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'uploading', ?)
    `).bind(id, assetId, upload.uploadId, bucketName, key, expectedSize, expires),
    c.env.DB.prepare(`UPDATE content_assets SET status = 'uploading', original_filename = ?, r2_key = ?, bucket = ?, mime_type = ?, updated_at = datetime('now') WHERE id = ?`).bind(filename, key, bucketName, mime, assetId),
    audit(c.env.DB, c, 'upload_start', 'content_asset', assetId, { session_id: id, key, expected_size: expectedSize }),
  ])
  return c.json({ success: true, data: { id, asset_id: assetId, part_size: MULTIPART_PART_SIZE, expires_at: expires } }, 201)
})

route.put('/asset-upload-sessions/:id/parts/:part', requirePermission('upload_images'), async (c) => {
  const id = pathParam(c, 'id')
  const partNumber = integer(pathParam(c, 'part'))
  if (partNumber === null || partNumber < 1 || partNumber > 10000) return c.json({ success: false, error: 'Invalid part number' }, 400)
  const session = await queryFirst<Row>(c.env.DB, `SELECT * FROM asset_uploads WHERE id = ? AND status = 'uploading'`, [id])
  if (!session) return c.json({ success: false, error: 'Active upload session not found' }, 404)
  if (new Date(String(session.expires_at)).getTime() < Date.now()) return c.json({ success: false, error: 'Upload session expired' }, 410)
  if (!c.req.raw.body) return c.json({ success: false, error: 'Part body is required' }, 400)
  const partSize = integer(c.req.header('Content-Length') ?? c.req.header('X-Part-Size'))
  if (partSize === null || partSize < 1 || partSize > MULTIPART_PART_SIZE) return c.json({ success: false, error: `Part size must be between 1 and ${MULTIPART_PART_SIZE} bytes` }, 400)
  const multipart = bucket(c.env, String(session.bucket)).resumeMultipartUpload(String(session.r2_key), String(session.upload_id))
  const uploaded = await multipart.uploadPart(partNumber, c.req.raw.body)
  await c.env.DB.prepare(`
    INSERT INTO asset_upload_parts (upload_session_id, part_number, etag, size_bytes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(upload_session_id, part_number) DO UPDATE SET etag = excluded.etag, size_bytes = excluded.size_bytes, created_at = datetime('now')
  `).bind(id, partNumber, uploaded.etag, partSize).run()
  return c.json({ success: true, data: { part_number: partNumber, etag: uploaded.etag, size_bytes: partSize } })
})

route.post('/asset-upload-sessions/:id/complete', requirePermission('upload_images'), async (c) => {
  const id = pathParam(c, 'id')
  const value = await body(c) ?? {}
  const session = await queryFirst<Row>(c.env.DB, `SELECT au.*, ca.mime_type, ca.visibility FROM asset_uploads au JOIN content_assets ca ON ca.id = au.asset_id WHERE au.id = ? AND au.status = 'uploading'`, [id])
  if (!session) return c.json({ success: false, error: 'Active upload session not found' }, 404)
  const parts = await queryAll<{ part_number: number; etag: string; size_bytes: number }>(c.env.DB, 'SELECT part_number, etag, size_bytes FROM asset_upload_parts WHERE upload_session_id = ? ORDER BY part_number', [id])
  if (!parts.length) return c.json({ success: false, error: 'No uploaded parts found' }, 409)
  const total = parts.reduce((sum, part) => sum + Number(part.size_bytes), 0)
  if (total !== Number(session.expected_size)) return c.json({ success: false, error: `Uploaded bytes (${total}) do not match expected size (${session.expected_size})` }, 409)
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (Number(parts[index].size_bytes) < 5 * 1024 * 1024) return c.json({ success: false, error: 'Every multipart part except the final one must be at least 5 MiB' }, 409)
  }
  const multipart = bucket(c.env, String(session.bucket)).resumeMultipartUpload(String(session.r2_key), String(session.upload_id))
  const completed = await multipart.complete(parts.map((part) => ({ partNumber: Number(part.part_number), etag: part.etag })))
  const checksum = text(value.checksum_sha256)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE asset_uploads SET status = 'completed', completed_at = datetime('now') WHERE id = ?`).bind(id),
    c.env.DB.prepare(`
      UPDATE content_assets SET status = 'ready', source = CASE WHEN source = 'catalog' THEN 'generated' ELSE source END,
        size_bytes = ?, checksum_sha256 = ?, etag = ?, uploaded_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(total, checksum, completed.etag, actor(c), session.asset_id),
    audit(c.env.DB, c, 'upload_complete', 'content_asset', String(session.asset_id), { session_id: id, size: total, etag: completed.etag }),
  ])
  return c.json({ success: true, data: { asset_id: session.asset_id, status: 'ready', size_bytes: total, etag: completed.etag } })
})

route.delete('/asset-upload-sessions/:id', requirePermission('upload_images'), async (c) => {
  const id = pathParam(c, 'id')
  const session = await queryFirst<Row>(c.env.DB, `SELECT * FROM asset_uploads WHERE id = ? AND status = 'uploading'`, [id])
  if (!session) return c.json({ success: false, error: 'Active upload session not found' }, 404)
  const multipart = bucket(c.env, String(session.bucket)).resumeMultipartUpload(String(session.r2_key), String(session.upload_id))
  await multipart.abort().catch(() => undefined)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE asset_uploads SET status = 'aborted' WHERE id = ?`).bind(id),
    c.env.DB.prepare(`UPDATE content_assets SET status = 'planned', updated_at = datetime('now') WHERE id = ?`).bind(session.asset_id),
    audit(c.env.DB, c, 'upload_abort', 'content_asset', String(session.asset_id), { session_id: id }),
  ])
  return c.json({ success: true, data: { id, status: 'aborted' } })
})

route.get('/assets/:id/content', async (c) => {
  const asset = await queryFirst<Row>(c.env.DB, `SELECT * FROM content_assets WHERE id = ? AND status = 'ready'`, [pathParam(c, 'id')])
  if (!asset || !asset.r2_key || !asset.bucket) return c.json({ success: false, error: 'Ready asset not found' }, 404)
  const range = c.req.header('Range')
  const rangeOptions = range ? { range: c.req.raw.headers } : undefined
  // Admin reads honour the stored bucket first, then fall back to the bucket the
  // asset *should* live in. This keeps the admin library usable while the
  // migration in scripts/migrate-asset-buckets.mjs is only partly applied.
  const storedBucket = String(asset.bucket)
  const derivedBucket = bucketForRow(asset)
  let object = await bucket(c.env, storedBucket).get(String(asset.r2_key), rangeOptions)
  if (!object && derivedBucket !== storedBucket) {
    object = await bucket(c.env, derivedBucket).get(String(asset.r2_key), rangeOptions)
  }
  if (!object) return c.json({ success: false, error: 'Asset object is missing from storage' }, 404)
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Disposition', `inline; filename="${String(asset.original_filename || 'asset').replace(/["\r\n]/g, '')}"`)
  headers.set('Cache-Control', asset.visibility === 'public' ? 'public, max-age=3600' : 'private, no-store')
  if (range && 'range' in object && object.range) {
    const objectRange = object.range as { offset: number; length: number }
    headers.set('Content-Range', `bytes ${objectRange.offset}-${objectRange.offset + objectRange.length - 1}/${object.size}`)
    headers.set('Content-Length', String(objectRange.length))
    return new Response(object.body, { status: 206, headers })
  }
  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { headers })
})

export default route
