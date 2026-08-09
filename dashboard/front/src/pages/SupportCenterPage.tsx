import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { EmptyState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { SupportFamilyEnvelope } from '../types/api'

/**
 * مركز الدعم: البحث عن عائلة لخدمة العملاء.
 *
 * ## ما كانت عليه
 *
 * ثلاث مشكلات:
 *
 * ١. `fetch()` بمسار نسبي، فيرجع HTML من majarra.app لا JSON من api.majarra.app.
 *
 * ٢. `catch` كان يضع **عائلة مخترعة** بالمعرّف الذي بحث عنه المستخدم:
 *    `{ family: { parent_id: query, status: 'active' }, children: [], devices: [] }`
 *    أي أن أي بحث — حتى عن معرّف لا وجود له — يُظهر «حساب نشط» بلا أطفال ولا
 *    أجهزة. موظف الدعم يقرأ هذا كحقيقة ويخبر العميل بها.
 *
 * ٣. أربعة أزرار كلها `alert()`: «إعادة مزامنة» و«استعادة شراء» و«إعادة ضبط
 *    PIN» و«تذكرة» — تعلن عمّا كانت ستفعله ولا تفعل شيئًا. أُزيلت بدل تركها
 *    تعطي إحساسًا زائفًا بالقدرة، ويُذكر صراحةً أنها غير مُنفَّذة.
 *
 * ## ما صارت عليه
 *
 * `api.supportFamily()` حقيقي. «غير موجود» تُعرض «غير موجود»، والعطل يُعرض عطلًا.
 */

const copy = {
  ar: {
    eyebrow: 'خدمة العملاء',
    title: 'مركز الدعم',
    lede: 'بحث بمعرّف الحساب. لا يعرض بيانات دفع كاملة ولا يعدّل المحتوى.',
    queryLabel: 'معرّف الحساب',
    queryPlaceholder: 'Family ID',
    search: 'بحث',
    searching: 'جارٍ البحث…',
    required: 'أدخل معرّف الحساب',
    notFound: 'لا حساب بهذا المعرّف',
    notFoundHint: 'تأكّد من المعرّف. البحث بالبريد غير مدعوم بعد.',
    account: 'الحساب',
    plan: 'الباقة',
    status: 'الحالة',
    childrenCount: 'الأطفال',
    devicesCount: 'الأجهزة',
    childrenTitle: 'ملفات الأطفال',
    devicesTitle: 'الأجهزة',
    entitlementsTitle: 'سجل الاستحقاق',
    name: 'الاسم',
    track: 'المسار',
    device: 'الجهاز',
    platform: 'النوع',
    product: 'المنتج',
    none: 'لا شيء',
    noChildren: 'لا ملفات أطفال',
    noDevices: 'لا أجهزة مسجَّلة',
    noEntitlements: 'لا سجل استحقاق',
    actionsTitle: 'إجراءات الدعم',
    actionsHint: 'إعادة مزامنة الاستحقاق واستعادة الشراء وإعادة ضبط PIN وإنشاء التذاكر — كلها غير مُنفَّذة بعد في الخادم. أُزيلت الأزرار بدل إظهارها معطّلة أو مُوهِمة بالعمل.',
    searchError: 'تعذر البحث',
  },
  en: {
    eyebrow: 'Customer support',
    title: 'Support centre',
    lede: 'Search by account ID. Does not expose full payment data and cannot modify content.',
    queryLabel: 'Account ID',
    queryPlaceholder: 'Family ID',
    search: 'Search',
    searching: 'Searching…',
    required: 'Enter an account ID',
    notFound: 'No account with that ID',
    notFoundHint: 'Check the ID. Searching by email is not supported yet.',
    account: 'Account',
    plan: 'Plan',
    status: 'Status',
    childrenCount: 'Children',
    devicesCount: 'Devices',
    childrenTitle: 'Child profiles',
    devicesTitle: 'Devices',
    entitlementsTitle: 'Entitlement history',
    name: 'Name',
    track: 'Track',
    device: 'Device',
    platform: 'Platform',
    product: 'Product',
    none: 'None',
    noChildren: 'No child profiles',
    noDevices: 'No registered devices',
    noEntitlements: 'No entitlement history',
    actionsTitle: 'Support actions',
    actionsHint: 'Entitlement resync, purchase restore, PIN reset and ticket creation are not implemented on the server yet. The buttons were removed rather than shown disabled or pretending to work.',
    searchError: 'Search failed',
  },
}

export function SupportCenterPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<SupportFamilyEnvelope | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  const search = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    const value = query.trim()
    if (!value) { setError(text.required); return }

    setLoading(true)
    setError('')
    setNotFound(false)
    setFamily(null)
    try {
      const response = await api.supportFamily(value)
      setFamily(response.data)
    } catch (caught) {
      // 404 حالة قائمة بذاتها: «غير موجود» ليست عطلًا وليست حسابًا مخترعًا
      const status = (caught as { status?: number } | null)?.status
      if (status === 404) setNotFound(true)
      else setError(caught instanceof Error ? caught.message : text.searchError)
    } finally {
      setLoading(false)
    }
  }, [query, text.required, text.searchError])

  const account = family?.family ?? null

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      <form className="panel" onSubmit={search}>
        <div className="entity-form">
          <div className="filters-row">
            <label className="field search-field">
              <span>{text.queryLabel}</span>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.queryPlaceholder}
                dir="ltr"
              />
            </label>
            <button className="button button--primary" type="submit" disabled={loading}>
              {loading ? text.searching : text.search}
            </button>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      </form>

      {loading ? <LoadingState /> : null}

      {notFound ? <EmptyState title={text.notFound} description={text.notFoundHint} /> : null}

      {account ? (
        <>
          <section className="panel">
            <div className="panel__header"><h3>{text.account}</h3></div>
            <div className="entity-form">
              <dl className="detail-list">
                <div>
                  <dt>{text.account}</dt>
                  <dd dir="ltr">{String(account.parent_id ?? '—')}</dd>
                </div>
                <div>
                  <dt>{text.plan}</dt>
                  <dd>
                    <span className={`plan-badge plan-badge--${String(account.plan ?? 'free')}`}>
                      {String(account.plan ?? 'free')}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>{text.status}</dt>
                  <dd>
                    <span className={`account-status account-status--${account.status === 'active' ? 'active' : 'archived'}`}>
                      {String(account.status ?? '—')}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>{text.childrenCount}</dt>
                  <dd dir="ltr">{(family?.children ?? []).length}</dd>
                </div>
                <div>
                  <dt>{text.devicesCount}</dt>
                  <dd dir="ltr">{(family?.devices ?? []).length}</dd>
                </div>
              </dl>
            </div>
          </section>

          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel__header"><h3>{text.childrenTitle}</h3></div>
              {(family?.children ?? []).length ? (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr><th>{text.name}</th><th>{text.track}</th></tr></thead>
                    <tbody>
                      {family!.children.map((child) => (
                        <tr key={child.child_id}>
                          <td><span className="table-primary">{child.nickname ?? '—'}</span></td>
                          <td>
                            {child.age_track ? (
                              <span className={`track-badge track-badge--${child.age_track}`}>{child.age_track}</span>
                            ) : <span className="table-secondary">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="table-secondary" style={{ padding: 14 }}>{text.noChildren}</p>
              )}
            </section>

            <section className="panel">
              <div className="panel__header"><h3>{text.devicesTitle}</h3></div>
              {(family?.devices ?? []).length ? (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr><th>{text.device}</th><th>{text.platform}</th><th>{text.status}</th></tr></thead>
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
                <p className="table-secondary" style={{ padding: 14 }}>{text.noDevices}</p>
              )}
            </section>
          </div>

          <section className="panel panel--table">
            <div className="panel__header"><h3>{text.entitlementsTitle}</h3></div>
            {(family?.entitlements ?? []).length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>{text.product}</th><th>{text.plan}</th><th>{text.status}</th></tr></thead>
                  <tbody>
                    {family!.entitlements.map((entry, index) => (
                      <tr key={`${entry.product_id}-${index}`}>
                        <td><span className="table-primary" dir="ltr">{entry.product_id}</span></td>
                        <td>{entry.plan}</td>
                        <td>
                          <span className="track-badge">{entry.entitlement_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="table-secondary" style={{ padding: 14 }}>{text.noEntitlements}</p>
            )}
          </section>

          {/* الإجراءات غير المُنفَّذة تُعلَن بدل أن تُوهِم بالعمل */}
          <section className="panel panel--notice">
            <strong>{text.actionsTitle}</strong>
            <p>{text.actionsHint}</p>
          </section>
        </>
      ) : null}
    </div>
  )
}
