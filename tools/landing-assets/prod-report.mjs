/**
 * تقرير موجز عن الصفحة الحيّة يُكتب JSON، فلا يتلف الترميز في الطرفية.
 * التشغيل: node tools/landing-assets/prod-report.mjs https://majarra.app
 */
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { writeFileSync } from 'node:fs'

const SITE = (process.argv[2] ?? 'https://majarra.app').replace(/\/$/, '')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9421

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(os.tmpdir(), `mj-prod-${Date.now()}`)}`,
  '--disable-gpu', '--no-first-run', '--no-sandbox', '--hide-scrollbars',
  '--force-prefers-reduced-motion', '--window-size=1360,1000', 'about:blank',
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
await send('Emulation.setDeviceMetricsOverride', {
  width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false, screenWidth: 1360, screenHeight: 1000,
}, sessionId)

async function evaluate(expression, timeoutMs = 60000) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId, timeoutMs)
  return r.result?.value
}

await send('Page.navigate', { url: SITE }, sessionId)
await sleep(3000)

// تمرير كامل لتحميل الصور المؤجلة قبل عدّ المكسور منها
await evaluate(`(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const step = window.innerHeight * 0.8;
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await wait(90); }
  window.scrollTo(0, 0);
  const settle = Promise.all([...document.images].map(i => i.complete ? null : new Promise(r => {
    i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true });
  })));
  await Promise.race([settle, wait(8000)]);
})()`)
await sleep(800)

const report = await evaluate(`(() => {
  const imgs = [...document.images];
  const audio = [...document.querySelectorAll('audio')];
  return {
    url: location.href,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    title: document.title,
    landingRoot: Boolean(document.querySelector('.mj-landing')),
    sections: [...document.querySelectorAll('[data-section]')].map(s => s.dataset.section),
    reveals: document.querySelectorAll('.mj-reveal').length,
    revealed: document.querySelectorAll('.mj-reveal.is-in').length,
    images: imgs.length,
    broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src),
    audioCount: audio.length,
    audioSources: audio.map(a => a.currentSrc || a.getAttribute('src')),
    partnersForm: Boolean(document.querySelector('#partners form.mj-partner-form')),
    langButtons: [...document.querySelectorAll('.mj-header-actions .mj-lang button')].map(b => b.title),
    height: document.documentElement.scrollHeight,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
})()`)

report.consoleErrors = consoleErrors
writeFileSync(path.join(import.meta.dirname, 'prod-report.json'), JSON.stringify(report, null, 2), 'utf8')
console.log('WROTE tools/landing-assets/prod-report.json')

await send('Target.closeTarget', { targetId })
socket.close()
chrome.kill()
