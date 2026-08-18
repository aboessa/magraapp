import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { callDurable, familyStub } from '../lib/doClient.ts'
import { auditActor, requireAdmin, requirePermission } from '../lib/adminAuth.ts'
import { actorId, auditStatement } from '../lib/auditLog.ts'
import { parsePagination, UNBOUNDED_LIST_PAGINATION } from '../lib/catalogueValidation.ts'
import { pathParam } from '../lib/routeParams.ts'
import type { AdminSessionUser } from '../lib/adminUsers.ts'
import {
  CONFIG_KEYS,
  HOME_BLOCK_TYPES,
  SYSTEM_BLOCK_TYPES,
  TARGETING_DIMENSIONS,
  homeContextFromQuery,
  isScheduleOpen,
  isSystemBlock,
  parseBlockConfig,
  parseTargeting,
  parseVersionEnvelope,
  resolveHomeBlocks,
  snapshotFromRow,
} from '../lib/homeExperience.ts'
import type {
  HomeBlockConfig, HomeBlockRow, HomeTargeting, HomeVersionEnvelope, ParseResult,
} from '../lib/homeExperience.ts'

type AppEnv = { Bindings: Env; Variables: { adminUser?: AdminSessionUser; adminIsLegacyKey?: boolean } }
const route = new Hono<AppEnv>()

/// حرس صريح لا ضمني.
///
/// كان هذا الملف بلا `use()`، فحمايته تعتمد على اتّساع وسيط adminRoute وترتيب
/// التركيب في admin.ts. مساراته تكشف بيانات العائلات والأجهزة والفوترة
/// (`/support/family/:id`)، فالاعتماد الضمني غير مقبول.
route.use('*', requireAdmin)

/// يفكّ تحليل عمود JSON مخزَّن، ويرجع للقيمة الافتراضية عند التلف.
///
/// `JSON.parse` المباشر يرمي على صف واحد فاسد فتسقط الاستجابة كلها. صفحة
/// إعدادات لا يجوز أن تتعطّل بسبب قيمة واحدة سيئة.
function parseJson(value: unknown, fallback: unknown) {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

/* ==================================================== Home Experience Builder
 *
 * The builder controls the logged-in child's Home screen: which rows exist, in
 * what order, under what titles, targeted at whom, scheduled when.
 *
 * ## What was wrong
 *
 * Every mutation here accepted whatever it was sent. `PATCH` wrote any
 * `sort_order`, any targeting shape and any config keys, and did not check that
 * the block existed — an unknown id returned 200 with `{ id }`, so the screen
 * reported a successful save of nothing. `POST` derived ids from
 * `Date.now()`, so two blocks created in the same millisecond collided on the
 * primary key. Nothing was audited, and "rollback" restored a snapshot that had
 * only ever captured `{id, block_type, title_ar}` — so it silently erased the
 * block's targeting and config while reporting success.
 *
 * Validation, ordering and resolution now live in `lib/homeExperience.ts`, shared
 * with the public `/home/resolved` endpoint so the preview below cannot disagree
 * with what a child actually receives.
 */

/// The columns every read of a block needs. `SELECT *` is avoided so a later
/// column cannot leak into a payload unnoticed.
const BLOCK_COLUMNS = `id, block_type, title_ar, sort_order, is_active, is_draft,
  scheduled_at, expires_at, version, targeting_json, config_json, created_at, updated_at`

/// Serializes a stored row for the builder, parsing the two JSON columns.
function blockPayload(row: Record<string, unknown>) {
  const targeting = parseTargeting(parseStored(row.targeting_json))
  const config = parseBlockConfig(parseStored(row.config_json))
  return {
    ...row,
    targeting: targeting.ok ? targeting.value : {},
    config: config.ok ? config.value : {},
    // Stated per row so the builder can disable the content picker on system
    // blocks instead of offering a choice the server will not honour.
    is_system: isSystemBlock(String(row.block_type), (config.ok ? config.value : {}) as Record<string, unknown>),
    /// True when the stored JSON does not survive validation. The builder shows
    /// this rather than silently presenting a normalized version of a row it
    /// would refuse to save back.
    targeting_invalid: !targeting.ok ? targeting.error : null,
    config_invalid: !config.ok ? config.error : null,
  }
}

function parseStored(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/// An ISO-8601 instant, or null. Returns undefined when the input is unusable.
function isoInstant(raw: unknown): string | null | undefined {
  if (raw === null || raw === '') return null
  if (typeof raw !== 'string') return undefined
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

/// Loads a block row or returns null.
async function loadBlock(env: Env, id: string) {
  return queryFirst<Record<string, unknown>>(
    env.DB, `SELECT ${BLOCK_COLUMNS} FROM home_experience_blocks WHERE id = ?`, [id],
  )
}

/**
 * A statement recording an immutable version row.
 *
 * Returned as a statement rather than executed so it can be batched with the
 * mutation it describes: a version that is written outside the batch can survive
 * a failed update, and a history that disagrees with the row is worse than none.
 */
function versionStatement(env: Env, envelope: HomeVersionEnvelope) {
  return env.DB.prepare(
    'INSERT INTO home_experience_versions (id, snapshot_json) VALUES (?, ?)',
  ).bind(crypto.randomUUID(), JSON.stringify(envelope))
}

route.get('/home-experience', async (c) => {
  const rows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT ${BLOCK_COLUMNS} FROM home_experience_blocks ORDER BY sort_order, id`,
  )
  return c.json({
    success: true,
    data: rows.map(blockPayload),
    meta: {
      // The builder renders its type picker from this rather than a hardcoded
      // list of its own, which is how it came to offer `continue_journey` and
      // `featured_series` — two types the table's CHECK constraint rejects, so
      // creating either failed with an opaque database error.
      block_types: HOME_BLOCK_TYPES,
      system_block_types: SYSTEM_BLOCK_TYPES,
      targeting_dimensions: TARGETING_DIMENSIONS,
      config_keys: CONFIG_KEYS,
    },
  })
})

/// Validates the writable fields shared by create and update.
function blockFields(body: Record<string, unknown>): ParseResult<{
  title_ar?: string | null
  sort_order?: number
  is_active?: number
  is_draft?: number
  scheduled_at?: string | null
  expires_at?: string | null
  targeting?: HomeTargeting
  config?: HomeBlockConfig
}> {
  const value: Record<string, unknown> = {}

  if (body.title_ar !== undefined) {
    if (body.title_ar === null) value.title_ar = null
    else if (typeof body.title_ar !== 'string' || body.title_ar.length > 200) {
      return { ok: false, error: 'title_ar must be a string of at most 200 characters' }
    } else value.title_ar = body.title_ar.trim()
  }
  if (body.sort_order !== undefined) {
    const order = Number(body.sort_order)
    if (!Number.isInteger(order) || order < 0 || order > 999) {
      return { ok: false, error: 'sort_order must be an integer between 0 and 999' }
    }
    value.sort_order = order
  }
  for (const key of ['is_active', 'is_draft'] as const) {
    if (body[key] === undefined) continue
    if (typeof body[key] !== 'boolean' && body[key] !== 0 && body[key] !== 1) {
      return { ok: false, error: `${key} must be a boolean` }
    }
    value[key] = body[key] === true || body[key] === 1 ? 1 : 0
  }
  for (const key of ['scheduled_at', 'expires_at'] as const) {
    if (body[key] === undefined) continue
    const instant = isoInstant(body[key])
    if (instant === undefined) return { ok: false, error: `${key} must be an ISO-8601 instant or null` }
    value[key] = instant
  }
  if (body.targeting !== undefined) {
    const parsed = parseTargeting(body.targeting)
    if (!parsed.ok) return parsed
    value.targeting = parsed.value
  }
  if (body.config !== undefined) {
    const parsed = parseBlockConfig(body.config)
    if (!parsed.ok) return parsed
    value.config = parsed.value
  }
  return { ok: true, value: value as never }
}

route.post('/home-experience', requirePermission('create'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)

  const blockType = typeof body.block_type === 'string' ? body.block_type : ''
  if (!(HOME_BLOCK_TYPES as readonly string[]).includes(blockType)) {
    // Checked here rather than left to the CHECK constraint so the operator gets
    // the list of valid types instead of "SQLITE_CONSTRAINT".
    return c.json({
      success: false,
      error: `block_type must be one of: ${HOME_BLOCK_TYPES.join(', ')}`,
    }, 400)
  }
  const fields = blockFields(body)
  if (!fields.ok) return c.json({ success: false, error: fields.error }, 400)

  const scheduledAt = fields.value.scheduled_at ?? null
  const expiresAt = fields.value.expires_at ?? null
  if (scheduledAt && expiresAt && expiresAt <= scheduledAt) {
    return c.json({ success: false, error: 'expires_at must be after scheduled_at' }, 400)
  }

  // `crypto.randomUUID()` rather than `block-${Date.now()}`: the timestamp form
  // collides on the primary key for two blocks created in the same millisecond,
  // which is reachable from a script or a double-submitted form.
  const id = crypto.randomUUID()
  const sortOrder = fields.value.sort_order ?? 99
  const isActive = fields.value.is_active ?? 1
  const isDraft = fields.value.is_draft ?? 0
  const targeting = fields.value.targeting ?? {}
  const config = fields.value.config ?? {}

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO home_experience_blocks
        (id, block_type, title_ar, sort_order, is_active, is_draft, scheduled_at, expires_at,
         version, targeting_json, config_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(
      id, blockType, fields.value.title_ar ?? null, sortOrder, isActive, isDraft,
      scheduledAt, expiresAt, JSON.stringify(targeting), JSON.stringify(config),
    ),
    versionStatement(c.env, {
      format: 'home_block_v1',
      block_id: id,
      action: 'create',
      actor_id: actorId(c),
      before: null,
      after: {
        block_id: id, block_type: blockType, title_ar: fields.value.title_ar ?? null,
        sort_order: sortOrder, is_active: isActive, is_draft: isDraft,
        scheduled_at: scheduledAt, expires_at: expiresAt, targeting, config,
      },
    }),
    auditStatement(c.env.DB, actorId(c), 'create', 'home_experience_block', id, { block_type: blockType }),
  ])
  const created = await loadBlock(c.env, id)
  return c.json({ success: true, data: created ? blockPayload(created) : { id } }, 201)
})

route.patch('/home-experience/:id', requirePermission('edit_metadata'), async (c) => {
  const id = pathParam(c, 'id')
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)

  // Existence is checked before anything is written. Without this the handler
  // returned 200 for an id that does not exist, so the builder reported a saved
  // change that never happened.
  const existing = await loadBlock(c.env, id)
  if (!existing) return c.json({ success: false, error: 'Block not found' }, 404)

  if (body.block_type !== undefined) {
    // The type decides how the client renders the row and which content source
    // feeds it. Changing it in place turns a saved editorial row into a different
    // block with the same history, so it is refused: delete and create instead.
    return c.json({
      success: false,
      error: 'block_type cannot be changed after creation; create a new block instead',
    }, 400)
  }
  const fields = blockFields(body)
  if (!fields.ok) return c.json({ success: false, error: fields.error }, 400)

  const before = snapshotFromRow(existing as unknown as HomeBlockRow)
  const merged = { ...before, ...fields.value }
  if (merged.scheduled_at && merged.expires_at && merged.expires_at <= merged.scheduled_at) {
    return c.json({ success: false, error: 'expires_at must be after scheduled_at' }, 400)
  }

  const sets: string[] = []
  const params: unknown[] = []
  const add = (column: string, value: unknown) => { sets.push(`${column} = ?`); params.push(value) }
  if (fields.value.title_ar !== undefined) add('title_ar', fields.value.title_ar)
  if (fields.value.sort_order !== undefined) add('sort_order', fields.value.sort_order)
  if (fields.value.is_active !== undefined) add('is_active', fields.value.is_active)
  if (fields.value.is_draft !== undefined) add('is_draft', fields.value.is_draft)
  if (fields.value.scheduled_at !== undefined) add('scheduled_at', fields.value.scheduled_at)
  if (fields.value.expires_at !== undefined) add('expires_at', fields.value.expires_at)
  if (fields.value.targeting !== undefined) add('targeting_json', JSON.stringify(fields.value.targeting))
  if (fields.value.config !== undefined) add('config_json', JSON.stringify(fields.value.config))
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400)

  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE home_experience_blocks
         SET ${sets.join(', ')}, version = version + 1, updated_at = datetime('now')
       WHERE id = ?
    `).bind(...params, id),
    versionStatement(c.env, {
      format: 'home_block_v1',
      block_id: id,
      action: 'update',
      actor_id: actorId(c),
      before,
      after: { ...merged, block_id: id },
    }),
    auditStatement(c.env.DB, actorId(c), 'update', 'home_experience_block', id,
      { fields: Object.keys(fields.value) }),
  ])
  const updated = await loadBlock(c.env, id)
  return c.json({ success: true, data: updated ? blockPayload(updated) : { id } })
})

/**
 * `GET /home-experience/:id/versions` — the real history.
 *
 * Returns only `home_block_v1` envelopes. Rows written by the previous
 * implementation held three fields and no actor, so they cannot be presented as
 * versions or rolled back to; they are counted in `meta.legacy_records` so the
 * screen can say that older history exists but is not usable, rather than
 * inventing entries.
 */
route.get('/home-experience/:id/versions', async (c) => {
  const id = pathParam(c, 'id')
  if (!await loadBlock(c.env, id)) return c.json({ success: false, error: 'Block not found' }, 404)

  const rows = await queryAll<{ id: string; snapshot_json: string; created_at: string }>(
    c.env.DB,
    `SELECT id, snapshot_json, created_at FROM home_experience_versions
      ORDER BY created_at DESC, id DESC LIMIT 200`,
  )
  let legacy = 0
  const versions = []
  for (const row of rows) {
    const envelope = parseVersionEnvelope(row.snapshot_json)
    if (!envelope) {
      // Legacy rows are keyed `ver-<block-id>-<timestamp>`, so they can be
      // attributed to a block even though their contents are unusable.
      if (row.id.startsWith(`ver-${id}`)) legacy += 1
      continue
    }
    if (envelope.block_id !== id) continue
    versions.push({
      id: row.id,
      created_at: row.created_at,
      action: envelope.action,
      actor_id: envelope.actor_id,
      /// Present so a screen can show what changed without a second request.
      before: envelope.before,
      after: envelope.after,
      /// A version can be restored only when it records a state to restore to.
      restorable: envelope.before !== null,
    })
  }
  return c.json({
    success: true,
    data: versions,
    meta: {
      total: versions.length,
      legacy_records: legacy,
      /// Stated in the payload so a client cannot present history as complete.
      note: legacy
        ? 'Older records exist from a previous implementation that did not capture targeting or config; they are not restorable.'
        : null,
    },
  })
})

/**
 * `POST /home-experience/:id/rollback` — restores a recorded state.
 *
 * Takes an explicit `version_id`. The previous handler took the most recent
 * snapshot matching a LIKE pattern, which meant an operator could not see or
 * choose what they were restoring, and the restore itself wrote
 * `snap.targeting || {}` from a snapshot that never contained targeting — so it
 * blanked the block.
 *
 * The rollback is itself recorded as a version, so it can be undone.
 */
route.post('/home-experience/:id/rollback', requirePermission('publish'), async (c) => {
  const id = pathParam(c, 'id')
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const versionId = typeof body?.version_id === 'string' ? body.version_id : ''
  if (!versionId) {
    return c.json({
      success: false,
      error: 'version_id is required; call GET /admin/home-experience/:id/versions to choose one',
    }, 400)
  }

  const current = await loadBlock(c.env, id)
  if (!current) return c.json({ success: false, error: 'Block not found' }, 404)

  const row = await queryFirst<{ snapshot_json: string }>(
    c.env.DB, 'SELECT snapshot_json FROM home_experience_versions WHERE id = ?', [versionId],
  )
  if (!row) return c.json({ success: false, error: 'Version not found' }, 404)
  const envelope = parseVersionEnvelope(row.snapshot_json)
  if (!envelope || envelope.block_id !== id) {
    return c.json({ success: false, error: 'That version does not describe this block' }, 400)
  }
  const target = envelope.before
  if (!target) {
    return c.json({
      success: false,
      error: 'That version records the creation of the block, so there is no earlier state to restore',
    }, 400)
  }

  const before = snapshotFromRow(current as unknown as HomeBlockRow)
  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE home_experience_blocks
         SET title_ar = ?, sort_order = ?, is_active = ?, is_draft = ?,
             scheduled_at = ?, expires_at = ?, targeting_json = ?, config_json = ?,
             version = version + 1, updated_at = datetime('now')
       WHERE id = ?
    `).bind(
      target.title_ar, target.sort_order, target.is_active, target.is_draft,
      target.scheduled_at, target.expires_at,
      JSON.stringify(target.targeting), JSON.stringify(target.config), id,
    ),
    versionStatement(c.env, {
      format: 'home_block_v1',
      block_id: id,
      action: 'rollback',
      actor_id: actorId(c),
      before,
      after: target,
    }),
    auditStatement(c.env.DB, actorId(c), 'update', 'home_experience_block', id,
      { rolled_back_to: versionId }),
  ])
  const restored = await loadBlock(c.env, id)
  return c.json({
    success: true,
    data: { block: restored ? blockPayload(restored) : { id }, restored_from: versionId },
  })
})

/**
 * `POST /home-experience/reorder` — sets the order of every block at once.
 *
 * The submitted list must be the complete set of block ids. A partial list was
 * previously accepted, and since it assigned indices from zero it produced
 * duplicate `sort_order` values against the blocks it omitted — leaving the final
 * order down to a database tie-break rather than the operator's intent.
 */
route.post('/home-experience/reorder', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const order = body?.order
  if (!Array.isArray(order) || order.some((id) => typeof id !== 'string' || !id)) {
    return c.json({ success: false, error: 'order must be an array of block ids' }, 400)
  }
  const ids = order as string[]
  if (new Set(ids).size !== ids.length) {
    return c.json({ success: false, error: 'order contains duplicate ids' }, 400)
  }

  const existing = await queryAll<{ id: string }>(
    c.env.DB, 'SELECT id FROM home_experience_blocks',
  )
  const known = new Set(existing.map((row) => row.id))
  const unknown = ids.filter((id) => !known.has(id))
  if (unknown.length) {
    return c.json({ success: false, error: `unknown block id(s): ${unknown.join(', ')}` }, 400)
  }
  const missing = existing.map((row) => row.id).filter((id) => !ids.includes(id))
  if (missing.length) {
    return c.json({
      success: false,
      error: `order must list every block; missing: ${missing.join(', ')}`,
    }, 400)
  }

  // One batch, so an interrupted reorder cannot leave half the rows renumbered.
  await c.env.DB.batch([
    ...ids.map((id, index) => c.env.DB.prepare(
      `UPDATE home_experience_blocks SET sort_order = ?, updated_at = datetime('now') WHERE id = ?`,
    ).bind(index, id)),
    auditStatement(c.env.DB, actorId(c), 'update', 'home_experience_order', 'all',
      { order: ids }),
  ])
  return c.json({ success: true, data: { order: ids } })
})

route.delete('/home-experience/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id')
  const existing = await loadBlock(c.env, id)
  if (!existing) return c.json({ success: false, error: 'Block not found' }, 404)

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM home_experience_blocks WHERE id = ?').bind(id),
    // The final state is recorded before the row goes, so a deletion is
    // reviewable and the block's history does not end without explanation.
    versionStatement(c.env, {
      format: 'home_block_v1',
      block_id: id,
      action: 'delete',
      actor_id: actorId(c),
      before: snapshotFromRow(existing as unknown as HomeBlockRow),
      after: null,
    }),
    auditStatement(c.env.DB, actorId(c), 'archive', 'home_experience_block', id,
      { block_type: existing.block_type }),
  ])
  return c.json({ success: true, data: { id, deleted: true } })
})

/**
 * `GET /home-experience/preview` — what a given persona would receive.
 *
 * Resolved by `resolveHomeBlocks`, the same function `/api/v1/home/resolved`
 * uses. It previously had its own filter that understood different dimensions, so
 * the preview and the app could disagree; a preview that does not match
 * production is worse than no preview.
 */
route.get('/home-experience/preview', async (c) => {
  const context = homeContextFromQuery((key) => c.req.query(key))
  const nowIso = new Date().toISOString()
  const rows = await queryAll<HomeBlockRow>(
    c.env.DB, `SELECT ${BLOCK_COLUMNS} FROM home_experience_blocks`,
  )
  const blocks = resolveHomeBlocks(rows, context, nowIso)
  const total = rows.length
  return c.json({
    success: true,
    data: {
      blocks,
      meta: {
        ...context,
        resolved_at: nowIso,
        /// Real diagnostics: the screen used to print "Fallback applied: none"
        /// unconditionally and compute exclusions from a list it had filtered
        /// itself.
        total_blocks: total,
        matched: blocks.length,
        excluded: total - blocks.length,
        excluded_inactive: rows.filter((row) => Number(row.is_active) !== 1).length,
        excluded_draft: rows.filter((row) => Number(row.is_draft) === 1).length,
        excluded_schedule: rows.filter((row) => Number(row.is_active) === 1
          && Number(row.is_draft) === 0 && !isScheduleOpen(row, nowIso)).length,
        resolver: 'lib/homeExperience.ts — identical to /api/v1/home/resolved',
      },
    },
  })
})


// Devices
//
// كان `LIMIT 50` مثبَّتًا بلا offset: الجهاز رقم 51 لا سبيل لرؤيته إطلاقًا.
// و`account_devices` ينمو بعدد العائلات لا بعدد المحتوى، فهو من أسرع الجداول
// نموًّا في المنصّة.
route.get('/devices', async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), UNBOUNDED_LIST_PAGINATION)
  const total = await queryFirst<{ total: number }>(c.env.DB, 'SELECT COUNT(*) AS total FROM account_devices')
  const rows = await queryAll(c.env.DB, `
    SELECT d.*, p.display_name as parent_name
      FROM account_devices d
      LEFT JOIN parents p ON p.id=d.parent_id
     ORDER BY d.last_seen_at DESC
     LIMIT ? OFFSET ?
  `, [limit, offset])
  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset } })
})

/**
 * سحب الجهاز غير متاح مؤقتًا.
 *
 * `account_devices` في D1 ليس مصدر السلطة الحي: الجهاز والجلسات وleases
 * الفعلية في FamilyState. تحديث صف D1 هنا كان يعلن نجاحًا بينما يترك جلسة
 * التطبيق قائمة. لا نكتب مرآة ثانية ولا نستدعي FamilyState بمعرّف لا يثبت أنه
 * معرّف الجهاز داخله؛ يلزم أولًا إسقاط أجهزة موثوق مبني من أحداث الـDO.
 */
route.post('/devices/:id/revoke', requirePermission('archive'), async (c) => {
  return c.json({
    success: false,
    error: 'سحب الجهاز غير متاح حتى يكتمل ربط قائمة الإدارة بمصدر FamilyState',
  }, 501)
})

/* -------------------------------------------------------- Remote Config */

/**
 * إعدادات التحكم عن بعد.
 *
 * الجدول موجود من المهاجرة 0015 لكن لم يكن له أي مسار، فكانت صفحة
 * RemoteConfigPage تعرض ثلاثة أعلام مخترعة في كل الحالات بلا استثناء: النداء
 * يعيد 404، فيرمي r.json()، فيمسك الـcatch ويحطّ بيانات ثابتة. أي أن المسؤول
 * كان يقرأ حالة نظام لا وجود لها.
 */
route.get('/remote-config', async (c) => {
  const rows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT key, value_json, rollout_percent, targeting_json, updated_at FROM remote_config ORDER BY key`,
  )
  return c.json({
    success: true,
    data: rows.map((row) => ({
      key: row.key,
      // يُفكّ التحليل هنا لا في الواجهة، فلا يتكرّر المنطق ولا تنكسر الصفحة
      // على قيمة غير صالحة
      value: parseJson(row.value_json, null),
      rollout_percent: Number(row.rollout_percent ?? 0),
      targeting: parseJson(row.targeting_json, {}),
      updated_at: row.updated_at,
    })),
  })
})

/// `publish` لا `edit_metadata`: قيمة في remote_config تصل إلى كل تطبيق حيّ
/// فورًا بلا مراجعة ولا جدولة، فهي نشرٌ فعليّ لتغيير سلوك المنتج. ربطها
/// بصلاحية تعديل الميتاداتا كان يمنح كل محرّر محتوى مفتاح المنصّة.
route.put('/remote-config/:key', requirePermission('publish'), async (c) => {
  const key = c.req.param('key')
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'صيغة الطلب غير صالحة' }, 400)

  const rollout = body.rollout_percent === undefined ? 100 : Number(body.rollout_percent)
  if (!Number.isInteger(rollout) || rollout < 0 || rollout > 100) {
    return c.json({ success: false, error: 'rollout_percent يجب أن يكون بين 0 و100' }, 400)
  }
  if (body.value === undefined) return c.json({ success: false, error: 'value مطلوب' }, 400)

  const targeting = body.targeting && typeof body.targeting === 'object' ? body.targeting : {}

  await c.env.DB.prepare(`
    INSERT INTO remote_config (key, value_json, rollout_percent, targeting_json, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      rollout_percent = excluded.rollout_percent,
      targeting_json = excluded.targeting_json,
      updated_at = datetime('now')
  `).bind(key, JSON.stringify(body.value), rollout, JSON.stringify(targeting)).run()

  try {
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details)
      VALUES (?, ?, 'update', 'remote_config', ?, ?)
    `).bind(
      crypto.randomUUID(), auditActor(c), key,
      JSON.stringify({ value: body.value, rollout_percent: rollout }),
    ).run()
  } catch (error) {
    console.error('remote_config_audit_failed', error instanceof Error ? error.message : String(error))
  }

  return c.json({ success: true, data: { key, rollout_percent: rollout } })
})

/// أعلام الميزات، جدول منفصل عن remote_config في المهاجرة 0015
route.get('/feature-flags', async (c) => {
  const rows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT key, enabled, targeting_json, created_at FROM feature_flags ORDER BY key`,
  )
  return c.json({
    success: true,
    data: rows.map((row) => ({
      key: row.key,
      enabled: Number(row.enabled) === 1,
      targeting: parseJson(row.targeting_json, {}),
      created_at: row.created_at,
    })),
  })
})

// Support Center - Family lookup
//
// البيانات هنا ليست «تفصيل الحساب كله»: العامل يحتاج حالة الباقة، ملفات الطفل
// والأجهزة والاستحقاقات المختصرة لحل المشكلة، لا hashes تثبيت أو شراء ولا
// معرفات مزوّد أو حقول إسقاطات لا تعرضها الواجهة. لذلك لا تُستخدم SELECT *.
route.get('/support/family/:id', async (c) => {
  const id = pathParam(c, 'id')
  const family = await queryFirst(c.env.DB, `
    SELECT parent_id, plan, status FROM family_projection WHERE parent_id = ?
  `, [id])
  if (!family) return c.json({ success: false, error: 'Family not found' }, 404)

  const [children, devices, entitlements] = await Promise.all([
    queryAll(c.env.DB, `
      SELECT child_id, nickname, age_track, status
        FROM child_projection
       WHERE parent_id = ?
       ORDER BY last_event_at_ms DESC
    `, [id]),
    queryAll(c.env.DB, `
      SELECT id, display_name, platform, status
        FROM account_devices
       WHERE parent_id = ?
       ORDER BY last_seen_at DESC
    `, [id]),
    queryAll(c.env.DB, `
      SELECT product_id, plan, entitlement_status, expires_at_ms
        FROM billing_audit
       WHERE parent_id = ?
       ORDER BY created_at DESC
       LIMIT 10
    `, [id]),
  ])

  // قراءة عائلة حدث حساس: entity_id وحده يكفي لربطه بلا إدخال nickname أو
  // بيانات فوترة في السجل، وactorId لا يثق في ترويسة مرسلة من العميل.
  await auditStatement(c.env.DB, actorId(c), 'view', 'support_family', id, {}).run()

  return c.json({ success: true, data: { family, children, devices, entitlements } })
})

/// `GET /admin/support/family/:id/devices` — the *live* device list.
///
/// ## Why this exists alongside the projection above
///
/// `account_devices` is a D1 projection fed by queue events. It is the right thing
/// to list and filter across accounts, and it is the wrong thing to answer "is this
/// parent's tablet still signed in right now", because a projection is by definition
/// behind and a support conversation happens in the present. The audit recorded the
/// consequence as a real gap: «لا إسقاط أجهزة حي من FamilyState».
///
/// `FamilyState` is the authority (`do/FamilyState.ts`), and its `GET /devices`
/// handler requires no parent session — unlike `POST /devices/revoke`, which checks
/// `activeSession` and therefore genuinely cannot be called by an operator. So the
/// read is available today and the write is not, and this endpoint is exactly the
/// half that is possible. Nothing here moves authority into D1.
///
/// `installation_id_hash` is dropped before the response. It is a device
/// fingerprint, an operator never needs it to answer a question, and the narrow
/// field set of the lookup above exists for the same reason.
route.get('/support/family/:id/devices', async (c) => {
  const id = pathParam(c, 'id')
  const family = await queryFirst<{ parent_id: string }>(c.env.DB, `
    SELECT parent_id FROM family_projection WHERE parent_id = ?
  `, [id])
  if (!family) return c.json({ success: false, error: 'Family not found' }, 404)

  const live = await callDurable<{
    success: boolean
    data?: Array<Record<string, unknown>>
  }>(familyStub(c.env, id), '/devices', { method: 'GET' })

  // A Durable Object outage must not be reported as "this family has no devices":
  // an empty list and an unreachable authority are different answers, and only one
  // of them means the parent can sign in.
  if (!live.ok || !live.data?.success) {
    return c.json({
      success: false,
      error: 'Family device state is unavailable right now',
      data: { source: 'family_state', reachable: false },
    }, 503)
  }

  const devices = (live.data.data ?? []).map((device) => ({
    id: device.id,
    display_name: device.display_name,
    platform: device.platform,
    status: device.status,
    registered_at: device.registered_at,
    last_seen_at: device.last_seen_at,
  }))

  await auditStatement(c.env.DB, actorId(c), 'view', 'support_family_devices', id, {
    device_count: devices.length,
  }).run()

  return c.json({
    success: true,
    data: {
      devices,
      source: 'family_state',
      // Stated in the payload so a screen cannot present a live read and a
      // projection read as the same thing.
      authority: 'FamilyState is the authority for device state; revoke is not an admin operation',
      revoke_available: false,
    },
  })
})

// Rights
//
// العمود اسمه `expiry_date` لا `expires_at`: كان `ORDER BY r.expires_at` يُعيد
// 500 على كل نداء لأن العمود لا وجود له في rights_licenses (المهاجرة 0015).
// لم يظهر الخطأ لأن الواجهة كانت تمسكه بـcatch وتعرض قائمة فارغة.
//
// NULLS LAST يدويًا: التراخيص الدائمة (بلا تاريخ انتهاء) تُعرض بعد المؤقّتة،
// فالأقرب انتهاءً هو ما يحتاج انتباهًا.
route.get('/rights', async (c) => {
  // rights_licenses ينمو بعدد اتفاقيات الترخيص ولا يُبذَر بشيء، فهو قائمة
  // مفتوحة الحجم بطبيعتها ويحتاج حدًّا.
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), UNBOUNDED_LIST_PAGINATION)

  // الفلترة في SQL لا في المتصفح.
  //
  // كانت الشاشة تُفلتر المجموعة المُحمَّلة، وهو ما يعمل إلى أن يكبر الجدول: عندها
  // تُفلتر الصفحة الأولى فقط ويبدو أن نصف التراخيص اختفى. والأهم أن مقياس
  // «تراخيص منتهية» في اللوحة التنفيذية يفتح هذه الشاشة، فبلا معامل يفهمه الخادم
  // كان الرابط يفتح قائمة غير مفلترة ويُظهر مجموعة غير التي عدّها المقياس.
  const clauses: string[] = []
  const params: unknown[] = []

  const search = c.req.query('q')?.trim()
  if (search) {
    clauses.push('(r.owner LIKE ? ESCAPE \'\\\' OR r.content_id LIKE ? ESCAPE \'\\\' OR s.title_ar LIKE ? ESCAPE \'\\\')')
    const term = `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
    params.push(term, term, term)
  }

  const licenseType = c.req.query('license_type')
  if (licenseType && ['exclusive', 'non_exclusive', 'owned'].includes(licenseType)) {
    clauses.push('r.license_type = ?')
    params.push(licenseType)
  }

  // `expiry` ثلاث حالات تشغيلية لا تاريخ: منتهٍ، ينتهي خلال ٦٠ يومًا، أو بلا
  // تاريخ انتهاء. المقارنة على أول عشرة أحرف لأن العمود قد يحمل طابعًا كاملًا،
  // ومقارنة طابع كامل بـ`date('now')` نصًّا تُخرج يوم الحدّ من النافذة.
  const expiry = c.req.query('expiry')
  if (expiry === 'expired') {
    clauses.push("r.expiry_date IS NOT NULL AND SUBSTR(r.expiry_date, 1, 10) < date('now')")
  } else if (expiry === 'soon') {
    clauses.push("r.expiry_date IS NOT NULL AND SUBSTR(r.expiry_date, 1, 10) >= date('now')"
      + " AND SUBSTR(r.expiry_date, 1, 10) <= date('now', '+60 days')")
  } else if (expiry === 'none') {
    clauses.push('r.expiry_date IS NULL')
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = await queryFirst<{ total: number }>(c.env.DB, `
    SELECT COUNT(*) AS total FROM rights_licenses r
      LEFT JOIN series s ON s.id = r.content_id ${where}
  `, params)
  const rows = await queryAll(c.env.DB, `
    SELECT r.*, s.title_ar as series_title
      FROM rights_licenses r
      LEFT JOIN series s ON s.id = r.content_id
     ${where}
     ORDER BY CASE WHEN r.expiry_date IS NULL THEN 1 ELSE 0 END, r.expiry_date
     LIMIT ? OFFSET ?
  `, [...params, limit, offset])
  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset } })
})

route.post('/rights', requirePermission('create'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const contentId = typeof body?.content_id === 'string' ? body.content_id.trim() : ''
  const owner = typeof body?.owner === 'string' ? body.owner.trim() : ''
  const licenseType = typeof body?.license_type === 'string' ? body.license_type : 'exclusive'
  if (!contentId || contentId.length > 200 || !owner || owner.length > 200) {
    return c.json({ success: false, error: 'content_id and owner are required' }, 400)
  }
  if (!['exclusive', 'non_exclusive', 'owned'].includes(licenseType)) {
    return c.json({ success: false, error: 'Invalid license_type' }, 400)
  }

  const normalizedList = (
    value: unknown,
    normalize: (item: string) => string | null,
  ): string[] | null => {
    if (value === undefined) return []
    if (!Array.isArray(value) || value.length > 50) return null
    const values = value.map((item) => typeof item === 'string' ? normalize(item.trim()) : null)
    if (values.some((item) => item === null)) return null
    const unique = [...new Set(values as string[])]
    return unique.length === values.length ? unique : null
  }

  const countries = normalizedList(body?.countries, (item) => /^[A-Za-z]{2}$/.test(item) ? item.toUpperCase() : null)
  const languages = normalizedList(body?.languages, (item) => /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(item) ? item : null)
  const devices = normalizedList(body?.devices, (item) => ['mobile', 'tv', 'web'].includes(item) ? item : null)
  if (!countries || !languages || !devices) {
    return c.json({ success: false, error: 'countries, languages and devices must be unique, valid lists of at most 50 items' }, 400)
  }

  const expiryDate = body?.expiry_date === undefined || body.expiry_date === null || body.expiry_date === ''
    ? null
    : typeof body.expiry_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.expiry_date)
      && new Date(`${body.expiry_date}T00:00:00.000Z`).toISOString().slice(0, 10) === body.expiry_date
      ? body.expiry_date
      : undefined
  if (expiryDate === undefined) return c.json({ success: false, error: 'expiry_date must be an ISO date' }, 400)

  // The current register resolves series only. Other content types require a
  // typed, central rights-policy schema before they can be attached safely.
  const series = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM series WHERE id = ? AND status <> ?', [contentId, 'archived'])
  if (!series) return c.json({ success: false, error: 'Series not found or archived' }, 400)

  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO rights_licenses (id, content_id, owner, license_type, countries, languages, devices, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, contentId, owner, licenseType, JSON.stringify(countries), JSON.stringify(languages), JSON.stringify(devices), expiryDate),
    // Keep the legal owner out of details; entity and normalized policy fields
    // are enough to explain the operation without duplicating contract metadata.
    auditStatement(c.env.DB, actorId(c), 'create', 'rights_license', id, {
      content_id: contentId, license_type: licenseType, countries, languages, devices, expiry_date: expiryDate,
    }),
  ])
  return c.json({ success: true, data: { id } }, 201)
})

export default route
