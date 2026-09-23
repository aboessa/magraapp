import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { SupportFamilyEnvelope, SupportLiveDevices } from '../types/api'
import { SupportTickets } from '../components/SupportTickets'
import { Icon } from '../components/Icon'

const copy = {
  ar: {
    eyebrow: 'خدمة العملاء والعمليات المباشرة',
    title: 'مركز دعم العملاء وتشخيص الحسابات',
    lede: 'إدارة طابور التذاكر وتتبع التزامات SLA، مع إمكانية التحقق الحي والآمن من بيانات العائلات والأجهزة المسجلة والتراخيص.',
    queryLabel: 'معرّف الحساب (Family ID)',
    queryPlaceholder: 'مثال: fam_abc123 أو UUID الحساب…',
    search: 'استعلام فوري',
    searching: 'جارٍ الاستعلام والتحقق…',
    required: 'يرجى إدخال معرّف الحساب أولاً',
    notFound: 'لا يوجد حساب بهذا المعرّف',
    notFoundHint: 'تأكّد من صحة المعرّف المدخل. البحث بالبريد الإلكتروني غير مدعوم في هذا المنفذ لأسباب أمنية.',
    account: 'ملف العائلة',
    plan: 'الباقة',
    status: 'الحالة',
    childrenCount: 'الأطفال',
    devicesCount: 'الأجهزة المسجلة',
    childrenTitle: 'ملفات الأطفال المسجلة',
    devicesTitle: 'الأجهزة والجلسات الفعالة',
    entitlementsTitle: 'سجل الاشتراكات والاستحقاق التجاري',
    name: 'الاسم المستعار',
    track: 'المسار التعليمي',
    device: 'الجهاز',
    platform: 'نظام التشغيل',
    product: 'المنتج',
    none: 'لا شيء',
    noChildren: 'لا توجد ملفات أطفال مسجلة في هذا الحساب.',
    noDevices: 'لا توجد أجهزة مسجَّلة في قاعدة البيانات.',
    noEntitlements: 'لا توجد سجلات اشتراك أو استحقاق نشطة.',
    actionsTitle: 'السياسات الأمنية والعمليات التشغيلية',
    actionsHint: 'العمليات الحساسة (مثل إعادة تعيين PIN، سحب التراخيص، وإعادة مزامنة الاستحقاق) تُسجَّل وتُدار مباشرة داخل التذاكر لضمان التدقيق الأمني وحفظ مسار العمليات، ولا تُعرض كأزرار حرة لتفادي الأخطاء.',
    ticketsTab: 'طابور التذاكر والـ SLA',
    lookupTab: 'استعلام حساب العائلة والأجهزة',
    searchError: 'تعذر البحث عن بيانات الحساب',
    liveRead: 'قراءة حيّة من مصدر السلطة (FamilyState)',
    liveLoading: 'جارٍ الاتصال بـ FamilyState…',
    liveSource: 'المصدر: FamilyState (قراءة حية متزامنة من Durable Object)',
    projectionSource: 'المصدر: قاعدة بيانات D1 (إسقاط متزامن عبر طابور الرسائل)',
    liveError: 'تعذر الوصول لمصدر السلطة FamilyState في الوقت الحالي (وهذا لا يعني عدم وجود أجهزة).',
    revokeUnavailable: 'سحب الجهاز عملية مشفرة تتطلب جلسة الوالد، ولا تملك اللوحة صلاحية سحبها إدارياً بدون تفويض.',
    lastSeen: 'آخر ظهور',
    viewFamily360: 'عرض ملف العائلة الشامل 360',
    kpiQueue: 'طابور التذاكر المباشر',
    kpiLookup: 'استعلام العائلات 360',
    kpiLiveState: 'مصدر السلطة FamilyState',
    kpiAudited: 'عمليات مدققة ومؤمنة',
    activeSessions: 'جلسات نشطة',
    allStatuses: 'كل الحالات',
    systemBeacon: 'مركز عمليات الدعم والـ SLA',
    beaconSub: 'تتبع زمني مؤتمت للاستجابة والحل',
    copyId: 'نسخ المعرّف',
    copied: 'تم النسخ!',
  },
  en: {
    eyebrow: 'Customer Support & Operations',
    title: 'Support Center & Family Diagnostics',
    lede: 'Manage ticket queues and track SLA compliance, with real-time audited inspection of family accounts, hardware, and entitlements.',
    queryLabel: 'Account ID (Family ID)',
    queryPlaceholder: 'e.g. fam_abc123 or UUID…',
    search: 'Instant Lookup',
    searching: 'Querying and verifying…',
    required: 'Please enter an account ID',
    notFound: 'No account found with that ID',
    notFoundHint: 'Double check the Family ID. Searching by email is not supported for security reasons.',
    account: 'Family Account',
    plan: 'Plan',
    status: 'Status',
    childrenCount: 'Children',
    devicesCount: 'Registered Devices',
    childrenTitle: 'Child Profiles',
    devicesTitle: 'Hardware & Active Sessions',
    entitlementsTitle: 'Commercial Entitlements & Subscriptions',
    name: 'Nickname',
    track: 'Track',
    device: 'Device',
    platform: 'Platform',
    product: 'Product',
    none: 'None',
    noChildren: 'No child profiles registered for this account.',
    noDevices: 'No registered devices in the database.',
    noEntitlements: 'No active entitlement or subscription records found.',
    actionsTitle: 'Security Policy & Operational Auditing',
    actionsHint: 'Sensitive operational actions (such as PIN reset, hardware revoke, and purchase sync) are executed and audited directly inside tickets with context and trace logs.',
    ticketsTab: 'Tickets Queue & SLA',
    lookupTab: 'Family & Hardware Lookup',
    searchError: 'Account search failed',
    liveRead: 'Live Read from Authority (FamilyState)',
    liveLoading: 'Connecting to FamilyState…',
    liveSource: 'Source: FamilyState (Live Synchronous Durable Object)',
    projectionSource: 'Source: D1 Database (Queue-fed projection)',
    liveError: 'FamilyState authority is temporarily unreachable — this does not mean zero devices.',
    revokeUnavailable: 'Revoking a device is a parent-session operation and cannot be forced without parent authorization.',
    lastSeen: 'Last seen',
    viewFamily360: 'Open Full Family 360 Profile',
    kpiQueue: 'Live Support Queue',
    kpiLookup: 'Family 360 Diagnostics',
    kpiLiveState: 'FamilyState Authority',
    kpiAudited: 'Audited & Governed Ops',
    activeSessions: 'Active Sessions',
    allStatuses: 'All Statuses',
    systemBeacon: 'Support & SLA Operations Center',
    beaconSub: 'Automated resolution and response tracking',
    copyId: 'Copy ID',
    copied: 'Copied!',
  },
}

export function SupportCenterPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']

  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<SupportFamilyEnvelope | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<'tickets' | 'lookup'>('tickets')
  const [live, setLive] = useState<SupportLiveDevices | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState('')
  const [copiedId, setCopiedId] = useState(false)

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const search = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    const value = query.trim()
    if (!value) {
      setError(text.required)
      return
    }

    setLoading(true)
    setError('')
    setNotFound(false)
    setFamily(null)
    setLive(null)
    setLiveError('')
    try {
      const response = await api.supportFamily(value)
      setFamily(response.data)
    } catch (caught) {
      const status = (caught as { status?: number } | null)?.status
      if (status === 404) {
        setNotFound(true)
      } else {
        setError(caught instanceof Error ? caught.message : text.searchError)
      }
    } finally {
      setLoading(false)
    }
  }, [query, text.required, text.searchError])

  const loadLiveDevices = useCallback(async () => {
    const id = family?.family?.parent_id
    if (!id) return
    setLiveLoading(true)
    setLiveError('')
    try {
      const response = await api.supportFamilyDevices(id)
      setLive(response.data)
    } catch (caught) {
      setLive(null)
      setLiveError(caught instanceof Error ? caught.message : text.liveError)
    } finally {
      setLiveLoading(false)
    }
  }, [family, text.liveError])

  const account = family?.family ?? null

  return (
    <div className="content-studio-root">
      {/* 1. Master Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className="status-beacon__dot status-beacon__dot--rose" />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">{text.systemBeacon}</span>
              <span className="status-beacon__sub">{text.beaconSub}</span>
            </div>
          </div>

          <div className="filter-pill-group" style={{ marginInlineStart: 12 }}>
            <button
              type="button"
              className={`filter-pill ${tab === 'tickets' ? 'filter-pill--active' : ''}`}
              onClick={() => setTab('tickets')}
            >
              <Icon name="chat" size={13} />
              <span>{text.ticketsTab}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${tab === 'lookup' ? 'filter-pill--active' : ''}`}
              onClick={() => setTab('lookup')}
            >
              <Icon name="search" size={13} />
              <span>{text.lookupTab}</span>
            </button>
          </div>
        </div>

        <div className="commercial-command-strip__right">
          {account && (
            <Link
              to={adminPath(`customers/${account.parent_id}`)}
              className="button button--secondary button--small"
              style={{ textDecoration: 'none' }}
            >
              <Icon name="parents" size={14} />
              <span>{text.viewFamily360}</span>
            </Link>
          )}
        </div>
      </section>

      {/* 2. Executive Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, rgba(14, 165, 233, 0.16) 50%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#ef4444' }} />
              {tab === 'tickets' ? 'SLA Queue Active' : 'Family 360 Diagnostics Active'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Bento Live Metrics Matrix */}
      <div className="commercial-bento-grid">
        <div
          className="commercial-bento-card commercial-bento-card--rose"
          onClick={() => setTab('tickets')}
          style={{ cursor: 'pointer', outline: tab === 'tickets' ? '2px solid #ef4444' : undefined }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.kpiQueue}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="chat" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">SLA Queue</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              <Icon name="clock" size={12} /> تتبع زمني للمحادثات
            </span>
          </div>
        </div>

        <div
          className="commercial-bento-card commercial-bento-card--indigo"
          onClick={() => setTab('lookup')}
          style={{ cursor: 'pointer', outline: tab === 'lookup' ? '2px solid #6366f1' : undefined }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.kpiLookup}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="search" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{account ? 'حساب محدد' : 'جاهز للبحث'}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              استعلام فوري ومباشر
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.kpiLiveState}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="devices" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">Durable Object</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              <Icon name="check" size={12} /> تزامن ومزامنة حية
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.kpiAudited}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="objectives" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">100% Governed</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              تسجيل تدقيقي لكل إجراء
            </span>
          </div>
        </div>
      </div>

      {/* 4. Tab 1: Live Support Tickets Queue */}
      {tab === 'tickets' && (
        <section style={{ marginTop: 24 }}>
          <SupportTickets />
        </section>
      )}

      {/* 5. Tab 2: Family & Hardware Diagnostic Lookup */}
      {tab === 'lookup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>
          {/* Diagnostic Search Console */}
          <section
            style={{
              padding: 24,
              borderRadius: 16,
              background: 'var(--surface-1)',
              border: '1px solid var(--cs-glass-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <form onSubmit={search}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                    {text.lookupTab}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                    أدخل معرّف العائلة (Family ID) للتحقق الفوري من الأطفال، الأجهزة، وتراخيص الاستحقاق الفعلية.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <input
                      type="text"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={text.queryPlaceholder}
                      dir="ltr"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--cs-glass-border)',
                        color: 'var(--text)',
                        fontSize: 14,
                        outline: 'none',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                  <button
                    className="button button--primary"
                    type="submit"
                    disabled={loading}
                    style={{ minWidth: 150, height: 44 }}
                  >
                    <Icon name="search" size={15} />
                    <span>{loading ? text.searching : text.search}</span>
                  </button>
                </div>

                {error ? (
                  <p className="form-error" role="alert" style={{ margin: 0 }}>
                    {error}
                  </p>
                ) : null}
              </div>
            </form>
          </section>

          {loading && <LoadingState />}

          {notFound && (
            <EmptyState title={text.notFound} description={text.notFoundHint} />
          )}

          {account && (
            <>
              {/* Family Dossier Overview Card */}
              <section
                style={{
                  padding: 24,
                  borderRadius: 16,
                  background: 'var(--surface-1)',
                  border: '1px solid var(--cs-glass-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 18,
                      background: 'rgba(14, 165, 233, 0.15)',
                      color: '#0ea5e9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(14, 165, 233, 0.3)',
                      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)',
                    }}
                  >
                    <Icon name="parents" size={28} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{text.account}:</span>
                      <div className="token-copy-box" style={{ padding: '3px 8px' }}>
                        <code style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700 }}>
                          {String(account.parent_id ?? '—')}
                        </code>
                        <button
                          className="button button--ghost button--small"
                          onClick={() => copyToClipboard(String(account.parent_id ?? ''))}
                          style={{ padding: '2px 6px', fontSize: 10 }}
                        >
                          {copiedId ? text.copied : text.copyId}
                        </button>
                      </div>
                      <span className={`plan-badge plan-badge--${String(account.plan ?? 'free')}`} style={{ fontSize: 11, fontWeight: 800 }}>
                        {String(account.plan ?? 'free')}
                      </span>
                      <span className={`account-status account-status--${account.status === 'active' ? 'active' : 'archived'}`}>
                        {String(account.status ?? '—')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
                      <span>
                        <strong style={{ color: 'var(--text)' }}>{(family?.children ?? []).length}</strong> {text.childrenCount}
                      </span>
                      <span>•</span>
                      <span>
                        <strong style={{ color: 'var(--text)' }}>{(family?.devices ?? []).length}</strong> {text.devicesCount}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  to={adminPath(`customers/${account.parent_id}`)}
                  className="button button--secondary"
                  style={{ gap: 8, textDecoration: 'none' }}
                >
                  <Icon name="parents" size={16} />
                  <span>{text.viewFamily360}</span>
                </Link>
              </section>

              {/* 2-Column Bento Diagnostics: Children & Devices */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
                {/* Children Inspection Panel */}
                <section
                  style={{
                    padding: 20,
                    borderRadius: 16,
                    background: 'var(--surface-1)',
                    border: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: 'rgba(168, 85, 247, 0.15)',
                          color: '#a855f7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="children" size={18} />
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{text.childrenTitle}</h3>
                    </div>
                    <span className="badge-count">{(family?.children ?? []).length}</span>
                  </div>

                  {(family?.children ?? []).length ? (
                    <div className="table-scroll" tabIndex={0}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>{text.name}</th>
                            <th>{text.track}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {family!.children.map((child) => (
                            <tr key={child.child_id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      background: 'rgba(168, 85, 247, 0.2)',
                                      color: '#a855f7',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 12,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {(child.nickname || 'طفل')[0]}
                                  </div>
                                  <span className="table-primary">{child.nickname ?? '—'}</span>
                                </div>
                              </td>
                              <td>
                                {child.age_track ? (
                                  <span className={`track-badge track-badge--${child.age_track}`}>{child.age_track}</span>
                                ) : (
                                  <span className="table-secondary">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="table-secondary" style={{ padding: 14, textAlign: 'center' }}>
                      {text.noChildren}
                    </p>
                  )}
                </section>

                {/* Devices Diagnostic Panel with Live Read Authority */}
                <section
                  style={{
                    padding: 20,
                    borderRadius: 16,
                    background: 'var(--surface-1)',
                    border: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: 'rgba(14, 165, 233, 0.15)',
                          color: '#0ea5e9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="devices" size={18} />
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{text.devicesTitle}</h3>
                    </div>

                    <button
                      type="button"
                      className="button button--secondary button--small"
                      disabled={liveLoading || !family}
                      onClick={() => void loadLiveDevices()}
                      style={{ gap: 6 }}
                    >
                      <Icon name="refresh" size={13} />
                      <span>{liveLoading ? text.liveLoading : text.liveRead}</span>
                    </button>
                  </div>

                  {liveError && (
                    <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: 12 }}>
                      {liveError}
                    </div>
                  )}

                  {live && (
                    <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <p className="readiness-note" style={{ margin: '0 0 8px', color: '#10b981', fontWeight: 700 }}>
                        {text.liveSource} · {live.authority}
                      </p>
                      <div className="table-scroll" tabIndex={0}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>{text.device}</th>
                              <th>{text.platform}</th>
                              <th>{text.status}</th>
                              <th>{text.lastSeen}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {live.devices.length ? (
                              live.devices.map((device) => (
                                <tr key={device.id}>
                                  <td><span className="table-primary">{device.display_name || device.id}</span></td>
                                  <td>{device.platform ?? '—'}</td>
                                  <td>
                                    <span className={`account-status account-status--${device.status === 'active' ? 'active' : 'archived'}`}>
                                      {device.status}
                                    </span>
                                  </td>
                                  <td dir="ltr">
                                    {device.last_seen_at
                                      ? new Date(Number(device.last_seen_at)).toISOString().slice(0, 16).replace('T', ' ')
                                      : '—'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4}><span className="table-secondary">{text.noDevices}</span></td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <p className="readiness-note" style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                        {text.revokeUnavailable}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="readiness-note" style={{ margin: '0 0 8px' }}>{text.projectionSource}</p>
                    {(family?.devices ?? []).length ? (
                      <div className="table-scroll" tabIndex={0}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>{text.device}</th>
                              <th>{text.platform}</th>
                              <th>{text.status}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {family!.devices.map((device) => (
                              <tr key={device.id}>
                                <td><span className="table-primary">{device.display_name || device.id}</span></td>
                                <td>{device.platform ?? '—'}</td>
                                <td>
                                  <span className={`account-status account-status--${device.status === 'active' ? 'active' : 'archived'}`}>
                                    {device.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="table-secondary" style={{ padding: 14, textAlign: 'center' }}>
                        {text.noDevices}
                      </p>
                    )}
                  </div>
                </section>
              </div>

              {/* Commercial Entitlements Panel */}
              <section
                style={{
                  padding: 20,
                  borderRadius: 16,
                  background: 'var(--surface-1)',
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="subscriptions" size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{text.entitlementsTitle}</h3>
                </div>

                {(family?.entitlements ?? []).length ? (
                  <div className="table-scroll" tabIndex={0}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{text.product}</th>
                          <th>{text.plan}</th>
                          <th>{text.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {family!.entitlements.map((entry, index) => (
                          <tr key={`${entry.product_id}-${index}`}>
                            <td><span className="table-primary" dir="ltr">{entry.product_id}</span></td>
                            <td>
                              <span className="plan-badge plan-badge--pro">{entry.plan}</span>
                            </td>
                            <td>
                              <span className="track-badge">{entry.entitlement_status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="table-secondary" style={{ padding: 14, textAlign: 'center' }}>
                    {text.noEntitlements}
                  </p>
                )}
              </section>

              {/* Security & Auditing Policies Banner */}
              <div
                style={{
                  padding: 18,
                  borderRadius: 16,
                  background: 'var(--surface-1)',
                  border: '1px solid var(--cs-glass-border)',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ color: '#f59e0b', marginTop: 2 }}>
                  <Icon name="warning" size={20} />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: 14, marginBottom: 4, color: 'var(--text)' }}>
                    {text.actionsTitle}
                  </strong>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    {text.actionsHint}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
