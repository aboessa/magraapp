/// Customer 360: one operational view of a family.
///
/// ## What it composes, and from where
///
/// Three sources, and which one answers which question is the whole design:
///
///  * **FamilyState (authority)** — plan, entitlement ledger, devices, sessions, active
///    leases. Anything a support conversation needs *in the present* comes from here,
///    because the D1 projection is queue-fed and therefore behind by design.
///  * **D1 projections** — the family and child rows, the billing audit trail, the
///    purchase records. These are the right source for anything historical or
///    cross-account, and for anything the authority does not keep.
///  * **Admin tables** — support tickets, audit log. Operational context that belongs to
///    the dashboard rather than to the family.
///
/// No authority moves into D1 for the dashboard's convenience. When the Durable Object
/// is unreachable, the affected section reports that explicitly and the rest of the page
/// still loads — a 503 for the whole workspace because one section failed would make the
/// screen useless exactly when it is needed.
///
/// ## What is deliberately not exposed
///
/// Child nicknames come from `child_projection`, which the admin already reads, but
/// nothing here surfaces a child's watch history, favourites, creations or progress
/// detail. A support operator resolving a billing or device problem has no need for what
/// a six-year-old watched, and the earlier narrowing of the family lookup (no install
/// hashes, no purchase hashes, no `auth_epoch` leakage to the client) was done for the
/// same reason. Progress is returned only as a count.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { requireAdmin } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';
import { callDurable, familyStub } from '../lib/doClient.ts';
import { parsePagination } from '../lib/catalogueValidation.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

/// A section that could not be loaded, reported rather than silently empty.
interface Unavailable {
  available: false;
  source: string;
  reason: string;
}

/// `GET /admin/customers` — the family list, for the entry point into 360.
route.get('/customers', requireAdmin, async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), { defaultLimit: 25, maxLimit: 100 });
  const search = c.req.query('q')?.trim();
  const plan = c.req.query('plan');
  const status = c.req.query('status');

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (search) { clauses.push('f.parent_id LIKE ?'); params.push(`%${search}%`); }
  if (plan) { clauses.push('f.plan = ?'); params.push(plan); }
  if (status) { clauses.push('f.status = ?'); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const total = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM family_projection f ${where}`, params);
  // `DB-102`: لا عمود `device_count` هنا.
  //
  // كان `(SELECT COUNT(*) FROM account_devices …)`، و`account_devices` جدولٌ
  // **بلا كاتب واحد** في المستودع كلّه (صفر `INSERT`/`UPDATE` في `src` و
  // `scripts` و`migrations`؛ ملكيّته انتقلت إلى `FamilyState` وأعلن ذلك
  // `0010_cleanup_dead_d1_tables.sql`). فكان العمود يُعيد **صفرًا لكل أسرة**،
  // واللوحة تعرضه رقمًا — أي «صفر أجهزة» على منصّةٍ أجهزتها تعمل.
  //
  // والسلطة لكل أسرة في كائنها الدائم، ولا مصدر مُجمَّع عبر الأسر. فالصحيح
  // **ألّا يُرسَل الحقل**: عدَدٌ مُختلَق أسوأ من غيابه، و`null` يجعل اللوحة
  // تعرض «—» بسببٍ مكتوب بدل رقم يُصدَّق.
  const rows = await queryAll(c.env.DB, `
    SELECT f.parent_id, f.plan, f.status,
           (SELECT COUNT(*) FROM child_projection cp WHERE cp.parent_id = f.parent_id) AS child_count,
           NULL AS device_count,
           (SELECT COUNT(*) FROM support_tickets st WHERE st.family_id = f.parent_id
              AND st.status NOT IN ('resolved', 'closed')) AS open_tickets
      FROM family_projection f
      ${where}
     ORDER BY f.parent_id
     LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  return c.json({
    success: true,
    data: rows,
    meta: {
      total: Number(total?.total ?? 0),
      limit,
      offset,
      // سببٌ يُقرأ في اللوحة، لا حقلٌ ناقص بلا تفسير.
      unavailable: {
        device_count:
          'عدّ الأجهزة لكل أسرة غير متوفّر: `account_devices` في D1 بلا كاتب، والسلطة في FamilyState لكل أسرة على حدة فلا تجميع عبر الأسر.',
      },
    },
  });
});

/// `GET /admin/customers/:id` — the full workspace payload.
route.get('/customers/:id', requireAdmin, async (c) => {
  const parentId = c.req.param('id') ?? '';
  const family = await queryFirst<{ parent_id: string; plan: string; status: string }>(c.env.DB, `
    SELECT parent_id, plan, status FROM family_projection WHERE parent_id = ?
  `, [parentId]);
  if (!family) return c.json({ success: false, error: 'Family not found' }, 404);

  // The authority read is allowed to fail on its own without taking the page with it.
  const authorityResult = await callDurable<{ success: boolean; data?: Record<string, unknown> }>(
    familyStub(c.env, parentId), '/admin/inspect', { method: 'GET' },
  );
  const authority: Record<string, unknown> | Unavailable = authorityResult.ok && authorityResult.data?.success
    ? { available: true, source: 'family_state', ...(authorityResult.data.data ?? {}) }
    : {
        available: false,
        source: 'family_state',
        reason: 'مصدر السلطة غير متاح الآن؛ هذا ليس «لا أجهزة» ولا «بلا اشتراك».',
      };

  const consentsResult = await callDurable<{ success: boolean; data?: unknown[] }>(
    familyStub(c.env, parentId), '/consents', { method: 'GET' },
  );

  const [children, devices, billing, purchases, tickets, audit, familyAudit] = await Promise.all([
    queryAll(c.env.DB, `
      SELECT child_id, nickname, age_track, status, last_event_at_ms
        FROM child_projection WHERE parent_id = ? ORDER BY last_event_at_ms DESC
    `, [parentId]),
    // `DB-102`: لا قراءة من `account_devices`.
    //
    // كان هنا استعلامٌ عليه، وتعليقٌ يبرّره بأن «الإسقاط يُحفظ بجانب الحيّ ليرى
    // المشغّل متى يتأخّر الإسقاط». والمقيس: الجدول **بلا كاتب واحد**، فالقائمة
    // فارغة **دائمًا** — أي أن المقارنة تقول «الإسقاط متأخّر إلى الأبد»، وهي
    // ليست معلومة بل ضجيج يُقرأ «لا أجهزة».
    //
    // والأجهزة تأتي أصلًا من قراءة السلطة (`/admin/inspect` أعلاه)، فالقائمة
    // الثانية كانت زائدة قبل أن تكون خاطئة.
    Promise.resolve<Unavailable>({
      available: false,
      source: 'account_devices (إسقاط D1 بلا كاتب)',
      reason:
        'ملكية الأجهزة انتقلت إلى FamilyState (`0010_cleanup_dead_d1_tables.sql`). القائمة الحيّة في `authority.devices`.',
    }),
    queryAll(c.env.DB, `
      SELECT product_id, plan, entitlement_status, expires_at_ms, created_at
        FROM billing_audit WHERE parent_id = ? ORDER BY created_at DESC LIMIT 25
    `, [parentId]),
    // `DB-102`: `google_play_purchases` أيضًا **بلا كاتب** (صفر `INSERT` في
    // المستودع)، فقائمة الشراءات كانت فارغة دائمًا. والفراغ هنا يبدو صادقًا
    // بالحادث — لا شراء لأن مسار الشراء نفسه غير موصول (`API-104`) — لكن سببه
    // ليس «لا شراءات» بل «لا كاتب». والفرق يهمّ يوم يُوصَل المسار: مشغّلٌ رأى
    // «لا شراءات» طويلًا لا يشكّ في القائمة عندما تبقى فارغة خطأً.
    //
    // (والملاحظة الأصلية تبقى صحيحة لمَن يوصّلها: لا رموز شراء ولا بصماتها في
    // هذا المخرَج — هي أوراق اعتماد لواجهة المتجر، والمشغّل يحتاج المنتج
    // والحالة والتواريخ لا المفتاح.)
    Promise.resolve<Unavailable>({
      available: false,
      source: 'google_play_purchases (جدول D1 بلا كاتب)',
      reason:
        'مسار التحقّق من الشراء غير موصول (`API-104` / `BILLING-001`)، فلا شيء يكتب هذا الجدول. الفراغ ليس «لا شراءات».',
    }),
    queryAll(c.env.DB, `
      SELECT id, reference, subject, category, priority, status, assignee_id,
             first_response_at, resolution_due_at, created_at
        FROM support_tickets WHERE family_id = ? ORDER BY created_at DESC LIMIT 25
    `, [parentId]).catch(() => []),
    // The audit trail for this family, which is how an operator answers "who touched
    // this account". Includes the operator device commands, since those are audited
    // against the device and the family id travels in the details.
    queryAll(c.env.DB, `
      SELECT action, entity_type, entity_id, actor_id, created_at
        FROM audit_logs
       WHERE (entity_type IN ('support_family', 'support_family_devices', 'family', 'family_device')
              AND entity_id = ?)
          OR (entity_type = 'family_device' AND details LIKE ?)
       ORDER BY created_at DESC LIMIT 30
    `, [parentId, `%${parentId}%`]),
    // PRIV-102: أثر مسار العميل نفسه — الجلسات والأجهزة ومنح التشغيل ودورة حياة
    // الحساب. جدول منفصل عن `audit_logs` عن قصد: ذاك سجل أفعال المسؤولين، وهذا
    // سجل أفعال الأسرة، ودمجهما كان يعني أن كل من يملك `view_audit_log` يقرأ
    // حركة الأسر. لا يُعطَّل القسم الصفحة إن غاب الجدول قبل تطبيق الترحيل.
    queryAll(c.env.DB, `
      SELECT action, actor_kind, actor_id, entity_type, entity_id, details, occurred_at_ms
        FROM family_audit_logs
       WHERE parent_id = ?
       ORDER BY occurred_at_ms DESC LIMIT 50
    `, [parentId]).catch(() => []),
  ]);

  // Reading a family is a sensitive act and is audited, as the narrower support lookup
  // already was. The count of sections is recorded rather than their contents.
  await auditStatement(c.env.DB, actorId(c), 'view', 'customer_360', parentId, {
    authority_available: (authority as { available?: boolean }).available === true,
    ticket_count: tickets.length,
  }).run();

  return c.json({
    success: true,
    data: {
      family,
      authority,
      children,
      devices_projection: devices,
      billing,
      purchases,
      tickets,
      audit,
      family_audit: familyAudit,
      consents: consentsResult.ok && consentsResult.data?.success
        ? consentsResult.data.data ?? []
        : { available: false, source: 'family_state', reason: 'تعذّر قراءة الموافقات من مصدر السلطة.' },
      // A count from the authority, not the rows: there is no admin-readable progress
      // projection in D1, and an operator does not need a child's viewing history. The
      // count comes from `/admin/inspect`, so when the authority is unreachable this
      // says so rather than reporting zero.
      progress_summary: (authority as { progress_records?: number }).progress_records === undefined
        ? { available: false, reason: 'تعذّر قراءة ملخّص التقدّم من مصدر السلطة.' }
        : { records: (authority as { progress_records?: number }).progress_records },
    },
    meta: {
      /// Where every section came from.
      ///
      /// The header of this file names three sources and says which one answers which
      /// question. Until now only `authority` carried that on the wire, so a screen
      /// rendering "devices" beside "devices" had no way to label which was the live read
      /// and which the projection — and `/admin/parents` already returns
      /// `meta.source`, so the convention existed and this endpoint did not follow it.
      /// Found by scripts/verify-customer360-e2e.mjs.
      ///
      /// `d1_projection` and `d1_history` are distinguished deliberately: a projection is
      /// eventually consistent behind the authority and may be stale, while a history
      /// table is the record of what happened and cannot be. An operator reading a device
      /// list needs to know which of the two they are looking at.
      sources: {
        family: 'd1_projection',
        authority: 'family_state',
        children: 'd1_projection',
        devices_projection: 'd1_projection',
        billing: 'd1_history',
        purchases: 'd1_history',
        tickets: 'd1_admin',
        audit: 'd1_admin',
        // سجل تاريخي لا إسقاط: يكتبه مستهلك الطابور من أحداث حدثت فعلًا،
        // ولا يُعاد بناؤه من حالة حاضرة، فلا يمكن أن «يتأخّر» عن مصدر السلطة.
        family_audit: 'd1_history',
        consents: 'family_state',
        progress_summary: 'family_state',
      },
      source_notes: {
        d1_projection: 'إسقاط في D1 يكتبه طابور الأحداث، فقد يتأخّر عن مصدر السلطة.',
        family_state: 'مصدر السلطة (Durable Object): الحاضر — الاستحقاق والأجهزة والجلسات.',
        d1_history: 'سجلّ تاريخي في D1: ما حدث فعلًا، ولا يتأخّر عن شيء.',
        d1_admin: 'جداول تشغيلية إدارية: التذاكر وسجل التدقيق.',
      },
    },
  });
});

export default route;
