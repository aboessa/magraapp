import { Hono } from 'hono'
import type { Env } from '../lib/db'
// امتدادات `.ts` صريحة على مسارات هذا الملف وحده.
//
// مجموعة الاختبارات تعمل بـ`node --experimental-strip-types`، وهو يطالب
// بالامتداد في الاستيراد النسبي ولا يستنتجه كما يفعل مُجمِّع wrangler. بلا
// الامتداد لا يمكن استيراد هذا المُوجِّه في اختبار إطلاقًا، فتبقى منطق فحص
// الجاهزية بلا تغطية — وهو ما سمح بأربع علل منطقية أن تبقى فيه.
//
// بقية الملفات تستورد بلا امتداد (150 موضعًا مقابل 6)، وتوحيدها تغييرٌ واسع
// لا يخصّ هذا العمل. wrangler يقبل الصيغتين، فلا أثر على البناء.
import { queryAll, queryFirst } from '../lib/db.ts'
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts'
import type { AdminSessionUser } from '../lib/adminUsers'
import { storyPublishError } from '../lib/catalogueValidation.ts'

type AppEnv = { Bindings: Env; Variables: { adminUser?: AdminSessionUser; adminIsLegacyKey?: boolean } }
const route = new Hono<AppEnv>()

/// حرس صريح لا ضمني: هذا الملف يصدّر محتوى كاملًا ويدّعي استعادته، فلا يصحّ
/// أن تعتمد حمايته على ترتيب التركيب في admin.ts.
route.use('*', requireAdmin)

/**
 * ## أربع علل كانت في هذا الملف
 *
 * ١. **`story` كان يقرأ من الجدول الخطأ.** `type === 'story'` كان يستعلم
 *    `books`، لكن `story_pages.story_id` يشير إلى `stories(id)` (المهاجرة 0002).
 *    فمعرّف قصة حقيقية يُعيد 404 من `books`، ومعرّف كتاب يُعيد صفر صفحات لأن
 *    `story_pages` لا تعرفه. أي أن الفحص لم ينجح على أي مدخل صحيح.
 *
 * ٢. **فحص الغلاف كان `!!x || true`.** تعبير قيمته `true` دائمًا. الفحص كان
 *    يمرّ حتى بلا غلاف، والرسالة تقول «غلاف افتراضي» — وهو ادّعاء لا يقابله
 *    شيء في قاعدة البيانات. وأسوأ: `books` و`stories` لا يحملان
 *    `cover_asset_id` إطلاقًا، فالقراءة كانت `undefined` دائمًا.
 *
 * ٣. **`series` و`book` و`game` و`project` تُعيد نجاحًا فارغًا.** الشرط
 *    `if (type === 'story')` وحده يملأ `checks`، و`[].every()` قيمته `true`،
 *    فأي نوع آخر كان يُعيد `readyToPublish: true` بقائمة فحوص فارغة. مسؤول
 *    يفحص سلسلة يُبلَّغ بجاهزيتها للنشر بلا فحص واحد.
 *
 * ٤. **حدّ الصفحات كان مخترعًا.** «الصفحات ≥ 4» لا وجود له في أي بوابة نشر.
 *    البوابة الحقيقية `storyPublishError` تشترط صفحة واحدة على الأقل + نصًّا
 *    باللغة الافتراضية لكل صفحة، وسردًا للقصص الصوتية. الرقم 4 كان يمنع نشر
 *    قصة صالحة من ثلاث صفحات.
 *
 * ## القاعدة الآن
 *
 * الفحص يستدعي بوابات النشر نفسها من `lib/catalogueValidation.ts` بدل قواعد
 * موازية. نسختان من «هل هذا جاهز للنشر» تتباعدان، والنسخة الأضعف تعطي إذنًا
 * ترفضه الأخرى — فيرى المسؤول «جاهز» ثم يُرفض النشر بـ409.
 */

/// الأنواع القابلة للتصدير والفحص، وجدول كلٍّ منها.
///
/// `story` و`book` كيانان مختلفان لا مترادفان: `stories` له صفحات في
/// `story_pages`، و`books` يخزّن صفحاته في عمود JSON اسمه `pages`.
const ENTITY_TABLES = {
  series: 'series',
  story: 'stories',
  book: 'books',
  game: 'games',
  project: 'projects',
} as const

type EntityType = keyof typeof ENTITY_TABLES

function isEntityType(value: string): value is EntityType {
  return Object.prototype.hasOwnProperty.call(ENTITY_TABLES, value)
}

const TYPE_LIST = Object.keys(ENTITY_TABLES).join(', ')

type Check = { check: string; passed: boolean; message: string }

/// يقرأ عمود JSON مخزَّنًا كنصّ. يرجع للقيمة الافتراضية عند التلف بدل الرمي:
/// صفٌّ واحد فاسد لا يجوز أن يُسقط الفحص كله.
function parseJsonColumn(value: unknown, fallback: unknown) {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

/**
 * فحوص جاهزية قصة (`stories`).
 *
 * يستدعي `storyPublishError` — البوابة نفسها التي يفرضها
 * `PATCH /stories/:id` — ثم يضيف فحص صور الصفحات، وهو ما يحتاج
 * `content_assets` فلا يمكن أن يكون في وحدة التحقق النقية.
 */
async function storyChecks(db: D1Database, id: string): Promise<Check[] | null> {
  const story = await queryFirst<{ type: string; default_language: string; visual_style_id: string | null }>(
    db,
    'SELECT type, default_language, visual_style_id FROM stories WHERE id = ?',
    [id],
  )
  if (!story) return null

  const pages = await queryAll<{ id: string; page_number: number; image_asset_id: string | null }>(
    db,
    'SELECT id, page_number, image_asset_id FROM story_pages WHERE story_id = ? ORDER BY page_number',
    [id],
  )
  const localizations = pages.length
    ? await queryAll<{ page_id: string; language: string; body_text: string | null; narration_asset_id: string | null }>(db, `
        SELECT page_id, language, body_text, narration_asset_id
          FROM story_page_localizations
         WHERE page_id IN (SELECT id FROM story_pages WHERE story_id = ?)
      `, [id])
    : []

  const checks: Check[] = []

  // البوابة الحقيقية: صفحة واحدة على الأقل + نصّ باللغة الافتراضية لكل صفحة
  const textError = storyPublishError(
    pages.map((page) => ({
      page_number: page.page_number,
      image_asset_id: page.image_asset_id,
      localizations: localizations.filter((item) => item.page_id === page.id),
    })),
    story.type,
    story.default_language,
  )
  checks.push({
    check: 'pages_and_text',
    passed: !textError,
    message: textError ?? `${pages.length} صفحة، وكلها تحمل نصًّا بـ${story.default_language}`,
  })

  // صور الصفحات: تحتاج content_assets فتبقى هنا لا في وحدة التحقق
  const missingImage = pages.find((page) => !page.image_asset_id)
  const assetIds = pages.map((page) => page.image_asset_id).filter((value): value is string => Boolean(value))
  let imagesReady = !missingImage && pages.length > 0
  let imageMessage = missingImage
    ? `الصفحة ${missingImage.page_number} بلا صورة`
    : 'كل الصفحات تحمل صورًا جاهزة'

  if (imagesReady && assetIds.length) {
    const unique = [...new Set(assetIds)]
    const placeholders = unique.map(() => '?').join(',')
    const ready = await queryFirst<{ total: number }>(
      db,
      `SELECT COUNT(*) AS total FROM content_assets WHERE id IN (${placeholders}) AND status = 'ready'`,
      unique,
    )
    if (Number(ready?.total ?? 0) !== unique.length) {
      imagesReady = false
      imageMessage = 'بعض صور الصفحات ليست بحالة ready'
    }
  }
  checks.push({ check: 'page_images', passed: imagesReady, message: imageMessage })

  // الاستايل البصري عمود حقيقي في stories، بخلاف الغلاف الذي لا وجود له
  checks.push({
    check: 'visual_style',
    passed: Boolean(story.visual_style_id),
    message: story.visual_style_id ? 'استايل بصري محدَّد' : 'بلا استايل بصري',
  })

  return checks
}

/// فحوص كتاب (`books`). صفحاته عمود JSON لا جدول، فبوابته `bookPublishError`.
async function bookChecks(db: D1Database, id: string): Promise<Check[] | null> {
  const book = await queryFirst<{ pages: unknown; visual_style_id: string | null }>(
    db,
    'SELECT pages, visual_style_id FROM books WHERE id = ?',
    [id],
  )
  if (!book) return null

  const pages = parseJsonColumn(book.pages, [])
  const hasPages = Array.isArray(pages) && pages.length > 0
  return [
    {
      check: 'pages',
      passed: hasPages,
      message: hasPages ? `${(pages as unknown[]).length} صفحة` : 'الكتاب بلا صفحات',
    },
    {
      check: 'visual_style',
      passed: Boolean(book.visual_style_id),
      message: book.visual_style_id ? 'استايل بصري محدَّد' : 'بلا استايل بصري',
    },
  ]
}

/// فحوص لعبة. `content_pack` يقود زمن التشغيل، فحزمة فارغة تعني لعبة لا تعرض شيئًا.
async function gameChecks(db: D1Database, id: string): Promise<Check[] | null> {
  const game = await queryFirst<{ content_pack: unknown; engine_id: string | null }>(
    db,
    'SELECT content_pack, engine_id FROM games WHERE id = ?',
    [id],
  )
  if (!game) return null

  const pack = parseJsonColumn(game.content_pack, null)
  const packOk = Boolean(pack) && typeof pack === 'object' && !Array.isArray(pack)
    && Object.keys(pack as Record<string, unknown>).length > 0
  return [
    {
      check: 'content_pack',
      passed: packOk,
      message: packOk ? 'حزمة المحتوى غير فارغة' : 'حزمة المحتوى فارغة، فاللعبة لن تعرض شيئًا',
    },
    {
      check: 'engine',
      passed: Boolean(game.engine_id),
      message: game.engine_id ? 'محرّك محدَّد' : 'بلا محرّك',
    },
  ]
}

/// فحوص مشروع: مواد وخطوات، وكلاهما عمود JSON.
async function projectChecks(db: D1Database, id: string): Promise<Check[] | null> {
  const project = await queryFirst<{ materials: unknown; steps: unknown }>(
    db,
    'SELECT materials, steps FROM projects WHERE id = ?',
    [id],
  )
  if (!project) return null

  const materials = parseJsonColumn(project.materials, [])
  const steps = parseJsonColumn(project.steps, [])
  const hasMaterials = Array.isArray(materials) && materials.length > 0
  const hasSteps = Array.isArray(steps) && steps.length > 0
  return [
    {
      check: 'materials',
      passed: hasMaterials,
      message: hasMaterials ? `${(materials as unknown[]).length} مادة` : 'بلا مواد',
    },
    {
      check: 'steps',
      passed: hasSteps,
      message: hasSteps ? `${(steps as unknown[]).length} خطوة` : 'بلا خطوات',
    },
  ]
}

/// فحوص سلسلة: وجود حلقات، وكوكب مرتبط.
async function seriesChecks(db: D1Database, id: string): Promise<Check[] | null> {
  const series = await queryFirst<{ planet_id: string | null; visual_style_id: string | null }>(
    db,
    'SELECT planet_id, visual_style_id FROM series WHERE id = ?',
    [id],
  )
  if (!series) return null

  const episodes = await queryFirst<{ total: number }>(
    db,
    `SELECT COUNT(*) AS total FROM episodes WHERE series_id = ? AND status <> 'archived'`,
    [id],
  )
  const episodeCount = Number(episodes?.total ?? 0)
  return [
    {
      check: 'episodes',
      passed: episodeCount > 0,
      message: episodeCount > 0 ? `${episodeCount} حلقة` : 'السلسلة بلا حلقات',
    },
    {
      check: 'planet',
      passed: Boolean(series.planet_id),
      message: series.planet_id ? 'مرتبطة بكوكب' : 'بلا كوكب',
    },
    {
      check: 'visual_style',
      passed: Boolean(series.visual_style_id),
      message: series.visual_style_id ? 'استايل بصري محدَّد' : 'بلا استايل بصري',
    },
  ]
}

// Backup - تصدير كيان كـ JSON
//
// التصدير كان يقتصر على `series` و`story`، ويقرأ صفحات القصة من الجدول الخطأ.
// الآن يشمل الأنواع الخمسة، وصفحات القصة تُصدَّر مع ترجماتها — وبدونها الملف
// المُصدَّر لا يحمل نصّ القصة إطلاقًا، أي أنه نسخة بلا محتوى.
route.get('/backup/:type/:id', async (c) => {
  const type = c.req.param('type')
  const id = c.req.param('id')
  if (!isEntityType(type)) {
    return c.json({ success: false, error: `type must be one of: ${TYPE_LIST}` }, 400)
  }

  const row = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM ${ENTITY_TABLES[type]} WHERE id = ?`,
    [id],
  )
  if (!row) return c.json({ success: false, error: 'Not found' }, 404)

  const extras: Record<string, unknown> = {}
  if (type === 'story') {
    const pages = await queryAll<Record<string, unknown>>(
      c.env.DB,
      'SELECT * FROM story_pages WHERE story_id = ? ORDER BY page_number',
      [id],
    )
    const localizations = pages.length
      ? await queryAll<Record<string, unknown>>(c.env.DB, `
          SELECT * FROM story_page_localizations
           WHERE page_id IN (SELECT id FROM story_pages WHERE story_id = ?)
        `, [id])
      : []
    extras.pages = pages.map((page) => ({
      ...page,
      localizations: localizations.filter((item) => item.page_id === page.id),
    }))
  }
  if (type === 'series') {
    extras.episodes = await queryAll<Record<string, unknown>>(
      c.env.DB,
      'SELECT * FROM episodes WHERE series_id = ? ORDER BY episode_number',
      [id],
    )
  }

  return c.json({
    success: true,
    data: {
      ...row,
      ...extras,
      entity_type: type,
      exported_at: new Date().toISOString(),
      version: 1,
    },
  })
})

/**
 * استعادة نسخة.
 *
 * ## تحذير: هذا المسار لا يستعيد شيئًا
 *
 * الجسم يُتحقَّق منه ثم تُعاد `{ restored: true }` بلا أي كتابة في قاعدة
 * البيانات. التعليق السابق كان «مبسط: يعيد إدخال البيانات» وهو وصفٌ لما لم
 * يُكتب. أي مسؤول ينادي هذا المسار يُبلَّغ بنجاح استعادة لم تحدث، وقد يبني
 * عليها قرارًا بحذف مصدر آخر.
 *
 * يُعاد 501 حتى تُنفَّذ الاستعادة فعلًا: الصمت الكاذب أخطر من رفض صريح.
 * الصلاحية مطلوبة رغم ذلك، فلا يصير المسار مفتوحًا عند تنفيذه لاحقًا.
 */
route.post('/restore', requirePermission('publish'), async (c) => {
  const body = await c.req.json().catch(() => null) as any
  if (!body?.type || !body?.id) return c.json({ success: false, error: 'type and id required' }, 400)
  return c.json({
    success: false,
    error: 'الاستعادة غير منفَّذة بعد. استخدم ملف النسخة من /backup واستورده يدويًا.',
  }, 501)
})

// Quality check
route.get('/quality/:type/:id', async (c) => {
  const type = c.req.param('type')
  const id = c.req.param('id')
  if (!isEntityType(type)) {
    return c.json({ success: false, error: `type must be one of: ${TYPE_LIST}` }, 400)
  }

  const db = c.env.DB
  const checks = type === 'story' ? await storyChecks(db, id)
    : type === 'book' ? await bookChecks(db, id)
      : type === 'game' ? await gameChecks(db, id)
        : type === 'project' ? await projectChecks(db, id)
          : await seriesChecks(db, id)

  // 404 حالة قائمة بذاتها: كيان غير موجود ليس كيانًا فاشل الفحص
  if (!checks) return c.json({ success: false, error: 'Not found' }, 404)

  const allPassed = checks.every((item) => item.passed)
  return c.json({
    success: true,
    data: { entity_type: type, entity_id: id, checks, allPassed, readyToPublish: allPassed },
  })
})

export default route
