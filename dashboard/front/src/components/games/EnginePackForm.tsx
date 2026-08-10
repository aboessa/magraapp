/**
 * نموذج تأليف حزمة لأي محرّك غير `trace_color`: ظرفها ومستوياتها.
 *
 * ## العلّة التي يُغلقها
 *
 * `GamePackForm.tsx` بنى استوديو تأليف كاملًا — لكن لمحرّك واحد. الأحد عشر
 * الباقية بقيت كما كانت: `content_pack` عمود JSON يُحرَّر بلصق نصّ، أو لا يُحرَّر
 * أصلًا. النتيجة أن اثني عشر محرّكًا لها عقود وقت تشغيل ومخطَّطات وقواعد دلالية
 * كاملة في الخادم، وواحدًا منها فقط يستطيع محرّر محتوى أن يؤلّف له.
 *
 * ## لماذا ظرف واحد وأحد عشر محرّرًا
 *
 * الظرف (`pack_version` و`progression` و`voice_manifest` و`accessibility`
 * و`review` ...) يبنيه الخادم مرة واحدة في `packSchema.ts` لكل المحرّكات، فهو
 * هنا مرة واحدة أيضًا. ما يختلف هو المستوى، وهو ما يُفوَّض إلى محرّر المحرّك.
 * الفصل بهذا الحدّ بالضبط لأنه حدّ المخطَّط نفسه: أي حقل ظرف يُكرَّر في محرّر
 * محرّك سينحرف عن نسخته في الخادم.
 *
 * ## ما يُقفَل ولا يُخفى
 *
 * `supports_dpad` و`localization` يفرضهما عقد المحرّك، و`engine_id` يفرضه صفّ
 * اللعبة. تُعرض كقيم مقروءة مع سبب قفلها لا تُحجَب: محرّر لا يرى الحقل يظنّ
 * الميزة ناقصة ويبحث عنها في SQL، ومحرّر يراه قابلًا للتعديل يكتب قيمة يرفضها
 * الخادم. الثالث — أن يراه ويعرف لماذا لا يُعدَّل — هو الصحيح.
 *
 * ## JSON الخام يبقى، مُعلَنًا أنه للتشخيص
 *
 * حزمة قديمة أو حقل أضافه المخطَّط ولم يصل النموذج بعد يجب أن يبقى قابلًا
 * للقراءة والتصحيح. إخفاؤه كليًّا يعني ميزة ناقصة تُسدّ باستعلام SQL يدوي.
 * لكنه **ليس** مسار العمل: مطويّ، وموسوم «تشخيص»، ولا يحتاجه أي تدفّق معتاد.
 */

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../Icon'
import { usePreferences } from '../../context/preferences'
import { api, ApiError } from '../../lib/api'
import { MAX_LEVELS } from '../../lib/tracePack'
import {
  emptyEngineLevel,
  emptyEnginePack,
  engineContract,
  engineLabel,
  isObject,
} from '../../lib/enginePack'
import { engineIssues, requiredVoiceKeysFor } from '../../lib/enginePackIssues'
import type { EngineIssueContext } from '../../lib/enginePackIssues'
import { ADVANCE_ON, PACK_LOCALIZATIONS, REVIEW_STATUSES, SUPERVISION_LEVELS } from '../../types/gamePack'
import type { AdvanceOn, PackLocalization, PackSupervisionLevel } from '../../types/gamePack'
import { REVIEW_KINDS } from '../../types/enginePack'
import type {
  BlockCodeLevel,
  CountQuantityLevel,
  EngineLevelRecord,
  EnginePack,
  EngineReviewStatus,
  LogicPatternLevel,
  MatchPairsLevel,
  MemoryFlipLevel,
  ReviewKind,
  RhythmTapLevel,
  SequenceOrderLevel,
  SimLabLevel,
  SortBinsLevel,
  TimelineMapLevel,
  WordBuildLevel,
} from '../../types/enginePack'
import { MatchPairsEditor, MemoryFlipEditor, SequenceOrderEditor, SortBinsEditor } from './engines/PairSortEditors'
import { CountQuantityEditor, LogicPatternEditor } from './engines/CountLogicEditors'
import { RhythmTapEditor, WordBuildEditor } from './engines/WordRhythmEditors'
import { BlockCodeEditor, SimLabEditor, TimelineMapEditor } from './engines/BlockSimTimelineEditors'
import { AssetField } from './engines/fields'

const copy = {
  ar: {
    kicker: 'حزمة المحتوى',
    title: 'التأليف',
    intro: 'كل ما يقرؤه المحرّك: المستويات وعناصرها والإتاحة والمراجعة. لا حاجة إلى JSON للعمل المعتاد.',
    save: 'حفظ المسوّدة',
    saving: 'جارٍ الحفظ...',
    saved: 'حُفظت الحزمة. راجع المعاينة ثم الجاهزية قبل النشر.',
    saveError: 'تعذر حفظ الحزمة',
    serverDetails: 'أسباب الرفض من الخادم',
    validate: 'فحص الآن',
    validated: (errors: number, warnings: number) => errors
      ? `${errors} خطأ يمنع الحفظ${warnings ? ` و${warnings} تنبيه` : ''}.`
      : warnings ? `لا خطأ يمنع الحفظ، و${warnings} تنبيه يمنع النشر.` : 'لا أخطاء ولا تنبيهات من فحص الواجهة.',
    validateNote: 'هذا فحص الواجهة: مرآة مبكرة لقواعد الخادم لا بديل عنها. الخادم يبقى الحَكَم عند الحفظ.',
    noPack: 'لا حزمة محتوى لهذه اللعبة بعد.',
    initialise: (engine: string) => `ابدأ حزمة ${engine}`,
    engine: 'المحرّك',
    engineLocked: 'من صفّ اللعبة. تغييره يعني لعبة أخرى لا حزمة أخرى.',
    packSettings: 'إعدادات الحزمة',
    packVersion: 'إصدار الحزمة',
    packId: 'معرّف الحزمة',
    localization: 'سياسة الترجمة',
    localizations: {
      language_neutral: 'محايدة لغويًا',
      translatable: 'قابلة للترجمة',
      language_specific: 'خاصّة بلغة (تُؤلَّف لا تُترجم)',
    } as Record<PackLocalization, string>,
    localizationLocked: (value: string) => `عقد المحرّك يثبّتها على «${value}»؛ الخادم يرفض غيرها.`,
    dpad: 'دعم لوحة الاتجاهات',
    dpadLocked: (value: boolean) => value
      ? 'المحرّك يُلعَب بلوحة الاتجاهات، فالقيمة true: إنكارها يخفي المحتوى عن كل بيت فيه تلفاز.'
      : 'المحرّك يحتاج مؤشِّرًا، فالقيمة false: ادّعاؤها يعرض لعبة لا تُلعَب على التلفاز.',
    supervision: 'مستوى الإشراف',
    supervisions: { none: 'دون إشراف', recommended: 'مستحسن', required: 'مطلوب' } as Record<PackSupervisionLevel, string>,
    progression: 'التقدّم',
    levelsToFinish: 'مستويات الإتمام',
    advanceOn: 'الانتقال',
    advance: { level_complete: 'بإكمال المستوى', manual: 'يدويًا' } as Record<AdvanceOn, string>,
    accessibility: 'إمكانية الوصول',
    minTouch: 'أصغر هدف لمس (dp)',
    minTouchHint: (dp: number, engine: string) => `عقد ${engine} يطلب ${dp}dp على الأقل، ومسار ما قبل المدرسة 64dp.`,
    sequentialTap: 'بديل اللمس المتتابع',
    sequentialTapHint: 'بلا بديل للسحب المتّصل يُستبعَد أطفال صعوبات الحركة.',
    reducedMotion: 'يدعم تقليل الحركة',
    repeatInstructions: 'زرّ «اسمع التعليمة مرة أخرى» ظاهر دائمًا',
    voice: 'دليل الصوت',
    voiceHint: 'مفتاح دلالي إلى معرّف أصل صوتي. المفاتيح الستّة المفروضة معروضة أولًا؛ ما يحتاجه المحرّك زيادةً عليها يعرضه طابور الصوت لأنه يقرؤه من عقد المحرّك.',
    voiceKey: 'المفتاح',
    addVoiceKey: 'مفتاح صوت آخر',
    voiceKeyPlaceholder: 'vo.hint',
    review: 'المراجعات البشرية',
    reviewHint: 'ما يسجَّل هنا إقرار بشري. النشر يقرأ سجلّ content_reviews أيضًا، وهذه الشاشة لا تمنح اعتمادًا نيابةً عن أحد.',
    reviewRequired: (kind: string) => `عقد هذا المحرّك يفرض «${kind}» معتمدة قبل النشر.`,
    reviewStatus: 'الحالة',
    reviewStatuses: {
      not_required: 'غير مطلوبة', pending: 'معلَّقة', approved: 'معتمدة', rejected: 'مرفوضة',
    } as Record<EngineReviewStatus, string>,
    reviewKinds: {
      linguistic_review: 'مراجعة لغوية',
      scientific_review: 'مراجعة علمية',
      historical_review: 'مراجعة تاريخية',
      music_rights: 'حقوق الموسيقى',
    } as Record<ReviewKind, string>,
    reviewer: 'المراجع',
    reviewedAt: 'التاريخ',
    reviewNote: 'ملاحظة',
    assets: 'الأصول المُعلَنة',
    assetsHint: 'صور وأصوات تعلنها الحزمة كحزمة واحدة. ما يذكره مستوى بالاسم لا يحتاج إضافته هنا.',
    images: 'صور',
    audio: 'أصوات',
    addAsset: 'أصل',
    levels: 'المستويات',
    level: 'مستوى',
    addLevel: 'مستوى جديد',
    removeLevel: 'حذف المستوى',
    removeLevelConfirm: 'سيُحذف هذا المستوى وكل عناصره، وتُعاد ترقيم المستويات. متابعة؟',
    levelErrors: (count: number) => `${count} خطأ`,
    levelWarnings: (count: number) => `${count} تنبيه`,
    packIssues: 'تنبيهات الحزمة',
    raw: 'JSON الخام — تشخيص فقط',
    rawHint: 'ليس مسار عمل: يُستخدم لقراءة حزمة قديمة أو حقل لم يصل النموذج بعد. أي تعديل هنا يُطبَّق كما هو ويُفحَص كالمعتاد.',
    rawApply: 'تطبيق JSON',
    rawInvalid: 'JSON غير صالح',
    rawApplied: 'طُبِّق JSON على النموذج. لم يُحفَظ بعد.',
    noEditor: (engine: string) => `لا محرّر مخصَّص لـ${engine} في هذا الإصدار. استخدم عرض التشخيص أدناه.`,
    flow: 'حرّر ← افحص ← عاين ← راجع الجاهزية ← احفظ المسوّدة ← انشر إن مرّت البوابات.',
  },
  en: {
    kicker: 'Content pack',
    title: 'Authoring',
    intro: 'Everything the engine reads: levels, their elements, accessibility and review. No JSON is needed for normal work.',
    save: 'Save draft',
    saving: 'Saving...',
    saved: 'Pack saved. Check the preview, then readiness, before publishing.',
    saveError: 'Unable to save the pack',
    serverDetails: 'Reasons the server refused',
    validate: 'Check now',
    validated: (errors: number, warnings: number) => errors
      ? `${errors} error(s) block the save${warnings ? ` and ${warnings} warning(s)` : ''}.`
      : warnings ? `Nothing blocks the save, and ${warnings} warning(s) block publication.` : 'No errors and no warnings from the client check.',
    validateNote: 'This is the client check: an early mirror of the server rules, never a replacement. The server remains the judge on save.',
    noPack: 'This game has no content pack yet.',
    initialise: (engine: string) => `Start a ${engine} pack`,
    engine: 'Engine',
    engineLocked: 'From the game row. Changing it means a different game, not a different pack.',
    packSettings: 'Pack settings',
    packVersion: 'Pack version',
    packId: 'Pack id',
    localization: 'Localization policy',
    localizations: {
      language_neutral: 'Language neutral',
      translatable: 'Translatable',
      language_specific: 'Language specific (authored, never translated)',
    } as Record<PackLocalization, string>,
    localizationLocked: (value: string) => `The engine contract fixes this at "${value}"; the server refuses anything else.`,
    dpad: 'D-pad support',
    dpadLocked: (value: boolean) => value
      ? 'The engine is playable with a D-pad, so this is true: denying it hides the content from every TV household.'
      : 'The engine needs a pointer, so this is false: claiming otherwise offers a game that cannot be played on a TV.',
    supervision: 'Supervision level',
    supervisions: { none: 'None', recommended: 'Recommended', required: 'Required' } as Record<PackSupervisionLevel, string>,
    progression: 'Progression',
    levelsToFinish: 'Levels to finish',
    advanceOn: 'Advance on',
    advance: { level_complete: 'Level complete', manual: 'Manual' } as Record<AdvanceOn, string>,
    accessibility: 'Accessibility',
    minTouch: 'Minimum touch target (dp)',
    minTouchHint: (dp: number, engine: string) => `The ${engine} contract asks for at least ${dp}dp, and the preschool track for 64dp.`,
    sequentialTap: 'Sequential-tap alternative',
    sequentialTapHint: 'Without an alternative to continuous dragging, children with motor difficulties are excluded.',
    reducedMotion: 'Supports reduced motion',
    repeatInstructions: 'The "hear it again" button is always visible',
    voice: 'Voice manifest',
    voiceHint: 'A semantic key pointing at an audio asset id. The six mandatory keys come first; whatever the engine needs beyond them is listed by the audio queue, which reads it from the engine contract.',
    voiceKey: 'Key',
    addVoiceKey: 'Another voice key',
    voiceKeyPlaceholder: 'vo.hint',
    review: 'Human reviews',
    reviewHint: 'What is recorded here is a human statement. Publish also reads content_reviews, and this screen grants no approval on anyone else\'s behalf.',
    reviewRequired: (kind: string) => `This engine's contract requires an approved "${kind}" before publish.`,
    reviewStatus: 'Status',
    reviewStatuses: {
      not_required: 'Not required', pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
    } as Record<EngineReviewStatus, string>,
    reviewKinds: {
      linguistic_review: 'Linguistic review',
      scientific_review: 'Scientific review',
      historical_review: 'Historical review',
      music_rights: 'Music rights',
    } as Record<ReviewKind, string>,
    reviewer: 'Reviewer',
    reviewedAt: 'Date',
    reviewNote: 'Note',
    assets: 'Declared assets',
    assetsHint: 'Images and audio the pack declares as a bundle. Anything a level names directly does not need adding here.',
    images: 'Images',
    audio: 'Audio',
    addAsset: 'Asset',
    levels: 'Levels',
    level: 'Level',
    addLevel: 'New level',
    removeLevel: 'Delete level',
    removeLevelConfirm: 'This level and all its elements will be deleted and the levels renumbered. Continue?',
    levelErrors: (count: number) => `${count} error(s)`,
    levelWarnings: (count: number) => `${count} warning(s)`,
    packIssues: 'Pack warnings',
    raw: 'Raw JSON — diagnostics only',
    rawHint: 'Not a workflow: use it to read an old pack or a field the form does not cover yet. Anything edited here is applied verbatim and checked as usual.',
    rawApply: 'Apply JSON',
    rawInvalid: 'Invalid JSON',
    rawApplied: 'JSON applied to the form. Not saved yet.',
    noEditor: (engine: string) => `No dedicated editor for ${engine} in this deployment. Use the diagnostics view below.`,
    flow: 'Edit → check → preview → review readiness → save draft → publish once the gates pass.',
  },
}

export interface EnginePackFormProps {
  gameId: string
  engineId: string
  packId: string
  pack: EnginePack | null
  ageMin: number
  ageMax: number
  hasLearningObjective: boolean
  gameSupervisionLevel?: string
  onSaved: (pack: EnginePack) => void
}

/**
 * يوجّه المستوى إلى محرّر محرّكه.
 *
 * التضييق من `EngineLevelRecord` إلى نوع المستوى يحدث **هنا وحده**: `engine_id`
 * هو المميِّز، وهو معروف من صفّ اللعبة، فهذا الموضع هو الوحيد الذي يملك المعرفة
 * الكافية للتضييق. تكراره في كل محرّر كان سيوزّع الافتراض على أحد عشر مكانًا.
 */
function LevelEditor({ engineId, level, onChange, ageMax }: {
  engineId: string
  level: EngineLevelRecord
  onChange: (level: EngineLevelRecord) => void
  ageMax: number
}) {
  const { locale } = usePreferences()
  const change = (next: unknown) => onChange(next as EngineLevelRecord)

  switch (engineId) {
    case 'match_pairs':
      return <MatchPairsEditor level={level as unknown as MatchPairsLevel} onChange={change} />
    case 'sort_bins':
      return <SortBinsEditor level={level as unknown as SortBinsLevel} onChange={change} />
    case 'memory_flip':
      return <MemoryFlipEditor level={level as unknown as MemoryFlipLevel} onChange={change} ageMax={ageMax} />
    case 'sequence_order':
      return <SequenceOrderEditor level={level as unknown as SequenceOrderLevel} onChange={change} />
    case 'count_quantity':
      return <CountQuantityEditor level={level as unknown as CountQuantityLevel} onChange={change} />
    case 'logic_pattern':
      return <LogicPatternEditor level={level as unknown as LogicPatternLevel} onChange={change} />
    case 'word_build':
      return <WordBuildEditor level={level as unknown as WordBuildLevel} onChange={change} />
    case 'rhythm_tap':
      return <RhythmTapEditor level={level as unknown as RhythmTapLevel} onChange={change} />
    case 'block_code':
      return <BlockCodeEditor level={level as unknown as BlockCodeLevel} onChange={change} />
    case 'sim_lab':
      return <SimLabEditor level={level as unknown as SimLabLevel} onChange={change} />
    case 'timeline_map':
      return <TimelineMapEditor level={level as unknown as TimelineMapLevel} onChange={change} />
    default:
      return <p className="inline-alert inline-alert--error">{copy[locale].noEditor(engineId)}</p>
  }
}

export function EnginePackForm(props: EnginePackFormProps) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const contract = engineContract(props.engineId)
  const engineName = engineLabel(props.engineId, locale)

  const [pack, setPack] = useState<EnginePack | null>(props.pack)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [details, setDetails] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const [raw, setRaw] = useState('')
  const [rawError, setRawError] = useState('')
  const [extraVoiceKey, setExtraVoiceKey] = useState('')
  const [extraKeys, setExtraKeys] = useState<string[]>([])

  // الحزمة الواردة من الصفحة تتغيّر بعد كل حفظ ناجح؛ إعادة المزامنة تمنع
  // نموذجًا يعرض حالة سابقة بعد أن قبل الخادم غيرها.
  useEffect(() => { setPack(props.pack) }, [props.pack])

  const issueContext: EngineIssueContext = useMemo(() => ({
    ageMin: props.ageMin,
    ageMax: props.ageMax,
    hasLearningObjective: props.hasLearningObjective,
    gameSupervisionLevel: props.gameSupervisionLevel,
  }), [props.ageMin, props.ageMax, props.hasLearningObjective, props.gameSupervisionLevel])

  const issues = useMemo(
    () => (pack ? engineIssues(pack, locale, issueContext) : []),
    [pack, locale, issueContext],
  )

  const levelCount = pack?.levels?.length ?? 0
  useEffect(() => {
    if (activeIndex > 0 && activeIndex > levelCount - 1) setActiveIndex(Math.max(levelCount - 1, 0))
  }, [activeIndex, levelCount])

  if (!pack) {
    return (
      <section className="panel">
        <header className="panel__header"><h3>{text.kicker}</h3></header>
        <div className="entity-form">
          <p className="data-unavailable">{text.noPack}</p>
          <button
            className="button button--primary"
            type="button"
            onClick={() => setPack(emptyEnginePack(props.engineId, props.packId))}
          ><Icon name="plus" size={16} />{text.initialise(engineName)}</button>
        </div>
      </section>
    )
  }

  const levels = pack.levels ?? []
  const patch = (next: Partial<EnginePack>) => {
    setPack({ ...pack, ...next })
    setStatus('')
    setChecked(false)
  }

  function patchLevel(index: number, next: EngineLevelRecord) {
    const safe = Math.min(index, levels.length - 1)
    if (safe < 0) return
    patch({ levels: levels.map((entry, position) => (position === safe ? next : entry)) })
  }

  function addLevel() {
    if (levels.length >= MAX_LEVELS) return
    patch({ levels: [...levels, emptyEngineLevel(props.engineId, levels.length + 1)] })
    setActiveIndex(levels.length)
  }

  /// الحذف يعيد ترقيم المستويات 1..n فورًا: فراغ في الترقيم يعزل كل مستوى بعده
  /// لأن التقدّم يسير بالرقم.
  function removeLevel(index: number) {
    if (!window.confirm(text.removeLevelConfirm)) return
    const next = levels
      .filter((_, position) => position !== index)
      .map((entry, position) => ({ ...entry, level: position + 1 }))
    patch({
      levels: next,
      progression: {
        ...pack!.progression,
        levels_to_finish: Math.min(pack!.progression.levels_to_finish, Math.max(next.length, 1)),
      },
    })
    setActiveIndex(Math.max(0, index - 1))
  }

  const access = pack.accessibility ?? {}
  const patchAccess = (next: Partial<typeof access>) => patch({ accessibility: { ...access, ...next } })

  function setVoice(key: string, value: string) {
    const next = { ...pack!.voice_manifest }
    if (value.trim()) next[key] = value.trim()
    else delete next[key]
    patch({ voice_manifest: next })
  }

  function patchReview(kind: ReviewKind, next: Partial<{ status: EngineReviewStatus; reviewer: string | null; reviewed_at: string | null; note: string | null }>) {
    const current = pack!.review?.[kind] ?? { status: 'pending' as EngineReviewStatus }
    patch({ review: { ...pack!.review, [kind]: { ...current, ...next } } })
  }

  function setAssetList(field: 'images' | 'audio', values: string[]) {
    patch({ assets: { ...pack!.assets, [field]: values } })
  }

  async function save() {
    setSaving(true)
    setError('')
    setDetails([])
    setStatus('')
    try {
      await api.updateGame(props.gameId, { content_pack: pack as unknown as Record<string, unknown> })
      setStatus(text.saved)
      props.onSaved(pack!)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.saveError)
      // تفاصيل الرفض كما وردت: هي القائمة الكاملة لا رسالة عامة.
      if (caught instanceof ApiError) setDetails(caught.details)
    } finally {
      setSaving(false)
    }
  }

  const packScopedIssues = issues.filter((issue) => issue.scope === 'pack')
  const levelIssues = (levelNumber: number) => issues.filter((issue) => issue.scope === `level:${levelNumber}`)
  const errorCount = issues.filter((issue) => issue.level === 'error').length
  const warningCount = issues.filter((issue) => issue.level === 'warning').length

  const voiceRows = [...new Set([...requiredVoiceKeysFor(), ...Object.keys(pack.voice_manifest ?? {}), ...extraKeys])]
  const level = levels[Math.min(activeIndex, Math.max(levels.length - 1, 0))] ?? null
  const requiredReview = contract?.requiredReview

  return (
    <div className="page-stack">
      <section className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__kicker">{text.kicker}</span>
            <h3>{text.title} — {engineName}</h3>
            <p>{text.intro}</p>
          </div>
          <div className="trace-editor__row">
            <button className="button button--secondary" type="button" onClick={() => setChecked(true)}>
              <Icon name="reviews" size={16} />{text.validate}
            </button>
            <button className="button button--primary" type="button" onClick={() => void save()} disabled={saving}>
              <Icon name="upload" size={16} />{saving ? text.saving : text.save}
            </button>
          </div>
        </header>

        <div className="entity-form">
          <p className="engine-note">{text.flow}</p>
          {error && <div className="inline-alert inline-alert--error">{error}</div>}
          {details.length > 0 && (
            <div className="inline-alert inline-alert--error">
              <strong>{text.serverDetails}</strong>
              <ul className="planned-list">{details.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          {status && <div className="inline-alert inline-alert--info">{status}</div>}
          {checked && (
            <div className={errorCount ? 'inline-alert inline-alert--error' : 'inline-alert inline-alert--info'} role="status">
              <strong>{text.validated(errorCount, warningCount)}</strong>
              <p>{text.validateNote}</p>
            </div>
          )}

          <div className="form-grid form-grid--three">
            <div className="field">
              <span>{text.engine}</span>
              <strong dir="ltr">{props.engineId}</strong>
              <small>{text.engineLocked}</small>
            </div>
            <label className="field">
              <span>{text.packVersion}</span>
              <input type="number" dir="ltr" min="1" value={pack.pack_version} onChange={(event) => patch({ pack_version: Number(event.target.value) })} />
            </label>
            <label className="field">
              <span>{text.packId}</span>
              <input dir="ltr" value={pack.pack_id ?? ''} onChange={(event) => patch({ pack_id: event.target.value })} />
            </label>
          </div>

          <div className="form-grid form-grid--three">
            <div className="field">
              <span>{text.localization}</span>
              {contract?.languageClass ? (
                <>
                  <strong>{text.localizations[contract.languageClass]}</strong>
                  <small>{text.localizationLocked(contract.languageClass)}</small>
                </>
              ) : (
                <select value={pack.localization ?? 'language_neutral'} onChange={(event) => patch({ localization: event.target.value as PackLocalization })}>
                  {PACK_LOCALIZATIONS.map((value) => <option value={value} key={value}>{text.localizations[value]}</option>)}
                </select>
              )}
            </div>
            <div className="field">
              <span>{text.dpad}</span>
              <strong dir="ltr">{String(contract?.supportsDpad ?? pack.supports_dpad ?? true)}</strong>
              <small>{text.dpadLocked(contract?.supportsDpad ?? true)}</small>
            </div>
            <label className="field">
              <span>{text.supervision}</span>
              <select value={pack.supervision_level ?? 'none'} onChange={(event) => patch({ supervision_level: event.target.value as PackSupervisionLevel })}>
                {SUPERVISION_LEVELS.map((value) => <option value={value} key={value}>{text.supervisions[value]}</option>)}
              </select>
            </label>
          </div>

          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.levelsToFinish}</span>
              <input
                type="number" dir="ltr" min="1" max={Math.max(levels.length, 1)}
                value={pack.progression.levels_to_finish}
                onChange={(event) => patch({ progression: { ...pack.progression, levels_to_finish: Number(event.target.value) } })}
              />
            </label>
            <label className="field">
              <span>{text.advanceOn}</span>
              <select value={pack.progression.advance_on} onChange={(event) => patch({ progression: { ...pack.progression, advance_on: event.target.value as AdvanceOn } })}>
                {ADVANCE_ON.map((value) => <option value={value} key={value}>{text.advance[value]}</option>)}
              </select>
            </label>
          </div>

          {packScopedIssues.length > 0 && (
            <details className="readiness-items" open={checked}>
              <summary>{text.packIssues} ({packScopedIssues.length})</summary>
              <ul className="planned-list">
                {packScopedIssues.map((issue) => (
                  <li className={issue.level === 'error' ? 'pack-issue pack-issue--error' : 'pack-issue'} key={issue.text}>{issue.text}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.accessibility}</h3></header>
        <div className="entity-form">
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.minTouch}</span>
              <input
                type="number" dir="ltr" min="48" max="96"
                value={access.min_touch_target_dp ?? ''}
                onChange={(event) => patchAccess({ min_touch_target_dp: Number(event.target.value) })}
              />
              <small>{text.minTouchHint(contract?.minTouchTargetDp ?? 48, engineName)}</small>
            </label>
            <label className="checkbox-control">
              <input type="checkbox" checked={access.sequential_tap_alternative === true} onChange={(event) => patchAccess({ sequential_tap_alternative: event.target.checked })} />
              <span>{text.sequentialTap}</span>
            </label>
            <label className="checkbox-control">
              <input type="checkbox" checked={access.reduced_motion_supported === true} onChange={(event) => patchAccess({ reduced_motion_supported: event.target.checked })} />
              <span>{text.reducedMotion}</span>
            </label>
          </div>
          <p className="engine-note">{text.sequentialTapHint}</p>
          <label className="checkbox-control">
            <input
              type="checkbox"
              checked={access.repeat_instructions_button === true}
              onChange={(event) => patchAccess({ repeat_instructions_button: event.target.checked ? true : undefined })}
            />
            <span>{text.repeatInstructions}</span>
          </label>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.voice}</h3><p>{text.voiceHint}</p></header>
        <div className="entity-form">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.voiceKey}</th><th>{text.audio}</th></tr></thead>
              <tbody>
                {voiceRows.map((key) => (
                  <tr key={key}>
                    <td><code dir="ltr">{key}</code></td>
                    <td>
                      <AssetField
                        label={key}
                        kind="audio"
                        value={pack.voice_manifest?.[key] ?? ''}
                        onChange={(value) => setVoice(key, value)}
                        required={requiredVoiceKeysFor().includes(key)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="engine-field__row">
            <input
              dir="ltr"
              placeholder={text.voiceKeyPlaceholder}
              aria-label={text.addVoiceKey}
              value={extraVoiceKey}
              onChange={(event) => setExtraVoiceKey(event.target.value.trim())}
            />
            <button
              className="button button--ghost"
              type="button"
              disabled={!extraVoiceKey}
              onClick={() => { setExtraKeys([...extraKeys, extraVoiceKey]); setExtraVoiceKey('') }}
            ><Icon name="plus" size={15} />{text.addVoiceKey}</button>
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.review}</h3><p>{text.reviewHint}</p></header>
        <div className="entity-form">
          {REVIEW_KINDS.map((kind) => {
            const record = pack.review?.[kind]
            const mandatory = requiredReview === kind
            if (!record && !mandatory) return null
            return (
              <div className="form-grid form-grid--three" key={kind}>
                <label className="field">
                  <span>{text.reviewKinds[kind]}{mandatory ? ' *' : ''}</span>
                  <select
                    value={record?.status ?? 'pending'}
                    onChange={(event) => patchReview(kind, { status: event.target.value as EngineReviewStatus })}
                  >
                    {REVIEW_STATUSES.map((value) => <option value={value} key={value}>{text.reviewStatuses[value]}</option>)}
                  </select>
                  {mandatory && <small>{text.reviewRequired(text.reviewKinds[kind])}</small>}
                </label>
                <label className="field">
                  <span>{text.reviewer}</span>
                  <input value={record?.reviewer ?? ''} onChange={(event) => patchReview(kind, { reviewer: event.target.value || null })} />
                </label>
                <label className="field">
                  <span>{text.reviewedAt}</span>
                  <input type="date" dir="ltr" value={record?.reviewed_at ?? ''} onChange={(event) => patchReview(kind, { reviewed_at: event.target.value || null })} />
                </label>
                <label className="field">
                  <span>{text.reviewNote}</span>
                  <input value={record?.note ?? ''} onChange={(event) => patchReview(kind, { note: event.target.value || null })} />
                </label>
              </div>
            )
          })}
          {!requiredReview && !pack.review && <p className="data-unavailable">—</p>}
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.assets}</h3><p>{text.assetsHint}</p></header>
        <div className="entity-form">
          {(['images', 'audio'] as const).map((field) => {
            const values = pack.assets?.[field] ?? []
            return (
              <div key={field}>
                <h4>{field === 'images' ? text.images : text.audio} <span className="title-count">{values.length}</span></h4>
                {values.map((value, index) => (
                  <div className="engine-field__row" key={index}>
                    <AssetField
                      label={`${field === 'images' ? text.images : text.audio} ${index + 1}`}
                      kind={field === 'images' ? 'image' : 'audio'}
                      value={value}
                      onChange={(next) => setAssetList(field, values.map((entry, position) => (position === index ? next : entry)))}
                    />
                    <button
                      className="icon-button icon-button--small icon-button--danger"
                      type="button"
                      aria-label={`${text.addAsset} ${index + 1}`}
                      onClick={() => setAssetList(field, values.filter((_, position) => position !== index))}
                    ><Icon name="close" size={14} /></button>
                  </div>
                ))}
                <button className="button button--ghost" type="button" onClick={() => setAssetList(field, [...values, ''])}>
                  <Icon name="plus" size={15} />{text.addAsset}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <header className="panel__header panel__header--filters">
          <div>
            <h3>{text.levels} <span className="title-count">{levels.length}/{MAX_LEVELS}</span></h3>
          </div>
          <button className="button button--primary" type="button" onClick={addLevel} disabled={levels.length >= MAX_LEVELS}>
            <Icon name="plus" size={16} />{text.addLevel}
          </button>
        </header>

        <div className="entity-form">
          <div className="engine-level-tabs" role="tablist" aria-label={text.levels}>
            {levels.map((entry, index) => {
              const number = Number(entry.level) || index + 1
              const own = levelIssues(number)
              const errors = own.filter((issue) => issue.level === 'error').length
              const warnings = own.length - errors
              return (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? 'engine-level-tab engine-level-tab--active' : 'engine-level-tab'}
                  onClick={() => setActiveIndex(index)}
                >
                  <strong>{text.level} {number}</strong>
                  {errors > 0 && <span className="pack-issue pack-issue--error">{text.levelErrors(errors)}</span>}
                  {errors === 0 && warnings > 0 && <span className="pack-issue">{text.levelWarnings(warnings)}</span>}
                </button>
              )
            })}
          </div>

          {level && (
            <>
              <div className="trace-editor__row">
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => removeLevel(activeIndex)}
                  disabled={levels.length <= 1}
                ><Icon name="archive" size={15} />{text.removeLevel}</button>
              </div>

              {levelIssues(Number(level.level) || activeIndex + 1).length > 0 && (
                <ul className="planned-list">
                  {levelIssues(Number(level.level) || activeIndex + 1).map((issue) => (
                    <li className={issue.level === 'error' ? 'pack-issue pack-issue--error' : 'pack-issue'} key={issue.text}>{issue.text}</li>
                  ))}
                </ul>
              )}

              <LevelEditor
                engineId={props.engineId}
                level={level}
                onChange={(next) => patchLevel(activeIndex, next)}
                ageMax={props.ageMax}
              />
            </>
          )}
        </div>
      </section>

      <section className="panel">
        <details>
          <summary className="panel__header"><h3>{text.raw}</h3></summary>
          <div className="entity-form">
            <p className="panel--notice">{text.rawHint}</p>
            <textarea
              className="engine-raw"
              rows={16}
              dir="ltr"
              aria-label={text.raw}
              value={raw || JSON.stringify(pack, null, 2)}
              onChange={(event) => { setRaw(event.target.value); setRawError('') }}
            />
            {rawError && <p className="inline-alert inline-alert--error">{rawError}</p>}
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                try {
                  const parsed = JSON.parse(raw || JSON.stringify(pack))
                  if (!isObject(parsed)) throw new Error('not an object')
                  setPack(parsed as unknown as EnginePack)
                  setRaw('')
                  setStatus(text.rawApplied)
                  setChecked(false)
                } catch {
                  setRawError(text.rawInvalid)
                }
              }}
            >{text.rawApply}</button>
          </div>
        </details>
      </section>
    </div>
  )
}
