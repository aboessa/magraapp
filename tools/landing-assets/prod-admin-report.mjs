/**
 * يتأكد أن مسار /admin/partnerships يعمل على الإنتاج: الحزمة تُحمّل،
 * الصفحة تُركّب، والمصادقة الناقصة تُعرض كخطأ مفهوم لا كشاشة بيضاء.
 * لا يحمل مفتاح الإدارة، فالمتوقع رسالة عدم تصريح.
 *
 * التشغيل: node tools/landing-assets/prod-admin-report.mjs https://majarra.app
 */
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { writeFileSync } from 'node:fs'

const SITE = (process.argv[2] ?? 'https://majarra.app').replace(/\/$/, '')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9423

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(os.tmpdir(), `mj-padmin-${Date.now()}`)}`,
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
if (!endpoint) { chrome.kill(); throw new Error('no chrome') }

const socket = new WebSocket(endpoint)
await new Promise((res, rej) => {
  socket.addEventListener('open', res, { once: true })
  socket.addEventListener('error', rej, { once: true })
})

let nextId = 1
const pending = new Map()
const consoleErrors = []
const failedRequests = []
socket.addEventListener('message', (event) => {
  const m = JSON.parse(event.data)
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id)
    pending.delete(m.id)
    if (m.error) reject(new Error(JSON.stringify(m.error)))
    else resolve(m.result)
    return
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(m.params.exceptionDetails.exception?.description ?? 'exception')
  }
  if (m.method === 'Network.responseReceived') {
    const { url, status } = m.params.response
    if (status >= 400) failedRequests.push(`${status} ${url}`)
  }
})
function send(method, params = {}, sessionId, timeoutMs = 60000) {
  const id = (nextId += 1)
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error('timeout ' + method)) }, timeoutMs)
    pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v) }, reject: (e) => { clearTimeout(t); reject(e) } })
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
await send('Page.enable', {}, sessionId)
await send('Runtime.enable', {}, sessionId)
await send('Network.enable', {}, sessionId)
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 1000,
}, sessionId)

await send('Page.navigate', { url: `${SITE}/admin/partnerships` }, sessionId)
await sleep(6000)

const report = await evaluateAll()
async function evaluateAll() {
  const r = await send('Runtime.evaluate', {
    expression: `(() => ({
      url: location.pathname,
      heading: document.querySelector('.page-intro h2')?.textContent?.trim() ?? null,
      sidebarPartnerships: [...document.querySelectorAll('.nav-link')].some(a => a.getAttribute('href') === '/admin/partnerships'),
      sidebarLinks: document.querySelectorAll('.nav-link').length,
      errorState: document.querySelector('.page-state, .error-state, .form-error')?.textContent?.trim()?.slice(0, 120) ?? null,
      noticePanels: [...document.querySelectorAll('.panel--notice strong')].map(e => e.textContent.trim()),
      settingsButton: Boolean([...document.querySelectorAll('.page-intro button')].length),
      blankScreen: document.body.innerText.trim().length < 40,
      bodyTextLength: document.body.innerText.trim().length,
    }))()`,
    returnByValue: true,
  }, sessionId)
  return r.result?.value
}

report.consoleErrors = consoleErrors
report.failedRequests = failedRequests
writeFileSync(path.join(import.meta.dirname, 'prod-admin-report.json'), JSON.stringify(report, null, 2), 'utf8')
console.log('WROTE tools/landing-assets/prod-admin-report.json')

const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
writeFileSync(path.join(import.meta.dirname, '_check', 'prod-admin.png'), Buffer.from(shot.data, 'base64'))

await send('Target.closeTarget', { targetId })
socket.close()
chrome.kill()
