/** فحص سريع لسلامة بيانات الهبوط بعد إصلاح الترميز */
import { readFileSync } from 'node:fs'

const source = readFileSync('src/landing/data.ts', 'utf8')

console.log('--- مدارات الكواكب ---')
for (const match of source.matchAll(/orbit: \{ radius: (\d+), angle: (-?\d+) \}/g)) {
  console.log(`  r=${match[1]} a=${match[2]}`)
}

console.log(`--- عزل الاتجاه: ${(source.match(/\$\{ltr\(/g) ?? []).length} استخدام ---`)

console.log('--- عيّنات نصية ---')
console.log(' أسماء كواكب:', (source.match(/name: 'كوكب [^']+'/g) ?? []).slice(0, 3).join(' | '))
console.log(' شرائح عمرية:', (source.match(/pill: `[^`]+`/g) ?? []).join(' | '))
console.log(' شريط الثقة :', (source.match(/label: `مناسب[^`]+`/g) ?? []).join(' | '))
console.log(' أعمار عوالم:', (source.match(/age: `[^`]+`/g) ?? []).slice(0, 3).join(' | '))
