import { Hono, type Context } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryFirst } from '../lib/db.ts'
import { requireAdmin, requirePermission, type AdminVariables } from '../lib/adminAuth.ts'
import { auditStatement, actorId } from '../lib/auditLog.ts'
import { evaluateFor, gateRefusal } from './adminPublishGate.ts'
import { summarizeGate } from '../lib/publishGate.ts'
import { pathParam } from '../lib/routeParams.ts'

type AppEnv = { Bindings: Env; Variables: AdminVariables }

const route = new Hono<AppEnv>()

/// Publishing for stories, books, games and projects.
///
/// ## The gap this closes
///
/// Only four publish endpoints existed in the entire API — series, episodes,
/// website pages and blog posts — so the content types that make up most of the
/// catalogue could be authored, reviewed and shown as "ready" and then never
/// published. That is the mechanical reason the database held **0 published
/// stories, 0 books and 0 projects** while the Story Workspace displayed a
/// readiness tab with no action and `QualityPage` rendered a "Publish now" button
/// with no handler.
///
/// The readiness gate already understood all six types
/// (`lib/publishGate.ts` → `PUBLISHABLE_TYPES`); nothing was calling it for four
/// of them.
///
/// ## Why one router rather than four handlers spread across the content modules
///
/// Publishing is one operation with one contract: authority, then readiness, then
/// a recorded state change. Splitting it across `adminContent.ts`,
/// `adminStories.ts` and `adminGames.ts` is how series and episodes ended up with
/// subtly different bodies, and how three of the six types were simply forgotten.
/// Keeping it in one file makes the omission of a type visible.
///
/// Mounted directly in `index.ts`, so it guards itself: Hono middleware belongs to
/// the router instance it is registered on.
route.use('*', requireAdmin)

/// The tables that can be published through here, with the columns each has.
///
/// `published_at` exists only on `stories`; books, games and projects carry
/// `status` and `updated_at` only. Writing a column that does not exist fails the
/// whole statement, so the shape is declared rather than assumed.
const PUBLISHABLE = {
  story: { table: 'stories', type: 'story', label: 'Story', hasPublishedAt: true, hasIsPublished: false },
  book: { table: 'books', type: 'book', label: 'Book', hasPublishedAt: false, hasIsPublished: false },
  game: { table: 'games', type: 'game', label: 'Game', hasPublishedAt: false, hasIsPublished: false },
  project: { table: 'projects', type: 'project', label: 'Project', hasPublishedAt: false, hasIsPublished: false },

  // API-106: السلسلة والحلقة انضمّتا إلى نفس المسار.
  //
  // كان لهما معالجان مستقلّان في `routes/admin.ts` يتعاملان مع نتيجة بوابة
  // فارغة كـ«غير مُقيَّمة» **وينشران على أي حال** — والتعليق هناك كان يقرّ بذلك
  // ويسجّله متابعةً لم تُنفَّذ. والأثر مقيس: عشرون حلقة منشورة بلا أصل فيديو
  // واحد وبمدّة فارغة. أي أن المسار الذي نُشرت به لم يمنع نشر محتوى **لا يمكن
  // تشغيله** على جهاز طفل.
  //
  // و`is_published` عمود على `episodes` وحدها: القراءة العامة تفحصه مع `status`،
  // فنشرٌ يضبط الأوّل ولا يضبط الثاني يُنتج حلقةً «منشورة» لا تظهر لأحد.
  series: { table: 'series', type: 'series', label: 'Series', hasPublishedAt: true, hasIsPublished: false },
  episode: { table: 'episodes', type: 'episode', label: 'Episode', hasPublishedAt: true, hasIsPublished: true },
} as const

export type PublishableKey = keyof typeof PUBLISHABLE

/// النشر لكل الأنواع الستة: نفس البوابة، ونفس الفشل المُغلَق، ونفس صفوف التدقيق.
///
/// مُصدَّرة ليستدعيها معالجا السلسلة والحلقة في `routes/admin.ts` بدل نسختيهما:
/// مسارُهما مُسجَّل هناك، ونقلُ التسجيل كان يعني تغيير ترتيب التركيب في ملف يخدم
/// مئة مسار. والمشترك هو **الدالّة** لا موضع التسجيل.
export async function publishEntity(c: Context<AppEnv>, key: PublishableKey) {
  return publish(c, key)
}

async function publish(c: Context<AppEnv>, key: PublishableKey) {
  const spec = PUBLISHABLE[key]
  const db = c.env.DB
  // API-106: `pathParam` لا `?? ''`. الفرق ليس تجميليًّا: مسارٌ فقد مقطعه بعد
  // تعديل توجيه يُنتج هنا خطأً مُعلَنًا يسمّي المقطع الناقص، بدل 400 «id required»
  // تُقرأ خطأً في الطلب فيبحث المشغّل في المكان الخطأ.
  const id = pathParam(c, 'id')

  // The table name comes from the literal map above, never from request input.
  const existing = await queryFirst<{ status: string }>(
    db,
    `SELECT status FROM ${spec.table} WHERE id = ?`,
    [id],
  )
  if (!existing) return c.json({ success: false, error: `${spec.label} not found` }, 404)
  if (existing.status === 'archived') {
    return c.json({ success: false, error: `Archived ${spec.label.toLowerCase()} cannot be published` }, 409)
  }
  // Idempotent: re-publishing something already live is not an error, and the
  // response says plainly that nothing changed.
  if (existing.status === 'published') {
    return c.json({ success: true, data: { id, status: 'published', published: false } })
  }

  // Readiness, server-side. The endpoint is reachable with curl, so a gate the
  // client can skip is decoration. Every blocker is returned at once.
  //
  // This **fails closed**. `evaluateFor` returns null only when it cannot gather
  // facts for the entity — and existence has already been established above — so a
  // null here means the gate did not run. Publishing content the gate could not
  // evaluate is the exact failure the gate exists to prevent.
  //
  // API-106: the series and episode handlers used to treat that null as
  // `'not evaluated'` and publish anyway. They now call this function, so all six
  // types share one gate and one refusal.
  const gate = await evaluateFor(c.env, spec.type, id)
  if (!gate) {
    await auditStatement(db, actorId(c), 'publish_blocked', spec.type, id, {
      previous_status: existing.status,
      blockers: ['readiness_not_evaluable'],
      summary: 'the readiness gate could not evaluate this entity',
    }).run()
    return c.json({
      success: false,
      error: 'Publish blocked: readiness could not be evaluated for this content',
    }, 409)
  }
  if (!gate.publishable) {
    await auditStatement(db, actorId(c), 'publish_blocked', spec.type, id, {
      previous_status: existing.status,
      blockers: gate.blockers.map((blocker) => blocker.id),
      summary: summarizeGate(gate),
    }).run()
    return c.json(gateRefusal(gate), 409)
  }

  const now = new Date().toISOString()
  // الأعمدة تُبنى من الخريطة الحرفية أعلاه لا من الطلب. و`is_published` يُضبط مع
  // `status` في نفس البيان: ضبط أحدهما وحده يُنتج حلقةً «منشورة» لا يراها أحد.
  const columns = [`status = 'published'`]
  const params: unknown[] = []
  if (spec.hasIsPublished) columns.push('is_published = 1')
  if (spec.hasPublishedAt) {
    columns.push('published_at = COALESCE(published_at, ?)')
    params.push(now)
  }
  columns.push(`updated_at = datetime('now')`)
  const update = db.prepare(
    `UPDATE ${spec.table} SET ${columns.join(', ')} WHERE id = ?`,
  ).bind(...params, id)

  await db.batch([
    update,
    // Warnings are recorded with the publish rather than discarded: "was this
    // published knowing the English narration was missing?" is a real question
    // months later, and only the audit row can answer it.
    auditStatement(db, actorId(c), 'publish', spec.type, id, {
      previous_status: existing.status,
      readiness: summarizeGate(gate),
      warnings: gate.warnings.map((warning) => warning.id),
    }),
  ])

  return c.json({
    success: true,
    data: { id, status: 'published', published: true, warnings: gate.warnings },
  })
}

route.post('/stories/:id/publish', requirePermission('publish'), (c) => publish(c, 'story'))
route.post('/books/:id/publish', requirePermission('publish'), (c) => publish(c, 'book'))
route.post('/games/:id/publish', requirePermission('publish'), (c) => publish(c, 'game'))
route.post('/projects/:id/publish', requirePermission('publish'), (c) => publish(c, 'project'))

export default route
