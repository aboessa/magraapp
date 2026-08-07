import type { Env } from '../lib/db'

// family-events-dlq: لا نحذف الرسالة دون تسجيل
export async function handleFamilyEventsDlq(batch: MessageBatch<unknown>, env: Env) {
  for (const msg of batch.messages) {
    const body = msg.body as any
    console.error('dlq_family_event', {
      event_id: body?.eventId ?? body?.event_id ?? 'unknown',
      parent_id: body?.parentId ?? body?.parent_id ?? 'unknown',
      type: body?.type ?? 'unknown',
      attempts: (msg as any).attempts ?? 'unknown',
    })
    // احتفظ بالرسالة في DLQ للمراجعة اليدوية - ack لمنع إعادة المحاولة اللانهائية
    // يمكن لاحقاً إضافة مصالحة عبر /admin/family-projection/reconcile
    msg.ack()
  }
}
