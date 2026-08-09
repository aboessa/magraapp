/**
 * طابور إنتاج الصوت: كل مقطع يحتاجه الكتالوج، سُجِّل أو لم يُسجَّل.
 *
 * ## العلّة التي يُغلقها
 *
 * قبل هذا المسار كان الصوت رقمًا: «٣ تسجيلات غير جاهزة» مع ثلاثة معرّفات أصول.
 * وهذا يكفي لمعرفة أن لعبة محجوبة ولا يكفي لتسجيل شيء: استوديو صوت لا يعمل من
 * `asset-vo-tc-intro`، بل يحتاج أن يعرف أي جملة، بأي لغة، لأي مستوى، وماذا يجب
 * أن يسمع الطفل.
 *
 * وأسوأ من ذلك أن الرقم كان يرى فقط المعرّفات التي **رُبطت بالحزمة أصلًا**، فمقطع
 * لم يفكّر فيه أحد لم يكن يظهر ناقصًا — لم يكن يظهر إطلاقًا. الخادم الآن يشتقّ
 * المطلوب من عقد المحرّك (عشرون مقطعًا منفصلًا لأرقام العدّ مثلًا)، وهذه الشاشة
 * تعرضه كما ورد.
 *
 * ## لا شيء يُعرض جاهزًا وهو ليس كذلك
 *
 * `production_status` يأتي من الخادم: `ready` فقط عندما تكون حالة الأصل `ready`،
 * وأي حالة أخرى — بما فيها `failed` — تُعرض `pending` مع الحالة الخام بجانبها.
 * لا تُحسَب نسبة تقدّم في الواجهة ولا يُخمَّن شيء.
 *
 * ## اللغة غير العربية لا ترث المقطع العربي
 *
 * وقت التشغيل يعود إلى التسجيل العربي عند غياب ترجمة، وهو الصحيح للتشغيل والخطأ
 * للإنتاج. صفٌّ فرنسي بلا تسجيل فرنسي يُعرض «مفقود» لأنه مفقود.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { engineLabel } from '../lib/enginePack'
import type { AudioQueueEnvelope, AudioQueueSummary, ProductionStatus } from '../types/enginePack'

const copy = {
  ar: {
    eyebrow: 'الإنتاج',
    title: 'طابور إنتاج الصوت',
    lede: 'كل مقطع يحتاجه الكتالوج مشتقًّا من عقود المحرّكات، لا من المفاتيح التي رُبطت بالحزم. المقطع الذي لم يفكّر فيه أحد يظهر هنا مفقودًا.',
    refresh: 'تحديث',
    loading: 'جارٍ حساب المقاطع المطلوبة...',
    loadError: 'تعذر تحميل طابور الصوت',
    filters: 'التصفية',
    language: 'اللغة',
    allLanguages: 'كل اللغات',
    gameStatus: 'حالة اللعبة',
    allStatuses: 'كل الحالات',
    production: 'حالة الإنتاج',
    allProduction: 'الكل',
    statuses: { missing: 'مفقود', pending: 'قيد الإنتاج', ready: 'جاهز' } as Record<ProductionStatus, string>,
    requiredOnly: 'المفروض فقط',
    summaryFiltered: 'المعروض',
    summaryCatalogue: 'الكتالوج كاملًا',
    total: 'مقطع',
    required: 'مفروض',
    optional: 'اختياري',
    outstanding: 'مفروض وغير جاهز',
    gamesCovered: (count: number) => `${count} لعبة`,
    byLanguage: 'حسب اللغة',
    rows: 'المقاطع',
    voiceKey: 'المفتاح',
    sourceText: 'النصّ المصدر',
    sourceOrigin: { localization: 'من الترجمة', pack: 'نصّ في الحزمة' } as Record<string, string>,
    noSource: 'لا نصّ مكتوب',
    noSourceHint: 'لا يُولَّد نصّ هنا: مقطع بلا نصّ بشري لا يُسجَّل، والاختراع يعني أداءً لجملة لم يعتمدها أحد.',
    kind: 'نوع الأصل',
    game: 'اللعبة',
    level: 'المستوى',
    packWide: 'الحزمة كاملة',
    requirement: 'الإلزام',
    asset: 'الأصل',
    assetState: 'حالة الأصل',
    review: 'المراجعة',
    reviewStates: {
      no_review_record: 'لا سجلّ',
      pending: 'معلَّقة',
      approved: 'معتمدة',
      rejected: 'مرفوضة',
      needs_changes: 'تحتاج تعديلًا',
    } as Record<string, string>,
    blocker: 'العائق',
    purpose: 'الغرض',
    empty: 'لا مقاطع مطابقة للتصفية.',
    open: 'افتح اللعبة',
    textKey: 'مفتاح النصّ',
  },
  en: {
    eyebrow: 'Production',
    title: 'Voice-over production queue',
    lede: 'Every clip the catalogue needs, derived from the engine contracts rather than from the keys packs happen to bind. A clip nobody has thought of shows up here as missing.',
    refresh: 'Refresh',
    loading: 'Deriving the required clips...',
    loadError: 'Unable to load the audio queue',
    filters: 'Filters',
    language: 'Language',
    allLanguages: 'All languages',
    gameStatus: 'Game status',
    allStatuses: 'All statuses',
    production: 'Production state',
    allProduction: 'All',
    statuses: { missing: 'Missing', pending: 'In production', ready: 'Ready' } as Record<ProductionStatus, string>,
    requiredOnly: 'Mandatory only',
    summaryFiltered: 'Shown',
    summaryCatalogue: 'Whole catalogue',
    total: 'clips',
    required: 'mandatory',
    optional: 'optional',
    outstanding: 'mandatory and not ready',
    gamesCovered: (count: number) => `${count} game(s)`,
    byLanguage: 'By language',
    rows: 'Clips',
    voiceKey: 'Key',
    sourceText: 'Source text',
    sourceOrigin: { localization: 'From the translation', pack: 'Literal in the pack' } as Record<string, string>,
    noSource: 'No written text',
    noSourceHint: 'No text is generated here: a clip with no human-written line is not recorded, and inventing one means performing a line nobody approved.',
    kind: 'Asset kind',
    game: 'Game',
    level: 'Level',
    packWide: 'Whole pack',
    requirement: 'Requirement',
    asset: 'Asset',
    assetState: 'Asset state',
    review: 'Review',
    reviewStates: {
      no_review_record: 'No record',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      needs_changes: 'Needs changes',
    } as Record<string, string>,
    blocker: 'Blocker',
    purpose: 'Purpose',
    empty: 'No clips match the filters.',
    open: 'Open the game',
    textKey: 'Text key',
  },
}

/// حالات اللعبة التي يعرفها الكتالوج. تُعرض كما هي بلا ترجمة: هي مفردات الخادم،
/// وترجمتها هنا تخلق قائمة ثانية تنحرف عند إضافة حالة.
const GAME_STATUSES = ['draft', 'writing', 'review_lang', 'production', 'qa', 'ready', 'scheduled', 'published']

function SummaryChips({ summary, label }: { summary: AudioQueueSummary; label: string }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  return (
    <div className="production-summary">
      <span className="production-chip"><strong dir="ltr">{summary.total}</strong> {label} · {text.total}</span>
      <span className="production-chip production-chip--ready"><strong dir="ltr">{summary.ready}</strong> {text.statuses.ready}</span>
      <span className="production-chip production-chip--pending"><strong dir="ltr">{summary.pending}</strong> {text.statuses.pending}</span>
      <span className="production-chip production-chip--missing"><strong dir="ltr">{summary.missing}</strong> {text.statuses.missing}</span>
      <span className="production-chip"><strong dir="ltr">{summary.required}</strong> {text.required}</span>
      <span className="production-chip"><strong dir="ltr">{summary.optional}</strong> {text.optional}</span>
      <span className="production-chip production-chip--missing"><strong dir="ltr">{summary.required_outstanding}</strong> {text.outstanding}</span>
    </div>
  )
}

export function AudioProductionQueuePage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [data, setData] = useState<AudioQueueEnvelope | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState('')
  const [status, setStatus] = useState('')
  const [production, setProduction] = useState('')
  const [requiredOnly, setRequiredOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // التصفية تُنفَّذ على الخادم لا في الواجهة: الطابور على مستوى الكتالوج
      // كامل قد يكون آلاف الصفوف، وترشيحها بعد تحميلها كلها يعني تحميلها كلها.
      const response = await api.gameAudioQueue({
        language: language || undefined,
        status: status || undefined,
        production_status: production || undefined,
        required: requiredOnly ? 'true' : undefined,
      })
      setData(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [language, status, production, requiredOnly, text.loadError])

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
              <span>{text.language}</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="">{text.allLanguages}</option>
                {data.languages.map((code) => <option value={code} key={code}>{code}</option>)}
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
            <label className="checkbox-control">
              <input type="checkbox" checked={requiredOnly} onChange={(event) => setRequiredOnly(event.target.checked)} />
              <span>{text.requiredOnly}</span>
            </label>
          </div>
        </header>
        <div className="entity-form">
          <SummaryChips summary={data.summary} label={text.summaryFiltered} />
          <SummaryChips summary={data.catalogue_summary} label={text.summaryCatalogue} />
          <h4>{text.byLanguage}</h4>
          <div className="production-summary">
            {Object.entries(data.catalogue_summary.by_language).map(([code, bucket]) => (
              <span className="production-chip" key={code}>
                <strong dir="ltr">{code}</strong>
                <span dir="ltr">{bucket.ready}/{bucket.total}</span>
                {bucket.missing > 0 && <small className="production-status production-status--missing">{bucket.missing}</small>}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.rows} <span className="title-count">{data.rows.length}</span></h3></header>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{text.language}</th>
                <th>{text.voiceKey}</th>
                <th>{text.sourceText}</th>
                <th>{text.kind}</th>
                <th>{text.game}</th>
                <th>{text.level}</th>
                <th>{text.requirement}</th>
                <th>{text.asset}</th>
                <th>{text.production}</th>
                <th>{text.review}</th>
                <th>{text.blocker}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={`${row.game_id}-${row.language}-${row.voice_key}-${row.level ?? 'pack'}-${index}`}>
                  <td dir="ltr">{row.language}</td>
                  <td>
                    <code dir="ltr">{row.voice_key}</code>
                    <small className="production-brief">{row.purpose}</small>
                  </td>
                  <td>
                    {row.source_text
                      ? <>
                          <span>{row.source_text}</span>
                          <small> · {text.sourceOrigin[row.source_text_origin ?? ''] ?? ''}</small>
                        </>
                      : <span className="production-status production-status--missing" title={text.noSourceHint}>{text.noSource}</span>}
                    {row.text_key && <small dir="ltr"> {text.textKey}: {row.text_key}</small>}
                  </td>
                  <td dir="ltr">{row.expected_asset_kind}</td>
                  <td>
                    <Link to={adminPath(`games/${row.game_id}`)}>{row.game_title}</Link>
                    <small>{engineLabel(row.engine_id, locale)} · <span dir="ltr">{row.game_status}</span></small>
                  </td>
                  <td dir="ltr">{row.level ?? text.packWide}</td>
                  <td>
                    <span className={row.requirement === 'required' ? 'library-pill library-pill--age' : 'library-pill'}>
                      {row.requirement === 'required' ? text.required : text.optional}
                    </span>
                  </td>
                  <td>{row.asset_id ? <code dir="ltr">{row.asset_id}</code> : '—'}</td>
                  <td>
                    <span className={`production-status production-status--${row.production_status}`}>
                      {text.statuses[row.production_status]}
                    </span>
                    {row.asset_status && <small dir="ltr"> {row.asset_status}</small>}
                  </td>
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
