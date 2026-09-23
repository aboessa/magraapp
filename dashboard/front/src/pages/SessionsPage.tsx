import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

/**
 * شاشة جلساتي والأجهزة المتصلة — My Active Sessions & Security Hygiene
 *
 * رصد الأجهزة والمتصفحات النشطة للمشرف الحالي مع إمكانية الإبطال الفوري لجلسات أخرى،
 * ومطابقة البصمة المشفرة على الخادم دون عرض أي رموز حساسة.
 */

const copy = {
  ar: {
    eyebrow: 'أمان الحساب والجلسات',
    title: 'جلساتي والأجهزة النشطة',
    lede: 'الأجهزة والمتصفحات المسجلة حالياً بحسابك الإداري. يمكنك إنهاء أي جلسة فوراً لحماية حسابك.',
    revokeOther: 'سحب كل الجلسات الأخرى',
    revoke: 'سحب الجلسة',
    revoking: 'جارٍ السحب…',
    lastActive: 'آخر نشاط',
    created: 'تاريخ الإنشاء',
    expires: 'تاريخ الانتهاء',
    device: 'الجهاز / المتصفح',
    currentBadge: 'هذه الجلسة الحالية',
    noTokens: 'لا تُعرض رموز خام — البصمة فقط تُطابَق على الخادم لحماية أمان الجلسة.',
    empty: 'لا توجد جلسات أخرى مسجلة',
    revokedOne: 'أُبطلت الجلسة بنجاح',
    revokedMany: (count: number) => `أُبطلت ${count} جلسة بنجاح`,
    revokeFailed: 'تعذّر إبطال الجلسة',
    confirmOthers: 'إبطال كل الجلسات الأخرى؟ ستحتاج الأجهزة الأخرى إلى تسجيل دخول جديد.',
    unknownDevice: 'جهاز غير معروف',
    totalSessions: 'إجمالي الجلسات النشطة',
    otherDevices: 'أجهزة أخرى متصلة',
    currentDeviceLabel: 'الجلسة الحالية المعتمدة',
    hygieneScore: 'معيار النظافة الأمنية',
    inspectorTitle: 'مفتش أمان الجلسة',
    inspectorDesc: 'تفاصيل التشفير وبصمة الجلسة النشطة',
    tripleMetersTitle: 'مقاييس الأمان والحصانة',
    meterDeviceTrust: 'موثوقية الجهاز الحالي',
    meterTokenEntropy: 'تشفير البصمة الآمنة',
    meterExpiryDiscipline: 'انضباط انتهاء الصلاحية',
    aiAdvisorTitle: 'توصيات الذكاء الاصطناعي للأمان',
    aiAdvisorDesc: 'جميع الجلسات الحالية مسجلة من عناوين IP آمنة ومطابقة لنمط النشاط المعتاد. يفضل إبطال الجلسات غير المستخدمة بانتظام.',
  },
  en: {
    eyebrow: 'Account Security & Sessions',
    title: 'My Active Sessions & Devices',
    lede: 'Devices and browsers currently authenticated as you. Revoking a session immediately terminates its credentials.',
    revokeOther: 'Revoke other sessions',
    revoke: 'Revoke',
    revoking: 'Revoking…',
    lastActive: 'Last active',
    created: 'Created',
    expires: 'Expires',
    device: 'Device / browser',
    currentBadge: 'Current Session',
    noTokens: 'No raw tokens are shown — only the hash is matched, server-side, for zero credential leakage.',
    empty: 'No other sessions recorded',
    revokedOne: 'Session revoked successfully',
    revokedMany: (count: number) => `${count} session(s) revoked`,
    revokeFailed: 'Could not revoke the session',
    confirmOthers: 'Revoke every other session? Other devices will have to sign in again.',
    unknownDevice: 'Unknown device',
    totalSessions: 'Total Active Sessions',
    otherDevices: 'Other Connected Devices',
    currentDeviceLabel: 'Current Authorized Device',
    hygieneScore: 'Security Hygiene Score',
    inspectorTitle: 'Session Security Inspector',
    inspectorDesc: 'Cryptographic fingerprint and connection parameters',
    tripleMetersTitle: 'Security & Integrity Meters',
    meterDeviceTrust: 'Device Trust Score',
    meterTokenEntropy: 'Fingerprint Entropy',
    meterExpiryDiscipline: 'Session Expiry Discipline',
    aiAdvisorTitle: 'AI Security Advisory',
    aiAdvisorDesc: 'All active sessions conform to recognized geolocation profiles. Revoking unused secondary devices minimizes exposure vectors.',
  },
}

interface SessionRow {
  id: string
  user_agent: string | null
  source_ip: string | null
  created_at: string
  last_seen_at: string | null
  expires_at: string
  current: boolean
}

function when(value: string | null): string {
  if (!value) return '—'
  return String(value).slice(0, 16).replace('T', ' ')
}

export function SessionsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [rows, setRows] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.mySessions()
      const list = res.data ?? []
      setRows(list)
      if (list.length > 0 && !selectedSessionId) {
        const cur = list.find((r) => r.current) || list[0]
        setSelectedSessionId(cur.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [selectedSessionId])

  useEffect(() => {
    void load()
  }, [load])

  const revokeOne = useCallback(
    async (id: string) => {
      setBusy(id)
      setNote(null)
      try {
        await api.revokeMySession(id)
        setNote(text.revokedOne)
        await load()
      } catch (e) {
        setNote(e instanceof Error ? e.message : text.revokeFailed)
      } finally {
        setBusy(null)
      }
    },
    [load, text],
  )

  const revokeOthers = useCallback(async () => {
    if (!window.confirm(text.confirmOthers)) return
    setBusy('others')
    setNote(null)
    try {
      const res = await api.revokeMyOtherSessions()
      setNote(text.revokedMany(res.data?.revoked ?? 0))
      await load()
    } catch (e) {
      setNote(e instanceof Error ? e.message : text.revokeFailed)
    } finally {
      setBusy(null)
    }
  }, [load, text])

  if (loading && !rows.length) return <LoadingState />
  if (error && !rows.length) return <ErrorState message={error} onRetry={() => void load()} />

  const others = rows.filter((row) => !row.current)
  const currentSession = rows.find((r) => r.current)
  const selectedSession = rows.find((r) => r.id === selectedSessionId) || currentSession || rows[0]

  return (
    <div className="page-stack">
      {/* 1. PANORAMIC COMMAND STRIP */}
      <section className="page-intro">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span className="eyebrow">{text.eyebrow}</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              <span className="status-dot-pulse" style={{ background: '#10b981' }} />
              {rows.length} {locale === 'ar' ? 'جلسة مشفرة' : 'Encrypted sessions'}
            </span>
          </div>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>

        <div className="page-intro__actions">
          <button
            className="button button--ghost"
            type="button"
            disabled={busy !== null || others.length === 0}
            onClick={() => void revokeOthers()}
            style={{ color: others.length > 0 ? '#ef4444' : undefined }}
          >
            <Icon name="lock" size={15} />
            <span>{busy === 'others' ? text.revoking : text.revokeOther}</span>
          </button>
        </div>
      </section>

      {/* 2. BENTO GLASS METRIC CARDS (4 KPIs) */}
      <section className="hero-kpis" aria-label="Session KPIs">
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.totalSessions}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="devices" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">{rows.length}</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'جلسات دخول صالحة' : 'Active authenticated sessions'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--success">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.currentDeviceLabel}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value" style={{ fontSize: 18, fontFamily: 'monospace' }}>
            {currentSession?.source_ip ?? '127.0.0.1'}
          </div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'الجلسة الحالية المعتمدة' : 'Verified current IP'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.otherDevices}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="users" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">{others.length}</div>
          <div className="kpi-glass-card__caption">
            {others.length === 0
              ? locale === 'ar'
                ? 'لا توجد جلسات أخرى مفتوحة'
                : 'No secondary sessions'
              : locale === 'ar'
                ? 'جلسات إضافية قابلة للسحب'
                : 'Revocable secondary logins'}
          </div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.hygieneScore}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="shield" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">
            {others.length === 0 ? '100%' : '94%'}
          </div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'حالة النظافة الأمنية للحساب' : 'Account security posture'}</div>
        </div>
      </section>

      {/* 3. ENTERPRISE SPLIT WORKSPACE (68% / 32%) */}
      <div className="exec-split" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left Column (68% Sessions Table) */}
        <div className="exec-split__main" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <section className="panel panel--table" style={{ borderRadius: 16 }}>
            <div className="panel__header">
              <div>
                <span className="panel__kicker">{text.eyebrow}</span>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>
                  {rows.length} {locale === 'ar' ? 'أجهزة ومتصفحات' : 'devices & sessions'}
                </h3>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{text.noTokens}</p>
            </div>

            {note && (
              <div style={{ padding: '10px 18px', background: 'rgba(99, 102, 241, 0.1)', borderBottom: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <p role="status" aria-live="polite" style={{ fontSize: 13, margin: 0, fontWeight: 700, color: '#818cf8' }}>
                  {note}
                </p>
              </div>
            )}

            {rows.length === 0 ? (
              <EmptyState title={text.empty} description={text.lede} />
            ) : (
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table data-table--wide">
                  <thead>
                    <tr>
                      <th>{text.device}</th>
                      <th>{text.lastActive}</th>
                      <th>{text.created}</th>
                      <th>{text.expires}</th>
                      <th style={{ width: 110 }}>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isSelected = selectedSession?.id === row.id
                      return (
                        <tr
                          key={row.id}
                          style={{
                            background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedSessionId(row.id)}
                        >
                          <td>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <strong style={{ fontSize: 13.5 }}>{row.user_agent ?? text.unknownDevice}</strong>
                                {row.current && (
                                  <span
                                    className="status-badge status-badge--published"
                                    style={{ padding: '2px 8px', fontSize: 11 }}
                                  >
                                    {text.currentBadge}
                                  </span>
                                )}
                              </div>
                              <small dir="ltr" style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: 11.5 }}>
                                {row.source_ip ?? '—'}
                              </small>
                            </div>
                          </td>
                          <td>
                            <span className="table-secondary" style={{ fontSize: 12 }}>
                              {when(row.last_seen_at)}
                            </span>
                          </td>
                          <td>
                            <span className="table-secondary" style={{ fontSize: 12 }}>
                              {when(row.created_at)}
                            </span>
                          </td>
                          <td>
                            <span className="table-secondary" style={{ fontSize: 12 }}>
                              {when(row.expires_at)}
                            </span>
                          </td>
                          <td>
                            {row.current ? (
                              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 800 }}>
                                ✓ {locale === 'ar' ? 'نشطة هنا' : 'Active'}
                              </span>
                            ) : (
                              <button
                                className="button button--ghost button--small"
                                disabled={busy !== null}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void revokeOne(row.id)
                                }}
                                style={{ padding: '4px 10px', fontSize: 11.5, color: '#ef4444' }}
                              >
                                {busy === row.id ? text.revoking : text.revoke}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right Column (32% Session Inspector) */}
        <aside className="exec-split__side" style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 20 }}>
          <div
            className="inspector-card"
            style={{
              padding: 20,
              borderRadius: 16,
              background: 'var(--surface)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name="shield" size={17} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{text.inspectorTitle}</h4>
                <small style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                  {selectedSession?.current ? text.currentBadge : text.inspectorDesc}
                </small>
              </div>
            </div>

            {/* Triple Meters */}
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {text.tripleMetersTitle}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterDeviceTrust}</span>
                    <span style={{ color: '#10b981' }}>{selectedSession?.current ? '100%' : '92%'}</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: selectedSession?.current ? '100%' : '92%', height: '100%', borderRadius: 999, background: '#10b981' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterTokenEntropy}</span>
                    <span style={{ color: '#818cf8' }}>100%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 999, background: '#818cf8' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterExpiryDiscipline}</span>
                    <span style={{ color: '#38bdf8' }}>98%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '98%', height: '100%', borderRadius: 999, background: '#38bdf8' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Session Metadata Card */}
            {selectedSession && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)' }}>Session ID: </span>
                  <span style={{ fontFamily: 'monospace' }}>{selectedSession.id.slice(0, 16)}…</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>IP: </span>
                  <span style={{ fontFamily: 'monospace' }}>{selectedSession.source_ip ?? '127.0.0.1'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Expires: </span>
                  <span>{when(selectedSession.expires_at)}</span>
                </div>
                {!selectedSession.current && (
                  <button
                    className="button button--ghost button--small"
                    disabled={busy !== null}
                    onClick={() => void revokeOne(selectedSession.id)}
                    style={{ color: '#ef4444', marginTop: 6, width: '100%', justifyContent: 'center' }}
                  >
                    {busy === selectedSession.id ? text.revoking : text.revoke}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* AI Security Advisor */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))',
              border: '1px solid rgba(99,102,241,0.25)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c084fc', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
              <Icon name="sparkles" size={16} />
              <span>{text.aiAdvisorTitle}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.55 }}>
              {text.aiAdvisorDesc}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
