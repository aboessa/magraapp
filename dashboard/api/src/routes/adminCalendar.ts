/// One calendar over everything the platform schedules.
///
/// ## Why the calendar is a read model and not a writer
///
/// Every entity on this calendar already has an endpoint that owns its schedule, and each of
/// those endpoints does more than set a column: `adminWebsite.ts` writes a revision before the
/// change, `adminBlog.ts` refuses `scheduled` without a time, both audit, and the publish
/// operations run a readiness gate. A calendar that wrote `scheduled_at` itself would be a
/// second writer bypassing all of that.
///
/// So each event declares *how* it can be rescheduled — the route, the permission, or the
/// reason it cannot — and the client calls that route. One writer per entity, validation and
/// audit intact, and drag-and-drop that cannot skip a rule.
///
/// ## What the calendar found
///
/// `scheduled/cleanup.ts` is the only cron on this Worker and it deletes processed events.
/// **No scheduled publication is ever published by a timer.** A row with
/// `status = 'scheduled'` is therefore a promise nothing keeps: it will sit there until a
/// person publishes it. Rather than draw those events as though they will appear, every one
/// carries the `no_scheduler` conflict, and a scheduled date already in the past carries
/// `lapsed_schedule` as well. That is the single most useful thing this screen can say.
///
/// ## Conflicts are conflicts, not warnings about tidiness
///
/// Three are reported, and each one costs something real if ignored:
///
/// * `no_scheduler` — the date will pass and nothing will happen.
/// * `rights_expiry_before_publication` — content scheduled to be public past the date its
///   licence ends. `lib/availabilityPolicy.ts` would refuse to serve it, and the publish gate
///   would refuse to publish it, so the plan is impossible as written.
/// * `same_day_collision` — two or more episodes of one series landing on the same day, which
///   is a release plan nobody chose.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll } from '../lib/db.ts';
import { requireAdmin, type AdminVariables } from '../lib/adminAuth.ts';

type AppEnv = { Bindings: Env; Variables: AdminVariables };

const route = new Hono<AppEnv>();

export interface CalendarEvent {
  id: string;
  /// `episode`, `series`, `story`, `website_page`, `blog_post`, `home_module`,
  /// `production_requirement`, `task`, `rights_expiry`.
  type: string;
  title: string;
  /// ISO date or datetime. The day part is what the calendar grids on.
  date: string;
  /// `scheduled`, `published`, `due`, `expires` — what the date means, which is not the same
  /// as the entity's status.
  date_kind: 'scheduled' | 'published' | 'due' | 'expires';
  status: string | null;
  language: string | null;
  planet_id: string | null;
  owner_id: string | null;
  team_id: string | null;
  context: string | null;
  admin_route: string;
  /// How this event may be moved. `supported: false` carries the reason.
  reschedule: {
    supported: boolean;
    method?: 'PATCH' | 'PUT';
    route?: string;
    field?: string;
    permission?: string;
    reason?: string;
  };
  conflicts: string[];
}

const RESCHEDULE_UNSUPPORTED = {
  published: 'التاريخ ماضٍ ومُسجَّل: تغييره يُعيد كتابة تاريخ نشر حدث فعلًا.',
  derived: 'التاريخ مشتقّ من حالة الكيان لا مُخزَّن كموعد، فلا يوجد حقل يُحرَّك.',
  rights: 'انتهاء الترخيص بند في العقد لا موعد تشغيلي؛ يُعدَّل من سجلّ الحقوق.',
};

const isoDay = (value: string | null | undefined): string | null =>
  (typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : null);

/// `GET /admin/calendar?from=2026-08-01&to=2026-08-31`
///
/// The window is required in effect: without one, "everything ever scheduled" is an unbounded
/// query over nine tables, and no calendar view asks for that.
route.get('/calendar', requireAdmin, async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const from = isoDay(c.req.query('from')) ?? `${today.slice(0, 7)}-01`;
  const to = isoDay(c.req.query('to')) ?? `${today.slice(0, 7)}-31`;
  if (from > to) {
    return c.json({ success: false, error: 'from must not be after to' }, 400);
  }

  const requestedTypes = (c.req.query('types') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const planet = c.req.query('planet') ?? '';
  const language = c.req.query('language') ?? '';
  const statusFilter = c.req.query('status') ?? '';
  const owner = c.req.query('owner') ?? '';
  const team = c.req.query('team') ?? '';

  // `to` is compared against the date prefix, so an event stored as a full timestamp on the
  // last day of the window is still inside it.
  const upper = `${to}T99`;

  const [
    episodes, series, stories, pages, posts, modules, requirements, tasks, rights,
  ] = await Promise.all([
    queryAll<{
      id: string; title_ar: string; status: string; published_at: string | null;
      series_title: string | null; planet_id: string | null;
    }>(c.env.DB, `
      SELECT e.id, e.title_ar, e.status, e.published_at, s.title_ar AS series_title, s.planet_id
        FROM episodes e LEFT JOIN series s ON s.id = e.series_id
       WHERE e.published_at IS NOT NULL AND e.published_at >= ? AND e.published_at <= ?
       ORDER BY e.published_at LIMIT 500
    `, [from, upper]),
    queryAll<{ id: string; title_ar: string; status: string; published_at: string | null; planet_id: string }>(c.env.DB, `
      SELECT id, title_ar, status, published_at, planet_id FROM series
       WHERE published_at IS NOT NULL AND published_at >= ? AND published_at <= ?
       ORDER BY published_at LIMIT 300
    `, [from, upper]),
    queryAll<{ id: string; title_ar: string; status: string; published_at: string | null; planet_id: string | null }>(c.env.DB, `
      SELECT st.id, st.title_ar, st.status, st.published_at, s.planet_id
        FROM stories st LEFT JOIN series s ON s.id = st.series_id
       WHERE st.published_at IS NOT NULL AND st.published_at >= ? AND st.published_at <= ?
       ORDER BY st.published_at LIMIT 300
    `, [from, upper]),
    queryAll<{
      id: string; title: string; status: string; language: string;
      scheduled_at: string | null; published_at: string | null;
    }>(c.env.DB, `
      SELECT id, title, status, language, scheduled_at, published_at FROM web_pages
       WHERE (COALESCE(scheduled_at, published_at) >= ? AND COALESCE(scheduled_at, published_at) <= ?)
       ORDER BY COALESCE(scheduled_at, published_at) LIMIT 300
    `, [from, upper]),
    queryAll<{
      id: string; title: string; status: string; language: string;
      scheduled_at: string | null; published_at: string | null;
    }>(c.env.DB, `
      SELECT id, title, status, language, scheduled_at, published_at FROM blog_posts
       WHERE (COALESCE(scheduled_at, published_at) >= ? AND COALESCE(scheduled_at, published_at) <= ?)
       ORDER BY COALESCE(scheduled_at, published_at) LIMIT 300
    `, [from, upper]),
    queryAll<{
      id: string; title_ar: string | null; block_type: string; is_active: number; is_draft: number;
      scheduled_at: string | null; expires_at: string | null;
    }>(c.env.DB, `
      SELECT id, title_ar, block_type, is_active, is_draft, scheduled_at, expires_at
        FROM home_experience_blocks
       WHERE (scheduled_at IS NOT NULL AND scheduled_at >= ? AND scheduled_at <= ?)
          OR (expires_at IS NOT NULL AND expires_at >= ? AND expires_at <= ?)
       ORDER BY COALESCE(scheduled_at, expires_at) LIMIT 200
    `, [from, upper, from, upper]),
    queryAll<{
      id: string; content_type: string; content_id: string; requirement: string; due_at: string | null;
      assignee_id: string | null; team_id: string | null; blocker: string | null;
    }>(c.env.DB, `
      SELECT id, content_type, content_id, requirement, due_at, assignee_id, team_id, blocker
        FROM production_requirements
       WHERE due_at IS NOT NULL AND due_at >= ? AND due_at <= ?
       ORDER BY due_at LIMIT 300
    `, [from, upper]),
    queryAll<{
      id: string; title_ar: string; status: string; due_date: string | null;
      assignee_id: string | null; planet_id: string | null; priority: string;
    }>(c.env.DB, `
      SELECT id, title_ar, status, due_date, assignee_id, planet_id, priority FROM tasks
       WHERE due_date IS NOT NULL AND due_date >= ? AND due_date <= ?
       ORDER BY due_date LIMIT 300
    `, [from, upper]),
    queryAll<{ id: string; owner: string; entity_type: string; entity_id: string; expiry: string | null }>(c.env.DB, `
      SELECT id, owner, entity_type, entity_id, expiry FROM content_rights
       WHERE expiry IS NOT NULL AND expiry >= ? AND expiry <= ?
       ORDER BY expiry LIMIT 200
    `, [from, upper]),
  ]);

  const events: CalendarEvent[] = [];

  for (const row of episodes) {
    events.push({
      id: row.id, type: 'episode', title: row.title_ar,
      date: row.published_at as string,
      date_kind: row.status === 'published' ? 'published' : 'scheduled',
      status: row.status, language: null, planet_id: row.planet_id, owner_id: null, team_id: null,
      context: row.series_title, admin_route: `episodes/${row.id}`,
      reschedule: { supported: false, reason: RESCHEDULE_UNSUPPORTED.derived },
      conflicts: [],
    });
  }
  for (const row of series) {
    events.push({
      id: row.id, type: 'series', title: row.title_ar,
      date: row.published_at as string,
      date_kind: row.status === 'published' ? 'published' : 'scheduled',
      status: row.status, language: null, planet_id: row.planet_id, owner_id: null, team_id: null,
      context: null, admin_route: `series/${row.id}`,
      reschedule: { supported: false, reason: RESCHEDULE_UNSUPPORTED.derived },
      conflicts: [],
    });
  }
  for (const row of stories) {
    events.push({
      id: row.id, type: 'story', title: row.title_ar,
      date: row.published_at as string,
      date_kind: row.status === 'published' ? 'published' : 'scheduled',
      status: row.status, language: null, planet_id: row.planet_id, owner_id: null, team_id: null,
      context: null, admin_route: `stories/${row.id}`,
      reschedule: { supported: false, reason: RESCHEDULE_UNSUPPORTED.derived },
      conflicts: [],
    });
  }
  for (const row of pages) {
    const scheduled = !!row.scheduled_at && row.status !== 'published';
    events.push({
      id: row.id, type: 'website_page', title: row.title,
      date: (row.scheduled_at ?? row.published_at) as string,
      date_kind: scheduled ? 'scheduled' : 'published',
      status: row.status, language: row.language, planet_id: null, owner_id: null, team_id: null,
      context: null, admin_route: `website/pages/${row.id}`,
      reschedule: scheduled
        ? {
            supported: true, method: 'PATCH', route: `/admin/website/pages/${row.id}`,
            field: 'scheduled_at', permission: 'edit_metadata',
          }
        : { supported: false, reason: RESCHEDULE_UNSUPPORTED.published },
      conflicts: [],
    });
  }
  for (const row of posts) {
    const scheduled = !!row.scheduled_at && row.status !== 'published';
    events.push({
      id: row.id, type: 'blog_post', title: row.title,
      date: (row.scheduled_at ?? row.published_at) as string,
      date_kind: scheduled ? 'scheduled' : 'published',
      status: row.status, language: row.language, planet_id: null, owner_id: null, team_id: null,
      context: null, admin_route: `blog/posts/${row.id}`,
      reschedule: scheduled
        ? {
            supported: true, method: 'PATCH', route: `/admin/blog/posts/${row.id}`,
            field: 'scheduled_at', permission: 'edit_text',
          }
        : { supported: false, reason: RESCHEDULE_UNSUPPORTED.published },
      conflicts: [],
    });
  }
  for (const row of modules) {
    // A module can appear twice on the calendar, once for each end of its window. They are
    // separate events because they are separate decisions.
    for (const [field, kind] of [['scheduled_at', 'scheduled'], ['expires_at', 'expires']] as const) {
      const value = row[field];
      if (!value || value < from || value > upper) continue;
      events.push({
        id: `${row.id}:${field}`, type: 'home_module',
        title: row.title_ar ?? row.block_type,
        date: value, date_kind: kind,
        status: row.is_draft === 1 ? 'draft' : (row.is_active === 1 ? 'active' : 'inactive'),
        language: null, planet_id: null, owner_id: null, team_id: null,
        context: row.block_type, admin_route: 'app-experience',
        reschedule: {
          supported: true, method: 'PATCH', route: `/admin/home-experience/${row.id}`,
          field, permission: 'edit_metadata',
        },
        conflicts: [],
      });
    }
  }
  for (const row of requirements) {
    events.push({
      id: row.id, type: 'production_requirement', title: row.requirement,
      date: row.due_at as string, date_kind: 'due',
      status: row.blocker ? 'blocked' : 'open',
      language: null, planet_id: null, owner_id: row.assignee_id, team_id: row.team_id,
      context: `${row.content_type}: ${row.content_id}`,
      admin_route: `production?content=${encodeURIComponent(row.content_id)}`,
      reschedule: {
        supported: true, method: 'PUT',
        route: `/admin/production/${row.content_type}/${row.content_id}/${row.requirement}`,
        field: 'due_at', permission: 'assign_members',
      },
      conflicts: [],
    });
  }
  for (const row of tasks) {
    events.push({
      id: row.id, type: 'task', title: row.title_ar,
      date: row.due_date as string, date_kind: 'due',
      status: row.status, language: null, planet_id: row.planet_id,
      owner_id: row.assignee_id, team_id: null,
      context: row.priority, admin_route: 'tasks',
      reschedule: {
        supported: false,
        reason: 'لا مسار تعديل للمهام في الخادم: /admin/tasks للقراءة فقط.',
      },
      conflicts: [],
    });
  }
  for (const row of rights) {
    events.push({
      id: row.id, type: 'rights_expiry', title: row.owner,
      date: row.expiry as string, date_kind: 'expires', status: 'expires',
      language: null, planet_id: null, owner_id: null, team_id: null,
      context: `${row.entity_type}: ${row.entity_id}`, admin_route: 'rights',
      reschedule: { supported: false, reason: RESCHEDULE_UNSUPPORTED.rights },
      conflicts: [],
    });
  }

  // --- Conflicts -----------------------------------------------------------

  // 1. Nothing publishes a scheduled row. See the module header.
  for (const event of events) {
    if (event.date_kind === 'scheduled') {
      event.conflicts.push('no_scheduler');
      if (isoDay(event.date)! < today) event.conflicts.push('lapsed_schedule');
    }
  }

  // 2. A licence that ends before the content is public.
  const expiryByEntity = new Map<string, string>();
  const allRights = await queryAll<{ entity_type: string; entity_id: string; expiry: string }>(c.env.DB, `
    SELECT entity_type, entity_id, expiry FROM content_rights WHERE expiry IS NOT NULL
  `);
  for (const row of allRights) {
    const key = `${row.entity_type}:${row.entity_id}`;
    const existing = expiryByEntity.get(key);
    // The latest licence wins: two licences for one entity mean the content is covered until
    // the later of the two ends.
    if (!existing || row.expiry > existing) expiryByEntity.set(key, row.expiry);
  }
  for (const event of events) {
    if (!['episode', 'series', 'story'].includes(event.type)) continue;
    const expiry = expiryByEntity.get(`${event.type}:${event.id}`);
    if (expiry && isoDay(event.date)! > expiry) event.conflicts.push('rights_expiry_before_publication');
  }

  // 3. Two or more episodes of one series on the same day.
  const byDayAndSeries = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (event.type !== 'episode' || !event.context) continue;
    const key = `${isoDay(event.date)}|${event.context}`;
    byDayAndSeries.set(key, [...(byDayAndSeries.get(key) ?? []), event]);
  }
  for (const group of byDayAndSeries.values()) {
    if (group.length > 1) for (const event of group) event.conflicts.push('same_day_collision');
  }

  // --- Filters -------------------------------------------------------------
  //
  // Applied after assembly rather than in each of the nine queries: the filter set is the same
  // for every source, and nine copies of it would drift.
  const filtered = events.filter((event) => {
    if (requestedTypes.length && !requestedTypes.includes(event.type)) return false;
    if (planet && event.planet_id !== planet) return false;
    if (language && event.language !== language) return false;
    if (statusFilter && event.status !== statusFilter) return false;
    if (owner && event.owner_id !== owner) return false;
    if (team && event.team_id !== team) return false;
    return true;
  }).sort((left, right) => left.date.localeCompare(right.date));

  return c.json({
    success: true,
    data: {
      from, to,
      events: filtered,
      total: filtered.length,
      /// Counted before filtering, so the filter chips can show what they hide.
      total_unfiltered: events.length,
      conflict_summary: {
        no_scheduler: filtered.filter((event) => event.conflicts.includes('no_scheduler')).length,
        lapsed_schedule: filtered.filter((event) => event.conflicts.includes('lapsed_schedule')).length,
        rights_expiry_before_publication: filtered.filter((event) => event.conflicts.includes('rights_expiry_before_publication')).length,
        same_day_collision: filtered.filter((event) => event.conflicts.includes('same_day_collision')).length,
      },
      /// Named so the screen can state the gap instead of implying the calendar is complete.
      unavailable: [
        { type: 'campaign', reason: 'لا جدول حملات في أي مهاجرة.' },
        { type: 'release', reason: 'لا سجلّ إصدارات: الجدولة تُخزَّن على كل كيان.' },
        { type: 'book', reason: 'جدول books بلا عمود نشر أو جدولة، فلا تاريخ يُرسَم.' },
        { type: 'game', reason: 'جدول games بلا عمود نشر أو جدولة.' },
      ],
      scheduler_available: false,
      scheduler_note: 'لا مُشغِّل دوري ينشر المجدول: scheduled/cleanup.ts هو الكرون الوحيد وهو للتنظيف. كل موعد مجدول يحتاج نشرًا يدويًا.',
    },
  });
});

export default route;
