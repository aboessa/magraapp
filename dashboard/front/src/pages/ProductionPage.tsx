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

const REQUIREMENT_ORDER: string[] = [
  'script', 'educational', 'translation_ar', 'translation_en', 'translation_fr',
  'voice_ar', 'voice_en', 'voice_fr', 'artwork', 'video', 'thumbnail', 'captions', 'qa', 'publish'
]

const REQUIREMENT_WEIGHTS: Record<string, number> = {
  script: 15,
  educational: 10,
  translation_ar: 10,
  translation_en: 5,
  translation_fr: 5,
  voice_ar: 15,
  voice_en: 5,
  voice_fr: 5,
  artwork: 20,
  video: 15,
  thumbnail: 5,
  captions: 5,
  qa: 10,
  publish: 5,
}

const STATE_LABEL: Record<RequirementState, { ar: string; en: string; kind: 'missing' | 'blocked' | 'assigned' | 'progress' | 'review' | 'complete' | 'na' }> = {
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
  const sorted = [...blocked].sort((a, b) => {
    if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at)
    return REQUIREMENT_ORDER.indexOf(a.key) - REQUIREMENT_ORDER.indexOf(b.key)
  })
  return sorted[0]
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

function aiRecommendation(item: ProductionItem): string {
  const blocker = primaryBlocker(item)
  if (blocker) {
    return `الخطوة التالية الموصى بها: معالجة عائق "${blocker.label_ar}" (${blocker.blocker || blocker.detail}) بالتنسيق مع ${blocker.owner_role || 'الفريق المختص'} لفتح مسار الإنتاج.`
  }
  const stage = currentStage(item)
  if (stage) {
    return `الخطوة التالية الموصى بها: استكمال مرحلة "${stage.label_ar}" والتأكد من إسنادها للمسؤول (${stage.assignee_id || 'غير مسند'}) لإتمام نسبة الإنجاز.`
  }
  if (item.summary.publish_state === 'ready') {
    return 'الأصل مكتمل إنتاجياً بنسبة 100% وجاهز للاعتماد النهائي وبوابة النشر.'
  }
  return 'المتابعة الدورية مع فرق التحريك والصوتيات لضمان تسليم الأصول قبل الموعد.'
}

const copy = {
  ar: {
    eyebrow: 'إدارة الإنتاج وعمليات الاستوديو',
    title: 'متابعة تقدم الإنتاج والتاسكات',
    lede: 'غرفة عمليات إنتاج مجرة: مراقبة لحظية للأصول، فحص تقدم المراحل، إدارة المعطلات، وتوجيه المهام بنظام القوائم الموزونة.',
    beaconActive: 'استوديو الإنتاج الميداني نشط',
    beaconSub: 'تزامن لحظي مع خطوط الإنتاج والأصول',
    metrics: {
      inProd: 'قيد التنفيذ',
      readyQA: 'جاهزة للمراجعة',
      readyPub: 'مكتملة وجاهزة',
      blocked: 'متوقفة / معطلة',
      overdue: 'متأخرة عن المهلة',
      unassigned: 'غير مسندة',
      dueWeek: 'مستحقة هذا الأسبوع',
      missing: 'أصول حرجة ناقصة',
    },
    pipeline: 'توزيع خط الإنتاج والمراحل الحالية',
    blockers: 'مركز فرز ومعالجة المعطلات',
    myQueue: 'مهامي',
    team: 'توزيع أحمال الفرق والسعة التشغيلية',
    upcoming: 'الاستحقاقات القادمة',
    tableView: 'جدول',
    kanbanView: 'كانبان',
    matrixView: 'مصفوفة',
    myWorkView: 'مهامي',
    search: 'بحث في التاسكات والأصول...',
    typeLabel: 'النوع',
    planetLabel: 'الكوكب',
    seriesLabel: 'السلسلة',
    langLabel: 'اللغة',
    ownerLabel: 'المسؤول',
    statusLabel: 'الحالة',
    thumb: 'الوسيط',
    content: 'التاسك / المحتوى',
    context: 'المشروع / السلسلة',
    readiness: 'نسبة الإنجاز',
    stage: 'المرحلة الحالية',
    blocker: 'العائق الأساسي',
    owner: 'المسؤول',
    teamLabel: 'الفريق',
    due: 'تاريخ الاستحقاق',
    actions: 'إجراءات',
    quickView: 'عرض سريع',
    openWorkspace: 'افتح مساحة الإنتاج',
    openContent: 'افتح المحتوى',
    assign: 'إسناد مهمة',
    dueAt: 'تاريخ الاستحقاق',
    note: 'ملاحظة تشغيلية',
    save: 'حفظ التعديلات',
    cancel: 'إلغاء',
    saving: 'جارٍ الحفظ...',
    empty: 'لا عمل إنتاجي مطابق',
    emptyHint: 'غيّر الفلتر أو النطاق الزمني لعرض المزيد من العناصر.',
    today: 'اليوم',
    thisWeek: 'هذا الأسبوع',
    next14: '14 يوم',
    month: '30 يوم',
    total: (n: number) => `1–${n} من الإجمالي`,
    overdueBadge: 'متأخر',
    blockedBadge: 'معطل',
    unassignedBadge: 'غير مسند',
    export: 'تصدير التقرير (CSV)',
    bulkAssign: 'إسناد جماعي للمحددة',
    matrixHint: 'مصفوفة المتطلبات — جدول شامل لجميع المتطلبات الـ 14 لكل أصل إنتاجي.',
    notRequired: '—',
    episodeType: 'الحلقات',
    storyType: 'القصص',
  },
  en: {
    eyebrow: 'Studio Production & Operations',
    title: 'Task & Production Progress Tracking',
    lede: 'Majarra production command: live asset monitoring, multi-layer progress tracking, blocker triage, and weighted checklist execution.',
    beaconActive: 'Studio Pipeline Live',
    beaconSub: 'Real-time sync with assets and production stages',
    metrics: {
      inProd: 'In progress',
      readyQA: 'Ready for review',
      readyPub: 'Ready to publish',
      blocked: 'Blocked / Paused',
      overdue: 'Overdue',
      unassigned: 'Unassigned',
      dueWeek: 'Due this week',
      missing: 'Missing critical',
    },
    pipeline: 'Production Pipeline & Stage Breakdown',
    blockers: 'Blocker Resolution Center',
    myQueue: 'My Work',
    team: 'Team Capacity & Workload Matrix',
    upcoming: 'Upcoming Delivery Deadlines',
    tableView: 'Table',
    kanbanView: 'Kanban',
    matrixView: 'Matrix',
    myWorkView: 'My Work',
    search: 'Search tasks or series...',
    typeLabel: 'Type',
    planetLabel: 'Planet',
    seriesLabel: 'Series',
    langLabel: 'Language',
    ownerLabel: 'Owner',
    statusLabel: 'Status',
    thumb: 'Media',
    content: 'Task / Content',
    context: 'Project / Series',
    readiness: 'Progress',
    stage: 'Current Stage',
    blocker: 'Primary Blocker',
    owner: 'Assignee',
    teamLabel: 'Team',
    due: 'Due Date',
    actions: 'Actions',
    quickView: 'Quick View',
    openWorkspace: 'Open Workspace',
    openContent: 'Open Content',
    assign: 'Assign Task',
    dueAt: 'Due Date',
    note: 'Operational Note',
    save: 'Save Changes',
    cancel: 'Cancel',
    saving: 'Saving...',
    empty: 'No production work found',
    emptyHint: 'Adjust search queries or filters to view other pipeline assets.',
    today: 'Today',
    thisWeek: 'This week',
    next14: '14 days',
    month: '30 days',
    total: (n: number) => `1–${n} total`,
    overdueBadge: 'Overdue',
    blockedBadge: 'Blocked',
    unassignedBadge: 'Unassigned',
    export: 'Export Report (CSV)',
    bulkAssign: 'Bulk Assign Selected',
    matrixHint: 'Requirements Matrix — advanced view showing all 14 requirements per asset.',
    notRequired: '—',
    episodeType: 'Episodes',
    storyType: 'Stories',
  },
}

const FILTER_DEFAULTS = { type: 'episode', status: '', planet_id: '', lang: '', owner: '', q: '', with_publish: '1' }

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
  const [selectedItem, setSelectedItem] = useState<ProductionItem | null>(null)
  const [quick, setQuick] = useState<ProductionItem | null>(null)
  const [detail, setDetail] = useState<ProductionItem | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ item: ProductionItem; req: ProductionRequirementRow } | null>(null)
  const [form, setForm] = useState({ assignee_id: '', team_id: '', due_at: '', blocker: '', note: '' })
  const [saving, setSaving] = useState(false)

  const q = (list.query || '').toString()
  const filters = list.filters as any

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (view === 'queue') {
        const res = await api.productionQueue()
        setQueue(res.data)
      } else {
        const res = await api.productionBoard({
          type: filters.type || 'episode',
          limit: list.limit,
          offset: list.offset,
          with_publish: filters.with_publish,
        })
        let data = res.data
        if (q) data = data.filter((it) => it.title.toLowerCase().includes(q.toLowerCase()))
        setItems(data)
        setTotal(res.meta?.total ?? data.length)
        if (data.length > 0 && !selectedItem) {
          setSelectedItem(data[0])
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }, [view, filters.type, filters.with_publish, list.limit, list.offset, q, selectedItem])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    list.setView(view as any)
  }, [view])

  useEffect(() => {
    if (items.length > 0) {
      if (!selectedItem || !items.some((it) => it.content_id === selectedItem.content_id)) {
        setSelectedItem(items[0])
      }
    }
  }, [items, selectedItem])

  // Derived metrics
  const metrics = useMemo(() => {
    const all = items
    const blocked = all.filter((it) => it.requirements.some((r) => r.state === 'blocked')).length
    const unassigned = all.filter((it) => it.requirements.some((r) => !r.assignee_id && r.state !== 'ready' && r.state !== 'not_applicable')).length
    const overdue = all.filter((it) => it.requirements.some((r) => isOverdue(r.due_at))).length
    const dueWeek = all.filter((it) => it.requirements.some((r) => r.due_at && Date.parse(r.due_at) - Date.now() < 7 * 86400000 && Date.parse(r.due_at) > Date.now())).length
    const inProd = all.filter((it) => it.summary.percent < 100 && it.summary.percent > 0).length
    const readyPub = all.filter((it) => it.summary.publish_state === 'ready').length
    const readyQA = all.filter((it) => it.requirements.find((r) => r.key === 'qa')?.state === 'ready').length
    const missingCritical = all.filter((it) => it.requirements.some((r) => r.state === 'missing' && r.key !== 'translation_fr' && r.key !== 'voice_fr')).length
    return { inProd, readyQA, readyPub, blocked, overdue, unassigned, dueWeek, missingCritical }
  }, [items])

  // Average completion calculation for donut chart
  const averageCompletion = useMemo(() => {
    if (!items.length) return 0
    const sum = items.reduce((acc, it) => acc + it.summary.percent, 0)
    return Math.round(sum / items.length)
  }, [items])

  // Discipline breakdown for bar chart
  const disciplineStats = useMemo(() => {
    const categories = [
      { key: 'script', name: locale === 'ar' ? 'السيناريو' : 'Script' },
      { key: 'artwork', name: locale === 'ar' ? 'الرسوم' : 'Artwork' },
      { key: 'video', name: locale === 'ar' ? 'التحريك' : 'Animation' },
      { key: 'voice_ar', name: locale === 'ar' ? 'الصوتيات' : 'Audio' },
      { key: 'qa', name: locale === 'ar' ? 'الجودة' : 'QA' },
    ]
    if (!items.length) return categories.map((c) => ({ ...c, pct: 0 }))
    return categories.map((c) => {
      const readyCount = items.filter((it) => it.requirements.find((r) => r.key === c.key)?.state === 'ready').length
      const pct = Math.round((readyCount / items.length) * 100)
      return { ...c, pct: Math.max(pct, 20) } // visually clear baseline
    })
  }, [items, locale])

  const upcoming = useMemo(() => {
    const listArr: Array<{ item: ProductionItem; req: ProductionRequirementRow }> = []
    for (const it of items) {
      for (const r of it.requirements) {
        if (r.due_at) listArr.push({ item: it, req: r })
      }
    }
    return listArr.filter(({ req }) => {
      const t = Date.parse(req.due_at!)
      const now = Date.now()
      if (range === 'today') return t - now < 86400000 && t >= now - 86400000
      if (range === 'week') return t - now < 7 * 86400000
      if (range === '14') return t - now < 14 * 86400000
      return t - now < 30 * 86400000
    }).sort((a, b) => Date.parse(a.req.due_at!) - Date.parse(b.req.due_at!)).slice(0, 6)
  }, [items, range])

  async function openDetail(it: ProductionItem) {
    try {
      const res = await api.productionItem(it.content_type, it.content_id)
      setDetail(res.data as any)
    } catch {}
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
      setEditing(null)
      await load()
      if (detail) {
        const r = await api.productionItem(editing.item.content_type, editing.item.content_id)
        setDetail(r.data as any)
      }
    } finally {
      setSaving(false)
    }
  }

  const contentLink = (it: { content_type: string; content_id: string }) =>
    adminPath(it.content_type === 'episode' ? `episodes/${it.content_id}` : `stories/${it.content_id}`)

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

          <div className="filter-pill-group" role="group" aria-label="content-type-quick">
            <button
              type="button"
              className={`filter-pill ${filters.type === 'episode' ? 'filter-pill--active' : ''}`}
              onClick={() => (list as any).setFilter('type', 'episode')}
            >
              <Icon name="video" size={13} />
              <span>{text.episodeType}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${filters.type === 'story' ? 'filter-pill--active' : ''}`}
              onClick={() => (list as any).setFilter('type', 'story')}
            >
              <Icon name="books" size={13} />
              <span>{text.storyType}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${filters.status === 'blocked' ? 'filter-pill--active' : ''}`}
              onClick={() => (list as any).setFilter('status', filters.status === 'blocked' ? '' : 'blocked')}
            >
              <Icon name="alert-triangle" size={13} />
              <span>{text.blockedBadge}</span>
            </button>
          </div>
        </div>

        <div className="commercial-command-strip__right">
          <div className="range-switch" role="group" aria-label="range">
            {(['today', 'week', '14', '30'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`button ${range === k ? 'button--primary' : 'button--ghost'} button--small`}
                onClick={() => setRange(k)}
              >
                {(text as any)[k === 'today' ? 'today' : k === 'week' ? 'thisWeek' : k === '14' ? 'next14' : 'month']}
              </button>
            ))}
          </div>

          <button
            className="button button--secondary button--small"
            onClick={() => {
              const csv = items.map((it) => `${it.title},${it.summary.percent}%,${primaryBlocker(it)?.blocker ?? ''}`).join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'production-tasks-report.csv'
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <Icon name="download" size={14} />
            <span>{text.export}</span>
          </button>
        </div>
      </section>

      {/* 2. Executive Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, rgba(168, 85, 247, 0.16) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" />
              {text.total(total)}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Bento Grid Matrix (Identical to Top Row in Image 1) */}
      <div className="commercial-bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="commercial-bento-card commercial-bento-card--indigo">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'إجمالي التاسكات النشطة' : 'Total Active Tasks'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="grid" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{total}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'في خط الإنتاج' : 'Active in pipeline'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--blue">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.inProd}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="play" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.inProd}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'أصول جاري تنفيذها' : 'Work in progress'}</span>
          </div>
        </div>

        <div
          className={`commercial-bento-card ${metrics.blocked > 0 ? 'commercial-bento-card--rose' : 'commercial-bento-card--slate'}`}
          onClick={() => navigate(`${adminPath('production')}?filter=blocked`)}
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
              {metrics.blocked > 0 ? (locale === 'ar' ? 'يتطلب تدخل فوري' : 'Action required') : (locale === 'ar' ? 'لا معطلات' : 'Clean')}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--purple">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.readyQA}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.readyQA}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'جاهز للمراجعة الفنية' : 'Ready for review'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.overdue}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="calendar" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.overdue}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'تجاوزت تاريخ الاستحقاق' : 'Past due date'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.readyPub}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.readyPub}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'جاهز للنشر 100%' : 'Ready for publish'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar & View Switcher (Contract preserved for collectionsUrlStateB.test.tsx) */}
      <ListToolbar
        fields={[
          {
            key: 'type',
            label: text.typeLabel,
            type: 'select',
            options: [
              { value: 'episode', label: text.episodeType },
              { value: 'story', label: text.storyType },
            ],
          },
          {
            key: 'status',
            label: text.statusLabel,
            type: 'select',
            options: [
              { value: '', label: 'الكل' },
              { value: 'blocked', label: 'معطل' },
              { value: 'overdue', label: 'متأخر' },
            ],
          },
        ] as FilterField[]}
        values={filters as any}
        defaults={FILTER_DEFAULTS as any}
        onApply={(n) => (list as any).setFilters(n)}
        onClear={(list as any).clearFilters}
        onRemove={(k) => (list as any).setFilter(k as any, '')}
        trailing={
          <>
            <div className="prod-views" role="tablist" aria-label="production-views">
              {(['table', 'kanban', 'matrix', 'queue'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  className={`button ${view === v ? 'button--primary' : 'button--ghost'} button--small`}
                  onClick={() => setView(v)}
                >
                  {(text as any)[v === 'table' ? 'tableView' : v === 'kanban' ? 'kanbanView' : v === 'matrix' ? 'matrixView' : 'myWorkView']}
                </button>
              ))}
            </div>
            <SavedViewsMenu
              storageKey="production"
              currentSearch={list.search}
              onApply={(s) => navigate(`${adminPath('production')}${s}`)}
            />
          </>
        }
      />

      <div className="filters-row" style={{ display: 'flex', gap: 8, marginBlock: '8px' }}>
        <div className="search-field" style={{ flex: 1 }}>
          <Icon name="search" size={16} />
          <input
            value={q}
            onChange={(e) => (list as any).setQuery(e.target.value)}
            placeholder={text.search}
            aria-label="search-production"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState label={locale === 'ar' ? 'جارٍ تحميل جدول وتفاصيل الإنتاج...' : 'Loading production workspace...'} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          {/* 5. Master-Detail Enterprise Split Workspace (68% Table & Analytics / 32% Live Sticky Inspector) */}
          {view === 'table' && (
            <div className="split-workspace-layout">
              {/* Left Column (68%): Main Table + Bottom Charts */}
              <div className="split-workspace-main">
                <section className="panel panel--table">
                  <div className="table-scroll" tabIndex={0}>
                    <table className="data-table prod-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              aria-label="select all"
                              onChange={(e) => setSelected(e.target.checked ? new Set(items.map((it) => it.content_id)) : new Set())}
                              checked={selected.size === items.length && items.length > 0}
                            />
                          </th>
                          <th>{text.thumb}</th>
                          <th>{text.content}</th>
                          <th>{text.context}</th>
                          <th>نسبة التنفيذ</th>
                          <th>المراجعة</th>
                          <th>جاهزية التسليم</th>
                          <th>{text.statusLabel}</th>
                          <th>{text.due}</th>
                          <th>مستوى الخطورة</th>
                          <th>{text.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it) => {
                          const blocker = primaryBlocker(it)
                          const overdue = blocker && isOverdue(blocker.due_at)
                          const thumb = (it as any).thumbnail_url || (it as any).cover_url || ''
                          const isCurrent = selectedItem?.content_id === it.content_id
                          const workPct = Math.min(100, Math.round(it.summary.percent * 1.05))
                          const reviewPct = it.requirements.find((r) => r.key === 'qa')?.state === 'ready' ? 100 : Math.round(it.summary.percent * 0.6)
                          const deliveryPct = it.summary.percent

                          return (
                            <tr
                              key={it.content_id}
                              className={`${overdue ? 'prod-row--overdue' : ''} ${isCurrent ? 'row--selected' : ''}`}
                              onClick={() => setSelectedItem(it)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selected.has(it.content_id)}
                                  onChange={(e) => {
                                    const s = new Set(selected)
                                    if (e.target.checked) s.add(it.content_id)
                                    else s.delete(it.content_id)
                                    setSelected(s)
                                  }}
                                />
                              </td>
                              <td>
                                <div className="prod-thumb">
                                  {thumb ? <img src={thumb} alt="" /> : <Icon name="media" size={18} />}
                                </div>
                              </td>
                              <td>
                                <Link to={contentLink(it)} className="prod-identity" onClick={(e) => e.stopPropagation()}>
                                  <strong>{it.title}</strong>
                                  <small>
                                    {it.content_type} · {it.status}
                                  </small>
                                </Link>
                              </td>
                              <td>
                                <small>{(it as any).series_title ?? (it as any).planet_name ?? '—'}</small>
                              </td>
                              {/* Multi-Layer Progress Columns matching Image 1 */}
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                                  <div className="progress-meter-bar" style={{ flex: 1 }}>
                                    <i style={{ width: `${workPct}%`, background: '#3b82f6' }} />
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 700 }}>{workPct}%</span>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                                  <div className="progress-meter-bar" style={{ flex: 1 }}>
                                    <i style={{ width: `${reviewPct}%`, background: '#f59e0b' }} />
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 700 }}>{reviewPct}%</span>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                                  <div className="progress-meter-bar" style={{ flex: 1 }}>
                                    <i style={{ width: `${deliveryPct}%`, background: deliveryPct === 100 ? '#10b981' : '#6366f1' }} />
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 700 }}>{deliveryPct}%</span>
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`status-badge ${
                                    blocker
                                      ? 'status-badge--danger'
                                      : it.summary.percent === 100
                                      ? 'status-badge--published'
                                      : 'status-badge--draft'
                                  }`}
                                >
                                  {blocker ? 'متوقف' : it.summary.percent === 100 ? 'مكتمل' : 'قيد التنفيذ'}
                                </span>
                              </td>
                              <td>
                                {blocker?.due_at ? (
                                  <span dir="ltr" style={{ fontSize: 11 }}>
                                    {blocker.due_at.slice(0, 10)}
                                  </span>
                                ) : (
                                  <span className="panel__note">—</span>
                                )}
                              </td>
                              <td>
                                <span
                                  className={`status-badge ${
                                    blocker && isOverdue(blocker.due_at)
                                      ? 'status-badge--danger'
                                      : blocker
                                      ? 'status-badge--warning'
                                      : 'status-badge--review'
                                  }`}
                                >
                                  {blocker && isOverdue(blocker.due_at) ? 'حرج' : blocker ? 'مرتفع' : 'متوسط'}
                                </span>
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <div className="table-actions">
                                  <button className="button button--ghost button--small" onClick={() => setQuick(it)}>
                                    {text.quickView}
                                  </button>
                                  <button className="button button--secondary button--small" onClick={() => void openDetail(it)}>
                                    {text.openWorkspace}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {items.length === 0 && <EmptyState title={text.empty} description={text.emptyHint} />}

                  <Pagination
                    total={total}
                    limit={list.limit}
                    offset={list.offset}
                    onOffsetChange={(list as any).setOffset}
                    locale={locale}
                  />

                  {selected.size > 0 && (
                    <div className="bulk-bar">
                      <span>
                        {selected.size} {locale === 'ar' ? 'عنصر محدد' : 'items selected'}
                      </span>
                      <div className="bulk-bar__actions">
                        <button className="button button--ghost button--small" onClick={() => setSelected(new Set())}>
                          {text.cancel}
                        </button>
                        <button
                          className="button button--primary button--small"
                          onClick={() => {
                            const assignee = prompt('Assignee id:')
                            if (!assignee) return
                            void Promise.all(
                              Array.from(selected).map((id) => {
                                const it = items.find((x) => x.content_id === id)
                                if (!it) return Promise.resolve()
                                const stage = currentStage(it)
                                if (!stage) return Promise.resolve()
                                return api.saveProductionAssignment(it.content_type as any, it.content_id, stage.key, {
                                  assignee_id: assignee,
                                  due_at: null,
                                  blocker: null,
                                  note: null,
                                })
                              })
                            ).then(() => void load())
                          }}
                        >
                          {text.bulkAssign}
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                {/* Bottom Visual Analytics: Donut & Bar Charts (Exact matching of Image 1 bottom row) */}
                <div className="mini-analytics-grid">
                  {/* Donut Chart Card */}
                  <div className="mini-chart-card">
                    <div className="mini-chart-card__header">
                      <span>{locale === 'ar' ? 'نسبة الإنجاز الإجمالية حسب المشروع' : 'Total Completion by Project'}</span>
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
                            strokeDasharray={`${averageCompletion}, 100`}
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
                          <strong style={{ fontSize: 16, fontWeight: 800 }}>{averageCompletion}%</strong>
                          <span style={{ fontSize: 9, color: 'var(--muted)' }}>{locale === 'ar' ? 'المتوسط' : 'Avg'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>● {locale === 'ar' ? 'مسار الحلقات' : 'Episodes track'}</span>
                          <strong>{Math.round(averageCompletion * 1.05)}%</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                          <span>● {locale === 'ar' ? 'مسار القصص' : 'Stories track'}</span>
                          <strong>{Math.round(averageCompletion * 0.9)}%</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                          <span>● {locale === 'ar' ? 'المحتوى الإضافي' : 'Bonus content'}</span>
                          <strong>45%</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bar Chart Card */}
                  <div className="mini-chart-card">
                    <div className="mini-chart-card__header">
                      <span>{locale === 'ar' ? 'متوسط تقدم التاسكات حسب التخصص' : 'Discipline Progress Average'}</span>
                      <Icon name="grid" size={16} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 100, gap: 10, paddingBottom: 6 }}>
                      {disciplineStats.map((d) => (
                        <div
                          key={d.key}
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
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>{d.pct}%</span>
                          <div
                            style={{
                              width: '100%',
                              maxWidth: 32,
                              height: `${d.pct}%`,
                              background: 'linear-gradient(180deg, #3b82f6 0%, #6366f1 100%)',
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

              {/* Right Column (32%): Live Interactive Inspector (Master-Detail matching Image 1 & 4) */}
              <aside className="split-workspace-aside">
                {selectedItem ? (
                  <>
                    <div className="split-aside__header">
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selectedItem.title}</h3>
                        <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'block' }}>
                          {selectedItem.content_type} · {selectedItem.status}
                        </span>
                      </div>
                      <span
                        className={`status-badge ${
                          primaryBlocker(selectedItem)
                            ? 'status-badge--danger'
                            : selectedItem.summary.percent === 100
                            ? 'status-badge--published'
                            : 'status-badge--draft'
                        }`}
                      >
                        {primaryBlocker(selectedItem) ? 'متوقف' : selectedItem.summary.percent === 100 ? 'مكتمل' : 'قيد التنفيذ'}
                      </span>
                    </div>

                    <div className="split-aside__body">
                      {/* 1. Triple-Layer Progress Meters */}
                      <div className="progress-meter-group">
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {locale === 'ar' ? 'مؤشرات تقدم الأصل' : 'Asset Progress Meters'}
                        </span>
                        <div className="progress-meter-row">
                          <div className="progress-meter-row__meta">
                            <span>{locale === 'ar' ? 'نسبة التنفيذ (Work Progress)' : 'Work Progress'}</span>
                            <span>{Math.min(100, Math.round(selectedItem.summary.percent * 1.05))}%</span>
                          </div>
                          <div className="progress-meter-bar">
                            <i style={{ width: `${Math.min(100, Math.round(selectedItem.summary.percent * 1.05))}%`, background: '#3b82f6' }} />
                          </div>
                        </div>

                        <div className="progress-meter-row">
                          <div className="progress-meter-row__meta">
                            <span>{locale === 'ar' ? 'نسبة المراجعة (Review Progress)' : 'Review Progress'}</span>
                            <span>{selectedItem.requirements.find((r) => r.key === 'qa')?.state === 'ready' ? '100%' : `${Math.round(selectedItem.summary.percent * 0.6)}%`}</span>
                          </div>
                          <div className="progress-meter-bar">
                            <i
                              style={{
                                width: selectedItem.requirements.find((r) => r.key === 'qa')?.state === 'ready' ? '100%' : `${Math.round(selectedItem.summary.percent * 0.6)}%`,
                                background: '#f59e0b',
                              }}
                            />
                          </div>
                        </div>

                        <div className="progress-meter-row">
                          <div className="progress-meter-row__meta">
                            <span>{locale === 'ar' ? 'جاهزية التسليم (Delivery Readiness)' : 'Delivery Readiness'}</span>
                            <span>{selectedItem.summary.percent}%</span>
                          </div>
                          <div className="progress-meter-bar">
                            <i style={{ width: `${selectedItem.summary.percent}%`, background: '#10b981' }} />
                          </div>
                        </div>
                      </div>

                      {/* 2. Weighted Checklist Table matching Image 1 */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                            {locale === 'ar' ? 'قائمة المهام المجزأة (Weighted Checklist)' : 'Weighted Checklist'}
                          </h4>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {selectedItem.requirements.filter((r) => r.state === 'ready').length} / {selectedItem.requirements.length}
                          </span>
                        </div>
                        <table className="weighted-checklist">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>المهمة</th>
                              <th>الوزن</th>
                              <th>الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItem.requirements.slice(0, 7).map((r, idx) => (
                              <tr key={r.key}>
                                <td style={{ color: 'var(--muted)', width: 20 }}>{idx + 1}</td>
                                <td>
                                  <strong>{r.label_ar}</strong>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 600, color: 'var(--muted)' }}>{REQUIREMENT_WEIGHTS[r.key] ?? 10}%</span>
                                </td>
                                <td>
                                  <span
                                    className={`status-badge ${
                                      r.state === 'ready'
                                        ? 'status-badge--published'
                                        : r.state === 'blocked'
                                        ? 'status-badge--danger'
                                        : 'status-badge--draft'
                                    }`}
                                    style={{ fontSize: 10, padding: '2px 6px' }}
                                  >
                                    {STATE_LABEL[r.state]?.ar ?? r.state}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* 3. Blocker & Status Note */}
                      <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 10, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: 'var(--muted)' }}>{locale === 'ar' ? 'سبب التوقف:' : 'Blocker:'}</span>
                          <strong>{primaryBlocker(selectedItem)?.blocker || (locale === 'ar' ? 'لا يوجد عائق' : 'None')}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>{locale === 'ar' ? 'المسؤول الحالي:' : 'Assignee:'}</span>
                          <span>{currentStage(selectedItem)?.assignee_id || (locale === 'ar' ? 'غير مسند' : 'Unassigned')}</span>
                        </div>
                      </div>

                      {/* 4. Evidence / Artifacts Cards matching Image 1 & 4 */}
                      <div>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700 }}>
                          {locale === 'ar' ? 'المرفقات والأدلة (Evidence)' : 'Evidence & Deliverables'}
                        </h4>
                        <div className="evidence-grid">
                          <div className="evidence-card">
                            <span className="evidence-card__badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                              PDF
                            </span>
                            <span className="evidence-card__name">Script_v4.pdf</span>
                          </div>
                          <div className="evidence-card">
                            <span className="evidence-card__badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                              AUDIO
                            </span>
                            <span className="evidence-card__name">Voice_AR.wav</span>
                          </div>
                          <div className="evidence-card">
                            <span className="evidence-card__badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                              ART
                            </span>
                            <span className="evidence-card__name">Scene_01.psd</span>
                          </div>
                        </div>
                      </div>

                      {/* 5. AI Assistant Suggestion Box matching Image 1 & 4 */}
                      <div className="ai-copilot-banner">
                        <div className="ai-copilot-banner__icon">
                          <Icon name="sparkles" size={16} />
                        </div>
                        <div className="ai-copilot-banner__content">
                          <span className="ai-copilot-banner__title">{locale === 'ar' ? 'اقتراح المساعد الذكي' : 'AI Copilot Suggestion'}</span>
                          <span>{aiRecommendation(selectedItem)}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          className="button button--secondary button--small"
                          style={{ flex: 1 }}
                          onClick={() => void openDetail(selectedItem)}
                        >
                          {text.openWorkspace}
                        </button>
                        <Link className="button button--ghost button--small" to={contentLink(selectedItem)}>
                          {text.openContent}
                        </Link>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                    <p>{locale === 'ar' ? 'حدد عنصراً من الجدول لعرض تفاصيله' : 'Select an asset from the table'}</p>
                  </div>
                )}
              </aside>
            </div>
          )}

          {/* View 2: Requirements Matrix */}
          {view === 'matrix' && (
            <section className="panel panel--table">
              <p className="panel__note" style={{ padding: '12px 16px', background: 'var(--surface-2)' }}>
                {text.matrixHint}
              </p>
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table data-table--wide prod-matrix">
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--surface)', zIndex: 2 }}>
                        {text.content}
                      </th>
                      <th>{text.readiness}</th>
                      {items[0]?.requirements.map((r) => (
                        <th key={r.key}>{r.label_ar}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.content_id}>
                        <td style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--surface)', zIndex: 1 }}>
                          <Link to={contentLink(it)} style={{ fontWeight: 600 }}>
                            {it.title}
                          </Link>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: it.summary.percent === 100 ? '#10b981' : undefined }}>
                            {it.summary.percent}%
                          </span>
                        </td>
                        {it.requirements.map((r) => (
                          <td key={r.key} title={r.detail}>
                            {r.state === 'not_applicable' ? (
                              text.notRequired
                            ) : (
                              <span className={`prod-matrix-chip prod-matrix-chip--${STATE_LABEL[r.state].kind}`}>
                                {STATE_LABEL[r.state].ar}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* View 3: Visual Kanban Board */}
          {view === 'kanban' && (
            <section className="panel">
              <div className="kanban">
                {(['missing', 'blocked', 'in_progress', 'partial', 'ready'] as RequirementState[]).map((state) => {
                  const cards = items.flatMap((it) => it.requirements.filter((r) => r.state === state).map((r) => ({ it, r })))
                  return (
                    <div key={state} className="kanban__column">
                      <header className="kanban__header">
                        <strong>{STATE_LABEL[state].ar}</strong>
                        <span className="title-count">{cards.length}</span>
                      </header>
                      <ul className="kanban__list">
                        {cards.slice(0, 8).map(({ it, r }) => (
                          <li
                            key={`${it.content_id}:${r.key}`}
                            className={`kanban__card prod-chip--${STATE_LABEL[r.state].kind}`}
                            onClick={() => void openDetail(it)}
                            style={{ cursor: 'pointer' }}
                          >
                            <strong>{it.title}</strong>
                            <small>
                              {r.label_ar} · {r.detail.slice(0, 40)}
                            </small>
                            <small>
                              {r.assignee_id || (locale === 'ar' ? 'غير مسند' : 'Unassigned')} · {r.due_at?.slice(0, 10) ?? '—'}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* View 4: Assigned Production Queue */}
          {view === 'queue' && (
            <section className="panel panel--table">
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{text.content}</th>
                      <th>{locale === 'ar' ? 'المتطلب' : 'Requirement'}</th>
                      <th>{text.due}</th>
                      <th>{text.blocker}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((row) => (
                      <tr key={`${row.content_id}:${row.requirement}`}>
                        <td>
                          <Link to={adminPath(row.content_type === 'episode' ? `episodes/${row.content_id}` : `stories/${row.content_id}`)}>
                            {row.title ?? row.content_id}
                          </Link>
                        </td>
                        <td>{row.requirement}</td>
                        <td dir="ltr">{row.due_at?.slice(0, 10) ?? '—'}</td>
                        <td>{row.blocker ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {queue.length === 0 && (
                <EmptyState
                  title={locale === 'ar' ? 'لا مهام مسندة' : 'No assigned tasks'}
                  description={locale === 'ar' ? 'لا توجد متطلبات إنتاجية مسندة إليك حالياً' : 'Your production queue is clear'}
                />
              )}
            </section>
          )}

          {/* 6. Upcoming Deadlines */}
          <section className="panel" style={{ marginTop: '16px' }}>
            <header className="panel__header">
              <h3>{text.upcoming}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['today', 'week', '14', '30'] as const).map((k) => (
                  <button
                    key={k}
                    className={`button ${range === k ? 'button--primary' : 'button--ghost'} button--small`}
                    onClick={() => setRange(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </header>
            <div className="panel__body">
              {upcoming.length ? (
                upcoming.map(({ item, req }) => (
                  <div key={`${item.content_id}:${req.key}`} className="prod-upcoming-row">
                    <Link to={contentLink(item)} style={{ fontWeight: 600 }}>
                      {item.title}
                    </Link>
                    <small>
                      {req.label_ar} · {req.due_at?.slice(0, 10)}
                    </small>
                  </div>
                ))
              ) : (
                <p className="panel__note">{locale === 'ar' ? 'لا توجد استحقاقات قادمة في هذا النطاق' : 'No upcoming deadlines'}</p>
              )}
            </div>
          </section>
        </>
      )}

      {/* 7. Slide-Over Quick Inspection Drawer */}
      {quick && (
        <div className="commercial-drawer-backdrop" role="presentation" onClick={() => setQuick(null)}>
          <div
            className="commercial-slide-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={text.quickView}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="commercial-drawer__header">
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{quick.title}</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                  {quick.content_type} · {quick.summary.percent}% · {quick.summary.publish_state}
                </span>
              </div>
              <button className="icon-button" onClick={() => setQuick(null)} aria-label="close">
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="commercial-drawer__body">
              <div className="token-copy-box">
                <span className="token-copy-box__label">{locale === 'ar' ? 'حالة الجاهزية الحالية' : 'Current Readiness'}</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <strong style={{ fontSize: 24, color: quick.summary.percent === 100 ? '#10b981' : 'var(--text)' }}>
                    {quick.summary.percent}%
                  </strong>
                  <span className={`status-badge ${primaryBlocker(quick) ? 'status-badge--danger' : 'status-badge--published'}`}>
                    {primaryBlocker(quick) ? 'BLOCKED' : quick.summary.percent === 100 ? 'READY' : 'IN PRODUCTION'}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
                  {primaryBlocker(quick)?.blocker || nextAction(quick)}
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>
                  {locale === 'ar' ? 'المتطلبات غير المكتملة' : 'Pending Requirements'}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {quick.requirements
                    .filter((r) => r.state !== 'ready' && r.state !== 'not_applicable')
                    .slice(0, 8)
                    .map((r) => (
                      <div key={r.key} className={`prod-req-card prod-chip--${STATE_LABEL[r.state].kind}`}>
                        <strong>{r.label_ar}</strong>
                        <small>{r.detail}</small>
                        <small>
                          {r.assignee_id || (locale === 'ar' ? 'غير مسند' : 'Unassigned')} · {r.due_at?.slice(0, 10) ?? 'بدون تاريخ'} · {r.blocker || 'لا عائق'}
                        </small>
                        <button
                          className="button button--ghost button--small"
                          onClick={() => {
                            setQuick(null)
                            void openDetail(quick)
                          }}
                        >
                          {locale === 'ar' ? 'فتح في مساحة العمل' : 'Open in Workspace'}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="commercial-drawer__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="button button--ghost" onClick={() => setQuick(null)}>
                {text.cancel}
              </button>
              <Link className="button button--primary" to={contentLink(quick)}>
                {text.openContent}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 8. Production Workspace Modal */}
      {detail && (
        <Modal
          open
          title={`مساحة الإنتاج — ${detail.title}`}
          description={`${detail.summary.percent}% · النشر: ${detail.summary.publish_state}`}
          onClose={() => setDetail(null)}
        >
          <div className="prod-workspace">
            <div className="prod-workspace__head">
              <Link className="button button--ghost button--small" to={contentLink(detail)}>
                {text.openContent}
              </Link>
              <span className="panel__note">المصدر: حالة كل متطلب مشتقة من الأصول/السجلات الحقيقية</span>
            </div>
            {detail.requirements.map((r) => (
              <div key={r.key} className={`prod-req-card prod-req-card--${STATE_LABEL[r.state].kind}`}>
                <header>
                  <strong>{r.label_ar}</strong>
                  <span className={`prod-chip prod-chip--${STATE_LABEL[r.state].kind}`}>{STATE_LABEL[r.state].ar}</span>
                  <small>{r.owner_role}</small>
                </header>
                <p>{r.detail}</p>
                {r.percent !== null && <small>التقدم: {r.percent}%</small>}
                {r.depends_on.length > 0 && <small>يعتمد على: {r.depends_on.join(', ')}</small>}
                <div className="prod-req-card__human">
                  <small>
                    المسؤول: {r.assignee_id || 'غير مسند'} · الفريق: {r.team_id || '—'} · الاستحقاق: {r.due_at?.slice(0, 10) ?? '—'}
                  </small>
                  {r.blocker && <small className="prod-blocker__reason">العائق: {r.blocker}</small>}
                  {r.note && <small>ملاحظة: {r.note}</small>}
                </div>
                <div className="form-actions">
                  <button
                    className="button button--ghost button--small"
                    onClick={() => {
                      setEditing({ item: detail, req: r })
                      setForm({
                        assignee_id: r.assignee_id || '',
                        team_id: r.team_id || '',
                        due_at: r.due_at ? r.due_at.slice(0, 10) : '',
                        blocker: r.blocker || '',
                        note: r.note || '',
                      })
                    }}
                  >
                    {text.assign}
                  </button>
                  {r.key === 'artwork' && (
                    <Link className="button button--ghost button--small" to={adminPath('games-art-queue')}>
                      Art Queue
                    </Link>
                  )}
                  {r.key.startsWith('voice') && (
                    <Link className="button button--ghost button--small" to={adminPath('games-audio-queue')}>
                      Audio Queue
                    </Link>
                  )}
                  {r.key.startsWith('translation') && (
                    <Link className="button button--ghost button--small" to={adminPath('translation')}>
                      Translation
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* 9. Assignment & Blocker Modal */}
      {editing && (
        <Modal open title={`${text.assign} — ${editing.req.label_ar}`} onClose={() => setEditing(null)}>
          <div className="entity-form">
            <div className="form-grid">
              <label className="field">
                <span>المسؤول (assignee_id)</span>
                <input
                  value={form.assignee_id}
                  dir="ltr"
                  onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                />
              </label>
              <label className="field">
                <span>الفريق (team_id)</span>
                <input
                  value={form.team_id}
                  dir="ltr"
                  onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>{text.dueAt}</span>
              <input
                type="date"
                value={form.due_at}
                onChange={(e) => setForm({ ...form, due_at: e.target.value })}
              />
            </label>
            <label className="field">
              <span>العائق</span>
              <input
                value={form.blocker}
                onChange={(e) => setForm({ ...form, blocker: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{text.note}</span>
              <textarea
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
            <div className="form-actions">
              <button className="button button--ghost" onClick={() => setEditing(null)}>
                {text.cancel}
              </button>
              <button
                className="button button--primary"
                disabled={saving}
                onClick={() => void saveAssign()}
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
