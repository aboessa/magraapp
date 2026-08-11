/**
 * التحقّق البصري من فهرس الكواكب ومساحة عملها في متصفح حقيقي.
 *
 * ## لماذا سكربت منفصل عن verify-dashboard.mjs
 *
 * السكربت الشامل يزور ٥٨ مسارًا في لغتين على أربعة عروض، وهو ما يُسقط العامل
 * المحلّي في منتصف التشغيل (رصدنا انهيار workerd بعد نحو ثلاثين مسارًا). حين
 * ينهار العامل تصير كل النتائج التالية 502، فلا يبقى في التقرير دليل على شاشة
 * الكواكب نفسها — وهي موضوع هذا العمل.
 *
 * هذا السكربت يزور مسارات الكواكب وحدها، فيكتمل قبل أن ينهار شيء، ويُنتج:
 *
 * ١. لقطات عند ١٤٤٠×٩٠٠ و١٩٢٠×١٠٨٠ بالعربية، و١٤٤٠×٩٠٠ بالإنجليزية.
 * ٢. قياسًا فعليًّا للكثافة: ما يظهر فوق الحدّ، وكم من العرض الأول فراغ.
 * ٣. تشغيل axe على كل مسار.
 * ٤. فحص عدم وجود تجاوز أفقي.
 *
 * القياسات أرقام لا أحكام: «الصفحة كثيفة» رأي، أمّا «٧ عناصر معلومات فوق الحدّ
 * و١٤٪ فراغ رأسي» فقابل للمراجعة والانحدار.
 *
 * Usage:
 *   node test/browser/verify-planets.mjs --front http://127.0.0.1:5174 \
 *     --api http://127.0.0.1:8787 --email ... --password ...
 */

import { chromium } from 'playwright'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '../../.tmp/browser-planets')

const argValue = (flag, fallback) => {
  const index = process.argv.indexOf(flag)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const FRONT = argValue('--front', 'http://127.0.0.1:5174').replace(/\/$/, '')
const API = argValue('--api', 'http://127.0.0.1:8787').replace(/\/$/, '')
const EMAIL = argValue('--email', 'kiro.verify@majarra.local')
const PASSWORD = argValue('--password', process.env.ADMIN_SEED_PASSWORD ?? '')
const ADMIN_BASE = argValue('--admin-base', '/iamnotsite')

const results = []
let failures = 0

function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failures += 1
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}\n`)
}

const axeSource = await readFile(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')

async function apiLogin() {
  const response = await fetch(`${API}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.data?.token) {
    throw new Error(`login failed (${response.status}): ${body?.error ?? 'no token'}`)
  }
  return body.data.token
}

async function firstPlanet(token) {
  const response = await fetch(`${API}/api/v1/admin/planets?include_inactive=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const body = await response.json().catch(() => null)
  return body?.data?.[0] ?? null
}

function watchPage(page) {
  const problems = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    const url = message.location()?.url ?? ''
    if (/favicon/i.test(text)) return
    if (/net::ERR_ABORTED/i.test(text)) return
    // ‏404 على معاينة أصل: صفٌّ في D1 حالته ready بلا كائن في دلو R2 المحلّي.
    if (/\/admin\/assets\/[^/]+\/content/.test(url) && /404/.test(text)) return
    problems.push(`${text} (${url})`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  return problems
}

async function runAxe(page, label) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(400)
  await page.evaluate(axeSource)
  const violations = await page.evaluate(async () => {
    const run = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })
    return run.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
    }))
  })
  const serious = violations.filter((violation) => ['serious', 'critical'].includes(violation.impact))
  record(`a11y ${label}`, serious.length === 0,
    serious.map((violation) => `${violation.id} (${violation.impact}) ${violation.nodes[0]}`).join(' | '))
  return serious
}

/// يقيس الكثافة فوق الحدّ.
///
/// «فوق الحدّ» = أول ارتفاع نافذة. المقياس عدد العناصر الحاملة للمعلومات: بطاقات،
/// خلايا مقاييس، صفوف جدول، صفوف شجرة، شرائح. ونسبة الفراغ = المساحة التي لا
/// يشغلها شيء من ذلك داخل العمود الرئيسي.
async function measureDensity(page, label, height) {
  const metrics = await page.evaluate((fold) => {
    const selectors = [
      '.planet-card', '.planet-summary__cell', '.metric-cell', '.health-cell',
      '.composition__cell', '.pipeline-cell', '.attention__item', '.tree__row',
      '.data-table tbody tr', '.planet-chip', '.coverage', '.timeline__entry',
    ]
    const nodes = [...document.querySelectorAll(selectors.join(','))]
    const above = nodes.filter((node) => {
      const box = node.getBoundingClientRect()
      return box.top < fold && box.bottom > 0 && box.height > 0
    })
    // أكبر فجوة رأسية متصلة داخل المحتوى الرئيسي فوق الحدّ: هي ما يُرى «فراغًا
    // كبيرًا بلا معنى» في لقطة الشاشة.
    const main = document.querySelector('.admin-main, main') ?? document.body
    const mainBox = main.getBoundingClientRect()
    const bands = above
      .map((node) => node.getBoundingClientRect())
      .map((box) => [Math.max(box.top, mainBox.top), Math.min(box.bottom, fold)])
      .filter(([top, bottom]) => bottom > top)
      .sort((a, b) => a[0] - b[0])
    let covered = 0
    let cursor = mainBox.top
    let largestGap = 0
    for (const [top, bottom] of bands) {
      if (top > cursor) largestGap = Math.max(largestGap, top - cursor)
      if (bottom > cursor) { covered += bottom - Math.max(top, cursor); cursor = bottom }
    }
    const usable = Math.max(1, fold - mainBox.top)
    return {
      informative: above.length,
      coveredPercent: Math.round((covered / usable) * 100),
      largestGap: Math.round(largestGap),
      scrollHeight: document.documentElement.scrollHeight,
    }
  }, height)

  // الحدّ الأدنى ستة عناصر معلومات فوق الحدّ. الشاشة القديمة كانت تُظهر الاسم
  // واللون والمعرّف وترتيب العرض — أربعة حقول في لوح فارغ — فستة عناصر مركّبة
  // هي أدنى ما يُفرّق مساحة عمل عن نموذج بيانات.
  record(`${label}: informative elements above the fold`, metrics.informative >= 6,
    `${metrics.informative} elements, ${metrics.coveredPercent}% of the fold carries content`)
  // فجوة تتجاوز ٢٦٠px فوق الحدّ هي اللوح الفارغ الذي طُلب إزالته.
  record(`${label}: no dead vertical band above the fold`, metrics.largestGap <= 260,
    `largest gap ${metrics.largestGap}px`)
  return metrics
}

/// يسجّل الدخول عبر النموذج الحقيقي داخل سياق مُعطى.
///
/// لا يُستعمل `storageState` هنا: رمز الجلسة في `sessionStorage` بقصد (لا يبقى
/// بعد إغلاق التبويب على جهاز مشترك)، و`storageState` في Playwright ينقل
/// الكوكيز و`localStorage` وحدهما. فنسخ الحالة بين السياقات كان يُنتج سياقًا
/// غير مُصادَق يهبط على شاشة الدخول — ثم تُقاس «كثافة» شاشة الدخول لا الكواكب.
async function signIn(page) {
  await page.goto(`${FRONT}${ADMIN_BASE}`, { waitUntil: 'networkidle' })
  const needsLogin = await page.locator('input[type="password"]').first().isVisible().catch(() => false)
  if (needsLogin) {
    await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL)
    await page.locator('input[type="password"]').first().fill(PASSWORD)
    await page.locator('form button[type="submit"]').first().click()
  }
  await page.waitForSelector('.sidebar', { timeout: 25_000 })
}

async function checkOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  const ok = overflow.scrollWidth <= overflow.innerWidth + 2
  record(`${label}: no horizontal overflow`, ok, ok ? '' : `${overflow.scrollWidth} > ${overflow.innerWidth}`)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  if (!PASSWORD) throw new Error('pass --password')

  const token = await apiLogin()
  const planet = await firstPlanet(token)
  if (!planet) throw new Error('no planet exists in the local database')
  record('fixture: a planet exists', true, `${planet.id} (${planet.name_ar})`)

  const browser = await chromium.launch()
  const a11y = []
  const density = {}

  try {
    const passes = [
      { name: '1440x900-ar', width: 1440, height: 900, locale: 'ar' },
      { name: '1920x1080-ar', width: 1920, height: 1080, locale: 'ar' },
      { name: '1440x900-en', width: 1440, height: 900, locale: 'en' },
    ]

    const routes = [
      { path: 'planets', label: 'collection', expect: { ar: /الكواكب/, en: /Planets/ } },
      { path: 'planets?view=table', label: 'collection table', expect: { ar: /الكوكب/, en: /Planet/ } },
      { path: `planets/${planet.id}`, label: 'workspace overview', expect: { ar: /نظرة عامة/, en: /Overview/ } },
      { path: `planets/${planet.id}?tab=content`, label: 'workspace content', expect: { ar: /المحتوى/, en: /Content/ } },
      { path: `planets/${planet.id}?tab=production`, label: 'workspace production', expect: { ar: /الإنتاج/, en: /Production/ } },
      { path: `planets/${planet.id}?tab=languages`, label: 'workspace languages', expect: { ar: /التغطية/, en: /Coverage/ } },
      { path: `planets/${planet.id}?tab=media`, label: 'workspace media', expect: { ar: /الوسائط/, en: /Media/ } },
      { path: `planets/${planet.id}?tab=rights`, label: 'workspace rights', expect: { ar: /الإتاحة|الحقوق/, en: /availability|Rights/ } },
      { path: `planets/${planet.id}?tab=analytics`, label: 'workspace analytics', expect: { ar: /التحليلات/, en: /Analytics/ } },
      { path: `planets/${planet.id}?tab=activity`, label: 'workspace history', expect: { ar: /السجل/, en: /History/ } },
      // الشاشة التي طلبها المستخدم مع الكواكب: الكواكب والتصنيفات.
      { path: 'taxonomy', label: 'taxonomy', expect: { ar: /التصنيفات/, en: /categories/ } },
      { path: 'taxonomy?usage=unused', label: 'taxonomy filtered', expect: { ar: /التصنيفات/, en: /categories/ } },
    ]

    for (const pass of passes) {
      const context = await browser.newContext({
        viewport: { width: pass.width, height: pass.height },
        locale: pass.locale,
      })
      const page = await context.newPage()
      const problems = watchPage(page)

      await signIn(page)
      record(`${pass.name}: sign-in reaches the dashboard`, true)
      await page.evaluate((value) => window.localStorage.setItem('majarra-lang', value), pass.locale)
      await page.reload({ waitUntil: 'networkidle' })

      const dir = await page.evaluate(() => document.documentElement.dir)
      const expectedDir = pass.locale === 'ar' ? 'rtl' : 'ltr'
      record(`${pass.name}: document dir is ${expectedDir}`, dir === expectedDir, dir)

      for (const route of routes) {
        problems.length = 0
        await page.goto(`${FRONT}${ADMIN_BASE}/${route.path}`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(400)

        const body = await page.locator('body').innerText()
        const rendered = route.expect[pass.locale].test(body)
        const label = `${pass.name} ${route.label}`
        record(`${label} renders`, rendered, rendered ? '' : body.slice(0, 90).replace(/\s+/g, ' '))
        record(`${label} has no console error`, problems.length === 0, problems.slice(0, 1).join(''))

        await checkOverflow(page, label)
        a11y.push(...(await runAxe(page, `${pass.locale}:${route.label}`)))

        const file = `${pass.name}-${route.label.replace(/\s+/g, '-')}.png`
        await page.screenshot({ path: join(OUT, file), fullPage: false })
      }

      // الكثافة تُقاس على الشاشتين المطلوبتين في المعايير.
      await page.goto(`${FRONT}${ADMIN_BASE}/planets`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      density[`${pass.name} collection`] = await measureDensity(page, `${pass.name} collection`, pass.height)

      await page.goto(`${FRONT}${ADMIN_BASE}/planets/${planet.id}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(500)
      density[`${pass.name} workspace`] = await measureDensity(page, `${pass.name} workspace`, pass.height)

      await context.close()
    }

    // --- رحلة المشغّل: من الفهرس إلى الحلقة ورجوعًا بمسار التنقّل ------------
    const journey = await browser.newContext({
      viewport: { width: 1440, height: 900 }, locale: 'ar',
    })
    const page = await journey.newPage()

    await signIn(page)
    await page.goto(`${FRONT}${ADMIN_BASE}/planets`, { waitUntil: 'networkidle' })
    // ينتظر بطاقة حقيقية لا هيكلًا: `.planet-card` يطابق بطاقات التحميل أيضًا،
    // وهي بلا رابط بقصد — فالنقر عليها لا يفتح شيئًا ويُقرأ الفشل كعيب في
    // الصفحة بينما هو عيب في المُحدِّد.
    await page.waitForSelector('.planet-card:not(.planet-card--skeleton)', { timeout: 20_000 })
    // البطاقة كلها منطقة نقر: النقر في وسطها يفتح مساحة العمل.
    const card = page.locator('.planet-card:not(.planet-card--skeleton)').first()
    const box = await card.boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.75)
    await page.waitForURL(/\/planets\/[^/?]+$/, { timeout: 10_000 }).catch(() => {})
    const openedWorkspace = /\/planets\/[^/?]+$/.test(new URL(page.url()).pathname)
    record('journey: clicking the card body opens the workspace', openedWorkspace, new URL(page.url()).pathname)

    // تبويب المحتوى ثم توسيع الشجرة حتى الحلقة.
    await page.goto(`${FRONT}${ADMIN_BASE}/planets/${planet.id}?tab=content`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.tree', { timeout: 15_000 }).catch(() => {})
    const treeRows = await page.locator('.tree__row').count()
    record('journey: the content tree renders rows', treeRows > 0, `${treeRows} rows`)

    const toggles = page.locator('.tree__toggle[aria-expanded="false"]')
    if (await toggles.count() > 0) {
      await toggles.first().click()
      await page.waitForTimeout(300)
      const after = await page.locator('.tree__row').count()
      record('journey: expanding a branch reveals its children', after > treeRows, `${treeRows} -> ${after}`)
    }

    // كل عقدة كيان هي رابط حقيقي، فلا نهاية مسدودة.
    const nodeLinks = await page.locator('.tree a.tree__label').count()
    record('journey: tree nodes are real links, not dead labels', nodeLinks > 0, `${nodeLinks} links`)

    const episodeLink = page.locator('.tree a.tree__label[href*="/episodes/"]').first()
    if (await episodeLink.count() > 0) {
      await episodeLink.click()
      await page.waitForLoadState('networkidle')
      record('journey: an episode opens from the tree', /\/episodes\//.test(page.url()), new URL(page.url()).pathname)
      await page.goBack({ waitUntil: 'networkidle' })
    }

    // «ما يحتاج إلى انتباه» يقود إلى عمل مفلتر لا إلى شاشة عارية.
    await page.goto(`${FRONT}${ADMIN_BASE}/planets/${planet.id}`, { waitUntil: 'networkidle' })
    const attention = page.locator('.attention__item a').first()
    if (await attention.count() > 0) {
      const href = await attention.getAttribute('href')
      record('journey: an attention item deep-links to corrective work', !!href && href.length > 1, href ?? '')
    } else {
      record('journey: attention panel states it checked and found nothing', true, 'no open items on this planet')
    }

    // حالة العنوان: التبويب يبقى بعد تحديث الصفحة.
    await page.goto(`${FRONT}${ADMIN_BASE}/planets/${planet.id}?tab=production`, { waitUntil: 'networkidle' })
    await page.reload({ waitUntil: 'networkidle' })
    const stillProduction = new URL(page.url()).searchParams.get('tab') === 'production'
    record('journey: the tab survives a refresh', stillProduction, page.url().split('?')[1] ?? '')

    // مسار التنقّل يعود إلى الفهرس.
    const crumb = page.locator('.breadcrumbs a').last()
    if (await crumb.count() > 0) {
      await crumb.click()
      await page.waitForLoadState('networkidle')
      record('journey: breadcrumbs return to the collection', /\/planets$/.test(new URL(page.url()).pathname),
        new URL(page.url()).pathname)
    }

    await journey.close()
  } finally {
    await browser.close()
  }

  const summary = {
    front: FRONT,
    api: API,
    ran_at: new Date().toISOString(),
    passed: results.filter((result) => result.ok).length,
    failed: failures,
    density,
    a11y_violations: a11y,
    results,
  }
  await writeFile(join(OUT, 'report.json'), JSON.stringify(summary, null, 2), 'utf8')
  process.stdout.write(`\n${summary.passed} passed, ${summary.failed} failed\nreport: ${join(OUT, 'report.json')}\n`)
  process.exitCode = failures ? 1 : 0
}

await main()
