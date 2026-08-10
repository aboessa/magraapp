import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * تهيئة بيئة اختبارات الواجهة.
 *
 * ## ما يُهيَّأ هنا ولماذا
 *
 * - `cleanup` بعد كل اختبار: RTL تُركِّب في `document.body`، وبلا تفكيك يرى
 *   الاختبار التالي شجرة سابقة فيتضاعف كل استعلام `getBy*` ويفشل برسالة عن
 *   «عنصرين متطابقين» تُقرأ كخطأ في المكوّن لا في الإعداد.
 * - `matchMedia` و`URL.createObjectURL`: jsdom لا يوفّرهما، وأي مكوّن يعرض صورة
 *   أصل (MediaThumb) أو يستعلم تفضيل الحركة يرمي بلا هذين.
 * - `sessionStorage`/`localStorage` تُمسَح: العروض المحفوظة وتفضيلات الأعمدة
 *   تُخزَّن هناك، فتسريبها بين الاختبارات يجعل ترتيب التشغيل مهمًّا.
 */

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:test') as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
