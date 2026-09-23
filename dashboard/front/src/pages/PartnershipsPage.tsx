import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ViewSwitcher } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type {
  PartnershipEmailStatus,
  PartnershipKind,
  PartnershipListMeta,
  PartnershipRequest,
  PartnershipSettings,
  PartnershipSettingsEnvelope,
  PartnershipStatus,
} from '../types/api'

const STATUSES: PartnershipStatus[] = ['new', 'in_review', 'contacted', 'accepted', 'declined', 'spam']
const KINDS: PartnershipKind[] = ['school', 'nursery', 'publisher', 'producer', 'creator', 'other']

const statusLabels: Record<'ar' | 'en', Record<PartnershipStatus, string>> = {
  ar: { new: 'جديد', in_review: 'قيد المراجعة', contacted: 'تم التواصل', accepted: 'مقبول', declined: 'مرفوض', spam: 'سبام' },
  en: { new: 'New', in_review: 'In review', contacted: 'Contacted', accepted: 'Accepted', declined: 'Declined', spam: 'Spam' },
}

const kindLabels: Record<'ar' | 'en', Record<PartnershipKind, string>> = {
  ar: { school: 'مدرسة', nursery: 'حضانة أو روضة', publisher: 'دار نشر', producer: 'منتج محتوى', creator: 'معلّق أو مبدع', other: 'أخرى' },
  en: { school: 'School', nursery: 'Nursery', publisher: 'Publisher', producer: 'Producer', creator: 'Creator', other: 'Other' },
}

const emailLabels: Record<'ar' | 'en', Record<PartnershipEmailStatus, string>> = {
  ar: { pending: 'قيد الإرسال', sent: 'أُرسل', failed: 'فشل', skipped: 'لم يُرسل' },
  en: { pending: 'Pending', sent: 'Sent', failed: 'Failed', skipped: 'Skipped' },
}

const localeLabels: Record<'ar' | 'en', Record<string, string>> = {
  ar: { ar: 'العربية', en: 'الإنجليزية', fr: 'الفرنسية' },
  en: { ar: 'Arabic', en: 'English', fr: 'French' },
}

const EMPTY_SETTINGS: PartnershipSettings = {
  partnership_inbox_email: '',
  partnership_from_email: '',
  partnership_cc_emails: '',
}

function formatDate(value: string, locale: 'ar' | 'en') {
  const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function PartnershipsPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  const [items, setItems] = useState<PartnershipRequest[]>([])
  const [meta, setMeta] = useState<PartnershipListMeta | null>(null)
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  const [selected, setSelected] = useState<PartnershipRequest | null>(null)
  const [note, setNote] = useState('')
  const [savingRequest, setSavingRequest] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<PartnershipSettings>(EMPTY_SETTINGS)
  const [settingsMeta, setSettingsMeta] = useState<PartnershipSettingsEnvelope | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.partnerships({
        status: status || undefined,
        kind: kind || undefined,
        search: search || undefined,
        page,
        limit: 25,
      })
      setItems(response.data)
      setMeta(response.meta)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الطلبات' : 'Unable to load requests')
    } finally {
      setLoading(false)
    }
  }, [ar, kind, page, search, status])

  useEffect(() => { void load() }, [load])

  const loadSettings = useCallback(async () => {
    setSettingsError('')
    try {
      const response = await api.partnershipSettings()
      setSettings({ ...EMPTY_SETTINGS, ...response.data.settings })
      setSettingsMeta(response.data)
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الإعدادات' : 'Unable to load settings')
    }
  }, [ar])

  useEffect(() => { void loadSettings() }, [loadSettings])

  function openRequest(item: PartnershipRequest) {
    setSelected(item)
    setNote(item.admin_note ?? '')
  }

  async function changeStatus(item: PartnershipRequest, next: PartnershipStatus) {
    setSavingRequest(true)
    setError('')
    try {
      const response = await api.updatePartnership(item.id, { status: next })
      setItems((current) => current.map((row) => (row.id === item.id ? response.data : row)))
      if (selected?.id === item.id) setSelected(response.data)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحديث الحالة' : 'Unable to update status')
    } finally {
      setSavingRequest(false)
    }
  }

  async function saveNote() {
    if (!selected) return
    setSavingRequest(true)
    try {
      const response = await api.updatePartnership(selected.id, { admin_note: note })
      setItems((current) => current.map((row) => (row.id === selected.id ? response.data : row)))
      setSelected(response.data)
      setNotice(ar ? 'حُفظت الملاحظة' : 'Note saved')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر حفظ الملاحظة' : 'Unable to save note')
    } finally {
      setSavingRequest(false)
    }
  }

  async function resend(item: PartnershipRequest) {
    setSavingRequest(true)
    setError('')
    try {
      await api.resendPartnership(item.id)
      setNotice(ar ? 'أُعيد إرسال الإشعار' : 'Notification resent')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر إعادة الإرسال' : 'Unable to resend')
    } finally {
      setSavingRequest(false)
    }
  }

  async function submitSettings(event: FormEvent) {
    event.preventDefault()
    setSavingSettings(true)
    setSettingsError('')
    try {
      await api.savePartnershipSettings(settings)
      await loadSettings()
      setSettingsOpen(false)
      setNotice(ar ? 'حُفظت إعدادات البريد' : 'Email settings saved')
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : ar ? 'تعذر الحفظ' : 'Unable to save')
    } finally {
      setSavingSettings(false)
    }
  }

  const counts = meta?.counts ?? {}
  const inboxMissing = settingsMeta !== null && !settingsMeta.inboxConfigured
  const providerMissing = settingsMeta?.emailProvider === 'none'

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Studio Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(16, 185, 129, 0.16) 50%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{ar ? 'الشراكات والمؤسسات' : 'Partnerships & Growth'}</span>
            <span className="catalog-hero__status-badge" style={{ borderColor: 'rgba(14, 165, 233, 0.3)', color: '#0ea5e9' }}>
              <span className="status-dot-pulse" style={{ background: '#0ea5e9' }} />
              {meta?.total ?? items.length} {ar ? 'طلب شراكة مسجل' : 'requests'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{ar ? 'طلبات الشراكة المؤسسية' : 'Partnership Requests'}</h1>
          <p className="catalog-hero__desc">
            {ar
              ? 'الطلبات الواردة من نموذج الشراكات في الموقع العام: مدارس، حضانات، دور نشر، استوديوهات، ومبدعون.'
              : 'Requests from landing page partnership channels: schools, nurseries, publishers, and studios.'}
          </p>
        </div>

        <div className="catalog-hero__actions">
          <button className="button button--ghost" type="button" onClick={() => setSettingsOpen(true)}>
            <Icon name="settings" size={16} />
            <span>{ar ? 'إعدادات البريد' : 'Email settings'}</span>
          </button>
        </div>
      </section>

      {/* 2. Bento Glass KPI Strip */}
      <div className="hero-kpis">
        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Icon name="bell" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{statusLabels[locale].new}</span>
            <div className="kpi-glass-card__num">{counts.new ?? 0}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#3b82f6' }}>
              {ar ? 'في انتظار المراجعة' : 'Pending review'}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Icon name="clock" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{statusLabels[locale].in_review}</span>
            <div className="kpi-glass-card__num">{counts.in_review ?? 0}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#f59e0b' }}>
              {ar ? 'تحت الدراسة الإدارية' : 'Under evaluation'}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <Icon name="chat" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{statusLabels[locale].contacted}</span>
            <div className="kpi-glass-card__num">{counts.contacted ?? 0}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#a855f7' }}>
              {ar ? 'تم التواصل مع الجهة' : 'Outreach initiated'}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="check" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{statusLabels[locale].accepted}</span>
            <div className="kpi-glass-card__num">{counts.accepted ?? 0}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              {ar ? 'شراكات معتمدة' : 'Approved partnerships'}
            </span>
          </div>
        </div>
      </div>

      {inboxMissing && (
        <div className="inline-alert inline-alert--warning" role="alert" style={{ marginBottom: 14 }}>
          <Icon name="alert-triangle" size={16} />
          <div>
            <strong>{ar ? 'لم يُضبط بريد الاستقبال' : 'Inbox email is not set'}</strong>
            <p style={{ margin: '4px 0 0 0' }}>
              {ar
                ? 'الطلبات تُحفظ وتظهر هنا، لكن لا يُرسل إشعار بريدي حتى تضبط عنوان الاستقبال من «إعدادات البريد».'
                : 'Requests are still stored and listed here, but no email notification is sent until you set the inbox address under “Email settings”.'}
            </p>
          </div>
        </div>
      )}

      {providerMissing && (
        <div className="inline-alert inline-alert--warning" role="alert" style={{ marginBottom: 14 }}>
          <Icon name="alert-triangle" size={16} />
          <div>
            <strong>{ar ? 'لا مزوّد بريد مضبوط' : 'No email provider configured'}</strong>
            <p style={{ margin: '4px 0 0 0' }}>
              {ar
                ? 'اضبط RESEND_API_KEY كسرّ في الـWorker، أو استخدم رابط EMAIL الخاص بـCloudflare.'
                : 'Set RESEND_API_KEY as a Worker secret, or use the Cloudflare EMAIL binding.'}
            </p>
          </div>
        </div>
      )}

      {notice && (
        <div className="inline-alert inline-alert--info" role="status" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{notice}</strong>
          <button className="button button--ghost button--small" type="button" onClick={() => setNotice('')}>
            {ar ? 'إخفاء' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* 3. Studio Control Strip */}
      <div className="catalog-control-strip">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          <div className="search-box" style={{ maxWidth: 300 }}>
            <input
              className="search-box__input"
              type="search"
              value={search}
              placeholder={ar ? 'ابحث بالاسم أو الجهة أو البريد...' : 'Search name, org, email...'}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1) }}
              className="filter-pill-select"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: 'inherit',
                fontSize: 13,
              }}
            >
              <option value="">{ar ? 'كل الحالات' : 'All statuses'}</option>
              {STATUSES.map((value) => (
                <option value={value} key={value}>
                  {statusLabels[locale][value]}
                  {counts[value] ? ` (${counts[value]})` : ''}
                </option>
              ))}
            </select>

            <select
              value={kind}
              onChange={(event) => { setKind(event.target.value); setPage(1) }}
              className="filter-pill-select"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: 'inherit',
                fontSize: 13,
              }}
            >
              <option value="">{ar ? 'كل الأنواع' : 'All kinds'}</option>
              {KINDS.map((value) => (
                <option value={value} key={value}>{kindLabels[locale][value]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="catalog-control-strip__right" style={{ alignSelf: 'center' }}>
          <ViewSwitcher
            modes={['table', 'cards']}
            value={viewMode}
            onChange={setViewMode}
            labels={{ table: ar ? 'جدول الطلبات' : 'Table', cards: ar ? 'بطاقات الشركاء' : 'Cards' }}
          />
        </div>
      </div>

      {/* 4. Main Body: Cards or Table */}
      {loading ? (
        <LoadingState label={ar ? 'جارٍ التحميل...' : 'Loading...'} />
      ) : error && !items.length ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={ar ? 'لا توجد طلبات شراكة' : 'No partnership requests'}
          description={ar ? 'ستظهر هنا طلبات المدارس والمؤسسات المسجلة عبر الموقع' : 'Incoming organization inquiries will appear here'}
        />
      ) : viewMode === 'cards' ? (
        <div className="partnerships-studio-grid">
          {items.map((item) => (
            <div key={item.id} className="partnership-card-item">
              <div className="partnership-card-item__header">
                <div>
                  <span className="track-badge" style={{ marginBottom: 6, display: 'inline-block' }}>
                    {kindLabels[locale][item.kind]}
                  </span>
                  <h3 className="partnership-card-item__org">{item.organization}</h3>
                  <div className="partnership-card-item__name">{item.name}</div>
                </div>
                <span className={`status-badge partner-status--${item.status}`}>
                  {statusLabels[locale][item.status]}
                </span>
              </div>

              <div className="partnership-card-item__body">
                <div className="partnership-card-item__row">
                  <span className="partnership-card-item__label">{ar ? 'البريد الإلكتروني' : 'Email'}:</span>
                  <code dir="ltr" style={{ color: '#38bdf8' }}>{item.email}</code>
                </div>
                <div className="partnership-card-item__row">
                  <span className="partnership-card-item__label">{ar ? 'الدولة واللغة' : 'Country / Lang'}:</span>
                  <span>{item.country || '—'} · {localeLabels[locale][item.locale] ?? item.locale}</span>
                </div>
                <div className="partnership-card-item__row">
                  <span className="partnership-card-item__label">{ar ? 'حالة الإشعار' : 'Notification'}:</span>
                  <span className={`status-badge partner-email--${item.email_status}`}>
                    {emailLabels[locale][item.email_status]}
                  </span>
                </div>
              </div>

              <div className="partnership-card-item__footer">
                <small style={{ color: 'var(--text-muted)' }}>{formatDate(item.created_at, locale)}</small>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={() => openRequest(item)}
                >
                  <Icon name="edit" size={14} />
                  <span>{ar ? 'معاينة وإجراء' : 'View'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{ar ? 'الجهة' : 'Organisation'}</th>
                  <th>{ar ? 'النوع' : 'Kind'}</th>
                  <th>{ar ? 'البريد' : 'Email'}</th>
                  <th>{ar ? 'البلد' : 'Country'}</th>
                  <th>{ar ? 'اللغة' : 'Language'}</th>
                  <th>{ar ? 'الإشعار' : 'Notification'}</th>
                  <th>{ar ? 'الحالة' : 'Status'}</th>
                  <th>{ar ? 'التاريخ' : 'Date'}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button className="entity-cell entity-cell--button" type="button" onClick={() => openRequest(item)}>
                        <div>
                          <strong>{item.organization}</strong>
                          <small>{item.name}</small>
                        </div>
                      </button>
                    </td>
                    <td>{kindLabels[locale][item.kind]}</td>
                    <td dir="ltr">{item.email}</td>
                    <td>{item.country || '—'}</td>
                    <td>{localeLabels[locale][item.locale] ?? item.locale}</td>
                    <td>
                      <span className={`status-badge partner-email--${item.email_status}`}>
                        {emailLabels[locale][item.email_status]}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge partner-status--${item.status}`}>
                        {statusLabels[locale][item.status]}
                      </span>
                    </td>
                    <td>{formatDate(item.created_at, locale)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-button icon-button--small"
                          type="button"
                          title={ar ? 'التفاصيل' : 'Details'}
                          onClick={() => openRequest(item)}
                        >
                          <Icon name="edit" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.pages > 1 && (
            <footer className="panel__footer">
              <button
                className="button button--ghost"
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                {ar ? 'السابق' : 'Previous'}
              </button>
              <span>{ar ? `صفحة ${page} من ${meta.pages}` : `Page ${page} of ${meta.pages}`}</span>
              <button
                className="button button--ghost"
                type="button"
                disabled={page >= meta.pages}
                onClick={() => setPage((current) => Math.min(current + 1, meta.pages))}
              >
                {ar ? 'التالي' : 'Next'}
              </button>
            </footer>
          )}
        </section>
      )}

      {/* Slide-over detail modal for request */}
      {selected && (
        <Modal
          open
          title={selected.organization}
          onClose={() => setSelected(null)}
        >
          <div className="partnership-detail">
            <div className="partnership-detail__meta">
              <div>
                <span className="field-label">{ar ? 'الممثل' : 'Representative'}</span>
                <strong>{selected.name}</strong>
              </div>
              <div>
                <span className="field-label">{ar ? 'البريد' : 'Email'}</span>
                <a href={`mailto:${selected.email}`} dir="ltr">{selected.email}</a>
              </div>
              {selected.phone && (
                <div>
                  <span className="field-label">{ar ? 'الهاتف' : 'Phone'}</span>
                  <a href={`tel:${selected.phone}`} dir="ltr">{selected.phone}</a>
                </div>
              )}
              {selected.country && (
                <div>
                  <span className="field-label">{ar ? 'البلد' : 'Country'}</span>
                  <span>{selected.country}</span>
                </div>
              )}
              <div>
                <span className="field-label">{ar ? 'النوع' : 'Kind'}</span>
                <span>{kindLabels[locale][selected.kind]}</span>
              </div>
              <div>
                <span className="field-label">{ar ? 'لغة التقديم' : 'Locale'}</span>
                <span>{localeLabels[locale][selected.locale] ?? selected.locale}</span>
              </div>
              <div>
                <span className="field-label">{ar ? 'تاريخ التقديم' : 'Submitted'}</span>
                <span>{formatDate(selected.created_at, locale)}</span>
              </div>
              <div>
                <span className="field-label">{ar ? 'إشعار البريد' : 'Email notification'}</span>
                <span className={`status-badge partner-email--${selected.email_status}`}>
                  {emailLabels[locale][selected.email_status]}
                </span>
                {selected.email_status === 'failed' && (
                  <button
                    className="button button--ghost button--small"
                    type="button"
                    disabled={savingRequest}
                    onClick={() => void resend(selected)}
                    style={{ marginInlineStart: 8 }}
                  >
                    {ar ? 'إعادة الإرسال' : 'Resend'}
                  </button>
                )}
              </div>
            </div>

            <div className="partnership-detail__message">
              <h4>{ar ? 'رسالة الطلب' : 'Request message'}</h4>
              <p>{selected.message}</p>
            </div>

            <div className="partnership-detail__status">
              <h4>{ar ? 'تغيير الحالة' : 'Change status'}</h4>
              <div className="status-buttons">
                {STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`button button--small ${selected.status === st ? 'button--primary' : 'button--ghost'}`}
                    disabled={savingRequest}
                    onClick={() => void changeStatus(selected, st)}
                  >
                    {statusLabels[locale][st]}
                  </button>
                ))}
              </div>
            </div>

            <div className="partnership-detail__note">
              <h4>{ar ? 'ملاحظة إدارية خاصة' : 'Internal note'}</h4>
              <textarea
                rows={4}
                value={note}
                placeholder={ar ? 'اكتب ملاحظة حول التواصل مع الجهة...' : 'Write an internal note...'}
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="form-actions" style={{ marginTop: 10 }}>
                <button
                  className="button button--primary button--small"
                  type="button"
                  disabled={savingRequest}
                  onClick={() => void saveNote()}
                >
                  {savingRequest ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ الملاحظة' : 'Save note')}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Email settings modal */}
      {settingsOpen && (
        <Modal
          open
          title={ar ? 'إعدادات إشعارات البريد' : 'Email notification settings'}
          onClose={() => setSettingsOpen(false)}
        >
          <form className="entity-form" onSubmit={(e) => void submitSettings(e)}>
            {settingsError && <p className="field__error" role="alert">{settingsError}</p>}
            <label className="field">
              <span>{ar ? 'بريد الاستقبال (Inbox)' : 'Inbox email'} *</span>
              <input
                type="email"
                dir="ltr"
                required
                value={settings.partnership_inbox_email}
                placeholder="partnerships@majarra.app"
                onChange={(e) => setSettings({ ...settings, partnership_inbox_email: e.target.value })}
              />
              <small>{ar ? 'العنوان الذي تصله الإشعارات بكل طلب شراكة جديد.' : 'Address to receive new partnership alerts.'}</small>
            </label>

            <label className="field">
              <span>{ar ? 'بريد الإرسال (From)' : 'From email'}</span>
              <input
                type="email"
                dir="ltr"
                value={settings.partnership_from_email}
                placeholder="notifications@majarra.app"
                onChange={(e) => setSettings({ ...settings, partnership_from_email: e.target.value })}
              />
            </label>

            <label className="field">
              <span>{ar ? 'نسخة إضافية (CC)' : 'CC emails'}</span>
              <input
                dir="ltr"
                value={settings.partnership_cc_emails}
                placeholder="team@majarra.app, ceo@majarra.app"
                onChange={(e) => setSettings({ ...settings, partnership_cc_emails: e.target.value })}
              />
              <small>{ar ? 'عناوين مفصولة بفواصل.' : 'Comma-separated email addresses.'}</small>
            </label>

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button className="button button--ghost" type="button" onClick={() => setSettingsOpen(false)}>
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button className="button button--primary" type="submit" disabled={savingSettings}>
                {savingSettings ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ الإعدادات' : 'Save settings')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
