import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { ErrorState, LoadingState } from '../components/PageState'
import { api } from '../lib/api'
import { usePreferences } from '../context/preferences'
import { formatDate, formatMetric, metricAvailabilityProps } from '../lib/labels'
import { Link } from 'react-router-dom'
import type { StreamHealthData } from '../types/api'

export function StreamHealthPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  const [data, setData] = useState<StreamHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (isScan = false) => {
    if (isScan) setScanning(true)
    else setLoading(true)
    setError('')
    try {
      const res = await api.streamHealthScan()
      if (res.data) {
        setData(res.data)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (ar ? 'تعذر فحص صحة البث' : 'Failed to scan stream health'))
    } finally {
      setLoading(false)
      setScanning(false)
    }
  }, [ar])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState label={ar ? 'جاري فحص سلامة روابط البث وأصول الوسائط...' : 'Scanning stream health...'} />
  if (error && !data) return <ErrorState message={error} onRetry={() => load()} />

  return (
    <div className="admin-page-container space-y-6 pb-12" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>📡</span>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {ar ? 'رادار جودة البث وسلامة الأصول (Stream CDN Health)' : 'Stream CDN & Asset Integrity Radar'}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1" style={{ color: 'var(--text-secondary, #6b7280)', marginTop: '4px' }}>
            {ar
              ? 'مراقبة فورية لأداء شبكة التوزيع السحابية، واكتشاف الأصول المعطوبة أو الحلقات التي ينقصها فيديو أو غلاف'
              : 'Real-time CDN edge telemetry and automated broken asset detector'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => load(true)}
            disabled={scanning}
            style={{
              padding: '10px 18px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              cursor: scanning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
            }}
          >
            <Icon name="refresh" size={16} />
            {scanning ? (ar ? 'جاري الفحص الشامل...' : 'Scanning...') : (ar ? 'إعادة الفحص الآن' : 'Run Health Scan')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>{ar ? 'مؤشر سلامة البث العام' : 'Overall Health Score'}</div>
          <div
            {...metricAvailabilityProps(data?.health_score, locale)}
            style={{ fontSize: '32px', fontWeight: 'bold', color: data?.health_score == null ? 'var(--text-primary, #111827)' : data.health_score > 90 ? '#16a34a' : '#ea580c', marginTop: '6px' }}
          >
            {formatMetric(data?.health_score, locale, '%')}
          </div>
          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>
            {ar ? '✓ أداء ممتاز وشبكة مستقرة' : '✓ Excellent network health'}
          </div>
        </div>

        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>{ar ? 'زمن الاستجابة السحابي' : 'Edge CDN Latency'}</div>
          <div {...metricAvailabilityProps(data?.cdn_latency_ms, locale)} style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-primary, #111827)', marginTop: '6px' }}>
            {formatMetric(data?.cdn_latency_ms, locale, ' ms')}
          </div>
          <div {...metricAvailabilityProps(data?.edge_locations_active, locale)} style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            {data?.edge_locations_active == null
              ? '—'
              : ar ? `${formatMetric(data.edge_locations_active, locale)} نقطة توزيع عالمية` : `${formatMetric(data.edge_locations_active, locale)} active global edge PoPs`}
          </div>
        </div>

        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>{ar ? 'تنبيهات حرجة (Critical)' : 'Critical Issues'}</div>
          <div
            {...metricAvailabilityProps(data?.metrics.critical_issues, locale)}
            style={{ fontSize: '32px', fontWeight: 'bold', color: data?.metrics.critical_issues == null ? 'var(--text-primary, #111827)' : data.metrics.critical_issues === 0 ? '#16a34a' : '#dc2626', marginTop: '6px' }}
          >
            {formatMetric(data?.metrics.critical_issues, locale)}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            {ar ? 'محتوى منشور بلا صفحات أو أصول' : 'Empty published content'}
          </div>
        </div>

        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>{ar ? 'تحسينات موصى بها (Warnings)' : 'Optimization Warnings'}</div>
          <div {...metricAvailabilityProps(data?.metrics.warning_issues, locale)} style={{ fontSize: '32px', fontWeight: 'bold', color: '#d97706', marginTop: '6px' }}>
            {formatMetric(data?.metrics.warning_issues, locale)}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            {ar ? 'حلقات تحتاج صورة غلاف بدقة أعلى' : 'Missing thumbnails / metadata'}
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div style={{ padding: '24px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔍</span> {ar ? 'قائمة الفحص التفصيلية للمحتوى' : 'Integrity Inspection List'}
            </h2>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              {ar ? `آخر فحص: ${data?.scanned_at ? formatDate(data.scanned_at, locale) : 'الآن'}` : `Scanned: ${data?.scanned_at || 'Just now'}`}
            </div>
          </div>
        </div>

        {data?.issues && data.issues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#16a34a' }}>
            <span style={{ fontSize: '32px' }}>🎉</span>
            <div style={{ fontWeight: 'bold', fontSize: '16px', marginTop: '8px' }}>
              {ar ? 'رائع! لا توجد أي أصول معطوبة أو حلقات ناقصة في المنصة' : 'All content is 100% verified & healthy!'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: ar ? 'right' : 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontSize: '12px' }}>
                  <th style={{ padding: '12px' }}>{ar ? 'مستوى الخطورة' : 'Severity'}</th>
                  <th style={{ padding: '12px' }}>{ar ? 'المحتوى المتأثر' : 'Title'}</th>
                  <th style={{ padding: '12px' }}>{ar ? 'التشخيص والملاحظة' : 'Description'}</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>{ar ? 'الإجراء السريع' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {data?.issues.map((issue) => (
                  <tr key={issue.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          background: issue.severity === 'critical' ? '#fee2e2' : '#fef3c7',
                          color: issue.severity === 'critical' ? '#dc2626' : '#b45309',
                        }}
                      >
                        {issue.severity === 'critical' ? (ar ? 'حرج 🔴' : 'Critical') : (ar ? 'تنبيه 🟡' : 'Warning')}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text-primary, #111827)' }}>
                      {issue.title}
                    </td>
                    <td style={{ padding: '12px', color: '#4b5563', fontSize: '13px' }}>
                      {issue.description}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <Link
                        to={issue.action_url}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          textDecoration: 'none',
                        }}
                      >
                        {ar ? 'إصلاح الآن' : 'Fix now'} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
