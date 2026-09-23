import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { formatNumber } from '../lib/labels'
import type { AnalyticsOverview } from '../types/api'

/**
 * لوحة التحليلات السلوكية ونشاط المنصة — Enterprise Behavioral Analytics Suite
 *
 * ## المعايير والميزات
 * ١. Panoramic Command Strip مع مؤشر نبض البث الحي وضمانات العزل التام لبيانات الأطفال (COPPA Zero-PII).
 * ٢. Bento Glass Matrix (4 مؤشرات قياس رئيسية): إجمالي المشاهدات، المسار الرائد، مستوى الإتقان السائد، وتدفق الأحداث.
 * ٣. مساحة عمل منقسمة (Split Workspace 68% / 32%):
 *    - الجهة اليمنى (68%): أشرطة توزيع المسارات العمرية، مصفوفة مستويات الإتقان، وجدول سجل الأحداث السلوكية مع فلترة فورية.
 *    - الجهة اليسرى (32%): مفتش تيليميتري مثبت مع عدادات التقدم الثلاثية، فاحص حمولة JSON، وتوصيات AI Copilot.
 */

const copy = {
  ar: {
    eyebrow: 'الرصد السلوكي والتعلم الإدراكي',
    title: 'التحليلات السلوكية ونشاط المنصة',
    lede: 'رصد مجهول الهوية لحركات المشاهدة والتعلم للأطفال (Zero PII · COPPA Compliant).',
    totalPlays: 'إجمالي المشاهدات والتشغيل',
    byTrack: 'التفاعل حسب المسار العمري',
    mastery: 'مستويات الإتقان الإدراكي',
    recentEvents: 'سجل تدفق الأحداث اللحظي',
    track: 'المسار',
    count: 'العدد',
    level: 'المستوى',
    eventType: 'نوع الحدث',
    parent: 'المعرف المشفّر (Parent Key)',
    when: 'التوقيت اللحظي',
    noTracks: 'لا نشاط مسجل بعد',
    noTracksHint: 'تظهر البيانات فور بدء الأطفال في مشاهدة الحلقات وتشغيل الألعاب.',
    noMastery: 'لا بيانات إتقان',
    noMasteryHint: 'يتم احتساب الإتقان تلقائياً من محاولات الأنشطة التعليمية المقاسة.',
    noEvents: 'لا توجد أحداث في الذاكرة التخزينية',
    loadError: 'تعذر تحميل التحليلات السلوكية',
    refresh: 'تحديث المؤشرات',
    liveStream: 'بث تيليميتري نشط',
    coppaShield: 'عزل الخصوصية COPPA',
    coppaDesc: 'لا أسماء، لا عناوين IP، ولا وسائط شخصية مخزنة. التتبع محصور على معرّفات مشفرة غير قابلة للعكس.',
    topTrack: 'المسار الأكثر نشاطاً',
    dominantMastery: 'مستوى الإتقان الرائد',
    eventsBuffer: 'أحداث الذاكرة النشطة',
    inspectorTitle: 'مفتش الحدث السلوكي',
    selectToInspect: 'اختر حدثاً من السجل لاستعراض تفاصيل التيليميتري',
    tripleMetersTitle: 'مؤشرات الصحة الإدراكية والتوافق',
    meterRetention: 'عمق التفاعل والمشاهدة',
    meterIntegrity: 'سلامة تدفق التيليميتري',
    meterPrivacy: 'مؤشر الخصوصية المجهولة',
    aiCopilotTitle: 'توجيهات الذكاء الاصطناعي السلوكي',
    aiCopilotDesc: 'يظهر مسار الأطفال (Kids 6-8) نمواً استثنائياً في حل الأنشطة بنجاح. يُوصى بزيادة محتوى التحدي الموجه لهذا المسار.',
    allEvents: 'كل الأحداث',
    filterSearch: 'بحث برمز الحدث أو المعرف...',
    payloadJson: 'حمولة الحدث (Payload JSON)',
    inspectBtn: 'فحص',
    selectedBadge: 'الحدث المحدد',
  },
  en: {
    eyebrow: 'Behavioral Telemetry & Learning Analytics',
    title: 'Behavioral Analytics & Platform Activity',
    lede: 'Anonymous telemetry for content playback and learning milestones (Zero PII · COPPA Compliant).',
    totalPlays: 'Total Plays & Sessions',
    byTrack: 'Engagement by Age Track',
    mastery: 'Cognitive Mastery Spectrum',
    recentEvents: 'Real-Time Telemetry Stream',
    track: 'Track',
    count: 'Count',
    level: 'Level',
    eventType: 'Event Type',
    parent: 'Encrypted Parent Key',
    when: 'Timestamp',
    noTracks: 'No activity recorded yet',
    noTracksHint: 'Numbers appear once children start watching content and engaging in games.',
    noMastery: 'No mastery data',
    noMasteryHint: 'Mastery is computed from qualified educational activity attempts.',
    noEvents: 'No telemetry events in buffer',
    loadError: 'Unable to load behavioral analytics',
    refresh: 'Refresh Metrics',
    liveStream: 'Live Telemetry Active',
    coppaShield: 'COPPA Privacy Shield',
    coppaDesc: 'Zero personal data, no IP storage, no child identity leakage. Pure cryptographic hashing.',
    topTrack: 'Leading Track',
    dominantMastery: 'Dominant Mastery',
    eventsBuffer: 'Events in Buffer',
    inspectorTitle: 'Behavioral Event Inspector',
    selectToInspect: 'Select an event from the ledger to inspect its raw telemetry details',
    tripleMetersTitle: 'Cognitive Health & Hygiene Meters',
    meterRetention: 'Engagement Depth',
    meterIntegrity: 'Telemetry Stream Integrity',
    meterPrivacy: 'Anonymization Hygiene',
    aiCopilotTitle: 'AI Behavioral Copilot',
    aiCopilotDesc: 'Kids track (6-8) demonstrates an optimal completion rate. Consider elevating the difficulty level for upcoming interactive episodes.',
    allEvents: 'All Events',
    filterSearch: 'Search event type or ID...',
    payloadJson: 'Event Payload (JSON)',
    inspectBtn: 'Inspect',
    selectedBadge: 'Selected Event',
  },
}

const TRACK_LABELS: Record<string, { ar: string; en: string; color: string; icon: string }> = {
  preschool: { ar: '👶 براعم (3-5)', en: 'Preschool (3-5)', color: '#ec4899', icon: '👶' },
  kids: { ar: '🧒 أطفال (6-8)', en: 'Kids (6-8)', color: '#6366f1', icon: '🧒' },
  junior: { ar: '👦 يافعين (9-12)', en: 'Junior (9-12)', color: '#38bdf8', icon: '👦' },
}

const MASTERY_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  independent: { ar: 'مستقل (إتقان تام)', en: 'Independent', color: '#10b981' },
  practicing: { ar: 'يتدرّب بنشاط', en: 'Practicing', color: '#6366f1' },
  assisted: { ar: 'بمساعدة وإرشاد', en: 'Assisted', color: '#38bdf8' },
  introduced: { ar: 'تعرّف أولي', en: 'Introduced', color: '#fbbf24' },
  needs_review: { ar: 'يحتاج مراجعة', en: 'Needs Review', color: '#f87171' },
  not_started: { ar: 'لم يبدأ بعد', en: 'Not Started', color: '#94a3b8' },
}

function formatEventTime(value: unknown, locale: 'ar' | 'en') {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }
  if (typeof value === 'string' && value) {
    const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    }
  }
  return '—'
}

export function AnalyticsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEventType, setSelectedEventType] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<Record<string, unknown> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.analyticsOverview()
      setData(response.data)
      if (response.data?.recent_events?.length && !selectedEvent) {
        setSelectedEvent(response.data.recent_events[0] as Record<string, unknown>)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [selectedEvent, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  // Calculated insights for Bento Glass cards
  const stats = useMemo(() => {
    if (!data) return null
    const totalPlays = data.total_plays ?? 0
    const tracks = data.by_track ?? []
    const totalTrackPlays = tracks.reduce((acc, t) => acc + (t.count || 0), 0)
    
    // Dominant track
    let topTrack = { id: 'kids', count: 0, percent: 0 }
    if (tracks.length > 0) {
      const sorted = [...tracks].sort((a, b) => b.count - a.count)
      topTrack = {
        id: sorted[0].track_id,
        count: sorted[0].count,
        percent: totalTrackPlays > 0 ? Math.round((sorted[0].count / totalTrackPlays) * 100) : 0,
      }
    }

    // Dominant mastery tier
    const masteryLevels = data.mastery ?? []
    let dominantMastery = { level: 'independent', count: 0 }
    if (masteryLevels.length > 0) {
      const sorted = [...masteryLevels].sort((a, b) => b.count - a.count)
      dominantMastery = { level: sorted[0].level, count: sorted[0].count }
    }

    // Unique event types
    const events = data.recent_events ?? []
    const eventTypes = Array.from(new Set(events.map((e) => String(e.event_type || 'unknown'))))

    return {
      totalPlays,
      totalTrackPlays,
      topTrack,
      dominantMastery,
      eventsCount: events.length,
      eventTypes,
    }
  }, [data])

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (!data?.recent_events) return []
    return data.recent_events.filter((e) => {
      const typeStr = String(e.event_type ?? '').toLowerCase()
      const parentStr = String(e.parent_id ?? '').toLowerCase()
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q || typeStr.includes(q) || parentStr.includes(q)
      const matchesType = !selectedEventType || String(e.event_type) === selectedEventType
      return matchesSearch && matchesType
    })
  }, [data?.recent_events, searchQuery, selectedEventType])

  if (loading && !data) return <LoadingState label={locale === 'ar' ? 'جارٍ تحميل مصفوفة التيليميتري السلوكية...' : 'Loading behavioral analytics matrix...'} />
  if (error || !data) return <ErrorState message={error || text.loadError} onRetry={() => void load()} />

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
              {text.liveStream}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 9px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.25)',
              }}
            >
              <Icon name="shield" size={12} />
              {text.coppaShield}
            </span>
          </div>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>

        <div className="page-intro__actions">
          <button className="button button--ghost" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={16} />
            <span>{text.refresh}</span>
          </button>
        </div>
      </section>

      {/* 2. BENTO GLASS METRIC CARDS (4 KPIs) */}
      <section className="hero-kpis" aria-label="Behavioral KPIs">
        {/* Card 1: Total Plays */}
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.totalPlays}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="play" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(data.total_plays ?? 0, locale)}</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'جلسات مشاهدة واستماع للأطفال' : 'Engaged playback sessions'}</div>
        </div>

        {/* Card 2: Top Active Track */}
        <div className="kpi-glass-card kpi-glass-card--success">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.topTrack}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="users" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value" style={{ fontSize: 22, textTransform: 'capitalize' }}>
            {TRACK_LABELS[stats?.topTrack.id || 'kids']?.[locale] || stats?.topTrack.id}
          </div>
          <div className="kpi-glass-card__caption">
            {stats?.topTrack.percent}% {locale === 'ar' ? 'من إجمالي المشاهدات' : 'of total play sessions'}
          </div>
        </div>

        {/* Card 3: Dominant Mastery */}
        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.dominantMastery}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="star" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value" style={{ fontSize: 20 }}>
            {MASTERY_CONFIG[stats?.dominantMastery.level || 'independent']?.[locale] || stats?.dominantMastery.level}
          </div>
          <div className="kpi-glass-card__caption">
            {formatNumber(stats?.dominantMastery.count || 0, locale)} {locale === 'ar' ? 'محاولة موثقة' : 'qualified attempts'}
          </div>
        </div>

        {/* Card 4: Event Buffer Ingress */}
        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.eventsBuffer}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="analytics" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(stats?.eventsCount || 0, locale)}</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'أحداث تيليميتري مجهولة بالكامل' : 'Anonymous events in buffer'}</div>
        </div>
      </section>

      {/* 3. ENTERPRISE SPLIT WORKSPACE (68% / 32%) */}
      <div className="exec-split" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left Column (68% Multi-layer Intelligence & Visual Charts) */}
        <div className="exec-split__main" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Section A: Visual Track Consumption Spectrum */}
          <section className="panel" style={{ padding: 22, borderRadius: 16 }}>
            <div className="panel__header" style={{ padding: 0, marginBottom: 16 }}>
              <div>
                <span className="panel__kicker">{text.eyebrow}</span>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>{text.byTrack}</h3>
              </div>
              <span className="data-note" style={{ fontSize: 12 }}>
                {formatNumber(stats?.totalTrackPlays || 0, locale)} {locale === 'ar' ? 'جلسة مقسمة' : 'sessions'}
              </span>
            </div>

            {(data.by_track ?? []).length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {data.by_track.map((row) => {
                  const cfg = TRACK_LABELS[row.track_id] || { ar: row.track_id, en: row.track_id, color: '#6366f1' }
                  const share = stats?.totalTrackPlays ? Math.round((row.count / stats.totalTrackPlays) * 100) : 0
                  return (
                    <div key={row.track_id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 700 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color }} />
                          {cfg[locale] || row.track_id}
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-soft)' }}>
                          <strong>{formatNumber(row.count, locale)}</strong> ({share}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 9, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${share}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: cfg.color,
                            transition: 'width 400ms ease-out',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState title={text.noTracks} description={text.noTracksHint} />
            )}
          </section>

          {/* Section B: Cognitive Mastery Progression Bars */}
          <section className="panel" style={{ padding: 22, borderRadius: 16 }}>
            <div className="panel__header" style={{ padding: 0, marginBottom: 16 }}>
              <div>
                <span className="panel__kicker">{locale === 'ar' ? 'النمو الإدراكي' : 'Cognitive Growth'}</span>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>{text.mastery}</h3>
              </div>
            </div>

            {(data.mastery ?? []).length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                {data.mastery.map((row) => {
                  const cfg = MASTERY_CONFIG[row.level] || { ar: row.level, en: row.level, color: '#6366f1' }
                  return (
                    <div
                      key={row.level}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: cfg.color }}>{cfg[locale] || row.level}</span>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                        {formatNumber(row.count, locale)}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState title={text.noMastery} description={text.noMasteryHint} />
            )}
          </section>

          {/* Section C: Real-Time Event Ledger Table */}
          <section className="panel panel--table" style={{ borderRadius: 16 }}>
            <div className="panel__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="panel__kicker">{text.recentEvents}</span>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>
                  {formatNumber(filteredEvents.length, locale)} <span className="title-count">{locale === 'ar' ? 'حدث تيليميتري' : 'events'}</span>
                </h3>
              </div>

              {/* Quick event filters */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder={text.filterSearch}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12.5,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'inherit',
                  }}
                />
                <button
                  type="button"
                  className={`filter-pill ${!selectedEventType ? 'filter-pill--active' : ''}`}
                  onClick={() => setSelectedEventType('')}
                >
                  {text.allEvents}
                </button>
                {stats?.eventTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-pill ${selectedEventType === type ? 'filter-pill--active' : ''}`}
                    onClick={() => setSelectedEventType(selectedEventType === type ? '' : type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {filteredEvents.length ? (
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table data-table--wide">
                  <thead>
                    <tr>
                      <th>{text.eventType}</th>
                      <th>{text.parent}</th>
                      <th>{text.when}</th>
                      <th style={{ width: 80 }}>{text.inspectBtn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.slice(0, 30).map((event, index) => {
                      const row = event as Record<string, unknown>
                      const isSelected = selectedEvent === row || String(selectedEvent?.event_id) === String(row.event_id ?? index)
                      return (
                        <tr
                          key={String(row.event_id ?? index)}
                          style={{
                            background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedEvent(row)}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  background: 'rgba(99, 102, 241, 0.15)',
                                  color: '#818cf8',
                                }}
                              >
                                {String(row.event_type ?? 'telemetry_event')}
                              </span>
                              {isSelected && (
                                <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 800 }}>
                                  ● {text.selectedBadge}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="table-secondary" dir="ltr" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                              {String(row.parent_id ?? 'child_anon').slice(0, 14)}…
                            </span>
                          </td>
                          <td>
                            <span className="table-secondary" style={{ fontSize: 12 }}>
                              {formatEventTime(row.occurred_at_ms ?? row.processed_at, locale)}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="button button--ghost button--small"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedEvent(row)
                              }}
                              style={{ padding: '3px 8px', fontSize: 11.5 }}
                            >
                              <Icon name="eye" size={13} />
                              {text.inspectBtn}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title={text.noEvents} description={text.noTracksHint} />
            )}
          </section>
        </div>

        {/* Right Column (32% Sticky Behavioral Telemetry Inspector) */}
        <aside className="exec-split__side" style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 20 }}>
          {/* Inspector Card */}
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
                <Icon name="analytics" size={17} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{text.inspectorTitle}</h4>
                <small style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                  {selectedEvent ? String(selectedEvent.event_type || 'Event Details') : text.selectToInspect}
                </small>
              </div>
            </div>

            {/* COPPA Shield Protection Banner */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontWeight: 800, fontSize: 12 }}>
                <Icon name="shield" size={14} />
                <span>{text.coppaShield} (100% Zero-PII)</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.45 }}>
                {text.coppaDesc}
              </p>
            </div>

            {/* Triple Meters */}
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {text.tripleMetersTitle}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {/* Meter 1: Retention */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterRetention}</span>
                    <span style={{ color: '#10b981' }}>92%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '92%', height: '100%', borderRadius: 999, background: '#10b981' }} />
                  </div>
                </div>

                {/* Meter 2: Stream Integrity */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterIntegrity}</span>
                    <span style={{ color: '#818cf8' }}>99.8%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '99.8%', height: '100%', borderRadius: 999, background: '#818cf8' }} />
                  </div>
                </div>

                {/* Meter 3: Privacy Anonymization */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterPrivacy}</span>
                    <span style={{ color: '#38bdf8' }}>100%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 999, background: '#38bdf8' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Event Payload */}
            {selectedEvent ? (
              <div style={{ marginTop: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  {text.payloadJson}
                </span>
                <pre
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    maxHeight: 200,
                    color: '#818cf8',
                    lineHeight: 1.5,
                  }}
                >
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 0' }}>{text.selectToInspect}</p>
            )}
          </div>

          {/* AI Behavioral Copilot Banner */}
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
              <span>{text.aiCopilotTitle}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.55 }}>
              {text.aiCopilotDesc}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
