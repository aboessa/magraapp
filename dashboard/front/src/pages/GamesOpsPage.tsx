/**
 * لوحة عمليّات الألعاب: ما هو موجود، وما هو محجوب، وعلى من.
 *
 * ## لماذا هذه الصفحة
 *
 * `GET /admin/games/ops` يُقيّم جاهزية كل لعبة فعليًّا — بنفس الدالّة التي تحجب
 * النشر — ثم يبوّبها. السؤال الذي يجيب عنه لا يجيب عنه عمود `status`: مسوّدة كل
 * أصولها مُنتَجة وكل مراجعاتها معتمدة تبعد خطوة عن النشر، ومسوّدة بلا رسوم تبعد
 * ربع سنة. عرضهما كرقم واحد هو كيف تُبنى خطّة على عمود حالة.
 *
 * ## الدلاء ليست تقسيمًا
 *
 * لعبة واحدة قد تكون ناقصة الرسوم والصوت ومراجعةً في الوقت نفسه، فتُحسَب في
 * الثلاثة. `blocked` هو العدد المتمايز. الخادم يقولها صراحةً، وهذه الشاشة تعرض
 * الاثنين ولا تخلطهما.
 *
 * ## «لم تُقيَّم» ليست «جاهزة»
 *
 * `publishable: null` تعني أن الجاهزية لم تُحسَب لهذه اللعبة. تُعرض كذلك بعلامة
 * خاصّة: تدويرها إلى «جاهزة» هو بالضبط الخطأ الذي يجعل لوحة كهذه ضارّة.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ErrorState, LoadingState } from '../components/PageState'
import { StatCard } from '../components/StatCard'
import { ARABIC_FONT_CHECK_ID, ArabicFontLicenceAlert } from '../components/games/ArabicFontLicenceAlert'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { engineLabel } from '../lib/enginePack'
import type { GamesOpsOverview, ReadinessBucket } from '../types/enginePack'

const copy = {
  ar: {
    eyebrow: 'عمليّات المحتوى',
    title: 'عمليّات الألعاب',
    lede: 'كل رقم هنا محسوب من فحص الجاهزية نفسه الذي يحجب النشر، لا من عمود الحالة.',
    refresh: 'تحديث',
    loading: 'جارٍ حساب الجاهزية لكل لعبة...',
    loadError: 'تعذر تحميل لوحة العمليّات',
    total: 'الألعاب',
    totalHint: 'كل ما ليس مؤرشفًا',
    publishable: 'قابلة للنشر',
    publishableHint: 'لا عائق واحد',
    drafts: 'مسوّدات',
    draftsHint: 'حالتها draft',
    published: 'منشورة',
    publishedHint: 'حالتها published',
    awaitingReview: 'بانتظار مراجعة',
    awaitingReviewHint: 'لها صفّ مراجعة معلَّق',
    coverage: 'تغطية المحرّكات',
    coverageValue: (implemented: number, total: number) => `${implemented}/${total}`,
    coverageHint: 'محرّكات الكتالوج التي لها عقد وقت تشغيل هنا',
    coverageMissing: 'محرّكات في الكتالوج بلا تنفيذ في هذا الإصدار',
    coverageUnregistered: 'تنفيذات بلا صفّ في الكتالوج',
    buckets: 'دلاء الجاهزية',
    bucketsHint: 'لعبة واحدة قد تظهر في أكثر من دلو. «محجوبة» هو العدد المتمايز.',
    bucketNames: {
      ready: 'لا عائق',
      blocked: 'محجوبة',
      missing_assets: 'رسوم ناقصة',
      missing_audio: 'صوت ناقص',
      missing_localization: 'ترجمة ناقصة',
      missing_review: 'مراجعة ناقصة',
      engine_not_implemented: 'محرّك غير منفَّذ',
    } as Record<ReadinessBucket, string>,
    unevaluated: 'لم تُقيَّم',
    unevaluatedHint: 'لم يُحسَب لها فحص جاهزية. لا تُقرأ كجاهزة.',
    byPlanet: 'حسب الكوكب',
    byEngine: 'حسب المحرّك',
    byTrack: 'حسب المسار العمري',
    byStatus: 'حسب الحالة',
    unassigned: 'بلا كوكب',
    notImplemented: 'غير منفَّذ',
    topBlockers: 'أكثر العوائق تكرارًا',
    blockerCheck: 'الفحص',
    blockerGames: 'ألعاب',
    blockerOwners: 'المسؤول',
    owners: {
      editor: 'محرّر المحتوى',
      engineering: 'الهندسة',
      reviewer: 'مراجع',
      production: 'الإنتاج',
      provider: 'مزوّد خارجي',
    } as Record<string, string>,
    games: 'الألعاب',
    game: 'اللعبة',
    engine: 'المحرّك',
    status: 'الحالة',
    age: 'العمر',
    tracks: 'المسارات',
    verdict: 'الجاهزية',
    yes: 'قابلة للنشر',
    no: 'محجوبة',
    unknown: 'لم تُقيَّم',
    reasons: 'العوائق',
    filter: 'تصفية بالدلو',
    all: 'الكل',
    open: 'افتح',
    empty: 'لا ألعاب مطابقة.',
  },
  en: {
    eyebrow: 'Content operations',
    title: 'Games operations',
    lede: 'Every number here comes from the same readiness evaluation that blocks publication, not from a status column.',
    refresh: 'Refresh',
    loading: 'Evaluating readiness for every game...',
    loadError: 'Unable to load the operations board',
    total: 'Games',
    totalHint: 'Everything not archived',
    publishable: 'Publishable',
    publishableHint: 'Not one blocker',
    drafts: 'Drafts',
    draftsHint: 'Status draft',
    published: 'Published',
    publishedHint: 'Status published',
    awaitingReview: 'Awaiting review',
    awaitingReviewHint: 'Has a pending review row',
    coverage: 'Engine coverage',
    coverageValue: (implemented: number, total: number) => `${implemented}/${total}`,
    coverageHint: 'Catalogue engines with a runtime contract here',
    coverageMissing: 'Catalogue engines with no implementation in this deployment',
    coverageUnregistered: 'Implementations with no catalogue row',
    buckets: 'Readiness buckets',
    bucketsHint: 'One game may appear in several buckets. "Blocked" is the distinct count.',
    bucketNames: {
      ready: 'No blocker',
      blocked: 'Blocked',
      missing_assets: 'Missing artwork',
      missing_audio: 'Missing audio',
      missing_localization: 'Missing localization',
      missing_review: 'Missing review',
      engine_not_implemented: 'Engine not implemented',
    } as Record<ReadinessBucket, string>,
    unevaluated: 'Unevaluated',
    unevaluatedHint: 'No readiness was computed. Never read as ready.',
    byPlanet: 'By planet',
    byEngine: 'By engine',
    byTrack: 'By age track',
    byStatus: 'By status',
    unassigned: 'No planet',
    notImplemented: 'Not implemented',
    topBlockers: 'Most frequent blockers',
    blockerCheck: 'Check',
    blockerGames: 'Games',
    blockerOwners: 'Owner',
    owners: {
      editor: 'Content editor',
      engineering: 'Engineering',
      reviewer: 'Reviewer',
      production: 'Production',
      provider: 'External provider',
    } as Record<string, string>,
    games: 'Games',
    game: 'Game',
    engine: 'Engine',
    status: 'Status',
    age: 'Age',
    tracks: 'Tracks',
    verdict: 'Readiness',
    yes: 'Publishable',
    no: 'Blocked',
    unknown: 'Unevaluated',
    reasons: 'Blockers',
    filter: 'Filter by bucket',
    all: 'All',
    open: 'Open',
    empty: 'No matching games.',
  },
}

const BUCKET_ORDER: ReadinessBucket[] = [
  'ready', 'blocked', 'missing_assets', 'missing_audio',
  'missing_localization', 'missing_review', 'engine_not_implemented',
]

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone?: 'ok' | 'warn' | 'danger' }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="ops-bar">
      <span>{label}</span>
      <span className="ops-bar__track">
        <span className={tone ? `ops-bar__fill ops-bar__fill--${tone}` : 'ops-bar__fill'} style={{ width: `${percent}%` }} />
      </span>
      <strong dir="ltr">{value}</strong>
    </div>
  )
}

export function GamesOpsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [overview, setOverview] = useState<GamesOpsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bucket, setBucket] = useState<ReadinessBucket | ''>('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.gamesOps()
      setOverview(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  const fontBlocker = useMemo(
    () => overview?.top_blockers.find((entry) => entry.check_id === ARABIC_FONT_CHECK_ID) ?? null,
    [overview],
  )

  const rows = useMemo(() => {
    if (!overview) return []
    if (!bucket) return overview.games
    return overview.games.filter((game) => game.buckets.includes(bucket))
  }, [overview, bucket])

  if (loading && !overview) return <LoadingState label={text.loading} />
  if (error && !overview) return <ErrorState message={error} onRetry={() => void load()} />
  if (!overview) return null

  const total = overview.total_games

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <button className="button button--secondary" type="button" onClick={() => void load()}>
          <Icon name="refresh" size={16} />{text.refresh}
        </button>
      </section>

      {/* الترخيص الخارجي أوّلًا: مهلته أطول من كل ما تحته، ولا يستطيع الفريق
          تقصيرها بأي جهد. */}
      {fontBlocker && <ArabicFontLicenceAlert state="blocked" games={fontBlocker.games} rightsHref={adminPath('rights')} />}

      <section className="stats-grid" aria-label={text.title}>
        <StatCard label={text.total} value={String(total)} description={text.totalHint} icon="games" />
        <StatCard label={text.publishable} value={String(overview.publishable_count)} description={text.publishableHint} icon="reviews" tone="cyan" />
        <StatCard label={text.drafts} value={String(overview.draft_count)} description={text.draftsHint} icon="episodes" tone="yellow" />
        <StatCard label={text.published} value={String(overview.published_count)} description={text.publishedHint} icon="analytics" tone="purple" />
        <StatCard label={text.awaitingReview} value={String(overview.games_awaiting_review)} description={text.awaitingReviewHint} icon="reviews" />
        <StatCard
          label={text.coverage}
          value={text.coverageValue(overview.engine_coverage.implemented, overview.engine_coverage.total)}
          description={text.coverageHint}
          icon="skills"
          tone="cyan"
        />
      </section>

      {(overview.engine_coverage.missing.length > 0 || overview.engine_coverage.unregistered.length > 0) && (
        <section className="panel">
          <header className="panel__header"><h3>{text.coverage}</h3></header>
          <div className="entity-form">
            {overview.engine_coverage.missing.length > 0 && (
              <div className="inline-alert inline-alert--error">
                <strong>{text.coverageMissing} ({overview.engine_coverage.missing.length})</strong>
                <p dir="ltr">{overview.engine_coverage.missing.join(', ')}</p>
              </div>
            )}
            {overview.engine_coverage.unregistered.length > 0 && (
              <div className="inline-alert inline-alert--info">
                <strong>{text.coverageUnregistered} ({overview.engine_coverage.unregistered.length})</strong>
                <p dir="ltr">{overview.engine_coverage.unregistered.join(', ')}</p>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="dashboard-grid dashboard-grid--tracks">
        <section className="panel">
          <header className="panel__header"><h3>{text.buckets}</h3><p>{text.bucketsHint}</p></header>
          <div className="entity-form">
            <div className="ops-bars">
              {BUCKET_ORDER.map((entry) => (
                <Bar
                  key={entry}
                  label={text.bucketNames[entry]}
                  value={overview.readiness_buckets[entry] ?? 0}
                  total={total}
                  tone={entry === 'ready' ? 'ok' : entry === 'blocked' ? 'danger' : 'warn'}
                />
              ))}
            </div>
            {overview.unevaluated_games > 0 && (
              <p className="inline-alert inline-alert--error">
                <strong>{text.unevaluated}: {overview.unevaluated_games}</strong> — {text.unevaluatedHint}
              </p>
            )}
          </div>
        </section>

        <section className="panel">
          <header className="panel__header"><h3>{text.topBlockers}</h3></header>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.blockerCheck}</th><th>{text.blockerGames}</th><th>{text.blockerOwners}</th></tr></thead>
              <tbody>
                {overview.top_blockers.map((entry) => (
                  <tr key={entry.check_id}>
                    <td><strong>{entry.label_ar}</strong><small dir="ltr">{entry.check_id}</small></td>
                    <td dir="ltr">{entry.games}</td>
                    <td>{entry.owners.map((owner) => (
                      <span className="track-badge" key={owner}>{text.owners[owner] ?? owner}</span>
                    ))}</td>
                  </tr>
                ))}
                {!overview.top_blockers.length && <tr><td colSpan={3} className="data-unavailable">—</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--tracks">
        <section className="panel">
          <header className="panel__header"><h3>{text.byPlanet}</h3></header>
          <div className="entity-form">
            <div className="ops-bars">
              {overview.by_planet.map((entry) => (
                <Bar key={entry.planet_id ?? 'none'} label={entry.planet_name ?? text.unassigned} value={entry.games} total={total} />
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <header className="panel__header"><h3>{text.byEngine}</h3></header>
          <div className="entity-form">
            <div className="ops-bars">
              {overview.by_engine.map((entry) => (
                <Bar
                  key={entry.engine_id}
                  label={`${engineLabel(entry.engine_id, locale)}${entry.implemented ? '' : ` — ${text.notImplemented}`}`}
                  value={entry.games}
                  total={total}
                  tone={entry.implemented ? undefined : 'danger'}
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--tracks">
        <section className="panel">
          <header className="panel__header"><h3>{text.byTrack}</h3></header>
          <div className="entity-form">
            <div className="ops-bars">
              {overview.by_age_track.map((entry) => (
                <Bar key={entry.track_id} label={entry.track_id} value={entry.games} total={total} />
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <header className="panel__header"><h3>{text.byStatus}</h3></header>
          <div className="entity-form">
            <div className="ops-bars">
              {overview.by_status.map((entry) => (
                <Bar key={entry.status} label={entry.status} value={entry.games} total={total} />
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <header className="panel__header panel__header--filters">
          <div><h3>{text.games} <span className="title-count">{rows.length}</span></h3></div>
          <label className="field">
            <span>{text.filter}</span>
            <select value={bucket} onChange={(event) => setBucket(event.target.value as ReadinessBucket | '')}>
              <option value="">{text.all}</option>
              {BUCKET_ORDER.map((entry) => (
                <option value={entry} key={entry}>{text.bucketNames[entry]} ({overview.readiness_buckets[entry] ?? 0})</option>
              ))}
            </select>
          </label>
        </header>
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{text.game}</th><th>{text.engine}</th><th>{text.status}</th>
                <th>{text.age}</th><th>{text.verdict}</th><th>{text.reasons}</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((game) => (
                <tr key={game.game_id}>
                  <td><strong>{game.title}</strong><small dir="ltr">{game.game_id}</small></td>
                  <td>{engineLabel(game.engine_id, locale)}</td>
                  <td dir="ltr">{game.status}</td>
                  <td dir="ltr">{game.age_min}–{game.age_max}<small> {game.age_tracks.join(', ')}</small></td>
                  <td>
                    {game.publishable === null
                      ? <span className="production-status">{text.unknown}</span>
                      : game.publishable
                        ? <span className="production-status production-status--ready">{text.yes}</span>
                        : <span className="production-status production-status--missing">{text.no}</span>}
                  </td>
                  <td>
                    {game.blocking_reasons.length === 0 ? '—' : (
                      <details className="readiness-items">
                        <summary>{game.blocking_reasons.length}</summary>
                        <ul className="planned-list">
                          {game.blocking_reasons.map((reason) => <li key={reason}>{reason}</li>)}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td>
                    <Link className="button button--ghost" to={adminPath(`games/${game.game_id}`)}>
                      <Icon name="arrow" size={15} />{text.open}
                    </Link>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="data-unavailable">{text.empty}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
