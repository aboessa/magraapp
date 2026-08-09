/**
 * مرآة قواعد الخادم لحزم المحرّكات الأحد عشر.
 *
 * ## مرآة لا بديل
 *
 * `api/src/lib/gamePackValidation.ts` يصرّح: «لا يُعتمد على تحقق الواجهة
 * إطلاقًا». هذا الملف لا يخالف ذلك ولا يمنع الحفظ. كل ما يُنتجه **تنبيهات مبكرة**
 * تُعرض بجانب الحقل الذي سبّبها، لأن البديل هو ما كان يحدث: يؤلّف المحرّر خمسة
 * مستويات، يحفظ، فيقرأ رسالة عن `answer` في عنصر `q3` لا يعرف أين يجده.
 *
 * القواعد أدناه منسوخة عن ثلاثة مصادر بالترتيب نفسه:
 *
 *  * `docs/games/schemas/<engine>.v1.schema.json` — الشكل والمدَيات والقوائم.
 *  * `api/src/lib/gamePackValidation.ts` — قواعد الظرف والعقد الاثنتا عشرة.
 *  * `api/src/lib/enginePackRules.ts` — ما لا يستطيع المخطَّط قوله: أن الجواب
 *    يساوي عدد العناصر المعروضة فعلًا، وأن حلّ المرجع يصل إلى الهدف.
 *
 * ## الفصل بين «خطأ» و«تنبيه» ليس تجميليًا
 *
 * «خطأ» يعني أن الخادم سيرفض الحفظ الآن، و«تنبيه» يعني أن المسوّدة تُحفَظ والنشر
 * يُرفض لاحقًا. التأليف تكراري بطبعه: صوت غير مسجَّل ومراجعة معلَّقة حالتان
 * طبيعيتان في منتصف العمل، وعرضهما كأخطاء يعلّم المحرّر تجاهل اللون الأحمر.
 *
 * ## ما ليس هنا
 *
 * وجود الأصل في `content_assets` وحالته، والمراجعات البشرية المسجَّلة في
 * `content_reviews`، وترخيص الخطّ العربي: لا تُخمَّن هنا بل تُقرأ من مسار
 * الجاهزية. الواجهة لا تعرفها، وادّعاء معرفتها يعني جاهزية مُختلقة.
 */

import type { Locale } from '../context/preferences'
import type { PackIssue, PackIssueLevel } from './tracePack'
import { BASE_VOICE_KEYS, MAX_LEVELS } from './tracePack'
import {
  ASSET_ID_PATTERN,
  BLOCK_TOKEN_PATTERN,
  I18N_KEY_PATTERN,
  LANGUAGE_TAG_PATTERN,
  NON_CONNECTING_AR,
  PACK_ID_PATTERN,
  REGION_BOUNDS,
  SIM_ID_PATTERN,
  VOICE_KEY_PATTERN,
  asArray,
  asRecords,
  blockGridSpec,
  boundsForRegion,
  engineContract,
  expectedArabicForm,
  isObject,
  runBlockProgram,
  wordChars,
} from './enginePack'
import type { BlockCell, BlockGrid, EnginePack } from '../types/enginePack'

/// ما تعرفه الواجهة عن صفّ اللعبة، وتحتاجه القواعد العمرية.
export interface EngineIssueContext {
  ageMin: number
  ageMax: number
  /// `games.learning_objective_id` موجود أم لا. المحرّكان «ترفيه أولًا» يجب ألّا
  /// يحملا هدفًا تعليميًا، والخادم يرفض ذلك.
  hasLearningObjective?: boolean
  /// `games.supervision_level`، لمقارنته بما تعلنه الحزمة.
  gameSupervisionLevel?: string
}

interface Sink {
  push: (level: PackIssueLevel, scope: string, text: string) => void
  locale: Locale
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

const copy = {
  ar: {
    engineMismatch: (found: string, expected: string) => `engine_id في الحزمة «${found}» لا يطابق محرّك اللعبة «${expected}».`,
    packId: (value: string) => `pack_id «${value}» لا يطابق صيغة المخطَّط (أحرف صغيرة وأرقام وشرطات، 3..64).`,
    packVersion: 'pack_version يجب أن يكون عددًا صحيحًا لا يقلّ عن 1.',
    levelNumbers: (found: number, expected: number) => `رقم المستوى ${found} في الموضع ${expected}: الأرقام تسير 1..n بلا فراغ ولا تكرار.`,
    levelCount: (count: number) => `${count} مستويات: المخطَّط يسمح بـ${MAX_LEVELS} كحدّ أقصى.`,
    levelsToFinish: (toFinish: number, count: number) => `progression.levels_to_finish (${toFinish}) أكبر من عدد المستويات (${count}).`,
    dpad: (engine: string, expected: boolean) => expected
      ? `${engine} يُلعَب بلوحة الاتجاهات: supports_dpad يجب أن تكون true حتى لا يُخفى المحتوى عن كل بيت فيه تلفاز.`
      : `${engine} يحتاج مؤشِّرًا: supports_dpad يجب أن تكون false.`,
    languageClass: (engine: string, expected: string, found: string) =>
      `${engine} تصنيفه اللغوي «${expected}»، و«${found}» يخالف عقد المحرّك. `
      + (expected === 'language_specific' ? 'إعادة التصنيف هي ما تسمح بترجمة آلية لأشكال الحروف.' : ''),
    objectiveForbidden: (engine: string) =>
      `${engine} محرّك ترفيهي لا يكتب إتقانًا، فلا يجوز أن يحمل هدفًا تعليميًا. أزل الهدف من صفّ اللعبة.`,
    supervisionMismatch: (packValue: string, gameValue: string) =>
      `supervision_level في الحزمة «${packValue}» لا يطابق قيمة صفّ اللعبة «${gameValue}».`,
    voiceKeyShape: (key: string) => `مفتاح صوت «${key}» لا يطابق صيغة المخطَّط vo.something أو vo.something.token.`,
    voiceKeyMissing: (key: string) => `مفتاح صوت مفروض وغير معرَّف: ${key}. المسوّدة تُحفَظ، والنشر يُرفض.`,
    assetId: (field: string, value: string) => `معرّف الأصل في ${field} غير صالح: «${value}».`,
    i18nKey: (field: string, value: string) => `${field} ليس مفتاح ترجمة صالحًا: «${value}». نصّ ظاهر في الحزمة يجعلها غير قابلة للترجمة.`,
    missingField: (field: string) => `حقل مفروض وغير معرَّف: ${field}.`,
    range: (field: string, value: number, min: number, max: number) => `${field} = ${value} خارج المدى المسموح ${min}..${max}.`,
    minItems: (field: string, count: number, min: number) => `${field} فيه ${count} وحدّ المخطَّط الأدنى ${min}.`,
    maxItems: (field: string, count: number, max: number) => `${field} فيه ${count} وحدّ المخطَّط الأقصى ${max}.`,
    duplicateId: (id: string) => `معرّف مكرَّر: ${id}.`,
    touchTarget: (declared: number, required: number, engine: string) =>
      `أصغر هدف لمس مُعلَن ${declared}dp، وعقد ${engine} يطلب ${required}dp على الأقل.`,
    touchTargetPreschool: (declared: number) =>
      `أصغر هدف لمس مُعلَن ${declared}dp، ومسار ما قبل المدرسة يطلب 64dp: إصبع طفل الثالثة لا تُصيب هدفًا أصغر.`,
    reviewPending: (kind: string, status: string) =>
      `هذا المحرّك يحتاج مراجعة «${kind}» معتمدة قبل النشر (الحالة: ${status}). هذه الشاشة لا تمنحها.`,
    // match_pairs
    itemTargetUnknown: (item: string, target: string) => `العنصر «${item}» يشير إلى هدف «${target}» غير موجود في المستوى.`,
    targetWithoutItem: (target: string) => `الهدف «${target}» بلا أي عنصر يطابقه، فلا يمكن إكمال المستوى.`,
    // sort_bins
    itemBinUnknown: (item: string, bin: string) => `العنصر «${item}» يشير إلى سلّة «${bin}» غير موجودة في المستوى.`,
    binWithoutItem: (bin: string) => `السلّة «${bin}» بلا أي عنصر يخصّها، فتبقى فارغة إلى نهاية المستوى.`,
    colourOnlyCriterion: 'معيار الفرز «color» وحده: السلال يجب أن تُميَّز بصورة ونصّ وصوت أيضًا حتى تُلعَب بلا تمييز لوني.',
    // memory_flip
    gridPairs: (cards: number, pairs: number) =>
      `الشبكة تعرض ${cards} بطاقة وفي المستوى ${pairs} زوجًا (${pairs * 2} بطاقة): العددان يجب أن يتساويا.`,
    flipDelayPreschool: (value: number) => `flip_back_delay_ms = ${value}، ومسار ما قبل المدرسة يطلب 1400 على الأقل.`,
    pairExplainMissing: (index: number) => `الزوج ${index} مترابط ولا يحمل explain_audio، والعلاقة تحتاج شرحًا مسموعًا.`,
    // sequence_order
    panelPositions: (count: number, found: string) => `مواضع اللوحات يجب أن تسير 1..${count} بلا فراغ، والموجود: ${found}.`,
    acceptedOrderUnknown: (index: number, id: string) => `الترتيب المقبول ${index + 1} يذكر لوحة «${id}» غير موجودة.`,
    acceptedOrderLength: (index: number, found: number, expected: number) =>
      `الترتيب المقبول ${index + 1} فيه ${found} لوحة والمستوى فيه ${expected}.`,
    acceptedOrderMissing: 'لا ترتيب مقبول واحد على الأقل، فلا شيء يمكن للطفل أن يحقّقه.',
    // count_quantity
    answerNotOption: (item: string) => `الجواب في «${item}» ليس بين الخيارات المعروضة.`,
    answerNotCount: (item: string, answer: number, total: number) =>
      `الجواب في «${item}» هو ${answer} والمعروض على الشاشة ${total} عنصرًا: الجواب يجب أن يكون العدد الذي سيعدّه الطفل فعلًا.`,
    answerOutsideRange: (item: string, answer: number, low: number, high: number) =>
      `الجواب ${answer} في «${item}» خارج مدى المستوى ${low}..${high}.`,
    compareEqual: (item: string, a: number, b: number) => `الجواب «متساويتان» في «${item}» والمجموعتان فيهما ${a} و${b}.`,
    compareMustEqual: (item: string, a: number, b: number) => `المجموعتان في «${item}» متساويتان (${a} و${b}) فالجواب يجب أن يكون «متساويتان».`,
    patternGaps: (item: string, gaps: number) => `في «${item}» يجب أن يكون موضع واحد فقط ناقصًا، والموجود ${gaps}.`,
    patternArithmetic: (item: string, step: number, expected: number, answer: string) =>
      `المتتالية في «${item}» تتقدّم بـ${step}، فالقيمة الناقصة ${expected} لا ${answer}.`,
    onScreenBudget: (item: string, count: number) => `في «${item}» ${count} عنصرًا على الشاشة، وحدّ المحرّك 20.`,
    recountButton: 'allow_recount_button يجب أن تكون true: زرّ «أعد العدّ» ظاهر دائمًا.',
    // logic_pattern
    logicGaps: (gaps: number) => `يجب أن تكون خليّة واحدة فقط ناقصة، والموجود ${gaps}.`,
    logicAnswerNotOption: (answer: string) => `الجواب «${answer}» ليس بين الخيارات.`,
    colourOnly: 'اللون وحده لا يجوز أن يكون البُعد المتغيّر: أضف شكلًا أو نقشًا أو دورانًا أو حجمًا أو عددًا حتى يُحَلّ النمط بلا تمييز لوني.',
    explanationRequired: (mode: string) => `«${mode}» يستلزم require_explanation = true: جواب صحيح بلا تعليل قد يكون تخمينًا.`,
    explainAnswerNotOption: (answer: string) => `explain_answer «${answer}» ليس بين explain_options.`,
    explainAnswerDiffers: (answer: string, rule: string) => `explain_answer «${answer}» يختلف عن rule_key «${rule}» — غالبًا سهو نسخ.`,
    // word_build
    slotsLetters: (letters: number, slots: number) => `${letters} حرفًا لـ${slots} خانة: العددان يجب أن يتساويا.`,
    slotsWord: (word: string, chars: number, slots: number) => `الكلمة «${word}» فيها ${chars} حرفًا وslots = ${slots}.`,
    letterPositions: (count: number, found: string) => `مواضع الحروف يجب أن تسير 1..${count} بلا فراغ، والموجود: ${found}.`,
    spelledMismatch: (spelled: string, word: string) => `الحروف تُهجّئ «${spelled}» والكلمة «${word}».`,
    distractorIsLetter: (char: string) => `المُشتّت «${char}» هو أيضًا حرف من حروف الكلمة: بطاقتان لا تُميَّزان، واحدة تُقبل وأخرى تُرفض.`,
    letterFormWrong: (char: string, position: number, found: string, expected: string, previous: string | null) =>
      `الحرف «${char}» في الموضع ${position} موسوم «${found}» وهو يأخذ الشكل «${expected}» في هذه الكلمة`
      + (previous ? ` لأن «${previous}» لا يتّصل بما بعده.` : '.'),
    letterFormMissing: (char: string) => `حروف العربية يجب أن تُعلن شكلها، و«${char}» لا يُعلنه.`,
    letterAudioMissing: (char: string) => `الحرف العربي «${char}» يجب أن يسمّي تسجيل صوته.`,
    showWordText: 'show_word_text_button يجب أن تكون true: هي ما يجعل اللعبة قابلة للعب لمن لا يسمع.',
    languageTag: (value: string) => `رمز اللغة «${value}» لا يطابق الصيغة ar أو ar-SA.`,
    arabicDirection: 'الحزمة العربية يجب أن تعلن writing_direction = rtl.',
    // rhythm_tap
    neverFail: 'never_fail يجب أن تكون true: المقطوعة تكمل دائمًا.',
    visualPulse: 'visual_pulse يجب أن تكون true: هي بديل الصوت لمن لا يسمع.',
    noteLane: (index: number, lane: number, lanes: number) => `النقرة ${index} في المسار ${lane} والمستوى فيه ${lanes} مسارًا.`,
    noteAfterEnd: (index: number, time: number, duration: number) => `النقرة ${index} عند ${time}ms بعد نهاية المقطوعة (${duration}ms).`,
    notesOutOfOrder: (index: number) => `النقرات ليست بترتيب زمني عند الموضع ${index}.`,
    hitWindowPreschool: (value: number) => `hit_window_ms = ${value}، ومسار ما قبل المدرسة يطلب 450 على الأقل.`,
    preschoolLevels: (level: number) => `حزم ما قبل المدرسة تستخدم المستويين 1 و2 فقط، لا المستوى ${level}.`,
    // block_code
    cellOutside: (name: string, cell: string, w: number, h: number) => `${name} في [${cell}] خارج الشبكة ${w}×${h}.`,
    startOnWall: 'نقطة البداية على حائط.',
    goalOnWall: 'الهدف على حائط.',
    startIsGoal: 'البداية والهدف الخليّة نفسها.',
    collectibleOnWall: (cell: string) => `مجموعة في [${cell}] على حائط.`,
    optimalOverLimit: (optimal: number, limit: number) => `optimal_blocks (${optimal}) أكبر من block_limit (${limit}) فالنجمة غير قابلة للوصول.`,
    referenceBlockNotAllowed: (kind: string) => `حلّ المرجع يستخدم «${kind}» وهو ليس في allowed_blocks.`,
    referenceTooLong: (count: number, limit: number) => `حلّ المرجع ${count} أمرًا، وحدّ المستوى ${limit}.`,
    referenceTokenShape: (token: string) => `الرمز «${token}» في حلّ المرجع لا يطابق صيغة المخطَّط.`,
    referenceFails: (x: number, y: number, collided: boolean, collected: number, total: number) =>
      `حلّ المرجع لا يحلّ المستوى: ينتهي عند [${x},${y}]${collided ? ' بعد اصطدام' : ''}، وجمع ${collected} من ${total}. `
      + 'هذا هو ما تعرضه الدرجة الرابعة من سلّم المساعدة، فحلٌّ فاشل يعرض على الطفل فشلًا موجَّهًا.',
    referenceNotOptimal: (count: number, optimal: number) => `حلّ المرجع ${count} أمرًا وoptimal_blocks = ${optimal}: الحلّ المعروض لا ينال النجمة.`,
    referenceMissing: 'لا حلّ مرجعي: الدرجة الرابعة من سلّم المساعدة لن يكون لها ما تعرضه.',
    // sim_lab
    relationshipUnknown: (id: string) => `expected_relationships يذكر «${id}» وهو ليس متغيّرًا.`,
    relationshipMissing: (id: string) => `المتغيّر «${id}» بلا علاقة مُعلَنة، فلا تستطيع المحاكاة الاستجابة له.`,
    allNone: 'كل المتغيّرات مُعلَنة «none»، فلا نتيجة يمكن ملاحظتها ولا شيء يُفسَّر.',
    variableRange: (id: string, min: number, max: number) => `المتغيّر «${id}» حدّه الأدنى ${min} ليس أقلّ من الأعلى ${max}.`,
    variableSteps: (id: string, min: number, max: number, step: number) => `مدى المتغيّر «${id}» من ${min} إلى ${max} ليس عددًا صحيحًا من خطوات ${step}.`,
    explanationAnswerNotOption: (answer: string) => `explanation_answer «${answer}» ليس بين explanation_options.`,
    duplicateHypothesis: 'خيار فرضية مكرَّر.',
    resultsTable: 'results_table يجب أن تكون true: الجدول هو الصورة النصيّة للنتيجة.',
    safetyNote: 'مستوى الإشراف «مطلوب» يستلزم safety_note_key.',
    variableId: (id: string) => `معرّف المتغيّر «${id}» لا يطابق الصيغة a-z و_ وأرقام.`,
    // timeline_map
    needsTimeline: (mode: string) => `النمط «${mode}» يستلزم كتلة timeline.`,
    needsMap: (mode: string) => `النمط «${mode}» يستلزم كتلة map.`,
    timelineOrder: (from: number, to: number) => `timeline.from (${from}) يجب أن يسبق timeline.to (${to}).`,
    mirrorInRtl: 'map.mirror_in_rtl يجب أن تكون false: الجغرافيا لا تُعكس أبدًا.',
    eventNeedsYear: (id: string, mode: string) => `الحدث «${id}» يحتاج سنة في النمط «${mode}».`,
    eventYearOutside: (id: string, year: number, from: number, to: number) => `سنة الحدث «${id}» (${year}) خارج الخطّ الزمني ${from}..${to}.`,
    eventNeedsToleranceYears: (id: string) => `الحدث «${id}» يحتاج tolerance_years.`,
    eventNeedsPlace: (id: string) => `الحدث «${id}» يحتاج lat وlon.`,
    eventOutsideRegion: (id: string, lat: number, lon: number, region: string) =>
      `الحدث «${id}» عند [${lat}, ${lon}] خارج خريطة «${region}»، فلا يستطيع الطفل وضعه أبدًا.`,
    eventNeedsToleranceKm: (id: string) => `الحدث «${id}» يحتاج tolerance_km.`,
    anchorOutside: (year: number) => `سنة المرساة ${year} خارج الخطّ الزمني المعروض.`,
    unknownRegion: (region: string) => `منطقة «${region}» بلا حدود معروفة، فسيُرسم العالم كلّه.`,
  },
  en: {
    engineMismatch: (found: string, expected: string) => `Pack engine_id "${found}" does not match the game's engine "${expected}".`,
    packId: (value: string) => `pack_id "${value}" does not match the schema pattern (lower case, digits and dashes, 3..64).`,
    packVersion: 'pack_version must be an integer of at least 1.',
    levelNumbers: (found: number, expected: number) => `Level number ${found} at position ${expected}: numbers must run 1..n without gaps or repeats.`,
    levelCount: (count: number) => `${count} levels: the schema allows at most ${MAX_LEVELS}.`,
    levelsToFinish: (toFinish: number, count: number) => `progression.levels_to_finish (${toFinish}) exceeds the ${count} level(s) in the pack.`,
    dpad: (engine: string, expected: boolean) => expected
      ? `${engine} is playable with a D-pad; supports_dpad must be true or working content is hidden from every TV household.`
      : `${engine} requires a pointer; supports_dpad must be false.`,
    languageClass: (engine: string, expected: string, found: string) =>
      `${engine} is "${expected}"; "${found}" contradicts the engine contract. `
      + (expected === 'language_specific' ? 'Reclassifying is what permits machine translation of letter forms.' : ''),
    objectiveForbidden: (engine: string) =>
      `${engine} is entertainment-first and writes no mastery, so it must not carry a learning objective. Remove it from the game row.`,
    supervisionMismatch: (packValue: string, gameValue: string) =>
      `Pack supervision_level "${packValue}" does not match the game row's "${gameValue}".`,
    voiceKeyShape: (key: string) => `Voice key "${key}" does not match the schema shape vo.something or vo.something.token.`,
    voiceKeyMissing: (key: string) => `Required voice key missing: ${key}. A draft saves; a publish is refused.`,
    assetId: (field: string, value: string) => `Invalid asset id in ${field}: "${value}".`,
    i18nKey: (field: string, value: string) => `${field} is not a valid translation key: "${value}". Visible prose in a pack cannot be translated.`,
    missingField: (field: string) => `Required and not set: ${field}.`,
    range: (field: string, value: number, min: number, max: number) => `${field} = ${value} is outside the allowed ${min}..${max}.`,
    minItems: (field: string, count: number, min: number) => `${field} has ${count} and the schema minimum is ${min}.`,
    maxItems: (field: string, count: number, max: number) => `${field} has ${count} and the schema maximum is ${max}.`,
    duplicateId: (id: string) => `Duplicate id: ${id}.`,
    touchTarget: (declared: number, required: number, engine: string) =>
      `Declared minimum touch target is ${declared}dp; the ${engine} contract asks for at least ${required}dp.`,
    touchTargetPreschool: (declared: number) =>
      `Declared minimum touch target is ${declared}dp; the preschool track asks for 64dp — a three-year-old's finger cannot hit less.`,
    reviewPending: (kind: string, status: string) =>
      `This engine needs an approved "${kind}" before publish (status: ${status}). This screen does not grant it.`,
    itemTargetUnknown: (item: string, target: string) => `Item "${item}" points at target "${target}", which is not in the level.`,
    targetWithoutItem: (target: string) => `Target "${target}" has no matching item, so the level cannot be completed.`,
    itemBinUnknown: (item: string, bin: string) => `Item "${item}" points at bin "${bin}", which is not in the level.`,
    binWithoutItem: (bin: string) => `Bin "${bin}" has no items of its own and stays empty for the whole level.`,
    colourOnlyCriterion: 'The sorting criterion is colour alone: bins must also be distinguished by image, text and sound so the level is playable without colour vision.',
    gridPairs: (cards: number, pairs: number) => `The grid shows ${cards} cards and the level has ${pairs} pair(s) (${pairs * 2} cards); the two must match.`,
    flipDelayPreschool: (value: number) => `flip_back_delay_ms = ${value}; the preschool track asks for at least 1400.`,
    pairExplainMissing: (index: number) => `Pair ${index} is related and carries no explain_audio; the relation needs a spoken explanation.`,
    panelPositions: (count: number, found: string) => `Panel positions must run 1..${count} without gaps, found ${found}.`,
    acceptedOrderUnknown: (index: number, id: string) => `Accepted order ${index + 1} names panel "${id}", which does not exist.`,
    acceptedOrderLength: (index: number, found: number, expected: number) => `Accepted order ${index + 1} has ${found} panels and the level has ${expected}.`,
    acceptedOrderMissing: 'No accepted order at all, so there is nothing the child can achieve.',
    answerNotOption: (item: string) => `The answer in "${item}" is not among the options shown.`,
    answerNotCount: (item: string, answer: number, total: number) =>
      `The answer in "${item}" is ${answer} but ${total} element(s) are on screen; the answer must be the number the child would actually count.`,
    answerOutsideRange: (item: string, answer: number, low: number, high: number) => `Answer ${answer} in "${item}" falls outside the level range ${low}..${high}.`,
    compareEqual: (item: string, a: number, b: number) => `The answer in "${item}" is "equal" but the sets hold ${a} and ${b}.`,
    compareMustEqual: (item: string, a: number, b: number) => `The sets in "${item}" are equal (${a} and ${b}) so the answer must be "equal".`,
    patternGaps: (item: string, gaps: number) => `Exactly one position in "${item}" may be missing, found ${gaps}.`,
    patternArithmetic: (item: string, step: number, expected: number, answer: string) =>
      `The sequence in "${item}" steps by ${step}, so the missing value is ${expected}, not ${answer}.`,
    onScreenBudget: (item: string, count: number) => `"${item}" has ${count} elements on screen and the engine's budget is 20.`,
    recountButton: 'allow_recount_button must be true: the recount button is always visible.',
    logicGaps: (gaps: number) => `Exactly one cell may be missing, found ${gaps}.`,
    logicAnswerNotOption: (answer: string) => `The answer "${answer}" is not among the options.`,
    colourOnly: 'Colour may not be the only changing dimension: add shape, pattern, rotation, size or count so the puzzle is solvable without colour vision.',
    explanationRequired: (mode: string) => `"${mode}" must set require_explanation true: a correct answer without a reason may be a guess.`,
    explainAnswerNotOption: (answer: string) => `explain_answer "${answer}" is not among explain_options.`,
    explainAnswerDiffers: (answer: string, rule: string) => `explain_answer "${answer}" differs from rule_key "${rule}" — almost always a copy/paste slip.`,
    slotsLetters: (letters: number, slots: number) => `${letters} letter(s) for ${slots} slot(s); they must match.`,
    slotsWord: (word: string, chars: number, slots: number) => `The word "${word}" has ${chars} letters but slots is ${slots}.`,
    letterPositions: (count: number, found: string) => `Letter positions must run 1..${count} without gaps, found ${found}.`,
    spelledMismatch: (spelled: string, word: string) => `The letters spell "${spelled}" but the word is "${word}".`,
    distractorIsLetter: (char: string) => `Distractor "${char}" is also a letter of the word: two indistinguishable tiles, one accepted and one refused.`,
    letterFormWrong: (char: string, position: number, found: string, expected: string, previous: string | null) =>
      `Letter "${char}" at position ${position} is marked "${found}" but takes the "${expected}" form in this word`
      + (previous ? ` because "${previous}" does not join to the left.` : '.'),
    letterFormMissing: (char: string) => `Arabic letters must declare their form; "${char}" does not.`,
    letterAudioMissing: (char: string) => `Arabic letter "${char}" must name its sound recording.`,
    showWordText: 'show_word_text_button must be true: it is what makes the game playable without hearing.',
    languageTag: (value: string) => `Language code "${value}" does not match the ar or ar-SA shape.`,
    arabicDirection: 'An Arabic pack must declare writing_direction = rtl.',
    neverFail: 'never_fail must be true: the track always plays to the end.',
    visualPulse: 'visual_pulse must be true: it is the alternative to hearing.',
    noteLane: (index: number, lane: number, lanes: number) => `Note ${index} is in lane ${lane} but the level has ${lanes} lane(s).`,
    noteAfterEnd: (index: number, time: number, duration: number) => `Note ${index} at ${time}ms falls after the ${duration}ms track ends.`,
    notesOutOfOrder: (index: number) => `Notes are not in time order at index ${index}.`,
    hitWindowPreschool: (value: number) => `hit_window_ms = ${value} is below the 450ms floor for a preschool audience.`,
    preschoolLevels: (level: number) => `Preschool packs use levels 1 and 2 only, not level ${level}.`,
    cellOutside: (name: string, cell: string, w: number, h: number) => `${name} at [${cell}] is outside the ${w}x${h} grid.`,
    startOnWall: 'The start cell is on a wall.',
    goalOnWall: 'The goal cell is on a wall.',
    startIsGoal: 'Start and goal are the same cell.',
    collectibleOnWall: (cell: string) => `Collectible at [${cell}] is on a wall.`,
    optimalOverLimit: (optimal: number, limit: number) => `optimal_blocks (${optimal}) exceeds block_limit (${limit}), so the star is unreachable.`,
    referenceBlockNotAllowed: (kind: string) => `reference_solution uses "${kind}", which is not in allowed_blocks.`,
    referenceTooLong: (count: number, limit: number) => `reference_solution is ${count} blocks, over the limit of ${limit}.`,
    referenceTokenShape: (token: string) => `Token "${token}" in reference_solution does not match the schema pattern.`,
    referenceFails: (x: number, y: number, collided: boolean, collected: number, total: number) =>
      `reference_solution does not solve the level: it ends at [${x},${y}]${collided ? ' after a collision' : ''}, ${collected} of ${total} collected. `
      + 'This is what the fourth help rung plays, so a failing solution demonstrates failure to the child.',
    referenceNotOptimal: (count: number, optimal: number) => `reference_solution is ${count} blocks but optimal_blocks is ${optimal}: the demonstrated solution does not earn the star.`,
    referenceMissing: 'No reference solution: the fourth help rung will have nothing to demonstrate.',
    relationshipUnknown: (id: string) => `expected_relationships names "${id}", which is not a variable.`,
    relationshipMissing: (id: string) => `Variable "${id}" has no declared relationship; the simulation cannot respond to it.`,
    allNone: 'Every variable is declared "none", so the experiment has no observable outcome and nothing to explain.',
    variableRange: (id: string, min: number, max: number) => `Variable "${id}" has min ${min} not below max ${max}.`,
    variableSteps: (id: string, min: number, max: number, step: number) => `Variable "${id}" range ${min}..${max} is not a whole number of ${step} steps.`,
    explanationAnswerNotOption: (answer: string) => `explanation_answer "${answer}" is not among explanation_options.`,
    duplicateHypothesis: 'Duplicate hypothesis option.',
    resultsTable: 'results_table must be true: the table is the accessible form of the result.',
    safetyNote: 'supervision_level "required" needs a safety_note_key.',
    variableId: (id: string) => `Variable id "${id}" does not match the a-z, underscore and digits shape.`,
    needsTimeline: (mode: string) => `Mode "${mode}" needs a timeline block.`,
    needsMap: (mode: string) => `Mode "${mode}" needs a map block.`,
    timelineOrder: (from: number, to: number) => `timeline.from (${from}) must be before timeline.to (${to}).`,
    mirrorInRtl: 'map.mirror_in_rtl must be false: geography is never mirrored.',
    eventNeedsYear: (id: string, mode: string) => `Event "${id}" needs a year in "${mode}" mode.`,
    eventYearOutside: (id: string, year: number, from: number, to: number) => `Event "${id}" year ${year} falls outside the timeline ${from}..${to}.`,
    eventNeedsToleranceYears: (id: string) => `Event "${id}" needs tolerance_years.`,
    eventNeedsPlace: (id: string) => `Event "${id}" needs lat and lon.`,
    eventOutsideRegion: (id: string, lat: number, lon: number, region: string) =>
      `Event "${id}" at [${lat}, ${lon}] is outside the "${region}" map, so the child could never place it.`,
    eventNeedsToleranceKm: (id: string) => `Event "${id}" needs tolerance_km.`,
    anchorOutside: (year: number) => `Anchor year ${year} is outside the visible timeline.`,
    unknownRegion: (region: string) => `Map region "${region}" has no known bounds; the whole world will be drawn.`,
  },
}

// ---------------------------------------------------------------------------
// أدوات مشتركة للفحص
// ---------------------------------------------------------------------------

function checkAssetId(sink: Sink, scope: string, field: string, value: unknown, required: boolean) {
  const text = copy[sink.locale]
  const id = str(value)
  if (!id) {
    if (required) sink.push('error', scope, text.missingField(field))
    return
  }
  if (!ASSET_ID_PATTERN.test(id)) sink.push('error', scope, text.assetId(field, id))
}

function checkI18nKey(sink: Sink, scope: string, field: string, value: unknown, required: boolean) {
  const text = copy[sink.locale]
  const key = str(value)
  if (!key) {
    if (required) sink.push('error', scope, text.missingField(field))
    return
  }
  if (!I18N_KEY_PATTERN.test(key)) sink.push('error', scope, text.i18nKey(field, key))
}

function checkIntRange(sink: Sink, scope: string, field: string, value: unknown, min: number, max: number, required: boolean) {
  const text = copy[sink.locale]
  const parsed = num(value)
  if (parsed === null) {
    if (required) sink.push('error', scope, text.missingField(field))
    return
  }
  if (parsed < min || parsed > max) sink.push('error', scope, text.range(field, parsed, min, max))
}

function checkCount(sink: Sink, scope: string, field: string, count: number, min: number, max: number) {
  const text = copy[sink.locale]
  if (count < min) sink.push('error', scope, text.minItems(field, count, min))
  if (count > max) sink.push('error', scope, text.maxItems(field, count, max))
}

function checkUniqueIds(sink: Sink, scope: string, records: Array<Record<string, unknown>>) {
  const text = copy[sink.locale]
  const seen = new Set<string>()
  for (const record of records) {
    const id = String(record.id ?? '')
    if (!id) continue
    if (seen.has(id)) sink.push('error', scope, text.duplicateId(id))
    seen.add(id)
  }
}

function contiguous(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.every((value, index) => value === index + 1)
}

// ---------------------------------------------------------------------------
// قواعد كل محرّك
// ---------------------------------------------------------------------------

type LevelRule = (
  level: Record<string, unknown>,
  scope: string,
  ctx: EngineIssueContext,
  sink: Sink,
) => void

const matchPairsRule: LevelRule = (level, scope, _ctx, sink) => {
  const text = copy[sink.locale]
  const targets = asRecords(level.targets)
  const items = asRecords(level.items)
  const distractors = asRecords(level.distractors)

  checkI18nKey(sink, scope, 'prompt_key', level.prompt_key, true)
  checkCount(sink, scope, 'targets', targets.length, 2, 3)
  checkCount(sink, scope, 'items', items.length, 2, 6)
  if (distractors.length > 3) sink.push('error', scope, text.maxItems('distractors', distractors.length, 3))
  checkUniqueIds(sink, scope, [...targets, ...items, ...distractors])

  for (const target of targets) {
    checkAssetId(sink, scope, `targets.${String(target.id)}.image`, target.image, true)
    checkAssetId(sink, scope, `targets.${String(target.id)}.audio`, target.audio, true)
    checkI18nKey(sink, scope, `targets.${String(target.id)}.label_key`, target.label_key, true)
  }
  const targetIds = new Set(targets.map((target) => String(target.id ?? '')))
  const claimed = new Set<string>()
  for (const item of items) {
    const id = String(item.id ?? '?')
    checkAssetId(sink, scope, `items.${id}.image`, item.image, true)
    checkAssetId(sink, scope, `items.${id}.audio`, item.audio, true)
    checkI18nKey(sink, scope, `items.${id}.label_key`, item.label_key, true)
    const target = String(item.target ?? '')
    if (!target) sink.push('error', scope, text.missingField(`items.${id}.target`))
    else if (!targetIds.has(target)) sink.push('error', scope, text.itemTargetUnknown(id, target))
    else claimed.add(target)
  }
  for (const target of targetIds) {
    if (target && !claimed.has(target)) sink.push('error', scope, text.targetWithoutItem(target))
  }
  for (const distractor of distractors) {
    const id = String(distractor.id ?? '?')
    checkAssetId(sink, scope, `distractors.${id}.image`, distractor.image, true)
    checkAssetId(sink, scope, `distractors.${id}.audio`, distractor.audio, true)
    checkI18nKey(sink, scope, `distractors.${id}.label_key`, distractor.label_key, true)
  }
}

const sortBinsRule: LevelRule = (level, scope, _ctx, sink) => {
  const text = copy[sink.locale]
  const bins = asRecords(level.bins)
  const items = asRecords(level.items)

  checkI18nKey(sink, scope, 'criterion_key', level.criterion_key, true)
  checkCount(sink, scope, 'bins', bins.length, 2, 3)
  checkCount(sink, scope, 'items', items.length, 4, 8)
  checkUniqueIds(sink, scope, [...bins, ...items])

  if (level.criterion_type === 'color') sink.push('warning', scope, text.colourOnlyCriterion)

  for (const bin of bins) {
    const id = String(bin.id ?? '?')
    checkI18nKey(sink, scope, `bins.${id}.label_key`, bin.label_key, true)
    checkAssetId(sink, scope, `bins.${id}.image`, bin.image, true)
    checkAssetId(sink, scope, `bins.${id}.audio`, bin.audio, true)
  }
  const binIds = new Set(bins.map((bin) => String(bin.id ?? '')))
  const used = new Set<string>()
  for (const item of items) {
    const id = String(item.id ?? '?')
    checkAssetId(sink, scope, `items.${id}.image`, item.image, true)
    checkAssetId(sink, scope, `items.${id}.audio`, item.audio, true)
    checkI18nKey(sink, scope, `items.${id}.label_key`, item.label_key, true)
    if (item.explain_audio !== undefined) checkAssetId(sink, scope, `items.${id}.explain_audio`, item.explain_audio, false)
    const bin = String(item.bin ?? '')
    if (!bin) sink.push('error', scope, text.missingField(`items.${id}.bin`))
    else if (!binIds.has(bin)) sink.push('error', scope, text.itemBinUnknown(id, bin))
    else used.add(bin)
  }
  for (const bin of binIds) {
    if (bin && !used.has(bin)) sink.push('error', scope, text.binWithoutItem(bin))
  }
}

const memoryFlipRule: LevelRule = (level, scope, ctx, sink) => {
  const text = copy[sink.locale]
  const grid = asArray(level.grid).map(num)
  const pairs = asRecords(level.pairs)

  checkCount(sink, scope, 'pairs', pairs.length, 2, 6)
  const width = grid[0]
  const height = grid[1]
  if (width === null || width === undefined || height === null || height === undefined) {
    sink.push('error', scope, text.missingField('grid'))
  } else {
    checkIntRange(sink, scope, 'grid[0]', width, 2, 4, true)
    checkIntRange(sink, scope, 'grid[1]', height, 2, 4, true)
    const cards = width * height
    // العدد لا يفرضه المخطَّط ولا يرفضه الخادم، فهو تنبيه لا خطأ. لكنه عيبٌ
    // حقيقي: شبكة 3×4 بأربعة أزواج تعني أربع بطاقات لا يقابلها شيء.
    if (cards !== pairs.length * 2) sink.push('warning', scope, text.gridPairs(cards, pairs.length))
  }

  checkIntRange(sink, scope, 'flip_back_delay_ms', level.flip_back_delay_ms, 800, 2000, true)
  const delay = num(level.flip_back_delay_ms)
  if (ctx.ageMax <= 5 && delay !== null && delay < 1400) {
    sink.push('warning', scope, text.flipDelayPreschool(delay))
  }
  if (level.reveal_help_after_misses !== undefined) {
    checkIntRange(sink, scope, 'reveal_help_after_misses', level.reveal_help_after_misses, 6, 20, false)
  }

  pairs.forEach((pair, index) => {
    checkAssetId(sink, scope, `pairs[${index}].a`, pair.a, true)
    checkAssetId(sink, scope, `pairs[${index}].b`, pair.b, true)
    checkI18nKey(sink, scope, `pairs[${index}].sound_key`, pair.sound_key, true)
    if (pair.audio !== undefined) checkAssetId(sink, scope, `pairs[${index}].audio`, pair.audio, false)
    if (pair.explain_audio !== undefined) checkAssetId(sink, scope, `pairs[${index}].explain_audio`, pair.explain_audio, false)
    if (level.pair_type === 'related' && !str(pair.explain_audio)) {
      sink.push('warning', scope, text.pairExplainMissing(index + 1))
    }
  })
}

const sequenceOrderRule: LevelRule = (level, scope, _ctx, sink) => {
  const text = copy[sink.locale]
  const panels = asRecords(level.panels)
  const orders = asArray(level.accepted_orders)

  checkI18nKey(sink, scope, 'prompt_key', level.prompt_key, true)
  checkCount(sink, scope, 'panels', panels.length, 3, 6)
  checkUniqueIds(sink, scope, panels)

  for (const panel of panels) {
    const id = String(panel.id ?? '?')
    checkAssetId(sink, scope, `panels.${id}.image`, panel.image, true)
    checkAssetId(sink, scope, `panels.${id}.audio`, panel.audio, true)
    checkI18nKey(sink, scope, `panels.${id}.caption_key`, panel.caption_key, true)
    checkIntRange(sink, scope, `panels.${id}.position`, panel.position, 1, 6, true)
  }
  const positions = panels.map((panel) => num(panel.position)).filter((value): value is number => value !== null)
  if (positions.length === panels.length && panels.length > 0 && !contiguous(positions)) {
    sink.push('error', scope, text.panelPositions(panels.length, [...positions].sort((a, b) => a - b).join(',')))
  }

  if (!orders.length) sink.push('error', scope, text.acceptedOrderMissing)
  if (orders.length > 3) sink.push('error', scope, text.maxItems('accepted_orders', orders.length, 3))
  const panelIds = new Set(panels.map((panel) => String(panel.id ?? '')))
  orders.forEach((order, index) => {
    const ids = asArray(order).map((value) => String(value))
    if (panels.length && ids.length !== panels.length) {
      sink.push('error', scope, text.acceptedOrderLength(index, ids.length, panels.length))
    }
    for (const id of ids) {
      if (!panelIds.has(id)) sink.push('error', scope, text.acceptedOrderUnknown(index, id))
    }
  })
}

const countQuantityRule: LevelRule = (level, scope, _ctx, sink) => {
  const text = copy[sink.locale]
  const mode = String(level.mode ?? '')
  const items = asRecords(level.items)
  const range = asArray(level.range).map(num)

  checkCount(sink, scope, 'items', items.length, 3, 5)
  checkUniqueIds(sink, scope, items)
  if (level.allow_recount_button === false) sink.push('error', scope, text.recountButton)

  for (const item of items) {
    const id = String(item.id ?? '?')
    const options = asArray(item.options)
    const answer = item.answer

    if (options.length && !options.some((option) => option === answer)) {
      sink.push('error', scope, text.answerNotOption(id))
    }

    if (mode === 'count_and_pick' || mode === 'drag_amount') {
      const sets = asRecords(item.items)
      if (!sets.length) sink.push('error', scope, text.minItems(`items.${id}.items`, 0, 1))
      const total = sets.reduce((sum, set) => sum + (num(set.count) ?? 0), 0)
      const expected = num(answer)
      for (const [index, set] of sets.entries()) {
        checkAssetId(sink, scope, `items.${id}.items[${index}].image`, set.image, true)
        checkIntRange(sink, scope, `items.${id}.items[${index}].count`, set.count, 1, 20, true)
      }
      // العلّة الأكثر شيوعًا في هذا المحرّك، وهي تُنتج سؤالًا لا يصيبه أي طفل.
      if (expected !== null && total > 0 && expected !== total) {
        sink.push('error', scope, text.answerNotCount(id, expected, total))
      }
      const low = range[0]
      const high = range[1]
      if (low !== null && low !== undefined && high !== null && high !== undefined
        && expected !== null && (expected < low || expected > high)) {
        sink.push('error', scope, text.answerOutsideRange(id, expected, low, high))
      }
      checkCount(sink, scope, `items.${id}.options`, options.length, 2, 4)
    }

    if (mode === 'compare_sets') {
      const setA = isObject(item.set_a) ? item.set_a : null
      const setB = isObject(item.set_b) ? item.set_b : null
      if (!setA) sink.push('error', scope, text.missingField(`items.${id}.set_a`))
      if (!setB) sink.push('error', scope, text.missingField(`items.${id}.set_b`))
      if (setA) {
        checkAssetId(sink, scope, `items.${id}.set_a.image`, setA.image, true)
        checkIntRange(sink, scope, `items.${id}.set_a.count`, setA.count, 1, 20, true)
      }
      if (setB) {
        checkAssetId(sink, scope, `items.${id}.set_b.image`, setB.image, true)
        checkIntRange(sink, scope, `items.${id}.set_b.count`, setB.count, 1, 20, true)
      }
      checkI18nKey(sink, scope, `items.${id}.question_key`, item.question_key, true)
      const a = setA ? num(setA.count) : null
      const b = setB ? num(setB.count) : null
      if (a !== null && b !== null) {
        const truth = a > b ? 'set_a' : b > a ? 'set_b' : 'equal'
        // «أيّهما أكثر» أم «أيّهما أقلّ» يحمله `question_key` وهو مفتاح ترجمة لا
        // يمكن قراءته آليًا، فحالة التساوي وحدها قابلة للفحص في الاتجاهين — وهي
        // مفحوصة، لأن جواب «متساويتان» بمجموعتين مختلفتين خطأ بأي صياغة.
        if (answer === 'equal' && truth !== 'equal') sink.push('error', scope, text.compareEqual(id, a, b))
        if (truth === 'equal' && answer !== 'equal') sink.push('error', scope, text.compareMustEqual(id, a, b))
      }
      checkCount(sink, scope, `items.${id}.options`, options.length, 2, 3)
    }

    if (mode === 'pattern_fill') {
      const sequence = asArray(item.sequence)
      checkCount(sink, scope, `items.${id}.sequence`, sequence.length, 3, 6)
      const gaps = sequence.filter((entry) => entry === null).length
      if (gaps !== 1) sink.push('error', scope, text.patternGaps(id, gaps))
      checkI18nKey(sink, scope, `items.${id}.rule_key`, item.rule_key, true)
      checkCount(sink, scope, `items.${id}.options`, options.length, 2, 4)

      const values = sequence.map(num)
      const known = values.filter((value): value is number => value !== null)
      if (known.length >= 2 && gaps === 1) {
        const indices = values.map((value, index) => (value === null ? -1 : index)).filter((index) => index >= 0)
        const first = indices[0]
        const second = indices[1]
        if (first !== undefined && second !== undefined && second !== first) {
          const step = ((values[second] as number) - (values[first] as number)) / (second - first)
          if (Number.isInteger(step)) {
            const anchorIndex = values.findIndex((value) => value !== null)
            const anchor = values[anchorIndex] as number
            const arithmetic = values.every((value, index) => value === null || value === anchor + (index - anchorIndex) * step)
            if (arithmetic) {
              const missingIndex = values.findIndex((value) => value === null)
              const expected = anchor + (missingIndex - anchorIndex) * step
              if (num(answer) !== expected) {
                sink.push('error', scope, text.patternArithmetic(id, step, expected, JSON.stringify(answer)))
              }
            }
          }
        }
      }
    }

    const sets = asRecords(item.items)
    const total = sets.reduce((sum, set) => sum + (num(set.count) ?? 0), 0)
    const compare = (isObject(item.set_a) ? num(item.set_a.count) ?? 0 : 0)
      + (isObject(item.set_b) ? num(item.set_b.count) ?? 0 : 0)
    const onScreen = Math.max(total, compare)
    if (onScreen > 20) sink.push('error', scope, text.onScreenBudget(id, onScreen))
  }
}

const logicPatternRule: LevelRule = (level, scope, _ctx, sink) => {
  const text = copy[sink.locale]
  const mode = String(level.mode ?? '')
  const options = asArray(level.options).filter((option): option is string => typeof option === 'string')
  const answer = level.answer

  checkI18nKey(sink, scope, 'rule_key', level.rule_key, true)
  checkCount(sink, scope, 'options', options.length, 3, 5)
  for (const [index, option] of options.entries()) {
    checkAssetId(sink, scope, `options[${index}]`, option, true)
  }
  checkAssetId(sink, scope, 'answer', answer, true)
  if (options.length && !options.includes(String(answer))) {
    sink.push('error', scope, text.logicAnswerNotOption(String(answer)))
  }

  const grid = asArray(level.grid)
  const sequence = asArray(level.sequence)
  const cells = grid.length ? grid.flatMap((row) => asArray(row)) : sequence
  const gaps = cells.filter((cell) => cell === null).length
  if (cells.length && gaps !== 1) sink.push('error', scope, text.logicGaps(gaps))
  if ((mode === 'matrix_2x2' || mode === 'matrix_3x3') && !grid.length) {
    sink.push('error', scope, text.missingField('grid'))
  }
  if ((mode === 'linear' || mode === 'linear_alt') && !sequence.length) {
    sink.push('error', scope, text.missingField('sequence'))
  }

  const dimensions = asArray(level.changing_dimensions).filter((value): value is string => typeof value === 'string')
  checkCount(sink, scope, 'changing_dimensions', dimensions.length, 1, 3)
  if (dimensions.length === 1 && dimensions[0] === 'color') sink.push('error', scope, text.colourOnly)

  if (mode === 'matrix_3x3' || mode === 'rule_infer') {
    if (level.require_explanation !== true) sink.push('error', scope, text.explanationRequired(mode))
    const explainOptions = asArray(level.explain_options).filter((value): value is string => typeof value === 'string')
    checkCount(sink, scope, 'explain_options', explainOptions.length, 3, 5)
    for (const [index, option] of explainOptions.entries()) {
      checkI18nKey(sink, scope, `explain_options[${index}]`, option, true)
    }
    const explainAnswer = level.explain_answer
    checkI18nKey(sink, scope, 'explain_answer', explainAnswer, true)
    if (explainOptions.length && !explainOptions.includes(String(explainAnswer))) {
      sink.push('error', scope, text.explainAnswerNotOption(String(explainAnswer)))
    }
    if (typeof explainAnswer === 'string' && explainAnswer && explainAnswer !== String(level.rule_key)) {
      sink.push('warning', scope, text.explainAnswerDiffers(explainAnswer, String(level.rule_key)))
    }
  }
}

const wordBuildRule: LevelRule = (level, scope, _ctx, sink) => {
  const text = copy[sink.locale]
  const language = String(level.language ?? '')
  const word = String(level.word ?? '')
  const slots = num(level.slots)
  const letters = asRecords(level.letters)
  const distractors = asRecords(level.distractors)

  if (!LANGUAGE_TAG_PATTERN.test(language)) sink.push('error', scope, text.languageTag(language))
  if (!word) sink.push('error', scope, text.missingField('word'))
  checkIntRange(sink, scope, 'slots', slots, 2, 5, true)
  checkCount(sink, scope, 'letters', letters.length, 2, 5)
  if (distractors.length > 3) sink.push('error', scope, text.maxItems('distractors', distractors.length, 3))
  checkAssetId(sink, scope, 'word_audio', level.word_audio, true)
  checkAssetId(sink, scope, 'word_image', level.word_image, true)
  if (level.word_syllables_audio !== undefined) {
    checkAssetId(sink, scope, 'word_syllables_audio', level.word_syllables_audio, false)
  }
  if (level.show_word_text_button !== true) sink.push('error', scope, text.showWordText)
  if (language === 'ar' && level.writing_direction !== 'rtl') sink.push('error', scope, text.arabicDirection)

  if (slots !== null && letters.length !== slots) sink.push('error', scope, text.slotsLetters(letters.length, slots))
  const chars = wordChars(word)
  if (slots !== null && word && chars.length !== slots) sink.push('error', scope, text.slotsWord(word, chars.length, slots))

  const positions = letters.map((letter) => num(letter.position)).filter((value): value is number => value !== null)
  if (positions.length === letters.length && letters.length > 0 && !contiguous(positions)) {
    sink.push('error', scope, text.letterPositions(letters.length, [...positions].sort((a, b) => a - b).join(',')))
  }

  const ordered = [...letters].sort((a, b) => (num(a.position) ?? 0) - (num(b.position) ?? 0))
  if (word && positions.length === letters.length) {
    const spelled = ordered.map((letter) => String(letter.char ?? '')).join('')
    if (spelled !== word) sink.push('error', scope, text.spelledMismatch(spelled, word))
  }

  const needed = new Set(letters.map((letter) => String(letter.char ?? '')))
  for (const distractor of distractors) {
    const char = String(distractor.char ?? '')
    if (needed.has(char)) sink.push('error', scope, text.distractorIsLetter(char))
    checkAssetId(sink, scope, `distractors.${char}.audio`, distractor.audio, true)
  }

  if (language === 'ar') {
    const orderedChars = ordered.map((letter) => String(letter.char ?? ''))
    ordered.forEach((letter, index) => {
      const form = String(letter.form ?? '')
      const char = orderedChars[index] ?? ''
      const expected = expectedArabicForm(orderedChars, index)
      const previous = index > 0 ? orderedChars[index - 1] ?? null : null
      const previousConnects = previous !== null && !NON_CONNECTING_AR.has(previous)
      if (!form) sink.push('error', scope, text.letterFormMissing(char))
      else if (expected && form !== expected) {
        sink.push('error', scope, text.letterFormWrong(char, index + 1, form, expected, previous && !previousConnects ? previous : null))
      }
      if (!str(letter.audio)) sink.push('error', scope, text.letterAudioMissing(char))
    })
  } else {
    for (const letter of letters) {
      checkAssetId(sink, scope, `letters.${String(letter.char ?? '?')}.audio`, letter.audio, true)
    }
  }
}

const rhythmTapRule: LevelRule = (level, scope, ctx, sink) => {
  const text = copy[sink.locale]
  const lanes = num(level.lanes) ?? 1
  const duration = num(level.track_duration_ms) ?? 0
  const window = num(level.hit_window_ms) ?? 0
  const notes = asRecords(level.notes)
  const levelNumber = num(level.level) ?? 1

  checkAssetId(sink, scope, 'track', level.track, true)
  checkIntRange(sink, scope, 'track_duration_ms', level.track_duration_ms, 10000, 180000, true)
  checkIntRange(sink, scope, 'bpm', level.bpm, 60, 140, true)
  checkIntRange(sink, scope, 'lanes', level.lanes, 1, 3, true)
  checkIntRange(sink, scope, 'hit_window_ms', level.hit_window_ms, 250, 600, true)
  checkIntRange(sink, scope, 'accuracy_to_pass', level.accuracy_to_pass, 0.4, 0.8, true)
  if (notes.length < 4) sink.push('error', scope, text.minItems('notes', notes.length, 4))
  if (level.never_fail !== true) sink.push('error', scope, text.neverFail)
  if (level.visual_pulse !== true) sink.push('error', scope, text.visualPulse)

  let previous = -1
  notes.forEach((note, index) => {
    const time = num(note.time_ms)
    const lane = num(note.lane)
    if (lane !== null && lane >= lanes) sink.push('error', scope, text.noteLane(index, lane, lanes))
    if (time !== null && duration > 0 && time > duration) sink.push('error', scope, text.noteAfterEnd(index, time, duration))
    if (time !== null) {
      if (time < previous) sink.push('warning', scope, text.notesOutOfOrder(index))
      previous = time
    }
  })

  if (ctx.ageMax <= 5) {
    if (window > 0 && window < 450) sink.push('error', scope, text.hitWindowPreschool(window))
    if (levelNumber > 2) sink.push('error', scope, text.preschoolLevels(levelNumber))
  }
}

const blockCodeRule: LevelRule = (level, scope, _ctx, sink) => {
  const text = copy[sink.locale]
  const grid = isObject(level.grid) ? level.grid : {}
  const width = num(grid.w) ?? 0
  const height = num(grid.h) ?? 0

  checkIntRange(sink, scope, 'grid.w', grid.w, 3, 8, true)
  checkIntRange(sink, scope, 'grid.h', grid.h, 3, 8, true)
  checkIntRange(sink, scope, 'block_limit', level.block_limit, 3, 24, true)
  checkIntRange(sink, scope, 'optimal_blocks', level.optimal_blocks, 2, 24, true)
  checkIntRange(sink, scope, 'step_delay_ms', level.step_delay_ms, 200, 1200, true)

  const cells = (value: unknown): BlockCell[] => asArray(value)
    .map((entry) => {
      const pair = asArray(entry).map(num)
      return pair.length === 2 && pair[0] !== null && pair[1] !== null
        ? [pair[0], pair[1]] as BlockCell
        : null
    })
    .filter((cell): cell is BlockCell => cell !== null)

  const walls = cells(grid.walls)
  const collectibles = cells(grid.collectibles)
  const start = cells([grid.start])[0]
  const goal = cells([grid.goal])[0]

  const inBounds = (cell: BlockCell) => cell[0] >= 0 && cell[1] >= 0 && cell[0] < width && cell[1] < height
  const same = (a?: BlockCell, b?: BlockCell) => !!a && !!b && a[0] === b[0] && a[1] === b[1]
  const isWall = (cell: BlockCell) => walls.some((wall) => same(wall, cell))

  if (walls.length > 12) sink.push('error', scope, text.maxItems('grid.walls', walls.length, 12))
  if (collectibles.length > 6) sink.push('error', scope, text.maxItems('grid.collectibles', collectibles.length, 6))
  for (const cell of walls) if (!inBounds(cell)) sink.push('error', scope, text.cellOutside('walls', cell.join(','), width, height))
  for (const cell of collectibles) if (!inBounds(cell)) sink.push('error', scope, text.cellOutside('collectibles', cell.join(','), width, height))
  if (!start) sink.push('error', scope, text.missingField('grid.start'))
  else if (!inBounds(start)) sink.push('error', scope, text.cellOutside('start', start.join(','), width, height))
  if (!goal) sink.push('error', scope, text.missingField('grid.goal'))
  else if (!inBounds(goal)) sink.push('error', scope, text.cellOutside('goal', goal.join(','), width, height))
  if (start && isWall(start)) sink.push('error', scope, text.startOnWall)
  if (goal && isWall(goal)) sink.push('error', scope, text.goalOnWall)
  if (same(start, goal)) sink.push('error', scope, text.startIsGoal)
  for (const cell of collectibles) if (isWall(cell)) sink.push('error', scope, text.collectibleOnWall(cell.join(',')))

  const limit = num(level.block_limit)
  const optimal = num(level.optimal_blocks)
  if (limit !== null && optimal !== null && optimal > limit) sink.push('error', scope, text.optimalOverLimit(optimal, limit))

  const allowed = new Set(asArray(level.allowed_blocks).filter((token): token is string => typeof token === 'string'))
  if (!allowed.size) sink.push('error', scope, text.minItems('allowed_blocks', 0, 1))
  const reference = asArray(level.reference_solution).filter((token): token is string => typeof token === 'string')

  for (const token of reference) {
    if (!BLOCK_TOKEN_PATTERN.test(token)) sink.push('error', scope, text.referenceTokenShape(token))
    const kind = token.split(':')[0] ?? ''
    if (!allowed.has(kind)) sink.push('error', scope, text.referenceBlockNotAllowed(kind))
  }
  if (reference.length && limit !== null && reference.length > limit) {
    sink.push('error', scope, text.referenceTooLong(reference.length, limit))
  }
  if (!reference.length) sink.push('warning', scope, text.referenceMissing)

  if (reference.length && start && goal && width > 0 && height > 0) {
    const outcome = runBlockProgram(blockGridSpec(level.grid as BlockGrid), reference)
    if (!outcome.reachedGoal) {
      sink.push('error', scope, text.referenceFails(outcome.x, outcome.y, outcome.collided, outcome.collected, collectibles.length))
    } else if (optimal !== null && reference.length > optimal) {
      sink.push('warning', scope, text.referenceNotOptimal(reference.length, optimal))
    }
  }
}

const simLabRule: LevelRule = (level, scope, _ctx, sink) => {
  const text = copy[sink.locale]
  const variables = asRecords(level.variables)
  const relationships = isObject(level.expected_relationships) ? level.expected_relationships : {}
  const ids = variables.map((variable) => String(variable.id ?? ''))

  checkCount(sink, scope, 'variables', variables.length, 1, 3)
  checkUniqueIds(sink, scope, variables)
  checkIntRange(sink, scope, 'min_trials_before_explain', level.min_trials_before_explain, 2, 6, true)
  if (level.results_table !== true) sink.push('error', scope, text.resultsTable)

  const measured = isObject(level.measured) ? level.measured : null
  if (!measured) sink.push('error', scope, text.missingField('measured'))
  else {
    if (!SIM_ID_PATTERN.test(String(measured.id ?? ''))) sink.push('error', scope, text.variableId(String(measured.id ?? '')))
    checkI18nKey(sink, scope, 'measured.label_key', measured.label_key, true)
    checkI18nKey(sink, scope, 'measured.unit_key', measured.unit_key, true)
  }

  for (const key of Object.keys(relationships)) {
    if (!ids.includes(key)) sink.push('error', scope, text.relationshipUnknown(key))
  }
  for (const id of ids) {
    if (!(id in relationships)) sink.push('error', scope, text.relationshipMissing(id))
  }
  const values = Object.values(relationships)
  if (values.length && values.every((value) => value === 'none')) sink.push('error', scope, text.allNone)

  for (const variable of variables) {
    const id = String(variable.id ?? '?')
    if (!SIM_ID_PATTERN.test(id)) sink.push('error', scope, text.variableId(id))
    checkI18nKey(sink, scope, `variables.${id}.label_key`, variable.label_key, true)
    checkI18nKey(sink, scope, `variables.${id}.unit_key`, variable.unit_key, true)
    const min = num(variable.min)
    const max = num(variable.max)
    const step = num(variable.step)
    if (min === null) sink.push('error', scope, text.missingField(`variables.${id}.min`))
    if (max === null) sink.push('error', scope, text.missingField(`variables.${id}.max`))
    if (step === null || step <= 0) sink.push('error', scope, text.missingField(`variables.${id}.step`))
    if (min !== null && max !== null && min >= max) sink.push('error', scope, text.variableRange(id, min, max))
    if (min !== null && max !== null && step !== null && step > 0) {
      const steps = (max - min) / step
      if (Math.abs(steps - Math.round(steps)) > 1e-9) sink.push('warning', scope, text.variableSteps(id, min, max, step))
    }
  }

  const hypotheses = asArray(level.hypothesis_options).filter((value): value is string => typeof value === 'string')
  checkCount(sink, scope, 'hypothesis_options', hypotheses.length, 2, 4)
  for (const [index, option] of hypotheses.entries()) checkI18nKey(sink, scope, `hypothesis_options[${index}]`, option, true)
  if (new Set(hypotheses).size !== hypotheses.length) sink.push('error', scope, text.duplicateHypothesis)

  const options = asArray(level.explanation_options).filter((value): value is string => typeof value === 'string')
  checkCount(sink, scope, 'explanation_options', options.length, 2, 4)
  for (const [index, option] of options.entries()) checkI18nKey(sink, scope, `explanation_options[${index}]`, option, true)
  const answer = level.explanation_answer
  checkI18nKey(sink, scope, 'explanation_answer', answer, true)
  if (options.length && !options.includes(String(answer))) {
    sink.push('error', scope, text.explanationAnswerNotOption(String(answer)))
  }

  if (level.supervision_level === 'required' && !String(level.safety_note_key ?? '').trim()) {
    sink.push('error', scope, text.safetyNote)
  }
}

const timelineMapRule: LevelRule = (level, scope, _ctx, sink) => {
  const text = copy[sink.locale]
  const mode = String(level.mode ?? '')
  const timeline = isObject(level.timeline) ? level.timeline : null
  const map = isObject(level.map) ? level.map : null
  const events = asRecords(level.events)

  checkCount(sink, scope, 'events', events.length, 3, 5)
  checkUniqueIds(sink, scope, events)

  const needsYear = mode === 'timeline' || mode === 'both'
  const needsPlace = mode === 'map' || mode === 'both'
  if (needsYear && !timeline) sink.push('error', scope, text.needsTimeline(mode))
  if (needsPlace && !map) sink.push('error', scope, text.needsMap(mode))

  const from = timeline ? num(timeline.from) : null
  const to = timeline ? num(timeline.to) : null
  if (from !== null && to !== null && from >= to) sink.push('error', scope, text.timelineOrder(from, to))
  if (map && map.mirror_in_rtl !== false) sink.push('error', scope, text.mirrorInRtl)

  const region = map ? String(map.region ?? '') : ''
  const known = region ? region in REGION_BOUNDS : false
  if (map && region && !known) sink.push('warning', scope, text.unknownRegion(region))
  const bounds = region ? boundsForRegion(region) : null

  for (const event of events) {
    const id = String(event.id ?? '?')
    checkI18nKey(sink, scope, `events.${id}.label_key`, event.label_key, true)
    checkAssetId(sink, scope, `events.${id}.image`, event.image, true)
    if (event.explain_key !== undefined) checkI18nKey(sink, scope, `events.${id}.explain_key`, event.explain_key, false)

    if (needsYear) {
      const year = num(event.year)
      if (year === null) sink.push('error', scope, text.eventNeedsYear(id, mode))
      else if (from !== null && to !== null && (year < from || year > to)) {
        sink.push('error', scope, text.eventYearOutside(id, year, from, to))
      }
      if (num(event.tolerance_years) === null) sink.push('error', scope, text.eventNeedsToleranceYears(id))
      else checkIntRange(sink, scope, `events.${id}.tolerance_years`, event.tolerance_years, 10, 200, false)
    }
    if (needsPlace) {
      const lat = num(event.lat)
      const lon = num(event.lon)
      if (lat === null || lon === null) sink.push('error', scope, text.eventNeedsPlace(id))
      else if (bounds && known) {
        const inside = lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLon && lon <= bounds.maxLon
        if (!inside) sink.push('error', scope, text.eventOutsideRegion(id, lat, lon, region))
      }
      if (num(event.tolerance_km) === null) sink.push('error', scope, text.eventNeedsToleranceKm(id))
      else checkIntRange(sink, scope, `events.${id}.tolerance_km`, event.tolerance_km, 50, 500, false)
    }
  }

  const anchors = timeline ? asRecords(timeline.anchors) : []
  for (const anchor of anchors) {
    const year = num(anchor.year)
    checkI18nKey(sink, scope, 'timeline.anchors[].label_key', anchor.label_key, true)
    if (year !== null && from !== null && to !== null && (year < from || year > to)) {
      sink.push('warning', scope, text.anchorOutside(year))
    }
  }
}

const LEVEL_RULES: Record<string, LevelRule> = {
  match_pairs: matchPairsRule,
  sort_bins: sortBinsRule,
  memory_flip: memoryFlipRule,
  sequence_order: sequenceOrderRule,
  count_quantity: countQuantityRule,
  logic_pattern: logicPatternRule,
  word_build: wordBuildRule,
  rhythm_tap: rhythmTapRule,
  block_code: blockCodeRule,
  sim_lab: simLabRule,
  timeline_map: timelineMapRule,
}

/**
 * مفاتيح الصوت التي يفرضها المخطَّط على كل حزمة.
 *
 * الستّة الأساسية فقط: ما يزيد عليها لكل محرّك (`vo.count.1..20` مثلًا) يعرضه
 * مسار طابور الصوت لأنه يقرأه من عقد المحرّك، وتكراره هنا كان سينحرف عنه.
 */
export function requiredVoiceKeysFor(): string[] {
  return [...BASE_VOICE_KEYS]
}

/**
 * كل ما تستطيع الواجهة كشفه في حزمة محرّك.
 *
 * `scope` هو `pack` أو `level:n`، بالضبط كما في `packIssues` لـ`trace_color`،
 * حتى يستطيع النموذج عرض التنبيه بجانب المستوى الذي سبّبه.
 */
export function engineIssues(pack: EnginePack, locale: Locale, ctx: EngineIssueContext): PackIssue[] {
  const issues: PackIssue[] = []
  const sink: Sink = {
    locale,
    push: (level, scope, text) => { issues.push({ level, scope, text }) },
  }
  const text = copy[locale]
  const engineId = pack.engine_id
  const contract = engineContract(engineId)

  if (!Number.isInteger(pack.pack_version) || pack.pack_version < 1) sink.push('error', 'pack', text.packVersion)
  if (pack.pack_id && !PACK_ID_PATTERN.test(pack.pack_id)) sink.push('error', 'pack', text.packId(pack.pack_id))

  const levels = pack.levels ?? []
  if (levels.length > MAX_LEVELS) sink.push('error', 'pack', text.levelCount(levels.length))
  levels.forEach((level, index) => {
    if (Number(level.level) !== index + 1) sink.push('error', 'pack', text.levelNumbers(Number(level.level), index + 1))
  })
  const toFinish = Number(pack.progression?.levels_to_finish)
  if (Number.isFinite(toFinish) && toFinish > levels.length) {
    sink.push('error', 'pack', text.levelsToFinish(toFinish, levels.length))
  }

  if (contract) {
    if (typeof pack.supports_dpad === 'boolean' && pack.supports_dpad !== contract.supportsDpad) {
      sink.push('error', 'pack', text.dpad(engineId, contract.supportsDpad))
    }
    if (contract.languageClass && typeof pack.localization === 'string' && pack.localization !== contract.languageClass) {
      sink.push('error', 'pack', text.languageClass(engineId, contract.languageClass, pack.localization))
    }
    if (!contract.writesMastery && ctx.hasLearningObjective === true) {
      sink.push('error', 'pack', text.objectiveForbidden(engineId))
    }
    // هدف اللمس: تنبيه لا خطأ، لأن الجاهزية هي من تحجب النشر عليه. عرضه هنا
    // يجعله قابلًا للإصلاح في نفس الشاشة التي يُكتب فيها.
    const declared = num(pack.accessibility?.min_touch_target_dp)
    if (declared !== null) {
      if (declared < contract.minTouchTargetDp) {
        sink.push('warning', 'pack', text.touchTarget(declared, contract.minTouchTargetDp, engineId))
      }
      if (ctx.ageMax <= 5 && declared < 64) sink.push('warning', 'pack', text.touchTargetPreschool(declared))
    }
    if (contract.requiredReview) {
      const status = pack.review?.[contract.requiredReview]?.status ?? 'pending'
      if (status !== 'approved') sink.push('warning', 'pack', text.reviewPending(contract.requiredReview, status))
    }
  }

  if (ctx.gameSupervisionLevel && pack.supervision_level && pack.supervision_level !== ctx.gameSupervisionLevel) {
    sink.push('error', 'pack', text.supervisionMismatch(pack.supervision_level, ctx.gameSupervisionLevel))
  }

  for (const [key, value] of Object.entries(pack.voice_manifest ?? {})) {
    if (!VOICE_KEY_PATTERN.test(key)) sink.push('error', 'pack', text.voiceKeyShape(key))
    if (value && !ASSET_ID_PATTERN.test(value)) sink.push('error', 'pack', text.assetId(`voice_manifest.${key}`, value))
  }
  for (const key of requiredVoiceKeysFor()) {
    if (!pack.voice_manifest?.[key]) sink.push('warning', 'pack', text.voiceKeyMissing(key))
  }
  for (const field of ['images', 'audio'] as const) {
    for (const [index, id] of (pack.assets?.[field] ?? []).entries()) {
      if (!ASSET_ID_PATTERN.test(id)) sink.push('error', 'pack', text.assetId(`assets.${field}[${index}]`, id))
    }
  }

  const rule = LEVEL_RULES[engineId]
  if (rule) {
    for (const level of levels) {
      rule(level, `level:${Number(level.level) || 0}`, ctx, sink)
    }
  }

  return issues
}
