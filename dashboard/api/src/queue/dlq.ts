import type { Env } from '../lib/db.ts'

/**
 * family-events-dlq: آخر محطة لحدث فشل كل محاولاته.
 *
 * ## العلّة التي كانت هنا
 *
 * التعليق السابق كان «لا نحذف الرسالة دون تسجيل»، والتسجيل الوحيد كان
 * `console.error` ثم `msg.ack()`. والـack يعني للطابور أن الرسالة عُولجت،
 * فتُحذف. أي أن الحدث كان يُفقَد فعلًا، وكل ما يبقى منه سطر سجل يشيخ ويُحذف.
 *
 * النتيجة: إسقاط `family_projection` لعائلة يبقى متأخّرًا بلا أي طريقة لملاحظة
 * ذلك. ووعد «يمكن لاحقًا إضافة مصالحة عبر /admin/family-projection/reconcile»
 * كان يشير إلى مسار **لا وجود له في الكود إطلاقًا** — بحثتُ عنه فلم أجده.
 *
 * ## ما صار
 *
 * الرسالة تُكتب في `failed_family_events` (المهاجرة 0021) قبل الـack. الـack
 * يبقى لأن إعادة المحاولة داخل مستهلك الـDLQ تُدوّر الفشل نفسه بلا نهاية —
 * الحدث وصل هنا بعد استنفاد محاولاته أصلًا. الفرق أن الجسم الخام يبقى محفوظًا
 * فيمكن فحصه وإعادة تشغيله.
 *
 * ## لماذا الكتابة قبل الـack لا بعده
 *
 * لو نجح الـack وفشلت الكتابة لضاع الحدث بلا أثر، وهي الحالة نفسها التي يعالجها
 * هذا الملف. الترتيب يجعل الفشل في الكتابة يُبقي الرسالة في الطابور.
 */

/// حجم أقصى للجسم المحفوظ. رسالة ضخمة واحدة لا يجوز أن تُفشل الكتابة أو تُتخم
/// الجدول، ومعرفة أن الجسم كان أكبر من الحد أنفع من فقدان الصفّ كله.
const MAX_PAYLOAD_LENGTH = 20_000

function serializePayload(body: unknown): string {
  let encoded: string
  try {
    encoded = JSON.stringify(body ?? null) ?? 'null'
  } catch {
    // جسم دوريّ أو غير قابل للترميز: يُسجَّل أنه كذلك بدل خسارة الصفّ
    return JSON.stringify({ error: 'payload_not_serializable' })
  }
  if (encoded.length <= MAX_PAYLOAD_LENGTH) return encoded
  return JSON.stringify({
    error: 'payload_truncated',
    original_length: encoded.length,
    preview: encoded.slice(0, 2_000),
  })
}

/// يقرأ حقلًا نصيًّا من جسم غير موثوق.
///
/// الجسم قد يكون أي شيء — رسالة مشوّهة هي أحد أسباب الوصول إلى الـDLQ — فلا
/// يُفترض شكله. القيم غير الصالحة تصير `null` لأن الأعمدة تسمح بذلك عن قصد.
function readText(source: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.length > 0 && value.length <= 200) return value
  }
  return null
}

function readInteger(source: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  }
  return null
}

export async function handleFamilyEventsDlq(batch: MessageBatch<unknown>, env: Env) {
  for (const msg of batch.messages) {
    // كلا الصيغتين مقبولتان: الإنتاج يرسل camelCase، وقد تصل رسائل قديمة
    // بـsnake_case، والـDLQ ليس مكان التزمّت بالشكل.
    const body = (msg.body && typeof msg.body === 'object' && !Array.isArray(msg.body)
      ? msg.body
      : {}) as Record<string, unknown>

    const eventId = readText(body, 'eventId', 'event_id')
    const parentId = readText(body, 'parentId', 'parent_id')
    const eventType = readText(body, 'type', 'event_type')
    const occurredAt = readInteger(body, 'occurredAt', 'occurred_at', 'occurredAtMs', 'occurred_at_ms')
    const attempts = Number((msg as { attempts?: unknown }).attempts ?? 0)

    console.error('dlq_family_event', {
      event_id: eventId ?? 'unknown',
      parent_id: parentId ?? 'unknown',
      type: eventType ?? 'unknown',
      attempts: Number.isFinite(attempts) ? attempts : 0,
    })

    try {
      await env.DB.prepare(`
        INSERT INTO failed_family_events (
          id, event_id, event_type, parent_id, occurred_at_ms, payload, attempts
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        eventId,
        eventType,
        parentId,
        occurredAt,
        serializePayload(msg.body),
        Number.isFinite(attempts) ? attempts : 0,
      ).run()

      // الحدث محفوظ الآن، فالـack لا يعني فقدانه
      msg.ack()
    } catch (error) {
      // الكتابة فشلت: تُترك الرسالة في الطابور لتُحاول مرة أخرى بدل أن تُحذف.
      // هذا هو الفرق الجوهري عن السلوك السابق الذي كان يـack مهما حدث.
      console.error(
        'dlq_persist_failed',
        error instanceof Error ? error.message : String(error),
      )
      msg.retry()
    }
  }
}
