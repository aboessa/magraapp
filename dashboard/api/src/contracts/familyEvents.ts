/// كل نوع حدث يستطيع `do/FamilyState.ts` إصداره في الـoutbox.
///
/// ## العلّة التي أغلقها توسيع هذه القائمة (PRIV-102)
///
/// الـoutbox يقبل أي نوع (`addOutbox(type, …)` لا يتحقّق منه)، ومسلِّم الـoutbox
/// يرسل كل صف معلّق إلى الطابور، ثم `parseFamilyEvent` هنا يرفض ما ليس في هذه
/// القائمة فيصير `invalid_event` ويُستهلَك بـ`console.warn` ثم `ack()`.
///
/// أي أن سبعة أنواع كانت تُصدَر فعلًا وتُدمَّر صامتةً بعد التسليم:
/// `device.revoked` و`downloads.revoked` و`child.updated`
/// و`child.track_transitioned` و`family.resynced` و`parent_pin.changed`
/// و`parent_pin.enrolled`. اثنان منها إبطال أمني (جهاز، تنزيلات) وواحد تغيير
/// بيانات اعتماد وليّ الأمر — أي أن أهم ما يحتاجه سجل التدقيق كان أول ما يُفقَد.
///
/// القائمة الآن مطابقة لما يُصدره الـDO. إضافة `addOutbox` بنوع جديد دون إضافته
/// هنا تعيد الخطأ نفسه، ولهذا يثبّت `test/familyAudit.test.mjs` التطابق بين
/// الاثنين بمسح المصدر.
export const FAMILY_EVENT_TYPES = [
  'family.initialized',
  'family.updated',
  'family.resynced',
  'family.deletion_requested',
  'family.deleted',
  'session.created',
  'session.revoked',
  'device.revoked',
  'downloads.revoked',
  'parent_pin.enrolled',
  'parent_pin.changed',
  'child.created',
  'child.updated',
  'child.track_transitioned',
  'child.deleted',
  'progress.updated',
  'content.completed',
  'favorite.updated',
  'playback.started',
  'playback.revoked',
  'playback.ended',
  'entitlement.updated',
  'data.exported',

  // ENC-001 — تراخيص الاستخدام دون إنترنت. السلطة في الـDO، وهذه الأحداث هي
  // ما يبني إسقاط D1 (`media_licenses`, `child_downloads`, `download_events`).
  'offline_license.issued',
  'offline_license.completed',
  'offline_license.renewed',
  'offline_license.revoked',
] as const;

export type FamilyEventType = typeof FAMILY_EVENT_TYPES[number];

export type FamilyEvent = {
  eventId: string;
  type: FamilyEventType;
  schemaVersion: 1;
  parentId: string;
  occurredAt: number;
  payload: Record<string, unknown>;
};

export function parseFamilyEvent(value: unknown): FamilyEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (typeof event.eventId !== 'string' || event.eventId.length < 8 || event.eventId.length > 200) return null;
  if (typeof event.parentId !== 'string' || event.parentId.length < 8 || event.parentId.length > 200) return null;
  if (typeof event.type !== 'string' || !FAMILY_EVENT_TYPES.includes(event.type as FamilyEventType)) return null;
  if (event.schemaVersion !== 1 || !Number.isInteger(event.occurredAt) || Number(event.occurredAt) < 1) return null;
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return null;
  return event as FamilyEvent;
}
