/// سجل تدقيق مسار العميل — PRIV-102.
///
/// ## العلّة
///
/// `audit_logs` كان يغطّي اللوحة وحدها: 32 صفًّا كلها إدارية، وصفر صف لأي عملية
/// على مسار الأسرة. أي أن منح ترخيص تشغيل، وإبطال جهاز، وتسجيل جلسة، وتصدير
/// بيانات الحساب، وطلب الحذف — كلها كانت تحدث بلا أثر قابل للمراجعة. خطة
/// الحماية تطلب العكس صراحةً: «Audit Logs لكل جلسة وإلغاء» مع استثناء الرابط
/// الكامل والتوكن ومفاتيح الطفل (تشفير المحتوي.md:1213).
///
/// ## لماذا الكتابة في مستهلك الطابور لا في المسار الساخن
///
/// كل عملية مؤهَّلة للتدقيق تُصدر أصلًا حدث outbox داخل نفس المعاملة التي
/// تُغيّر الحالة. فالكتابة من المستهلك تعني:
///
///   1. **لا فقدان**: الحدث محفوظ في الـoutbox قبل أن يرى العميل الاستجابة،
///      والمستهلك يعيد المحاولة، والفشل النهائي يذهب إلى `failed_family_events`.
///      كتابة D1 من داخل الـDO كانت ستضيف نداءً شبكيًا داخل معاملة، وفشله يترك
///      الحالة متغيّرة بلا سجل — وهو بالضبط الفشل الصامت الذي نغلقه.
///   2. **لا تكلفة على زمن الاستجابة**: مسار `POST /playback/start` لا يكتب صفًّا
///      إضافيًا.
///   3. **idempotent مجانًا**: `event_id` هو مفتاح الجدول، والطابور at-least-once.
///
/// ## ما لا يُدقَّق، وعن قصد
///
///   * `progress.updated` و`content.completed` و`favorite.updated`: سلوك تعلّمي
///     عالي الحجم، لا فعل أمني. تدقيقها يجعل الجدول أكبر من كل ما عداه ويطمر
///     الأحداث التي تُراجَع فعلًا، ويحوّل سجل التدقيق إلى سجل مشاهدة طفل — أي
///     يخالف الخصوصية التي أُنشئ لحمايتها.
///   * **تجديد الترخيص عند كل نبضة**: النبضة كل دقائق لكل جلسة نشطة، فصفٌّ لكل
///     تجديد يعني آلاف الصفوف لطفل واحد في مساء واحد. التجديد ليس قدرة جديدة
///     بل تمديد لمنحة مُدقَّقة، و`playback.started`/`playback.ended` يحدّان
///     المظروف الزمني، و`playback.revoked` يُسجّل كل إبطال بسببه. متابعة
///     مسجَّلة في §15 من الأودت إن طُلب أثر لكل تمديد.

import type { FamilyEvent, FamilyEventType } from '../contracts/familyEvents.ts';
import { serializeAuditDetails } from './auditLog.ts';

/// نوع الفاعل، مستخلَص من الحمولة لا من ثقة بالمتصل.
///
/// المسارات الإدارية في `FamilyState` تضيف `by: 'operator'` و`operator_id`
/// و`reason` إلى الحمولة (`adminRevokeDevice`, `adminRevokeDownloads`,
/// `adminResync`)، وما خلاها فعل وليّ أمر من جلسة مُصادَقة.
///
/// `family.deleted` و`child.deleted` يُصدرهما المنبّه لا الطلب، لكنهما يُنسَبان
/// إلى وليّ الأمر لا إلى `system`: الفعل فعله، والمنبّه منفّذ مؤجَّل، وطلبه
/// نفسه مُدقَّق في `family.deletion_requested` بنفس `requestId`. `system` محفوظ
/// لفعل ينشأ داخل النظام بلا طلب من أحد، ولا يُصدره أي مسار اليوم.
export type FamilyAuditActorKind = 'parent' | 'operator' | 'system';

/// الكيان الذي يخصّه الحدث، حتى يمكن سؤال «ما جرى لهذا الجهاز/الترخيص».
type EntityResolver = (payload: Record<string, unknown>, parentId: string) => {
  entityType: string;
  entityId: string | null;
};

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const family: EntityResolver = (_payload, parentId) => ({ entityType: 'family', entityId: parentId });
const child: EntityResolver = (payload) => ({ entityType: 'child', entityId: str(payload.childId) });
const device: EntityResolver = (payload) => ({ entityType: 'device', entityId: str(payload.deviceId) });
const session: EntityResolver = (payload) => ({ entityType: 'auth_session', entityId: str(payload.sessionId) });
const lease: EntityResolver = (payload) => ({ entityType: 'playback_lease', entityId: str(payload.leaseId) });

/// الأحداث المؤهَّلة للتدقيق، وكيف يُقرأ كيان كل منها.
///
/// القائمة صريحة لا استبعادية: نوع حدث جديد لا يُدقَّق حتى يُضاف هنا بقرار،
/// وهو الاتجاه الآمن للخصوصية — الخطأ الافتراضي «لم يُسجَّل» لا «سُجِّل كل شيء».
const AUDITED: Partial<Record<FamilyEventType, EntityResolver>> = {
  // دورة حياة الحساب والهوية
  'family.initialized': family,
  'family.updated': family,
  'family.resynced': family,
  'family.deletion_requested': (payload, parentId) => (
    payload.scope === 'child'
      ? { entityType: 'child', entityId: str(payload.childId) }
      : { entityType: 'family', entityId: parentId }
  ),
  'family.deleted': family,
  'data.exported': family,

  // المصادقة والأجهزة
  'session.created': session,
  // `scope: 'all' | 'others'` لا يحمل معرّف جلسة واحدة؛ الكيان يصير الأسرة.
  'session.revoked': (payload, parentId) => (
    str(payload.sessionId)
      ? { entityType: 'auth_session', entityId: str(payload.sessionId) }
      : { entityType: 'family', entityId: parentId }
  ),
  'device.revoked': device,
  'downloads.revoked': device,
  'parent_pin.enrolled': family,
  'parent_pin.changed': family,

  // الأطفال
  'child.created': child,
  'child.updated': child,
  'child.track_transitioned': child,
  'child.deleted': child,

  // الترخيص والاستحقاق
  //
  // ENC-001: منح ترخيص الاستخدام دون إنترنت وتجديده وإبطاله أفعال أمنية بامتياز
  // — نسخة محفوظة على جهاز تعيش أيامًا، فسؤال «من رخّص هذا الملف ومتى وأي جهاز»
  // لا بديل عنه.
  'offline_license.issued': (payload) => ({
    entityType: 'offline_license',
    entityId: str(payload.licenseId),
  }),
  'offline_license.completed': (payload) => ({
    entityType: 'offline_license',
    entityId: str(payload.licenseId),
  }),
  'offline_license.renewed': (payload) => ({
    entityType: 'offline_license',
    entityId: str(payload.licenseId),
  }),
  'offline_license.revoked': (payload, parentId) => ({
    // الإبطال قد يشمل تراخيص عدّة لجهاز واحد، فالكيان هو الجهاز حين لا يكون
    // ترخيصًا واحدًا بعينه.
    entityType: str(payload.deviceId) ? 'device' : 'family',
    entityId: str(payload.deviceId) ?? parentId,
  }),
  'playback.started': lease,
  'playback.revoked': lease,
  'playback.ended': lease,
  'entitlement.updated': (payload) => ({
    entityType: 'entitlement',
    entityId: str(payload.entitlementId),
  }),
};

export function isAuditedFamilyEvent(type: FamilyEventType): boolean {
  return Object.prototype.hasOwnProperty.call(AUDITED, type);
}

function actorKind(payload: Record<string, unknown>): FamilyAuditActorKind {
  const by = payload.by;
  if (by === 'operator') return 'operator';
  if (by === 'system') return 'system';
  return 'parent';
}

/// معرّف الفاعل.
///
/// للمسؤول: معرّف حسابه كما أرسله المسار الإداري بعد التحقّق منه.
/// لوليّ الأمر: `parentId` نفسه ولا شيء غيره — لا `session_id` ولا بصمة جهاز،
/// لأن الجلسة والجهاز مُسجَّلان في `entity_id`/`details` عند لزومهما، وتكرارهما
/// في خانة الفاعل يجعل من السجل أداة تتبّع أوسع من غرضه.
function resolveActorId(payload: Record<string, unknown>, parentId: string, kind: FamilyAuditActorKind) {
  if (kind === 'operator') return str(payload.operator_id) ?? 'unknown_operator';
  if (kind === 'system') return 'system';
  return parentId;
}

/// بيان SQL جاهز للإدراج في نفس `DB.batch` الذي يطبّق الإسقاط.
///
/// يعود `null` لحدث غير مؤهَّل، فالمتصل لا يحتاج فحصًا مسبقًا.
///
/// `INSERT OR IGNORE`: إعادة تسليم الحدث نفسه — أو إعادة تشغيله من
/// `failed_family_events` — يجب أن تُنتج صفًّا واحدًا، لا صفًّا لكل محاولة.
export function familyAuditStatement(
  db: D1Database,
  event: FamilyEvent,
): D1PreparedStatement | null {
  const resolver = AUDITED[event.type];
  if (!resolver) return null;

  const payload = event.payload ?? {};
  const kind = actorKind(payload);
  const { entityType, entityId } = resolver(payload, event.parentId);

  return db.prepare(`
    INSERT OR IGNORE INTO family_audit_logs (
      event_id, parent_id, action, actor_kind, actor_id,
      entity_type, entity_id, details, occurred_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    event.eventId,
    event.parentId,
    event.type,
    kind,
    resolveActorId(payload, event.parentId, kind),
    entityType,
    entityId,
    // نفس منقّح مسار اللوحة: لا توكن، ولا رابط مُوقَّع كامل، ولا `nickname`
    // ولا شهر/سنة ميلاد. `child.created` يحمل `nickname` في حمولته فعلًا،
    // وهذا ما يمسحه قبل الوصول إلى الجدول.
    serializeAuditDetails(payload),
    event.occurredAt,
  );
}
