/**
 * يفتح كل عناصر <details> (الأسئلة الشائعة وجدول المقارنة) ويقيس
 * التجاوز الأفقي، لأن الجدول عرضه الأدنى 620px وقد يكسر الشاشات الضيقة.
 *
 * التشغيل: node tools/landing-assets/check-expanded.mjs [url]
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

const BASE = process.argv[2] ?? process.env.MJ_PREVIEW_URL ?? 'http://127.0.0.1:5199'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9455
const WIDTHS = [320, 375, 768, 1280]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = path.join(os.tmpdir(), `mj-exp-${Date.now()}`)
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--disable-gpu', '--no-first-run', '--no-sandbox', '--hide-scrollbars',
  '--force-prefers-reduced-motion', 'about:blank',
], { stdio: 'ignore' })

let endpoint
for (let i = 0; i < 80; i += 1) {
  try {
    const info = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
    if (info.webSocketDebuggerUrl) { endpoint = info.webSocketDebuggerUrl; break }
  } catch { /* ignore */ }
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
socket.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (!m.id || !pending.has(m.id)) return
  const { resolve, reject } = pending.get(m.id)
  pending.delete(m.id)
  if (m.error) reject(new Error(JSON.stringify(m.error)))
  else resolve(m.result)
})
function send(method, params = {}, sessionId, ms = 40000) {
  const id = nextId += 1
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`مهلة ${method}`)) }, ms)
    pending.set(id, {
      resolve: (v) => { clearTimeout(t); resolve(v) },
      reject: (err) => { clearTimeout(t); reject(err) },
    })
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
}
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
await send('Page.enable', {}, sessionId)
await send('Runtime.enable', {}, sessionId)

const evaluate = async (expression, ms = 60000) => (await send('Runtime.evaluate', {
  expression, returnByValue: true, awaitPromise: true,
}, sessionId, ms)).result?.value

let failures = 0
for (const width of WIDTHS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height: 900, deviceScaleFactor: 1, mobile: width <= 860,
    screenWidth: width, screenHeight: 900,
  }, sessionId)
  await send('Page.navigate', { url: BASE }, sessionId)

  let ready = false
  for (let i = 0; i < 40; i += 1) {
    await sleep(300)
    ready = await evaluate(`Boolean(document.querySelector('.mj-compare'))`)
    if (ready) break
  }
  if (!ready) { console.log(`✗ ${width}px — الصفحة لم تُركّب`); failures += 1; continue }

  const report = await evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const all = [...document.querySelectorAll('.mj-landing details')];
    all.forEach(d => { d.open = true; });
    await wait(600);
    const vw = window.innerWidth;
    const wrap = document.querySelector('.mj-table-wrap');
    const table = document.querySelector('.mj-cmp');
    return {
      vw,
      openedCount: all.length,
      docOverflow: document.documentElement.scrollWidth - vw,
      wrapWidth: wrap ? Math.round(wrap.getBoundingClientRect().width) : null,
      wrapScrollable: wrap ? wrap.scrollWidth > wrap.clientWidth + 1 : null,
      wrapOverflowX: wrap ? getComputedStyle(wrap).overflowX : null,
      tableWidth: table ? Math.round(table.getBoundingClientRect().width) : null,
    };
  })()`)

  const problems = []
  if (report.docOverflow > 2) problems.push(`تجاوز أفقي ${report.docOverflow}px`)
  if (report.vw !== width) problems.push(`منفذ العرض ${report.vw} ≠ ${width}`)
  // على الشاشات الضيقة يجب أن يكون الجدول قابلًا للتمرير داخل حاويته لا أن يمدّ الصفحة
  if (report.tableWidth > report.wrapWidth + 1 && !report.wrapScrollable) {
    problems.push('الجدول أوسع من حاويته وغير قابل للتمرير')
  }

  const mark = problems.length === 0 ? '✓' : '✗'
  console.log(`${mark} ${String(width).padStart(4)}px  فتح ${report.openedCount} عنصر | حاوية الجدول ${report.wrapWidth}px (${report.wrapOverflowX}${report.wrapScrollable ? '، قابلة للتمرير' : ''}) | الجدول ${report.tableWidth}px${problems.length ? ' — ' + problems.join(' | ') : ''}`)
  if (problems.length) failures += 1
}

console.log(failures === 0 ? '\nسليم: فتح كل الأقسام القابلة للطي لا يكسر أي مقاس' : `\n${failures} مقاس به مشاكل`)

await send('Target.closeTarget', { targetId })
socket.close()
chrome.kill()
if (failures > 0) process.exitCode = 1
