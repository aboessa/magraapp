import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { PlansCatalogue } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'التجارة',
    title: 'حدود الباقات',
    lede: 'الحدود الفعلية التي يفرضها التطبيق على العائلة. لا تمثل أسعارًا أو عروضًا متجرية.',
    plan: 'الباقة',
    children: 'ملفات الأطفال',
    devices: 'الأجهزة',
    streams: 'المشاهدة المتزامنة',
    downloads: 'أجهزة التنزيل',
    empty: 'لا توجد باقات معرفة',
    emptyHint: 'لم يرجع الخادم أي حدود للسياسة الحالية.',
    loadError: 'تعذر تحميل حدود الباقات',
    pricingTitle: 'الأسعار غير متاحة',
    pricingHint: 'لا يوجد بعد نموذج أسعار أو ربط معرّفات منتجات المتاجر أو خصومات أو أسعار محفوظة للمشتركين. لا تعرض هذه الشاشة سعرًا ولا تغيّر اشتراكًا أو استحقاقًا.',
    sourceTitle: 'مصدر الحدود',
    sourceHint: 'تأتي هذه الحدود من سياسة FamilyState نفسها التي تُفرض عند إنشاء ملف طفل أو تسجيل جهاز أو طلب مشاهدة، وليست نسخة يدوية في لوحة التحكم.',
  },
  en: {
    eyebrow: 'Commerce',
    title: 'Plan limits',
    lede: 'The live limits enforced for a family. They are not store prices or offers.',
    plan: 'Plan',
    children: 'Child profiles',
    devices: 'Devices',
    streams: 'Concurrent streams',
    downloads: 'Download devices',
    empty: 'No plans are defined',
    emptyHint: 'The server returned no current policy limits.',
    loadError: 'Unable to load plan limits',
    pricingTitle: 'Pricing is unavailable',
    pricingHint: 'There is no price model, store-product mapping, promotion, or grandfathered-price authority yet. This screen shows no price and cannot change a subscription or entitlement.',
    sourceTitle: 'Limit source',
    sourceHint: 'These limits come from the same FamilyState policy enforced when a child profile or device is created, or playback is requested. They are not a manual dashboard copy.',
  },
}

export function PackagesPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [catalogue, setCatalogue] = useState<PlansCatalogue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.plans()
      setCatalogue(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  const plans = catalogue?.plans ?? []
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      {plans.length ? (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.plan}</th>
                  <th>{text.children}</th>
                  <th>{text.devices}</th>
                  <th>{text.streams}</th>
                  <th>{text.downloads}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td><span className="table-primary">{plan.id}</span></td>
                    <td>{plan.limits.children}</td>
                    <td>{plan.limits.devices}</td>
                    <td>{plan.limits.concurrent_streams}</td>
                    <td>{plan.limits.download_devices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : <EmptyState title={text.empty} description={text.emptyHint} />}

      <section className="panel panel--notice">
        <strong>{text.sourceTitle}</strong>
        <p>{text.sourceHint}</p>
      </section>
      <section className="panel panel--notice">
        <strong>{text.pricingTitle}</strong>
        <p>{text.pricingHint}</p>
      </section>
    </div>
  )
}
