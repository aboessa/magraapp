import { describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { generateTemporaryPassword } from '../lib/tempPassword'

/**
 * ‏`SEC-205`: بيانات الاعتماد الإدارية لا تُولَّد من `Math.random()`.
 *
 * العطل الأصلي كان سطرين في `TeamAccessPage.tsx`:
 * `Math.random().toString(36).slice(2, 12) + 'Aa1!'` لإنشاء حساب إداريّ، ومثله
 * لإعادة تعيين كلمة مروره. و`Math.random()` مولّدٌ غير تشفيريّ، فمخرجاته قابلة
 * للتنبّؤ ممّن رأى قليلًا منها.
 *
 * والحرس الثاني أدناه هو الذي يمنع العودة: اختبارُ خصائصِ الدالّة وحده كان
 * سيبقى أخضر لو أضاف أحدهم مسار اعتمادٍ ثالثًا بـ`Math.random()`.
 */

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out)
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

describe('generateTemporaryPassword', () => {
  it('يُنتج الطول المُعلَن في كل مرّة', () => {
    // `Math.random().toString(36).slice(2, 12)` كان يُنتج أقصر من عشرة أحيانًا،
    // لأن سلسلة الأساس-36 لـ`double` قد تقصر. الطول الثابت جزءٌ من العقد.
    for (let index = 0; index < 200; index += 1) {
      expect(generateTemporaryPassword()).toHaveLength(24)
    }
  })

  it('يستوفي أربع فئات محارف', () => {
    for (let index = 0; index < 200; index += 1) {
      const password = generateTemporaryPassword()
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[0-9]/)
      expect(password).toMatch(/[!@#$%^&*\-_=+]/)
    }
  })

  it('لا يحتوي محارف مُلتبسة تُقرأ خطأً من الشاشة', () => {
    for (let index = 0; index < 200; index += 1) {
      expect(generateTemporaryPassword()).not.toMatch(/[0O1lI]/)
    }
  })

  it('لا يضع الفئات في مواضع ثابتة', () => {
    // اللاصقة الثابتة `'Aa1!'` في الآخر كانت تعني أن آخر أربعة محارف معروفة
    // شكلًا. الخلط يجعل موضع الرمز متغيّرًا، وهذا ما يُقاس هنا.
    const positions = new Set<number>()
    for (let index = 0; index < 400; index += 1) {
      positions.add(generateTemporaryPassword().search(/[!@#$%^&*\-_=+]/))
    }
    expect(positions.size).toBeGreaterThan(5)
  })

  it('لا يُعيد القيمة نفسها', () => {
    const seen = new Set<string>()
    for (let index = 0; index < 500; index += 1) seen.add(generateTemporaryPassword())
    expect(seen.size).toBe(500)
  })

  it('يرفض العمل بلا مولّد تشفيريّ بدل أن يهبط إلى بديلٍ أضعف', () => {
    // `vi.stubGlobal` لا الإسناد المباشر: `globalThis.crypto` في jsdom مُعرَّف
    // بـgetter غير قابل للكتابة، فالإسناد يفشل صامتًا ويبقى المولّد الحقيقي
    // قائمًا — أي أن الاختبار كان سيمرّ بلا أن يفحص شيئًا.
    vi.stubGlobal('crypto', undefined)
    try {
      expect(() => generateTemporaryPassword()).toThrow(/getRandomValues is unavailable/)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('مسارات الاعتماد في اللوحة', () => {
  it('لا مسار يولّد كلمة مرور من Math.random()', () => {
    const files = sourceFiles(join(process.cwd(), 'src'))
    // حرس عدم الخلاء: مِسحةٌ تجمع صفر ملف تُبلّغ نظافةً لا تعني شيئًا.
    expect(files.length).toBeGreaterThan(200)

    const offenders: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const [index, line] of source.split(/\r?\n/).entries()) {
        const trimmed = line.trimStart()
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
        if (!/Math\.random/.test(line)) continue
        // المخالفة هي `Math.random` **في سياق كلمة مرور أو اعتماد**، لا كل
        // استعمالٍ لها: مفاتيح React واختيار عنصرٍ عشوائيّ مقبولان.
        if (/password|secret|token|credential/i.test(line)) {
          offenders.push(`${file.replace(process.cwd(), '')}:${index + 1}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
