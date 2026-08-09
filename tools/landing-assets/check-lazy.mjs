/**
 * يتأكد أن الصور المؤجلة (loading="lazy") تُحمّل فعلًا عند الوصول إليها،
 * بتمرير بطيء إلى قسم الكواكب ثم قياس naturalWidth لكل صورة كوكب.
 *
 * التشغيل: node tools/landing-assets/check-lazy.mjs [url]
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

const BASE = process.argv[2] ?? process.env.MJ_PREVIEW_URL ?? 'http://127.0.0.1:5199'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9444

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = path.join(os.tmpdir(), `mj-lazy-${Date.now()}`)
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--disable-gpu', '--no-first-run', '--no-sandbox', '--hide-scrollbars', 'about:blank',
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
await send('Emulation.setDeviceMetricsOverride', {
  width: 1360, height: 900, deviceScaleFactor: 1, mobile: false,
  screenWidth: 1360, screenHeight: 900,
}, sessionId)
await send('Page.navigate', { url: BASE }, sessionId)

const evaluate = async (expression, ms = 60000) => (await send('Runtime.evaluate', {
  expression, returnByValue: true, awaitPromise: true,
}, sessionId, ms)).result?.value

for (let i = 0; i < 40; i += 1) {
  await sleep(300)
  if (await evaluate(`Boolean(document.querySelector('.mj-planet img'))`)) break
}

// تمرير بطيء واقعي إلى قسم الكواكب
const report = await evaluate(`(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const target = document.querySelector('[data-section="worlds"]');
  const top = target.getBoundingClientRect().top + window.scrollY;
  const stepPx = 220;
  for (let y = 0; y < top + 400; y += stepPx) {
    window.scrollTo(0, y);
    await wait(140);
  }
  await wait(2500);
  const imgs = [...document.querySelectorAll('.mj-planet img')];
  return {
    total: imgs.length,
    loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
    failed: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')),
    stillPending: imgs.filter(i => !i.complete).map(i => i.getAttribute('src')),
    sizes: imgs.map(i => i.naturalWidth + 'x' + i.naturalHeight),
  };
})()`)

console.log(`صور الكواكب: ${report.total}`)
console.log(`محمّلة فعلًا: ${report.loaded}`)
console.log(`فشلت: ${report.failed.length}`)
report.failed.forEach((s) => console.log(`  ! ${s}`))
console.log(`ما زالت معلّقة: ${report.stillPending.length}`)
report.stillPending.forEach((s) => console.log(`  ~ ${s}`))
console.log(`أبعاد فعلية: ${[...new Set(report.sizes)].join(', ')}`)

const ok = report.loaded === report.total
console.log(ok ? '\nسليم: كل صور الكواكب تُحمّل عند الوصول إليها' : '\nمشكلة: بعض الصور لم تُحمّل')

await send('Target.closeTarget', { targetId })
socket.close()
chrome.kill()
if (!ok) process.exitCode = 1
