import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
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
import type { AuditRecord } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'الحوكمة والأمان والمساءلة',
    title: 'سجل التدقيق الشامل والعمليات الإدارية',
    intro: 'سجل غير قابل للتعديل يوثق من قام بالتعديل، نوع المورد، والتفاصيل المحجوبة أمنياً عبر جميع وحدات الإدارة.',
    refresh: 'تحديث السجل',
    list: 'السجلات',
    total: 'إجمالي السجلات',
    allActions: 'كل الأفعال',
    allEntities: 'كل الأنواع',
    actorFilter: 'معرّف الفاعل...',
    fromDate: 'من تاريخ',
    toDate: 'إلى تاريخ',
    invalidRange: 'تاريخ البداية يجب ألا يكون بعد تاريخ النهاية.',
    when: 'التاريخ والتوقيت',
    actor: 'الفاعل',
    action: 'الفعل',
    entity: 'المورد',
    details: 'التفاصيل',
    loading: 'جارٍ تحميل سجل التدقيق...',
    loadError: 'تعذر تحميل سجل التدقيق',
    empty: 'لا توجد سجلات مطابقة',
    emptyDesc: 'يُكتب السجل عند أي تعديل. غيّر عوامل التصفية لرؤية سجلات سابقة.',
    systemActor: 'مفتاح مشترك (System)',
    systemActorHint: 'عملية نُفِّذت بمفتاح API الإداري.',
    noDetails: 'لا توجد تفاصيل إضافية',
    redacted: 'محجوب أمنياً',
    redactedHint: 'الرموز والبيانات الحساسة تُحجب على الخادم قبل الحفظ.',
    inspect: 'فحص السجل',
    drawerTitle: 'التفاصيل الجنائية لعملية التدقيق',
    systemBeacon: 'سجل التدقيق غير القابل للتعديل',
    beaconSub: 'توثيق رقابي مؤمّن ومشفّر لكافة التعديلات',
    actorId: 'معرّف الفاعل (Actor ID)',
    copied: 'تم النسخ!',
    copyId: 'نسخ المعرّف',
    createCount: 'عمليات إنشاء',
    updateCount: 'عمليات تعديل',
    deleteCount: 'عمليات حذف وأرشفة',
  },
  en: {
    eyebrow: 'Security, Governance & Audit',
    title: 'Audit Log & Forensic Activity Ledger',
    intro: 'Immutable governance ledger recording who modified what, target resources, and redacted payload parameters across all admin modules.',
    refresh: 'Refresh Log',
    list: 'Entries',
    total: 'Total Entries',
    allActions: 'All Actions',
    allEntities: 'All Types',
    actorFilter: 'Actor ID...',
    fromDate: 'From Date',
    toDate: 'To Date',
    invalidRange: 'The start date must not be after the end date.',
    when: 'Timestamp',
    actor: 'Actor',
    action: 'Action',
    entity: 'Resource',
    details: 'Details',
    loading: 'Loading audit ledger...',
    loadError: 'Unable to load audit log',
    empty: 'No matching entries',
    emptyDesc: 'An entry is written on every change. Adjust filters or perform an action to view records here.',
    systemActor: 'Shared Key (System)',
    systemActorHint: 'Action executed via backend administrative API key.',
    noDetails: 'No extra details',
    redacted: 'Redacted',
    redactedHint: 'Tokens, passwords, and sensitive child fields are sanitized before write.',
    inspect: 'Inspect Entry',
    drawerTitle: 'Audit Forensic Dossier',
    systemBeacon: 'Immutable Audit Ledger',
    beaconSub: 'Cryptographically protected operational accountability',
    actorId: 'Actor ID',
    copied: 'Copied!',
    copyId: 'Copy ID',
    createCount: 'Creations',
    updateCount: 'Updates',
    deleteCount: 'Deletions & Archives',
  },
}

const KNOWN_ACTIONS = ['create', 'update', 'delete', 'archive', 'rederive_tracks'] as const

const actionLabels: Record<'ar' | 'en', Record<string, string>> = {
  ar: {
    create: 'إنشاء',
    update: 'تعديل',
    delete: 'حذف',
    archive: 'أرشفة',
    rederive_tracks: 'إعادة اشتقاق المسارات',
  },
  en: {
    create: 'Create',
    update: 'Update',
    delete: 'Delete',
    archive: 'Archive',
    rederive_tracks: 'Re-derive tracks',
  },
}

const NON_IDENTITIES = ['admin-api-key', 'legacy-admin-key', 'admin']

function readDetails(raw: string): { key: string; value: string }[] | { raw: string } {
  if (!raw || raw === '{}') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { raw }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { raw }

  return Object.entries(parsed as Record<string, unknown>)
    .filter(([key]) => key !== 'claimed_actor')
    .map(([key, value]) => ({
      key,
      value:
        typeof value === 'string'
          ? value
          : value === null || value === undefined
          ? '—'
          : JSON.stringify(value),
    }))
}

const LIMIT = 50
const DEFAULT_FILTERS = { actor_id: '', action: '', entity_type: '', from: '', to: '' }

const FILTER_FIELDS = (
  text: (typeof copy)['ar'],
  locale: 'ar' | 'en',
  entityTypes: string[],
): FilterField[] => [
  {
    key: 'actor_id',
    label: text.actor,
    type: 'text',
    chip: (value) => `${text.actor}: ${value}`,
  },
  {
    key: 'action',
    label: text.action,
    type: 'select',
    options: [
      { value: '', label: text.allActions },
      ...KNOWN_ACTIONS.map((item) => ({ value: item, label: actionLabels[locale][item] ?? item })),
    ],
  },
  {
    key: 'entity_type',
    label: text.entity,
    type: 'select',
    options: [{ value: '', label: text.allEntities }, ...entityTypes.map((item) => ({ value: item, label: item }))],
  },
  { key: 'from', label: text.fromDate, type: 'date', chip: (value) => `${text.fromDate}: ${value}` },
  { key: 'to', label: text.toDate, type: 'date', chip: (value) => `${text.toDate}: ${value}` },
]

export function AuditLogPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()

  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { filters, offset, limit } = list
  const { actor_id: actor, action, entity_type: entityType, from: fromDate, to: toDate } = filters
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inspecting, setInspecting] = useState<AuditRecord | null>(null)
  const [copiedId, setCopiedId] = useState(false)

  const rangeInvalid = Boolean(fromDate && toDate && fromDate > toDate)

  const load = useCallback(async () => {
    if (rangeInvalid) return
    setLoading(true)
    setError('')
    try {
      const response = await api.auditLogs({
        action,
        entity_type: entityType,
        actor_id: actor.trim(),
        from: fromDate,
        to: toDate,
        limit,
        offset,
      })
      setRecords(response.data)
      setTotal(response.meta?.total ?? response.data.length)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [action, actor, entityType, fromDate, toDate, limit, offset, rangeInvalid, text.loadError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  const entityTypes = useMemo(
    () => Array.from(new Set(records.map((r) => r.entity_type).filter(Boolean))).sort(),
    [records],
  )

  const createCount = records.filter((r) => r.action === 'create').length
  const updateCount = records.filter((r) => r.action === 'update').length
  const deleteCount = records.filter((r) => r.action === 'delete' || r.action === 'archive').length

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const getActionTheme = (act: string) => {
    if (act === 'create') return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: actionLabels[locale].create ?? act }
    if (act === 'update') return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', label: actionLabels[locale].update ?? act }
    if (act === 'delete' || act === 'archive') return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', label: actionLabels[locale][act] ?? act }
    return { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', label: act }
  }

  return (
    <div className="content-studio-root">
      {/* 1. Master Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className="status-beacon__dot status-beacon__dot--indigo" />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">{text.systemBeacon}</span>
              <span className="status-beacon__sub">{text.beaconSub}</span>
            </div>
          </div>

          <div className="filter-pill-group" style={{ marginInlineStart: 12 }}>
            <button
              className={`filter-pill ${filters.action === '' ? 'filter-pill--active' : ''}`}
              onClick={() => list.setFilter('action', '')}
            >
              {text.allActions}
            </button>
            {KNOWN_ACTIONS.map((a) => (
              <button
                key={a}
                className={`filter-pill ${filters.action === a ? 'filter-pill--active' : ''}`}
                onClick={() => list.setFilter('action', a)}
              >
                {actionLabels[locale][a] ?? a}
              </button>
            ))}
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
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, rgba(14, 165, 233, 0.16) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#6366f1' }} />
              {formatNumber(total, locale)} {text.total}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.intro}</p>
        </div>
      </section>

      {/* 3. Executive Bento Live Metrics Matrix */}
      <div className="commercial-bento-grid">
        <div className="commercial-bento-card commercial-bento-card--indigo" onClick={() => list.clearFilters()} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.total}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="objectives" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(total, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'جميع السجلات الموثقة' : 'All recorded logs'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald" onClick={() => list.setFilter('action', 'create')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.createCount}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="plus" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(createCount, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'إضافة كيانات جديدة' : 'Created entities'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber" onClick={() => list.setFilter('action', 'update')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.updateCount}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="palette" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(updateCount, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              {locale === 'ar' ? 'تعديل بيانات وإعدادات' : 'Entity modifications'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--rose" onClick={() => list.setFilter('action', 'delete')} style={{ cursor: 'pointer' }}>
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.deleteCount}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="warning" size={20} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{formatNumber(deleteCount, locale)}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">
              {locale === 'ar' ? 'إجراءات حساسة ومدققة' : 'Audited sensitive actions'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Catalog Control Strip & Filter Tools */}
      <section className="catalog-control-strip" style={{ marginTop: 24 }}>
        <div className="catalog-control-strip__left">
          <ListToolbar
            searchValue={list.filters.actor_id}
            onSearchChange={(value) => list.setFilter('actor_id', value)}
            searchPlaceholder={text.actorFilter}
            fields={FILTER_FIELDS(text, locale, entityTypes)}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')}
            trailing={
              <SavedViewsMenu
                storageKey="audit-logs"
                currentSearch={list.search}
                onApply={(search) => navigate(`${adminPath('audit-logs')}${search}`)}
              />
            }
          />
        </div>
      </section>

      {/* 5. Main Audit Ledger Table */}
      {loading && !records.length ? (
        <LoadingState label={text.loading} />
      ) : error && !records.length ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : records.length === 0 ? (
        <EmptyState title={text.empty} description={text.emptyDesc} />
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
                  <th>{text.actor}</th>
                  <th>{text.action}</th>
                  <th>{text.entity}</th>
                  <th>{text.details}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((row) => {
                  const isSystem = NON_IDENTITIES.includes(row.actor_id ?? '')
                  const details = readDetails(row.details)
                  const theme = getActionTheme(row.action)
                  return (
                    <tr key={row.id} onClick={() => setInspecting(row)} style={{ cursor: 'pointer' }}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                        {formatDate(row.created_at, locale)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className="entity-avatar"
                            style={{
                              background: isSystem ? 'rgba(148, 163, 184, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                              color: isSystem ? '#94a3b8' : '#818cf8',
                              fontWeight: 800,
                            }}
                          >
                            {isSystem ? 'S' : (row.actor_id || 'U').charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <strong style={{ fontSize: 13, color: 'var(--text)' }}>
                              {isSystem ? text.systemActor : row.actor_id}
                            </strong>
                            {isSystem && (
                              <small style={{ display: 'block', color: 'var(--muted)', fontSize: 10.5 }}>
                                {text.systemActorHint}
                              </small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 14,
                            fontSize: 11,
                            fontWeight: 800,
                            background: theme.bg,
                            color: theme.color,
                            border: '1px solid currentColor',
                          }}
                        >
                          {theme.label}
                        </span>
                      </td>
                      <td>
                        <div>
                          <strong style={{ fontSize: 13, color: 'var(--text)' }}>{row.entity_type}</strong>
                          {row.entity_id && (
                            <code dir="ltr" style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                              {row.entity_id.slice(0, 16)}…
                            </code>
                          )}
                        </div>
                      </td>
                      <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {'raw' in details ? (
                          <code dir="ltr" style={{ fontSize: 11, color: 'var(--muted)' }}>{details.raw}</code>
                        ) : details.length ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {details.slice(0, 2).map((d) => (
                              <span
                                key={d.key}
                                style={{
                                  background: 'var(--surface-2)',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  color: 'var(--text-soft)',
                                }}
                              >
                                <strong>{d.key}:</strong> {d.value}
                              </span>
                            ))}
                            {details.length > 2 && (
                              <span style={{ fontSize: 10, color: 'var(--muted)' }}>+{details.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: 11 }}>{text.noDetails}</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          onClick={() => setInspecting(row)}
                          title={text.inspect}
                        >
                          <Icon name="objectives" size={13} />
                          <span>{text.inspect}</span>
                        </button>
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

      {/* 6. Slide-Over Audit Forensic Drawer */}
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
              maxWidth: 520,
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
                background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                  {inspecting.action.toUpperCase()} · {inspecting.entity_type}
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
              {/* Actor Box */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  {text.actorId}
                </label>
                <div className="token-copy-box">
                  <code style={{ fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {inspecting.actor_id}
                  </code>
                  <button
                    className="button button--ghost button--small"
                    onClick={() => copyToClipboard(inspecting.actor_id ?? '')}
                    style={{ flexShrink: 0, padding: '4px 8px' }}
                  >
                    {copiedId ? text.copied : text.copyId}
                  </button>
                </div>
              </div>

              {/* Entity Target Box */}
              {inspecting.entity_id && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                    {text.entity} ({inspecting.entity_type})
                  </label>
                  <div className="token-copy-box">
                    <code style={{ fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                      {inspecting.entity_id}
                    </code>
                    <button
                      className="button button--ghost button--small"
                      onClick={() => copyToClipboard(inspecting.entity_id!)}
                      style={{ flexShrink: 0, padding: '4px 8px' }}
                    >
                      {copiedId ? text.copied : text.copyId}
                    </button>
                  </div>
                </div>
              )}

              {/* Timestamp and Action Badge */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                  background: 'var(--surface-2)',
                  padding: 16,
                  borderRadius: 14,
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{text.action}</span>
                  <strong style={{ fontSize: 14, color: getActionTheme(inspecting.action).color }}>
                    {inspecting.action}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{text.when}</span>
                  <strong style={{ fontSize: 12, color: 'var(--text)' }}>
                    {formatDate(inspecting.created_at, locale)}
                  </strong>
                </div>
              </div>

              {/* Details Key-Value or JSON */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                  {text.details}
                </label>
                {(() => {
                  const details = readDetails(inspecting.details)
                  if ('raw' in details) {
                    return (
                      <pre
                        dir="ltr"
                        style={{
                          margin: 0,
                          padding: 14,
                          borderRadius: 10,
                          background: 'var(--surface-2)',
                          border: '1px solid var(--cs-glass-border)',
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: 'var(--text)',
                          maxHeight: 240,
                          overflow: 'auto',
                        }}
                      >
                        {details.raw}
                      </pre>
                    )
                  }
                  if (!details.length) {
                    return (
                      <div style={{ fontSize: 12, color: 'var(--muted)', padding: 12, background: 'var(--surface-2)', borderRadius: 10 }}>
                        {text.noDetails}
                      </div>
                    )
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {details.map((d) => (
                        <div
                          key={d.key}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            background: 'var(--surface-2)',
                            border: '1px solid var(--cs-glass-border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{d.key}</span>
                          <strong style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>{d.value}</strong>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* Redaction Notice */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--cs-glass-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Icon name="objectives" size={16} />
                <span style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4 }}>
                  {text.redactedHint}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}