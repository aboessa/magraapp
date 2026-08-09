/**
 * يتحقق أن مشغّل السرد يعمل فعلًا: يضغط زر التشغيل ويقيس تقدّم الوقت
 * وعدد أعمدة الموجة المُلوّنة، ثم يتحقق من الإيقاف والانتقال.
 *
 * التشغيل: node tools/landing-assets/check-audio.mjs [url]
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

const BASE = process.argv[2] ?? process.env.MJ_PREVIEW_URL ?? 'http://127.0.0.1:5199'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9466

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = path.join(os.tmpdir(), `mj-audio-${Date.now()}`)
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--disable-gpu', '--no-first-run', '--no-sandbox', '--hide-scrollbars',
  // يسمح بالتشغيل بلا تفاعل مستخدم حقيقي، وبمخرَج صوتي وهمي في بيئة بلا صوت
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream',
  'about:blank',
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
  if (await evaluate(`Boolean(document.querySelector('.mj-reader-audio audio'))`)) break
}

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

// 1) العنصر موجود ولا يُنزّل شيئًا قبل التفاعل
const initial = await evaluate(`(() => {
  const a = document.querySelector('.mj-reader-audio audio');
  return { src: a.getAttribute('src'), preload: a.getAttribute('preload'), readyState: a.readyState, paused: a.paused };
})()`)
check('عنصر الصوت موجود', Boolean(initial.src), initial.src)
check('لا يُنزّل قبل الضغط', initial.preload === 'none' && initial.readyState === 0,
  `preload=${initial.preload} readyState=${initial.readyState}`)

// 2) عنصر الصوت يقرأ الملف ويعرف مدته.
// نتجنّب fetch من داخل الصفحة لأن سيرفر التطوير يردّ 204 على طلبات
// الملفات الثابتة أحيانًا، وهو أرتيفاكت في الفحص لا عيب في المنتج.
const meta = await evaluate(`(async () => {
  const audio = document.querySelector('.mj-reader-audio audio');
  if (audio.readyState >= 1) return { duration: audio.duration, readyState: audio.readyState };
  return await new Promise((resolve) => {
    audio.addEventListener('loadedmetadata', () => resolve({ duration: audio.duration, readyState: audio.readyState }), { once: true });
    audio.addEventListener('error', () => resolve({ error: 'خطأ تحميل، كود ' + (audio.error && audio.error.code) }), { once: true });
    setTimeout(() => resolve({ error: 'مهلة تحميل البيانات الوصفية' }), 12000);
    audio.load();
  });
})()`, 30000)
check('عنصر الصوت يقرأ الملف', !meta.error && meta.readyState >= 1,
  meta.error ?? `readyState=${meta.readyState}`)
check('المدة تطابق المتوقع 12.84 ث',
  !meta.error && Math.abs(meta.duration - 12.84) < 0.15,
  meta.error ?? `${Number(meta.duration).toFixed(2)} ث`)


// 4) الضغط على التشغيل يُقدّم الوقت
const played = await evaluate(`(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const section = document.querySelector('[data-section="stories"]');
  section.scrollIntoView();
  await wait(500);
  const btn = document.querySelector('.mj-play');
  const audio = document.querySelector('.mj-reader-audio audio');
  btn.click();
  await wait(1800);
  const t1 = audio.currentTime;
  const barsPlayed = document.querySelectorAll('.mj-wave i.is-played').length;
  const label = document.querySelector('.mj-reader-audio small').textContent;
  const icon = document.querySelector('.mj-play svg path')?.getAttribute('d') ?? '';
  await wait(1200);
  const t2 = audio.currentTime;
  return { t1, t2, paused: audio.paused, barsPlayed, label, isPauseIcon: icon.includes('M8 5h3v14H8') };
})()`, 30000)
check('التشغيل يبدأ ويتقدّم الوقت', played.t1 > 0.2 && played.t2 > played.t1,
  `${played.t1.toFixed(2)} ث ← ${played.t2.toFixed(2)} ث`)
check('أعمدة الموجة تتلوّن مع التقدّم', played.barsPlayed > 0, `${played.barsPlayed} من 28`)
check('الأيقونة تتحول إلى إيقاف', played.isPauseIcon)
check('الوقت يظهر في التسمية', /\d:\d\d/.test(played.label), played.label.trim())

// 5) الإيقاف يعمل
const paused = await evaluate(`(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const btn = document.querySelector('.mj-play');
  const audio = document.querySelector('.mj-reader-audio audio');
  btn.click();
  await wait(400);
  const tAtPause = audio.currentTime;
  await wait(900);
  return { paused: audio.paused, drift: Math.abs(audio.currentTime - tAtPause) };
})()`)
check('الإيقاف يعمل ولا يتقدّم الوقت', paused.paused && paused.drift < 0.05,
  `paused=${paused.paused} انحراف ${paused.drift.toFixed(3)} ث`)

// 6) الانتقال بالنقر على الموجة
const seeked = await evaluate(`(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const wave = document.querySelector('.mj-wave');
  const audio = document.querySelector('.mj-reader-audio audio');
  const box = wave.getBoundingClientRect();
  // RTL: النقر قرب الحافة اليسرى يعني قرب نهاية المقطع
  wave.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: box.left + box.width * 0.1, clientY: box.top + box.height / 2 }));
  await wait(400);
  return { t: audio.currentTime, duration: audio.duration };
})()`)
check('النقر على الموجة ينتقل للأمام', seeked.t > seeked.duration * 0.6,
  `${seeked.t.toFixed(2)} ث من ${seeked.duration.toFixed(2)} ث`)

// 7) الخروج عن الشاشة يوقف التشغيل
// نبدأ من صفحة نظيفة حتى لا يعتمد هذا الفحص على حالة الفحوصات السابقة
await send('Page.navigate', { url: BASE }, sessionId)
for (let i = 0; i < 40; i += 1) {
  await sleep(300)
  if (await evaluate(`Boolean(document.querySelector('.mj-reader-audio audio'))`)) break
}

const autoPause = await evaluate(`(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const audio = document.querySelector('.mj-reader-audio audio');
  const btn = document.querySelector('.mj-play');

  document.querySelector('[data-section="stories"]').scrollIntoView();
  await wait(700);
  btn.click();
  // ننتظر بدء التشغيل فعليًا بدل مهلة ثابتة
  let wasPlaying = false;
  for (let i = 0; i < 20; i += 1) {
    await wait(150);
    if (!audio.paused && audio.currentTime > 0.05) { wasPlaying = true; break; }
  }
  if (!wasPlaying) return { wasPlaying, pausedAfterScroll: audio.paused, note: 'لم يبدأ التشغيل' };

  window.scrollTo(0, 0);
  let pausedAfterScroll = false;
  for (let i = 0; i < 20; i += 1) {
    await wait(150);
    if (audio.paused) { pausedAfterScroll = true; break; }
  }
  return { wasPlaying, pausedAfterScroll };
})()`, 30000)
check('يتوقف عند خروج القسم عن الشاشة',
  autoPause.wasPlaying && autoPause.pausedAfterScroll,
  autoPause.note ?? `كان يشتغل=${autoPause.wasPlaying} توقف=${autoPause.pausedAfterScroll}`)

console.log(failures === 0 ? '\nكل الفحوصات ناجحة' : `\n${failures} فحص فاشل`)

await send('Target.closeTarget', { targetId })
socket.close()
chrome.kill()
if (failures > 0) process.exitCode = 1
