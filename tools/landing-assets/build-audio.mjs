/**
 * يجهّز مقاطع السرد لصفحة الهبوط (عربي، إنجليزي، فرنسي).
 *
 * ترويسة كل الملفات الأصلية معطوبة: byteRate=96000 بينما القيمة الصحيحة
 * لمقطع أحادي 24000 Hz بعمق 16-bit هي 48000. أثبتنا المعدّل الحقيقي بقياس
 * التردد الأساسي للصوت (probe-pitch.mjs): عند 24kHz يقع داخل نطاق الكلام
 * البشري، وعند 48kHz كان سيقع فوق 440 Hz وهو غير منطقي.
 *
 * لذلك نحفظ العيّنات كما هي بلا إعادة تشكيل ولا خفض جودة، ونكتب ترويسة
 * صحيحة فقط. الملفات تُنزّل عند الضغط على التشغيل لا مع تحميل الصفحة.
 *
 * يُخرج أيضًا قمم الموجة الحقيقية لكل مقطع لرسم الشكل الموجي في الواجهة.
 *
 * التشغيل: node tools/landing-assets/build-audio.mjs
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const OUT_DIR = path.join(ROOT, 'dashboard/front/public/landing/audio')
const META_FILE = path.join(import.meta.dirname, 'audio-meta.json')
const BARS = 28

/** أسماء المخرجات لاتينية حتى لا تحتاج ترميز نسبة مئوية في الـURL */
const CLIPS = [
  { lang: 'ar', source: 'خرجت نهي.wav', out: 'story-nature-page4-ar.wav' },
  { lang: 'en', source: 'noha english.wav', out: 'story-nature-page4-en.wav' },
  { lang: 'fr', source: 'noha france.wav', out: 'story-nature-page4-fr.wav' },
]

function readWav(file) {
  const buf = readFileSync(file)
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('ليس ملف WAV صالحًا')
  }
  let offset = 12
  let fmt = null
  let data = null
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    if (id === 'fmt ') {
      fmt = {
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
  if (!fmt || !data) throw new Error('ترويسة WAV ناقصة')
  if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error(`صيغة غير مدعومة: ${fmt.audioFormat} / ${fmt.bitsPerSample}-bit`)
  }
  return { fmt, data }
}

/** يكتب WAV بترويسة متسقة مع القيم الممرَّرة */
function writeWav(file, pcm, sampleRate, channels) {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * channels * 2, 28)
  header.writeUInt16LE(channels * 2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(pcm.length, 40)
  writeFileSync(file, Buffer.concat([header, pcm]))
}

/** قمم الموجة مُطبَّعة بين 18% و100% حتى تبقى المقاطع الهادئة مرئية */
function waveformOf(data, channels, totalSamples) {
  const samples = new Float32Array(totalSamples)
  for (let i = 0; i < totalSamples; i += 1) {
    let sum = 0
    for (let c = 0; c < channels; c += 1) sum += data.readInt16LE((i * channels + c) * 2)
    samples[i] = sum / channels / 32768
  }
  const bucket = Math.floor(totalSamples / BARS)
  const peaks = []
  for (let b = 0; b < BARS; b += 1) {
    let localPeak = 0
    for (let i = b * bucket; i < (b + 1) * bucket && i < totalSamples; i += 1) {
      localPeak = Math.max(localPeak, Math.abs(samples[i]))
    }
    peaks.push(localPeak)
  }
  const maxPeak = Math.max(...peaks) || 1
  return peaks.map((p) => Math.round((0.18 + 0.82 * (p / maxPeak)) * 100))
}

mkdirSync(OUT_DIR, { recursive: true })
const meta = {}
let totalKb = 0

for (const clip of CLIPS) {
  const sourcePath = path.join(ROOT, 'audio', clip.source)
  const outPath = path.join(OUT_DIR, clip.out)
  const { fmt, data } = readWav(sourcePath)

  const expectedByteRate = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8)
  const headerBroken = fmt.byteRate !== expectedByteRate

  const totalSamples = data.length / 2 / fmt.channels
  const duration = totalSamples / fmt.sampleRate

  writeWav(outPath, data, fmt.sampleRate, fmt.channels)

  const kb = Math.round(statSync(outPath).size / 1024)
  totalKb += kb

  meta[clip.lang] = {
    src: `/landing/audio/${clip.out}`,
    durationSeconds: Number(duration.toFixed(2)),
    sampleRate: fmt.sampleRate,
    channels: fmt.channels,
    sizeKb: kb,
    waveform: waveformOf(data, fmt.channels, totalSamples),
  }

  console.log(`[${clip.lang}] ${clip.source}`)
  console.log(`   ${fmt.channels} قناة، ${fmt.sampleRate} Hz، ${fmt.bitsPerSample}-bit`
    + ` | ترويسة ${headerBroken ? `معطوبة (byteRate ${fmt.byteRate} بدل ${expectedByteRate}) وصُحّحت` : 'سليمة'}`)
  console.log(`   المدة ${duration.toFixed(2)} ث | ${kb} KB | ${meta[clip.lang].src}`)
}

writeFileSync(META_FILE, `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
console.log(`\nالإجمالي: ${totalKb} KB في ${CLIPS.length} مقاطع (تُنزّل عند الضغط فقط)`)
console.log(`البيانات الوصفية: ${path.relative(ROOT, META_FILE)}`)
