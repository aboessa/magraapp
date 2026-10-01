import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { api } from '../lib/api'
import { usePreferences } from '../context/preferences'
import { formatDate } from '../lib/labels'

interface Coupon {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed_amount' | 'free_days'
  discount_value: number
  currency?: string
  applicable_plan: 'all' | 'family' | 'family_plus'
  max_redemptions: number | null
  times_redeemed: number
  starts_at?: string | null
  expires_at?: string | null
  affiliate_name?: string | null
  affiliate_commission_rate?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export function CouponsAdminPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')

  const [meta, setMeta] = useState({
    total: 0,
    active: 0,
    total_redemptions: 0,
    total_affiliates: 0,
  })

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState<{
    code: string
    discount_type: 'percentage' | 'fixed_amount' | 'free_days'
    discount_value: number
    currency: string
    applicable_plan: 'all' | 'family' | 'family_plus'
    max_redemptions: string
    expires_at: string
    affiliate_name: string
    affiliate_commission_rate: string
  }>({
    code: '',
    discount_type: 'percentage',
    discount_value: 20,
    currency: 'USD',
    applicable_plan: 'all',
    max_redemptions: '',
    expires_at: '',
    affiliate_name: '',
    affiliate_commission_rate: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.coupons()
      setCoupons(res.data)
      if (res.meta) {
        setMeta(res.meta)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحميل الكوبونات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleGenerateCode = () => {
    const prefixes = ['MAJARRA', 'SUPER', 'KIDS', 'HERO', 'EID', 'FAMILY']
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const randomNum = Math.floor(10 + Math.random() * 90)
    setForm(prev => ({ ...prev, code: `${randomPrefix}${randomNum}` }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim()) return

    setCreating(true)
    setCreateError('')
    try {
      await api.createCoupon({
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        currency: form.currency,
        applicable_plan: form.applicable_plan,
        max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null,
        expires_at: form.expires_at || null,
        affiliate_name: form.affiliate_name.trim() || null,
        affiliate_commission_rate: form.affiliate_commission_rate ? Number(form.affiliate_commission_rate) : 0,
        is_active: true,
      })
      setShowCreateModal(false)
      setForm({
        code: '',
        discount_type: 'percentage',
        discount_value: 20,
        currency: 'USD',
        applicable_plan: 'all',
        max_redemptions: '',
        expires_at: '',
        affiliate_name: '',
        affiliate_commission_rate: '',
      })
      await load()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'فشل إنشاء الكوبون')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      await api.updateCoupon(coupon.code, { is_active: !coupon.is_active })
      setCoupons(prev => prev.map(c => (c.code === coupon.code ? { ...c, is_active: !c.is_active } : c)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleDelete = async (coupon: Coupon) => {
    if (!confirm(ar ? `هل أنت متأكد من حذف الكوبون ${coupon.code} نهائياً؟` : `Delete coupon ${coupon.code}?`)) return
    try {
      await api.deleteCoupon(coupon.code)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const filtered = coupons.filter(c => {
    if (filterType !== 'all' && c.discount_type !== filterType) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchCode = c.code.toLowerCase().includes(q)
      const matchAffiliate = c.affiliate_name?.toLowerCase().includes(q)
      if (!matchCode && !matchAffiliate) return false
    }
    return true
  })

  return (
    <div className="page-stack">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="live-status-pulse" />
            <h1 className="admin-page-title" style={{ margin: 0 }}>
              {ar ? 'إدارة الكوبونات وشركاء النجاح (Coupons & Affiliates)' : 'Coupons & Affiliates Hub'}
            </h1>
          </div>
          <p className="admin-page-subtitle">
            {ar
              ? 'إنشاء أكواد الخصم الترويجية وفترات التجربة المجانية، وتتبع استخدامات حملات التسويق بالعمولة.'
              : 'Create promotional discounts, trial vouchers, and track affiliate partner performance.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
          </button>
          <button className="button button--primary button--small" onClick={() => setShowCreateModal(true)}>
            <Icon name="sparkles" size={14} />
            <span>{ar ? 'إنشاء كوبون جديد' : 'New Coupon'}</span>
          </button>
        </div>
      </div>

      {/* Bento Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'إجمالي الكوبونات' : 'Total Coupons'}</span>
            <div className="bento-glass-card__icon"><Icon name="subscriptions" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{meta.total}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{meta.active} {ar ? 'كوبون نشط' : 'active'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'مرات الاستخدام الفعلي' : 'Total Redemptions'}</span>
            <div className="bento-glass-card__icon"><Icon name="check" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ color: 'var(--color-success, #10b981)' }}>
            {meta.total_redemptions}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'تحويلات ناجحة' : 'Converted'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'شركاء التسويق (Affiliates)' : 'Affiliate Partners'}</span>
            <div className="bento-glass-card__icon"><Icon name="parents" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{meta.total_affiliates}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{ar ? 'شركاء مؤثرون' : 'Creators'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'أنواع الخصومات المدعومة' : 'Discount Types'}</span>
            <div className="bento-glass-card__icon"><Icon name="analytics" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 16 }}>% · $ · Days</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'تطبيق تلقائي عند الدفع' : 'Auto apply'}</span>
          </div>
        </article>
      </section>

      {/* Filter Strip */}
      <div className="filter-strip" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          className="input input--search"
          placeholder={ar ? 'بحث بكود الكوبون أو اسم الشريك...' : 'Search by coupon code or affiliate...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`button ${filterType === 'all' ? 'button--primary' : 'button--ghost'} button--small`}
            onClick={() => setFilterType('all')}
          >
            {ar ? 'الكل' : 'All'}
          </button>
          <button
            type="button"
            className={`button ${filterType === 'percentage' ? 'button--primary' : 'button--ghost'} button--small`}
            onClick={() => setFilterType('percentage')}
          >
            % {ar ? 'نسبة مئوية' : 'Percentage'}
          </button>
          <button
            type="button"
            className={`button ${filterType === 'fixed_amount' ? 'button--primary' : 'button--ghost'} button--small`}
            onClick={() => setFilterType('fixed_amount')}
          >
            $ {ar ? 'مبلغ ثابت' : 'Fixed'}
          </button>
          <button
            type="button"
            className={`button ${filterType === 'free_days' ? 'button--primary' : 'button--ghost'} button--small`}
            onClick={() => setFilterType('free_days')}
          >
            🎁 {ar ? 'أيام مجانية' : 'Free Trial'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <LoadingState label={ar ? 'جارٍ تحميل الكوبونات...' : 'Loading coupons...'} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : filtered.length === 0 ? (
          <EmptyState title={ar ? 'لا توجد أكواد خصم تطابق الفلاتر' : 'No matching coupons found'} description="" />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{ar ? 'كود الكوبون' : 'Code'}</th>
                <th>{ar ? 'الخصم الممنوح' : 'Discount'}</th>
                <th>{ar ? 'الباقة المستهدفة' : 'Plan'}</th>
                <th>{ar ? 'شريك التسويق' : 'Affiliate'}</th>
                <th>{ar ? 'الاستخدام / الحد الأقصى' : 'Usage'}</th>
                <th>{ar ? 'تاريخ الانتهاء' : 'Expires'}</th>
                <th>{ar ? 'الحالة' : 'Status'}</th>
                <th style={{ textAlign: 'end' }}>{ar ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(coupon => (
                <tr key={coupon.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <code
                        style={{
                          fontWeight: 800,
                          fontSize: 13,
                          letterSpacing: 1,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'var(--surface-sunken)',
                          border: '1px solid var(--border)',
                          color: 'var(--primary)',
                        }}
                      >
                        {coupon.code}
                      </code>
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        title={ar ? 'نسخ الكود' : 'Copy code'}
                        style={{ padding: 4 }}
                        onClick={() => {
                          void navigator.clipboard.writeText(coupon.code)
                          alert(ar ? `تم نسخ الكود ${coupon.code}` : `Copied ${coupon.code}`)
                        }}
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td>
                    <strong>
                      {coupon.discount_type === 'percentage' && `${coupon.discount_value}%`}
                      {coupon.discount_type === 'fixed_amount' && `${coupon.discount_value} ${coupon.currency || 'USD'}`}
                      {coupon.discount_type === 'free_days' && `${coupon.discount_value} ${ar ? 'يوم تجربة مجانية' : 'free days'}`}
                    </strong>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--surface-sunken)' }}>
                      {coupon.applicable_plan === 'all' ? (ar ? 'كافة الباقات' : 'All Plans') : coupon.applicable_plan}
                    </span>
                  </td>
                  <td>
                    {coupon.affiliate_name ? (
                      <div>
                        <strong>{coupon.affiliate_name}</strong>
                        {coupon.affiliate_commission_rate ? (
                          <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>
                            {ar ? `عمولة: ${coupon.affiliate_commission_rate}%` : `Comm: ${coupon.affiliate_commission_rate}%`}
                          </small>
                        ) : null}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span><strong>{coupon.times_redeemed}</strong> / {coupon.max_redemptions ?? '∞'}</span>
                    </div>
                  </td>
                  <td>
                    {coupon.expires_at ? (
                      <span style={{ fontSize: 12 }}>{formatDate(coupon.expires_at, locale)}</span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{ar ? 'دائم (بلا انتهاء)' : 'Permanent'}</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(coupon)}
                      style={{
                        cursor: 'pointer',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        border: 'none',
                        background: coupon.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: coupon.is_active ? '#10b981' : '#ef4444',
                      }}
                    >
                      {coupon.is_active ? (ar ? '● نشط' : 'Active') : (ar ? '○ معطل' : 'Disabled')}
                    </button>
                  </td>
                  <td style={{ textAlign: 'end' }}>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      style={{ color: 'var(--color-danger, #ef4444)' }}
                      onClick={() => void handleDelete(coupon)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <Modal
          open={showCreateModal}
          title={ar ? 'إنشاء كود خصم / كوبون تسويقي جديد' : 'Create New Promotional Coupon'}
          onClose={() => setShowCreateModal(false)}
          maxWidth={540}
        >
          {createError && (
            <div style={{ padding: 10, borderRadius: 6, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', marginBottom: 14, fontSize: 13 }}>
              {createError}
            </div>
          )}

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="field">
              <span className="field__label">{ar ? 'كود الكوبون (Coupon Code)' : 'Coupon Code'} *</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  required
                  className="input"
                  style={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}
                  placeholder="e.g. RAMADAN25"
                  value={form.code}
                  onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                />
                <button type="button" className="button button--secondary button--small" onClick={handleGenerateCode}>
                  🎲 {ar ? 'توليد تلقائي' : 'Generate'}
                </button>
              </div>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="field">
                <span className="field__label">{ar ? 'نوع الخصم' : 'Discount Type'}</span>
                <select
                  className="input"
                  value={form.discount_type}
                  onChange={e => setForm(prev => ({ ...prev, discount_type: e.target.value as any }))}
                >
                  <option value="percentage">نسبة مئوية (%)</option>
                  <option value="fixed_amount">مبلغ مالي ثابت ($)</option>
                  <option value="free_days">فترة تجربة مجانية (أيام)</option>
                </select>
              </label>

              <label className="field">
                <span className="field__label">{ar ? 'قيمة الخصم' : 'Discount Value'} *</span>
                <input
                  type="number"
                  required
                  min={1}
                  className="input"
                  value={form.discount_value}
                  onChange={e => setForm(prev => ({ ...prev, discount_value: Number(e.target.value) }))}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="field">
                <span className="field__label">{ar ? 'الباقة المؤهلة' : 'Applicable Plan'}</span>
                <select
                  className="input"
                  value={form.applicable_plan}
                  onChange={e => setForm(prev => ({ ...prev, applicable_plan: e.target.value as any }))}
                >
                  <option value="all">كافة الباقات (الكل)</option>
                  <option value="family">باقة العائلة (Family)</option>
                  <option value="family_plus">باقة العائلة بلس (Family+)</option>
                </select>
              </label>

              <label className="field">
                <span className="field__label">{ar ? 'الحد الأقصى لمرات الاستخدام' : 'Max Redemptions'}</span>
                <input
                  type="number"
                  min={1}
                  className="input"
                  placeholder={ar ? 'غير محدود (فارغ)' : 'Unlimited'}
                  value={form.max_redemptions}
                  onChange={e => setForm(prev => ({ ...prev, max_redemptions: e.target.value }))}
                />
              </label>
            </div>

            <label className="field">
              <span className="field__label">{ar ? 'تاريخ الانتهاء' : 'Expiry Date'}</span>
              <input
                type="date"
                className="input"
                value={form.expires_at}
                onChange={e => setForm(prev => ({ ...prev, expires_at: e.target.value }))}
              />
            </label>

            <div style={{ padding: 12, borderRadius: 8, background: 'var(--surface-sunken)', border: '1px solid var(--border)' }}>
              <strong style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
                🤝 {ar ? 'بيانات الشريك المسوّق (اختياري)' : 'Affiliate Marketer Details (Optional)'}
              </strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field__label">{ar ? 'اسم الشريك / القناة' : 'Partner Name'}</span>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. سارة محمد (مؤثرة تربوية)"
                    value={form.affiliate_name}
                    onChange={e => setForm(prev => ({ ...prev, affiliate_name: e.target.value }))}
                  />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field__label">{ar ? 'نسبة العمولة (%)' : 'Commission %'}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input"
                    placeholder="e.g. 15"
                    value={form.affiliate_commission_rate}
                    onChange={e => setForm(prev => ({ ...prev, affiliate_commission_rate: e.target.value }))}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button type="button" className="button button--ghost" onClick={() => setShowCreateModal(false)}>
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="button button--primary" disabled={creating}>
                {creating ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ ونشر الكوبون' : 'Create Coupon')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
export default CouponsAdminPage
