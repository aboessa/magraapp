import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { queryAll, queryFirst } from '../lib/db'
import { callDurable, familyStub } from '../lib/doClient'
import { auditActor, requireAdmin, requirePermission } from '../lib/adminAuth'
import { actorId, auditStatement } from '../lib/auditLog'
import { parsePagination, UNBOUNDED_LIST_PAGINATION } from '../lib/catalogueValidation'
import type { AdminSessionUser } from '../lib/adminUsers'

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

// Home Experience Builder - يتحكم في تركيب الصفحة الرئيسية
route.get('/home-experience', async (c) => {
  const rows = await queryAll<Record<string, unknown>>(c.env.DB, `SELECT * FROM home_experience_blocks ORDER BY sort_order, created_at`)
  // `queryAll<Record<string, unknown>>` rather than the untyped default: spreading a row of
  // type `unknown` is not allowed (TS2698), and the previous code worked around the symptom
  // with `(r as any)` on each field while leaving the spread itself broken.
  return c.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      targeting: JSON.parse(String(row.targeting_json ?? '{}')),
      config: JSON.parse(String(row.config_json ?? '{}')),
    })),
  })
})

route.post('/home-experience', requirePermission('create'), async (c) => {
  const body = await c.req.json().catch(() => null) as any
  if (!body?.block_type) return c.json({ success: false, error: 'block_type required' }, 400)
  const id = `block-${Date.now()}`
  await c.env.DB.prepare(`INSERT INTO home_experience_blocks (id, block_type, title_ar, sort_order, is_active, is_draft, scheduled_at, expires_at, version, targeting_json, config_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, body.block_type, body.title_ar || null, body.sort_order ?? 99, body.is_active ?? 1, body.is_draft ? 1 : 0, body.scheduled_at || null, body.expires_at || null, 1, JSON.stringify(body.targeting || {}), JSON.stringify(body.config || {})).run()
  // snapshot for rollback
  await c.env.DB.prepare(`INSERT INTO home_experience_versions (id, snapshot_json) VALUES (?,?)`).bind(`ver-${id}-${Date.now()}`, JSON.stringify({ id, block_type: body.block_type, title_ar: body.title_ar })).run().catch(() => {})
  return c.json({ success: true, data: { id } }, 201)
})

route.patch('/home-experience/:id', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(() => null) as any
  const sets: string[] = []
  const params: unknown[] = []
  const add = (col: string, val: unknown) => { sets.push(`${col}=?`); params.push(val) }
  if (body.title_ar !== undefined) add('title_ar', body.title_ar)
  if (body.sort_order !== undefined) add('sort_order', body.sort_order)
  if (body.is_active !== undefined) add('is_active', body.is_active ? 1 : 0)
  if (body.is_draft !== undefined) add('is_draft', body.is_draft ? 1 : 0)
  if (body.scheduled_at !== undefined) add('scheduled_at', body.scheduled_at)
  if (body.expires_at !== undefined) add('expires_at', body.expires_at)
  if (body.version !== undefined) add('version', body.version)
  if (body.targeting !== undefined) add('targeting_json', JSON.stringify(body.targeting))
  if (body.config !== undefined) add('config_json', JSON.stringify(body.config))
  if (!sets.length) return c.json({ success: false, error: 'No fields' }, 400)
  await c.env.DB.prepare(`UPDATE home_experience_blocks SET ${sets.join(', ')}, updated_at=datetime('now') WHERE id=?`).bind(...params, c.req.param('id')).run()
  return c.json({ success: true, data: { id: c.req.param('id') } })
})

route.post('/home-experience/:id/rollback', requirePermission('edit_metadata'), async (c) => {
  const id = c.req.param('id')
  const ver = await c.env.DB.prepare(`SELECT snapshot_json FROM home_experience_versions WHERE id LIKE ? ORDER BY created_at DESC LIMIT 1`).bind(`ver-${id}%`).first() as any
  if (!ver) return c.json({ success: false, error: 'No version found' }, 404)
  const snap = JSON.parse(ver.snapshot_json)
  await c.env.DB.prepare(`UPDATE home_experience_blocks SET title_ar=?, targeting_json=?, config_json=?, version=version+1 WHERE id=?`).bind(snap.title_ar, JSON.stringify(snap.targeting || {}), JSON.stringify(snap.config || {}), id).run()
  return c.json({ success: true, data: { rolled_back: true } })
})

route.post('/home-experience/reorder', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json().catch(() => null) as any
  const order: string[] = body?.order
  if (!Array.isArray(order)) return c.json({ success: false, error: 'order must be array of ids' }, 400)
  for (let i = 0; i < order.length; i++) {
    await c.env.DB.prepare(`UPDATE home_experience_blocks SET sort_order=? WHERE id=?`).bind(i, order[i]).run()
  }
  return c.json({ success: true, data: { reordered: true } })
})

route.delete('/home-experience/:id', requirePermission('archive'), async (c) => {
  await c.env.DB.prepare(`DELETE FROM home_experience_blocks WHERE id=?`).bind(c.req.param('id')).run()
  return c.json({ success: true, data: { deleted: true } })
})

// Preview - يبني JSON للصفحة حسب الاستهداف + الجدولة
route.get('/home-experience/preview', async (c) => {
  const track = c.req.query('track') || 'kids'
  const country = c.req.query('country') || 'EG'
  const platform = c.req.query('platform') || 'mobile'
  const plan = c.req.query('plan') || 'family'
  const isNewUser = c.req.query('is_new_user') === '1'
  const now = new Date().toISOString()
  const rows = await queryAll(c.env.DB, `SELECT * FROM home_experience_blocks WHERE is_active=1 AND is_draft=0 AND (scheduled_at IS NULL OR scheduled_at <= ?) AND (expires_at IS NULL OR expires_at > ?) ORDER BY sort_order`, [now, now])
  const filtered = rows.filter((r: any) => {
    const t = JSON.parse(r.targeting_json || '{}')
    if (t.track && t.track !== track) return false
    if (t.country && t.country !== country) return false
    if (t.platform && t.platform !== platform) return false
    if (t.plan && t.plan !== plan) return false
    if (t.is_new_user !== undefined && Boolean(t.is_new_user) !== isNewUser) return false
    return true
  })
  return c.json({ success: true, data: { blocks: filtered, meta: { track, country, platform, plan, isNewUser } } })
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
  const id = c.req.param('id')
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
  const id = c.req.param('id')
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
  const total = await queryFirst<{ total: number }>(c.env.DB, 'SELECT COUNT(*) AS total FROM rights_licenses')
  const rows = await queryAll(c.env.DB, `
    SELECT r.*, s.title_ar as series_title
      FROM rights_licenses r
      LEFT JOIN series s ON s.id = r.content_id
     ORDER BY CASE WHEN r.expiry_date IS NULL THEN 1 ELSE 0 END, r.expiry_date
     LIMIT ? OFFSET ?
  `, [limit, offset])
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
