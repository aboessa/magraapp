import { describe, expect, test } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * لا ملفَّ في اللوحة خارج فحص الأنواع (`ADM-105`).
 *
 * ## العلّة
 *
 * `tsc --noEmit` كان **أخضر وكاذبًا**: تسعة وعشرون ملفًا في `src/pages` تحمل
 * تعليمة تعطيل الفحص للملف كلّه، فالنتيجة تصف تسعًا وثمانين صفحة لا مئة وثماني
 * عشرة. وهي غالبًا أعقد الصفحات، أي الأحقّ بالفحص.
 *
 * وما أخفته لم يكن أسلوبًا: نداءٌ إلى الشبكة بمُعرَّف مُختلق تُهمَل نتيجته،
 * ونداءٌ آخر يُكرَّر ثلاثًا وتُهمَل نتيجتان، ومقارنة رقم بنصّ تجعل مسار ٩–١٢ يعرض
 * «لا نتائج» دائمًا، ورسالةُ خطأ غير موجودة تجعل الفشل يظهر كصفحة فارغة ناجحة.
 *
 * ## لماذا المطابقة على «التعليمة» لا على النصّ
 *
 * حرسٌ يبحث عن النصّ المجرّد يرصد **التعليقات التي تشرح العطل** — وهي مكتوبة في
 * ثلاثة من الملفات المُصلَحة. فتُقشَّر الشروح أو يُعاد كتابتها بالحيلة، ويبقى
 * الحرس. المطابقة هنا على الشكل الذي يفهمه TypeScript فقط: تعليقٌ **يبدأ**
 * بالتعليمة. والاسم نفسه مُركَّب من جزأين في هذا الملف لئلّا يرصد الحرس نفسه.
 *
 * ## و`@ts-expect-error` مسموحة عن قصد
 *
 * لأنها **تفشل عندما يزول الخطأ**، فتُنظّف نفسها ولا تتقادم صامتة. أمّا تعطيل
 * الملف كلّه أو تجاهل سطر فيبقى بعد أن يزول سببه بلا أن يُخبر أحدًا.
 */

const SRC = path.resolve(__dirname, '..')
const FILE_LEVEL = new RegExp(String.raw`(//|/\*)\s*@ts-` + 'nocheck')
const LINE_LEVEL = new RegExp(String.raw`(//|/\*)\s*@ts-` + 'ignore')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) { out.push(...sourceFiles(full)); continue }
    if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

const files = sourceFiles(SRC)

describe('تغطية فحص الأنواع', () => {
  test('القياس يجري على شجرة كاملة لا على ملف أو اثنين', () => {
    // حرسٌ يقيس صفرًا من صفر يمرّ دائمًا. هذا يمنع أن يمرّ الاختبار لأن الجمع فشل.
    expect(files.length).toBeGreaterThan(200)
  })

  test('لا ملف يعطّل الفحص عن نفسه كلّه', () => {
    const offenders = files
      .filter((file) => FILE_LEVEL.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file))
    expect(offenders).toEqual([])
  })

  test('ولا سطر يتجاهل خطأه بلا انتهاء صلاحية', () => {
    const offenders = files
      .filter((file) => LINE_LEVEL.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file))
    expect(offenders).toEqual([])
  })
})
