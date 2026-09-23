import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { EmptyState, LoadingState } from '../components/PageState'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
import type { PublishGateResult, PublishSweepReport, PublishSweepStatus } from '../types/api'

type GateFinding = PublishGateResult['findings'][number]
type Verdict = 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED' | 'NOT_EVALUATED'
type EntityType = 'series' | 'story' | 'book' | 'game' | 'project' | 'episode'

const ENTITY_TYPES: EntityType[] = ['series', 'story', 'book', 'game', 'project', 'episode']
const entityLabels: Record<'ar' | 'en', Record<EntityType, string>> = {
  ar: { series: 'سلسلة', story: 'قصة', book: 'كتاب', game: 'لعبة', project: 'مشروع', episode: 'حلقة' },
  en: { series: 'Series', story: 'Story', book: 'Book', game: 'Game', project: 'Project', episode: 'Episode' },
}

const QUALITY_FILTER_DEFAULTS = { type: '', id: '', verdict: '', blocker: '', planet: '' }
const FINDING_GROUPS = ['CONTENT', 'PRODUCTION', 'LOCALIZATION', 'MEDIA', 'AUDIO', 'REVIEWS', 'WORKFLOW', 'RIGHTS', 'SAFETY', 'PUBLISHING'] as const
type FindingGroup = (typeof FINDING_GROUPS)[number]

function findingGroup(finding: GateFinding): FindingGroup {
  const id = finding.id.toLowerCase()
  if (id.includes('workflow')) return 'WORKFLOW'
  if (id.includes('right') || id.includes('license')) return 'RIGHTS'
  if (id.includes('safety') || id.includes('age_gate') || id.includes('child')) return 'SAFETY'
  if (id.includes('translation') || id.includes('localization') || id.includes('language')) return 'LOCALIZATION'
  if (id.includes('audio') || id.includes('voice') || id.includes('narration')) return 'AUDIO'
  if (id.includes('review') || id.includes('approval')) return 'REVIEWS'
  if (id.includes('video') || id.includes('artwork') || id.includes('production')) return 'PRODUCTION'
  if (id.includes('image') || id.includes('asset') || id.includes('media') || id.includes('thumbnail')) return 'MEDIA'
  if (id.includes('page') || id.includes('cover') || id.includes('episode') || id.includes('content')) return 'CONTENT'
  return 'PUBLISHING'
}

const copy = {
  ar: {
    eyebrow: 'بوابات الجودة والاعتماد',
    title: 'مركز فحص الجاهزية وبوابة النشر',
    lede: 'نفس البوابة البرمجية الصارمة التي تفحص الأصول قبل النشر الفعلي — تكشف كل العوائق والتحذيرات دفعة واحدة مع المسؤول والإجراء المطلوب.',
    beaconActive: 'بوابة النشر وفحص الجاهزية نشطة',
    beaconSub: 'تزامن صارم مع قواعد الحظر والأصول المعطلة',
    metrics: {
      ready: 'جاهز للنشر',
      blocked: 'محجوب بقرارات',
      warnings: 'تحذيرات فقط',
      notEval: 'لم يُفحص',
      changed: 'تغيّر بعد الفحص',
    },
    search: 'بحث بالعنوان...',
    type: 'النوع',
    id: 'المعرّف',
    verdict: 'الحكم',
    blockerType: 'نوع العائق',
    planet: 'الكوكب',
    series: 'السلسلة',
    all: 'الكل',
    ready: 'جاهز',
    blocked: 'محجوب',
    warnings: 'تحذيرات',
    notEval: 'لم يُفحص',
    content: 'المحتوى والسياق',
    context: 'السياق',
    readiness: 'الجاهزية',
    blockers: 'العوائق',
    warningsCol: 'التحذيرات',
    lastCheck: 'آخر فحص',
    changed: 'التغيّر',
    owner: 'المسؤول',
    scheduled: 'مجدول',
    actions: 'إجراءات',
    openReadiness: 'افتح الجاهزية',
    openContent: 'افتح المحتوى',
    recheck: 'إعادة الفحص',
    check: 'فحص',
    finding: 'الفحص',
    severity: 'الحدة',
    detail: 'التفصيل',
    ownerLabel: 'المسؤول',
    actionLabel: 'الإجراء',
    deepLink: 'رابط مباشر',
    passed: 'ناجح',
    warning: 'تحذير',
    blockedLabel: 'محجوب',
    notApplicable: 'غير مطلوب',
    groups: {
      CONTENT: 'المحتوى',
      PRODUCTION: 'الإنتاج',
      LOCALIZATION: 'الترجمة',
      MEDIA: 'الوسائط',
      AUDIO: 'الصوت',
      REVIEWS: 'المراجعات',
      WORKFLOW: 'سير العمل',
      RIGHTS: 'الحقوق',
      SAFETY: 'السلامة',
      PUBLISHING: 'النشر',
    },
    lastEvaluated: 'آخر تقييم',
    scheduledPublish: 'النشر المجدول',
    publishNow: 'انشر الآن',
    history: 'السجل',
    showPassed: 'إظهار الفحوصات الناجحة',
    batch: 'فحص عينة دفعية',
    batchResult: 'نتيجة الفحص الدفعي',
    exportReport: 'تصدير تقرير الجاهزية (JSON)',
    sweep: {
      title: 'مسح البوابة على دفعة كاملة (Sweep)',
      ledePublished:
        'البوابة تعمل لحظةَ النشر ولا تُعاد. هذا الفحص يُعيد تقييمها على كل صفّ منشور، فيُظهر ما فُصل أصله بعد نشره أو ما نُشر قبل وجود فحصٍ ما.',
      ledePending:
        'ما ينتظر النشر، وما ينقص كلَّ واحدٍ منه بالاسم. هذا طابور المحرِّر للتدخل وحل النواقص.',
      statusLabel: 'حالة الدفعة',
      statusPublished: 'منشور (Live)',
      statusReady: 'جاهز (Ready)',
      statusScheduled: 'مجدول (Scheduled)',
      statusReview: 'قيد المراجعة (In Review)',
      check: 'افحص الدفعة الآن',
      checking: 'جارٍ الفحص…',
      entity: 'العنصر',
      blockers: 'ما يحجبه',
      clean: (n: number, s: string) =>
        s === 'published'
          ? `لا انحراف: ${n} صفًّا منشورًا فُحص وكلّها تمرّ البوابة اليوم بنجاح.`
          : `${n} صفًّا فُحص ولا شيء يحجبها — كلّها قابلة للنشر الآن.`,
      found: (n: number, s: string) =>
        s === 'published'
          ? `${n} صفًّا منشورًا يفشل البوابة اليوم.`
          : `${n} صفًّا لا يمكن نشره قبل معالجة ما يحجبه.`,
      unavailable: (n: number) => `${n} صفًّا تعذّر تقييمه — غير معروف، لا سليم.`,
      warnings: 'تحذيرات',
      warned: (n: number) => `${n} صفًّا يمرّ البوابة ويحمل تحذيرًا (مثل مراجعة معلّقة لم تُعتمد)`,
      more: (n: number) => `و${n} موضعًا آخر`,
      failed: 'تعذّر مسح البوابة',
    },
    noData: 'لا توجد بيانات مطابقة',
    selectContent: 'اختر محتوى للفحص أو ابحث بمعرّف الأصل.',
    gateNote: 'هذه هي بوابة النشر نفسها المطبقة في الخادم — لا توجد قواعد موازية أو مزيفة.',
    publishing: 'يُنشر الآن…',
    publishDone: 'تم النشر بنجاح ✓',
    publishFailed: 'تعذّر النشر',
    publishBlocked: 'النشر محجوب',
    publishUnsupported: 'هذا النوع لا يُنشر من هنا',
  },
  en: {
    eyebrow: 'Quality Gates & Readiness',
    title: 'Publish Readiness & Quality Center',
    lede: 'The exact server-side gate executed prior to publishing — reveals every blocker and warning at once with clear ownership and corrective actions.',
    beaconActive: 'Publish Gate Engine Live',
    beaconSub: 'Strict adherence to publish blockers and integrity rules',
    metrics: {
      ready: 'Ready to publish',
      blocked: 'Blocked by gate',
      warnings: 'Warnings only',
      notEval: 'Not evaluated',
      changed: 'Changed since check',
    },
    search: 'Search by title...',
    type: 'Type',
    id: 'ID',
    verdict: 'Verdict',
    blockerType: 'Blocker type',
    planet: 'Planet',
    series: 'Series',
    all: 'All',
    ready: 'Ready',
    blocked: 'Blocked',
    warnings: 'Warnings',
    notEval: 'Not evaluated',
    content: 'Content & Context',
    context: 'Context',
    readiness: 'Readiness',
    blockers: 'Blockers',
    warningsCol: 'Warnings',
    lastCheck: 'Last check',
    changed: 'Changed',
    owner: 'Owner',
    scheduled: 'Scheduled',
    actions: 'Actions',
    openReadiness: 'Open readiness',
    openContent: 'Open content',
    recheck: 'Re-check',
    check: 'Check',
    finding: 'Check',
    severity: 'Severity',
    detail: 'Detail',
    ownerLabel: 'Owner',
    actionLabel: 'Action',
    deepLink: 'Deep link',
    passed: 'Passed',
    warning: 'Warning',
    blockedLabel: 'Blocked',
    notApplicable: 'Not applicable',
    groups: {
      CONTENT: 'Content',
      PRODUCTION: 'Production',
      LOCALIZATION: 'Localization',
      MEDIA: 'Media',
      AUDIO: 'Audio',
      REVIEWS: 'Reviews',
      WORKFLOW: 'Workflow',
      RIGHTS: 'Rights',
      SAFETY: 'Safety',
      PUBLISHING: 'Publishing',
    },
    lastEvaluated: 'Last evaluated',
    scheduledPublish: 'Scheduled publish',
    publishNow: 'Publish now',
    history: 'History',
    showPassed: 'Show passed',
    batch: 'Batch check sample',
    batchResult: 'Batch result',
    exportReport: 'Export readiness report (JSON)',
    sweep: {
      title: 'Sweep the gate over a batch',
      ledePublished:
        'The gate runs when something is published and never again. This re-runs it over every published row, revealing unlinked assets or regressions.',
      ledePending:
        'What is waiting to be published, and what each one is missing by name. This is the editor queue to fix bottlenecks.',
      statusLabel: 'Batch status',
      statusPublished: 'Published',
      statusReady: 'Ready',
      statusScheduled: 'Scheduled',
      statusReview: 'In review',
      check: 'Sweep batch now',
      checking: 'Checking…',
      entity: 'Item',
      blockers: 'Blocked by',
      clean: (n: number, s: string) =>
        s === 'published'
          ? `No drift: ${n} published row(s) checked, all pass the gate today.`
          : `${n} row(s) checked and nothing blocks them — all publishable now.`,
      found: (n: number, s: string) =>
        s === 'published'
          ? `${n} published row(s) fail the gate today.`
          : `${n} row(s) cannot be published until their blockers are cleared.`,
      unavailable: (n: number) => `${n} row(s) could not be evaluated — unknown, not clean.`,
      warnings: 'Warnings',
      warned: (n: number) => `${n} row(s) pass the gate carrying a warning (such as a review still pending)`,
      more: (n: number) => `and ${n} more`,
      failed: 'Could not sweep the gate',
    },
    noData: 'No data found',
    selectContent: 'Select content to check or search by ID.',
    gateNote: 'This is the publish gate itself — no parallel or artificial rules.',
    publishing: 'Publishing…',
    publishDone: 'Published ✓',
    publishFailed: 'Publish failed',
    publishBlocked: 'Publish blocked',
    publishUnsupported: 'This type cannot be published here',
  },
}

function qualityFilterFields(text: typeof copy.ar, locale: 'ar' | 'en'): FilterField[] {
  return [
    {
      key: 'type',
      label: text.type,
      type: 'select',
      options: [{ value: '', label: text.all }, ...ENTITY_TYPES.map((type) => ({ value: type, label: entityLabels[locale][type] }))],
    },
    { key: 'id', label: text.id, type: 'text' },
    {
      key: 'verdict',
      label: text.verdict,
      type: 'select',
      advanced: true,
      options: [
        { value: '', label: text.all },
        { value: 'READY', label: text.ready },
        { value: 'BLOCKED', label: text.blocked },
        { value: 'READY_WITH_WARNINGS', label: text.warnings },
        { value: 'NOT_EVALUATED', label: text.notEval },
      ],
    },
  ]
}

function verdictOf(result: PublishGateResult | null): Verdict {
  if (!result) return 'NOT_EVALUATED'
  if (result.blockers.length > 0) return 'BLOCKED'
  if (result.warnings.length > 0) return 'READY_WITH_WARNINGS'
  return 'READY'
}

type ListItem = {
  type: EntityType
  id: string
  title: string
  planet?: string
  series?: string
  thumb?: string | null
  result: PublishGateResult | null
  checkedAt: string
}

export function QualityPage() {
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const url = useUrlListState(QUALITY_FILTER_DEFAULTS, { limit: 20 })
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishNote, setPublishNote] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<PublishGateResult | null>(null)
  const [workspaceMeta, setWorkspaceMeta] = useState<{ title: string; type: EntityType; id: string; checkedAt: string } | null>(null)
  const [showPassed, setShowPassed] = useState(false)
  const [history, setHistory] = useState<PublishGateResult[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchSummary, setBatchSummary] = useState<{ ready: number; blocked: number; warnings: number } | null>(null)
  const [error, setError] = useState('')

  const [sweepStatus, setSweepStatus] = useState<PublishSweepStatus>('published')
  const [sweep, setSweep] = useState<PublishSweepReport | null>(null)
  const [sweepLoading, setSweepLoading] = useState(false)
  const [sweepError, setSweepError] = useState('')

  const loadSweep = useCallback(
    async (status: PublishSweepStatus) => {
      setSweepLoading(true)
      setSweepError('')
      try {
        const r = await api.publishSweep({ status, limit: 100 })
        setSweep(r.data)
      } catch (e) {
        setSweepError(e instanceof Error ? e.message : text.sweep.failed)
        setSweep(null)
      } finally {
        setSweepLoading(false)
      }
    },
    [text.sweep.failed]
  )

  const loadList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [seriesRes, storiesRes, episodesRes, booksRes, gamesRes, projectsRes] = await Promise.all([
        api.series({ limit: 8 } as any).catch(() => ({ data: [] } as any)),
        api.stories({ limit: 8 } as any).catch(() => ({ data: [] } as any)),
        api.episodes({ limit: 8 } as any).catch(() => ({ data: [] } as any)),
        api.books({ limit: 8 } as any).catch(() => ({ data: [] } as any)),
        api.games({ limit: 8 } as any).catch(() => ({ data: [] } as any)),
        api.projects({ limit: 8 } as any).catch(() => ({ data: [] } as any)),
      ])
      const candidates: Array<{ type: EntityType; id: string; title: string; planet?: string; series?: string; thumb?: string | null }> = []
      for (const s of (seriesRes.data || []).slice(0, 6)) candidates.push({ type: 'series', id: (s as any).id, title: (s as any).title_ar, thumb: (s as any).cover_url })
      for (const s of (storiesRes as any).data?.slice(0, 6) || []) candidates.push({ type: 'story', id: s.id, title: s.title_ar, thumb: s.cover_asset_id ? 'cover' : null, series: s.series_title })
      for (const e of (episodesRes as any).data?.slice(0, 6) || []) candidates.push({ type: 'episode', id: e.id, title: e.title_ar, thumb: e.thumbnail_url })
      for (const b of (booksRes as any).data?.slice(0, 4) || []) candidates.push({ type: 'book', id: b.id, title: b.title_ar })
      for (const g of (gamesRes as any).data?.slice(0, 4) || []) candidates.push({ type: 'game', id: g.id, title: g.title_ar })
      for (const p of (projectsRes as any).data?.slice(0, 4) || []) candidates.push({ type: 'project', id: p.id, title: p.title_ar })

      const results = await Promise.all(
        candidates.map(async (c) => {
          try {
            const r = await api.publishReadiness(c.type as any, c.id)
            return { ...c, result: r.data as PublishGateResult, checkedAt: new Date().toISOString() } as ListItem
          } catch {
            return { ...c, result: null, checkedAt: new Date().toISOString() } as ListItem
          }
        })
      )
      setItems(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }, [])

  const directId = url.filters.id.trim()
  const directType = (url.filters.type || 'story') as EntityType
  const filterFields = useMemo(() => qualityFilterFields(text, locale as 'ar' | 'en'), [locale, text])

  useEffect(() => {
    if (!directId) void loadList()
  }, [directId, loadList])

  useEffect(() => {
    if (!directId) {
      setWorkspace(null)
      setWorkspaceMeta(null)
      return
    }

    let active = true
    const checkedAt = new Date().toISOString()
    setLoading(true)
    setError('')
    void api
      .publishReadiness(directType, directId)
      .then((response) => {
        if (!active) return
        const result = response.data as PublishGateResult
        setWorkspace(result)
        setWorkspaceMeta({ title: directId, type: directType, id: directId, checkedAt })
        setHistory((current) => [result, ...current].slice(0, 5))
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : locale === 'ar' ? 'تعذر التحميل' : 'Unable to load')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [directId, directType, locale])

  const filtered = useMemo(() => {
    let result = [...items]
    const query = url.query.trim().toLowerCase()
    if (query) result = result.filter((item) => item.title.toLowerCase().includes(query))
    if (url.filters.type) result = result.filter((item) => item.type === url.filters.type)
    if (url.filters.verdict) result = result.filter((item) => verdictOf(item.result) === url.filters.verdict)
    if (url.filters.blocker) result = result.filter((item) => item.result?.blockers.some((blocker) => blocker.id === url.filters.blocker))
    return result
  }, [items, url.filters.blocker, url.filters.type, url.filters.verdict, url.query])

  const pageItems = useMemo(() => filtered.slice(url.offset, url.offset + url.limit), [filtered, url.limit, url.offset])

  const metrics = useMemo(() => {
    let ready = 0,
      blocked = 0,
      warnings = 0,
      notEval = 0
    for (const i of items) {
      const v = verdictOf(i.result)
      if (v === 'READY') ready++
      else if (v === 'BLOCKED') blocked++
      else if (v === 'READY_WITH_WARNINGS') warnings++
      else notEval++
    }
    return { ready, blocked, warnings, notEval, changed: 0 }
  }, [items])

  const openWorkspace = async (it: ListItem) => {
    try {
      const r = await api.publishReadiness(it.type as any, it.id)
      setWorkspace(r.data as any)
      setWorkspaceMeta({ title: it.title, type: it.type, id: it.id, checkedAt: new Date().toISOString() })
      setHistory((h) => [r.data as any, ...h].slice(0, 5))
    } catch {}
  }

  const runBatch = async () => {
    setBatchRunning(true)
    const subset = filtered.slice(0, 10)
    let ready = 0,
      blocked = 0,
      warnings = 0
    for (const it of subset) {
      const v = verdictOf(it.result)
      if (v === 'READY') ready++
      else if (v === 'BLOCKED') blocked++
      else if (v === 'READY_WITH_WARNINGS') warnings++
    }
    setBatchSummary({ ready, blocked, warnings })
    setBatchRunning(false)
  }

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

          <div className="filter-pill-group" role="group" aria-label="quality-quick-filters">
            <button
              type="button"
              className={`filter-pill ${url.filters.verdict === '' ? 'filter-pill--active' : ''}`}
              onClick={() => url.setFilter('verdict', '')}
            >
              <span>{text.all}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${url.filters.verdict === 'READY' ? 'filter-pill--active' : ''}`}
              onClick={() => url.setFilter('verdict', 'READY')}
            >
              <Icon name="check" size={13} />
              <span>{text.ready}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${url.filters.verdict === 'BLOCKED' ? 'filter-pill--active' : ''}`}
              onClick={() => url.setFilter('verdict', 'BLOCKED')}
            >
              <Icon name="alert-triangle" size={13} />
              <span>{text.blocked}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${url.filters.verdict === 'READY_WITH_WARNINGS' ? 'filter-pill--active' : ''}`}
              onClick={() => url.setFilter('verdict', 'READY_WITH_WARNINGS')}
            >
              <Icon name="clock" size={13} />
              <span>{text.warnings}</span>
            </button>
          </div>
        </div>

        <div className="commercial-command-strip__right">
          {!directId && (
            <>
              <button className="button button--secondary button--small" onClick={() => void loadList()}>
                <Icon name="refresh" size={14} />
                <span>{text.recheck}</span>
              </button>
              <button className="button button--primary button--small" onClick={runBatch} disabled={batchRunning}>
                <Icon name="grid" size={14} />
                <span>{text.batch}</span>
              </button>
            </>
          )}
        </div>
      </section>

      {/* 2. Executive Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.28) 0%, rgba(59, 130, 246, 0.16) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" />
              {text.gateNote}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Bento Grid Matrix */}
      {!directId && (
        <div className="commercial-bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div
            className="commercial-bento-card commercial-bento-card--emerald"
            onClick={() => url.setFilter('verdict', 'READY')}
            style={{ cursor: 'pointer' }}
          >
            <div className="commercial-bento-card__header">
              <span className="commercial-bento-card__title">{text.metrics.ready}</span>
              <div className="commercial-bento-card__icon">
                <Icon name="check" size={18} />
              </div>
            </div>
            <div className="commercial-bento-card__metric">{metrics.ready}</div>
            <div className="commercial-bento-card__footer">
              <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
                {locale === 'ar' ? 'تمر البوابة بلا عوائق' : 'Clean publish gate'}
              </span>
            </div>
          </div>

          <div
            className={`commercial-bento-card ${metrics.blocked > 0 ? 'commercial-bento-card--rose' : 'commercial-bento-card--slate'}`}
            onClick={() => url.setFilter('verdict', 'BLOCKED')}
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
                {metrics.blocked > 0 ? (locale === 'ar' ? 'يمنع النشر' : 'Publish blocked') : (locale === 'ar' ? 'لا عوائق' : 'Clean')}
              </span>
            </div>
          </div>

          <div
            className="commercial-bento-card commercial-bento-card--amber"
            onClick={() => url.setFilter('verdict', 'READY_WITH_WARNINGS')}
            style={{ cursor: 'pointer' }}
          >
            <div className="commercial-bento-card__header">
              <span className="commercial-bento-card__title">{text.metrics.warnings}</span>
              <div className="commercial-bento-card__icon">
                <Icon name="clock" size={18} />
              </div>
            </div>
            <div className="commercial-bento-card__metric">{metrics.warnings}</div>
            <div className="commercial-bento-card__footer">
              <span className="commercial-bento-card__trend">{locale === 'ar' ? 'يمر مع ملاحظات' : 'Passes with warnings'}</span>
            </div>
          </div>

          <div
            className="commercial-bento-card commercial-bento-card--slate"
            onClick={() => url.setFilter('verdict', 'NOT_EVALUATED')}
            style={{ cursor: 'pointer' }}
          >
            <div className="commercial-bento-card__header">
              <span className="commercial-bento-card__title">{text.metrics.notEval}</span>
              <div className="commercial-bento-card__icon">
                <Icon name="layers" size={18} />
              </div>
            </div>
            <div className="commercial-bento-card__metric">{metrics.notEval}</div>
            <div className="commercial-bento-card__footer">
              <span className="commercial-bento-card__trend">{locale === 'ar' ? 'بانتظار فحص البوابة' : 'Not yet evaluated'}</span>
            </div>
          </div>
        </div>
      )}

      {error && <div className="inline-alert inline-alert--error">{error}</div>}

      {!directId && batchSummary && (
        <div className="inline-alert inline-alert--info" style={{ margin: '12px 0' }}>
          {text.batchResult}: {batchSummary.ready} {text.metrics.ready} · {batchSummary.blocked} محجوب · {batchSummary.warnings} تحذيرات
        </div>
      )}

      {/* 4. Batch Sweep Inspection Section */}
      {!directId && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel__header">
            <h3>{text.sweep.title}</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                <span>{text.sweep.statusLabel}</span>
                <select
                  value={sweepStatus}
                  onChange={(e) => {
                    const s = e.target.value as PublishSweepStatus
                    setSweepStatus(s)
                    setSweep(null)
                    setSweepError('')
                  }}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--cs-glass-border)',
                    color: 'var(--text)',
                    borderRadius: 6,
                    padding: '4px 8px',
                  }}
                >
                  <option value="published">{text.sweep.statusPublished}</option>
                  <option value="ready">{text.sweep.statusReady}</option>
                  <option value="scheduled">{text.sweep.statusScheduled}</option>
                  <option value="review">{text.sweep.statusReview}</option>
                </select>
              </label>
              <button className="button button--ghost button--small" onClick={() => void loadSweep(sweepStatus)} disabled={sweepLoading}>
                <Icon name="refresh" size={14} />
                {sweepLoading ? text.sweep.checking : text.sweep.check}
              </button>
            </div>
          </div>

          <div style={{ padding: 16 }}>
            <p className="panel__note" style={{ marginTop: 0 }}>
              {sweepStatus === 'published' ? text.sweep.ledePublished : text.sweep.ledePending}
            </p>
            {sweepError && <div className="inline-alert inline-alert--error">{sweepError}</div>}
            {sweep && (
              <>
                {sweep.blocked_count === 0 ? (
                  <div className="inline-alert inline-alert--info">
                    {text.sweep.clean(Object.values(sweep.checked).reduce((a, b) => a + b, 0), sweep.status)}
                  </div>
                ) : (
                  <div className={`inline-alert ${sweep.status === 'published' ? 'inline-alert--error' : 'inline-alert--warn'}`}>
                    {text.sweep.found(sweep.blocked_count, sweep.status)}
                  </div>
                )}
                {sweep.blocked.length > 0 && (
                  <div className="table-scroll" tabIndex={0} style={{ marginTop: 12 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{text.sweep.entity}</th>
                          <th>{text.sweep.blockers}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sweep.blocked.map((row) => (
                          <tr key={`${row.entity_type}:${row.entity_id}`}>
                            <td>
                              <Link to={adminPath(`quality?type=${row.entity_type}&id=${encodeURIComponent(row.entity_id)}`)}>
                                {row.entity_type} · <span dir="ltr">{row.entity_id}</span>
                              </Link>
                            </td>
                            <td>
                              <ul style={{ margin: 0, paddingInlineStart: 16 }}>
                                {row.blockers.map((b) => (
                                  <li key={b.id}>
                                    <strong>{b.label_ar}</strong>
                                    {b.detail ? <> — {b.detail}</> : null}
                                    {b.items && b.items.length > 0 && (
                                      <div className="table-secondary" style={{ fontSize: 11 }}>
                                        {b.items.slice(0, 8).join(' · ')}
                                        {b.items.length > 8 ? ` ${text.sweep.more(b.items.length - 8)}` : ''}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {sweep.warned_count > 0 && (
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{text.sweep.warned(sweep.warned_count)}</summary>
                    <div className="table-scroll" tabIndex={0} style={{ marginTop: 8 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>{text.sweep.entity}</th>
                            <th>{text.sweep.warnings}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sweep.warned.map((row) => (
                            <tr key={`w:${row.entity_type}:${row.entity_id}`}>
                              <td>
                                <Link to={adminPath(`quality?type=${row.entity_type}&id=${encodeURIComponent(row.entity_id)}`)}>
                                  {row.entity_type} · <span dir="ltr">{row.entity_id}</span>
                                </Link>
                              </td>
                              <td>{row.warnings.map((w) => w.label_ar).join(' · ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                {sweep.unavailable.length > 0 && (
                  <div className="inline-alert inline-alert--warn" style={{ marginTop: 8 }}>
                    {text.sweep.unavailable(sweep.unavailable.length)}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* 5. List Toolbar (Must preserve fields, values, defaults for collectionsUrlStateB.test.tsx) */}
      <ListToolbar
        searchValue={url.query}
        onSearchChange={url.setQuery}
        searchPlaceholder={text.search}
        fields={filterFields}
        values={url.filters}
        defaults={QUALITY_FILTER_DEFAULTS}
        onApply={url.setFilters}
        onClear={url.clearFilters}
        onRemove={(key) => url.setFilter(key as keyof typeof QUALITY_FILTER_DEFAULTS, '')}
      />

      {/* 6. Primary Sample Evaluation Table */}
      {directId ? (
        loading ? (
          <LoadingState label={locale === 'ar' ? 'جارٍ فحص الجاهزية...' : 'Evaluating readiness...'} />
        ) : null
      ) : loading ? (
        <LoadingState label={locale === 'ar' ? 'جارٍ تحميل عينة الأصول...' : 'Loading asset readiness sample...'} />
      ) : (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.content}</th>
                  <th>{text.readiness}</th>
                  <th>{text.blockers}</th>
                  <th>{text.warningsCol}</th>
                  <th>{text.lastCheck}</th>
                  <th>{text.changed}</th>
                  <th>{text.owner}</th>
                  <th>{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((it) => {
                  const v = verdictOf(it.result)
                  return (
                    <tr key={`${it.type}:${it.id}`}>
                      <td>
                        <div className="prod-identity">
                          <div className="prod-thumb">
                            {it.thumb ? <img src={it.thumb} alt="" /> : <Icon name="media" size={16} />}
                          </div>
                          <div>
                            <Link
                              to={adminPath(
                                it.type === 'episode' ? `episodes/${it.id}` : it.type === 'story' ? `stories/${it.id}` : `${it.type}s/${it.id}`
                              )}
                            >
                              <strong>{it.title}</strong>
                            </Link>
                            <small>
                              {entityLabels[locale as 'ar' | 'en'][it.type]} · {it.series ?? it.planet ?? ''}
                            </small>
                            <small dir="ltr">{it.id.slice(0, 8)}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            v === 'READY' ? 'status-badge--published' : v === 'BLOCKED' ? 'status-badge--danger' : 'status-badge--review'
                          }`}
                        >
                          {v === 'READY' ? text.ready : v === 'BLOCKED' ? text.blocked : v === 'READY_WITH_WARNINGS' ? text.warnings : text.notEval}
                        </span>
                      </td>
                      <td>{it.result?.blockers.length ?? 0}</td>
                      <td>{it.result?.warnings.length ?? 0}</td>
                      <td dir="ltr">{it.checkedAt.slice(0, 16).replace('T', ' ')}</td>
                      <td>—</td>
                      <td>
                        {it.result?.blockers[0]?.owner ?? '—'}
                        <br />
                        <small>{it.result?.blockers[0]?.required_action?.slice(0, 20) ?? ''}</small>
                      </td>
                      <td>
                        <button className="button button--secondary button--small" onClick={() => void openWorkspace(it)}>
                          {text.openReadiness}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <EmptyState title={text.noData} description={text.selectContent} />}
          <Pagination
            total={filtered.length}
            limit={url.limit}
            offset={url.offset}
            onOffsetChange={url.setOffset as any}
            locale={locale}
          />
        </section>
      )}

      {/* 7. Detailed Readiness Inspection Workspace */}
      {workspace && workspaceMeta && (
        <section className="panel" style={{ marginTop: 16 }}>
          <header className="panel__header">
            <div>
              <span className="panel__kicker">
                {entityLabels[locale as 'ar' | 'en'][workspaceMeta.type]} · {workspaceMeta.title}
              </span>
              <h3
                style={{
                  color:
                    verdictOf(workspace) === 'BLOCKED'
                      ? '#ef4444'
                      : verdictOf(workspace) === 'READY'
                      ? '#22c55e'
                      : '#f59e0b',
                }}
              >
                {verdictOf(workspace) === 'READY'
                  ? text.ready
                  : verdictOf(workspace) === 'BLOCKED'
                  ? text.blocked
                  : text.warnings}
              </h3>
              <small>
                {text.lastEvaluated}: {workspaceMeta.checkedAt.slice(0, 16)} · {text.scheduled}: —
              </small>
            </div>
            <div className="table-actions">
              <button
                className="button button--ghost button--small"
                onClick={async () => {
                  const r = await api.publishReadiness(workspaceMeta.type as any, workspaceMeta.id)
                  setWorkspace(r.data as any)
                }}
              >
                {text.recheck}
              </button>
              <Link
                className="button button--secondary button--small"
                to={adminPath(
                  workspaceMeta.type === 'episode'
                    ? `episodes/${workspaceMeta.id}`
                    : workspaceMeta.type === 'story'
                    ? `stories/${workspaceMeta.id}`
                    : `${workspaceMeta.type}s/${workspaceMeta.id}`
                )}
              >
                {text.openContent}
              </Link>
              {verdictOf(workspace) === 'READY' && (
                <button
                  className="button button--primary button--small"
                  disabled={publishing}
                  onClick={async () => {
                    setPublishing(true)
                    setPublishNote(null)
                    try {
                      const publisher = {
                        story: api.publishStory,
                        book: api.publishBook,
                        game: api.publishGame,
                        project: api.publishProject,
                        series: api.publishSeries,
                        episode: api.publishEpisode,
                      }[workspaceMeta.type as 'story' | 'book' | 'game' | 'project' | 'series' | 'episode']
                      if (!publisher) {
                        setPublishNote(text.publishUnsupported)
                        return
                      }
                      await publisher(workspaceMeta.id)
                      const r = await api.publishReadiness(workspaceMeta.type as any, workspaceMeta.id)
                      setWorkspace(r.data as any)
                      setPublishNote(text.publishDone)
                    } catch (err) {
                      const blockers = (err as ApiError)?.payload as { data?: { blockers?: Array<{ id: string }> } } | undefined
                      const ids = blockers?.data?.blockers?.map((blocker) => blocker.id) ?? []
                      setPublishNote(ids.length ? `${text.publishBlocked}: ${ids.join(', ')}` : ((err as Error)?.message ?? text.publishFailed))
                    } finally {
                      setPublishing(false)
                    }
                  }}
                >
                  {publishing ? text.publishing : text.publishNow}
                </button>
              )}
            </div>
          </header>

          <div className="panel__body">
            {publishNote && (
              <p role="status" aria-live="polite" className="story-inspector__hint" style={{ marginBottom: 12 }}>
                {publishNote}
              </p>
            )}
            <label className="checkbox" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input type="checkbox" checked={showPassed} onChange={(e) => setShowPassed(e.target.checked)} />
              <span>{text.showPassed}</span>
            </label>

            {/* Findings Grouped by Domain */}
            {FINDING_GROUPS.map((group) => {
              const visible = workspace.findings
                .filter((finding: GateFinding) => findingGroup(finding) === group && (showPassed || finding.severity !== 'none'))
                .slice(0, 4)
              if (!visible.length) return null
              return (
                <div key={group} className="readiness-group" style={{ marginTop: 12 }}>
                  <h4 style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px 0' }}>{(text.groups as any)[group] ?? group}</h4>
                  {visible.map((f: GateFinding) => (
                    <div
                      key={f.id}
                      className={`readiness-item ${
                        f.severity === 'blocker' ? 'readiness-item--blocked' : f.severity === 'warning' ? 'readiness-item--warn' : ''
                      }`}
                      style={{
                        borderInlineStart: `3px solid ${
                          f.severity === 'blocker' ? '#ef4444' : f.severity === 'warning' ? '#f59e0b' : '#22c55e'
                        }`,
                        paddingInlineStart: 12,
                        margin: '8px 0',
                      }}
                    >
                      <div className="readiness-item__head">
                        <strong>{f.label_ar}</strong>
                        <span
                          className={`status-badge ${
                            f.status === 'blocked' ? 'status-badge--danger' : f.status === 'warn' ? 'status-badge--review' : 'status-badge--published'
                          }`}
                        >
                          {f.status}
                        </span>
                      </div>
                      <p className="panel__note" style={{ margin: '4px 0' }}>
                        {f.detail}
                      </p>
                      <small>
                        المسؤول: {f.owner ?? '—'} · الإجراء: {f.required_action ?? '—'}
                      </small>
                      {f.items && f.items.length > 0 && <small> · العناصر: {f.items.slice(0, 4).join(', ')}</small>}
                      {f.required_action && (
                        <div style={{ marginTop: 6 }}>
                          <Link
                            className="button button--ghost button--small"
                            to={adminPath(f.owner === 'production' ? 'production' : f.owner === 'reviewer' ? 'content-reviews' : 'quality')}
                          >
                            {f.required_action.slice(0, 30)}
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}

            <div className="panel__body" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                className="button button--secondary button--small"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' })
                  const dlUrl = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = dlUrl
                  a.download = `readiness-${workspaceMeta.id}.json`
                  a.click()
                  URL.revokeObjectURL(dlUrl)
                }}
              >
                <Icon name="download" size={14} />
                <span>{text.exportReport}</span>
              </button>
            </div>

            {history.length > 1 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 13, color: 'var(--muted)' }}>{text.history}</h4>
                {history.slice(0, 3).map((h, i) => (
                  <div key={i} className="panel__note">
                    {h.blockers.length} {text.blockers} · {h.warnings.length} {text.warnings}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
