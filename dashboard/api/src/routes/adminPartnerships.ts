import { Hono } from 'hono'
import { requireAdmin, requirePermission } from '../lib/adminAuth'
import { actorId, auditStatement } from '../lib/auditLog'
import type { Env } from '../lib/db'
import type { AdminSessionUser } from '../lib/adminUsers'
import { queryAll, queryFirst } from '../lib/db'
import { isEmailAddress, parseEmailList, sendEmail } from '../lib/email'
import {
  buildPartnershipEmail,
  EDITABLE_SETTINGS,
  isEditableSetting,
  markEmailResult,
  readSetting,
  STATUSES,
  writeSetting,
  type PartnershipRequestRow,
  type PartnershipStatus,
} from '../lib/partnerships'

type AppEnv = { Bindings: Env; Variables: { adminUser?: AdminSessionUser; adminIsLegacyKey?: boolean } }

const adminPartnershipsRoute = new Hono<AppEnv>()

adminPartnershipsRoute.use('*', requireAdmin)

const MAX_LIMIT = 100

/// هوية الفاعل من الجلسة لا من ترويسة يكتبها المتصل.
///
/// كانت `X-Admin-Actor` هي المصدر الوحيد، وهي ترويسة يضعها العميل بنفسه بلا
/// تحقّق، والقيمة الافتراضية `'dashboard-admin'` ليست معرّفًا في admin_users.
/// إعدادات الشراكات تحدّد إلى أي بريد تُرسل طلبات الجهات، فتغييرها تحويلٌ
/// لمسار بريد رسميّ ويجب أن يُنسب لفاعل حقيقي.
function actor(c: Parameters<typeof actorId>[0]) {
  return actorId(c)
}

/** قائمة الطلبات مع ترقيم صفحات وتصفية بالحالة والنوع والبحث */
adminPartnershipsRoute.get('/', async (c) => {
  const url = new URL(c.req.url)
  const status = url.searchParams.get('status')
  const kind = url.searchParams.get('kind')
  const search = url.searchParams.get('search')?.trim()
  const limit = Math.min(Number(url.searchParams.get('limit')) || 25, MAX_LIMIT)
  const page = Math.max(Number(url.searchParams.get('page')) || 1, 1)
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []

  if (status && (STATUSES as readonly string[]).includes(status)) {
    conditions.push('status = ?')
    params.push(status)
  }
  if (kind) {
    conditions.push('kind = ?')
    params.push(kind)
  }
  if (search) {
    conditions.push('(name LIKE ? OR organization LIKE ? OR email LIKE ?)')
    const pattern = `%${search}%`
    params.push(pattern, pattern, pattern)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const total = await queryFirst<{ total: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS total FROM partnership_requests ${where}`,
    params,
  )

  const rows = await queryAll<PartnershipRequestRow>(
    c.env.DB,
    `SELECT * FROM partnership_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )

  const counts = await queryAll<{ status: PartnershipStatus; total: number }>(
    c.env.DB,
    'SELECT status, COUNT(*) AS total FROM partnership_requests GROUP BY status',
  )

  return c.json({
    success: true,
    data: rows,
    meta: {
      total: total?.total ?? 0,
      page,
      limit,
      pages: Math.max(Math.ceil((total?.total ?? 0) / limit), 1),
      counts: Object.fromEntries(counts.map((row) => [row.status, row.total])),
    },
  })
})

adminPartnershipsRoute.get('/settings', async (c) => {
  const entries = await Promise.all(
    EDITABLE_SETTINGS.map(async (key) => [key, (await readSetting(c.env.DB, key)) ?? ''] as const),
  )
  const inbox = entries.find(([key]) => key === 'partnership_inbox_email')?.[1] ?? ''

  return c.json({
    success: true,
    data: {
      settings: Object.fromEntries(entries),
      // يُبلّغ اللوحة أي مزوّد سيُستخدم فعلًا، فلا يُفاجأ المسؤول بفشل صامت
      emailProvider: c.env.RESEND_API_KEY ? 'resend' : c.env.EMAIL ? 'cloudflare' : 'none',
      defaultFrom: c.env.EMAIL_FROM ?? null,
      inboxConfigured: isEmailAddress(inbox),
    },
  })
})

/// `publish`: هذه الإعدادات تحدّد إلى أي صندوق بريد تُحوَّل طلبات الجهات
/// الرسمية، فتغييرها أثره خارج المنصّة لا داخلها، وأقرب صلاحية موجودة لأثر
/// عام كهذا هي النشر. لا توجد صلاحية مخصّصة لإعدادات المنصّة في المهاجرة 0014.
adminPartnershipsRoute.put('/settings', requirePermission('publish'), async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'صيغة الطلب غير صالحة' }, 400)

  const updates: [string, string][] = []
  for (const [key, raw] of Object.entries(body)) {
    if (!isEditableSetting(key)) {
      return c.json({ success: false, error: `مفتاح غير مسموح: ${key}` }, 400)
    }
    const value = typeof raw === 'string' ? raw.trim() : ''

    // الفراغ مسموح ويعني «غير مضبوط»، لكن أي قيمة غير فارغة يجب أن تكون بريدًا صالحًا
    if (value) {
      if (key === 'partnership_cc_emails') {
        const parsed = parseEmailList(value)
        const supplied = value.split(',').map((entry) => entry.trim()).filter(Boolean)
        if (parsed.length !== supplied.length) {
          return c.json({ success: false, error: 'قائمة النسخ الكربونية تحتوي عنوانًا غير صالح' }, 400)
        }
      } else if (!isEmailAddress(value)) {
        return c.json({ success: false, error: `قيمة ${key} ليست بريدًا صالحًا` }, 400)
      }
    }
    updates.push([key, value])
  }

  if (!updates.length) return c.json({ success: false, error: 'لا حقول للتحديث' }, 400)

  for (const [key, value] of updates) {
    await writeSetting(c.env.DB, key, value, actor(c))
  }

  const entries = await Promise.all(
    EDITABLE_SETTINGS.map(async (key) => [key, (await readSetting(c.env.DB, key)) ?? ''] as const),
  )
  await auditStatement(
    c.env.DB,
    actor(c),
    'update',
    'partnership_settings',
    'settings',
    { changed_keys: updates.map(([key]) => key) },
  ).run()
  return c.json({ success: true, data: { settings: Object.fromEntries(entries) } })
})

adminPartnershipsRoute.get('/:id', async (c) => {
  const row = await queryFirst<PartnershipRequestRow>(
    c.env.DB,
    'SELECT * FROM partnership_requests WHERE id = ?',
    [c.req.param('id')],
  )
  if (!row) return c.json({ success: false, error: 'الطلب غير موجود' }, 404)
  return c.json({ success: true, data: row })
})

adminPartnershipsRoute.patch('/:id', requirePermission('edit_metadata'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'صيغة الطلب غير صالحة' }, 400)

  const existing = await queryFirst<PartnershipRequestRow>(
    c.env.DB,
    'SELECT id FROM partnership_requests WHERE id = ?',
    [id],
  )
  if (!existing) return c.json({ success: false, error: 'الطلب غير موجود' }, 404)

  const fields: string[] = []
  const params: unknown[] = []

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !(STATUSES as readonly string[]).includes(body.status)) {
      return c.json({ success: false, error: 'حالة غير صالحة' }, 400)
    }
    fields.push('status = ?')
    params.push(body.status)
  }
  if (body.admin_note !== undefined) {
    const note = typeof body.admin_note === 'string' ? body.admin_note.trim().slice(0, 2000) : ''
    fields.push('admin_note = ?')
    params.push(note || null)
  }

  if (!fields.length) return c.json({ success: false, error: 'لا حقول للتحديث' }, 400)

  await c.env.DB.prepare(`
    UPDATE partnership_requests SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?
  `).bind(...params, id).run()

  const row = await queryFirst<PartnershipRequestRow>(
    c.env.DB,
    'SELECT * FROM partnership_requests WHERE id = ?',
    [id],
  )
  await auditStatement(
    c.env.DB,
    actor(c),
    'update',
    'partnership_request',
    id,
    { changed_fields: fields.map((field) => field.split(' ')[0]) },
  ).run()
  return c.json({ success: true, data: row })
})

/** إعادة محاولة إرسال الإشعار لطلب فشل بريده أو لم يُضبط بريده وقتها */
adminPartnershipsRoute.post('/:id/resend', requirePermission('edit_metadata'), async (c) => {
  const id = c.req.param('id')
  const row = await queryFirst<PartnershipRequestRow>(
    c.env.DB,
    'SELECT * FROM partnership_requests WHERE id = ?',
    [id],
  )
  if (!row) return c.json({ success: false, error: 'الطلب غير موجود' }, 404)

  const inbox = await readSetting(c.env.DB, 'partnership_inbox_email')
  if (!isEmailAddress(inbox)) {
    return c.json({ success: false, error: 'اضبط بريد استقبال الشراكات أولًا' }, 400)
  }

  const fromOverride = await readSetting(c.env.DB, 'partnership_from_email')
  const cc = parseEmailList(await readSetting(c.env.DB, 'partnership_cc_emails'))
  const mail = buildPartnershipEmail(row)

  const result = await sendEmail(c.env, {
    to: { email: inbox },
    ...(isEmailAddress(fromOverride) ? { from: { email: fromOverride, name: 'Majarra' } } : {}),
    ...(cc.length ? { cc: cc.map((address) => ({ email: address })) } : {}),
    replyTo: { email: row.email, name: row.name },
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  })

  await markEmailResult(c.env.DB, id, result.ok ? 'sent' : 'failed', result.ok ? null : result.error)
  if (!result.ok) return c.json({ success: false, error: result.error }, 502)

  // إعادة الإرسال أثر خارجي؛ لا نسجل العنوان أو نص الرسالة لأنهما بيانات جهة
  // خارجية، بل النتيجة والمزوّد فقط.
  try {
    await auditStatement(
      c.env.DB,
      actor(c),
      'resend',
      'partnership_request',
      id,
      { email_status: 'sent', provider: result.provider },
    ).run()
  } catch (error) {
    // الرسالة أُرسلت بالفعل؛ تعطل سجل التدقيق لا يبرر إبلاغ المستخدم بالفشل.
    console.error('partnership_resend_audit_failed', error instanceof Error ? error.message : String(error))
  }

  return c.json({ success: true, data: { id, emailStatus: 'sent', provider: result.provider } })
})

export default adminPartnershipsRoute
