/**
 * يملأ نموذج الشراكات في المتصفح فعليًا ويؤكد وصول الطلب إلى D1.
 * يغطي المسار الكامل: React → fetch → Worker → D1 → مسار الإدارة.
 *
 * التشغيل: node tools/landing-assets/check-partner-form.mjs http://127.0.0.1:5205 http://127.0.0.1:8791
 */
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

const SITE = (process.argv[2] ?? 'http://127.0.0.1:5205').replace(/\/$/, '')
const API = (process.argv[3] ?? 'http://127.0.0.1:8791').replace(/\/$/, '')
const OUT = path.join(import.meta.dirname, '_check')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9417

mkdirSync(OUT, { recursive: true })

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(os.tmpdir(), `mj-form-${Date.now()}`)}`,
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
/**
 * ملاحظة على التكرار: المتصفح لا يرسل CF-Connecting-IP (ولا يُسمح له،
 * فـCloudflare تكتبه على الحافة)، فكل تشغيلة تُحسب على مفتاح "unknown"
 * وحدّه خمسة طلبات مقبولة في الساعة. قبل إعادة التشغيل امسح العدّاد:
 *   npx wrangler kv key delete --binding CACHE --local --preview "rl:partnership-submit:unknown"
 * تشغيله من مجلد dashboard/api، ثم أعد تشغيل wrangler dev
 * لأن للحدّ نسخة في ذاكرة العملية أيضًا.
 */
await send('Emulation.setDeviceMetricsOverride', {
  width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false,
  screenWidth: 1360, screenHeight: 1000,
}, sessionId)

async function evaluate(expression, timeoutMs = 30000) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId, timeoutMs)
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'خطأ تنفيذ')
  return result.result?.value
}

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures.push(name)
}

async function shoot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
  writeFileSync(path.join(OUT, `form-${name}.png`), Buffer.from(result.data, 'base64'))
}

/** React لا يرى تغيير value المباشر، فنُطلق حدث input أصليًا */
const SET_FIELD = (selector, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`

console.log(`فتح ${SITE}`)
await send('Page.navigate', { url: SITE }, sessionId)
await sleep(2500)

console.log('\n--- النموذج ظاهر ---')
const present = await evaluate(`(() => {
  const form = document.querySelector('#partners form.mj-partner-form');
  return {
    form: Boolean(form),
    fields: [...document.querySelectorAll('#partners form input, #partners form textarea, #partners form select')].map((el) => el.id),
    honeypotVisible: (() => {
      const box = document.querySelector('.mj-honeypot');
      if (!box) return null;
      const r = box.getBoundingClientRect();
      return r.width > 4 || r.height > 4;
    })(),
  };
})()`)
check('النموذج مُركّب', present.form)
check('الحقول المطلوبة موجودة',
  ['mj-p-kind', 'mj-p-name', 'mj-p-org', 'mj-p-email', 'mj-p-message'].every((id) => present.fields.includes(id)),
  present.fields.join(', '))
check('فخ البوتات مخفي بصريًا', present.honeypotVisible === false, String(present.honeypotVisible))

console.log('\n--- التحقق من طرف العميل ---')
await evaluate(SET_FIELD('#mj-p-name', 'سلمى منصور'))
await evaluate(SET_FIELD('#mj-p-org', 'حضانة البراعم'))
await evaluate(SET_FIELD('#mj-p-email', 'not-an-email'))
await evaluate(SET_FIELD('#mj-p-message', 'نريد ترخيص عرض جماعي داخل الفصل لعشرين طفلًا.'))
await evaluate(`document.querySelector('#partners form button[type=submit]').click()`)
await sleep(500)
const clientError = await evaluate(`document.querySelector('#partners .mj-field-error')?.textContent?.trim() ?? null`)
check('بريد غير صالح يُوقف الإرسال محليًا', Boolean(clientError), String(clientError))

console.log('\n--- إرسال حقيقي ---')
const stamp = Date.now()
const org = `حضانة البراعم ${stamp}`
const email = `salma.${stamp}@example.com`
await evaluate(SET_FIELD('#mj-p-kind', 'nursery'))
await evaluate(SET_FIELD('#mj-p-org', org))
await evaluate(SET_FIELD('#mj-p-email', email))
await evaluate(SET_FIELD('#mj-p-phone', '+20 100 111 2222'))
await evaluate(SET_FIELD('#mj-p-country', 'مصر'))
await evaluate(`document.querySelector('#partners form button[type=submit]').click()`)
await sleep(2500)

const success = await evaluate(`(() => {
  const done = document.querySelector('#partners .mj-partner-done');
  return {
    shown: Boolean(done),
    title: done?.querySelector('h3')?.textContent?.trim() ?? null,
    error: document.querySelector('#partners .mj-field-error')?.textContent?.trim() ?? null,
    role: done?.getAttribute('role') ?? null,
  };
})()`)
check('تظهر لوحة النجاح', success.shown, success.title ?? success.error ?? '—')
check('لوحة النجاح مُعلَنة لقارئ الشاشة', success.role === 'status', String(success.role))
await shoot('success')

console.log('\n--- الطلب وصل D1 ---')
const list = await (await fetch(`${API}/api/v1/admin/partnerships?search=${encodeURIComponent(String(stamp))}`)).json()
const row = list?.data?.[0]
check('الطلب موجود في مسار الإدارة', Boolean(row), `${list?.data?.length ?? 0} نتيجة`)
check('اسم الجهة العربي وصل سليمًا', row?.organization === org, String(row?.organization))
check('البريد وصل', row?.email === email, String(row?.email))
check('النوع من القائمة المنسدلة وصل', row?.kind === 'nursery', String(row?.kind))
check('الهاتف وصل', row?.phone === '+20 100 111 2222', String(row?.phone))
check('البلد العربي وصل سليمًا', row?.country === 'مصر', String(row?.country))
check('لغة الواجهة سُجّلت', ['ar', 'en', 'fr'].includes(row?.locale), String(row?.locale))
check('حقل الفخ لم يُحفظ كرابط', !row?.message?.includes('http'), '')

console.log('\n--- إعادة إرسال طلب آخر من اللوحة نفسها ---')
const again = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('#partners .mj-partner-done button')][0];
  if (!btn) return false;
  btn.click();
  return true;
})()`)
await sleep(600)
const backToForm = await evaluate(`Boolean(document.querySelector('#partners form.mj-partner-form'))`)
check('زر «إرسال طلب آخر» يعيد النموذج', again === true && backToForm === true, `${again} / ${backToForm}`)
const cleared = await evaluate(`document.querySelector('#mj-p-name')?.value ?? null`)
check('الحقول فُرِّغت بعد النجاح', cleared === '', JSON.stringify(cleared))

console.log('\n--- أخطاء الكونسول ---')
const relevant = consoleErrors.filter((entry) => !entry.includes('favicon'))
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
