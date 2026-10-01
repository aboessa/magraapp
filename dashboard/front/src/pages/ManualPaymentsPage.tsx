import { useCallback, useEffect, useState } from 'react'
import { LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { hasPermission } from '../lib/adminSession'
import {
  api,
  type ManualMethodCode,
  type ManualPaymentMethod,
  type ManualPaymentRequest,
  type ManualPaymentSettings,
  type ManualPrices,
} from '../lib/api'
import { metricAvailabilityProps } from '../lib/labels'

/// Manual payments (wallets / InstaPay): the receiving numbers and prices the
/// app shows, and the transfers parents reported. Approving grants the plan
/// for the days copied into the request, on top of any period still running.

const PLAN: Record<string, string> = { family: 'العائلة', family_plus: 'العائلة بلس' }
const PERIOD: Record<string, string> = { monthly: 'شهري', annual: 'سنوي' }
const STATUS: Record<string, string> = { pending: 'مستني مراجعة', approved: 'اتقبل', rejected: 'اترفض', cancelled: 'ألغاه ولي الأمر' }
const FILTERS = ['pending', 'approved', 'rejected', 'cancelled', ''] as const

type Draft = {
  enabled: boolean
  receipt_required: boolean
  instructions: string
  methods: ManualPaymentMethod[]
  prices: ManualPrices
}

function toDraft(settings: ManualPaymentSettings): Draft {
  return {
    enabled: settings.enabled,
    receipt_required: settings.receipt_required,
    instructions: settings.instructions,
    methods: settings.methods,
    prices: settings.prices,
  }
}

function SettingsPanel({ settings, onSaved }: { settings: ManualPaymentSettings; onSaved: (next: ManualPaymentSettings) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const canEdit = hasPermission('manage_billing')
  const methodFor = (code: ManualMethodCode) => draft.methods.find((m) => m.code === code)

  const setMethod = (code: ManualMethodCode, patch: Partial<ManualPaymentMethod> | null) => {
    setDraft((current) => {
      const others = current.methods.filter((m) => m.code !== code)
      if (patch === null) return { ...current, methods: others }
      const existing = current.methods.find((m) => m.code === code) ?? { code, account: '', holder: '', enabled: true }
      const next = { ...existing, ...patch }
      return { ...current, methods: settings.method_codes.map((c) => (c === code ? next : others.find((m) => m.code === c))).filter(Boolean) as ManualPaymentMethod[] }
    })
  }

  const setPrice = (plan: keyof ManualPrices, period: 'monthly' | 'annual', raw: string) => {
    const value = raw.trim() === '' ? null : Number(raw)
    setDraft((current) => ({ ...current, prices: { ...current.prices, [plan]: { ...current.prices[plan], [period]: value } } }))
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const saved = (await api.saveManualPaymentSettings(draft)).data
      onSaved(saved)
      setDraft(toDraft(saved))
      setMessage({ ok: true, text: 'اتحفظ. التطبيق هيعرض التغيير في خلال دقيقة.' })
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : 'تعذر الحفظ' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="manual-settings-title">
      <h2 id="manual-settings-title" className="panel__title">أرقام الاستلام والأسعار</h2>
      <p className="panel__note">
        الأرقام دي بتظهر لولي الأمر في صفحة العضوية. المبلغ والمدة بيتحددوا من هنا بس، والتطبيق مش بيبعت مبلغ.
        {settings.updated_at && <> آخر تعديل: <span dir="ltr">{settings.updated_at}</span> (إصدار {settings.version}).</>}
      </p>

      <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={draft.enabled} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
        <span>تفعيل الدفع اليدوي في التطبيق</span>
      </label>

      <div className="table-scroll" tabIndex={0}>
        <table className="data-table">
          <thead><tr><th>الوسيلة</th><th>مفعّلة</th><th>الرقم / عنوان إنستاباي</th><th>اسم صاحب الحساب (اختياري)</th></tr></thead>
          <tbody>
            {settings.method_codes.map((code) => {
              const method = methodFor(code)
              const label = settings.method_labels[code]
              return (
                <tr key={code}>
                  <td>{label}</td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`تفعيل ${label}`}
                      checked={Boolean(method?.enabled)}
                      disabled={!canEdit}
                      onChange={(e) => (e.target.checked || method?.account ? setMethod(code, { enabled: e.target.checked }) : setMethod(code, null))}
                    />
                  </td>
                  <td>
                    <input
                      dir="ltr"
                      aria-label={`رقم ${label}`}
                      placeholder={code === 'instapay' ? 'name@instapay أو 01xxxxxxxxx' : '01xxxxxxxxx'}
                      value={method?.account ?? ''}
                      disabled={!canEdit}
                      onChange={(e) => (e.target.value || method?.enabled ? setMethod(code, { account: e.target.value }) : setMethod(code, null))}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`اسم صاحب حساب ${label}`}
                      value={method?.holder ?? ''}
                      maxLength={80}
                      disabled={!canEdit || !method}
                      onChange={(e) => setMethod(code, { holder: e.target.value })}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="table-scroll" tabIndex={0} style={{ marginTop: 12 }}>
        <table className="data-table">
          <thead><tr><th>الباقة</th><th>شهري (جنيه، 30 يوم)</th><th>سنوي (جنيه، 365 يوم)</th></tr></thead>
          <tbody>
            {(['family', 'family_plus'] as const).map((plan) => (
              <tr key={plan}>
                <td>{PLAN[plan]}</td>
                {(['monthly', 'annual'] as const).map((period) => (
                  <td key={period}>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      dir="ltr"
                      aria-label={`سعر ${PLAN[plan]} ${PERIOD[period]}`}
                      placeholder="مش متاح"
                      value={draft.prices[plan][period] ?? ''}
                      disabled={!canEdit}
                      onChange={(e) => setPrice(plan, period, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="field field--wide" style={{ marginTop: 12 }}>
        <label htmlFor="manual-instructions">تعليمات تظهر لولي الأمر (اختياري)</label>
        <textarea id="manual-instructions" rows={2} maxLength={600} value={draft.instructions} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
      </div>
      <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={draft.receipt_required} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, receipt_required: e.target.checked })} />
        <span>صورة الإيصال إجبارية</span>
      </label>

      {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'panel__note' : 'panel__note panel__note--bad'}>{message.text}</p>}
      <button className="button button--primary" type="button" disabled={!canEdit || saving} title={canEdit ? undefined : 'تحتاج صلاحية manage_billing'} onClick={() => void save()}>
        <Icon name="check" size={15} />{saving ? 'بيحفظ…' : 'حفظ'}
      </button>
    </section>
  )
}

function ReceiptButton({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt="إيصال التحويل" style={{ maxWidth: 120, maxHeight: 160, borderRadius: 6 }} />
      </a>
    )
  }
  return (
    <>
      <button className="button button--ghost button--small" type="button" onClick={() => void api.manualPaymentReceipt(id).then(setUrl).catch((e) => setError(e instanceof Error ? e.message : 'Error'))}>
        عرض الإيصال
      </button>
      {error && <small role="alert"> {error}</small>}
    </>
  )
}

export function ManualPaymentsPage() {
  const [settings, setSettings] = useState<ManualPaymentSettings | null>(null)
  const [requests, setRequests] = useState<ManualPaymentRequest[]>([])
  const [pending, setPending] = useState<number | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('pending')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const canReview = hasPermission('manage_billing')

  const loadRequests = useCallback(async (status: string) => {
    const result = await api.manualPaymentRequests(status || undefined)
    setRequests(result.data)
    setPending(result.meta?.pending ?? null)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([api.manualPaymentSettings(), loadRequests(filter)])
      .then(([s]) => { if (active) setSettings(s.data) })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Error') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filter, loadRequests])

  const approve = async (request: ManualPaymentRequest) => {
    const what = `${PLAN[request.plan]} ${PERIOD[request.period]} بـ ${request.amount_egp} جنيه من ${request.sender}`
    if (!window.confirm(`اتأكدت إن التحويل وصل؟\n${what}\nالاشتراك هيتفعّل ${request.days} يوم.`)) return
    setBusy(request.id)
    setError('')
    try {
      await api.approveManualPayment(request.id)
      await loadRequests(filter)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  const reject = async (request: ManualPaymentRequest) => {
    const reason = window.prompt('سبب الرفض؟ هيوصل لولي الأمر في إشعار (مثلًا: التحويل ماوصلش، المبلغ ناقص).')
    if (!reason || reason.trim().length < 3) return
    setBusy(request.id)
    setError('')
    try {
      await api.rejectManualPayment(request.id, reason.trim())
      await loadRequests(filter)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="content-studio-root">
      <section className="catalog-hero">
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta"><span className="catalog-hero__eyebrow">التجارة</span></div>
          <h1 className="catalog-hero__title">
            طلبات الدفع{' '}
            {pending == null
              ? <small {...metricAvailabilityProps(pending, 'ar')}>(— غير متاح)</small>
              : pending > 0 && <small>({pending} مستني)</small>}
          </h1>
          <p className="catalog-hero__desc">تحويلات فودافون كاش والمحافظ وإنستاباي. راجع التحويل في تطبيق المحفظة أو البنك الأول، وبعدين اقبل.</p>
        </div>
      </section>

      {error && <div className="panel panel--notice panel--notice--bad" role="alert"><strong>{error}</strong></div>}
      {loading && !settings && <LoadingState />}

      <section className="panel" aria-labelledby="manual-requests-title">
        <h2 id="manual-requests-title" className="panel__title">الطلبات</h2>
        <div role="group" aria-label="فلترة الطلبات" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {FILTERS.map((value) => (
            <button key={value || 'all'} type="button" aria-pressed={filter === value} className={`button button--small ${filter === value ? 'button--primary' : 'button--ghost'}`} onClick={() => setFilter(value)}>
              {value ? STATUS[value] : 'الكل'}
            </button>
          ))}
        </div>
        {requests.length === 0 && !loading ? <p className="panel__note">مفيش طلبات هنا.</p> : (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>التاريخ</th><th>الباقة</th><th>المبلغ</th><th>الوسيلة</th><th>من رقم</th><th>رقم العملية</th><th>الإيصال</th><th>ولي الأمر</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td dir="ltr">{request.created_at}</td>
                    <td>{PLAN[request.plan]} · {PERIOD[request.period]}</td>
                    <td>{request.amount_egp} جنيه</td>
                    <td>{settings?.method_labels[request.method_code] ?? request.method_code}</td>
                    <td dir="ltr">{request.sender}</td>
                    <td dir="ltr">{request.reference ?? '—'}</td>
                    <td>{request.has_receipt ? <ReceiptButton id={request.id} /> : '—'}</td>
                    <td dir="ltr"><small>{request.parent_id}</small></td>
                    <td>
                      {STATUS[request.status]}
                      {request.status === 'approved' && request.expires_at_ms && <small> لحد {new Date(request.expires_at_ms).toLocaleDateString('ar-EG')}</small>}
                      {request.status === 'rejected' && request.reject_reason && <small> ({request.reject_reason})</small>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {request.status === 'pending' && (
                        <>
                          <button className="button button--primary button--small" type="button" disabled={!canReview || busy === request.id} title={canReview ? undefined : 'تحتاج صلاحية manage_billing'} onClick={() => void approve(request)}>قبول</button>{' '}
                          <button className="button button--ghost button--small" type="button" disabled={!canReview || busy === request.id} onClick={() => void reject(request)}>رفض</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {settings && <SettingsPanel key={settings.version} settings={settings} onSaved={setSettings} />}
    </div>
  )
}
