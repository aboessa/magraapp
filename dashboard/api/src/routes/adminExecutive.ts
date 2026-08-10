/// Executive dashboard: one aggregate over the operational tables that now exist.
///
/// ## Why one endpoint and not twelve calls from the browser
///
/// The home screen asks twelve questions of eleven tables. Twelve round trips means the
/// page renders in twelve stages, each able to fail on its own, and an operator reading a
/// half-drawn dashboard cannot tell "nothing is wrong" from "that module has not arrived".
/// One request answers all of them in a handful of SQL statements, and a module that
/// genuinely cannot be answered says so in its own `unavailable` field.
///
/// ## Every metric carries the path that shows the same set
///
/// A number with no destination is a number nobody can act on: the previous home screen
/// displayed counts and the next question — *which* tickets, *which* pages — had no answer
/// except retyping filters by hand. Each metric here ships a `drill` path with the exact
/// filters, and the front end links it.
///
/// ## What is deliberately not here
///
/// No revenue, no churn, no conversion, no latency, no cache hit rate. There is no payment
/// provider configured and no Analytics Engine binding, so every one of those would be an
/// invented figure on the most-read screen in the product. They are listed in `limits`
/// instead, by name, with the reason.

import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryFirst } from '../lib/db.ts';
import { requireAdmin } from '../lib/adminAuth.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

type Tone = 'neutral' | 'good' | 'warn' | 'danger';

interface Metric {
  key: string;
  label_ar: string;
  label_en: string;
  value: number;
  tone: Tone;
  drill: string | null;
}

interface Module {
  key: string;
  label_ar: string;
  label_en: string;
  source: string;
  metrics: Metric[];
  unavailable: string | null;
}

const metric = (
  key: string,
  labelAr: string,
  labelEn: string,
  value: number,
  drill: string | null,
  /// النبرة تُحسب لا تُثبَّت: صفر عائق حالة جيدة، وعائق واحد حالة تحتاج تدخّلًا.
  tone: Tone = 'neutral',
): Metric => ({ key, label_ar: labelAr, label_en: labelEn, value, tone, drill });

/// النبرة حسب العدّاد: صفر = جيد، أي رقم = تحذير أو خطر.
const alertTone = (value: number, danger = false): Tone =>
  value === 0 ? 'good' : danger ? 'danger' : 'warn';

/// `GET /admin/dashboard/executive`
route.get('/dashboard/executive', requireAdmin, async (c) => {
  const db = c.env.DB;
  const modules: Module[] = [];
  const limits: string[] = [];

  // --- الدعم ---------------------------------------------------------------
  //
  // ساعتان منفصلتان: الردّ الأول والحلّ. تذكرة رُدَّ عليها في عشر دقائق وحُلَّت في
  // ثلاثة أيام تجربة جيدة؛ تذكرة حُلَّت في ثلاثة أيام بلا ردّ ليوميْن ليست كذلك،
  // ومؤشّر واحد لا يميّز بينهما.
  // `waiting_customer` مستثناة من خرق الحلّ: الساعة متوقّفة لأننا ننتظر العميل.
  const support = await queryFirst<Record<string, number>>(db, `
    SELECT
      (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open', 'in_progress')) AS open_tickets,
      (SELECT COUNT(*) FROM support_tickets WHERE status = 'waiting_customer') AS waiting_customer,
      (SELECT COUNT(*) FROM support_tickets
        WHERE first_response_at IS NULL AND first_response_due_at IS NOT NULL
          AND first_response_due_at < datetime('now')
          AND status NOT IN ('resolved', 'closed')) AS first_response_breached,
      (SELECT COUNT(*) FROM support_tickets
        WHERE resolved_at IS NULL AND resolution_due_at IS NOT NULL
          AND resolution_due_at < datetime('now')
          AND status NOT IN ('resolved', 'closed', 'waiting_customer')) AS resolution_breached,
      (SELECT COUNT(*) FROM support_tickets WHERE escalated_at IS NOT NULL AND status NOT IN ('resolved', 'closed')) AS escalated,
      (SELECT COUNT(*) FROM support_tickets WHERE assignee_id IS NULL AND status NOT IN ('resolved', 'closed')) AS unassigned
  `);
  modules.push({
    key: 'support',
    label_ar: 'الدعم',
    label_en: 'Support',
    source: 'support_tickets',
    unavailable: null,
    metrics: [
      metric('open', 'تذاكر مفتوحة', 'Open tickets', Number(support?.open_tickets ?? 0), '/support-center?status=open'),
      metric('first_response_breached', 'خرق مهلة الردّ الأول', 'First-response SLA breached', Number(support?.first_response_breached ?? 0), '/support-center?overdue=first_response', alertTone(Number(support?.first_response_breached ?? 0), true)),
      metric('resolution_breached', 'خرق مهلة الحلّ', 'Resolution SLA breached', Number(support?.resolution_breached ?? 0), '/support-center?overdue=resolution', alertTone(Number(support?.resolution_breached ?? 0), true)),
      metric('escalated', 'مُصعَّدة', 'Escalated', Number(support?.escalated ?? 0), '/support-center?status=open', alertTone(Number(support?.escalated ?? 0))),
      metric('unassigned', 'بلا مسؤول', 'Unassigned', Number(support?.unassigned ?? 0), '/support-center?status=open', alertTone(Number(support?.unassigned ?? 0))),
      metric('waiting_customer', 'بانتظار العميل', 'Waiting on customer', Number(support?.waiting_customer ?? 0), '/support-center?status=waiting_customer'),
    ],
  });

  // --- الإنتاج -------------------------------------------------------------
  //
  // العوائق والتواريخ المتأخّرة فقط. عدّاد «مراحل مكتملة» يحتاج تقييم مصفوفة
  // المتطلبات لكل حلقة وقصة، وهو نداء لكل عنصر — تكلفة لا تُبرّر على شاشة تُفتح
  // في كل تحديث. مركز الإنتاج نفسه يشتقّ الحالة الكاملة.
  const production = await queryFirst<Record<string, number>>(db, `
    SELECT
      (SELECT COUNT(*) FROM production_requirements WHERE blocker IS NOT NULL AND TRIM(blocker) <> '') AS blocked,
      (SELECT COUNT(*) FROM production_requirements WHERE due_at IS NOT NULL AND due_at < datetime('now')) AS overdue,
      (SELECT COUNT(*) FROM production_requirements WHERE assignee_id IS NULL AND team_id IS NULL) AS unowned,
      (SELECT COUNT(DISTINCT content_id) FROM production_requirements) AS tracked_items
  `);
  modules.push({
    key: 'production',
    label_ar: 'الإنتاج',
    label_en: 'Production',
    source: 'production_requirements',
    unavailable: null,
    metrics: [
      metric('blocked', 'متطلبات مُعطَّلة', 'Blocked requirements', Number(production?.blocked ?? 0), '/production', alertTone(Number(production?.blocked ?? 0), true)),
      metric('overdue', 'متأخّرة عن موعدها', 'Overdue requirements', Number(production?.overdue ?? 0), '/production', alertTone(Number(production?.overdue ?? 0))),
      metric('unowned', 'بلا مالك', 'Without an owner', Number(production?.unowned ?? 0), '/production', alertTone(Number(production?.unowned ?? 0))),
      metric('tracked_items', 'عناصر متابَعة', 'Items tracked', Number(production?.tracked_items ?? 0), '/production'),
    ],
  });

  // --- مسارات المراجعة -----------------------------------------------------
  const workflow = await queryFirst<Record<string, number>>(db, `
    SELECT
      (SELECT COUNT(*) FROM workflow_runs WHERE status = 'running') AS running,
      (SELECT COUNT(*) FROM workflow_run_stages
        WHERE due_at IS NOT NULL AND due_at < datetime('now')
          AND status IN ('pending', 'in_progress', 'changes_requested')) AS overdue_stages,
      (SELECT COUNT(*) FROM workflow_run_stages WHERE status = 'changes_requested') AS changes_requested,
      (SELECT COUNT(*) FROM content_reviews WHERE status = 'pending') AS pending_reviews
  `);
  modules.push({
    key: 'workflow',
    label_ar: 'المراجعة والحكومة',
    label_en: 'Review and governance',
    source: 'workflow_runs · workflow_run_stages · content_reviews',
    unavailable: null,
    metrics: [
      metric('running', 'مسارات جارية', 'Runs in progress', Number(workflow?.running ?? 0), '/workflows'),
      metric('overdue_stages', 'مراحل متأخّرة', 'Overdue stages', Number(workflow?.overdue_stages ?? 0), '/workflows', alertTone(Number(workflow?.overdue_stages ?? 0), true)),
      metric('changes_requested', 'مطلوب تعديلها', 'Changes requested', Number(workflow?.changes_requested ?? 0), '/workflows', alertTone(Number(workflow?.changes_requested ?? 0))),
      metric('pending_reviews', 'مراجعات معلّقة', 'Reviews pending', Number(workflow?.pending_reviews ?? 0), '/content-reviews'),
    ],
  });

  // --- الكتالوج ------------------------------------------------------------
  const content = await queryFirst<Record<string, number>>(db, `
    SELECT
      (SELECT COUNT(*) FROM series WHERE status = 'published') AS published_series,
      (SELECT COUNT(*) FROM series WHERE status NOT IN ('published', 'archived')) AS pipeline_series,
      (SELECT COUNT(*) FROM episodes WHERE is_published = 1) AS published_episodes,
      (SELECT COUNT(*) FROM episodes WHERE status = 'ready' AND is_published = 0) AS ready_unpublished_episodes,
      (SELECT COUNT(*) FROM stories WHERE status = 'published') AS published_stories,
      (SELECT COUNT(*) FROM games WHERE status = 'published') AS published_games
  `);
  modules.push({
    key: 'catalogue',
    label_ar: 'الكتالوج',
    label_en: 'Catalogue',
    source: 'series · episodes · stories · games',
    unavailable: null,
    metrics: [
      metric('published_series', 'سلاسل منشورة', 'Series published', Number(content?.published_series ?? 0), '/series?status=published'),
      metric('pipeline_series', 'سلاسل في الخطّ', 'Series in the pipeline', Number(content?.pipeline_series ?? 0), '/series'),
      metric('published_episodes', 'حلقات منشورة', 'Episodes published', Number(content?.published_episodes ?? 0), '/episodes'),
      // جاهزة ولم تُنشر: الحالة الوحيدة هنا التي تعني عملًا مكتملًا لا يراه أحد.
      metric('ready_unpublished_episodes', 'جاهزة ولم تُنشر', 'Ready, not published', Number(content?.ready_unpublished_episodes ?? 0), '/episodes?status=ready', Number(content?.ready_unpublished_episodes ?? 0) > 0 ? 'warn' : 'good'),
      metric('published_stories', 'قصص منشورة', 'Stories published', Number(content?.published_stories ?? 0), '/stories'),
      metric('published_games', 'ألعاب منشورة', 'Games published', Number(content?.published_games ?? 0), '/games-ops'),
    ],
  });

  // --- الموقع العام --------------------------------------------------------
  const website = await queryFirst<Record<string, number>>(db, `
    SELECT
      (SELECT COUNT(*) FROM web_pages WHERE status = 'published') AS published,
      (SELECT COUNT(*) FROM web_pages WHERE status = 'draft') AS draft,
      (SELECT COUNT(*) FROM web_pages WHERE status = 'review') AS review,
      (SELECT COUNT(*) FROM web_pages WHERE status = 'scheduled') AS scheduled,
      (SELECT COUNT(*) FROM web_pages p WHERE p.status = 'published'
         AND NOT EXISTS (SELECT 1 FROM web_page_sections s WHERE s.page_id = p.id AND s.is_active = 1)) AS published_empty
  `);
  modules.push({
    key: 'website',
    label_ar: 'الموقع العام',
    label_en: 'Public website',
    source: 'web_pages · web_page_sections',
    unavailable: null,
    metrics: [
      metric('published', 'صفحات منشورة', 'Pages published', Number(website?.published ?? 0), '/website/pages?status=published'),
      metric('review', 'في المراجعة', 'In review', Number(website?.review ?? 0), '/website/pages?status=review'),
      metric('scheduled', 'مجدولة', 'Scheduled', Number(website?.scheduled ?? 0), '/website/pages?status=scheduled&view=calendar'),
      metric('draft', 'مسوّدات', 'Drafts', Number(website?.draft ?? 0), '/website/pages?status=draft'),
      // صفحة منشورة بلا قسم مُفعَّل تُخدَم فارغة للزوّار. البوابة تمنع نشرها،
      // فوجودها يعني قسمًا عُطِّل بعد النشر.
      metric('published_empty', 'منشورة وفارغة', 'Published but empty', Number(website?.published_empty ?? 0), '/website/pages?status=published', alertTone(Number(website?.published_empty ?? 0), true)),
    ],
  });

  // --- المدوّنة ------------------------------------------------------------
  const blog = await queryFirst<Record<string, number>>(db, `
    SELECT
      (SELECT COUNT(*) FROM blog_posts WHERE status = 'published') AS published,
      (SELECT COUNT(*) FROM blog_posts WHERE status = 'draft') AS draft,
      (SELECT COUNT(*) FROM blog_posts WHERE status = 'review') AS review,
      (SELECT COUNT(*) FROM blog_posts WHERE status = 'scheduled') AS scheduled,
      (SELECT COUNT(*) FROM blog_posts WHERE status <> 'archived' AND author_id IS NULL) AS without_author,
      (SELECT COUNT(*) FROM blog_posts b
        WHERE b.status <> 'archived' AND b.source_type IS NOT NULL
          AND (b.religious_reviewer_id IS NULL OR b.religious_approved_at IS NULL)) AS awaiting_religious_review
  `);
  modules.push({
    key: 'blog',
    label_ar: 'المدوّنة',
    label_en: 'Blog',
    source: 'blog_posts',
    unavailable: null,
    metrics: [
      metric('published', 'مقالات منشورة', 'Posts published', Number(blog?.published ?? 0), '/blog/posts?status=published'),
      metric('scheduled', 'مجدولة', 'Scheduled', Number(blog?.scheduled ?? 0), '/blog/posts?status=scheduled&view=calendar'),
      metric('review', 'في المراجعة', 'In review', Number(blog?.review ?? 0), '/blog/posts?status=review'),
      metric('draft', 'مسوّدات', 'Drafts', Number(blog?.draft ?? 0), '/blog/posts?status=draft'),
      metric('without_author', 'بلا كاتب', 'Without an author', Number(blog?.without_author ?? 0), '/blog/posts', alertTone(Number(blog?.without_author ?? 0))),
      // المقال المُصنَّف دينيًا بلا مراجع مُسمّى وتاريخ لا يُنشر. عدّاده هنا لأن
      // البوابة تظهر عند محاولة النشر فقط، أي بعد انتهاء الكتابة.
      metric('awaiting_religious_review', 'بانتظار مراجعة شرعية', 'Awaiting religious review', Number(blog?.awaiting_religious_review ?? 0), '/blog/posts', alertTone(Number(blog?.awaiting_religious_review ?? 0))),
    ],
  });

  // --- SEO -----------------------------------------------------------------
  //
  // مجموعة فرعية رخيصة من `/admin/seo/audit`: الحقول الغائبة على كيان منشور،
  // محسوبة بـSQL. التدقيق الكامل يفحص التكرار والروابط الداخلية والأيتام ويقرأ
  // كل جسم مقال، وهو أثقل من أن يُشغَّل عند كل فتح للصفحة الرئيسية.
  const seo = await queryFirst<Record<string, number>>(db, `
    SELECT
      (SELECT COUNT(*) FROM web_pages p LEFT JOIN seo_meta m ON m.entity_type = 'web_page' AND m.entity_id = p.id
        WHERE p.status = 'published' AND (m.seo_title IS NULL OR TRIM(m.seo_title) = '')) AS pages_missing_title,
      (SELECT COUNT(*) FROM web_pages p LEFT JOIN seo_meta m ON m.entity_type = 'web_page' AND m.entity_id = p.id
        WHERE p.status = 'published' AND (m.meta_description IS NULL OR TRIM(m.meta_description) = '')) AS pages_missing_description,
      (SELECT COUNT(*) FROM blog_posts b LEFT JOIN seo_meta m ON m.entity_type = 'blog_post' AND m.entity_id = b.id
        WHERE b.status = 'published' AND (m.seo_title IS NULL OR TRIM(m.seo_title) = '')) AS posts_missing_title,
      (SELECT COUNT(*) FROM web_pages p JOIN seo_meta m ON m.entity_type = 'web_page' AND m.entity_id = p.id
        WHERE p.status = 'published' AND m.robots_index = 0) AS published_noindex,
      (SELECT COUNT(*) FROM web_redirects) AS redirects
  `);
  const seoCritical = Number(seo?.pages_missing_title ?? 0) + Number(seo?.posts_missing_title ?? 0);
  modules.push({
    key: 'seo',
    label_ar: 'SEO',
    label_en: 'SEO',
    source: 'seo_meta · web_pages · blog_posts (مجموعة فرعية من التدقيق الكامل)',
    unavailable: null,
    metrics: [
      metric('missing_title', 'عناوين SEO ناقصة', 'Missing SEO titles', seoCritical, '/seo?check=missing_title', alertTone(seoCritical, true)),
      metric('pages_missing_description', 'أوصاف ناقصة (صفحات)', 'Missing descriptions (pages)', Number(seo?.pages_missing_description ?? 0), '/seo?check=missing_description', alertTone(Number(seo?.pages_missing_description ?? 0))),
      metric('published_noindex', 'منشورة noindex', 'Published noindex', Number(seo?.published_noindex ?? 0), '/seo?check=published_noindex', alertTone(Number(seo?.published_noindex ?? 0))),
      metric('redirects', 'تحويلات', 'Redirects', Number(seo?.redirects ?? 0), '/seo'),
    ],
  });

  // --- العملاء والأجهزة ----------------------------------------------------
  const customers = await queryFirst<Record<string, number>>(db, `
    SELECT
      (SELECT COUNT(*) FROM family_projection WHERE status = 'active') AS active_families,
      (SELECT COUNT(*) FROM family_projection WHERE status = 'suspended') AS suspended_families,
      (SELECT COUNT(*) FROM family_projection WHERE status = 'active' AND plan <> 'free') AS paid_families,
      (SELECT COUNT(*) FROM child_projection WHERE status = 'active') AS active_children
  `);
  modules.push({
    key: 'customers',
    label_ar: 'العملاء',
    label_en: 'Customers',
    source: 'family_projection · child_projection (إسقاط من الطابور؛ مصدر السلطة FamilyState)',
    unavailable: null,
    metrics: [
      metric('active_families', 'عائلات نشطة', 'Active families', Number(customers?.active_families ?? 0), '/customers?status=active'),
      metric('paid_families', 'عائلات مدفوعة', 'Paying families', Number(customers?.paid_families ?? 0), '/customers'),
      metric('suspended_families', 'عائلات موقوفة', 'Suspended families', Number(customers?.suspended_families ?? 0), '/customers?status=suspended'),
      metric('active_children', 'أطفال نشطون', 'Active children', Number(customers?.active_children ?? 0), '/children'),
    ],
  });

  const devices = await queryFirst<Record<string, number>>(db, `
    SELECT
      (SELECT COUNT(*) FROM account_devices WHERE status = 'active') AS active_devices,
      (SELECT COUNT(*) FROM account_devices WHERE status = 'revoked') AS revoked_devices
  `);
  modules.push({
    key: 'devices',
    label_ar: 'الأجهزة',
    label_en: 'Devices',
    source: 'account_devices (إسقاط D1)',
    // الحدّ مذكور في الوحدة نفسها لا في حاشية: الإسقاط لم يعد يُكتب من مسار
    // التسجيل، فالعدّ تاريخي. القراءة الحيّة في مساحة عمل العائلة من FamilyState.
    unavailable: 'العدّ من إسقاط D1 الذي لم يعد مسار التسجيل يكتبه؛ القراءة الحيّة لكل عائلة في Customer 360.',
    metrics: [
      metric('active_devices', 'أجهزة نشطة (إسقاط)', 'Active devices (projection)', Number(devices?.active_devices ?? 0), '/devices-admin'),
      metric('revoked_devices', 'أجهزة مسحوبة (إسقاط)', 'Revoked devices (projection)', Number(devices?.revoked_devices ?? 0), '/devices-admin'),
    ],
  });

  // --- الحقوق والإتاحة ----------------------------------------------------
  const rights = await queryFirst<Record<string, number>>(db, `
    SELECT
      (SELECT COUNT(*) FROM content_rights) AS agreements,
      (SELECT COUNT(*) FROM content_rights WHERE expiry IS NOT NULL AND expiry < date('now')) AS expired,
      (SELECT COUNT(*) FROM content_rights WHERE expiry IS NOT NULL AND expiry >= date('now')
         AND expiry <= date('now', '+60 day')) AS expiring_soon,
      (SELECT COUNT(*) FROM content_availability WHERE mode = 'unavailable') AS withheld,
      (SELECT COUNT(*) FROM content_availability WHERE mode = 'selected_only') AS restricted
  `);
  modules.push({
    key: 'rights',
    label_ar: 'الحقوق والإتاحة',
    label_en: 'Rights and availability',
    source: 'content_rights · content_availability',
    unavailable: null,
    metrics: [
      metric('expired', 'اتفاقيات منتهية', 'Expired agreements', Number(rights?.expired ?? 0), '/rights', alertTone(Number(rights?.expired ?? 0), true)),
      metric('expiring_soon', 'تنتهي في ٦٠ يومًا', 'Expiring within 60 days', Number(rights?.expiring_soon ?? 0), '/rights', alertTone(Number(rights?.expiring_soon ?? 0))),
      metric('agreements', 'اتفاقيات', 'Agreements', Number(rights?.agreements ?? 0), '/rights'),
      metric('withheld', 'محتوى محجوب كليًا', 'Withheld everywhere', Number(rights?.withheld ?? 0), '/rights'),
      metric('restricted', 'محتوى مُقيَّد جغرافيًا', 'Geo-restricted', Number(rights?.restricted ?? 0), '/rights'),
    ],
  });

  // --- سلامة التشغيل ------------------------------------------------------
  const platform = await queryFirst<Record<string, number>>(db, `
    SELECT
      (SELECT COUNT(*) FROM failed_family_events WHERE resolved_at IS NULL) AS unresolved_dlq,
      (SELECT COUNT(*) FROM audit_logs WHERE created_at >= datetime('now', '-1 day')) AS audit_last_day
  `).catch(() => null);
  modules.push({
    key: 'platform',
    label_ar: 'سلامة التشغيل',
    label_en: 'Platform health',
    source: 'failed_family_events · audit_logs',
    unavailable: platform ? null : 'جدول أحداث العائلة الفاشلة غير متاح في قاعدة البيانات الحالية.',
    metrics: platform ? [
      metric('unresolved_dlq', 'أحداث فاشلة غير معالَجة', 'Unresolved failed events', Number(platform.unresolved_dlq ?? 0), '/failed-events', alertTone(Number(platform.unresolved_dlq ?? 0), true)),
      metric('audit_last_day', 'إجراءات إدارية (٢٤ ساعة)', 'Admin actions (24h)', Number(platform.audit_last_day ?? 0), '/audit-logs'),
    ] : [],
  });

  limits.push(
    'الإيرادات والاشتراكات المدفوعة والاسترجاعات: لا مزوّد دفع مُهيَّأ، فلا رقم مالي يمكن إثباته.',
    'زمن الاستجابة وعمق الطابور ونسبة الإصابة في الذاكرة المؤقتة: Analytics Engine غير مربوط.',
    'حالة الفهرسة في محرّكات البحث: لا تكامل مع Search Console؛ ما يُعرض هنا تدقيق داخلي فقط.',
    'اكتمال مراحل الإنتاج: مشتقّ من الأصول لكل عنصر على حدة في مركز الإنتاج، وأثقل من أن يُجمَّع هنا.',
    'عدّ الأجهزة من إسقاط D1 لا من مصدر السلطة؛ الفرق مذكور في وحدة الأجهزة.',
  );

  return c.json({
    success: true,
    data: {
      generated_at: new Date().toISOString(),
      modules,
      limits,
    },
  });
});

export default route;
