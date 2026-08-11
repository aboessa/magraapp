import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EntityHeader } from '../components/EntityHeader'
import { DetailTabs } from '../components/DetailTabs'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { TimelineView } from '../components/DataViews'
import { StoryThumbnail } from '../components/StoryThumbnail'
import { AvailabilityPanel } from '../components/AvailabilityPanel'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatDate, formatNumber } from '../lib/labels'
import type { StoryBlocker, StoryLanguageCoverage, StoryWorkspace } from '../types/api'

/**
 * مساحة عمل القصة.
 *
 * ## لماذا شاشة بين المكتبة والمحرّر
 *
 * كان `/admin/stories/:id` يفتح المحرّر مباشرةً. فمن أراد أن يعرف حالة القصة —
 * كم صفحة، ما ينقصها، هل تُنشر — كان يهبط في سطح تأليف صفحات ويقرأ الإجابة من
 * بطاقتين في عمود جانبي. وإدارة القصة ككيان وتأليف صفحاتها فعلان مختلفان:
 *
 *   مساحة العمل   `/admin/stories/:id`           القصة ككيان
 *   المحرّر        `/admin/stories/:id/builder`   تأليف الصفحات
 *
 * ## ما لا تفعله هذه الشاشة
 *
 * لا تحمل حقول تحرير الصفحات. الصفحة الواحدة — نصّها وصورتها وسردها — تُحرَّر في
 * المحرّر حيث تُرى الصورة بحجم مفيد. وضع نموذج نصّ هنا كان سيُنتج مكانين لتحرير
 * الشيء نفسه.
 *
 * ولا تُعلن تبويبات لا تسندها بيانات: المراجعات والحقوق مرفوضتان بقيد
 * `entity_type` في جدوليهما، والتوقيت عمود لا يكتبه شيء. تُقال هذه الحدود صراحةً
 * بدل تبويب فارغ يبدو عيبًا.
 */

const TABS = ['overview', 'pages', 'localization', 'narration', 'readiness', 'availability', 'activity'] as const
type TabKey = (typeof TABS)[number]

const typeLabels = {
  ar: { picture_book: 'كتاب مصوّر', audio_story: 'قصة صوتية', interactive: 'قصة تفاعلية', comic: 'كوميكس' },
  en: { picture_book: 'Illustrated book', audio_story: 'Audio story', interactive: 'Interactive story', comic: 'Comic' },
}

const copy = {
  ar: {
    contentRoot: 'المحتوى',
    stories: 'القصص',
    loading: 'جارٍ تحميل القصة...',
    loadError: 'تعذر تحميل القصة',
    notFound: 'القصة غير موجودة',
    notFoundDesc: 'قد يكون المعرّف غير صحيح أو حُذف صفّ القصة.',
    denied: 'لا تملك صلاحية عرض هذه القصة.',
    retry: 'إعادة المحاولة',

    openBuilder: 'فتح المحرّر',
    editDenied: 'التعديل يحتاج صلاحية تعديل البيانات.',
    addFirstPage: 'أضف الصفحة الأولى',

    tabOverview: 'نظرة عامة',
    tabPages: 'الصفحات',
    tabLocalization: 'اللغات',
    tabNarration: 'السرد',
    tabReadiness: 'جاهزية النشر',
    tabAvailability: 'الإتاحة',
    tabActivity: 'السجل',

    pages: 'صفحة',
    pagesWithImage: 'صفحة بصورة جاهزة',
    pagesReady: 'صفحة مكتملة',
    type: 'النوع',
    ages: 'الأعمار',
    language: 'لغة القصة',
    series: 'السلسلة',
    planet: 'الكوكب',
    style: 'النمط البصري',
    updated: 'آخر تعديل',
    never: 'لا تعديل مسجّل',

    description: 'الوصف',
    noDescription: 'بلا وصف',

    composition: 'حالة الإنتاج',
    readToMe: 'اقرأ لي',
    readAlong: 'قراءة متزامنة',
    ready: 'جاهزة',
    notReady: 'غير مكتملة',
    publishable: 'قابلة للنشر',
    blocked: 'موقوفة',

    coverage: 'التغطية بحسب اللغة',
    coverageNote: 'الأرقام معدودة من صفحات القصة لا من قائمة اللغات المعلَنة. النصّ والسرد سؤالان مختلفان.',
    colLanguage: 'اللغة',
    colText: 'النصّ',
    colNarration: 'السرد الجاهز',
    colTiming: 'مؤشّرات التوقيت',
    declared: 'معلَنة',
    undeclared: 'غير معلَنة',

    pagesTable: 'صفحات القصة',
    colPage: 'الصفحة',
    colImage: 'الصورة',
    colLayout: 'التخطيط',
    colDuration: 'المدّة',
    colState: 'الحالة',
    open: 'فتح',
    pageReady: 'مكتملة',
    pagePartial: 'ناقصة',
    pageEmpty: 'فارغة',
    noImage: 'بلا صورة',
    imageNotReady: (status: string) => `الصورة ${status}`,
    imageOk: 'جاهزة',
    noPages: 'لا صفحات في هذه القصة بعد',
    noPagesDesc: 'أضف الصفحة الأولى من المحرّر، ثم ارفع صورتها ونصّها.',

    blockers: 'ما يمنع النشر',
    blockersEmpty: 'لا عوائق: الصفحات موجودة، وكلها مصوّرة بأصول جاهزة، وكلها تحمل نصًّا بلغة القصة.',
    severityBlocker: 'عائق',
    severityWarning: 'تحذير',
    page: 'صفحة',
    fixIn: 'يُصلح في المحرّر',

    unsupported: 'حدود المخطَّط',
    unsupportedNote: 'ما دون هذا ليس نقصًا في العمل بل في المخطَّط، ويُقال صراحةً بدل تبويب فارغ:',

    activityEmpty: 'لا سجلّ تدقيق لهذه القصة بعد.',
    openAudit: 'سجل التدقيق',
  },
  en: {
    contentRoot: 'Content',
    stories: 'Stories',
    loading: 'Loading the story...',
    loadError: 'Unable to load the story',
    notFound: 'Story not found',
    notFoundDesc: 'The id may be wrong, or the story row was removed.',
    denied: 'You do not have permission to view this story.',
    retry: 'Retry',

    openBuilder: 'Open editor',
    editDenied: 'Editing needs the edit_metadata permission.',
    addFirstPage: 'Add the first page',

    tabOverview: 'Overview',
    tabPages: 'Pages',
    tabLocalization: 'Languages',
    tabNarration: 'Narration',
    tabReadiness: 'Publish readiness',
    tabAvailability: 'Availability',
    tabActivity: 'History',

    pages: 'pages',
    pagesWithImage: 'pages with a ready image',
    pagesReady: 'complete pages',
    type: 'Type',
    ages: 'Ages',
    language: 'Story language',
    series: 'Series',
    planet: 'Planet',
    style: 'Visual style',
    updated: 'Updated',
    never: 'No recorded update',

    description: 'Description',
    noDescription: 'No description',

    composition: 'Production state',
    readToMe: 'Read to me',
    readAlong: 'Read along',
    ready: 'Ready',
    notReady: 'Incomplete',
    publishable: 'Publishable',
    blocked: 'Blocked',

    coverage: 'Coverage by language',
    coverageNote: 'The numbers are counted from the story’s pages, not from the declared language list. Text and narration are different questions.',
    colLanguage: 'Language',
    colText: 'Text',
    colNarration: 'Ready narration',
    colTiming: 'Timing cues',
    declared: 'declared',
    undeclared: 'not declared',

    pagesTable: 'Story pages',
    colPage: 'Page',
    colImage: 'Image',
    colLayout: 'Layout',
    colDuration: 'Duration',
    colState: 'State',
    open: 'Open',
    pageReady: 'Complete',
    pagePartial: 'Partial',
    pageEmpty: 'Empty',
    noImage: 'No image',
    imageNotReady: (status: string) => `Image is ${status}`,
    imageOk: 'Ready',
    noPages: 'This story has no pages yet',
    noPagesDesc: 'Add the first page from the editor, then upload its artwork and text.',

    blockers: 'What blocks publication',
    blockersEmpty: 'No blockers: pages exist, all are illustrated with ready assets, and all carry text in the story language.',
    severityBlocker: 'Blocker',
    severityWarning: 'Warning',
    page: 'page',
    fixIn: 'Fix in the editor',

    unsupported: 'Schema limits',
    unsupportedNote: 'What follows is not missing work but a missing column, stated plainly rather than shown as an empty tab:',

    activityEmpty: 'No audit history for this story yet.',
    openAudit: 'Audit log',
  },
}

/// شريط تغطية يحمل الرقم ومقامه معًا.
function CoverageBar({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const tone = total === 0 ? 'muted' : percent >= 100 ? 'ok' : percent > 0 ? 'warn' : 'bad'
  return (
    <div className={`story-coverage__row story-coverage__row--${tone}`}>
      <span className={`story-coverage__track ${tone === 'warn' ? 'story-coverage__track--warn' : tone === 'bad' ? 'story-coverage__track--bad' : ''}`}>
        <span style={{ width: `${percent}%` }} />
      </span>
      <b className="story-coverage__value" dir="ltr">{done}/{total}</b>
    </div>
  )
}

export function StoryWorkspacePage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()

  const [workspace, setWorkspace] = useState<StoryWorkspace | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'denied' | 'error'>('loading')
  const [error, setError] = useState('')

  const rawTab = params.get('tab') ?? 'overview'
  const tab: TabKey = (TABS as readonly string[]).includes(rawTab) ? (rawTab as TabKey) : 'overview'

  const setTab = useCallback((next: string) => {
    const params2 = new URLSearchParams(params)
    if (next === 'overview') params2.delete('tab')
    else params2.set('tab', next)
    setParams(params2, { replace: true })
  }, [params, setParams])

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.storyWorkspace(id)
      setWorkspace(response.data)
      setState('ok')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setState('missing')
      else if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) setState('denied')
      else setState('error')
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }, [id, text.loadError])

  useEffect(() => { void load() }, [load])

  if (state === 'loading' && !workspace) return <LoadingState label={text.loading} />
  if (state === 'missing') {
    return (
      <div className="page-stack">
        <EmptyState
          title={text.notFound}
          description={text.notFoundDesc}
          action={<Link className="button button--ghost" to={adminPath('stories')}>{text.stories}</Link>}
        />
      </div>
    )
  }
  if (state === 'denied') return <div className="page-stack"><ErrorState message={error || text.denied} /></div>
  if (!workspace) return <div className="page-stack"><ErrorState message={error} onRetry={() => void load()} /></div>

  const { story, pages, coverage, blockers, readiness, capabilities, activity } = workspace
  const title = locale === 'en' ? story.title_en || story.title_ar : story.title_ar
  const defaultLanguage = story.default_language

  const pageState = (page: typeof pages[number]) => {
    const hasImage = !!page.image_asset_id && page.image_status === 'ready'
    const hasText = page.localizations.some((entry) => entry.language === defaultLanguage && entry.has_text)
    if (hasImage && hasText) return 'ready' as const
    if (!hasImage && !hasText) return 'empty' as const
    return 'partial' as const
  }

  const blockerCount = blockers.filter((entry) => entry.severity === 'blocker').length

  /// وجهة العائق: المحرّر على الصفحة المعنيّة وتبويب المفتِّش الذي يُصلحه.
  const blockerHref = (entry: StoryBlocker) => {
    const search = new URLSearchParams()
    if (entry.page_number) search.set('page', String(entry.page_number))
    if (entry.inspector) search.set('inspect', entry.inspector)
    if (entry.language) search.set('lang', entry.language)
    const query = search.toString()
    return adminPath(`stories/${id}/builder${query ? `?${query}` : ''}`)
  }

  const overviewTab = (
    <div className="workspace-stack">
      <section className="panel">
        <header className="panel__header"><h3>{text.description}</h3></header>
        <div className="panel__body">
          <p className="workspace-prose">{story.description_ar?.trim() || text.noDescription}</p>
          <dl className="story-facts">
            <div><dt>{text.series}</dt><dd>{story.series_title || '—'}</dd></div>
            <div><dt>{text.planet}</dt><dd>{story.planet_name || '—'}</dd></div>
            <div><dt>{text.style}</dt><dd>{story.visual_style_name || '—'}</dd></div>
            <div><dt>{text.language}</dt><dd dir="ltr">{defaultLanguage.toUpperCase()}</dd></div>
            <div>
              <dt>{text.updated}</dt>
              <dd dir="ltr">
                {story.updated_at ? formatDate(story.updated_at.replace(' ', 'T') + 'Z', locale) : text.never}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.composition}</h3></header>
        <div className="panel__body">
          <div className="metric-row">
            <div className="metric-cell">
              <strong>{formatNumber(readiness.pages_total, locale)}</strong>
              <span>{text.pages}</span>
            </div>
            <div className={`metric-cell metric-cell--${readiness.pages_with_image >= readiness.pages_total && readiness.pages_total > 0 ? 'good' : 'warn'}`}>
              <strong dir="ltr">{formatNumber(readiness.pages_with_image, locale)}/{formatNumber(readiness.pages_total, locale)}</strong>
              <span>{text.pagesWithImage}</span>
            </div>
            <div className={`metric-cell metric-cell--${readiness.read_to_me_ready ? 'good' : 'warn'}`}>
              <strong>{readiness.read_to_me_ready ? text.ready : text.notReady}</strong>
              <span>{text.readToMe}</span>
            </div>
            {/* «اقرأ لي» و«القراءة المتزامنة» حُكمان منفصلان: سرد بلا مؤشّرات
                توقيت هو الأول مكتمل والثاني فارغ. */}
            <div className={`metric-cell metric-cell--${readiness.read_along_ready ? 'good' : 'muted'}`}>
              <strong>{readiness.read_along_ready ? text.ready : text.notReady}</strong>
              <span>{text.readAlong}</span>
            </div>
            <div className={`metric-cell metric-cell--${readiness.publishable ? 'good' : 'danger'}`}>
              <strong>{readiness.publishable ? text.publishable : text.blocked}</strong>
              <span>{formatNumber(blockerCount, locale)} {text.severityBlocker}</span>
            </div>
          </div>
        </div>
      </section>

      {blockers.length > 0 && (
        <section className="panel">
          <header className="panel__header">
            <h3>{text.blockers} <span className="title-count">{formatNumber(blockers.length, locale)}</span></h3>
          </header>
          <div className="panel__body">
            <div className="story-readiness">
              {blockers.slice(0, 8).map((entry) => (
                <Link className={`story-readiness__item story-readiness__item--${entry.severity}`} to={blockerHref(entry)} key={entry.key}>
                  <Icon name={entry.severity === 'blocker' ? 'warning' : 'clock'} size={15} />
                  <span>{locale === 'en' ? entry.label_en : entry.label_ar}</span>
                  <span className="story-readiness__page">
                    {entry.page_number ? `${text.page} ${formatNumber(entry.page_number, locale)}` : ''}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <header className="panel__header">
          <div>
            <h3>{text.unsupported}</h3>
            <p className="panel__note">{text.unsupportedNote}</p>
          </div>
        </header>
        <div className="panel__body">
          <ul className="module-notes">
            {!capabilities.reviews_supported && <li>{capabilities.reviews_reason}</li>}
            {!capabilities.rights_supported && <li>{capabilities.rights_reason}</li>}
            {!capabilities.timing_supported && <li>{capabilities.timing_reason}</li>}
            {!capabilities.panels_supported && <li>{capabilities.panels_reason}</li>}
          </ul>
        </div>
      </section>
    </div>
  )

  const pagesTab = pages.length === 0 ? (
    <EmptyState
      title={text.noPages}
      description={text.noPagesDesc}
      action={<Link className="button button--primary" to={adminPath(`stories/${id}/builder`)}>
        <Icon name="plus" size={16} />{text.addFirstPage}
      </Link>}
    />
  ) : (
    <section className="panel panel--table">
      <header className="panel__header">
        <h3>{text.pagesTable} <span className="title-count">{formatNumber(pages.length, locale)}</span></h3>
      </header>
      <div className="table-scroll" tabIndex={0}>
        <table className="data-table data-table--wide">
          <thead>
            <tr>
              <th>{text.colPage}</th>
              <th>{text.colImage}</th>
              <th>{text.colText}</th>
              <th>{text.colNarration}</th>
              <th>{text.colLayout}</th>
              <th>{text.colDuration}</th>
              <th>{text.colState}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => {
              const own = pageState(page)
              const arabic = page.localizations.find((entry) => entry.language === defaultLanguage)
              return (
                <tr key={page.id}>
                  <td>
                    <Link className="entity-cell entity-cell--button" to={adminPath(`stories/${id}/builder?page=${page.page_number}`)}>
                      <StoryThumbnail src={page.image_url} alt="" title={String(page.page_number)} size={38} />
                      <div><strong dir="ltr">{formatNumber(page.page_number, locale)}</strong></div>
                    </Link>
                  </td>
                  <td>
                    {!page.image_asset_id
                      ? <span className="story-chip story-chip--bad">{text.noImage}</span>
                      : page.image_status !== 'ready'
                        // الحالة الحقيقية لا «موجودة/غائبة»: أصل `planned` كان
                        // يمنع النشر بلا أن تُظهر الشاشة السبب.
                        ? <span className="story-chip story-chip--warn">{text.imageNotReady(String(page.image_status))}</span>
                        : <span className="story-chip story-chip--ok">{text.imageOk}</span>}
                  </td>
                  <td>
                    {arabic?.has_text
                      ? <span className="story-chip story-chip--ok" dir="ltr">{defaultLanguage.toUpperCase()}</span>
                      : <span className="story-chip story-chip--bad">—</span>}
                  </td>
                  <td>
                    {arabic?.narration_ready
                      ? <span className="story-chip story-chip--ok" dir="ltr">{defaultLanguage.toUpperCase()}</span>
                      : <span className="story-chip story-chip--muted">—</span>}
                  </td>
                  <td dir="ltr">{page.layout}</td>
                  <td dir="ltr">{page.duration_ms ? `${(page.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                  <td>
                    <span className={`story-readiness-badge story-readiness-badge--${own}`}>
                      {own === 'ready' ? text.pageReady : own === 'empty' ? text.pageEmpty : text.pagePartial}
                    </span>
                  </td>
                  <td>
                    <Link className="button button--ghost button--small" to={adminPath(`stories/${id}/builder?page=${page.page_number}`)}>
                      {text.open}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )

  const coverageTable = (kind: 'text' | 'narration' | 'timing') => (
    <div className="story-coverage">
      {coverage.map((entry: StoryLanguageCoverage) => {
        const done = kind === 'text' ? entry.text_done : kind === 'narration' ? entry.narration_done : entry.timing_done
        return (
          <div className="story-coverage__row" key={entry.language}>
            <span className="story-coverage__lang" dir="ltr">{entry.language.toUpperCase()}</span>
            <CoverageBar done={done} total={entry.total} />
            <span className="story-coverage__value">
              {entry.declared ? text.declared : text.undeclared}
            </span>
          </div>
        )
      })}
    </div>
  )

  const localizationTab = (
    <div className="workspace-stack">
      <section className="panel">
        <header className="panel__header">
          <div>
            <h3>{text.coverage}</h3>
            <p className="panel__note">{text.coverageNote}</p>
          </div>
        </header>
        <div className="panel__body">
          <h4 className="story-inspector__section-title">{text.colText}</h4>
          {coverageTable('text')}
        </div>
      </section>
      <section className="panel">
        <header className="panel__header"><h3>{text.colTiming}</h3></header>
        <div className="panel__body">
          {/* التوقيت لا يكتبه شيء في المنصّة، فعرض أصفاره بلا تفسير كان سيبدو
              تقصيرًا في العمل لا حدًّا في المخطَّط. */}
          <p className="data-unavailable" role="note">{capabilities.timing_reason}</p>
        </div>
      </section>
    </div>
  )

  const narrationTab = (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h3>{text.colNarration}</h3>
          <p className="panel__note">{text.coverageNote}</p>
        </div>
      </header>
      <div className="panel__body">{coverageTable('narration')}</div>
    </section>
  )

  const readinessTab = (
    <section className="panel">
      <header className="panel__header">
        <h3>{text.blockers} <span className="title-count">{formatNumber(blockers.length, locale)}</span></h3>
      </header>
      <div className="panel__body">
        {blockers.length === 0 ? (
          // حالة الفراغ تُعدّد ما فُحص فعلًا: «لا عوائق» وحدها لا تقول إن كان
          // الفحص جرى أصلًا.
          <p className="workspace-prose">{text.blockersEmpty}</p>
        ) : (
          <div className="story-readiness">
            {blockers.map((entry) => (
              <Link className={`story-readiness__item story-readiness__item--${entry.severity}`} to={blockerHref(entry)} key={entry.key}>
                <Icon name={entry.severity === 'blocker' ? 'warning' : 'clock'} size={15} />
                <span>{locale === 'en' ? entry.label_en : entry.label_ar}</span>
                <span className="story-readiness__page">
                  {entry.severity === 'blocker' ? text.severityBlocker : text.severityWarning}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )

  const activityTab = (
    <section className="panel">
      <header className="panel__header">
        <h3>{text.tabActivity}</h3>
        <Link className="button button--ghost button--small" to={adminPath('audit-logs')}>{text.openAudit}</Link>
      </header>
      <div className="panel__body">
        <TimelineView
          entries={activity.map((entry) => ({
            id: entry.id,
            at: entry.created_at.includes('T') ? entry.created_at : `${entry.created_at.replace(' ', 'T')}Z`,
            title: entry.action,
            detail: `${entry.actor_name || entry.actor_id || '—'} · ${entry.entity_type}`,
          }))}
          emptyLabel={text.activityEmpty}
        />
      </div>
    </section>
  )

  /// بلا `useMemo` بقصد.
  ///
  /// كان هذا `useMemo` وهو *بعد* المخارج المبكرة أعلاه (تحميل/غير موجودة/ممنوعة)،
  /// فعدد الخطّافات يتغيّر بين تصييرين: React يرمي «Rendered more hooks than
  /// during the previous render» لحظة انتقال الصفحة من التحميل إلى البيانات.
  ///
  /// ونقله إلى أعلى المكوّن غير ممكن: محتوى التبويبات مبنيّ من `workspace` الذي
  /// لا يوجد قبل تلك المخارج. والتحفيظ نفسه لم يكن يشتري شيئًا — كل عنصر في
  /// مصفوفة الاعتماديات عنصر JSX يُعاد بناؤه في كل تصيير، فالمقارنة تفشل دائمًا.
  const tabs = [
    { key: 'overview', label: text.tabOverview, badge: blockers.length || undefined, content: overviewTab },
    { key: 'pages', label: text.tabPages, badge: pages.length || undefined, content: pagesTab },
    { key: 'localization', label: text.tabLocalization, content: localizationTab },
    { key: 'narration', label: text.tabNarration, content: narrationTab },
    { key: 'readiness', label: text.tabReadiness, badge: blockerCount || undefined, content: readinessTab },
    { key: 'availability', label: text.tabAvailability, content: <AvailabilityPanel scope="story" entityId={id} /> },
    { key: 'activity', label: text.tabActivity, badge: activity.length || undefined, content: activityTab },
  ]

  return (
    <div className="page-stack story-workspace">
      <EntityHeader
        breadcrumbs={[
          { label: text.contentRoot, to: adminPath('') },
          { label: text.stories, to: adminPath('stories') },
          { label: title },
        ]}
        thumbnail={<StoryThumbnail src={story.cover_url} alt="" title={title} color={story.planet_color} size={62} />}
        title={title}
        subtitle={story.description_ar ?? undefined}
        meta={[
          `${formatNumber(readiness.pages_total, locale)} ${text.pages}`,
          typeLabels[locale][story.type],
          `${story.age_min}–${story.age_max}`,
          story.series_title ?? '',
          story.planet_name ?? '',
        ].filter(Boolean)}
        status={<StatusBadge status={story.status} />}
        actions={
          <>
            {/* الفعل الأساسي هو فتح المحرّر: هذه الشاشة تُدير الكيان، والتأليف
                يحدث هناك. */}
            <Link className="button button--primary" to={adminPath(`stories/${id}/builder`)}>
              <Icon name="edit" size={16} />{text.openBuilder}
            </Link>
          </>
        }
      />

      {error && <div className="inline-alert inline-alert--error" role="alert">{error}</div>}

      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />
    </div>
  )
}
