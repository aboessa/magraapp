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

  const child = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    'SELECT id, nickname, age_track, language, status, parent_id FROM children_profiles WHERE id = ?',
    [childId],
  )
  // 404 حالة قائمة بذاتها: طفل غير موجود ليس طفلًا بلا تقدّم
  if (!child) return c.json({ success: false, error: 'Child not found' }, 404)

  const watch = await queryAll<Record<string, unknown>>(c.env.DB, `
    SELECT wp.episode_id, e.title_ar AS episode_title, s.title_ar AS series_title,
           wp.progress_seconds, wp.is_completed, wp.watch_count,
           wp.completed_at, wp.updated_at
      FROM watch_progress wp
      LEFT JOIN episodes e ON e.id = wp.episode_id
      LEFT JOIN series s ON s.id = e.series_id
     WHERE wp.child_id = ?
     ORDER BY wp.updated_at DESC
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
        progress_seconds: Number(row.progress_seconds ?? 0),
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
