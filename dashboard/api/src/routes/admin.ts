import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Env } from '../lib/db'
import { pathParam } from '../lib/routeParams.ts'
import { queryAll, queryFirst } from '../lib/db'
import { applyArtworkUrl, artworkSelect, publicAssetBaseUrl, SERIES_COVER_ROLES, EPISODE_THUMBNAIL_ROLES } from '../lib/assetUrls'
import { bumpPublicContentCacheVersion } from '../lib/publicCache'
import adminAssetsRoute from './adminAssets'
import adminCatalogueRoute from './adminCatalogue'
import adminContentRoute from './adminContent'
import adminFamilyProjectionRoute from './adminFamilyProjection'
import adminTeamsRoute from './adminTeams'
import adminAppExperienceRoute from './adminAppExperience'
import adminPlansRoute from './adminPlans'
import adminBackupRoute from './adminBackup'
import adminMasteryRoute from './adminMastery'
import adminTtsRoute from './adminTts'
import adminPublishGateRoute, { evaluateFor, gateRefusal } from './adminPublishGate.ts'
import adminAvailabilityRoute from './adminAvailability.ts'
import adminWorkflowRoute from './adminWorkflow.ts'
import adminSupportRoute from './adminSupport.ts'
import adminProductionRoute from './adminProduction.ts'
import adminDevicesRoute from './adminDevices.ts'
import adminCustomerRoute from './adminCustomer.ts'
import adminWebsiteRoute from './adminWebsite.ts'
import adminBlogRoute from './adminBlog.ts'
import adminSeoRoute from './adminSeo.ts'
import adminExecutiveRoute from './adminExecutive.ts'
import { summarizeGate } from '../lib/publishGate.ts'
import { validateIslamicFields } from '../lib/islamicContent'
import { actorId, auditStatement } from '../lib/auditLog'
import { requireAdmin, requirePermission } from '../lib/adminAuth'
import { parseTrackIds } from '../lib/catalogueValidation'

type AppEnv = { Bindings: Env }
type DbRow = Record<string, unknown>
type JsonRecord = Record<string, unknown>
type AgeTrack = 'preschool' | 'kids' | 'junior'

const adminRoute = new Hono<AppEnv>()

const TRACKS: AgeTrack[] = ['preschool', 'kids', 'junior']
const SERIES_TYPES = ['continuous', 'anthology', 'knowledge', 'presenter', 'standalone']
const CONTENT_STATUSES = ['draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published', 'archived']
const READING_LEVELS = ['pre_reader', 'emerging', 'independent']
const INTERACTION_MODES = ['tap', 'guided', 'mixed', 'independent']
const SUPERVISION_LEVELS = ['none', 'recommended', 'required']
const PRODUCTION_LEVELS = ['motion_story', 'limited_2d', 'full_2d', 'live', 'stylized_3d']
const DIFFICULTIES = ['easy', 'medium', 'hard']
const PLANS = ['free', 'family', 'family_plus']

/// The religious-review gate lives in lib/islamicContent.ts so it can be unit
/// tested. It previously compared planet_id against 'iman' while the seeded ID
/// is 'islamic', which silently disabled the gate for all real Islamic content.

/// الحرس نفسه المستخدم في كل مسارات الإدارة، من lib/adminAuth.ts.
///
/// كان هذا الملف يكرّر منطق التحقق من المفتاح المشترك بدل استيراده، فوُجدت
/// نسختان من فحص المصادقة. الآن نسخة واحدة تقبل جلسة مستخدم حقيقية وتُسقط
/// المفتاح المشترك بعد بذر أول مستخدم.
adminRoute.use('*', requireAdmin)

adminRoute.use('*', async (c, next) => {
  await next()

  // Public catalog pages are cached at the edge. Any successful CMS write
  // rotates their cache namespace without ever caching private admin data.
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method) && c.res.status < 400) {
    await bumpPublicContentCacheVersion(c.env.CACHE)
  }
})

// CMS modules and the read-only FamilyDO projection share this route's
// authentication middleware. Projection routes are registered before the
// legacy D1 family handlers below and therefore remain the authoritative admin
// read path while mutations fail closed.
adminRoute.route('/', adminContentRoute)
// Catalogue rows that had no HTTP surface at all: learning objectives and their
// track rows, skills, content reviews, story-page reads and the cascading story
// purge. Mounted after adminContent so nothing here shadows an existing handler.
adminRoute.route('/', adminCatalogueRoute)
adminRoute.route('/', adminAssetsRoute)
adminRoute.route('/', adminFamilyProjectionRoute)
adminRoute.route('/', adminTeamsRoute)
adminRoute.route('/', adminAppExperienceRoute)
adminRoute.route('/', adminPlansRoute)
adminRoute.route('/', adminBackupRoute)
// الإتقان والمحاولات: mastery و attempts كانا بلا أي مسار مخصَّص، والقراءة
// الوحيدة لهما كانت تجميعًا واحدًا داخل /analytics/overview.
adminRoute.route('/', adminMasteryRoute)
// Narration generation. Mounted last so it cannot shadow any existing handler.
adminRoute.route('/', adminTtsRoute)
// جاهزية النشر الموحّدة: مسار قراءة واحد لكل الأنواع القابلة للنشر، تستدعيه
// الواجهة قبل زرّ النشر، وتستدعيه عمليات النشر نفسها عبر evaluateFor.
adminRoute.route('/', adminPublishGateRoute)
// سياسة الإتاحة الجغرافية: قراءة السلسلة الكاملة (موروثة أم مُلغاة) وكتابتها.
adminRoute.route('/', adminAvailabilityRoute)
// محرك سير العمل: مراحل وتعيينات وقرارات وSLA.
//
// مركّب بعد adminTeams الذي يحمل `GET /workflows/runs` (القائمة) و
// `POST /workflows/runs/:id/review` (سجل القرار القديم). لا تعارض: مسارات هذا
// المحرك أخصّ (templates/overdue/my-stages و/stages/:key/decision)، وسجل
// القرارات القديم يبقى عاملًا بلا كسر.
adminRoute.route('/', adminWorkflowRoute)
// مركز الدعم: التذاكر وخطها الزمني وSLA والوسوم والعروض المحفوظة. مركّب بعد
// adminAppExperience الذي يحمل `/support/family/:id`، ومساراته لا تتقاطع معه.
adminRoute.route('/', adminSupportRoute)
// مركز الإنتاج: مصفوفة متطلبات لكل عنصر، مشتقّة من الأصول نفسها، وطبقة إسناد
// بشرية مخزَّنة. مركّب بعد بوابة النشر لأنه يستدعي تقييمها لصفّ «النشر».
adminRoute.route('/', adminProductionRoute)
// عمليات الأجهزة الإدارية: المسار المشغِّل إلى سلطة FamilyState. مسارات هذا
// المُوجِّه تحت /families/:id فلا تتقاطع مع /devices للقراءة من الإسقاط.
adminRoute.route('/', adminDevicesRoute)
// Customer 360: مساحة عمل العائلة. تُركِّب قراءة السلطة مع الإسقاطات وجداول
// الإدارة، ولا تنقل سلطة العائلة إلى D1.
adminRoute.route('/', adminCustomerRoute)
// CMS الموقع العام: صفحات وأقسام ومراجعات وجدولة ونشر. تغييرات التسويق الروتينية
// لا تحتاج نشر كود.
adminRoute.route('/', adminWebsiteRoute)
// المدونة وSEO. مركّبان بعد الموقع لأن كليهما يشترك معه في seo_meta والتحويلات.
adminRoute.route('/', adminBlogRoute)
adminRoute.route('/', adminSeoRoute)
// اللوحة التنفيذية: تجميعة واحدة على الجداول التشغيلية. مركّبة بعدها كلها لأنها
// تقرأ من جداولها جميعًا ولا تملك جدولًا خاصًّا بها.
adminRoute.route('/', adminExecutiveRoute)

function parsePagination(limitValue?: string, offsetValue?: string) {
  const parsedLimit = Number.parseInt(limitValue ?? '20', 10)
  const parsedOffset = Number.parseInt(offsetValue ?? '0', 10)
  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  }
}

/// The JSON body of an admin request, or null when it is not a JSON object.
///
/// ## Why the parameter is typed this way
///
/// It used to read `Parameters<typeof adminRoute.post>[1] extends never ? never : any`, which
/// was an attempt to borrow Hono's handler context type and did not work: that overload's
/// parameter tuple has one element, so index 1 does not exist (TS2493). The conditional then
/// resolved through the `any` branch anyway, so the expression cost a compiler error and
/// bought nothing.
///
/// `Context` is the type it was reaching for. The three generics are left open because this
/// helper only ever touches `c.req.json()`, which is present on every context regardless of
/// bindings or path.
async function readBody(c: Context<any, any, any>): Promise<JsonRecord | null> {
  const value = await c.req.json().catch(() => null)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonRecord
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value === 'string') return value.trim() || null
  return undefined
}

function integer(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function asBooleanInteger(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return slug || `series-${crypto.randomUUID().slice(0, 8)}`
}

function isAgeRange(ageMin: number | null, ageMax: number | null): ageMin is number {
  return ageMin !== null && ageMax !== null && ageMin >= 3 && ageMax <= 12 && ageMax >= ageMin
}

function tracksForRange(ageMin: number, ageMax: number): AgeTrack[] {
  return TRACKS.filter((track) => {
    const bounds = track === 'preschool' ? [3, 5] : track === 'kids' ? [6, 8] : [9, 12]
    return ageMin <= bounds[1] && ageMax >= bounds[0]
  })
}

function normalizeTracks(value: unknown, ageMin: number, ageMax: number): AgeTrack[] | null {
  if (value === undefined) return tracksForRange(ageMin, ageMax)
  if (!Array.isArray(value)) return null

  const unique = [...new Set(value)]
  if (!unique.length || unique.some((track) => typeof track !== 'string' || !TRACKS.includes(track as AgeTrack))) {
    return null
  }

  const applicable = tracksForRange(ageMin, ageMax)
  if (unique.some((track) => !applicable.includes(track as AgeTrack))) return null
  return unique as AgeTrack[]
}

function deriveChildTrack(birthMonth: number, birthYear: number, reference = new Date()): { age: number; track: AgeTrack } | null {
  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) return null

  const currentYear = reference.getUTCFullYear()
  const currentMonth = reference.getUTCMonth() + 1
  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) return null

  const age = currentYear - birthYear - (currentMonth < birthMonth ? 1 : 0)
  if (age >= 3 && age <= 5) return { age, track: 'preschool' }
  if (age >= 6 && age <= 8) return { age, track: 'kids' }
  if (age >= 9 && age <= 12) return { age, track: 'junior' }
  return null
}

function jsonArray(value: unknown): string | null {
  return Array.isArray(value) ? JSON.stringify(value) : null
}

function serializeSeries(row: DbRow) {
  return {
    ...row,
    track_ids: parseTrackIds(row.track_ids),
    is_free: Boolean(row.is_free),
  }
}

function serializeEpisode(row: DbRow) {
  return {
    ...row,
    track_ids: parseTrackIds(row.track_ids),
    is_free: Boolean(row.is_free),
    is_published: Boolean(row.is_published),
  }
}

function databaseError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isConstraintError(error: unknown): boolean {
  return /UNIQUE|constraint|FOREIGN KEY/i.test(databaseError(error))
}

// Dashboard -----------------------------------------------------------------
adminRoute.get('/dashboard/stats', async (c) => {
  const db = c.env.DB
  const totals = await queryFirst<DbRow>(db, `
    SELECT
      (SELECT COUNT(*) FROM series WHERE status <> 'archived') AS total_series,
      (SELECT COUNT(*) FROM series WHERE status = 'published') AS published_series,
      (SELECT COUNT(*) FROM episodes WHERE status <> 'archived') AS total_episodes,
      (SELECT COUNT(*) FROM episodes WHERE is_published = 1) AS published_episodes,
      (SELECT COUNT(*) FROM family_projection WHERE status = 'active') AS active_parents,
      (SELECT COUNT(*) FROM child_projection WHERE status = 'active') AS active_children
  `)

  const [trackRows, statusRows, planRows, recentSeries, recentActivity] = await Promise.all([
    queryAll<DbRow>(db, `
      SELECT st.track_id, COUNT(DISTINCT st.series_id) AS series_count
      FROM series_tracks st
      JOIN series s ON s.id = st.series_id
      WHERE s.status <> 'archived'
      GROUP BY st.track_id
      ORDER BY CASE st.track_id WHEN 'preschool' THEN 1 WHEN 'kids' THEN 2 ELSE 3 END
    `),
    queryAll<DbRow>(db, `
      SELECT status, COUNT(*) AS count
      FROM series
      GROUP BY status
      ORDER BY count DESC
    `),
    queryAll<DbRow>(db, `
      SELECT plan, COUNT(*) AS count
      FROM family_projection
      WHERE status = 'active'
      GROUP BY plan
    `),
    queryAll<DbRow>(db, `
      SELECT s.id, s.title_ar, s.status, s.age_min, s.age_max, s.updated_at,
        p.name_ar AS planet_name,
        (SELECT GROUP_CONCAT(track_id) FROM series_tracks WHERE series_id = s.id) AS track_ids,
        (SELECT COUNT(*) FROM episodes WHERE series_id = s.id AND status <> 'archived') AS episodes_count
      FROM series s
      LEFT JOIN planets p ON p.id = s.planet_id
      WHERE s.status <> 'archived'
      ORDER BY s.updated_at DESC, s.sort_order ASC
      LIMIT 5
    `),
    queryAll<DbRow>(db, `
      SELECT id, actor_id, action, entity_type, entity_id, details, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 6
    `),
  ])

  const trackCounts = Object.fromEntries(TRACKS.map((track) => [track, 0]))
  for (const row of trackRows) trackCounts[String(row.track_id)] = Number(row.series_count)

  return c.json({
    success: true,
    data: {
      totals: totals ?? {},
      series_by_track: trackCounts,
      series_by_status: statusRows,
      parents_by_plan: planRows,
      recent_series: recentSeries.map(serializeSeries),
      recent_activity: recentActivity,
      generated_at: new Date().toISOString(),
    },
  })
})

// Series --------------------------------------------------------------------
adminRoute.get('/series', async (c) => {
  const db = c.env.DB
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const query = c.req.query('q')?.trim()
  const track = c.req.query('track')
  const status = c.req.query('status')
  const planet = c.req.query('planet')
  const type = c.req.query('type')

  if (track && !TRACKS.includes(track as AgeTrack)) return c.json({ success: false, error: 'Invalid track' }, 400)
  if (status && status !== 'all' && !CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)
  if (type && !SERIES_TYPES.includes(type)) return c.json({ success: false, error: 'Invalid series type' }, 400)

  const clauses: string[] = []
  const params: unknown[] = []

  if (!status) clauses.push(`s.status <> 'archived'`)
  if (status && status !== 'all') { clauses.push('s.status = ?'); params.push(status) }
  if (query) {
    clauses.push('(s.title_ar LIKE ? OR s.title_en LIKE ? OR s.slug LIKE ?)')
    const pattern = `%${query}%`
    params.push(pattern, pattern, pattern)
  }
  if (track) {
    clauses.push('EXISTS (SELECT 1 FROM series_tracks sf WHERE sf.series_id = s.id AND sf.track_id = ?)')
    params.push(track)
  }
  if (planet) { clauses.push('s.planet_id = ?'); params.push(planet) }
  if (type) { clauses.push('s.type = ?'); params.push(type) }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const totalRow = await queryFirst<{ total: number }>(db, `SELECT COUNT(*) AS total FROM series s ${where}`, params)
  const baseUrl = publicAssetBaseUrl(c.env)
  const rows = await queryAll<DbRow>(db, `
    SELECT s.*, p.name_ar AS planet_name, p.color_hex AS planet_color,
      (SELECT GROUP_CONCAT(track_id) FROM series_tracks WHERE series_id = s.id) AS track_ids,
      (SELECT COUNT(*) FROM seasons WHERE series_id = s.id) AS seasons_count,
      (SELECT COUNT(*) FROM episodes WHERE series_id = s.id AND status <> 'archived') AS episodes_count,
      ${artworkSelect('cover_asset', 'series', 's.id', SERIES_COVER_ROLES)}
    FROM series s
    LEFT JOIN planets p ON p.id = s.planet_id
    ${where}
    ORDER BY s.sort_order ASC, s.updated_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])
  // cover_url resolves through asset_links (see lib/assetUrls.ts), matching the
  // public /series endpoint. The admin list used to return the deprecated
  // series.cover_url column as-is, which is null for every series whose poster
  // was attached the normal way (through asset_links), so the admin table
  // fell back to a plain letter avatar even for series with a real poster.
  for (const row of rows) applyArtworkUrl(row, 'cover_asset', 'cover_url', baseUrl)

  return c.json({ success: true, data: rows.map(serializeSeries), meta: { total: Number(totalRow?.total ?? 0), limit, offset } })
})

adminRoute.get('/series/:id', async (c) => {
  const db = c.env.DB
  const id = pathParam(c, 'id')
  const baseUrl = publicAssetBaseUrl(c.env)
  const row = await queryFirst<DbRow>(db, `
    SELECT s.*, p.name_ar AS planet_name,
      (SELECT GROUP_CONCAT(track_id) FROM series_tracks WHERE series_id = s.id) AS track_ids,
      (SELECT COUNT(*) FROM episodes WHERE series_id = s.id AND status <> 'archived') AS episodes_count,
      ${artworkSelect('cover_asset', 'series', 's.id', SERIES_COVER_ROLES)}
    FROM series s
    LEFT JOIN planets p ON p.id = s.planet_id
    WHERE s.id = ?
  `, [id])

  if (!row) return c.json({ success: false, error: 'Series not found' }, 404)
  applyArtworkUrl(row, 'cover_asset', 'cover_url', baseUrl)

  const [seasons, characters] = await Promise.all([
    queryAll<DbRow>(db, 'SELECT * FROM seasons WHERE series_id = ? ORDER BY season_number', [id]),
    queryAll<DbRow>(db, 'SELECT * FROM characters WHERE series_id = ? ORDER BY created_at', [id]),
  ])
  const episodeIds = await queryAll<DbRow>(db, `
    SELECT e.*, ${artworkSelect('thumb_asset', 'episode', 'e.id', EPISODE_THUMBNAIL_ROLES)}
    FROM episodes e WHERE e.series_id = ? AND e.status <> 'archived'
    ORDER BY e.season_id, e.episode_number
  `, [id])
  for (const episode of episodeIds) applyArtworkUrl(episode, 'thumb_asset', 'thumbnail_url', baseUrl)

  return c.json({ success: true, data: { ...serializeSeries(row), seasons, characters, episodes: episodeIds.map(serializeEpisode) } })
})

adminRoute.post('/series', requirePermission('create'), async (c) => {
  const body = await readBody(c)
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)

  const titleAr = text(body.title_ar)
  const planetId = text(body.planet_id)
  const type = text(body.type)
  const ageMin = integer(body.age_min)
  const ageMax = integer(body.age_max)

  if (!titleAr || !planetId || !type) return c.json({ success: false, error: 'title_ar, planet_id and type are required' }, 400)
  if (!SERIES_TYPES.includes(type)) return c.json({ success: false, error: 'Invalid series type' }, 400)
  if (!isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'Age range must be within 3-12' }, 400)

  const trackIds = normalizeTracks(body.track_ids, ageMin, ageMax as number)
  if (!trackIds) return c.json({ success: false, error: 'track_ids do not match the age range' }, 400)

  const readingLevel = text(body.reading_level) ?? 'emerging'
  const interactionMode = text(body.interaction_mode) ?? 'guided'
  const supervisionLevel = text(body.supervision_level) ?? 'recommended'
  const productionLevel = text(body.production_level) ?? 'motion_story'
  const difficulty = text(body.difficulty) ?? 'easy'
  const status = text(body.status) ?? 'draft'
  const priceTier = text(body.price_tier) ?? 'family'

  if (!READING_LEVELS.includes(readingLevel) || !INTERACTION_MODES.includes(interactionMode) || !SUPERVISION_LEVELS.includes(supervisionLevel)) {
    return c.json({ success: false, error: 'Invalid experience metadata' }, 400)
  }
  if (!PRODUCTION_LEVELS.includes(productionLevel) || !DIFFICULTIES.includes(difficulty) || !CONTENT_STATUSES.includes(status) || !PLANS.includes(priceTier)) {
    return c.json({ success: false, error: 'Invalid production, status, difficulty or price tier' }, 400)
  }
  if (status === 'published') {
    return c.json({ success: false, error: 'Create the series in a non-published state, then use the publish operation' }, 400)
  }

  const db = c.env.DB
  const planetExists = await queryFirst<{ id: string }>(db, 'SELECT id FROM planets WHERE id = ? AND is_active = 1', [planetId])
  if (!planetExists) return c.json({ success: false, error: 'Planet not found' }, 400)

  const id = crypto.randomUUID()
  const slug = text(body.slug) ?? slugify(titleAr)
  const publishedAt = null

  const insert = db.prepare(`
    INSERT INTO series (
      id, title_ar, title_en, slug, planet_id, type, age_min, age_max,
      reading_level, interaction_mode, supervision_level, cover_url, description_ar,
      visual_style, visual_style_id, difficulty, production_level, status, is_free, price_tier,
      sort_order, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, titleAr, nullableText(body.title_en) ?? null, slug, planetId, type, ageMin, ageMax,
    readingLevel, interactionMode, supervisionLevel, nullableText(body.cover_url) ?? null,
    nullableText(body.description_ar) ?? null, nullableText(body.visual_style) ?? null,
    nullableText(body.visual_style_id) ?? null, difficulty, productionLevel, status, asBooleanInteger(body.is_free), priceTier,
    integer(body.sort_order) ?? 0, publishedAt,
  )

  const statements = [
    insert,
    ...trackIds.map((track) => db.prepare('INSERT INTO series_tracks (series_id, track_id) VALUES (?, ?)').bind(id, track)),
    auditStatement(db, actorId(c), 'create', 'series', id, { title_ar: titleAr, status, track_ids: trackIds }),
  ]

  try {
    await db.batch(statements)
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Series slug or values conflict with existing data' }, 409)
    throw error
  }

  return c.json({ success: true, data: { id, slug, status, track_ids: trackIds } }, 201)
})

adminRoute.patch('/series/:id', requirePermission('edit_metadata'), async (c) => {
  const body = await readBody(c)
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)

  const db = c.env.DB
  const id = pathParam(c, 'id')
  const existing = await queryFirst<DbRow>(db, 'SELECT * FROM series WHERE id = ?', [id])
  if (!existing) return c.json({ success: false, error: 'Series not found' }, 404)
  if (text(body.status) === 'published') {
    return c.json({ success: false, error: 'Use the publish operation to publish a series' }, 400)
  }

  const ageMin = body.age_min === undefined ? Number(existing.age_min) : integer(body.age_min)
  const ageMax = body.age_max === undefined ? Number(existing.age_max) : integer(body.age_max)
  if (!isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'Age range must be within 3-12' }, 400)

  const ageChanged = body.age_min !== undefined || body.age_max !== undefined
  const updateTracks = body.track_ids !== undefined || ageChanged
  const trackIds = updateTracks ? normalizeTracks(body.track_ids, ageMin, ageMax as number) : null
  if (updateTracks && !trackIds) return c.json({ success: false, error: 'track_ids do not match the age range' }, 400)

  const sets: string[] = []
  const params: unknown[] = []
  const add = (column: string, value: unknown) => { sets.push(`${column} = ?`); params.push(value) }

  const requiredTextFields = ['title_ar', 'slug', 'planet_id', 'type', 'reading_level', 'interaction_mode', 'supervision_level', 'difficulty', 'production_level', 'status', 'price_tier']
  for (const field of requiredTextFields) {
    if (body[field] === undefined) continue
    const value = text(body[field])
    if (!value) return c.json({ success: false, error: `${field} cannot be empty` }, 400)
    add(field, value)
  }

  const finalType = text(body.type) ?? String(existing.type)
  const finalReading = text(body.reading_level) ?? String(existing.reading_level)
  const finalInteraction = text(body.interaction_mode) ?? String(existing.interaction_mode)
  const finalSupervision = text(body.supervision_level) ?? String(existing.supervision_level)
  const finalDifficulty = text(body.difficulty) ?? String(existing.difficulty)
  const finalProduction = text(body.production_level) ?? String(existing.production_level)
  const finalStatus = text(body.status) ?? String(existing.status)
  const finalPlan = text(body.price_tier) ?? String(existing.price_tier)

  if (!SERIES_TYPES.includes(finalType) || !READING_LEVELS.includes(finalReading) || !INTERACTION_MODES.includes(finalInteraction) || !SUPERVISION_LEVELS.includes(finalSupervision)) {
    return c.json({ success: false, error: 'Invalid series or experience metadata' }, 400)
  }
  if (!DIFFICULTIES.includes(finalDifficulty) || !PRODUCTION_LEVELS.includes(finalProduction) || !CONTENT_STATUSES.includes(finalStatus) || !PLANS.includes(finalPlan)) {
    return c.json({ success: false, error: 'Invalid production, status, difficulty or price tier' }, 400)
  }

  if (body.planet_id !== undefined) {
    const planet = await queryFirst<{ id: string }>(db, 'SELECT id FROM planets WHERE id = ? AND is_active = 1', [text(body.planet_id)])
    if (!planet) return c.json({ success: false, error: 'Planet not found' }, 400)
  }

  const nullableFields = ['title_en', 'cover_url', 'logo_url', 'trailer_url', 'description_ar', 'description_en', 'visual_style', 'visual_style_id', 'safety_notes', 'rights_owner', 'rights_expiry', 'bible_url']
  for (const field of nullableFields) {
    if (body[field] === undefined) continue
    const value = nullableText(body[field])
    if (value === undefined) return c.json({ success: false, error: `${field} must be text or null` }, 400)
    add(field, value)
  }

  if (body.age_min !== undefined) add('age_min', ageMin)
  if (body.age_max !== undefined) add('age_max', ageMax)
  if (body.sort_order !== undefined) {
    const value = integer(body.sort_order)
    if (value === null) return c.json({ success: false, error: 'sort_order must be an integer' }, 400)
    add('sort_order', value)
  }
  if (body.is_free !== undefined) add('is_free', asBooleanInteger(body.is_free))

  if (!sets.length && !updateTracks) return c.json({ success: false, error: 'No supported fields supplied' }, 400)

  const statements: D1PreparedStatement[] = []
  if (sets.length) {
    sets.push(`updated_at = datetime('now')`)
    statements.push(db.prepare(`UPDATE series SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id))
  }
  if (trackIds) {
    statements.push(db.prepare('DELETE FROM series_tracks WHERE series_id = ?').bind(id))
    statements.push(...trackIds.map((track) => db.prepare('INSERT INTO series_tracks (series_id, track_id) VALUES (?, ?)').bind(id, track)))
  }
  statements.push(auditStatement(db, actorId(c), 'update', 'series', id, body))

  try {
    await db.batch(statements)
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Series values conflict with existing data' }, 409)
    throw error
  }

  return c.json({ success: true, data: { id, updated: true } })
})

adminRoute.post('/series/:id/publish', requirePermission('publish'), async (c) => {
  const db = c.env.DB
  const id = pathParam(c, 'id')
  const existing = await queryFirst<{ status: string }>(db, 'SELECT status FROM series WHERE id = ?', [id])
  if (!existing) return c.json({ success: false, error: 'Series not found' }, 404)
  if (existing.status === 'archived') return c.json({ success: false, error: 'Archived series cannot be published' }, 409)
  if (existing.status === 'published') return c.json({ success: true, data: { id, status: 'published', published: false } })

  // The readiness gate, server-side.
  //
  // Publish authority separation answered *who* may publish. This answers whether
  // the content is finished, and it has to live here rather than in the UI: the
  // endpoint is reachable with curl, and a gate the client can skip is decoration.
  // Every blocker is returned at once — see lib/publishGate.ts for why one refusal
  // at a time is the behaviour this replaces.
  const gate = await evaluateFor(c.env, 'series', id)
  if (gate && !gate.publishable) {
    await auditStatement(db, actorId(c), 'publish_blocked', 'series', id, {
      previous_status: existing.status,
      blockers: gate.blockers.map((blocker) => blocker.id),
      summary: summarizeGate(gate),
    }).run()
    return c.json(gateRefusal(gate), 409)
  }

  await db.batch([
    db.prepare(`UPDATE series SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = datetime('now') WHERE id = ?`)
      .bind(new Date().toISOString(), id),
    // The warnings are recorded with the publish, not discarded. Six months later
    // "was this published knowing the French translation was missing?" is a real
    // question, and only the audit row can answer it.
    auditStatement(db, actorId(c), 'publish', 'series', id, {
      previous_status: existing.status,
      readiness: gate ? summarizeGate(gate) : 'not evaluated',
      warnings: gate?.warnings.map((warning) => warning.id) ?? [],
    }),
  ])
  return c.json({
    success: true,
    data: { id, status: 'published', published: true, warnings: gate?.warnings ?? [] },
  })
})

adminRoute.delete('/series/:id', requirePermission('archive'), async (c) => {
  const db = c.env.DB
  const id = pathParam(c, 'id')
  const exists = await queryFirst<{ id: string }>(db, 'SELECT id FROM series WHERE id = ?', [id])
  if (!exists) return c.json({ success: false, error: 'Series not found' }, 404)

  await db.batch([
    db.prepare(`UPDATE series SET status = 'archived', updated_at = datetime('now') WHERE id = ?`).bind(id),
    auditStatement(db, actorId(c), 'archive', 'series', id, {}),
  ])

  return c.json({ success: true, data: { id, status: 'archived' } })
})

// Episodes ------------------------------------------------------------------
adminRoute.get('/episodes', async (c) => {
  const db = c.env.DB
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'))
  const query = c.req.query('q')?.trim()
  const seriesId = c.req.query('series_id')
  const track = c.req.query('track')
  const status = c.req.query('status')

  if (track && !TRACKS.includes(track as AgeTrack)) return c.json({ success: false, error: 'Invalid track' }, 400)
  if (status && status !== 'all' && !CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)

  const clauses: string[] = []
  const params: unknown[] = []
  if (!status) clauses.push(`e.status <> 'archived'`)
  if (status && status !== 'all') { clauses.push('e.status = ?'); params.push(status) }
  if (query) { clauses.push('(e.title_ar LIKE ? OR e.description_ar LIKE ?)'); params.push(`%${query}%`, `%${query}%`) }
  if (seriesId) { clauses.push('e.series_id = ?'); params.push(seriesId) }
  if (track) {
    clauses.push('EXISTS (SELECT 1 FROM episode_tracks ef WHERE ef.episode_id = e.id AND ef.track_id = ?)')
    params.push(track)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const totalRow = await queryFirst<{ total: number }>(db, `SELECT COUNT(*) AS total FROM episodes e ${where}`, params)
  const baseUrl = publicAssetBaseUrl(c.env)
  const rows = await queryAll<DbRow>(db, `
    SELECT e.*, s.title_ar AS series_title,
      (SELECT GROUP_CONCAT(track_id) FROM episode_tracks WHERE episode_id = e.id) AS track_ids,
      lo.title_ar AS objective_title,
      ${artworkSelect('thumb_asset', 'episode', 'e.id', EPISODE_THUMBNAIL_ROLES)}
    FROM episodes e
    JOIN series s ON s.id = e.series_id
    LEFT JOIN learning_objectives lo ON lo.id = e.learning_objective_id
    ${where}
    ORDER BY e.updated_at DESC, e.episode_number ASC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])
  // thumbnail_url resolves through asset_links, mirroring the public /episodes
  // endpoint. Selecting episodes.thumbnail_url directly (the deprecated column)
  // returned null for every episode whose thumbnail was attached the normal
  // way, so the admin table always fell back to a static play-icon circle.
  for (const row of rows) applyArtworkUrl(row, 'thumb_asset', 'thumbnail_url', baseUrl)

  return c.json({ success: true, data: rows.map(serializeEpisode), meta: { total: Number(totalRow?.total ?? 0), limit, offset } })
})

adminRoute.get('/episodes/:id', async (c) => {
  const baseUrl = publicAssetBaseUrl(c.env)
  const row = await queryFirst<DbRow>(c.env.DB, `
    SELECT e.*, s.title_ar AS series_title,
      (SELECT GROUP_CONCAT(track_id) FROM episode_tracks WHERE episode_id = e.id) AS track_ids,
      lo.title_ar AS objective_title,
      ${artworkSelect('thumb_asset', 'episode', 'e.id', EPISODE_THUMBNAIL_ROLES)}
    FROM episodes e
    JOIN series s ON s.id = e.series_id
    LEFT JOIN learning_objectives lo ON lo.id = e.learning_objective_id
    WHERE e.id = ?
  `, [pathParam(c, 'id')])

  if (!row) return c.json({ success: false, error: 'Episode not found' }, 404)
  applyArtworkUrl(row, 'thumb_asset', 'thumbnail_url', baseUrl)
  return c.json({ success: true, data: serializeEpisode(row) })
})

adminRoute.post('/episodes', requirePermission('create'), async (c) => {
  const body = await readBody(c)
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)

  const titleAr = text(body.title_ar)
  const seriesId = text(body.series_id)
  if (!titleAr || !seriesId) return c.json({ success: false, error: 'title_ar and series_id are required' }, 400)

  const db = c.env.DB
  const series = await queryFirst<DbRow>(db, 'SELECT id, age_min, age_max FROM series WHERE id = ? AND status <> ?', [seriesId, 'archived'])
  if (!series) return c.json({ success: false, error: 'Series not found' }, 400)

  const ageMin = body.age_min === undefined ? Number(series.age_min) : integer(body.age_min)
  const ageMax = body.age_max === undefined ? Number(series.age_max) : integer(body.age_max)
  if (!isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'Age range must be within 3-12' }, 400)

  const trackIds = normalizeTracks(body.track_ids, ageMin, ageMax as number)
  if (!trackIds) return c.json({ success: false, error: 'track_ids do not match the age range' }, 400)

  const readingLevel = text(body.reading_level) ?? 'emerging'
  const interactionMode = text(body.interaction_mode) ?? 'guided'
  const supervisionLevel = text(body.supervision_level) ?? 'recommended'
  const difficulty = text(body.difficulty) ?? 'easy'
  const status = text(body.status) ?? 'draft'

  if (!READING_LEVELS.includes(readingLevel) || !INTERACTION_MODES.includes(interactionMode) || !SUPERVISION_LEVELS.includes(supervisionLevel) || !DIFFICULTIES.includes(difficulty) || !CONTENT_STATUSES.includes(status)) {
    return c.json({ success: false, error: 'Invalid episode metadata' }, 400)
  }
  if (status === 'published') {
    return c.json({ success: false, error: 'Create the episode in a non-published state, then use the publish operation' }, 400)
  }

  const id = crypto.randomUUID()
  const published = false
  const insert = db.prepare(`
    INSERT INTO episodes (
      id, series_id, season_id, episode_number, title_ar, description_ar,
      video_master_url, video_hls_1080, video_hls_480, thumbnail_url,
      duration_seconds, age_min, age_max, reading_level, interaction_mode,
      supervision_level, safety_notes, learning_objective_id, new_words, skills,
      mastery_criteria, parent_guide_ar, questions, family_activity_ar,
      difficulty, status, is_free, is_published, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, seriesId, nullableText(body.season_id) ?? null, integer(body.episode_number), titleAr,
    nullableText(body.description_ar) ?? null, nullableText(body.video_master_url) ?? null,
    nullableText(body.video_hls_1080) ?? null, nullableText(body.video_hls_480) ?? null,
    nullableText(body.thumbnail_url) ?? null, integer(body.duration_seconds), ageMin, ageMax,
    readingLevel, interactionMode, supervisionLevel, nullableText(body.safety_notes) ?? null,
    nullableText(body.learning_objective_id) ?? null, jsonArray(body.new_words) ?? '[]',
    jsonArray(body.skills) ?? '[]', nullableText(body.mastery_criteria) ?? null,
    nullableText(body.parent_guide_ar) ?? null, jsonArray(body.questions) ?? '[]',
    nullableText(body.family_activity_ar) ?? null, difficulty, status,
    asBooleanInteger(body.is_free), published ? 1 : 0, published ? new Date().toISOString() : null,
  )

  const statements = [
    insert,
    ...trackIds.map((track) => db.prepare('INSERT INTO episode_tracks (episode_id, track_id) VALUES (?, ?)').bind(id, track)),
    auditStatement(db, actorId(c), 'create', 'episode', id, { title_ar: titleAr, series_id: seriesId, status }),
  ]

  try {
    await db.batch(statements)
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Episode values conflict with existing data' }, 409)
    throw error
  }

  return c.json({ success: true, data: { id, status, track_ids: trackIds } }, 201)
})

adminRoute.patch('/episodes/:id', requirePermission('edit_metadata'), async (c) => {
  const body = await readBody(c)
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)

  const db = c.env.DB
  const id = pathParam(c, 'id')
  const existing = await queryFirst<DbRow>(db, 'SELECT * FROM episodes WHERE id = ?', [id])
  if (!existing) return c.json({ success: false, error: 'Episode not found' }, 404)
  if (text(body.status) === 'published') {
    return c.json({ success: false, error: 'Use the publish operation to publish an episode' }, 400)
  }

  const ageMin = body.age_min === undefined ? Number(existing.age_min) : integer(body.age_min)
  const ageMax = body.age_max === undefined ? Number(existing.age_max) : integer(body.age_max)
  if (!isAgeRange(ageMin, ageMax)) return c.json({ success: false, error: 'Age range must be within 3-12' }, 400)

  const ageChanged = body.age_min !== undefined || body.age_max !== undefined
  const updateTracks = body.track_ids !== undefined || ageChanged
  const trackIds = updateTracks ? normalizeTracks(body.track_ids, ageMin, ageMax as number) : null
  if (updateTracks && !trackIds) return c.json({ success: false, error: 'track_ids do not match the age range' }, 400)

  const sets: string[] = []
  const params: unknown[] = []
  const add = (column: string, value: unknown) => { sets.push(`${column} = ?`); params.push(value) }

  if (body.series_id !== undefined) {
    const seriesId = text(body.series_id)
    if (!seriesId) return c.json({ success: false, error: 'series_id cannot be empty' }, 400)
    const series = await queryFirst<{ id: string }>(db, 'SELECT id FROM series WHERE id = ? AND status <> ?', [seriesId, 'archived'])
    if (!series) return c.json({ success: false, error: 'Series not found' }, 400)
    add('series_id', seriesId)
  }

  if (body.title_ar !== undefined) {
    const value = text(body.title_ar)
    if (!value) return c.json({ success: false, error: 'title_ar cannot be empty' }, 400)
    add('title_ar', value)
  }

  const nullableFields = ['season_id', 'description_ar', 'video_master_url', 'video_hls_1080', 'video_hls_480', 'thumbnail_url', 'captions_ar_url', 'safety_notes', 'learning_objective_id', 'mastery_criteria', 'parent_guide_ar', 'linked_game_id', 'linked_book_id', 'printable_url', 'family_activity_ar']
  for (const field of nullableFields) {
    if (body[field] === undefined) continue
    const value = nullableText(body[field])
    if (value === undefined) return c.json({ success: false, error: `${field} must be text or null` }, 400)
    add(field, value)
  }

  const integerFields = ['episode_number', 'duration_seconds']
  for (const field of integerFields) {
    if (body[field] === undefined) continue
    if (body[field] === null) { add(field, null); continue }
    const value = integer(body[field])
    if (value === null || value <= 0) return c.json({ success: false, error: `${field} must be a positive integer or null` }, 400)
    add(field, value)
  }

  const enumFields: Array<[string, string[]]> = [
    ['reading_level', READING_LEVELS],
    ['interaction_mode', INTERACTION_MODES],
    ['supervision_level', SUPERVISION_LEVELS],
    ['difficulty', DIFFICULTIES],
  ]
  for (const [field, allowed] of enumFields) {
    if (body[field] === undefined) continue
    const value = text(body[field])
    if (!value || !allowed.includes(value)) return c.json({ success: false, error: `Invalid ${field}` }, 400)
    add(field, value)
  }

  const jsonFields = ['new_words', 'skills', 'prerequisites', 'questions', 'dubs']
  for (const field of jsonFields) {
    if (body[field] === undefined) continue
    const value = jsonArray(body[field])
    if (value === null) return c.json({ success: false, error: `${field} must be an array` }, 400)
    add(field, value)
  }

  if (body.age_min !== undefined) add('age_min', ageMin)
  if (body.age_max !== undefined) add('age_max', ageMax)
  if (body.is_free !== undefined) add('is_free', asBooleanInteger(body.is_free))
  if (body.status !== undefined) {
    const status = text(body.status)
    if (!status || !CONTENT_STATUSES.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)
    add('status', status)
    add('is_published', 0)
  }

  if (!sets.length && !updateTracks) return c.json({ success: false, error: 'No supported fields supplied' }, 400)

  const statements: D1PreparedStatement[] = []
  if (sets.length) {
    sets.push(`updated_at = datetime('now')`)
    statements.push(db.prepare(`UPDATE episodes SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id))
  }
  if (trackIds) {
    statements.push(db.prepare('DELETE FROM episode_tracks WHERE episode_id = ?').bind(id))
    statements.push(...trackIds.map((track) => db.prepare('INSERT INTO episode_tracks (episode_id, track_id) VALUES (?, ?)').bind(id, track)))
  }
  statements.push(auditStatement(db, actorId(c), 'update', 'episode', id, body))

  try {
    await db.batch(statements)
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Episode values conflict with existing data' }, 409)
    throw error
  }

  return c.json({ success: true, data: { id, updated: true } })
})

adminRoute.post('/episodes/:id/publish', requirePermission('publish'), async (c) => {
  const db = c.env.DB
  const id = pathParam(c, 'id')
  const existing = await queryFirst<{ status: string }>(db, 'SELECT status FROM episodes WHERE id = ?', [id])
  if (!existing) return c.json({ success: false, error: 'Episode not found' }, 404)
  if (existing.status === 'archived') return c.json({ success: false, error: 'Archived episode cannot be published' }, 409)
  if (existing.status === 'published') return c.json({ success: true, data: { id, status: 'published', published: false } })

  // Same gate as series, and for episodes it carries the checks that matter most:
  // an episode with no video file or no thumbnail is not a lesser episode, it is a
  // dead tile in a child's library.
  const gate = await evaluateFor(c.env, 'episode', id)
  if (gate && !gate.publishable) {
    await auditStatement(db, actorId(c), 'publish_blocked', 'episode', id, {
      previous_status: existing.status,
      blockers: gate.blockers.map((blocker) => blocker.id),
      summary: summarizeGate(gate),
    }).run()
    return c.json(gateRefusal(gate), 409)
  }

  await db.batch([
    db.prepare(`UPDATE episodes SET status = 'published', is_published = 1, published_at = COALESCE(published_at, ?), updated_at = datetime('now') WHERE id = ?`)
      .bind(new Date().toISOString(), id),
    auditStatement(db, actorId(c), 'publish', 'episode', id, {
      previous_status: existing.status,
      readiness: gate ? summarizeGate(gate) : 'not evaluated',
      warnings: gate?.warnings.map((warning) => warning.id) ?? [],
    }),
  ])
  return c.json({
    success: true,
    data: { id, status: 'published', published: true, warnings: gate?.warnings ?? [] },
  })
})

adminRoute.delete('/episodes/:id', requirePermission('archive'), async (c) => {
  const db = c.env.DB
  const id = pathParam(c, 'id')
  const exists = await queryFirst<{ id: string }>(db, 'SELECT id FROM episodes WHERE id = ?', [id])
  if (!exists) return c.json({ success: false, error: 'Episode not found' }, 404)

  await db.batch([
    db.prepare(`UPDATE episodes SET status = 'archived', is_published = 0, updated_at = datetime('now') WHERE id = ?`).bind(id),
    auditStatement(db, actorId(c), 'archive', 'episode', id, {}),
  ])

  return c.json({ success: true, data: { id, status: 'archived' } })
})

// Legacy D1 family handlers removed - ownership moved to FamilyState/IdentityState DO (2026-08)
// Use /api/v1/family/* (DO) and /admin/family-projection/* for reads.
// Keeping this file as no-op to avoid breaking wrangler bundling while migrations 0006/0007 tables remain as dead tables documented in 0010_cleanup.

export default adminRoute
