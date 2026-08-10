/**
 * معاينة مستوى لكل محرّك، مرسومة من الحزمة المخزَّنة نفسها.
 *
 * ## نموذج واحد لا نموذجان
 *
 * `GET /admin/games/:id/preview` يُعيد `content_pack` **كما هو مخزَّن**، وهذه
 * الشاشة ترسم منه مباشرة. نموذج معاينة ثانٍ «أجمل»، أو بيانات تجريبية مكتوبة في
 * الواجهة، كان سينحرف عن الحزمة ثم يَكذب على المحرّر بشأن ما سيراه الطفل — وهو
 * أسوأ من عدم وجود معاينة، لأن الكذب يُعتمد عليه.
 *
 * ## ما تعرضه وما لا تعرضه
 *
 * ليست محاكاة للمحرّك: لا حساب دقّة ولا مؤقّت ولا منطق لعب. تعرض **البيانات
 * التي سيقرؤها المحرّك** بالشكل الذي ستُعرض به: الصور الفعلية، والعناصر بعددها
 * الحقيقي، والخيار الصحيح معلَّمًا، والنصّ المُحلّ للغة المختارة.
 *
 * ## المفتاح غير المترجم يُعرض مفتاحًا
 *
 * حين لا توجد ترجمة للمفتاح في اللغة المختارة، يُعرض المفتاح نفسه بعلامة صريحة.
 * هذا بالضبط ما سيراه الطفل، وإخفاؤه بنصّ عربي افتراضي يجعل ترجمةً ناقصة تبدو
 * كاملة.
 */

import { useState } from 'react'
import { usePreferences } from '../../context/preferences'
import { asArray, asRecords, blockGridSpec, boundsForRegion, isObject, runBlockProgram } from '../../lib/enginePack'
import { AssetThumb } from './engines/fields'
import type { BlockCell, BlockGrid } from '../../types/enginePack'

const copy = {
  ar: {
    level: 'المستوى',
    noLevels: 'لا مستويات في الحزمة.',
    noEngine: (engine: string) => `لا معاينة مخصَّصة لـ${engine} في هذا الإصدار.`,
    untranslated: 'لا ترجمة في اللغة المختارة؛ سيظهر المفتاح كما هو.',
    targets: 'الأهداف',
    items: 'العناصر',
    distractors: 'مشتّتات',
    bins: 'السلال',
    prompt: 'التوجيه',
    criterion: 'المعيار',
    cards: 'البطاقات',
    reveal: 'اكشف الوجوه',
    hide: 'أخفِ الوجوه',
    faceDown: 'مقلوبة',
    flipDelay: 'مهلة إعادة القلب',
    panels: 'اللوحات',
    acceptedOrders: 'الترتيبات المقبولة',
    question: 'السؤال',
    options: 'الخيارات',
    correct: 'الصحيح',
    onScreen: 'عدد العناصر على الشاشة',
    compare: 'المقارنة',
    sequence: 'المتتالية',
    missing: '؟',
    rule: 'القاعدة',
    dimensions: 'الأبعاد المتغيّرة',
    explanation: 'التعليل',
    word: 'الكلمة',
    slots: 'الخانات',
    tiles: 'بطاقات الحروف',
    tilesHint: 'تُخلَط عند العرض؛ الترتيب هنا هو ترتيب التأليف.',
    lanes: 'المسارات',
    notes: 'النقرات',
    track: 'المقطوعة',
    grid: 'الشبكة',
    program: 'الحلّ المرجعي',
    path: 'مسار الروبوت',
    reaches: 'يصل إلى الهدف',
    fails: 'لا يصل إلى الهدف',
    variables: 'المتغيّرات',
    measured: 'المقياس',
    hypotheses: 'خيارات التوقّع',
    explanations: 'خيارات التفسير',
    trials: 'أقلّ عدد محاولات',
    supervision: 'الإشراف',
    safety: 'ملاحظة السلامة',
    timeline: 'الخطّ الزمني',
    map: 'الخريطة',
    events: 'الأحداث',
    tolerance: 'التفاوت',
    years: 'سنة',
    km: 'كم',
    start: 'ب',
    goal: 'هـ',
    noPreviewData: 'المستوى بلا بيانات كافية للعرض.',
  },
  en: {
    level: 'Level',
    noLevels: 'The pack has no levels.',
    noEngine: (engine: string) => `No dedicated preview for ${engine} in this deployment.`,
    untranslated: 'No translation in the chosen language; the key itself would be shown.',
    targets: 'Targets',
    items: 'Items',
    distractors: 'Distractors',
    bins: 'Bins',
    prompt: 'Prompt',
    criterion: 'Criterion',
    cards: 'Cards',
    reveal: 'Reveal the faces',
    hide: 'Hide the faces',
    faceDown: 'Face down',
    flipDelay: 'Flip-back delay',
    panels: 'Panels',
    acceptedOrders: 'Accepted orders',
    question: 'Question',
    options: 'Options',
    correct: 'Correct',
    onScreen: 'Elements on screen',
    compare: 'Comparison',
    sequence: 'Sequence',
    missing: '?',
    rule: 'Rule',
    dimensions: 'Changing dimensions',
    explanation: 'Explanation',
    word: 'Word',
    slots: 'Slots',
    tiles: 'Letter tiles',
    tilesHint: 'Shuffled on screen; the order here is the authoring order.',
    lanes: 'Lanes',
    notes: 'Notes',
    track: 'Track',
    grid: 'Grid',
    program: 'Reference solution',
    path: 'Robot path',
    reaches: 'Reaches the goal',
    fails: 'Does not reach the goal',
    variables: 'Variables',
    measured: 'Measured',
    hypotheses: 'Prediction options',
    explanations: 'Explanation options',
    trials: 'Minimum trials',
    supervision: 'Supervision',
    safety: 'Safety note',
    timeline: 'Timeline',
    map: 'Map',
    events: 'Events',
    tolerance: 'Tolerance',
    years: 'years',
    km: 'km',
    start: 'S',
    goal: 'G',
    noPreviewData: 'This level has too little data to display.',
  },
}

/// نصّ مفتاح ترجمة كما سيُعرض، أو المفتاح نفسه بعلامة صريحة.
function Translated({ keyName, prompts }: { keyName?: string | null; prompts: Record<string, string> }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  if (!keyName) return <span className="data-unavailable">—</span>
  const value = prompts[keyName]
  if (value) return <span>{value}</span>
  return (
    <span className="engine-preview__untranslated" title={text.untranslated}>
      <code dir="ltr">{keyName}</code>
    </span>
  )
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export interface EnginePreviewProps {
  engineId: string
  pack: Record<string, unknown> | null
  prompts: Record<string, string>
}

export function EnginePreview({ engineId, pack, prompts }: EnginePreviewProps) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const levels = asRecords(pack?.levels)

  if (!levels.length) return <p className="data-unavailable">{text.noLevels}</p>
  const level = levels[Math.min(index, levels.length - 1)]
  if (!level) return <p className="data-unavailable">{text.noLevels}</p>

  return (
    <div className="engine-preview">
      <label className="field">
        <span>{text.level}</span>
        <select value={index} onChange={(event) => setIndex(Number(event.target.value))}>
          {levels.map((entry, position) => (
            <option value={position} key={position}>
              {num(entry.level) || position + 1}{entry.mode ? ` · ${str(entry.mode)}` : ''}
            </option>
          ))}
        </select>
      </label>

      {engineId === 'match_pairs' && <MatchPairsPreview level={level} prompts={prompts} />}
      {engineId === 'sort_bins' && <SortBinsPreview level={level} prompts={prompts} />}
      {engineId === 'memory_flip' && (
        <MemoryFlipPreview level={level} prompts={prompts} revealed={revealed} onToggle={() => setRevealed(!revealed)} />
      )}
      {engineId === 'sequence_order' && <SequenceOrderPreview level={level} prompts={prompts} />}
      {engineId === 'count_quantity' && <CountQuantityPreview level={level} prompts={prompts} />}
      {engineId === 'logic_pattern' && <LogicPatternPreview level={level} prompts={prompts} />}
      {engineId === 'word_build' && <WordBuildPreview level={level} />}
      {engineId === 'rhythm_tap' && <RhythmTapPreview level={level} />}
      {engineId === 'block_code' && <BlockCodePreview level={level} />}
      {engineId === 'sim_lab' && <SimLabPreview level={level} prompts={prompts} />}
      {engineId === 'timeline_map' && <TimelineMapPreview level={level} prompts={prompts} />}
      {![
        'match_pairs', 'sort_bins', 'memory_flip', 'sequence_order', 'count_quantity',
        'logic_pattern', 'word_build', 'rhythm_tap', 'block_code', 'sim_lab', 'timeline_map',
      ].includes(engineId) && <p className="data-unavailable">{text.noEngine(engineId)}</p>}
    </div>
  )
}

type LevelProps = { level: Record<string, unknown>; prompts: Record<string, string> }

function MatchPairsPreview({ level, prompts }: LevelProps) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const targets = asRecords(level.targets)
  const items = asRecords(level.items)
  const distractors = asRecords(level.distractors)

  return (
    <>
      <p className="engine-preview__prompt"><Translated keyName={str(level.prompt_key)} prompts={prompts} /></p>
      <h5>{text.targets}</h5>
      <div className="engine-preview__row">
        {targets.map((target) => (
          <figure key={str(target.id)}>
            <AssetThumb assetId={str(target.image)} size={72} />
            <figcaption><Translated keyName={str(target.label_key)} prompts={prompts} /></figcaption>
          </figure>
        ))}
      </div>
      <h5>{text.items}</h5>
      <div className="engine-preview__row">
        {[...items, ...distractors].map((item, position) => {
          const isDistractor = position >= items.length
          return (
            <figure key={`${str(item.id)}-${position}`} className={isDistractor ? 'engine-preview__distractor' : undefined}>
              <AssetThumb assetId={str(item.image)} size={60} />
              <figcaption>
                <Translated keyName={str(item.label_key)} prompts={prompts} />
                {isDistractor ? <small> · {text.distractors}</small> : <small dir="ltr"> → {str(item.target)}</small>}
              </figcaption>
            </figure>
          )
        })}
      </div>
    </>
  )
}

function SortBinsPreview({ level, prompts }: LevelProps) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const bins = asRecords(level.bins)
  const items = asRecords(level.items)

  return (
    <>
      <p className="engine-preview__prompt">
        {text.criterion}: <Translated keyName={str(level.criterion_key)} prompts={prompts} />
      </p>
      <div className="engine-board">
        {bins.map((bin) => (
          <div className="engine-board__column" key={str(bin.id)}>
            <header>
              <AssetThumb assetId={str(bin.image)} size={56} />
              <span><Translated keyName={str(bin.label_key)} prompts={prompts} /></span>
            </header>
            <ul>
              {items.filter((item) => str(item.bin) === str(bin.id)).map((item) => (
                <li key={str(item.id)}>
                  <AssetThumb assetId={str(item.image)} size={40} />
                  <Translated keyName={str(item.label_key)} prompts={prompts} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}

function MemoryFlipPreview({ level, prompts, revealed, onToggle }: LevelProps & { revealed: boolean; onToggle: () => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const pairs = asRecords(level.pairs)
  const grid = asArray(level.grid).map(num)
  const width = grid[0] || 2
  const height = grid[1] || 2
  const faces = pairs.flatMap((pair) => [
    { assetId: str(pair.a), key: str(pair.sound_key) },
    { assetId: str(pair.b), key: str(pair.sound_key) },
  ])
  const cells = Math.max(width * height, faces.length)

  return (
    <>
      <div className="trace-editor__row">
        <button className="button button--secondary" type="button" aria-pressed={revealed} onClick={onToggle}>
          {revealed ? text.hide : text.reveal}
        </button>
        <span className="table-secondary">{text.flipDelay}: <span dir="ltr">{num(level.flip_back_delay_ms)}ms</span></span>
      </div>
      <div className="engine-grid" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}>
        {Array.from({ length: cells }, (_, position) => {
          const face = faces[position]
          if (!face) return <div className="engine-grid__cell engine-grid__cell--empty" key={position}><small>—</small></div>
          return (
            <div className="engine-grid__cell" key={position}>
              {revealed
                ? <><AssetThumb assetId={face.assetId} size={52} /><small><Translated keyName={face.key} prompts={prompts} /></small></>
                : <span className="engine-card-back" role="img" aria-label={text.faceDown} />}
            </div>
          )
        })}
      </div>
    </>
  )
}

function SequenceOrderPreview({ level, prompts }: LevelProps) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const panels = asRecords(level.panels)
  const ordered = [...panels].sort((a, b) => num(a.position) - num(b.position))
  const orders = asArray(level.accepted_orders)

  return (
    <>
      <p className="engine-preview__prompt"><Translated keyName={str(level.prompt_key)} prompts={prompts} /></p>
      <h5>{text.panels}</h5>
      <ol className="engine-strip">
        {ordered.map((panel) => (
          <li key={str(panel.id)}>
            <span className="engine-strip__index">{num(panel.position)}</span>
            <AssetThumb assetId={str(panel.image)} size={64} />
            <small><Translated keyName={str(panel.caption_key)} prompts={prompts} /></small>
          </li>
        ))}
      </ol>
      <h5>{text.acceptedOrders}</h5>
      <ul className="planned-list">
        {orders.map((order, position) => (
          <li key={position} dir="ltr">{asArray(order).map((id) => String(id)).join(' → ')}</li>
        ))}
        {!orders.length && <li className="data-unavailable">—</li>}
      </ul>
    </>
  )
}

function CountQuantityPreview({ level, prompts }: LevelProps) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const items = asRecords(level.items)
  const mode = str(level.mode)

  return (
    <>
      {items.map((item) => {
        const id = str(item.id)
        const sets = asRecords(item.items)
        const options = asArray(item.options)
        const total = sets.reduce((sum, set) => sum + num(set.count), 0)
        const setA = isObject(item.set_a) ? item.set_a : null
        const setB = isObject(item.set_b) ? item.set_b : null
        const sequence = asArray(item.sequence)

        return (
          <article className="engine-preview__question" key={id}>
            <header>
              <code dir="ltr">{id}</code>
              <Translated keyName={str(item.question_key)} prompts={prompts} />
            </header>

            {(mode === 'count_and_pick' || mode === 'drag_amount') && (
              <>
                <div className="engine-count-strip">
                  {sets.map((set, position) => (
                    <div className="engine-count-strip__set" key={position}>
                      {Array.from({ length: Math.min(num(set.count), 20) }, (_, copyIndex) => (
                        <AssetThumb assetId={str(set.image)} size={30} key={copyIndex} />
                      ))}
                    </div>
                  ))}
                </div>
                <p className="table-secondary">{text.onScreen}: <strong dir="ltr">{total}</strong></p>
              </>
            )}

            {mode === 'compare_sets' && setA && setB && (
              <div className="engine-preview__row">
                {[setA, setB].map((set, position) => (
                  <div className="engine-count-strip__set" key={position}>
                    {Array.from({ length: Math.min(num(set.count), 20) }, (_, copyIndex) => (
                      <AssetThumb assetId={str(set.image)} size={28} key={copyIndex} />
                    ))}
                    <small dir="ltr">{num(set.count)}</small>
                  </div>
                ))}
              </div>
            )}

            {mode === 'pattern_fill' && (
              <div className="engine-sequence">
                {sequence.map((value, position) => (
                  <span className={value === null ? 'engine-sequence__slot engine-sequence__slot--missing' : 'engine-sequence__slot'} key={position}>
                    <strong dir="ltr">{value === null ? text.missing : String(value)}</strong>
                  </span>
                ))}
              </div>
            )}

            <div className="engine-options">
              {options.map((option, position) => (
                <span
                  className={option === item.answer ? 'engine-option engine-option--correct' : 'engine-option'}
                  key={position}
                  dir="ltr"
                >
                  {String(option)}
                  {option === item.answer && <small> ✓ {text.correct}</small>}
                </span>
              ))}
            </div>
            {str(item.rule_key) && <p className="table-secondary">{text.rule}: <Translated keyName={str(item.rule_key)} prompts={prompts} /></p>}
          </article>
        )
      })}
      {!items.length && <p className="data-unavailable">{text.noPreviewData}</p>}
    </>
  )
}

function LogicPatternPreview({ level, prompts }: LevelProps) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const grid = asArray(level.grid)
  const sequence = asArray(level.sequence)
  const options = asArray(level.options).map((value) => String(value))
  const dimensions = asArray(level.changing_dimensions).map((value) => String(value))

  return (
    <>
      {grid.length ? (
        <div className="engine-grid" style={{ gridTemplateColumns: `repeat(${asArray(grid[0]).length || 1}, minmax(0, 1fr))` }}>
          {grid.flatMap((row, rowIndex) => asArray(row).map((cell, columnIndex) => (
            <div className={cell === null ? 'engine-grid__cell engine-grid__cell--missing' : 'engine-grid__cell'} key={`${rowIndex}-${columnIndex}`}>
              {cell === null ? <strong>{text.missing}</strong> : <AssetThumb assetId={String(cell)} size={52} />}
            </div>
          )))}
        </div>
      ) : (
        <div className="engine-sequence">
          {sequence.map((cell, position) => (
            <div className={cell === null ? 'engine-sequence__slot engine-sequence__slot--missing' : 'engine-sequence__slot'} key={position}>
              {cell === null ? <strong>{text.missing}</strong> : <AssetThumb assetId={String(cell)} size={52} />}
            </div>
          ))}
        </div>
      )}
      <h5>{text.options}</h5>
      <div className="engine-preview__row">
        {options.map((option) => (
          <figure key={option} className={option === str(level.answer) ? 'engine-preview__correct' : undefined}>
            <AssetThumb assetId={option} size={56} />
            {option === str(level.answer) && <figcaption>✓ {text.correct}</figcaption>}
          </figure>
        ))}
      </div>
      <p className="table-secondary">{text.rule}: <Translated keyName={str(level.rule_key)} prompts={prompts} /></p>
      <p className="table-secondary">{text.dimensions}: <span dir="ltr">{dimensions.join(', ') || '—'}</span></p>
      {level.require_explanation === true && (
        <>
          <h5>{text.explanation}</h5>
          <ul className="planned-list">
            {asArray(level.explain_options).map((option) => (
              <li key={String(option)} className={String(option) === str(level.explain_answer) ? 'engine-preview__correct' : undefined}>
                <Translated keyName={String(option)} prompts={prompts} />
                {String(option) === str(level.explain_answer) && <small> ✓ {text.correct}</small>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function WordBuildPreview({ level }: { level: Record<string, unknown> }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const letters = asRecords(level.letters)
  const distractors = asRecords(level.distractors)
  const slots = num(level.slots)
  const rtl = str(level.writing_direction) !== 'ltr'

  return (
    <>
      <div className="engine-preview__row">
        <AssetThumb assetId={str(level.word_image)} size={96} />
        <div>
          <p className="engine-word-preview" dir={rtl ? 'rtl' : 'ltr'}>{str(level.word)}</p>
          <p className="table-secondary">{text.slots}: <span dir="ltr">{slots}</span></p>
        </div>
      </div>
      <div className="engine-slots" dir={rtl ? 'rtl' : 'ltr'}>
        {Array.from({ length: slots || letters.length }, (_, position) => (
          <span className="engine-slot" key={position} />
        ))}
      </div>
      <h5>{text.tiles}</h5>
      <p className="table-secondary">{text.tilesHint}</p>
      <div className="engine-preview__row">
        {[...letters, ...distractors].map((letter, position) => (
          <span
            className={position >= letters.length ? 'engine-letter engine-letter--distractor' : 'engine-letter'}
            key={position}
            dir="rtl"
          >
            {str(letter.char)}
            {str(letter.form) && <small dir="ltr">{str(letter.form)}</small>}
          </span>
        ))}
      </div>
    </>
  )
}

function RhythmTapPreview({ level }: { level: Record<string, unknown> }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const notes = asRecords(level.notes)
  const lanes = Math.max(1, num(level.lanes) || 1)
  const duration = Math.max(1, num(level.track_duration_ms) || 1)
  const bpm = Math.max(1, num(level.bpm) || 1)
  const beatMs = 60000 / bpm
  const beats = Math.floor(duration / beatMs)

  return (
    <>
      <p className="table-secondary">
        {text.track}: <code dir="ltr">{str(level.track) || '—'}</code>
        {' · '}<span dir="ltr">{duration}ms</span>
        {' · '}<span dir="ltr">{bpm} bpm</span>
        {' · '}{text.lanes}: <span dir="ltr">{lanes}</span>
        {' · '}{text.notes}: <span dir="ltr">{notes.length}</span>
      </p>
      <div className="engine-timeline">
        {Array.from({ length: lanes }, (_, lane) => (
          <div className="engine-timeline__lane" key={lane}>
            <span className="engine-timeline__label">{lane + 1}</span>
            <div className="engine-timeline__track engine-timeline__track--readonly">
              {Array.from({ length: beats + 1 }, (_, beat) => (
                <span
                  className={beat % 4 === 0 ? 'engine-timeline__beat engine-timeline__beat--bar' : 'engine-timeline__beat'}
                  style={{ insetInlineStart: `${((beat * beatMs) / duration) * 100}%` }}
                  key={beat}
                  aria-hidden="true"
                />
              ))}
              {notes.filter((note) => num(note.lane) === lane).map((note, position) => (
                <span
                  className="engine-timeline__note"
                  style={{ insetInlineStart: `${Math.min(100, (num(note.time_ms) / duration) * 100)}%` }}
                  key={position}
                  title={`${num(note.time_ms)}ms`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function BlockCodePreview({ level }: { level: Record<string, unknown> }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const grid = isObject(level.grid) ? level.grid as unknown as BlockGrid : null
  if (!grid) return <p className="data-unavailable">{text.noPreviewData}</p>
  const width = num(grid.w)
  const height = num(grid.h)
  const walls = (grid.walls ?? []) as BlockCell[]
  const collectibles = (grid.collectibles ?? []) as BlockCell[]
  const reference = asArray(level.reference_solution).filter((token): token is string => typeof token === 'string')
  const outcome = reference.length ? runBlockProgram(blockGridSpec(grid), reference) : null
  const pathCells = new Set((outcome?.path ?? []).map((cell) => `${cell[0]},${cell[1]}`))
  const same = (a: BlockCell | undefined, cell: BlockCell) => !!a && a[0] === cell[0] && a[1] === cell[1]

  return (
    <>
      <div className="engine-code-grid" style={{ gridTemplateColumns: `repeat(${width || 1}, minmax(0, 1fr))` }} dir="ltr">
        {Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
          const cell: BlockCell = [x, y]
          const classes = ['engine-code-cell', 'engine-code-cell--readonly']
          if (walls.some((wall) => same(wall, cell))) classes.push('engine-code-cell--wall')
          if (same(grid.start, cell)) classes.push('engine-code-cell--start')
          if (same(grid.goal, cell)) classes.push('engine-code-cell--goal')
          if (collectibles.some((entry) => same(entry, cell))) classes.push('engine-code-cell--collect')
          if (pathCells.has(`${x},${y}`)) classes.push('engine-code-cell--path')
          return (
            <span className={classes.join(' ')} key={`${x}-${y}`}>
              {same(grid.start, cell) ? text.start : same(grid.goal, cell) ? text.goal : collectibles.some((entry) => same(entry, cell)) ? '★' : ''}
            </span>
          )
        }))}
      </div>
      <p className="table-secondary">{text.program}: <span dir="ltr">{reference.join(' · ') || '—'}</span></p>
      {outcome && (
        <p className={outcome.reachedGoal ? 'inline-alert inline-alert--info' : 'inline-alert inline-alert--error'}>
          {text.path}: {outcome.reachedGoal ? text.reaches : text.fails} <span dir="ltr">[{outcome.x},{outcome.y}]</span>
        </p>
      )}
    </>
  )
}

function SimLabPreview({ level, prompts }: LevelProps) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const variables = asRecords(level.variables)
  const relationships = isObject(level.expected_relationships) ? level.expected_relationships : {}
  const measured = isObject(level.measured) ? level.measured : null

  return (
    <>
      <h5>{text.variables}</h5>
      {variables.map((variable) => (
        <div className="engine-preview__variable" key={str(variable.id)}>
          <span><Translated keyName={str(variable.label_key)} prompts={prompts} /></span>
          <input
            type="range"
            min={num(variable.min)}
            max={num(variable.max)}
            step={num(variable.step) || 1}
            defaultValue={num(variable.min)}
            aria-label={str(variable.label_key)}
          />
          <small dir="ltr">
            {num(variable.min)}..{num(variable.max)} / {num(variable.step)}
            {' · '}{String(relationships[str(variable.id)] ?? '—')}
          </small>
        </div>
      ))}
      {measured && (
        <p className="table-secondary">
          {text.measured}: <Translated keyName={str(measured.label_key)} prompts={prompts} />
          {' '}(<Translated keyName={str(measured.unit_key)} prompts={prompts} />)
        </p>
      )}
      <h5>{text.hypotheses}</h5>
      <ul className="planned-list">
        {asArray(level.hypothesis_options).map((option) => (
          <li key={String(option)}><Translated keyName={String(option)} prompts={prompts} /></li>
        ))}
      </ul>
      <h5>{text.explanations}</h5>
      <ul className="planned-list">
        {asArray(level.explanation_options).map((option) => (
          <li key={String(option)} className={String(option) === str(level.explanation_answer) ? 'engine-preview__correct' : undefined}>
            <Translated keyName={String(option)} prompts={prompts} />
            {String(option) === str(level.explanation_answer) && <small> ✓ {text.correct}</small>}
          </li>
        ))}
      </ul>
      <p className="table-secondary">
        {text.trials}: <span dir="ltr">{num(level.min_trials_before_explain)}</span>
        {' · '}{text.supervision}: <span dir="ltr">{str(level.supervision_level) || '—'}</span>
      </p>
      {str(level.safety_note_key) && (
        <p className="inline-alert inline-alert--info">
          {text.safety}: <Translated keyName={str(level.safety_note_key)} prompts={prompts} />
        </p>
      )}
    </>
  )
}

function TimelineMapPreview({ level, prompts }: LevelProps) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const events = asRecords(level.events)
  const timeline = isObject(level.timeline) ? level.timeline : null
  const map = isObject(level.map) ? level.map : null
  const from = timeline ? num(timeline.from) : 0
  const to = timeline ? num(timeline.to) : 0
  const bounds = map ? boundsForRegion(str(map.region)) : null

  return (
    <>
      {timeline && (
        <>
          <h5>{text.timeline}</h5>
          <div className="engine-rail" dir="ltr">
            <span className="engine-rail__end">{from}</span>
            <span className="engine-rail__end engine-rail__end--to">{to}</span>
            {asRecords(timeline.anchors).map((anchor, position) => (
              <span
                className="engine-rail__anchor"
                style={{ left: `${((num(anchor.year) - from) / Math.max(1, to - from)) * 100}%` }}
                key={position}
                title={String(num(anchor.year))}
              />
            ))}
            {events.map((event, position) => (
              event.year === undefined ? null : (
                <span
                  className="engine-rail__event"
                  style={{ left: `${Math.min(100, Math.max(0, ((num(event.year) - from) / Math.max(1, to - from)) * 100))}%` }}
                  key={str(event.id)}
                  title={`${str(event.id)} · ${num(event.year)}`}
                >{position + 1}</span>
              )
            ))}
          </div>
        </>
      )}
      {map && bounds && (
        <>
          <h5>{text.map}</h5>
          <div className="engine-map" dir="ltr">
            <span className="engine-map__bounds">{str(map.region)}</span>
            {events.map((event, position) => (
              event.lat === undefined || event.lon === undefined ? null : (
                <span
                  className="engine-map__pin"
                  style={{
                    left: `${((num(event.lon) - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 100}%`,
                    top: `${((bounds.maxLat - num(event.lat)) / (bounds.maxLat - bounds.minLat)) * 100}%`,
                  }}
                  key={str(event.id)}
                  title={`${str(event.id)} · ${num(event.lat)}, ${num(event.lon)}`}
                >{position + 1}</span>
              )
            ))}
          </div>
        </>
      )}
      <h5>{text.events}</h5>
      <div className="engine-preview__row">
        {events.map((event) => (
          <figure key={str(event.id)}>
            <AssetThumb assetId={str(event.image)} size={64} />
            <figcaption>
              <Translated keyName={str(event.label_key)} prompts={prompts} />
              <small dir="ltr">
                {event.year !== undefined ? ` ${num(event.year)} ±${num(event.tolerance_years)}${text.years}` : ''}
                {event.lat !== undefined ? ` ${num(event.lat)},${num(event.lon)} ±${num(event.tolerance_km)}${text.km}` : ''}
              </small>
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
