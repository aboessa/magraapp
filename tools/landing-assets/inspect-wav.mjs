/**
 * يقرأ ترويسة ملف WAV لمعرفة الصيغة والمدة قبل نشره على الويب.
 * التشغيل: node tools/landing-assets/inspect-wav.mjs <path>
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) throw new Error('حدّد مسار الملف')

const buf = readFileSync(file)
const riff = buf.toString('ascii', 0, 4)
const wave = buf.toString('ascii', 8, 12)
if (riff !== 'RIFF' || wave !== 'WAVE') {
  console.log(`ليس ملف WAV صالحًا: ${riff}/${wave}`)
  process.exit(1)
}

let offset = 12
let fmt = null
let dataSize = 0
while (offset + 8 <= buf.length) {
  const id = buf.toString('ascii', offset, offset + 4)
  const size = buf.readUInt32LE(offset + 4)
  if (id === 'fmt ') {
    fmt = {
      audioFormat: buf.readUInt16LE(offset + 8),
      channels: buf.readUInt16LE(offset + 10),
      sampleRate: buf.readUInt32LE(offset + 12),
      byteRate: buf.readUInt32LE(offset + 16),
      bitsPerSample: buf.readUInt16LE(offset + 22),
    }
  } else if (id === 'data') {
    dataSize = size
  }
  offset += 8 + size + (size % 2)
}

const FORMATS = { 1: 'PCM', 3: 'IEEE float', 6: 'A-law', 7: 'mu-law', 65534: 'extensible' }
const duration = fmt && fmt.byteRate ? dataSize / fmt.byteRate : 0

console.log(`الملف: ${file}`)
console.log(`الحجم: ${(buf.length / 1024).toFixed(0)} KB`)
console.log(`الصيغة: ${FORMATS[fmt.audioFormat] ?? fmt.audioFormat}`)
console.log(`القنوات: ${fmt.channels} | معدل العينات: ${fmt.sampleRate} Hz | ${fmt.bitsPerSample} bit`)
console.log(`المدة: ${duration.toFixed(2)} ثانية`)
console.log(`\nالمدة المنسّقة: ${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, '0')}`)
