/**
 * يتحقق فعليًا من أن مبدّل اللغة يترجم الصفحة، لا أن الزر يستجيب فقط.
 * يقيس: تغيّر نصوص عشرة أقسام، ضبط lang/dir على <html>، بقاء الاختيار بعد إعادة التحميل،
 * غياب التمرير الأفقي في اتجاه LTR، وعدم بقاء أي نص عربي في الواجهة الأجنبية.
 *
 * التشغيل: node tools/landing-assets/check-i18n.mjs http://127.0.0.1:5199
 */
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5199'
const OUT = path.join(import.meta.dirname, '_check')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9414

mkdirSync(OUT, { recursive: true })

const profile = path.join(os.tmpdir(), `mj-i18n-${Date.now()}`)
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--disable-gpu', '--no-first-run', '--no-sandbox', '--hide-scrollbars',
  '--force-prefers-reduced-motion',
  '--window-size=1360,1000',
  'about:blank',
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
  width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false,
  screenWidth: 1360, screenHeight: 1000,
}, sessionId)

async function evaluate(expression, timeoutMs = 30000) {
  const result = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, sessionId, timeoutMs)
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'خطأ تنفيذ')
  return result.result?.value
}

async function goto(url) {
  await send('Page.navigate', { url }, sessionId)
  await sleep(2200)
}

async function shoot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
  writeFileSync(path.join(OUT, `i18n-${name}.png`), Buffer.from(result.data, 'base64'))
}

/** بصمة نصية من عشرة أقسام مختلفة، ومقاييس الاتجاه والتجاوز */
const PROBE = `(() => {
  const t = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;
  const root = document.documentElement;
  const overflow = [...document.querySelectorAll('.mj-landing *')]
    .filter((el) => el.getBoundingClientRect().width > root.clientWidth + 1)
    .map((el) => el.className + ' @' + Math.round(el.getBoundingClientRect().width))
    .slice(0, 8);
  // نص عربي متبقٍ داخل الواجهة (نستثني الشعار وعيّنة اللغات المقصودة)
  const arabic = /[\\u0600-\\u06FF]/;
  const leaked = [...document.querySelectorAll('.mj-landing *')]
    .filter((el) => el.children.length === 0)
    .filter((el) => arabic.test(el.textContent ?? ''))
    .filter((el) => !el.closest('.mj-brand, .mj-lang, .mj-copyright, .mj-footer-select, .mj-lang-txt, .mj-seg'))
    .map((el) => (el.className || el.tagName) + ': ' + el.textContent.trim().slice(0, 40))
    .slice(0, 10);
  return {
    lang: root.lang,
    dir: root.dir,
    stored: window.localStorage.getItem('majarra-landing-lang'),
    title: document.title,
    h1: t('.mj-hero h1'),
    heroCopy: t('.mj-hero-copy'),
    nav: [...document.querySelectorAll('.mj-nav-link')].map((n) => n.textContent.trim()),
    trust: t('.mj-trust-item'),
    pillar: t('.mj-pillar h3'),
    showcaseTab: t('.mj-tab'),
    world: t('.mj-wpanel h3'),
    ageTab: t('.mj-age-switch button'),
    plan: t('.mj-plan-tagline'),
    faq: t('.mj-faq summary'),
    partnersHeading: t('#partners h2'),
    partnersSubmit: t('#partners button[type=submit]'),
    footerCol: t('.mj-footer-col h3'),
    scrollW: root.scrollWidth,
    clientW: root.clientWidth,
    overflow,
    leaked,
    sections: [...document.querySelectorAll('[data-section]')].map((s) => s.dataset.section).length,
    audioSrc: document.querySelector('.mj-reader audio')?.getAttribute('src')
      ?? document.querySelector('.mj-reader source')?.getAttribute('src') ?? null,
  };
})()`

/**
 * مبدّل الهيدر يعرض الاختصار (ع / EN / FR) على الشاشات الضيقة والاسم الكامل داخل القائمة،
 * فنطابق على title لأنه يحمل الاسم بلغته الأصلية في الحالتين.
 */
const CLICK = (label) => `(() => {
  const buttons = [...document.querySelectorAll('.mj-header-actions .mj-lang button')];
  const btn = buttons.find((b) => b.title === ${JSON.stringify(label)});
  if (!btn) return { clicked: false, available: buttons.map((b) => b.title + '/' + b.textContent.trim()) };
  btn.click();
  return { clicked: true, pressed: btn.getAttribute('aria-pressed') };
})()`

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures.push(name)
}

console.log(`فتح ${BASE}`)
await goto(BASE)

// كروم بلا واجهة لغته en-US فيستنتج المنصّة الإنجليزية،
// ونحتاج العربية خطًا مرجعيًا نقيس عليه التغيّر
await evaluate(`window.localStorage.setItem('majarra-landing-lang', 'ar')`)
await goto(BASE)

console.log('\n--- العربية (خط مرجعي) ---')
const ar = await evaluate(PROBE)
check('lang=ar dir=rtl', ar.lang === 'ar' && ar.dir === 'rtl', `${ar.lang}/${ar.dir}`)
check('عشرون قسمًا على الأقل', ar.sections >= 20, `${ar.sections} قسم`)
check('قسم الشراكات موجود', Boolean(ar.partnersHeading), ar.partnersHeading ?? '—')
check('صفر تجاوز أفقي', ar.scrollW <= ar.clientW + 1, `${ar.scrollW} ≤ ${ar.clientW}`)
console.log('    H1:', ar.h1)
await shoot('ar')

const results = { ar }

for (const [label, code, dir] of [['English', 'en', 'ltr'], ['Français', 'fr', 'ltr']]) {
  console.log(`\n--- ${label} ---`)
  const clicked = await evaluate(CLICK(label))
  check('زر اللغة قابل للنقر', clicked.clicked === true, JSON.stringify(clicked))
  await sleep(700)
  const probe = await evaluate(PROBE)
  results[code] = probe

  check(`lang=${code} dir=${dir}`, probe.lang === code && probe.dir === dir, `${probe.lang}/${probe.dir}`)
  check('الاختيار محفوظ في localStorage', probe.stored === code, String(probe.stored))
  check('عنوان الصفحة تُرجم', probe.title !== ar.title)
  check('عنوان الهيرو تُرجم', probe.h1 !== ar.h1, probe.h1 ?? '—')
  check('نص الهيرو تُرجم', probe.heroCopy !== ar.heroCopy)
  check('شريط التنقل تُرجم', JSON.stringify(probe.nav) !== JSON.stringify(ar.nav), probe.nav.join(' | '))
  check('شريط الثقة تُرجم', probe.trust !== ar.trust, probe.trust ?? '—')
  check('العمود الأول تُرجم', probe.pillar !== ar.pillar, probe.pillar ?? '—')
  check('تبويب المحتوى تُرجم', probe.showcaseTab !== ar.showcaseTab, probe.showcaseTab ?? '—')
  check('لوحة الكوكب تُرجمت', probe.world !== ar.world, probe.world ?? '—')
  check('تبويب العمر تُرجم', probe.ageTab !== ar.ageTab, probe.ageTab ?? '—')
  check('وصف الباقة تُرجم', probe.plan !== ar.plan)
  check('سؤال شائع تُرجم', probe.faq !== ar.faq, probe.faq ?? '—')
  check('قسم الشراكات تُرجم', probe.partnersHeading !== ar.partnersHeading, probe.partnersHeading ?? '—')
  check('زر إرسال الطلب تُرجم', probe.partnersSubmit !== ar.partnersSubmit, probe.partnersSubmit ?? '—')
  check('عمود الفوتر تُرجم', probe.footerCol !== ar.footerCol, probe.footerCol ?? '—')
  check('صفر تجاوز أفقي', probe.scrollW <= probe.clientW + 1, `${probe.scrollW} ≤ ${probe.clientW}${probe.overflow.length ? ' :: ' + probe.overflow.join(' , ') : ''}`)
  check('لا نص عربي متبقٍ', probe.leaked.length === 0, probe.leaked.join(' || '))
  await shoot(code)
}

console.log('\n--- بقاء اللغة بعد إعادة التحميل ---')
await goto(BASE)
const reloaded = await evaluate(PROBE)
check('اللغة الفرنسية ما زالت مطبَّقة', reloaded.lang === 'fr' && reloaded.h1 === results.fr.h1, `${reloaded.lang} / ${reloaded.h1}`)

console.log('\n--- أخطاء الكونسول ---')
if (consoleErrors.length === 0) console.log('  لا أخطاء')
else consoleErrors.forEach((e) => console.log('  !', e))

console.log('\n=== الخلاصة ===')
if (failures.length === 0 && consoleErrors.length === 0) console.log('كل الفحوص ناجحة')
else {
  console.log(`فحوص فاشلة: ${failures.length} → ${failures.join(' , ')}`)
  console.log(`أخطاء كونسول: ${consoleErrors.length}`)
  process.exitCode = 1
}

await send('Target.closeTarget', { targetId })
socket.close()
chrome.kill()
