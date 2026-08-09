/**
 * يفحص استجابة صفحة الهبوط على مقاسات حقيقية عبر Chrome DevTools Protocol.
 *
 * يكشف تلقائيًا:
 *  - تجاوز أفقي (شريط تمرير جانبي) وأي عنصر يسبّبه
 *  - عناصر تخرج عن حدود الشاشة
 *  - أهداف لمس أصغر من 44px على الموبايل
 *  - نصوص أصغر من 11px
 *  - تداخل الكواكب في مشهد المدار
 * ويأخذ لقطة لكل مقاس.
 *
 * التشغيل: node tools/landing-assets/responsive.mjs [url]
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const BASE = process.argv[2] ?? process.env.MJ_PREVIEW_URL ?? 'http://localhost:5173'
const OUT = path.join(import.meta.dirname, '_responsive')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9422

/** مقاسات تمثّل أجهزة فعلية وحدود الـmedia queries */
const VIEWPORTS = [
  { name: '01-mobile-320', width: 320, height: 700, dpr: 2, mobile: true },
  { name: '02-mobile-375', width: 375, height: 812, dpr: 3, mobile: true },
  { name: '03-mobile-430', width: 430, height: 932, dpr: 3, mobile: true },
  { name: '04-edge-580', width: 580, height: 900, dpr: 2, mobile: true },
  { name: '05-tablet-768', width: 768, height: 1024, dpr: 2, mobile: true },
  { name: '06-edge-860', width: 860, height: 1000, dpr: 2, mobile: true },
  { name: '07-tablet-1024', width: 1024, height: 768, dpr: 2, mobile: false },
  { name: '08-edge-1080', width: 1080, height: 900, dpr: 1, mobile: false },
  { name: '09-laptop-1280', width: 1280, height: 800, dpr: 1, mobile: false },
  { name: '10-desktop-1440', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: '11-wide-1920', width: 1920, height: 1080, dpr: 1, mobile: false },
]

mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const profile = path.join(os.tmpdir(), `mj-resp-${Date.now()}`)
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--disable-gpu', '--no-first-run', '--no-sandbox',
  '--hide-scrollbars', '--force-prefers-reduced-motion',
  'about:blank',
], { stdio: 'ignore' })

let endpoint
for (let attempt = 0; attempt < 80; attempt += 1) {
  try {
    const info = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
    if (info.webSocketDebuggerUrl) { endpoint = info.webSocketDebuggerUrl; break }
  } catch { /* لم يجهز بعد */ }
  await sleep(250)
}
if (!endpoint) { chrome.kill(); throw new Error('تعذّر الاتصال بكروم') }

const socket = new WebSocket(endpoint)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let nextId = 1
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (!message.id || !pending.has(message.id)) return
  const { resolve, reject } = pending.get(message.id)
  pending.delete(message.id)
  if (message.error) reject(new Error(JSON.stringify(message.error)))
  else resolve(message.result)
})

function send(method, params = {}, sessionId, timeoutMs = 30000) {
  const id = nextId += 1
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`مهلة ${method}`)) }, timeoutMs)
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value) },
      reject: (error) => { clearTimeout(timer); reject(error) },
    })
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
await send('Page.enable', {}, sessionId)
await send('Runtime.enable', {}, sessionId)

async function evaluate(expression, timeoutMs = 30000) {
  const result = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, sessionId, timeoutMs)
  return result.result?.value
}

/** يُنفَّذ داخل الصفحة لكل مقاس */
const AUDIT = `(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  // تمرير كامل لتحميل الصور المؤجلة وتفعيل ظهور الأقسام
  const step = window.innerHeight * 0.85;
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await wait(70);
  }
  window.scrollTo(0, 0);
  await wait(350);

  const vw = window.innerWidth;
  const isMobile = vw <= 860;
  const describe = (el) => {
    const own = (node) => (node.className && typeof node.className === 'string')
      ? '.' + node.className.trim().split(/\\s+/).slice(0, 2).join('.')
      : '';
    let label = el.tagName.toLowerCase() + own(el);
    // العناصر بلا صنف تُنسب إلى أقرب سلف مُصنّف حتى تكون قابلة للتتبع
    if (!own(el)) {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (own(p)) { label += ' in ' + own(p); break; }
      }
    }
    return label;
  };

  // 1) تجاوز أفقي
  const docOverflow = document.documentElement.scrollWidth - vw;

  // 2) عناصر تخرج عن الشاشة (تجاهل المزخرفة المخفية والمقصودة)
  const offscreen = [];
  for (const el of document.querySelectorAll('.mj-landing *')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    // العناصر داخل حاويات مقصودة الإخفاء بالـoverflow لا تُحسب
    let clipped = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflow !== 'visible' || ps.overflowX !== 'visible') { clipped = true; break; }
      if (p.classList && p.classList.contains('mj-landing')) break;
    }
    if (clipped) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const overRight = r.right - vw;
    const overLeft = -r.left;
    if (overRight > 2 || overLeft > 2) {
      offscreen.push({ el: describe(el), overRight: Math.round(overRight), overLeft: Math.round(overLeft), width: Math.round(r.width) });
    }
  }

  // 3) أهداف اللمس على الموبايل
  const smallTargets = [];
  if (isMobile) {
    for (const el of document.querySelectorAll('.mj-landing a, .mj-landing button, .mj-landing summary, .mj-landing select')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const text = (el.textContent || '').trim();
      // الروابط النصية عرضها يتبع طول الكلمة، فالمهم فيها الارتفاع.
      // أما الأزرار الأيقونية بلا نص فيلزم البُعدان معًا.
      const tooSmall = text.length > 0
        ? r.height < 44 - 0.5
        : (r.height < 44 - 0.5 || r.width < 44 - 0.5);
      if (tooSmall) {
        smallTargets.push({ el: describe(el), w: Math.round(r.width), h: Math.round(r.height), text: text.slice(0, 24) });
      }
    }
  }

  // 4) نصوص صغيرة جدًا
  const tinyText = new Map();
  for (const el of document.querySelectorAll('.mj-landing p, .mj-landing span, .mj-landing small, .mj-landing b, .mj-landing li, .mj-landing figcaption, .mj-landing td, .mj-landing th')) {
    if (!el.textContent || !el.textContent.trim()) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none') continue;
    const size = parseFloat(style.fontSize);
    // 11px حدّ أدنى على شاشات اللمس، و10px على الديسكتوب حيث نصوص
    // الميتا الثانوية بحجم 10.5px متعارف عليها مع مؤشر الماوس
    const floor = isMobile ? 11 : 10;
    if (size > 0 && size < floor) {
      const key = describe(el) + '@' + size.toFixed(1);
      tinyText.set(key, (tinyText.get(key) || 0) + 1);
    }
  }

  // 5) تداخل الكواكب
  const planets = [...document.querySelectorAll('.mj-planet')].map(p => {
    const r = p.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2, name: (p.textContent || '').trim() };
  });
  const planetOverlaps = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const d = Math.hypot(planets[i].cx - planets[j].cx, planets[i].cy - planets[j].cy);
      if (d < planets[i].r + planets[j].r - 2) planetOverlaps.push(planets[i].name + ' ↔ ' + planets[j].name);
    }
  }

  // 6) تحقق أن القوائم انقلبت لوضع الموبايل
  const burger = document.querySelector('.mj-burger');
  const burgerVisible = burger ? getComputedStyle(burger).display !== 'none' : false;
  const navEl = document.querySelector('.mj-nav');
  const navPosition = navEl ? getComputedStyle(navEl).position : null;

  // 7) أعمدة الشبكات الرئيسية
  const cols = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
  };

  return {
    vw, isMobile,
    scrollHeight: document.documentElement.scrollHeight,
    docOverflow,
    offscreen: offscreen.slice(0, 10),
    offscreenCount: offscreen.length,
    smallTargets: smallTargets.slice(0, 10),
    smallTargetCount: smallTargets.length,
    tinyText: [...tinyText.entries()].slice(0, 6),
    planetOverlaps,
    burgerVisible, navPosition,
    grid: {
      pillars: cols('.mj-pillars'),
      posters: cols('.mj-poster-row'),
      trust: cols('.mj-trust-grid'),
      plans: cols('.mj-plans'),
      faq: cols('.mj-faq-grid'),
      footer: cols('.mj-footer-grid'),
      worlds: cols('.mj-worlds'),
      ageCard: cols('.mj-age-card'),
      parents: cols('.mj-parents-grid'),
    },
  };
})()`

console.log(`فحص الاستجابة على ${BASE}\n`)
const results = []

for (const view of VIEWPORTS) {
  // بدون screenWidth/screenHeight يوسّع كروم منفذ العرض تلقائيًا عند
  // mobile:true فلا تُختبر المقاسات الضيقة فعلًا. نتحقق لاحقًا أن innerWidth مطابق.
  await send('Emulation.setDeviceMetricsOverride', {
    width: view.width, height: view.height, deviceScaleFactor: 1, mobile: view.mobile,
    screenWidth: view.width, screenHeight: view.height,
  }, sessionId)
  await send('Page.navigate', { url: BASE }, sessionId)

  // الانتظار حتى تُركّب الصفحة فعلًا، بدل مهلة ثابتة قد تسبق الرندر
  // فتمرّ الفحوصات على صفحة فارغة ويظهر نجاح زائف
  let ready = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(300)
    ready = await evaluate(`Boolean(document.querySelector('.mj-pillars') && document.querySelector('.mj-planet'))`)
    if (ready) break
  }
  if (!ready) {
    console.log(`✗ ${String(view.width).padStart(4)}px  الصفحة لم تُركّب داخل المهلة — الفحص غير موثوق`)
    process.exitCode = 1
    continue
  }

  const audit = await evaluate(AUDIT, 60000)

  // حراسة ثانية: لو غابت الشبكات فالقياس باطل
  if (audit.grid.pillars === null || audit.grid.posters === null) {
    console.log(`✗ ${String(view.width).padStart(4)}px  تعذّر قياس الشبكات — الفحص غير موثوق`)
    process.exitCode = 1
    continue
  }

  results.push({ view, audit })

  const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
  writeFileSync(path.join(OUT, `${view.name}.png`), Buffer.from(shot.data, 'base64'))

  const flags = []
  // لو لم يطابق منفذ العرض المطلوب فالنتيجة غير موثوقة ولا تُحتسب
  if (audit.vw !== view.width) flags.push(`منفذ العرض ${audit.vw} لا يطابق المطلوب ${view.width}`)
  if (audit.docOverflow > 2) flags.push(`تجاوز أفقي ${audit.docOverflow}px`)
  if (audit.offscreenCount > 0) flags.push(`${audit.offscreenCount} عنصر خارج الشاشة`)
  if (audit.smallTargetCount > 0) flags.push(`${audit.smallTargetCount} هدف لمس <44px`)
  if (audit.tinyText.length > 0) flags.push(`نص <11px`)
  if (audit.planetOverlaps.length > 0) flags.push(`${audit.planetOverlaps.length} تداخل كواكب`)

  const mark = flags.length === 0 ? '✓' : '✗'
  console.log(`${mark} ${String(view.width).padStart(4)}px  ${flags.length === 0 ? 'سليم' : flags.join(' | ')}`)

  if (audit.offscreenCount > 0) {
    audit.offscreen.forEach((o) => console.log(`      خارج: ${o.el} (يمين +${o.overRight}, يسار +${o.overLeft}, عرض ${o.width})`))
  }
  if (audit.smallTargetCount > 0) {
    audit.smallTargets.forEach((t) => console.log(`      لمس: ${t.el} ${t.w}×${t.h} "${t.text}"`))
  }
  if (audit.tinyText.length > 0) {
    audit.tinyText.forEach(([key, count]) => console.log(`      نص: ${key}px ×${count}`))
  }
  audit.planetOverlaps.forEach((p) => console.log(`      كواكب: ${p}`))
}

console.log('\n--- أعمدة الشبكات لكل مقاس ---')
console.log('عرض   أعمدة:أساسات بوسترات ثقة باقات أسئلة فوتر | عوالم أعمار أهل | برجر موضع-القائمة')
for (const { view, audit } of results) {
  const g = audit.grid
  console.log(
    `${String(view.width).padStart(4)}  ` +
    `${String(g.pillars).padStart(8)} ${String(g.posters).padStart(8)} ${String(g.trust).padStart(3)} ` +
    `${String(g.plans).padStart(5)} ${String(g.faq).padStart(5)} ${String(g.footer).padStart(4)} | ` +
    `${String(g.worlds).padStart(5)} ${String(g.ageCard).padStart(5)} ${String(g.parents).padStart(3)} | ` +
    `${audit.burgerVisible ? 'ظاهر' : 'مخفي'} ${audit.navPosition}`,
  )
}

const broken = results.filter(({ audit }) =>
  audit.docOverflow > 2 || audit.offscreenCount > 0 || audit.smallTargetCount > 0
  || audit.tinyText.length > 0 || audit.planetOverlaps.length > 0)

console.log(`\n${broken.length === 0 ? 'كل المقاسات سليمة' : `${broken.length} مقاس به مشاكل: ${broken.map((b) => b.view.width + 'px').join(', ')}`}`)
console.log(`اللقطات في ${OUT}`)

await send('Target.closeTarget', { targetId })
socket.close()
chrome.kill()
if (broken.length > 0) process.exitCode = 1
