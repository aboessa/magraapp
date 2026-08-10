/**
 * طابور إنتاج الرسوم: كل صورة يحتاجها الكتالوج، بدورها وبمواصفتها وبموجزها.
 *
 * ## لماذا الدور لا اسم الملفّ
 *
 * الخادم يحدّد دور كل أصل من **الحقل الذي سمّاه**: `coloring.template_asset`
 * قالب تلوين، و`map.image` خريطة أساس، و`panels[].image` لوحة تسلسل. اسم الملفّ
 * عُرف يتغيّر؛ الحقل عقد. والدور هو ما يحمل المواصفة والموجز: رسّام يحتاج أن
 * يفتح مستندًا ليعرف أن البطاقة 512×512 سيفتحه أحيانًا ولن يفتحه أحيانًا.
 *
 * ## الغلاف ليس في الحزمة
 *
 * غلاف اللعبة صفٌّ في `asset_links` لا حقل في `content_pack`. الخادم يضيفه إلى
 * الطابور لأن لعبة بلا غلاف تعني بلاطة فارغة في مكتبة طفل — وهو عيب يصل إلى وليّ
 * أمر قبل أن يصل إلى متتبّع أخطاء.
 *
 * ## القيود التي يعرضها العائق
 *
 * أصل مقيَّد بلغة لا يمكن إعادة استخدامه في بناء آخر، ودورٌ لا يسمح بنصّ داخل
 * الصورة لا يجوز تقييده بلغة أصلًا. الخادم يحسب هذين ويعرضهما كعائق مكتوب، وهذه
 * الشاشة تعرضه كما ورد بلا إعادة صياغة.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { engineLabel } from '../lib/enginePack'
import { AssetThumb } from '../components/games/engines/fields'
import type { ArtQueueEnvelope, ArtQueueSummary, ProductionStatus } from '../types/enginePack'

/// الأدوار كما يعرّفها `api/src/lib/artProductionQueue.ts`. تُستخدم لبناء قائمة
/// التصفية فقط؛ الاسم المعروض يأتي من الخادم في `role_label_ar` فلا تُترجم هنا
/// مرتين.
const ROLES = [
  'tracing_reference', 'colouring_art', 'template', 'cover',
  'game_illustration', 'map_base', 'character', 'background',
]

const GAME_STATUSES = ['draft', 'writing', 'review_lang', 'production', 'qa', 'ready', 'scheduled', 'published']

const copy = {
  ar: {
    eyebrow: 'الإنتاج',
    title: 'طابور إنتاج الرسوم',
    lede: 'كل صورة يشير إليها الكتالوج بدورها ومواصفتها وموجزها. الدور يأتي من الحقل الذي سمّى الأصل، لا من اسم الملفّ.',
    refresh: 'تحديث',
    loading: 'جارٍ حساب الرسوم المطلوبة...',
    loadError: 'تعذر تحميل طابور الرسوم',
    filters: 'التصفية',
    role: 'الدور',
    allRoles: 'كل الأدوار',
    gameStatus: 'حالة اللعبة',
    allStatuses: 'كل الحالات',
    production: 'حالة الإنتاج',
    allProduction: 'الكل',
    statuses: { missing: 'لم يُرسم', pending: 'قيد الإنتاج', ready: 'جاهز' } as Record<ProductionStatus, string>,
    summaryFiltered: 'المعروض',
    summaryCatalogue: 'الكتالوج كاملًا',
    total: 'أصل',
    languageLocked: 'مقيَّد بلغة',
    byRole: 'حسب الدور',
    gamesCovered: (count: number) => `${count} لعبة`,
    rows: 'الأصول',
    asset: 'الأصل',
    game: 'اللعبة',
    level: 'المستوى',
    packWide: 'الحزمة كاملة',
    spec: 'المواصفة',
    aspect: 'النسبة',
    size: 'المقاس',
    format: 'الصيغة',
    languageDependency: 'اللغة',
    languageNone: 'محايد لغويًا',
    brief: 'الموجز',
    state: 'الحالة',
    owner: 'المالك',
    ownerHint: 'من رفع الأصل — وهي الملكية الوحيدة التي تسجّلها قاعدة البيانات.',
    review: 'المراجعة',
    reviewStates: {
      no_review_record: 'لا سجلّ',
      pending: 'معلَّقة',
      approved: 'معتمدة',
      rejected: 'مرفوضة',
      needs_changes: 'تحتاج تعديلًا',
    } as Record<string, string>,
    blocker: 'العائق',
    empty: 'لا أصول مطابقة للتصفية.',
  },
  en: {
    eyebrow: 'Production',
    title: 'Art production queue',
    lede: 'Every image the catalogue references, with its role, geometry and brief. The role comes from the field that named the asset, not from the file name.',
    refresh: 'Refresh',
    loading: 'Deriving the required artwork...',
    loadError: 'Unable to load the art queue',
    filters: 'Filters',
    role: 'Role',
    allRoles: 'All roles',
    gameStatus: 'Game status',
    allStatuses: 'All statuses',
    production: 'Production state',
    allProduction: 'All',
    statuses: { missing: 'Not drawn', pending: 'In production', ready: 'Ready' } as Record<ProductionStatus, string>,
    summaryFiltered: 'Shown',
    summaryCatalogue: 'Whole catalogue',
    total: 'assets',
    languageLocked: 'language locked',
    byRole: 'By role',
    gamesCovered: (count: number) => `${count} game(s)`,
    rows: 'Assets',
    asset: 'Asset',
    game: 'Game',
    level: 'Level',
    packWide: 'Whole pack',
    spec: 'Specification',
    aspect: 'Aspect',
    size: 'Size',
    format: 'Format',
    languageDependency: 'Language',
    languageNone: 'Language neutral',
    brief: 'Brief',
    state: 'State',
    owner: 'Owner',
    ownerHint: 'Whoever uploaded the asset — the only ownership the database records.',
    review: 'Review',
    reviewStates: {
      no_review_record: 'No record',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      needs_changes: 'Needs changes',
    } as Record<string, string>,
    blocker: 'Blocker',
    empty: 'No assets match the filters.',
  },
}

function SummaryChips({ summary, label }: { summary: ArtQueueSummary; label: string }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  return (
    <div className="production-summary">
      <span className="production-chip"><strong dir="ltr">{summary.total}</strong> {label} · {text.total}</span>
      <span className="production-chip production-chip--ready"><strong dir="ltr">{summary.ready}</strong> {text.statuses.ready}</span>
      <span className="production-chip production-chip--pending"><strong dir="ltr">{summary.pending}</strong> {text.statuses.pending}</span>
      <span className="production-chip production-chip--missing"><strong dir="ltr">{summary.missing}</strong> {text.statuses.missing}</span>
      <span className="production-chip"><strong dir="ltr">{summary.language_locked}</strong> {text.languageLocked}</span>
    </div>
  )
}

export function ArtProductionQueuePage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [data, setData] = useState<ArtQueueEnvelope | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [production, setProduction] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.gameArtQueue({
        role: role || undefined,
        status: status || undefined,
        production_status: production || undefined,
      })
      setData(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [role, status, production, text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading && !data) return <LoadingState label={text.loading} />
  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return null

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

      <section className="panel">
        <header className="panel__header panel__header--filters">
          <div><h3>{text.filters}</h3><p>{text.gamesCovered(data.games_covered)}</p></div>
          <div className="filters-row">
            <label className="field">
              <span>{text.role}</span>
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="">{text.allRoles}</option>
                {ROLES.map((value) => <option value={value} key={value}>{value}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.gameStatus}</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">{text.allStatuses}</option>
                {GAME_STATUSES.map((value) => <option value={value} key={value}>{value}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.production}</span>
              <select value={production} onChange={(event) => setProduction(event.target.value)}>
                <option value="">{text.allProduction}</option>
                <option value="missing">{text.statuses.missing}</option>
                <option value="pending">{text.statuses.pending}</option>
                <option value="ready">{text.statuses.ready}</option>
              </select>
            </label>
          </div>
        </header>
        <div className="entity-form">
          <SummaryChips summary={data.summary} label={text.summaryFiltered} />
          <SummaryChips summary={data.catalogue_summary} label={text.summaryCatalogue} />
          <h4>{text.byRole}</h4>
          <div className="production-summary">
            {Object.entries(data.catalogue_summary.by_role).map(([key, bucket]) => (
              <span className="production-chip" key={key}>
                <strong dir="ltr">{key}</strong>
                <span dir="ltr">{bucket.ready}/{bucket.total}</span>
                {bucket.missing > 0 && <small className="production-status production-status--missing">{bucket.missing}</small>}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.rows} <span className="title-count">{data.rows.length}</span></h3></header>
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{text.asset}</th>
                <th>{text.role}</th>
                <th>{text.game}</th>
                <th>{text.level}</th>
                <th>{text.spec}</th>
                <th>{text.languageDependency}</th>
                <th>{text.brief}</th>
                <th>{text.state}</th>
                <th>{text.owner}</th>
                <th>{text.review}</th>
                <th>{text.blocker}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={`${row.game_id}-${row.asset_id}-${index}`}>
                  <td>
                    {/* المعاينة الفعلية: صفٌّ يقول «جاهز» وصورته لا تُقرأ عيبٌ
                        لا يظهر في أي عمود حالة. */}
                    <AssetThumb assetId={row.asset_id} size={48} />
                    <code dir="ltr">{row.asset_id}</code>
                  </td>
                  <td>
                    <strong>{row.role_label_ar}</strong>
                    <small dir="ltr">{row.role}</small>
                  </td>
                  <td>
                    <Link to={adminPath(`games/${row.game_id}`)}>{row.game_title}</Link>
                    <small>{engineLabel(row.engine_id, locale)} · <span dir="ltr">{row.game_status}</span></small>
                  </td>
                  <td dir="ltr">{row.level ?? text.packWide}</td>
                  <td dir="ltr">
                    <small>{text.aspect}: {row.expected_aspect_ratio}</small>
                    <small>{text.size}: {row.expected_size ?? '—'}</small>
                    <small>{text.format}: {row.expected_format}</small>
                  </td>
                  <td>{row.language_dependency
                    ? <span className="library-pill library-pill--paid" dir="ltr">{row.language_dependency}</span>
                    : <span className="table-secondary">{text.languageNone}</span>}</td>
                  <td className="production-brief">{row.brief}</td>
                  <td>
                    <span className={`production-status production-status--${row.production_status}`}>
                      {text.statuses[row.production_status]}
                    </span>
                    {row.asset_status && <small dir="ltr"> {row.asset_status}</small>}
                  </td>
                  <td title={text.ownerHint}>{row.assigned_owner ?? '—'}</td>
                  <td>
                    <span className="track-badge">{text.reviewStates[row.review_status] ?? row.review_status}</span>
                    <small dir="ltr"> {row.review_role}</small>
                  </td>
                  <td className="production-brief">{row.blocker ?? '—'}</td>
                </tr>
              ))}
              {!data.rows.length && <tr><td colSpan={11} className="data-unavailable">{text.empty}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
