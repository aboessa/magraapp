/**
 * يحسم معدّل العينات الحقيقي لملف السرد.
 *
 * الترويسة متعارضة: sampleRate=24000 لكن byteRate=96000 و blockAlign=2
 * وchannels=1، وهذه الثلاثة تتفق على 48000 Hz أحادي.
 * الحكم: نقيس التردد الأساسي للصوت البشري بالارتباط الذاتي على مقاطع
 * مجهورة. الكلام البشري يقع بين 75 و 300 Hz، فالمعدّل الصحيح هو الذي
 * يعطي ترددًا داخل هذا النطاق.
 *
 * التشغيل: node tools/landing-assets/probe-pitch.mjs <path>
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const buf = readFileSync(file)

let offset = 12
let data = null
while (offset + 8 <= buf.length) {
  const id = buf.toString('ascii', offset, offset + 4)
  const size = buf.readUInt32LE(offset + 4)
  if (id === 'data') data = buf.subarray(offset + 8, offset + 8 + size)
  offset += 8 + size + (size % 2)
}

const total = data.length / 2
const samples = new Float32Array(total)
for (let i = 0; i < total; i += 1) samples[i] = data.readInt16LE(i * 2) / 32768

/** يقدّر الدورة بالعيّنات عبر الارتباط الذاتي داخل نافذة */
function estimatePeriod(window, minLag, maxLag) {
  let best = 0
  let bestScore = -1
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let num = 0
    let den1 = 0
    let den2 = 0
    for (let i = 0; i + lag < window.length; i += 1) {
      num += window[i] * window[i + lag]
      den1 += window[i] * window[i]
      den2 += window[i + lag] * window[i + lag]
    }
    const score = num / (Math.sqrt(den1 * den2) || 1)
    if (score > bestScore) { bestScore = score; best = lag }
  }
  return { period: best, score: bestScore }
}

// نختار أعلى النوافذ طاقةً لأنها الأرجح أن تكون مجهورة
const WIN = 4096
const candidates = []
for (let start = 0; start + WIN < total; start += WIN) {
  let energy = 0
  for (let i = start; i < start + WIN; i += 1) energy += samples[i] * samples[i]
  candidates.push({ start, energy })
}
candidates.sort((a, b) => b.energy - a.energy)
const picked = candidates.slice(0, 6)

console.log('نوافذ مجهورة مختارة (أعلى طاقة):\n')
const results = []
for (const { start } of picked) {
  const window = samples.subarray(start, start + WIN)
  // نطاق البحث يغطي 60–350 Hz على أي من المعدّلين
  const { period, score } = estimatePeriod(window, 40, 800)
  if (period === 0) continue
  const f0at24k = 24000 / period
  const f0at48k = 48000 / period
  results.push({ period, score, f0at24k, f0at48k })
  console.log(`  دورة ${String(period).padStart(3)} عيّنة (تشابه ${score.toFixed(3)})`
    + `  →  عند 24kHz: ${f0at24k.toFixed(0)} Hz | عند 48kHz: ${f0at48k.toFixed(0)} Hz`)
}

const plausible = (f) => f >= 75 && f <= 320
const votes24 = results.filter((r) => plausible(r.f0at24k)).length
const votes48 = results.filter((r) => plausible(r.f0at48k)).length

console.log(`\nنوافذ ترددها منطقي للكلام البشري (75–320 Hz):`)
console.log(`  بافتراض 24000 Hz: ${votes24} من ${results.length}`)
console.log(`  بافتراض 48000 Hz: ${votes48} من ${results.length}`)

const trueRate = votes48 > votes24 ? 48000 : 24000
console.log(`\nالمعدّل الحقيقي المرجّح: ${trueRate} Hz`)
console.log(`المدة الصحيحة: ${(total / trueRate).toFixed(2)} ثانية`)
if (trueRate !== 24000) {
  console.log('\nتنبيه: ترويسة الملف تعلن 24000 Hz، فسيشغّله المتصفح بنصف السرعة')
  console.log('وبنبرة منخفضة. لا بد من تصحيح الترويسة قبل النشر.')
}
