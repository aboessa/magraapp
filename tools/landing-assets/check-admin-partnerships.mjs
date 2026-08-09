/**
 * يتحقق أن صفحة طلبات الشراكة في لوحة الإدارة تعرض البيانات الحقيقية
 * وتفتح نافذة التفاصيل ونافذة إعدادات البريد.
 *
 * التشغيل: node tools/landing-assets/check-admin-partnerships.mjs http://127.0.0.1:5205
 */
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

const SITE = (process.argv[2] ?? 'http://127.0.0.1:5205').replace(/\/$/, '')
const OUT = path.join(import.meta.dirname, '_check')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9419

mkdirSync(OUT, { recursive: true })

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(os.tmpdir(), `mj-admin-${Date.now()}`)}`,
  '--disable-gpu', '--no-first-run', '--no-sandbox', '--hide-scrollbars',
  '--force-prefers-reduced-motion', '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let endpoint
for (let i = 0; i < 60; i += 1) {
  try {
    const info = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
    if (info.webSocketDebuggerUrl) { endpoint = info.webSocketDebuggerUrl; break }
  } catch { /* لم يجهز */ }
  await sleep(250)
}
if (!endpoint) { chrome.kill(); throw new Error('تعذّر الاتصال بكروم') }

const socket = new WebSocket(endpoint)
await new Promise((res, rej) => {
  socket.addEventListener('open', res, { once: true })
  socket.addEventListener('error', rej, { once: true })
})

let nextId = 1
const pending = new Map()
const consoleErrors = []

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(JSON.stringify(message.error)))
    else resolve(message.result)
    return
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleErrors.push(message.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
  }
  if (message.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(message.params.exceptionDetails.exception?.description ?? 'exception')
  }
})

function send(method, params = {}, sessionId, timeoutMs = 30000) {
  const id = (nextId += 1)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`مهلة ${method}`)) }, timeoutMs)
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v) },
      reject: (e) => { clearTimeout(timer); reject(e) },
    })
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
await send('Page.enable', {}, sessionId)
await send('Runtime.enable', {}, sessionId)
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  screenWidth: 1440, screenHeight: 1000,
}, sessionId)

async function evaluate(expression, timeoutMs = 30000) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId, timeoutMs)
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'خطأ تنفيذ')
  return result.result?.value
}

async function shoot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
  writeFileSync(path.join(OUT, `admin-${name}.png`), Buffer.from(result.data, 'base64'))
}

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures.push(name)
}

console.log(`فتح ${SITE}/admin/partnerships`)
await send('Page.navigate', { url: `${SITE}/admin/partnerships` }, sessionId)
await sleep(4000)

console.log('\n--- الصفحة والقائمة ---')
const page = await evaluate(`(() => {
  const rows = [...document.querySelectorAll('.data-table tbody tr')];
  return {
    heading: document.querySelector('.page-intro h2')?.textContent?.trim() ?? null,
    total: document.querySelector('.panel__header h3')?.textContent?.trim() ?? null,
    rows: rows.length,
    firstOrg: rows[0]?.querySelector('.entity-cell strong')?.textContent?.trim() ?? null,
    statusBadges: [...document.querySelectorAll('[class*="partner-status--"]')].length,
    emailBadges: [...document.querySelectorAll('[class*="partner-email--"]')].length,
    notice: document.querySelector('.panel--notice strong')?.textContent?.trim() ?? null,
    sidebarLink: [...document.querySelectorAll('.nav-link')].some((a) => a.getAttribute('href') === '/admin/partnerships'),
    loading: Boolean(document.querySelector('.page-state--loading, .loading-state')),
    emptyState: Boolean(document.querySelector('.empty-state')),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
})()`)

check('العنوان معروض', Boolean(page.heading), page.heading ?? '—')
check('مدخل الشريط الجانبي موجود', page.sidebarLink === true)
check('القائمة حمّلت صفوفًا حقيقية', page.rows > 0, `${page.rows} صف · إجمالي ${page.total}`)
check('اسم أول جهة معروض', Boolean(page.firstOrg), page.firstOrg ?? '—')
check('شارات الحالة تُلوّن', page.statusBadges >= page.rows, `${page.statusBadges} شارة`)
check('شارات حالة البريد معروضة', page.emailBadges >= page.rows, `${page.emailBadges} شارة`)
check('صفر تجاوز أفقي', page.overflow === false)
await shoot('list')

console.log('\n--- نافذة التفاصيل ---')
await evaluate(`document.querySelector('.data-table tbody tr .entity-cell--button')?.click()`)
await sleep(700)
const modal = await evaluate(`(() => {
  const details = [...document.querySelectorAll('.detail-list dt')].map((el) => el.textContent.trim());
  return {
    open: Boolean(document.querySelector('.detail-list')),
    fields: details.length,
    message: document.querySelector('.detail-body')?.textContent?.trim()?.slice(0, 60) ?? null,
    statusSelect: Boolean([...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'in_review'))),
    noteBox: Boolean(document.querySelector('textarea')),
  };
})()`)
check('نافذة التفاصيل تفتح', modal.open)
check('كل حقول الطلب معروضة', modal.fields >= 8, `${modal.fields} حقل`)
check('نص التعاون معروض', Boolean(modal.message), modal.message ?? '—')
check('قائمة الحالة موجودة', modal.statusSelect === true)
check('صندوق الملاحظة الداخلية موجود', modal.noteBox === true)
await shoot('detail')

console.log('\n--- نافذة إعدادات البريد ---')
await evaluate(`(() => {
  const close = document.querySelector('.modal__close, [aria-label*="إغلاق"], [aria-label*="Close"]');
  if (close) close.click();
})()`)
await sleep(500)
await evaluate(`[...document.querySelectorAll('.page-intro button')][0]?.click()`)
await sleep(700)
const settings = await evaluate(`(() => {
  const inputs = [...document.querySelectorAll('.modal input[type=email], .modal input[type=text]')];
  return {
    open: inputs.length > 0,
    count: inputs.length,
    inbox: inputs[0]?.value ?? null,
    provider: [...document.querySelectorAll('.modal .detail-body')].map((el) => el.textContent.trim().slice(0, 90))[0] ?? null,
  };
})()`)
check('نافذة الإعدادات تفتح', settings.open, `${settings.count} حقل`)
check('بريد الاستقبال المحفوظ معروض', settings.inbox === 'partners@majarra.app', String(settings.inbox))
check('المزوّد المستخدم معروض للمسؤول', Boolean(settings.provider), settings.provider ?? '—')
await shoot('settings')

console.log('\n--- أخطاء الكونسول ---')
const relevant = consoleErrors.filter((entry) => !entry.includes('favicon') && !entry.includes('DevTools'))
if (relevant.length === 0) console.log('  لا أخطاء')
else relevant.forEach((entry) => console.log('  !', entry))

console.log('\n=== الخلاصة ===')
if (failures.length === 0 && relevant.length === 0) console.log('كل الفحوص ناجحة')
else {
  console.log(`فحوص فاشلة: ${failures.length} → ${failures.join(' , ')}`)
  console.log(`أخطاء كونسول: ${relevant.length}`)
  process.exitCode = 1
}

await send('Target.closeTarget', { targetId })
socket.close()
chrome.kill()
