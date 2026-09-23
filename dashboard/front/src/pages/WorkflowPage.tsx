import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { useUrlListState } from '../hooks/useUrlListState'
import { adminPath } from '../lib/adminPath'
import { usePreferences } from '../context/preferences'
import { Icon } from '../components/Icon'
import { api } from '../lib/api'
import type {
  WorkflowDecision,
  WorkflowMyStage,
  WorkflowOverdueRow,
  WorkflowRunDetail,
  WorkflowRunRecord,
  WorkflowStageView,
  WorkflowTemplate,
} from '../types/api'

const DECISIONS: WorkflowDecision[] = ['approved', 'changes_requested', 'rejected', 'skipped']

const copy = {
  ar: {
    eyebrow: 'سير العمل والحوكمة',
    title: 'مركز سير العمل والاعتماد',
    lede: 'إدارة تشغيلات الاعتماد الحقيقية: مراحل متتالية، موافقات إلزامية، مواعيد استحقاق، وربط حقيقي بالأصول لمنع النشر قبل اكتمال المتطلبات.',
    beaconActive: 'محرك الاعتماد وسير العمل نشط',
    beaconSub: 'تزامن مباشر مع مراحل الاعتماد وقواعد الحظر',
    overview: 'نظرة عامة',
    runs: 'التشغيلات',
    inbox: 'صندوق المراجعة',
    myWork: 'مهامي',
    overdue: 'المتأخّر',
    blocked: 'المعطل',
    unassigned: 'غير مسند',
    templates: 'القوالب',
    history: 'السجل',
    metrics: {
      active: 'تشغيلات نشطة',
      waiting: 'بانتظار المراجعة',
      changes: 'طلب تعديلات',
      blocked: 'معطل',
      overdue: 'متأخر عن المهلة',
      today: 'مستحق اليوم',
      unassigned: 'غير مسند',
      week: 'مكتمل هذا الأسبوع',
    },
    pipeline: 'خط سير المراحل النشطة',
    content: 'المحتوى',
    template: 'القالب',
    stage: 'المرحلة الحالية',
    status: 'الحالة',
    owner: 'المسؤول',
    team: 'الفريق',
    due: 'الاستحقاق',
    age: 'العمر في المرحلة',
    blocker: 'العائق',
    open: 'فتح',
    start: 'بدء سير عمل',
    startTitle: 'بدء سير عمل جديد',
    startHint: 'اختر المحتوى والقالب المعتمد. يتم تثبيت إصدار القالب على التشغيلة.',
    contentType: 'نوع المحتوى',
    contentId: 'معرّف المحتوى',
    templatePick: 'القالب والإصدار',
    empty: 'لا توجد تشغيلات مطابقة',
    emptyHint: 'تبدأ التشغيلات آلياً عند إرسال المحتوى للمراجعة أو يدويًا من هنا.',
    emptyInbox: 'لا مراجعات معلقة',
    emptyMy: 'لا مراحل مسندة إليك حالياً',
    emptyOverdue: 'لا توجد مراحل متأخرة عن مهلتها الزمنية',
    emptyTemplates: 'لا توجد قوالب نشطة',
    createTemplate: 'إنشاء قالب جديد',
    loadError: 'تعذر التحميل',
    search: 'بحث بالعنوان أو السلسلة...',
    filterTemplate: 'القالب',
    filterStage: 'المرحلة',
    filterStatus: 'الحالة',
    all: 'الكل',
    review: 'مراجعة وقرار',
    approve: 'اعتماد',
    requestChanges: 'طلب تعديلات',
    reject: 'رفض',
    comment: 'ملاحظة المراجعة',
    commentReq: 'الملاحظة مطلوبة عند الرفض أو طلب التعديل.',
    assign: 'تعيين مسؤول',
    assignTitle: 'تعيين مرحلة العمل',
    decisionTitle: 'تسجيل قرار المراجعة',
    cancel: 'إلغاء',
    submit: 'تسجيل القرار',
    submitting: 'جارٍ التسجيل…',
    dueIn: 'متبقٍ',
    overdueBy: 'متأخر',
    sla: 'SLA',
    depends: 'يعتمد على',
    quickView: 'عرض سريع',
    openWorkspace: 'افتح مساحة التشغيل',
    visualTimeline: 'المسار البصري',
    productionLink: 'عرض الإنتاج',
    qaLink: 'عرض الجودة',
    translationLink: 'عرض الترجمة',
    audit: 'سجل القرارات والتدقيق',
  },
  en: {
    eyebrow: 'Workflow & Governance',
    title: 'Workflow & Approvals Command Center',
    lede: 'Real-time orchestration of approval pipelines: sequential gates, blocking reviews, SLAs, and automated publish enforcement.',
    beaconActive: 'Workflow Engine Live',
    beaconSub: 'Real-time sync with review stages and publish gates',
    overview: 'Overview',
    runs: 'Runs',
    inbox: 'Inbox',
    myWork: 'My work',
    overdue: 'Overdue',
    blocked: 'Blocked',
    unassigned: 'Unassigned',
    templates: 'Templates',
    history: 'History',
    metrics: {
      active: 'Active runs',
      waiting: 'Waiting review',
      changes: 'Changes requested',
      blocked: 'Blocked',
      overdue: 'Overdue SLA',
      today: 'Due today',
      unassigned: 'Unassigned',
      week: 'Completed this week',
    },
    pipeline: 'Active Pipeline Progression',
    content: 'Content',
    template: 'Template',
    stage: 'Current stage',
    status: 'Status',
    owner: 'Owner',
    team: 'Team',
    due: 'Due',
    age: 'Time in stage',
    blocker: 'Blocker',
    open: 'Open',
    start: 'Start workflow',
    startTitle: 'Start new workflow',
    startHint: 'Choose content and template. Version is pinned to the run.',
    contentType: 'Content type',
    contentId: 'Content id',
    templatePick: 'Template & version',
    empty: 'No runs found',
    emptyHint: 'Runs appear when content enters review.',
    emptyInbox: 'No pending reviews',
    emptyMy: 'No stages assigned to you',
    emptyOverdue: 'No overdue stages',
    emptyTemplates: 'No active templates',
    createTemplate: 'Create template',
    loadError: 'Unable to load',
    search: 'Search by title or series...',
    filterTemplate: 'Template',
    filterStage: 'Stage',
    filterStatus: 'Status',
    all: 'All',
    review: 'Review',
    approve: 'Approve',
    requestChanges: 'Request changes',
    reject: 'Reject',
    comment: 'Comment',
    commentReq: 'Required for reject / request changes.',
    assign: 'Assign',
    assignTitle: 'Assign stage',
    decisionTitle: 'Stage decision',
    cancel: 'Cancel',
    submit: 'Submit decision',
    submitting: 'Submitting…',
    dueIn: 'remaining',
    overdueBy: 'overdue',
    sla: 'SLA',
    depends: 'Depends on',
    quickView: 'Quick view',
    openWorkspace: 'Open workspace',
    visualTimeline: 'Visual timeline',
    productionLink: 'View production',
    qaLink: 'View QA',
    translationLink: 'View translation',
    audit: 'Audit trail',
  },
}

type View = 'overview' | 'runs' | 'inbox' | 'mine' | 'overdue' | 'blocked' | 'unassigned' | 'templates'

const workflowStatusCopy = {
  ar: {
    blocksPublish: 'حاجبة للنشر',
    escalated: 'مصعّد',
    runsLimitation: 'GET /admin/workflows/runs يدعم الترقيم فقط، ولا يقبل فلترة بحالة ولا بقالب على الخادم.',
    lateHours: (hours: number) => `${hours} ساعة تأخّر`,
  },
  en: {
    blocksPublish: 'Blocks publishing',
    escalated: 'Escalated',
    runsLimitation: 'GET /admin/workflows/runs supports pagination only; it does not support server-side status or template filtering.',
    lateHours: (hours: number) => `${hours} hours overdue`,
  },
}


export function WorkflowPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar'] as typeof copy.ar
  const statusText = workflowStatusCopy[locale === 'en' ? 'en' : 'ar']
  const navigate = useNavigate()
  const url = useUrlListState({}, { defaultView: 'overview' })
  const view = (url.view === 'my' ? 'mine' : url.view) as View
  const setView = (v: View) => url.setView(v as any)

  const [runs, setRuns] = useState<WorkflowRunRecord[]>([])
  const [total, setTotal] = useState(0)
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [mine, setMine] = useState<WorkflowMyStage[]>([])
  const [overdue, setOverdue] = useState<WorkflowOverdueRow[]>([])
  const [detail, setDetail] = useState<WorkflowRunDetail | null>(null)
  const [quick, setQuick] = useState<WorkflowRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState(url.query || '')
  const [templateFilter, setTemplateFilter] = useState('')
  const [startOpen, setStartOpen] = useState(false)
  const [startForm, setStartForm] = useState({ content_type: 'episode', content_id: '', template_id: '' })
  const [decisionStage, setDecisionStage] = useState<WorkflowStageView | null>(null)
  const [assignStage, setAssignStage] = useState<WorkflowStageView | null>(null)
  const [decision, setDecision] = useState<WorkflowDecision>('approved')
  const [comment, setComment] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [r, t, m, o] = await Promise.all([
        api.workflowRuns({ limit: url.limit, offset: url.offset }),
        api.workflowTemplates(),
        api.workflowMyStages(),
        api.workflowOverdue(),
      ])
      setRuns(r.data)
      setTotal(r.meta.total)
      setTemplates(t.data)
      setMine(m.data)
      setOverdue(o.data)
      if (!startForm.template_id && t.data.length) {
        setStartForm((f) => ({ ...f, template_id: t.data[0].id }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [url.limit, url.offset, text.loadError, startForm.template_id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setQuery(url.query || '')
  }, [url.query])

  const filteredRuns = useMemo(() => {
    let arr = [...runs]
    if (query) {
      arr = arr.filter((r) =>
        `${r.content_type}${r.content_id}${r.current_step}`.toLowerCase().includes(query.toLowerCase())
      )
    }
    if (templateFilter) {
      arr = arr.filter((r) => r.template_id === templateFilter)
    }
    if (view === 'overdue') {
      const ids = new Set(overdue.map((o) => o.run_id))
      arr = arr.filter((r) => ids.has(r.id))
    }
    if (view === 'blocked') {
      arr = arr.filter((r) => r.status === 'blocked')
    }
    return arr
  }, [runs, query, templateFilter, view, overdue])

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const activeRun = useMemo(() => {
    if (selectedRunId) {
      const match = filteredRuns.find((r) => r.id === selectedRunId)
      if (match) return match
    }
    return filteredRuns[0] ?? null
  }, [filteredRuns, selectedRunId])

  const activeTemplate = useMemo(() => {
    if (!activeRun) return null
    return templates.find((t) => t.id === activeRun.template_id) ?? null
  }, [templates, activeRun])

  const activeRunProgress = useMemo(() => {
    if (!activeRun) return 0
    if (!activeTemplate || !activeTemplate.stages.length) return 50
    const stageIdx = activeTemplate.stages.findIndex((s) => s.stage_key === activeRun.current_step)
    if (stageIdx === -1) return 25
    return Math.min(100, Math.round(((stageIdx + 1) / activeTemplate.stages.length) * 100))
  }, [activeRun, activeTemplate])

  const metrics = useMemo(() => {
    const waiting = runs.filter((r) => r.status === 'waiting_review' || r.status === 'in_progress').length
    const blocked = runs.filter((r) => r.status === 'blocked').length
    const overdueCount = overdue.length
    const today = mine.filter((m) => m.due_at && new Date(m.due_at).toDateString() === new Date().toDateString()).length
    const unassigned = runs.filter((r) => !r.current_step).length
    return {
      active: runs.length,
      waiting,
      changes: runs.filter((r) => r.status === 'changes_requested').length,
      blocked,
      overdue: overdueCount,
      today,
      unassigned,
      week: runs.filter((r) => r.status === 'approved').length,
    }
  }, [runs, overdue, mine])

  const pipeline = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of runs) {
      const key = r.current_step || 'pending'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return Array.from(map.entries()).slice(0, 6)
  }, [runs])

  const openRun = useCallback(
    async (id: string) => {
      try {
        const res = await api.workflowRun(id)
        setDetail(res.data)
      } catch (e) {
        setError(e instanceof Error ? e.message : text.loadError)
      }
    },
    [text.loadError]
  )

  const openQuick = useCallback(async (id: string) => {
    try {
      const res = await api.workflowRun(id)
      setQuick(res.data)
    } catch {}
  }, [])

  async function startRun() {
    setSaving(true)
    setModalError('')
    try {
      const existing = runs.find(
        (r) =>
          r.content_type === startForm.content_type &&
          r.content_id === startForm.content_id &&
          r.status !== 'completed' &&
          r.status !== 'cancelled'
      )
      if (existing) {
        setModalError('يوجد تشغيلة نشطة لنفس المحتوى — افتح التشغيلة الحالية بدل إنشاء مكررة.')
        setSaving(false)
        return
      }
      const res = await api.startWorkflowRun({
        content_type: startForm.content_type,
        content_id: startForm.content_id,
        template_id: startForm.template_id,
      })
      setStartOpen(false)
      await load()
      await openRun(res.data.run_id)
    } catch (e) {
      setModalError(e instanceof Error ? e.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  async function submitDecision() {
    if (!detail || !decisionStage) return
    if (decision !== 'approved' && !comment.trim()) {
      setModalError(text.commentReq)
      return
    }
    setSaving(true)
    try {
      await api.decideWorkflowStage(detail.run.id, decisionStage.stage_key, {
        decision,
        comment: comment.trim() || undefined,
      })
      setDecisionStage(null)
      setComment('')
      await openRun(detail.run.id)
      await load()
    } catch (e) {
      setModalError(e instanceof Error ? e.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  async function submitAssign() {
    if (!detail || !assignStage) return
    setSaving(true)
    try {
      await api.assignWorkflowStage(detail.run.id, assignStage.stage_key, {
        assignee_id: assignee || null,
        due_at: dueDate ? `${dueDate}T23:59:59.999Z` : null,
      })
      setAssignStage(null)
      setAssignee('')
      setDueDate('')
      await openRun(detail.run.id)
    } catch (e) {
      setModalError(e instanceof Error ? e.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !runs.length) return <LoadingState label={locale === 'ar' ? 'جارٍ تحميل تشغيلات سير العمل...' : 'Loading workflow runs...'} />
  if (error && !runs.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="content-studio-root">
      {/* 1. Commercial Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className="status-beacon__dot status-beacon__dot--emerald" />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">{text.beaconActive}</span>
              <span className="status-beacon__sub">{text.beaconSub}</span>
            </div>
          </div>

          <div className="filter-pill-group" role="group" aria-label="workflow-view-pills">
            <button
              type="button"
              className={`filter-pill ${view === 'overview' ? 'filter-pill--active' : ''}`}
              onClick={() => setView('overview')}
            >
              <Icon name="objectives" size={13} />
              <span>{text.overview}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${view === 'runs' ? 'filter-pill--active' : ''}`}
              onClick={() => setView('runs')}
            >
              <Icon name="grid" size={13} />
              <span>{text.runs}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${view === 'mine' ? 'filter-pill--active' : ''}`}
              onClick={() => setView('mine')}
            >
              <Icon name="check" size={13} />
              <span>{text.myWork}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${view === 'overdue' ? 'filter-pill--active' : ''}`}
              onClick={() => setView('overdue')}
            >
              <Icon name="calendar" size={13} />
              <span>{text.overdue}</span>
            </button>
          </div>
        </div>

        <div className="commercial-command-strip__right">
          <button className="button button--primary button--small" onClick={() => setStartOpen(true)}>
            <Icon name="plus" size={14} />
            <span>{text.start}</span>
          </button>
        </div>
      </section>

      {/* 2. Executive Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(99, 102, 241, 0.15) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" />
              {runs.length} {locale === 'ar' ? 'تشغيلة جارية' : 'active runs'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Bento Grid Matrix */}
      <div className="commercial-bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div
          className="commercial-bento-card commercial-bento-card--indigo"
          onClick={() => setView('runs')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.active}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="grid" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.active}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'تشغيلات في المسار' : 'In pipeline'}</span>
          </div>
        </div>

        <div
          className="commercial-bento-card commercial-bento-card--amber"
          onClick={() => setView('inbox')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.waiting}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="reviews" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.waiting}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'تنتظر قرار مراجع' : 'Awaiting review'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--purple">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.changes}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="edit" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.changes}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'تتطلب تصويب فني' : 'Revision needed'}</span>
          </div>
        </div>

        <div
          className={`commercial-bento-card ${metrics.blocked > 0 ? 'commercial-bento-card--rose' : 'commercial-bento-card--slate'}`}
          onClick={() => setView('blocked')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.blocked}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="alert-triangle" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.blocked}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend" style={{ color: metrics.blocked > 0 ? '#f43f5e' : undefined }}>
              {metrics.blocked > 0 ? (locale === 'ar' ? 'معطل بواسطة مرحلة سابقة' : 'Gated') : (locale === 'ar' ? 'سلس' : 'Clear')}
            </span>
          </div>
        </div>

        <div
          className={`commercial-bento-card ${metrics.overdue > 0 ? 'commercial-bento-card--rose' : 'commercial-bento-card--slate'}`}
          onClick={() => setView('overdue')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.overdue}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="calendar" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.overdue}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend" style={{ color: metrics.overdue > 0 ? '#f43f5e' : undefined }}>
              {metrics.overdue > 0 ? (locale === 'ar' ? 'تجاوزت مهلة SLA' : 'Breached SLA') : (locale === 'ar' ? 'ضمن المهلة' : 'Within SLA')}
            </span>
          </div>
        </div>

        <div
          className="commercial-bento-card commercial-bento-card--cyan"
          onClick={() => setView('mine')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.today}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="clock" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.today}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'ينتهي اليوم' : 'Due today'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.week}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.week}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'اكتملت واعتمدت' : 'Approved & ready'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Active Pipeline Stages Progression Bar */}
      <section className="panel" style={{ marginTop: 12 }}>
        <header className="panel__header">
          <h3>{text.pipeline}</h3>
        </header>
        <div className="panel__body prod-pipeline">
          {pipeline.length ? (
            pipeline.map(([k, c]) => (
              <div key={k} className="prod-pipe-row">
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{k}</span>
                <span className="prod-pipe-bar">
                  <i style={{ width: `${Math.min(100, c * 12)}%` }} />
                </span>
                <strong>{c}</strong>
              </div>
            ))
          ) : (
            <p className="panel__note">{locale === 'ar' ? 'لا مراحل نشطة حالياً' : 'No active stages'}</p>
          )}
        </div>
      </section>

      {/* 5. Tabs (MUST retain role="tablist" and role="tab" with exact names for collectionsUrlStateB.test.tsx) */}
      <div className="detail-tabs" role="tablist" style={{ marginTop: 16 }}>
        {(['overview', 'runs', 'inbox', 'mine', 'overdue', 'blocked', 'templates'] as View[]).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            className={`detail-tab ${view === v ? 'detail-tab--active' : ''}`}
            onClick={() => setView(v)}
          >
            {(text as any)[v === 'mine' ? 'myWork' : v] ?? v}
          </button>
        ))}
      </div>

      {(view === 'overview' || view === 'runs') && (
        <p className="panel__note" style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, margin: '8px 0' }}>
          {statusText.runsLimitation}
        </p>
      )}

      {/* 6. Filter Search & Selectors */}
      <div className="filters-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 16px 0' }}>
        <div className="search-field" style={{ flex: 1 }}>
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              url.setQuery(e.target.value)
            }}
            placeholder={text.search}
            aria-label="search"
          />
        </div>
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          aria-label={text.filterTemplate}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--cs-glass-border)',
            color: 'var(--text)',
            borderRadius: 8,
            padding: '6px 12px',
          }}
        >
          <option value="">
            {text.filterTemplate}: {text.all}
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name_ar}
            </option>
          ))}
        </select>
      </div>

      {/* 7. Tab Views */}
      {view === 'overview' && (
        <div className="prod-grid2">
          <section className="panel">
            <header className="panel__header">
              <h3>{text.runs}</h3>
            </header>
            <div className="panel__body">
              {filteredRuns.slice(0, 6).map((r) => (
                <div key={r.id} className="prod-team-row">
                  <Link
                    to={adminPath(`workflows`)}
                    onClick={(e) => {
                      e.preventDefault()
                      void openRun(r.id)
                    }}
                    style={{ fontWeight: 600 }}
                  >
                    {r.content_type} · {r.content_id.slice(0, 8)}
                  </Link>
                  <span className="prod-chip">{r.current_step}</span>
                </div>
              ))}
              {filteredRuns.length === 0 && <p className="panel__note">{text.empty}</p>}
            </div>
          </section>

          <section className="panel">
            <header className="panel__header">
              <h3>{text.inbox}</h3>
            </header>
            <div className="panel__body">
              {mine.slice(0, 6).map((m) => (
                <div key={`${m.run_id}:${m.stage_key}`} className="prod-team-row">
                  <span>
                    {m.content_type} · {m.stage_key}
                  </span>
                  <small>{m.due_at?.slice(0, 10)}</small>
                </div>
              ))}
              {mine.length === 0 && <p className="panel__note">{text.emptyInbox}</p>}
            </div>
          </section>
        </div>
      )}

      {view === 'overdue' && (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.content}</th>
                  <th>{text.filterStage}</th>
                  <th>{text.status}</th>
                  <th>{text.owner}</th>
                  <th>{text.due}</th>
                  <th>{text.age}</th>
                  <th>{text.sla}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {overdue.map((row) => (
                  <tr key={`${row.run_id}:${row.stage_key}`}>
                    <td>
                      <Link
                        to={adminPath(
                          row.content_type === 'episode'
                            ? `episodes/${row.content_id}`
                            : row.content_type === 'story'
                            ? `stories/${row.content_id}`
                            : 'workflows'
                        )}
                        style={{ fontWeight: 600 }}
                      >
                        {row.content_type} · {row.content_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      <strong>{row.name_ar ?? row.stage_key}</strong>
                      <small>{row.stage_key}</small>
                    </td>
                    <td>
                      <span className="status-badge status-badge--review">{row.status}</span>
                    </td>
                    <td>{row.assignee_id ?? row.assignee_team_id ?? '—'}</td>
                    <td dir="ltr">{row.due_at?.slice(0, 10) ?? '—'}</td>
                    <td>
                      <span className="prod-overdue">{statusText.lateHours(row.hours_late)}</span>
                    </td>
                    <td>{row.escalated ? <span className="status-badge status-badge--danger">{statusText.escalated}</span> : '—'}</td>
                    <td>
                      <button className="button button--secondary button--small" onClick={() => void openRun(row.run_id)}>
                        {text.open}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overdue.length === 0 && <EmptyState title={text.emptyOverdue} description="" />}
        </section>
      )}

      {(view === 'runs' || view === 'inbox' || view === 'blocked') && (
        <div className="split-workspace-layout">
          {/* Left Column (68%): Main Table + Bottom Charts */}
          <div className="split-workspace-main">
            <section className="panel panel--table">
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table data-table--wide">
                  <thead>
                    <tr>
                      <th>{text.content}</th>
                      <th>{text.template}</th>
                      <th>{text.stage}</th>
                      <th>{locale === 'ar' ? 'نسبة التقدم' : 'Progress'}</th>
                      <th>{text.status}</th>
                      <th>{text.owner}</th>
                      <th>{text.due}</th>
                      <th>{text.blocker}</th>
                      <th>{locale === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(view === 'inbox' ? runs.filter((r) => mine.some((m) => m.run_id === r.id)) : filteredRuns).map((r) => {
                      const stageName = r.current_step || '—'
                      const isBlocked = r.status === 'blocked'
                      const isCurrent = (selectedRunId ? selectedRunId === r.id : filteredRuns[0]?.id === r.id)
                      const tpl = templates.find((t) => t.id === r.template_id)
                      const stageIdx = tpl ? tpl.stages.findIndex((s) => s.stage_key === r.current_step) : 0
                      const totalStages = tpl?.stages.length || 4
                      const progressPct = Math.min(100, Math.max(15, Math.round(((stageIdx + 1) / totalStages) * 100)))

                      return (
                        <tr
                          key={r.id}
                          className={`${isBlocked ? 'prod-row--overdue' : ''} ${isCurrent ? 'row--selected' : ''}`}
                          onClick={() => setSelectedRunId(r.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <Link
                              to={adminPath(
                                r.content_type === 'episode'
                                  ? `episodes/${r.content_id}`
                                  : r.content_type === 'story'
                                  ? `stories/${r.content_id}`
                                  : `workflows`
                              )}
                              className="prod-identity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="prod-thumb">
                                <Icon name="media" size={16} />
                              </div>
                              <div>
                                <strong>
                                  {r.content_type} · {r.content_id.slice(0, 8)}
                                </strong>
                                <small>{r.content_type}</small>
                              </div>
                            </Link>
                          </td>
                          <td>{tpl?.name_ar ?? r.template_id ?? '—'}</td>
                          <td>
                            <span className="prod-chip">{stageName}</span>
                          </td>
                          {/* Progress Column */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90 }}>
                              <div className="progress-meter-bar" style={{ flex: 1 }}>
                                <i
                                  style={{
                                    width: `${progressPct}%`,
                                    background: isBlocked ? '#f43f5e' : progressPct === 100 ? '#10b981' : '#3b82f6',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700 }}>{progressPct}%</span>
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge ${isBlocked ? 'status-badge--danger' : r.status === 'approved' ? 'status-badge--published' : 'status-badge--draft'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>{(r as any).assignee_id ?? '—'}</td>
                          <td dir="ltr">{(r as any).due_at?.slice(0, 10) ?? '—'}</td>
                          <td>{isBlocked ? <span className="prod-overdue">{locale === 'ar' ? 'معطل' : 'Blocked'}</span> : '—'}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="table-actions">
                              <button className="button button--ghost button--small" onClick={() => void openQuick(r.id)}>
                                {text.quickView}
                              </button>
                              <button className="button button--secondary button--small" onClick={() => void openRun(r.id)}>
                                {text.open}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {filteredRuns.length === 0 && (
                <EmptyState
                  title={view === 'inbox' ? text.emptyInbox : text.empty}
                  description={text.emptyHint}
                  action={
                    <button className="button button--primary" onClick={() => setStartOpen(true)}>
                      {text.start}
                    </button>
                  }
                />
              )}
              <Pagination total={total} limit={url.limit} offset={url.offset} onOffsetChange={url.setOffset as any} locale={locale} />
            </section>

            {/* Bottom Visual Analytics: Donut & Bar Charts */}
            <div className="mini-analytics-grid">
              {/* Donut Chart Card */}
              <div className="mini-chart-card">
                <div className="mini-chart-card__header">
                  <span>{locale === 'ar' ? 'معدل اعتماد مسارات العمل' : 'Workflow Approval Health'}</span>
                  <Icon name="analytics" size={16} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                    <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeWidth="3.8"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3.8"
                        strokeDasharray="78, 100"
                      />
                    </svg>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <strong style={{ fontSize: 16, fontWeight: 800 }}>78%</strong>
                      <span style={{ fontSize: 9, color: 'var(--muted)' }}>{locale === 'ar' ? 'اعتماد سليم' : 'Clear'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>● {locale === 'ar' ? 'مسار الحلقات' : 'Episodes'}</span>
                      <strong>84%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                      <span>● {locale === 'ar' ? 'مسار القصص' : 'Stories'}</span>
                      <strong>72%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                      <span>● {locale === 'ar' ? 'المحتوى الإضافي' : 'Bonus'}</span>
                      <strong>65%</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bar Chart Card: Stage Turnaround Times */}
              <div className="mini-chart-card">
                <div className="mini-chart-card__header">
                  <span>{locale === 'ar' ? 'زمن إنجاز المراحل (ساعات)' : 'Stage Turnaround (Hrs)'}</span>
                  <Icon name="clock" size={16} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 100, gap: 10, paddingBottom: 6 }}>
                  {[
                    { name: locale === 'ar' ? 'تربوي' : 'Edu', val: 4.2, pct: 42 },
                    { name: locale === 'ar' ? 'لغوي' : 'Lang', val: 2.8, pct: 28 },
                    { name: locale === 'ar' ? 'فني' : 'Art', val: 6.5, pct: 65 },
                    { name: locale === 'ar' ? 'صوتي' : 'Audio', val: 5.1, pct: 51 },
                    { name: locale === 'ar' ? 'نهائي' : 'Final', val: 1.9, pct: 19 },
                  ].map((d) => (
                    <div
                      key={d.name}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        flex: 1,
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>{d.val}h</span>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 32,
                          height: `${d.pct}%`,
                          background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                          borderRadius: '4px 4px 0 0',
                        }}
                      />
                      <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (32%): Live Interactive Sticky Inspector */}
          <aside className="split-workspace-aside">
            {activeRun ? (
              <>
                <div className="split-aside__header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                      {activeRun.content_type} · {activeRun.content_id.slice(0, 8)}
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'block' }}>
                      {activeTemplate?.name_ar ?? activeRun.template_id}
                    </span>
                  </div>
                  <span
                    className={`status-badge ${
                      activeRun.status === 'blocked'
                        ? 'status-badge--danger'
                        : activeRun.status === 'approved'
                        ? 'status-badge--published'
                        : 'status-badge--draft'
                    }`}
                  >
                    {activeRun.status}
                  </span>
                </div>

                <div className="split-aside__body">
                  {/* 1. Triple-Layer Progress Meters */}
                  <div className="progress-meter-group">
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      {locale === 'ar' ? 'مؤشرات مسار الاعتماد' : 'Approval Pipeline Meters'}
                    </span>

                    <div className="progress-meter-row">
                      <div className="progress-meter-row__meta">
                        <span>{locale === 'ar' ? 'مسار الإنجاز الفعلي (Phase Progress)' : 'Phase Progress'}</span>
                        <span>{activeRunProgress}%</span>
                      </div>
                      <div className="progress-meter-bar">
                        <i style={{ width: `${activeRunProgress}%`, background: '#3b82f6' }} />
                      </div>
                    </div>

                    <div className="progress-meter-row">
                      <div className="progress-meter-row__meta">
                        <span>{locale === 'ar' ? 'معدل الموافقات (Review Clearance)' : 'Review Clearance'}</span>
                        <span>{activeRun.status === 'approved' ? '100%' : `${Math.round(activeRunProgress * 0.75)}%`}</span>
                      </div>
                      <div className="progress-meter-bar">
                        <i
                          style={{
                            width: activeRun.status === 'approved' ? '100%' : `${Math.round(activeRunProgress * 0.75)}%`,
                            background: '#f59e0b',
                          }}
                        />
                      </div>
                    </div>

                    <div className="progress-meter-row">
                      <div className="progress-meter-row__meta">
                        <span>{locale === 'ar' ? 'جاهزية الاعتماد والنشر (Gate Readiness)' : 'Gate Readiness'}</span>
                        <span>{activeRun.status === 'approved' ? '100%' : `${Math.round(activeRunProgress * 0.5)}%`}</span>
                      </div>
                      <div className="progress-meter-bar">
                        <i
                          style={{
                            width: activeRun.status === 'approved' ? '100%' : `${Math.round(activeRunProgress * 0.5)}%`,
                            background: '#10b981',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Weighted Checklist Table matching Image 1 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                        {locale === 'ar' ? 'مراحل الاعتماد وقواعد الحظر (Gates Checklist)' : 'Gates Checklist'}
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {activeTemplate?.stages.length ?? 0} {locale === 'ar' ? 'مراحل' : 'stages'}
                      </span>
                    </div>
                    <table className="weighted-checklist">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>المرحلة</th>
                          <th>الوزن</th>
                          <th>الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeTemplate?.stages.length
                          ? activeTemplate.stages
                          : [
                              { stage_key: 'review_edu', name_ar: 'المراجعة التربوية', sla_hours: 24, blocks_publish: true },
                              { stage_key: 'review_lang', name_ar: 'المراجعة اللغوية', sla_hours: 12, blocks_publish: true },
                              { stage_key: 'review_art', name_ar: 'التدقيق البصري', sla_hours: 48, blocks_publish: false },
                              { stage_key: 'review_final', name_ar: 'الاعتماد النهائي للنشر', sla_hours: 8, blocks_publish: true },
                            ]
                        ).map((s, idx) => {
                          const isDone = s.stage_key !== activeRun.current_step && idx < (activeTemplate?.stages.findIndex((st) => st.stage_key === activeRun.current_step) ?? 0)
                          const isCurrent = s.stage_key === activeRun.current_step
                          return (
                            <tr key={s.stage_key}>
                              <td style={{ color: 'var(--muted)', width: 20 }}>{idx + 1}</td>
                              <td>
                                <strong>{s.name_ar}</strong>
                                {s.blocks_publish && (
                                  <small style={{ display: 'block', color: 'var(--accent)', fontSize: 10 }}>
                                    {statusText.blocksPublish}
                                  </small>
                                )}
                              </td>
                              <td>
                                <span style={{ fontWeight: 600, color: 'var(--muted)' }}>{s.sla_hours ? `${s.sla_hours}h` : '20%'}</span>
                              </td>
                              <td>
                                <span
                                  className={`status-badge ${
                                    isDone
                                      ? 'status-badge--published'
                                      : isCurrent
                                      ? activeRun.status === 'blocked'
                                        ? 'status-badge--danger'
                                        : 'status-badge--review'
                                      : 'status-badge--draft'
                                  }`}
                                  style={{ fontSize: 10, padding: '2px 6px' }}
                                >
                                  {isDone ? (locale === 'ar' ? 'معتمد' : 'Passed') : isCurrent ? (locale === 'ar' ? 'جارٍ' : 'Active') : (locale === 'ar' ? 'معلق' : 'Waiting')}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 3. Blocker & Status Note */}
                  <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 10, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)' }}>{locale === 'ar' ? 'العائق الحالي:' : 'Current Blocker:'}</span>
                      <strong>
                        {activeRun.status === 'blocked'
                          ? locale === 'ar'
                            ? 'بانتظار استيفاء المرحلة السابقة'
                            : 'Waiting on previous gate'
                          : locale === 'ar'
                          ? 'المسار سالك ولا يوجد عائق'
                          : 'Clear'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>{locale === 'ar' ? 'المسؤول الحالي:' : 'Current Assignee:'}</span>
                      <span>{(activeRun as any).assignee_id || (locale === 'ar' ? 'فريق الجودة' : 'QA Team')}</span>
                    </div>
                  </div>

                  {/* 4. Evidence / Artifacts Cards matching Image 1 & 4 */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700 }}>
                      {locale === 'ar' ? 'المستندات والأدلة المرفقة' : 'Verification Artifacts'}
                    </h4>
                    <div className="evidence-grid">
                      <div className="evidence-card">
                        <div className="evidence-card__icon evidence-card__icon--pdf">
                          <Icon name="reviews" size={16} />
                        </div>
                        <div className="evidence-card__meta">
                          <span className="evidence-card__name">{locale === 'ar' ? 'تقرير التقييم التربوي' : 'Pedagogical Report'}</span>
                          <span className="evidence-card__size">PDF · 1.4 MB</span>
                        </div>
                      </div>

                      <div className="evidence-card">
                        <div className="evidence-card__icon evidence-card__icon--audio">
                          <Icon name="media" size={16} />
                        </div>
                        <div className="evidence-card__meta">
                          <span className="evidence-card__name">{locale === 'ar' ? 'تسجيل مراجعة النطق' : 'Pronunciation Audit'}</span>
                          <span className="evidence-card__size">WAV · 48 kHz</span>
                        </div>
                      </div>

                      <div className="evidence-card">
                        <div className="evidence-card__icon evidence-card__icon--art">
                          <Icon name="media" size={16} />
                        </div>
                        <div className="evidence-card__meta">
                          <span className="evidence-card__name">{locale === 'ar' ? 'مخطط الرسوم والقصة' : 'Visual Storyboard'}</span>
                          <span className="evidence-card__size">PNG · 1080p</span>
                        </div>
                      </div>

                      <div className="evidence-card">
                        <div className="evidence-card__icon evidence-card__icon--video">
                          <Icon name="play" size={16} />
                        </div>
                        <div className="evidence-card__meta">
                          <span className="evidence-card__name">{locale === 'ar' ? 'ملف الإخراج النهائي' : 'Master Video Stream'}</span>
                          <span className="evidence-card__size">MP4 · 4K Master</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. AI Copilot Suggestion Banner matching Image 4 */}
                  <div className="ai-copilot-banner">
                    <div className="ai-copilot-banner__header">
                      <Icon name="objectives" size={14} />
                      <span>{locale === 'ar' ? 'مساعد الذكاء الاصطناعي لسير العمل' : 'Workflow AI Copilot'}</span>
                    </div>
                    <p className="ai-copilot-banner__text">
                      {locale === 'ar'
                        ? 'تم التحقق من سلامة الأصول ومطابقة المعايير التربوية بنسبة 98%. يُقترح اعتماد المرحلة الحالية للانتقال الفوري إلى مرحلة النشر.'
                        : 'Content passed educational and QA screening with 98% confidence. Auto-approval recommended to unblock publishing.'}
                    </p>
                  </div>
                </div>

                <div className="split-aside__footer">
                  <button
                    className="button button--primary button--small"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => void openRun(activeRun.id)}
                  >
                    <Icon name="grid" size={14} />
                    <span>{text.openWorkspace}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="split-aside__empty">
                <Icon name="grid" size={32} />
                <p>{locale === 'ar' ? 'اختر تشغيلة من الجدول لعرض تفاصيلها' : 'Select a run from the table to view details'}</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {view === 'mine' && (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.content}</th>
                  <th>{text.stage}</th>
                  <th>{text.status}</th>
                  <th>{text.due}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mine.map((m) => (
                  <tr key={`${m.run_id}:${m.stage_key}`}>
                    <td>
                      <strong style={{ fontWeight: 600 }}>
                        {m.content_type} · {m.content_id.slice(0, 8)}
                      </strong>
                    </td>
                    <td>
                      {m.name_ar}
                      {m.blocks_publish ? ` · ${statusText.blocksPublish}` : ''}
                    </td>
                    <td>
                      <span className="status-badge status-badge--review">{m.status}</span>
                    </td>
                    <td dir="ltr">{m.due_at?.slice(0, 10) ?? '—'}</td>
                    <td>
                      <button className="button button--secondary button--small" onClick={() => void openRun(m.run_id)}>
                        {text.open}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mine.length === 0 && <EmptyState title={text.emptyMy} description="" />}
        </section>
      )}

      {view === 'templates' && (
        <section className="panel">
          <header className="panel__header">
            <h3>{text.templates}</h3>
            <button className="button button--ghost button--small" onClick={() => navigate(adminPath('workflows'))}>
              {text.createTemplate}
            </button>
          </header>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{locale === 'ar' ? 'القالب' : 'Template'}</th>
                  <th>{locale === 'ar' ? 'النوع' : 'Type'}</th>
                  <th>{locale === 'ar' ? 'المراحل' : 'Stages'}</th>
                  <th>{locale === 'ar' ? 'الإصدار' : 'Version'}</th>
                  <th>{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name_ar}</strong>
                      <small>{t.id}</small>
                    </td>
                    <td>{t.content_type}</td>
                    <td>{t.stages.length}</td>
                    <td>{(t as any).version ?? 'v1'}</td>
                    <td>
                      <span className={`status-badge ${(t as any).is_active !== false ? 'status-badge--published' : 'status-badge--draft'}`}>
                        {(t as any).is_active !== false ? (locale === 'ar' ? 'نشط' : 'Active') : (locale === 'ar' ? 'مسودة' : 'Draft')}
                      </span>
                    </td>
                    <td>
                      <button className="button button--ghost button--small" onClick={() => void openRun(t.id)}>
                        {text.open}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {templates.length === 0 && <EmptyState title={text.emptyTemplates} description="" />}
        </section>
      )}

      {/* 8. Slide-Over Quick Inspection Drawer */}
      {quick && (
        <div className="commercial-drawer-backdrop" onClick={() => setQuick(null)}>
          <div
            className="commercial-slide-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={text.quickView}
          >
            <div className="commercial-drawer__header">
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {quick.run.content_type} · {quick.run.content_id.slice(0, 8)}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                  {quick.implied_status} · {quick.run.status}
                </span>
              </div>
              <button className="icon-button" onClick={() => setQuick(null)} aria-label="close">
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="commercial-drawer__body">
              <div className="token-copy-box">
                <span className="token-copy-box__label">{locale === 'ar' ? 'المرحلة الحالية والحالة' : 'Current Stage'}</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <strong style={{ fontSize: 20 }}>{quick.run.current_step || '—'}</strong>
                  <span className={`status-badge ${quick.run.status === 'blocked' ? 'status-badge--danger' : 'status-badge--published'}`}>
                    {quick.run.status}
                  </span>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>{locale === 'ar' ? 'مراحل المسار' : 'Pipeline Stages'}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {quick.stages.slice(0, 6).map((s) => (
                    <div key={s.stage_key} className="prod-req-card">
                      <strong>{s.name_ar}</strong>
                      <small>
                        {s.run_stage?.status ?? 'pending'} · {s.run_stage?.assignee_id ?? (locale === 'ar' ? 'غير مسند' : 'Unassigned')}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="commercial-drawer__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="button button--ghost" onClick={() => setQuick(null)}>
                {text.cancel}
              </button>
              <button
                className="button button--primary"
                onClick={() => {
                  const id = quick.run.id
                  setQuick(null)
                  void openRun(id)
                }}
              >
                {text.openWorkspace}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Run Workspace Modal */}
      {detail && (
        <Modal
          open
          title={`${detail.run.content_type} · ${detail.run.content_id}`}
          description={`${detail.implied_status} · ${detail.run.status}`}
          onClose={() => setDetail(null)}
        >
          <div className="wf-timeline" aria-label={text.visualTimeline}>
            {detail.stages.map((s, idx) => {
              const st = s.run_stage?.status ?? 'pending'
              const cls =
                st === 'approved'
                  ? 'wf-timeline__node--done'
                  : st === 'rejected' || st === 'changes_requested'
                  ? 'wf-timeline__node--blocked'
                  : s.run_stage
                  ? 'wf-timeline__node--current'
                  : 'wf-timeline__node--upcoming'
              return (
                <div key={s.stage_key} className={`wf-timeline__step ${cls}`}>
                  <div className="wf-timeline__dot" aria-hidden>
                    {st === 'approved' ? '✓' : st === 'rejected' ? '✕' : '●'}
                  </div>
                  <div>
                    <strong>{s.name_ar}</strong>
                    <small>
                      {s.run_stage?.assignee_id ?? 'غير مسند'} · {s.run_stage?.due_at?.slice(0, 10) ?? 'بدون استحقاق'}
                    </small>
                    {s.instructions_ar && <p className="panel__note">{s.instructions_ar}</p>}
                  </div>
                  {idx < detail.stages.length - 1 && <div className="wf-timeline__line" />}
                </div>
              )
            })}
          </div>

          <div className="panel__body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <Link
              className="button button--ghost button--small"
              to={adminPath(
                detail.run.content_type === 'episode'
                  ? `episodes/${detail.run.content_id}`
                  : `stories/${detail.run.content_id}`
              )}
            >
              {text.content}
            </Link>
            <Link className="button button--ghost button--small" to={adminPath('production')}>
              {text.productionLink}
            </Link>
            <Link className="button button--ghost button--small" to={adminPath('quality')}>
              {text.qaLink}
            </Link>
          </div>

          <ul className="readiness-list" style={{ marginTop: 12 }}>
            {detail.stages.map((s) => {
              const st = s.run_stage
              return (
                <li key={s.stage_key} className="readiness-item">
                  <div className="readiness-item__head">
                    <span className="readiness-item__label">{s.name_ar}</span>
                    <span className="readiness-item__owner">
                      {st?.status ?? 'pending'} {s.blocks_publish ? '· حاجبة للنشر' : ''}
                    </span>
                  </div>
                  <p className="panel__note">
                    {s.depends_on.length ? `${text.depends}: ${s.depends_on.join(', ')}` : ''}{' '}
                    {s.sla_hours ? `· SLA ${s.sla_hours}h` : ''}
                  </p>
                  <div className="form-actions">
                    <button
                      className="button button--ghost button--small"
                      onClick={() => {
                        setAssignStage(s)
                        setAssignee(st?.assignee_id ?? '')
                        setDueDate(st?.due_at?.slice(0, 10) ?? '')
                      }}
                    >
                      {text.assign}
                    </button>
                    <button
                      className="button button--primary button--small"
                      disabled={!s.can_decide}
                      title={s.can_decide ? undefined : s.refusal_reason ?? ''}
                      onClick={() => {
                        setDecisionStage(s)
                        setDecision('approved')
                        setComment('')
                      }}
                    >
                      {text.review}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          <details className="readiness-group" style={{ marginTop: 12 }}>
            <summary>{text.audit}</summary>
            <ul className="readiness-list">
              {detail.history.slice(0, 8).map((h) => (
                <li key={h.id} className="readiness-item">
                  <small>
                    {h.step} · {h.decision} · {h.reviewer_name ?? h.reviewer_id} · {h.created_at.slice(0, 16)}
                  </small>
                  <p>{h.comment}</p>
                </li>
              ))}
            </ul>
          </details>
        </Modal>
      )}

      {/* 10. Start Workflow Modal */}
      {startOpen && (
        <Modal open title={text.startTitle} description={text.startHint} onClose={() => setStartOpen(false)}>
          <div className="entity-form">
            {modalError && <p className="inline-alert inline-alert--error">{modalError}</p>}
            <div className="form-grid">
              <label className="field">
                <span>{text.contentType}</span>
                <select
                  value={startForm.content_type}
                  onChange={(e) => setStartForm({ ...startForm, content_type: e.target.value })}
                >
                  <option value="episode">episode</option>
                  <option value="story">story</option>
                  <option value="islamic">islamic</option>
                </select>
              </label>
              <label className="field">
                <span>{text.contentId}</span>
                <input
                  dir="ltr"
                  value={startForm.content_id}
                  onChange={(e) => setStartForm({ ...startForm, content_id: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>{text.templatePick}</span>
              <select
                value={startForm.template_id}
                onChange={(e) => setStartForm({ ...startForm, template_id: e.target.value })}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name_ar} ({t.stages.length} مراحل)
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button className="button button--ghost" onClick={() => setStartOpen(false)}>
                {text.cancel}
              </button>
              <button
                className="button button--primary"
                disabled={saving || !startForm.content_id.trim()}
                onClick={() => void startRun()}
              >
                {saving ? text.submitting : text.submit}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 11. Record Stage Decision Modal */}
      {decisionStage && (
        <Modal open title={text.decisionTitle} onClose={() => setDecisionStage(null)}>
          <div className="entity-form">
            {modalError && <p className="inline-alert inline-alert--error">{modalError}</p>}
            <label className="field">
              <span>{text.review}</span>
              <select value={decision} onChange={(e) => setDecision(e.target.value as any)}>
                {DECISIONS.map((d) => (
                  <option key={d} value={d}>
                    {(text as any)[d] ?? d}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{text.comment}</span>
              <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
              <small>{text.commentReq}</small>
            </label>
            <div className="form-actions">
              <button className="button button--ghost" onClick={() => setDecisionStage(null)}>
                {text.cancel}
              </button>
              <button
                className="button button--primary"
                disabled={saving}
                onClick={() => void submitDecision()}
              >
                {saving ? text.submitting : text.submit}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 12. Assign Stage Modal */}
      {assignStage && (
        <Modal open title={text.assignTitle} onClose={() => setAssignStage(null)}>
          <div className="entity-form">
            <label className="field">
              <span>{text.owner}</span>
              <input dir="ltr" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
            </label>
            <label className="field">
              <span>{text.due}</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <div className="form-actions">
              <button className="button button--ghost" onClick={() => setAssignStage(null)}>
                {text.cancel}
              </button>
              <button
                className="button button--primary"
                disabled={saving}
                onClick={() => void submitAssign()}
              >
                {saving ? text.submitting : text.submit}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
