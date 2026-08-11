import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { pathParam } from '../lib/routeParams.ts'
// Explicit .ts specifiers, as in lib/routeParams.ts and lib/gamePackGate.ts
// below: the extensionless form only resolves through a bundler, so this router
// could not be imported by `node --experimental-strip-types --test` and none of
// its 40+ handlers had test coverage.
import { queryAll, queryFirst } from '../lib/db.ts'
import { isIslamicContent, validateIslamicFields } from '../lib/islamicContent.ts'
import { actorId, auditStatement } from '../lib/auditLog.ts'
import { requirePermission } from '../lib/adminAuth.ts'
import {
  bookLanguagesError,
  bookPublishError,
  engineIdError,
  gamePublishError,
  isReleaseStatus,
  parsePagination,
  projectPublishError,
  storyPublishError,
  uniqueStringArray,
} from '../lib/catalogueValidation.ts'
import { validatePackForGame } from '../lib/gamePackGate.ts'

type AppEnv = { Bindings: Env }
type Row = Record<string, unknown>
type JsonObject = Record<string, unknown>

const route = new Hono<AppEnv>()

const CONTENT_STATUSES = ['draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published', 'archived']
const STORY_TYPES = ['picture_book', 'audio_story', 'interactive', 'comic']
const READING_LEVELS = ['pre_reader', 'emerging', 'independent']
const INTERACTION_MODES = ['tap', 'guided', 'mixed', 'independent']
const SUPERVISION_LEVELS = ['none', 'recommended', 'required']
const PRICE_TIERS = ['free', 'family', 'family_plus']
const STYLE_MEDIA = ['2d', '3d', 'mixed', 'stop_motion', 'live', 'graphic']
const PRODUCTION_LEVELS = ['motion_story', 'limited_2d', 'full_2d', 'live', 'stylized_3d']
const CHARACTER_ROLES = ['hero', 'side', 'villain', 'narrator', 'presenter']
const PAGE_LAYOUTS = ['full_bleed', 'split', 'panels', 'text_focus']
const BUBBLE_KINDS = ['dialogue', 'thought', 'caption', 'sound']

async function body(c: any): Promise<JsonObject | null> {
  const value = await c.req.json().catch(() => null)
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null || value === '') return null
  return typeof value === 'string' ? value.trim() || null : undefined
}

function integer(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function boolInt(value: unknown) {
  return value === true || value === 1 || value === '1' ? 1 : 0
}

function slugify(value: string, fallback: string) {
  const slug = value.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  return slug || `${fallback}-${crypto.randomUUID().slice(0, 8)}`
}

function jsonArray(value: unknown): string | null {
  return Array.isArray(value) ? JSON.stringify(value) : null
}

function jsonObject(value: unknown): string | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? JSON.stringify(value) : null
}

function parseJson(value: unknown, fallback: unknown) {
  if (typeof value !== 'string') return fallback
  try { return JSON.parse(value) } catch { return fallback }
}

/// هوية الفاعل من الجلسة المُصادَقة.
///
/// كانت تقرأ ترويسة `X-Admin-Actor` مباشرة، وهي ترويسة يكتبها المتصل بنفسه بلا
/// أي تحقّق — فأي شخص كان يستطيع نسبة تعديلاته إلى غيره. الآن من `adminUser`
/// الذي يضبطه `requireAdmin` من صف جلسة مُتحقَّق منه.
function actor(c: any) {
  return actorId(c)
}

/// يستخدم auditStatement المشترك، فيمرّ كل صف تدقيق عبر نفس التنقية.
///
/// كان هذا الملف يُدرج بـ`JSON.stringify` خامًا، فلا يُنقّى من الرموز ولا
/// بيانات الأطفال — بخلاف باقي المسارات التي تستخدم auditStatement.
function audit(db: D1Database, c: any, action: string, entityType: string, entityId: string, details: unknown) {
  return auditStatement(db, actor(c), action, entityType, entityId, details)
}

function isConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /UNIQUE|constraint|FOREIGN KEY/i.test(message)
}

function isAgeRange(min: number | null, max: number | null): min is number {
  return min !== null && max !== null && min >= 3 && max <= 12 && max >= min
}

/// The religious-review gate. This module used to carry its own copy that
/// compared `planetId === 'iman'`, while the seeded planet ID is `islamic`, so
/// every story, book, game and project on the real Islamic planet skipped the
/// gate entirely. lib/islamicContent.ts holds the single unit-tested
/// implementation; see test/islamicContent.test.mjs.
///
/// stories, books, games and projects carry no religious columns of their own -
/// the approval is recorded on the parent series - so the gate is evaluated
/// against that series row. Content with no series and no Islamic source type is
/// unaffected.
async function islamicReleaseError(db: D1Database, seriesId: string | null): Promise<string | null> {
  if (!seriesId) return null
  const series = await queryFirst<Row>(db, `
    SELECT planet_id, source_type, verse_surah, verse_ayah, hadith_collection, hadith_number,
      religious_reviewer_id, religious_approved_at
    FROM series WHERE id = ?
  `, [seriesId])
  if (!series) return null
  if (!isIslamicContent(series.planet_id == null ? null : String(series.planet_id), series.source_type == null ? null : String(series.source_type))) {
    return null
  }
  const error = validateIslamicFields(series as JsonObject, String(series.planet_id ?? ''))
  return error ? `${error} (على المسلسل الأصل)` : null
}

function validLanguage(value: string) {
  return /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(value)
}

// Planets live in routes/adminPlanets.ts.
//
// They were four handlers here returning name + colour + series_count. The planet
// collection and workspace need aggregates over series, episodes, stories, games,
// assets, production requirements, reviews, availability and audit — all reached
// through series.planet_id — so they moved to their own router rather than growing
// this one, which already owns stories, books, games, projects and characters.

function serializeCategory(row: Row) {
  return { ...row, is_active: Boolean(row.is_active) }
}

function serializeStyle(row: Row) {
  return { ...row, is_active: Boolean(row.is_active), age_tracks: parseJson(row.age_tracks, []) }
}

function serializeStory(row: Row) {
  return { ...row, is_free: Boolean(row.is_free), languages: parseJson(row.languages, []) }
}


route.get('/categories', async (c) => {
  const includeInactive = c.req.query('include_inactive') === '1'
  const rows = await queryAll<Row>(c.env.DB, `
    SELECT c.*,
      (SELECT COUNT(*) FROM series_categories sc JOIN series s ON s.id = sc.series_id WHERE sc.category_id = c.id AND s.status <> 'archived') AS series_count
    FROM categories c
    ${includeInactive ? '' : 'WHERE c.is_active = 1'}
    ORDER BY c.sort_order, c.created_at
  `)
  return c.json({ success: true, data: rows.map(serializeCategory) })
})

route.post('/categories', requirePermission('create'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const nameAr = stringValue(value.name_ar)
  if (!nameAr) return c.json({ success: false, error: 'name_ar is required' }, 400)
  const slug = stringValue(value.slug) ?? slugify(stringValue(value.name_en) ?? nameAr, 'category')
  const color = stringValue(value.color_hex) ?? '#4ECDC4'
  if (!/^#[0-9a-f]{6}$/i.test(color)) return c.json({ success: false, error: 'Invalid color_hex' }, 400)
  const id = stringValue(value.id) ?? `category-${slug}`
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO categories (id, slug, name_ar, name_en, description_ar, color_hex, icon, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, slug, nameAr, nullableString(value.name_en) ?? null, nullableString(value.description_ar) ?? null, color, nullableString(value.icon) ?? null, integer(value.sort_order) ?? 0, value.is_active === undefined ? 1 : boolInt(value.is_active)),
      audit(c.env.DB, c, 'create', 'category', id, value),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Category id or slug already exists' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, slug } }, 201)
})

route.patch('/categories/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM categories WHERE id = ?', [id])) return c.json({ success: false, error: 'Category not found' }, 404)
  const sets: string[] = []
  const params: unknown[] = []
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue) }

  for (const field of ['slug', 'name_ar']) {
    if (value[field] === undefined) continue
    const parsed = stringValue(value[field])
    if (!parsed) return c.json({ success: false, error: `${field} cannot be empty` }, 400)
    add(field, parsed)
  }
  for (const field of ['name_en', 'description_ar', 'icon']) {
    if (value[field] === undefined) continue
    const parsed = nullableString(value[field])
    if (parsed === undefined) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  if (value.color_hex !== undefined) {
    const color = stringValue(value.color_hex)
    if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return c.json({ success: false, error: 'Invalid color_hex' }, 400)
    add('color_hex', color)
  }
  if (value.sort_order !== undefined) {
    const order = integer(value.sort_order)
    if (order === null) return c.json({ success: false, error: 'sort_order must be an integer' }, 400)
    add('sort_order', order)
  }
  if (value.is_active !== undefined) add('is_active', boolInt(value.is_active))
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)
  sets.push(`updated_at = datetime('now')`)

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(c.env.DB, c, 'update', 'category', id, value),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Category slug already exists' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, updated: true } })
})

route.delete('/categories/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM categories WHERE id = ?', [id])) return c.json({ success: false, error: 'Category not found' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE categories SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).bind(id),
    audit(c.env.DB, c, 'archive', 'category', id, {}),
  ])
  return c.json({ success: true, data: { id, is_active: false } })
})

route.put('/series/:id/categories', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value || !Array.isArray(value.category_ids)) return c.json({ success: false, error: 'category_ids must be an array' }, 400)
  const seriesId = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM series WHERE id = ?', [seriesId])) return c.json({ success: false, error: 'Series not found' }, 404)
  const ids = [...new Set(value.category_ids.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()))]
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',')
    const count = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM categories WHERE id IN (${placeholders}) AND is_active = 1`, ids)
    if (Number(count?.total ?? 0) !== ids.length) return c.json({ success: false, error: 'One or more categories are invalid' }, 400)
  }
  const primary = stringValue(value.primary_category_id)
  if (primary && !ids.includes(primary)) return c.json({ success: false, error: 'primary_category_id must be included in category_ids' }, 400)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM series_categories WHERE series_id = ?').bind(seriesId),
    ...ids.map((categoryId, index) => c.env.DB.prepare('INSERT INTO series_categories (series_id, category_id, is_primary) VALUES (?, ?, ?)').bind(seriesId, categoryId, categoryId === primary || (!primary && index === 0) ? 1 : 0)),
    audit(c.env.DB, c, 'update_categories', 'series', seriesId, { category_ids: ids, primary_category_id: primary }),
  ])
  return c.json({ success: true, data: { id: seriesId, category_ids: ids } })
})

// Visual styles -------------------------------------------------------------
route.get('/visual-styles', async (c) => {
  const includeInactive = c.req.query('include_inactive') === '1'
  const rows = await queryAll<Row>(c.env.DB, `
    SELECT vs.*,
      (SELECT COUNT(*) FROM series s WHERE s.visual_style_id = vs.id AND s.status <> 'archived') AS series_count,
      (SELECT COUNT(*) FROM stories st WHERE st.visual_style_id = vs.id AND st.status <> 'archived') AS stories_count
    FROM visual_styles vs
    ${includeInactive ? '' : 'WHERE vs.is_active = 1'}
    ORDER BY vs.medium, vs.name_en
  `)
  return c.json({ success: true, data: rows.map(serializeStyle) })
})

route.post('/visual-styles', requirePermission('create'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const nameAr = stringValue(value.name_ar)
  const nameEn = stringValue(value.name_en)
  const prompt = stringValue(value.prompt_fragment)
  const medium = stringValue(value.medium)
  const production = stringValue(value.production_level) ?? 'motion_story'
  if (!nameAr || !nameEn || !prompt || !medium) return c.json({ success: false, error: 'name_ar, name_en, medium and prompt_fragment are required' }, 400)
  if (!STYLE_MEDIA.includes(medium) || !PRODUCTION_LEVELS.includes(production)) return c.json({ success: false, error: 'Invalid medium or production_level' }, 400)
  const ageTracks = value.age_tracks === undefined ? '["preschool","kids","junior"]' : jsonArray(value.age_tracks)
  if (!ageTracks) return c.json({ success: false, error: 'age_tracks must be an array' }, 400)
  const slug = stringValue(value.slug) ?? slugify(nameEn, 'style')
  const id = stringValue(value.id) ?? `style-${slug}`
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO visual_styles (id, slug, name_ar, name_en, medium, description_ar, prompt_fragment, negative_prompt, production_level, age_tracks, source_reference, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, slug, nameAr, nameEn, medium, nullableString(value.description_ar) ?? null, prompt, nullableString(value.negative_prompt) ?? null, production, ageTracks, nullableString(value.source_reference) ?? null, value.is_active === undefined ? 1 : boolInt(value.is_active)),
      audit(c.env.DB, c, 'create', 'visual_style', id, { slug, medium }),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Visual style id or slug already exists' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, slug } }, 201)
})

route.patch('/visual-styles/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM visual_styles WHERE id = ?', [id])) return c.json({ success: false, error: 'Visual style not found' }, 404)
  const sets: string[] = []
  const params: unknown[] = []
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue) }

  for (const field of ['slug', 'name_ar', 'name_en', 'prompt_fragment']) {
    if (value[field] === undefined) continue
    const parsed = stringValue(value[field])
    if (!parsed) return c.json({ success: false, error: `${field} cannot be empty` }, 400)
    add(field, parsed)
  }
  for (const field of ['description_ar', 'negative_prompt', 'source_reference']) {
    if (value[field] === undefined) continue
    const parsed = nullableString(value[field])
    if (parsed === undefined) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  if (value.medium !== undefined) {
    const parsed = stringValue(value.medium)
    if (!parsed || !STYLE_MEDIA.includes(parsed)) return c.json({ success: false, error: 'Invalid medium' }, 400)
    add('medium', parsed)
  }
  if (value.production_level !== undefined) {
    const parsed = stringValue(value.production_level)
    if (!parsed || !PRODUCTION_LEVELS.includes(parsed)) return c.json({ success: false, error: 'Invalid production_level' }, 400)
    add('production_level', parsed)
  }
  if (value.age_tracks !== undefined) {
    const parsed = jsonArray(value.age_tracks)
    if (!parsed) return c.json({ success: false, error: 'age_tracks must be an array' }, 400)
    add('age_tracks', parsed)
  }
  if (value.is_active !== undefined) add('is_active', boolInt(value.is_active))
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)
  sets.push(`updated_at = datetime('now')`)
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE visual_styles SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(c.env.DB, c, 'update', 'visual_style', id, value),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Visual style slug already exists' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, updated: true } })
})

route.delete('/visual-styles/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM visual_styles WHERE id = ?', [id])) return c.json({ success: false, error: 'Visual style not found' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE visual_styles SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).bind(id),
    audit(c.env.DB, c, 'archive', 'visual_style', id, {}),
  ])
  return c.json({ success: true, data: { id, is_active: false } })
})

// Seasons -------------------------------------------------------------------
route.get('/seasons', async (c) => {
  const seriesId = c.req.query('series_id')
  const clauses = seriesId ? 'WHERE se.series_id = ?' : ''
  const params = seriesId ? [seriesId] : []
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const totalRow = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM seasons se ${clauses}`, params)
  const rows = await queryAll<Row>(c.env.DB, `
    SELECT se.*, s.title_ar AS series_title,
      (SELECT COUNT(*) FROM episodes e WHERE e.season_id = se.id AND e.status <> 'archived') AS episodes_count
    FROM seasons se
    JOIN series s ON s.id = se.series_id
    ${clauses}
    ORDER BY s.sort_order, se.season_number
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])
  return c.json({
    success: true,
    data: rows.map((row) => ({ ...row, learning_goals: parseJson(row.learning_goals, []) })),
    meta: { total: Number(totalRow?.total ?? 0), limit, offset },
  })
})

route.post('/seasons', requirePermission('create'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const seriesId = stringValue(value.series_id)
  const number = integer(value.season_number)
  const status = stringValue(value.status) ?? 'draft'
  if (!seriesId || number === null || number < 1) return c.json({ success: false, error: 'series_id and a positive season_number are required' }, 400)
  if (!CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)
  if (!await queryFirst(c.env.DB, `SELECT id FROM series WHERE id = ? AND status <> 'archived'`, [seriesId])) return c.json({ success: false, error: 'Series not found' }, 400)
  const goals = value.learning_goals === undefined ? '[]' : jsonArray(value.learning_goals)
  if (!goals) return c.json({ success: false, error: 'learning_goals must be an array' }, 400)
  const id = crypto.randomUUID()
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO seasons (id, series_id, season_number, title_ar, theme_ar, description_ar, episode_count, watch_order, learning_goals, release_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, seriesId, number, nullableString(value.title_ar) ?? null, nullableString(value.theme_ar) ?? null, nullableString(value.description_ar) ?? null, integer(value.episode_count) ?? 0, stringValue(value.watch_order) ?? 'any', goals, nullableString(value.release_date) ?? null, status),
      audit(c.env.DB, c, 'create', 'season', id, { series_id: seriesId, season_number: number }),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'This season number already exists for the series' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id } }, 201)
})

route.patch('/seasons/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM seasons WHERE id = ?', [id])) return c.json({ success: false, error: 'Season not found' }, 404)
  const sets: string[] = []
  const params: unknown[] = []
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue) }
  if (value.series_id !== undefined) {
    const seriesId = stringValue(value.series_id)
    if (!seriesId || !await queryFirst(c.env.DB, `SELECT id FROM series WHERE id = ? AND status <> 'archived'`, [seriesId])) return c.json({ success: false, error: 'Series not found' }, 400)
    add('series_id', seriesId)
  }
  if (value.season_number !== undefined) {
    const number = integer(value.season_number)
    if (number === null || number < 1) return c.json({ success: false, error: 'season_number must be positive' }, 400)
    add('season_number', number)
  }
  for (const field of ['title_ar', 'theme_ar', 'description_ar', 'release_date']) {
    if (value[field] === undefined) continue
    const parsed = nullableString(value[field])
    if (parsed === undefined) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  if (value.episode_count !== undefined) {
    const count = integer(value.episode_count)
    if (count === null || count < 0) return c.json({ success: false, error: 'episode_count must be zero or positive' }, 400)
    add('episode_count', count)
  }
  if (value.watch_order !== undefined) {
    const order = stringValue(value.watch_order)
    if (!order || !['sequential', 'any'].includes(order)) return c.json({ success: false, error: 'Invalid watch_order' }, 400)
    add('watch_order', order)
  }
  if (value.status !== undefined) {
    const status = stringValue(value.status)
    if (!status || !CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)
    add('status', status)
  }
  if (value.learning_goals !== undefined) {
    const goals = jsonArray(value.learning_goals)
    if (!goals) return c.json({ success: false, error: 'learning_goals must be an array' }, 400)
    add('learning_goals', goals)
  }
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE seasons SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(c.env.DB, c, 'update', 'season', id, value),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Season values conflict with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, updated: true } })
})

route.delete('/seasons/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM seasons WHERE id = ?', [id])) return c.json({ success: false, error: 'Season not found' }, 404)
  // Archiving a season that published episodes or stories still sit in would
  // hide the grouping the public catalogue orders them by.
  const referenced = await queryFirst<{ episodes: number; stories: number }>(c.env.DB, `
    SELECT
      (SELECT COUNT(*) FROM episodes WHERE season_id = ? AND status = 'published') AS episodes,
      (SELECT COUNT(*) FROM stories WHERE season_id = ? AND status = 'published') AS stories
  `, [id, id])
  if (Number(referenced?.episodes ?? 0) > 0 || Number(referenced?.stories ?? 0) > 0) {
    return c.json({ success: false, error: `Season still holds ${referenced?.episodes} published episode(s) and ${referenced?.stories} published story/stories. Move or unpublish them first.` }, 409)
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE seasons SET status = 'archived' WHERE id = ?`).bind(id),
    audit(c.env.DB, c, 'archive', 'season', id, {}),
  ])
  return c.json({ success: true, data: { id, status: 'archived' } })
})

// Characters ----------------------------------------------------------------
route.get('/characters', async (c) => {
  const seriesId = c.req.query('series_id')
  const includeArchived = c.req.query('include_archived') === '1'
  const clauses: string[] = []
  const params: unknown[] = []
  if (seriesId) { clauses.push('ch.series_id = ?'); params.push(seriesId) }
  if (!includeArchived) clauses.push(`ch.status <> 'archived'`)
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const totalRow = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM characters ch ${where}`, params)
  const rows = await queryAll<Row>(c.env.DB, `
    SELECT ch.*, s.title_ar AS series_title
    FROM characters ch JOIN series s ON s.id = ch.series_id
    ${where}
    ORDER BY s.sort_order, ch.created_at
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])
  return c.json({
    success: true,
    data: rows.map((row) => ({ ...row, traits: parseJson(row.traits, []), reference_images: parseJson(row.reference_images, []), expressions: parseJson(row.expressions, {}), outfits: parseJson(row.outfits, []), languages: parseJson(row.languages, []) })),
    meta: { total: Number(totalRow?.total ?? 0), limit, offset },
  })
})

route.post('/characters', requirePermission('create'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const seriesId = stringValue(value.series_id)
  const nameAr = stringValue(value.name_ar)
  const role = stringValue(value.role)
  if (!seriesId || !nameAr) return c.json({ success: false, error: 'series_id and name_ar are required' }, 400)
  if (role && !CHARACTER_ROLES.includes(role)) return c.json({ success: false, error: 'Invalid role' }, 400)
  if (!await queryFirst(c.env.DB, `SELECT id FROM series WHERE id = ? AND status <> 'archived'`, [seriesId])) return c.json({ success: false, error: 'Series not found' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO characters (id, series_id, name_ar, role, age, description_ar, traits, speech_style, reference_images, expressions, outfits, voice_actor, languages, rights_owner, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).bind(id, seriesId, nameAr, role, integer(value.age), nullableString(value.description_ar) ?? null, jsonArray(value.traits) ?? '[]', nullableString(value.speech_style) ?? null, jsonArray(value.reference_images) ?? '[]', jsonObject(value.expressions) ?? '{}', jsonArray(value.outfits) ?? '[]', nullableString(value.voice_actor) ?? null, jsonArray(value.languages) ?? '["ar"]', nullableString(value.rights_owner) ?? null),
    audit(c.env.DB, c, 'create', 'character', id, { series_id: seriesId, name_ar: nameAr }),
  ])
  return c.json({ success: true, data: { id } }, 201)
})

route.patch('/characters/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM characters WHERE id = ?', [id])) return c.json({ success: false, error: 'Character not found' }, 404)
  const sets: string[] = []
  const params: unknown[] = []
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue) }
  for (const field of ['series_id', 'name_ar']) {
    if (value[field] === undefined) continue
    const parsed = stringValue(value[field])
    if (!parsed) return c.json({ success: false, error: `${field} cannot be empty` }, 400)
    add(field, parsed)
  }
  for (const field of ['description_ar', 'speech_style', 'voice_actor', 'rights_owner']) {
    if (value[field] === undefined) continue
    const parsed = nullableString(value[field])
    if (parsed === undefined) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  if (value.role !== undefined) {
    const parsed = nullableString(value.role)
    if (parsed && !CHARACTER_ROLES.includes(parsed)) return c.json({ success: false, error: 'Invalid role' }, 400)
    add('role', parsed)
  }
  if (value.age !== undefined) {
    if (value.age === null || value.age === '') add('age', null)
    else {
      const parsed = integer(value.age)
      if (parsed === null || parsed < 0) return c.json({ success: false, error: 'Invalid age' }, 400)
      add('age', parsed)
    }
  }
  for (const field of ['traits', 'reference_images', 'outfits', 'languages']) {
    if (value[field] === undefined) continue
    const parsed = jsonArray(value[field])
    if (!parsed) return c.json({ success: false, error: `${field} must be an array` }, 400)
    add(field, parsed)
  }
  if (value.expressions !== undefined) {
    const parsed = jsonObject(value.expressions)
    if (!parsed) return c.json({ success: false, error: 'expressions must be an object' }, 400)
    add('expressions', parsed)
  }
  if (value.status !== undefined) {
    const status = stringValue(value.status)
    if (!status || !['active', 'archived'].includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)
    add('status', status)
  }
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(c.env.DB, c, 'update', 'character', id, value),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Character values conflict with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, updated: true } })
})

route.delete('/characters/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM characters WHERE id = ?', [id])) return c.json({ success: false, error: 'Character not found' }, 404)
  // story_bubbles.character_id is ON DELETE SET NULL and speech bubbles in a
  // published story would lose their speaker.
  const bubbles = await queryFirst<{ total: number }>(c.env.DB, `
    SELECT COUNT(*) AS total
    FROM story_bubbles sb
    JOIN story_pages sp ON sp.id = sb.page_id
    JOIN stories st ON st.id = sp.story_id
    WHERE sb.character_id = ? AND st.status = 'published'
  `, [id])
  if (Number(bubbles?.total ?? 0) > 0) {
    return c.json({ success: false, error: `Character speaks in ${bubbles?.total} bubble(s) of published stories. Reassign them first.` }, 409)
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE characters SET status = 'archived' WHERE id = ?`).bind(id),
    audit(c.env.DB, c, 'archive', 'character', id, {}),
  ])
  return c.json({ success: true, data: { id, status: 'archived' } })
})

// Books, games, and projects ------------------------------------------------
const GAME_DIFFICULTIES = ['easy', 'medium', 'hard']

function strictBoolInt(value: unknown): number | null {
  if (value === true || value === 1 || value === '1') return 1
  if (value === false || value === 0 || value === '0') return 0
  return null
}

function optionalNullableString(value: unknown): string | null | undefined {
  return value === undefined ? null : nullableString(value)
}

/// uniqueStringArray now comes from lib/catalogueValidation.ts. This module
/// carried a byte-identical private copy, so the rule had two homes and only
/// one of them was unit tested.

function serializeBook(row: Row) {
  return { ...row, pages: parseJson(row.pages, []), languages: parseJson(row.languages, ['ar']), is_free: Boolean(row.is_free) }
}

function serializeGame(row: Row) {
  return { ...row, content_pack: parseJson(row.content_pack, {}), help_system: parseJson(row.help_system, {}), is_free: Boolean(row.is_free) }
}

function serializeProject(row: Row) {
  return {
    ...row,
    materials: parseJson(row.materials, []),
    steps: parseJson(row.steps, []),
    learning_objective_ids: parseJson(row.learning_objective_ids, []),
    is_free: Boolean(row.is_free),
  }
}

async function linkedAssets(db: D1Database, entityType: string, entityId: string) {
  return queryAll<Row>(db, `
    SELECT ca.*, al.id AS link_id, al.role, al.language AS link_language,
      al.sort_order AS link_sort_order, al.created_at AS linked_at
    FROM asset_links al
    JOIN content_assets ca ON ca.id = al.asset_id
    WHERE al.entity_type = ? AND al.entity_id = ?
    ORDER BY al.sort_order, ca.created_at
  `, [entityType, entityId])
}

async function objectiveIdsExist(db: D1Database, ids: string[]) {
  if (!ids.length) return true
  const placeholders = ids.map(() => '?').join(',')
  const row = await queryFirst<{ total: number }>(db, `SELECT COUNT(*) AS total FROM learning_objectives WHERE id IN (${placeholders})`, ids)
  return Number(row?.total ?? 0) === ids.length
}

async function gameReferenceError(db: D1Database, engineId: string, seriesId: string | null, episodeId: string | null, objectiveId: string | null) {
  // engine_id is a FOREIGN KEY with ON DELETE RESTRICT; the pure check in
  // lib/catalogueValidation.ts turns an unknown engine into a readable 400
  // instead of a raw FOREIGN KEY failure.
  const engines = await queryAll<{ id: string }>(db, 'SELECT id FROM game_engines')
  const engineError = engineIdError(engineId, engines.map((engine) => engine.id))
  if (engineError) return engineError
  if (seriesId && !await queryFirst(db, `SELECT id FROM series WHERE id = ? AND status <> 'archived'`, [seriesId])) return 'Series not found'
  if (episodeId) {
    const episode = await queryFirst<{ series_id: string }>(db, `SELECT series_id FROM episodes WHERE id = ? AND status <> 'archived'`, [episodeId])
    if (!episode) return 'Episode not found'
    if (seriesId && episode.series_id !== seriesId) return 'episode_id must belong to series_id'
  }
  if (objectiveId && !await queryFirst(db, 'SELECT id FROM learning_objectives WHERE id = ?', [objectiveId])) return 'Learning objective not found'
  return null
}

route.get('/game-engines', async (c) => {
  const rows = await queryAll<Row>(c.env.DB, `
    SELECT ge.*,
      (SELECT COUNT(*) FROM games g WHERE g.engine_id = ge.id AND g.status <> 'archived') AS games_count
    FROM game_engines ge
    ORDER BY ge.name_ar, ge.created_at
  `)
  return c.json({ success: true, data: rows.map((row) => ({ ...row, mechanics: parseJson(row.mechanics, {}) })) })
})

route.get('/books', async (c) => {
  const clauses: string[] = []
  const params: unknown[] = []
  const query = c.req.query('q')?.trim()
  const status = c.req.query('status')
  const planet = c.req.query('planet')
  if (query) { clauses.push('(b.title_ar LIKE ? OR s.title_ar LIKE ?)'); params.push(`%${query}%`, `%${query}%`) }
  if (status && status !== 'all') {
    if (!CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)
    clauses.push('b.status = ?')
    params.push(status)
  }
  // A book reaches its planet only through its series; `books` has no planet column.
  // Without this filter the planet workspace could only link to the whole catalogue,
  // so a counter reading "4 books" opened a list of every book in Majarra.
  if (planet) { clauses.push('s.planet_id = ?'); params.push(planet) }
  if (!status) clauses.push(`b.status <> 'archived'`)
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const totalRow = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM books b LEFT JOIN series s ON s.id = b.series_id ${where}`, params)
  const rows = await queryAll<Row>(c.env.DB, `
    SELECT b.*, s.title_ar AS series_title,
      (SELECT al.asset_id FROM asset_links al WHERE al.entity_type = 'book' AND al.entity_id = b.id AND al.role = 'cover' ORDER BY al.created_at DESC LIMIT 1) AS cover_asset_id
    FROM books b
    LEFT JOIN series s ON s.id = b.series_id
    ${where}
    ORDER BY b.updated_at DESC, b.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])
  return c.json({ success: true, data: rows.map(serializeBook), meta: { total: Number(totalRow?.total ?? 0), limit, offset } })
})

route.get('/books/:id', async (c) => {
  const id = pathParam(c, 'id')
  const book = await queryFirst<Row>(c.env.DB, `
    SELECT b.*, s.title_ar AS series_title
    FROM books b
    LEFT JOIN series s ON s.id = b.series_id
    WHERE b.id = ?
  `, [id])
  if (!book) return c.json({ success: false, error: 'Book not found' }, 404)
  const assets = await linkedAssets(c.env.DB, 'book', id)
  return c.json({ success: true, data: { ...serializeBook(book), assets } })
})

route.post('/books', requirePermission('create'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const titleAr = stringValue(value.title_ar)
  const type = value.type === undefined ? 'picture_book' : stringValue(value.type)
  const ageMin = integer(value.age_min)
  const ageMax = integer(value.age_max)
  const reading = value.reading_level === undefined ? 'emerging' : stringValue(value.reading_level)
  const interaction = value.interaction_mode === undefined ? 'guided' : stringValue(value.interaction_mode)
  const supervision = value.supervision_level === undefined ? 'recommended' : stringValue(value.supervision_level)
  const status = value.status === undefined ? 'draft' : stringValue(value.status)
  if (!titleAr || !isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'title_ar and an age range within 3-12 are required' }, 400)
  if (!type || !STORY_TYPES.includes(type) || !reading || !READING_LEVELS.includes(reading) || !interaction || !INTERACTION_MODES.includes(interaction) || !supervision || !SUPERVISION_LEVELS.includes(supervision) || !status || !CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid book type, experience metadata, or status' }, 400)
  const pages = value.pages === undefined ? '[]' : jsonArray(value.pages)
  if (!pages) return c.json({ success: false, error: 'pages must be an array' }, 400)
  const seriesId = optionalNullableString(value.series_id)
  const safetyNotes = optionalNullableString(value.safety_notes)
  if (seriesId === undefined || safetyNotes === undefined) return c.json({ success: false, error: 'Invalid series_id or safety_notes' }, 400)
  if (seriesId && !await queryFirst(c.env.DB, `SELECT id FROM series WHERE id = ? AND status <> 'archived'`, [seriesId])) return c.json({ success: false, error: 'Series not found' }, 400)
  const isFree = value.is_free === undefined ? 0 : strictBoolInt(value.is_free)
  if (isFree === null) return c.json({ success: false, error: 'is_free must be a boolean' }, 400)
  // visual_style_id, languages and default_language exist on the books table but
  // had no HTTP surface, so a book's art style and language set could only be
  // set with raw SQL. visual_style_id is an ON DELETE SET NULL foreign key;
  // validating it here turns a bad id into a 400 instead of a FOREIGN KEY 500.
  const visualStyleId = optionalNullableString(value.visual_style_id)
  if (visualStyleId === undefined) return c.json({ success: false, error: 'Invalid visual_style_id' }, 400)
  if (visualStyleId && !await queryFirst(c.env.DB, 'SELECT id FROM visual_styles WHERE id = ? AND is_active = 1', [visualStyleId])) {
    return c.json({ success: false, error: 'Visual style not found' }, 400)
  }
  const bookLanguages = value.languages === undefined ? ['ar'] : uniqueStringArray(value.languages)
  const bookDefaultLanguage = stringValue(value.default_language) ?? (bookLanguages?.[0] ?? 'ar')
  const languageError = bookLanguagesError(bookLanguages, bookDefaultLanguage)
  if (languageError) return c.json({ success: false, error: languageError }, 400)
  if (isReleaseStatus(status)) {
    const gate = bookPublishError(pages)
    if (gate) return c.json({ success: false, error: gate }, 400)
    const islamic = await islamicReleaseError(c.env.DB, seriesId)
    if (islamic) return c.json({ success: false, error: islamic }, 400)
  }
  const id = crypto.randomUUID()
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO books (id, series_id, title_ar, type, pages, age_min, age_max, reading_level, interaction_mode, supervision_level, safety_notes, is_free, status, visual_style_id, languages, default_language, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(id, seriesId, titleAr, type, pages, ageMin, ageMax, reading, interaction, supervision, safetyNotes, isFree, status, visualStyleId, JSON.stringify(bookLanguages), bookDefaultLanguage),
      audit(c.env.DB, c, 'create', 'book', id, { title_ar: titleAr, type, status }),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Book values conflict with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, status } }, 201)
})

route.patch('/books/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const id = pathParam(c, 'id')
  const existing = await queryFirst<Row>(c.env.DB, 'SELECT * FROM books WHERE id = ?', [id])
  if (!existing) return c.json({ success: false, error: 'Book not found' }, 404)
  const ageMin = value.age_min === undefined ? Number(existing.age_min) : integer(value.age_min)
  const ageMax = value.age_max === undefined ? Number(existing.age_max) : integer(value.age_max)
  if (!isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'Age range must be within 3-12' }, 400)

  const sets: string[] = []
  const params: unknown[] = []
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue) }
  if (value.title_ar !== undefined) {
    const title = stringValue(value.title_ar)
    if (!title) return c.json({ success: false, error: 'title_ar cannot be empty' }, 400)
    add('title_ar', title)
  }
  if (value.series_id !== undefined) {
    const seriesId = nullableString(value.series_id)
    if (seriesId === undefined) return c.json({ success: false, error: 'Invalid series_id' }, 400)
    if (seriesId && !await queryFirst(c.env.DB, `SELECT id FROM series WHERE id = ? AND status <> 'archived'`, [seriesId])) return c.json({ success: false, error: 'Series not found' }, 400)
    add('series_id', seriesId)
  }
  const enums: Array<[string, string[]]> = [['type', STORY_TYPES], ['reading_level', READING_LEVELS], ['interaction_mode', INTERACTION_MODES], ['supervision_level', SUPERVISION_LEVELS], ['status', CONTENT_STATUSES]]
  for (const [field, allowed] of enums) {
    if (value[field] === undefined) continue
    const parsed = stringValue(value[field])
    if (!parsed || !allowed.includes(parsed)) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  if (value.pages !== undefined) {
    const pages = jsonArray(value.pages)
    if (!pages) return c.json({ success: false, error: 'pages must be an array' }, 400)
    add('pages', pages)
  }
  if (value.safety_notes !== undefined) {
    const notes = nullableString(value.safety_notes)
    if (notes === undefined) return c.json({ success: false, error: 'Invalid safety_notes' }, 400)
    add('safety_notes', notes)
  }
  if (value.age_min !== undefined) add('age_min', ageMin)
  if (value.age_max !== undefined) add('age_max', ageMax)
  if (value.is_free !== undefined) {
    const isFree = strictBoolInt(value.is_free)
    if (isFree === null) return c.json({ success: false, error: 'is_free must be a boolean' }, 400)
    add('is_free', isFree)
  }
  if (value.visual_style_id !== undefined) {
    const styleId = nullableString(value.visual_style_id)
    if (styleId === undefined) return c.json({ success: false, error: 'Invalid visual_style_id' }, 400)
    if (styleId && !await queryFirst(c.env.DB, 'SELECT id FROM visual_styles WHERE id = ? AND is_active = 1', [styleId])) {
      return c.json({ success: false, error: 'Visual style not found' }, 400)
    }
    add('visual_style_id', styleId)
  }
  // languages and default_language have to stay consistent: dropping the
  // default language out of the list would leave the reader with no text to
  // fall back on, so both are resolved together against their final values.
  // The rule itself is pure and unit tested (bookLanguagesError).
  if (value.languages !== undefined || value.default_language !== undefined) {
    const finalLanguages = value.languages === undefined
      ? (parseJson(existing.languages, ['ar']) as string[])
      : uniqueStringArray(value.languages)
    const finalDefaultLanguage = value.default_language === undefined
      ? String(existing.default_language ?? 'ar')
      : stringValue(value.default_language)
    const languageError = bookLanguagesError(finalLanguages, finalDefaultLanguage)
    if (languageError) return c.json({ success: false, error: languageError }, 400)
    if (value.languages !== undefined) add('languages', JSON.stringify(finalLanguages))
    if (value.default_language !== undefined) add('default_language', finalDefaultLanguage)
  }
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)
  const finalStatus = value.status === undefined ? String(existing.status) : stringValue(value.status)
  if (isReleaseStatus(finalStatus)) {
    const finalPages = value.pages === undefined ? existing.pages : value.pages
    const gate = bookPublishError(finalPages)
    if (gate) return c.json({ success: false, error: gate }, 400)
    const finalSeriesId = value.series_id === undefined
      ? (existing.series_id == null ? null : String(existing.series_id))
      : nullableString(value.series_id) ?? null
    const islamic = await islamicReleaseError(c.env.DB, finalSeriesId)
    if (islamic) return c.json({ success: false, error: islamic }, 400)
  }
  sets.push(`updated_at = datetime('now')`)
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE books SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(c.env.DB, c, 'update', 'book', id, value),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Book values conflict with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, updated: true } })
})

route.delete('/books/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM books WHERE id = ?', [id])) return c.json({ success: false, error: 'Book not found' }, 404)
  // episodes.linked_book_id has no foreign key, so archiving a book a published
  // episode still points at would leave that episode linking to hidden content.
  const linked = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM episodes WHERE linked_book_id = ? AND status = 'published'`, [id])
  if (Number(linked?.total ?? 0) > 0) {
    return c.json({ success: false, error: `Book is linked from ${linked?.total} published episode(s). Unlink them first.` }, 409)
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE books SET status = 'archived', updated_at = datetime('now') WHERE id = ?`).bind(id),
    audit(c.env.DB, c, 'archive', 'book', id, {}),
  ])
  return c.json({ success: true, data: { id, status: 'archived' } })
})

route.get('/games', async (c) => {
  const clauses: string[] = []
  const params: unknown[] = []
  const query = c.req.query('q')?.trim()
  const status = c.req.query('status')
  const planet = c.req.query('planet')
  if (query) { clauses.push('(g.title_ar LIKE ? OR s.title_ar LIKE ? OR ge.name_ar LIKE ?)'); params.push(`%${query}%`, `%${query}%`, `%${query}%`) }
  if (status && status !== 'all') {
    if (!CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)
    clauses.push('g.status = ?')
    params.push(status)
  }
  // A game may hang off a series directly or off an episode that belongs to one, and
  // the planet counter on the workspace counts both. Filtering on `g.series_id` alone
  // would silently drop every episode-attached game and contradict that counter.
  if (planet) {
    clauses.push(`COALESCE(g.series_id, (SELECT e2.series_id FROM episodes e2 WHERE e2.id = g.episode_id))
      IN (SELECT s2.id FROM series s2 WHERE s2.planet_id = ?)`)
    params.push(planet)
  }
  if (!status) clauses.push(`g.status <> 'archived'`)
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const totalRow = await queryFirst<{ total: number }>(c.env.DB, `
    SELECT COUNT(*) AS total FROM games g
    JOIN game_engines ge ON ge.id = g.engine_id
    LEFT JOIN series s ON s.id = g.series_id
    ${where}
  `, params)
  const rows = await queryAll<Row>(c.env.DB, `
    SELECT g.*, ge.name_ar AS engine_name, s.title_ar AS series_title,
      e.title_ar AS episode_title, lo.title_ar AS learning_objective_title,
      (SELECT al.asset_id FROM asset_links al WHERE al.entity_type = 'game' AND al.entity_id = g.id AND al.role = 'cover' ORDER BY al.created_at DESC LIMIT 1) AS cover_asset_id
    FROM games g
    JOIN game_engines ge ON ge.id = g.engine_id
    LEFT JOIN series s ON s.id = g.series_id
    LEFT JOIN episodes e ON e.id = g.episode_id
    LEFT JOIN learning_objectives lo ON lo.id = g.learning_objective_id
    ${where}
    ORDER BY g.updated_at DESC, g.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])
  return c.json({ success: true, data: rows.map(serializeGame), meta: { total: Number(totalRow?.total ?? 0), limit, offset } })
})

route.get('/games/:id', async (c) => {
  const id = pathParam(c, 'id')
  const game = await queryFirst<Row>(c.env.DB, `
    SELECT g.*, ge.name_ar AS engine_name, s.title_ar AS series_title,
      e.title_ar AS episode_title, lo.title_ar AS learning_objective_title
    FROM games g
    JOIN game_engines ge ON ge.id = g.engine_id
    LEFT JOIN series s ON s.id = g.series_id
    LEFT JOIN episodes e ON e.id = g.episode_id
    LEFT JOIN learning_objectives lo ON lo.id = g.learning_objective_id
    WHERE g.id = ?
  `, [id])
  if (!game) return c.json({ success: false, error: 'Game not found' }, 404)
  const assets = await linkedAssets(c.env.DB, 'game', id)
  return c.json({ success: true, data: { ...serializeGame(game), assets } })
})

route.post('/games', requirePermission('create'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const engineId = stringValue(value.engine_id)
  const titleAr = stringValue(value.title_ar)
  const ageMin = integer(value.age_min)
  const ageMax = integer(value.age_max)
  const reading = value.reading_level === undefined ? 'emerging' : stringValue(value.reading_level)
  const interaction = value.interaction_mode === undefined ? 'guided' : stringValue(value.interaction_mode)
  const supervision = value.supervision_level === undefined ? 'recommended' : stringValue(value.supervision_level)
  const difficulty = value.difficulty === undefined ? 'easy' : stringValue(value.difficulty)
  const status = value.status === undefined ? 'draft' : stringValue(value.status)
  if (!engineId || !titleAr || !isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'engine_id, title_ar, and an age range within 3-12 are required' }, 400)
  if (!reading || !READING_LEVELS.includes(reading) || !interaction || !INTERACTION_MODES.includes(interaction) || !supervision || !SUPERVISION_LEVELS.includes(supervision) || !difficulty || !GAME_DIFFICULTIES.includes(difficulty) || !status || !CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid game experience metadata or status' }, 400)
  const seriesId = optionalNullableString(value.series_id)
  const episodeId = optionalNullableString(value.episode_id)
  const objectiveId = optionalNullableString(value.learning_objective_id)
  const safetyNotes = optionalNullableString(value.safety_notes)
  const instructions = optionalNullableString(value.instructions_ar)
  if (seriesId === undefined || episodeId === undefined || objectiveId === undefined || safetyNotes === undefined || instructions === undefined) return c.json({ success: false, error: 'Invalid nullable game field' }, 400)
  const referenceError = await gameReferenceError(c.env.DB, engineId, seriesId, episodeId, objectiveId)
  if (referenceError) return c.json({ success: false, error: referenceError }, 400)
  const contentPack = value.content_pack === undefined ? '{}' : jsonObject(value.content_pack)
  const helpSystem = value.help_system === undefined ? '{}' : jsonObject(value.help_system)
  if (!contentPack || !helpSystem) return c.json({ success: false, error: 'content_pack and help_system must be objects' }, 400)
  let maxAttempts: number | null = null
  if (value.max_attempts !== undefined && value.max_attempts !== null && value.max_attempts !== '') {
    maxAttempts = integer(value.max_attempts)
    if (maxAttempts === null || maxAttempts < 1) return c.json({ success: false, error: 'max_attempts must be a positive integer or null' }, 400)
  }
  const isFree = value.is_free === undefined ? 0 : strictBoolInt(value.is_free)
  if (isFree === null) return c.json({ success: false, error: 'is_free must be a boolean' }, 400)
  // Engine pack contract. Runs on every write, not only at publish: a level
  // numbered 0 or a colouring stage claiming to grade the child is a defect at
  // any status. Asset readiness and human review are only enforced for a
  // release, which is what `forPublish` selects.
  const packGate = await validatePackForGame(
    c.env.DB,
    { engine_id: engineId, age_min: ageMin as number, age_max: ageMax as number, supervision_level: supervision, safety_notes: safetyNotes },
    contentPack,
    isReleaseStatus(status),
  )
  if (packGate.errors.length) {
    return c.json({ success: false, error: `content_pack is invalid for engine ${engineId}`, details: packGate.errors }, 400)
  }
  if (isReleaseStatus(status)) {
    const gate = gamePublishError(contentPack)
    if (gate) return c.json({ success: false, error: gate }, 400)
    const islamic = await islamicReleaseError(c.env.DB, seriesId)
    if (islamic) return c.json({ success: false, error: islamic }, 400)
  }
  const id = crypto.randomUUID()
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO games (id, engine_id, series_id, episode_id, title_ar, learning_objective_id, age_min, age_max, reading_level, interaction_mode, supervision_level, safety_notes, difficulty, content_pack, instructions_ar, max_attempts, help_system, is_free, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(id, engineId, seriesId, episodeId, titleAr, objectiveId, ageMin, ageMax, reading, interaction, supervision, safetyNotes, difficulty, contentPack, instructions, maxAttempts, helpSystem, isFree, status),
      audit(c.env.DB, c, 'create', 'game', id, { title_ar: titleAr, engine_id: engineId, status }),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Game values conflict with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, status } }, 201)
})

route.patch('/games/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const id = pathParam(c, 'id')
  const existing = await queryFirst<Row>(c.env.DB, 'SELECT * FROM games WHERE id = ?', [id])
  if (!existing) return c.json({ success: false, error: 'Game not found' }, 404)
  const ageMin = value.age_min === undefined ? Number(existing.age_min) : integer(value.age_min)
  const ageMax = value.age_max === undefined ? Number(existing.age_max) : integer(value.age_max)
  if (!isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'Age range must be within 3-12' }, 400)
  const engineId = value.engine_id === undefined ? String(existing.engine_id) : stringValue(value.engine_id)
  const seriesId = value.series_id === undefined ? (existing.series_id == null ? null : String(existing.series_id)) : nullableString(value.series_id)
  const episodeId = value.episode_id === undefined ? (existing.episode_id == null ? null : String(existing.episode_id)) : nullableString(value.episode_id)
  const objectiveId = value.learning_objective_id === undefined ? (existing.learning_objective_id == null ? null : String(existing.learning_objective_id)) : nullableString(value.learning_objective_id)
  if (!engineId || seriesId === undefined || episodeId === undefined || objectiveId === undefined) return c.json({ success: false, error: 'Invalid game reference' }, 400)
  const referenceError = await gameReferenceError(c.env.DB, engineId, seriesId, episodeId, objectiveId)
  if (referenceError) return c.json({ success: false, error: referenceError }, 400)

  const sets: string[] = []
  const params: unknown[] = []
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue) }
  if (value.engine_id !== undefined) add('engine_id', engineId)
  if (value.series_id !== undefined) add('series_id', seriesId)
  if (value.episode_id !== undefined) add('episode_id', episodeId)
  if (value.learning_objective_id !== undefined) add('learning_objective_id', objectiveId)
  if (value.title_ar !== undefined) {
    const title = stringValue(value.title_ar)
    if (!title) return c.json({ success: false, error: 'title_ar cannot be empty' }, 400)
    add('title_ar', title)
  }
  for (const field of ['safety_notes', 'instructions_ar']) {
    if (value[field] === undefined) continue
    const parsed = nullableString(value[field])
    if (parsed === undefined) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  const enums: Array<[string, string[]]> = [['reading_level', READING_LEVELS], ['interaction_mode', INTERACTION_MODES], ['supervision_level', SUPERVISION_LEVELS], ['difficulty', GAME_DIFFICULTIES], ['status', CONTENT_STATUSES]]
  for (const [field, allowed] of enums) {
    if (value[field] === undefined) continue
    const parsed = stringValue(value[field])
    if (!parsed || !allowed.includes(parsed)) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  for (const field of ['content_pack', 'help_system']) {
    if (value[field] === undefined) continue
    const parsed = jsonObject(value[field])
    if (!parsed) return c.json({ success: false, error: `${field} must be an object` }, 400)
    add(field, parsed)
  }
  if (value.max_attempts !== undefined) {
    if (value.max_attempts === null || value.max_attempts === '') add('max_attempts', null)
    else {
      const attempts = integer(value.max_attempts)
      if (attempts === null || attempts < 1) return c.json({ success: false, error: 'max_attempts must be a positive integer or null' }, 400)
      add('max_attempts', attempts)
    }
  }
  if (value.age_min !== undefined) add('age_min', ageMin)
  if (value.age_max !== undefined) add('age_max', ageMax)
  if (value.is_free !== undefined) {
    const isFree = strictBoolInt(value.is_free)
    if (isFree === null) return c.json({ success: false, error: 'is_free must be a boolean' }, 400)
    add('is_free', isFree)
  }
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)
  const finalStatus = value.status === undefined ? String(existing.status) : stringValue(value.status)

  // Validate the pack that will actually be stored, merged from the patch and
  // the existing row. Checking only `value.content_pack` would let a status
  // change to `published` skip validation entirely whenever the pack itself was
  // not part of the same request — which is the normal way a game is published.
  const finalPackJson = value.content_pack === undefined
    ? String(existing.content_pack ?? '{}')
    : (jsonObject(value.content_pack) as string)
  const finalSupervision = value.supervision_level === undefined
    ? String(existing.supervision_level)
    : stringValue(value.supervision_level) as string
  const finalSafetyNotes = value.safety_notes === undefined
    ? (existing.safety_notes == null ? null : String(existing.safety_notes))
    : nullableString(value.safety_notes) ?? null
  const packGate = await validatePackForGame(
    c.env.DB,
    {
      engine_id: engineId,
      age_min: ageMin as number,
      age_max: ageMax as number,
      supervision_level: finalSupervision,
      safety_notes: finalSafetyNotes,
    },
    finalPackJson,
    isReleaseStatus(finalStatus),
  )
  if (packGate.errors.length) {
    return c.json({ success: false, error: `content_pack is invalid for engine ${engineId}`, details: packGate.errors }, 400)
  }

  if (isReleaseStatus(finalStatus)) {
    const gate = gamePublishError(finalPackJson)
    if (gate) return c.json({ success: false, error: gate }, 400)
    const islamic = await islamicReleaseError(c.env.DB, seriesId)
    if (islamic) return c.json({ success: false, error: islamic }, 400)
  }
  sets.push(`updated_at = datetime('now')`)
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE games SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(c.env.DB, c, 'update', 'game', id, value),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Game values conflict with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, updated: true } })
})

route.delete('/games/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM games WHERE id = ?', [id])) return c.json({ success: false, error: 'Game not found' }, 404)
  // episodes.linked_game_id carries no foreign key, so archiving a game a
  // published episode links to would strand that episode's activity.
  const linked = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM episodes WHERE linked_game_id = ? AND status = 'published'`, [id])
  if (Number(linked?.total ?? 0) > 0) {
    return c.json({ success: false, error: `Game is linked from ${linked?.total} published episode(s). Unlink them first.` }, 409)
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE games SET status = 'archived', updated_at = datetime('now') WHERE id = ?`).bind(id),
    audit(c.env.DB, c, 'archive', 'game', id, {}),
  ])
  return c.json({ success: true, data: { id, status: 'archived' } })
})

route.get('/projects', async (c) => {
  const clauses: string[] = []
  const params: unknown[] = []
  const query = c.req.query('q')?.trim()
  const status = c.req.query('status')
  const planet = c.req.query('planet')
  if (query) { clauses.push('(p.title_ar LIKE ? OR p.description_ar LIKE ?)'); params.push(`%${query}%`, `%${query}%`) }
  // Same two parents as games: a project hangs off a series or off an episode. The
  // planet workspace counts both, so both must filter or the counter and the list
  // it opens would disagree.
  if (planet) {
    clauses.push(`COALESCE(p.series_id, (SELECT e2.series_id FROM episodes e2 WHERE e2.id = p.episode_id))
      IN (SELECT s2.id FROM series s2 WHERE s2.planet_id = ?)`)
    params.push(planet)
  }
  if (status && status !== 'all') {
    if (!CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)
    clauses.push('p.status = ?')
    params.push(status)
  }
  if (!status) clauses.push(`p.status <> 'archived'`)
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const totalRow = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM projects p ${where}`, params)
  const rows = await queryAll<Row>(c.env.DB, `
    SELECT p.*, s.title_ar AS series_title, e.title_ar AS episode_title,
      (SELECT al.asset_id FROM asset_links al WHERE al.entity_type = 'project' AND al.entity_id = p.id AND al.role = 'cover' ORDER BY al.created_at DESC LIMIT 1) AS cover_asset_id
    FROM projects p
    LEFT JOIN series s ON s.id = p.series_id
    LEFT JOIN episodes e ON e.id = p.episode_id
    ${where}
    ORDER BY p.updated_at DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])
  return c.json({ success: true, data: rows.map(serializeProject), meta: { total: Number(totalRow?.total ?? 0), limit, offset } })
})

route.get('/projects/:id', async (c) => {
  const id = pathParam(c, 'id')
  const project = await queryFirst<Row>(c.env.DB, `
    SELECT p.*, s.title_ar AS series_title, e.title_ar AS episode_title
    FROM projects p
    LEFT JOIN series s ON s.id = p.series_id
    LEFT JOIN episodes e ON e.id = p.episode_id
    WHERE p.id = ?
  `, [id])
  if (!project) return c.json({ success: false, error: 'Project not found' }, 404)
  const assets = await linkedAssets(c.env.DB, 'project', id)
  return c.json({ success: true, data: { ...serializeProject(project), assets } })
})

/// series_id, episode_id and estimated_minutes were added by migration 0018.
/// Both links are ON DELETE SET NULL foreign keys; validating them here turns a
/// bad id into a 400 instead of a FOREIGN KEY failure.
async function projectReferenceError(db: D1Database, seriesId: string | null, episodeId: string | null): Promise<string | null> {
  if (seriesId && !await queryFirst(db, `SELECT id FROM series WHERE id = ? AND status <> 'archived'`, [seriesId])) return 'Series not found'
  if (episodeId) {
    const episode = await queryFirst<{ series_id: string }>(db, `SELECT series_id FROM episodes WHERE id = ? AND status <> 'archived'`, [episodeId])
    if (!episode) return 'Episode not found'
    if (seriesId && episode.series_id !== seriesId) return 'episode_id must belong to series_id'
  }
  return null
}

route.post('/projects', requirePermission('create'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const titleAr = stringValue(value.title_ar)
  const ageMin = integer(value.age_min)
  const ageMax = integer(value.age_max)
  const supervision = value.supervision_level === undefined ? 'recommended' : stringValue(value.supervision_level)
  const status = value.status === undefined ? 'draft' : stringValue(value.status)
  if (!titleAr || !isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'title_ar and an age range within 3-12 are required' }, 400)
  if (!supervision || !SUPERVISION_LEVELS.includes(supervision) || !status || !CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid supervision_level or status' }, 400)
  const description = optionalNullableString(value.description_ar)
  const safetyNotes = optionalNullableString(value.safety_notes)
  const coverUrl = optionalNullableString(value.cover_url)
  if (description === undefined || safetyNotes === undefined || coverUrl === undefined) return c.json({ success: false, error: 'Invalid nullable project field' }, 400)
  const materials = value.materials === undefined ? '[]' : jsonArray(value.materials)
  const steps = value.steps === undefined ? '[]' : jsonArray(value.steps)
  if (!materials || !steps) return c.json({ success: false, error: 'materials and steps must be arrays' }, 400)
  const objectiveIds = value.learning_objective_ids === undefined ? [] : uniqueStringArray(value.learning_objective_ids)
  if (!objectiveIds) return c.json({ success: false, error: 'learning_objective_ids must contain unique non-empty strings' }, 400)
  if (!await objectiveIdsExist(c.env.DB, objectiveIds)) return c.json({ success: false, error: 'One or more learning objectives were not found' }, 400)
  const isFree = value.is_free === undefined ? 0 : strictBoolInt(value.is_free)
  if (isFree === null) return c.json({ success: false, error: 'is_free must be a boolean' }, 400)
  const seriesId = optionalNullableString(value.series_id)
  const episodeId = optionalNullableString(value.episode_id)
  if (seriesId === undefined || episodeId === undefined) return c.json({ success: false, error: 'Invalid series_id or episode_id' }, 400)
  const referenceError = await projectReferenceError(c.env.DB, seriesId, episodeId)
  if (referenceError) return c.json({ success: false, error: referenceError }, 400)
  let estimatedMinutes: number | null = null
  if (value.estimated_minutes !== undefined && value.estimated_minutes !== null && value.estimated_minutes !== '') {
    estimatedMinutes = integer(value.estimated_minutes)
    if (estimatedMinutes === null || estimatedMinutes < 1) return c.json({ success: false, error: 'estimated_minutes must be a positive integer or null' }, 400)
  }
  if (isReleaseStatus(status)) {
    const gate = projectPublishError(materials, steps)
    if (gate) return c.json({ success: false, error: gate }, 400)
    const islamic = await islamicReleaseError(c.env.DB, seriesId)
    if (islamic) return c.json({ success: false, error: islamic }, 400)
  }
  const id = crypto.randomUUID()
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO projects (id, title_ar, description_ar, age_min, age_max, supervision_level, safety_notes, materials, steps, learning_objective_ids, cover_url, is_free, status, series_id, episode_id, estimated_minutes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(id, titleAr, description, ageMin, ageMax, supervision, safetyNotes, materials, steps, JSON.stringify(objectiveIds), coverUrl, isFree, status, seriesId, episodeId, estimatedMinutes),
      audit(c.env.DB, c, 'create', 'project', id, { title_ar: titleAr, status, series_id: seriesId, episode_id: episodeId }),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Project values conflict with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, status } }, 201)
})

route.patch('/projects/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const id = pathParam(c, 'id')
  const existing = await queryFirst<Row>(c.env.DB, 'SELECT * FROM projects WHERE id = ?', [id])
  if (!existing) return c.json({ success: false, error: 'Project not found' }, 404)
  const ageMin = value.age_min === undefined ? Number(existing.age_min) : integer(value.age_min)
  const ageMax = value.age_max === undefined ? Number(existing.age_max) : integer(value.age_max)
  if (!isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'Age range must be within 3-12' }, 400)

  const sets: string[] = []
  const params: unknown[] = []
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue) }
  if (value.title_ar !== undefined) {
    const title = stringValue(value.title_ar)
    if (!title) return c.json({ success: false, error: 'title_ar cannot be empty' }, 400)
    add('title_ar', title)
  }
  for (const field of ['description_ar', 'safety_notes', 'cover_url']) {
    if (value[field] === undefined) continue
    const parsed = nullableString(value[field])
    if (parsed === undefined) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  if (value.supervision_level !== undefined) {
    const supervision = stringValue(value.supervision_level)
    if (!supervision || !SUPERVISION_LEVELS.includes(supervision)) return c.json({ success: false, error: 'Invalid supervision_level' }, 400)
    add('supervision_level', supervision)
  }
  if (value.status !== undefined) {
    const status = stringValue(value.status)
    if (!status || !CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)
    add('status', status)
  }
  for (const field of ['materials', 'steps']) {
    if (value[field] === undefined) continue
    const parsed = jsonArray(value[field])
    if (!parsed) return c.json({ success: false, error: `${field} must be an array` }, 400)
    add(field, parsed)
  }
  if (value.learning_objective_ids !== undefined) {
    const objectiveIds = uniqueStringArray(value.learning_objective_ids)
    if (!objectiveIds) return c.json({ success: false, error: 'learning_objective_ids must contain unique non-empty strings' }, 400)
    if (!await objectiveIdsExist(c.env.DB, objectiveIds)) return c.json({ success: false, error: 'One or more learning objectives were not found' }, 400)
    add('learning_objective_ids', JSON.stringify(objectiveIds))
  }
  if (value.age_min !== undefined) add('age_min', ageMin)
  if (value.age_max !== undefined) add('age_max', ageMax)
  if (value.is_free !== undefined) {
    const isFree = strictBoolInt(value.is_free)
    if (isFree === null) return c.json({ success: false, error: 'is_free must be a boolean' }, 400)
    add('is_free', isFree)
  }
  // Migration 0018 links a project to the episode it accompanies.
  const finalSeriesId = value.series_id === undefined
    ? (existing.series_id == null ? null : String(existing.series_id))
    : nullableString(value.series_id)
  const finalEpisodeId = value.episode_id === undefined
    ? (existing.episode_id == null ? null : String(existing.episode_id))
    : nullableString(value.episode_id)
  if (finalSeriesId === undefined || finalEpisodeId === undefined) return c.json({ success: false, error: 'Invalid series_id or episode_id' }, 400)
  if (value.series_id !== undefined || value.episode_id !== undefined) {
    const referenceError = await projectReferenceError(c.env.DB, finalSeriesId, finalEpisodeId)
    if (referenceError) return c.json({ success: false, error: referenceError }, 400)
    if (value.series_id !== undefined) add('series_id', finalSeriesId)
    if (value.episode_id !== undefined) add('episode_id', finalEpisodeId)
  }
  if (value.estimated_minutes !== undefined) {
    if (value.estimated_minutes === null || value.estimated_minutes === '') add('estimated_minutes', null)
    else {
      const minutes = integer(value.estimated_minutes)
      if (minutes === null || minutes < 1) return c.json({ success: false, error: 'estimated_minutes must be a positive integer or null' }, 400)
      add('estimated_minutes', minutes)
    }
  }
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)
  const finalStatus = value.status === undefined ? String(existing.status) : stringValue(value.status)
  if (isReleaseStatus(finalStatus)) {
    const gate = projectPublishError(
      value.materials === undefined ? existing.materials : value.materials,
      value.steps === undefined ? existing.steps : value.steps,
    )
    if (gate) return c.json({ success: false, error: gate }, 400)
    const islamic = await islamicReleaseError(c.env.DB, finalSeriesId)
    if (islamic) return c.json({ success: false, error: islamic }, 400)
  }
  sets.push(`updated_at = datetime('now')`)
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(c.env.DB, c, 'update', 'project', id, value),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Project values conflict with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, updated: true } })
})

route.delete('/projects/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM projects WHERE id = ?', [id])) return c.json({ success: false, error: 'Project not found' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE projects SET status = 'archived', updated_at = datetime('now') WHERE id = ?`).bind(id),
    audit(c.env.DB, c, 'archive', 'project', id, {}),
  ])
  return c.json({ success: true, data: { id, status: 'archived' } })
})

// Stories and comics --------------------------------------------------------
route.get('/stories', async (c) => {
  const clauses: string[] = []
  const params: unknown[] = []
  const query = c.req.query('q')?.trim()
  const status = c.req.query('status')
  const type = c.req.query('type')
  const seriesId = c.req.query('series_id')
  const planet = c.req.query('planet')
  if (query) { clauses.push('(st.title_ar LIKE ? OR st.title_en LIKE ? OR st.slug LIKE ?)'); params.push(`%${query}%`, `%${query}%`, `%${query}%`) }
  if (status && status !== 'all') { if (!CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400); clauses.push('st.status = ?'); params.push(status) }
  if (!status) clauses.push(`st.status <> 'archived'`)
  if (type) { if (!STORY_TYPES.includes(type)) return c.json({ success: false, error: 'Invalid story type' }, 400); clauses.push('st.type = ?'); params.push(type) }
  if (seriesId) { clauses.push('st.series_id = ?'); params.push(seriesId) }
  // A story reaches its planet through its series only; `stories` has no planet
  // column. Without this the planet workspace's "12 stories" counter could only
  // open every story in Majarra, which reads as a broken link rather than a filter.
  if (planet) { clauses.push('st.series_id IN (SELECT s2.id FROM series s2 WHERE s2.planet_id = ?)'); params.push(planet) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const totalRow = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM stories st ${where}`, params)
  const rows = await queryAll<Row>(c.env.DB, `
    SELECT st.*, s.title_ar AS series_title, vs.name_ar AS visual_style_name,
      (SELECT COUNT(*) FROM story_pages sp WHERE sp.story_id = st.id) AS pages_count,
      (SELECT al.asset_id FROM asset_links al WHERE al.entity_type = 'story' AND al.entity_id = st.id AND al.role = 'cover' ORDER BY al.created_at DESC LIMIT 1) AS cover_asset_id
    FROM stories st
    LEFT JOIN series s ON s.id = st.series_id
    LEFT JOIN visual_styles vs ON vs.id = st.visual_style_id
    ${where}
    ORDER BY st.sort_order, st.updated_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])
  return c.json({ success: true, data: rows.map(serializeStory), meta: { total: Number(totalRow?.total ?? 0), limit, offset } })
})

route.get('/stories/:id', async (c) => {
  const id = pathParam(c, 'id')
  const story = await queryFirst<Row>(c.env.DB, `
    SELECT st.*, s.title_ar AS series_title, vs.name_ar AS visual_style_name
    FROM stories st
    LEFT JOIN series s ON s.id = st.series_id
    LEFT JOIN visual_styles vs ON vs.id = st.visual_style_id
    WHERE st.id = ?
  `, [id])
  if (!story) return c.json({ success: false, error: 'Story not found' }, 404)
  const [pages, localizations, bubbles, assets] = await Promise.all([
    queryAll<Row>(c.env.DB, 'SELECT * FROM story_pages WHERE story_id = ? ORDER BY page_number', [id]),
    queryAll<Row>(c.env.DB, `SELECT spl.* FROM story_page_localizations spl JOIN story_pages sp ON sp.id = spl.page_id WHERE sp.story_id = ? ORDER BY sp.page_number, spl.language`, [id]),
    queryAll<Row>(c.env.DB, `SELECT sb.* FROM story_bubbles sb JOIN story_pages sp ON sp.id = sb.page_id WHERE sp.story_id = ? ORDER BY sp.page_number, sb.sort_order`, [id]),
    queryAll<Row>(c.env.DB, `SELECT ca.*, al.role, al.language AS link_language FROM asset_links al JOIN content_assets ca ON ca.id = al.asset_id WHERE al.entity_type = 'story' AND al.entity_id = ? ORDER BY al.sort_order, ca.created_at`, [id]),
  ])
  const enriched = pages.map((page) => ({
    ...page,
    localizations: localizations.filter((item) => item.page_id === page.id).map((item) => ({ ...item, timing_cues: parseJson(item.timing_cues, []) })),
    bubbles: bubbles.filter((item) => item.page_id === page.id).map((item) => ({ ...item, localized_text: parseJson(item.localized_text, {}), audio_tracks: parseJson(item.audio_tracks, {}) })),
  }))
  return c.json({ success: true, data: { ...serializeStory(story), pages: enriched, assets } })
})

route.post('/stories', requirePermission('create'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const titleAr = stringValue(value.title_ar)
  const type = stringValue(value.type) ?? 'picture_book'
  const ageMin = integer(value.age_min)
  const ageMax = integer(value.age_max)
  const status = stringValue(value.status) ?? 'draft'
  if (!titleAr || !isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'title_ar and an age range within 3-12 are required' }, 400)
  if (!STORY_TYPES.includes(type) || !CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid type or status' }, 400)
  const reading = stringValue(value.reading_level) ?? 'emerging'
  const interaction = stringValue(value.interaction_mode) ?? 'guided'
  const supervision = stringValue(value.supervision_level) ?? 'recommended'
  const tier = stringValue(value.price_tier) ?? 'family'
  if (!READING_LEVELS.includes(reading) || !INTERACTION_MODES.includes(interaction) || !SUPERVISION_LEVELS.includes(supervision) || !PRICE_TIERS.includes(tier)) return c.json({ success: false, error: 'Invalid experience metadata' }, 400)
  const languages = value.languages === undefined ? '["ar"]' : jsonArray(value.languages)
  if (!languages) return c.json({ success: false, error: 'languages must be an array' }, 400)
  // A story is created before its pages exist, so it can never satisfy the
  // release gate at creation time. Refuse rather than write an unpublishable
  // 'published' row that the PATCH gate would then never re-check.
  if (isReleaseStatus(status)) {
    return c.json({ success: false, error: 'A new story has no pages yet. Create it as a draft, add pages with text, then change the status.' }, 400)
  }
  const id = crypto.randomUUID()
  const slug = stringValue(value.slug) ?? slugify(titleAr, 'story')
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO stories (id, series_id, season_id, slug, title_ar, title_en, description_ar, description_en, type, age_min, age_max, reading_level, interaction_mode, supervision_level, visual_style_id, default_language, languages, status, is_free, price_tier, safety_notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, nullableString(value.series_id) ?? null, nullableString(value.season_id) ?? null, slug, titleAr, nullableString(value.title_en) ?? null, nullableString(value.description_ar) ?? null, nullableString(value.description_en) ?? null, type, ageMin, ageMax, reading, interaction, supervision, nullableString(value.visual_style_id) ?? null, stringValue(value.default_language) ?? 'ar', languages, status, boolInt(value.is_free), tier, nullableString(value.safety_notes) ?? null, integer(value.sort_order) ?? 0),
      audit(c.env.DB, c, 'create', 'story', id, { title_ar: titleAr, type, status }),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Story slug or relations conflict with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, slug, status } }, 201)
})

/// Release gate for a story. The page-count and per-page text rules live in
/// lib/catalogueValidation.ts (storyPublishError) so they are unit tested; the
/// artwork rules stay here because they need the content_assets table.
async function publicationReadiness(db: D1Database, storyId: string) {
  const story = await queryFirst<{ type: string; default_language: string; series_id: string | null }>(db, 'SELECT type, default_language, series_id FROM stories WHERE id = ?', [storyId])
  if (!story) return 'Story not found'

  const pages = await queryAll<{ id: string; page_number: number; image_asset_id: string | null }>(db, 'SELECT id, page_number, image_asset_id FROM story_pages WHERE story_id = ? ORDER BY page_number', [storyId])
  const localizations = pages.length
    ? await queryAll<{ page_id: string; language: string; body_text: string | null; narration_asset_id: string | null }>(db, `
        SELECT spl.page_id, spl.language, spl.body_text, spl.narration_asset_id
        FROM story_page_localizations spl
        WHERE spl.page_id IN (SELECT id FROM story_pages WHERE story_id = ?)
      `, [storyId])
    : []

  const textError = storyPublishError(
    pages.map((page) => ({
      page_number: page.page_number,
      image_asset_id: page.image_asset_id,
      localizations: localizations.filter((item) => item.page_id === page.id),
    })),
    story.type,
    story.default_language,
  )
  if (textError) return textError

  const missingImage = pages.find((page) => !page.image_asset_id)
  if (missingImage) return `Every story page must have an image before release (page ${missingImage.page_number} has none)`

  const assetIds = pages.map((page) => String(page.image_asset_id))
  const placeholders = assetIds.map(() => '?').join(',')
  const readyRow = await queryFirst<{ total: number }>(db, `SELECT COUNT(*) AS total FROM content_assets WHERE id IN (${placeholders}) AND status = 'ready'`, assetIds)
  if (Number(readyRow?.total ?? 0) !== new Set(assetIds).size) {
    return 'All referenced page images must be ready before release'
  }

  return islamicReleaseError(db, story.series_id)
}

route.patch('/stories/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const id = pathParam(c, 'id')
  const existing = await queryFirst<Row>(c.env.DB, 'SELECT * FROM stories WHERE id = ?', [id])
  if (!existing) return c.json({ success: false, error: 'Story not found' }, 404)
  const nextStatus = value.status === undefined ? String(existing.status) : stringValue(value.status)
  if (!nextStatus || !CONTENT_STATUSES.includes(nextStatus)) return c.json({ success: false, error: 'Invalid status' }, 400)
  if (['ready', 'scheduled', 'published'].includes(nextStatus) && nextStatus !== existing.status) {
    const readinessError = await publicationReadiness(c.env.DB, id)
    if (readinessError) return c.json({ success: false, error: readinessError }, 409)
  }
  const ageMin = value.age_min === undefined ? Number(existing.age_min) : integer(value.age_min)
  const ageMax = value.age_max === undefined ? Number(existing.age_max) : integer(value.age_max)
  if (!isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'Age range must be within 3-12' }, 400)

  const sets: string[] = []
  const params: unknown[] = []
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue) }
  for (const field of ['title_ar', 'slug']) {
    if (value[field] === undefined) continue
    const parsed = stringValue(value[field])
    if (!parsed) return c.json({ success: false, error: `${field} cannot be empty` }, 400)
    add(field, parsed)
  }
  for (const field of ['series_id', 'season_id', 'title_en', 'description_ar', 'description_en', 'visual_style_id', 'safety_notes']) {
    if (value[field] === undefined) continue
    const parsed = nullableString(value[field])
    if (parsed === undefined) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  const enums: Array<[string, string[]]> = [['type', STORY_TYPES], ['reading_level', READING_LEVELS], ['interaction_mode', INTERACTION_MODES], ['supervision_level', SUPERVISION_LEVELS], ['price_tier', PRICE_TIERS]]
  for (const [field, allowed] of enums) {
    if (value[field] === undefined) continue
    const parsed = stringValue(value[field])
    if (!parsed || !allowed.includes(parsed)) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  if (value.default_language !== undefined) {
    const language = stringValue(value.default_language)
    if (!language || !validLanguage(language)) return c.json({ success: false, error: 'Invalid default_language' }, 400)
    add('default_language', language)
  }
  if (value.languages !== undefined) {
    const languages = jsonArray(value.languages)
    if (!languages) return c.json({ success: false, error: 'languages must be an array' }, 400)
    add('languages', languages)
  }
  if (value.age_min !== undefined) add('age_min', ageMin)
  if (value.age_max !== undefined) add('age_max', ageMax)
  if (value.is_free !== undefined) add('is_free', boolInt(value.is_free))
  if (value.sort_order !== undefined) {
    const order = integer(value.sort_order)
    if (order === null) return c.json({ success: false, error: 'sort_order must be an integer' }, 400)
    add('sort_order', order)
  }
  if (value.status !== undefined) {
    add('status', nextStatus)
    if (nextStatus === 'published' && !existing.published_at) add('published_at', new Date().toISOString())
  }
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)
  sets.push(`updated_at = datetime('now')`)
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE stories SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(c.env.DB, c, 'update', 'story', id, value),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Story values conflict with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, updated: true } })
})

route.delete('/stories/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM stories WHERE id = ?', [id])) return c.json({ success: false, error: 'Story not found' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE stories SET status = 'archived', updated_at = datetime('now') WHERE id = ?`).bind(id),
    audit(c.env.DB, c, 'archive', 'story', id, {}),
  ])
  return c.json({ success: true, data: { id, status: 'archived' } })
})

route.post('/stories/:id/pages', requirePermission('create'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const storyId = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, `SELECT id FROM stories WHERE id = ? AND status <> 'archived'`, [storyId])) return c.json({ success: false, error: 'Story not found' }, 404)
  const last = await queryFirst<{ maximum: number }>(c.env.DB, 'SELECT COALESCE(MAX(page_number), 0) AS maximum FROM story_pages WHERE story_id = ?', [storyId])
  const pageNumber = value.page_number === undefined ? Number(last?.maximum ?? 0) + 1 : integer(value.page_number)
  const layout = stringValue(value.layout) ?? 'full_bleed'
  if (pageNumber === null || pageNumber < 1 || !PAGE_LAYOUTS.includes(layout)) return c.json({ success: false, error: 'Invalid page_number or layout' }, 400)
  const id = crypto.randomUUID()
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO story_pages (id, story_id, page_number, layout, image_asset_id, background_asset_id, duration_ms, transition, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, storyId, pageNumber, layout, nullableString(value.image_asset_id) ?? null, nullableString(value.background_asset_id) ?? null, integer(value.duration_ms), stringValue(value.transition) ?? 'fade', integer(value.sort_order) ?? pageNumber),
      audit(c.env.DB, c, 'create', 'story_page', id, { story_id: storyId, page_number: pageNumber }),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Page number or asset reference conflicts with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, story_id: storyId, page_number: pageNumber } }, 201)
})

route.patch('/story-pages/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM story_pages WHERE id = ?', [id])) return c.json({ success: false, error: 'Story page not found' }, 404)
  const sets: string[] = []
  const params: unknown[] = []
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue) }
  if (value.page_number !== undefined) {
    const number = integer(value.page_number)
    if (number === null || number < 1) return c.json({ success: false, error: 'page_number must be positive' }, 400)
    add('page_number', number)
  }
  if (value.layout !== undefined) {
    const layout = stringValue(value.layout)
    if (!layout || !PAGE_LAYOUTS.includes(layout)) return c.json({ success: false, error: 'Invalid layout' }, 400)
    add('layout', layout)
  }
  for (const field of ['image_asset_id', 'background_asset_id']) {
    if (value[field] === undefined) continue
    const parsed = nullableString(value[field])
    if (parsed === undefined) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  if (value.duration_ms !== undefined) {
    if (value.duration_ms === null || value.duration_ms === '') add('duration_ms', null)
    else {
      const duration = integer(value.duration_ms)
      if (duration === null || duration < 1) return c.json({ success: false, error: 'duration_ms must be positive' }, 400)
      add('duration_ms', duration)
    }
  }
  if (value.transition !== undefined) {
    const transition = stringValue(value.transition)
    if (!transition) return c.json({ success: false, error: 'transition cannot be empty' }, 400)
    add('transition', transition)
  }
  if (value.sort_order !== undefined) {
    const order = integer(value.sort_order)
    if (order === null) return c.json({ success: false, error: 'sort_order must be an integer' }, 400)
    add('sort_order', order)
  }
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)
  sets.push(`updated_at = datetime('now')`)
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE story_pages SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(c.env.DB, c, 'update', 'story_page', id, value),
    ])
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Page values conflict with existing data' }, 409)
    throw error
  }
  return c.json({ success: true, data: { id, updated: true } })
})

route.delete('/story-pages/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM story_pages WHERE id = ?', [id])) return c.json({ success: false, error: 'Story page not found' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM story_pages WHERE id = ?').bind(id),
    audit(c.env.DB, c, 'delete', 'story_page', id, {}),
  ])
  return c.json({ success: true, data: { id, deleted: true } })
})

route.put('/story-pages/:id/localizations/:language', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const pageId = pathParam(c, 'id')
  const language = pathParam(c, 'language')
  if (!validLanguage(language)) return c.json({ success: false, error: 'Invalid language code' }, 400)
  if (!await queryFirst(c.env.DB, 'SELECT id FROM story_pages WHERE id = ?', [pageId])) return c.json({ success: false, error: 'Story page not found' }, 404)
  const cues = value.timing_cues === undefined ? '[]' : jsonArray(value.timing_cues)
  if (!cues) return c.json({ success: false, error: 'timing_cues must be an array' }, 400)
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO story_page_localizations (page_id, language, body_text, alt_text, narration_asset_id, timing_cues)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(page_id, language) DO UPDATE SET
        body_text = excluded.body_text,
        alt_text = excluded.alt_text,
        narration_asset_id = excluded.narration_asset_id,
        timing_cues = excluded.timing_cues,
        updated_at = datetime('now')
    `).bind(pageId, language, nullableString(value.body_text) ?? null, nullableString(value.alt_text) ?? null, nullableString(value.narration_asset_id) ?? null, cues),
    audit(c.env.DB, c, 'upsert_localization', 'story_page', pageId, { language }),
  ])
  return c.json({ success: true, data: { page_id: pageId, language } })
})

route.post('/story-pages/:id/bubbles', requirePermission('create'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const pageId = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM story_pages WHERE id = ?', [pageId])) return c.json({ success: false, error: 'Story page not found' }, 404)
  const kind = stringValue(value.kind) ?? 'dialogue'
  if (!BUBBLE_KINDS.includes(kind)) return c.json({ success: false, error: 'Invalid bubble kind' }, 400)
  const x = finiteNumber(value.position_x) ?? 0
  const y = finiteNumber(value.position_y) ?? 0
  const width = finiteNumber(value.width) ?? 30
  const height = finiteNumber(value.height) ?? 20
  if (x < 0 || x > 100 || y < 0 || y > 100 || width <= 0 || width > 100 || height <= 0 || height > 100) return c.json({ success: false, error: 'Bubble geometry must use percentages between 0 and 100' }, 400)
  const localized = value.localized_text === undefined ? '{}' : jsonObject(value.localized_text)
  const audio = value.audio_tracks === undefined ? '{}' : jsonObject(value.audio_tracks)
  if (!localized || !audio) return c.json({ success: false, error: 'localized_text and audio_tracks must be objects' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO story_bubbles (id, page_id, character_id, kind, position_x, position_y, width, height, localized_text, audio_tracks, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, pageId, nullableString(value.character_id) ?? null, kind, x, y, width, height, localized, audio, integer(value.sort_order) ?? 0),
    audit(c.env.DB, c, 'create', 'story_bubble', id, { page_id: pageId, kind }),
  ])
  return c.json({ success: true, data: { id } }, 201)
})

route.patch('/story-bubbles/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await body(c)
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400)
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM story_bubbles WHERE id = ?', [id])) return c.json({ success: false, error: 'Story bubble not found' }, 404)
  const sets: string[] = []
  const params: unknown[] = []
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue) }
  if (value.character_id !== undefined) add('character_id', nullableString(value.character_id) ?? null)
  if (value.kind !== undefined) {
    const kind = stringValue(value.kind)
    if (!kind || !BUBBLE_KINDS.includes(kind)) return c.json({ success: false, error: 'Invalid bubble kind' }, 400)
    add('kind', kind)
  }
  for (const field of ['position_x', 'position_y', 'width', 'height']) {
    if (value[field] === undefined) continue
    const parsed = finiteNumber(value[field])
    if (parsed === null || parsed < 0 || parsed > 100 || ((field === 'width' || field === 'height') && parsed === 0)) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, parsed)
  }
  for (const field of ['localized_text', 'audio_tracks']) {
    if (value[field] === undefined) continue
    const parsed = jsonObject(value[field])
    if (!parsed) return c.json({ success: false, error: `${field} must be an object` }, 400)
    add(field, parsed)
  }
  if (value.sort_order !== undefined) {
    const order = integer(value.sort_order)
    if (order === null) return c.json({ success: false, error: 'sort_order must be an integer' }, 400)
    add('sort_order', order)
  }
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)
  sets.push(`updated_at = datetime('now')`)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE story_bubbles SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
    audit(c.env.DB, c, 'update', 'story_bubble', id, value),
  ])
  return c.json({ success: true, data: { id, updated: true } })
})

route.delete('/story-bubbles/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  if (!await queryFirst(c.env.DB, 'SELECT id FROM story_bubbles WHERE id = ?', [id])) return c.json({ success: false, error: 'Story bubble not found' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM story_bubbles WHERE id = ?').bind(id),
    audit(c.env.DB, c, 'delete', 'story_bubble', id, {}),
  ])
  return c.json({ success: true, data: { id, deleted: true } })
})

export default route
