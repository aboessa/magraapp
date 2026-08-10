import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * إعداد اختبارات الواجهة، منفصل عن `vite.config.ts`.
 *
 * ## لماذا ملف مستقلّ
 *
 * `vite.config.ts` يحمل وسيط تطوير يوجّه `/api` إلى العامل المحلّي. حقن إعداد
 * الاختبار فيه يجعل أي تغيير في أحدهما يخصّ الآخر، وقد كان هذا المشروع بلا أي
 * مُشغِّل اختبارات واجهة حتى الآن — فبدء الإعداد نظيفًا أرخص من تفكيكه لاحقًا.
 *
 * ## jsdom لا متصفح حقيقي هنا
 *
 * هذه اختبارات وحدة وتكامل على المكوّنات: تُدار بالسرعة التي تجعلها تُشغَّل مع كل
 * تعديل. النقر الحقيقي في متصفح محقَّق منفصلًا بسكربت Playwright
 * (`test/browser/`) الذي يفتح Chromium على خادم تطوير فعلي — الاثنان يجيبان عن
 * سؤالين مختلفين ولا يُغني أحدهما عن الآخر.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // لا تُشمَل اختبارات المتصفح: تحتاج خادمًا يعمل، وتشغيلها ضمن الوحدة يجعل
    // فشل بيئة يظهر كفشل مكوّن.
    exclude: ['node_modules/**', 'dist/**', 'test/browser/**'],
    css: false,
    restoreMocks: true,
    clearMocks: true,
  },
})
