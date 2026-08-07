import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PreferencesProvider } from './context/PreferencesContext'
import { LandingPage } from './pages/LandingPage'

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

function App() {
  return (
    <PreferencesProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminRoutes />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PreferencesProvider>
  )
}

export default App
