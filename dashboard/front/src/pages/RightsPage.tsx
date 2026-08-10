import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
import type { RightsLicenseRecord } from '../types/api'

/**
 * الحقوق والتراخيص.
 *
 * ## ما كانت عليه
 *
 * زر «إضافة حق» كان يجمع `content_id` و`owner` بـ`prompt()` ثم **يثبّت الباقي
 * في الكود**:
 *
 *   license_type: 'exclusive', countries: ['EG','SA'],
 *   languages: ['ar'], expiry_date: '2027-12-31'
 *
 * أي أن كل ترخيص يُنشأ من اللوحة كان حصريًا لمصر والسعودية بالعربية فقط منتهيًا
 * في 2027-12-31، أيًا كان الاتفاق الحقيقي. وهذه بيانات قانونية: تسجيلها خطأ
 * أسوأ من عدم تسجيلها.
 *
 * ثم `location.reload()` بلا فحص الاستجابة، فالفشل يبدو نجاحًا.
 *
 * ووصف الصفحة كان يَعِد بالتحكم في «الأجهزة والباقات وOffline» ولا يجمع شيئًا
 * منها.
 *
 * ## ما صارت عليه
 *
 * نموذج حقيقي يجمع كل الحقول، والأعمدة المخزَّنة كنصوص JSON تُعرض مفكوكة.
 */

const LICENSE_TYPES = ['exclusive', 'non_exclusive', 'owned'] as const

const copy = {
  ar: {
    eyebrow: 'الحقوق والتراخيص',
    title: 'إدارة الحقوق',
    lede: 'سجل إداري لمالك الحق ونوع الترخيص والدول واللغات والأجهزة وتاريخ الانتهاء. لا يفرض هذا السجل حجب النشر أو التشغيل بعد؛ الحقوق المنتهية تُبرز للتنبيه فقط.',
    add: 'حق جديد',
    search: 'بحث بالمالك أو معرّف المحتوى…',
    filterNote: 'البحث والفلاتر والترقيم كلها على الخادم: الرابط قابل للمشاركة ويفتح المجموعة نفسها.',
    expiringSoon: 'ينتهي خلال ٦٠ يومًا',
    allTypes: 'كل الأنواع',
    content: 'المحتوى',
    owner: 'المالك',
    type: 'النوع',
    countries: 'الدول',
    languages: 'اللغات',
    devices: 'الأجهزة',
    expires: 'الانتهاء',
    perpetual: 'دائم',
    expired: 'منتهي',
    all: 'الجميع',
    contentIdLabel: 'معرّف المحتوى',
    contentIdHint: 'معرّف سلسلة منشورة أو مسودة غير مؤرشفة كما هو في الكتالوج. لا يدعم هذا السجل أنواع محتوى أخرى بعد.',
    ownerLabel: 'مالك الحق',
    typeLabel: 'نوع الترخيص',
    countriesLabel: 'الدول',
    countriesHint: 'رموز الدول مفصولة بفاصلة، مثل EG,SA,AE. اتركها فارغة لكل الدول.',
    languagesLabel: 'اللغات',
    languagesHint: 'رموز اللغات مفصولة بفاصلة، مثل ar,en. اتركها فارغة لكل اللغات.',
    devicesLabel: 'الأجهزة',
    devicesHint: 'مثل mobile,tv,web. اتركها فارغة لكل الأجهزة.',
    expiryLabel: 'تاريخ الانتهاء',
    expiryHint: 'اتركه فارغًا إن كان الترخيص دائمًا. لا يُخترع تاريخ افتراضي.',
    save: 'إضافة',
    saving: 'جارٍ الإضافة…',
    cancel: 'إلغاء',
    created: 'أُضيف الحق',
    required: 'معرّف المحتوى ومالك الحق مطلوبان',
    empty: 'لا حقوق مسجَّلة',
    emptyHint: 'أضف أول ترخيص لتتبّع صلاحية بث المحتوى.',
    loadError: 'تعذر تحميل الحقوق',
    types: {
      exclusive: 'حصري',
      non_exclusive: 'غير حصري',
      owned: 'ملكية كاملة',
    } as Record<string, string>,
  },
  en: {
    eyebrow: 'Rights and licensing',
    title: 'Rights management',
    lede: 'An administrative register of rights holder, licence type, territories, languages, devices and expiry. It does not yet block publishing or playback; expired rights are highlighted for attention only.',
    add: 'New right',
    search: 'Search owner or content id…',
    filterNote: 'Search, filters and paging all run on the server, so the link is shareable and opens the same set.',
    expiringSoon: 'Expires within 60 days',
    allTypes: 'All types',
    content: 'Content',
    owner: 'Owner',
    type: 'Type',
    countries: 'Territories',
    languages: 'Languages',
    devices: 'Devices',
    expires: 'Expires',
    perpetual: 'Perpetual',
    expired: 'Expired',
    all: 'All',
    contentIdLabel: 'Content ID',
    contentIdHint: 'A published or non-archived draft series ID from the catalogue. Other content types are not supported by this register yet.',
    ownerLabel: 'Rights holder',
    typeLabel: 'Licence type',
    countriesLabel: 'Territories',
    countriesHint: 'Comma-separated country codes, e.g. EG,SA,AE. Leave empty for all territories.',
    languagesLabel: 'Languages',
    languagesHint: 'Comma-separated language codes, e.g. ar,en. Leave empty for all languages.',
    devicesLabel: 'Devices',
    devicesHint: 'e.g. mobile,tv,web. Leave empty for all devices.',
    expiryLabel: 'Expiry date',
    expiryHint: 'Leave empty if the licence is perpetual. No default date is invented.',
    save: 'Add',
    saving: 'Adding…',
    cancel: 'Cancel',
    created: 'Right added',
    required: 'Content ID and rights holder are required',
    empty: 'No rights recorded',
    emptyHint: 'Add the first licence to track content distribution validity.',
    loadError: 'Unable to load rights',
    types: {
      exclusive: 'Exclusive',
      non_exclusive: 'Non-exclusive',
      owned: 'Owned',
    } as Record<string, string>,
  },
}

const EMPTY_FORM = {
  content_id: '',
  owner: '',
  license_type: 'exclusive',
  countries: '',
  languages: '',
  devices: '',
  expiry_date: '',
}

/// الأعمدة مخزَّنة كنصوص JSON في D1، فتُفكّ للعرض بلا إسقاط الصفحة على قيمة فاسدة
function parseList(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function isExpired(date: string | null) {
  if (!date) return false
  const parsed = new Date(date)
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now()
}

const LIMIT = 25

/**
 * فلاتر السجل، بأسماء المعاملات التي يقبلها `GET /admin/rights` بالحرف.
 *
 * كان المسار يقبل `limit` و`offset` وحدهما بلا أي شرط `WHERE`، و`api.rights()` لا
 * تأخذ وسائط أصلًا — فكانت التصفية والبحث والترقيم كلها في المتصفح على المجموعة
 * كاملة. ذلك يعمل إلى أن يكبر السجل: عندها تُفلتر الصفحة الأولى وحدها ويبدو أن
 * نصف التراخيص اختفى.
 *
 * والأهم أن مقياس «تراخيص منتهية» في اللوحة التنفيذية يفتح هذه الشاشة، فمعامل لا
 * يفهمه الخادم كان يعني أن الرابط يفتح قائمة غير مفلترة ويُظهر مجموعة غير التي
 * عدّها المقياس. الآن الفلاتر في SQL، و`expiry` ثلاث حالات تشغيلية يفهمها الخادم:
 * `expired` و`soon` (ستّون يومًا) و`none` (بلا تاريخ انتهاء).
 */
const DEFAULT_FILTERS = { license_type: '', expiry: '' }

const FILTER_FIELDS = (text: (typeof copy)['ar']): FilterField[] => [
  {
    key: 'license_type',
    label: text.type,
    type: 'select',
    options: [
      { value: '', label: text.allTypes },
      ...LICENSE_TYPES.map((value) => ({ value, label: text.types[value] ?? value })),
    ],
  },
  {
    key: 'expiry',
    label: text.expires,
    type: 'select',
    options: [
      { value: '', label: text.all },
      { value: 'expired', label: text.expired },
      // القيم هي ما يفهمه الخادم بالحرف. `perpetual` كان اسمًا محليًّا لا يعرفه.
      { value: 'soon', label: text.expiringSoon },
      { value: 'none', label: text.perpetual },
    ],
  },
]

export function RightsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()

  // العنوان هو حالة القائمة حتى والتصفية محلّية: «التراخيص المنتهية» رابطٌ
  // يُشارك مع الشؤون القانونية، والتحديث لا يُفقد ما كان معروضًا.
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { query, filters, offset, limit } = list
  const [rights, setRights] = useState<RightsLicenseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // الفلترة والبحث والترقيم كلها على الخادم الآن. كانت في المتصفح لأن المسار
      // لم يكن يقبل معاملات، وهو ما يعمل إلى أن يكبر السجل: عندها تُفلتر الصفحة
      // الأولى وحدها ويبدو أن نصف التراخيص اختفى. والأهم أن مقياس «تراخيص منتهية»
      // في اللوحة التنفيذية يفتح هذه الشاشة، فالمعامل يجب أن يعني شيئًا للخادم.
      const response = await api.rights({
        q: query.trim() || undefined,
        license_type: filters.license_type || undefined,
        expiry: filters.expiry || undefined,
        limit,
        offset,
      })
      setRights(response.data)
      setTotal(response.meta.total)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [filters.expiry, filters.license_type, limit, offset, query, text.loadError])

  // نداء واحد بعد سكون المفاتيح لا نداء لكل حرف.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  const paged = rights

  async function submit() {
    if (!form.content_id.trim() || !form.owner.trim()) {
      setFormError(text.required)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      // كل الحقول من المستخدم: لا قيم قانونية مثبّتة في الكود
      await api.createRight({
        content_id: form.content_id.trim(),
        owner: form.owner.trim(),
        license_type: form.license_type,
        countries: splitList(form.countries),
        languages: splitList(form.languages),
        devices: splitList(form.devices),
        expiry_date: form.expiry_date.trim() || null,
      })
      setOpen(false)
      setForm(EMPTY_FORM)
      setNotice(text.created)
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <div className="page-intro__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={() => { setForm(EMPTY_FORM); setFormError(''); setOpen(true) }}
          >
            <Icon name="plus" size={16} />{text.add}
          </button>
        </div>
      </section>

      {notice ? <section className="panel panel--notice" role="status">{notice}</section> : null}

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <h3>{text.title} <span className="title-count">{total}</span></h3>
            {/* نطاق التصفية مُعلَن: المسار لا يقبل فلاتر، فكلّها في المتصفح */}
            <p className="panel__note">{text.filterNote}</p>
          </div>
          <ListToolbar
            searchValue={query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={FILTER_FIELDS(text)}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')}
            trailing={
              <SavedViewsMenu
                storageKey="rights"
                currentSearch={list.search}
                onApply={(search) => navigate(`${adminPath('rights')}${search}`)}
              />
            }
          />
        </header>

        {rights.length ? (
          <>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table data-table--wide">
                <thead>
                  <tr>
                    <th>{text.content}</th>
                    <th>{text.owner}</th>
                    <th>{text.type}</th>
                    <th>{text.countries}</th>
                    <th>{text.languages}</th>
                    <th>{text.expires}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((right) => {
                    const countries = parseList(right.countries)
                    const languages = parseList(right.languages)
                    return (
                      <tr key={right.id}>
                        <td>
                          <span className="table-primary">{right.series_title ?? right.content_id}</span>
                          <span className="table-secondary" dir="ltr">{right.content_id}</span>
                        </td>
                        <td>{right.owner}</td>
                        <td>
                          <span className="track-badge">
                            {text.types[right.license_type] ?? right.license_type}
                          </span>
                        </td>
                        <td>
                          <span className="table-secondary" dir="ltr">
                            {countries.length ? countries.join(', ') : text.all}
                          </span>
                        </td>
                        <td>
                          <span className="table-secondary" dir="ltr">
                            {languages.length ? languages.join(', ') : text.all}
                          </span>
                        </td>
                        <td>
                          {right.expiry_date ? (
                            <span className={isExpired(right.expiry_date) ? 'size-warning' : 'table-secondary'}>
                              {right.expiry_date}
                              {isExpired(right.expiry_date) ? ` · ${text.expired}` : ''}
                            </span>
                          ) : (
                            <span className="table-secondary">{text.perpetual}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </>
        ) : (
          <EmptyState title={text.empty} description={text.emptyHint} />
        )}
      </section>

      {open ? (
        <Modal open title={text.add} onClose={() => setOpen(false)}>
          <div className="entity-form">
            <div className="form-grid">
              <label className="field">
                <span>{text.contentIdLabel}</span>
                <input
                  type="text"
                  value={form.content_id}
                  onChange={(event) => setForm({ ...form, content_id: event.target.value })}
                  dir="ltr"
                  required
                />
                <small>{text.contentIdHint}</small>
              </label>
              <label className="field">
                <span>{text.ownerLabel}</span>
                <input
                  type="text"
                  value={form.owner}
                  onChange={(event) => setForm({ ...form, owner: event.target.value })}
                  required
                />
              </label>
            </div>

            <label className="field">
              <span>{text.typeLabel}</span>
              <select
                value={form.license_type}
                onChange={(event) => setForm({ ...form, license_type: event.target.value })}
              >
                {LICENSE_TYPES.map((value) => (
                  <option value={value} key={value}>{text.types[value] ?? value}</option>
                ))}
              </select>
            </label>

            <div className="form-grid form-grid--three">
              <label className="field">
                <span>{text.countriesLabel}</span>
                <input
                  type="text"
                  value={form.countries}
                  onChange={(event) => setForm({ ...form, countries: event.target.value })}
                  dir="ltr"
                  placeholder="EG,SA"
                />
                <small>{text.countriesHint}</small>
              </label>
              <label className="field">
                <span>{text.languagesLabel}</span>
                <input
                  type="text"
                  value={form.languages}
                  onChange={(event) => setForm({ ...form, languages: event.target.value })}
                  dir="ltr"
                  placeholder="ar,en"
                />
                <small>{text.languagesHint}</small>
              </label>
              <label className="field">
                <span>{text.devicesLabel}</span>
                <input
                  type="text"
                  value={form.devices}
                  onChange={(event) => setForm({ ...form, devices: event.target.value })}
                  dir="ltr"
                  placeholder="mobile,tv"
                />
                <small>{text.devicesHint}</small>
              </label>
            </div>

            <label className="field">
              <span>{text.expiryLabel}</span>
              {/* لا تاريخ افتراضي: الفراغ يعني ترخيصًا دائمًا */}
              <input
                type="date"
                value={form.expiry_date}
                onChange={(event) => setForm({ ...form, expiry_date: event.target.value })}
              />
              <small>{text.expiryHint}</small>
            </label>

            {formError ? <p className="form-error" role="alert">{formError}</p> : null}

            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setOpen(false)}>
                {text.cancel}
              </button>
              <button className="button button--primary" type="button" disabled={saving} onClick={() => void submit()}>
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
