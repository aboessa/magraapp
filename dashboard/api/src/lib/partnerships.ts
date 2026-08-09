import { queryFirst } from './db'

/** أنواع الجهات وحالات الطلب. مطابقة لقيود CHECK في المهاجرة 0017. */
export const KINDS = ['school', 'nursery', 'publisher', 'producer', 'creator', 'other'] as const
export const STATUSES = ['new', 'in_review', 'contacted', 'accepted', 'declined', 'spam'] as const
export const LOCALES = ['ar', 'en', 'fr'] as const
export const EMAIL_STATUSES = ['pending', 'sent', 'failed', 'skipped'] as const

export type PartnershipKind = typeof KINDS[number]
export type PartnershipStatus = typeof STATUSES[number]
export type PartnershipLocale = typeof LOCALES[number]
export type PartnershipEmailStatus = typeof EMAIL_STATUSES[number]

export type PartnershipRequestRow = {
  id: string
  kind: PartnershipKind
  name: string
  organization: string
  email: string
  phone: string | null
  country: string | null
  message: string
  locale: PartnershipLocale
  status: PartnershipStatus
  admin_note: string | null
  email_status: PartnershipEmailStatus
  email_error: string | null
  source_ip: string | null
  user_agent: string | null
  created_at: string
  updated_at: string
}

/** مفاتيح الإعدادات التي تسمح اللوحة بتحريرها. أي مفتاح آخر يُرفض. */
export const EDITABLE_SETTINGS = [
  'partnership_inbox_email',
  'partnership_from_email',
  'partnership_cc_emails',
] as const

export type EditableSettingKey = typeof EDITABLE_SETTINGS[number]

export function isEditableSetting(key: string): key is EditableSettingKey {
  return (EDITABLE_SETTINGS as readonly string[]).includes(key)
}

export async function readSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await queryFirst<{ value: string | null }>(
    db,
    'SELECT value FROM platform_settings WHERE key = ?',
    [key],
  )
  return row?.value ?? null
}

export async function writeSetting(db: D1Database, key: string, value: string, actor: string | null) {
  await db.prepare(`
    INSERT INTO platform_settings (key, value, updated_at, updated_by)
    VALUES (?, ?, datetime('now'), ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now'),
      updated_by = excluded.updated_by
  `).bind(key, value, actor).run()
}

export async function markEmailResult(
  db: D1Database,
  id: string,
  status: PartnershipEmailStatus,
  error: string | null,
) {
  try {
    await db.prepare(`
      UPDATE partnership_requests
      SET email_status = ?, email_error = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(status, error ? error.slice(0, 500) : null, id).run()
  } catch (cause) {
    // الطلب محفوظ بالفعل، وفشل تحديث حالة البريد لا يستحق إفشال الاستجابة
    console.error('partnership_email_status_failed', id, cause instanceof Error ? cause.message : String(cause))
  }
}

/* ----------------------------------------------------------- بريد الإشعار */

const KIND_LABELS_AR: Record<PartnershipKind, string> = {
  school: 'مدرسة',
  nursery: 'حضانة أو روضة',
  publisher: 'دار نشر',
  producer: 'منتج محتوى',
  creator: 'معلّق صوتي أو مبدع',
  other: 'أخرى',
}

const LOCALE_LABELS_AR: Record<PartnershipLocale, string> = {
  ar: 'العربية',
  en: 'الإنجليزية',
  fr: 'الفرنسية',
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type PartnershipEmailInput = {
  id: string
  kind: PartnershipKind
  name: string
  organization: string
  email: string
  phone: string | null
  country: string | null
  message: string
  locale: PartnershipLocale
}

/**
 * بريد الإشعار الداخلي بالعربية دائمًا: مستلمه فريق مجرة لا الزائر،
 * ولغة الزائر مذكورة كحقل ليُردّ عليه بها.
 */
export function buildPartnershipEmail(input: PartnershipEmailInput) {
  const kindLabel = KIND_LABELS_AR[input.kind]
  const subject = `طلب شراكة جديد · ${kindLabel} · ${input.organization}`

  const rows: [string, string][] = [
    ['نوع الجهة', kindLabel],
    ['اسم الجهة', input.organization],
    ['الاسم', input.name],
    ['البريد', input.email],
    ['الهاتف', input.phone ?? '—'],
    ['البلد', input.country ?? '—'],
    ['لغة الزائر', LOCALE_LABELS_AR[input.locale]],
    ['رقم الطلب', input.id],
  ]

  const text = [
    'طلب شراكة جديد من صفحة الهبوط',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'تفاصيل التعاون:',
    input.message,
    '',
    'يمكن الرد على هذه الرسالة مباشرة للوصول إلى صاحب الطلب.',
    'الطلب متاح أيضًا في لوحة الإدارة ضمن صفحة طلبات الشراكة.',
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,Segoe UI,Tahoma,sans-serif;color:#12182b">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:14px;padding:24px">
    <h1 style="margin:0 0 4px;font-size:19px">طلب شراكة جديد</h1>
    <p style="margin:0 0 20px;font-size:13px;color:#5b6478">وارد من نموذج الشراكات في صفحة الهبوط</p>
    <table style="width:100%;border-collapse:collapse;font-size:13.5px">
      ${rows.map(([label, value]) => `<tr>
        <th align="right" style="width:120px;padding:8px 0;color:#5b6478;font-weight:600;vertical-align:top">${escapeHtml(label)}</th>
        <td style="padding:8px 0">${escapeHtml(value)}</td>
      </tr>`).join('')}
    </table>
    <h2 style="margin:22px 0 8px;font-size:15px">تفاصيل التعاون</h2>
    <div style="padding:14px;border-radius:10px;background:#f4f6fb;font-size:13.5px;line-height:1.9;white-space:pre-wrap">${escapeHtml(input.message)}</div>
    <p style="margin:20px 0 0;font-size:12px;color:#5b6478">
      الرد على هذه الرسالة يذهب إلى صاحب الطلب مباشرة.
      الطلب متاح كذلك في لوحة الإدارة ضمن صفحة طلبات الشراكة.
    </p>
  </div>
</body></html>`

  return { subject, text, html }
}
