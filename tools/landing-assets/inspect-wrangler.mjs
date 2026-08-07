/**
 * يقرأ مخطط إعداد wrangler المثبّت فعلًا للتأكد من أسماء الحقول
 * قبل كتابة إعداد نشر الأصول الثابتة، بدل الاعتماد على الذاكرة.
 *
 * التشغيل من dashboard/api:  node ../../tools/landing-assets/inspect-wrangler.mjs
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const API_DIR = process.cwd()
const requireFromApi = createRequire(pathToFileURL(path.join(API_DIR, 'package.json')))

const pkg = requireFromApi('wrangler/package.json')
console.log(`wrangler: ${pkg.version}`)

// الحزمة لا تصدّر المخطط عبر exports، فنقرؤه من القرص مباشرة
const { readFileSync } = await import('node:fs')
const schemaPath = path.join(API_DIR, 'node_modules/wrangler/config-schema.json')
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const defs = schema.definitions ?? {}
const rootProps = defs.RawConfig?.properties ?? schema.properties ?? {}

function resolve(node) {
  if (!node) return null
  const ref = node.$ref ?? node.anyOf?.find((entry) => entry.$ref)?.$ref
  if (!ref) return node
  return defs[ref.split('/').pop()] ?? null
}

console.log(`\nحقول الجذر ذات الصلة: ${['assets', 'routes', 'route', 'name', 'main', 'compatibility_date', 'observability']
  .filter((key) => key in rootProps).join(', ')}`)

const assets = resolve(rootProps.assets)
if (!assets) {
  console.log('\n! لا يوجد حقل assets في هذا الإصدار')
} else {
  console.log('\nحقول assets:')
  for (const [key, value] of Object.entries(assets.properties ?? {})) {
    const inner = resolve(value)
    const allowed = inner?.enum ?? value.enum
    console.log(`  ${key}${allowed ? ` = ${allowed.join(' | ')}` : ''}`)
  }
}

const routes = resolve(rootProps.routes)
if (routes) {
  const item = resolve(routes.items) ?? routes.items
  const variants = item?.anyOf ?? [item]
  console.log('\nشكل routes:')
  variants.forEach((variant) => {
    const resolved = resolve(variant)
    if (resolved?.properties) console.log(`  كائن: ${Object.keys(resolved.properties).join(', ')}`)
    else if (resolved?.type) console.log(`  ${resolved.type}`)
  })
}
