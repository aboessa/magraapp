/**
 * يحدد العنصر المسؤول عن العرض الأدنى للصفحة على شاشة ضيقة.
 * يقيس min-content width لكل عنصر ويرتّب الأسوأ.
 *
 * التشغيل: node tools/landing-assets/diagnose-width.mjs [url] [width]
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

const BASE = process.argv[2] ?? process.env.MJ_PREVIEW_URL ?? 'http://localhost:5173'
const WIDTH = Number(process.argv[3] ?? 320)
const MOBILE = process.argv[4] !== 'desktop'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9433

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const profile = path.join(os.tmpdir(), `mj-diag-${Date.now()}`)
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--disable-gpu', '--no-first-run', '--no-sandbox', '--hide-scrollbars',
  '--force-prefers-reduced-motion', 'about:blank',
], { stdio: 'ignore' })

let endpoint
for (let attempt = 0; attempt < 80; attempt += 1) {
  try {
    const info = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
    if (info.webSocketDebuggerUrl) { endpoint = info.webSocketDebuggerUrl; break }
  } catch { /* ignore */ }
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
function send(method, params = {}, sessionId, timeoutMs = 40000) {
  const id = nextId += 1
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
  width: WIDTH, height: 800, deviceScaleFactor: 1, mobile: MOBILE,
  screenWidth: WIDTH, screenHeight: 800,
}, sessionId)
console.log(`طُلب: ${WIDTH}px | mobile=${MOBILE}`)
await send('Page.navigate', { url: BASE }, sessionId)
await sleep(2600)

const result = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => {
    const vw = window.innerWidth;
    const probe = document.createElement('div');
    const describe = (el) => {
      const id = el.id ? '#' + el.id : '';
      const cls = (el.className && typeof el.className === 'string')
        ? '.' + el.className.trim().split(/\\s+/).join('.') : '';
      return el.tagName.toLowerCase() + id + cls;
    };
    const path = (el) => {
      const parts = [];
      for (let p = el; p && parts.length < 4; p = p.parentElement) {
        parts.push(el === p ? describe(p) : (p.className && typeof p.className === 'string'
          ? '.' + p.className.trim().split(/\\s+/)[0] : p.tagName.toLowerCase()));
      }
      return parts.join(' < ');
    };

    // min-content width لكل عنصر: العناصر التي لا تستطيع الانضغاط تحت عرض الشاشة
    const offenders = [];
    for (const el of document.querySelectorAll('.mj-landing *')) {
      const style = getComputedStyle(el);
      if (style.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= vw + 1) continue;
      offenders.push({
        el: path(el),
        width: Math.round(r.width),
        excess: Math.round(r.width - vw),
        position: style.position,
        whiteSpace: style.whiteSpace,
        minWidth: style.minWidth,
        flex: style.flex,
        gridCols: style.gridTemplateColumns.split(' ').length,
        childCount: el.children.length,
      });
    }
    offenders.sort((a, b) => b.excess - a.excess);

    // العناصر التي تُوسّع المستند فعلًا: تتجاوز الحدود ولا يقصّها أي سلف
    const clipsX = (el) => {
      const s = getComputedStyle(el);
      return s.overflowX !== 'visible' || s.overflow !== 'visible';
    };
    const unclipped = [];
    for (const el of document.querySelectorAll('.mj-landing, .mj-landing *')) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      // العناصر الثابتة لا تُوسّع منطقة التمرير
      if (s.position === 'fixed') continue;
      let clipped = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (clipsX(p)) { clipped = true; break; }
      }
      if (clipped) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const right = r.right + window.scrollX;
      const left = r.left + window.scrollX;
      if (right > vw + 1 || left < -1) {
        unclipped.push({
          el: path(el),
          right: Math.round(right),
          left: Math.round(left),
          width: Math.round(r.width),
          position: s.position,
          overRight: Math.round(right - vw),
          overLeft: Math.round(-left),
        });
      }
    }
    unclipped.sort((a, b) => Math.max(b.overRight, b.overLeft) - Math.max(a.overRight, a.overLeft));

    // فحص الهيدر بالتفصيل
    const header = document.querySelector('.mj-header');
    const inner = document.querySelector('.mj-header-inner');
    const headerKids = inner ? [...inner.children].map((c) => {
      const s = getComputedStyle(c);
      const r = c.getBoundingClientRect();
      return { el: describe(c), w: Math.round(r.width), display: s.display, position: s.position, minWidth: s.minWidth, flexShrink: s.flexShrink };
    }) : [];

    return {
      vw,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      landingWidth: Math.round(document.querySelector('.mj-landing')?.getBoundingClientRect().width ?? 0),
      headerWidth: header ? Math.round(header.getBoundingClientRect().width) : null,
      innerWidth: inner ? Math.round(inner.getBoundingClientRect().width) : null,
      headerKids,
      offenderCount: offenders.length,
      worst: offenders.slice(0, 6),
      unclippedCount: unclipped.length,
      unclipped: unclipped.slice(0, 20),
    };
  })()`,
}, sessionId)

const data = result.result.value
console.log(`عرض الشاشة: ${data.vw}px`)
console.log(`scrollWidth للمستند: ${data.docScrollWidth} | للـbody: ${data.bodyScrollWidth}`)
console.log(`عرض .mj-landing: ${data.landingWidth}`)
console.log(`عرض الهيدر: ${data.headerWidth} | عرض .mj-header-inner: ${data.innerWidth}`)

console.log('\n--- أبناء الهيدر ---')
data.headerKids.forEach((kid) => {
  console.log(`  ${kid.el}`)
  console.log(`     عرض ${kid.w} | display ${kid.display} | position ${kid.position} | min-width ${kid.minWidth} | flex-shrink ${kid.flexShrink}`)
})

console.log(`\n=== المسبّب الحقيقي للتجاوز: ${data.unclippedCount} عنصر غير مقصوص ===`)
data.unclipped.forEach((o) => {
  const side = o.overRight > o.overLeft ? `يمين +${o.overRight}` : `يسار +${o.overLeft}`
  console.log(`  ${side}  ${o.el}`)
  console.log(`     عرض ${o.width} | left ${o.left} | right ${o.right} | position ${o.position}`)
})

console.log(`\n--- (للمقارنة) أوسع من الشاشة لكن مقصوص: ${data.offenderCount} ---`)
data.worst.forEach((o) => {
  console.log(`  +${o.excess}px  ${o.el} (عرض ${o.width}, ${o.position})`)
})

await send('Target.closeTarget', { targetId })
socket.close()
chrome.kill()
