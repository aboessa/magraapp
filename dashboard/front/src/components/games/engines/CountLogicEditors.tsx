/**
 * محرّرا `count_quantity` و`logic_pattern`.
 *
 * ## count_quantity: الجواب يُحسَب ولا يُكتَب
 *
 * العلّة الأكثر شيوعًا في هذا المحرّك — والخادم يقولها صراحةً — أن يُكتب
 * `answer` رقمًا لا يساوي عدد العناصر المعروضة فعلًا. النتيجة سؤال لا يستطيع أي
 * طفل إصابته، ولا يكتشفه أحد لأن الحزمة صحيحة شكلًا.
 *
 * فالجواب هنا **ليس حقلًا**. المحرّر يؤلّف المجموعات (صورة وعدد نسخ)، والمحرّر
 * البصري يرسم النسخ فعلًا، والجواب مجموعها محسوبًا ومعروضًا للقراءة فقط. لا يوجد
 * مكان تُكتب فيه القيمة الخاطئة. والخيارات تحتوي الجواب دائمًا لأن إضافته
 * تلقائية: خيارات لا تحتوي الجواب سؤال آخر بلا إجابة.
 *
 * في `compare_sets` الحساب غير كامل بالضرورة: صياغة السؤال («أيّهما أكثر» أم
 * «أيّهما أقلّ») تعيش في مفتاح ترجمة لا يُقرأ آليًا، فالجواب يبقى اختيارًا —
 * لكن الحالتين اللتين يفرضهما الحساب مفروضتان: التساوي يُلزم «متساويتان»،
 * والاختلاف يمنعها.
 *
 * في `pattern_fill` تُستنتج القيمة الناقصة حين تكون المتتالية حسابية (وهو ما
 * يفحصه الخادم)، وتُعرض كاقتراح بضغطة واحدة مع بيان الخطوة.
 *
 * ## logic_pattern: الجواب من الخيارات لا نصّ حرّ
 *
 * `answer` معرّف أصل يجب أن يكون بين `options`. حقل نصّ منفصل يعني احتمال خطأ
 * مطبعي في معرّف طويل؛ فالجواب هنا **اختيار من الخيارات الموجودة** بصورها.
 *
 * والقاعدة التي لا يجوز خرقها: اللون وحده لا يكفي كبُعد متغيّر. الخادم يرفضها،
 * وسببها أن طفلًا لا يميّز الألوان يُقصى من المستوى كلّه. المحرّر يعرض المنع
 * حيث تُختار الأبعاد لا في قائمة أخطاء بعد الحفظ.
 */

import { Icon } from '../../Icon'
import { usePreferences } from '../../../context/preferences'
import { asRecords, nextId } from '../../../lib/enginePack'
import { AssetField, AssetThumb, EditorCard, EditorSection, KeyField, confirmRemoval, moveInArray } from './fields'
import { CHANGING_DIMENSIONS, COMPARE_ANSWERS, COUNT_MODES, LOGIC_MODES, NUMERAL_SYSTEMS } from '../../../types/enginePack'
import type {
  CompareAnswer,
  CompareItem,
  CountAnyItem,
  CountPickItem,
  CountQuantityLevel,
  CountSet,
  LogicPatternLevel,
  PatternItem,
} from '../../../types/enginePack'

const copy = {
  ar: {
    mode: 'النمط',
    modes: {
      count_and_pick: 'عُدّ واختر الرقم',
      drag_amount: 'اسحب الكمّية المطلوبة',
      compare_sets: 'قارن مجموعتين',
      pattern_fill: 'أكمل المتتالية',
    } as Record<string, string>,
    modeHint: 'تغيير النمط يغيّر شكل الأسئلة بالكامل: العناصر الحالية تبقى ويجب مراجعتها.',
    range: 'مدى الأعداد',
    rangeFrom: 'من',
    rangeTo: 'إلى',
    numerals: 'شكل الأرقام',
    numeralSystems: { auto: 'تلقائي حسب اللغة', arabic_indic: '١٢٣ هندية', western: '123 غربية' } as Record<string, string>,
    countAloud: 'العدّ بصوت عالٍ عند الخطأ',
    recount: 'زرّ «أعد العدّ» ظاهر دائمًا',
    recountLocked: 'مفروض في العقد ولا يُطفأ: الطفل يحتاج أن يعيد العدّ بلا عقوبة.',
    questions: 'الأسئلة',
    questionsHint: 'من 3 إلى 5 أسئلة في المستوى.',
    addQuestion: 'سؤال',
    question: 'مفتاح صياغة السؤال',
    sets: 'المجموعات المعروضة',
    setsHint: 'كل مجموعة صورة وعدد نسخ. مجموع النسخ هو الجواب، ويُحسَب هنا ولا يُكتب.',
    addSet: 'مجموعة',
    count: 'عدد النسخ',
    onScreen: 'على الشاشة',
    answerComputed: 'الجواب المحسوب',
    answerLocked: 'يساوي عدد العناصر المعروضة. الخادم يرفض أي قيمة أخرى، فلا حقل لكتابتها.',
    options: 'الخيارات المعروضة',
    optionsHint: 'من 2 إلى 4. الجواب مُضاف دائمًا ولا يمكن حذفه.',
    addOption: 'خيار',
    optionValue: 'قيمة',
    correct: 'الصحيح',
    budget: (count: number) => `${count} عنصرًا على الشاشة، وحدّ المحرّك 20.`,
    setA: 'المجموعة الأولى',
    setB: 'المجموعة الثانية',
    compareAnswer: 'الجواب',
    compareAnswers: { set_a: 'الأولى', set_b: 'الثانية', equal: 'متساويتان' } as Record<string, string>,
    equalForced: 'المجموعتان متساويتان، فالجواب «متساويتان» لا غير.',
    equalBlocked: 'المجموعتان غير متساويتين، فلا يجوز أن يكون الجواب «متساويتان».',
    compareFact: (a: number, b: number) => a === b ? `متساويتان (${a} و${b}).` : `الأكثر: ${a > b ? 'الأولى' : 'الثانية'} (${a} و${b}).`,
    compareWording: 'أيّهما «أكثر» أم «أقلّ» تحمله صياغة السؤال المترجمة، فالخادم لا يستطيع فحصه: راجعه بنفسك.',
    sequence: 'المتتالية',
    sequenceHint: 'من 3 إلى 6 مواضع، وموضع واحد فقط ناقص.',
    addPosition: 'موضع',
    missing: 'ناقص',
    setMissing: 'اجعله الموضع الناقص',
    ruleKey: 'مفتاح القاعدة',
    inferred: (step: number, value: number) => `المتتالية تتقدّم بـ${step}، فالقيمة الناقصة ${value}.`,
    useInferred: 'استخدم القيمة المستنتجة',
    gapsWrong: (count: number) => `يجب أن يكون موضع واحد فقط ناقصًا، والموجود ${count}.`,
    // logic_pattern
    logicMode: 'شكل النمط',
    logicModes: {
      linear: 'متتالية خطية',
      linear_alt: 'متتالية متبادلة',
      matrix_2x2: 'مصفوفة 2×2',
      matrix_3x3: 'مصفوفة 3×3',
      rule_infer: 'استنتاج القاعدة',
    } as Record<string, string>,
    cells: 'الخلايا',
    cellsHint: 'كل خليّة معرّف صورة، وخليّة واحدة بالضبط ناقصة — هي التي يملؤها الطفل.',
    cell: 'خليّة',
    logicOptions: 'الخيارات',
    logicOptionsHint: 'من 3 إلى 5 خيارات. الجواب يُختار منها فلا يمكن أن يكون خارجها.',
    logicAnswer: 'الجواب',
    pickAnswer: 'اجعله الجواب',
    isAnswer: 'الجواب',
    dimensions: 'الأبعاد المتغيّرة',
    dimensionNames: {
      color: 'اللون', shape: 'الشكل', size: 'الحجم',
      rotation: 'الدوران', count: 'العدد', pattern: 'النقش',
    } as Record<string, string>,
    dimensionsHint: 'من 1 إلى 3. اللون وحده مرفوض من الخادم: بُعدٌ غير اللون هو ما يجعل النمط قابلًا للحلّ بلا تمييز لوني.',
    colourOnly: 'اللون هو البُعد الوحيد المحدَّد. أضف بُعدًا آخر — شكل أو نقش أو دوران أو حجم أو عدد — وإلا رُفض الحفظ.',
    requireExplanation: 'يطلب تعليلًا بعد الجواب',
    explanationLocked: 'مفروض في هذا الشكل: جواب صحيح بلا تعليل قد يكون تخمينًا.',
    explainOptions: 'خيارات التعليل',
    explainOptionsHint: 'من 3 إلى 5 مفاتيح ترجمة. الجواب يُختار منها.',
    addExplain: 'خيار تعليل',
    explainAnswer: 'التعليل الصحيح',
    rows: 'صفوف',
    columns: 'أعمدة',
    remove: 'حذف',
  },
  en: {
    mode: 'Mode',
    modes: {
      count_and_pick: 'Count and pick the number',
      drag_amount: 'Drag the requested amount',
      compare_sets: 'Compare two sets',
      pattern_fill: 'Complete the sequence',
    } as Record<string, string>,
    modeHint: 'Changing the mode changes the whole question shape: existing items are kept and must be reviewed.',
    range: 'Number range',
    rangeFrom: 'From',
    rangeTo: 'To',
    numerals: 'Numeral shape',
    numeralSystems: { auto: 'Automatic by language', arabic_indic: '١٢٣ Arabic-Indic', western: '123 Western' } as Record<string, string>,
    countAloud: 'Count aloud after a mistake',
    recount: 'The recount button is always visible',
    recountLocked: 'Required by the contract and never switched off: the child must be able to recount without penalty.',
    questions: 'Questions',
    questionsHint: '3 to 5 questions per level.',
    addQuestion: 'Question',
    question: 'Question wording key',
    sets: 'Sets shown on screen',
    setsHint: 'Each set is an image and a number of copies. The total is the answer, computed here rather than typed.',
    addSet: 'Set',
    count: 'Copies',
    onScreen: 'On screen',
    answerComputed: 'Computed answer',
    answerLocked: 'Equals the number of elements shown. The server refuses any other value, so there is no field to type one.',
    options: 'Options shown',
    optionsHint: '2 to 4. The answer is always included and cannot be removed.',
    addOption: 'Option',
    optionValue: 'Value',
    correct: 'Correct',
    budget: (count: number) => `${count} elements on screen; the engine's budget is 20.`,
    setA: 'First set',
    setB: 'Second set',
    compareAnswer: 'Answer',
    compareAnswers: { set_a: 'First', set_b: 'Second', equal: 'Equal' } as Record<string, string>,
    equalForced: 'The sets are equal, so the answer can only be "equal".',
    equalBlocked: 'The sets are not equal, so the answer must not be "equal".',
    compareFact: (a: number, b: number) => a === b ? `Equal (${a} and ${b}).` : `More: ${a > b ? 'the first' : 'the second'} (${a} and ${b}).`,
    compareWording: 'Whether the question asks for "more" or "fewer" lives in the translated wording, which the server cannot read: check it yourself.',
    sequence: 'Sequence',
    sequenceHint: '3 to 6 positions, with exactly one missing.',
    addPosition: 'Position',
    missing: 'Missing',
    setMissing: 'Make this the missing position',
    ruleKey: 'Rule key',
    inferred: (step: number, value: number) => `The sequence steps by ${step}, so the missing value is ${value}.`,
    useInferred: 'Use the inferred value',
    gapsWrong: (count: number) => `Exactly one position may be missing, found ${count}.`,
    logicMode: 'Pattern shape',
    logicModes: {
      linear: 'Linear sequence',
      linear_alt: 'Alternating sequence',
      matrix_2x2: '2×2 matrix',
      matrix_3x3: '3×3 matrix',
      rule_infer: 'Infer the rule',
    } as Record<string, string>,
    cells: 'Cells',
    cellsHint: 'Each cell is an image id, and exactly one cell is missing — the one the child fills.',
    cell: 'Cell',
    logicOptions: 'Options',
    logicOptionsHint: '3 to 5 options. The answer is chosen from them, so it cannot fall outside.',
    logicAnswer: 'Answer',
    pickAnswer: 'Make this the answer',
    isAnswer: 'Answer',
    dimensions: 'Changing dimensions',
    dimensionNames: {
      color: 'Colour', shape: 'Shape', size: 'Size',
      rotation: 'Rotation', count: 'Count', pattern: 'Pattern',
    } as Record<string, string>,
    dimensionsHint: '1 to 3. Colour alone is refused by the server: a non-colour dimension is what makes the puzzle solvable without colour vision.',
    colourOnly: 'Colour is the only dimension selected. Add another — shape, pattern, rotation, size or count — or the save is refused.',
    requireExplanation: 'Ask for a reason after the answer',
    explanationLocked: 'Mandatory in this shape: a correct answer without a reason may be a guess.',
    explainOptions: 'Explanation options',
    explainOptionsHint: '3 to 5 translation keys. The answer is chosen from them.',
    addExplain: 'Explanation option',
    explainAnswer: 'Correct explanation',
    rows: 'Rows',
    columns: 'Columns',
    remove: 'Delete',
  },
}

// ---------------------------------------------------------------------------
// count_quantity
// ---------------------------------------------------------------------------

function isCompare(item: CountAnyItem): item is CompareItem {
  return 'set_a' in item
}

function isPattern(item: CountAnyItem): item is PatternItem {
  return 'sequence' in item
}

/// القيمة الناقصة حين تكون المتتالية حسابية، وهي الحالة التي يفحصها الخادم.
function inferredMissing(sequence: Array<number | null>): { step: number; value: number } | null {
  const indices = sequence.map((value, index) => (value === null ? -1 : index)).filter((index) => index >= 0)
  if (indices.length < 2) return null
  const first = indices[0]
  const second = indices[1]
  if (first === undefined || second === undefined || second === first) return null
  const step = ((sequence[second] as number) - (sequence[first] as number)) / (second - first)
  if (!Number.isInteger(step)) return null
  const anchorIndex = sequence.findIndex((value) => value !== null)
  const anchor = sequence[anchorIndex] as number
  const arithmetic = sequence.every((value, index) => value === null || value === anchor + (index - anchorIndex) * step)
  if (!arithmetic) return null
  const missingIndex = sequence.findIndex((value) => value === null)
  if (missingIndex < 0) return null
  return { step, value: anchor + (missingIndex - anchorIndex) * step }
}

/// شريط النسخ كما ستُعرض للطفل: العدّ يقع على ما يُرى، فرسمه هو المحرّر.
function CountStrip({ sets }: { sets: CountSet[] }) {
  return (
    <div className="engine-count-strip">
      {sets.map((set, index) => (
        <div className="engine-count-strip__set" key={index}>
          {Array.from({ length: Math.max(0, Math.min(Number(set.count) || 0, 20)) }, (_, copy) => (
            <AssetThumb assetId={set.image} size={30} key={copy} />
          ))}
          <small dir="ltr">×{Number(set.count) || 0}</small>
        </div>
      ))}
    </div>
  )
}

export function CountQuantityEditor({ level, onChange }: { level: CountQuantityLevel; onChange: (level: CountQuantityLevel) => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const mode = level.mode ?? 'count_and_pick'
  const items = level.items ?? []
  const range = level.range ?? [1, 5]
  const patch = (next: Partial<CountQuantityLevel>) => onChange({ ...level, ...next })

  const patchItem = (index: number, next: CountAnyItem) =>
    patch({ items: items.map((entry, position) => (position === index ? next : entry)) })

  function addQuestion() {
    const prefix = mode === 'pattern_fill' ? 'p' : 'q'
    const id = nextId(items.map((item) => String((item as { id?: string }).id ?? '')), prefix)
    if (mode === 'compare_sets') {
      const item: CompareItem = {
        id,
        set_a: { image: '', count: 3 },
        set_b: { image: '', count: 5 },
        question_key: `game.count_quantity.level_${level.level}.question_${id}`,
        options: ['set_a', 'set_b'],
        answer: 'set_b',
      }
      patch({ items: [...items, item] })
      return
    }
    if (mode === 'pattern_fill') {
      const item: PatternItem = {
        id,
        sequence: [2, 4, null],
        options: [6],
        answer: 6,
        rule_key: `game.count_quantity.level_${level.level}.rule_${id}`,
      }
      patch({ items: [...items, item] })
      return
    }
    const item: CountPickItem = {
      id,
      items: [{ image: '', count: 3 }],
      question_key: `game.count_quantity.level_${level.level}.question_${id}`,
      options: [3],
      answer: 3,
    }
    patch({ items: [...items, item] })
  }

  /// خيارات مع الجواب دائمًا. الترتيب مصعّد ليكون العرض متوقّعًا.
  function withAnswer(options: number[], answer: number): number[] {
    const unique = [...new Set([...options.filter((value) => Number.isFinite(value)), answer])]
    return unique.sort((a, b) => a - b)
  }

  return (
    <div className="engine-editor">
      <div className="form-grid form-grid--three">
        <label className="field">
          <span>{text.mode}</span>
          <select value={mode} onChange={(event) => patch({ mode: event.target.value as CountQuantityLevel['mode'] })}>
            {COUNT_MODES.map((value) => <option value={value} key={value}>{text.modes[value]}</option>)}
          </select>
          <small>{text.modeHint}</small>
        </label>
        <label className="field">
          <span>{text.numerals}</span>
          <select value={level.numeral_system ?? 'auto'} onChange={(event) => patch({ numeral_system: event.target.value as CountQuantityLevel['numeral_system'] })}>
            {NUMERAL_SYSTEMS.map((value) => <option value={value} key={value}>{text.numeralSystems[value]}</option>)}
          </select>
        </label>
        <div className="field">
          <span>{text.range}</span>
          <div className="engine-field__row">
            <input
              type="number" dir="ltr" min="1" max="20" aria-label={text.rangeFrom}
              value={range[0]}
              onChange={(event) => patch({ range: [Number(event.target.value), range[1]] })}
            />
            <input
              type="number" dir="ltr" min="1" max="20" aria-label={text.rangeTo}
              value={range[1]}
              onChange={(event) => patch({ range: [range[0], Number(event.target.value)] })}
            />
          </div>
        </div>
      </div>

      <div className="form-grid">
        <label className="checkbox-control">
          <input type="checkbox" checked={level.count_aloud_on_error !== false} onChange={(event) => patch({ count_aloud_on_error: event.target.checked })} />
          <span>{text.countAloud}</span>
        </label>
        <label className="checkbox-control">
          {/* معطَّل لا مخفيّ: المحرّر يجب أن يرى أن الزرّ موجود وأنه ليس قرارًا
              قابلًا للتغيير، لا أن يظنّه غير مُنفَّذ. */}
          <input type="checkbox" checked disabled readOnly />
          <span>{text.recount}</span>
        </label>
      </div>
      <p className="engine-note">{text.recountLocked}</p>

      <EditorSection
        title={`${text.questions} (${items.length}/5)`}
        hint={text.questionsHint}
        actions={<button className="button button--secondary" type="button" onClick={addQuestion} disabled={items.length >= 5}><Icon name="plus" size={15} />{text.addQuestion}</button>}
      >
        {items.map((item, index) => {
          const id = String((item as { id?: string }).id ?? '?')
          const remove = () => {
            if (!confirmRemoval(locale, `${text.addQuestion} ${id}`)) return
            patch({ items: items.filter((_, position) => position !== index) })
          }

          if (isCompare(item)) {
            const a = Number(item.set_a?.count) || 0
            const b = Number(item.set_b?.count) || 0
            const equal = a === b
            const total = a + b
            return (
              <EditorCard key={id} title={<code dir="ltr">{id}</code>} removeLabel={text.remove} onRemove={remove}>
                <div className="form-grid">
                  <AssetField label={`${text.setA} — ${text.sets}`} kind="image" value={item.set_a?.image} onChange={(value) => patchItem(index, { ...item, set_a: { ...item.set_a, image: value } })} required />
                  <label className="field">
                    <span>{text.setA} · {text.count}</span>
                    <input type="number" dir="ltr" min="1" max="20" value={a} onChange={(event) => patchItem(index, { ...item, set_a: { ...item.set_a, count: Number(event.target.value) } })} />
                  </label>
                  <AssetField label={`${text.setB} — ${text.sets}`} kind="image" value={item.set_b?.image} onChange={(value) => patchItem(index, { ...item, set_b: { ...item.set_b, image: value } })} required />
                  <label className="field">
                    <span>{text.setB} · {text.count}</span>
                    <input type="number" dir="ltr" min="1" max="20" value={b} onChange={(event) => patchItem(index, { ...item, set_b: { ...item.set_b, count: Number(event.target.value) } })} />
                  </label>
                </div>
                <CountStrip sets={[item.set_a ?? { image: '', count: 0 }, item.set_b ?? { image: '', count: 0 }]} />
                {total > 20 && <p className="inline-alert inline-alert--error">{text.budget(total)}</p>}
                <p className="engine-note">{text.compareFact(a, b)} {text.compareWording}</p>
                <div className="form-grid">
                  <KeyField label={text.question} value={item.question_key} onChange={(value) => patchItem(index, { ...item, question_key: value })} required suggest={`game.count_quantity.level_${level.level}.question_${id}`} />
                  <div className="field">
                    <span>{text.compareAnswer}</span>
                    <div className="engine-field__row">
                      {COMPARE_ANSWERS.map((value) => {
                        // التساوي يُلزم «متساويتان»، والاختلاف يمنعها. هذان هما
                        // ما يفرضه الحساب، والباقي تقرّره صياغة السؤال.
                        const disabled = value === 'equal' ? !equal : equal
                        return (
                          <label className="checkbox-control" key={value}>
                            <input
                              type="radio"
                              name={`compare-${level.level}-${id}`}
                              checked={item.answer === value}
                              disabled={disabled}
                              onChange={() => patchItem(index, {
                                ...item,
                                answer: value as CompareAnswer,
                                options: [...new Set([...(item.options ?? []), value as CompareAnswer])],
                              })}
                            />
                            <span>{text.compareAnswers[value]}</span>
                          </label>
                        )
                      })}
                    </div>
                    <small>{equal ? text.equalForced : text.equalBlocked}</small>
                  </div>
                </div>
              </EditorCard>
            )
          }

          if (isPattern(item)) {
            const sequence = item.sequence ?? []
            const gaps = sequence.filter((value) => value === null).length
            const inferred = gaps === 1 ? inferredMissing(sequence) : null
            return (
              <EditorCard key={id} title={<code dir="ltr">{id}</code>} removeLabel={text.remove} onRemove={remove}>
                <EditorSection
                  title={text.sequence}
                  hint={text.sequenceHint}
                  actions={
                    <button
                      className="button button--ghost" type="button" disabled={sequence.length >= 6}
                      onClick={() => patchItem(index, { ...item, sequence: [...sequence, 0] })}
                    ><Icon name="plus" size={14} />{text.addPosition}</button>
                  }
                >
                  <div className="engine-sequence">
                    {sequence.map((value, slot) => (
                      <div className={value === null ? 'engine-sequence__slot engine-sequence__slot--missing' : 'engine-sequence__slot'} key={slot}>
                        <input
                          type="number" dir="ltr" aria-label={`${text.sequence} ${slot + 1}`}
                          value={value === null ? '' : value}
                          placeholder="?"
                          onChange={(event) => patchItem(index, {
                            ...item,
                            sequence: sequence.map((entry, position) => (position === slot
                              ? (event.target.value === '' ? null : Number(event.target.value))
                              : entry)),
                          })}
                        />
                        <button
                          className="button button--ghost" type="button" title={text.setMissing}
                          onClick={() => patchItem(index, {
                            ...item,
                            // موضع ناقص واحد بالضبط: تعليم موضع يُعيد الباقي إلى
                            // أرقامه، فلا يمكن أن يكون هناك فراغان.
                            sequence: sequence.map((entry, position) => (position === slot ? null : entry ?? 0)),
                          })}
                        >{text.missing}</button>
                        {sequence.length > 3 && (
                          <button
                            className="icon-button icon-button--small icon-button--danger" type="button" title={text.remove}
                            onClick={() => patchItem(index, { ...item, sequence: sequence.filter((_, position) => position !== slot) })}
                          ><Icon name="close" size={12} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  {gaps !== 1 && <p className="inline-alert inline-alert--error">{text.gapsWrong(gaps)}</p>}
                  {inferred && (
                    <div className="engine-note">
                      <span>{text.inferred(inferred.step, inferred.value)}</span>
                      {item.answer !== inferred.value && (
                        <button
                          className="button button--secondary" type="button"
                          onClick={() => patchItem(index, { ...item, answer: inferred.value, options: withAnswer(item.options ?? [], inferred.value) })}
                        >{text.useInferred}</button>
                      )}
                    </div>
                  )}
                </EditorSection>
                <div className="form-grid">
                  <KeyField label={text.ruleKey} value={item.rule_key} onChange={(value) => patchItem(index, { ...item, rule_key: value })} required suggest={`game.count_quantity.level_${level.level}.rule_${id}`} />
                  <label className="field">
                    <span>{text.answerComputed}</span>
                    <input
                      type="number" dir="ltr" value={item.answer ?? ''}
                      onChange={(event) => {
                        const answer = Number(event.target.value)
                        patchItem(index, { ...item, answer, options: withAnswer(item.options ?? [], answer) })
                      }}
                    />
                  </label>
                </div>
                <NumberOptions
                  options={item.options ?? []}
                  answer={item.answer}
                  onChange={(options) => patchItem(index, { ...item, options: withAnswer(options, item.answer) })}
                  max={4}
                />
              </EditorCard>
            )
          }

          const pick = item as CountPickItem
          const sets = pick.items ?? []
          const total = sets.reduce((sum, set) => sum + (Number(set.count) || 0), 0)
          return (
            <EditorCard key={id} title={<code dir="ltr">{id}</code>} removeLabel={text.remove} onRemove={remove}>
              <EditorSection
                title={text.sets}
                hint={text.setsHint}
                actions={
                  <button
                    className="button button--ghost" type="button"
                    onClick={() => patchItem(index, {
                      ...pick,
                      items: [...sets, { image: '', count: 1 }],
                      // الجواب يتبع المجموعات فورًا: لا لحظة تكون فيها الحزمة
                      // غير متّسقة، ولا حقل يمكن أن ينسى المحرّر تحديثه.
                      answer: total + 1,
                      options: withAnswer(pick.options ?? [], total + 1),
                    })}
                  ><Icon name="plus" size={14} />{text.addSet}</button>
                }
              >
                {sets.map((set, setIndex) => (
                  <div className="form-grid form-grid--three" key={setIndex}>
                    <AssetField
                      label={text.sets} kind="image" value={set.image} required
                      onChange={(value) => patchItem(index, { ...pick, items: sets.map((entry, position) => (position === setIndex ? { ...entry, image: value } : entry)) })}
                    />
                    <label className="field">
                      <span>{text.count}</span>
                      <input
                        type="number" dir="ltr" min="1" max="20" value={set.count ?? 1}
                        onChange={(event) => {
                          const nextSets = sets.map((entry, position) => (position === setIndex ? { ...entry, count: Number(event.target.value) } : entry))
                          const answer = nextSets.reduce((sum, entry) => sum + (Number(entry.count) || 0), 0)
                          patchItem(index, { ...pick, items: nextSets, answer, options: withAnswer(pick.options ?? [], answer) })
                        }}
                      />
                    </label>
                    <div className="field">
                      <span>&nbsp;</span>
                      <button
                        className="button button--ghost" type="button" disabled={sets.length <= 1}
                        onClick={() => {
                          const nextSets = sets.filter((_, position) => position !== setIndex)
                          const answer = nextSets.reduce((sum, entry) => sum + (Number(entry.count) || 0), 0)
                          patchItem(index, { ...pick, items: nextSets, answer, options: withAnswer(pick.options ?? [], answer) })
                        }}
                      ><Icon name="close" size={14} />{text.remove}</button>
                    </div>
                  </div>
                ))}
                <CountStrip sets={sets} />
                <div className="detail-fields">
                  <div><span>{text.onScreen}</span><strong dir="ltr">{total}</strong></div>
                  <div><span>{text.answerComputed}</span><strong dir="ltr">{total}</strong></div>
                </div>
                <p className="engine-note">{text.answerLocked}</p>
                {total > 20 && <p className="inline-alert inline-alert--error">{text.budget(total)}</p>}
              </EditorSection>
              <div className="form-grid">
                <KeyField label={text.question} value={pick.question_key} onChange={(value) => patchItem(index, { ...pick, question_key: value })} suggest={`game.count_quantity.level_${level.level}.question_${id}`} />
              </div>
              <NumberOptions
                options={pick.options ?? []}
                answer={total}
                onChange={(options) => patchItem(index, { ...pick, answer: total, options: withAnswer(options, total) })}
                max={4}
              />
            </EditorCard>
          )
        })}
      </EditorSection>
    </div>
  )
}

/// خيارات رقمية، والجواب بينها دائمًا ولا يمكن حذفه.
function NumberOptions({ options, answer, onChange, max }: {
  options: number[]
  answer: number
  onChange: (options: number[]) => void
  max: number
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  return (
    <EditorSection
      title={`${text.options} (${options.length}/${max})`}
      hint={text.optionsHint}
      actions={
        <button
          className="button button--ghost" type="button" disabled={options.length >= max}
          onClick={() => onChange([...options, Math.max(1, answer + 1)])}
        ><Icon name="plus" size={14} />{text.addOption}</button>
      }
    >
      <div className="engine-options">
        {options.map((option, index) => (
          <div className={option === answer ? 'engine-option engine-option--correct' : 'engine-option'} key={index}>
            <input
              type="number" dir="ltr" aria-label={`${text.optionValue} ${index + 1}`}
              value={option}
              disabled={option === answer}
              onChange={(event) => onChange(options.map((entry, position) => (position === index ? Number(event.target.value) : entry)))}
            />
            {option === answer
              ? <span className="library-pill library-pill--age">{text.correct}</span>
              : (
                <button
                  className="icon-button icon-button--small icon-button--danger" type="button" title={text.remove}
                  onClick={() => onChange(options.filter((_, position) => position !== index))}
                ><Icon name="close" size={12} /></button>
              )}
          </div>
        ))}
      </div>
    </EditorSection>
  )
}

// ---------------------------------------------------------------------------
// logic_pattern
// ---------------------------------------------------------------------------

export function LogicPatternEditor({ level, onChange }: { level: LogicPatternLevel; onChange: (level: LogicPatternLevel) => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const mode = level.mode ?? 'linear'
  const isMatrix = mode === 'matrix_2x2' || mode === 'matrix_3x3'
  const options = level.options ?? []
  const dimensions = level.changing_dimensions ?? []
  const explainOptions = level.explain_options ?? []
  const needsExplanation = mode === 'matrix_3x3' || mode === 'rule_infer'
  const patch = (next: Partial<LogicPatternLevel>) => onChange({ ...level, ...next })

  const size = mode === 'matrix_2x2' ? 2 : 3
  const grid = level.grid ?? []
  const sequence = level.sequence ?? []

  /// تبديل الشكل يبني الهيكل المطلوب للشكل الجديد بدل تركه فارغًا: المخطَّط
  /// يفرض `grid` للمصفوفات و`sequence` للخطّية، وحزمة بلا الهيكل الصحيح مرفوضة.
  function switchMode(next: LogicPatternLevel['mode']) {
    const matrix = next === 'matrix_2x2' || next === 'matrix_3x3'
    const side = next === 'matrix_2x2' ? 2 : 3
    if (matrix) {
      const rows = Array.from({ length: side }, (_, row) => Array.from({ length: side }, (_, column) => grid[row]?.[column] ?? null))
      patch({ mode: next, grid: rows, sequence: undefined, require_explanation: next === 'matrix_3x3' ? true : level.require_explanation })
      return
    }
    if (next === 'rule_infer') {
      patch({ mode: next, require_explanation: true })
      return
    }
    patch({ mode: next, grid: undefined, sequence: sequence.length ? sequence : [null, null, null] })
  }

  function setCell(row: number, column: number, value: string | null) {
    const rows = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => grid[r]?.[c] ?? null))
    // خليّة ناقصة واحدة بالضبط: تعليم خليّة يُفرغ الفراغ السابق ضمنًا لأن
    // المحرّر يضع قيمة، وتعليم الفراغ يمسح أي فراغ آخر.
    if (value === null) {
      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
          if (rows[r][c] === null && !(r === row && c === column)) rows[r][c] = options[0] ?? ''
        }
      }
    }
    rows[row][column] = value
    patch({ grid: rows })
  }

  function setSequenceSlot(slot: number, value: string | null) {
    const next = sequence.map((entry, index) => {
      if (index === slot) return value
      if (value === null && entry === null) return options[0] ?? ''
      return entry
    })
    patch({ sequence: next })
  }

  return (
    <div className="engine-editor">
      <div className="form-grid form-grid--three">
        <label className="field">
          <span>{text.logicMode}</span>
          <select value={mode} onChange={(event) => switchMode(event.target.value as LogicPatternLevel['mode'])}>
            {LOGIC_MODES.map((value) => <option value={value} key={value}>{text.logicModes[value]}</option>)}
          </select>
        </label>
        <KeyField label={text.ruleKey} value={level.rule_key} onChange={(value) => patch({ rule_key: value })} required suggest={`game.logic_pattern.level_${level.level}.rule`} />
        <div className="field">
          <span>{text.dimensions}</span>
          <div className="engine-field__row engine-field__row--wrap">
            {CHANGING_DIMENSIONS.map((dimension) => {
              const checked = dimensions.includes(dimension)
              return (
                <label className="checkbox-control" key={dimension}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && dimensions.length >= 3}
                    onChange={(event) => patch({
                      changing_dimensions: event.target.checked
                        ? [...dimensions, dimension]
                        : dimensions.filter((entry) => entry !== dimension),
                    })}
                  />
                  <span>{text.dimensionNames[dimension]}</span>
                </label>
              )
            })}
          </div>
          <small>{text.dimensionsHint}</small>
        </div>
      </div>
      {dimensions.length === 1 && dimensions[0] === 'color' && (
        <p className="inline-alert inline-alert--error">{text.colourOnly}</p>
      )}

      <EditorSection title={text.cells} hint={text.cellsHint}>
        {isMatrix ? (
          <div className="engine-grid" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
            {Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => {
              const value = grid[row]?.[column] ?? null
              return (
                <div className={value === null ? 'engine-grid__cell engine-grid__cell--missing' : 'engine-grid__cell'} key={`${row}-${column}`}>
                  <AssetThumb assetId={value} size={52} />
                  <select
                    aria-label={`${text.cell} ${row + 1}×${column + 1}`}
                    value={value === null ? '__missing__' : value}
                    onChange={(event) => setCell(row, column, event.target.value === '__missing__' ? null : event.target.value)}
                  >
                    <option value="__missing__">{text.missing}</option>
                    {options.map((option) => <option value={option} key={option}>{option}</option>)}
                  </select>
                </div>
              )
            }))}
          </div>
        ) : (
          <div className="engine-sequence">
            {sequence.map((value, slot) => (
              <div className={value === null ? 'engine-sequence__slot engine-sequence__slot--missing' : 'engine-sequence__slot'} key={slot}>
                <AssetThumb assetId={value} size={52} />
                <select
                  aria-label={`${text.cell} ${slot + 1}`}
                  value={value === null ? '__missing__' : value ?? ''}
                  onChange={(event) => setSequenceSlot(slot, event.target.value === '__missing__' ? null : event.target.value)}
                >
                  <option value="__missing__">{text.missing}</option>
                  {options.map((option) => <option value={option} key={option}>{option}</option>)}
                </select>
                {sequence.length > 3 && (
                  <button
                    className="icon-button icon-button--small icon-button--danger" type="button" title={text.remove}
                    onClick={() => patch({ sequence: sequence.filter((_, position) => position !== slot) })}
                  ><Icon name="close" size={12} /></button>
                )}
              </div>
            ))}
            <button
              className="button button--ghost" type="button" disabled={sequence.length >= 6}
              onClick={() => patch({ sequence: [...sequence, options[0] ?? ''] })}
            ><Icon name="plus" size={14} />{text.addPosition}</button>
          </div>
        )}
      </EditorSection>

      <EditorSection
        title={`${text.logicOptions} (${options.length}/5)`}
        hint={text.logicOptionsHint}
        actions={
          <button
            className="button button--secondary" type="button" disabled={options.length >= 5}
            onClick={() => patch({ options: [...options, ''] })}
          ><Icon name="plus" size={15} />{text.logicOptions}</button>
        }
      >
        {options.map((option, index) => (
          <EditorCard
            key={index}
            badge={<AssetThumb assetId={option} size={44} />}
            title={option === level.answer
              ? <span className="library-pill library-pill--age">{text.isAnswer}</span>
              : <span dir="ltr">{index + 1}</span>}
            onMoveUp={index > 0 ? () => patch({ options: moveInArray(options, index, -1) }) : undefined}
            onMoveDown={index < options.length - 1 ? () => patch({ options: moveInArray(options, index, 1) }) : undefined}
            removeLabel={text.remove}
            onRemove={() => {
              const next = options.filter((_, position) => position !== index)
              patch({
                options: next,
                // الجواب يجب أن يبقى بين الخيارات: حذف الخيار الصحيح ينقل الجواب
                // إلى أول خيار باقٍ بدل أن يتركه معرّفًا لا وجود له.
                answer: level.answer === option ? next[0] ?? '' : level.answer,
                grid: level.grid?.map((row) => row.map((cell) => (cell === option ? null : cell))),
                sequence: level.sequence?.map((cell) => (cell === option ? null : cell)),
              })
            }}
          >
            <div className="form-grid">
              <AssetField label={text.logicOptions} kind="image" value={option} onChange={(value) => patch({
                options: options.map((entry, position) => (position === index ? value : entry)),
                answer: level.answer === option ? value : level.answer,
              })} required hideThumb />
              <div className="field">
                <span>{text.logicAnswer}</span>
                <label className="checkbox-control">
                  <input
                    type="radio"
                    name={`logic-answer-${level.level}`}
                    checked={level.answer === option && !!option}
                    onChange={() => patch({ answer: option })}
                  />
                  <span>{text.pickAnswer}</span>
                </label>
              </div>
            </div>
          </EditorCard>
        ))}
      </EditorSection>

      <EditorSection title={text.explainOptions} hint={needsExplanation ? text.explanationLocked : text.explainOptionsHint}>
        <label className="checkbox-control">
          <input
            type="checkbox"
            checked={needsExplanation ? true : level.require_explanation === true}
            disabled={needsExplanation}
            onChange={(event) => patch({ require_explanation: event.target.checked })}
          />
          <span>{text.requireExplanation}</span>
        </label>
        {(needsExplanation || level.require_explanation) && (
          <>
            {explainOptions.map((option, index) => (
              <div className="form-grid form-grid--three" key={index}>
                <KeyField
                  label={`${text.explainOptions} ${index + 1}`}
                  value={option}
                  onChange={(value) => patch({
                    explain_options: explainOptions.map((entry, position) => (position === index ? value : entry)),
                    explain_answer: level.explain_answer === option ? value : level.explain_answer,
                  })}
                  required
                />
                <div className="field">
                  <span>{text.explainAnswer}</span>
                  <label className="checkbox-control">
                    <input
                      type="radio"
                      name={`explain-answer-${level.level}`}
                      checked={level.explain_answer === option && !!option}
                      onChange={() => patch({ explain_answer: option })}
                    />
                    <span>{text.pickAnswer}</span>
                  </label>
                </div>
                <div className="field">
                  <span>&nbsp;</span>
                  <button
                    className="button button--ghost" type="button"
                    onClick={() => {
                      const next = explainOptions.filter((_, position) => position !== index)
                      patch({
                        explain_options: next,
                        explain_answer: level.explain_answer === option ? next[0] ?? '' : level.explain_answer,
                      })
                    }}
                  ><Icon name="close" size={14} />{text.remove}</button>
                </div>
              </div>
            ))}
            <button
              className="button button--ghost" type="button" disabled={explainOptions.length >= 5}
              onClick={() => patch({ explain_options: [...explainOptions, level.rule_key && !explainOptions.length ? level.rule_key : ''] })}
            ><Icon name="plus" size={15} />{text.addExplain}</button>
          </>
        )}
      </EditorSection>
    </div>
  )
}

/// عدد الأسئلة في مستوى `count_quantity`، لعرضه في قائمة المستويات.
export function countQuestionCount(level: Record<string, unknown>): number {
  return asRecords(level.items).length
}
