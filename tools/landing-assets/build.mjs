/**
 * يبني أصول صفحة الهبوط المحسّنة لمشروع الفرونت.
 *
 * يقرأ الصور المرجعية من majarra-landing.v3.html، ثم يحوّلها إلى WebP
 * بمقاسات مناسبة لحجم العرض الفعلي، ويكتبها في dashboard/front/public/landing.
 * يخرج أيضًا manifest.json يربط المسار القديم بالمسار الجديد.
 *
 * التشغيل:  node tools/landing-assets/build.mjs
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SOURCE_HTML = path.join(ROOT, 'majarra-landing.v3.html')
const OUT_DIR = path.join(ROOT, 'dashboard/front/public/landing')
const MANIFEST = path.join(import.meta.dirname, 'manifest.json')

// sharp مثبّت بالفعل داخل dashboard/api، فنعيد استخدامه بدل إضافة اعتمادية جديدة
const requireFromApi = createRequire(pathToFileURL(path.join(ROOT, 'dashboard/api/package.json')))
const sharp = requireFromApi('sharp')

/** أقصى عرض لكل فئة = ضعف مقاس العرض الفعلي في الصفحة (لشاشات 2x) */
const RULES = [
  { test: /images\/landing\//, width: 1600, quality: 76 },
  { test: /images\/series\/banners\//, width: 1200, quality: 78 },
  { test: /parent-dashboard-hero/, width: 1000, quality: 80 },
  { test: /images\/app\/parent\//, width: 560, quality: 80 },
  { test: /images\/app\/avatars\//, width: 128, quality: 82 },
  { test: /planets\//, width: 280, quality: 82 },
  { test: /images\/(series\/posters|books\/covers|games|islamic\/posters|projects\/covers|audio\/covers|activities\/covers)\//, width: 480, quality: 80 },
]

/** المسار الجديد داخل public/landing */
function targetFor(source) {
  let rel
  if (source.includes('majarra_images/assets/images/')) {
    rel = source.split('majarra_images/assets/images/')[1]
  } else if (source.includes('app_main/assets/images/')) {
    rel = source.split('app_main/assets/images/')[1]
  } else {
    rel = path.basename(source)
  }
  // تجنّب /landing/landing/... لصور الهيرو
  rel = rel.replace(/^landing\//, 'hero/')
  return rel.replace(/\.(png|jpe?g|webp)$/i, '.webp')
}

function ruleFor(source) {
  return RULES.find((rule) => rule.test.test(source)) ?? { width: 720, quality: 80 }
}

/** يفضّل أصغر نسخة متاحة من نفس الصورة كمصدر للتحويل */
function bestSource(source) {
  const base = source.replace(/\.(png|jpe?g|webp)$/i, '')
  const candidates = ['.webp', '.jpg', '.jpeg', '.png']
    .map((ext) => path.join(ROOT, base + ext))
    .filter((file) => existsSync(file))
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => statSync(a).size - statSync(b).size)[0]
}

const html = await readFile(SOURCE_HTML, 'utf8')
const referenced = [...new Set(
  [...html.matchAll(/['"]([A-Za-z0-9_\-/.]+\.(?:png|jpe?g|webp))['"]/g)].map((m) => m[1]),
)]
  // الشعار يُستورد من src/assets داخل مشروع الفرونت، فلا يُنسخ هنا
  .filter((p) => p !== 'majarra-logo.png')

const manifest = {}
let sourceBytes = 0
let outBytes = 0
const failures = []

for (const source of referenced) {
  const input = bestSource(source)
  if (!input) {
    failures.push(`${source} → المصدر غير موجود`)
    continue
  }

  const relTarget = targetFor(source)
  const outFile = path.join(OUT_DIR, relTarget)
  const { width, quality } = ruleFor(source)

  await mkdir(path.dirname(outFile), { recursive: true })
  await sharp(input)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toFile(outFile)

  sourceBytes += statSync(input).size
  outBytes += statSync(outFile).size
  manifest[source] = `/landing/${relTarget.replace(/\\/g, '/')}`
}

await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2)
console.log(`ملفات محوّلة: ${Object.keys(manifest).length} / ${referenced.length}`)
console.log(`الحجم قبل: ${mb(sourceBytes)} MB  →  بعد: ${mb(outBytes)} MB`)
if (failures.length) {
  console.log(`\nفشل (${failures.length}):`)
  failures.forEach((f) => console.log(`  - ${f}`))
  process.exitCode = 1
}
