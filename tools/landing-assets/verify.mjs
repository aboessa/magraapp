/**
 * يتحقق أن كل صورة تشير إليها مكوّنات صفحة الهبوط موجودة فعلًا في مخرجات البناء.
 * التشغيل من مجلد dashboard/front:  node ../../tools/landing-assets/verify.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const FRONT = process.cwd()

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

const distLanding = walk(path.join(FRONT, 'dist/landing'))
const totalMb = distLanding.reduce((sum, file) => sum + statSync(file).size, 0) / 1048576
console.log(`صور الهبوط في dist: ${distLanding.length} ملف / ${totalMb.toFixed(2)} MB`)

const sources = walk(path.join(FRONT, 'src')).filter((file) => /\.(tsx|ts)$/.test(file))
const refs = new Set()
for (const file of sources) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/['"](\/landing\/[A-Za-z0-9_\-/.]+\.webp)['"]/g)) {
    refs.add(match[1])
  }
}

const missing = [...refs].filter((url) => !existsSync(path.join(FRONT, 'dist', url.slice(1))))
console.log(`مسارات مرجعية في السورس: ${refs.size}`)
console.log(`مفقودة في dist: ${missing.length}`)
missing.forEach((url) => console.log(`  ! ${url}`))

const unused = distLanding
  .map((file) => `/${path.relative(path.join(FRONT, 'dist'), file).split(path.sep).join('/')}`)
  .filter((url) => !refs.has(url))
console.log(`موجودة في dist وغير مستخدمة: ${unused.length}`)
unused.forEach((url) => console.log(`  - ${url}`))

if (missing.length) process.exitCode = 1
