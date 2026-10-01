import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { requireAdmin } from '../lib/adminAuth.ts'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()

/// حرس صريح لا ضمني.
///
/// هذا الملف كان بلا `use()` إطلاقًا، فحمايته تعتمد على أن وسيط adminRoute
/// المركّب على `/api/v1/admin/*` يتّسع ليطابق `/api/v1/admin/analytics/*`
/// وعلى ترتيب التركيب في index.ts. الاعتماد الضمني يتعطّل بصمت عند أي إعادة
/// ترتيب، والمسارات هنا تكشف تقدّم الأطفال و parent_id.
route.use('*', requireAdmin)

route.get('/analytics/overview', async (c) => {
  const totalPlays = await queryFirst<{ c: number }>(c.env.DB, `SELECT COUNT(*) as c FROM processed_family_events WHERE event_type IN ('progress.updated','content.completed','playback.started')`)
  const byTrack = await queryAll(c.env.DB, `SELECT track_id, COUNT(*) as count FROM series_tracks JOIN series s ON s.id = series_tracks.series_id WHERE s.status='published' GROUP BY track_id`)
  const mastery = await queryAll(c.env.DB, `SELECT level, COUNT(*) as count FROM mastery GROUP BY level`)
  const recent = await queryAll(c.env.DB, `SELECT event_id, event_type, parent_id, occurred_at_ms FROM processed_family_events ORDER BY occurred_at_ms DESC LIMIT 20`)
  return c.json({ success: true, data: { total_plays: totalPlays?.c ?? 0, by_track: byTrack, mastery, recent_events: recent } })
})

/**
 * `GET /analytics/watch-time?days=7|30|90` — `ADM-309`.
 *
 * From `child_watch_time_daily`, the projection of the same seconds the
 * screen-time limits count (`watch_time.credited`). Days are the families'
 * local dates. Aggregates only: no child names, no per-family rows.
 */
route.get('/analytics/watch-time', async (c) => {
  const requested = Number(c.req.query('days') ?? 7)
  const days = [7, 30, 90].includes(requested) ? requested : 7
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10)
  const db = c.env.DB

  const [totals, daily, byTrack, topContent, topSeries] = await Promise.all([
    queryFirst<{ seconds: number | null; children: number; families: number; child_days: number }>(db, `
      SELECT SUM(watched_seconds) AS seconds,
             COUNT(DISTINCT child_id) AS children,
             COUNT(DISTINCT parent_id) AS families,
             COUNT(DISTINCT activity_date || '|' || child_id) AS child_days
        FROM child_watch_time_daily WHERE activity_date >= ?
    `, [since]),
    queryAll<{ day: string; seconds: number; children: number }>(db, `
      SELECT activity_date AS day, SUM(watched_seconds) AS seconds, COUNT(DISTINCT child_id) AS children
        FROM child_watch_time_daily WHERE activity_date >= ?
       GROUP BY activity_date ORDER BY activity_date
    `, [since]),
    queryAll<{ age_track: string | null; seconds: number; children: number }>(db, `
      SELECT age_track, SUM(watched_seconds) AS seconds, COUNT(DISTINCT child_id) AS children
        FROM child_watch_time_daily WHERE activity_date >= ?
       GROUP BY age_track ORDER BY seconds DESC
    `, [since]),
    queryAll<{ content_type: string; content_id: string; title: string | null; series_title: string | null; seconds: number; children: number }>(db, `
      SELECT w.content_type, w.content_id,
             e.title_ar AS title, s.title_ar AS series_title,
             SUM(w.watched_seconds) AS seconds, COUNT(DISTINCT w.child_id) AS children
        FROM child_watch_time_daily w
        LEFT JOIN episodes e ON e.id = w.content_id AND w.content_type = 'episode'
        LEFT JOIN series s ON s.id = e.series_id
       WHERE w.activity_date >= ?
       GROUP BY w.content_type, w.content_id
       ORDER BY seconds DESC LIMIT 20
    `, [since]),
    queryAll<{ series_id: string; title: string | null; seconds: number; children: number }>(db, `
      SELECT e.series_id, s.title_ar AS title,
             SUM(w.watched_seconds) AS seconds, COUNT(DISTINCT w.child_id) AS children
        FROM child_watch_time_daily w
        JOIN episodes e ON e.id = w.content_id AND w.content_type = 'episode'
        LEFT JOIN series s ON s.id = e.series_id
       WHERE w.activity_date >= ?
       GROUP BY e.series_id
       ORDER BY seconds DESC LIMIT 10
    `, [since]),
  ])

  const seconds = Number(totals?.seconds ?? 0)
  const childDays = Number(totals?.child_days ?? 0)
  return c.json({
    success: true,
    data: {
      days,
      since,
      totals: {
        watched_minutes: Math.round(seconds / 60),
        active_children: Number(totals?.children ?? 0),
        active_families: Number(totals?.families ?? 0),
        // Per child on the days they watched: a child who watched once is not
        // averaged down by the days they did not open the app.
        avg_minutes_per_child_day: childDays > 0 ? Math.round((seconds / 60 / childDays) * 10) / 10 : 0,
      },
      daily: daily.map((row) => ({ day: row.day, minutes: Math.round(Number(row.seconds) / 60), children: Number(row.children) })),
      by_track: byTrack.map((row) => ({ age_track: row.age_track, minutes: Math.round(Number(row.seconds) / 60), children: Number(row.children) })),
      top_content: topContent.map((row) => ({ ...row, minutes: Math.round(Number(row.seconds) / 60), seconds: Number(row.seconds), children: Number(row.children) })),
      top_series: topSeries.map((row) => ({ ...row, minutes: Math.round(Number(row.seconds) / 60), seconds: Number(row.seconds), children: Number(row.children) })),
    },
  })
})

/**
 * تقدّم طفل واحد.
 *
 * ## العلّة التي كانت هنا
 *
 * الاستعلام كان على جدول اسمه `content_progress`:
 *
 *   SELECT content_type, content_id, position_ms, duration_ms, completed,
 *          updated_at FROM content_progress WHERE child_id = ?
 *
 * وهذا الجدول **لا وجود له في أي مهاجرة ولا في قاعدة الإنتاج** — تحقّقتُ من
 * `sqlite_master` على الإنتاج فليس فيه إلا `watch_progress` و`mastery`
 * و`attempts`. فالمسار كان يرمي على كل نداء، ولم يظهر ذلك لأن أحدًا لم يستدعه:
 * لم تكن له واجهة.
 *
 * وكل أسماء الأعمدة كانت مخترعة كذلك. الجدول الحقيقي `watch_progress`
 * (المهاجرة 0001) يحمل `progress_seconds` و`is_completed` و`watch_count` —
 * لا `position_ms` ولا `duration_ms` ولا `completed`.
 *
 * ## ما صار
 *
 * ثلاثة مصادر حقيقية تُجمَع في استجابة واحدة، لأن «تقدّم الطفل» ليس جدولًا
 * واحدًا: المشاهدة في `watch_progress`، والإتقان في `mastery`، والمحاولات في
 * `attempts`. عرض واحد منها فقط يعطي صورة ناقصة عن طفل يُسأل عنه في الدعم.
 *
 * `nickname` كُنية لا اسم قانوني، وتُكشف بالفعل في adminFamilyProjection.ts.
 * ولا تُعاد تواريخ الميلاد ولا البريد: لا حاجة لها في قياس التقدّم.
 */
route.get('/analytics/children/:childId', async (c) => {
  const childId = c.req.param('childId')

  // API-105: يُقرأ من الإسقاط الذي يكتبه الطابور، لا من `children_profiles`.
  //
  // ذلك الجدول **صفر صفًّا ولا كاتب له**: سلطة الحقيقة في الكائن الدائم، فكان
  // هذا المسار يُعيد 404 لكل طفل قائم فعلًا — «طفل غير موجود» عن طفلٍ يشاهد.
  const child = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT child_id AS id, nickname, age_track, language, status, parent_id
       FROM child_projection WHERE child_id = ?`,
    [childId],
  )
  // 404 حالة قائمة بذاتها: طفل غير موجود ليس طفلًا بلا تقدّم
  if (!child) return c.json({ success: false, error: 'Child not found' }, 404)

  // API-105: التقدّم من `child_progress_projection`.
  //
  // و`content_type` معروض لأن المفتاح صار ثلاثيًّا: الكتب والقصص والألعاب لها
  // تقدّم أيضًا، و`watch_progress` القديم لم يكن يقبل إلا الحلقات.
  const watch = await queryAll<Record<string, unknown>>(c.env.DB, `
    SELECT p.content_type, p.content_id, p.content_id AS episode_id,
           e.title_ar AS episode_title, s.title_ar AS series_title,
           p.position_ms, p.duration_ms, p.completed AS is_completed,
           p.completions AS watch_count, p.completed_at_ms, p.updated_at
      FROM child_progress_projection p
      LEFT JOIN episodes e ON e.id = p.content_id AND p.content_type = 'episode'
      LEFT JOIN series s ON s.id = e.series_id
     WHERE p.child_id = ?
     ORDER BY p.last_event_at_ms DESC
     LIMIT 50
  `, [childId])

  const mastery = await queryAll<Record<string, unknown>>(c.env.DB, `
    SELECT m.objective_id, lo.code, lo.title_ar AS objective_title,
           m.level, m.attempts, m.correct_attempts, m.last_attempt_at
      FROM mastery m
      LEFT JOIN learning_objectives lo ON lo.id = m.objective_id
     WHERE m.child_id = ?
     ORDER BY m.last_attempt_at DESC
     LIMIT 50
  `, [childId])

  const attempts = await queryAll<Record<string, unknown>>(c.env.DB, `
    SELECT a.id, a.episode_id, a.game_id, g.title_ar AS game_title,
           e.title_ar AS episode_title,
           a.score, a.max_score, a.time_spent_seconds, a.help_used, a.created_at
      FROM attempts a
      LEFT JOIN games g ON g.id = a.game_id
      LEFT JOIN episodes e ON e.id = a.episode_id
     WHERE a.child_id = ?
     ORDER BY a.created_at DESC
     LIMIT 50
  `, [childId])

  return c.json({
    success: true,
    data: {
      child: {
        ...child,
        // الحالة المنطقية تُعاد منطقية: D1 يخزّنها 0/1
        status: String(child.status ?? ''),
      },
      watch_progress: watch.map((row) => ({
        ...row,
        is_completed: Number(row.is_completed) === 1,
        watch_count: Number(row.watch_count ?? 0),
        // الثواني تبقى في العقد لأن اللوحة تعرضها، وتُشتقّ من المللي بدل أن
        // تُخزَّن: التخزين بدقّة أقل من المصدر يُفقد ما يحتاجه الاستكمال.
        progress_seconds: Math.floor(Number(row.position_ms ?? 0) / 1000),
        duration_seconds: Math.floor(Number(row.duration_ms ?? 0) / 1000),
        completed_at: row.completed_at_ms === null || row.completed_at_ms === undefined
          ? null
          : new Date(Number(row.completed_at_ms)).toISOString(),
      })),
      mastery: mastery.map((row) => {
        const total = Number(row.attempts ?? 0)
        const correct = Number(row.correct_attempts ?? 0)
        return {
          ...row,
          attempts: total,
          correct_attempts: correct,
          // null لا صفر: «لا محاولات» ليست «نسبة نجاح صفر»
          success_rate: total > 0 ? Math.round((correct / total) * 100) : null,
        }
      }),
      attempts: attempts.map((row) => ({
        ...row,
        help_used: Number(row.help_used) === 1,
        score_percent: row.score != null && row.max_score != null && Number(row.max_score) > 0
          ? Math.round((Number(row.score) / Number(row.max_score)) * 100)
          : null,
      })),
    },
  })
})

export default route
