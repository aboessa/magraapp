import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type {
  SupportSavedView,
  SupportSlaOverview,
  SupportTicket,
  SupportTicketDetail,
  TicketPriority,
  TicketStatus,
} from '../types/api'
import { Modal } from './Modal'
import { Pagination } from './Pagination'
import { EmptyState, ErrorState, LoadingState } from './PageState'
import { usePreferences } from '../context/preferences'

/**
 * طابور تذاكر الدعم ومساحة تفاصيل التذكرة.
 *
 * ## ما تحلّه
 *
 * كان سطح الدعم بحثًا واحدًا عن عائلة: شاشة مفيدة، وليست CRM. لا شيء كان يسجّل أن
 * محادثة حدثت، ولا ما وُعِد به، ولا من يملكها، ولا متى تستحق. فالسؤال نفسه إن
 * وصل مرّتين يُجاب مرّتين من الصفر، ولا أحد يعرف كم استغرقت الإجابة الثانية.
 *
 * ## ساعتان لا ساعة
 *
 * كل تذكرة تحمل حالة SLA محسوبة على الخادم: أول ردّ، والحلّ. تذكرة أُجيبت في عشر
 * دقائق وحُلّت في ثلاثة أيام تجربة جيّدة؛ وتذكرة حُلّت في ثلاثة أيام بلا ردّ في
 * يومين ليست كذلك — وهدف واحد لا يفرّق بينهما.
 *
 * ## الإجراءات التشغيلية
 *
 * تُعرض فقط الإجراءات التي **يمكن للمنصّة تنفيذها فعلًا**، وتُسرَد البقية مع سبب
 * تعذّر كل واحد نصًّا. هذا مقصود: سبق أن شُحنت في هذه اللوحة أزرار تفشل دائمًا
 * (نموذج ملف طفل مقابل خادم للقراءة فقط، سحب جهاز مقابل مسار يتحقّق من جلسة
 * والٍ)، والعلاج كان إزالتها وبيان السبب لا تعطيلها.
 */

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']
const PRIORITIES: TicketPriority[] = ['urgent', 'high', 'normal', 'low']
const CATEGORIES = [
  'billing', 'subscription', 'playback', 'downloads', 'account',
  'device', 'child_profile', 'content', 'privacy', 'bug', 'other',
] as const

const copy = {
  ar: {
    queue: 'طابور التذاكر',
    newTicket: 'تذكرة جديدة',
    search: 'بحث بالموضوع أو المرجع…',
    allStatuses: 'كل الحالات',
    allPriorities: 'كل الأولويات',
    allCategories: 'كل التصنيفات',
    liveOnly: 'غير المحسومة فقط',
    overdueOnly: 'المتأخّرة فقط',
    reference: 'المرجع',
    subject: 'الموضوع',
    category: 'التصنيف',
    priority: 'الأولوية',
    status: 'الحالة',
    assignee: 'المسؤول',
    due: 'استحقاق الحلّ',
    sla: 'SLA',
    tags: 'الوسوم',
    open: 'فتح',
    unassigned: 'بلا إسناد',
    breachResponse: 'تجاوز أول ردّ',
    breachResolution: 'تجاوز الحلّ',
    paused: 'موقوفة (انتظار العميل)',
    onTrack: 'داخل الهدف',
    empty: 'لا تذاكر مطابقة',
    emptyHint: 'غيّر الفلاتر أو افتح تذكرة جديدة.',
    loadError: 'تعذر تحميل التذاكر',
    slaTitle: 'التزام SLA',
    slaResponseBreaches: 'تجاوزات أول ردّ (مفتوحة)',
    slaResolutionBreaches: 'تجاوزات الحلّ (مفتوحة)',
    views: 'العروض المحفوظة',
    saveView: 'حفظ العرض الحالي',
    viewName: 'اسم العرض',
    shared: 'مشترك مع الفريق',
    deleteView: 'حذف',
    timeline: 'الخط الزمني',
    note: 'ملاحظة داخلية',
    addNote: 'إضافة ملاحظة',
    noteHint: 'الملاحظات داخلية: لا يوجد قناة مراسلة للعميل في المنصّة، ولا تُحسب الملاحظة كأول ردّ.',
    firstResponse: 'تسجيل أول ردّ',
    firstResponseChannel: 'القناة التي أُجيب بها العميل',
    firstResponseHint: 'المنصّة لا ترسل شيئًا؛ التسجيل هنا إقرار المشغّل بأنه ردّ عبر القناة التي استخدمها العميل.',
    firstResponseDone: 'أول ردّ مُسجَّل',
    escalate: 'تصعيد',
    escalateReason: 'سبب التصعيد',
    escalateHint: 'التصعيد يرفع الأولوية ويعيد حساب المواعيد؛ تصعيد بلا تحريك الساعة ملاحظة لا تصعيد.',
    actions: 'إجراءات تشغيلية',
    actionReason: 'السبب (إلزامي)',
    record: 'تسجيل',
    unavailableActions: 'إجراءات غير متاحة، وسبب كل واحد',
    familyLink: 'الحساب المرتبط',
    deviceLink: 'الجهاز',
    subscriptionLink: 'الاشتراك',
    purchaseLink: 'الشراء',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    cancel: 'إلغاء',
    required: 'الموضوع والتصنيف مطلوبان.',
    statuses: {
      open: 'مفتوحة', in_progress: 'قيد المعالجة', waiting_customer: 'انتظار العميل',
      resolved: 'محلولة', closed: 'مغلقة',
    } as Record<string, string>,
    priorities: { urgent: 'عاجلة', high: 'مرتفعة', normal: 'عادية', low: 'منخفضة' } as Record<string, string>,
    categories: {
      billing: 'فواتير', subscription: 'اشتراك', playback: 'تشغيل', downloads: 'تنزيلات',
      account: 'حساب', device: 'جهاز', child_profile: 'ملف طفل', content: 'محتوى',
      privacy: 'خصوصية', bug: 'خلل', other: 'أخرى',
    } as Record<string, string>,
    actionLabels: {
      manual_note: 'إجراء نُفِّذ خارج المنصّة (تسجيل)',
      entitlement_resync: 'إعادة مزامنة الاستحقاق',
      subscription_resync: 'إعادة مزامنة الاشتراك',
      restore_purchase: 'استعادة الشراء',
      device_revoke: 'سحب جهاز',
      pin_reset: 'إعادة ضبط رمز الوالد',
      account_recovery: 'استرداد الحساب',
    } as Record<string, string>,
  },
  en: {
    queue: 'Ticket queue',
    newTicket: 'New ticket',
    search: 'Search subject or reference…',
    allStatuses: 'All statuses',
    allPriorities: 'All priorities',
    allCategories: 'All categories',
    liveOnly: 'Unsettled only',
    overdueOnly: 'Overdue only',
    reference: 'Reference',
    subject: 'Subject',
    category: 'Category',
    priority: 'Priority',
    status: 'Status',
    assignee: 'Assignee',
    due: 'Resolution due',
    sla: 'SLA',
    tags: 'Tags',
    open: 'Open',
    unassigned: 'Unassigned',
    breachResponse: 'First response breached',
    breachResolution: 'Resolution breached',
    paused: 'Paused (waiting on customer)',
    onTrack: 'Within target',
    empty: 'No matching tickets',
    emptyHint: 'Change the filters or open a new ticket.',
    loadError: 'Unable to load tickets',
    slaTitle: 'SLA compliance',
    slaResponseBreaches: 'First-response breaches (open)',
    slaResolutionBreaches: 'Resolution breaches (open)',
    views: 'Saved views',
    saveView: 'Save current view',
    viewName: 'View name',
    shared: 'Shared with the team',
    deleteView: 'Delete',
    timeline: 'Timeline',
    note: 'Internal note',
    addNote: 'Add note',
    noteHint: 'Notes are internal: the platform has no customer messaging channel, and a note does not count as a first response.',
    firstResponse: 'Record first response',
    firstResponseChannel: 'Channel the family was answered on',
    firstResponseHint: 'The platform sends nothing; recording this is the operator stating they replied on the channel the family used.',
    firstResponseDone: 'First response recorded',
    escalate: 'Escalate',
    escalateReason: 'Escalation reason',
    escalateHint: 'Escalation raises the priority and re-derives the deadlines; escalating without moving the clock is a note, not an escalation.',
    actions: 'Operational actions',
    actionReason: 'Reason (required)',
    record: 'Record',
    unavailableActions: 'Unavailable actions, and why each one is unavailable',
    familyLink: 'Linked account',
    deviceLink: 'Device',
    subscriptionLink: 'Subscription',
    purchaseLink: 'Purchase',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    required: 'Subject and category are required.',
    statuses: {
      open: 'Open', in_progress: 'In progress', waiting_customer: 'Waiting on customer',
      resolved: 'Resolved', closed: 'Closed',
    } as Record<string, string>,
    priorities: { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' } as Record<string, string>,
    categories: {
      billing: 'Billing', subscription: 'Subscription', playback: 'Playback', downloads: 'Downloads',
      account: 'Account', device: 'Device', child_profile: 'Child profile', content: 'Content',
      privacy: 'Privacy', bug: 'Bug', other: 'Other',
    } as Record<string, string>,
    actionLabels: {
      manual_note: 'Action performed outside the platform (record it)',
      entitlement_resync: 'Entitlement resync',
      subscription_resync: 'Subscription resync',
      restore_purchase: 'Restore purchase',
      device_revoke: 'Revoke device',
      pin_reset: 'Reset parent PIN',
      account_recovery: 'Account recovery',
    } as Record<string, string>,
  },
}

const LIMIT = 25

export function SupportTickets({ familyId }: { familyId?: string }) {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sla, setSla] = useState<SupportSlaOverview | null>(null)
  const [views, setViews] = useState<SupportSavedView[]>([])

  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [live, setLive] = useState(true)
  const [overdue, setOverdue] = useState(false)

  const [detail, setDetail] = useState<SupportTicketDetail | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ subject: '', category: 'billing', priority: 'normal', family_id: familyId ?? '', body: '', tags: '' })
  const [note, setNote] = useState('')
  const [channel, setChannel] = useState('')
  const [escalation, setEscalation] = useState('')
  const [actionKind, setActionKind] = useState('manual_note')
  const [actionReason, setActionReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [viewName, setViewName] = useState('')

  const filters = useCallback(() => ({
    status: status || undefined,
    priority: priority || undefined,
    category: category || undefined,
    family_id: familyId || undefined,
    q: query.trim() || undefined,
    live: live ? '1' : undefined,
    overdue: overdue ? '1' : undefined,
    limit: LIMIT,
    offset,
  }), [category, familyId, live, offset, overdue, priority, query, status])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ticketsResponse, slaResponse, viewsResponse] = await Promise.all([
        api.supportTickets(filters()),
        api.supportSla(),
        api.supportViews(),
      ])
      setTickets(ticketsResponse.data)
      setTotal(ticketsResponse.meta?.total ?? ticketsResponse.data.length)
      setSla(slaResponse.data)
      setViews(viewsResponse.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [filters, text.loadError])

  useEffect(() => { void load() }, [load])

  const openTicket = useCallback(async (id: string) => {
    setModalError('')
    setNote('')
    setChannel('')
    setEscalation('')
    setActionReason('')
    try {
      const response = await api.supportTicket(id)
      setDetail(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }, [text.loadError])

  async function runGuarded(work: () => Promise<unknown>, refreshDetail = true) {
    setSaving(true)
    setModalError('')
    try {
      await work()
      if (refreshDetail && detail) await openTicket(detail.ticket.id)
      await load()
      return true
    } catch (caught) {
      setModalError(caught instanceof Error ? caught.message : text.loadError)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function createTicket() {
    if (!form.subject.trim()) { setModalError(text.required); return }
    const created = await runGuarded(async () => {
      const response = await api.createSupportTicket({
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        family_id: form.family_id.trim() || null,
        body: form.body.trim() || null,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      })
      setCreateOpen(false)
      setForm({ subject: '', category: 'billing', priority: 'normal', family_id: familyId ?? '', body: '', tags: '' })
      await openTicket(response.data.id)
    }, false)
    if (!created) return
  }

  const slaLabel = (ticket: SupportTicket) => {
    if (ticket.sla.paused) return text.paused
    if (ticket.sla.resolution_breached) return `${text.breachResolution} (+${ticket.sla.resolution_minutes_late}m)`
    if (ticket.sla.first_response_breached) return text.breachResponse
    return text.onTrack
  }

  const slaClass = (ticket: SupportTicket) => {
    if (ticket.sla.resolution_breached) return 'blocked'
    if (ticket.sla.first_response_breached) return 'warn'
    if (ticket.sla.paused) return 'not_applicable'
    return 'pass'
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel__header">
          <div><h3>{text.queue} <span className="title-count">{total}</span></h3></div>
          <button className="button button--primary" type="button" onClick={() => { setCreateOpen(true); setModalError('') }}>
            {text.newTicket}
          </button>
        </div>

        {sla && (
          <p className="readiness-note">
            {text.slaTitle} — {text.slaResponseBreaches}: {sla.open_breaches.first_response} ·
            {' '}{text.slaResolutionBreaches}: {sla.open_breaches.resolution}
          </p>
        )}

        <div className="filters-row">
          <label className="search-field">
            <input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0) }} placeholder={text.search} />
          </label>
          <select aria-label={text.allStatuses} value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0) }}>
            <option value="">{text.allStatuses}</option>
            {STATUSES.map((item) => <option value={item} key={item}>{text.statuses[item]}</option>)}
          </select>
          <select aria-label={text.allPriorities} value={priority} onChange={(event) => { setPriority(event.target.value); setOffset(0) }}>
            <option value="">{text.allPriorities}</option>
            {PRIORITIES.map((item) => <option value={item} key={item}>{text.priorities[item]}</option>)}
          </select>
          <select aria-label={text.allCategories} value={category} onChange={(event) => { setCategory(event.target.value); setOffset(0) }}>
            <option value="">{text.allCategories}</option>
            {CATEGORIES.map((item) => <option value={item} key={item}>{text.categories[item]}</option>)}
          </select>
          <label className="field field--inline">
            <input type="checkbox" checked={live} onChange={(event) => { setLive(event.target.checked); setOffset(0) }} />
            <span>{text.liveOnly}</span>
          </label>
          <label className="field field--inline">
            <input type="checkbox" checked={overdue} onChange={(event) => { setOverdue(event.target.checked); setOffset(0) }} />
            <span>{text.overdueOnly}</span>
          </label>
        </div>

        {views.length > 0 && (
          <div className="filters-row">
            <span className="readiness-note">{text.views}:</span>
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                className="button button--ghost"
                onClick={() => {
                  // العرض المحفوظ يُطبَّق على الفلاتر الحقيقية لا على نسخة موازية،
                  // فما يُعرض بعد التطبيق هو ما سيُرسل للخادم بالضبط.
                  const saved = JSON.parse(view.filters_json || '{}') as Record<string, string | boolean>
                  setStatus(typeof saved.status === 'string' ? saved.status : '')
                  setPriority(typeof saved.priority === 'string' ? saved.priority : '')
                  setCategory(typeof saved.category === 'string' ? saved.category : '')
                  setQuery(typeof saved.q === 'string' ? saved.q : '')
                  setLive(saved.live === true || saved.live === '1')
                  setOverdue(saved.overdue === true || saved.overdue === '1')
                  setOffset(0)
                }}
              >
                {view.name}{view.is_shared ? ' ⁂' : ''}
              </button>
            ))}
          </div>
        )}

        <div className="filters-row">
          <label className="field">
            <span>{text.viewName}</span>
            <input value={viewName} onChange={(event) => setViewName(event.target.value)} />
          </label>
          <button
            className="button button--ghost"
            type="button"
            disabled={!viewName.trim() || saving}
            onClick={() => void runGuarded(async () => {
              await api.createSupportView({
                name: viewName.trim(),
                filters: { status, priority, category, q: query.trim(), live, overdue },
                is_shared: true,
              })
              setViewName('')
            }, false)}
          >
            {text.saveView}
          </button>
        </div>

        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : tickets.length ? (
          <>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table data-table--wide">
                <thead>
                  <tr>
                    <th>{text.reference}</th><th>{text.subject}</th><th>{text.category}</th>
                    <th>{text.priority}</th><th>{text.status}</th><th>{text.assignee}</th>
                    <th>{text.due}</th><th>{text.sla}</th><th />
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td dir="ltr"><span className="table-primary">{ticket.reference}</span></td>
                      <td>
                        <span className="table-primary">{ticket.subject}</span>
                        {ticket.tags.length > 0 && <span className="table-secondary">{ticket.tags.join(' · ')}</span>}
                      </td>
                      <td>{text.categories[ticket.category] ?? ticket.category}</td>
                      <td>{text.priorities[ticket.priority] ?? ticket.priority}</td>
                      <td>{text.statuses[ticket.status] ?? ticket.status}</td>
                      <td>{ticket.assignee_name || ticket.assignee_id || <span className="table-secondary">{text.unassigned}</span>}</td>
                      <td dir="ltr">{ticket.resolution_due_at?.slice(0, 16).replace('T', ' ') ?? '—'}</td>
                      <td>
                        <span className={`readiness-item readiness-item--${slaClass(ticket)} readiness-pill`}>
                          {slaLabel(ticket)}
                        </span>
                      </td>
                      <td>
                        <button className="button button--ghost" type="button" onClick={() => void openTicket(ticket.id)}>
                          {text.open}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={LIMIT} offset={offset} onOffsetChange={setOffset} locale={locale} />
          </>
        ) : <EmptyState title={text.empty} description={text.emptyHint} />}
      </section>

      {createOpen && (
        <Modal open title={text.newTicket} onClose={() => setCreateOpen(false)}>
          <div className="entity-form">
            {modalError && <p className="inline-alert inline-alert--error" role="alert">{modalError}</p>}
            <label className="field">
              <span>{text.subject}</span>
              <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>{text.category}</span>
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                  {CATEGORIES.map((item) => <option value={item} key={item}>{text.categories[item]}</option>)}
                </select>
              </label>
              <label className="field">
                <span>{text.priority}</span>
                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                  {PRIORITIES.map((item) => <option value={item} key={item}>{text.priorities[item]}</option>)}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>{text.familyLink}</span>
                <input value={form.family_id} dir="ltr" onChange={(event) => setForm({ ...form, family_id: event.target.value })} />
              </label>
              <label className="field">
                <span>{text.tags}</span>
                <input value={form.tags} dir="ltr" onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="refund, vat" />
              </label>
            </div>
            <label className="field">
              <span>{text.note}</span>
              <textarea rows={4} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
            </label>
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setCreateOpen(false)}>{text.cancel}</button>
              <button className="button button--primary" type="button" disabled={saving} onClick={() => void createTicket()}>
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal
          open
          title={`${detail.ticket.reference} — ${detail.ticket.subject}`}
          description={detail.ticket.sla.reason}
          onClose={() => setDetail(null)}
        >
          {modalError && <p className="inline-alert inline-alert--error" role="alert">{modalError}</p>}

          <div className="form-grid">
            <label className="field">
              <span>{text.status}</span>
              <select
                value={detail.ticket.status}
                onChange={(event) => void runGuarded(() => api.updateSupportTicket(detail.ticket.id, { status: event.target.value }))}
              >
                {STATUSES.map((item) => <option value={item} key={item}>{text.statuses[item]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.priority}</span>
              <select
                value={detail.ticket.priority}
                onChange={(event) => void runGuarded(() => api.updateSupportTicket(detail.ticket.id, { priority: event.target.value }))}
              >
                {PRIORITIES.map((item) => <option value={item} key={item}>{text.priorities[item]}</option>)}
              </select>
            </label>
          </div>

          <dl className="detail-list">
            <div><dt>{text.familyLink}</dt><dd dir="ltr">{detail.ticket.family_id ?? '—'}</dd></div>
            <div><dt>{text.deviceLink}</dt><dd dir="ltr">{detail.ticket.device_id ?? '—'}</dd></div>
            <div><dt>{text.subscriptionLink}</dt><dd dir="ltr">{detail.ticket.subscription_ref ?? '—'}</dd></div>
            <div><dt>{text.purchaseLink}</dt><dd dir="ltr">{detail.ticket.purchase_ref ?? '—'}</dd></div>
            <div><dt>{text.due}</dt><dd dir="ltr">{detail.ticket.resolution_due_at?.slice(0, 16).replace('T', ' ') ?? '—'}</dd></div>
            <div>
              <dt>{text.firstResponse}</dt>
              <dd dir="ltr">{detail.ticket.first_response_at?.slice(0, 16).replace('T', ' ') ?? '—'}</dd>
            </div>
          </dl>

          {!detail.ticket.first_response_at ? (
            <div className="filters-row">
              <label className="field">
                <span>{text.firstResponseChannel}</span>
                <input value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="email / phone / store" />
              </label>
              <button
                className="button button--ghost"
                type="button"
                disabled={!channel.trim() || saving}
                onClick={() => void runGuarded(() => api.recordSupportFirstResponse(detail.ticket.id, channel.trim()))}
              >
                {text.firstResponse}
              </button>
            </div>
          ) : <p className="readiness-note">{text.firstResponseDone}</p>}
          <p className="readiness-note">{text.firstResponseHint}</p>

          <div className="filters-row">
            <label className="field">
              <span>{text.escalateReason}</span>
              <input value={escalation} onChange={(event) => setEscalation(event.target.value)} />
            </label>
            <button
              className="button button--ghost"
              type="button"
              disabled={!escalation.trim() || saving || detail.ticket.status === 'closed'}
              onClick={() => void runGuarded(() => api.escalateSupportTicket(detail.ticket.id, escalation.trim()))}
            >
              {text.escalate}
            </button>
          </div>
          <p className="readiness-note">{text.escalateHint}</p>

          <label className="field">
            <span>{text.note}</span>
            <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="form-actions">
            <button
              className="button button--ghost"
              type="button"
              disabled={!note.trim() || saving}
              onClick={() => void runGuarded(async () => { await api.addSupportNote(detail.ticket.id, note.trim()); setNote('') })}
            >
              {text.addNote}
            </button>
          </div>
          <p className="readiness-note">{text.noteHint}</p>

          <h4>{text.actions}</h4>
          <div className="filters-row">
            <select value={actionKind} onChange={(event) => setActionKind(event.target.value)}>
              {detail.supported_actions.map((item) => (
                <option value={item} key={item}>{text.actionLabels[item] ?? item}</option>
              ))}
            </select>
            <label className="field">
              <span>{text.actionReason}</span>
              <input value={actionReason} onChange={(event) => setActionReason(event.target.value)} />
            </label>
            <button
              className="button button--ghost"
              type="button"
              disabled={!actionReason.trim() || saving}
              onClick={() => void runGuarded(async () => {
                await api.recordSupportAction(detail.ticket.id, actionKind, actionReason.trim())
                setActionReason('')
              })}
            >
              {text.record}
            </button>
          </div>

          {/* الإجراءات غير المتاحة تُسرَد بسببها الحقيقي بدل إخفائها أو تعطيلها:
              المشغّل الذي يعرف السبب يوجّه الطلب للمكان الصحيح بدل إعادة المحاولة. */}
          <details className="readiness-group">
            <summary>{text.unavailableActions}</summary>
            <ul className="readiness-list">
              {Object.entries(detail.unavailable_actions).map(([action, reason]) => (
                <li key={action} className="readiness-item readiness-item--not_applicable">
                  <div className="readiness-item__head">
                    <span className="readiness-item__label">{text.actionLabels[action] ?? action}</span>
                  </div>
                  <p className="readiness-item__detail">{reason}</p>
                </li>
              ))}
            </ul>
          </details>

          <details className="readiness-group" open>
            <summary>{text.timeline}</summary>
            <ul className="readiness-list">
              {detail.timeline.map((event) => (
                <li key={event.id} className="readiness-item readiness-item--not_applicable">
                  <div className="readiness-item__head">
                    <span className="readiness-item__label">{event.kind}</span>
                    <span className="readiness-item__owner" dir="ltr">
                      {event.actor_name ?? event.actor_id ?? '—'} · {event.created_at.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  {event.body && <p className="readiness-item__detail">{event.body}</p>}
                </li>
              ))}
            </ul>
          </details>
        </Modal>
      )}
    </div>
  )
}
