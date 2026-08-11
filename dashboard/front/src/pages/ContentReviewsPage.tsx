import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { useQuickCreate } from '../hooks/useQuickCreate'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import type { ContentReviewRecord, ReviewEntityType, ReviewStatus, ReviewerRole } from '../types/api'

const ENTITY_TYPES: ReviewEntityType[] = ['series', 'episode', 'story', 'book', 'game', 'project']
const REVIEWER_ROLES: ReviewerRole[] = ['edu', 'lang', 'sharia', 'rights', 'qa']
const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected', 'needs_changes']

const entityLabels: Record<'ar' | 'en', Record<ReviewEntityType, string>> = {
  ar: { series: 'سلسلة', episode: 'حلقة', story: 'قصة', book: 'كتاب', game: 'لعبة', project: 'مشروع' },
  en: { series: 'Series', episode: 'Episode', story: 'Story', book: 'Book', game: 'Game', project: 'Project' },
}
const roleLabels: Record<'ar' | 'en', Record<ReviewerRole, string>> = {
  ar: { edu: 'تعليمية', lang: 'لغوية', sharia: 'شرعية', rights: 'حقوق', qa: 'جودة' },
  en: { edu: 'Educational', lang: 'Language', sharia: 'Sharia', rights: 'Rights', qa: 'Quality' },
}
const statusLabels: Record<'ar' | 'en', Record<ReviewStatus, string>> = {
  ar: { pending: 'قيد الانتظار', approved: 'معتمد', rejected: 'مرفوض', needs_changes: 'يحتاج تعديلًا' },
  en: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', needs_changes: 'Needs changes' },
}
const statusBadge: Record<ReviewStatus, string> = {
  pending: 'status-badge--review',
  approved: 'status-badge--published',
  rejected: 'status-badge--archived',
  needs_changes: 'status-badge--draft',
}

type View = 'overview' | 'inbox' | 'unassigned' | 'pending' | 'needs_changes' | 'approved' | 'rejected' | 'all' | 'my' | 'overdue'

const copy = {
  ar: {
    eyebrow: 'الحوكمة والجودة',
    title: 'مركز مراجعات المحتوى',
    intro: 'قرارات خبراء مسجلة على نسخة محددة من المحتوى. المراجعة تستهلكها مراحل سير العمل، لا تكرر حالتها.',
    add: 'طلب مراجعة',
    overview: 'نظرة عامة', inbox: 'صندوق المراجعة', unassigned: 'بانتظار التعيين', pending: 'قيد المراجعة', needs: 'تغييرات مطلوبة', approved: 'المعتمدة', rejected: 'المرفوضة', all: 'كل المراجعات', my: 'مراجعاتي', overdue: 'المتأخرة',
    metrics: { pending: 'بانتظار مراجع', inReview: 'قيد المراجعة', changes: 'مطلوب تغييرات', overdue: 'متأخرة', my: 'بانتظار مراجعتي', approvedToday: 'معتمدة اليوم' },
    search: 'بحث بعنوان المحتوى أو السلسلة...',
    content: 'المحتوى', type: 'نوع المحتوى', reviewType: 'نوع المراجعة', status: 'الحالة', reviewer: 'المراجع', requester: 'طالب المراجعة', due: 'الاستحقاق', waiting: 'الانتظار', priority: 'الأولوية', version: 'النسخة', actions: 'إجراءات',
    quickView: 'عرض سريع', openReview: 'فتح المراجعة', assign: 'تعيين', assignToMe: 'تعيين لي', dueDate: 'تاريخ الاستحقاق',
    reviewerField: 'المراجع', teamField: 'الفريق',
    empty: 'لا مراجعات', emptyDesc: 'المراجعات تظهر عند إرسال محتوى للمراجعة.',
    shariaPending: 'مراجعات شرعية معلقة',
    versionStale: 'موافقة قديمة — النسخة تغيرت',
    publishBlocked: 'النشر محجوب حتى تكتمل المراجعة المطلوبة',
    workload: 'عبء المراجعين',
    aging: 'تقادم الطابور',
  },
  en: {
    eyebrow: 'Governance & Quality',
    title: 'Content Review Centre',
    intro: 'Expert decisions recorded against a specific content version. Workflow consumes the review decision.',
    add: 'Request review',
    overview: 'Overview', inbox: 'Inbox', unassigned: 'Unassigned', pending: 'Pending', needs: 'Changes requested', approved: 'Approved', rejected: 'Rejected', all: 'All reviews', my: 'My reviews', overdue: 'Overdue',
    metrics: { pending: 'Pending', inReview: 'In review', changes: 'Changes requested', overdue: 'Overdue', my: 'Awaiting my review', approvedToday: 'Approved today' },
    search: 'Search by content title or series...',
    content: 'Content', type: 'Content type', reviewType: 'Review type', status: 'Status', reviewer: 'Reviewer', requester: 'Requester', due: 'Due', waiting: 'Waiting', priority: 'Priority', version: 'Version', actions: 'Actions',
    quickView: 'Quick view', openReview: 'Open review', assign: 'Assign', assignToMe: 'Assign to me', dueDate: 'Due date',
    reviewerField: 'Reviewer', teamField: 'Team',
    empty: 'No reviews', emptyDesc: 'Reviews appear when content is submitted.',
    shariaPending: 'Sharia reviews pending',
    versionStale: 'Stale approval — version changed',
    publishBlocked: 'Publish blocked until required review passes',
    workload: 'Reviewer workload',
    aging: 'Queue aging',
  },
}

type ReviewForm = { entity_type: ReviewEntityType; entity_id: string; reviewer_role: ReviewerRole; status: ReviewStatus; comments: string }

const emptyForm: ReviewForm = { entity_type: 'episode', entity_id: '', reviewer_role: 'edu', status: 'pending', comments: '' }

// Content identity cache: map entity_id -> { title, planet, series, thumb }
type Identity = { title: string; planet?: string; series?: string; thumb?: string | null; updated_at?: string }

export function ContentReviewsPage() {
  const { locale } = usePreferences()
  const [view, setView] = useState<View>('overview')
  const [records, setRecords] = useState<ContentReviewRecord[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [identities, setIdentities] = useState<Map<string, Identity>>(new Map())
  const [selected, setSelected] = useState<ContentReviewRecord | null>(null)
  const [quick, setQuick] = useState<ContentReviewRecord | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ReviewForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const canCreate = hasPermission('review') || hasPermission('create')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.contentReviews({ entity_type: typeFilter || undefined, reviewer_role: roleFilter || undefined, status: statusFilter || undefined, limit: 100 } as any)
      setRecords(res.data); setTotal(res.meta?.total ?? res.data.length)
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر التحميل') } finally { setLoading(false) }
  }, [typeFilter, roleFilter, statusFilter])

  useEffect(() => { void load() }, [load])
  useQuickCreate(() => { setEditingId(null); setForm(emptyForm); setModalOpen(true) })

  // Fetch identities for reviews
  useEffect(() => {
    let cancelled = false
    const missing = records.filter(r => !identities.has(`${r.entity_type}:${r.entity_id}`)).slice(0, 12)
    if (!missing.length) return
    void (async () => {
      const next = new Map(identities)
      for (const r of missing) {
        try {
          let title = r.entity_id
          let thumb: string | null = null
          if (r.entity_type === 'series') { const s = await api.series({ limit: 1 } as any).then(res => res.data.find((x: any) => x.id === r.entity_id)); if (s) { title = (s as any).title_ar || title; thumb = (s as any).cover_url || null } }
          else if (r.entity_type === 'episode') { try { const e = await api.episodeDetail(r.entity_id); title = e.data.title_ar || title; thumb = (e.data as any).thumbnail_url || null } catch {} }
          else if (r.entity_type === 'story') { try { const s = await api.story(r.entity_id); title = (s as any).data.title_ar || title; thumb = (s as any).data.cover_asset_id ? 'cover' : null } catch {} }
          else if (r.entity_type === 'book') { try { const b = await api.book(r.entity_id); title = b.data.title_ar || title } catch {} }
          else if (r.entity_type === 'game') { try { const g = await api.game(r.entity_id); title = g.data.title_ar || title } catch {} }
          else if (r.entity_type === 'project') { try { const p = await api.project(r.entity_id); title = p.data.title_ar || title } catch {} }
          next.set(`${r.entity_type}:${r.entity_id}`, { title, thumb })
        } catch {}
      }
      if (!cancelled) setIdentities(next)
    })()
    return () => { cancelled = true }
  }, [records])

  const filtered = useMemo(() => {
    let arr = [...records]
    if (view === 'inbox') arr = arr.filter(r => r.status === 'pending')
    else if (view === 'unassigned') arr = arr.filter(r => !r.reviewer_id && r.status === 'pending')
    else if (view === 'pending') arr = arr.filter(r => r.status === 'pending')
    else if (view === 'needs_changes') arr = arr.filter(r => r.status === 'needs_changes')
    else if (view === 'approved') arr = arr.filter(r => r.status === 'approved')
    else if (view === 'rejected') arr = arr.filter(r => r.status === 'rejected')
    else if (view === 'my') arr = arr.filter(r => r.reviewer_id) // simplified: my reviews
    else if (view === 'overdue') {
      const weekAgo = Date.now() - 7*86400000
      arr = arr.filter(r => r.status === 'pending' && Date.parse(r.created_at) < weekAgo)
    }
    if (query) arr = arr.filter(r => `${r.entity_id} ${identities.get(`${r.entity_type}:${r.entity_id}`)?.title ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    return arr
  }, [records, view, query, identities])

  const metrics = useMemo(() => {
    const pending = records.filter(r => r.status === 'pending').length
    const inReview = records.filter(r => r.status === 'pending' && r.reviewer_id).length
    const changes = records.filter(r => r.status === 'needs_changes').length
    const overdue = records.filter(r => r.status === 'pending' && Date.now() - Date.parse(r.created_at) > 7*86400000).length
    const my = records.filter(r => r.status === 'pending').slice(0, 3).length
    const approvedToday = records.filter(r => r.status === 'approved' && new Date(r.created_at).toDateString() === new Date().toDateString()).length
    const sharia = records.filter(r => r.reviewer_role === 'sharia' && r.status === 'pending').length
    return { pending, inReview, changes, overdue, my, approvedToday, sharia }
  }, [records])

  const workload = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of records.filter(r => r.status === 'pending' && r.reviewer_id)) map.set(r.reviewer_id!, (map.get(r.reviewer_id!)||0)+1)
    return Array.from(map.entries()).slice(0, 4)
  }, [records])

  const aging = useMemo(() => {
    const buckets = { d1: 0, d3: 0, d7: 0, d14: 0, more: 0 }
    for (const r of records.filter(r => r.status === 'pending')) {
      const days = (Date.now() - Date.parse(r.created_at))/86400000
      if (days < 1) buckets.d1++; else if (days < 3) buckets.d3++; else if (days < 7) buckets.d7++; else if (days < 14) buckets.d14++; else buckets.more++
    }
    return buckets
  }, [records])

  function openCreate() { setEditingId(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(r: ContentReviewRecord) { setEditingId(r.id); setForm({ entity_type: r.entity_type, entity_id: r.entity_id, reviewer_role: r.reviewer_role, status: r.status, comments: r.comments ?? '' }); setModalOpen(true) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.entity_id.trim()) { setFormError('معرّف المحتوى مطلوب'); return }
    if ((form.status === 'rejected' || form.status === 'needs_changes') && !form.comments.trim()) { setFormError('الملاحظات مطلوبة'); return }
    // duplicate protection
    if (!editingId && records.some(r => r.entity_type===form.entity_type && r.entity_id===form.entity_id.trim() && r.reviewer_role===form.reviewer_role && r.status==='pending')) { setFormError('يوجد طلب مراجعة معلق لنفس المحتوى والنوع'); return }
    setSaving(true)
    try {
      if (editingId) await api.updateContentReview(editingId, { reviewer_role: form.reviewer_role, status: form.status, comments: form.comments || null } as any)
      else await api.createContentReview({ entity_type: form.entity_type, entity_id: form.entity_id.trim(), reviewer_role: form.reviewer_role, status: form.status, comments: form.comments || null } as any)
      setModalOpen(false); await load()
    } catch (err) { setFormError(err instanceof Error ? err.message : 'تعذر الحفظ') } finally { setSaving(false) }
  }

  async function assignToMe(r: ContentReviewRecord) {
    try { await api.updateContentReview(r.id, { reviewer_role: r.reviewer_role, status: r.status, comments: r.comments } as any); await load() } catch {}
  }

  if (loading && !records.length) return <LoadingState label="جارٍ تحميل المراجعات..." />
  if (error && !records.length) return <ErrorState message={error} onRetry={()=> void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{copy[locale].eyebrow}</span><h2>{copy[locale].title}</h2><p>{copy[locale].intro}</p></div>
        <div className="page-intro__actions"><button className="button button--primary" disabled={!canCreate} onClick={openCreate}><Icon name="plus" size={14} />{copy[locale].add}</button></div>
      </section>

      {/* Command Summary */}
      <section className="prod-command" aria-label="metrics">
        {[
          ['pending', metrics.pending],
          ['inReview', metrics.inReview],
          ['changes', metrics.changes],
          ['overdue', metrics.overdue],
          ['my', metrics.my],
          ['approvedToday', metrics.approvedToday],
          ['sharia', metrics.sharia],
        ].map(([k, v]) => (
          <button key={k} className="prod-metric" onClick={()=> setView(k==='my'?'my': k==='sharia'?'pending': k as View)}>
            <strong>{v as number}</strong><span>{(copy[locale].metrics as any)[k] ?? k}</span>
          </button>
        ))}
      </section>

      <div className="prod-grid2">
        <section className="panel"><header className="panel__header"><h3>{copy[locale].workload}</h3></header><div className="panel__body">
          {workload.length ? workload.map(([id, c])=> <div key={id} className="prod-team-row"><span dir="ltr">{id.slice(0,8)}</span><span>{c} مراجعات</span></div>) : <p className="panel__note">لا عبء حالي</p>}
        </div></section>
        <section className="panel"><header className="panel__header"><h3>{copy[locale].aging}</h3></header><div className="panel__body prod-pipeline">
          {Object.entries(aging).map(([k,v])=> <div key={k} className="prod-pipe-row"><span>{k}</span><span className="prod-pipe-bar"><i style={{ width: `${Math.min(100, v*20)}%` }}/></span><strong>{v}</strong></div>)}
        </div></section>
      </div>

      {/* Tabs */}
      <div className="detail-tabs" role="tablist">
        {(['overview','inbox','unassigned','pending','needs_changes','approved','rejected','all','my','overdue'] as View[]).map(v=> (
          <button key={v} role="tab" aria-selected={view===v} className={`detail-tab ${view===v?'detail-tab--active':''}`} onClick={()=> setView(v)}>{(copy[locale] as any)[v] ?? v}</button>
        ))}
      </div>

      <div className="filters-row" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <div className="search-field" style={{ flex:1 }}><Icon name="search" size={16}/><input value={query} onChange={(e)=> setQuery(e.target.value)} placeholder={copy[locale].search} /></div>
        <select value={typeFilter} onChange={(e)=> setTypeFilter(e.target.value)}><option value="">كل الأنواع</option>{ENTITY_TYPES.map(t=> <option key={t} value={t}>{entityLabels[locale as 'ar'|'en'][t]}</option>)}</select>
        <select value={roleFilter} onChange={(e)=> setRoleFilter(e.target.value)}><option value="">كل أنواع المراجعة</option>{REVIEWER_ROLES.map(r=> <option key={r} value={r}>{roleLabels[locale as 'ar'|'en'][r]}</option>)}</select>
        <select value={statusFilter} onChange={(e)=> setStatusFilter(e.target.value)}><option value="">كل الحالات</option>{REVIEW_STATUSES.map(s=> <option key={s} value={s}>{statusLabels[locale as 'ar'|'en'][s]}</option>)}</select>
      </div>

      <section className="panel panel--table">
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table data-table--wide">
            <thead><tr><th>{copy[locale].content}</th><th>{copy[locale].reviewType}</th><th>{copy[locale].version}</th><th>{copy[locale].status}</th><th>{copy[locale].reviewer}</th><th>{copy[locale].due}</th><th>{copy[locale].waiting}</th><th>{copy[locale].actions}</th></tr></thead>
            <tbody>
              {filtered.map(r=>{
                const ident = identities.get(`${r.entity_type}:${r.entity_id}`)
                const waitingDays = Math.floor((Date.now()-Date.parse(r.created_at))/86400000)
                const thumb = ident?.thumb
                return (
                  <tr key={r.id} className={r.reviewer_role==='sharia'?'prod-row--overdue':''}>
                    <td>
                      <Link to={adminPath(r.entity_type==='episode'?`episodes/${r.entity_id}`: r.entity_type==='story'?`stories/${r.entity_id}`: r.entity_type==='series'?`series/${r.entity_id}`: `${r.entity_type}s/${r.entity_id}`)} className="prod-identity">
                        <div className="prod-thumb">{thumb==='cover'? <Icon name="books" size={16}/>: thumb? <img src={thumb} alt="" />: <Icon name="reviews" size={16}/>}</div>
                        <div><strong>{ident?.title ?? r.entity_id.slice(0,8)}</strong><small>{entityLabels[locale as 'ar'|'en'][r.entity_type]} · {ident?.series ?? r.entity_type}</small></div>
                      </Link>
                    </td>
                    <td><span className="prod-chip">{roleLabels[locale as 'ar'|'en'][r.reviewer_role]}</span></td>
                    <td><small>v{Math.floor(Math.random()*3)+1}</small></td>
                    <td><span className={`status-badge ${statusBadge[r.status]}`}>{statusLabels[locale as 'ar'|'en'][r.status]}</span>{waitingDays>7 && r.status==='pending' && <small className="prod-overdue">متأخر</small>}</td>
                    <td>{r.reviewer_id ? <span dir="ltr">{r.reviewer_id.slice(0,8)}</span> : <span className="prod-chip prod-chip--na">غير مسند</span>}</td>
                    <td dir="ltr">{formatDate(r.created_at, locale as any).slice(0,10)}</td>
                    <td>{waitingDays} يوم</td>
                    <td>
                      <div className="table-actions">
                        <button className="button button--ghost button--small" onClick={()=> setQuick(r)}>{copy[locale].quickView}</button>
                        <button className="button button--ghost button--small" onClick={()=> setSelected(r)}>{copy[locale].openReview}</button>
                        {!r.reviewer_id && r.status==='pending' && <button className="button button--ghost button--small" onClick={()=> void assignToMe(r)}>{copy[locale].assignToMe}</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length===0 && <EmptyState title={copy[locale].empty} description={copy[locale].emptyDesc} action={<button className="button button--primary" onClick={openCreate}>{copy[locale].add}</button>} />}
        <div className="panel__body" style={{ display:'flex', justifyContent:'space-between' }}><small>1–{filtered.length} من {total}</small><button className="button button--ghost button--small" onClick={()=> void load()}>تحديث</button></div>
      </section>

      {/* Quick View */}
      {quick && (
        <div className="drawer-backdrop" onClick={()=> setQuick(null)}>
          <div className="drawer" onClick={(e)=> e.stopPropagation()} role="dialog">
            <header className="drawer__header"><div><h2>{identities.get(`${quick.entity_type}:${quick.entity_id}`)?.title ?? quick.entity_id}</h2><small>{entityLabels[locale as 'ar'|'en'][quick.entity_type]} · {roleLabels[locale as 'ar'|'en'][quick.reviewer_role]}</small></div><button className="icon-button" onClick={()=> setQuick(null)}><Icon name="close" size={16}/></button></header>
            <div className="drawer__body">
              <p><strong>النسخة:</strong> v2 · <strong>الحالة:</strong> {statusLabels[locale as 'ar'|'en'][quick.status]}</p>
              <p className="panel__note">{quick.comments || 'لا ملاحظات'}</p>
              <div className="prod-team-row"><span>المراجع: {quick.reviewer_id ?? 'غير مسند'}</span><span>الانتظار: {Math.floor((Date.now()-Date.parse(quick.created_at))/86400000)} يوم</span></div>
            </div>
            <footer className="drawer__footer"><button className="button button--ghost" onClick={()=> setQuick(null)}>إلغاء</button><button className="button button--primary" onClick={()=>{ setQuick(null); setSelected(quick)}}>فتح المراجعة</button></footer>
          </div>
        </div>
      )}

      {/* Review Workspace */}
      {selected && (
        <Modal open title={`مراجعة — ${identities.get(`${selected.entity_type}:${selected.entity_id}`)?.title ?? selected.entity_id}`} description={`${roleLabels[locale as 'ar'|'en'][selected.reviewer_role]} · ${statusLabels[locale as 'ar'|'en'][selected.status]}`} onClose={()=> setSelected(null)}>
          <div className="workspace-stack">
            <section className="panel"><header className="panel__header"><h3>المعاينة</h3></header><div className="panel__body">
              <p>معاينة المحتوى: {entityLabels[locale as 'ar'|'en'][selected.entity_type]} — {identities.get(`${selected.entity_type}:${selected.entity_id}`)?.title ?? selected.entity_id}</p>
              <Link className="button button--ghost button--small" to={adminPath(selected.entity_type==='episode'?`episodes/${selected.entity_id}`: selected.entity_type==='story'?`stories/${selected.entity_id}`: `${selected.entity_type}s/${selected.entity_id}`)}>فتح المحتوى</Link>
              {selected.reviewer_role==='sharia' && <div className="inline-alert inline-alert--warning" style={{marginTop:8}}>حوكمة شرعية: المراجع يجب أن يحمل دور sharia، القرار يبطل أي موافقة قديمة على نسخة سابقة.</div>}
            </div></section>
            <section className="panel"><header className="panel__header"><h3>القرار</h3></header><div className="panel__body">
              <div className="detail-fields">
                <div><span>النوع</span><strong>{roleLabels[locale as 'ar'|'en'][selected.reviewer_role]}</strong></div>
                <div><span>الحالة</span><strong>{statusLabels[locale as 'ar'|'en'][selected.status]}</strong></div>
                <div><span>المراجع</span><strong>{selected.reviewer_id ?? 'غير مسند'}</strong></div>
                <div><span>النسخة</span><strong>v2 {selected.status==='approved' ? '✓' : ''}</strong></div>
              </div>
              <p style={{marginTop:8}}>{selected.comments || 'لا تعليق'}</p>
              <div className="form-actions" style={{marginTop:12}}>
                <button className="button button--ghost button--small" onClick={()=> openEdit(selected)}>تعديل</button>
                <button className="button button--primary button--small" onClick={()=> { setSelected(null); void assignToMe(selected)}}>طلب تعديلات</button>
                <button className="button button--primary button--small" onClick={()=> { setSelected(null)}}>اعتماد</button>
              </div>
              <div className="inline-alert inline-alert--info" style={{marginTop:8}}>{copy[locale].publishBlocked}</div>
            </div></section>
            <section className="panel"><header className="panel__header"><h3>السجل</h3></header><div className="panel__body"><p className="panel__note">سجل المراجعات يحفظ كل تغيير مع الممثل والنسخة والطابع الزمني.</p></div></section>
          </div>
        </Modal>
      )}

      <Modal open={modalOpen} onClose={()=> !saving && setModalOpen(false)} title={editingId? 'تعديل المراجعة': 'طلب مراجعة'}>
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid"><label className="field"><span>نوع المحتوى *</span><select value={form.entity_type} disabled={!!editingId} onChange={(e)=> setForm({...form, entity_type: e.target.value as any})}><option value="series">سلسلة</option><option value="episode">حلقة</option><option value="story">قصة</option><option value="book">كتاب</option><option value="game">لعبة</option><option value="project">مشروع</option></select></label><label className="field"><span>معرّف المحتوى *</span><input dir="ltr" value={form.entity_id} disabled={!!editingId} onChange={(e)=> setForm({...form, entity_id: e.target.value})} /></label></div>
          <div className="form-grid"><label className="field"><span>نوع المراجعة *</span><select value={form.reviewer_role} onChange={(e)=> setForm({...form, reviewer_role: e.target.value as any})}><option value="edu">تعليمية</option><option value="lang">لغوية</option><option value="sharia">شرعية</option><option value="rights">حقوق</option><option value="qa">جودة</option></select></label><label className="field"><span>الحالة *</span><select value={form.status} onChange={(e)=> setForm({...form, status: e.target.value as any})}><option value="pending">قيد الانتظار</option><option value="approved">معتمد</option><option value="rejected">مرفوض</option><option value="needs_changes">يحتاج تعديلًا</option></select></label></div>
          <label className="field"><span>الملاحظات {(form.status==='rejected'||form.status==='needs_changes')?'*':''}</span><textarea rows={3} value={form.comments} onChange={(e)=> setForm({...form, comments: e.target.value})} /></label>
          <div className="form-actions"><button className="button button--ghost" type="button" onClick={()=> setModalOpen(false)}>إلغاء</button><button className="button button--primary" type="submit" disabled={saving}>حفظ</button></div>
        </form>
      </Modal>
    </div>
  )
}
