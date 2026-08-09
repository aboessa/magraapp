/**
 * فصل الإنشاء عن الاعتماد.
 *
 * القسم 9 من خطة الصلاحيات ينصّ:
 *
 *   «الشخص الذي أنشأ أو عدّل المحتوى لا يعتمد النسخة نفسها اعتمادًا نهائيًا.»
 *
 * ولم يكن هذا مفروضًا في أي مكان: كان بإمكان الشخص الواحد أن يُنشئ محتوى ثم
 * يراجعه ثم يعتمده ثم ينشره، وهي بالضبط الحالة التي تمنعها القاعدة. الأسوأ أن
 * `reviewer_id` كان يُقرأ من جسم الطلب، فيستطيع المراجع نسبة الاعتماد إلى غيره.
 *
 * ## كيف نعرف من أنشأ المحتوى
 *
 * لا يوجد عمود `created_by` على جداول المحتوى، وإضافته تعني مهاجرة تمسّ كل
 * جدول. لكن `audit_logs` يسجّل بالفعل كل `create` و`update` بهوية الفاعل، وقد
 * صار يسجّل الهوية الحقيقية بعد إصلاح `auditLog.actorId`. فهو المصدر المتاح
 * للإجابة عن «من عدّل هذا آخر مرة».
 *
 * حدّ هذا المصدر معروف ويُذكر صريحًا: السجلات التي كُتبت قبل ذلك الإصلاح تحمل
 * `'admin-api-key'` أو `'legacy-admin-key'`، ولا تُطابق أي مستخدم، فلا تمنع
 * اعتمادًا. أي أن القاعدة تُفرض على العمل الجديد ولا تُطبَّق رجعيًا — وهذا
 * أصدق من ادّعاء تغطية كاملة.
 */

import { queryFirst } from './db.ts'

/// الحالات التي تعني اعتمادًا نهائيًا، فتخضع للقاعدة.
///
/// `needs_changes` و`rejected` لا تخضع: طلب التعديل من صاحب العمل نفسه لا ضرر
/// فيه، والقاعدة تحمي من الاعتماد الذاتي لا من نقد الذات.
export const APPROVING_STATUSES = ['approved'] as const

export function isApproval(status: unknown): boolean {
  return typeof status === 'string' && (APPROVING_STATUSES as readonly string[]).includes(status)
}

/// الأفعال التي تُعدّ «إنشاءً أو تعديلًا» في سجل التدقيق.
const AUTHORING_ACTIONS = ['create', 'update'] as const

/// هويات لا تمثّل مستخدمًا حقيقيًا، فلا تُقارَن بأحد.
const NON_IDENTITIES = ['admin-api-key', 'legacy-admin-key', 'admin'] as const

function isRealIdentity(actor: string | null | undefined): actor is string {
  if (!actor) return false
  return !(NON_IDENTITIES as readonly string[]).includes(actor)
}

export type SelfApprovalCheck =
  | { ok: true }
  | { ok: false; reason: 'self_approval'; lastAuthor: string }

/**
 * يمنع الشخص من اعتماد محتوى هو آخر من عدّله.
 *
 * يُستدعى قبل كتابة الاعتماد. يُرجِع `ok: true` عند عدم وجود سجل تأليف معروف،
 * فالقاعدة لا تمنع ما لا تستطيع إثباته — منع الاعتماد على مجرد غياب دليل يعطّل
 * مراجعة المحتوى القديم بلا سبب.
 *
 * المالك مستثنى بشرط: القسم 9 يسمح باستثناء مالك المنصّة «في الحالات الطارئة،
 * مع تسجيل السبب». لذلك لا يُستثنى تلقائيًا هنا؛ المتصل هو من يقرّر تمرير
 * `allowOverride` ويُسجّل ذلك في التدقيق.
 */
export async function checkSelfApproval(
  db: D1Database,
  options: {
    entityType: string
    entityId: string
    /// هوية من يحاول الاعتماد، من الجلسة لا من جسم الطلب
    approverId: string
    /// استثناء صريح لمالك المنصّة في حالة طارئة، ويُسجَّل
    allowOverride?: boolean
  },
): Promise<SelfApprovalCheck> {
  if (options.allowOverride) return { ok: true }
  if (!isRealIdentity(options.approverId)) return { ok: true }

  const placeholders = AUTHORING_ACTIONS.map(() => '?').join(', ')
  const row = await queryFirst<{ actor_id: string | null }>(db, `
    SELECT actor_id
      FROM audit_logs
     WHERE entity_type = ?
       AND entity_id = ?
       AND action IN (${placeholders})
     ORDER BY created_at DESC
     LIMIT 1
  `, [options.entityType, options.entityId, ...AUTHORING_ACTIONS])

  const lastAuthor = row?.actor_id ?? null
  if (!isRealIdentity(lastAuthor)) return { ok: true }
  if (lastAuthor !== options.approverId) return { ok: true }

  return { ok: false, reason: 'self_approval', lastAuthor }
}

/// رسالة الرفض بالعربية، مشتركة بين المسارات فلا تتباعد صياغتها.
export const SELF_APPROVAL_ERROR =
  'لا يمكنك اعتماد محتوى أنت آخر من عدّله. الفصل بين الإنشاء والاعتماد قاعدة إلزامية.'
