import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { BillingPaymentMethod, PlanPricingRow, StoreProduct } from '../types/api'
import { EmptyState, ErrorState, LoadingState } from './PageState'

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }
const actionsStyle = { display: 'flex', gap: 6, flexWrap: 'wrap' as const }

const emptyProduct = {
  provider: 'google_play', store_product_id: '', plan: 'family', billing_period: 'monthly',
  base_country: '', currency: '', base_price_minor: '', trial_days: '',
}
const emptyPrice = {
  store_product_id: '', country: 'EG', currency: 'EGP',
  price_minor: '', effective_until: '',
}
const emptyMethod = {
  provider: 'payment_gateway', method_code: '', name_ar: '', name_en: '', country: 'EG',
  platform: 'web', checkout_mode: 'hosted_checkout', sort_order: '0',
}

type ProductForm = typeof emptyProduct
type PriceForm = typeof emptyPrice
type MethodForm = typeof emptyMethod

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: 'grid', gap: 5 }}><span className="table-secondary">{label}</span>{children}</label>
}

function statusClass(status: string) {
  return status === 'active' ? 'account-status account-status--active' : 'account-status account-status--archived'
}

function displayPrice(row: PlanPricingRow) {
  const divisor = 10 ** Number(row.currency_exponent ?? 2)
  return `${(row.price_minor / divisor).toFixed(Number(row.currency_exponent ?? 2))} ${row.currency}`
}

function reasonFor(action: string) {
  return window.prompt(`سبب ${action} (سيُحفظ في سجل التدقيق):`)?.trim() ?? ''
}

export function CommerceControls({ onChanged }: { onChanged?: () => void }) {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [prices, setPrices] = useState<PlanPricingRow[]>([])
  const [methods, setMethods] = useState<BillingPaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct)
  const [priceForm, setPriceForm] = useState<PriceForm>(emptyPrice)
  const [methodForm, setMethodForm] = useState<MethodForm>(emptyMethod)
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [editingMethod, setEditingMethod] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [productResult, priceResult, methodResult] = await Promise.all([
        api.storeProducts(), api.pricingMatrix(), api.paymentMethods(),
      ])
      setProducts(productResult.data)
      setPrices(priceResult.data)
      setMethods(methodResult.data)
      setPriceForm((current) => current.store_product_id || !productResult.data.length
        ? current : { ...current, store_product_id: productResult.data[0].id })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحميل إعدادات التجارة')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const completed = async (message: string) => {
    setNotice(message); setError(''); await load(); onChanged?.()
  }
  const failed = (caught: unknown) => setError(caught instanceof Error ? caught.message : 'تعذر حفظ التغيير')

  const submitProduct = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const payload = {
        ...productForm,
        base_country: productForm.base_country || null,
        currency: productForm.currency || null,
        base_price_minor: productForm.base_price_minor === '' ? null : Number(productForm.base_price_minor),
        trial_days: productForm.trial_days === '' ? null : Number(productForm.trial_days),
      }
      if (editingProduct) await api.updateStoreProduct(editingProduct, payload)
      else await api.createStoreProduct(payload)
      setEditingProduct(null); setProductForm(emptyProduct)
      await completed(editingProduct ? 'تم تحديث المنتج.' : 'تم إنشاء المنتج بحالة غير نشطة.')
    } catch (caught) { failed(caught) } finally { setBusy(false) }
  }

  const editProduct = (product: StoreProduct) => {
    setEditingProduct(product.id)
    setProductForm({
      provider: product.provider, store_product_id: product.store_product_id, plan: product.plan,
      billing_period: product.billing_period, base_country: product.base_country ?? '',
      currency: product.currency ?? '', base_price_minor: product.base_price_minor?.toString() ?? '',
      trial_days: product.trial_days?.toString() ?? '',
    })
  }

  const changeProductStatus = async (product: StoreProduct, status: 'inactive' | 'active' | 'deprecated') => {
    const reason = reasonFor(`تغيير حالة المنتج إلى ${status}`); if (!reason) return
    setBusy(true)
    try { await api.setStoreProductStatus(product.id, status, reason); await completed('تم تحديث حالة المنتج.') }
    catch (caught) { failed(caught) } finally { setBusy(false) }
  }

  const submitPrice = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const payload = {
        ...priceForm,
        price_minor: Number(priceForm.price_minor),
        effective_until: priceForm.effective_until || null,
      }
      if (editingPrice) await api.updatePricing(editingPrice, payload)
      else await api.createPricing(payload)
      setEditingPrice(null)
      setPriceForm({ ...emptyPrice, store_product_id: products[0]?.id ?? '' })
      await completed(editingPrice ? 'تم تحديث مسودة السعر.' : 'تم إنشاء مسودة السعر.')
    } catch (caught) { failed(caught) } finally { setBusy(false) }
  }

  const editPrice = (price: PlanPricingRow) => {
    setEditingPrice(price.id)
    setPriceForm({
      store_product_id: price.store_product_id, country: price.country, currency: price.currency,
      price_minor: String(price.price_minor),
      effective_until: price.effective_until?.slice(0, 16) ?? '',
    })
  }

  const changePriceStatus = async (price: PlanPricingRow, status: 'active' | 'expired') => {
    const reason = reasonFor(`${status === 'active' ? 'تفعيل' : 'إنهاء'} السعر`); if (!reason) return
    setBusy(true)
    try { await api.setPricingStatus(price.id, status, reason); await completed('تم تحديث دورة حياة السعر.') }
    catch (caught) { failed(caught) } finally { setBusy(false) }
  }

  const submitMethod = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const payload = { ...methodForm, sort_order: Number(methodForm.sort_order) }
      if (editingMethod) await api.updatePaymentMethod(editingMethod, payload)
      else await api.createPaymentMethod(payload)
      setEditingMethod(null); setMethodForm(emptyMethod)
      await completed(editingMethod ? 'تم تحديث وسيلة الدفع.' : 'تم إنشاء وسيلة الدفع كمسودة.')
    } catch (caught) { failed(caught) } finally { setBusy(false) }
  }

  const editMethod = (method: BillingPaymentMethod) => {
    setEditingMethod(method.id)
    setMethodForm({
      provider: method.provider, method_code: method.method_code, name_ar: method.name_ar,
      name_en: method.name_en, country: method.country, platform: method.platform,
      checkout_mode: method.checkout_mode, sort_order: String(method.sort_order),
    })
  }

  const changeMethodStatus = async (method: BillingPaymentMethod, status: 'draft' | 'active' | 'disabled') => {
    const reason = reasonFor(`تغيير حالة وسيلة الدفع إلى ${status}`); if (!reason) return
    setBusy(true)
    try { await api.setPaymentMethodStatus(method.id, status, reason); await completed('تم تحديث حالة وسيلة الدفع.') }
    catch (caught) { failed(caught) } finally { setBusy(false) }
  }

  if (loading) return <LoadingState />
  if (error && !products.length && !prices.length && !methods.length) return <ErrorState message={error} onRetry={() => void load()} />

  return <div className="page-stack">
    {(error || notice) && <div role={error ? 'alert' : 'status'} className={`status-badge ${error ? 'status-badge--review' : 'status-badge--active'}`}>{error || notice}</div>}

    <section className="panel panel--table">
      <div className="panel__header"><div><h3>منتجات المتاجر</h3><p className="panel__note">الربط بين الباقة ومعرّف المنتج لدى Google Play أو App Store أو بوابة الويب.</p></div></div>
      <form onSubmit={submitProduct} style={{ padding: 14, display: 'grid', gap: 12 }}>
        <div style={gridStyle}>
          <Field label="المزود"><select value={productForm.provider} disabled={Boolean(editingProduct)} onChange={(e) => setProductForm({ ...productForm, provider: e.target.value })}><option value="google_play">Google Play</option><option value="app_store">App Store</option><option value="stripe">Stripe</option><option value="manual">Manual mapping</option></select></Field>
          <Field label="معرّف المنتج"><input required dir="ltr" disabled={Boolean(editingProduct)} value={productForm.store_product_id} onChange={(e) => setProductForm({ ...productForm, store_product_id: e.target.value })} /></Field>
          <Field label="الباقة"><select disabled={Boolean(editingProduct)} value={productForm.plan} onChange={(e) => setProductForm({ ...productForm, plan: e.target.value })}><option value="family">family</option><option value="family_plus">family_plus</option></select></Field>
          <Field label="الدورة"><select value={productForm.billing_period} onChange={(e) => setProductForm({ ...productForm, billing_period: e.target.value })}><option value="weekly">weekly</option><option value="monthly">monthly</option><option value="annual">annual</option><option value="lifetime">lifetime</option></select></Field>
          <Field label="الدولة الأساسية"><input value={productForm.base_country} maxLength={2} placeholder="EG" onChange={(e) => setProductForm({ ...productForm, base_country: e.target.value.toUpperCase() })} /></Field>
          <Field label="العملة"><input value={productForm.currency} maxLength={3} placeholder="EGP" onChange={(e) => setProductForm({ ...productForm, currency: e.target.value.toUpperCase() })} /></Field>
          <Field label="السعر الأساسي (minor)"><input type="number" min="0" value={productForm.base_price_minor} onChange={(e) => setProductForm({ ...productForm, base_price_minor: e.target.value })} /></Field>
          <Field label="أيام التجربة"><input type="number" min="0" max="365" value={productForm.trial_days} onChange={(e) => setProductForm({ ...productForm, trial_days: e.target.value })} /></Field>
        </div>
        <div style={actionsStyle}><button className="button button--primary" disabled={busy}>{editingProduct ? 'حفظ التعديل' : 'إنشاء منتج غير نشط'}</button>{editingProduct && <button type="button" className="button button--ghost" onClick={() => { setEditingProduct(null); setProductForm(emptyProduct) }}>إلغاء</button>}</div>
      </form>
      {products.length ? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>المنتج</th><th>المزود</th><th>الباقة</th><th>الدورة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td dir="ltr">{product.store_product_id}</td><td>{product.provider}</td><td>{product.plan}</td><td>{product.billing_period}</td><td><span className={statusClass(product.status)}>{product.status}</span></td><td><div style={actionsStyle}><button className="button button--ghost button--small" disabled={busy || product.status === 'deprecated'} onClick={() => editProduct(product)}>تعديل</button>{product.status !== 'active' && product.status !== 'deprecated' && <button className="button button--primary button--small" disabled={busy} onClick={() => void changeProductStatus(product, 'active')}>تفعيل</button>}{product.status === 'active' && <button className="button button--secondary button--small" disabled={busy} onClick={() => void changeProductStatus(product, 'inactive')}>تعطيل</button>}{product.status !== 'deprecated' && <button className="button button--danger button--small" disabled={busy} onClick={() => void changeProductStatus(product, 'deprecated')}>إيقاف نهائي</button>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="لا توجد منتجات" description="أنشئ أول ربط لمنتج متجر." />}
    </section>

    <section className="panel panel--table">
      <div className="panel__header"><div><h3>الأسعار الإقليمية</h3><p className="panel__note">مسودة ثم تفعيل. تفعيل سعر جديد ينهي السعر النشط السابق لنفس المنتج والدولة.</p></div></div>
      <form onSubmit={submitPrice} style={{ padding: 14, display: 'grid', gap: 12 }}>
        <div style={gridStyle}>
          <Field label="منتج المتجر"><select required disabled={Boolean(editingPrice)} value={priceForm.store_product_id} onChange={(e) => setPriceForm({ ...priceForm, store_product_id: e.target.value })}><option value="">اختر</option>{products.map((product) => <option key={product.id} value={product.id}>{product.plan} · {product.provider} · {product.store_product_id}</option>)}</select></Field>
          <Field label="الدولة"><input required value={priceForm.country} maxLength={6} onChange={(e) => setPriceForm({ ...priceForm, country: e.target.value.toUpperCase() })} /></Field>
          <Field label="العملة"><input required value={priceForm.currency} maxLength={3} onChange={(e) => setPriceForm({ ...priceForm, currency: e.target.value.toUpperCase() })} /><small className="table-secondary">المنازل العشرية تُشتق خادميًا من ISO-4217.</small></Field>
          <Field label="السعر بالوحدة الصغرى"><input required type="number" min="0" value={priceForm.price_minor} onChange={(e) => setPriceForm({ ...priceForm, price_minor: e.target.value })} /></Field>
          <Field label="ينتهي (اختياري)"><input type="datetime-local" value={priceForm.effective_until} onChange={(e) => setPriceForm({ ...priceForm, effective_until: e.target.value })} /></Field>
        </div>
        <div style={actionsStyle}><button className="button button--primary" disabled={busy || !products.length}>{editingPrice ? 'حفظ المسودة' : 'إنشاء سعر'}</button>{editingPrice && <button type="button" className="button button--ghost" onClick={() => { setEditingPrice(null); setPriceForm({ ...emptyPrice, store_product_id: products[0]?.id ?? '' }) }}>إلغاء</button>}</div>
      </form>
      {prices.length ? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>الباقة/المنتج</th><th>الدولة</th><th>السعر</th><th>الفترة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>{prices.map((price) => <tr key={price.id}><td>{price.plan}<br/><small dir="ltr">{price.store_product_id}</small></td><td>{price.country}</td><td dir="ltr">{displayPrice(price)}</td><td>{String(price.effective_from).slice(0, 10)} → {price.effective_until ? String(price.effective_until).slice(0, 10) : '∞'}</td><td><span className={statusClass(price.status)}>{price.status}</span></td><td><div style={actionsStyle}>{price.status === 'draft' && <><button className="button button--ghost button--small" disabled={busy} onClick={() => editPrice(price)}>تعديل</button><button className="button button--primary button--small" disabled={busy} onClick={() => void changePriceStatus(price, 'active')}>تفعيل</button></>}{price.status === 'active' && <button className="button button--secondary button--small" disabled={busy} onClick={() => void changePriceStatus(price, 'expired')}>إنهاء</button>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="لا توجد أسعار" description="أضف سعرًا حسب الدولة والعملة." />}
    </section>

    <section className="panel panel--table">
      <div className="panel__header"><div><h3>وسائل الدفع</h3><p className="panel__note">الحالة Active لا تُقبل إلا إذا أكد الخادم جاهزية adapter والاعتماد والتحقق.</p></div></div>
      <form onSubmit={submitMethod} style={{ padding: 14, display: 'grid', gap: 12 }}>
        <div style={gridStyle}>
          <Field label="المزود"><select disabled={Boolean(editingMethod)} value={methodForm.provider} onChange={(e) => setMethodForm({ ...methodForm, provider: e.target.value })}><option value="google_play">Google Play</option><option value="app_store">App Store</option><option value="stripe">Stripe</option><option value="payment_gateway">Payment gateway</option></select></Field>
          <Field label="كود الوسيلة"><input required dir="ltr" disabled={Boolean(editingMethod)} value={methodForm.method_code} placeholder="vodafone_cash" onChange={(e) => setMethodForm({ ...methodForm, method_code: e.target.value })} /></Field>
          <Field label="الاسم العربي"><input required value={methodForm.name_ar} onChange={(e) => setMethodForm({ ...methodForm, name_ar: e.target.value })} /></Field>
          <Field label="الاسم الإنجليزي"><input required value={methodForm.name_en} onChange={(e) => setMethodForm({ ...methodForm, name_en: e.target.value })} /></Field>
          <Field label="الدولة"><input required value={methodForm.country} maxLength={6} onChange={(e) => setMethodForm({ ...methodForm, country: e.target.value.toUpperCase() })} /></Field>
          <Field label="المنصة"><select value={methodForm.platform} onChange={(e) => setMethodForm({ ...methodForm, platform: e.target.value })}><option value="android">Android</option><option value="ios">iOS</option><option value="web">Web</option></select></Field>
          <Field label="نمط الدفع"><select value={methodForm.checkout_mode} onChange={(e) => setMethodForm({ ...methodForm, checkout_mode: e.target.value })}><option value="native_store">native_store</option><option value="hosted_checkout">hosted_checkout</option><option value="redirect">redirect</option></select></Field>
          <Field label="الترتيب"><input type="number" value={methodForm.sort_order} onChange={(e) => setMethodForm({ ...methodForm, sort_order: e.target.value })} /></Field>
        </div>
        <div style={actionsStyle}><button className="button button--primary" disabled={busy}>{editingMethod ? 'حفظ التعديل' : 'إنشاء وسيلة كمسودة'}</button>{editingMethod && <button type="button" className="button button--ghost" onClick={() => { setEditingMethod(null); setMethodForm(emptyMethod) }}>إلغاء</button>}</div>
      </form>
      {methods.length ? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>الوسيلة</th><th>السوق</th><th>المسار</th><th>جاهزية الخادم</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>{methods.map((method) => <tr key={method.id}><td><strong>{method.name_ar}</strong><br/><small dir="ltr">{method.provider}/{method.method_code}</small></td><td>{method.country} · {method.platform}</td><td>{method.checkout_mode}</td><td><span className={method.runtime_ready ? 'status-badge status-badge--active' : 'status-badge status-badge--review'}>{method.runtime_ready ? 'جاهز' : 'غير مربوط'}</span></td><td><span className={statusClass(method.status)}>{method.status}</span></td><td><div style={actionsStyle}>{method.status !== 'active' && <button className="button button--ghost button--small" disabled={busy} onClick={() => editMethod(method)}>تعديل</button>}{method.status !== 'active' && <button className="button button--primary button--small" disabled={busy || !method.runtime_ready} onClick={() => void changeMethodStatus(method, 'active')}>تفعيل</button>}{method.status === 'active' && <button className="button button--secondary button--small" disabled={busy} onClick={() => void changeMethodStatus(method, 'disabled')}>تعطيل</button>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="لا توجد وسائل دفع" description="أنشئ الوسيلة كمسودة، ثم اربط adapter الخادمي قبل التفعيل." />}
    </section>
  </div>
}
