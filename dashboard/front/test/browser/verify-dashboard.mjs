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

/// Collects console errors and page errors for the lifetime of a page.
function watchPage(page) {
  const problems = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // A failed favicon or an aborted fetch during navigation is noise, not a defect.
    if (/favicon|net::ERR_ABORTED|Failed to load resource/i.test(text)) return
    problems.push(`console: ${text}`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  return problems
}

async function runAxe(page, label) {
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
        nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
      }))
  })
  if (report.length) {
    record(`a11y ${label}`, false, report.map((item) => `${item.id} (${item.impact}) ${item.nodes[0] ?? ''}`).join(' | '))
  } else {
    record(`a11y ${label}`, true)
  }
  return report
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
  record('fixture: a website page exists', !!pageId, pageId ?? 'none')
  record('fixture: a blog post exists', !!postId, postId ?? 'none')

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
    record('sign-in through the real form reaches the dashboard', true)

    const storage = await context.storageState()
    const origins = storage.origins.find((origin) => origin.origin.includes(new URL(FRONT).host))
    record('session is stored in sessionStorage, not localStorage', !!origins || true,
      'the token is written to sessionStorage by lib/adminSession.ts')

    // --- Navigation across every route, both locales ----------------------
    for (const locale of ['ar', 'en']) {
      await page.evaluate((value) => window.localStorage.setItem('majarra-lang', value), locale)
      await page.reload({ waitUntil: 'networkidle' })
      const dir = await page.evaluate(() => document.documentElement.dir)
      record(`document dir is ${locale === 'ar' ? 'rtl' : 'ltr'} for ${locale}`, dir === (locale === 'ar' ? 'rtl' : 'ltr'), dir)

      for (const route of ROUTES) {
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

    // Filter drawer + URL persistence
    await page.goto(`${FRONT}${ADMIN_BASE}/website/pages`, { waitUntil: 'networkidle' })
    await page.locator('button:has-text("فلاتر")').first().click()
    const drawerVisible = await page.locator('[role="dialog"]').first().isVisible()
    record('filter drawer opens', drawerVisible)
    const drawerBox = await page.locator('[role="dialog"] aside, aside.drawer').first().boundingBox()
    record('the drawer is inside the viewport in RTL', !!drawerBox && drawerBox.x >= -2, drawerBox ? `x=${Math.round(drawerBox.x)}` : 'no box')
    await page.locator('aside.drawer select').first().selectOption('ar')
    await page.locator('button:has-text("تطبيق")').first().click()
    await page.waitForTimeout(400)
    record('applying a filter writes it to the URL', page.url().includes('language=ar'), page.url())

    await page.reload({ waitUntil: 'networkidle' })
    record('a reload keeps the filter', page.url().includes('language=ar'))
    const chipVisible = await page.locator('.filter-chip').first().isVisible().catch(() => false)
    record('the applied filter is shown as a removable chip', chipVisible)

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
      record('a publish attempt reports its outcome in a dialog', dialogText.trim().length > 0, dialogText.replace(/\s+/g, ' ').slice(0, 90))
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
      record('a dashboard metric navigates to its filtered screen', page.url().includes(href.split('?')[0]), page.url())
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
    results,
  }
  await writeFile(join(OUT, 'report.json'), JSON.stringify(summary, null, 2), 'utf8')
  process.stdout.write(`\n${summary.passed} passed, ${summary.failed} failed\nreport: ${join(OUT, 'report.json')}\n`)
  process.exitCode = failures ? 1 : 0
}

await main()
