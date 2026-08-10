import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DetailTabs } from '../components/DetailTabs'
import { EntityHeader } from '../components/EntityHeader'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { GameLocalizationPanel } from '../components/games/GameLocalizationPanel'
import { GamePackForm } from '../components/games/GamePackForm'
import { EnginePackForm } from '../components/games/EnginePackForm'
import { GamePreviewPanel } from '../components/games/GamePreviewPanel'
import { PublishReadinessPanel } from '../components/games/PublishReadinessPanel'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { statusLabels } from '../lib/labels'
import { parsePack, promptKeysOf, usedModes } from '../lib/tracePack'
import { parseEnginePack } from '../lib/enginePack'
import type { GameDetail, LearningObjectiveDetail } from '../types/api'
import type { GameReadiness, TracePack } from '../types/gamePack'
import type { EnginePack } from '../types/enginePack'

/**
 * صفحة لعبة واحدة: استوديو الرسم.
 *
 * ## لماذا صفحة مستقلّة
 *
 * `library-content/games/:id` تعرض اللعبة ككيان مكتبة: عمر وحالة وأصول مرتبطة،
 * وحزمة المحتوى كـ`<pre>` من JSON. ذلك كافٍ لقراءة صفّ، وغير كافٍ لتأليف لعبة
 * رسم: لا هندسة قابلة للتحرير، ولا معاينة لما سيراه الطفل، ولا قائمة بما يمنع
 * النشر، ولا ترجمات.
 *
 * ## لا جاهزية مُختلقة في النظرة العامة
 *
 * كل رقم وكل حالة في هذه الصفحة من الخادم: الأصول من فحص الجاهزية بحالتها
 * الفعلية، وتغطية اللغات من فحوص `localization_*`، وحالة المراجعة من الحزمة.
 * ما لا يُعرف لا يُخمَّن ويظهر «—».
 */

const copy = {
  ar: {
    breadcrumb: 'الكتب والألعاب والأنشطة',
    kind: 'لعبة',
    loading: 'جارٍ تحميل اللعبة...',
    loadError: 'تعذر تحميل اللعبة',
    notFound: 'اللعبة غير موجودة',
    years: 'سنوات',
    tabs: { overview: 'نظرة عامة', pack: 'الحزمة والهندسة', preview: 'المعاينة', readiness: 'الجاهزية', languages: 'اللغات' },
    identity: 'التعريف',
    engine: 'المحرّك',
    engineImplementation: 'تنفيذ المحرّك',
    engineImplemented: 'له عقد وقت تشغيل في هذا الإصدار',
    engineMissing: 'لا عقد وقت تشغيل في هذا الإصدار',
    engineUnknown: 'يُحدَّد من فحص الجاهزية',
    status: 'حالة المحتوى',
    difficulty: 'الصعوبة',
    difficulties: { easy: 'سهل', medium: 'متوسط', hard: 'صعب' } as Record<string, string>,
    age: 'المدى العمري',
    packVersion: 'إصدار الحزمة',
    packMissing: 'لا حزمة',
    levels: 'المستويات',
    modes: 'أنماط الرسم المستخدمة',
    objective: 'الهدف التعليمي',
    objectiveCode: 'الرمز',
    criteria: 'المعيار المقيس',
    noObjective: 'لا هدف تعليمي مرتبط، فلا يمكن قياس الإتقان.',
    skills: 'المهارات',
    skillsPrimary: 'الأساسية',
    skillsFromReadiness: 'من فحص الجاهزية',
    noSkill: 'الهدف بلا مهارة أساسية.',
    localization: 'تغطية اللغات',
    accessibility: 'إمكانية الوصول',
    simplified: 'الوضع الحركي المبسّط',
    sequentialTap: 'بديل اللمس المتتابع',
    reducedMotion: 'تقليل الحركة',
    minTouch: 'أصغر هدف لمس',
    declared: 'مُعلَن',
    notDeclared: 'غير مُعلَن',
    review: 'المراجعة اللغوية',
    reviewer: 'المراجع',
    reviewNotRequired: 'غير مطلوبة (لا حروف في الحزمة)',
    blockers: 'عوائق الإنتاج',
    noBlockers: 'لا عائق يمنع النشر من جهة البيانات.',
    blockersUnknown: 'تُقرأ من تبويب الجاهزية.',
    assets: 'الأصول الفنية',
    audio: 'الأصوات',
    assetsEmpty: 'الحزمة لا تشير إلى أصول من هذا النوع.',
    ready: 'جاهز',
    notReady: 'غير جاهز',
    promptKeys: 'مفاتيح نصوص التوجيه',
    openLibrary: 'بيانات المكتبة',
    coverAlt: (title: string) => `غلاف ${title}`,
    instructions: 'التعليمات',
  },
  en: {
    breadcrumb: 'Books, games & activities',
    kind: 'Game',
    loading: 'Loading the game...',
    loadError: 'Unable to load the game',
    notFound: 'Game not found',
    years: 'years',
    tabs: { overview: 'Overview', pack: 'Pack & geometry', preview: 'Preview', readiness: 'Readiness', languages: 'Languages' },
    identity: 'Identity',
    engine: 'Engine',
    engineImplementation: 'Engine implementation',
    engineImplemented: 'Has a runtime contract in this deployment',
    engineMissing: 'No runtime contract in this deployment',
    engineUnknown: 'Determined by the readiness check',
    status: 'Content status',
    difficulty: 'Difficulty',
    difficulties: { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as Record<string, string>,
    age: 'Age range',
    packVersion: 'Pack version',
    packMissing: 'No pack',
    levels: 'Levels',
    modes: 'Drawing modes used',
    objective: 'Learning objective',
    objectiveCode: 'Code',
    criteria: 'Measurable criterion',
    noObjective: 'No learning objective is linked, so mastery cannot be measured.',
    skills: 'Skills',
    skillsPrimary: 'Primary',
    skillsFromReadiness: 'from the readiness check',
    noSkill: 'The objective has no primary skill.',
    localization: 'Language coverage',
    accessibility: 'Accessibility',
    simplified: 'Simplified motor mode',
    sequentialTap: 'Sequential-tap alternative',
    reducedMotion: 'Reduced motion',
    minTouch: 'Minimum touch target',
    declared: 'Declared',
    notDeclared: 'Not declared',
    review: 'Linguistic review',
    reviewer: 'Reviewer',
    reviewNotRequired: 'Not required (no letters in the pack)',
    blockers: 'Production blockers',
    noBlockers: 'Nothing in the data blocks publication.',
    blockersUnknown: 'Read from the readiness tab.',
    assets: 'Artwork assets',
    audio: 'Audio',
    assetsEmpty: 'The pack references no assets of this kind.',
    ready: 'Ready',
    notReady: 'Not ready',
    promptKeys: 'Prompt keys',
    openLibrary: 'Library record',
    coverAlt: (title: string) => `${title} cover`,
    instructions: 'Instructions',
  },
}

/// غلاف اللعبة. الأصول محروسة بالمصادقة فلا يمكن ربطها بـ<img src> مباشرة،
/// وتُقرأ كـblob ثم تُحرَّر عند التفريغ حتى لا تحتجز ذاكرة التبويب.
function Cover({ assetId, alt }: { assetId?: string | null; alt: string }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    setUrl('')
    if (!assetId) return
    let live = true
    let objectUrl = ''
    void api.assetBlob(assetId).then((blob) => {
      if (!live) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => setUrl(''))
    return () => {
      live = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [assetId])

  return (
    <div className="entity-thumb">
      {url ? <img src={url} alt={alt} /> : <span className="entity-thumb__letter" aria-hidden="true"><Icon name="games" size={24} /></span>}
    </div>
  )
}

export function GameDetailPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const { id = '' } = useParams()

  const [game, setGame] = useState<GameDetail | null>(null)
  const [objective, setObjective] = useState<LearningObjectiveDetail | null>(null)
  const [readiness, setReadiness] = useState<GameReadiness | null>(null)
  const [pack, setPack] = useState<TracePack | null>(null)
  /// حزمة أي محرّك آخر. حالة ثانية لا واحدة عامّة: `TracePack` عقد `trace_color`
  /// بحقوله الخاصّة، وتوحيدهما في نوع واحد كل حقوله اختيارية يفقد ما يمنعه كلٌّ
  /// منهما.
  const [enginePack, setEnginePack] = useState<EnginePack | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.game(id)
      setGame(response.data)
      // `parsePack` عقد `trace_color`: تشغيله على حزمة `memory_flip` يُنتج نوعًا
      // يبدو صالحًا وحقوله كلها غير ذات معنى، فيُعرض «أنماط رسم» لمحرّك لا يرسم.
      setPack(response.data.engine_id === 'trace_color' ? parsePack(response.data.content_pack) : null)
      setEnginePack(parseEnginePack(response.data.content_pack, response.data.engine_id))
      if (response.data.learning_objective_id) {
        // الهدف يُحمَّل على حدة: صفّ اللعبة يحمل عنوانه لا رمزه ولا معياره
        // المقيس، وهما ما يجعل الهدف قابلًا للتحقّق.
        const objectiveResponse = await api.learningObjective(response.data.learning_objective_id)
        setObjective(objectiveResponse.data)
      } else {
        setObjective(null)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => { void load() }, [load])

  const loadReadiness = useCallback(async () => {
    try {
      const response = await api.gameReadiness(id)
      setReadiness(response.data)
    } catch {
      // الجاهزية إضافة إلى النظرة العامة لا شرط لعرضها: تبويب الجاهزية يعرض
      // سبب الفشل بنفسه، فلا يُكرَّر خطأ هنا.
      setReadiness(null)
    }
  }, [id])

  useEffect(() => { void loadReadiness() }, [loadReadiness])

  const modes = useMemo(() => usedModes(pack), [pack])
  const promptKeys = useMemo(() => promptKeysOf(pack), [pack])

  if (loading && !game) return <LoadingState label={text.loading} />
  if (error && !game) return <ErrorState message={error} onRetry={() => void load()} />
  if (!game) return <EmptyState title={text.notFound} description="" />

  const engineCheck = readiness?.checks.find((check) => check.id === 'engine')
  const skillsCheck = readiness?.checks.find((check) => check.id === 'skills')
  const localizationChecks = readiness?.checks.filter((check) => check.id.startsWith('localization_')) ?? []
  const reviewCheck = readiness?.checks.find((check) => check.id === 'linguistic_review')
  const artAssets = readiness?.assets.filter((asset) => asset.kind !== 'audio') ?? []
  const audioAssets = readiness?.assets.filter((asset) => asset.kind === 'audio') ?? []
  const simplified = pack?.accessibility?.simplified_motor
  const review = pack?.review?.linguistic_review

  const assetTable = (rows: typeof artAssets) => (rows.length === 0 ? (
    <p className="data-unavailable">{text.assetsEmpty}</p>
  ) : (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <tbody>
          {rows.map((asset) => (
            <tr key={asset.asset_id}>
              <td><code dir="ltr">{asset.asset_id}</code></td>
              <td><span className={asset.ready ? 'asset-status asset-status--ready' : 'asset-status asset-status--planned'}>{asset.state ?? '—'}</span></td>
              <td>{asset.ready ? text.ready : text.notReady}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ))

  const overview = (
    <div className="page-stack">
      <div className="dashboard-grid dashboard-grid--tracks">
        <article className="panel">
          <header className="panel__header"><h3>{text.identity}</h3></header>
          <div className="detail-fields">
            <div><span>{text.engine}</span><strong dir="ltr">{game.engine_name || game.engine_id}</strong></div>
            <div>
              <span>{text.engineImplementation}</span>
              <strong>
                {engineCheck
                  ? engineCheck.status === 'pass' ? text.engineImplemented : text.engineMissing
                  : text.engineUnknown}
              </strong>
            </div>
            <div><span>{text.status}</span><strong>{statusLabels[locale][game.status]}</strong></div>
            <div><span>{text.difficulty}</span><strong>{text.difficulties[game.difficulty] ?? game.difficulty}</strong></div>
            <div><span>{text.age}</span><strong>{game.age_min}–{game.age_max} {text.years}</strong></div>
            <div><span>{text.packVersion}</span><strong dir="ltr">{pack ? pack.pack_version : text.packMissing}</strong></div>
            <div><span>{text.levels}</span><strong>{pack?.levels?.length ?? 0}</strong></div>
          </div>
          <div className="detail-panel-pad">
            <span>{text.modes}</span>
            <div className="badge-row">
              {modes.length ? modes.map((mode) => <span className="track-badge" dir="ltr" key={mode}>{mode}</span>) : <span className="data-unavailable">—</span>}
            </div>
          </div>
        </article>

        <article className="panel">
          <header className="panel__header"><h3>{text.objective}</h3></header>
          <div className="detail-panel-pad">
            {objective ? (
              <div className="detail-fields">
                <div><span>{text.objectiveCode}</span><strong dir="ltr">{objective.code}</strong></div>
                <div><span>{text.objective}</span><strong>{objective.title_ar}</strong></div>
                <div><span>{text.criteria}</span><strong>{objective.measurable_criteria || '—'}</strong></div>
                <div><span>{text.skillsPrimary}</span><strong>{objective.skill_name || objective.skill_id || text.noSkill}</strong></div>
              </div>
            ) : <p className="inline-alert inline-alert--error">{text.noObjective}</p>}
          </div>
          <div className="detail-panel-pad">
            <span>{text.skills} <small>({text.skillsFromReadiness})</small></span>
            <p className="table-secondary" dir="ltr">{skillsCheck?.detail ?? '—'}</p>
          </div>
        </article>
      </div>

      <div className="dashboard-grid dashboard-grid--tracks">
        <article className="panel">
          <header className="panel__header"><h3>{text.localization}</h3></header>
          <div className="detail-panel-pad">
            {localizationChecks.length === 0 ? <p className="data-unavailable">—</p> : (
              <ul className="detail-list">
                {localizationChecks.map((check) => (
                  <li key={check.id}>
                    <span className={`readiness-status readiness-status--${check.status}`} aria-hidden="true">
                      {check.status === 'pass' ? '✓' : check.status === 'blocked' ? '✕' : check.status === 'warn' ? '!' : '–'}
                    </span>
                    {' '}{check.label_ar} — {check.detail ?? '—'}
                  </li>
                ))}
              </ul>
            )}
            <span>{text.promptKeys}</span>
            <ul className="detail-list">
              {promptKeys.length ? promptKeys.map((key) => <li key={key}><code dir="ltr">{key}</code></li>) : <li className="data-unavailable">—</li>}
            </ul>
          </div>
        </article>

        <article className="panel">
          <header className="panel__header"><h3>{text.accessibility}</h3></header>
          <div className="detail-fields">
            <div>
              <span>{text.simplified}</span>
              <strong dir="ltr">{simplified ? `${simplified.tolerance_dp}dp · ${simplified.coverage_required}` : text.notDeclared}</strong>
            </div>
            <div>
              <span>{text.sequentialTap}</span>
              <strong>{pack?.accessibility?.sequential_tap_alternative === true ? text.declared : text.notDeclared}</strong>
            </div>
            <div>
              <span>{text.reducedMotion}</span>
              <strong>{pack?.accessibility?.reduced_motion_supported === true ? text.declared : text.notDeclared}</strong>
            </div>
            <div>
              <span>{text.minTouch}</span>
              <strong dir="ltr">{pack?.accessibility?.min_touch_target_dp ? `${pack.accessibility.min_touch_target_dp}dp` : '—'}</strong>
            </div>
          </div>
          <div className="detail-panel-pad">
            <span>{text.review}</span>
            <p>
              {review
                ? <>
                    <strong dir="ltr">{review.status}</strong>
                    {review.reviewer ? ` · ${text.reviewer}: ${review.reviewer}` : ''}
                    {review.reviewed_at ? ` · ${review.reviewed_at}` : ''}
                  </>
                : reviewCheck?.status === 'not_applicable' ? text.reviewNotRequired : '—'}
            </p>
            {reviewCheck && reviewCheck.status === 'blocked' && (
              <p className="inline-alert inline-alert--error">{reviewCheck.detail}</p>
            )}
          </div>
        </article>
      </div>

      <div className="dashboard-grid dashboard-grid--tracks">
        <article className="panel">
          <header className="panel__header"><h3>{text.assets}</h3></header>
          <div className="detail-panel-pad">{assetTable(artAssets)}</div>
        </article>
        <article className="panel">
          <header className="panel__header"><h3>{text.audio}</h3></header>
          <div className="detail-panel-pad">{assetTable(audioAssets)}</div>
        </article>
      </div>

      <section className="panel">
        <header className="panel__header"><h3>{text.blockers}</h3></header>
        <div className="detail-panel-pad">
          {!readiness ? <p className="data-unavailable">{text.blockersUnknown}</p>
            : readiness.publishable ? <p className="inline-alert inline-alert--info">{text.noBlockers}</p>
              : (
                <ul className="planned-list">
                  {readiness.blocking_reasons.map((reason) => <li className="pack-issue pack-issue--error" key={reason}>{reason}</li>)}
                </ul>
              )}
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.instructions}</h3></header>
        <div className="detail-panel-pad">{game.instructions_ar || <span className="data-unavailable">—</span>}</div>
      </section>
    </div>
  )

  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[
          { label: text.breadcrumb, to: adminPath('library-content') },
          { label: text.kind },
          { label: game.title_ar },
        ]}
        thumbnail={<Cover assetId={game.cover_asset_id} alt={text.coverAlt(game.title_ar)} />}
        title={game.title_ar}
        subtitle={objective?.title_ar ?? undefined}
        meta={<>
          <span dir="ltr">{game.engine_name || game.engine_id}</span>
          <span>{game.age_min}–{game.age_max} {text.years}</span>
          <span>{text.difficulties[game.difficulty] ?? game.difficulty}</span>
          {pack && <span dir="ltr">{pack.levels?.length ?? 0} × {text.levels}</span>}
        </>}
        status={<StatusBadge status={game.status} />}
        actions={
          <Link className="button button--secondary" to={adminPath(`library-content/games/${game.id}`)}>
            <Icon name="arrow" size={16} />{text.openLibrary}
          </Link>
        }
      />

      <DetailTabs tabs={[
        { key: 'overview', label: text.tabs.overview, content: overview },
        {
          key: 'pack',
          label: text.tabs.pack,
          badge: pack?.levels?.length ?? enginePack?.levels?.length,
          // أي محرّر حزمة يُعرض: محرّر trace_color المتخصّص أم المحرّر العام.
          //
          // الفصل بـengine_id لا بوجود حزمة مُحلَّلة: الحزمة قد تكون فارغة أو
          // من إصدار سابق لا يُحلَّل، وصفّ اللعبة هو الجهة التي تعرف محرّكها.
          // كان هذا الشرط يقرأ اسمًا غير معرَّف (`isTraceColor`) فكان بناء
          // الواجهة كلها يفشل بـTS2304 — أي أن اللوحة لم تكن قابلة للبناء.
          content: game.engine_id === 'trace_color' ? (
            <GamePackForm
              gameId={game.id}
              packId={pack?.pack_id ?? game.id}
              pack={pack}
              onSaved={(next) => { setPack(next); void loadReadiness() }}
            />
          ) : (
            /* المحرّكات الأحد عشر الأخرى: نفس التدفّق ونفس الظرف، ومحرّر مستوى
               خاصّ بكل محرّك. الفصل بـengine_id لا بشكل الحزمة: الحزمة قد تكون
               فارغة أو من إصدار سابق، وصفّ اللعبة هو من يعرف محرّكها. */
            <EnginePackForm
              gameId={game.id}
              engineId={game.engine_id}
              packId={enginePack?.pack_id ?? game.id}
              pack={enginePack}
              ageMin={game.age_min}
              ageMax={game.age_max}
              hasLearningObjective={Boolean(game.learning_objective_id)}
              gameSupervisionLevel={game.supervision_level}
              onSaved={(next) => { setEnginePack(next); void loadReadiness() }}
            />
          ),
        },
        { key: 'preview', label: text.tabs.preview, content: <GamePreviewPanel gameId={game.id} /> },
        {
          key: 'readiness',
          label: text.tabs.readiness,
          badge: readiness && !readiness.publishable ? readiness.blocking_reasons.length : undefined,
          content: <PublishReadinessPanel gameId={game.id} onLoaded={setReadiness} />,
        },
        { key: 'languages', label: text.tabs.languages, content: <GameLocalizationPanel gameId={game.id} /> },
      ]} />
    </div>
  )
}
