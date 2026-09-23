import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'

const copy = {
  ar: {
    back: 'العودة للحملات',
    loading: 'جارٍ تحميل بيانات الحملة...',
    loadError: 'تعذر تحميل بيانات الحملة',
    overview: 'نظرة عامة',
    audience: 'الجمهور المستهدف',
    creative: 'المحتوى الإبداعي',
    schedule: 'الجدولة والمواعيد',
    delivery: 'سجل التسليم',
    experiment: 'التجربة والاختبار',
    analytics: 'التحليلات والمتابعة',
    history: 'السجل',
    channel: 'قناة التسليم',
    audienceEst: 'الجمهور المؤهل',
    deepLink: 'الرابط العميق',
    scheduleHint: 'المنطقة الزمنية: UTC — يُعرض كما أدخله المشرف',
    testSend: 'إرسال تجريبي',
    confirmSend: 'تأكيد الإرسال',
    channelHint: 'قناة معتمدة وموثوقة تقنياً',
    noDelivery: 'لا توجد سجلات تسليم بعد',
    noOpen: 'معدل الفتح غير متاح — لا تتبع وهمي بدون أحداث حقيقية',
    eligible: 'مؤهل',
    sent: 'تم الإرسال',
    delivered: 'تم التسليم',
    opened: 'تم الفتح',
    clicked: 'نقرة',
  },
  en: {
    back: 'Back to Campaigns',
    loading: 'Loading campaign...',
    loadError: 'Failed to load campaign',
    overview: 'Overview',
    audience: 'Target Audience',
    creative: 'Creative Asset',
    schedule: 'Schedule',
    delivery: 'Delivery Log',
    experiment: 'Experiment',
    analytics: 'Analytics',
    history: 'History',
    channel: 'Delivery Channel',
    audienceEst: 'Eligible Audience',
    deepLink: 'Deep Link',
    scheduleHint: 'Timezone: UTC — strictly as recorded',
    testSend: 'Test Send',
    confirmSend: 'Confirm Send',
    channelHint: 'Real delivery channel',
    noDelivery: 'No delivery logs recorded yet',
    noOpen: 'Open rate telemetry unavailable without verified events',
    eligible: 'Eligible',
    sent: 'Sent',
    delivered: 'Delivered',
    opened: 'Opened',
    clicked: 'Clicked',
  },
}

export function CampaignWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState<'overview' | 'audience' | 'creative' | 'schedule' | 'delivery' | 'analytics'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [testBusy, setTestBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.campaign(id)
      setData(r.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  const runTestSend = async () => {
    setTestBusy(true)
    try {
      await api.campaignTestSend(id)
      await load()
    } finally {
      setTestBusy(false)
    }
  }

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return <EmptyState title={text.loadError} description={id} />

  const aud = typeof data.audience_json === 'string' ? JSON.parse(data.audience_json) : data.audience_json ?? {}
  const cr = typeof data.creative_json === 'string' ? JSON.parse(data.creative_json) : data.creative_json ?? {}
  const isCompleted = data.status === 'completed'
  const isScheduled = data.status === 'scheduled'
  const isDeepLinkValid = data.deep_link?.startsWith('/') || data.deep_link?.startsWith('https://majarra.app')

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Studio Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: isCompleted
              ? 'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(14, 165, 233, 0.16) 50%, transparent 80%)'
              : isScheduled
              ? 'radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(168, 85, 247, 0.16) 50%, transparent 80%)'
              : 'radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, rgba(236, 72, 153, 0.16) 50%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <Link className="catalog-hero__eyebrow" to={adminPath('campaigns')}>
              ← {text.back}
            </Link>
            <span
              className="catalog-hero__status-badge"
              style={{
                borderColor: isCompleted ? '#10b981' : isScheduled ? '#f59e0b' : '#a855f7',
                color: isCompleted ? '#10b981' : isScheduled ? '#f59e0b' : '#a855f7',
              }}
            >
              <span
                className="status-dot-pulse"
                style={{ background: isCompleted ? '#10b981' : isScheduled ? '#f59e0b' : '#a855f7' }}
              />
              <span
                className={`account-status account-status--${isCompleted ? 'active' : isScheduled ? 'pending' : 'draft'}`}
                style={{ background: 'transparent', padding: 0 }}
              >
                {data.status}
              </span>
            </span>
          </div>
          <h1 className="catalog-hero__title">{data.name}</h1>
          <p className="catalog-hero__desc">
            {text.channel}: <span className="track-badge">{data.channel}</span> · {data.objective ?? ''} · ID: <code dir="ltr">{id}</code>
          </p>
        </div>

        <div className="catalog-hero__actions">
          <button
            className="button button--ghost"
            type="button"
            disabled={testBusy}
            onClick={() => void runTestSend()}
          >
            <Icon name="upload" size={15} />
            <span>{testBusy ? text.loading : text.testSend}</span>
          </button>
        </div>
      </section>

      {/* 2. Bento Glass KPI Cards */}
      <div className="hero-kpis">
        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Icon name="globe" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.channel}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 20 }}>
              {data.channel}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#3b82f6' }}>
              {text.channelHint}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <Icon name="users" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.audienceEst}</span>
            <div className="kpi-glass-card__num">{data.eligible_count ?? '—'}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#a855f7' }}>
              {locale === 'ar' ? 'مستخدم مؤهل وفق المعايير' : 'Eligible targets'}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="check" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.sent}</span>
            <div className="kpi-glass-card__num">{data.sent_count ?? '—'}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              {locale === 'ar' ? 'رسالة تم إرسالها' : 'Dispatched messages'}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Icon name="calendar" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.schedule}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 16 }}>
              {data.scheduled_at ? data.scheduled_at.slice(0, 10) : 'فوري (الآن)'}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#f59e0b' }}>
              {text.scheduleHint}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Studio Tabs */}
      <div className="catalog-control-strip" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: 1, padding: '4px 0' }}>
          {(['overview', 'audience', 'creative', 'schedule', 'delivery', 'analytics'] as const).map((t) => (
            <button
              key={t}
              className={`button ${tab === t ? 'button--primary' : 'button--ghost'} button--small`}
              onClick={() => setTab(t)}
            >
              {(text as any)[t] ?? t}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Tab Panels */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
            <h3 style={{ marginBottom: 16 }}>{text.overview}</h3>
            <dl style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: 14, columnGap: 12, margin: 0 }}>
              <dt style={{ color: 'var(--text-muted)' }}>{text.channel}</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>
                {data.channel} — <small>{text.channelHint}</small>
              </dd>

              <dt style={{ color: 'var(--text-muted)' }}>{text.audienceEst}</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>{data.eligible_count ?? '—'}</dd>

              <dt style={{ color: 'var(--text-muted)' }}>{text.deepLink}</dt>
              <dd style={{ margin: 0, fontWeight: 500 }} dir="ltr">
                {data.deep_link ?? '—'}
              </dd>

              <dt style={{ color: 'var(--text-muted)' }}>{locale === 'ar' ? 'مؤهل / مرسل / مستلم' : 'Funnel Counts'}</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>
                {data.eligible_count ?? '—'} / {data.sent_count ?? '—'} / {data.delivered_count ?? '—'}
              </dd>
            </dl>

            <div className="inline-alert inline-alert--info" style={{ marginTop: 16 }}>
              {text.noOpen} — {data.opened_count ?? '—'} opened
            </div>

            <div style={{ marginTop: 16 }}>
              <button
                className="button button--ghost button--small"
                type="button"
                disabled={testBusy}
                onClick={() => void runTestSend()}
              >
                <Icon name="upload" size={14} />
                <span>{testBusy ? text.loading : `${text.testSend} (جمهور الاختبار فقط)`}</span>
              </button>
            </div>
          </div>

          <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
            <h3 style={{ marginBottom: 16 }}>{locale === 'ar' ? 'الأهداف والروابط' : 'Goals & Links'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{locale === 'ar' ? 'الهدف' : 'Objective'}:</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 500 }}>{data.objective || '—'}</p>
              </div>

              <div>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text.deepLink}:</span>
                <div style={{ marginTop: 4 }}>
                  <code dir="ltr" style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)' }}>
                    {data.deep_link || '—'}
                  </code>
                  <span
                    className={`account-status account-status--${isDeepLinkValid ? 'active' : 'archived'}`}
                    style={{ marginInlineStart: 8 }}
                  >
                    {isDeepLinkValid ? '✓ صالح' : 'معطّل'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'audience' && (
        <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
          <h3 style={{ marginBottom: 14 }}>{text.audience}</h3>
          <pre
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: 16,
              borderRadius: 8,
              overflow: 'auto',
              color: '#38bdf8',
            }}
          >
            {JSON.stringify(aud, null, 2)}
          </pre>
          <p className="panel__note" style={{ marginTop: 12 }}>
            Privacy-safe: country/language/plan/age band aggregate only, no child-level targeting.
          </p>
        </div>
      )}

      {tab === 'creative' && (
        <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
          <h3 style={{ marginBottom: 14 }}>{text.creative}</h3>
          <pre
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: 16,
              borderRadius: 8,
              overflow: 'auto',
              color: '#a855f7',
            }}
          >
            {JSON.stringify(cr, null, 2)}
          </pre>
          <p style={{ marginTop: 14 }}>
            Deep link validated:{' '}
            <strong style={{ color: isDeepLinkValid ? '#10b981' : '#ef4444' }}>
              {isDeepLinkValid ? '✓ Valid' : 'Broken'}
            </strong>
          </p>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
          <h3 style={{ marginBottom: 14 }}>{text.schedule}</h3>
          <p>
            Scheduled: <strong>{data.scheduled_at ?? 'Now'}</strong> — {text.scheduleHint}
          </p>
          <p>
            Status: <span className="track-badge">{data.status}</span>
          </p>
        </div>
      )}

      {tab === 'delivery' && (
        <div className="panel panel--table" style={{ padding: 20, borderRadius: 12 }}>
          <h3 style={{ marginBottom: 14 }}>{text.delivery}</h3>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {(data.delivery_logs ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {text.noDelivery}
                    </td>
                  </tr>
                ) : (
                  (data.delivery_logs ?? []).map((l: any) => (
                    <tr key={l.id}>
                      <td>{l.channel}</td>
                      <td>
                        <span className="track-badge">{l.status}</span>
                      </td>
                      <td>{l.recipient_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
          <h3 style={{ marginBottom: 14 }}>{text.analytics}</h3>
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
              padding: 16,
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span>
              {text.eligible}: <strong>{data.eligible_count ?? '—'}</strong>
            </span>
            <span>→</span>
            <span>
              {text.sent}: <strong>{data.sent_count ?? '—'}</strong>
            </span>
            <span>→</span>
            <span>
              {text.delivered}: <strong>{data.delivered_count ?? '—'}</strong>
            </span>
            <span>→</span>
            <span>
              {text.opened}: <strong>{data.opened_count ?? '—'}</strong>
            </span>
          </div>
          <p className="panel__note" style={{ marginTop: 14 }}>
            No fake open/click if telemetry unavailable.
          </p>
        </div>
      )}
    </div>
  )
}
