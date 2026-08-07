/**
 * يتحقق من سلوك Worker الأصول محليًا: هل ترجع المسارات العميقة index.html
 * (SPA fallback) وهل تُخدَم الصور والأصول بالنوع الصحيح؟
 *
 * التشغيل بعد `wrangler dev --port 8799`:
 *   node tools/landing-assets/verify-routes.mjs
 */
const BASE = process.argv[2] ?? process.env.MJ_WORKER_URL ?? 'http://127.0.0.1:8799'

let failures = 0

async function check(label, urlPath, expect) {
  let response
  try {
    response = await fetch(`${BASE}${urlPath}`, { redirect: 'manual' })
  } catch (error) {
    console.log(`✗ ${label} — تعذّر الاتصال: ${error.message}`)
    failures += 1
    return
  }

  const type = response.headers.get('content-type') ?? ''
  const problems = []
  if (expect.status && response.status !== expect.status) {
    problems.push(`الحالة ${response.status} بدل ${expect.status}`)
  }
  if (expect.type && !type.includes(expect.type)) {
    problems.push(`النوع ${type || 'بلا'} لا يحتوي ${expect.type}`)
  }
  if (expect.bodyIncludes) {
    const body = await response.text()
    if (!body.includes(expect.bodyIncludes)) problems.push(`المحتوى لا يحتوي ${expect.bodyIncludes}`)
  }

  if (problems.length === 0) {
    console.log(`✓ ${label} — ${response.status} ${type.split(';')[0]}`)
  } else {
    console.log(`✗ ${label} — ${problems.join(' | ')}`)
    failures += 1
  }
}

console.log(`فحص ${BASE}\n`)

// الجذر وصفحة الهبوط
await check('الجذر يعيد HTML', '/', { status: 200, type: 'text/html', bodyIncludes: '<div id="root">' })

// مسارات SPA العميقة يجب أن تعيد index.html لا 404
await check('مسار /admin (SPA fallback)', '/admin', { status: 200, type: 'text/html' })
await check('مسار /admin/series (SPA fallback)', '/admin/series', { status: 200, type: 'text/html' })
await check('مسار تسويقي /plans (SPA fallback)', '/plans', { status: 200, type: 'text/html' })
await check('مسار محتوى عميق (SPA fallback)', '/content/junior-robo-codes', { status: 200, type: 'text/html' })

// الأصول الثابتة
await check('صورة كوكب WebP', '/landing/planets/planet-abjad.webp', { status: 200, type: 'image/webp' })
await check('بوستر مسلسل WebP', '/landing/series/posters/junior-robo-codes-poster.webp', { status: 200, type: 'image/webp' })
await check('لوحة ولي الأمر WebP', '/landing/app/parent/parent-dashboard-hero.webp', { status: 200, type: 'image/webp' })
await check('شعار public', '/majarra-logo.png', { status: 200, type: 'image/png' })
await check('favicon', '/favicon.svg', { status: 200, type: 'image/svg+xml' })

console.log(failures === 0 ? '\nكل الفحوصات ناجحة' : `\n${failures} فحص فاشل`)
if (failures > 0) process.exitCode = 1
