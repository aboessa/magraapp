/**
 * محرّرات المحرّكات الأربعة القائمة على عناصر مرتَّبة أو مصنَّفة:
 * `match_pairs` و`sort_bins` و`memory_flip` و`sequence_order`.
 *
 * ## لماذا مجتمعة في ملف واحد
 *
 * الأربعة تؤلّف الشيء نفسه بنيويًا: قائمة عناصر لكل منها صورة ومفتاح نصّ
 * وتسجيل صوت، وعلاقة بين العناصر (هدف، سلّة، زوج، موضع). فصلها إلى أربعة ملفات
 * يعني أربع نسخ من نفس الحقول الثلاثة، وأول تغيير في شكل معرّف الأصل يصلح ثلاثة
 * منها وينسى الرابع.
 *
 * ## العلاقة تُحرَّر كعلاقة لا كنصّ
 *
 * الخطأ الذي كانت هذه المحرّرات موجودة لإلغائه واحد: في JSON الخام، ربط عنصر
 * بهدفه يعني كتابة `"target": "t2"` بيد المحرّر، ولا شيء يمنع كتابة `t9`. الخادم
 * يرفضها، لكن بعد الحفظ وبرسالة عن معرّف. هنا العلاقة قائمة اختيار من الأهداف
 * الموجودة فعلًا، ومعروضة **بصريًا**: العنصر يظهر تحت هدفه بصورته، فالخطأ يُرى
 * قبل أن يُحفَظ.
 *
 * ## هدف بلا عنصر وسلّة بلا عنصر
 *
 * كلاهما عيب حقيقي لا يمنعه المخطَّط: هدف لا يطابقه شيء لا يمكن إكماله، وسلّة
 * تبقى فارغة إلى نهاية المستوى تبدو للطفل كخطأ منه. يُعرضان كتنبيه صريح في
 * المحرّر وفي مرآة القواعد معًا.
 */

import { Icon } from '../../Icon'
import { usePreferences } from '../../../context/preferences'
import { asRecords, nextId } from '../../../lib/enginePack'
import { AssetField, AssetThumb, EditorCard, EditorSection, KeyField, confirmRemoval, moveInArray } from './fields'
import {
  MATCH_TYPES,
  CRITERION_TYPES,
  PAIR_TYPES,
  SEQUENCE_TYPES,
} from '../../../types/enginePack'
import type {
  MatchDistractor,
  MatchItem,
  MatchPairsLevel,
  MatchTarget,
  MemoryFlipLevel,
  MemoryPair,
  SequenceOrderLevel,
  SequencePanel,
  SortBin,
  SortBinsLevel,
  SortItem,
} from '../../../types/enginePack'

const copy = {
  ar: {
    // مشترك
    image: 'الصورة',
    audio: 'التسجيل الصوتي',
    labelKey: 'مفتاح الاسم',
    add: 'إضافة',
    remove: 'حذف',
    of: 'من',
    // match_pairs
    matchType: 'نوع المطابقة',
    matchTypes: {
      identical: 'متطابق',
      shadow: 'ظِلّ',
      relation: 'علاقة',
      sound_image: 'صوت وصورة',
      part_whole: 'جزء وكلّ',
    } as Record<string, string>,
    prompt: 'مفتاح التوجيه',
    targets: 'الأهداف',
    targetsHint: 'من 2 إلى 3 أهداف. كل هدف يحتاج صورة واسمًا منطوقًا: الاسم المكتوب لا يقرؤه طفل ما قبل القراءة.',
    items: 'العناصر',
    itemsHint: 'من 2 إلى 6 عناصر، ولكل عنصر هدف واحد يُختار من الأهداف الموجودة.',
    distractors: 'المشتّتات',
    distractorsHint: 'حتى 3. تُرسم بنفس أسلوب العناصر الصحيحة تمامًا، وتُنطق كما تُنطق: مشتّت صامت يكشف نفسه.',
    addTarget: 'هدف',
    addItem: 'عنصر',
    addDistractor: 'مشتّت',
    target: 'الهدف',
    board: 'اللوح كما سيراه الطفل',
    boardHint: 'كل عنصر تحت هدفه. عنصر بلا هدف صحيح يظهر في «غير مربوطة».',
    unassigned: 'غير مربوطة',
    emptyTarget: 'هذا الهدف بلا عنصر يطابقه، فلا يمكن إكمال المستوى.',
    shuffle: 'خلط ترتيب العناصر عند العرض',
    // sort_bins
    criterion: 'مفتاح معيار الفرز',
    criterionType: 'نوع المعيار',
    criterionTypes: {
      color: 'لون',
      shape: 'شكل',
      size: 'حجم',
      compound: 'مركّب',
      abstract: 'مجرّد',
    } as Record<string, string>,
    colourWarning: 'المعيار «لون»: العقد يفرض أن تُميَّز السلّة بصورة ونصّ وصوت أيضًا، وإلا خرج طفل لا يميّز الألوان من اللعبة.',
    bins: 'السلال',
    binsHint: 'سلّتان أو ثلاث. كل سلّة تحتاج صورة تُفهم منها وحدها، لا لونًا فقط.',
    sortItems: 'العناصر',
    sortItemsHint: 'من 4 إلى 8 عناصر، ولكل عنصر سلّة صحيحة واحدة.',
    addBin: 'سلّة',
    bin: 'السلّة',
    moveTo: 'انقل إلى',
    emptyBin: 'هذه السلّة بلا عنصر يخصّها، فتبقى فارغة إلى نهاية المستوى.',
    explainOnCorrect: 'شرح سبب الصحّة بعد كل فرز صحيح',
    explainAudio: 'تسجيل الشرح',
    // memory_flip
    grid: 'الشبكة',
    gridWidth: 'أعمدة',
    gridHeight: 'صفوف',
    gridHint: 'كل بعد من 2 إلى 4. عدد البطاقات = الأعمدة × الصفوف، ويجب أن يساوي ضعف عدد الأزواج.',
    cards: 'بطاقة',
    pairs: 'الأزواج',
    pairsHint: 'من 2 إلى 6 أزواج. كل زوج وجهان واسم منطوق.',
    addPair: 'زوج',
    pairType: 'نوع الزوج',
    pairTypes: { identical: 'متماثل', related: 'مترابط' } as Record<string, string>,
    faceA: 'الوجه الأول',
    faceB: 'الوجه الثاني',
    soundKey: 'مفتاح اسم الزوج',
    pairAudio: 'تسجيل الاسم',
    pairExplain: 'تسجيل شرح العلاقة',
    flipDelay: 'مهلة إعادة القلب (ms)',
    flipDelayHint: 'من 800 إلى 2000، ولا تقلّ عن 1400 لما قبل المدرسة: الطفل يحتاج وقتًا لينظر لا ليتذكّر بسرعة.',
    revealHelp: 'كشف زوج بعد عدد محاولات',
    revealHelpHint: 'من 6 إلى 20. يحدث بهدوء بلا تعليق: لا خطأ في هذه اللعبة.',
    celebrate: 'احتفال صغير عند كل زوج',
    gridMismatch: (cards: number, pairs: number) => `الشبكة ${cards} بطاقة والأزواج ${pairs} (${pairs * 2} بطاقة).`,
    fixGrid: 'اضبط الشبكة على عدد الأزواج',
    noPairsYet: 'لا أزواج بعد.',
    cardPreview: 'الشبكة كما ستُوزَّع',
    // sequence_order
    sequenceType: 'نوع التسلسل',
    sequenceTypes: {
      story: 'قصّة',
      process: 'عمليّة',
      procedure: 'إجراء',
      cause_effect: 'سبب ونتيجة',
    } as Record<string, string>,
    panels: 'اللوحات',
    panelsHint: 'من 3 إلى 6 لوحات. الترتيب يجب أن يُفهم من الصورة وحدها بلا نصّ.',
    addPanel: 'لوحة',
    caption: 'مفتاح التعليق',
    position: 'الموضع',
    strip: 'الشريط بترتيب اللوحات',
    stripHint: 'الاتجاه يتبع اتجاه القراءة، فيُعكس في العربية تلقائيًا في التطبيق.',
    acceptedOrders: 'الترتيبات المقبولة',
    acceptedOrdersHint: 'ترتيب واحد على الأقل وثلاثة كحدّ أقصى. بعض التسلسلات لها أكثر من ترتيب صحيح منطقيًا، وقبول واحد فقط يعاقب الطفل على إجابة صحيحة.',
    addOrder: 'ترتيب مقبول',
    useCurrent: 'خُذ الترتيب الحالي',
    order: 'الترتيب',
    narrate: 'سرد التسلسل كاملًا بعد إتمامه',
    noOrders: 'لا ترتيب مقبول: لا شيء يمكن للطفل أن يحقّقه.',
  },
  en: {
    image: 'Image',
    audio: 'Audio recording',
    labelKey: 'Label key',
    add: 'Add',
    remove: 'Delete',
    of: 'of',
    matchType: 'Match type',
    matchTypes: {
      identical: 'Identical',
      shadow: 'Shadow',
      relation: 'Relation',
      sound_image: 'Sound and image',
      part_whole: 'Part and whole',
    } as Record<string, string>,
    prompt: 'Prompt key',
    targets: 'Targets',
    targetsHint: '2 or 3 targets. Each needs an image and a spoken name: a written name is unreadable to a pre-reading child.',
    items: 'Items',
    itemsHint: '2 to 6 items, each pointing at one of the targets that exist.',
    distractors: 'Distractors',
    distractorsHint: 'Up to 3. Drawn in exactly the style of the real items and spoken like them: a silent distractor gives itself away.',
    addTarget: 'Target',
    addItem: 'Item',
    addDistractor: 'Distractor',
    target: 'Target',
    board: 'The board as the child sees it',
    boardHint: 'Each item sits under its target. An item with no valid target appears under "Unassigned".',
    unassigned: 'Unassigned',
    emptyTarget: 'This target has no matching item, so the level cannot be completed.',
    shuffle: 'Shuffle the item order on screen',
    criterion: 'Sorting criterion key',
    criterionType: 'Criterion type',
    criterionTypes: {
      color: 'Colour',
      shape: 'Shape',
      size: 'Size',
      compound: 'Compound',
      abstract: 'Abstract',
    } as Record<string, string>,
    colourWarning: 'Criterion "colour": the contract requires the bin to be distinguished by image, text and sound as well, or a colour-blind child is excluded.',
    bins: 'Bins',
    binsHint: 'Two or three bins. Each needs an image that explains itself, not just a colour.',
    sortItems: 'Items',
    sortItemsHint: '4 to 8 items, each with exactly one correct bin.',
    addBin: 'Bin',
    bin: 'Bin',
    moveTo: 'Move to',
    emptyBin: 'This bin has no items of its own and stays empty for the whole level.',
    explainOnCorrect: 'Explain why each correct sort is correct',
    explainAudio: 'Explanation recording',
    grid: 'Grid',
    gridWidth: 'Columns',
    gridHeight: 'Rows',
    gridHint: 'Each side 2 to 4. Cards = columns × rows, and must equal twice the number of pairs.',
    cards: 'cards',
    pairs: 'Pairs',
    pairsHint: '2 to 6 pairs. Each pair has two faces and a spoken name.',
    addPair: 'Pair',
    pairType: 'Pair type',
    pairTypes: { identical: 'Identical', related: 'Related' } as Record<string, string>,
    faceA: 'First face',
    faceB: 'Second face',
    soundKey: 'Pair name key',
    pairAudio: 'Name recording',
    pairExplain: 'Relation explanation recording',
    flipDelay: 'Flip-back delay (ms)',
    flipDelayHint: '800 to 2000, and never below 1400 for preschool: the child needs time to look, not to remember quickly.',
    revealHelp: 'Reveal a pair after this many misses',
    revealHelpHint: '6 to 20. It happens quietly with no comment: there is no "wrong" in this game.',
    celebrate: 'Small celebration on every pair',
    gridMismatch: (cards: number, pairs: number) => `The grid holds ${cards} cards and there are ${pairs} pair(s) (${pairs * 2} cards).`,
    fixGrid: 'Fit the grid to the pairs',
    noPairsYet: 'No pairs yet.',
    cardPreview: 'How the grid will be dealt',
    sequenceType: 'Sequence type',
    sequenceTypes: {
      story: 'Story',
      process: 'Process',
      procedure: 'Procedure',
      cause_effect: 'Cause and effect',
    } as Record<string, string>,
    panels: 'Panels',
    panelsHint: '3 to 6 panels. The order must be readable from the picture alone, with no text.',
    addPanel: 'Panel',
    caption: 'Caption key',
    position: 'Position',
    strip: 'The strip in panel order',
    stripHint: 'The direction follows reading order, so the app mirrors it in Arabic automatically.',
    acceptedOrders: 'Accepted orders',
    acceptedOrdersHint: 'At least one order and at most three. Some sequences have more than one logically correct order, and accepting only one punishes a correct answer.',
    addOrder: 'Accepted order',
    useCurrent: 'Take the current order',
    order: 'Order',
    narrate: 'Narrate the whole sequence once complete',
    noOrders: 'No accepted order: there is nothing the child can achieve.',
  },
}

// ---------------------------------------------------------------------------
// match_pairs
// ---------------------------------------------------------------------------

export function MatchPairsEditor({ level, onChange }: { level: MatchPairsLevel; onChange: (level: MatchPairsLevel) => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const targets = level.targets ?? []
  const items = level.items ?? []
  const distractors = level.distractors ?? []

  const patch = (next: Partial<MatchPairsLevel>) => onChange({ ...level, ...next })
  const keyFor = (kind: string, id: string) => `game.match_pairs.level_${level.level}.${kind}_${id}`

  function addTarget() {
    const id = nextId(targets.map((target) => target.id), 't')
    patch({ targets: [...targets, { id, image: '', label_key: keyFor('target', id), audio: '' }] })
  }

  function addItem(targetId?: string) {
    const id = nextId(items.map((item) => item.id), 'i')
    patch({
      items: [...items, {
        id,
        image: '',
        // العنصر الجديد يُربط بأوّل هدف موجود لا بنصّ فارغ: عنصر بلا هدف يُرفض
        // من الخادم، والقيمة الافتراضية الصحيحة أقلّ كلفة من رسالة رفض.
        target: targetId ?? targets[0]?.id ?? '',
        label_key: keyFor('item', id),
        audio: '',
      }],
    })
  }

  function addDistractor() {
    const id = nextId(distractors.map((entry) => entry.id), 'd')
    patch({ distractors: [...distractors, { id, image: '', label_key: keyFor('distractor', id), audio: '' }] })
  }

  const patchTarget = (index: number, next: Partial<MatchTarget>) =>
    patch({ targets: targets.map((entry, position) => (position === index ? { ...entry, ...next } : entry)) })
  const patchItem = (index: number, next: Partial<MatchItem>) =>
    patch({ items: items.map((entry, position) => (position === index ? { ...entry, ...next } : entry)) })
  const patchDistractor = (index: number, next: Partial<MatchDistractor>) =>
    patch({ distractors: distractors.map((entry, position) => (position === index ? { ...entry, ...next } : entry)) })

  const targetIds = new Set(targets.map((target) => target.id))
  const unassigned = items.filter((item) => !targetIds.has(item.target))

  return (
    <div className="engine-editor">
      <div className="form-grid form-grid--three">
        <label className="field">
          <span>{text.matchType}</span>
          <select value={level.match_type ?? 'identical'} onChange={(event) => patch({ match_type: event.target.value as MatchPairsLevel['match_type'] })}>
            {MATCH_TYPES.map((value) => <option value={value} key={value}>{text.matchTypes[value]}</option>)}
          </select>
        </label>
        <KeyField
          label={text.prompt}
          value={level.prompt_key}
          onChange={(value) => patch({ prompt_key: value })}
          required
          suggest={`game.match_pairs.level_${level.level}.prompt`}
        />
        <label className="checkbox-control">
          <input type="checkbox" checked={level.shuffle !== false} onChange={(event) => patch({ shuffle: event.target.checked })} />
          <span>{text.shuffle}</span>
        </label>
      </div>

      <EditorSection title={text.board} hint={text.boardHint}>
        <div className="engine-board">
          {targets.map((target) => {
            const mine = items.filter((item) => item.target === target.id)
            return (
              <div className={mine.length ? 'engine-board__column' : 'engine-board__column engine-board__column--empty'} key={target.id}>
                <header>
                  <AssetThumb assetId={target.image} size={52} />
                  <code dir="ltr">{target.id}</code>
                </header>
                {mine.length === 0
                  ? <p className="engine-board__warn">{text.emptyTarget}</p>
                  : (
                    <ul>
                      {mine.map((item) => (
                        <li key={item.id}>
                          <AssetThumb assetId={item.image} size={38} />
                          <code dir="ltr">{item.id}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                <button className="button button--ghost" type="button" onClick={() => addItem(target.id)}>
                  <Icon name="plus" size={14} />{text.addItem}
                </button>
              </div>
            )
          })}
          {unassigned.length > 0 && (
            <div className="engine-board__column engine-board__column--empty">
              <header><strong>{text.unassigned}</strong></header>
              <ul>
                {unassigned.map((item) => (
                  <li key={item.id}><AssetThumb assetId={item.image} size={38} /><code dir="ltr">{item.id}</code></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </EditorSection>

      <EditorSection
        title={`${text.targets} (${targets.length}/3)`}
        hint={text.targetsHint}
        actions={<button className="button button--secondary" type="button" onClick={addTarget} disabled={targets.length >= 3}><Icon name="plus" size={15} />{text.addTarget}</button>}
      >
        {targets.map((target, index) => (
          <EditorCard
            key={target.id}
            badge={<AssetThumb assetId={target.image} size={40} />}
            title={<code dir="ltr">{target.id}</code>}
            onMoveUp={index > 0 ? () => patch({ targets: moveInArray(targets, index, -1) }) : undefined}
            onMoveDown={index < targets.length - 1 ? () => patch({ targets: moveInArray(targets, index, 1) }) : undefined}
            removeLabel={text.remove}
            onRemove={() => {
              if (!confirmRemoval(locale, `${text.addTarget} ${target.id}`)) return
              patch({ targets: targets.filter((_, position) => position !== index) })
            }}
          >
            <div className="form-grid">
              <AssetField label={text.image} kind="image" value={target.image} onChange={(value) => patchTarget(index, { image: value })} required />
              <AssetField label={text.audio} kind="audio" value={target.audio} onChange={(value) => patchTarget(index, { audio: value })} required />
              <KeyField label={text.labelKey} value={target.label_key} onChange={(value) => patchTarget(index, { label_key: value })} required suggest={keyFor('target', target.id)} />
            </div>
          </EditorCard>
        ))}
      </EditorSection>

      <EditorSection
        title={`${text.items} (${items.length}/6)`}
        hint={text.itemsHint}
        actions={<button className="button button--secondary" type="button" onClick={() => addItem()} disabled={items.length >= 6}><Icon name="plus" size={15} />{text.addItem}</button>}
      >
        {items.map((item, index) => (
          <EditorCard
            key={item.id}
            badge={<AssetThumb assetId={item.image} size={40} />}
            title={<code dir="ltr">{item.id}</code>}
            tone={targetIds.has(item.target) ? 'default' : 'warn'}
            onMoveUp={index > 0 ? () => patch({ items: moveInArray(items, index, -1) }) : undefined}
            onMoveDown={index < items.length - 1 ? () => patch({ items: moveInArray(items, index, 1) }) : undefined}
            removeLabel={text.remove}
            onRemove={() => {
              if (!confirmRemoval(locale, `${text.addItem} ${item.id}`)) return
              patch({ items: items.filter((_, position) => position !== index) })
            }}
          >
            <div className="form-grid">
              <AssetField label={text.image} kind="image" value={item.image} onChange={(value) => patchItem(index, { image: value })} required />
              <AssetField label={text.audio} kind="audio" value={item.audio} onChange={(value) => patchItem(index, { audio: value })} required />
              <KeyField label={text.labelKey} value={item.label_key} onChange={(value) => patchItem(index, { label_key: value })} required suggest={keyFor('item', item.id)} />
              <label className="field">
                <span>{text.target}</span>
                <select value={item.target ?? ''} onChange={(event) => patchItem(index, { target: event.target.value })}>
                  <option value="">—</option>
                  {targets.map((target) => <option value={target.id} key={target.id}>{target.id}</option>)}
                </select>
              </label>
            </div>
          </EditorCard>
        ))}
      </EditorSection>

      <EditorSection
        title={`${text.distractors} (${distractors.length}/3)`}
        hint={text.distractorsHint}
        actions={<button className="button button--ghost" type="button" onClick={addDistractor} disabled={distractors.length >= 3}><Icon name="plus" size={15} />{text.addDistractor}</button>}
      >
        {distractors.map((entry, index) => (
          <EditorCard
            key={entry.id}
            badge={<AssetThumb assetId={entry.image} size={40} />}
            title={<code dir="ltr">{entry.id}</code>}
            removeLabel={text.remove}
            onRemove={() => {
              if (!confirmRemoval(locale, `${text.addDistractor} ${entry.id}`)) return
              patch({ distractors: distractors.filter((_, position) => position !== index) })
            }}
          >
            <div className="form-grid">
              <AssetField label={text.image} kind="image" value={entry.image} onChange={(value) => patchDistractor(index, { image: value })} required />
              <AssetField label={text.audio} kind="audio" value={entry.audio} onChange={(value) => patchDistractor(index, { audio: value })} required />
              <KeyField label={text.labelKey} value={entry.label_key} onChange={(value) => patchDistractor(index, { label_key: value })} required suggest={keyFor('distractor', entry.id)} />
            </div>
          </EditorCard>
        ))}
      </EditorSection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// sort_bins
// ---------------------------------------------------------------------------

export function SortBinsEditor({ level, onChange }: { level: SortBinsLevel; onChange: (level: SortBinsLevel) => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const bins = level.bins ?? []
  const items = level.items ?? []

  const patch = (next: Partial<SortBinsLevel>) => onChange({ ...level, ...next })
  const keyFor = (kind: string, id: string) => `game.sort_bins.level_${level.level}.${kind}_${id}`

  function addBin() {
    const id = nextId(bins.map((bin) => bin.id), 'b')
    patch({ bins: [...bins, { id, label_key: keyFor('bin', id), image: '', audio: '' }] })
  }

  function addItem(binId?: string) {
    const id = nextId(items.map((item) => item.id), 'i')
    patch({
      items: [...items, {
        id, image: '', bin: binId ?? bins[0]?.id ?? '', label_key: keyFor('item', id), audio: '',
      }],
    })
  }

  const patchBin = (index: number, next: Partial<SortBin>) =>
    patch({ bins: bins.map((entry, position) => (position === index ? { ...entry, ...next } : entry)) })
  const patchItem = (index: number, next: Partial<SortItem>) =>
    patch({ items: items.map((entry, position) => (position === index ? { ...entry, ...next } : entry)) })

  const binIds = new Set(bins.map((bin) => bin.id))
  const unassigned = items.filter((item) => !binIds.has(item.bin))

  return (
    <div className="engine-editor">
      <div className="form-grid form-grid--three">
        <KeyField label={text.criterion} value={level.criterion_key} onChange={(value) => patch({ criterion_key: value })} required suggest={`game.sort_bins.level_${level.level}.criterion`} />
        <label className="field">
          <span>{text.criterionType}</span>
          <select value={level.criterion_type ?? 'shape'} onChange={(event) => patch({ criterion_type: event.target.value as SortBinsLevel['criterion_type'] })}>
            {CRITERION_TYPES.map((value) => <option value={value} key={value}>{text.criterionTypes[value]}</option>)}
          </select>
        </label>
        <label className="checkbox-control">
          <input type="checkbox" checked={level.shuffle !== false} onChange={(event) => patch({ shuffle: event.target.checked })} />
          <span>{locale === 'ar' ? 'خلط ترتيب العناصر' : 'Shuffle item order'}</span>
        </label>
      </div>
      {level.criterion_type === 'color' && <p className="inline-alert inline-alert--info">{text.colourWarning}</p>}

      <label className="checkbox-control">
        <input type="checkbox" checked={level.explain_on_correct === true} onChange={(event) => patch({ explain_on_correct: event.target.checked })} />
        <span>{text.explainOnCorrect}</span>
      </label>

      <EditorSection
        title={`${text.bins} (${bins.length}/3)`}
        hint={text.binsHint}
        actions={<button className="button button--secondary" type="button" onClick={addBin} disabled={bins.length >= 3}><Icon name="plus" size={15} />{text.addBin}</button>}
      >
        {/* الفرز يُحرَّر كفرز: كل سلّة عمود، وعناصرها داخلها بصورها، ونقل عنصر
            زرٌّ في بطاقته لا كتابة معرّف سلّة. */}
        <div className="engine-board">
          {bins.map((bin) => {
            const mine = items.filter((item) => item.bin === bin.id)
            return (
              <div className={mine.length ? 'engine-board__column' : 'engine-board__column engine-board__column--empty'} key={bin.id}>
                <header><AssetThumb assetId={bin.image} size={52} /><code dir="ltr">{bin.id}</code></header>
                {mine.length === 0 ? <p className="engine-board__warn">{text.emptyBin}</p> : (
                  <ul>
                    {mine.map((item) => (
                      <li key={item.id}><AssetThumb assetId={item.image} size={38} /><code dir="ltr">{item.id}</code></li>
                    ))}
                  </ul>
                )}
                <button className="button button--ghost" type="button" onClick={() => addItem(bin.id)}>
                  <Icon name="plus" size={14} />{locale === 'ar' ? 'عنصر' : 'Item'}
                </button>
              </div>
            )
          })}
          {unassigned.length > 0 && (
            <div className="engine-board__column engine-board__column--empty">
              <header><strong>{text.unassigned ?? ''}</strong></header>
              <ul>{unassigned.map((item) => <li key={item.id}><AssetThumb assetId={item.image} size={38} /><code dir="ltr">{item.id}</code></li>)}</ul>
            </div>
          )}
        </div>

        {bins.map((bin, index) => (
          <EditorCard
            key={bin.id}
            badge={<AssetThumb assetId={bin.image} size={40} />}
            title={<code dir="ltr">{bin.id}</code>}
            onMoveUp={index > 0 ? () => patch({ bins: moveInArray(bins, index, -1) }) : undefined}
            onMoveDown={index < bins.length - 1 ? () => patch({ bins: moveInArray(bins, index, 1) }) : undefined}
            removeLabel={text.remove}
            onRemove={() => {
              if (!confirmRemoval(locale, `${text.addBin} ${bin.id}`)) return
              patch({ bins: bins.filter((_, position) => position !== index) })
            }}
          >
            <div className="form-grid">
              <AssetField label={text.image} kind="image" value={bin.image} onChange={(value) => patchBin(index, { image: value })} required />
              <AssetField label={text.audio} kind="audio" value={bin.audio} onChange={(value) => patchBin(index, { audio: value })} required />
              <KeyField label={text.labelKey} value={bin.label_key} onChange={(value) => patchBin(index, { label_key: value })} required suggest={keyFor('bin', bin.id)} />
            </div>
          </EditorCard>
        ))}
      </EditorSection>

      <EditorSection
        title={`${text.sortItems} (${items.length}/8)`}
        hint={text.sortItemsHint}
        actions={<button className="button button--secondary" type="button" onClick={() => addItem()} disabled={items.length >= 8}><Icon name="plus" size={15} />{locale === 'ar' ? 'عنصر' : 'Item'}</button>}
      >
        {items.map((item, index) => (
          <EditorCard
            key={item.id}
            badge={<AssetThumb assetId={item.image} size={40} />}
            title={<code dir="ltr">{item.id}</code>}
            tone={binIds.has(item.bin) ? 'default' : 'warn'}
            removeLabel={text.remove}
            onRemove={() => {
              if (!confirmRemoval(locale, `${item.id}`)) return
              patch({ items: items.filter((_, position) => position !== index) })
            }}
          >
            <div className="form-grid">
              <AssetField label={text.image} kind="image" value={item.image} onChange={(value) => patchItem(index, { image: value })} required />
              <AssetField label={text.audio} kind="audio" value={item.audio} onChange={(value) => patchItem(index, { audio: value })} required />
              <KeyField label={text.labelKey} value={item.label_key} onChange={(value) => patchItem(index, { label_key: value })} required suggest={keyFor('item', item.id)} />
              <label className="field">
                <span>{text.bin}</span>
                <select value={item.bin ?? ''} onChange={(event) => patchItem(index, { bin: event.target.value })}>
                  <option value="">—</option>
                  {bins.map((bin) => <option value={bin.id} key={bin.id}>{bin.id}</option>)}
                </select>
              </label>
              {level.explain_on_correct && (
                <AssetField label={text.explainAudio} kind="audio" value={item.explain_audio} onChange={(value) => patchItem(index, { explain_audio: value || undefined })} />
              )}
            </div>
          </EditorCard>
        ))}
      </EditorSection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// memory_flip
// ---------------------------------------------------------------------------

/// أبعاد شبكة تُنتج عدد البطاقات المطلوب، أو null إن لم يوجد.
///
/// المخطَّط يقيّد كل بعد بـ2..4، فليس كل عدد أزواج قابلًا للتوزيع: خمسة أزواج
/// (عشر بطاقات) لا تُرتَّب في شبكة أبعادها بين 2 و4. عرض ذلك صراحةً أفضل من
/// اقتراح شبكة لا يقبلها الخادم.
function gridForPairs(pairCount: number): [number, number] | null {
  const cards = pairCount * 2
  for (let width = 2; width <= 4; width += 1) {
    for (let height = 2; height <= 4; height += 1) {
      if (width * height === cards) return [width, height]
    }
  }
  return null
}

export function MemoryFlipEditor({ level, onChange, ageMax }: {
  level: MemoryFlipLevel
  onChange: (level: MemoryFlipLevel) => void
  ageMax?: number
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const pairs = level.pairs ?? []
  const grid = level.grid ?? [2, 2]
  const width = Number(grid[0]) || 2
  const height = Number(grid[1]) || 2
  const cards = width * height
  const patch = (next: Partial<MemoryFlipLevel>) => onChange({ ...level, ...next })
  const suggestion = gridForPairs(pairs.length)

  function addPair() {
    patch({
      pairs: [...pairs, {
        a: '', b: '',
        sound_key: `game.memory_flip.level_${level.level}.pair_${pairs.length + 1}`,
      }],
    })
  }

  const patchPair = (index: number, next: Partial<MemoryPair>) =>
    patch({ pairs: pairs.map((entry, position) => (position === index ? { ...entry, ...next } : entry)) })

  /// وجوه البطاقات كما ستُوزَّع: وجهان لكل زوج، ثم خلايا فارغة إن كانت الشبكة
  /// أكبر. المعروض ليس ترتيب اللعب — الخلط وقت التشغيل — بل عدد البطاقات مقابل
  /// عدد الخلايا، وهو ما يخطئ فيه التأليف.
  const faces: Array<{ assetId: string; label: string } | null> = []
  for (const [index, pair] of pairs.entries()) {
    faces.push({ assetId: pair.a, label: `${index + 1}a` })
    faces.push({ assetId: pair.b, label: `${index + 1}b` })
  }
  while (faces.length < cards) faces.push(null)

  return (
    <div className="engine-editor">
      <div className="form-grid form-grid--three">
        <label className="field">
          <span>{text.pairType}</span>
          <select value={level.pair_type ?? 'identical'} onChange={(event) => patch({ pair_type: event.target.value as MemoryFlipLevel['pair_type'] })}>
            {PAIR_TYPES.map((value) => <option value={value} key={value}>{text.pairTypes[value]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{text.gridWidth}</span>
          <select value={width} onChange={(event) => patch({ grid: [Number(event.target.value), height] })}>
            {[2, 3, 4].map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{text.gridHeight}</span>
          <select value={height} onChange={(event) => patch({ grid: [width, Number(event.target.value)] })}>
            {[2, 3, 4].map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
          <small>{text.gridHint}</small>
        </label>
      </div>

      <div className="form-grid form-grid--three">
        <label className="field">
          <span>{text.flipDelay}</span>
          <input
            type="number" dir="ltr" min="800" max="2000" step="100"
            value={level.flip_back_delay_ms ?? 1400}
            onChange={(event) => patch({ flip_back_delay_ms: Number(event.target.value) })}
          />
          <small>{text.flipDelayHint}</small>
        </label>
        <label className="field">
          <span>{text.revealHelp}</span>
          <input
            type="number" dir="ltr" min="6" max="20"
            value={level.reveal_help_after_misses ?? ''}
            onChange={(event) => patch({ reveal_help_after_misses: event.target.value ? Number(event.target.value) : undefined })}
          />
          <small>{text.revealHelpHint}</small>
        </label>
        <label className="checkbox-control">
          <input type="checkbox" checked={level.celebrate_each_pair !== false} onChange={(event) => patch({ celebrate_each_pair: event.target.checked })} />
          <span>{text.celebrate}</span>
        </label>
      </div>

      {ageMax !== undefined && ageMax <= 5 && (level.flip_back_delay_ms ?? 0) < 1400 && (
        <p className="inline-alert inline-alert--error">{text.flipDelayHint}</p>
      )}

      <EditorSection title={text.cardPreview} hint={`${cards} ${text.cards} · ${pairs.length} × 2`}>
        {cards !== pairs.length * 2 && (
          <div className="inline-alert inline-alert--error">
            <p>{text.gridMismatch(cards, pairs.length)}</p>
            {suggestion && (
              <button className="button button--secondary" type="button" onClick={() => patch({ grid: suggestion })}>
                {text.fixGrid} ({suggestion[0]}×{suggestion[1]})
              </button>
            )}
          </div>
        )}
        <div className="engine-grid" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}>
          {faces.slice(0, Math.max(cards, faces.length)).map((face, index) => (
            <div className={face ? 'engine-grid__cell' : 'engine-grid__cell engine-grid__cell--empty'} key={index}>
              {face ? <><AssetThumb assetId={face.assetId} size={48} /><small dir="ltr">{face.label}</small></> : <small>—</small>}
            </div>
          ))}
        </div>
      </EditorSection>

      <EditorSection
        title={`${text.pairs} (${pairs.length}/6)`}
        hint={text.pairsHint}
        actions={<button className="button button--secondary" type="button" onClick={addPair} disabled={pairs.length >= 6}><Icon name="plus" size={15} />{text.addPair}</button>}
      >
        {!pairs.length && <p className="data-unavailable">{text.noPairsYet}</p>}
        {pairs.map((pair, index) => (
          <EditorCard
            key={`${pair.a}-${pair.b}-${index}`}
            badge={<><AssetThumb assetId={pair.a} size={40} /><AssetThumb assetId={pair.b} size={40} /></>}
            title={<span dir="ltr">{index + 1}</span>}
            onMoveUp={index > 0 ? () => patch({ pairs: moveInArray(pairs, index, -1) }) : undefined}
            onMoveDown={index < pairs.length - 1 ? () => patch({ pairs: moveInArray(pairs, index, 1) }) : undefined}
            removeLabel={text.remove}
            onRemove={() => {
              if (!confirmRemoval(locale, `${text.addPair} ${index + 1}`)) return
              patch({ pairs: pairs.filter((_, position) => position !== index) })
            }}
          >
            <div className="form-grid">
              <AssetField label={text.faceA} kind="image" value={pair.a} onChange={(value) => patchPair(index, { a: value })} required />
              <AssetField
                label={text.faceB}
                kind="image"
                value={pair.b}
                onChange={(value) => patchPair(index, { b: value })}
                required
                hint={level.pair_type === 'identical'
                  ? (locale === 'ar' ? 'الزوج المتماثل يستخدم الصورة نفسها في الوجهين.' : 'An identical pair uses the same image on both faces.')
                  : undefined}
              />
              <KeyField label={text.soundKey} value={pair.sound_key} onChange={(value) => patchPair(index, { sound_key: value })} required suggest={`game.memory_flip.level_${level.level}.pair_${index + 1}`} />
              <AssetField label={text.pairAudio} kind="audio" value={pair.audio} onChange={(value) => patchPair(index, { audio: value || undefined })} />
              {level.pair_type === 'related' && (
                <AssetField label={text.pairExplain} kind="audio" value={pair.explain_audio} onChange={(value) => patchPair(index, { explain_audio: value || undefined })} required />
              )}
            </div>
            {level.pair_type === 'identical' && pair.a && pair.b !== pair.a && (
              <button className="button button--ghost" type="button" onClick={() => patchPair(index, { b: pair.a })}>
                {locale === 'ar' ? 'اجعل الوجهين متماثلين' : 'Make both faces identical'}
              </button>
            )}
          </EditorCard>
        ))}
      </EditorSection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// sequence_order
// ---------------------------------------------------------------------------

export function SequenceOrderEditor({ level, onChange }: { level: SequenceOrderLevel; onChange: (level: SequenceOrderLevel) => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const panels = level.panels ?? []
  const orders = level.accepted_orders ?? []
  const patch = (next: Partial<SequenceOrderLevel>) => onChange({ ...level, ...next })

  /// إعادة الترقيم 1..n بعد كل تغيير: `position` هو ما يقرؤه المحرّك، وفراغ فيه
  /// يعني لوحة لا يمكن الوصول إليها.
  const renumber = (list: SequencePanel[]) => list.map((panel, index) => ({ ...panel, position: index + 1 }))

  function addPanel() {
    const id = nextId(panels.map((panel) => panel.id), 'p')
    patch({
      panels: renumber([...panels, {
        id, image: '', position: panels.length + 1,
        caption_key: `game.sequence_order.level_${level.level}.panel_${id}`, audio: '',
      }]),
    })
  }

  const patchPanel = (index: number, next: Partial<SequencePanel>) =>
    patch({ panels: panels.map((entry, position) => (position === index ? { ...entry, ...next } : entry)) })

  const ordered = [...panels].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const currentOrder = ordered.map((panel) => panel.id)

  return (
    <div className="engine-editor">
      <div className="form-grid form-grid--three">
        <label className="field">
          <span>{text.sequenceType}</span>
          <select value={level.sequence_type ?? 'story'} onChange={(event) => patch({ sequence_type: event.target.value as SequenceOrderLevel['sequence_type'] })}>
            {SEQUENCE_TYPES.map((value) => <option value={value} key={value}>{text.sequenceTypes[value]}</option>)}
          </select>
        </label>
        <KeyField label={text.prompt} value={level.prompt_key} onChange={(value) => patch({ prompt_key: value })} required suggest={`game.sequence_order.level_${level.level}.prompt`} />
        <label className="checkbox-control">
          <input type="checkbox" checked={level.narrate_on_complete !== false} onChange={(event) => patch({ narrate_on_complete: event.target.checked })} />
          <span>{text.narrate}</span>
        </label>
      </div>

      <EditorSection title={text.strip} hint={text.stripHint}>
        <ol className="engine-strip">
          {ordered.map((panel) => (
            <li key={panel.id}>
              <span className="engine-strip__index">{panel.position}</span>
              <AssetThumb assetId={panel.image} size={64} />
              <code dir="ltr">{panel.id}</code>
            </li>
          ))}
          {!ordered.length && <li className="data-unavailable">—</li>}
        </ol>
      </EditorSection>

      <EditorSection
        title={`${text.panels} (${panels.length}/6)`}
        hint={text.panelsHint}
        actions={<button className="button button--secondary" type="button" onClick={addPanel} disabled={panels.length >= 6}><Icon name="plus" size={15} />{text.addPanel}</button>}
      >
        {panels.map((panel, index) => (
          <EditorCard
            key={panel.id}
            badge={<AssetThumb assetId={panel.image} size={44} />}
            title={<><span className="engine-strip__index">{panel.position}</span><code dir="ltr">{panel.id}</code></>}
            onMoveUp={index > 0 ? () => patch({ panels: renumber(moveInArray(panels, index, -1)) }) : undefined}
            onMoveDown={index < panels.length - 1 ? () => patch({ panels: renumber(moveInArray(panels, index, 1)) }) : undefined}
            removeLabel={text.remove}
            onRemove={() => {
              if (!confirmRemoval(locale, `${text.addPanel} ${panel.id}`)) return
              const remaining = panels.filter((_, position) => position !== index)
              patch({
                panels: renumber(remaining),
                // الترتيبات المقبولة تُنقّى من اللوحة المحذوفة: ترتيب يذكر لوحة
                // غير موجودة يرفضه الخادم، وتركه للمحرّر ليكتشفه لاحقًا سهو.
                accepted_orders: orders
                  .map((order) => order.filter((id) => id !== panel.id))
                  .filter((order) => order.length > 0),
              })
            }}
          >
            <div className="form-grid">
              <AssetField label={text.image} kind="image" value={panel.image} onChange={(value) => patchPanel(index, { image: value })} required />
              <AssetField label={text.audio} kind="audio" value={panel.audio} onChange={(value) => patchPanel(index, { audio: value })} required />
              <KeyField label={text.caption} value={panel.caption_key} onChange={(value) => patchPanel(index, { caption_key: value })} required suggest={`game.sequence_order.level_${level.level}.panel_${panel.id}`} />
            </div>
          </EditorCard>
        ))}
      </EditorSection>

      <EditorSection
        title={`${text.acceptedOrders} (${orders.length}/3)`}
        hint={text.acceptedOrdersHint}
        actions={
          <button
            className="button button--secondary"
            type="button"
            disabled={orders.length >= 3 || !currentOrder.length}
            onClick={() => patch({ accepted_orders: [...orders, currentOrder] })}
          ><Icon name="plus" size={15} />{text.useCurrent}</button>
        }
      >
        {!orders.length && <p className="inline-alert inline-alert--error">{text.noOrders}</p>}
        {orders.map((order, orderIndex) => (
          <EditorCard
            key={orderIndex}
            title={<>{text.order} {orderIndex + 1}</>}
            removeLabel={text.remove}
            onRemove={() => patch({ accepted_orders: orders.filter((_, position) => position !== orderIndex) })}
          >
            <ol className="engine-strip engine-strip--compact">
              {order.map((id, slot) => (
                <li key={`${id}-${slot}`}>
                  <span className="engine-strip__index">{slot + 1}</span>
                  <AssetThumb assetId={panels.find((panel) => panel.id === id)?.image} size={44} />
                  <select
                    aria-label={`${text.order} ${orderIndex + 1} · ${slot + 1}`}
                    value={id}
                    onChange={(event) => patch({
                      accepted_orders: orders.map((entry, position) => (
                        position === orderIndex
                          ? entry.map((value, index) => (index === slot ? event.target.value : value))
                          : entry
                      )),
                    })}
                  >
                    {panels.map((panel) => <option value={panel.id} key={panel.id}>{panel.id}</option>)}
                  </select>
                </li>
              ))}
            </ol>
          </EditorCard>
        ))}
      </EditorSection>
    </div>
  )
}

/// يُستخدم في نموذج الحزمة لعرض عدد العناصر في مستوى بلا معرفة بنوع المحرّك.
export function levelElementCount(level: Record<string, unknown>): number {
  return ['items', 'pairs', 'panels', 'events', 'letters', 'targets', 'variables', 'notes']
    .reduce((total, key) => total + asRecords(level[key]).length, 0)
}
