import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
// امتداد `.ts` صريح: مجموعة الاختبارات تعمل بـ`node --experimental-strip-types`
// الذي يطالب بالامتداد في الاستيراد النسبي ولا يستنتجه كما يفعل مُجمِّع wrangler.
// بلا الامتداد لا يمكن استيراد هذا المُوجِّه في اختبار إطلاقًا.
import { queryAll, queryFirst } from '../lib/db.ts'
import { requireAdmin } from '../lib/adminAuth.ts'
import { ENGINES_WITHOUT_MASTERY } from '../lib/engineContracts.ts'
import { parsePagination, UNBOUNDED_LIST_PAGINATION } from '../lib/catalogueValidation.ts'
import type { AdminSessionUser } from '../lib/adminUsers.ts'

type AppEnv = { Bindings: Env; Variables: { adminUser?: AdminSessionUser; adminIsLegacyKey?: boolean } }
const route = new Hono<AppEnv>()

/// حرس صريح لا ضمني: هذه المسارات تكشف تقدّم أطفال بأسمائهم، فحمايتها لا يجوز
/// أن تعتمد على ترتيب التركيب في ملف آخر.
route.use('*', requireAdmin)

/**
 * الإتقان والمحاولات.
 *
 * ## لماذا لم تكن هذه المسارات موجودة
 *
 * `mastery` و`attempts` جدولان من المهاجرة 0001، وكل ما كان يقرأهما هو سطر
 * واحد في `adminAnalytics.ts:20`:
 *
 *   SELECT level, COUNT(*) FROM mastery GROUP BY level
 *
 * أي أن السؤال الوحيد الذي كان يمكن طرحه هو «كم صفًّا في كل مستوى». ولا سبيل
 * لمعرفة **أي طفل** متعثّر، ولا **أي هدف تعليمي** يتعثّر فيه الأطفال عمومًا —
 * وهما السؤالان اللذان يُبنى عليهما قرار تعديل المحتوى.
 *
 * ولذلك بقي عنصر «الإتقان والمحاولات» في القائمة معطَّلًا بلافتة «قريبًا».
 *
 * ## ثلاثة أسئلة، ثلاثة مسارات
 *
 * التجميع بحسب الهدف يجيب «أي هدف يحتاج مراجعة»، والتجميع بحسب الطفل يجيب «من
 * يحتاج مساعدة»، والصفوف الخام تجيب «ما الذي حدث بالضبط». دمجها في مسار واحد
 * يعني استجابة تحمل ثلاثة أشكال لا يستخدم المستدعي إلا واحدًا منها.
 *
 * ## بيانات الأطفال
 *
 * `children_profiles.nickname` كُنية لا اسم قانوني، و`adminFamilyProjection.ts`
 * يكشفها بالفعل للوحة (السطر 78 يبحث بها). فكشفها هنا يتبع سابقة قائمة لا
 * يؤسّس واحدة جديدة. ولا يُعاد `birth_month` ولا `birth_year` ولا البريد: لا
 * حاجة لها في قياس الإتقان، و`lib/auditLog.ts` يحجبها في السجل أصلًا.
 */

/// مستويات الإتقان، مطابقة لقيد CHECK في المهاجرة 0001.
///
/// الترتيب مقصود: من «لم يبدأ» إلى «مستقلّ»، و`needs_review` آخرًا لأنه ليس
/// موقعًا على السلّم بل علامة تراجع.
const MASTERY_LEVELS = [
  'not_started',
  'introduced',
  'practicing',
  'assisted',
  'independent',
  'needs_review',
] as const

/**
 * ملخّص الإتقان لكل هدف تعليمي.
 *
 * يجيب: أي هدف يتعثّر فيه الأطفال؟ الهدف الذي نسبة نجاح محاولاته منخفضة أو
 * الذي يحمل `needs_review` كثيرًا هو مرشَّح لإعادة صياغة أو محتوى إضافي.
 *
 * `success_rate` يُحسب في SQL لا في الواجهة: القسمة على مجموع المحاولات تحتاج
 * كل الصفوف، وحسابها بعد الترقيم يعطي نسبة الصفحة لا نسبة الهدف.
 */
route.get('/mastery/by-objective', async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), UNBOUNDED_LIST_PAGINATION)
  const skillId = c.req.query('skill_id')?.trim()
  const level = c.req.query('level')?.trim()

  if (level && !(MASTERY_LEVELS as readonly string[]).includes(level)) {
    return c.json({ success: false, error: `level must be one of: ${MASTERY_LEVELS.join(', ')}` }, 400)
  }

  const clauses: string[] = []
  const params: unknown[] = []
  if (skillId) { clauses.push('lo.skill_id = ?'); params.push(skillId) }
  // التصفية بالمستوى تُطبَّق على صفوف mastery لا على الهدف: الهدف الذي فيه طفل
  // واحد بـneeds_review يظهر، وعدّاده يبيّن حجم المشكلة.
  if (level) { clauses.push('EXISTS (SELECT 1 FROM mastery m2 WHERE m2.objective_id = lo.id AND m2.level = ?)'); params.push(level) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const total = await queryFirst<{ total: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS total FROM learning_objectives lo ${where}`,
    params,
  )

  // ## لماذا تُقاس «لماذا لا دليل» ولا تُوصَف (`CNT-109`)
  //
  // تبويب التشخيص في `MasteryPage` كان يكتب **عناوين أعمدته مكان قيمها**: ثلاث
  // عبارات ثابتة («محتوى مرتبط»، «ألعاب قادرة على توليد دليل»، «حالة التشغيل»)
  // تتكرّر في كل صفّ من السبعة والخمسين. أي أن التبويب الذي يوجد ليجيب «لماذا لا
  // دليل لهذا الهدف؟» كان يجيب بما **يشبه** الجواب ولا يقيس شيئًا — وأسوأ من
  // الخلية الفارغة، لأن المسؤول يقرأ منه أن لكل هدفٍ محتوى مرتبطًا وألعابًا قادرة،
  // وهو عكس ما يوجد التبويب لكشفه.
  //
  // و«قادرة على توليد دليل» ليست عدد الألعاب المرتبطة: محرّكٌ لا يكتب إتقانًا
  // (`memory_flip`, `rhythm_tap`) لا يُنتج دليلًا أبدًا، فلعبةٌ عليه مرتبطةٌ بهدف
  // هي **خطأ ربط** لا مصدر قياس — وهو ما تحجبه بوابة النشر أصلًا.
  const withoutMastery = ENGINES_WITHOUT_MASTERY.length > 0 ? ENGINES_WITHOUT_MASTERY : ['__none__']
  const withoutMasteryPlaceholders = withoutMastery.map(() => '?').join(', ')

  const rows = await queryAll<Record<string, unknown>>(c.env.DB, `
    SELECT lo.id, lo.code, lo.title_ar, lo.skill_id,
           sk.name_ar AS skill_name,
           (SELECT COUNT(*) FROM episodes e WHERE e.learning_objective_id = lo.id) AS linked_episodes,
           (SELECT COUNT(*) FROM games g WHERE g.learning_objective_id = lo.id) AS linked_games,
           (SELECT COUNT(*) FROM questions q WHERE q.learning_objective_id = lo.id) AS questions_count,
           (SELECT COUNT(*) FROM games g2
              WHERE g2.learning_objective_id = lo.id
                AND g2.status = 'published'
                AND g2.engine_id NOT IN (${withoutMasteryPlaceholders})) AS evidence_capable_games,
           COUNT(m.child_id) AS children_count,
           SUM(CASE WHEN m.level = 'independent' THEN 1 ELSE 0 END) AS independent_count,
           SUM(CASE WHEN m.level = 'needs_review' THEN 1 ELSE 0 END) AS needs_review_count,
           SUM(CASE WHEN m.level = 'not_started' THEN 1 ELSE 0 END) AS not_started_count,
           COALESCE(SUM(m.attempts), 0) AS attempts,
           COALESCE(SUM(m.correct_attempts), 0) AS correct_attempts,
           MAX(m.last_attempt_at) AS last_attempt_at
      FROM learning_objectives lo
      LEFT JOIN skills sk ON sk.id = lo.skill_id
      LEFT JOIN mastery m ON m.objective_id = lo.id
      ${where}
     GROUP BY lo.id
     ORDER BY needs_review_count DESC, lo.code
     LIMIT ? OFFSET ?
  `,
  // المَعلَمات بترتيب ظهور `?` في النصّ: قائمة المحرّكات في `SELECT` فتأتي قبل
  // مَعلَمات `WHERE`. خلطُ الترتيب هنا لا يُنتج خطأً بل **أرقامًا خاطئة**.
  [...withoutMastery, ...params, limit, offset])

  return c.json({
    success: true,
    data: rows.map((row) => {
      const attempts = Number(row.attempts ?? 0)
      const correct = Number(row.correct_attempts ?? 0)
      return {
        ...row,
        linked_episodes: Number(row.linked_episodes ?? 0),
        linked_games: Number(row.linked_games ?? 0),
        questions_count: Number(row.questions_count ?? 0),
        evidence_capable_games: Number(row.evidence_capable_games ?? 0),
        children_count: Number(row.children_count ?? 0),
        independent_count: Number(row.independent_count ?? 0),
        needs_review_count: Number(row.needs_review_count ?? 0),
        not_started_count: Number(row.not_started_count ?? 0),
        attempts,
        correct_attempts: correct,
        // null لا صفر عند غياب المحاولات: «لا بيانات» ليست «نسبة نجاح صفر»،
        // والفرق يقلب قراءة المسؤول للهدف رأسًا على عقب.
        success_rate: attempts > 0 ? Math.round((correct / attempts) * 100) : null,
      }
    }),
    meta: { total: Number(total?.total ?? 0), limit, offset, levels: MASTERY_LEVELS },
  })
})

/**
 * ملخّص الإتقان لكل طفل.
 *
 * يجيب: من يحتاج مساعدة؟ الطفل الذي عدد أهدافه بـ`needs_review` مرتفع أو نسبة
 * نجاحه منخفضة يحتاج تدخّلًا.
 */
route.get('/mastery/by-child', async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), UNBOUNDED_LIST_PAGINATION)
  const track = c.req.query('track')?.trim()
  const parentId = c.req.query('parent_id')?.trim()

  const TRACKS = ['preschool', 'kids', 'junior']
  if (track && !TRACKS.includes(track)) {
    return c.json({ success: false, error: `track must be one of: ${TRACKS.join(', ')}` }, 400)
  }

  // الأطفال المؤرشفون مستثنون: قياس إتقان ملفٍّ متوقّف لا معنى له
  const clauses: string[] = [`cp.status = 'active'`]
  const params: unknown[] = []
  if (track) { clauses.push('cp.age_track = ?'); params.push(track) }
  if (parentId) { clauses.push('cp.parent_id = ?'); params.push(parentId) }
  const where = `WHERE ${clauses.join(' AND ')}`

  const total = await queryFirst<{ total: number }>(
    c.env.DB,
    // API-105: `child_projection` لا `children_profiles`. الثاني صفر صفًّا ولا
    // كاتب له، فكانت هذه الشاشة تعرض «صفر طفل» على منصّة فيها أطفال.
    `SELECT COUNT(*) AS total FROM child_projection cp ${where}`,
    params,
  )

  const rows = await queryAll<Record<string, unknown>>(c.env.DB, `
    SELECT cp.child_id AS child_id, cp.nickname, cp.age_track, cp.parent_id,
           COUNT(m.objective_id) AS objectives_count,
           SUM(CASE WHEN m.level = 'independent' THEN 1 ELSE 0 END) AS independent_count,
           SUM(CASE WHEN m.level = 'needs_review' THEN 1 ELSE 0 END) AS needs_review_count,
           COALESCE(SUM(m.attempts), 0) AS attempts,
           COALESCE(SUM(m.correct_attempts), 0) AS correct_attempts,
           MAX(m.last_attempt_at) AS last_attempt_at
      FROM child_projection cp
      LEFT JOIN mastery m ON m.child_id = cp.child_id
      ${where}
     GROUP BY cp.child_id
     ORDER BY needs_review_count DESC, cp.nickname
     LIMIT ? OFFSET ?
  `, [...params, limit, offset])

  return c.json({
    success: true,
    data: rows.map((row) => {
      const attempts = Number(row.attempts ?? 0)
      const correct = Number(row.correct_attempts ?? 0)
      return {
        ...row,
        objectives_count: Number(row.objectives_count ?? 0),
        independent_count: Number(row.independent_count ?? 0),
        needs_review_count: Number(row.needs_review_count ?? 0),
        attempts,
        correct_attempts: correct,
        success_rate: attempts > 0 ? Math.round((correct / attempts) * 100) : null,
      }
    }),
    meta: { total: Number(total?.total ?? 0), limit, offset },
  })
})

/**
 * المحاولات الخام.
 *
 * `attempts` جدول منفصل عن `mastery`: الأول سجل أحداث والثاني حالة مُجمَّعة.
 * قراءته تجيب «ما الذي حدث بالضبط» — الدرجة والوقت المستغرق وهل استُخدمت
 * المساعدة.
 *
 * عمود `answers` **لا يُعاد**: هو JSON لأجوبة الطفل، وحجمه غير محدود، ولا يفيد
 * في لوحة إدارة بقدر ما يوسّع سطح تعرّض بيانات الأطفال. من يحتاجه يقرأه من
 * الصفّ مباشرة.
 */
route.get('/attempts', async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), UNBOUNDED_LIST_PAGINATION)
  const childId = c.req.query('child_id')?.trim()
  const gameId = c.req.query('game_id')?.trim()
  const episodeId = c.req.query('episode_id')?.trim()

  const clauses: string[] = []
  const params: unknown[] = []
  if (childId) { clauses.push('a.child_id = ?'); params.push(childId) }
  if (gameId) { clauses.push('a.game_id = ?'); params.push(gameId) }
  if (episodeId) { clauses.push('a.episode_id = ?'); params.push(episodeId) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const total = await queryFirst<{ total: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS total FROM attempts a ${where}`,
    params,
  )

  const rows = await queryAll<Record<string, unknown>>(c.env.DB, `
    SELECT a.id, a.child_id, cp.nickname, a.episode_id, a.game_id,
           a.score, a.max_score, a.time_spent_seconds, a.help_used, a.created_at,
           g.title_ar AS game_title, e.title_ar AS episode_title
      FROM attempts a
      LEFT JOIN child_projection cp ON cp.child_id = a.child_id
      LEFT JOIN games g ON g.id = a.game_id
      LEFT JOIN episodes e ON e.id = a.episode_id
      ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?
  `, [...params, limit, offset])

  return c.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      help_used: Number(row.help_used) === 1,
      // النسبة تُحسب فقط عندما يكون للدرجة سقف: score بلا max_score لا يقبل
      // تحويلًا إلى نسبة مئوية.
      score_percent: row.score != null && row.max_score != null && Number(row.max_score) > 0
        ? Math.round((Number(row.score) / Number(row.max_score)) * 100)
        : null,
    })),
    meta: { total: Number(total?.total ?? 0), limit, offset },
  })
})

export default route
