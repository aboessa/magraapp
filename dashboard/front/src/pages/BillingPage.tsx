import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { formatNumber } from '../lib/labels'
import type {
  BillingEntitlementRecord,
  BillingPurchaseRecord,
  BillingStats,
} from '../types/api'

/**
 * الاشتراكات والفوترة.
 *
 * ## ما كانت عليه
 *
 * ثلاث مشكلات:
 *
 * ١. `api.dashboard().catch(() => null)` في السطر الأول — نداء لا يُنتظَر ولا
 *    يُسنَد ولا يُستخدَم. كان يُطلق طلبًا على كل تركيب ويُهمل نتيجته.
 *
 * ٢. `fetch('/api/v1/admin/billing/stats')` بمسار نسبي، فيرجع HTML من
 *    majarra.app لا JSON من api.majarra.app.
 *
 * ٣. `.catch(() => setStats({ by_plan: [] }))` — فيظهر «الاشتراكات والفوترة»
 *    بصفر خطط وصفر عمليات شراء. عطل الفوترة يبدو كنشاط تجاري بلا مشتركين، وهو
 *    أسوأ تفسير ممكن لخطأ في صفحة إيرادات.
 *
 * وكانت `recent_entitlements` تعود من الخادم ولا تُعرض، وعمليات الشراء تُلقى
 * في `<pre>JSON.stringify(...)</pre>` خامًا.
 *
 * ## أسماء الأعمدة
 *
 * `billing_audit` يحمل `entitlement_status` و`starts_at_ms` و`expires_at_ms`
 * و`verified_at_ms` — لا `status` ولا `purchased_at`. الاستعلام في الخادم كان
 * يسأل عن الأسماء الخطأ ويُعيد 500، وقد صُحّح.
 */

const copy = {
  ar: {
    eyebrow: 'التجارة',
    title: 'الاشتراكات والفوترة',
    lede: 'Google Play هو مصدر الحقيقة للاستحقاق، وFamilyState يحتفظ بنسخة سريعة منه.',
    plansTitle: 'الاشتراكات النشطة حسب الخطة',
    purchasesTitle: 'آخر عمليات الشراء',
    entitlementsTitle: 'آخر أحداث الاستحقاق',
    plan: 'الخطة',
    count: 'العدد',
    account: 'الحساب',
    product: 'المنتج',
    status: 'الحالة',
    providerState: 'حالة المزوّد',
    starts: 'يبدأ',
    expires: 'ينتهي',
    event: 'الحدث',
    when: 'الوقت',
    noPlans: 'لا اشتراكات نشطة',
    noPlansHint: 'الأرقام تظهر عند أول شراء مُتحقَّق من Google Play.',
    noPurchases: 'لا عمليات شراء',
    noPurchasesHint: 'كل شراء مُتحقَّق يُسجَّل في billing_audit.',
    noEntitlements: 'لا أحداث استحقاق',
    noEntitlementsHint: 'الأحداث تصل من إشعارات Google Play في الوقت الحقيقي.',
    loadError: 'تعذر تحميل بيانات الفوترة',
    none: '—',
    refresh: 'تحديث',
    tabOverview: 'نظرة عامة',
    tabPurchases: 'سجل الشراء',
    tabEntitlements: 'الاستحقاقات النشطة',
    ledgerTitle: 'سجل الشراء الكامل',
    ledgerHint: 'من billing_audit. يحمل ملخّص رمز الشراء ووقت التحقّق — لا يعرضهما ملخّص النظرة العامة.',
    tokenHash: 'ملخّص الرمز',
    tokenHashHint: 'ملخّص لا الرمز نفسه: رمز الشراء الأصلي لا يُخزَّن إطلاقًا.',
    verifiedAt: 'وقت التحقّق',
    activeTitle: 'الاستحقاقات النشطة',
    activeHint: 'من family_projection، والخطط المجانية مستثناة: الاستحقاق يعني اشتراكًا مدفوعًا.',
    noDates: 'بلا تواريخ',
    noDatesHint: 'family_projection لا يحمل تاريخ بداية ولا نهاية — تلك في سجل الشراء.',
    lastEvent: 'آخر حدث',
    updated: 'آخر تحديث',
    accountStatus: 'حالة الحساب',
    total: 'الإجمالي',
  },
  en: {
    eyebrow: 'Commerce',
    title: 'Subscriptions and billing',
    lede: 'Google Play is the source of truth for entitlement; FamilyState keeps a fast copy of it.',
    plansTitle: 'Active subscriptions by plan',
    purchasesTitle: 'Recent purchases',
    entitlementsTitle: 'Recent entitlement events',
    plan: 'Plan',
    count: 'Count',
    account: 'Account',
    product: 'Product',
    status: 'Status',
    providerState: 'Provider state',
    starts: 'Starts',
    expires: 'Expires',
    event: 'Event',
    when: 'When',
    noPlans: 'No active subscriptions',
    noPlansHint: 'Numbers appear after the first verified Google Play purchase.',
    noPurchases: 'No purchases',
    noPurchasesHint: 'Every verified purchase is recorded in billing_audit.',
    noEntitlements: 'No entitlement events',
    noEntitlementsHint: 'Events arrive from Google Play real-time notifications.',
    loadError: 'Unable to load billing data',
    none: '—',
    refresh: 'Refresh',
    tabOverview: 'Overview',
    tabPurchases: 'Purchase ledger',
    tabEntitlements: 'Active entitlements',
    ledgerTitle: 'Full purchase ledger',
    ledgerHint: 'From billing_audit. Carries the purchase token hash and verification time, which the overview summary does not show.',
    tokenHash: 'Token hash',
    tokenHashHint: 'A hash, not the token: the original purchase token is never stored.',
    verifiedAt: 'Verified at',
    activeTitle: 'Active entitlements',
    activeHint: 'From family_projection, with free plans excluded: an entitlement means a paid subscription.',
    noDates: 'No dates',
    noDatesHint: 'family_projection carries no start or end date — those live in the purchase ledger.',
    lastEvent: 'Last event',
    updated: 'Updated',
    accountStatus: 'Account status',
    total: 'Total',
  },
}

/// الأعمدة الزمنية في billing_audit ميلي ثانية، لا نصوص D1
function formatMs(value: unknown, locale: 'ar' | 'en') {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  return new Date(value).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
  })
}

function formatStamp(value: unknown, locale: 'ar' | 'en') {
  if (typeof value === 'number' && Number.isFinite(value)) return formatMs(value, locale)
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

/**
 * التبويبات الثلاثة.
 *
 * كل تبويب مسارٌ مختلف يجيب سؤالًا مختلفًا، لا عرضٌ آخر لنفس البيانات:
 *
 * - `overview`  → `/billing/stats`        ما الحالة العامة؟
 * - `purchases` → `/billing/purchases`    ما الذي حدث في كل شراء؟
 * - `active`    → `/billing/entitlements` من يملك خطة مدفوعة الآن؟
 *
 * المسارَان الأخيران كانا موجودَين في الخادم بلا أي مستدعٍ في الواجهة.
 */
type Tab = 'overview' | 'purchases' | 'active'

export function BillingPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<BillingStats | null>(null)
  const [purchases, setPurchases] = useState<BillingPurchaseRecord[]>([])
  const [entitlements, setEntitlements] = useState<BillingEntitlementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // كل تبويب ينادي مساره وحده: تحميل الثلاثة معًا يُصدر طلبين لا يُقرآن
      if (tab === 'overview') {
        const response = await api.billingStats()
        setStats(response.data)
      } else if (tab === 'purchases') {
        const response = await api.billingPurchases(100)
        setPurchases(response.data)
      } else {
        const response = await api.billingEntitlements()
        setEntitlements(response.data)
      }
    } catch (caught) {
      // لا احتياطي بصفر: عطل الفوترة لا يجوز أن يبدو كغياب مشتركين
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [tab, text.loadError])

  useEffect(() => { void load() }, [load])

  /// الفشل يُعرض داخل التبويب لا بدلًا من الصفحة كلها: عطل في سجل الشراء لا
  /// يجوز أن يمنع قراءة النظرة العامة.
  const blocked = error && (
    (tab === 'overview' && !stats)
    || (tab === 'purchases' && !purchases.length)
    || (tab === 'active' && !entitlements.length)
  )

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--secondary" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={17} />{text.refresh}
          </button>
        </div>
      </section>

      {/* كل تبويب مسارٌ مختلف يجيب سؤالًا مختلفًا، لا عرضٌ آخر لنفس البيانات */}
      <div className="library-tabs">
        <button
          className={`library-tab ${tab === 'overview' ? 'library-tab--active' : ''}`}
          type="button"
          onClick={() => setTab('overview')}
        >
          <Icon name="analytics" size={17} />{text.tabOverview}
        </button>
        <button
          className={`library-tab ${tab === 'purchases' ? 'library-tab--active' : ''}`}
          type="button"
          onClick={() => setTab('purchases')}
        >
          <Icon name="subscriptions" size={17} />{text.tabPurchases}
        </button>
        <button
          className={`library-tab ${tab === 'active' ? 'library-tab--active' : ''}`}
          type="button"
          onClick={() => setTab('active')}
        >
          <Icon name="parents" size={17} />{text.tabEntitlements}
        </button>
      </div>

      {loading ? <LoadingState /> : null}
      {blocked ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {error && !blocked ? <div className="inline-alert inline-alert--error">{error}</div> : null}

      {/* ------------------------------------------------ سجل الشراء الكامل */}
      {tab === 'purchases' && !loading && !blocked ? (
        <>
          <section className="panel panel--table">
            <header className="panel__header panel__header--filters">
              <div>
                <span className="panel__kicker">{text.ledgerTitle}</span>
                <h3>{text.total} <span className="title-count">{formatNumber(purchases.length, locale)}</span></h3>
              </div>
            </header>
            {purchases.length ? (
              <div className="table-scroll">
                <table className="data-table data-table--wide">
                  <thead>
                    <tr>
                      <th>{text.account}</th>
                      <th>{text.product}</th>
                      <th>{text.status}</th>
                      <th>{text.starts}</th>
                      <th>{text.expires}</th>
                      <th>{text.verifiedAt}</th>
                      <th>{text.tokenHash}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((row) => (
                      <tr key={row.purchase_token_hash}>
                        <td><span className="table-secondary" dir="ltr">{row.parent_id.slice(0, 12)}…</span></td>
                        <td>
                          <span className="table-primary" dir="ltr">{row.product_id}</span>
                          <span className={`plan-badge plan-badge--${row.plan}`}>{row.plan}</span>
                        </td>
                        <td>
                          <span className={`account-status account-status--${row.entitlement_status === 'active' ? 'active' : 'archived'}`}>
                            {row.entitlement_status}
                          </span>
                          <span className="table-secondary" dir="ltr">{row.provider_state}</span>
                        </td>
                        <td><span className="table-secondary">{formatMs(row.starts_at_ms, locale)}</span></td>
                        <td><span className="table-secondary">{formatMs(row.expires_at_ms, locale)}</span></td>
                        <td><span className="table-secondary">{formatMs(row.verified_at_ms, locale)}</span></td>
                        <td>
                          {/* ملخّص لا الرمز: الرمز الأصلي لا يُخزَّن إطلاقًا */}
                          <code className="table-secondary" dir="ltr" title={text.tokenHashHint}>
                            {row.purchase_token_hash.slice(0, 10)}…
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title={text.noPurchases} description={text.noPurchasesHint} />}
            <footer className="panel__footer"><span>{text.ledgerHint}</span></footer>
          </section>
        </>
      ) : null}

      {/* ------------------------------------------- الاستحقاقات النشطة */}
      {tab === 'active' && !loading && !blocked ? (
        <section className="panel panel--table">
          <header className="panel__header panel__header--filters">
            <div>
              <span className="panel__kicker">{text.activeTitle}</span>
              <h3>{text.total} <span className="title-count">{formatNumber(entitlements.length, locale)}</span></h3>
            </div>
          </header>
          {entitlements.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.account}</th>
                    <th>{text.plan}</th>
                    <th>{text.accountStatus}</th>
                    <th>{text.lastEvent}</th>
                    <th>{text.updated}</th>
                  </tr>
                </thead>
                <tbody>
                  {entitlements.map((row) => (
                    <tr key={row.parent_id}>
                      <td><span className="table-primary" dir="ltr">{row.parent_id}</span></td>
                      <td><span className={`plan-badge plan-badge--${row.plan}`}>{row.plan}</span></td>
                      <td>
                        <span className={`account-status account-status--${row.status === 'active' ? 'active' : 'archived'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td><span className="table-secondary">{formatStamp(row.last_event_at_ms, locale)}</span></td>
                      <td><span className="table-secondary">{formatStamp(row.updated_at, locale)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title={text.noEntitlements} description={text.activeHint} />}
          <footer className="panel__footer"><span>{text.activeHint}</span></footer>
        </section>
      ) : null}

      {/* حدّ الجدول يُعلَن بدل أن يُكتشف: لا تواريخ بداية/نهاية هنا */}
      {tab === 'active' && !loading && !blocked && entitlements.length ? (
        <section className="panel panel--notice">
          <strong>{text.noDates}</strong>
          <p>{text.noDatesHint}</p>
        </section>
      ) : null}

      {/* الشرط على `stats` نفسه لا على `blocked`: الثاني قيمة محسوبة لا يستنتج
          منها المدقّق أن `stats` غير فارغ، فكل قراءة داخل الكتلة تصير خطأ نوع. */}
      {tab !== 'overview' || loading || !stats ? null : (
      <>
      <section className="panel">
        <div className="panel__header"><h3>{text.plansTitle}</h3></div>
        {(stats.by_plan ?? []).length ? (
          <div className="stats-grid">
            {stats.by_plan.map((row) => (
              <article className="stat-card stat-card--cyan" key={row.plan}>
                <div className="stat-card__top">
                  <span className={`plan-badge plan-badge--${row.plan}`}>{row.plan}</span>
                </div>
                <strong className="stat-card__value" dir="ltr">{row.count}</strong>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title={text.noPlans} description={text.noPlansHint} />
        )}
      </section>

      <section className="panel panel--table">
        <div className="panel__header">
          <h3>{text.purchasesTitle}</h3>
          <span className="panel__kicker">{(stats.recent_purchases ?? []).length}</span>
        </div>
        {(stats.recent_purchases ?? []).length ? (
          <div className="table-scroll">
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.account}</th>
                  <th>{text.product}</th>
                  <th>{text.status}</th>
                  <th>{text.starts}</th>
                  <th>{text.expires}</th>
                </tr>
              </thead>
              <tbody>
                {/* جدول مقروء بدل JSON خام */}
                {stats.recent_purchases.slice(0, 20).map((purchase, index) => {
                  const row = purchase as Record<string, unknown>
                  return (
                    <tr key={String(row.parent_id ?? index) + index}>
                      <td>
                        <span className="table-secondary" dir="ltr">
                          {String(row.parent_id ?? text.none).slice(0, 12)}…
                        </span>
                      </td>
                      <td>
                        <span className="table-primary" dir="ltr">{String(row.product_id ?? text.none)}</span>
                        {row.plan ? <span className="table-secondary">{String(row.plan)}</span> : null}
                      </td>
                      <td>
                        {/* entitlement_status هو الاسم الحقيقي في الجدول */}
                        <span className={`account-status account-status--${row.entitlement_status === 'active' ? 'active' : 'archived'}`}>
                          {String(row.entitlement_status ?? text.none)}
                        </span>
                        {row.provider_state ? (
                          <span className="table-secondary" dir="ltr">{String(row.provider_state)}</span>
                        ) : null}
                      </td>
                      <td><span className="table-secondary">{formatMs(row.starts_at_ms, locale)}</span></td>
                      <td><span className="table-secondary">{formatMs(row.expires_at_ms, locale)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={text.noPurchases} description={text.noPurchasesHint} />
        )}
      </section>

      <section className="panel panel--table">
        <div className="panel__header">
          <h3>{text.entitlementsTitle}</h3>
          <span className="panel__kicker">{(stats.recent_entitlements ?? []).length}</span>
        </div>
        {/* recent_entitlements كانت تعود من الخادم ولا تُعرض إطلاقًا */}
        {(stats.recent_entitlements ?? []).length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>{text.event}</th><th>{text.account}</th><th>{text.when}</th></tr>
              </thead>
              <tbody>
                {stats.recent_entitlements.slice(0, 20).map((entry, index) => {
                  const row = entry as Record<string, unknown>
                  return (
                    <tr key={String(row.event_id ?? index)}>
                      <td><span className="table-primary" dir="ltr">{String(row.event_type ?? text.none)}</span></td>
                      <td>
                        <span className="table-secondary" dir="ltr">
                          {String(row.parent_id ?? text.none).slice(0, 12)}…
                        </span>
                      </td>
                      <td>
                        <span className="table-secondary">
                          {formatStamp(row.occurred_at_ms ?? row.processed_at, locale)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={text.noEntitlements} description={text.noEntitlementsHint} />
        )}
      </section>
      </>
      )}
    </div>
  )
}
