/// منع تصعيد الصلاحيات، ونسبة المنح إلى فاعل حقيقي (`SEC-103`).
///
/// ## العلّة
///
/// `manage_permissions` كانت **مفتاح المنصّة كلّها**: من يملكها يستطيع أن يمنح
/// نفسه `owner`. والحرس كان موجودًا (`requirePermission('manage_permissions')`)
/// والمقارنة غائبة — أي أن السؤال المطروح كان «هل تستطيع منح الأدوار؟» لا «هل
/// تستطيع منح **هذا** الدور؟».
///
/// وكانت مقارنة واحدة قائمة في `POST /users/:id/grants` وحدها، فبقيت خمسة أبواب
/// تتجاوزها:
///
/// | الباب | كيف كان يُصعّد |
/// |---|---|
/// | `POST /users` | يُنشئ مستخدمًا جديدًا بدور `owner` مباشرة |
/// | `POST /grants` | يمنح أي دور لأي أحد بلا مقارنة ولا تحقّق من وجود الدور |
/// | `POST /roles` | يخلق دورًا يحمل `manage_billing` ثم يمنحه لنفسه |
/// | `PATCH /roles/:id` | يمنح نفسه دورًا مخصَّصًا ثم يرفع صلاحياته |
/// | `POST /teams` | يضيف نفسه إلى فريق يحمل منحًا أعلى |
///
/// ## القاعدة: مجموعة فرعية لا رتبة
///
/// **لا تُعطِ ما لا تملك.** الجواب مقارنةُ مجموعتَي صلاحيات لا رتبةٌ للأدوار.
///
/// ورُفض اختراع عمود `rank` على `roles`: يحتاج قيمة لكل دور مخصَّص يُنشأ لاحقًا،
/// ويصير رقمًا يُصان بيد إنسان بجانب الحقيقة الفعلية (`role_permissions`). ورقمان
/// يفترقان يعني حرسًا يسمح بما تمنعه الحقيقة. والمجموعة الفرعية تُقرأ من نفس
/// الجدول الذي يُنفَّذ به التصريح، فلا موضع لافتراقهما.
///
/// ## و`owner`/`system_admin` يتخطّيان
///
/// يملكان كل صلاحية أصلًا، فاختبار المجموعة الفرعية يمرّ لهما على كل حال —
/// والتخطّي الصريح يُبقي بذر مالك أوّل ممكنًا.

import { queryAll, queryFirst } from './db.ts';
import { isSuperuser, type AdminSessionUser } from './adminUsers.ts';

/// الفاعل كما يراه هذا الملف.
///
/// `undefined` تعني وضع الطوارئ قبل بذر أول حساب: لا فاعل ليُقارَن به، و
/// `requireAdmin` يرفض هذا المسار بمجرد وجود مستخدم واحد.
export type Actor = AdminSessionUser | undefined;

/// صلاحيات دور من الحقيقة (`role_permissions`) لا من قائمة مكتوبة.
export async function permissionsOfRole(db: D1Database, roleId: string): Promise<string[]> {
  const rows = await queryAll<{ permission_id: string }>(
    db, 'SELECT permission_id FROM role_permissions WHERE role_id = ?', [roleId],
  );
  return rows.map((row) => row.permission_id);
}

/// الصلاحيات التي يطلبها هذا المنح ولا يملكها الفاعل، أو `null` إن كان داخل حدّه.
///
/// المقارنة على `permissions` المسطّحة عن قصد: هي «ما يملكه في أي نطاق». وتضييقها
/// بالنطاق كان سيمنع قائد قسم من منح دوره لعضو في قسمه — وهو الاستخدام المشروع
/// الوحيد لهذه الشاشة.
export function permissionsBeyondActor(actor: Actor, requested: readonly string[]): string[] | null {
  if (!actor) return null;
  if (isSuperuser(actor)) return null;
  const held = new Set(actor.permissions);
  const missing = [...new Set(requested)].filter((permission) => !held.has(permission)).sort();
  return missing.length ? missing : null;
}

/// نفس الفحص لدور بمعرّفه.
export async function roleBeyondActor(
  db: D1Database, actor: Actor, roleId: string,
): Promise<string[] | null> {
  if (!actor || isSuperuser(actor)) return null;
  return permissionsBeyondActor(actor, await permissionsOfRole(db, roleId));
}

/// ردّ الرفض الموحَّد.
///
/// يذكر **الصلاحيات الناقصة بالاسم**: من يحاول منحًا مشروعًا يحتاج أن يعرف ما
/// يمنعه، والقائمة ليست سرًّا — هي صلاحيات الدور المطلوب، وهي معروضة أصلًا في
/// شاشة الأدوار.
export function escalationRefusal(missing: string[]) {
  return {
    success: false as const,
    code: 'privilege_escalation' as const,
    error: 'لا يمكنك منح صلاحيات لا تملكها',
    details: { missing_permissions: missing },
  };
}

/// قيمة `granted_by` التي تصلح للتخزين، أو `null`.
///
/// ## العلّة
///
/// العمود مُعلَن `REFERENCES admin_users(id)`، و**D1 لا يفرض المفاتيح الأجنبية**
/// بلا `PRAGMA foreign_keys` لكل اتصال. فكان يُخزَّن فيه نصوص ليست معرّفات:
/// `'legacy-admin-key'` من `actorId`، **وقيمة ترويسة يكتبها المتصل** عبر
/// `auditActor` (`X-Admin-Actor`). أي أن سجلّ «من منح هذه الصلاحية» كان قابلًا
/// للتلفيق من الطلب نفسه.
///
/// ## القرار: `NULL` لا نصّ مختلق
///
/// حين لا يكون الفاعل مستخدمًا قائمًا — وضع الطوارئ قبل بذر أول حساب — يُخزَّن
/// `NULL`. ونسبةُ الفعل تبقى محفوظة في `audit_logs` حيث يظهر `legacy-admin-key`
/// صريحًا.
///
/// و`NULL` أصدق من نصّ يشبه المعرّف: الأولى تقول «غير منسوب»، والثانية تقول
/// «منسوب إلى كائن غير موجود» — وهي كذبة يصعب اكتشافها في مراجعة.
export async function verifiedGrantedBy(db: D1Database, actor: Actor): Promise<string | null> {
  if (!actor) return null;
  const row = await queryFirst<{ id: string }>(
    db, 'SELECT id FROM admin_users WHERE id = ?', [actor.id],
  );
  return row?.id ?? null;
}

/// هل إزالة هذا المنح تُسقط آخر مالك للمنصّة؟
///
/// كان هذا الحرس في `DELETE /users/:id/grants/:grantId` وحده، و`DELETE /grants/:id`
/// في موجّه الفرق يحذف بالمعرّف بلا أي فحص — أي بابٌ خلفيّ يُفرغ المنصّة من
/// مالكها بطلب واحد.
export async function isLastOwnerGrant(db: D1Database, roleId: string): Promise<boolean> {
  if (roleId !== 'owner') return false;
  const owners = await queryFirst<{ total: number }>(db, `
    SELECT COUNT(*) AS total FROM access_grants
     WHERE role_id = 'owner' AND grantee_type = 'user'
       AND (valid_until IS NULL OR valid_until > datetime('now'))
  `);
  return Number(owners?.total ?? 0) <= 1;
}
