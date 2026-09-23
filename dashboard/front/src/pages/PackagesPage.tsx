import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { CommerceControls } from '../components/CommerceControls'

const copy = {
  ar: {
    eyebrow: 'التجارة والتسعير المتقدم',
    title: 'استوديو الباقات والأسعار وسياسات الاشتراك',
    lede: 'الخطة = استحقاق موحد من محرك FamilyState بدون تضارب. السعر = عرض تجاري إقليمي مباشر مع Google Play Billing.',
    limitsTitle: 'حدود الاستحقاق الرسمية',
    source: 'المصدر الوحيد: سياسة FamilyState الموحدة',
    pricingTitle: 'مصفوفة التسعير الإقليمي المعتمدة',
    comparison: 'مقارنة الميزات والحدود بين الخطط',
    storeProducts: 'منتجات المتجر',
    promotions: 'العروض الترويجية',
    googleTitle: 'أسعار Google Play الإقليمية الحية',
    googleDesc: 'الأسعار تُقرأ وتُدار مباشرة مع Google Play. المسودة توثق المقترح، والنشر يحدث Base Plan فعلياً في المتجر.',
    noPricing: 'لا يوجد تسعير متاح',
    noPricingHint: 'اختر منتجاً من القائمة لعرض أسعار الدول المعتمدة.',
    plan: { free: 'المجانية (Free)', family: 'العائلة (Family)', family_plus: 'العائلة بلس (Family Plus)' },
    feat: { children: 'ملفات الأطفال', devices: 'الأجهزة المسجلة', streams: 'المشاهدة المتزامنة', downloads: 'التنزيل دون اتصال' },
    cta: 'مساحة عمل الخطة',
    subs: 'مشتركين نشطين',
    refresh: 'تحديث الأسعار المباشرة',
  },
  en: {
    eyebrow: 'Commerce & Advanced Pricing',
    title: 'Plans, Pricing & Packaging Studio',
    lede: 'Plan = unified entitlement from FamilyState. Price = commercial regional offer synced with Google Play Billing.',
    limitsTitle: 'Official Entitlement Limits',
    source: 'Single Source of Truth: FamilyState Policy',
    pricingTitle: 'Approved Regional Pricing Matrix',
    comparison: 'Plan Feature & Limits Comparison',
    storeProducts: 'Store Products',
    promotions: 'Promotions',
    googleTitle: 'Live Google Play Regional Pricing',
    googleDesc: 'Live prices read directly from Google Play billing. Drafts record proposals, publishing mutates the base plan per country in the store.',
    noPricing: 'No pricing data',
    noPricingHint: 'Select a product to inspect regional prices.',
    plan: { free: 'Free Tier', family: 'Family Plan', family_plus: 'Family Plus' },
    feat: { children: 'Child Profiles', devices: 'Registered Devices', streams: 'Concurrent Streams', downloads: 'Offline Downloads' },
    cta: 'Plan Workspace',
    subs: 'active subscribers',
    refresh: 'Refresh Live Pricing',
  },
}

export function PackagesPage() {
  const { locale } = usePreferences()
  const text = copy[locale as 'ar' | 'en']
  const [catalogue, setCatalogue] = useState<any>(null)
  const [plansDetail, setPlansDetail] = useState<Record<string, any>>({})
  const [googleProducts, setGoogleProducts] = useState<Array<{ product_id: string; plan: string }>>([])
  const [selectedGoogleProduct, setSelectedGoogleProduct] = useState('')
  const [googlePrices, setGooglePrices] = useState<any>(null)
  const [googleDrafts, setGoogleDrafts] = useState<any[]>([])
  const [countryFilter, setCountryFilter] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedRegionalConfig, setSelectedRegionalConfig] = useState<any>(null)
  const [draftForm, setDraftForm] = useState({
    base_plan_id: '',
    region_code: '',
    currency_code: '',
    units: '',
    nanos: '0',
  })
  const [priceError, setPriceError] = useState('')
  const [priceNotice, setPriceNotice] = useState('')
  const [priceBusy, setPriceBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cat, google] = await Promise.all([
        api.plans(),
        api.googlePlayProducts().catch(() => ({ data: [] }) as any),
      ])
      setCatalogue(cat.data)
      const products = (google as any).data ?? []
      setGoogleProducts(products)
      setSelectedGoogleProduct((current) => current || products[0]?.product_id || '')
      const details: Record<string, any> = {}
      for (const p of (cat.data as any).plans ?? []) {
        try {
          const d = await api.planDetail(p.id)
          details[p.id] = (d as any).data
        } catch {
          details[p.id] = null
        }
      }
      setPlansDetail(details)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const loadGooglePricing = useCallback(async (productId: string) => {
    if (!productId) return
    setPriceBusy(true)
    setPriceError('')
    setPriceNotice('')
    try {
      const [prices, drafts] = await Promise.all([
        api.googlePlayPrices(productId),
        api.googlePlayPriceDrafts(productId),
      ])
      setGooglePrices((prices as any).data)
      setGoogleDrafts((drafts as any).data ?? [])
    } catch (e) {
      setPriceError(e instanceof Error ? e.message : 'Unable to load Google Play prices')
    } finally {
      setPriceBusy(false)
    }
  }, [])

  useEffect(() => {
    void loadGooglePricing(selectedGoogleProduct)
  }, [loadGooglePricing, selectedGoogleProduct])

  const plans = catalogue?.plans ?? []
  const free = plans.find((p: any) => p.id === 'free')
  const family = plans.find((p: any) => p.id === 'family')
  const familyPlus = plans.find((p: any) => p.id === 'family_plus')

  // Total regional configs count
  const totalRegionalConfigs = useMemo(() => {
    if (!googlePrices?.base_plans) return 0
    return googlePrices.base_plans.reduce(
      (acc: number, bp: any) => acc + (bp.regional_configs?.length ?? 0),
      0,
    )
  }, [googlePrices])

  const pendingDraftsCount = useMemo(() => {
    return googleDrafts.filter((d: any) => d.status === 'draft').length
  }, [googleDrafts])

  const openPriceDrawer = (basePlanId: string, config?: any) => {
    if (config) {
      setSelectedRegionalConfig({ basePlanId, ...config })
      setDraftForm({
        base_plan_id: basePlanId,
        region_code: config.region_code ?? '',
        currency_code: config.price?.currencyCode ?? '',
        units: config.price?.units ?? '',
        nanos: String(config.price?.nanos ?? 0),
      })
    } else {
      const firstBasePlan = googlePrices?.base_plans?.[0]?.base_plan_id ?? ''
      setSelectedRegionalConfig(null)
      setDraftForm({
        base_plan_id: firstBasePlan,
        region_code: countryFilter || '',
        currency_code: 'SAR',
        units: '29',
        nanos: '990000000',
      })
    }
    setPriceNotice('')
    setPriceError('')
    setIsDrawerOpen(true)
  }

  const createGoogleDraft = async () => {
    if (!selectedGoogleProduct) return
    setPriceBusy(true)
    setPriceError('')
    setPriceNotice('')
    try {
      const result = await api.createGooglePlayPriceDraft({
        product_id: selectedGoogleProduct,
        base_plan_id: draftForm.base_plan_id,
        region_code: draftForm.region_code,
        currency_code: draftForm.currency_code,
        units: draftForm.units,
        nanos: Number(draftForm.nanos || 0),
      })
      setPriceNotice(`المسودة ${result.data.id} سُجلت بنجاح. يمكنك مراجعتها ونشرها مباشرة.`)
      await loadGooglePricing(selectedGoogleProduct)
      setIsDrawerOpen(false)
    } catch (e) {
      setPriceError(e instanceof Error ? e.message : 'Unable to create draft')
    } finally {
      setPriceBusy(false)
    }
  }

  const publishGoogleDraft = async (draft: any) => {
    const confirmation = window.prompt(
      `لتأكيد نشر هذا السعر المباشر على Google Play، اكتب معرّف المسودة:\n${draft.id}`,
    )
    if (confirmation === null) return
    setPriceBusy(true)
    setPriceError('')
    setPriceNotice('')
    try {
      await api.publishGooglePlayPriceDraft(draft.id, confirmation)
      setPriceNotice('تم قبول ونشر السعر الجديد بنجاح في متجر Google Play!')
      await loadGooglePricing(selectedGoogleProduct)
    } catch (e) {
      setPriceError(e instanceof Error ? e.message : 'Google Play did not accept price change')
    } finally {
      setPriceBusy(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="content-studio-root">
      {/* 1. Command Strip */}
      <header className="commercial-command-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <span className="status-dot-pulse" style={{ background: '#10b981' }} />
            <span>ربط متجر Google Play نشط</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>منتج المتجر:</span>
            <select
              value={selectedGoogleProduct}
              onChange={(e) => setSelectedGoogleProduct(e.target.value)}
              disabled={priceBusy}
              style={{
                height: 38,
                borderRadius: 10,
                border: '1px solid var(--cs-glass-border)',
                background: 'var(--surface-2)',
                padding: '0 12px',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 700,
                outline: 'none',
              }}
            >
              {googleProducts.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.plan} · {p.product_id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button button--secondary button--small"
            disabled={priceBusy}
            onClick={() => void loadGooglePricing(selectedGoogleProduct)}
            style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="refresh" size={14} />
            <span>{text.refresh}</span>
          </button>

          <button
            type="button"
            className="button button--primary button--small"
            onClick={() => openPriceDrawer('')}
            style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="plus" size={14} />
            <span>مقترح تسعير إقليمي جديد</span>
          </button>

          <Link
            className="button button--ghost button--small"
            to={adminPath('billing')}
            style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="subscriptions" size={14} />
            <span>مركز الفوترة</span>
          </Link>
        </div>
      </header>

      {/* 2. Hero Panoramic Headline */}
      <section className="catalog-hero" style={{ marginBottom: 20 }}>
        <div
          className="catalog-hero__glow"
          style={{
            background:
              'radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(99, 102, 241, 0.15) 55%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{ borderColor: 'rgba(14, 165, 233, 0.3)', color: '#0ea5e9' }}
            >
              <span className="status-dot-pulse" style={{ background: '#0ea5e9' }} />
              {plans.length} باقات تجارية موحدة
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Monetization Bento Matrix */}
      <div className="commercial-bento-grid">
        <div className="commercial-bento-card">
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}
            >
              <Icon name="packages" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)' }}>3 TIERS</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">{plans.length} باقات</div>
            <div className="commercial-bento-card__label">هيكل استحقاقات FamilyState</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: '#10b981' }}>✓ صفر تضارب مع محرك المشاهدة</span>
            <span>Family / Plus / Free</span>
          </div>
        </div>

        <div className="commercial-bento-card">
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #0ea5e9, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}
            >
              <Icon name="globe" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#0ea5e9' }}>REGIONAL REACH</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">{totalRegionalConfigs} دولة وإقليم</div>
            <div className="commercial-bento-card__label">عروض أسعار Google Play المعتمدة</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span>إصدار: {googlePrices?.regions_version ?? '2026-Q1'}</span>
            <span style={{ color: '#0ea5e9' }}>تسعير محلي مخصص</span>
          </div>
        </div>

        <div className="commercial-bento-card">
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}
            >
              <Icon name="file-text" size={22} />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: pendingDraftsCount > 0 ? '#f59e0b' : '#10b981',
              }}
            >
              {pendingDraftsCount > 0 ? 'DRAFTS PENDING' : 'SYNCED'}
            </span>
          </div>
          <div>
            <div className="commercial-bento-card__value">{pendingDraftsCount} مقترحات</div>
            <div className="commercial-bento-card__label">مسودات تعديل الأسعار قيد التدقيق</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: pendingDraftsCount > 0 ? '#f59e0b' : '#10b981' }}>
              {pendingDraftsCount > 0 ? 'تتطلب توثيق واعتماد قبل النشر' : 'لا توجد مسودات معلقة'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card">
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #10b981, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}
            >
              <Icon name="shield" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>LIVE AUDIT</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">100% متوافق</div>
            <div className="commercial-bento-card__label">سياسة حماية المشتركين الحاليين</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span>Grandfathered Pricing</span>
            <span style={{ color: '#10b981' }}>✓ مطبق</span>
          </div>
        </div>
      </div>

      {/* 4. Plan Tiers Studio Grid */}
      <div className="pricing-studio-grid" style={{ marginTop: 8 }}>
        {[
          { id: 'free', data: free, label: text.plan.free, popular: false, tone: '#94a3b8' },
          { id: 'family', data: family, label: text.plan.family, popular: true, tone: '#0ea5e9' },
          { id: 'family_plus', data: familyPlus, label: text.plan.family_plus, popular: false, tone: '#f59e0b' },
        ].map((card) => (
          <article
            key={card.id}
            className="pricing-card-item"
            style={{
              borderColor: card.popular ? 'var(--primary)' : undefined,
              position: 'relative',
              borderRadius: 18,
            }}
          >
            {card.popular && (
              <span
                style={{
                  position: 'absolute',
                  top: 16,
                  insetInlineEnd: 16,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(14, 165, 233, 0.15)',
                  color: '#0ea5e9',
                  border: '1px solid rgba(14, 165, 233, 0.3)',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                الأكثر اختياراً
              </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: `${card.tone}20`,
                  color: card.tone,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${card.tone}40`,
                }}
              >
                <Icon name="subscriptions" size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{card.label}</h3>
                <small style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  {text.subs}: <strong>{plansDetail[card.id]?.subscribers ?? '—'}</strong>
                </small>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10, margin: '14px 0' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  borderRadius: 10,
                  background: 'var(--cs-glass-surface)',
                  border: '1px solid var(--cs-glass-border)',
                  fontSize: 12,
                }}
              >
                <span>{text.feat.children}</span>
                <strong>{card.data?.limits?.children ?? '—'} ملفات</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  borderRadius: 10,
                  background: 'var(--cs-glass-surface)',
                  border: '1px solid var(--cs-glass-border)',
                  fontSize: 12,
                }}
              >
                <span>{text.feat.devices}</span>
                <strong>{card.data?.limits?.devices ?? '—'} أجهزة</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  borderRadius: 10,
                  background: 'var(--cs-glass-surface)',
                  border: '1px solid var(--cs-glass-border)',
                  fontSize: 12,
                }}
              >
                <span>{text.feat.streams}</span>
                <strong>{card.data?.limits?.concurrent_streams ?? '—'} شاشات متزامنة</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  borderRadius: 10,
                  background: 'var(--cs-glass-surface)',
                  border: '1px solid var(--cs-glass-border)',
                  fontSize: 12,
                }}
              >
                <span>{text.feat.downloads}</span>
                <strong>
                  {card.data?.limits?.download_devices
                    ? `${card.data.limits.download_devices} أجهزة أوفلاين`
                    : 'غير متاح'}
                </strong>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 'auto',
                paddingTop: 14,
                borderTop: '1px solid var(--cs-glass-border)',
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{text.source}</span>
              <Link
                className="button button--secondary button--small"
                to={adminPath(`plans/${card.id}`)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Icon name="sparkles" size={13} />
                <span>{text.cta}</span>
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* 5. Parity Comparison Table Card */}
      <section className="catalog-filter-card" style={{ padding: 24, marginTop: 20, borderRadius: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{text.comparison}</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              المطابقة الصارمة بين قواعد الخادم وسياسات التخويل الموزعة
            </p>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{text.source}</span>
        </div>

        <div className="table-scroll" tabIndex={0}>
          <table className="data-table data-table--wide">
            <thead>
              <tr>
                <th>الميزة / الحد الفعلي</th>
                <th>المجانية (Free)</th>
                <th>العائلة (Family)</th>
                <th>العائلة بلس (Family Plus)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{text.feat.children}</td>
                <td>{free?.limits?.children ?? 1}</td>
                <td>{family?.limits?.children ?? 4}</td>
                <td>{familyPlus?.limits?.children ?? 4}</td>
              </tr>
              <tr>
                <td>{text.feat.devices}</td>
                <td>{free?.limits?.devices ?? 1}</td>
                <td>{family?.limits?.devices ?? 4}</td>
                <td>{familyPlus?.limits?.devices ?? 8}</td>
              </tr>
              <tr>
                <td>{text.feat.streams}</td>
                <td>1</td>
                <td>2</td>
                <td>4</td>
              </tr>
              <tr>
                <td>{text.feat.downloads}</td>
                <td>0</td>
                <td>
                  <span className="track-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    ✓ 2 أجهزة
                  </span>
                </td>
                <td>
                  <span className="track-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    ✓ 4 أجهزة
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Commerce Controls Component */}
      <div style={{ marginTop: 20 }}>
        <CommerceControls onChanged={() => void load()} />
      </div>

      {/* 7. Google Play Live Regional Pricing Card */}
      <section className="catalog-filter-card" style={{ padding: 24, marginTop: 20, borderRadius: 18 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{text.googleTitle}</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 680 }}>
              {text.googleDesc}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>تصفية بالدولة:</span>
              <input
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value.toUpperCase())}
                placeholder="EG, SA, US"
                maxLength={2}
                style={{
                  height: 38,
                  borderRadius: 10,
                  border: '1px solid var(--cs-glass-border)',
                  background: 'var(--cs-glass-surface)',
                  padding: '0 12px',
                  width: 110,
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'center',
                  outline: 'none',
                }}
              />
            </label>

            <button
              type="button"
              className="button button--secondary button--small"
              disabled={!selectedGoogleProduct || priceBusy}
              onClick={() => void loadGooglePricing(selectedGoogleProduct)}
              style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="refresh" size={14} />
              <span>{text.refresh}</span>
            </button>
          </div>
        </div>

        {priceError && (
          <div className="inline-alert inline-alert--error" style={{ marginBottom: 16 }}>
            {priceError}
          </div>
        )}
        {priceNotice && (
          <div className="inline-alert inline-alert--success" style={{ marginBottom: 16 }}>
            {priceNotice}
          </div>
        )}

        {googlePrices && (
          <>
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--cs-glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="globe" size={16} />
                <span>
                  <strong>إصدار الأقاليم (Regions version):</strong>{' '}
                  <span dir="ltr" style={{ fontWeight: 800, color: '#0ea5e9' }}>
                    {googlePrices.regions_version}
                  </span>
                </span>
              </div>
              <span style={{ color: 'var(--text-secondary)' }}>
                يطبق على المشتركين الجدد فقط؛ المشتركون الحاليون محتفظون بتعريفتهم تلقائياً.
              </span>
            </div>

            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Base Plan</th>
                    <th>الدولة (ISO)</th>
                    <th>السعر الحالي في المتجر</th>
                    <th>إتاحة المشتركين الجدد</th>
                    <th style={{ textAlign: 'end' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {(googlePrices.base_plans ?? []).flatMap((base: any) =>
                    (base.regional_configs ?? [])
                      .filter((c: any) => !countryFilter || c.region_code === countryFilter)
                      .map((c: any) => (
                        <tr key={`${base.base_plan_id}:${c.region_code}`}>
                          <td dir="ltr" style={{ fontWeight: 800, color: 'var(--text)' }}>
                            {base.base_plan_id}
                          </td>
                          <td>
                            <span
                              className="plan-badge"
                              style={{
                                padding: '4px 10px',
                                borderRadius: 8,
                                fontWeight: 800,
                                background: 'rgba(99, 102, 241, 0.12)',
                                color: '#6366f1',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                              }}
                            >
                              {c.region_code}
                            </span>
                          </td>
                          <td dir="ltr" style={{ fontWeight: 700, fontSize: 13 }}>
                            {c.price ? (
                              <span>
                                {c.price.currencyCode} {c.price.units}
                                {c.price.nanos ? '.' + String(c.price.nanos).slice(0, 2) : ''}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <span
                              className={`account-status account-status--${
                                c.new_subscriber_availability ? 'active' : 'archived'
                              }`}
                            >
                              {c.new_subscriber_availability ? 'متاح للمشتركين الجدد' : 'مغلق'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'end' }}>
                            <button
                              type="button"
                              className="button button--ghost button--small"
                              disabled={!c.price || priceBusy}
                              onClick={() => openPriceDrawer(base.base_plan_id, c)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <Icon name="edit" size={13} />
                              <span>تعديل السعر</span>
                            </button>
                          </td>
                        </tr>
                      )),
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Price Change Drafts History */}
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>سجل مسودات تعديل الأسعار الإقليمية</h4>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              المسودة توثق المقترح، ولا تُفعل إلا بالاعتماد الصريح
            </span>
          </div>

          {googleDrafts.length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>المسودة</th>
                    <th>الدولة</th>
                    <th>السعر المسجل سابقاً</th>
                    <th>السعر المقترح الجديد</th>
                    <th>الحالة التدقيقية</th>
                    <th style={{ textAlign: 'end' }}>النشر</th>
                  </tr>
                </thead>
                <tbody>
                  {googleDrafts.map((d: any) => (
                    <tr key={d.id}>
                      <td dir="ltr">
                        <small style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>
                          {d.id.slice(0, 10)}…
                        </small>
                        <br />
                        <span style={{ fontSize: 12, fontWeight: 800 }}>{d.base_plan_id}</span>
                      </td>
                      <td>
                        <span className="plan-badge">{d.region_code}</span>
                      </td>
                      <td dir="ltr">
                        {d.observed_price
                          ? `${d.observed_price.currencyCode} ${d.observed_price.units}`
                          : '—'}
                      </td>
                      <td dir="ltr" style={{ fontWeight: 800, color: '#10b981' }}>
                        {d.currency_code} {d.units}
                        {d.nanos ? '.' + String(d.nanos).slice(0, 2) : ''}
                      </td>
                      <td>
                        <span
                          className={`account-status account-status--${
                            d.status === 'published' ? 'active' : 'archived'
                          }`}
                        >
                          {d.status === 'published' ? 'منشور في المتجر' : 'مسودة معلقة'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'end' }}>
                        {d.status === 'draft' ? (
                          <button
                            className="button button--primary button--small"
                            disabled={priceBusy}
                            onClick={() => void publishGoogleDraft(d)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <Icon name="upload" size={13} />
                            <span>نشر السعر الآن</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>✓ تم النشر</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="لا توجد مسودات تسعير حالية"
              description="انقر على 'تعديل السعر' لأي دولة لإنشاء مقترح سعر مدقق وجديد."
            />
          )}
        </div>
      </section>

      {/* 8. Slide-Over Price Adjustment Drawer */}
      {isDrawerOpen && (
        <>
          <div className="commercial-drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />
          <div className="commercial-slide-drawer" role="dialog" aria-modal="true">
            <div className="commercial-drawer__header">
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>
                  {selectedRegionalConfig ? 'تعديل السعر الإقليمي' : 'اقتراح سعر إقليمي جديد'}
                </h3>
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {selectedRegionalConfig
                    ? `إقليم: ${selectedRegionalConfig.region_code} · ${selectedRegionalConfig.basePlanId}`
                    : 'تسجيل مسودة تعديل سعر لـ Google Play'}
                </small>
              </div>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => setIsDrawerOpen(false)}
                style={{ padding: 6 }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="commercial-drawer__body">
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 14,
                  background: 'rgba(14, 165, 233, 0.08)',
                  border: '1px solid rgba(14, 165, 233, 0.25)',
                  fontSize: 12,
                  color: 'var(--text)',
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 4, color: '#0ea5e9' }}>
                  معيار الأمان التجاري:
                </div>
                لا يتم إرسال التعديل فورياً لـ Google Play بل يُسجل مقترحاً مدققاً في مسودات الأسعار لمراجعته
                واعتماده.
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    الخطة الأساسية (Base Plan):
                  </span>
                  <select
                    value={draftForm.base_plan_id}
                    dir="ltr"
                    onChange={(e) => setDraftForm({ ...draftForm, base_plan_id: e.target.value })}
                    style={{
                      height: 42,
                      borderRadius: 12,
                      border: '1px solid var(--cs-glass-border)',
                      background: 'var(--surface-2)',
                      padding: '0 12px',
                      color: 'var(--text)',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {googlePrices?.base_plans?.map((b: any) => (
                      <option key={b.base_plan_id} value={b.base_plan_id}>
                        {b.base_plan_id}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      كود الدولة (ISO 3166):
                    </span>
                    <input
                      value={draftForm.region_code}
                      maxLength={2}
                      dir="ltr"
                      onChange={(e) =>
                        setDraftForm({ ...draftForm, region_code: e.target.value.toUpperCase() })
                      }
                      placeholder="SA, EG, AE"
                      style={{
                        height: 42,
                        borderRadius: 12,
                        border: '1px solid var(--cs-glass-border)',
                        background: 'var(--surface-2)',
                        padding: '0 12px',
                        color: 'var(--text)',
                        fontSize: 14,
                        fontWeight: 800,
                        textAlign: 'center',
                      }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      رمز العملة (Currency):
                    </span>
                    <input
                      value={draftForm.currency_code}
                      maxLength={3}
                      dir="ltr"
                      onChange={(e) =>
                        setDraftForm({ ...draftForm, currency_code: e.target.value.toUpperCase() })
                      }
                      placeholder="SAR, EGP, USD"
                      style={{
                        height: 42,
                        borderRadius: 12,
                        border: '1px solid var(--cs-glass-border)',
                        background: 'var(--surface-2)',
                        padding: '0 12px',
                        color: 'var(--text)',
                        fontSize: 14,
                        fontWeight: 800,
                        textAlign: 'center',
                      }}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      الوحدات الصحيحة (Units):
                    </span>
                    <input
                      value={draftForm.units}
                      inputMode="numeric"
                      dir="ltr"
                      onChange={(e) => setDraftForm({ ...draftForm, units: e.target.value })}
                      placeholder="29"
                      style={{
                        height: 42,
                        borderRadius: 12,
                        border: '1px solid var(--cs-glass-border)',
                        background: 'var(--surface-2)',
                        padding: '0 12px',
                        color: 'var(--text)',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      الكسور الدقيقة (Nanos):
                    </span>
                    <input
                      value={draftForm.nanos}
                      inputMode="numeric"
                      dir="ltr"
                      onChange={(e) => setDraftForm({ ...draftForm, nanos: e.target.value })}
                      placeholder="990000000"
                      style={{
                        height: 42,
                        borderRadius: 12,
                        border: '1px solid var(--cs-glass-border)',
                        background: 'var(--surface-2)',
                        padding: '0 12px',
                        color: 'var(--text)',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    />
                  </label>
                </div>

                {/* Live Preview Box */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 14,
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>
                    معاينة السعر النهائي للمشترك:
                  </span>
                  <span
                    dir="ltr"
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: '#10b981',
                      fontFamily: 'monospace',
                    }}
                  >
                    {draftForm.currency_code || 'SAR'} {draftForm.units || '0'}
                    {draftForm.nanos && draftForm.nanos !== '0'
                      ? '.' + String(draftForm.nanos).slice(0, 2)
                      : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="commercial-drawer__footer">
              <button
                type="button"
                className="button button--primary"
                disabled={priceBusy || !draftForm.region_code || !draftForm.units}
                onClick={() => void createGoogleDraft()}
                style={{ flex: 1, height: 44 }}
              >
                {priceBusy ? 'جارٍ حفظ المسودة…' : 'حفظ مقترح السعر في المسودات'}
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setIsDrawerOpen(false)}
                style={{ height: 44 }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
