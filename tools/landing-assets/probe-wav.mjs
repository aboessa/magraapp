/**
 * ترويسة ملف السرد متعارضة: channels=1 لكن byteRate يوافق قناتين.
 * هذا السكربت يحسم الأمر إحصائيًا: لو كان الملف ستيريو متداخلًا
 * فالعينات الزوجية والفردية (يسار/يمين) سيكون بينها ارتباط شديد.
 *
 * التشغيل: node tools/landing-assets/probe-wav.mjs <path>
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const buf = readFileSync(file)

let offset = 12
const chunks = []
let fmtInfo = null
let data = null
while (offset + 8 <= buf.length) {
  const id = buf.toString('ascii', offset, offset + 4)
  const size = buf.readUInt32LE(offset + 4)
  chunks.push(`${id}(${size})`)
  if (id === 'fmt ') {
    fmtInfo = {
      chunkSize: size,
      audioFormat: buf.readUInt16LE(offset + 8),
      channels: buf.readUInt16LE(offset + 10),
      sampleRate: buf.readUInt32LE(offset + 12),
      byteRate: buf.readUInt32LE(offset + 16),
      blockAlign: buf.readUInt16LE(offset + 20),
      bitsPerSample: buf.readUInt16LE(offset + 22),
    }
  } else if (id === 'data') {
    data = buf.subarray(offset + 8, offset + 8 + size)
  }
  offset += 8 + size + (size % 2)
}

console.log(`المقاطع: ${chunks.join(', ')}`)
console.log('ترويسة fmt:', fmtInfo)

const expectedByteRate = fmtInfo.sampleRate * fmtInfo.channels * (fmtInfo.bitsPerSample / 8)
const expectedBlockAlign = fmtInfo.channels * (fmtInfo.bitsPerSample / 8)
console.log(`\nbyteRate المعلن ${fmtInfo.byteRate} | المتوقع من channels ${expectedByteRate}`)
console.log(`blockAlign المعلن ${fmtInfo.blockAlign} | المتوقع من channels ${expectedBlockAlign}`)

const totalSamples = data.length / 2
const samples = new Float32Array(totalSamples)
for (let i = 0; i < totalSamples; i += 1) samples[i] = data.readInt16LE(i * 2) / 32768

// ارتباط بيرسون بين العيّنات الزوجية والفردية
const n = Math.floor(totalSamples / 2)
let sumA = 0
let sumB = 0
for (let i = 0; i < n; i += 1) { sumA += samples[2 * i]; sumB += samples[2 * i + 1] }
const meanA = sumA / n
const meanB = sumB / n
let cov = 0
let varA = 0
let varB = 0
for (let i = 0; i < n; i += 1) {
  const a = samples[2 * i] - meanA
  const b = samples[2 * i + 1] - meanB
  cov += a * b
  varA += a * a
  varB += b * b
}
const correlation = cov / Math.sqrt(varA * varB)

// للمقارنة: ارتباط عيّنة بجارتها التالية في تفسير أحادي
let cov2 = 0
let v1 = 0
let v2 = 0
for (let i = 0; i < totalSamples - 1; i += 1) {
  const a = samples[i] - meanA
  const b = samples[i + 1] - meanA
  cov2 += a * b
  v1 += a * a
  v2 += b * b
}
const lag1 = cov2 / Math.sqrt(v1 * v2)

console.log(`\nارتباط الزوجي/الفردي (يفترض ستيريو): ${correlation.toFixed(4)}`)
console.log(`ارتباط الجار التالي (lag-1): ${lag1.toFixed(4)}`)
console.log(`\nإجمالي العيّنات: ${totalSamples}`)
console.log(`لو أحادي 24kHz → المدة ${(totalSamples / 24000).toFixed(2)} ث`)
console.log(`لو ستيريو 24kHz → المدة ${(totalSamples / 2 / 24000).toFixed(2)} ث`)
console.log(`لو أحادي 48kHz → المدة ${(totalSamples / 48000).toFixed(2)} ث`)

const verdict = fmtInfo.blockAlign === 4 || Math.abs(correlation) > 0.9
console.log(`\nالحكم: ${verdict ? 'ستيريو متداخل (قناتان)' : 'أحادي فعلًا'}`)
