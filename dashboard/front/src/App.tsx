import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { PreferencesProvider } from './context/PreferencesContext'
import { LandingPage } from './pages/LandingPage'
import { ConstructionPage, MaintenancePage, NotFoundPage } from './pages/StatusPages'
import { initialLandingLocale, type LandingLocale } from './landing/i18n'
import { fetchSiteStatus, previewModeFromLocation, type SiteStatusResult } from './landing/siteModeApi'
import { hasAdminSession } from './lib/adminSession'
import { ADMIN_BASE } from './lib/adminPath'

// لوحة الإدارة حزمة منفصلة، فلا تُنزَّل مع صفحة الهبوط العامة
const AdminRoutes = lazy(() => import('./AdminRoutes'))

function AdminFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#090d1f',
        color: '#aab5d1',
        fontSize: 14,
      }}
      role="status"
      aria-live="polite"
    >
      جارٍ تحميل لوحة الإدارة…
    </div>
  )
}

/**
 * شاشة صامتة أثناء سؤال الخادم عن وضع الموقع.
 *
 * بلا نص ولا مؤشّر تحميل عن قصد: النداء يستغرق أجزاء من الثانية، وإظهار
 * «جارٍ التحميل» ثم استبداله فورًا وميض مزعج. الخلفية بلون الصفحة نفسه
 * فلا يرى الزائر انتقالًا.
 */
function ModeProbe() {
  return <div style={{ minHeight: '100vh', background: '#06091a' }} aria-hidden="true" />
}

/**
 * بوابة وضع الموقع.
 *
 * تسأل الخادم مرة واحدة عند التحميل، ثم تعرض صفحة الهبوط أو صفحة حالة.
 *
 * ## قاعدتان لا تُخالفان
 *
 * ١. **لوحة الإدارة لا تُحجب أبدًا.** المسارات تحت /admin تُركَّب خارج البوابة
 *    تمامًا. لو حجبها الوضع لصار «تحت الصيانة» بابًا مغلقًا بلا مفتاح: لا
 *    يمكن للمسؤول الدخول ليعيد الموقع مباشرًا، وهو الشيء الوحيد الذي يحتاجه
 *    في تلك اللحظة.
 *
 * ٢. **تعذّر معرفة الحالة يعرض صفحة الهبوط.** انقطاع شبكة عابر لا يجوز أن
 *    يُخفي الموقع. الوضع الحقيقي في D1 على أي حال، وهذه بوابة عرض لا صلاحيات.
 *
 * ٣. **المسؤول المُسجَّل يرى الموقع عاديًا.** من يملك مفتاح الإدارة في هذه
 *    الجلسة يتخطّى الحجب، فيراجع صفحة الهبوط قبل الإطلاق وأثناء الصيانة بلا
 *    حاجة لتبديل الوضع ذهابًا وإيابًا وتعريض الموقع للزوّار في الأثناء.
 */
function SiteGate() {
  const location = useLocation()
  const [result, setResult] = useState<SiteStatusResult | null>(null)
  const [locale] = useState<LandingLocale>(() => initialLandingLocale())

  // معاينة بلا حفظ: ?preview=maintenance يعرض التصميم دون تغيير أي إعداد
  const preview = previewModeFromLocation(location.search)

  /**
   * تجاوز المسؤول.
   *
   * تخطٍّ عرضيّ لا ثغرة أمنية: كل ما يفتحه هو صفحة الهبوط التسويقية، وهي
   * محتوى عام أصلًا سيراه الجميع بعد الإطلاق. البيانات الحقيقية تحرسها
   * ADMIN_API_KEY في الخادم ولا تتأثر بهذا الشرط إطلاقًا.
   */
  const isAdmin = hasAdminSession()

  useEffect(() => {
    // لا داعي لسؤال الخادم إن كان العرض محسومًا سلفًا
    if (preview || isAdmin) return
    const controller = new AbortController()
    void fetchSiteStatus(controller.signal).then(setResult)
    return () => controller.abort()
  }, [preview, isAdmin])

  // المعاينة أولًا حتى يتمكّن المسؤول من رؤية صفحات الحالة رغم تجاوزه
  if (preview) {
    if (preview === 'construction') return <ConstructionPage locale={locale} status={null} />
    if (preview === 'maintenance') return <MaintenancePage locale={locale} status={null} />
    return <LandingPage />
  }

  if (isAdmin) return <LandingPage />

  if (!result) return <ModeProbe />

  // فشل مفتوح: الموقع يظهر بدل أن يختفي عند تعذّر الوصول للـAPI
  if (result.state === 'unavailable') return <LandingPage />

  if (result.status.mode === 'construction') {
    return <ConstructionPage locale={locale} status={result.status} />
  }
  if (result.status.mode === 'maintenance') {
    return <MaintenancePage locale={locale} status={result.status} />
  }
  return <LandingPage />
}

/**
 * صفحة 404 حقيقية.
 *
 * كان المسار الشامل يُحوّل كل رابط مجهول إلى `/` بصمت، فيرى الزائر الصفحة
 * الرئيسية بلا تفسير ويظن أن الرابط صحيح. الأسوأ أن أخطاء الروابط تختفي
 * فلا تُكتشف. الآن يرى صفحة تشرح ما حدث وتقترح بدائل.
 */
function NotFoundRoute() {
  const [locale] = useState<LandingLocale>(() => initialLandingLocale())
  return <NotFoundPage locale={locale} />
}

function App() {
  return (
    <PreferencesProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SiteGate />} />
          {/* خارج البوابة عن قصد: انظر القاعدة ١ في SiteGate. */}
          <Route
            path={`${ADMIN_BASE}/*`}
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminRoutes />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </BrowserRouter>
    </PreferencesProvider>
  )
}

export default App
