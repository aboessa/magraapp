import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
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
  // التواريخ من D1 بصيغة "YYYY-MM-DD HH:MM:SS" بتوقيت UTC بلا لاحقة منطقة
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
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{ar ? 'الشراكات' : 'Partnerships'}</span>
          <h2>{ar ? 'طلبات الشراكة' : 'Partnership requests'}</h2>
          <p>
            {ar
              ? 'الطلبات الواردة من نموذج الشراكات في صفحة الهبوط: مدارس وحضانات ودور نشر ومنتجو محتوى ومعلّقون.'
              : 'Requests from the landing page partnerships form: schools, nurseries, publishers, producers and creators.'}
          </p>
        </div>
        <button className="button button--ghost" type="button" onClick={() => setSettingsOpen(true)}>
          <Icon name="bell" size={17} />
          {ar ? 'إعدادات البريد' : 'Email settings'}
        </button>
      </section>

      {inboxMissing && (
        <section className="panel panel--notice" role="alert">
          <strong>{ar ? 'لم يُضبط بريد الاستقبال' : 'Inbox email is not set'}</strong>
          <p>
            {ar
              ? 'الطلبات تُحفظ وتظهر هنا، لكن لا يُرسل إشعار بريدي حتى تضبط عنوان الاستقبال من «إعدادات البريد».'
              : 'Requests are still stored and listed here, but no email notification is sent until you set the inbox address under “Email settings”.'}
          </p>
        </section>
      )}

      {providerMissing && (
        <section className="panel panel--notice" role="alert">
          <strong>{ar ? 'لا مزوّد بريد مضبوط' : 'No email provider configured'}</strong>
          <p>
            {ar
              ? 'اضبط RESEND_API_KEY كسرّ في الـWorker، أو استخدم رابط EMAIL الخاص بـCloudflare مع التحقق من عنوان الاستقبال في لوحة Cloudflare أولًا.'
              : 'Set RESEND_API_KEY as a Worker secret, or use the Cloudflare EMAIL binding after verifying the destination address in the Cloudflare dashboard.'}
          </p>
        </section>
      )}

      {notice && (
        <section className="panel panel--notice" role="status">
          <strong>{notice}</strong>
          <button className="button button--ghost" type="button" onClick={() => setNotice('')}>
            {ar ? 'إخفاء' : 'Dismiss'}
          </button>
        </section>
      )}

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{ar ? 'كل الطلبات' : 'All requests'}</span>
            <h3>{meta?.total ?? items.length}</h3>
          </div>
          <div className="filters-row">
            <select
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1) }}
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
            >
              <option value="">{ar ? 'كل الأنواع' : 'All kinds'}</option>
              {KINDS.map((value) => (
                <option value={value} key={value}>{kindLabels[locale][value]}</option>
              ))}
            </select>
            <input
              className="search-field"
              type="search"
              value={search}
              placeholder={ar ? 'ابحث بالاسم أو الجهة أو البريد' : 'Search name, organisation or email'}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            />
          </div>
        </header>

        {loading ? (
          <LoadingState label={ar ? 'جارٍ التحميل...' : 'Loading...'} />
        ) : error && !items.length ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : items.length ? (
          <>
            {error && <p className="form-error" role="alert">{error}</p>}
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
          </>
        ) : (
          <EmptyState
            title={ar ? 'لا طلبات بعد' : 'No requests yet'}
            description={ar
              ? 'ستظهر هنا الطلبات المرسلة من قسم الشراكات في صفحة الهبوط.'
              : 'Requests submitted from the partnerships section of the landing page will appear here.'}
          />
        )}
      </section>

      <Modal
        open={Boolean(selected)}
        onClose={() => !savingRequest && setSelected(null)}
        title={selected ? selected.organization : ''}
      >
        {selected && (
          <div className="entity-form">
            <dl className="detail-list">
              <div><dt>{ar ? 'الاسم' : 'Name'}</dt><dd>{selected.name}</dd></div>
              <div><dt>{ar ? 'النوع' : 'Kind'}</dt><dd>{kindLabels[locale][selected.kind]}</dd></div>
              <div>
                <dt>{ar ? 'البريد' : 'Email'}</dt>
                <dd dir="ltr"><a href={`mailto:${selected.email}`}>{selected.email}</a></dd>
              </div>
              <div>
                <dt>{ar ? 'الهاتف' : 'Phone'}</dt>
                <dd dir="ltr">{selected.phone || '—'}</dd>
              </div>
              <div><dt>{ar ? 'البلد' : 'Country'}</dt><dd>{selected.country || '—'}</dd></div>
              <div><dt>{ar ? 'لغة الزائر' : 'Visitor language'}</dt><dd>{localeLabels[locale][selected.locale] ?? selected.locale}</dd></div>
              <div><dt>{ar ? 'وصل في' : 'Received'}</dt><dd>{formatDate(selected.created_at, locale)}</dd></div>
              <div>
                <dt>{ar ? 'الإشعار البريدي' : 'Email notification'}</dt>
                <dd>
                  <span className={`status-badge partner-email--${selected.email_status}`}>
                    {emailLabels[locale][selected.email_status]}
                  </span>
                </dd>
              </div>
            </dl>

            {selected.email_error && (
              <p className="form-error">{selected.email_error}</p>
            )}

            <label className="field">
              <span>{ar ? 'تفاصيل التعاون' : 'Collaboration details'}</span>
              <p className="detail-body">{selected.message}</p>
            </label>

            <label className="field">
              <span>{ar ? 'الحالة' : 'Status'}</span>
              <select
                value={selected.status}
                disabled={savingRequest}
                onChange={(event) => void changeStatus(selected, event.target.value as PartnershipStatus)}
              >
                {STATUSES.map((value) => (
                  <option value={value} key={value}>{statusLabels[locale][value]}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{ar ? 'ملاحظة داخلية' : 'Internal note'}</span>
              <textarea
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={ar ? 'لا تُعرض للمُرسل' : 'Never shown to the sender'}
              />
            </label>

            <div className="form-actions">
              <button
                className="button button--ghost"
                type="button"
                disabled={savingRequest || selected.email_status === 'sent'}
                onClick={() => void resend(selected)}
              >
                {ar ? 'إعادة إرسال الإشعار' : 'Resend notification'}
              </button>
              <button className="button button--primary" type="button" disabled={savingRequest} onClick={() => void saveNote()}>
                {ar ? 'حفظ الملاحظة' : 'Save note'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={settingsOpen}
        onClose={() => !savingSettings && setSettingsOpen(false)}
        title={ar ? 'إعدادات بريد الشراكات' : 'Partnership email settings'}
      >
        <form className="entity-form" onSubmit={submitSettings}>
          {settingsError && <p className="form-error" role="alert">{settingsError}</p>}

          <label className="field">
            <span>{ar ? 'بريد استقبال الطلبات *' : 'Inbox email *'}</span>
            <input
              type="email"
              dir="ltr"
              value={settings.partnership_inbox_email}
              placeholder="partners@majarra.app"
              onChange={(event) => setSettings({ ...settings, partnership_inbox_email: event.target.value })}
            />
            <small>
              {ar
                ? 'كل طلب جديد يُرسل إلى هذا العنوان، والرد عليه يذهب لصاحب الطلب مباشرة. اتركه فارغًا لتعطيل الإشعار مع الاستمرار في حفظ الطلبات.'
                : 'Every new request is sent to this address, and replying reaches the sender directly. Leave empty to disable notifications while still storing requests.'}
            </small>
          </label>

          <label className="field">
            <span>{ar ? 'نسخة كربونية' : 'CC recipients'}</span>
            <input
              type="text"
              dir="ltr"
              value={settings.partnership_cc_emails}
              placeholder="a@majarra.app, b@majarra.app"
              onChange={(event) => setSettings({ ...settings, partnership_cc_emails: event.target.value })}
            />
            <small>{ar ? 'عناوين مفصولة بفاصلة، اختياري.' : 'Comma separated, optional.'}</small>
          </label>

          <label className="field">
            <span>{ar ? 'عنوان المُرسل' : 'Sender address'}</span>
            <input
              type="email"
              dir="ltr"
              value={settings.partnership_from_email}
              placeholder={settingsMeta?.defaultFrom ?? 'accounts@majarra.app'}
              onChange={(event) => setSettings({ ...settings, partnership_from_email: event.target.value })}
            />
            <small>
              {ar
                ? `اتركه فارغًا لاستخدام العنوان الافتراضي${settingsMeta?.defaultFrom ? ` (${settingsMeta.defaultFrom})` : ''}. يجب أن يكون على نطاق موثّق عند المزوّد.`
                : `Leave empty to use the default${settingsMeta?.defaultFrom ? ` (${settingsMeta.defaultFrom})` : ''}. It must belong to a domain verified with the provider.`}
            </small>
          </label>

          <p className="detail-body">
            {ar ? 'مزوّد البريد الحالي: ' : 'Current email provider: '}
            <strong>
              {settingsMeta?.emailProvider === 'resend' ? 'Resend'
                : settingsMeta?.emailProvider === 'cloudflare' ? 'Cloudflare Email Routing'
                  : ar ? 'غير مضبوط' : 'not configured'}
            </strong>
            {settingsMeta?.emailProvider === 'cloudflare' && (
              <>
                {' — '}
                {ar
                  ? 'Cloudflare لا يرسل إلا إلى عنوان مُتحقَّق منه كـdestination address في نطاقك، فتحقّق من بريد الاستقبال في لوحة Cloudflare أولًا.'
                  : 'Cloudflare only delivers to an address verified as a destination address on your zone, so verify the inbox in the Cloudflare dashboard first.'}
              </>
            )}
          </p>

          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setSettingsOpen(false)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="button button--primary" disabled={savingSettings}>
              {ar ? 'حفظ' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
