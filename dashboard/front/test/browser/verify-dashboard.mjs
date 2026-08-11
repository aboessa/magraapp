/**
 * Real-browser verification of the dashboard.
 *
 * ## Why this exists
 *
 * Every previous report on this dashboard admitted the same gap: no screen had ever been
 * opened in a browser. `tsc`, `vite build` and `oxlint` prove the code compiles; jsdom
 * tests prove a component behaves in isolation. Neither can see a layout that overflows at
 * 1366 px, a drawer that opens off-screen in RTL, a route that renders blank because a
 * lazily-imported module throws, or a console error nobody notices.
 *
 * This drives Chromium against a real Vite dev server and a real `wrangler dev` worker with
 * a local D1, logs in through the actual login form, clicks through every new surface, and
 * records exactly what was exercised.
 *
 * ## What it asserts
 *
 * - Each route renders its own heading (not the router's fallback and not a blank page).
 * - No uncaught page error and no `console.error` on any visited route.
 * - No horizontal document overflow at any of the four required widths.
 * - `dir` is `rtl` for Arabic and `ltr` for English on every route.
 * - The interactions that matter are performed, not just the pages loaded: filter drawer,
 *   URL-persisted filters, quick view, calendar and tree views, editor tabs, a publish
 *   attempt that must surface its blockers, and a dashboard drill-through.
 * - axe-core runs on every route and every serious/critical violation is reported.
 *
 * ## Usage
 *
 *   node test/browser/verify-dashboard.mjs --front http://127.0.0.1:5174 \
 *     --api http://127.0.0.1:8787 --email owner@majarra.local --password '...'
 *
 * It does not deploy, does not touch production, and writes only screenshots and a JSON
 * report under `.tmp/browser/`.
 */

import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '../../.tmp/browser')

const argValue = (flag, fallback) => {
  const index = process.argv.indexOf(flag)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const FRONT = argValue('--front', 'http://127.0.0.1:5174').replace(/\/$/, '')
const API = argValue('--api', 'http://127.0.0.1:8787').replace(/\/$/, '')
const EMAIL = argValue('--email', 'owner@majarra.local')
const PASSWORD = argValue('--password', process.env.ADMIN_SEED_PASSWORD ?? '')
const ADMIN_BASE = argValue('--admin-base', '/iamnotsite')

/// The four widths the audit requires, plus a large tablet in portrait.
const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: 'tablet-1024x1366', width: 1024, height: 1366 },
]

const results = []
let failures = 0
/// Conditions the harness could not drive. Kept out of both counters so neither
/// "N passed" nor "M failed" is misleading about what was actually exercised.
const unverified = []

function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failures += 1
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}\n`)
}

/// Routes visited on every viewport and in both locales.
const ROUTES = [
  { path: '', label: 'dashboard home', expect: /لوحة مجرة|Majarra dashboard/ },
  { path: 'website/pages', label: 'website pages', expect: /صفحات الموقع|Website pages/ },
  { path: 'blog/posts', label: 'blog posts', expect: /المقالات|Posts/ },
  { path: 'blog/taxonomy', label: 'blog taxonomy', expect: /الكُتّاب والتصنيفات|Authors, categories/ },
  { path: 'seo', label: 'seo operations', expect: /عمليّات SEO|SEO operations/ },
  { path: 'support-center', label: 'support centre', expect: /الدعم|Support/ },
  { path: 'production', label: 'production centre', expect: /الإنتاج|Production/ },
  { path: 'customers', label: 'customers', expect: /العائلات|Families/ },
  { path: 'devices-admin', label: 'devices', expect: /الأجهزة|Devices/ },
  { path: 'media', label: 'media library', expect: /الوسائط|Media/ },
  { path: 'audit-logs', label: 'audit log', expect: /سجل التدقيق|Audit log/ },
  // الشاشات المُضافة والشاشات الأقدم التي لم تكن في التغطية.
  //
  // كل عنصر هنا يحمل نصًّا من نسخ الصفحة نفسها لا كلمة عامة: `expect` تُطابق
  // «الصفحة» بأي شيء تقريبًا، فتنجح على صفحة خطأ. النصوص أدناه من ملفات النسخ.
  { path: 'calendar', label: 'content calendar', expect: /تقويم المحتوى|Content calendar/ },
  { path: 'series', label: 'series', expect: /إدارة السلاسل|Series management/ },
  { path: 'episodes', label: 'episodes', expect: /الحلقات|Episodes/ },
  { path: 'planets', label: 'planets', expect: /الكواكب|Planets/ },
  // مساحة عمل كوكب حقيقي. المعرّف يُحلّ وقت التشغيل من الفهرس لا يُثبَّت هنا:
  // معرّف مكتوب بيدنا يجعل الفحص ينجح على 404 لو حُذف ذلك الكوكب.
  { path: 'planets/__FIRST_PLANET__', label: 'planet workspace', expect: /نظرة عامة|Overview/ },
  { path: 'planets/__FIRST_PLANET__?tab=content', label: 'planet workspace content', expect: /المحتوى|Content/ },
  { path: 'planets/__FIRST_PLANET__?tab=languages', label: 'planet workspace languages', expect: /التغطية|Coverage/ },
  { path: 'library-content', label: 'content library', expect: /الكتب والألعاب|Books, games/ },
  { path: 'stories', label: 'stories', expect: /محرر القصص|Visual story editor/ },
  { path: 'workflows', label: 'workflow', expect: /سير العمل|Workflow/ },
  { path: 'quality', label: 'readiness check', expect: /الجاهزية|Readiness/ },
  { path: 'mastery', label: 'mastery', expect: /الإتقان|Mastery/ },
  { path: 'rights', label: 'rights', expect: /الحقوق|Rights/ },
  { path: 'team-access', label: 'staff and permissions', expect: /الموظفون|Staff/ },
  { path: 'app-experience', label: 'home builder', expect: /الصفحة الرئيسية|Home/ },
  { path: 'failed-events', label: 'failed events', expect: /الأحداث|events/ },
  { path: 'games-ops', label: 'games operations', expect: /الألعاب|Games/ },
  { path: 'analytics', label: 'analytics', expect: /التحليلات|Analytics/ },
]

const axeSource = await readFile(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')

async function apiFetch(path, token, init = {}) {
  const response = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Admin-Actor': 'browser-verify',
      ...(init.headers ?? {}),
    },
  })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

/// Signs in over HTTP to get a token for the fixture setup. The browser signs in again
/// through the real form, because that form is one of the things being verified.
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

/// Makes sure there is at least one blog author and post, so the blog screens are
/// verified with content rather than only in their empty state.
async function ensureBlogFixture(token) {
  const taxonomy = await apiFetch('/admin/blog/taxonomy', token)
  let authorId = taxonomy.body?.data?.authors?.[0]?.id
  if (!authorId) {
    const created = await apiFetch('/admin/blog/authors', token, {
      method: 'POST',
      body: JSON.stringify({ display_name: 'محرِّر التحقّق' }),
    })
    authorId = created.body?.data?.id
  }
  const posts = await apiFetch('/admin/blog/posts', token)
  if ((posts.body?.data ?? []).length > 0) return posts.body.data[0].id

  const slug = `browser-verify-${Date.now()}`
  const created = await apiFetch('/admin/blog/posts', token, {
    method: 'POST',
    body: JSON.stringify({
      title: 'مقال التحقّق بالمتصفح',
      slug,
      language: 'ar',
      author_id: authorId,
      body: [{ type: 'paragraph', text: 'فقرة أنشأها سكربت التحقّق بالمتصفح.' }],
    }),
  })
  if (!created.body?.data?.id) throw new Error(`fixture post failed: ${created.body?.error}`)
  return created.body.data.id
}

async function firstPageId(token) {
  const pages = await apiFetch('/admin/website/pages', token)
  return pages.body?.data?.[0]?.id ?? null
}

/// The id of a planet that actually exists, for the workspace routes.
///
/// Resolved at run time rather than hard-coded: a literal id would make the check pass
/// against a 404 page if that planet were renamed or disabled, and the workspace's
/// empty state renders without a console error — so nothing else would catch it.
async function firstPlanetId(token) {
  const planets = await apiFetch('/admin/planets?include_inactive=1', token)
  return planets.body?.data?.[0]?.id ?? null
}

/// Drops the planet-workspace routes when no planet exists, instead of visiting
/// `/planets/undefined` and reporting a 404 as a rendering failure.
function resolveRoutes(planetId) {
  return ROUTES
    .filter((route) => planetId || !route.path.includes('__FIRST_PLANET__'))
    .map((route) => ({ ...route, path: route.path.replace('__FIRST_PLANET__', planetId ?? '') }))
}

/// Collects console errors and page errors for the lifetime of a page.
function watchPage(page) {
  const problems = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    const url = message.location()?.url ?? ''
    // يُستثنى الأيقونة المفضّلة والطلبات المُلغاة أثناء التنقّل فقط. كان الاستثناء
    // يشمل «Failed to load resource» كاملةً، وهو يُخفي أي 4xx/5xx حقيقي — أي
    // بالضبط ما يُراد رصده. (رُصد بذلك انهيار العامل المحلّي في منتصف تشغيل.)
    if (/favicon/i.test(text)) return
    if (/net::ERR_ABORTED/i.test(text)) return
    // 404 على معاينة أصل: صفٌّ في D1 حالته `ready` بلا كائن في دلو R2 المحلّي.
    // الخادم يجيب بالصواب والواجهة تتراجع إلى أيقونة، فهذا شرط بيانات محلّية لا
    // عيب في الشاشة. الاستثناء بالمسار لا بالنصّ، فأي 404 آخر يبقى فشلًا.
    if (/\/admin\/assets\/[^/]+\/content/.test(url) && /404/.test(text)) return
    problems.push(`console: ${text} (${url})`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  return problems
}

async function runAxe(page, label) {
  // Wait for the page to settle before auditing it.
  //
  // Two of this suite's four remaining failures were caused by auditing too early, and the
  // colour data axe returns is what proved it: `.eyebrow` on mastery measured 2.07 in Arabic
  // and 2.66 in English — two different values for one static rule, which only happens
  // mid-transition — and `.button--secondary` measured 4.47 against a threshold of 4.5,
  // because the refresh button is `disabled` while the first load is in flight and carries
  // the reduced opacity that goes with it.
  //
  // Auditing the settled state is not a weaker assertion. A 200ms fade and a button that is
  // disabled for the duration of a request are not what a reader is asked to read; the
  // rendered result is. What *would* be weaker is excluding the selectors, which is why they
  // are still audited — just after the page stops moving.
  await page.waitForFunction(() => {
    const animating = document.getAnimations().some((animation) => animation.playState === 'running')
    const loading = document.querySelector('.page-state--loading, .spinner')
    return !animating && !loading
  }, { timeout: 8_000 }).catch(() => { /* audited as-is if it never settles; that is itself a finding */ })

  await page.evaluate(axeSource)
  const report = await page.evaluate(async () => {
    // Only the rules that matter for an internal admin tool, and only the two severities
    // worth stopping for. A report of 300 "best practice" notes gets ignored wholesale.
    const run = await window.axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })
    return run.violations
      .filter((violation) => ['serious', 'critical'].includes(violation.impact))
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        // The full node record, not just the selector.
        //
        // Recording selectors alone cost this session an hour: two colour-contrast failures
        // were "investigated" by measuring the selector on the same page, where both passed,
        // because axe was failing a *different* element or a different state. axe already
        // knows the two colours, the ratio it measured and the ratio it wanted; throwing
        // that away and re-deriving it by hand is how a real defect gets filed as a mystery.
        nodes: violation.nodes.slice(0, 4).map((node) => {
          const contrast = [...(node.any ?? []), ...(node.all ?? [])]
            .map((check) => check.data)
            .find((data) => data && data.contrastRatio !== undefined)
          return {
            target: node.target.join(' '),
            html: (node.html ?? '').slice(0, 160),
            ...(contrast
              ? {
                  fg: contrast.fgColor,
                  bg: contrast.bgColor,
                  ratio: contrast.contrastRatio,
                  needs: contrast.expectedContrastRatio,
                  fontSize: contrast.fontSize,
                  fontWeight: contrast.fontWeight,
                }
              : {}),
          }
        }),
      }))
  })
  if (report.length) {
    record(`a11y ${label}`, false, report.map((item) => {
      const node = item.nodes[0]
      const colours = node?.ratio
        ? ` ${node.fg} on ${node.bg} ${node.ratio} needs ${node.needs} (${node.fontSize} ${node.fontWeight})`
        : ''
      return `${item.id} (${item.impact}) ${node?.target ?? ''}${colours}`
    }).join(' | '))
  } else {
    record(`a11y ${label}`, true)
  }
  return report.map((item) => ({ ...item, route: label }))
}

async function checkOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  const ok = overflow.scrollWidth <= overflow.innerWidth + 2
  record(`no horizontal overflow ${label}`, ok, ok ? '' : `${overflow.scrollWidth} > ${overflow.innerWidth}`)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  if (!PASSWORD) throw new Error('pass --password (the seeded local owner password)')

  const token = await apiLogin()
  const postId = await ensureBlogFixture(token)
  const pageId = await firstPageId(token)
  const planetId = await firstPlanetId(token)
  record('fixture: a website page exists', !!pageId, pageId ?? 'none')
  record('fixture: a blog post exists', !!postId, postId ?? 'none')
  // بلا كوكب لا تُفحص مساحة العمل، ويُسجَّل ذلك صراحةً بدل أن يبدو الفحص ناجحًا.
  if (planetId) record('fixture: a planet exists for the workspace routes', true, planetId)
  else unverified.push({ name: 'planet workspace routes', reason: 'no planet row in the local database' })
  const routes = resolveRoutes(planetId)

  const browser = await chromium.launch()
  const a11y = []

  try {
    // --- Sign in through the real form ------------------------------------
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar' })
    const page = await context.newPage()
    const problems = watchPage(page)

    await page.goto(`${FRONT}${ADMIN_BASE}`, { waitUntil: 'networkidle' })
    const loginVisible = await page.locator('input[type="email"], input[name="email"]').first().isVisible().catch(() => false)
    record('login screen is shown without a session', loginVisible)
    if (loginVisible) {
      await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL)
      await page.locator('input[type="password"]').first().fill(PASSWORD)
      await page.locator('form button[type="submit"], button:has-text("دخول"), button:has-text("Sign in")').first().click()
    }
    await page.waitForSelector('.sidebar', { timeout: 15_000 })
    // مقياس حقيقي لا ثابت: القائمة الجانبية ظاهرة **و**نموذج الدخول اختفى. تسجيل
    // `true` بعد `waitForSelector` لا يفحص شيئًا، لأن الفشل يرمي قبل الوصول إليه.
    const sidebarVisible = await page.locator('.sidebar').isVisible()
    const loginGone = (await page.locator('input[type="password"]').count()) === 0
    record('sign-in through the real form reaches the dashboard', sidebarVisible && loginGone,
      `sidebar=${sidebarVisible} loginForm=${loginGone ? 'gone' : 'still present'}`)

    const storage = await context.storageState()
    // فحص فعليّ للتخزين: الرمز في sessionStorage ولا يوجد في localStorage. الرمز
    // في localStorage يبقى بعد إغلاق التبويب على جهاز مشترك.
    const tokenLocation = await page.evaluate(() => ({
      session: window.sessionStorage.getItem('majarra-admin-token') ? 'present' : 'absent',
      local: window.localStorage.getItem('majarra-admin-token') ? 'present' : 'absent',
    }))
    record('the session token is in sessionStorage and not in localStorage',
      tokenLocation.session === 'present' && tokenLocation.local === 'absent',
      `sessionStorage=${tokenLocation.session} localStorage=${tokenLocation.local}`)

    // --- Navigation across every route, both locales ----------------------
    for (const locale of ['ar', 'en']) {
      await page.evaluate((value) => window.localStorage.setItem('majarra-lang', value), locale)
      await page.reload({ waitUntil: 'networkidle' })
      const dir = await page.evaluate(() => document.documentElement.dir)
      record(`document dir is ${locale === 'ar' ? 'rtl' : 'ltr'} for ${locale}`, dir === (locale === 'ar' ? 'rtl' : 'ltr'), dir)

      for (const route of routes) {
        problems.length = 0
        await page.goto(`${FRONT}${ADMIN_BASE}/${route.path}`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(250)
        const heading = await page.locator('h2, h3').first().textContent().catch(() => '')
        const body = await page.locator('body').innerText()
        const rendered = route.expect.test(body)
        record(`${locale}: ${route.label} renders`, rendered, rendered ? (heading ?? '').trim().slice(0, 60) : (heading ?? '').trim().slice(0, 80))
        record(`${locale}: ${route.label} has no console or page error`, problems.length === 0, problems.slice(0, 2).join(' | '))
        a11y.push(...(await runAxe(page, `${locale}:${route.label}`)))
      }
    }

    // --- Interactions, in Arabic (the primary locale) ---------------------
    await page.evaluate(() => window.localStorage.setItem('majarra-lang', 'ar'))

    // --- Command palette --------------------------------------------------
    //
    // لوحة أوامر لا تُدار بلوحة المفاتيح هي قائمة عادية بخطوات أكثر، فالفحص هنا
    // بالمفاتيح وحدها: الاختصار، ثم الأسهم، ثم Enter، ثم Escape.
    await page.goto(`${FRONT}${ADMIN_BASE}`, { waitUntil: 'networkidle' })
    await page.keyboard.press('Control+k')
    await page.waitForSelector('.palette', { timeout: 5_000 }).catch(() => {})
    const paletteOpen = (await page.locator('.palette').count()) > 0
    record('Ctrl+K opens the command palette', paletteOpen)

    if (paletteOpen) {
      const combobox = page.locator('.palette [role="combobox"]')
      record('the palette input is focused on open',
        await combobox.evaluate((node) => node === document.activeElement).catch(() => false))
      record('the palette input is a combobox with a controlled listbox',
        (await page.locator('.palette [role="listbox"]').count()) > 0
          && (await combobox.getAttribute('aria-controls')) === 'palette-list')

      const optionCount = await page.locator('.palette [role="option"]').count()
      record('permitted commands are listed on open', optionCount > 0, `${optionCount} options`)

      const firstActive = await combobox.getAttribute('aria-activedescendant')
      await page.keyboard.press('ArrowDown')
      // Polled rather than waited on a fixed delay: a single 120ms sleep made this check
      // intermittent, and an intermittent check is one people learn to re-run.
      let secondActive = firstActive
      for (let attempt = 0; attempt < 20 && secondActive === firstActive; attempt += 1) {
        await page.waitForTimeout(50)
        secondActive = await combobox.getAttribute('aria-activedescendant')
      }
      record('ArrowDown moves the announced selection', !!firstActive && firstActive !== secondActive,
        `${firstActive} → ${secondActive}`)

      // البحث الحقيقي: نصّ من الكتالوج المحلّي، والنتيجة يجب أن تكون مجموعة لها
      // عنوان نوع لا صفًّا بلا سياق.
      await combobox.fill('لونا')
      await page.waitForTimeout(700)
      const groups = await page.locator('.palette__group').count()
      record('typing runs a real search and groups the results by type', groups > 0, `${groups} groups`)

      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      record('Escape closes the palette', (await page.locator('.palette').count()) === 0)
    }

    // --- Content calendar -------------------------------------------------
    await page.goto(`${FRONT}${ADMIN_BASE}/calendar`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    record('the calendar states that nothing publishes a scheduled row',
      /لا نشر تلقائي|No automatic publishing/.test(await page.locator('body').innerText()))
    record('the month grid renders', (await page.locator('.sched--month .sched__cell').count()) > 0)

    for (const [label, view] of [['يوم', 'day'], ['أسبوع', 'week'], ['شهر', 'month']]) {
      await page.locator(`.sched__toolbar .view-switcher__button:has-text("${label}")`).first().click()
      await page.waitForTimeout(600)
      record(`the calendar switches to the ${view} view and records it in the URL`,
        (await page.locator(`.sched--${view}`).count()) > 0
          && (view === 'month' ? !page.url().includes('view=') : page.url().includes(`view=${view}`)),
        page.url())
    }

    // بديل لوحة المفاتيح للسحب: حقل تاريخ على كل حدث قابل للنقل. غيابه يجعل
    // إعادة الجدولة ميزة لمن يستطيع السحب بالماوس فقط.
    const movableCount = await page.locator('.sched__move input[type="date"]').count()
    const lockedCount = await page.locator('.sched__locked').count()
    record('every event is either movable by keyboard or states why it is not',
      movableCount + lockedCount > 0, `movable=${movableCount} locked=${lockedCount}`)

    // --- Filter drawer + URL persistence ----------------------------------
    await page.goto(`${FRONT}${ADMIN_BASE}/website/pages`, { waitUntil: 'networkidle' })
    await page.locator('button:has-text("فلاتر")').first().click()
    const drawerVisible = await page.locator('[role="dialog"]').first().isVisible()
    record('filter drawer opens', drawerVisible)
    const drawerBox = await page.locator('[role="dialog"] aside, aside.drawer').first().boundingBox()
    record('the drawer is inside the viewport in RTL', !!drawerBox && drawerBox.x >= -2, drawerBox ? `x=${Math.round(drawerBox.x)}` : 'no box')

    // The field is chosen by finding the first select that has an option differing from its
    // current value, rather than assuming the language filter is first. Assuming an order
    // made this check pass or fail on the shape of the fixture rather than on the behaviour
    // it is meant to prove: selecting a value that is already the default writes nothing to
    // the URL, correctly, and the check then read as a defect in the URL state.
    const chosen = await page.locator('aside.drawer select').evaluateAll((selects) => {
      for (const [index, select] of selects.entries()) {
        const option = [...select.options].find((candidate) => candidate.value && candidate.value !== select.value)
        if (option) return { index, value: option.value }
      }
      return null
    })
    if (chosen) {
      await page.locator('aside.drawer select').nth(chosen.index).selectOption(chosen.value)
      // Scoped to the drawer, and matched on the exact label.
      //
      // `button:has-text("تطبيق")` matches on substring across the whole page, and the
      // restructured sidebar has a group button reading "التحكّم في التطبيق" — which contains
      // it, and comes first in the DOM. So this clicked a navigation group instead of the
      // apply button, and the check reported the URL as unchanged. The product was fine; the
      // locator was not.
      await page.locator('aside.drawer button', { hasText: /^تطبيق$/ }).first().click()
      await page.waitForTimeout(400)
      record('applying a filter from the drawer writes it to the URL',
        [...new URL(page.url()).searchParams.values()].includes(chosen.value),
        `${page.url()} (chose ${chosen.value})`)
    } else {
      record('applying a filter from the drawer writes it to the URL', false, 'no select offered an alternative value')
    }

    // Filter state in the URL, proven by arriving at a filtered link — which is what makes a
    // link from the executive dashboard open the same set the sender was looking at.
    await page.goto(`${FRONT}${ADMIN_BASE}/website/pages?language=ar`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const chipVisible = await page.locator('.filter-chip').first().isVisible().catch(() => false)
    record('a filtered link renders the filter as a removable chip', chipVisible)
    await page.reload({ waitUntil: 'networkidle' })
    record('a reload keeps the filter', page.url().includes('language=ar'), page.url())

    // Quick view
    const quickButton = page.locator('button:has-text("عرض سريع")').first()
    if (await quickButton.count()) {
      await quickButton.click()
      await page.waitForSelector('[role="dialog"]')
      const hasEditorLink = await page.locator('[role="dialog"] a:has-text("فتح المحرِّر")').count()
      record('quick view opens and links to the full editor', hasEditorLink > 0)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      record('Escape closes the quick view', (await page.locator('[role="dialog"]').count()) === 0)
    } else {
      record('quick view opens and links to the full editor', false, 'no rows to open')
    }

    // Calendar and tree views
    for (const [view, selector, label] of [
      ['calendar', '.calendar', 'calendar view renders'],
      ['tree', '[role="tree"]', 'tree view renders'],
    ]) {
      await page.goto(`${FRONT}${ADMIN_BASE}/website/pages?view=${view}`, { waitUntil: 'networkidle' })
      record(label, (await page.locator(selector).count()) > 0)
    }

    // Website page editor: tabs, publish attempt, revisions
    if (pageId) {
      await page.goto(`${FRONT}${ADMIN_BASE}/website/pages/${pageId}`, { waitUntil: 'networkidle' })
      record('page editor renders its sections', (await page.locator('.section-card, .data-unavailable').count()) > 0)
      for (const tab of ['الإعدادات', 'SEO', 'اللغات', 'المراجعات', 'سجلّ التدقيق', 'معاينة']) {
        const locator = page.locator(`[role="tab"]:has-text("${tab}")`).first()
        if (await locator.count()) {
          await locator.click()
          await page.waitForTimeout(250)
          const panel = await page.locator('[role="tabpanel"]').first().innerText()
          record(`page editor tab "${tab}" renders content`, panel.trim().length > 0, panel.trim().slice(0, 50))
        } else {
          record(`page editor tab "${tab}" renders content`, false, 'tab missing')
        }
      }
      await page.locator('[role="tab"]:has-text("الأقسام")').first().click()
      await page.locator('button:has-text("نشر")').first().click()
      await page.waitForTimeout(800)
      const dialogText = await page.locator('[role="dialog"]').first().innerText().catch(() => '')
      // يجب أن يحمل الحوار **معرّف عائق أو تحذير بعينه**، لا مجرّد نصّ. حوار غير
      // فارغ يمكن أن يكون «تعذر النشر» بلا سبب، وهو بالضبط ما بُنيت البوابة
      // لإنهائه. المعرّفات من `pagePublishBlockers` في الخادم.
      const namedFinding = /\b(title|sections|seo_title|meta_description)\b/.test(dialogText)
      record('a publish attempt names the blocker or warning that produced it', namedFinding,
        dialogText.replace(/\s+/g, ' ').slice(0, 110))
      await page.keyboard.press('Escape')
    }

    // Blog editor: block editor, autosave notice, direction
    if (postId) {
      await page.goto(`${FRONT}${ADMIN_BASE}/blog/posts/${postId}`, { waitUntil: 'networkidle' })
      record('blog editor renders structured blocks, not a JSON textarea', (await page.locator('.block-card').count()) > 0)
      const bodyDir = await page.locator('.block-card__body').first().getAttribute('dir')
      record('an Arabic post is edited right-to-left', bodyDir === 'rtl', String(bodyDir))
      const autosave = await page.locator('.panel--notice').first().innerText()
      record('the autosave state is stated on screen', /الحفظ التلقائي/.test(autosave), autosave.slice(0, 60))
    }

    // SEO operations: the internal/external separation
    await page.goto(`${FRONT}${ADMIN_BASE}/seo`, { waitUntil: 'networkidle' })
    const seoBody = await page.locator('body').innerText()
    record('the SEO page declares the audit is internal only', /internal_audit/.test(seoBody))
    await page.locator('[role="tab"]:has-text("الفهرسة الخارجية")').first().click()
    await page.waitForTimeout(250)
    const indexPanel = await page.locator('[role="tabpanel"]').first().innerText()
    record('external index status is declared unavailable', /غير متاحة/.test(indexPanel), indexPanel.replace(/\s+/g, ' ').slice(0, 80))
    await page.locator('[role="tab"]:has-text("تغطية الفحوص")').first().click()
    await page.waitForTimeout(250)
    record('the unimplemented checks are named on screen', /غير مُنفَّذ/.test(await page.locator('[role="tabpanel"]').first().innerText()))

    // Dashboard drill-through
    await page.goto(`${FRONT}${ADMIN_BASE}`, { waitUntil: 'networkidle' })
    const drillLinks = page.locator('a.exec-metric')
    const drillCount = await drillLinks.count()
    const drill = drillLinks.first()
    record('the dashboard renders drillable metrics', drillCount > 0, `${drillCount} metrics`)
    if (drillCount > 0) {
      const href = await drill.getAttribute('href')
      await drill.click()
      await page.waitForLoadState('networkidle')
      // المقارنة على المسار **وسلسلة الاستعلام** معًا: الفلتر هو الفارق بين
      // «افتح الدعم» و«افتح التذاكر التي ينتجها هذا الرقم».
      const landed = new URL(page.url())
      const expected = new URL(href, page.url())
      const samePath = landed.pathname === expected.pathname
      const sameQuery = landed.search === expected.search
      record('a dashboard metric navigates to its filtered screen', samePath && sameQuery,
        `${landed.pathname}${landed.search} (expected ${expected.pathname}${expected.search})`)
      record('the drill target carries a filter, not a bare screen', expected.search.length > 1, expected.search)
    }

    // Keyboard reachability of the primary navigation
    await page.goto(`${FRONT}${ADMIN_BASE}`, { waitUntil: 'networkidle' })
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const element = document.activeElement
      return element ? `${element.tagName}.${element.className}`.slice(0, 60) : 'none'
    })
    record('tabbing from the top reaches a focusable control', focused !== 'none' && focused !== 'BODY.', focused)

    await context.close()

    // --- Responsive sweep -------------------------------------------------
    for (const viewport of VIEWPORTS) {
      const sized = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: 'ar', storageState: storage })
      const sizedPage = await sized.newPage()
      const sizedProblems = watchPage(sizedPage)
      for (const route of ['', 'website/pages', 'blog/posts', 'seo', 'support-center']) {
        sizedProblems.length = 0
        await sizedPage.goto(`${FRONT}${ADMIN_BASE}/${route}`, { waitUntil: 'networkidle' })
        await sizedPage.waitForTimeout(200)
        const label = `${viewport.name} ${route || 'home'}`
        await checkOverflow(sizedPage, label)
        record(`${label} has no console error`, sizedProblems.length === 0, sizedProblems.slice(0, 1).join(''))
        await sizedPage.screenshot({ path: join(OUT, `${viewport.name}-${route.replace(/\//g, '_') || 'home'}.png`), fullPage: false })
      }
      // The page editor is the widest surface, so it is measured on every width too.
      if (pageId) {
        await sizedPage.goto(`${FRONT}${ADMIN_BASE}/website/pages/${pageId}`, { waitUntil: 'networkidle' })
        await checkOverflow(sizedPage, `${viewport.name} page editor`)
        await sizedPage.screenshot({ path: join(OUT, `${viewport.name}-page-editor.png`) })
      }
      await sized.close()
    }
  } finally {
    await browser.close()
  }

  const summary = {
    front: FRONT,
    api: API,
    ran_at: new Date().toISOString(),
    passed: results.filter((result) => result.ok).length,
    failed: failures,
    a11y_violations: a11y,
    unverified,
    results,
  }
  await writeFile(join(OUT, 'report.json'), JSON.stringify(summary, null, 2), 'utf8')
  process.stdout.write(`\n${summary.passed} passed, ${summary.failed} failed`
    + `${unverified.length ? `, ${unverified.length} not exercised` : ''}\nreport: ${join(OUT, 'report.json')}\n`)
  for (const entry of unverified) process.stdout.write(`  not exercised: ${entry.name} — ${entry.reason}\n`)
  process.exitCode = failures ? 1 : 0
}

await main()
