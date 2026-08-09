/**
 * يقارن ما يُخدَم فعليًا على النطاق الحي بما في مجلد dist المحلي،
 * ليُعرف هل النشر وصل للزائر أم أن النطاق ما زال يُخدَم من مصدر آخر.
 *
 * التشغيل: node tools/landing-assets/probe-live.mjs https://majarra.app
 */
import { readdirSync } from 'node:fs'
import path from 'node:path'

const TARGET = (process.argv[2] ?? 'https://majarra.app').replace(/\/$/, '')
const DIST = path.join(import.meta.dirname, '..', '..', 'dashboard', 'front', 'dist', 'assets')

const local = readdirSync(DIST).filter((name) => name.endsWith('.js') || name.endsWith('.css'))
console.log('محليًا في dist/assets:')
local.forEach((name) => console.log('   ' + name))

const response = await fetch(`${TARGET}/`, { redirect: 'manual' })
const html = await response.text()
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])

console.log(`\nالمُخدَّم على ${TARGET} (HTTP ${response.status}):`)
refs.forEach((ref) => console.log('   ' + ref))

const liveAssets = refs.filter((ref) => ref.includes('/assets/')).map((ref) => path.basename(ref))
const matched = liveAssets.filter((name) => local.includes(name))

console.log('\nالنتيجة:')
if (liveAssets.length === 0) {
  console.log('  لا أصول /assets/ في الصفحة الحيّة — مصدر مختلف تمامًا')
} else if (matched.length === liveAssets.length) {
  console.log(`  مطابق: النطاق يخدم بناءك الحالي (${matched.join(', ')})`)
} else {
  console.log(`  غير مطابق: الحيّ ${liveAssets.join(', ')} — بناؤك المحلي ${local.filter((n) => n.endsWith('.js')).join(', ')}`)
  console.log('  أي أن النطاق ما زال يُخدَم من نشر أقدم أو من مصدر آخر')
}

// وسم يميّز صفحة الهبوط الجديدة: أصنافها كلها ببادئة mj-
const landing = await fetch(`${TARGET}/`).then((r) => r.text())
console.log(`\nوسم صفحة الهبوط الجديدة (mj-landing) في HTML: ${landing.includes('mj-') ? 'موجود' : 'غير موجود (الصفحة تُركّب بـJS فهذا متوقع)'}`)
