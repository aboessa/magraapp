/**
 * تحقق من مخرجات البناء قبل النشر.
 * يُشغّل من dashboard/front: node ../../tools/landing-assets/verify-build.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const DIST = path.join(process.cwd(), 'dist')
let failures = 0

function check(label, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

const files = walk(DIST)
const assetJs = files.filter((f) => f.endsWith('.js'))
const landingEntry = assetJs.find((f) => path.basename(f).startsWith('index-'))
const adminChunk = assetJs.find((f) => path.basename(f).startsWith('AdminRoutes-'))

check('مجلد dist موجود', files.length > 0, `${files.length} ملف`)
check('صفحة index.html موجودة', existsSync(path.join(DIST, 'index.html')))
check('حزمة الهبوط منفصلة', Boolean(landingEntry), landingEntry && path.basename(landingEntry))
check('حزمة اللوحة منفصلة (تُحمّل عند /admin فقط)', Boolean(adminChunk), adminChunk && path.basename(adminChunk))

// قاعدة الـAPI يجب أن تُحقن في حزمة اللوحة، وإلا نادت majarra.app نفسه
if (adminChunk) {
  const adminSource = readFileSync(adminChunk, 'utf8')
  check(
    'قاعدة الـAPI مضمّنة في حزمة اللوحة',
    adminSource.includes('api.majarra.app/api/v1'),
    'من .env.production',
  )
}

// صار للهبوط نداء واحد: نموذج الشراكات. فيحتاج قاعدة الـAPI،
// لكن يجب ألا يسحب عميل اللوحة (lib/api.ts) ومعه ترويسات الإدارة،
// وعلامة ذلك هي مفتاح جلسة المسؤول.
if (landingEntry) {
  const landingSource = readFileSync(landingEntry, 'utf8')
  check(
    'حزمة الهبوط تحمل قاعدة الـAPI لنموذج الشراكات',
    landingSource.includes('api.majarra.app/api/v1'),
    'من .env.production',
  )
  check(
    'حزمة الهبوط لا تسحب عميل اللوحة',
    !landingSource.includes('majarra-admin-token'),
  )
  check('حزمة الهبوط تحمل مسار الشراكات', landingSource.includes('/partnerships'))
}

// كل صورة يشير إليها السورس موجودة في المخرجات
const sources = walk(path.join(process.cwd(), 'src')).filter((f) => /\.(tsx|ts)$/.test(f))
const refs = new Set()
for (const file of sources) {
  for (const match of readFileSync(file, 'utf8').matchAll(/['"](\/landing\/[A-Za-z0-9_\-/.]+\.webp)['"]/g)) {
    refs.add(match[1])
  }
}
const missing = [...refs].filter((url) => !existsSync(path.join(DIST, url.slice(1))))
check('كل صور الهبوط في المخرجات', missing.length === 0, `${refs.size} مرجع، ${missing.length} مفقود`)
missing.forEach((url) => console.log(`    ! ${url}`))

// حجم أكبر أصل، لتفادي رفع ملف ثقيل بالخطأ
const heaviest = files.map((f) => ({ f, size: statSync(f).size })).sort((a, b) => b.size - a.size)[0]
check(
  'أكبر أصل أقل من 500KB',
  heaviest.size < 500 * 1024,
  `${path.basename(heaviest.f)} = ${Math.round(heaviest.size / 1024)}KB`,
)

const total = files.reduce((sum, f) => sum + statSync(f).size, 0)
console.log(`\nإجمالي المخرجات: ${(total / 1024 / 1024).toFixed(2)} MB في ${files.length} ملف`)

if (failures > 0) {
  console.log(`\n${failures} فحص فاشل`)
  process.exitCode = 1
} else {
  console.log('\nكل الفحوصات ناجحة')
}
