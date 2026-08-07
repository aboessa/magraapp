/**
 * يصلح ملفًا تعرّض لترميز مزدوج (UTF-8 قُرئ كـ Latin-1 ثم كُتب UTF-8)،
 * وهو ما يحدث عند تحرير ملف UTF-8 بلا BOM بأدوات PowerShell 5.1.
 * يتحقق أولًا، ولا يكتب إلا إذا كان الإصلاح يزيد عدد الحروف العربية.
 *
 * التشغيل: node tools/landing-assets/repair-encoding.mjs <path> [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const target = process.argv[2]
const checkOnly = process.argv.includes('--check')
if (!target) throw new Error('حدّد مسار الملف')

const ARABIC = /[\u0600-\u06FF]/g

const raw = readFileSync(target)
let text = raw.toString('utf8')
const hadBom = text.charCodeAt(0) === 0xfeff
if (hadBom) text = text.slice(1)

const before = (text.match(ARABIC) ?? []).length
const repaired = Buffer.from(text, 'latin1').toString('utf8')
const after = (repaired.match(ARABIC) ?? []).length

console.log(`${target}`)
console.log(`  BOM: ${hadBom} | عربي قبل: ${before} | عربي بعد الإصلاح: ${after}`)

if (after <= before) {
  console.log('  الملف سليم، لا حاجة للإصلاح')
  process.exit(0)
}

if (checkOnly) {
  console.log('  يحتاج إصلاحًا (وضع التحقق فقط)')
  process.exit(1)
}

// يُكتب UTF-8 بلا BOM كما تتوقعه أدوات البناء
writeFileSync(target, Buffer.from(repaired, 'utf8'))
console.log('  أُصلح وكُتب UTF-8 بلا BOM')
