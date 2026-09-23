import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'

const copy = {
  ar: {
    eyebrow: 'المالية المتقدمة والتكاليف',
    title: 'اقتصاديات المحتوى وسجل التكاليف الإنتاجية',
    lede: 'تكلفة إنتاج المحتوى الرقمي مقابل معدلات الاستهلاك — الربحية الصافية لا تُعرض بدون نموذج إسناد إيراد محاسبي موثوق.',
    overview: 'نظرة عامة',
    revenue: 'الإيرادات',
    costs: 'سجل التكاليف',
    economics: 'اقتصاديات المحتوى',
    countries: 'البلدان',
    rightsCosts: 'تكاليف الحقوق',
    budget: 'الميزانية مقابل الفعلي',
    addCost: 'إضافة تكلفة إنتاج',
    entity: 'الكيان والمحتوى',
    category: 'فئة الإنفاق',
    amount: 'المبلغ',
    currency: 'العملة',
    vendor: 'المورّد / الاستوديو',
    period: 'الفترة المحاسبية',
    allocation: 'أساس التخصيص',
    storyCosts: 'تكاليف القصة',
    noCosts: 'لا توجد تكاليف مسجلة بعد',
    noCostsHint: 'أدخل تكلفة الإنتاج أو الرسم أو الترجمة أو الترخيص للأعمال المسجلة في الكتالوج.',
    profitUnavailable: 'الربحية غير متاحة — لا يوجد نموذج إسناد إيراد',
    ltvUnavailable: 'قيمة العميل الدائمة غير متاحة',
    cacUnavailable: 'تكلفة الاكتساب غير متاحة',
    costCategories: 'الكتابة / الرسم / التحريك / الصوت / الترجمة / المراجعة / الترخيص / الخارجي',
    totalCost: 'إجمالي التكلفة',
    costsByCurrency: 'التكاليف حسب العملة',
    budgetVsActualTitle: 'الميزانية التقديرية مقابل الفعلي',
    scopeExplanation: 'النطاق: كوكب / سلسلة / إنتاج عام — ميزانية / ملتزم به / فعلي / متوقع لكل فترة.',
    cancel: 'إلغاء',
    save: 'حفظ التكلفة',
    saving: 'جارٍ الحفظ...',
  },
  en: {
    eyebrow: 'Advanced Finance & Costing',
    title: 'Content Economics & Production Ledger',
    lede: 'Content cost vs user consumption — profitability is not claimed without an audited attribution framework.',
    overview: 'Overview',
    revenue: 'Revenue',
    costs: 'Cost Ledger',
    economics: 'Content Economics',
    countries: 'Countries',
    rightsCosts: 'Rights Costs',
    budget: 'Budget vs Actual',
    addCost: 'Add Production Cost',
    entity: 'Entity & Title',
    category: 'Category',
    amount: 'Amount',
    currency: 'Currency',
    vendor: 'Vendor / Studio',
    period: 'Period',
    allocation: 'Allocation Basis',
    storyCosts: 'Story Costs',
    noCosts: 'No costs recorded yet',
    noCostsHint: 'Enter production, illustration, translation, or licensing costs for catalog items.',
    profitUnavailable: 'Profit unavailable — no attribution model',
    ltvUnavailable: 'LTV unavailable',
    cacUnavailable: 'CAC unavailable',
    costCategories: 'Writing / Illustration / Animation / Audio / Translation / QA / Licensing / External',
    totalCost: 'Total Cost',
    costsByCurrency: 'Costs by Currency',
    budgetVsActualTitle: 'Budget vs Actual Performance',
    scopeExplanation: 'Scope: Planet / Series / Global — separate Budget / Committed / Actual / Forecast per period.',
    cancel: 'Cancel',
    save: 'Save Cost',
    saving: 'Saving...',
  },
}

const CATEGORIES = [
  'writing',
  'illustration',
  'animation',
  'video',
  'audio',
  'translation',
  'qa',
  'licensing',
  'external',
  'marketing',
  'technology',
  'other',
]

export function AdvancedFinancePage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [tab, setTab] = useState<'overview' | 'costs' | 'economics' | 'budget'>('overview')
  const [costs, setCosts] = useState<any[]>([])
  const [byCurrency, setByCurrency] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedCostDrawer, setSelectedCostDrawer] = useState<any>(null)
  const [form, setForm] = useState<any>({
    entity_type: 'story',
    entity_id: '',
    category: 'writing',
    amount_minor: 0,
    currency: 'EGP',
    vendor: '',
    allocation_basis: 'flat',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = (await api.contentCosts({ limit: 50 } as any)) as any
      setCosts(res.data ?? [])
      setByCurrency(res.meta?.by_currency ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createCost = async () => {
    if (!form.entity_id || !form.category) return
    setSaving(true)
    try {
      await api.createContentCost({
        ...form,
        amount_minor: Number(form.amount_minor),
      } as any)
      setFormOpen(false)
      setForm({
        entity_type: 'story',
        entity_id: '',
        category: 'writing',
        amount_minor: 0,
        currency: 'EGP',
        vendor: '',
        allocation_basis: 'flat',
      })
      void load()
    } finally {
      setSaving(false)
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
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#c084fc',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <span className="status-dot-pulse" style={{ background: '#a855f7' }} />
            <span>سجل تكاليف الإنتاج والملكية الفكرية نشط</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              padding: 4,
              borderRadius: 12,
              background: 'var(--surface-2)',
              border: '1px solid var(--cs-glass-border)',
              gap: 4,
            }}
          >
            {(['overview', 'costs', 'economics', 'budget'] as const).map((t) => (
              <button
                key={t}
                className={`button ${tab === t ? 'button--primary' : 'button--ghost'} button--small`}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: tab === t ? 800 : 500,
                }}
                onClick={() => setTab(t)}
              >
                {(text as any)[t]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={() => void load()}
            style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="refresh" size={14} />
            <span>تحديث السجل</span>
          </button>

          <button
            type="button"
            className="button button--primary button--small"
            onClick={() => setFormOpen(true)}
            style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="plus" size={14} />
            <span>{text.addCost}</span>
          </button>
        </div>
      </header>

      {/* 2. Hero Panoramic Headline */}
      <section className="catalog-hero" style={{ marginBottom: 20 }}>
        <div
          className="catalog-hero__glow"
          style={{
            background:
              'radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, rgba(16, 185, 129, 0.15) 50%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{ borderColor: 'rgba(168, 85, 247, 0.3)', color: '#a855f7' }}
            >
              <span className="status-dot-pulse" style={{ background: '#a855f7' }} />
              {costs.length} {locale === 'ar' ? 'بند تكلفة مسجل' : 'cost entries'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Production Bento Grid */}
      <div className="commercial-bento-grid">
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
              <Icon name="tag" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>CAPEX ENTRIES</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">{costs.length}</div>
            <div className="commercial-bento-card__label">
              {locale === 'ar' ? 'بنود التكاليف الموثقة' : 'Recorded Cost Entries'}
            </div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: '#10b981' }}>
              {byCurrency.length ? `${byCurrency.length} عملات مسجلة` : 'سجلات موثقة'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card">
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}
            >
              <Icon name="palette" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>DISCIPLINES</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">{CATEGORIES.length}</div>
            <div className="commercial-bento-card__label">
              {locale === 'ar' ? 'فئات الإنفاق والإنتاج' : 'Production Categories'}
            </div>
          </div>
          <div className="commercial-bento-card__footer">
            <span>كتابة، رسم، تحريك، صوت، ترجمة</span>
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
              <Icon name="series" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>ENTITIES</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">
              {new Set(costs.map((c) => c.entity_id)).size}
            </div>
            <div className="commercial-bento-card__label">
              {locale === 'ar' ? 'الكيانات المستفيدة' : 'Covered Entities'}
            </div>
          </div>
          <div className="commercial-bento-card__footer">
            <span>قصص، سلاسل، حلقات، ألعاب</span>
          </div>
        </div>

        <div className="commercial-bento-card">
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #a855f7, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}
            >
              <Icon name="shield" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#a855f7' }}>ATTRIBUTION</span>
          </div>
          <div>
            <div className="commercial-bento-card__value" style={{ fontSize: 20 }}>
              {locale === 'ar' ? 'فصل محاسبي نزيه' : 'Audited Parity'}
            </div>
            <div className="commercial-bento-card__label">
              {locale === 'ar' ? 'نموذج الإسناد والربحية' : 'Attribution Model'}
            </div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: '#a855f7' }}>فصل التكلفة عن الاستهلاك</span>
          </div>
        </div>
      </div>

      {/* 4. Tab Panels */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          <div className="catalog-filter-card" style={{ padding: 22, borderRadius: 18 }}>
            <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
              <Icon name="tag" size={18} />
              <span>{text.costsByCurrency}</span>
            </h3>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.currency}</th>
                    <th>{locale === 'ar' ? 'إجمالي الوحدات الصغرى' : 'Total (minor)'}</th>
                  </tr>
                </thead>
                <tbody>
                  {byCurrency.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        {locale === 'ar' ? 'لا توجد عملات مسجلة' : 'No currency totals'}
                      </td>
                    </tr>
                  ) : (
                    byCurrency.map((r: any) => (
                      <tr key={r.currency}>
                        <td>
                          <strong>{r.currency}</strong>
                        </td>
                        <td>
                          <span className="plan-badge" style={{ fontWeight: 800 }}>
                            {r.total}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              العملات المتعددة لا تُجمع بدون أسعار صرف رسمية معتمدة لكل فترة.
            </p>
          </div>

          <div className="catalog-filter-card" style={{ padding: 22, borderRadius: 18 }}>
            <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
              <Icon name="shield" size={18} />
              <span>{text.budgetVsActualTitle}</span>
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
              {text.scopeExplanation}
            </p>
            <div style={{ marginTop: 16 }}>
              <Link className="button button--ghost button--small" to={adminPath('series')}>
                مساحة عمل تكاليف السلاسل →
              </Link>
            </div>
            <div
              className="inline-alert inline-alert--info"
              style={{ marginTop: 16, borderRadius: 12 }}
            >
              {text.profitUnavailable} — يتم عرض الاستهلاك والتكلفة بشكل منفصل ومستقل.
            </div>
          </div>
        </div>
      )}

      {tab === 'costs' && (
        <section className="catalog-filter-card" style={{ padding: 22, borderRadius: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{text.costs}</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                سجل القيود المحاسبية الصريحة للمصروفات الإنتاجية
              </p>
            </div>
            <span className="track-badge">
              {costs.length} {locale === 'ar' ? 'بند' : 'records'}
            </span>
          </div>

          {costs.length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.entity}</th>
                    <th>{text.category}</th>
                    <th>{text.amount}</th>
                    <th>{text.currency}</th>
                    <th>{text.vendor}</th>
                    <th>{text.period}</th>
                    <th>{text.allocation}</th>
                    <th style={{ textAlign: 'end' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((c: any) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.entity_type}:{c.entity_id.slice(0, 8)}</strong>
                        <br />
                        <small style={{ color: 'var(--text-muted)' }}>{c.series_title ?? ''}</small>
                      </td>
                      <td>
                        <span className="track-badge">{c.category}</span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 14 }}>
                          {(c.amount_minor / 100).toFixed(2)}
                        </strong>
                      </td>
                      <td>{c.currency}</td>
                      <td>{c.vendor ?? '—'}</td>
                      <td>{c.period ?? '—'}</td>
                      <td>{c.allocation_basis ?? '—'}</td>
                      <td style={{ textAlign: 'end' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            className="button button--ghost button--small"
                            onClick={() => setSelectedCostDrawer(c)}
                            title="فحص التفاصيل"
                          >
                            <Icon name="eye" size={13} />
                          </button>
                          <Link
                            className="button button--ghost button--small"
                            to={adminPath(
                              `${
                                c.entity_type === 'series'
                                  ? 'series'
                                  : c.entity_type === 'episode'
                                  ? 'episodes'
                                  : c.entity_type === 'story'
                                  ? 'stories'
                                  : 'games'
                              }/${c.entity_id}`,
                            )}
                          >
                            المحتوى
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={text.noCosts} description={text.noCostsHint} />
          )}
        </section>
      )}

      {tab === 'economics' && (
        <div className="catalog-filter-card" style={{ padding: 22, borderRadius: 18 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>{text.economics}</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
            عرض بنود التكلفة للقصة / السلسلة: الكتابة، الرسم، التحريك، الصوت، الترجمة، التدقيق وضمان الجودة، والترخيص بعد توثيق البيانات الحقيقية.
          </p>

          <div className="table-scroll" tabIndex={0} style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>العنصر / المحتوى</th>
                  <th>{text.totalCost}</th>
                  <th>معدل الاستهلاك والمشاهدة</th>
                  <th>الربحية الصافية</th>
                </tr>
              </thead>
              <tbody>
                {costs.slice(0, 5).map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <strong dir="ltr">{c.entity_id.slice(0, 8)}</strong>
                    </td>
                    <td>
                      <strong style={{ fontSize: 14 }}>{(c.amount_minor / 100).toFixed(2)}</strong> {c.currency}
                    </td>
                    <td>—</td>
                    <td>
                      <span className="account-status account-status--review">
                        {text.profitUnavailable}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'budget' && (
        <div className="catalog-filter-card" style={{ padding: 22, borderRadius: 18 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>{text.budget}</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
            الميزانية التقديرية / الالتزامات التعاقدية / المصروف الفعلي / التوقعات المستقبلية لكل كوكب وسلسلة وإنتاج.
          </p>
          <div className="inline-alert inline-alert--warning" style={{ marginTop: 14, borderRadius: 12 }}>
            <Icon name="alert-triangle" size={16} />
            <span>عدم الخلط بين الميزانية التقديرية وبين التكاليف الفعلية الملتزم بها.</span>
          </div>
        </div>
      )}

      {/* 5. Slide-Over Production Cost Inspection Drawer */}
      {selectedCostDrawer && (
        <>
          <div className="commercial-drawer-backdrop" onClick={() => setSelectedCostDrawer(null)} />
          <div className="commercial-slide-drawer" role="dialog" aria-modal="true">
            <div className="commercial-drawer__header">
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>
                  فحص تفاصيل قيد تكلفة الإنتاج
                </h3>
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                  معرّف البند: {selectedCostDrawer.id}
                </small>
              </div>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => setSelectedCostDrawer(null)}
                style={{ padding: 6 }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="commercial-drawer__body">
              {/* Entity Headline Card */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 16,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <span className="track-badge" style={{ marginBottom: 6 }}>
                  {selectedCostDrawer.entity_type}
                </span>
                <h3 style={{ margin: '4px 0 2px', fontSize: 17, fontWeight: 900 }}>
                  {selectedCostDrawer.series_title || selectedCostDrawer.entity_id}
                </h3>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  {selectedCostDrawer.entity_id}
                </div>
              </div>

              {/* Amount and Currency */}
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: 14,
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)' }}>المبلغ المسجل:</span>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981', marginTop: 2 }}>
                    {(selectedCostDrawer.amount_minor / 100).toFixed(2)} {selectedCostDrawer.currency}
                  </div>
                </div>
                <span className="track-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 800 }}>
                  {selectedCostDrawer.allocation_basis ?? 'flat'}
                </span>
              </div>

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>فئة الإنفاق:</span>
                  <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>
                    <span className="track-badge">{selectedCostDrawer.category}</span>
                  </div>
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>المورّد / الاستوديو:</span>
                  <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>
                    {selectedCostDrawer.vendor || '—'}
                  </div>
                </div>
              </div>

              {/* Period & Notes */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 12,
                  background: 'var(--surface)',
                  border: '1px solid var(--cs-glass-border)',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>الفترة المحاسبية:</span>
                <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>
                  {selectedCostDrawer.period || 'فترة حالية مفتوحة'}
                </div>
              </div>
            </div>

            <div className="commercial-drawer__footer">
              <Link
                className="button button--primary"
                to={adminPath(
                  `${
                    selectedCostDrawer.entity_type === 'series'
                      ? 'series'
                      : selectedCostDrawer.entity_type === 'episode'
                      ? 'episodes'
                      : selectedCostDrawer.entity_type === 'story'
                      ? 'stories'
                      : 'games'
                  }/${selectedCostDrawer.entity_id}`,
                )}
                style={{ flex: 1, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Icon name="sparkles" size={15} />
                <span>فتح صفحة المحتوى في الاستوديو</span>
              </Link>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setSelectedCostDrawer(null)}
                style={{ height: 42 }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </>
      )}

      {/* 6. Modal for adding cost */}
      {formOpen && (
        <Modal open title={text.addCost} onClose={() => setFormOpen(false)}>
          <div className="entity-form">
            <label className="field">
              <span>نوع الكيان (Entity Type)</span>
              <select
                value={form.entity_type}
                onChange={(e) => setForm({ ...form, entity_type: e.target.value })}
              >
                <option value="series">series (سلسلة)</option>
                <option value="episode">episode (حلقة)</option>
                <option value="story">story (قصة)</option>
                <option value="game">game (لعبة)</option>
                <option value="planet">planet (كوكب)</option>
              </select>
            </label>

            <label className="field">
              <span>معرّف الكيان (Entity ID) *</span>
              <input
                value={form.entity_id}
                onChange={(e) => setForm({ ...form, entity_id: e.target.value })}
                placeholder="series_123 أو story_abc"
                dir="ltr"
              />
            </label>

            <label className="field">
              <span>فئة التكلفة (Category) *</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>المبلغ الإجمالي (Amount) *</span>
              <input
                type="number"
                value={form.amount_minor ? form.amount_minor / 100 : ''}
                onChange={(e) =>
                  setForm({ ...form, amount_minor: Math.round(Number(e.target.value) * 100) })
                }
                placeholder="1000.00"
                dir="ltr"
              />
            </label>

            <label className="field">
              <span>العملة (Currency) *</span>
              <input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                dir="ltr"
                placeholder="EGP, SAR, USD"
              />
            </label>

            <label className="field">
              <span>المورّد / الاستوديو (Vendor)</span>
              <input
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="اسم الاستوديو أو الرسام أو المؤدي"
              />
            </label>

            <label className="field">
              <span>أساس التخصيص (Allocation Basis)</span>
              <select
                value={form.allocation_basis}
                onChange={(e) => setForm({ ...form, allocation_basis: e.target.value })}
              >
                <option value="flat">ثابت (flat)</option>
                <option value="per_episode">لكل حلقة (per_episode)</option>
                <option value="per_minute">لكل دقيقة (per_minute)</option>
              </select>
            </label>

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => setFormOpen(false)}
              >
                {text.cancel}
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={saving || !form.entity_id}
                onClick={() => void createCost()}
              >
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
