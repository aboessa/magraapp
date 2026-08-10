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
/// ## Zero and "we cannot tell" are different answers
///
/// Every count here used to end in `?? 0`. That reads a source which could not be read at
/// all as "there is none of it", and on the most-read screen in the product those two
/// answers lead to opposite decisions. So each module's row is read through [readRow],
/// which returns `null` when the statement fails, and a metric built from a `null` row
/// carries `value: null` with a reason in its own `unavailable` field rather than a zero.
/// `account_devices` is the standing case: no code path writes it (proved by
/// `scripts/verify-device-e2e.mjs`), so its count is not zero devices — it is unknowable
/// from D1, and it says so.
///
/// ## Every metric states its period, and names the list that reproduces it
///
/// A number with no destination is a number nobody can act on, and a number whose period is
/// unstated gets read as a rate. Each metric therefore carries:
///
/// - `window` — the period it covers (`current_state`, `last_24h`, `next_60_days`).
/// - `drill` — the admin screen path, with only filter keys that the target honours.
/// - `drill_api` — the admin list request that reproduces the same set, so the number and
///   the list can be compared by a machine rather than by eye.
/// - `drill_match` — `exact` when that request returns exactly this count, `related` when
///   the list endpoint cannot express the predicate. `related` requires a `note`; the type
///   below enforces it, so a metric cannot quietly be downgraded without stating why.
///
/// `scripts/verify-executive-e2e.mjs` drives all of this over HTTP and fails if an `exact`
/// metric disagrees with its list.
///
/// ## Test fixtures are not production content
///
/// `series.content_class` separates supplied platform test material from Majarra content
/// (migration 0018, `lib/contentClass.ts`). The catalogue counters here used to ignore it,
/// so a database whose only published series were the two fixture series reported "2 series
/// published, 14 episodes published" on the executive screen while Majarra had published
/// nothing. Every catalogue counter now restricts to `content_class = 'production'`, and
/// episodes, stories and games reach it through their series.
///
/// ## What is deliberately not here
///
/// No revenue, no churn, no conversion, no latency, no cache hit rate. There is no payment
/// provider configured and no Analytics Engine binding, so every one of those would be an
/// invented figure. They are listed in `limits` instead, by name, with the reason.

import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryFirst } from '../lib/db.ts';
import { requireAdmin } from '../lib/adminAuth.ts';
import { SQL_DEADLINE_PASSED } from '../lib/supportCrm.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

type Tone = 'neutral' | 'good' | 'warn' | 'danger';

/// The period a number covers, stated rather than implied.
type MetricWindow = 'current_state' | 'last_24h' | 'next_60_days';

/// Whether `drill_api` returns exactly this set, or a related one.
type DrillMatch = 'exact' | 'related';

interface Metric {
  key: string;
  label_ar: string;
  label_en: string;
  /// `null` means the source could not be read — never "zero of them".
  value: number | null;
  tone: Tone;
  window: MetricWindow;
  drill: string;
  drill_api: string;
  drill_match: DrillMatch;
  unavailable: string | null;
  note: string | null;
}

interface Module {
  key: string;
  label_ar: string;
  label_en: string;
  source: string;
  metrics: Metric[];
  unavailable: string | null;
}

interface MetricBase {
  key: string;
  ar: string;
  en: string;
  value: number;
  window: MetricWindow;
  drill: string;
  drillApi: string;
  tone?: Tone;
  /// Set when the source could not be read; forces `value` to null.
  unavailable?: string | null;
}

/// `related` carries a mandatory note: the reason the list cannot reproduce the count is
/// part of the payload, enforced by the compiler rather than by review.
type MetricSpec = MetricBase & (
  | { match: 'exact'; note?: string | null }
  | { match: 'related'; note: string }
);

const metric = (spec: MetricSpec): Metric => ({
  key: spec.key,
  label_ar: spec.ar,
  label_en: spec.en,
  value: spec.unavailable ? null : spec.value,
  // An unreadable source has no state to colour: green would read as "all clear".
  tone: spec.unavailable ? 'neutral' : (spec.tone ?? 'neutral'),
  window: spec.window,
  drill: spec.drill,
  drill_api: spec.drillApi,
  drill_match: spec.match,
  unavailable: spec.unavailable ?? null,
  note: spec.note ?? null,
});

/// النبرة حسب العدّاد: صفر = جيد، أي رقم = تحذير أو خطر.
const alertTone = (value: number, danger = false): Tone =>
  value === 0 ? 'good' : danger ? 'danger' : 'warn';

/// One aggregate row, or `null` when the statement could not run.
///
/// Every statement in this file is a single `SELECT` of scalar subqueries, so SQLite always
/// returns exactly one row. `null` therefore means the read failed — a missing table, a
/// renamed column — and never "no rows matched". That distinction is the whole reason this
/// helper exists instead of `?? 0` at every call site.
async function readRow(
  db: Env['DB'],
  sql: string,
  params: unknown[] = [],
): Promise<Record<string, number> | null> {
  try {
    return await queryFirst<Record<string, number>>(db, sql, params);
  } catch {
    return null;
  }
}

const count = (row: Record<string, number> | null, key: string): number => Number(row?.[key] ?? 0);

/// `YYYY-MM-DD HH:MM:SS` in UTC — the shape SQLite's `datetime()` produces, and the shape
/// `GET /admin/audit-logs` accepts in `from`/`to`, so one boundary serves both.
const sqlTimestamp = (date: Date): string => date.toISOString().slice(0, 19).replace('T', ' ');

/// Test fixtures are never production content; see the header and `lib/contentClass.ts`.
const PRODUCTION_SERIES = "s.content_class = 'production'";
/// Stories and games may hang off no series at all, and an unparented row is Majarra's.
const PRODUCTION_OR_UNPARENTED = "COALESCE(s.content_class, 'production') = 'production'";

const CATALOGUE_FIXTURE_NOTE =
  'العدّاد يستثني محتوى الاختبار (content_class = test_fixture)، وقائمة الكتالوج الإدارية لا تملك '
  + 'فلترًا لهذا الحقل، فقائمة الوجهة أوسع من العدّاد بمقدار عناصر الاختبار.';
const SUPPORT_LIVE_NOTE =
  'قائمة التذاكر لا تفلتر هذا الشرط؛ الوجهة تفتح التذاكر غير المُنجَزة (live=1) وهي مجموعة أوسع.';

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
  //
  // المهل مخزّنة بـ`new Date().toISOString()` («2026-08-11T02:09:03.591Z») بينما
  // `datetime('now')` تعطي «2026-08-10 21:53:44»، والمقارنة نصّية: 'T' (0x54) أكبر من
  // المسافة (0x20)، فمهلة انقضت قبل ساعة تبدو مستقبلية داخل اليوم نفسه. هذا العيب كان
  // هنا حتى هذه الجلسة: قاعدة البيانات المحلية فيها ٧ تذاكر خُرقت مهلة الردّ الأول فيها
  // وكانت اللوحة تعرض صفرًا. `SQL_DEADLINE_PASSED` من lib/supportCrm.ts يوحّد الشكلين،
  // وهو نفس المسند الذي تستخدمه قائمة التذاكر، فالرقم والقائمة لا يمكن أن يختلفا.
  const support = await readRow(db, `
    SELECT
      (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open', 'in_progress')) AS open_tickets,
      (SELECT COUNT(*) FROM support_tickets WHERE status = 'waiting_customer') AS waiting_customer,
      (SELECT COUNT(*) FROM support_tickets
        WHERE first_response_at IS NULL AND first_response_due_at IS NOT NULL
          AND ${SQL_DEADLINE_PASSED('first_response_due_at')}
          AND status NOT IN ('resolved', 'closed')) AS first_response_breached,
      (SELECT COUNT(*) FROM support_tickets
        WHERE resolution_due_at IS NOT NULL
          AND status NOT IN ('resolved', 'closed', 'waiting_customer')
          AND ${SQL_DEADLINE_PASSED('resolution_due_at')}) AS resolution_breached,
      (SELECT COUNT(*) FROM support_tickets WHERE escalated_at IS NOT NULL AND status NOT IN ('resolved', 'closed')) AS escalated,
      (SELECT COUNT(*) FROM support_tickets WHERE assignee_id IS NULL AND status NOT IN ('resolved', 'closed')) AS unassigned
  `);
  const supportGap = support ? null : 'تعذّرت قراءة جدول التذاكر، فأرقام الدعم غير معروفة الآن — وليست أصفارًا.';
  modules.push({
    key: 'support',
    label_ar: 'الدعم',
    label_en: 'Support',
    source: 'support_tickets',
    unavailable: supportGap,
    metrics: [
      metric({
        key: 'open', ar: 'تذاكر مفتوحة وقيد العمل', en: 'Open and in progress',
        value: count(support, 'open_tickets'), window: 'current_state', unavailable: supportGap,
        drill: '/support-center?live=1', drillApi: '/api/v1/admin/support/tickets?live=1&limit=1',
        match: 'related',
        note: 'العدّاد يجمع open و in_progress. قائمة التذاكر تفلتر حالة واحدة أو «غير مُنجَزة» (live=1)'
          + ' التي تضمّ «بانتظار العميل» أيضًا، فالوجهة أوسع بمقدار تلك التذاكر.',
      }),
      metric({
        key: 'first_response_breached', ar: 'خرق مهلة الردّ الأول', en: 'First-response SLA breached',
        value: count(support, 'first_response_breached'), window: 'current_state', unavailable: supportGap,
        tone: alertTone(count(support, 'first_response_breached'), true),
        drill: '/support-center?live=1', drillApi: '/api/v1/admin/support/tickets?live=1&limit=1',
        match: 'related',
        note: 'فلتر `overdue=1` في قائمة التذاكر يخصّ مهلة الحلّ فقط؛ لا فلتر لمهلة الردّ الأول،'
          + ' فالوجهة هي التذاكر غير المُنجَزة كلها.',
      }),
      metric({
        key: 'resolution_breached', ar: 'خرق مهلة الحلّ', en: 'Resolution SLA breached',
        value: count(support, 'resolution_breached'), window: 'current_state', unavailable: supportGap,
        tone: alertTone(count(support, 'resolution_breached'), true),
        drill: '/support-center?overdue=1', drillApi: '/api/v1/admin/support/tickets?overdue=1&limit=1',
        match: 'exact',
        note: 'نفس مسند القائمة حرفًا بحرف، فالرقم والقائمة يتطابقان.',
      }),
      metric({
        key: 'escalated', ar: 'مُصعَّدة', en: 'Escalated',
        value: count(support, 'escalated'), window: 'current_state', unavailable: supportGap,
        tone: alertTone(count(support, 'escalated')),
        drill: '/support-center?live=1', drillApi: '/api/v1/admin/support/tickets?live=1&limit=1',
        match: 'related', note: SUPPORT_LIVE_NOTE,
      }),
      metric({
        key: 'unassigned', ar: 'بلا مسؤول', en: 'Unassigned',
        value: count(support, 'unassigned'), window: 'current_state', unavailable: supportGap,
        tone: alertTone(count(support, 'unassigned')),
        drill: '/support-center?live=1', drillApi: '/api/v1/admin/support/tickets?live=1&limit=1',
        match: 'related',
        note: 'فلتر `assignee_id` يحتاج قيمة، فلا سبيل لطلب «بلا مسؤول» من القائمة؛ الوجهة هي'
          + ' التذاكر غير المُنجَزة كلها.',
      }),
      metric({
        key: 'waiting_customer', ar: 'بانتظار العميل', en: 'Waiting on customer',
        value: count(support, 'waiting_customer'), window: 'current_state', unavailable: supportGap,
        drill: '/support-center?status=waiting_customer',
        drillApi: '/api/v1/admin/support/tickets?status=waiting_customer&limit=1',
        match: 'exact',
      }),
    ],
  });

  // --- الإنتاج -------------------------------------------------------------
  //
  // `production_requirements` هو الطبقة البشرية فقط: مسؤول، فريق، موعد، عائق، ملاحظة.
  // لا عمود «مُنجَز» فيه — الاكتمال مشتقّ من الأصول لكل عنصر في `productionMatrix`. لذلك
  // «متأخّرة» هنا تعني حرفيًا «مضى موعدها»، لا «مضى موعدها ولم تُنجَز»، والعنوان يقول ذلك
  // بدل أن يترك القارئ يفترض الأقوى. المواعيد تُكتب ISO فتُقارَن بنفس التطبيع.
  const production = await readRow(db, `
    SELECT
      (SELECT COUNT(*) FROM production_requirements pr
         LEFT JOIN episodes e ON pr.content_type = 'episode' AND e.id = pr.content_id
         LEFT JOIN stories st ON pr.content_type = 'story' AND st.id = pr.content_id
         LEFT JOIN series s ON s.id = COALESCE(e.series_id, st.series_id)
        WHERE pr.blocker IS NOT NULL AND TRIM(pr.blocker) <> ''
          AND ${PRODUCTION_OR_UNPARENTED}) AS blocked,
      (SELECT COUNT(*) FROM production_requirements pr
         LEFT JOIN episodes e ON pr.content_type = 'episode' AND e.id = pr.content_id
         LEFT JOIN stories st ON pr.content_type = 'story' AND st.id = pr.content_id
         LEFT JOIN series s ON s.id = COALESCE(e.series_id, st.series_id)
        WHERE pr.due_at IS NOT NULL AND ${SQL_DEADLINE_PASSED('pr.due_at')}
          AND ${PRODUCTION_OR_UNPARENTED}) AS past_due,
      (SELECT COUNT(*) FROM production_requirements pr
         LEFT JOIN episodes e ON pr.content_type = 'episode' AND e.id = pr.content_id
         LEFT JOIN stories st ON pr.content_type = 'story' AND st.id = pr.content_id
         LEFT JOIN series s ON s.id = COALESCE(e.series_id, st.series_id)
        WHERE pr.assignee_id IS NULL AND pr.team_id IS NULL
          AND ${PRODUCTION_OR_UNPARENTED}) AS unowned,
      (SELECT COUNT(DISTINCT pr.content_id) FROM production_requirements pr
         LEFT JOIN episodes e ON pr.content_type = 'episode' AND e.id = pr.content_id
         LEFT JOIN stories st ON pr.content_type = 'story' AND st.id = pr.content_id
         LEFT JOIN series s ON s.id = COALESCE(e.series_id, st.series_id)
        WHERE ${PRODUCTION_OR_UNPARENTED}) AS tracked_items
  `);
  const productionGap = production
    ? null
    : 'تعذّرت قراءة جدول متطلبات الإنتاج، فأرقام الإنتاج غير معروفة الآن — وليست أصفارًا.';
  const PRODUCTION_BOARD_NOTE =
    'لوحة الإنتاج تُرقّم العناصر (حلقات/قصص) مع مصفوفة متطلبات كل عنصر، ولا مسار يُرقّم صفوف'
    + ' `production_requirements` نفسها، فالوجهة مجموعة مختلفة من العدّاد لا مرشَّحة منه.';
  modules.push({
    key: 'production',
    label_ar: 'الإنتاج',
    label_en: 'Production',
    source: 'production_requirements (الطبقة البشرية؛ الاكتمال يُشتقّ من الأصول في مركز الإنتاج)',
    unavailable: productionGap,
    metrics: [
      metric({
        key: 'blocked', ar: 'متطلبات بعائق مُعلَن', en: 'Requirements with a declared blocker',
        value: count(production, 'blocked'), window: 'current_state', unavailable: productionGap,
        tone: alertTone(count(production, 'blocked'), true),
        drill: '/production', drillApi: '/api/v1/admin/production/board?type=episode&with_publish=0&limit=1',
        match: 'related', note: PRODUCTION_BOARD_NOTE,
      }),
      metric({
        key: 'overdue', ar: 'متطلبات مضى موعدها', en: 'Requirements past their due date',
        value: count(production, 'past_due'), window: 'current_state', unavailable: productionGap,
        tone: alertTone(count(production, 'past_due')),
        drill: '/production', drillApi: '/api/v1/admin/production/board?type=episode&with_publish=0&limit=1',
        match: 'related',
        note: 'لا حالة إنجاز مخزّنة في جدول المتطلبات — الاكتمال يُشتقّ من الأصول لكل عنصر — فهذا'
          + ' العدّاد يعني «مضى الموعد» ولا يعني «مضى الموعد ولم يُنجَز». ' + PRODUCTION_BOARD_NOTE,
      }),
      metric({
        key: 'unowned', ar: 'بلا مالك', en: 'Without an owner',
        value: count(production, 'unowned'), window: 'current_state', unavailable: productionGap,
        tone: alertTone(count(production, 'unowned')),
        drill: '/production', drillApi: '/api/v1/admin/production/board?type=episode&with_publish=0&limit=1',
        match: 'related', note: PRODUCTION_BOARD_NOTE,
      }),
      metric({
        key: 'tracked_items', ar: 'عناصر لها متابعة بشرية', en: 'Items with human tracking',
        value: count(production, 'tracked_items'), window: 'current_state', unavailable: productionGap,
        drill: '/production', drillApi: '/api/v1/admin/production/board?type=episode&with_publish=0&limit=1',
        match: 'related',
        note: 'العدّاد يعدّ العناصر التي كُتب لها صفّ متطلب واحد على الأقل (إسناد أو موعد أو عائق)،'
          + ' لا كل العناصر في الخطّ. ' + PRODUCTION_BOARD_NOTE,
      }),
    ],
  });

  // --- مسارات المراجعة -----------------------------------------------------
  //
  // مواعيد المراحل تُكتب ISO أيضًا، فتُقارَن بنفس التطبيع. لاحظ أن
  // `GET /admin/workflows/overdue` — وجهة هذا العدّاد — لا تزال تقارن `due_at` نصًّا خامًّا،
  // فهي تُنقص خرقًا وقع في اليوم نفسه. لذلك العدّاد `related` لا `exact`، والملاحظة تقول
  // السبب بدل أن يُقرأ الفرق كخطأ في أحدهما.
  const workflow = await readRow(db, `
    SELECT
      (SELECT COUNT(*) FROM workflow_runs WHERE status = 'running') AS running,
      (SELECT COUNT(*) FROM workflow_run_stages rs
         JOIN workflow_runs wr ON wr.id = rs.run_id
        WHERE rs.due_at IS NOT NULL AND ${SQL_DEADLINE_PASSED('rs.due_at')}
          AND rs.status NOT IN ('approved', 'skipped')
          AND wr.status = 'running') AS overdue_stages,
      (SELECT COUNT(*) FROM workflow_run_stages WHERE status = 'changes_requested') AS changes_requested,
      (SELECT COUNT(*) FROM content_reviews WHERE status = 'pending') AS pending_reviews
  `);
  const workflowGap = workflow
    ? null
    : 'تعذّرت قراءة جداول المسارات والمراجعات، فأرقامها غير معروفة الآن — وليست أصفارًا.';
  modules.push({
    key: 'workflow',
    label_ar: 'المراجعة والحكومة',
    label_en: 'Review and governance',
    source: 'workflow_runs · workflow_run_stages · content_reviews',
    unavailable: workflowGap,
    metrics: [
      metric({
        key: 'running', ar: 'مسارات جارية', en: 'Runs in progress',
        value: count(workflow, 'running'), window: 'current_state', unavailable: workflowGap,
        drill: '/workflows', drillApi: '/api/v1/admin/workflows/runs?limit=1',
        match: 'related', note: 'قائمة المسارات لا تقبل فلتر حالة، فهي تُرجع كل المسارات لا الجارية فقط.',
      }),
      metric({
        key: 'overdue_stages', ar: 'مراحل مضى موعدها', en: 'Stages past their due date',
        value: count(workflow, 'overdue_stages'), window: 'current_state', unavailable: workflowGap,
        tone: alertTone(count(workflow, 'overdue_stages'), true),
        drill: '/workflows', drillApi: '/api/v1/admin/workflows/overdue',
        match: 'related',
        note: 'المسند هنا نفس مسند `GET /admin/workflows/overdue` إلا أنه يطبّع شكل التاريخ المخزّن؛'
          + ' ذلك المسار يقارن `due_at` نصًّا خامًّا فيُنقص الخرق الواقع في اليوم نفسه، فقد يعطي رقمًا أصغر.',
      }),
      metric({
        key: 'changes_requested', ar: 'مطلوب تعديلها', en: 'Changes requested',
        value: count(workflow, 'changes_requested'), window: 'current_state', unavailable: workflowGap,
        tone: alertTone(count(workflow, 'changes_requested')),
        drill: '/workflows', drillApi: '/api/v1/admin/workflows/runs?limit=1',
        match: 'related', note: 'العدّاد يعدّ المراحل، والقائمة تُرقّم المسارات، ولا فلتر لحالة المرحلة فيها.',
      }),
      metric({
        key: 'pending_reviews', ar: 'مراجعات معلّقة', en: 'Reviews pending',
        value: count(workflow, 'pending_reviews'), window: 'current_state', unavailable: workflowGap,
        drill: '/content-reviews?status=pending',
        drillApi: '/api/v1/admin/content-reviews?status=pending&limit=1',
        match: 'exact',
      }),
    ],
  });

  // --- الكتالوج ------------------------------------------------------------
  //
  // كل عدّاد مقصور على `content_class = 'production'`. قبل هذه الجلسة كانت هذه الوحدة
  // تعرض «٢ سلاسل منشورة» و«١٤ حلقة منشورة» و«١ لعبة منشورة» على قاعدة البيانات المحلية،
  // وكلها من مادة الاختبار المورّدة: محتوى مجرّة المنشور كان صفرًا.
  const content = await readRow(db, `
    SELECT
      (SELECT COUNT(*) FROM series s WHERE s.status = 'published' AND ${PRODUCTION_SERIES}) AS published_series,
      (SELECT COUNT(*) FROM series s WHERE s.status NOT IN ('published', 'archived') AND ${PRODUCTION_SERIES}) AS pipeline_series,
      (SELECT COUNT(*) FROM episodes e JOIN series s ON s.id = e.series_id
        WHERE e.is_published = 1 AND ${PRODUCTION_SERIES}) AS published_episodes,
      (SELECT COUNT(*) FROM episodes e JOIN series s ON s.id = e.series_id
        WHERE e.status = 'ready' AND e.is_published = 0 AND ${PRODUCTION_SERIES}) AS ready_unpublished_episodes,
      (SELECT COUNT(*) FROM stories st LEFT JOIN series s ON s.id = st.series_id
        WHERE st.status = 'published' AND ${PRODUCTION_OR_UNPARENTED}) AS published_stories,
      (SELECT COUNT(*) FROM games g LEFT JOIN series s ON s.id = g.series_id
        WHERE g.status = 'published' AND ${PRODUCTION_OR_UNPARENTED}) AS published_games
  `);
  const contentGap = content
    ? null
    : 'تعذّرت قراءة جداول الكتالوج، فأرقامه غير معروفة الآن — وليست أصفارًا.';
  modules.push({
    key: 'catalogue',
    label_ar: 'الكتالوج',
    label_en: 'Catalogue',
    source: 'series · episodes · stories · games (محتوى إنتاجي فقط: content_class = production)',
    unavailable: contentGap,
    metrics: [
      metric({
        key: 'published_series', ar: 'سلاسل منشورة', en: 'Series published',
        value: count(content, 'published_series'), window: 'current_state', unavailable: contentGap,
        drill: '/series?status=published', drillApi: '/api/v1/admin/series?status=published&limit=1',
        match: 'related', note: CATALOGUE_FIXTURE_NOTE,
      }),
      metric({
        key: 'pipeline_series', ar: 'سلاسل في الخطّ', en: 'Series in the pipeline',
        value: count(content, 'pipeline_series'), window: 'current_state', unavailable: contentGap,
        drill: '/series', drillApi: '/api/v1/admin/series?limit=1',
        match: 'related',
        note: 'العدّاد يستثني المنشورة والمؤرشفة ومحتوى الاختبار؛ القائمة الافتراضية تستثني المؤرشفة فقط.',
      }),
      metric({
        key: 'published_episodes', ar: 'حلقات منشورة', en: 'Episodes published',
        value: count(content, 'published_episodes'), window: 'current_state', unavailable: contentGap,
        drill: '/episodes?status=published', drillApi: '/api/v1/admin/episodes?status=published&limit=1',
        match: 'related',
        note: 'العدّاد يقرأ `is_published` (ما يُخدَم فعلًا)، والقائمة تفلتر عمود `status`. '
          + CATALOGUE_FIXTURE_NOTE,
      }),
      // جاهزة ولم تُنشر: الحالة الوحيدة هنا التي تعني عملًا مكتملًا لا يراه أحد.
      metric({
        key: 'ready_unpublished_episodes', ar: 'جاهزة ولم تُنشر', en: 'Ready, not published',
        value: count(content, 'ready_unpublished_episodes'), window: 'current_state', unavailable: contentGap,
        tone: count(content, 'ready_unpublished_episodes') > 0 ? 'warn' : 'good',
        drill: '/episodes?status=ready', drillApi: '/api/v1/admin/episodes?status=ready&limit=1',
        match: 'related',
        note: 'العدّاد يشترط `is_published = 0` أيضًا، والقائمة تفلتر الحالة وحدها. ' + CATALOGUE_FIXTURE_NOTE,
      }),
      metric({
        key: 'published_stories', ar: 'قصص منشورة', en: 'Stories published',
        value: count(content, 'published_stories'), window: 'current_state', unavailable: contentGap,
        drill: '/stories?status=published', drillApi: '/api/v1/admin/stories?status=published&limit=1',
        match: 'related', note: CATALOGUE_FIXTURE_NOTE,
      }),
      metric({
        key: 'published_games', ar: 'ألعاب منشورة', en: 'Games published',
        value: count(content, 'published_games'), window: 'current_state', unavailable: contentGap,
        drill: '/games-ops', drillApi: '/api/v1/admin/games?status=published&limit=1',
        match: 'related', note: CATALOGUE_FIXTURE_NOTE,
      }),
    ],
  });

  // --- الموقع العام --------------------------------------------------------
  const website = await readRow(db, `
    SELECT
      (SELECT COUNT(*) FROM web_pages WHERE status = 'published') AS published,
      (SELECT COUNT(*) FROM web_pages WHERE status = 'draft') AS draft,
      (SELECT COUNT(*) FROM web_pages WHERE status = 'review') AS review,
      (SELECT COUNT(*) FROM web_pages WHERE status = 'scheduled') AS scheduled,
      (SELECT COUNT(*) FROM web_pages p WHERE p.status = 'published'
         AND NOT EXISTS (SELECT 1 FROM web_page_sections s WHERE s.page_id = p.id AND s.is_active = 1)) AS published_empty
  `);
  const websiteGap = website
    ? null
    : 'تعذّرت قراءة جداول الموقع، فأرقامه غير معروفة الآن — وليست أصفارًا.';
  modules.push({
    key: 'website',
    label_ar: 'الموقع العام',
    label_en: 'Public website',
    source: 'web_pages · web_page_sections',
    unavailable: websiteGap,
    metrics: [
      metric({
        key: 'published', ar: 'صفحات منشورة', en: 'Pages published',
        value: count(website, 'published'), window: 'current_state', unavailable: websiteGap,
        drill: '/website/pages?status=published', drillApi: '/api/v1/admin/website/pages?status=published',
        match: 'exact',
      }),
      metric({
        key: 'review', ar: 'في المراجعة', en: 'In review',
        value: count(website, 'review'), window: 'current_state', unavailable: websiteGap,
        drill: '/website/pages?status=review', drillApi: '/api/v1/admin/website/pages?status=review',
        match: 'exact',
      }),
      metric({
        key: 'scheduled', ar: 'مجدولة', en: 'Scheduled',
        value: count(website, 'scheduled'), window: 'current_state', unavailable: websiteGap,
        drill: '/website/pages?status=scheduled&view=calendar',
        drillApi: '/api/v1/admin/website/pages?status=scheduled',
        match: 'exact',
      }),
      metric({
        key: 'draft', ar: 'مسوّدات', en: 'Drafts',
        value: count(website, 'draft'), window: 'current_state', unavailable: websiteGap,
        drill: '/website/pages?status=draft', drillApi: '/api/v1/admin/website/pages?status=draft',
        match: 'exact',
      }),
      // صفحة منشورة بلا قسم مُفعَّل تُخدَم فارغة للزوّار. البوابة تمنع نشرها،
      // فوجودها يعني قسمًا عُطِّل بعد النشر.
      metric({
        key: 'published_empty', ar: 'منشورة وفارغة', en: 'Published but empty',
        value: count(website, 'published_empty'), window: 'current_state', unavailable: websiteGap,
        tone: alertTone(count(website, 'published_empty'), true),
        drill: '/website/pages?status=published', drillApi: '/api/v1/admin/website/pages?status=published',
        match: 'related',
        note: 'لا فلتر لعدد الأقسام المُفعَّلة في القائمة؛ الوجهة كل الصفحات المنشورة، وعمود'
          + ' `active_sections` فيها هو ما يميّز الفارغة.',
      }),
    ],
  });

  // --- المدوّنة ------------------------------------------------------------
  const blog = await readRow(db, `
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
  const blogGap = blog ? null : 'تعذّرت قراءة جدول المقالات، فأرقام المدوّنة غير معروفة الآن — وليست أصفارًا.';
  const BLOG_LIST_NOTE =
    'قائمة المقالات تفلتر اللغة والحالة والتصنيف فقط؛ لا فلتر لهذا الشرط، فالوجهة كل المقالات'
    + ' (بحدّ ١٠٠ صفّ في المسار).';
  modules.push({
    key: 'blog',
    label_ar: 'المدوّنة',
    label_en: 'Blog',
    source: 'blog_posts',
    unavailable: blogGap,
    metrics: [
      metric({
        key: 'published', ar: 'مقالات منشورة', en: 'Posts published',
        value: count(blog, 'published'), window: 'current_state', unavailable: blogGap,
        drill: '/blog/posts?status=published', drillApi: '/api/v1/admin/blog/posts?status=published',
        match: 'exact', note: 'المسار يحدّ النتائج بـ١٠٠ صفّ، فالتطابق مضمون حتى هذا الحدّ.',
      }),
      metric({
        key: 'scheduled', ar: 'مجدولة', en: 'Scheduled',
        value: count(blog, 'scheduled'), window: 'current_state', unavailable: blogGap,
        drill: '/blog/posts?status=scheduled&view=calendar',
        drillApi: '/api/v1/admin/blog/posts?status=scheduled',
        match: 'exact',
      }),
      metric({
        key: 'review', ar: 'في المراجعة', en: 'In review',
        value: count(blog, 'review'), window: 'current_state', unavailable: blogGap,
        drill: '/blog/posts?status=review', drillApi: '/api/v1/admin/blog/posts?status=review',
        match: 'exact',
      }),
      metric({
        key: 'draft', ar: 'مسوّدات', en: 'Drafts',
        value: count(blog, 'draft'), window: 'current_state', unavailable: blogGap,
        drill: '/blog/posts?status=draft', drillApi: '/api/v1/admin/blog/posts?status=draft',
        match: 'exact',
      }),
      metric({
        key: 'without_author', ar: 'بلا كاتب', en: 'Without an author',
        value: count(blog, 'without_author'), window: 'current_state', unavailable: blogGap,
        tone: alertTone(count(blog, 'without_author')),
        drill: '/blog/posts', drillApi: '/api/v1/admin/blog/posts',
        match: 'related', note: BLOG_LIST_NOTE,
      }),
      // المقال المُصنَّف دينيًا بلا مراجع مُسمّى وتاريخ لا يُنشر. عدّاده هنا لأن
      // البوابة تظهر عند محاولة النشر فقط، أي بعد انتهاء الكتابة.
      metric({
        key: 'awaiting_religious_review', ar: 'بانتظار مراجعة شرعية', en: 'Awaiting religious review',
        value: count(blog, 'awaiting_religious_review'), window: 'current_state', unavailable: blogGap,
        tone: alertTone(count(blog, 'awaiting_religious_review')),
        drill: '/blog/posts', drillApi: '/api/v1/admin/blog/posts',
        match: 'related', note: BLOG_LIST_NOTE,
      }),
    ],
  });

  // --- SEO -----------------------------------------------------------------
  //
  // مجموعة فرعية رخيصة من `/admin/seo/audit`: الحقول الغائبة على كيان منشور،
  // محسوبة بـSQL. التدقيق الكامل يفحص التكرار والروابط الداخلية والأيتام ويقرأ
  // كل جسم مقال، وهو أثقل من أن يُشغَّل عند كل فتح للصفحة الرئيسية.
  //
  // كل عدّاد يغطّي الصفحات والمقالات معًا، تمامًا كما يفعل التدقيق. قبل هذه الجلسة كان
  // «أوصاف ناقصة» و«منشورة noindex» يعدّان الصفحات وحدها ويفتحان قائمة تضمّ المقالات
  // أيضًا، فالرقم والقائمة لا يتفقان (٤ مقابل ٨ محليًا).
  const seo = await readRow(db, `
    SELECT
      (SELECT COUNT(*) FROM web_pages p LEFT JOIN seo_meta m ON m.entity_type = 'web_page' AND m.entity_id = p.id
        WHERE p.status = 'published' AND (m.seo_title IS NULL OR TRIM(m.seo_title) = '')) AS pages_missing_title,
      (SELECT COUNT(*) FROM blog_posts b LEFT JOIN seo_meta m ON m.entity_type = 'blog_post' AND m.entity_id = b.id
        WHERE b.status = 'published' AND (m.seo_title IS NULL OR TRIM(m.seo_title) = '')) AS posts_missing_title,
      (SELECT COUNT(*) FROM web_pages p LEFT JOIN seo_meta m ON m.entity_type = 'web_page' AND m.entity_id = p.id
        WHERE p.status = 'published' AND (m.meta_description IS NULL OR TRIM(m.meta_description) = '')) AS pages_missing_description,
      (SELECT COUNT(*) FROM blog_posts b LEFT JOIN seo_meta m ON m.entity_type = 'blog_post' AND m.entity_id = b.id
        WHERE b.status = 'published' AND (m.meta_description IS NULL OR TRIM(m.meta_description) = '')) AS posts_missing_description,
      (SELECT COUNT(*) FROM web_pages p JOIN seo_meta m ON m.entity_type = 'web_page' AND m.entity_id = p.id
        WHERE p.status = 'published' AND m.robots_index = 0) AS pages_published_noindex,
      (SELECT COUNT(*) FROM blog_posts b JOIN seo_meta m ON m.entity_type = 'blog_post' AND m.entity_id = b.id
        WHERE b.status = 'published' AND m.robots_index = 0) AS posts_published_noindex,
      (SELECT COUNT(*) FROM web_redirects) AS redirects
  `);
  const seoGap = seo ? null : 'تعذّرت قراءة جداول SEO، فأرقامها غير معروفة الآن — وليست أصفارًا.';
  const missingTitle = count(seo, 'pages_missing_title') + count(seo, 'posts_missing_title');
  const missingDescription = count(seo, 'pages_missing_description') + count(seo, 'posts_missing_description');
  const publishedNoindex = count(seo, 'pages_published_noindex') + count(seo, 'posts_published_noindex');
  const SEO_AUDIT_NOTE = (issueId: string) =>
    `التدقيق يُرجع كل أنواع المشكلات في مصفوفة واحدة بلا عدّاد إجمالي، فالمقارنة تكون بعدّ`
    + ` المشكلات ذات المعرّف \`${issueId}\` فيه — وهو ما يفعله scripts/verify-executive-e2e.mjs.`;
  modules.push({
    key: 'seo',
    label_ar: 'SEO',
    label_en: 'SEO',
    source: 'seo_meta · web_pages · blog_posts (مجموعة فرعية من التدقيق الكامل)',
    unavailable: seoGap,
    metrics: [
      metric({
        key: 'missing_title', ar: 'عناوين SEO ناقصة', en: 'Missing SEO titles',
        value: missingTitle, window: 'current_state', unavailable: seoGap,
        tone: alertTone(missingTitle, true),
        drill: '/seo?check=missing_title', drillApi: '/api/v1/admin/seo/audit',
        match: 'related', note: SEO_AUDIT_NOTE('missing_title'),
      }),
      metric({
        key: 'missing_description', ar: 'أوصاف ميتا ناقصة', en: 'Missing meta descriptions',
        value: missingDescription, window: 'current_state', unavailable: seoGap,
        tone: alertTone(missingDescription),
        drill: '/seo?check=missing_description', drillApi: '/api/v1/admin/seo/audit',
        match: 'related', note: SEO_AUDIT_NOTE('missing_description'),
      }),
      metric({
        key: 'published_noindex', ar: 'منشورة noindex', en: 'Published noindex',
        value: publishedNoindex, window: 'current_state', unavailable: seoGap,
        tone: alertTone(publishedNoindex),
        drill: '/seo?check=published_noindex', drillApi: '/api/v1/admin/seo/audit',
        match: 'related', note: SEO_AUDIT_NOTE('published_noindex'),
      }),
      metric({
        key: 'redirects', ar: 'تحويلات', en: 'Redirects',
        value: count(seo, 'redirects'), window: 'current_state', unavailable: seoGap,
        drill: '/seo', drillApi: '/api/v1/admin/seo/redirects',
        match: 'exact', note: 'مسار التحويلات يحدّ النتائج بـ٢٠٠ صفّ، فالتطابق مضمون حتى هذا الحدّ.',
      }),
    ],
  });

  // --- العملاء -------------------------------------------------------------
  const customers = await readRow(db, `
    SELECT
      (SELECT COUNT(*) FROM family_projection WHERE status = 'active') AS active_families,
      (SELECT COUNT(*) FROM family_projection WHERE status = 'suspended') AS suspended_families,
      (SELECT COUNT(*) FROM family_projection WHERE status = 'active' AND plan <> 'free') AS paid_plan_families,
      (SELECT COUNT(*) FROM child_projection WHERE status = 'active') AS active_children
  `);
  const customersGap = customers
    ? null
    : 'تعذّرت قراءة إسقاط العائلات والأطفال، فأرقام العملاء غير معروفة الآن — وليست أصفارًا.';
  modules.push({
    key: 'customers',
    label_ar: 'العملاء',
    label_en: 'Customers',
    source: 'family_projection · child_projection (إسقاط يكتبه مستهلك طابور أحداث العائلة؛ مصدر السلطة FamilyState)',
    unavailable: customersGap,
    metrics: [
      metric({
        key: 'active_families', ar: 'عائلات نشطة', en: 'Active families',
        value: count(customers, 'active_families'), window: 'current_state', unavailable: customersGap,
        drill: '/customers?status=active', drillApi: '/api/v1/admin/customers?status=active&limit=1',
        match: 'exact',
      }),
      metric({
        key: 'paid_families', ar: 'عائلات على باقة مدفوعة', en: 'Families on a paid plan',
        value: count(customers, 'paid_plan_families'), window: 'current_state', unavailable: customersGap,
        drill: '/customers?status=active', drillApi: '/api/v1/admin/customers?status=active&limit=1',
        match: 'related',
        note: 'هذا عدّ لحقل الباقة في الإسقاط لا إثبات دفع — لا مزوّد دفع مُهيَّأ. وفلتر `plan` في'
          + ' القائمة يقبل قيمة واحدة، و«مدفوعة» تعني `family` أو `family_plus`، فالوجهة كل العائلات النشطة.',
      }),
      metric({
        key: 'suspended_families', ar: 'عائلات موقوفة', en: 'Suspended families',
        value: count(customers, 'suspended_families'), window: 'current_state', unavailable: customersGap,
        drill: '/customers?status=suspended', drillApi: '/api/v1/admin/customers?status=suspended&limit=1',
        match: 'exact',
      }),
      metric({
        key: 'active_children', ar: 'أطفال نشطون', en: 'Active children',
        value: count(customers, 'active_children'), window: 'current_state', unavailable: customersGap,
        drill: '/children?status=active', drillApi: '/api/v1/admin/children?status=active&limit=1',
        match: 'exact',
      }),
    ],
  });

  // --- الأجهزة -------------------------------------------------------------
  //
  // لا استعلام هنا، وهذا هو التصحيح. `account_devices` إسقاط لا يكتبه أي مسار: فحص
  // `scripts/verify-device-e2e.mjs` يثبت أن كل إشارة إليه في الشيفرة قراءة أو تعليق، ولا
  // عبارة كتابة واحدة. جدول بلا كاتب يعطي صفرًا دائمًا، وعرض ذلك الصفر كعدّاد أجهزة يقول
  // «لا أجهزة» بينما الحقيقة «لا نعرف من هنا». القراءة الحيّة لكل عائلة في Customer 360
  // من FamilyState.
  const DEVICES_UNAVAILABLE =
    'إسقاط `account_devices` في D1 لا يكتبه أي مسار (تحقّق scripts/verify-device-e2e.mjs)، فالعدّ'
    + ' غير معروف من قاعدة البيانات ولا يساوي صفرًا. حالة الأجهزة الحيّة لكل عائلة تُقرأ من'
    + ' FamilyState في Customer 360.';
  modules.push({
    key: 'devices',
    label_ar: 'الأجهزة',
    label_en: 'Devices',
    source: 'account_devices (إسقاط D1 بلا كاتب؛ مصدر السلطة FamilyState)',
    unavailable: DEVICES_UNAVAILABLE,
    metrics: [
      metric({
        key: 'active_devices', ar: 'أجهزة نشطة', en: 'Active devices',
        value: 0, window: 'current_state', unavailable: DEVICES_UNAVAILABLE,
        drill: '/devices-admin', drillApi: '/api/v1/admin/devices?limit=1',
        match: 'related',
        note: 'الوجهة تُظهر نفس الإسقاط غير المكتوب؛ وهي معروضة كسجلّ إداري للقراءة فقط.',
      }),
      metric({
        key: 'revoked_devices', ar: 'أجهزة مسحوبة', en: 'Revoked devices',
        value: 0, window: 'current_state', unavailable: DEVICES_UNAVAILABLE,
        drill: '/devices-admin', drillApi: '/api/v1/admin/devices?limit=1',
        match: 'related',
        note: 'الوجهة تُظهر نفس الإسقاط غير المكتوب؛ وهي معروضة كسجلّ إداري للقراءة فقط.',
      }),
    ],
  });

  // --- الحقوق والإتاحة ----------------------------------------------------
  //
  // الجدول هنا `rights_licenses` لا `content_rights`. الأخير تقرأه بوابة النشر والتقويم
  // والبحث، ولا مسار إداري يكتبه، فعدّاده صفر أبديّ؛ وشاشة الحقوق ومسار
  // `GET/POST /admin/rights` يعملان على `rights_licenses` وحده. كان العدّاد يقرأ الجدول
  // الأول ويفتح شاشة تعرض الثاني، فالرقم والقائمة يجيبان سؤالين مختلفين.
  //
  // التواريخ تُطبَّع بـSUBSTR(...,1,10) قبل مقارنتها بـdate('now'): `expiry_date` قد يُكتب
  // تاريخًا وحده أو طابعًا زمنيًا كاملًا، والمقارنة النصّية مع تاريخ اليوم تُخرج طابعًا في
  // اليوم الحدّي من النطاق.
  const rights = await readRow(db, `
    SELECT
      (SELECT COUNT(*) FROM rights_licenses) AS agreements,
      (SELECT COUNT(*) FROM rights_licenses
        WHERE expiry_date IS NOT NULL AND SUBSTR(expiry_date, 1, 10) < date('now')) AS expired,
      (SELECT COUNT(*) FROM rights_licenses
        WHERE expiry_date IS NOT NULL AND SUBSTR(expiry_date, 1, 10) >= date('now')
          AND SUBSTR(expiry_date, 1, 10) <= date('now', '+60 day')) AS expiring_soon,
      (SELECT COUNT(*) FROM content_availability WHERE mode = 'unavailable') AS withheld,
      (SELECT COUNT(*) FROM content_availability WHERE mode = 'selected_only') AS restricted
  `);
  const rightsGap = rights
    ? null
    : 'تعذّرت قراءة جداول الحقوق والإتاحة، فأرقامها غير معروفة الآن — وليست أصفارًا.';
  const RIGHTS_LIST_NOTE =
    'قائمة الحقوق لا تقبل فلتر انتهاء؛ هي ترتّب بالأقرب انتهاءً، فالوجهة كل الاتفاقيات.';
  const AVAILABILITY_NOTE =
    'سياسات الإتاحة تُقرأ من `GET /admin/availability` الذي يُرجعها كلها بلا فلتر `mode`،'
    + ' ومساحة عمل الحقوق لا تعرضها بعد — وهي فجوة في الواجهة لا في الرقم.';
  modules.push({
    key: 'rights',
    label_ar: 'الحقوق والإتاحة',
    label_en: 'Rights and availability',
    source: 'rights_licenses · content_availability',
    unavailable: rightsGap,
    metrics: [
      metric({
        key: 'expired', ar: 'اتفاقيات منتهية', en: 'Expired agreements',
        value: count(rights, 'expired'), window: 'current_state', unavailable: rightsGap,
        tone: alertTone(count(rights, 'expired'), true),
        drill: '/rights', drillApi: '/api/v1/admin/rights?limit=1',
        match: 'related', note: RIGHTS_LIST_NOTE,
      }),
      metric({
        key: 'expiring_soon', ar: 'تنتهي في ٦٠ يومًا', en: 'Expiring within 60 days',
        value: count(rights, 'expiring_soon'), window: 'next_60_days', unavailable: rightsGap,
        tone: alertTone(count(rights, 'expiring_soon')),
        drill: '/rights', drillApi: '/api/v1/admin/rights?limit=1',
        match: 'related', note: RIGHTS_LIST_NOTE,
      }),
      metric({
        key: 'agreements', ar: 'اتفاقيات', en: 'Agreements',
        value: count(rights, 'agreements'), window: 'current_state', unavailable: rightsGap,
        drill: '/rights', drillApi: '/api/v1/admin/rights?limit=1',
        match: 'exact',
      }),
      metric({
        key: 'withheld', ar: 'محتوى محجوب كليًا', en: 'Withheld everywhere',
        value: count(rights, 'withheld'), window: 'current_state', unavailable: rightsGap,
        drill: '/rights', drillApi: '/api/v1/admin/availability',
        match: 'related', note: AVAILABILITY_NOTE,
      }),
      metric({
        key: 'restricted', ar: 'محتوى مُقيَّد جغرافيًا', en: 'Geo-restricted',
        value: count(rights, 'restricted'), window: 'current_state', unavailable: rightsGap,
        drill: '/rights', drillApi: '/api/v1/admin/availability',
        match: 'related', note: AVAILABILITY_NOTE,
      }),
    ],
  });

  // --- سلامة التشغيل ------------------------------------------------------
  //
  // استعلامان منفصلان لا واحد. كانا في `SELECT` واحد مع `.catch(() => null)`، فغياب جدول
  // أحدهما كان يمحو المؤشّرين ويُفرِّغ الوحدة من مؤشّراتها كلها — بما فيها المؤشّر الذي
  // كان يمكن الإجابة عنه. الآن كلٌّ يعلن عدم توفّره وحده.
  //
  // نافذة التدقيق تُحسب هنا وتُربَط، ثم تُمرَّر بنفس القيمة إلى `drill_api`، فقائمة السجل
  // تُرجع نفس المجموعة بالضبط بدل نافذة تُحسب مرتين في لحظتين مختلفتين.
  const auditTo = new Date();
  const auditFrom = new Date(auditTo.getTime() - 24 * 60 * 60 * 1000);
  const auditFromSql = sqlTimestamp(auditFrom);
  const auditToSql = sqlTimestamp(auditTo);

  const dlq = await readRow(db, `
    SELECT COUNT(*) AS unresolved FROM failed_family_events WHERE status = 'pending'
  `);
  const audit = await readRow(
    db,
    'SELECT COUNT(*) AS total FROM audit_logs WHERE created_at >= ? AND created_at <= ?',
    [auditFromSql, auditToSql],
  );
  const dlqGap = dlq
    ? null
    : 'جدول أحداث العائلة الفاشلة غير مقروء في قاعدة البيانات الحالية، فعدد الأحداث غير المعالَجة غير معروف.';
  const auditGap = audit ? null : 'جدول سجلّ التدقيق غير مقروء، فعدد الإجراءات الإدارية غير معروف.';
  modules.push({
    key: 'platform',
    label_ar: 'سلامة التشغيل',
    label_en: 'Platform health',
    source: 'failed_family_events · audit_logs',
    // الوحدة تُعلن التعذّر فقط إذا تعذّر مصدراها كلاهما؛ وإلا فكل مؤشّر يقول حاله.
    unavailable: dlqGap && auditGap ? 'تعذّرت قراءة مصدري هذه الوحدة كليهما.' : null,
    metrics: [
      metric({
        key: 'unresolved_dlq', ar: 'أحداث فاشلة غير معالَجة', en: 'Unresolved failed events',
        value: count(dlq, 'unresolved'), window: 'current_state', unavailable: dlqGap,
        tone: alertTone(count(dlq, 'unresolved'), true),
        drill: '/failed-events?status=pending',
        drillApi: '/api/v1/admin/failed-family-events?status=pending&limit=1',
        match: 'exact',
      }),
      metric({
        key: 'audit_last_day', ar: 'إجراءات إدارية (٢٤ ساعة)', en: 'Admin actions (24h)',
        value: count(audit, 'total'), window: 'last_24h', unavailable: auditGap,
        drill: `/audit-logs?from=${encodeURIComponent(auditFromSql)}&to=${encodeURIComponent(auditToSql)}`,
        drillApi: `/api/v1/admin/audit-logs?from=${encodeURIComponent(auditFromSql)}`
          + `&to=${encodeURIComponent(auditToSql)}&limit=1`,
        match: 'exact',
      }),
    ],
  });

  limits.push(
    'الإيرادات والاشتراكات المدفوعة والاسترجاعات: لا مزوّد دفع مُهيَّأ، فلا رقم مالي يمكن إثباته.',
    'زمن الاستجابة وعمق الطابور ونسبة الإصابة في الذاكرة المؤقتة: Analytics Engine غير مربوط.',
    'حالة الفهرسة في محرّكات البحث: لا تكامل مع Search Console؛ ما يُعرض هنا تدقيق داخلي فقط.',
    'اكتمال مراحل الإنتاج: مشتقّ من الأصول لكل عنصر على حدة في مركز الإنتاج، وأثقل من أن يُجمَّع هنا.'
      + ' لذلك «متطلبات مضى موعدها» تعني الموعد لا الإنجاز.',
    'عدّ الأجهزة: إسقاط `account_devices` لا يكتبه أي مسار، فالمؤشّران يُعلنان عدم التوفّر ولا يعرضان صفرًا.',
    'حقوق بوابة النشر (`content_rights`): لا مسار إداري يكتب هذا الجدول، فلا يُعدّ هنا؛ وحدة الحقوق'
      + ' تعدّ `rights_licenses` وهو ما تكتبه شاشة الحقوق وتعرضه.',
    'وجهات النقر: شاشات الدعم والإنتاج والمسارات والحقوق والأجهزة والسجلّ لا تقرأ فلاتر العنوان بعد'
      + ' (صفحات الموقع والمدوّنة وSEO تقرأها)، فالفلتر في `drill` صحيح الاسم لكن الشاشة تفتح غير مفلترة'
      + ' حتى تُوصَّل. `drill_api` هو المسار الذي يُعيد المجموعة نفسها اليوم.',
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
