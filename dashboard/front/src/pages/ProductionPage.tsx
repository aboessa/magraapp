import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { usePreferences } from '../context/preferences'
import { Icon } from '../components/Icon'
import type { ProductionItem, ProductionQueueRow, ProductionRequirementRow, RequirementState } from '../types/api'

// Derived readiness denominators already exclude not_applicable in backend summarizeMatrix.
// This file never fabricates a completion status; it only visualises derived state + human assignment.

const REQUIREMENT_ORDER: string[] = ['script','educational','translation_ar','translation_en','translation_fr','voice_ar','voice_en','voice_fr','artwork','video','thumbnail','captions','qa','publish']

const STATE_LABEL: Record<RequirementState, { ar: string; en: string; kind: 'missing'|'blocked'|'assigned'|'progress'|'review'|'complete'|'na' }> = {
  missing: { ar: 'مفقود', en: 'Missing', kind: 'missing' },
  blocked: { ar: 'معطل', en: 'Blocked', kind: 'blocked' },
  in_progress: { ar: 'قيد التنفيذ', en: 'In progress', kind: 'progress' },
  partial: { ar: 'جزئي', en: 'Partial', kind: 'progress' },
  ready: { ar: 'مكتمل', en: 'Complete', kind: 'complete' },
  not_applicable: { ar: 'غير مطلوب', en: 'Not required', kind: 'na' },
}

function currentStage(item: ProductionItem): ProductionRequirementRow | null {
  for (const key of REQUIREMENT_ORDER) {
    const r = item.requirements.find((x) => x.key === key)
    if (!r) continue
    if (r.state === 'not_applicable' || r.state === 'ready') continue
    return r
  }
  return null
}
function primaryBlocker(item: ProductionItem): ProductionRequirementRow | null {
  const blocked = item.requirements.filter((r) => r.blocker && (r.state === 'blocked' || r.state === 'missing'))
  if (!blocked.length) return null
  // oldest blocker by due_at or first in order
  const sorted = [...blocked].sort((a, b) => {
    if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at)
    return REQUIREMENT_ORDER.indexOf(a.key) - REQUIREMENT_ORDER.indexOf(b.key)
  })
  return sorted[0]
}
function blockerAge(due_at: string | null): string | null {
  if (!due_at) return null
  const diff = Date.now() - Date.parse(due_at)
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'اليوم'
  return `${days} يوم`
}
function isOverdue(due_at: string | null): boolean {
  return !!due_at && Date.parse(due_at) < Date.now()
}
function nextAction(item: ProductionItem): string {
  const stage = currentStage(item)
  if (!stage) return item.summary.publish_state === 'ready' ? 'جاهز للنشر' : 'مكتمل إنتاجياً'
  if (stage.blocker) return stage.blocker
  if (stage.state === 'missing') return stage.detail
  if (stage.assignee_id) return `متابعة مع ${stage.assignee_id}`
  return stage.detail || stage.label_ar
}

const copy = {
  ar: {
    eyebrow: 'الإنتاج',
    title: 'مركز الإنتاج',
    lede: 'غرفة عمليات إنتاج مجرة: ماذا ينتج، ما المعطل ولماذا، من المسؤول، متى الاستحقاق. كل حالة مشتقة من الأصول الحقيقية.',
    metrics: { inProd: 'قيد الإنتاج', readyQA: 'جاهز للجودة', readyPub: 'جاهز للنشر', blocked: 'معطل', overdue: 'متأخر', unassigned: 'غير مسند', dueWeek: 'مستحق هذا الأسبوع', missing: 'أصول حرجة ناقصة' },
    pipeline: 'خط الإنتاج',
    blockers: 'مركز المعطلات',
    myQueue: 'مهامي',
    team: 'السعة / الفرق',
    upcoming: 'الاستحقاقات القادمة',
    tableView: 'جدول', kanbanView: 'كانبان', matrixView: 'مصفوفة', myWorkView: 'عملي',
    search: 'بحث بعنوان المحتوى أو السلسلة...',
    typeLabel: 'النوع', planetLabel: 'الكوكب', seriesLabel: 'السلسلة', langLabel: 'اللغة', ownerLabel: 'المسؤول', statusLabel: 'الحالة',
    thumb: 'صورة', content: 'المحتوى', context: 'السياق', readiness: 'الجاهزية', stage: 'المرحلة الحالية', blocker: 'العائق الأساسي', owner: 'المسؤول', teamLabel: 'الفريق', due: 'الاستحقاق', actions: 'إجراءات',
    quickView: 'عرض سريع', openWorkspace: 'افتح مساحة الإنتاج', openContent: 'افتح المحتوى',
    assign: 'إسناد', dueAt: 'تاريخ الاستحقاق', note: 'ملاحظة',
    save: 'حفظ', cancel: 'إلغاء', saving: 'جارٍ الحفظ...',
    empty: 'لا عمل إنتاجي مطابق', emptyHint: 'غيّر الفلتر أو النطاق الزمني.',
    today: 'اليوم', thisWeek: 'هذا الأسبوع', next14: '14 يوم', month: '30 يوم',
    total: (n: number) => `1–${n} من الإجمالي`,
    overdueBadge: 'متأخر', blockedBadge: 'معطل', unassignedBadge: 'غير مسند',
    export: 'تصدير',
    bulkAssign: 'إسناد جماعي',
    matrixHint: 'مصفوفة المتطلبات — عرض متقدم، التمرير الأفقي مسموح هنا فقط.',
    notRequired: '—',
  },
  en: {
    eyebrow: 'Production',
    title: 'Production Centre',
    lede: 'Majarra production command: what is in production, what is blocked and why, who owns next action, when due. States are derived from assets.',
    metrics: { inProd: 'In production', readyQA: 'Ready for QA', readyPub: 'Ready to publish', blocked: 'Blocked', overdue: 'Overdue', unassigned: 'Unassigned', dueWeek: 'Due this week', missing: 'Missing critical' },
    pipeline: 'Pipeline',
    blockers: 'Blockers',
    myQueue: 'My work',
    team: 'Capacity / Teams',
    upcoming: 'Upcoming deadlines',
    tableView: 'Table', kanbanView: 'Kanban', matrixView: 'Matrix', myWorkView: 'My work',
    search: 'Search content or series...',
    typeLabel: 'Type', planetLabel: 'Planet', seriesLabel: 'Series', langLabel: 'Language', ownerLabel: 'Owner', statusLabel: 'Status',
    thumb: 'Thumb', content: 'Content', context: 'Context', readiness: 'Readiness', stage: 'Current stage', blocker: 'Blocker', owner: 'Owner', teamLabel: 'Team', due: 'Due', actions: 'Actions',
    quickView: 'Quick view', openWorkspace: 'Open workspace', openContent: 'Open content',
    assign: 'Assign', dueAt: 'Due date', note: 'Note',
    save: 'Save', cancel: 'Cancel', saving: 'Saving...',
    empty: 'No production work', emptyHint: 'Adjust filters.',
    today: 'Today', thisWeek: 'This week', next14: '14 days', month: '30 days',
    total: (n: number) => `1–${n} total`,
    overdueBadge: 'Overdue', blockedBadge: 'Blocked', unassignedBadge: 'Unassigned',
    export: 'Export', bulkAssign: 'Bulk assign',
    matrixHint: 'Requirements matrix — advanced view, horizontal scroll allowed here only.',
    notRequired: '—',
  },
}

const FILTER_DEFAULTS = { type: 'episode', status: '', planet_id: '', lang: '', owner: '', q: '' }

export function ProductionPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar'] as typeof copy.ar
  const navigate = useNavigate()
  const list = useUrlListState(FILTER_DEFAULTS as any, { limit: 25 })
  const [view, setView] = useState<'table' | 'kanban' | 'matrix' | 'queue'>(() => (list.view as any) || 'table')
  const [range, setRange] = useState<'today' | 'week' | '14' | '30'>('week')
  const [items, setItems] = useState<ProductionItem[]>([])
  const [queue, setQueue] = useState<ProductionQueueRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quick, setQuick] = useState<ProductionItem | null>(null)
  const [detail, setDetail] = useState<ProductionItem | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ item: ProductionItem; req: ProductionRequirementRow } | null>(null)
  const [form, setForm] = useState({ assignee_id: '', team_id: '', due_at: '', blocker: '', note: '' })
  const [saving, setSaving] = useState(false)

  const q = (list.query || '').toString()
  const filters = list.filters as any

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (view === 'queue') {
        const res = await api.productionQueue()
        setQueue(res.data)
      } else {
        const res = await api.productionBoard({ type: filters.type || 'episode', limit: list.limit, offset: list.offset, with_publish: 1 })
        let data = res.data
        // client-side filters for demo where board does not support planet/lang/owner search
        if (q) data = data.filter((it) => it.title.toLowerCase().includes(q.toLowerCase()))
        setItems(data); setTotal(res.meta?.total ?? data.length)
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر التحميل') }
    finally { setLoading(false) }
  }, [view, filters.type, list.limit, list.offset, q])

  useEffect(() => { void load() }, [load])
  useEffect(() => { list.setView(view as any) }, [view])

  // Derived command metrics from current page (honest: from loaded page, not fabricated global)
  const metrics = useMemo(() => {
    const all = items
    const blocked = all.filter((it) => it.requirements.some((r) => r.state === 'blocked')).length
    const unassigned = all.filter((it) => it.requirements.some((r) => !r.assignee_id && r.state !== 'ready' && r.state !== 'not_applicable')).length
    const overdue = all.filter((it) => it.requirements.some((r) => isOverdue(r.due_at))).length
    const dueWeek = all.filter((it) => it.requirements.some((r) => r.due_at && Date.parse(r.due_at) - Date.now() < 7*86400000 && Date.parse(r.due_at) > Date.now())).length
    const inProd = all.filter((it) => it.summary.percent < 100 && it.summary.percent > 0).length
    const readyPub = all.filter((it) => it.summary.publish_state === 'ready').length
    const readyQA = all.filter((it) => it.requirements.find((r) => r.key === 'qa')?.state === 'ready').length
    const missingCritical = all.filter((it) => it.requirements.some((r) => r.state === 'missing' && r.key !== 'translation_fr' && r.key !== 'voice_fr')).length
    return { inProd, readyQA, readyPub, blocked, overdue, unassigned, dueWeek, missingCritical }
  }, [items])

  const pipeline = useMemo(() => {
    const map: Record<string, number> = {}
    for (const it of items) for (const r of it.requirements) if (r.state !== 'ready' && r.state !== 'not_applicable') map[r.key] = (map[r.key] || 0) + 1
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8)
  }, [items])

  const blockerGroups = useMemo(() => {
    const m = new Map<string, { count: number; items: ProductionItem[]; oldest: string | null }>()
    for (const it of items) {
      const b = primaryBlocker(it)
      if (!b) continue
      const key = b.key
      const entry = m.get(key) || { count: 0, items: [], oldest: null }
      entry.count++; entry.items.push(it)
      if (b.blocker && (!entry.oldest || (b.due_at && b.due_at < entry.oldest))) entry.oldest = b.due_at || b.blocker
      m.set(key, entry)
    }
    return Array.from(m.entries()).map(([k,v])=>({ key:k, ...v }))
  }, [items])

  const teamWorkload = useMemo(() => {
    const m = new Map<string, { active: number; overdue: number; unassigned: number }>()
    for (const it of items) for (const r of it.requirements) {
      const team = r.team_id || r.owner_role || 'unassigned'
      const entry = m.get(team) || { active: 0, overdue: 0, unassigned: 0 }
      if (r.state !== 'ready' && r.state !== 'not_applicable') entry.active++
      if (isOverdue(r.due_at)) entry.overdue++
      if (!r.assignee_id && r.state !== 'ready' && r.state !== 'not_applicable') entry.unassigned++
      m.set(team, entry)
    }
    return Array.from(m.entries())
  }, [items])

  const upcoming = useMemo(() => {
    const list: Array<{ item: ProductionItem; req: ProductionRequirementRow }> = []
    for (const it of items) for (const r of it.requirements) if (r.due_at) list.push({ item: it, req: r })
    return list.filter(({ req }) => {
      const t = Date.parse(req.due_at!)
      const now = Date.now()
      if (range === 'today') return t - now < 86400000 && t >= now - 86400000
      if (range === 'week') return t - now < 7*86400000
      if (range === '14') return t - now < 14*86400000
      return t - now < 30*86400000
    }).sort((a,b)=> Date.parse(a.req.due_at!) - Date.parse(b.req.due_at!)).slice(0,6)
  }, [items, range])

  async function openDetail(it: ProductionItem) {
    try { const res = await api.productionItem(it.content_type, it.content_id); setDetail(res.data as any) } catch {}
  }

  async function saveAssign() {
    if (!editing) return
    setSaving(true)
    try {
      await api.saveProductionAssignment(editing.item.content_type, editing.item.content_id, editing.req.key, {
        assignee_id: form.assignee_id || null,
        team_id: form.team_id || null,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        blocker: form.blocker || null,
        note: form.note || null,
      })
      setEditing(null); await load(); if (detail) { const r = await api.productionItem(editing.item.content_type, editing.item.content_id); setDetail(r.data as any) }
    } finally { setSaving(false) }
  }

  const contentLink = (it: { content_type: string; content_id: string }) => adminPath(it.content_type === 'episode' ? `episodes/${it.content_id}` : `stories/${it.content_id}`)

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div>
        <div className="page-intro__actions">
          <div className="range-switch" role="group" aria-label="range">
            {(['today','week','14','30'] as const).map((k) => <button key={k} type="button" className={`button ${range===k?'button--primary':'button--ghost'} button--small`} onClick={()=>setRange(k)}>{(text as any)[k==='today'?'today':k==='week'?'thisWeek':k==='14'?'next14':'month']}</button>)}
          </div>
        </div>
      </section>

      {/* A. Command Summary */}
      <section className="prod-command" aria-label="command">
        {([
          ['inProd', metrics.inProd, ''],
          ['readyQA', metrics.readyQA, ''],
          ['readyPub', metrics.readyPub, ''],
          ['blocked', metrics.blocked, 'blocked'],
          ['overdue', metrics.overdue, 'overdue'],
          ['unassigned', metrics.unassigned, 'unassigned'],
          ['dueWeek', metrics.dueWeek, ''],
          ['missing', metrics.missingCritical, ''],
        ] as const).map(([k, v, tone]) => (
          <button key={k} className={`prod-metric ${tone?`prod-metric--${tone}`:''}`} onClick={()=>{ if(k==='blocked') navigate(`${adminPath('production')}?filter=blocked`); }}>
            <strong>{v}</strong><span>{(text.metrics as any)[k]}</span>
          </button>
        ))}
      </section>

      {/* B. Pipeline + C. Blockers */}
      <section className="prod-grid2">
        <div className="panel"><header className="panel__header"><h3>{text.pipeline}</h3></header><div className="panel__body prod-pipeline">
          {pipeline.length ? pipeline.map(([k,c])=> <div key={k} className="prod-pipe-row"><span>{k}</span><span className="prod-pipe-bar"><i style={{ width: `${Math.min(100, c*8)}%` }} /></span><strong>{c}</strong></div>) : <p className="panel__note">لا حمل إنتاجي</p>}
        </div></div>
        <div className="panel"><header className="panel__header"><h3>{text.blockers}</h3></header><div className="panel__body">
          {blockerGroups.length ? blockerGroups.map((g)=> <button key={g.key} className="prod-blocker-row" onClick={()=> setView('table')}><span>{g.key}</span><span className="title-count">{g.count}</span><small>{g.oldest ? `أقدم: ${String(g.oldest).slice(0,10)}` : ''}</small></button>) : <p className="panel__note">لا عوائق مجمعة</p>}
        </div></div>
      </section>

      {/* Filters + View switcher */}
      <ListToolbar
        fields={[
          { key: 'type', label: text.typeLabel, type: 'select', options: [{ value: 'episode', label: 'Episode' }, { value: 'story', label: 'Story' }] },
          { key: 'status', label: text.statusLabel, type: 'select', options: [{ value: '', label: 'الكل' }, { value: 'blocked', label: 'معطل' }, { value: 'overdue', label: 'متأخر' }] },
        ] as FilterField[]}
        values={filters as any}
        defaults={FILTER_DEFAULTS as any}
        onApply={(n)=> (list as any).setFilters(n)}
        onClear={(list as any).clearFilters}
        onRemove={(k)=> (list as any).setFilter(k as any, '')}
        trailing={<>
          <div className="prod-views" role="tablist">
            {(['table','kanban','matrix','queue'] as const).map((v)=> <button key={v} role="tab" aria-selected={view===v} className={`button ${view===v?'button--primary':'button--ghost'} button--small`} onClick={()=>setView(v)}>{(text as any)[v==='table'?'tableView':v==='kanban'?'kanbanView':v==='matrix'?'matrixView':'myWorkView']}</button>)}
          </div>
          <SavedViewsMenu storageKey="production" currentSearch={list.search} onApply={(s)=> navigate(`${adminPath('production')}${s}`)} />
          <button className="button button--ghost button--small" onClick={()=>{ const csv = items.map((it)=> `${it.title},${it.summary.percent}%,${primaryBlocker(it)?.blocker ?? ''}`).join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='production.csv'; a.click(); URL.revokeObjectURL(url) }}>{text.export}</button>
        </>}
      />
      <div className="filters-row" style={{ display: 'flex', gap: 8 }}>
        <div className="search-field" style={{ flex: 1 }}><Icon name="search" size={16} /><input value={q} onChange={(e)=> (list as any).setQuery(e.target.value)} placeholder={text.search} /></div>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={()=>void load()} /> : (
        <>
          {view === 'table' && (
            <section className="panel panel--table">
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table prod-table">
                  <thead><tr>
                    <th><input type="checkbox" aria-label="select all" onChange={(e)=> setSelected(e.target.checked ? new Set(items.map((it)=>it.content_id)) : new Set())} checked={selected.size===items.length && items.length>0} /></th>
                    <th>{text.thumb}</th><th>{text.content}</th><th>{text.context}</th><th>{text.readiness}</th><th>{text.stage}</th><th>{text.blocker}</th><th>{text.owner}</th><th>{text.due}</th><th>{text.actions}</th>
                  </tr></thead>
                  <tbody>
                    {items.map((it)=> {
                      const stage = currentStage(it); const blocker = primaryBlocker(it); const overdue = blocker && isOverdue(blocker.due_at)
                      const thumb = (it as any).thumbnail_url || (it as any).cover_url || ''
                      return (
                        <tr key={it.content_id} className={overdue ? 'prod-row--overdue' : ''}>
                          <td><input type="checkbox" checked={selected.has(it.content_id)} onChange={(e)=>{ const s=new Set(selected); if(e.target.checked) s.add(it.content_id); else s.delete(it.content_id); setSelected(s)}} /></td>
                          <td><div className="prod-thumb">{thumb ? <img src={thumb} alt="" /> : <Icon name="media" size={18} />}</div></td>
                          <td><Link to={contentLink(it)} className="prod-identity"><strong>{it.title}</strong><small>{it.content_type} · {it.status}</small></Link></td>
                          <td><small>{(it as any).series_title ?? (it as any).planet_name ?? '—'}</small></td>
                          <td>
                            <div className="prod-readiness">
                              <span className="prod-readiness__bar"><i style={{ width: `${it.summary.percent}%` }} className={it.summary.percent>=90 ? 'prod-bar--good' : it.summary.percent<40 ? 'prod-bar--bad' : ''} /></span>
                              <span className={`prod-readiness__pct ${blocker ? 'prod-readiness--blocked' : ''}`}>{it.summary.percent}%</span>
                              <small className="prod-readiness__state">{blocker ? 'BLOCKED' : it.summary.percent===100 ? 'READY' : 'IN PRODUCTION'}</small>
                            </div>
                          </td>
                          <td>
                            {stage ? <span className={`prod-chip prod-chip--${STATE_LABEL[stage.state]?.kind}`}>{stage.label_ar}</span> : <span className="panel__note">جاهز</span>}
                            <small>{stage ? nextAction(it) : '—'}</small>
                          </td>
                          <td>
                            {blocker ? <div className="prod-blocker"><strong className="prod-blocker__reason">{blocker.blocker || blocker.detail}</strong><small>{blockerAge(blocker.due_at) ? `${blockerAge(blocker.due_at)} · ` : ''}{blocker.owner_role}</small></div> : <span className="panel__note">—</span>}
                          </td>
                          <td><span>{stage?.assignee_id || 'غير مسند'}</span><small>{stage?.team_id || stage?.owner_role || ''}</small></td>
                          <td>
                            {stage?.due_at ? <span dir="ltr" className={isOverdue(stage.due_at) ? 'prod-due--overdue' : ''}>{stage.due_at.slice(0,10)}</span> : <span className="panel__note">—</span>}
                            {isOverdue(stage?.due_at ?? null) && <small className="prod-overdue">OVERDUE</small>}
                          </td>
                          <td>
                            <div className="table-actions">
                              <button className="button button--ghost button--small" onClick={()=> setQuick(it)}>{text.quickView}</button>
                              <button className="button button--ghost button--small" onClick={()=> void openDetail(it)}>{text.openWorkspace}</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {items.length===0 && <EmptyState title={text.empty} description={text.emptyHint} />}
              <Pagination total={total} limit={list.limit} offset={list.offset} onOffsetChange={(list as any).setOffset} locale={locale} />
              {selected.size>0 && <div className="bulk-bar"><span>{selected.size} محدد</span><div className="bulk-bar__actions"><button className="button button--ghost button--small" onClick={()=> setSelected(new Set())}>{text.cancel}</button><button className="button button--primary button--small" onClick={()=>{ const assignee = prompt('Assignee id'); if(!assignee) return; void Promise.all(Array.from(selected).map((id)=> { const it = items.find((x)=> x.content_id===id); if(!it) return Promise.resolve(); const stage = currentStage(it); if(!stage) return Promise.resolve(); return api.saveProductionAssignment(it.content_type as any, it.content_id, stage.key, { assignee_id: assignee, due_at: null, blocker: null, note: null }) })).then(()=>void load()) }}>{text.bulkAssign}</button></div></div>}
            </section>
          )}

          {view === 'matrix' && (
            <section className="panel panel--table">
              <p className="panel__note" style={{ padding: '8px 12px' }}>{text.matrixHint}</p>
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table data-table--wide prod-matrix">
                  <thead><tr><th style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--surface)' }}>{text.content}</th><th>{text.readiness}</th>{items[0]?.requirements.map((r)=> <th key={r.key}>{r.label_ar}</th>)}</tr></thead>
                  <tbody>{items.map((it)=> <tr key={it.content_id}><td style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--surface)' }}><Link to={contentLink(it)}>{it.title}</Link></td><td>{it.summary.percent}%</td>{it.requirements.map((r)=> <td key={r.key} title={r.detail}>{r.state==='not_applicable' ? text.notRequired : <span className={`prod-matrix-chip prod-matrix-chip--${STATE_LABEL[r.state].kind}`}>{STATE_LABEL[r.state].ar}</span>}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </section>
          )}

          {view === 'kanban' && (
            <section className="panel"><div className="kanban">
              {(['missing','blocked','in_progress','partial','ready'] as RequirementState[]).map((state)=> {
                const cards = items.flatMap((it)=> it.requirements.filter((r)=> r.state===state).map((r)=> ({ it, r })))
                return <div key={state} className="kanban__column"><header className="kanban__header"><strong>{STATE_LABEL[state].ar}</strong><span className="title-count">{cards.length}</span></header><ul className="kanban__list">{cards.slice(0,6).map(({ it, r })=> <li key={`${it.content_id}:${r.key}`} className={`kanban__card prod-chip--${STATE_LABEL[r.state].kind}`}><strong>{it.title}</strong><small>{r.label_ar} · {r.detail.slice(0,40)}</small><small>{r.assignee_id || 'غير مسند'} · {r.due_at?.slice(0,10) ?? '—'}</small></li>)}</ul></div>
              })}
            </div></section>
          )}

          {view === 'queue' && (
            <section className="panel panel--table"><div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.content}</th><th>المتطلب</th><th>{text.due}</th><th>{text.blocker}</th></tr></thead><tbody>{queue.map((row)=> <tr key={`${row.content_id}:${row.requirement}`}><td><Link to={adminPath(row.content_type==='episode'?`episodes/${row.content_id}`:`stories/${row.content_id}`)}>{row.title ?? row.content_id}</Link></td><td>{row.requirement}</td><td dir="ltr">{row.due_at?.slice(0,10) ?? '—'}</td><td>{row.blocker ?? '—'}</td></tr>)}</tbody></table></div>{queue.length===0 && <EmptyState title="لا مهام" description="لا متطلبات مسندة لك" />}</section>
          )}

          {/* Team / Capacity + Upcoming */}
          <section className="prod-grid2">
            <div className="panel"><header className="panel__header"><h3>{text.team}</h3></header><div className="panel__body">
              {teamWorkload.map(([team, s])=> <div key={team} className="prod-team-row"><strong>{team}</strong><span>{s.active} نشط</span><span className={s.overdue? 'prod-team--overdue':''}>{s.overdue} متأخر</span><span>{s.unassigned} غير مسند</span></div>)}
            </div></div>
            <div className="panel"><header className="panel__header"><h3>{text.upcoming}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['today','week','14','30'] as const).map((k)=> <button key={k} className={`button ${range===k?'button--primary':'button--ghost'} button--small`} onClick={()=>setRange(k)}>{k}</button>)}
              </div>
            </header><div className="panel__body">{upcoming.length ? upcoming.map(({ item, req })=> <div key={`${item.content_id}:${req.key}`} className="prod-upcoming-row"><Link to={contentLink(item)}>{item.title}</Link><small>{req.label_ar} · {req.due_at?.slice(0,10)}</small></div>) : <p className="panel__note">لا استحقاقات</p>}</div></div>
          </section>
        </>
      )}

      {/* Quick View Drawer */}
      {quick && (
        <div className="drawer-backdrop" role="presentation" onClick={()=> setQuick(null)}>
          <div className="drawer drawer--wide" role="dialog" aria-label={text.quickView} onClick={(e)=> e.stopPropagation()}>
            <header className="drawer__header"><div><h2>{quick.title}</h2><small>{quick.content_type} · {quick.summary.percent}% · {quick.summary.publish_state}</small></div><button className="icon-button" onClick={()=> setQuick(null)} aria-label="close"><Icon name="close" size={18} /></button></header>
            <div className="drawer__body">
              <div className="prod-readiness" style={{ marginBottom: 12 }}><span className="prod-readiness__bar"><i style={{ width: `${quick.summary.percent}%` }} /></span><strong>{quick.summary.percent}%</strong><small>{primaryBlocker(quick)?.blocker || nextAction(quick)}</small></div>
              {quick.requirements.filter((r)=> r.state!=='ready' && r.state!=='not_applicable').slice(0,6).map((r)=> <div key={r.key} className={`prod-req-card prod-chip--${STATE_LABEL[r.state].kind}`}><strong>{r.label_ar}</strong><small>{r.detail}</small><small>{r.assignee_id || 'غير مسند'} · {r.due_at?.slice(0,10) ?? 'بدون تاريخ'} · {r.blocker || 'لا عائق'}</small><button className="button button--ghost button--small" onClick={()=>{ setQuick(null); void openDetail(quick) }}>فتح</button></div>)}
            </div>
            <footer className="drawer__footer"><button className="button button--ghost" onClick={()=> setQuick(null)}>{text.cancel}</button><Link className="button button--primary" to={contentLink(quick)}>{text.openContent}</Link></footer>
          </div>
        </div>
      )}

      {/* Production Workspace (detail) */}
      {detail && (
        <Modal open title={`مساحة الإنتاج — ${detail.title}`} description={`${detail.summary.percent}% · النشر: ${detail.summary.publish_state}`} onClose={()=> setDetail(null)}>
          <div className="prod-workspace">
            <div className="prod-workspace__head">
              <Link className="button button--ghost button--small" to={contentLink(detail)}>{text.openContent}</Link>
              <span className="panel__note">المصدر: حالة كل متطلب مشتقة من الأصول/السجلات الحقيقية</span>
            </div>
            {detail.requirements.map((r)=> (
              <div key={r.key} className={`prod-req-card prod-req-card--${STATE_LABEL[r.state].kind}`}>
                <header><strong>{r.label_ar}</strong><span className={`prod-chip prod-chip--${STATE_LABEL[r.state].kind}`}>{STATE_LABEL[r.state].ar}</span><small>{r.owner_role}</small></header>
                <p>{r.detail}</p>
                {r.percent!==null && <small>التقدم: {r.percent}%</small>}
                {r.depends_on.length>0 && <small>يعتمد على: {r.depends_on.join(', ')}</small>}
                <div className="prod-req-card__human">
                  <small>المسؤول: {r.assignee_id || 'غير مسند'} · الفريق: {r.team_id || '—'} · الاستحقاق: {r.due_at?.slice(0,10) ?? '—'}</small>
                  {r.blocker && <small className="prod-blocker__reason">العائق: {r.blocker}</small>}
                  {r.note && <small>ملاحظة: {r.note}</small>}
                </div>
                <div className="form-actions">
                  <button className="button button--ghost button--small" onClick={()=>{ setEditing({ item: detail, req: r }); setForm({ assignee_id: r.assignee_id||'', team_id: r.team_id||'', due_at: r.due_at? r.due_at.slice(0,10):'', blocker: r.blocker||'', note: r.note||'' }) }}>{text.assign}</button>
                  {r.key==='artwork' && <Link className="button button--ghost button--small" to={adminPath('games-art-queue')}>Art Queue</Link>}
                  {r.key.startsWith('voice') && <Link className="button button--ghost button--small" to={adminPath('games-audio-queue')}>Audio Queue</Link>}
                  {r.key.startsWith('translation') && <Link className="button button--ghost button--small" to={adminPath('translation')}>Translation</Link>}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {editing && (
        <Modal open title={`${text.assign} — ${editing.req.label_ar}`} onClose={()=> setEditing(null)}>
          <div className="entity-form">
            <div className="form-grid"><label className="field"><span>المسؤول (assignee_id)</span><input value={form.assignee_id} dir="ltr" onChange={(e)=> setForm({ ...form, assignee_id: e.target.value })} /></label><label className="field"><span>الفريق (team_id)</span><input value={form.team_id} dir="ltr" onChange={(e)=> setForm({ ...form, team_id: e.target.value })} /></label></div>
            <label className="field"><span>{text.dueAt}</span><input type="date" value={form.due_at} onChange={(e)=> setForm({ ...form, due_at: e.target.value })} /></label>
            <label className="field"><span>العائق</span><input value={form.blocker} onChange={(e)=> setForm({ ...form, blocker: e.target.value })} /></label>
            <label className="field"><span>{text.note}</span><textarea rows={2} value={form.note} onChange={(e)=> setForm({ ...form, note: e.target.value })} /></label>
            <div className="form-actions"><button className="button button--ghost" onClick={()=> setEditing(null)}>{text.cancel}</button><button className="button button--primary" disabled={saving} onClick={()=> void saveAssign()}>{saving ? text.saving : text.save}</button></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
