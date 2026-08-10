import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { ErrorState, LoadingState } from '../components/PageState'
import { ScheduleCalendar, ScheduleToolbar } from '../components/ScheduleCalendar'
import { scheduleRange } from '../lib/scheduleDates'
import type { ScheduleView } from '../lib/scheduleDates'
import { useUrlListState } from '../hooks/useUrlListState'
import { adminPath } from '../lib/adminPath'
import { api } from '../lib/api'
import { hasPermission } from '../lib/adminSession'
import { usePreferences } from '../context/preferences'
import type { CalendarEventRecord, ContentCalendar } from '../types/api'

/**
 * تقويم المحتوى: كل ما تجدوله المنصّة في شاشة واحدة.
 *
 * ## لماذا شاشة مستقلّة لا تبويب تقويم في كل قائمة
 *
 * تبويب التقويم في صفحة المدوّنة يجيب «متى تُنشر مقالاتي». والسؤال الذي يُطرح
 * فعلًا قبل كل إطلاق هو «ما الذي يحدث في أسبوع الرابع عشر» — وجوابه يعبر تسعة
 * جداول: حلقات، قصص، سلاسل، صفحات موقع، مقالات، وحدات الصفحة الرئيسية، متطلّبات
 * إنتاج، مهام، وانتهاء تراخيص. لا قائمة واحدة تملكه.
 *
 * ## أهمّ ما تقوله هذه الشاشة
 *
 * **لا مُشغِّل دوري ينشر المجدول.** الكرون الوحيد في الخادم ينظّف أحداثًا
 * مُعالَجة. فكل صفّ حالته `scheduled` وعدٌ لا يحفظه شيء، وسيبقى كما هو حتى
 * ينشره إنسان. الشاشة تقول ذلك في أعلاها وتعلّم كل حدث مجدول بتنبيهه، بدل أن
 * ترسمه كأنه سيظهر في موعده.
 *
 * ## الإعادة الجدولة تمرّ بمسار الكيان
 *
 * السحب والإفلات — وحقل التاريخ الذي يقابله للوحة المفاتيح — ينادي المسار الذي
 * يُعلنه الحدث نفسه، فيمرّ بمراجعة الصفحة وتحقّقها وتدقيقها. لا كتابة مباشرة على
 * عمود `scheduled_at` من هنا.
 */

const copy = {
  ar: {
    eyebrow: 'تخطيط',
    title: 'تقويم المحتوى',
    intro: 'كل ما تجدوله المنصّة: حلقات وقصص وصفحات ومقالات ووحدات الرئيسية ومتطلّبات الإنتاج والمهام وانتهاء التراخيص.',
    loading: 'جارٍ تحميل التقويم…',
    search: 'ابحث في العناوين…',
    type: 'النوع', planet: 'الكوكب', language: 'اللغة', status: 'الحالة', owner: 'المسؤول', team: 'الفريق',
    all: 'الكل',
    conflicts: 'تنبيهات الجدولة',
    noSchedulerTitle: 'لا نشر تلقائي',
    unavailable: 'كيانات لا تظهر في التقويم',
    counts: (shown: number, total: number) => `${shown} من ${total} حدثًا`,
    moved: 'تمّ النقل.',
    moveFailed: 'تعذّر النقل، ولم يتغيّر التاريخ.',
    denied: 'لا تملك الصلاحية المطلوبة لهذه النقلة.',
    retry: 'إعادة المحاولة',
    conflictNames: {
      no_scheduler: 'مجدول بلا مُشغِّل',
      lapsed_schedule: 'موعد مضى',
      rights_expiry_before_publication: 'ترخيص ينتهي قبل النشر',
      same_day_collision: 'تعارض في اليوم نفسه',
    } as Record<string, string>,
  },
  en: {
    eyebrow: 'Planning',
    title: 'Content calendar',
    intro: 'Everything the platform schedules: episodes, stories, pages, posts, home modules, production requirements, tasks and licence expiry.',
    loading: 'Loading the calendar…',
    search: 'Search titles…',
    type: 'Type', planet: 'Planet', language: 'Language', status: 'Status', owner: 'Owner', team: 'Team',
    all: 'All',
    conflicts: 'Scheduling alerts',
    noSchedulerTitle: 'No automatic publishing',
    unavailable: 'Entities the calendar cannot place',
    counts: (shown: number, total: number) => `${shown} of ${total} events`,
    moved: 'Moved.',
    moveFailed: 'The move failed and the date is unchanged.',
    denied: 'You do not hold the permission this move requires.',
    retry: 'Retry',
    conflictNames: {
      no_scheduler: 'Scheduled with no scheduler',
      lapsed_schedule: 'Date has passed',
      rights_expiry_before_publication: 'Licence ends before publication',
      same_day_collision: 'Same-day collision',
    } as Record<string, string>,
  },
}

const TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  episode: { ar: 'حلقة', en: 'Episode' },
  series: { ar: 'سلسلة', en: 'Series' },
  story: { ar: 'قصة', en: 'Story' },
  website_page: { ar: 'صفحة موقع', en: 'Website page' },
  blog_post: { ar: 'مقال', en: 'Blog post' },
  home_module: { ar: 'وحدة الرئيسية', en: 'Home module' },
  production_requirement: { ar: 'متطلّب إنتاج', en: 'Production requirement' },
  task: { ar: 'مهمة', en: 'Task' },
  rights_expiry: { ar: 'انتهاء ترخيص', en: 'Licence expiry' },
}

const DEFAULTS = { type: '', planet: '', language: '', status: '', owner: '', team: '', conflict: '' }

export function ContentCalendarPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()

  const list = useUrlListState(DEFAULTS, { defaultView: 'month' })
  const view = (['day', 'week', 'month'].includes(list.view) ? list.view : 'month') as ScheduleView
  const [anchorKey, setAnchorKey] = useState(() => new Date().toISOString().slice(0, 10))
  const anchor = useMemo(() => {
    const [year, month, day] = anchorKey.split('-').map(Number)
    return new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1)
  }, [anchorKey])

  const [payload, setPayload] = useState<ContentCalendar | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const range = useMemo(() => scheduleRange(view, anchor), [anchor, view])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // الفلاتر تُرسل إلى الخادم لا تُطبَّق في المتصفح: النافذة قد تحمل مئات
      // الأحداث، وتصفية مجموعة كاملة في المتصفح تكبر مع البيانات لا مع الشاشة.
      const response = await api.contentCalendar({
        from: range.from,
        to: range.to,
        types: list.filters.type ? [list.filters.type] : undefined,
        planet: list.filters.planet || undefined,
        language: list.filters.language || undefined,
        status: list.filters.status || undefined,
        owner: list.filters.owner || undefined,
        team: list.filters.team || undefined,
      })
      setPayload(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'error')
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [list.filters, range.from, range.to])

  useEffect(() => { void load() }, [load])

  const events = useMemo(() => {
    const all = payload?.events ?? []
    const needle = list.query.trim().toLowerCase()
    return all.filter((event) => {
      // البحث النصّي وحده محلّي: المسار لا يقبل `q`، وإرسال معامل يتجاهله الخادم
      // هو ما يجعل حقل بحث يبدو معطوبًا. هذا مُعلَن في الشاشة.
      if (needle && !event.title.toLowerCase().includes(needle)
        && !(event.context ?? '').toLowerCase().includes(needle)) return false
      if (list.filters.conflict && !event.conflicts.includes(list.filters.conflict)) return false
      return true
    })
  }, [list.filters.conflict, list.query, payload])

  const fields: FilterField[] = useMemo(() => [
    {
      key: 'type', label: text.type, type: 'select',
      options: [
        { value: '', label: text.all },
        ...Object.entries(TYPE_LABELS).map(([value, labels]) => ({ value, label: labels[locale] })),
      ],
    },
    {
      key: 'language', label: text.language, type: 'select',
      options: [
        { value: '', label: text.all },
        { value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }, { value: 'fr', label: 'Français' },
      ],
    },
    { key: 'planet', label: text.planet, type: 'text' },
    { key: 'status', label: text.status, type: 'text' },
    { key: 'owner', label: text.owner, type: 'text' },
    { key: 'team', label: text.team, type: 'text' },
    {
      key: 'conflict', label: text.conflicts, type: 'select',
      options: [
        { value: '', label: text.all },
        ...Object.entries(text.conflictNames).map(([value, label]) => ({ value, label })),
      ],
    },
  ], [locale, text])

  const move = useCallback(async (event: CalendarEventRecord, date: string) => {
    if (!event.reschedule.supported) return
    if (event.reschedule.permission && !hasPermission(event.reschedule.permission)) {
      setNotice(text.denied)
      return
    }
    setBusyId(event.id)
    setNotice(null)
    try {
      await api.rescheduleCalendarEvent(event, date)
      setNotice(text.moved)
      // إعادة تحميل بدل تعديل الحالة محليًا: الخادم قد يضبط الحالة أو يحسب
      // تعارضًا جديدًا، وتفاؤلٌ يخفي ذلك يجعل الشاشة تختلف عن قاعدة البيانات.
      await load()
    } catch (cause) {
      setNotice(cause instanceof Error ? `${text.moveFailed} ${cause.message}` : text.moveFailed)
    } finally {
      setBusyId(null)
    }
  }, [load, text])

  const conflictEntries = Object.entries(payload?.conflict_summary ?? {}).filter(([, count]) => count > 0)

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
      </section>

      {payload && !payload.scheduler_available && (
        <section className="panel panel--notice">
          <strong><Icon name="warning" size={15} /> {text.noSchedulerTitle}</strong>
          <p>{payload.scheduler_note}</p>
        </section>
      )}

      <ListToolbar
        searchValue={list.query}
        onSearchChange={list.setQuery}
        searchPlaceholder={text.search}
        fields={fields}
        values={list.filters}
        defaults={DEFAULTS}
        onApply={(next) => list.setFilters(next)}
        onClear={list.clearFilters}
        onRemove={(key) => list.setFilter(key as keyof typeof DEFAULTS, '')}
        trailing={
          <SavedViewsMenu
            storageKey="content-calendar"
            currentSearch={list.search}
            onApply={(search) => navigate(`${adminPath('calendar')}${search}`)}
          />
        }
      />

      <ScheduleToolbar
        view={view}
        anchor={anchor}
        onView={(next) => list.setView(next)}
        onAnchor={(date) => setAnchorKey(date.toISOString().slice(0, 10))}
      />

      {conflictEntries.length > 0 && (
        <div className="filter-chips" aria-label={text.conflicts}>
          {conflictEntries.map(([key, count]) => (
            <button
              key={key}
              type="button"
              className={`filter-chip filter-chip--button ${list.filters.conflict === key ? 'filter-chip--on' : ''}`}
              onClick={() => list.setFilter('conflict', list.filters.conflict === key ? '' : key)}
            >
              <Icon name="warning" size={12} />
              {text.conflictNames[key] ?? key} <strong>{count}</strong>
            </button>
          ))}
        </div>
      )}

      {notice && <p className="form-note" role="status">{notice}</p>}

      {loading && !payload ? <LoadingState label={text.loading} />
        : error ? <ErrorState message={error} onRetry={() => void load()} />
          : (
            <>
              <p className="meta-line">{text.counts(events.length, payload?.total_unfiltered ?? 0)}</p>
              <ScheduleCalendar
                view={view}
                anchor={anchor}
                events={events}
                busyId={busyId}
                onOpen={(event) => navigate(adminPath(event.admin_route))}
                onMove={(event, date) => void move(event, date)}
              />
            </>
          )}

      {payload && payload.unavailable.length > 0 && (
        <section className="panel">
          <div className="panel__header"><h3>{text.unavailable}</h3></div>
          <div className="entity-form">
            <ul className="planned-list">
              {payload.unavailable.map((entry) => <li key={entry.type}>{entry.type} — {entry.reason}</li>)}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}
