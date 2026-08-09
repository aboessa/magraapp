/**
 * دوالّ نقيّة لتأليف حزمة trace_color: تبسيط المسار، القيم الافتراضية، ومرآة
 * قواعد الخادم.
 *
 * ## لماذا مرآة لا بديل
 *
 * `api/src/lib/gamePackValidation.ts` يصرّح: «لا يُعتمد على تحقق الواجهة
 * إطلاقًا». هذا الملف لا يخالف ذلك ولا يمنع الحفظ؛ كل ما يُنتجه **تنبيهات
 * مبكرة** تُعرض بجانب الحقل الذي سبّبها، فلا يكتشف المحرّر خطأ ترتيب الرسم بعد
 * جولة كاملة إلى الخادم. الحَكَم يبقى الخادم، وما يرفضه يُعرض كما ورد.
 *
 * القواعد أدناه منسوخة عن ملف الخادم بالترتيب نفسه لتسهيل مقارنتها عند تغييره.
 * ما لا يمكن للواجهة معرفته — وجود الأصل في content_assets وحالته، والمراجعة
 * اللغوية المعتمدة — ليس هنا: تُقرأ من مسار الجاهزية لا تُخمَّن.
 *
 * ## لماذا الإحداثيّات هنا
 *
 * التبسيط (Ramer–Douglas–Peucker) والتقريب والحصر في [0,1] دوالّ نقيّة قصيرة،
 * ووضعها في مكوّن React يعني أنها تُعاد كتابتها في أي محرّر آخر لاحقًا.
 */

import type { Locale } from '../context/preferences'
import type {
  LinguisticReview,
  NormalizedPoint,
  TraceLevel,
  TraceMode,
  TracePack,
  TraceStroke,
} from '../types/gamePack'

export type PackIssueLevel = 'error' | 'warning'

export interface PackIssue {
  level: PackIssueLevel
  /// أين يُعرض التنبيه: `pack` أو `level:3`.
  scope: string
  text: string
}

/// أي درجات تقييم صادقة لكل نمط رسم. منسوخة عن `SCORING_BY_MODE` في الخادم:
/// لا تعرّف بصور في مجرّة، فما لا يمكن قياسه موضوعيًا لا يُمنح درجة.
export const SCORING_BY_MODE: Record<TraceMode, readonly string[]> = {
  line: ['geometric'],
  curve: ['geometric'],
  path: ['geometric'],
  shape: ['geometric', 'geometric_ordered'],
  number: ['geometric', 'geometric_ordered'],
  letter: ['geometric_ordered'],
  connect_dots: ['sequence'],
  copy_pattern: ['discrete', 'none'],
  complete_drawing: ['geometric', 'none'],
  coloring: ['none'],
  free_draw: ['none'],
  draw_from_prompt: ['none'],
}

/// أنماط تُنتج أثرًا للطفل لا قياسًا، فلا تُقيَّم أبدًا.
export const CREATION_MODES: readonly TraceMode[] = [
  'coloring', 'free_draw', 'draw_from_prompt', 'complete_drawing', 'copy_pattern',
]

/// أنماط تحمل مستوياتها هندسة قابلة للتتبّع.
export const GEOMETRIC_MODES: readonly TraceMode[] = [
  'line', 'curve', 'path', 'shape', 'number', 'letter', 'copy_pattern',
]

export const BASE_VOICE_KEYS = [
  'vo.intro', 'vo.instruction', 'vo.instruction_repeat',
  'vo.level_complete', 'vo.game_complete', 'vo.exit_confirm',
] as const

const I18N_KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/
const ASSET_ID = /^[A-Za-z0-9_-]{3,128}$/
const PACK_ID = /^[a-z0-9][a-z0-9-]{2,63}$/
const HEX_COLOUR = /^#[0-9A-F]{6}$/
const STROKE_ID = /^s[0-9]+$/

/// أقصى عدد خطوات في مستوى واحد (`maxItems` في المخطَّط). حرف بأربع خطوات
/// يُرفض من الخادم، فيُنبَّه عليه قبل الحفظ.
export const MAX_STROKES_PER_LEVEL = 3
export const MAX_LEVELS = 10

/// قماش مرجعي بوحدات dp لرسم شريط التفاوت في المعاينة.
///
/// `tolerance_dp` تُحلّ على قماش الطفل وقت التشغيل، فلا عرض ثابت لها في الواجهة.
/// الرسم هنا نسبةً إلى قماش 320dp — قماش هاتف صغير معقول — ويُصرَّح بذلك في نصّ
/// المعاينة بدل تقديم الشريط كقياس نهائي.
export const REFERENCE_CANVAS_DP = 320

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/// ثلاث خانات عشرية: أدقّ من حاجة قماش 0..1 على أي شاشة، وأقصر بكثير من ناتج
/// السحب الخام الذي يحمل 15 خانة لا معنى لها.
export function roundCoord(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000
}

export function normalizePoint(x: number, y: number): NormalizedPoint {
  return [roundCoord(x), roundCoord(y)]
}

/// مسافة نقطة عن قطعة مستقيمة (لا عن مستقيم لا نهائي).
///
/// القطعة هي الصحيح هنا: الأشكال المغلقة تبدأ وتنتهي عند النقطة نفسها، فتصير
/// القطعة نقطة، والمسافة عن مستقيم لا نهائي تصير قسمة على صفر.
function segmentDistance(point: NormalizedPoint, start: NormalizedPoint, end: NormalizedPoint): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1])
  let t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy))
}

/**
 * تبسيط Ramer–Douglas–Peucker.
 *
 * السحب بالإصبع أو القلم يولّد مئات النقاط المتلاصقة؛ تخزينها يضخّم الحزمة بلا
 * فائدة ويجعل تحرير نقطة واحدة مستحيلًا. التبسيط يُبقي النقاط التي تحمل شكل
 * المسار ويحذف ما بينها، بحدّ تفاوت يختاره المحرّر ويرى أثره فورًا.
 */
export function simplifyPath(points: NormalizedPoint[], tolerance: number): NormalizedPoint[] {
  if (points.length <= 2 || tolerance <= 0) return points.map((point) => [point[0], point[1]] as NormalizedPoint)
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return []

  let index = -1
  let largest = 0
  for (let i = 1; i < points.length - 1; i += 1) {
    const candidate = points[i]
    if (!candidate) continue
    const distance = segmentDistance(candidate, first, last)
    if (distance > largest) {
      largest = distance
      index = i
    }
  }

  if (index < 0 || largest <= tolerance) return [[first[0], first[1]], [last[0], last[1]]]

  const head = simplifyPath(points.slice(0, index + 1), tolerance)
  const tail = simplifyPath(points.slice(index), tolerance)
  return [...head.slice(0, -1), ...tail]
}

/// يعيد ترقيم الخطوات 1..n بلا فراغ. الخادم يرفض الفراغ لأن المحرّك يسير على
/// الترتيب، فخطوة برقم مفقود تصير غير قابلة للوصول إليها أبدًا.
export function renumberStrokes(strokes: TraceStroke[]): TraceStroke[] {
  return strokes.map((stroke, index) => ({ ...stroke, order: index + 1 }))
}

/// معرّف خطوة جديد لا يصادم الموجود. الصيغة `^s[0-9]+$` من المخطَّط.
export function nextStrokeId(strokes: TraceStroke[]): string {
  let candidate = strokes.length + 1
  const taken = new Set(strokes.map((stroke) => stroke.id))
  while (taken.has(`s${candidate}`)) candidate += 1
  return `s${candidate}`
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/// يقرأ حزمة مخزَّنة كما هي بلا إصلاح صامت.
///
/// الحزمة قد تكون مؤلَّفة يدويًا أو ناقصة أو من إصدار سابق. القراءة تُبقي ما
/// تجده وتكتفي بضمان الحدّ الأدنى الذي تحتاجه الواجهة لتُعرض (مصفوفات موجودة،
/// كائنات موجودة). لا تُصلح قيمة خاطئة: التنبيهات وظيفة `packIssues`، والإصلاح
/// الصامت يخفي عن المحرّر ما يجب أن يراه.
export function parsePack(value: unknown): TracePack | null {
  if (!isObject(value) || Object.keys(value).length === 0) return null
  const levels = Array.isArray(value.levels) ? value.levels.filter(isObject) : []
  const accessibility = isObject(value.accessibility) ? value.accessibility : null
  const simplified = accessibility && isObject(accessibility.simplified_motor) ? accessibility.simplified_motor : null
  const progression = isObject(value.progression) ? value.progression : {}
  const assets = isObject(value.assets) ? value.assets : {}
  const voice = isObject(value.voice_manifest) ? value.voice_manifest : {}
  const review = isObject(value.review) ? value.review : {}
  const linguistic = isObject(review.linguistic_review) ? review.linguistic_review : null

  return {
    ...value,
    pack_version: Number(value.pack_version) || 1,
    engine_id: typeof value.engine_id === 'string' ? value.engine_id : 'trace_color',
    progression: {
      levels_to_finish: Number(progression.levels_to_finish) || levels.length || 1,
      advance_on: progression.advance_on === 'manual' ? 'manual' : 'level_complete',
    },
    levels: levels as unknown as TraceLevel[],
    assets: {
      images: Array.isArray(assets.images) ? assets.images.filter((item): item is string => typeof item === 'string') : [],
      audio: Array.isArray(assets.audio) ? assets.audio.filter((item): item is string => typeof item === 'string') : [],
    },
    voice_manifest: Object.fromEntries(
      Object.entries(voice).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
    // الوضع المبسّط لا يُعوَّض بقيمة افتراضية: حزمة لا تُعلنه تُعرض «غير مُعلَن»،
    // وأي رقم مخترع هنا يصير ادّعاء إتاحة لم يقرّره أحد.
    accessibility: accessibility
      ? {
          ...accessibility,
          simplified_motor: simplified
            ? {
                tolerance_dp: Number(simplified.tolerance_dp),
                coverage_required: Number(simplified.coverage_required),
              }
            : undefined,
          sequential_tap_alternative: accessibility.sequential_tap_alternative === true,
        }
      : undefined,
    review: linguistic
      ? { linguistic_review: linguistic as unknown as LinguisticReview }
      : (value.review as TracePack['review']),
  } as TracePack
}

/// حزمة ابتدائية صالحة بنيويًا: مستوى واحد بلا هندسة بعد.
///
/// `supports_dpad: false` ليست قيمة افتراضية تجميلية: المحرّك يحتاج مؤشِّرًا،
/// وحزمة تدّعي دعم لوحة التلفاز تُعرض على التلفاز ثم لا تُلعَب.
export function emptyTracePack(packId: string): TracePack {
  return {
    pack_version: 1,
    engine_id: 'trace_color',
    pack_id: packId,
    localization: 'language_neutral',
    supports_dpad: false,
    supervision_level: 'none',
    progression: { levels_to_finish: 1, advance_on: 'level_complete' },
    levels: [emptyLevel(1)],
    assets: { images: [], audio: [] },
    voice_manifest: {},
    accessibility: {
      simplified_motor: { tolerance_dp: 44, coverage_required: 0.6 },
      sequential_tap_alternative: true,
      reduced_motion_supported: true,
      min_touch_target_dp: 64,
    },
    review: { linguistic_review: { status: 'not_required' } },
  }
}

export function emptyLevel(level: number): TraceLevel {
  return {
    level,
    mode: 'shape',
    scoring: 'geometric',
    prompt_key: `game.pack.level_${level}.prompt`,
    completion: { rule: 'all_strokes_complete' },
    tolerance_dp: 28,
    coverage_required: 0.8,
    stroke_paths: [],
  }
}

/// الحقول التي يفرضها المخطَّط لكل نمط، لتُعلَّم في النموذج بنجمة صادقة.
export function requiredLevelFields(mode: TraceMode): string[] {
  if (mode === 'letter') {
    return ['language', 'glyph', 'letter_form', 'writing_direction', 'guide_audio', 'stroke_paths', 'tolerance_dp', 'coverage_required']
  }
  if (mode === 'number') return ['glyph', 'guide_audio', 'stroke_paths', 'tolerance_dp', 'coverage_required']
  if (mode === 'connect_dots') return ['dots']
  if (mode === 'coloring') return ['coloring']
  if (GEOMETRIC_MODES.includes(mode)) return ['stroke_paths', 'tolerance_dp', 'coverage_required']
  return []
}

const copy = {
  ar: {
    scoring: (mode: string, allowed: string, scoring: string, creation: boolean) =>
      `النمط «${mode}» لا يقبل إلا التقييم ${allowed} لا «${scoring}». `
      + (creation ? 'التعبير الحرّ لا يُقيَّم، ولا تعرّف بالصور في المنصّة.' : 'التقييم يجب أن يطابق ما يمكن قياسه موضوعيًا.'),
    orderedRequired: (mode: string, count: number) =>
      `«${mode}» بـ${count} خطوات يستلزم التقييم «geometric_ordered»: رسم الخطوات بترتيب مقلوب يُنتج شكلًا آخر.`,
    levelNumbers: (found: number, expected: number) =>
      `رقم المستوى ${found} في الموضع ${expected}: الأرقام تسير 1..n بلا فراغ ولا تكرار.`,
    levelsToFinish: (toFinish: number, count: number) =>
      `progression.levels_to_finish (${toFinish}) أكبر من عدد المستويات (${count}).`,
    dpad: 'المحرّك يحتاج مؤشِّرًا: supports_dpad يجب أن تكون false.',
    strokeOrder: (found: string, count: number) =>
      `ترتيب الخطوات يجب أن يسير 1..${count} بلا فراغ، والموجود: ${found}.`,
    strokeIdDuplicate: (id: string) => `معرّف خطوة مكرَّر: ${id}.`,
    strokeIdShape: (id: string) => `معرّف الخطوة «${id}» لا يطابق الصيغة s1 s2 s3.`,
    dotPoints: (id: string) => `الخطوة «${id}» نقطة، فتحمل نقطة واحدة بالضبط: النقطة تُلمَس ولا تُسحَب.`,
    strokePoints: (id: string) => `الخطوة «${id}» تحتاج نقطتين على الأقل لتكون قابلة للتتبّع.`,
    strokeCount: (count: number) => `${count} خطوات في مستوى واحد: المخطَّط يسمح بـ${MAX_STROKES_PER_LEVEL} كحدّ أقصى.`,
    dotsBeforeBody: (body: number, dot: number) =>
      `نقطة الحرف مرتَّبة قبل جسمه (ترتيب الجسم ${body}، ترتيب النقطة ${dot}). المعيار المقيس هو الجسم ثم النقطة.`,
    letterLocalization: 'حزمة تحوي مستويات حروف يجب أن تعلن localization = language_specific.',
    missingField: (field: string) => `حقل مفروض للنمط وغير معرَّف: ${field}.`,
    tolerance: (value: number) => `tolerance_dp = ${value} خارج المدى المسموح 16..48.`,
    coverage: (value: number) => `coverage_required = ${value} خارج المدى المسموح 0.5..1.`,
    simplifiedTolerance: (simplified: number, level: number) =>
      `تفاوت الوضع المبسّط (${simplified}) يجب ألا يقلّ عن تفاوت المستوى (${level}): وضع «مبسّط» أصعب من العادي أسوأ من عدمه.`,
    simplifiedCoverage: (simplified: number, level: number) =>
      `تغطية الوضع المبسّط (${simplified}) يجب ألا تزيد على تغطية المستوى (${level}).`,
    simplifiedRange: 'الوضع المبسّط: التفاوت 24..64 والتغطية 0.4..0.95.',
    simplifiedMissing: 'الحزمة لا تُعلن وضعًا حركيًا مبسّطًا، والمخطَّط يفرضه.',
    sequentialTap: 'بديل اللمس المتتابع مفروض في المخطَّط ولا يجوز إسقاطه.',
    completionStrokes: 'قاعدة الإكمال «all_strokes_complete» تحتاج خطوات مرسومة.',
    completionDots: 'قاعدة الإكمال «all_dots_connected» تحتاج نقاط توصيل.',
    completionTaps: (mode: string) =>
      `النمط غير المُقيَّم «${mode}» يكمل بـ«child_taps_done» ليقرّر الطفل متى انتهى.`,
    dotsOrder: (count: number) => `ترتيب نقاط التوصيل يجب أن يسير 1..${count} بلا فراغ.`,
    palette: (count: number) => `لوحة التلوين ${count} لونًا: المخطَّط يفرض من 3 إلى 6.`,
    paletteHex: (value: string) => `لون غير صالح «${value}»: الصيغة #RRGGBB بأحرف كبيرة.`,
    paletteMissing: 'التلوين مُفعَّل بلا لوحة ألوان، والنشر يرفض ذلك.',
    promptKey: (key: string) => `prompt_key «${key}» ليس مفتاح ترجمة صالحًا: نصّ ظاهر في الحزمة يجعلها غير قابلة للترجمة.`,
    assetId: (field: string, value: string) => `معرّف الأصل في ${field} غير صالح: «${value}».`,
    packId: (value: string) => `pack_id «${value}» لا يطابق صيغة المخطَّط.`,
    voiceKey: (key: string) => `مفتاح صوت مفروض وغير معرَّف: ${key}. المسوّدة تُحفَظ، والنشر يُرفض.`,
    reviewPending: (status: string) =>
      `حزمة الحروف تحتاج مراجعة عربية معتمدة لترتيب الرسم (الحالة: ${status}). هذه الأداة لا تمنحها.`,
    engineMismatch: (value: string) => `engine_id في الحزمة «${value}» لا يطابق trace_color.`,
  },
  en: {
    scoring: (mode: string, allowed: string, scoring: string, creation: boolean) =>
      `Mode "${mode}" may only use scoring ${allowed}, not "${scoring}". `
      + (creation ? 'Free expression is never graded and the platform has no image recognition.' : 'Scoring must match what the mode can objectively measure.'),
    orderedRequired: (mode: string, count: number) =>
      `"${mode}" with ${count} strokes must use scoring "geometric_ordered"; the wrong order produces a different glyph.`,
    levelNumbers: (found: number, expected: number) =>
      `Level number ${found} at position ${expected}: numbers must run 1..n without gaps or repeats.`,
    levelsToFinish: (toFinish: number, count: number) =>
      `progression.levels_to_finish (${toFinish}) exceeds the ${count} level(s) in the pack.`,
    dpad: 'The engine needs a pointer: supports_dpad must be false.',
    strokeOrder: (found: string, count: number) =>
      `Stroke order must run 1..${count} without gaps, found ${found}.`,
    strokeIdDuplicate: (id: string) => `Duplicate stroke id: ${id}.`,
    strokeIdShape: (id: string) => `Stroke id "${id}" does not match s1, s2, s3.`,
    dotPoints: (id: string) => `Stroke "${id}" is a dot and must carry exactly one point: a dot is tapped, not dragged.`,
    strokePoints: (id: string) => `Stroke "${id}" needs at least two points to be traceable.`,
    strokeCount: (count: number) => `${count} strokes in one level: the schema allows at most ${MAX_STROKES_PER_LEVEL}.`,
    dotsBeforeBody: (body: number, dot: number) =>
      `A letter dot is ordered before the body (body order ${body}, dot order ${dot}). The measured criterion is body before dot.`,
    letterLocalization: 'A pack containing letter levels must declare localization = language_specific.',
    missingField: (field: string) => `Required for this mode and not set: ${field}.`,
    tolerance: (value: number) => `tolerance_dp = ${value} is outside the allowed 16..48.`,
    coverage: (value: number) => `coverage_required = ${value} is outside the allowed 0.5..1.`,
    simplifiedTolerance: (simplified: number, level: number) =>
      `Simplified-motor tolerance (${simplified}) must be at least the level tolerance (${level}); a stricter "accessible" mode is worse than none.`,
    simplifiedCoverage: (simplified: number, level: number) =>
      `Simplified-motor coverage (${simplified}) must not exceed the level requirement (${level}).`,
    simplifiedRange: 'Simplified motor: tolerance 24..64 and coverage 0.4..0.95.',
    simplifiedMissing: 'The pack declares no simplified-motor mode, and the schema requires one.',
    sequentialTap: 'The sequential-tap alternative is mandatory in the schema and cannot be dropped.',
    completionStrokes: 'Completion rule "all_strokes_complete" needs stroke paths.',
    completionDots: 'Completion rule "all_dots_connected" needs dots.',
    completionTaps: (mode: string) =>
      `Unscored mode "${mode}" must complete on "child_taps_done" so the child decides when it is finished.`,
    dotsOrder: (count: number) => `connect_dots order must run 1..${count} without gaps.`,
    palette: (count: number) => `The palette has ${count} colours: the schema requires 3 to 6.`,
    paletteHex: (value: string) => `Invalid colour "${value}": the format is #RRGGBB in upper case.`,
    paletteMissing: 'Colouring is enabled with no palette, and publish rejects that.',
    promptKey: (key: string) => `prompt_key "${key}" is not a valid translation key: visible prose in a pack cannot be translated.`,
    assetId: (field: string, value: string) => `Invalid asset id in ${field}: "${value}".`,
    packId: (value: string) => `pack_id "${value}" does not match the schema pattern.`,
    voiceKey: (key: string) => `Required voice key missing: ${key}. A draft saves; a publish is refused.`,
    reviewPending: (status: string) =>
      `A letter pack needs an approved Arabic review of stroke order (status: ${status}). This tool does not grant it.`,
    engineMismatch: (value: string) => `Pack engine_id "${value}" does not match trace_color.`,
  },
}

/// تنبيه ترتيب الحروف: الجسم قبل النقاط.
///
/// **لا يُصلَح صامتًا.** ترتيب رسم الحرف حكم لغوي، وإعادة ترتيبه تلقائيًا تعني
/// أنّ الأداة تدّعي معرفة لا تملكها. المعروض تنبيه، والقرار للمحرّر ثم للمراجع.
export function letterOrderIssue(strokes: TraceStroke[], locale: Locale): string | null {
  const body = strokes.filter((stroke) => stroke.type !== 'dot').map((stroke) => stroke.order)
  const dots = strokes.filter((stroke) => stroke.type === 'dot').map((stroke) => stroke.order)
  if (!body.length || !dots.length) return null
  const maxBody = Math.max(...body)
  const minDot = Math.min(...dots)
  return minDot < maxBody ? copy[locale].dotsBeforeBody(maxBody, minDot) : null
}

/// تنبيهات شكل الخطوات وحدها: تُستخدم داخل المحرّر حيث لا حزمة كاملة بعد.
export function strokeIssues(strokes: TraceStroke[], mode: TraceMode, locale: Locale): string[] {
  const text = copy[locale]
  const issues: string[] = []
  if (!strokes.length) return issues

  const orders = strokes.map((stroke) => stroke.order).sort((a, b) => a - b)
  if (orders.some((value, index) => value !== index + 1)) {
    issues.push(text.strokeOrder(orders.join(','), strokes.length))
  }

  const seen = new Set<string>()
  for (const stroke of strokes) {
    if (seen.has(stroke.id)) issues.push(text.strokeIdDuplicate(stroke.id))
    seen.add(stroke.id)
    if (!STROKE_ID.test(stroke.id)) issues.push(text.strokeIdShape(stroke.id))
    if (stroke.type === 'dot' && stroke.points.length !== 1) issues.push(text.dotPoints(stroke.id))
    if (stroke.type !== 'dot' && stroke.points.length < 2) issues.push(text.strokePoints(stroke.id))
  }

  if (strokes.length > MAX_STROKES_PER_LEVEL) issues.push(text.strokeCount(strokes.length))
  if (mode === 'letter') {
    const order = letterOrderIssue(strokes, locale)
    if (order) issues.push(order)
  }
  return issues
}

function levelScope(level: TraceLevel): string {
  return `level:${level.level}`
}

/**
 * كل ما تستطيع الواجهة كشفه في الحزمة، بمستوى «خطأ» أو «تنبيه».
 *
 * «خطأ» يعني أن الخادم سيرفض الحفظ، و«تنبيه» يعني أن المسوّدة تُحفَظ والنشر
 * يُرفض. الفصل مقصود: المحرّر يحتاج أن يعرف ما يمنعه الآن وما سيمنعه لاحقًا.
 */
export function packIssues(pack: TracePack, locale: Locale): PackIssue[] {
  const text = copy[locale]
  const issues: PackIssue[] = []
  const push = (level: PackIssueLevel, scope: string, message: string) => {
    issues.push({ level, scope, text: message })
  }

  if (pack.engine_id !== 'trace_color') push('error', 'pack', text.engineMismatch(pack.engine_id))
  if (pack.supports_dpad === true) push('error', 'pack', text.dpad)
  if (pack.pack_id && !PACK_ID.test(pack.pack_id)) push('error', 'pack', text.packId(pack.pack_id))

  const levels = pack.levels ?? []
  levels.forEach((level, index) => {
    if (Number(level.level) !== index + 1) push('error', 'pack', text.levelNumbers(Number(level.level), index + 1))
  })
  const toFinish = Number(pack.progression?.levels_to_finish)
  if (Number.isFinite(toFinish) && toFinish > levels.length) {
    push('error', 'pack', text.levelsToFinish(toFinish, levels.length))
  }

  const simplified = pack.accessibility?.simplified_motor
  const simplifiedTolerance = Number(simplified?.tolerance_dp)
  const simplifiedCoverage = Number(simplified?.coverage_required)
  if (pack.accessibility?.sequential_tap_alternative !== true) push('error', 'pack', text.sequentialTap)
  if (!simplified) push('error', 'pack', text.simplifiedMissing)
  else if (Number.isFinite(simplifiedTolerance) && (simplifiedTolerance < 24 || simplifiedTolerance > 64)) {
    push('error', 'pack', text.simplifiedRange)
  } else if (Number.isFinite(simplifiedCoverage) && (simplifiedCoverage < 0.4 || simplifiedCoverage > 0.95)) {
    push('error', 'pack', text.simplifiedRange)
  }

  const hasLetterLevel = levels.some((level) => level.mode === 'letter')
  if (hasLetterLevel && pack.localization !== 'language_specific') {
    push('error', 'pack', text.letterLocalization)
  }

  for (const level of levels) {
    const scope = levelScope(level)
    const mode = level.mode
    const allowed = SCORING_BY_MODE[mode]
    if (allowed && !allowed.includes(level.scoring)) {
      push('error', scope, text.scoring(
        mode,
        allowed.map((item) => `«${item}»`).join(locale === 'ar' ? ' أو ' : ' or '),
        level.scoring,
        CREATION_MODES.includes(mode),
      ))
    }

    const strokes = level.stroke_paths ?? []
    for (const message of strokeIssues(strokes, mode, locale)) push('error', scope, message)
    if ((mode === 'letter' || mode === 'number') && strokes.length > 1 && level.scoring !== 'geometric_ordered') {
      push('error', scope, text.orderedRequired(mode, strokes.length))
    }

    for (const field of requiredLevelFields(mode)) {
      const value = (level as unknown as Record<string, unknown>)[field]
      const absent = value === undefined || value === null || value === ''
        || (Array.isArray(value) && value.length === 0)
      if (absent) push('error', scope, text.missingField(field))
    }

    if (!I18N_KEY.test(level.prompt_key ?? '')) push('error', scope, text.promptKey(level.prompt_key ?? ''))

    const tolerance = Number(level.tolerance_dp)
    if (Number.isFinite(tolerance) && (tolerance < 16 || tolerance > 48)) push('error', scope, text.tolerance(tolerance))
    const coverage = Number(level.coverage_required)
    if (Number.isFinite(coverage) && (coverage < 0.5 || coverage > 1)) push('error', scope, text.coverage(coverage))

    if (Number.isFinite(tolerance) && Number.isFinite(simplifiedTolerance) && simplifiedTolerance < tolerance) {
      push('error', scope, text.simplifiedTolerance(simplifiedTolerance, tolerance))
    }
    if (Number.isFinite(coverage) && Number.isFinite(simplifiedCoverage) && simplifiedCoverage > coverage) {
      push('error', scope, text.simplifiedCoverage(simplifiedCoverage, coverage))
    }

    const dots = level.dots ?? []
    if (dots.length) {
      const orders = dots.map((dot) => Number(dot.order)).sort((a, b) => a - b)
      if (orders.some((value, index) => value !== index + 1)) push('error', scope, text.dotsOrder(dots.length))
    }

    const rule = level.completion?.rule
    if (rule === 'all_strokes_complete' && !strokes.length) push('error', scope, text.completionStrokes)
    if (rule === 'all_dots_connected' && !dots.length) push('error', scope, text.completionDots)
    if (CREATION_MODES.includes(mode) && level.scoring === 'none' && rule !== 'child_taps_done') {
      push('error', scope, text.completionTaps(mode))
    }

    const coloring = level.coloring
    if (coloring?.enabled) {
      const palette = coloring.palette ?? []
      if (!palette.length) push('warning', scope, text.paletteMissing)
      else if (palette.length < 3 || palette.length > 6) push('error', scope, text.palette(palette.length))
      for (const colour of palette) {
        if (!HEX_COLOUR.test(colour)) push('error', scope, text.paletteHex(colour))
      }
    }

    for (const [field, value] of [
      ['guide_audio', level.guide_audio],
      ['background_asset', level.background_asset],
      ['coloring.template_asset', level.coloring?.template_asset],
    ] as Array<[string, string | undefined]>) {
      if (value && !ASSET_ID.test(value)) push('error', scope, text.assetId(field, value))
    }
  }

  // مفاتيح الصوت: ناقصها تنبيه على المسوّدة ورفض عند النشر، كما يفصل الخادم.
  const requiredVoice = [...BASE_VOICE_KEYS] as string[]
  if (levels.some((level) => (level.stroke_paths ?? []).length > 0)) requiredVoice.push('vo.stroke_complete')
  if (levels.some((level) => level.coloring?.enabled === true)) requiredVoice.push('vo.coloring_intro')
  for (const key of requiredVoice) {
    if (!pack.voice_manifest?.[key]) push('warning', 'pack', text.voiceKey(key))
  }

  if (hasLetterLevel) {
    const status = pack.review?.linguistic_review?.status ?? 'pending'
    if (status !== 'approved') push('warning', 'pack', text.reviewPending(status))
  }

  return issues
}

/// أنماط الرسم المستخدمة في الحزمة، لعرضها في صفحة اللعبة بلا تخمين.
export function usedModes(pack: TracePack | null): TraceMode[] {
  if (!pack) return []
  return [...new Set((pack.levels ?? []).map((level) => level.mode))]
}

/// مفاتيح التوجيه التي تحتاج ترجمة، مأخوذة من الحزمة نفسها.
export function promptKeysOf(pack: TracePack | null): string[] {
  if (!pack) return []
  return [...new Set((pack.levels ?? []).map((level) => level.prompt_key).filter(Boolean))].sort()
}
