/**
 * يأخذ لقطات تحقق لصفحة الهبوط عبر Chrome DevTools Protocol.
 * يعطي لقطة كاملة للصفحة ولقطات لكل قسم، ويجمع أخطاء الكونسول.
 *
 * التشغيل: node tools/landing-assets/shoot.mjs http://localhost:4319
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const BASE = process.argv[2] ?? process.env.MJ_PREVIEW_URL ?? 'http://localhost:4321'
const OUT = path.join(import.meta.dirname, '_check')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9411

mkdirSync(OUT, { recursive: true })

const profile = path.join(os.tmpdir(), `mj-shoot-${Date.now()}`)
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-sandbox',
  '--hide-scrollbars',
  '--force-prefers-reduced-motion',
  '--window-size=1360,1000',
  'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

console.log('انتظار المتصفح…')
let endpoint
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/json/version`)
    const info = await response.json()
    if (info.webSocketDebuggerUrl) { endpoint = info.webSocketDebuggerUrl; break }
  } catch {
    // لم يجهز
  }
  await sleep(250)
}
if (!endpoint) {
  chrome.kill()
  throw new Error('تعذّر الاتصال بمنفذ تصحيح كروم')
}

const socket = new WebSocket(endpoint)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
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

/** كل أمر له مهلة قصوى حتى لا تتوقف الأداة إلى الأبد */
function send(method, params = {}, sessionId, timeoutMs = 30000) {
  const id = nextId += 1
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`مهلة ${method}`))
    }, timeoutMs)
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value) },
      reject: (error) => { clearTimeout(timer); reject(error) },
    })
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
}

// جلسة على تبويب جديد
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

await send('Page.enable', {}, sessionId)
await send('Runtime.enable', {}, sessionId)
await send('Emulation.setDeviceMetricsOverride', {
  width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false,
}, sessionId)

async function goto(url) {
  await send('Page.navigate', { url }, sessionId)
  await sleep(2500)
}

async function evaluate(expression, timeoutMs = 30000) {
  const result = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, sessionId, timeoutMs)
  return result.result?.value
}

async function shoot(name, options = {}) {
  const result = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: Boolean(options.fullPage), ...options.clip ? { clip: options.clip } : {},
  }, sessionId)
  const file = path.join(OUT, `${name}.png`)
  writeFileSync(file, Buffer.from(result.data, 'base64'))
  console.log(`  ✓ ${name}.png`)
}

console.log(`فتح ${BASE}`)
await goto(BASE)

// تمرير الصفحة كاملة أولًا حتى تُحمّل الصور المؤجلة (loading="lazy")،
// وإلا ظهرت فراغات في اللقطات بسبب أداة التحقق لا بسبب الصفحة
console.log('تمرير لتحميل الصور المؤجلة…')
const scrollReport = await evaluate(`(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const step = window.innerHeight * 0.8;
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await wait(100);
  }
  window.scrollTo(0, 0);
  // مهلة قصوى حتى لا يتوقف التحقق على صورة لا تُحمّل أبدًا
  const settle = Promise.all([...document.images].map(img => img.complete
    ? Promise.resolve()
    : new Promise(r => {
        img.addEventListener('load', r, { once: true });
        img.addEventListener('error', r, { once: true });
      })));
  await Promise.race([settle, wait(6000)]);
  const imgs = [...document.images];
  return { total: imgs.length, pending: imgs.filter(i => !i.complete).length };
})()`)
console.log(`  الصور: ${scrollReport.total} | ما زالت معلّقة: ${scrollReport.pending}`)
await sleep(800)

const diagnostics = await evaluate(`(() => {
  const root = document.querySelector('.mj-landing');
  const sections = [...document.querySelectorAll('[data-section]')].map(s => s.dataset.section);
  const imgs = [...document.images];
  return {
    hasRoot: Boolean(root),
    height: document.documentElement.scrollHeight,
    sections,
    reveals: document.querySelectorAll('.mj-reveal').length,
    revealed: document.querySelectorAll('.mj-reveal.is-in').length,
    images: imgs.length,
    brokenImages: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src),
    h1: document.querySelector('.mj-hero h1')?.textContent ?? null,
  };
})()`)

console.log('\n--- تشخيص ---')
console.log('جذر mj-landing:', diagnostics.hasRoot)
console.log('طول الصفحة:', diagnostics.height, 'px')
console.log('الأقسام:', diagnostics.sections.length, '→', diagnostics.sections.join(', '))
console.log('عناصر reveal:', diagnostics.revealed, '/', diagnostics.reveals, 'ظاهرة')
console.log('الصور:', diagnostics.images, '| مكسورة:', diagnostics.brokenImages.length)
diagnostics.brokenImages.forEach((src) => console.log('   ! ', src))
console.log('عنوان H1:', diagnostics.h1)

// لقطات لكل قسم
const sectionShots = ['hero', 'pillars', 'showcase', 'worlds', 'stories', 'ages', 'parents', 'learning', 'identity', 'languages', 'devices', 'originals', 'start', 'plans', 'reviews', 'faq', 'footer']
console.log('\n--- لقطات الأقسام ---')
for (const name of sectionShots) {
  const box = await evaluate(`(() => {
    const el = document.querySelector('[data-section="${name}"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: 0, y: Math.round(r.top + window.scrollY), width: 1360, height: Math.min(Math.round(r.height), 2400) };
  })()`)
  if (!box) { console.log(`  - ${name}: غير موجود`); continue }
  await shoot(`sec-${name}`, { clip: { ...box, scale: 1 }, fullPage: true })
}

console.log('\n--- أخطاء الكونسول ---')
if (consoleErrors.length === 0) console.log('لا أخطاء')
else consoleErrors.forEach((e) => console.log('  !', e))

await send('Target.closeTarget', { targetId })
socket.close()
chrome.kill()
if (diagnostics.brokenImages.length || consoleErrors.length) process.exitCode = 1
