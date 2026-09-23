import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
import { formatDate, formatNumber } from '../lib/labels'
import type { FailedEventStatus, FailedFamilyEventRecord } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'سلامة البيانات والتعافي من الأعطال',
    title: 'أحداث العائلة المتعثرة (DLQ Recovery)',
    intro: 'أحداث استنفدت محاولاتها وسقطت في طابور الرسائل الميتة. كل صفّ يعني إسقاط عائلة متأخّرًا عن حالتها الحقيقية.',
    refresh: 'تحديث البيانات',
    list: 'الأحداث',
    total: 'إجمالي الأحداث',
    pendingCount: 'أحداث معلَّقة',
    allStatuses: 'كل الحالات',
    parentFilter: 'معرّف ولي الأمر...',
    when: 'وقت الفشل',
    event: 'الحدث',
    family: 'العائلة',
    attempts: 'المحاولات',
    status: 'الحالة',
    resolution: 'المعالجة',
    payload: 'الجسم المحفوظ',
    replay: 'إعادة تشغيل',
    discard: 'استبعاد',
    inspect: 'فحص وتدقيق الجسم',
    loading: 'جارٍ تحميل الأحداث...',
    loadError: 'تعذر تحميل الأحداث الفاشلة',
    empty: 'لا أحداث فاشلة',
    emptyDesc: 'كل أحداث العائلة عُولجت بنجاح. هذه هي الحالة المرجوّة.',
    emptyFiltered: 'لا أحداث مطابقة',
    emptyFilteredDesc: 'غيّر عوامل التصفية لرؤية أحداث بحالة أخرى.',
    unknownEvent: 'حدث مجهول الهوية',
    unknownHint: 'رسالة مشوّهة لا تحمل معرّفًا. تُسجَّل رغم ذلك بدل أن تُفقَد.',
    noParent: 'بلا عائلة معروفة',
    placeholderPayload: 'جسم غير قابل لإعادة التشغيل',
    truncated: 'الجسم حُفظ مقتطعًا لأنه كان أكبر من الحدّ',
    unserializable: 'الجسم لم يكن قابلًا للترميز',
    cannotReplay: 'لا يمكن إعادة التشغيل: الجسم المحفوظ نائبٌ لا حدثٌ. استبعده.',
    discardTitle: 'استبعاد حدث',
    discardLede: 'الاستبعاد نهائي: الحدث لن يُطبَّق على الإسقاط. السبب يُسجَّل مع هويتك.',
    noteField: 'سبب الاستبعاد *',
    notePlaceholder: 'مثال: حدث تجريبي من بيئة التطوير، لا يخصّ عائلة حقيقية.',
    noteRequired: 'السبب مطلوب.',
    cancel: 'إلغاء',
    confirmDiscard: 'استبعاد',
    replaying: 'جارٍ إعادة التشغيل...',
    replayedOk: 'أُعيد تشغيل الحدث بنجاح.',
    replayedDuplicate: 'الحدث كان مُسقَطًا سلفًا، فوُسم كمُعاد تشغيله بلا تطبيق مزدوج.',
    discardedOk: 'استُبعد الحدث بنجاح.',
    actionError: 'تعذر تنفيذ الإجراء',
    close: 'إغلاق',
    resolvedBy: 'بواسطة',
    pendingNote: 'الأحداث المعلَّقة تحتاج قرارًا: إعادة تشغيل بعد إصلاح السبب، أو استبعاد بسبب مكتوب وموثق.',
    systemBeacon: 'طابور الرسائل الميتة (DLQ)',
    beaconSub: 'حماية متقدمة من فقدان إسقاط بيانات العائلات',
    eventId: 'معرّف الحدث',
    drawerTitle: 'فحص الحدث والجسم المشفر',
    copied: 'تم النسخ!',
    copyId: 'نسخ المعرّف',
    replayedCount: 'تمت إعادة تشغيلها',
    discardedCount: 'مُستبعدة بقرار',
  },
  en: {
    eyebrow: 'Data Integrity & DLQ Recovery',
    title: 'Failed Family Events & DLQ Recovery',
    intro: 'Events that exhausted every retry and landed in the dead-letter queue. Each row means one family\u2019s projection is behind its true state.',
    refresh: 'Refresh Data',
    list: 'Events',
    total: 'Total Events',
    pendingCount: 'Pending',
    allStatuses: 'All statuses',
    parentFilter: 'Parent id...',
    when: 'Failed at',
    event: 'Event',
    family: 'Family',
    attempts: 'Attempts',
    status: 'Status',
    resolution: 'Resolution',
    payload: 'Stored payload',
    replay: 'Replay',
    discard: 'Discard',
    inspect: 'Inspect Payload',
    loading: 'Loading failed events...',
    loadError: 'Unable to load failed events',
    empty: 'No failed events',
    emptyDesc: 'Every family event was processed successfully. This is the desired state.',
    emptyFiltered: 'No matching events',
    emptyFilteredDesc: 'Adjust the filters to see events in another state.',
    unknownEvent: 'Unidentified event',
    unknownHint: 'A malformed message carrying no id. Recorded anyway rather than lost.',
    noParent: 'No known family',
    placeholderPayload: 'Payload is not replayable',
    truncated: 'The payload was stored truncated because it exceeded the size cap',
    unserializable: 'The payload could not be serialized',
    cannotReplay: 'Cannot replay: the stored payload is a placeholder, not an event. Discard it.',
    discardTitle: 'Discard event',
    discardLede: 'Discarding is final: the event will never be applied to the projection. The reason is recorded with your identity.',
    noteField: 'Reason for discarding *',
    notePlaceholder: 'For example: a test event from development, not tied to a real family.',
    noteRequired: 'A reason is required.',
    cancel: 'Cancel',
    confirmDiscard: 'Discard',
    replaying: 'Replaying...',
    replayedOk: 'The event was replayed successfully.',
    replayedDuplicate: 'The event was already projected, so it was marked replayed without applying it twice.',
    discardedOk: 'The event was discarded.',
    actionError: 'Unable to complete the action',
    close: 'Close',
    resolvedBy: 'by',
    pendingNote: 'Pending events need a decision: replay after fixing the cause, or discard with a written reason.',
    systemBeacon: 'Dead-Letter Queue (DLQ)',
    beaconSub: 'Guaranteed projection recovery & event auditing',
    eventId: 'Event ID',
    drawerTitle: 'Stored Payload Forensic Dossier',
    copied: 'Copied!',
    copyId: 'Copy ID',
    replayedCount: 'Replayed',
    discardedCount: 'Discarded',
  },
}

const STATUSES: FailedEventStatus[] = ['pending', 'replayed', 'discarded']

const statusLabels: Record<'ar' | 'en', Record<FailedEventStatus, string>> = {
  ar: { pending: 'معلَّق', replayed: 'أُعيد تشغيله', discarded: 'مُستبعَد' },
  en: { pending: 'Pending', replayed: 'Replayed', discarded: 'Discarded' },
}

function inspectPayload(raw: string): { replayable: boolean; placeholder?: 'truncated' | 'unserializable' | 'invalid' } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { replayable: false, placeholder: 'invalid' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { replayable: false, placeholder: 'invalid' }
  }
  const error = (parsed as Record<string, unknown>).error
  if (error === 'payload_truncated') return { replayable: false, placeholder: 'truncated' }
  if (error === 'payload_not_serializable') return { replayable: false, placeholder: 'unserializable' }
  if (typeof error === 'string') return { replayable: false, placeholder: 'invalid' }
  return { replayable: true }
}

function prettyPayload(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

const LIMIT = 50
const ANY_STATUS = 'all'
const DEFAULT_FILTERS = { status: 'pending', parent_id: '' }

const FILTER_FIELDS = (
  text: (typeof copy)['ar'],
  locale: 'ar' | 'en',
): FilterField[] => [
  {
    key: 'parent_id',
    label: text.family,
    type: 'text',
    chip: (value) => `${text.family}: ${value}`,
  },
  {
    key: 'status',
    label: text.status,
    type: 'select',
    options: [
      { value: ANY_STATUS, label: text.allStatuses },
      ...STATUSES.map((item) => ({ value: item, label: statusLabels[locale][item] })),
    ],
  },
]

export function FailedEventsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()

  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { filters, offset, limit } = list
  const { status, parent_id: parentId } = filters
  const serverStatus = status === ANY_STATUS ? '' : status
  const [records, setRecords] = useState<FailedFamilyEventRecord[]>([])
  const [total, setTotal] = useState(0)
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [busyId, setBusyId] = useState<string | null>(null)
  const [inspecting, setInspecting] = useState<FailedFamilyEventRecord | null>(null)
  const [discarding, setDiscarding] = useState<FailedFamilyEventRecord | null>(null)
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  const [copiedId, setCopiedId] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.failedFamilyEvents({
        status: serverStatus,
        parent_id: parentId.trim(),
        limit,
        offset,
      })
      setRecords(response.data)
      setTotal(response.meta?.total ?? response.data.length)
      setPending(response.meta?.pending ?? 0)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [parentId, serverStatus, limit, offset, text.loadError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  async function replay(row: FailedFamilyEventRecord) {
    setBusyId(row.id)
    setError('')
    setNotice('')
    try {
      const response = await api.replayFailedFamilyEvent(row.id)
      setNotice(response.data.duplicate ? text.replayedDuplicate : text.replayedOk)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.actionError)
    } finally {
      setBusyId(null)
    }
  }

  function openDiscard(row: FailedFamilyEventRecord) {
    setDiscarding(row)
    setNote('')
    setFormError('')
  }

  async function confirmDiscard() {
    if (!discarding) return
    const reason = note.trim()
    if (!reason) {
      setFormError(text.noteRequired)
      return
    }

    setBusyId(discarding.id)
    setFormError('')
    try {
      await api.discardFailedFamilyEvent(discarding.id, reason)
      setDiscarding(null)
      setNotice(text.discardedOk)
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.actionError)
    } finally {
      setBusyId(null)
    }
  }

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const replayedCount = records.filter((r) => r.status === 'replayed').length
  const discardedCount = records.filter((r) => r.status === 'discarded').length

  return (
    <div className="content-studio-root">
      {/* 1. Master Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className={`status-beacon__dot ${pending > 0 ? 'status-beacon__dot--rose' : 'status-beacon__dot--emerald'}`} />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">{text.systemBeacon}</span>
              <span className="status-beacon__sub">{text.beaconSub}</span>
            </div>
          </div>

          <div className="filter-pill-group" style={{ marginInlineStart: 12 }}>
            <button
              className={`filter-pill ${status === ANY_STATUS ? 'filter-pill--active' : ''}`}
              onClick={() => list.setFilter('status', ANY_STATUS)}
            >
              {text.allStatuses}
            </button>
            <button
              className={`filter-pill ${status === 'pending' ? 'filter-pill--active' : ''}`}
              onClick={() => list.setFilter('status', 'pending')}
            >
              {statusLabels[locale].pending} ({pending})
            </button>
            <button
              className={`filter-pill ${status === 'replayed' ? 'filter-pill--active' : ''}`}
              onClick={() => list.setFilter('status', 'replayed')}
            >
              {statusLabels[locale].replayed}
            </button>
            <button
              className={`filter-pill ${status === 'discarded' ? 'filter-pill--active' : ''}`}
              onClick={() => list.setFilter('status', 'discarded')}
            >
              {statusLabels[locale].discarded}
            </button>
          </div>
        </div>

        <div className="commercial-command-strip__right">
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
            <span>{text.refresh}</span>
          </button>
        </div>
      </section>

      {/* 2. Executive Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(239, 68, 68, 0.28) 0%, rgba(245, 158, 11, 0.16) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#ef4444' }} />
              {formatNumber(pending, locale)} {text.pendingCount}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.intro}</p>
        </div>
      </section>

      {/* 3. Executive Bento Live Metrics Matrix */}
      <div className="commercial-bento-grid">
        <div className="commercial-bento-card commercial-bento-card--indigo" onClick={() => list.setFilter('status', ANY_STATUS)} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.total}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="objectives" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(total, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'سجل الأحداث الكلي' : 'All recorded DLQ events'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--rose" onClick={() => list.setFilter('status', 'pending')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.pendingCount}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="warning" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(pending, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              {locale === 'ar' ? 'تحتاج قرار إعادة أو استبعاد' : 'Awaiting operator decision'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald" onClick={() => list.setFilter('status', 'replayed')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.replayedCount}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(replayedCount, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              <Icon name="check" size={12} /> {locale === 'ar' ? 'أُعيد تطبيقها بنجاح' : 'Replayed to projection'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber" onClick={() => list.setFilter('status', 'discarded')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.discardedCount}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="clock" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(discardedCount, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              {locale === 'ar' ? 'استُبعدت مع تدوين السبب' : 'Audited discards'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Operational Notification Banners */}
      {notice && (
        <div
          style={{
            margin: '20px 0 0',
            padding: '14px 18px',
            borderRadius: 14,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontWeight: 700,
          }}
        >
          <Icon name="check" size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* 5. Catalog Control Strip & Filter Tools */}
      <section className="catalog-control-strip" style={{ marginTop: 24 }}>
        <div className="catalog-control-strip__left">
          <ListToolbar
            searchValue={list.filters.parent_id}
            onSearchChange={(value) => list.setFilter('parent_id', value)}
            searchPlaceholder={text.parentFilter}
            fields={FILTER_FIELDS(text, locale)}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, DEFAULT_FILTERS[key as keyof typeof DEFAULT_FILTERS])}
            trailing={
              <SavedViewsMenu
                storageKey="failed-family-events"
                currentSearch={list.search}
                onApply={(search) => navigate(`${adminPath('failed-events')}${search}`)}
              />
            }
          />
        </div>
      </section>

      {/* 6. Main Events Table View */}
      {loading && !records.length ? (
        <LoadingState label={text.loading} />
      ) : error && !records.length ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : records.length === 0 ? (
        <EmptyState
          title={serverStatus || parentId ? text.emptyFiltered : text.empty}
          description={serverStatus || parentId ? text.emptyFilteredDesc : text.emptyDesc}
        />
      ) : (
        <section
          className="panel panel--table"
          style={{
            marginTop: 20,
            background: 'var(--surface-1)',
            borderRadius: 16,
            border: '1px solid var(--cs-glass-border)',
            overflow: 'hidden',
          }}
        >
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.when}</th>
                  <th>{text.event}</th>
                  <th>{text.family}</th>
                  <th>{text.attempts}</th>
                  <th>{text.status}</th>
                  <th>{text.resolution}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((row) => {
                  const check = inspectPayload(row.payload)
                  const isBusy = busyId === row.id
                  return (
                    <tr key={row.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                        {formatDate(row.failed_at, locale)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ color: 'var(--text)' }}>{row.event_type || text.unknownEvent}</strong>
                          <code dir="ltr" style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                            {row.id.slice(0, 16)}…
                          </code>
                        </div>
                      </td>
                      <td>
                        {row.parent_id ? (
                          <Link
                            to={adminPath(`customers/${row.parent_id}`)}
                            style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
                          >
                            {row.parent_id.slice(0, 12)}…
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>{text.noParent}</span>
                        )}
                      </td>
                      <td>
                        <span className="counter-badge counter-badge--muted">{row.attempts}</span>
                      </td>
                      <td>
                        <span
                          className={`account-status account-status--${
                            row.status === 'pending' ? 'suspended' : row.status === 'replayed' ? 'active' : 'archived'
                          }`}
                        >
                          {statusLabels[locale][row.status]}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                        {row.resolved_at ? (
                          <div>
                            <span>{formatDate(row.resolved_at, locale)}</span>
                            {row.resolved_by && (
                              <small style={{ display: 'block', color: 'var(--muted)' }}>
                                {text.resolvedBy}: {row.resolved_by}
                              </small>
                            )}
                            {row.resolution_note && (
                              <small style={{ display: 'block', color: 'var(--text)', fontStyle: 'italic' }}>
                                &ldquo;{row.resolution_note}&rdquo;
                              </small>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="button button--ghost button--small"
                            onClick={() => setInspecting(row)}
                          >
                            <Icon name="objectives" size={13} />
                            <span>{text.inspect}</span>
                          </button>
                          {row.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="button button--primary button--small"
                                disabled={isBusy || !check.replayable}
                                onClick={() => void replay(row)}
                                title={!check.replayable ? text.cannotReplay : undefined}
                              >
                                {isBusy ? text.replaying : text.replay}
                              </button>
                              <button
                                type="button"
                                className="button button--secondary button--small"
                                disabled={isBusy}
                                onClick={() => openDiscard(row)}
                              >
                                {text.discard}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--cs-glass-border)' }}>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </div>
        </section>
      )}

      {/* 7. Slide-Over Payload Inspection Drawer */}
      {inspecting && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setInspecting(null)}
        >
          <aside
            className="commercial-slide-drawer"
            style={{
              width: '100%',
              maxWidth: 540,
              height: '100%',
              background: 'var(--surface-1)',
              borderInlineStart: '1px solid var(--cs-glass-border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.3)',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '24px 24px 20px',
                borderBottom: '1px solid var(--cs-glass-border)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.08) 0%, transparent 100%)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                  {inspecting.event_type || text.unknownEvent}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 2 }}>
                  {text.drawerTitle}
                </span>
              </div>
              <button
                className="button button--ghost button--small"
                onClick={() => setInspecting(null)}
                style={{ padding: '6px 10px' }}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Event ID Box */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  {text.eventId}
                </label>
                <div className="token-copy-box">
                  <code style={{ fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {inspecting.id}
                  </code>
                  <button
                    className="button button--ghost button--small"
                    onClick={() => copyToClipboard(inspecting.id)}
                    style={{ flexShrink: 0, padding: '4px 8px' }}
                  >
                    {copiedId ? text.copied : text.copyId}
                  </button>
                </div>
              </div>

              {/* Status and Attempts */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span
                  className={`account-status account-status--${
                    inspecting.status === 'pending' ? 'suspended' : inspecting.status === 'replayed' ? 'active' : 'archived'
                  }`}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  {statusLabels[locale][inspecting.status]}
                </span>
                <span className="counter-badge" style={{ padding: '6px 12px', fontSize: 12 }}>
                  {text.attempts}: {inspecting.attempts}
                </span>
              </div>

              {/* Payload View */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  {text.payload}
                </label>
                <pre
                  dir="ltr"
                  style={{
                    margin: 0,
                    padding: 16,
                    borderRadius: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--cs-glass-border)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: 'var(--text)',
                    maxHeight: 280,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {prettyPayload(inspecting.payload)}
                </pre>
              </div>

              {/* Actions */}
              {inspecting.status === 'pending' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="button button--primary"
                    style={{ flex: 1, padding: '12px 16px', justifyContent: 'center' }}
                    disabled={busyId === inspecting.id || !inspectPayload(inspecting.payload).replayable}
                    onClick={() => void replay(inspecting)}
                  >
                    <Icon name="refresh" size={15} />
                    <span>{busyId === inspecting.id ? text.replaying : text.replay}</span>
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    style={{ flex: 1, padding: '12px 16px', justifyContent: 'center' }}
                    disabled={busyId === inspecting.id}
                    onClick={() => openDiscard(inspecting)}
                  >
                    <span>{text.discard}</span>
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* 8. Discard Confirmation Modal */}
      <Modal open={Boolean(discarding)} onClose={() => setDiscarding(null)} title={text.discardTitle}>
        <div style={{ display: 'grid', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6 }}>
            {text.discardLede}
          </p>
          <label className="field">
            <span>{text.noteField}</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={text.notePlaceholder}
              style={{ width: '100%', padding: 10, borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--cs-glass-border)' }}
            />
          </label>
          {formError && (
            <p className="form-error" role="alert" style={{ margin: 0 }}>
              {formError}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="button button--secondary" onClick={() => setDiscarding(null)}>
              {text.cancel}
            </button>
            <button className="button button--primary" onClick={() => void confirmDiscard()}>
              {text.confirmDiscard}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
