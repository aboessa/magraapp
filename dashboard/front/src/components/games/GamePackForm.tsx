import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../Icon'
import { usePreferences } from '../../context/preferences'
import { api, ApiError } from '../../lib/api'
import {
  MAX_LEVELS,
  SCORING_BY_MODE,
  GEOMETRIC_MODES,
  BASE_VOICE_KEYS,
  emptyLevel,
  emptyTracePack,
  packIssues,
  requiredLevelFields,
} from '../../lib/tracePack'
import {
  ADVANCE_ON,
  COMPLETION_RULES,
  PACK_LOCALIZATIONS,
  REVIEW_STATUSES,
  SCORING_MODES,
  SUPERVISION_LEVELS,
  TRACE_MODES,
} from '../../types/gamePack'
import type {
  AdvanceOn,
  CompletionRule,
  LinguisticReviewStatus,
  PackLocalization,
  PackSupervisionLevel,
  TraceConnectDot,
  TraceLevel,
  TraceMode,
  TracePack,
  TraceScoring,
  TraceStroke,
} from '../../types/gamePack'
import { TracePathEditor } from './TracePathEditor'
import type { StrokeMeta } from './TracePathEditor'

/**
 * نموذج تأليف حزمة trace_color كاملة: مستوياتها وإعداداتها العامة.
 *
 * ## العلّة التي يُغلقها
 *
 * `content_pack` كانت تُحرَّر كنصّ JSON خام (وفي شاشة الألعاب لم تكن تُحرَّر
 * إطلاقًا: تُقرأ من الخادم وتُعاد كما هي). كل قاعدة من قواعد العقد الاثنتَي عشرة
 * كان على المحرّر أن يحفظها عن ظهر قلب، وكل خطأ يظهر كرفض 400 واحد بلا إشارة
 * إلى المستوى المسبِّب.
 *
 * ## التنبيهات هنا ليست تحققًا
 *
 * `lib/tracePack.ts` يعرض مرآة لقواعد الخادم بجانب الحقل الذي سبّبها، والخادم
 * يبقى الحَكَم: ما يرفضه يُعرض كما ورد، بما فيه مصفوفة `details` التي كانت
 * تُهمَل في lib/api.ts فيرى المحرّر «حزمة غير صالحة» بلا سبب.
 *
 * ## JSON الخام يبقى موجودًا
 *
 * مطويًّا وبوصف صريح: تشخيص. حزمة قديمة أو حقل أضافه المخطَّط ولم يصل النموذج
 * بعد يجب أن يبقى قابلًا للقراءة والتصحيح، وإخفاؤه كليًّا يعني ميزةً ناقصة
 * تُسدّ باستعلام SQL يدوي.
 */

const copy = {
  ar: {
    title: 'حزمة المحتوى',
    intro: 'كل ما يقرؤه المحرّك: المستويات وهندستها والإتاحة والمراجعة. لا حاجة إلى JSON للعمل المعتاد.',
    save: 'حفظ الحزمة',
    saving: 'جارٍ الحفظ...',
    saved: 'حُفظت الحزمة.',
    saveError: 'تعذر حفظ الحزمة',
    serverDetails: 'أسباب الرفض من الخادم',
    packSection: 'إعدادات الحزمة',
    packVersion: 'إصدار الحزمة',
    packVersionHint: 'لا يجوز أن يزيد على إصدار المحرّك المدعوم (1).',
    packId: 'معرّف الحزمة',
    localization: 'سياسة الترجمة',
    localizations: {
      language_neutral: 'محايدة لغويًا',
      translatable: 'قابلة للترجمة',
      language_specific: 'خاصّة بلغة (تُؤلَّف لا تُترجم)',
    } as Record<PackLocalization, string>,
    dpad: 'دعم لوحة الاتجاهات',
    dpadNote: 'المحرّك يحتاج مؤشِّرًا (إصبع أو قلم)، فالقيمة false دائمًا حتى يستطيع كتالوج التلفاز استبعادها من البيانات وحدها.',
    supervision: 'مستوى الإشراف',
    supervisions: { none: 'دون إشراف', recommended: 'مستحسن', required: 'مطلوب' } as Record<PackSupervisionLevel, string>,
    progression: 'التقدّم',
    levelsToFinish: 'مستويات الإتمام',
    advanceOn: 'الانتقال',
    advance: { level_complete: 'بإكمال المستوى', manual: 'يدويًا' } as Record<AdvanceOn, string>,
    accessibility: 'إمكانية الوصول',
    simplifiedTolerance: 'تفاوت الوضع المبسّط (dp)',
    simplifiedCoverage: 'تغطية الوضع المبسّط',
    sequentialTap: 'بديل اللمس المتتابع',
    sequentialTapNote: 'مفروض في المخطَّط: بلا بديل للسحب المتّصل يُستبعَد أطفال صعوبات الحركة.',
    accessibilityMissing: 'الحزمة المخزَّنة لا تُعلن وضعًا حركيًا مبسّطًا. القيم أدناه مقترحة ولم تُحفَظ بعد؛ الحفظ هو ما يُسجّلها.',
    reducedMotion: 'يدعم تقليل الحركة',
    minTouch: 'أصغر هدف لمس (dp)',
    assets: 'الأصول',
    images: 'صور — معرّف في كل سطر',
    audio: 'صوت — معرّف في كل سطر',
    voice: 'دليل الصوت',
    voiceHint: 'مفتاح دلالي إلى معرّف أصل صوتي. المفاتيح المفروضة معروضة أولًا، والناقص منها يمنع النشر لا الحفظ.',
    voiceKey: 'المفتاح',
    voiceAsset: 'معرّف الأصل',
    addVoiceKey: 'مفتاح صوت آخر',
    review: 'المراجعة اللغوية',
    reviewStatus: 'الحالة',
    reviewStatuses: {
      not_required: 'غير مطلوبة',
      pending: 'معلَّقة',
      approved: 'معتمدة',
      rejected: 'مرفوضة',
    } as Record<LinguisticReviewStatus, string>,
    reviewer: 'المراجع',
    reviewedAt: 'تاريخ المراجعة',
    reviewNotes: 'ملاحظات',
    reviewNotice: 'حزمة تحوي حروفًا لا تُنشر إلا بمراجعة عربية معتمدة. تسجيل «معتمدة» هنا إقرار بشري، ولا تمنحه هذه الشاشة نيابةً عن أحد.',
    levels: 'المستويات',
    addLevel: 'مستوى جديد',
    removeLevel: 'حذف المستوى',
    removeLevelConfirm: 'سيُحذف هذا المستوى بكل هندسته، وتُعاد ترقيم البقية. متابعة؟',
    level: 'مستوى',
    mode: 'نمط الرسم',
    scoring: 'التقييم',
    scoringAllowed: (allowed: string) => `المسموح لهذا النمط: ${allowed}`,
    promptKey: 'مفتاح نصّ التوجيه',
    promptKeyHint: 'مفتاح ترجمة لا نصّ ظاهر: النصّ نفسه يُؤلَّف في تبويب اللغات.',
    completion: 'قاعدة الإكمال',
    completionRules: {
      all_strokes_complete: 'إكمال كل الخطوات',
      all_dots_connected: 'توصيل كل النقاط',
      child_taps_done: 'الطفل يقرّر الانتهاء',
    } as Record<CompletionRule, string>,
    minStrokes: 'أدنى عدد خطوات',
    toleranceDp: 'التفاوت (dp)',
    coverage: 'التغطية المطلوبة',
    guideAudio: 'الصوت الموجّه',
    background: 'صورة الخلفية / القالب',
    coloring: 'مرحلة التلوين',
    coloringEnabled: 'تلوين مُفعَّل',
    regions: 'المناطق — r1 r2 ...',
    palette: 'لوحة الألوان',
    paletteHint: 'من 3 إلى 6 ألوان. التلوين تعبير حرّ ولا يُقيَّم إطلاقًا.',
    addColour: 'لون',
    templateAsset: 'أصل القالب',
    dots: 'نقاط التوصيل',
    addDot: 'نقطة',
    dotId: 'المعرّف',
    dotOrder: 'الترتيب',
    dotX: 'س',
    dotY: 'ص',
    dotLabel: 'مفتاح التسمية',
    geometry: 'الهندسة',
    geometryUnused: 'هذا النمط لا يستخدم مسارات رسم.',
    issues: 'تنبيهات مطابقة العقد',
    issuesNone: 'لا تنبيهات من فحص الواجهة. الخادم يفحص مرة أخرى عند الحفظ.',
    errorLabel: 'يمنع الحفظ',
    warningLabel: 'يمنع النشر لا الحفظ',
    raw: 'JSON الخام (تشخيص)',
    rawHint: 'للقراءة والإصلاح عند وجود حقل لا يعرضه النموذج. «تطبيق» يستبدل الحزمة بالكامل.',
    apply: 'تطبيق JSON',
    rawInvalid: 'نصّ JSON غير صالح.',
    initialise: 'إنشاء حزمة ابتدائية',
    noPack: 'لا حزمة محتوى بعد لهذه اللعبة.',
    required: 'مفروض لهذا النمط',
  },
  en: {
    title: 'Content pack',
    intro: 'Everything the engine reads: levels, geometry, accessibility and review. No JSON needed for normal work.',
    save: 'Save pack',
    saving: 'Saving...',
    saved: 'Pack saved.',
    saveError: 'Unable to save the pack',
    serverDetails: 'Reasons the server refused',
    packSection: 'Pack settings',
    packVersion: 'Pack version',
    packVersionHint: 'Must not exceed the supported engine version (1).',
    packId: 'Pack id',
    localization: 'Localization policy',
    localizations: {
      language_neutral: 'Language neutral',
      translatable: 'Translatable',
      language_specific: 'Language specific (authored, not translated)',
    } as Record<PackLocalization, string>,
    dpad: 'D-pad support',
    dpadNote: 'The engine needs a pointer, so this is always false and a TV catalogue can exclude the game from data alone.',
    supervision: 'Supervision level',
    supervisions: { none: 'None', recommended: 'Recommended', required: 'Required' } as Record<PackSupervisionLevel, string>,
    progression: 'Progression',
    levelsToFinish: 'Levels to finish',
    advanceOn: 'Advance on',
    advance: { level_complete: 'Level complete', manual: 'Manual' } as Record<AdvanceOn, string>,
    accessibility: 'Accessibility',
    simplifiedTolerance: 'Simplified-motor tolerance (dp)',
    simplifiedCoverage: 'Simplified-motor coverage',
    sequentialTap: 'Sequential-tap alternative',
    sequentialTapNote: 'Mandatory in the schema: without an alternative to continuous drag, children with motor difficulty are excluded.',
    accessibilityMissing: 'The stored pack declares no simplified-motor mode. The values below are suggestions and are not saved yet; saving is what records them.',
    reducedMotion: 'Reduced motion supported',
    minTouch: 'Minimum touch target (dp)',
    assets: 'Assets',
    images: 'Images — one id per line',
    audio: 'Audio — one id per line',
    voice: 'Voice manifest',
    voiceHint: 'A semantic key bound to an audio asset id. Required keys are listed first; a missing one blocks publish, not saving.',
    voiceKey: 'Key',
    voiceAsset: 'Asset id',
    addVoiceKey: 'Another voice key',
    review: 'Linguistic review',
    reviewStatus: 'Status',
    reviewStatuses: {
      not_required: 'Not required',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
    } as Record<LinguisticReviewStatus, string>,
    reviewer: 'Reviewer',
    reviewedAt: 'Reviewed at',
    reviewNotes: 'Notes',
    reviewNotice: 'A pack containing letters publishes only with an approved Arabic review. Recording "approved" here is a human claim; this screen does not grant it on anyone\u2019s behalf.',
    levels: 'Levels',
    addLevel: 'New level',
    removeLevel: 'Delete level',
    removeLevelConfirm: 'This level and all of its geometry will be deleted and the rest renumbered. Continue?',
    level: 'Level',
    mode: 'Drawing mode',
    scoring: 'Scoring',
    scoringAllowed: (allowed: string) => `Allowed for this mode: ${allowed}`,
    promptKey: 'Prompt key',
    promptKeyHint: 'A translation key, not visible prose: the text itself is authored in the languages tab.',
    completion: 'Completion rule',
    completionRules: {
      all_strokes_complete: 'All strokes complete',
      all_dots_connected: 'All dots connected',
      child_taps_done: 'Child taps done',
    } as Record<CompletionRule, string>,
    minStrokes: 'Minimum strokes',
    toleranceDp: 'Tolerance (dp)',
    coverage: 'Coverage required',
    guideAudio: 'Guide audio',
    background: 'Background / template image',
    coloring: 'Colouring stage',
    coloringEnabled: 'Colouring enabled',
    regions: 'Regions — r1 r2 ...',
    palette: 'Palette',
    paletteHint: '3 to 6 colours. Colouring is free expression and is never scored.',
    addColour: 'Colour',
    templateAsset: 'Template asset',
    dots: 'Connect-the-dots',
    addDot: 'Dot',
    dotId: 'Id',
    dotOrder: 'Order',
    dotX: 'x',
    dotY: 'y',
    dotLabel: 'Label key',
    geometry: 'Geometry',
    geometryUnused: 'This mode does not use stroke paths.',
    issues: 'Contract warnings',
    issuesNone: 'No warnings from the client checks. The server checks again on save.',
    errorLabel: 'Blocks saving',
    warningLabel: 'Blocks publish, not saving',
    raw: 'Raw JSON (diagnostics)',
    rawHint: 'For reading and repairing a field the form does not render. "Apply" replaces the whole pack.',
    apply: 'Apply JSON',
    rawInvalid: 'Invalid JSON text.',
    initialise: 'Create a starter pack',
    noPack: 'This game has no content pack yet.',
    required: 'Required for this mode',
  },
}

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
}

export interface GamePackFormProps {
  gameId: string
  packId: string
  pack: TracePack | null
  onSaved: (pack: TracePack) => void
}

export function GamePackForm(props: GamePackFormProps) {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [pack, setPack] = useState<TracePack | null>(props.pack)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [details, setDetails] = useState<string[]>([])
  const [raw, setRaw] = useState('')
  const [rawError, setRawError] = useState('')
  const [extraVoiceKey, setExtraVoiceKey] = useState('')
  const [extraKeys, setExtraKeys] = useState<string[]>([])

  const issues = useMemo(() => (pack ? packIssues(pack, locale) : []), [pack, locale])
  const levelCount = pack?.levels?.length ?? 0

  useEffect(() => {
    if (activeIndex > 0 && activeIndex > levelCount - 1) setActiveIndex(Math.max(levelCount - 1, 0))
  }, [activeIndex, levelCount])

  if (!pack) {
    return (
      <section className="panel">
        <header className="panel__header"><h3>{text.title}</h3></header>
        <div className="entity-form">
          <p className="data-unavailable">{text.noPack}</p>
          <button className="button button--primary" type="button" onClick={() => setPack(emptyTracePack(props.packId))}>
            <Icon name="plus" size={16} />{text.initialise}
          </button>
        </div>
      </section>
    )
  }

  const levels = pack.levels ?? []
  const level = levels[Math.min(activeIndex, Math.max(levels.length - 1, 0))] ?? null

  function patch(next: Partial<TracePack>) {
    setPack({ ...pack!, ...next })
    setStatus('')
  }

  function patchLevel(index: number, next: Partial<TraceLevel>) {
    // الحصر مقصود: تطبيق JSON بمستويات أقل أو حذف مستوى قد يترك المؤشّر خارج
    // المدى، وتعديل فهرس غير موجود يفشل صامتًا فيبدو النموذج معطَّلًا بلا سبب.
    const safe = Math.min(index, levels.length - 1)
    if (safe < 0) return
    patch({ levels: levels.map((entry, position) => (position === safe ? { ...entry, ...next } : entry)) })
  }

  function addLevel() {
    if (levels.length >= MAX_LEVELS) return
    patch({ levels: [...levels, emptyLevel(levels.length + 1)] })
    setActiveIndex(levels.length)
  }

  /// الحذف يعيد ترقيم المستويات 1..n فورًا: فراغ في الترقيم يعزل كل مستوى بعده
  /// لأن التقدّم يسير بالرقم.
  function removeLevel(index: number) {
    if (!window.confirm(text.removeLevelConfirm)) return
    const next = levels.filter((_, position) => position !== index).map((entry, position) => ({ ...entry, level: position + 1 }))
    patch({ levels: next, progression: { ...pack!.progression, levels_to_finish: Math.min(pack!.progression.levels_to_finish, Math.max(next.length, 1)) } })
    setActiveIndex(Math.max(0, index - 1))
  }

  function moveLevel(index: number, offset: number) {
    const target = index + offset
    if (target < 0 || target >= levels.length) return
    const next = [...levels]
    const moved = next[index]
    const displaced = next[target]
    if (!moved || !displaced) return
    next[index] = displaced
    next[target] = moved
    patch({ levels: next.map((entry, position) => ({ ...entry, level: position + 1 })) })
    setActiveIndex(target)
  }

  /// قيم حقول الإتاحة المعروضة. القيم الابتدائية للحقول فقط: القراءة في
  /// `parsePack` لا تخترع شيئًا، وصفحة اللعبة تعرض «غير مُعلَن» حتى يُسجّلها
  /// المحرّر من هنا فتُكتب فعلًا في الحزمة.
  const access = {
    simplified_motor: pack.accessibility?.simplified_motor ?? { tolerance_dp: 44, coverage_required: 0.6 },
    sequential_tap_alternative: pack.accessibility?.sequential_tap_alternative ?? false,
    reduced_motion_supported: pack.accessibility?.reduced_motion_supported,
    min_touch_target_dp: pack.accessibility?.min_touch_target_dp,
  }

  function patchAccess(next: Partial<typeof access>) {
    patch({ accessibility: { ...access, ...next } })
  }

  function setVoice(key: string, value: string) {    const next = { ...pack!.voice_manifest }
    if (value.trim()) next[key] = value.trim()
    else delete next[key]
    patch({ voice_manifest: next })
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
      // تفاصيل الرفض من الخادم تُعرض كما وردت: هي القائمة الكاملة لا رسالة عامة
      if (caught instanceof ApiError) setDetails(caught.details)
    } finally {
      setSaving(false)
    }
  }

  const levelIssues = (index: number) => issues.filter((issue) => issue.scope === `level:${index + 1}`)
  const packLevelIssues = issues.filter((issue) => issue.scope === 'pack')

  const requiredVoiceKeys = [...BASE_VOICE_KEYS] as string[]
  if (levels.some((entry) => (entry.stroke_paths ?? []).length > 0)) requiredVoiceKeys.push('vo.stroke_complete')
  if (levels.some((entry) => entry.coloring?.enabled)) requiredVoiceKeys.push('vo.coloring_intro')
  const voiceRows = [...new Set([...requiredVoiceKeys, ...Object.keys(pack.voice_manifest ?? {}), ...extraKeys])]

  const strokeMeta: StrokeMeta = {
    glyph: level?.glyph,
    language: level?.language,
    letter_form: level?.letter_form,
    writing_direction: level?.writing_direction,
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <header className="panel__header">
          <div><span className="panel__kicker">{text.title}</span><h3>{text.packSection}</h3><p>{text.intro}</p></div>
          <button className="button button--primary" type="button" onClick={() => void save()} disabled={saving}>
            <Icon name="upload" size={16} />{saving ? text.saving : text.save}
          </button>
        </header>

        <div className="entity-form">
          {error && <div className="inline-alert inline-alert--error">{error}</div>}
          {details.length > 0 && (
            <div className="inline-alert inline-alert--error">
              <strong>{text.serverDetails}</strong>
              <ul className="planned-list">{details.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          {status && <div className="inline-alert inline-alert--info">{status}</div>}

          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.packVersion}</span>
              <input type="number" min="1" max="1" value={pack.pack_version} onChange={(event) => patch({ pack_version: Number(event.target.value) })} />
              <small>{text.packVersionHint}</small>
            </label>
            <label className="field">
              <span>{text.packId}</span>
              <input dir="ltr" value={pack.pack_id ?? ''} onChange={(event) => patch({ pack_id: event.target.value })} />
            </label>
            <label className="field">
              <span>{text.localization}</span>
              <select value={pack.localization ?? 'language_neutral'} onChange={(event) => patch({ localization: event.target.value as PackLocalization })}>
                {PACK_LOCALIZATIONS.map((value) => <option value={value} key={value}>{text.localizations[value]}</option>)}
              </select>
            </label>
          </div>

          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.supervision}</span>
              <select value={pack.supervision_level ?? 'none'} onChange={(event) => patch({ supervision_level: event.target.value as PackSupervisionLevel })}>
                {SUPERVISION_LEVELS.map((value) => <option value={value} key={value}>{text.supervisions[value]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.levelsToFinish}</span>
              <input
                type="number" min="1" max={Math.max(levels.length, 1)}
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

          <div className="field">
            <span>{text.dpad}</span>
            {/* معطَّل لا مخفيّ: القيمة جزء من الحزمة ويجب أن تُرى، وسببها مكتوب */}
            <label className="checkbox-control">
              <input type="checkbox" checked={pack.supports_dpad === true} disabled onChange={() => undefined} />
              <span>false</span>
            </label>
            <small>{text.dpadNote}</small>
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.accessibility}</h3></header>
        <div className="entity-form">
          {/* حزمة قديمة قد لا تُعلن الوضع المبسّط. لا يُعوَّض صامتًا في القراءة
              (فذلك ادّعاء إتاحة لم يقرّره أحد)، لكن الحقول تُعرض بقيم ابتدائية
              معلَنة حتى يستطيع المحرّر تسجيله فعلًا، مع تنبيه صريح بأنه ناقص. */}
          {!pack.accessibility?.simplified_motor && (
            <div className="inline-alert inline-alert--error">{text.accessibilityMissing}</div>
          )}
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.simplifiedTolerance}</span>
              <input
                type="number" min="24" max="64"
                value={access.simplified_motor.tolerance_dp}
                onChange={(event) => patchAccess({ simplified_motor: { ...access.simplified_motor, tolerance_dp: Number(event.target.value) } })}
              />
            </label>
            <label className="field">
              <span>{text.simplifiedCoverage}</span>
              <input
                type="number" min="0.4" max="0.95" step="0.05"
                value={access.simplified_motor.coverage_required}
                onChange={(event) => patchAccess({ simplified_motor: { ...access.simplified_motor, coverage_required: Number(event.target.value) } })}
              />
            </label>
            <label className="field">
              <span>{text.minTouch}</span>
              <input
                type="number" min="40" max="96"
                value={access.min_touch_target_dp ?? 64}
                onChange={(event) => patchAccess({ min_touch_target_dp: Number(event.target.value) })}
              />
            </label>
          </div>
          <div className="form-grid">
            <div className="field">
              <span>{text.sequentialTap}</span>
              <label className="checkbox-control">
                <input
                  type="checkbox"
                  checked={access.sequential_tap_alternative === true}
                  onChange={(event) => patchAccess({ sequential_tap_alternative: event.target.checked })}
                />
                <span>{text.sequentialTap}</span>
              </label>
              <small>{text.sequentialTapNote}</small>
            </div>
            <div className="field">
              <span>{text.reducedMotion}</span>
              <label className="checkbox-control">
                <input
                  type="checkbox"
                  checked={access.reduced_motion_supported === true}
                  onChange={(event) => patchAccess({ reduced_motion_supported: event.target.checked })}
                />
                <span>{text.reducedMotion}</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.levels}</h3>
          <button className="button button--secondary" type="button" onClick={addLevel} disabled={levels.length >= MAX_LEVELS}>
            <Icon name="plus" size={15} />{text.addLevel}
          </button>
        </header>

        <div className="entity-form">
          <nav className="library-tabs" role="tablist" aria-label={text.levels}>
            {levels.map((entry, index) => (
              <button
                key={entry.level}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'library-tab library-tab--active' : 'library-tab'}
                onClick={() => setActiveIndex(index)}
              >
                <span>{text.level} {entry.level}</span>
                <strong>{entry.mode}</strong>
                {levelIssues(index).length > 0 && <span className="library-pill library-pill--paid">{levelIssues(index).length}</span>}
              </button>
            ))}
          </nav>

          {level && (
            <div className="page-stack">
              <div className="trace-editor__row">
                <button className="button button--ghost" type="button" onClick={() => moveLevel(activeIndex, -1)} disabled={activeIndex === 0}>▲</button>
                <button className="button button--ghost" type="button" onClick={() => moveLevel(activeIndex, 1)} disabled={activeIndex >= levels.length - 1}>▼</button>
                <button className="button button--ghost" type="button" onClick={() => removeLevel(activeIndex)} disabled={levels.length <= 1}>
                  <Icon name="archive" size={15} />{text.removeLevel}
                </button>
              </div>

              <div className="form-grid form-grid--three">
                <label className="field">
                  <span>{text.mode}</span>
                  <select value={level.mode} onChange={(event) => patchLevel(activeIndex, { mode: event.target.value as TraceMode })}>
                    {TRACE_MODES.map((value) => <option value={value} key={value}>{value}</option>)}
                  </select>
                  <small>{text.required}: {requiredLevelFields(level.mode).join(' · ') || '—'}</small>
                </label>
                <label className="field">
                  <span>{text.scoring}</span>
                  <select value={level.scoring} onChange={(event) => patchLevel(activeIndex, { scoring: event.target.value as TraceScoring })}>
                    {SCORING_MODES.map((value) => <option value={value} key={value}>{value}</option>)}
                  </select>
                  <small>{text.scoringAllowed((SCORING_BY_MODE[level.mode] ?? []).join(' · '))}</small>
                </label>
                <label className="field">
                  <span>{text.completion}</span>
                  <select
                    value={level.completion?.rule ?? 'all_strokes_complete'}
                    onChange={(event) => patchLevel(activeIndex, { completion: { ...level.completion, rule: event.target.value as CompletionRule } })}
                  >
                    {COMPLETION_RULES.map((value) => <option value={value} key={value}>{text.completionRules[value]}</option>)}
                  </select>
                </label>
              </div>

              <div className="form-grid form-grid--three">
                <label className="field">
                  <span>{text.promptKey}</span>
                  <input dir="ltr" value={level.prompt_key ?? ''} onChange={(event) => patchLevel(activeIndex, { prompt_key: event.target.value })} />
                  <small>{text.promptKeyHint}</small>
                </label>
                <label className="field">
                  <span>{text.toleranceDp}</span>
                  <input type="number" min="16" max="48" value={level.tolerance_dp ?? ''} onChange={(event) => patchLevel(activeIndex, { tolerance_dp: event.target.value === '' ? undefined : Number(event.target.value) })} />
                </label>
                <label className="field">
                  <span>{text.coverage}</span>
                  <input type="number" min="0.5" max="1" step="0.05" value={level.coverage_required ?? ''} onChange={(event) => patchLevel(activeIndex, { coverage_required: event.target.value === '' ? undefined : Number(event.target.value) })} />
                </label>
              </div>

              <div className="form-grid form-grid--three">
                <label className="field">
                  <span>{text.guideAudio}</span>
                  <input dir="ltr" value={level.guide_audio ?? ''} onChange={(event) => patchLevel(activeIndex, { guide_audio: event.target.value || undefined })} />
                </label>
                <label className="field">
                  <span>{text.background}</span>
                  <input dir="ltr" value={level.background_asset ?? ''} onChange={(event) => patchLevel(activeIndex, { background_asset: event.target.value || undefined })} />
                </label>
                <label className="field">
                  <span>{text.minStrokes}</span>
                  <input
                    type="number" min="1"
                    value={level.completion?.min_strokes ?? ''}
                    onChange={(event) => patchLevel(activeIndex, { completion: { ...level.completion, min_strokes: event.target.value === '' ? undefined : Number(event.target.value) } })}
                  />
                </label>
              </div>

              {levelIssues(activeIndex).length > 0 && (
                <ul className="planned-list">
                  {levelIssues(activeIndex).map((issue) => (
                    <li className={`pack-issue pack-issue--${issue.level}`} key={issue.text}>{issue.text}</li>
                  ))}
                </ul>
              )}

              <fieldset className="trace-editor__group">
                <legend>{text.geometry}</legend>
                {GEOMETRIC_MODES.includes(level.mode) ? (
                  <TracePathEditor
                    // مفتاح لكل مستوى: تاريخ التراجع محلّي في المحرّر، وبقاء
                    // نسخة واحدة عبر تبديل المستويات يعني أن «تراجع» قد يكتب
                    // هندسة مستوى في مستوى آخر.
                    key={`level-${level.level}`}
                    strokes={level.stroke_paths ?? []}
                    onChange={(strokes: TraceStroke[]) => patchLevel(activeIndex, { stroke_paths: strokes })}
                    mode={level.mode}
                    toleranceDp={level.tolerance_dp}
                    meta={strokeMeta}
                    onMetaChange={(next) => patchLevel(activeIndex, {
                      glyph: next.glyph || undefined,
                      language: next.language || undefined,
                      letter_form: next.letter_form,
                      writing_direction: next.writing_direction,
                    })}
                    backgroundAssetId={level.background_asset ?? level.coloring?.template_asset ?? null}
                  />
                ) : <p className="data-unavailable">{text.geometryUnused}</p>}
              </fieldset>

              {level.mode === 'connect_dots' && (
                <fieldset className="trace-editor__group">
                  <legend>{text.dots}</legend>
                  <div className="table-scroll" tabIndex={0}>
                    <table className="data-table">
                      <thead><tr><th>{text.dotId}</th><th>{text.dotOrder}</th><th>{text.dotX}</th><th>{text.dotY}</th><th>{text.dotLabel}</th><th /></tr></thead>
                      <tbody>
                        {(level.dots ?? []).map((dot, dotIndex) => {
                          const patchDot = (next: Partial<TraceConnectDot>) => patchLevel(activeIndex, {
                            dots: (level.dots ?? []).map((entry, position) => (position === dotIndex ? { ...entry, ...next } : entry)),
                          })
                          return (
                            <tr key={dot.id}>
                              <td><input dir="ltr" value={dot.id} onChange={(event) => patchDot({ id: event.target.value })} /></td>
                              <td><input type="number" min="1" value={dot.order} onChange={(event) => patchDot({ order: Number(event.target.value) })} /></td>
                              <td><input type="number" min="0" max="1" step="0.01" value={dot.at?.[0] ?? 0} onChange={(event) => patchDot({ at: [Number(event.target.value), dot.at?.[1] ?? 0] })} /></td>
                              <td><input type="number" min="0" max="1" step="0.01" value={dot.at?.[1] ?? 0} onChange={(event) => patchDot({ at: [dot.at?.[0] ?? 0, Number(event.target.value)] })} /></td>
                              <td><input dir="ltr" value={dot.label_key ?? ''} onChange={(event) => patchDot({ label_key: event.target.value || undefined })} /></td>
                              <td>
                                <button
                                  className="icon-button icon-button--small icon-button--danger" type="button"
                                  onClick={() => patchLevel(activeIndex, { dots: (level.dots ?? []).filter((_, position) => position !== dotIndex).map((entry, position) => ({ ...entry, order: position + 1 })) })}
                                ><Icon name="close" size={14} /></button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button
                    className="button button--secondary" type="button"
                    onClick={() => {
                      const dots = level.dots ?? []
                      patchLevel(activeIndex, { dots: [...dots, { id: `d${dots.length + 1}`, order: dots.length + 1, at: [0.5, 0.5] }] })
                    }}
                  ><Icon name="plus" size={15} />{text.addDot}</button>
                </fieldset>
              )}

              <fieldset className="trace-editor__group">
                <legend>{text.coloring}</legend>
                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    checked={level.coloring?.enabled === true}
                    onChange={(event) => patchLevel(activeIndex, {
                      coloring: event.target.checked
                        ? { ...level.coloring, enabled: true, palette: level.coloring?.palette ?? ['#FFD34D', '#00D6F5', '#FF6FAE'] }
                        : { ...level.coloring, enabled: false },
                    })}
                  />
                  <span>{text.coloringEnabled}</span>
                </label>
                {level.coloring?.enabled && (
                  <>
                    <div className="form-grid">
                      <label className="field">
                        <span>{text.regions}</span>
                        <input dir="ltr" value={(level.coloring.regions ?? []).join(' ')} onChange={(event) => patchLevel(activeIndex, { coloring: { ...level.coloring!, regions: lines(event.target.value.replace(/\s+/g, '\n')) } })} />
                      </label>
                      <label className="field">
                        <span>{text.templateAsset}</span>
                        <input dir="ltr" value={level.coloring.template_asset ?? ''} onChange={(event) => patchLevel(activeIndex, { coloring: { ...level.coloring!, template_asset: event.target.value || undefined } })} />
                      </label>
                    </div>
                    <div className="field">
                      <span>{text.palette}</span>
                      <div className="trace-palette">
                        {(level.coloring.palette ?? []).map((colour, colourIndex) => (
                          <span className="trace-palette__item" key={`${colour}-${colourIndex}`}>
                            <input
                              type="color"
                              value={colour}
                              aria-label={`${text.addColour} ${colourIndex + 1}`}
                              onChange={(event) => patchLevel(activeIndex, {
                                // المخطَّط يفرض #RRGGBB بأحرف كبيرة، ومنتقي
                                // اللون في المتصفّح يُعيدها صغيرة دائمًا.
                                coloring: { ...level.coloring!, palette: (level.coloring!.palette ?? []).map((entry, position) => (position === colourIndex ? event.target.value.toUpperCase() : entry)) },
                              })}
                            />
                            <code dir="ltr">{colour}</code>
                            <button
                              className="icon-button icon-button--small icon-button--danger" type="button"
                              onClick={() => patchLevel(activeIndex, { coloring: { ...level.coloring!, palette: (level.coloring!.palette ?? []).filter((_, position) => position !== colourIndex) } })}
                            ><Icon name="close" size={13} /></button>
                          </span>
                        ))}
                        <button
                          className="button button--ghost" type="button"
                          disabled={(level.coloring.palette ?? []).length >= 6}
                          onClick={() => patchLevel(activeIndex, { coloring: { ...level.coloring!, palette: [...(level.coloring!.palette ?? []), '#6A3DF2'] } })}
                        ><Icon name="plus" size={14} />{text.addColour}</button>
                      </div>
                      <small>{text.paletteHint}</small>
                    </div>
                  </>
                )}
              </fieldset>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.voice}</h3></header>
        <div className="entity-form">
          <small>{text.voiceHint}</small>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.voiceKey}</th><th>{text.voiceAsset}</th></tr></thead>
              <tbody>
                {voiceRows.map((key) => (
                  <tr key={key}>
                    <td><code dir="ltr">{key}</code>{requiredVoiceKeys.includes(key) && <span className="library-pill library-pill--age">★</span>}</td>
                    <td><input dir="ltr" value={pack.voice_manifest?.[key] ?? ''} onChange={(event) => setVoice(key, event.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="trace-editor__row">
            <input dir="ltr" placeholder="vo.hint" value={extraVoiceKey} onChange={(event) => setExtraVoiceKey(event.target.value)} />
            <button
              className="button button--ghost" type="button"
              disabled={!extraVoiceKey.trim()}
              // مفتاح بلا قيمة لا يُخزَّن في الحزمة (قيمة فارغة تعني حذفًا)، فيُحفظ
              // اسم الصفّ محليًا حتى يُلصق فيه معرّف الأصل.
              onClick={() => { setExtraKeys([...new Set([...extraKeys, extraVoiceKey.trim()])]); setExtraVoiceKey('') }}
            ><Icon name="plus" size={15} />{text.addVoiceKey}</button>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>{text.images}</span>
              <textarea rows={4} dir="ltr" value={(pack.assets?.images ?? []).join('\n')} onChange={(event) => patch({ assets: { ...pack.assets, images: lines(event.target.value) } })} />
            </label>
            <label className="field">
              <span>{text.audio}</span>
              <textarea rows={4} dir="ltr" value={(pack.assets?.audio ?? []).join('\n')} onChange={(event) => patch({ assets: { ...pack.assets, audio: lines(event.target.value) } })} />
            </label>
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.review}</h3></header>
        <div className="entity-form">
          <p className="panel--notice">{text.reviewNotice}</p>
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.reviewStatus}</span>
              <select
                value={pack.review?.linguistic_review?.status ?? 'not_required'}
                onChange={(event) => patch({ review: { linguistic_review: { ...pack.review?.linguistic_review, status: event.target.value as LinguisticReviewStatus } } })}
              >
                {REVIEW_STATUSES.map((value) => <option value={value} key={value}>{text.reviewStatuses[value]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.reviewer}</span>
              <input
                value={pack.review?.linguistic_review?.reviewer ?? ''}
                onChange={(event) => patch({ review: { linguistic_review: { status: pack.review?.linguistic_review?.status ?? 'pending', ...pack.review?.linguistic_review, reviewer: event.target.value || null } } })}
              />
            </label>
            <label className="field">
              <span>{text.reviewedAt}</span>
              <input
                type="date"
                value={(pack.review?.linguistic_review?.reviewed_at ?? '').slice(0, 10)}
                onChange={(event) => patch({ review: { linguistic_review: { status: pack.review?.linguistic_review?.status ?? 'pending', ...pack.review?.linguistic_review, reviewed_at: event.target.value || null } } })}
              />
            </label>
          </div>
          <label className="field">
            <span>{text.reviewNotes}</span>
            <textarea
              rows={3}
              value={pack.review?.linguistic_review?.notes ?? ''}
              onChange={(event) => patch({ review: { linguistic_review: { status: pack.review?.linguistic_review?.status ?? 'pending', ...pack.review?.linguistic_review, notes: event.target.value || null } } })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.issues}</h3></header>
        <div className="entity-form">
          {issues.length === 0 ? <p className="data-unavailable">{text.issuesNone}</p> : (
            <ul className="planned-list">
              {[...packLevelIssues, ...issues.filter((issue) => issue.scope !== 'pack')].map((issue) => (
                <li className={`pack-issue pack-issue--${issue.level}`} key={`${issue.scope}-${issue.text}`}>
                  <strong>{issue.scope === 'pack' ? text.packSection : `${text.level} ${issue.scope.split(':')[1]}`}</strong>
                  <span className="table-secondary"> · {issue.level === 'error' ? text.errorLabel : text.warningLabel}</span>
                  <p>{issue.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <details className="panel">
        <summary className="panel__header"><h3>{text.raw}</h3></summary>
        <div className="entity-form">
          <small>{text.rawHint}</small>
          {rawError && <div className="inline-alert inline-alert--error">{rawError}</div>}
          <textarea
            rows={18} dir="ltr" className="detail-json"
            value={raw || JSON.stringify(pack, null, 2)}
            onChange={(event) => { setRaw(event.target.value); setRawError('') }}
          />
          <div className="form-actions">
            <button
              className="button button--secondary" type="button"
              onClick={() => {
                try {
                  const parsed = JSON.parse(raw || JSON.stringify(pack)) as TracePack
                  setPack(parsed)
                  setRaw('')
                } catch {
                  setRawError(text.rawInvalid)
                }
              }}
            >{text.apply}</button>
          </div>
        </div>
      </details>
    </div>
  )
}
