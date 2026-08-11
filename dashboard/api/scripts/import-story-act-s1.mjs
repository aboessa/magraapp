/**
 * يستورد قصة «بيت الطائر» (act-s1) المصوّرة والمسرودة إلى R2 وD1.
 *
 * ## ما كان ناقصًا
 *
 * الأصول كانت على القرص وحده: ١١ صورة و١٦ ملف سرد، ومعاينة HTML مبنية منها. أمّا
 * قاعدة البيانات فلم تعرف عنها شيئًا — لا `content_assets` ولا رابط صورة في
 * `story_pages` ولا `narration_asset_id`. والقصة نفسها موجودة محليًّا بنصّها العربي
 * وبديلها النصّي، لكن بلا صور ولا صوت ولا مدد، وبلا صفوف إنجليزية أصلًا.
 *
 * ## لماذا سكربت لا SQL يدويّ
 *
 * ثلاثة أشياء لا يمكن كتابتها بيدٍ بثقة: مجموع sha256 لكل ملف، حجمه بالبايت،
 * والمدّة المقيسة من رأس WAV. أي انحراف في واحدة منها يعني صفًّا يكذب على المدقّق.
 * السكربت يقرأها من الملفّ نفسه في كل تشغيل، فلا مجال لانحراف.
 *
 * ## قابل لإعادة التشغيل
 *
 * كل كتابة `ON CONFLICT ... DO UPDATE` أو `INSERT OR IGNORE`، ومعرّفات الأصول
 * مشتقّة من مسارها (`asset-act-s1-page-001`) لا مولَّدة عشوائيًّا. فتشغيله مرتين
 * يُنتج الحالة نفسها، وتشغيله بعد تحديث صورة يُحدّث المجموع والحجم وحدهما.
 *
 * ## قواعد الدلاء ليست خيارًا
 *
 * `lib/assetBuckets.ts` يجعل الدلو دالةً في `visibility`، و`lib/assetUrls.ts` يرفض
 * بناء رابط عام إذا اختلفت بادئة المفتاح عن العمود. لذلك:
 *
 *   صور القصة   visibility=public   bucket=thumbs   key=public/...
 *   سرد القصة   visibility=public   bucket=thumbs   key=public/...
 *
 * السرد عام بقصد: هو جزء من تجربة القراءة لا محتوى مقيَّد بالاشتراك، والقصة نفسها
 * `is_free = 1`. لو صار مقيَّدًا يومًا فالمكان الصحيح `MEDIA_BUCKET` مع رمز قدرة،
 * لا مفتاح عام في دلو الـCDN.
 *
 * ## ما لا يفعله هذا السكربت
 *
 * لا يُغيّر حالة القصة إلى `published`. البذر لا يُنشر محتوى: المراجعة اللغوية
 * والتربوية بوّابة بشرية، وملفّ القصة نفسه يقول `status: draft`. يُوصل السكربت
 * القصة إلى `ready` تقنيًّا (أصول مكتملة ومرتبطة) ويترك النشر لقراره الصحيح.
 *
 * Usage:
 *   node scripts/import-story-act-s1.mjs [--remote] [--dry-run] [--skip-upload]
 */

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(scriptDir, '..')
const rootDir = path.resolve(apiDir, '..', '..')
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler')

const args = new Set(process.argv.slice(2))
const isRemote = args.has('--remote')
const dryRun = args.has('--dry-run')
const skipUpload = args.has('--skip-upload')
const targetFlag = isRemote ? '--remote' : '--local'
/// `--env production` لازم للبعيد وحده: البيئة العليا للتطوير المحلّي، ودلاؤها
/// وقاعدتها ليست الإنتاج (`majarra-creations-dev` مثلًا).
const envFlags = isRemote ? ['--env', 'production'] : []

const STORY_ID = 'story-bird-home'
const STORY_SLUG = 'bird-home'
const SERIES_ID = 'series-preschool-calm-tale'
const IMAGE_DIR = 'assets/images/stories/act-s1-playveo'
const AUDIO_DIR = 'assets/audio/stories/act-s1'

/// نصوص الصفحات وبدائلها. المصدر ملفّ القصة و`narration.locked.json`، ومنقولة
/// حرفيًّا: البديل النصّي وصفٌ لما في الصورة لا إعادة صياغة للسرد، فهما حقلان
/// مختلفان لقارئ الشاشة.
const PAGES = [
  {
    page: 1,
    transition: 'kenburns_slow',
    ar: 'هذا زُغب. بيته عشّ صغير.',
    en: 'This is Fluff. His home is a small nest.',
    altAr: 'عشّ صغير على فرع. زُغب فيه، وأمّه بجانبه. ضوء نهار دافئ.',
    altEn: 'A small nest on a branch. Fluff is inside it with his mother beside him, in warm daylight.',
  },
  {
    page: 2,
    transition: 'kenburns_slow',
    ar: 'اليوم يريد أن يطير قليلًا.',
    en: 'Today he wants to fly a little.',
    altAr: 'زُغب على حرف العشّ، ينظر إلى السماء. العشّ ما زال في الكادر.',
    altEn: 'Fluff on the rim of the nest, looking up at the sky. The nest is still in frame.',
  },
  {
    page: 3,
    transition: 'pan_slow',
    ar: 'طار إلى الشجرة. ثم أبعد قليلًا.',
    en: 'He flew to the tree. Then a little farther.',
    altAr: 'زُغب يطير قريبًا من الشجرة. العشّ مرئي في الخلف صغيرًا.',
    altEn: 'Fluff flying near the tree. The nest is visible small in the background.',
  },
  {
    page: 4,
    transition: 'pan_slow',
    ar: 'هبّت ريح خفيفة. فتحرّكت الأوراق.',
    en: 'A soft wind blew. The leaves moved.',
    altAr: 'ريح خفيفة تحرّك الأوراق. زُغب يميل قليلًا في الهواء. العشّ ما زال مرئيًا.',
    altEn: 'A soft wind moves the leaves. Fluff tilts a little in the air. The nest is still visible.',
  },
  {
    page: 5,
    transition: 'kenburns_slow',
    ar: 'نظر زُغب إلى بيته. وعرف طريقه.',
    en: 'Fluff looked at his home. He knew the way.',
    altAr: 'زُغب يلتفت نحو العشّ. الضوء يميل للمساء.',
    altEn: 'Fluff turns towards the nest. The light is shifting towards evening.',
  },
  {
    page: 6,
    transition: 'kenburns_slow',
    ar: 'فطار إلى العشّ. وأمّه تنتظره.',
    en: 'He flew to the nest. His mother was waiting.',
    altAr: 'زُغب يهبط في العشّ. أمّه تفتح جناحها له.',
    altEn: 'Fluff lands in the nest. His mother opens her wing for him.',
  },
  {
    page: 7,
    transition: 'static',
    ar: 'جلس قريبًا منها. والريح هدأت.',
    en: 'He sat close beside her. The wind grew still.',
    altAr: 'زُغب تحت جناح أمّه. المساء. قمر خفيف في السماء.',
    altEn: 'Fluff under his mother’s wing in the evening, with a faint moon in the sky.',
  },
  {
    page: 8,
    transition: 'static',
    ar: 'والآن ينام زُغب في بيته.',
    en: 'And now Fluff sleeps in his home.',
    altAr: 'العشّ من بعيد قليلًا. زُغب وأمّه ساكنان. قمر هادئ.',
    altEn: 'The nest seen from a little farther away. Fluff and his mother are still, under a calm moon.',
  },
]

/// أصول الغلاف. النسب من `playveo/act-s1.manifest.json` ولها أدوار مختلفة في
/// الواجهة، فلا يصلح أحدها بديلًا عن الآخر.
const COVER_ASSETS = [
  { file: 'cover.jpg', role: 'cover', aspect: '1:1', titleAr: 'غلاف بيت الطائر' },
  { file: 'hero.jpg', role: 'hero', aspect: '16:9', titleAr: 'صورة رئيسية لبيت الطائر' },
  { file: 'thumb.jpg', role: 'thumbnail', aspect: '3:4', titleAr: 'مصغّرة بيت الطائر' },
]

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.wav': 'audio/wav' }

function sql(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  return `'${String(value).replaceAll("'", "''")}'`
}

function run(argv, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(wrangler, argv, { cwd: apiDir, stdio: options.quiet ? 'pipe' : 'inherit', shell: process.platform === 'win32' })
    let stderr = ''
    if (options.quiet) child.stderr?.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`wrangler ${argv[0]} ${argv[1]} exited ${code}${stderr ? `: ${stderr.slice(0, 400)}` : ''}`))))
  })
}

/// المدّة من رأس RIFF لا من ملفّ جانبي.
///
/// `_durations.json` يحمل القيم نفسها، لكن قراءة الرأس تجعل الصفّ مشتقًّا من
/// الملفّ الذي سيُرفع فعلًا. لو استُبدل ملفّ صوت ولم يُحدَّث الملفّ الجانبي، تكتشف
/// القراءة الاختلاف بدل أن تنسخ رقمًا قديمًا.
function wavDurationMs(buffer) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') return null
  const byteRate = buffer.readUInt32LE(28)
  if (!byteRate) return null
  // حجم قطعة data من الرأس القياسي ٤٤ بايت الذي يكتبه tools/tts/narrate.mjs.
  const dataSize = buffer.readUInt32LE(40)
  if (!dataSize) return null
  return Math.round((dataSize / byteRate) * 1000)
}

async function readAsset(relativePath) {
  const absolute = path.join(rootDir, relativePath)
  const data = await fs.readFile(absolute)
  const extension = path.extname(relativePath).toLowerCase()
  return {
    absolute,
    relativePath,
    data,
    size: data.length,
    checksum: createHash('sha256').update(data).digest('hex'),
    mime: MIME[extension] ?? 'application/octet-stream',
    durationMs: extension === '.wav' ? wavDurationMs(data) : null,
  }
}

async function main() {
  const records = []

  // --- الصور ---------------------------------------------------------------
  for (const entry of PAGES) {
    const file = `page-${String(entry.page).padStart(3, '0')}.jpg`
    const asset = await readAsset(`${IMAGE_DIR}/${file}`)
    records.push({
      ...asset,
      id: `asset-act-s1-page-${String(entry.page).padStart(3, '0')}`,
      kind: 'image',
      titleAr: `بيت الطائر — الصفحة ${entry.page}`,
      aspect: '16:9',
      language: null,
      page: entry.page,
      purpose: 'page-image',
    })
  }

  for (const cover of COVER_ASSETS) {
    const asset = await readAsset(`${IMAGE_DIR}/${cover.file}`)
    records.push({
      ...asset,
      id: `asset-act-s1-${cover.role === 'thumbnail' ? 'thumb' : cover.role}`,
      kind: 'image',
      titleAr: cover.titleAr,
      aspect: cover.aspect,
      language: null,
      page: null,
      purpose: 'cover',
      role: cover.role,
    })
  }

  // --- السرد ---------------------------------------------------------------
  for (const language of ['ar', 'en']) {
    for (const entry of PAGES) {
      const file = `page-${String(entry.page).padStart(3, '0')}-${language}.wav`
      const asset = await readAsset(`${AUDIO_DIR}/${language}/${file}`)
      if (!asset.durationMs) throw new Error(`could not measure duration for ${file}`)
      records.push({
        ...asset,
        id: `asset-act-s1-vo-${language}-${String(entry.page).padStart(3, '0')}`,
        kind: 'audio',
        titleAr: `سرد بيت الطائر — الصفحة ${entry.page} (${language})`,
        aspect: null,
        language,
        page: entry.page,
        purpose: 'narration',
      })
    }
  }

  // مفتاح R2 مشتقّ من المسار النسبي تحت بادئة النطاق، فيبقى مقروءًا في الدلو
  // ومطابقًا للاتفاق الذي يفحصه `keyPrefixMatchesVisibility`.
  for (const record of records) {
    record.visibility = 'public'
    record.bucket = 'thumbs'
    record.r2Key = `public/catalog/${record.relativePath}`
  }

  // --- مدّة الصفحة: نيّة تحريرية، لا طول ملفّ الصوت -------------------------
  //
  // `story_pages.duration_ms` هو مدّة *عرض* الصفحة، وهي ليست دائمًا طول السرد.
  // الصفحة ٨ تحمل `preRollMs: 800` في `_durations.json` (صمت مقصود قبل السطر
  // الأخير، لأنّ القصة تنتهي بسكون)، فمدّتها 6480ms مع أنّ الـwav 5680ms.
  //
  // فالرقمان مصدرهما مختلف بحقّ: طول الـwav يُقاس من الملفّ، ومدّة الصفحة تُقرأ من
  // الملفّ الجانبي الذي يحمل القرار التحريري. ونقارنهما: لو خالف
  // `measuredDurationMs` رأسَ الـwav فذلك انحراف بين الملفّ الجانبي والصوت
  // المرفوع، وهو خطأ يجب أن يوقف الاستيراد لا أن يُبلَع صامتًا.
  const sidecar = JSON.parse(await fs.readFile(path.join(rootDir, AUDIO_DIR, 'ar', '_durations.json'), 'utf8'))
  const durations = new Map()
  for (const entry of sidecar.pages) {
    const measuredFromWav = records.find((r) => r.purpose === 'narration' && r.language === 'ar' && r.page === entry.page)?.durationMs
    if (measuredFromWav !== entry.measuredDurationMs) {
      throw new Error(`page ${entry.page}: _durations.json says ${entry.measuredDurationMs}ms but the wav header says ${measuredFromWav}ms`)
    }
    durations.set(entry.page, entry.pageDurationMs ?? entry.measuredDurationMs)
  }

  console.log(`act-s1: ${records.length} assets`)
  console.log(`  images    ${records.filter((r) => r.kind === 'image').length}`)
  console.log(`  narration ${records.filter((r) => r.kind === 'audio').length}`)
  console.log(`  AR total  ${(([...durations.values()].reduce((a, b) => a + b, 0)) / 1000).toFixed(1)}s`)
  console.log(`  target    ${isRemote ? 'REMOTE (production)' : 'local'}`)

  if (dryRun) {
    for (const record of records) {
      console.log(`  ${record.id.padEnd(30)} ${String(record.size).padStart(8)}B  ${record.r2Key}`)
    }
    console.log('\ndry run: nothing written')
    return
  }

  // --- رفع الكائنات إلى R2 -------------------------------------------------
  if (!skipUpload) {
    const bucketName = 'majarra-thumbs'
    let done = 0
    for (const record of records) {
      await run([
        'r2', 'object', 'put', `${bucketName}/${record.r2Key}`,
        `--file=${record.absolute}`,
        `--content-type=${record.mime}`,
        ...(isRemote ? ['--remote'] : ['--local']),
      ], { quiet: true })
      done += 1
      if (done % 8 === 0 || done === records.length) console.log(`  uploaded ${done}/${records.length}`)
    }
  }

  // --- صفوف D1 ------------------------------------------------------------
  const statements = []

  for (const record of records) {
    const metadata = {
      story: 'act-s1',
      purpose: record.purpose,
      ...(record.page ? { page: record.page } : {}),
      ...(record.durationMs ? { duration_ms: record.durationMs } : {}),
      source_manifest: record.kind === 'audio' ? `tools/tts/act-s1.narration${record.language === 'en' ? '.en' : '.locked'}.json` : 'tools/playveo/act-s1.manifest.json',
    }
    statements.push(`
INSERT INTO content_assets (
  id, title_ar, kind, source, status, original_filename, expected_path, r2_key, bucket,
  mime_type, size_bytes, checksum_sha256, visibility, language, aspect_ratio, metadata, uploaded_by, updated_at
) VALUES (
  ${sql(record.id)}, ${sql(record.titleAr)}, ${sql(record.kind)}, 'generated', 'ready',
  ${sql(path.basename(record.relativePath))}, ${sql(record.relativePath)}, ${sql(record.r2Key)}, ${sql(record.bucket)},
  ${sql(record.mime)}, ${sql(record.size)}, ${sql(record.checksum)}, ${sql(record.visibility)},
  ${sql(record.language)}, ${sql(record.aspect)}, ${sql(JSON.stringify(metadata))}, 'story-import-act-s1', datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  title_ar = excluded.title_ar, status = excluded.status, r2_key = excluded.r2_key,
  bucket = excluded.bucket, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
  checksum_sha256 = excluded.checksum_sha256, visibility = excluded.visibility,
  language = excluded.language, aspect_ratio = excluded.aspect_ratio, metadata = excluded.metadata,
  updated_at = datetime('now');`)
  }

  // القصة. `languages` تصير ["ar","en"] لأنّ السرد الإنجليزي صار موجودًا فعلًا،
  // والحالة `ready` لا `published`: الأصول مكتملة، والنشر قرار تحريري.
  statements.push(`
INSERT INTO stories (
  id, series_id, slug, title_ar, title_en, description_ar, type, age_min, age_max,
  reading_level, interaction_mode, supervision_level, default_language, languages,
  status, is_free, price_tier, sort_order, updated_at
) VALUES (
  ${sql(STORY_ID)}, ${sql(SERIES_ID)}, ${sql(STORY_SLUG)}, 'بيت الطائر', 'Bird Home',
  'طائر صغير يطير بعيدًا، ثم يعود إلى عشّه', 'picture_book', 3, 5,
  'pre_reader', 'tap', 'recommended', 'ar', '["ar","en"]',
  'ready', 1, 'free', 1, datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  series_id = excluded.series_id, title_en = excluded.title_en,
  description_ar = excluded.description_ar, languages = excluded.languages,
  status = excluded.status, is_free = excluded.is_free, price_tier = excluded.price_tier,
  updated_at = datetime('now');`)

  for (const entry of PAGES) {
    const pageId = `page-bird-home-${String(entry.page).padStart(3, '0')}`
    const imageId = `asset-act-s1-page-${String(entry.page).padStart(3, '0')}`
    const durationMs = durations.get(entry.page)
    statements.push(`
INSERT INTO story_pages (id, story_id, page_number, layout, image_asset_id, duration_ms, transition, sort_order, updated_at)
VALUES (${sql(pageId)}, ${sql(STORY_ID)}, ${entry.page}, 'full_bleed', ${sql(imageId)}, ${sql(durationMs)}, ${sql(entry.transition)}, ${entry.page}, datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  image_asset_id = excluded.image_asset_id, duration_ms = excluded.duration_ms,
  transition = excluded.transition, layout = excluded.layout, updated_at = datetime('now');`)

    for (const language of ['ar', 'en']) {
      const narrationId = `asset-act-s1-vo-${language}-${String(entry.page).padStart(3, '0')}`
      statements.push(`
INSERT INTO story_page_localizations (page_id, language, body_text, alt_text, narration_asset_id, updated_at)
VALUES (${sql(pageId)}, ${sql(language)}, ${sql(language === 'ar' ? entry.ar : entry.en)}, ${sql(language === 'ar' ? entry.altAr : entry.altEn)}, ${sql(narrationId)}, datetime('now'))
ON CONFLICT(page_id, language) DO UPDATE SET
  body_text = excluded.body_text, alt_text = excluded.alt_text,
  narration_asset_id = excluded.narration_asset_id, updated_at = datetime('now');`)
    }
  }

  // روابط الغلاف. المعرّف مشتقّ من الدور، فإعادة التشغيل لا تُنشئ رابطًا ثانيًا.
  for (const cover of COVER_ASSETS) {
    const assetId = `asset-act-s1-${cover.role === 'thumbnail' ? 'thumb' : cover.role}`
    statements.push(`
INSERT INTO asset_links (id, asset_id, entity_type, entity_id, role, sort_order)
VALUES (${sql(`link-act-s1-${cover.role}`)}, ${sql(assetId)}, 'story', ${sql(STORY_ID)}, ${sql(cover.role)}, 0)
ON CONFLICT(id) DO UPDATE SET asset_id = excluded.asset_id, role = excluded.role;`)
  }

  statements.push(`
INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details)
VALUES (${sql(`audit-import-act-s1-${Date.now()}`)}, 'story-import-act-s1', 'bulk_import', 'story', ${sql(STORY_ID)},
  ${sql(JSON.stringify({ assets: records.length, pages: PAGES.length, languages: ['ar', 'en'], target: isRemote ? 'remote' : 'local' }))});`)

  const tempDir = path.join(apiDir, '.tmp')
  await fs.mkdir(tempDir, { recursive: true })
  const sqlPath = path.join(tempDir, 'import-story-act-s1.sql')
  await fs.writeFile(sqlPath, statements.join('\n'), 'utf8')
  try {
    await run(['d1', 'execute', 'majarra-db', targetFlag, ...envFlags, `--file=${sqlPath}`])
  } finally {
    await fs.rm(sqlPath, { force: true })
  }

  console.log(`\nimported ${records.length} assets, ${PAGES.length} pages, 2 languages`)
}

await main()
