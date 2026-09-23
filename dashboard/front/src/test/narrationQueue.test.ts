import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ‏`ADM-201`: طابور السرد يُبنى من بيانات حقيقية، لا من `Math.random()`.
 *
 * كانت `NarrationPage.tsx` تختلق الطابور كلَّه من مكتبة القصص:
 * مقدار السرد بقذفة عملة، وحالة الاعتماد بقذفة عملة، والنصّ بقالبٍ يُرسَل بعده
 * إلى `ttsPreview` كأنّه السطر الحقيقي، و`processing` عدّادًا محفورًا بـ1.
 *
 * وهذه شاشة حكمٍ تشغيليّ: مشغّلٌ يقرأ منها ما يُنتَج وما يُعتمَد. فاختبارٌ نصّيّ
 * على المصدر هو الحرس الصحيح هنا — العطل كان **وجود** هذه الأنماط، لا سلوكًا
 * يُحاكى ببناء شجرة.
 */

const SOURCE = readFileSync(
  join(process.cwd(), 'src', 'pages', 'NarrationPage.tsx'),
  'utf8',
)

/// الأسطر التنفيذية وحدها: التعليقات تصف ما أُزيل بالنصّ، فقراءتها مخالفةً
/// تجعل الحرس يمنع توثيق العطل الذي يحرس منه.
const CODE_LINES = SOURCE.split(/\r?\n/).filter((line) => {
  const trimmed = line.trimStart()
  return !trimmed.startsWith('//') && !trimmed.startsWith('///') && !trimmed.startsWith('*')
})
const CODE = CODE_LINES.join('\n')

describe('NarrationPage — طابور السرد', () => {
  it('لا يستعمل Math.random في أي سطر تنفيذيّ', () => {
    const offenders = CODE_LINES.filter((line) => /Math\.random/.test(line))
    expect(offenders).toEqual([])
  })

  it('لا يحفر مالكًا ولا موعدًا ولا نسخة نصّ', () => {
    expect(CODE).not.toMatch(/'Audio Team'/)
    expect(CODE).not.toMatch(/'2026-08-20'/)
    expect(CODE).not.toMatch(/sourceVersion:\s*'v6'/)
  })

  it('لا يحفر عدّاد «قيد التوليد»', () => {
    // `m.processing = 1` كان يُعلن مهمّةً جارية دائمًا، بلا قراءة حرفٍ من الخادم.
    expect(CODE).not.toMatch(/processing\s*=\s*[1-9]/)
  })

  it('لا يبني نصّ الصفحة بقالب', () => {
    // القالب كان `` `نص الصفحة ${p} من ${s.title_ar}` `` ثم يُرسَل إلى ttsPreview.
    expect(CODE).not.toMatch(/text:\s*`/)
  })

  it('يقرأ الصفحات من مساحة عمل القصة', () => {
    expect(CODE).toMatch(/api\.storyWorkspace\(/)
    // `allSettled` لا `all`: قصةٌ تفشل لا تُفرِغ الشاشة.
    expect(CODE).toMatch(/Promise\.allSettled\(/)
  })

  it('يشتقّ الحالة من حقول السرد الحقيقية', () => {
    expect(CODE).toMatch(/narration_asset_id/)
    expect(CODE).toMatch(/narration_ready/)
    // الفرق الذي يحرسه العقد نفسه: تصييرٌ آليّ ليس تسجيلًا معتمدًا.
    expect(CODE).toMatch(/narration_source === 'generated'/)
  })

  it('يرفض توليد صوت لنصّ فارغ', () => {
    expect(CODE).toMatch(/if \(!item\.text\.trim\(\)\)/)
  })

  it('يُعلن القصص التي تعذّر تحميلها بدل طابورٍ أقصر بلا سبب', () => {
    expect(CODE).toMatch(/workspaceErrors/)
    expect(CODE).toMatch(/role="alert"/)
  })
})
