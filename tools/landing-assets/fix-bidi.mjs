/**
 * يعزل النطاقات الرقمية داخل النصوص العربية في وحدة بيانات صفحة الهبوط.
 *
 * السبب: في سياق RTL تعكس قواعد الاتجاه الثنائي «9–12» فتظهر «12–9»،
 * وهذا خطأ في المعلومة نفسها لا في الشكل.
 *
 * يلمس فقط النصوص أحادية الاقتباس التي تحتوي نطاقًا رقميًا وحرفًا عربيًا معًا،
 * فتبقى القيم المجردة مثل '6–8' كما هي لأنها تُعزل بـ dir="ltr" عند العرض.
 *
 * التشغيل: node tools/landing-assets/fix-bidi.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const TARGET = path.join(ROOT, 'dashboard/front/src/landing/data.ts')
const CHECK_ONLY = process.argv.includes('--check')

const RANGE = /\d+\s*–\s*\d+/
const ARABIC = /[\u0600-\u06FF]/
// نصوص أحادية الاقتباس بلا هروب، وهي نمط كل بيانات المحتوى هنا
const LITERAL = /'([^'\\\n]*)'/g

const original = readFileSync(TARGET, 'utf8')
const changes = []

const updated = original.replace(LITERAL, (match, body, offset) => {
  if (!RANGE.test(body) || !ARABIC.test(body)) return match
  // تجاهل سطور التعليقات
  const lineStart = original.lastIndexOf('\n', offset) + 1
  const line = original.slice(lineStart, original.indexOf('\n', offset))
  if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return match

  const wrapped = body.replace(new RegExp(RANGE.source, 'g'), (range) => '${ltr(\'' + range + '\')}')
  changes.push({ from: body, to: wrapped })
  return '`' + wrapped + '`'
})

if (changes.length === 0) {
  console.log('لا تغييرات مطلوبة')
} else {
  console.log(`نصوص معزولة: ${changes.length}`)
  changes.forEach((change) => console.log(`  ${change.from}\n  → ${change.to}\n`))
}

if (!CHECK_ONLY && changes.length > 0) {
  writeFileSync(TARGET, updated, 'utf8')
  console.log('كُتب الملف')
}
