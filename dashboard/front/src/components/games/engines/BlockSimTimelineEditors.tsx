/**
 * محرّرات `block_code` و`sim_lab` و`timeline_map`.
 *
 * ## block_code: الشبكة تُرسم، والحلّ يُشغَّل
 *
 * مستوى برمجة مؤلَّف بالأرقام (`"walls": [[1,2],[1,3]]`) لا يمكن مراجعته: لا
 * أحد يرى أن الهدف محاط بحوائط، ولا أن `reference_solution` يدخل في حائط عند
 * الأمر الثالث. والحلّ المرجعي ليس تفصيلًا: هو ما تعرضه **الدرجة الرابعة من
 * سلّم المساعدة** لطفل تعطّل أربع مرات، فحلٌّ فاشل يعرض عليه فشلًا موجَّهًا.
 *
 * فالشبكة هنا تُرسم بالضغط على خلاياها، والحلّ يُبنى بأزرار من الأوامر المسموحة
 * فقط، ثم **يُشغَّل** بنفس دلالات الخادم فيُرسم مسار الروبوت ونتيجته. الخطأ
 * يُرى قبل الحفظ لا بعده.
 *
 * ## sim_lab: كل متغيّر له علاقة، بالبناء
 *
 * الخادم يرفض متغيّرًا بلا علاقة مُعلَنة وعلاقةً تسمّي متغيّرًا غير موجود.
 * الاثنان نتيجة واحدة لسبب واحد: `variables` و`expected_relationships` جدولان
 * منفصلان في JSON. هنا هما شيء واحد: إضافة متغيّر تُنشئ علاقته، وحذفه يحذفها،
 * ولا يوجد مكان يمكن أن يتباعدا فيه.
 *
 * ## timeline_map: السنة على خطّ، والمكان على خريطة
 *
 * الخادم يرفض حدثًا خارج مدى الخطّ الزمني أو خارج حدود المنطقة، لأن الطفل لا
 * يستطيع وضعه أبدًا. المحرّر يعرض الخطّ والمستطيل نفسيهما فيُوضَع الحدث داخلهما
 * بالضغط. مربّع الحدود ليس خريطة سياسية: هو نافذة عرض، ولا تُرسم منه أي حدود.
 */

import { useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from '../../Icon'
import { usePreferences } from '../../../context/preferences'
import { AssetField, AssetThumb, EditorCard, EditorSection, KeyField, confirmRemoval } from './fields'
import { KNOWN_REGIONS, blockGridSpec, boundsForRegion, nextId, runBlockProgram } from '../../../lib/enginePack'
import {
  BLOCK_FACINGS,
  BLOCK_TOKENS,
  DISPLAY_CALENDARS,
  SIM_KINDS,
  SIM_RELATIONSHIPS,
  TIMELINE_MODES,
} from '../../../types/enginePack'
import { SUPERVISION_LEVELS } from '../../../types/gamePack'
import type {
  BlockCell,
  BlockCodeLevel,
  BlockToken,
  SimLabLevel,
  SimRelationship,
  SimVariable,
  TimelineEvent,
  TimelineMapLevel,
} from '../../../types/enginePack'

const copy = {
  ar: {
    remove: 'حذف',
    // block_code
    gridSection: 'الشبكة',
    gridHint: 'العرض والطول من 3 إلى 8. اختر أداة ثم اضغط على خليّة.',
    width: 'العرض',
    height: 'الطول',
    tool: 'الأداة',
    tools: { wall: 'حائط', start: 'البداية', goal: 'الهدف', collect: 'مجموعة', clear: 'إفراغ' } as Record<string, string>,
    facing: 'اتجاه البداية',
    facings: { north: 'شمالًا', east: 'شرقًا', south: 'جنوبًا', west: 'غربًا' } as Record<string, string>,
    facingNote: 'الشبكة والاتجاهات منطق لعبة ولا تُعكس في العربية.',
    allowed: 'الأوامر المسموحة',
    allowedHint: 'أمر مسموح يحتاج تسجيلًا صوتيًا باسمه: طفل لا يقرأ لا يستطيع استخدام أمر لا يسمع اسمه.',
    blocks: {
      move: 'تقدَّم', turn_left: 'استدر يسارًا', turn_right: 'استدر يمينًا',
      repeat: 'كرِّر', if_path: 'إن كان الطريق مفتوحًا', collect: 'اجمع', function: 'دالّة',
    } as Record<string, string>,
    limits: 'الحدود',
    blockLimit: 'أقصى عدد أوامر',
    optimal: 'عدد الأوامر المثالي',
    optimalHint: 'نجمة إضافية فقط. الحلّ الأطول لا يُعاقب أبدًا.',
    stepDelay: 'مهلة كل خطوة (ms)',
    stepDelayHint: 'من 200 إلى 1200. التنفيذ مرئي خطوة بخطوة وقابل للإيقاف.',
    coordinates: 'إظهار إحداثيّات الشبكة للطفل',
    reference: 'الحلّ المرجعي',
    referenceHint: 'هذا ما ستعرضه الدرجة الرابعة من سلّم المساعدة. يُشغَّل هنا بدلالات الخادم نفسها.',
    addBlock: 'أضف أمرًا',
    repeatCount: 'عدد التكرار',
    run: 'النتيجة',
    reached: 'يصل إلى الهدف',
    notReached: 'لا يصل إلى الهدف',
    collided: 'اصطدم بحائط',
    endsAt: (x: number, y: number) => `ينتهي عند [${x},${y}]`,
    collected: (count: number, total: number) => `جمع ${count} من ${total}`,
    steps: (count: number) => `${count} خطوة`,
    empty: 'لا أوامر بعد.',
    start: 'ب',
    goalCell: 'هـ',
    // sim_lab
    sim: 'المحاكاة',
    sims: { plant_growth: 'نموّ نبات', circuit: 'دائرة كهربية', pendulum: 'بندول' } as Record<string, string>,
    variables: 'المتغيّرات',
    variablesHint: 'من 1 إلى 3. كل متغيّر يُنشئ علاقته المتوقَّعة معه، فلا يمكن أن يبقى بلا علاقة.',
    addVariable: 'متغيّر',
    variableId: 'المعرّف',
    label: 'مفتاح الاسم',
    unit: 'مفتاح الوحدة',
    min: 'الأدنى',
    max: 'الأعلى',
    step: 'الخطوة',
    relationship: 'العلاقة المتوقَّعة',
    relationships: { positive: 'طردية', negative: 'عكسية', none: 'لا تأثير', saturating: 'تتشبّع' } as Record<string, string>,
    relationshipHint: '«لا تأثير» مفهوم تعليمي مقصود، لكن لا يجوز أن تكون كل المتغيّرات كذلك: تجربة بلا نتيجة ملحوظة لا شيء فيها ليُفسَّر.',
    allNone: 'كل المتغيّرات «لا تأثير»: لا نتيجة يمكن ملاحظتها ولا شيء يُفسَّر.',
    measured: 'المقياس',
    measuredHint: 'ما يقيسه الطفل ويراه يتغيّر.',
    hypotheses: 'خيارات التوقّع',
    hypothesesHint: 'من 2 إلى 4 مفاتيح ترجمة. التوقّع الخاطئ ليس فشلًا: التفسير هو ما يُقاس.',
    addHypothesis: 'خيار توقّع',
    explanations: 'خيارات التفسير',
    explanationsHint: 'من 2 إلى 4. الصحيح يُختار منها فلا يمكن أن يكون خارجها.',
    addExplanation: 'خيار تفسير',
    correct: 'الصحيح',
    pick: 'اجعله الصحيح',
    minTrials: 'أقلّ عدد محاولات قبل التفسير',
    minTrialsHint: 'من 2 إلى 6. التفسير قبل تجربة كافية تخمين.',
    resultsTable: 'جدول النتائج',
    resultsTableLocked: 'مفروض ولا يُطفأ: الجدول هو الصورة النصيّة للنتيجة، وهي ما يقرؤه قارئ الشاشة.',
    supervision: 'مستوى الإشراف',
    supervisions: { none: 'دون إشراف', recommended: 'مستحسن', required: 'مطلوب' } as Record<string, string>,
    safetyNote: 'مفتاح ملاحظة السلامة',
    safetyNoteHint: 'مفروض حين يكون الإشراف «مطلوبًا».',
    duplicateId: 'معرّف متغيّر مكرَّر.',
    // timeline_map
    mode: 'النمط',
    modes: { timeline: 'خطّ زمني', map: 'خريطة', both: 'الاثنان' } as Record<string, string>,
    timeline: 'الخطّ الزمني',
    from: 'من سنة',
    to: 'إلى سنة',
    calendar: 'التقويم المعروض',
    calendars: { auto: 'تلقائي', gregorian: 'ميلادي', hijri: 'هجري' } as Record<string, string>,
    calendarNote: 'التخزين ميلادي دائمًا؛ هذا اختيار عرض فقط.',
    anchors: 'المراسي',
    anchorsHint: 'حتى 3 مراسٍ تساعد الطفل على تقدير الموضع. تُعرض على الخطّ نفسه.',
    addAnchor: 'مرساة',
    year: 'السنة',
    map: 'الخريطة',
    region: 'المنطقة',
    projection: 'الإسقاط',
    mirror: 'تُعكس في العربية',
    mirrorLocked: 'مفروضة false: الجغرافيا لا تُعكس أبدًا.',
    regionHint: 'المنطقة تحدّد حدود العرض، والخادم يرفض حدثًا خارجها لأن الطفل لا يستطيع وضعه.',
    events: 'الأحداث',
    eventsHint: 'من 3 إلى 5 أحداث. اضغط على الخطّ أو الخريطة لتحديد موضع الحدث المحدَّد.',
    addEvent: 'حدث',
    toleranceYears: 'التفاوت (سنوات)',
    toleranceKm: 'التفاوت (كم)',
    explainKey: 'مفتاح شرح الحدث',
    selected: 'المحدَّد',
    select: 'تحديد',
    railHint: 'اضغط على الخطّ لضبط سنة الحدث المحدَّد.',
    mapHint: 'اضغط على المستطيل لضبط موقع الحدث المحدَّد. المستطيل نافذة عرض لا خريطة سياسية.',
    outsideRail: 'خارج مدى الخطّ.',
    outsideMap: 'خارج حدود المنطقة.',
    showAnchor: 'إظهار مرساة مرجعية للطفل',
    lat: 'خطّ العرض',
    lon: 'خطّ الطول',
    noEvent: 'حدّد حدثًا أوّلًا.',
  },
  en: {
    remove: 'Delete',
    gridSection: 'Grid',
    gridHint: 'Width and height 3 to 8. Choose a tool, then click a cell.',
    width: 'Width',
    height: 'Height',
    tool: 'Tool',
    tools: { wall: 'Wall', start: 'Start', goal: 'Goal', collect: 'Collectible', clear: 'Clear' } as Record<string, string>,
    facing: 'Starting direction',
    facings: { north: 'North', east: 'East', south: 'South', west: 'West' } as Record<string, string>,
    facingNote: 'The grid and the directions are game logic and are never mirrored in Arabic.',
    allowed: 'Allowed blocks',
    allowedHint: 'Every allowed block needs a spoken name: a pre-reading child cannot use a block whose name they never hear.',
    blocks: {
      move: 'Move', turn_left: 'Turn left', turn_right: 'Turn right',
      repeat: 'Repeat', if_path: 'If the path is clear', collect: 'Collect', function: 'Function',
    } as Record<string, string>,
    limits: 'Limits',
    blockLimit: 'Block limit',
    optimal: 'Optimal block count',
    optimalHint: 'An extra star only. A longer solution is never penalised.',
    stepDelay: 'Step delay (ms)',
    stepDelayHint: '200 to 1200. Execution is visible step by step and can be paused.',
    coordinates: 'Show grid coordinates to the child',
    reference: 'Reference solution',
    referenceHint: 'This is what the fourth help rung demonstrates. It is run here with the server semantics.',
    addBlock: 'Add a block',
    repeatCount: 'Repeat count',
    run: 'Outcome',
    reached: 'Reaches the goal',
    notReached: 'Does not reach the goal',
    collided: 'Collided with a wall',
    endsAt: (x: number, y: number) => `Ends at [${x},${y}]`,
    collected: (count: number, total: number) => `Collected ${count} of ${total}`,
    steps: (count: number) => `${count} step(s)`,
    empty: 'No blocks yet.',
    start: 'S',
    goalCell: 'G',
    sim: 'Simulation',
    sims: { plant_growth: 'Plant growth', circuit: 'Circuit', pendulum: 'Pendulum' } as Record<string, string>,
    variables: 'Variables',
    variablesHint: '1 to 3. Each variable creates its expected relationship, so none can be left without one.',
    addVariable: 'Variable',
    variableId: 'Id',
    label: 'Label key',
    unit: 'Unit key',
    min: 'Minimum',
    max: 'Maximum',
    step: 'Step',
    relationship: 'Expected relationship',
    relationships: { positive: 'Positive', negative: 'Negative', none: 'No effect', saturating: 'Saturating' } as Record<string, string>,
    relationshipHint: '"No effect" is a deliberate teaching concept, but not every variable may be one: an experiment with no observable outcome has nothing to explain.',
    allNone: 'Every variable is "no effect": nothing can be observed and nothing explained.',
    measured: 'Measured quantity',
    measuredHint: 'What the child measures and watches change.',
    hypotheses: 'Prediction options',
    hypothesesHint: '2 to 4 translation keys. A wrong prediction is not a failure: the explanation is what is measured.',
    addHypothesis: 'Prediction option',
    explanations: 'Explanation options',
    explanationsHint: '2 to 4. The correct one is chosen from them, so it cannot fall outside.',
    addExplanation: 'Explanation option',
    correct: 'Correct',
    pick: 'Make this the correct one',
    minTrials: 'Minimum trials before explaining',
    minTrialsHint: '2 to 6. Explaining before enough trials is guessing.',
    resultsTable: 'Results table',
    resultsTableLocked: 'Mandatory and never switched off: the table is the textual form of the result and what a screen reader reads.',
    supervision: 'Supervision level',
    supervisions: { none: 'None', recommended: 'Recommended', required: 'Required' } as Record<string, string>,
    safetyNote: 'Safety note key',
    safetyNoteHint: 'Mandatory when supervision is "required".',
    duplicateId: 'Duplicate variable id.',
    mode: 'Mode',
    modes: { timeline: 'Timeline', map: 'Map', both: 'Both' } as Record<string, string>,
    timeline: 'Timeline',
    from: 'From year',
    to: 'To year',
    calendar: 'Displayed calendar',
    calendars: { auto: 'Automatic', gregorian: 'Gregorian', hijri: 'Hijri' } as Record<string, string>,
    calendarNote: 'Storage is always Gregorian; this is a display choice only.',
    anchors: 'Anchors',
    anchorsHint: 'Up to 3 anchors that help the child judge position. Drawn on the same rail.',
    addAnchor: 'Anchor',
    year: 'Year',
    map: 'Map',
    region: 'Region',
    projection: 'Projection',
    mirror: 'Mirrored in Arabic',
    mirrorLocked: 'Forced to false: geography is never mirrored.',
    regionHint: 'The region sets the visible bounds, and the server refuses an event outside them because the child could never place it.',
    events: 'Events',
    eventsHint: '3 to 5 events. Click the rail or the map to place the selected event.',
    addEvent: 'Event',
    toleranceYears: 'Tolerance (years)',
    toleranceKm: 'Tolerance (km)',
    explainKey: 'Event explanation key',
    selected: 'Selected',
    select: 'Select',
    railHint: 'Click the rail to set the selected event year.',
    mapHint: 'Click the rectangle to set the selected event location. The rectangle is a viewport, not a political map.',
    outsideRail: 'Outside the rail range.',
    outsideMap: 'Outside the region bounds.',
    showAnchor: 'Show a reference anchor to the child',
    lat: 'Latitude',
    lon: 'Longitude',
    noEvent: 'Select an event first.',
  },
}

// ---------------------------------------------------------------------------
// block_code
// ---------------------------------------------------------------------------

type GridTool = 'wall' | 'start' | 'goal' | 'collect' | 'clear'

function sameCell(a: BlockCell | undefined, b: BlockCell | undefined): boolean {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1]
}

export function BlockCodeEditor({ level, onChange }: { level: BlockCodeLevel; onChange: (level: BlockCodeLevel) => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [tool, setTool] = useState<GridTool>('wall')
  const grid = level.grid ?? { w: 4, h: 4, start: [0, 0], facing: 'east', goal: [3, 0] }
  const width = Math.max(3, Math.min(8, Number(grid.w) || 4))
  const height = Math.max(3, Math.min(8, Number(grid.h) || 4))
  const walls = grid.walls ?? []
  const collectibles = grid.collectibles ?? []
  const reference = level.reference_solution ?? []
  const allowed = level.allowed_blocks ?? []

  const patch = (next: Partial<BlockCodeLevel>) => onChange({ ...level, ...next })
  const patchGrid = (next: Partial<typeof grid>) => patch({ grid: { ...grid, ...next } })

  /// تصغير الشبكة يُسقط ما خرج عنها فورًا: خليّة خارج الحدود يرفضها الخادم،
  /// وتركها لتُكتشف بعد الحفظ يخفي أن التصغير هو ما أفسدها.
  function resize(nextWidth: number, nextHeight: number) {
    const inside = (cell: BlockCell) => cell[0] < nextWidth && cell[1] < nextHeight
    patch({
      grid: {
        ...grid,
        w: nextWidth,
        h: nextHeight,
        walls: walls.filter(inside),
        collectibles: collectibles.filter(inside),
        start: inside(grid.start) ? grid.start : [0, 0],
        goal: inside(grid.goal) ? grid.goal : [nextWidth - 1, nextHeight - 1],
      },
    })
  }

  function paint(cell: BlockCell) {
    if (tool === 'wall') {
      if (sameCell(cell, grid.start) || sameCell(cell, grid.goal)) return
      const exists = walls.some((wall) => sameCell(wall, cell))
      patchGrid({
        walls: exists ? walls.filter((wall) => !sameCell(wall, cell)) : [...walls, cell],
        collectibles: collectibles.filter((entry) => !sameCell(entry, cell)),
      })
      return
    }
    if (tool === 'start') {
      if (sameCell(cell, grid.goal)) return
      patchGrid({ start: cell, walls: walls.filter((wall) => !sameCell(wall, cell)) })
      return
    }
    if (tool === 'goal') {
      if (sameCell(cell, grid.start)) return
      patchGrid({ goal: cell, walls: walls.filter((wall) => !sameCell(wall, cell)) })
      return
    }
    if (tool === 'collect') {
      if (walls.some((wall) => sameCell(wall, cell))) return
      const exists = collectibles.some((entry) => sameCell(entry, cell))
      patchGrid({ collectibles: exists ? collectibles.filter((entry) => !sameCell(entry, cell)) : [...collectibles, cell] })
      return
    }
    patchGrid({
      walls: walls.filter((wall) => !sameCell(wall, cell)),
      collectibles: collectibles.filter((entry) => !sameCell(entry, cell)),
    })
  }

  const outcome = useMemo(
    () => (reference.length ? runBlockProgram(blockGridSpec({ ...grid, w: width, h: height }), reference) : null),
    [grid, width, height, reference],
  )
  const pathCells = new Set((outcome?.path ?? []).map((cell) => `${cell[0]},${cell[1]}`))

  function addToken(token: BlockToken) {
    patch({ reference_solution: [...reference, token === 'repeat' ? 'repeat:2' : token] })
  }

  return (
    <div className="engine-editor">
      <EditorSection title={text.gridSection} hint={text.gridHint}>
        <div className="form-grid form-grid--three">
          <label className="field">
            <span>{text.width}</span>
            <select value={width} onChange={(event) => resize(Number(event.target.value), height)}>
              {[3, 4, 5, 6, 7, 8].map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{text.height}</span>
            <select value={height} onChange={(event) => resize(width, Number(event.target.value))}>
              {[3, 4, 5, 6, 7, 8].map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{text.facing}</span>
            <select value={grid.facing ?? 'east'} onChange={(event) => patchGrid({ facing: event.target.value as typeof grid.facing })}>
              {BLOCK_FACINGS.map((value) => <option value={value} key={value}>{text.facings[value]}</option>)}
            </select>
            <small>{text.facingNote}</small>
          </label>
        </div>

        <fieldset className="trace-editor__group">
          <legend>{text.tool}</legend>
          <div className="trace-editor__row">
            {(['wall', 'start', 'goal', 'collect', 'clear'] as GridTool[]).map((value) => (
              <button
                key={value}
                type="button"
                className={tool === value ? 'button button--secondary is-active' : 'button button--ghost'}
                aria-pressed={tool === value}
                onClick={() => setTool(value)}
              >{text.tools[value]}</button>
            ))}
          </div>
        </fieldset>

        {/* الشبكة أزرار لا خلايا جدول: كل خليّة قابلة للوصول بلوحة المفاتيح
            وتحمل اسمًا يقول إحداثيّاتها وما فيها. */}
        <div className="engine-code-grid" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }} dir="ltr">
          {Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
            const cell: BlockCell = [x, y]
            const isWall = walls.some((wall) => sameCell(wall, cell))
            const isStart = sameCell(grid.start, cell)
            const isGoal = sameCell(grid.goal, cell)
            const isCollect = collectibles.some((entry) => sameCell(entry, cell))
            const onPath = pathCells.has(`${x},${y}`)
            const classes = ['engine-code-cell']
            if (isWall) classes.push('engine-code-cell--wall')
            if (isStart) classes.push('engine-code-cell--start')
            if (isGoal) classes.push('engine-code-cell--goal')
            if (isCollect) classes.push('engine-code-cell--collect')
            if (onPath) classes.push('engine-code-cell--path')
            const label = [
              `${x},${y}`,
              isWall ? text.tools.wall : '',
              isStart ? text.tools.start : '',
              isGoal ? text.tools.goal : '',
              isCollect ? text.tools.collect : '',
            ].filter(Boolean).join(' · ')
            return (
              <button
                type="button"
                className={classes.join(' ')}
                key={`${x}-${y}`}
                aria-label={label}
                title={label}
                onClick={() => paint(cell)}
              >
                {isStart ? text.start : isGoal ? text.goalCell : isCollect ? '★' : ''}
              </button>
            )
          }))}
        </div>
      </EditorSection>

      <EditorSection title={text.allowed} hint={text.allowedHint}>
        <div className="engine-field__row engine-field__row--wrap">
          {BLOCK_TOKENS.map((token) => {
            const checked = allowed.includes(token)
            return (
              <label className="checkbox-control" key={token}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...allowed, token]
                      : allowed.filter((entry) => entry !== token)
                    patch({
                      allowed_blocks: next,
                      // منع أمر يستخدمه الحلّ المرجعي يُنقّيه معه: حلٌّ يستخدم
                      // أمرًا غير مسموح يرفضه الخادم.
                      reference_solution: reference.filter((entry) => next.includes((entry.split(':')[0] ?? '') as BlockToken)),
                    })
                  }}
                />
                <span>{text.blocks[token]} <code dir="ltr">{token}</code></span>
              </label>
            )
          })}
        </div>
      </EditorSection>

      <EditorSection title={text.limits}>
        <div className="form-grid form-grid--three">
          <label className="field">
            <span>{text.blockLimit}</span>
            <input type="number" dir="ltr" min="3" max="24" value={level.block_limit ?? 6} onChange={(event) => patch({ block_limit: Number(event.target.value) })} />
          </label>
          <label className="field">
            <span>{text.optimal}</span>
            <input type="number" dir="ltr" min="2" max="24" value={level.optimal_blocks ?? 3} onChange={(event) => patch({ optimal_blocks: Number(event.target.value) })} />
            <small>{text.optimalHint}</small>
          </label>
          <label className="field">
            <span>{text.stepDelay}</span>
            <input type="number" dir="ltr" min="200" max="1200" step="50" value={level.step_delay_ms ?? 600} onChange={(event) => patch({ step_delay_ms: Number(event.target.value) })} />
            <small>{text.stepDelayHint}</small>
          </label>
        </div>
        <label className="checkbox-control">
          <input type="checkbox" checked={level.show_grid_coordinates === true} onChange={(event) => patch({ show_grid_coordinates: event.target.checked })} />
          <span>{text.coordinates}</span>
        </label>
      </EditorSection>

      <EditorSection
        title={`${text.reference} (${reference.length}/${level.block_limit ?? 24})`}
        hint={text.referenceHint}
        actions={
          <>
            {allowed.map((token) => (
              <button className="button button--ghost" type="button" key={token} onClick={() => addToken(token)}>
                <Icon name="plus" size={14} />{text.blocks[token]}
              </button>
            ))}
          </>
        }
      >
        {!reference.length && <p className="data-unavailable">{text.empty}</p>}
        <ol className="engine-program">
          {reference.map((token, index) => {
            const [kind, count] = token.split(':')
            return (
              <li key={index}>
                <span className="engine-strip__index">{index + 1}</span>
                <strong>{text.blocks[kind ?? ''] ?? kind}</strong>
                {kind === 'repeat' && (
                  <label className="engine-program__count">
                    <span>{text.repeatCount}</span>
                    <input
                      type="number" dir="ltr" min="2" max="9" value={Number(count) || 2}
                      onChange={(event) => patch({
                        reference_solution: reference.map((entry, position) => (position === index ? `repeat:${Number(event.target.value)}` : entry)),
                      })}
                    />
                  </label>
                )}
                <button
                  className="icon-button icon-button--small icon-button--danger" type="button"
                  title={text.remove} aria-label={`${text.remove} ${index + 1}`}
                  onClick={() => patch({ reference_solution: reference.filter((_, position) => position !== index) })}
                ><Icon name="close" size={13} /></button>
              </li>
            )
          })}
        </ol>
        {outcome && (
          <div className={outcome.reachedGoal ? 'inline-alert inline-alert--info' : 'inline-alert inline-alert--error'}>
            <strong>{text.run}: {outcome.reachedGoal ? text.reached : text.notReached}</strong>
            <p>
              {text.endsAt(outcome.x, outcome.y)}
              {outcome.collided ? ` · ${text.collided}` : ''}
              {collectibles.length ? ` · ${text.collected(outcome.collected, collectibles.length)}` : ''}
              {` · ${text.steps(outcome.steps)}`}
            </p>
          </div>
        )}
      </EditorSection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// sim_lab
// ---------------------------------------------------------------------------

export function SimLabEditor({ level, onChange }: { level: SimLabLevel; onChange: (level: SimLabLevel) => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const variables = level.variables ?? []
  const relationships = level.expected_relationships ?? {}
  const hypotheses = level.hypothesis_options ?? []
  const explanations = level.explanation_options ?? []
  const patch = (next: Partial<SimLabLevel>) => onChange({ ...level, ...next })

  function addVariable() {
    const id = `var_${variables.length + 1}`
    const variable: SimVariable = {
      id,
      label_key: `game.sim_lab.level_${level.level}.${id}_label`,
      min: 0,
      max: 10,
      step: 1,
      unit_key: `game.sim_lab.level_${level.level}.${id}_unit`,
    }
    // العلاقة تُنشأ مع المتغيّر لا بعده: الجدولان يبقيان متطابقين بالبناء.
    patch({
      variables: [...variables, variable],
      expected_relationships: { ...relationships, [id]: 'positive' },
    })
  }

  function patchVariable(index: number, next: Partial<SimVariable>) {
    const current = variables[index]
    if (!current) return
    const updated = { ...current, ...next }
    const nextRelationships = { ...relationships }
    if (next.id && next.id !== current.id) {
      nextRelationships[next.id] = relationships[current.id] ?? 'positive'
      delete nextRelationships[current.id]
    }
    patch({
      variables: variables.map((entry, position) => (position === index ? updated : entry)),
      expected_relationships: nextRelationships,
    })
  }

  function removeVariable(index: number) {
    const current = variables[index]
    if (!current) return
    if (!confirmRemoval(locale, `${text.addVariable} ${current.id}`)) return
    const nextRelationships = { ...relationships }
    delete nextRelationships[current.id]
    patch({
      variables: variables.filter((_, position) => position !== index),
      expected_relationships: nextRelationships,
    })
  }

  const ids = variables.map((variable) => variable.id)
  const duplicate = new Set(ids).size !== ids.length
  const allNone = ids.length > 0 && ids.every((id) => relationships[id] === 'none')
  const measured = level.measured ?? { id: 'result', label_key: '', unit_key: '' }

  return (
    <div className="engine-editor">
      <div className="form-grid form-grid--three">
        <label className="field">
          <span>{text.sim}</span>
          <select value={level.sim ?? 'plant_growth'} onChange={(event) => patch({ sim: event.target.value as SimLabLevel['sim'] })}>
            {SIM_KINDS.map((value) => <option value={value} key={value}>{text.sims[value]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{text.minTrials}</span>
          <input type="number" dir="ltr" min="2" max="6" value={level.min_trials_before_explain ?? 3} onChange={(event) => patch({ min_trials_before_explain: Number(event.target.value) })} />
          <small>{text.minTrialsHint}</small>
        </label>
        <label className="checkbox-control">
          <input type="checkbox" checked disabled readOnly />
          <span>{text.resultsTable}</span>
        </label>
      </div>
      <p className="engine-note">{text.resultsTableLocked}</p>

      <div className="form-grid form-grid--three">
        <label className="field">
          <span>{text.supervision}</span>
          <select value={level.supervision_level ?? 'none'} onChange={(event) => patch({ supervision_level: event.target.value as SimLabLevel['supervision_level'] })}>
            {SUPERVISION_LEVELS.map((value) => <option value={value} key={value}>{text.supervisions[value]}</option>)}
          </select>
        </label>
        {level.supervision_level === 'required' && (
          <KeyField
            label={text.safetyNote}
            value={level.safety_note_key ?? ''}
            onChange={(value) => patch({ safety_note_key: value || null })}
            required
            hint={text.safetyNoteHint}
            suggest={`game.sim_lab.level_${level.level}.safety`}
          />
        )}
      </div>

      <EditorSection title={text.measured} hint={text.measuredHint}>
        <div className="form-grid form-grid--three">
          <label className="field">
            <span>{text.variableId}</span>
            <input dir="ltr" value={measured.id} onChange={(event) => patch({ measured: { ...measured, id: event.target.value.trim() } })} />
          </label>
          <KeyField label={text.label} value={measured.label_key} onChange={(value) => patch({ measured: { ...measured, label_key: value } })} required suggest={`game.sim_lab.level_${level.level}.measured_label`} />
          <KeyField label={text.unit} value={measured.unit_key} onChange={(value) => patch({ measured: { ...measured, unit_key: value } })} required suggest={`game.sim_lab.level_${level.level}.measured_unit`} />
        </div>
      </EditorSection>

      <EditorSection
        title={`${text.variables} (${variables.length}/3)`}
        hint={text.variablesHint}
        actions={<button className="button button--secondary" type="button" onClick={addVariable} disabled={variables.length >= 3}><Icon name="plus" size={15} />{text.addVariable}</button>}
      >
        {duplicate && <p className="inline-alert inline-alert--error">{text.duplicateId}</p>}
        {allNone && <p className="inline-alert inline-alert--error">{text.allNone}</p>}
        {variables.map((variable, index) => (
          <EditorCard
            key={`${variable.id}-${index}`}
            title={<code dir="ltr">{variable.id}</code>}
            removeLabel={text.remove}
            onRemove={() => removeVariable(index)}
          >
            <div className="form-grid form-grid--three">
              <label className="field">
                <span>{text.variableId}</span>
                <input dir="ltr" value={variable.id} onChange={(event) => patchVariable(index, { id: event.target.value.trim() })} />
              </label>
              <KeyField label={text.label} value={variable.label_key} onChange={(value) => patchVariable(index, { label_key: value })} required suggest={`game.sim_lab.level_${level.level}.${variable.id}_label`} />
              <KeyField label={text.unit} value={variable.unit_key} onChange={(value) => patchVariable(index, { unit_key: value })} required suggest={`game.sim_lab.level_${level.level}.${variable.id}_unit`} />
            </div>
            <div className="form-grid form-grid--three">
              <label className="field">
                <span>{text.min}</span>
                <input type="number" dir="ltr" value={variable.min ?? 0} onChange={(event) => patchVariable(index, { min: Number(event.target.value) })} />
              </label>
              <label className="field">
                <span>{text.max}</span>
                <input type="number" dir="ltr" value={variable.max ?? 0} onChange={(event) => patchVariable(index, { max: Number(event.target.value) })} />
              </label>
              <label className="field">
                <span>{text.step}</span>
                <input type="number" dir="ltr" min="0" step="0.1" value={variable.step ?? 1} onChange={(event) => patchVariable(index, { step: Number(event.target.value) })} />
              </label>
            </div>
            <label className="field">
              <span>{text.relationship}</span>
              <select
                value={relationships[variable.id] ?? 'positive'}
                onChange={(event) => patch({ expected_relationships: { ...relationships, [variable.id]: event.target.value as SimRelationship } })}
              >
                {SIM_RELATIONSHIPS.map((value) => <option value={value} key={value}>{text.relationships[value]}</option>)}
              </select>
              <small>{text.relationshipHint}</small>
            </label>
          </EditorCard>
        ))}
      </EditorSection>

      <EditorSection
        title={`${text.hypotheses} (${hypotheses.length}/4)`}
        hint={text.hypothesesHint}
        actions={
          <button
            className="button button--ghost" type="button" disabled={hypotheses.length >= 4}
            onClick={() => patch({ hypothesis_options: [...hypotheses, ''] })}
          ><Icon name="plus" size={15} />{text.addHypothesis}</button>
        }
      >
        {hypotheses.map((option, index) => (
          <div className="form-grid" key={index}>
            <KeyField
              label={`${text.hypotheses} ${index + 1}`}
              value={option}
              onChange={(value) => patch({ hypothesis_options: hypotheses.map((entry, position) => (position === index ? value : entry)) })}
              required
              suggest={`game.sim_lab.level_${level.level}.hypothesis_${index + 1}`}
            />
            <button
              className="button button--ghost" type="button"
              onClick={() => patch({ hypothesis_options: hypotheses.filter((_, position) => position !== index) })}
            ><Icon name="close" size={14} />{text.remove}</button>
          </div>
        ))}
      </EditorSection>

      <EditorSection
        title={`${text.explanations} (${explanations.length}/4)`}
        hint={text.explanationsHint}
        actions={
          <button
            className="button button--ghost" type="button" disabled={explanations.length >= 4}
            onClick={() => patch({ explanation_options: [...explanations, ''] })}
          ><Icon name="plus" size={15} />{text.addExplanation}</button>
        }
      >
        {explanations.map((option, index) => (
          <div className="form-grid form-grid--three" key={index}>
            <KeyField
              label={`${text.explanations} ${index + 1}`}
              value={option}
              onChange={(value) => patch({
                explanation_options: explanations.map((entry, position) => (position === index ? value : entry)),
                explanation_answer: level.explanation_answer === option ? value : level.explanation_answer,
              })}
              required
              suggest={`game.sim_lab.level_${level.level}.explanation_${index + 1}`}
            />
            <div className="field">
              <span>{text.correct}</span>
              <label className="checkbox-control">
                <input
                  type="radio"
                  name={`sim-explanation-${level.level}`}
                  checked={level.explanation_answer === option && !!option}
                  onChange={() => patch({ explanation_answer: option })}
                />
                <span>{text.pick}</span>
              </label>
            </div>
            <div className="field">
              <span>&nbsp;</span>
              <button
                className="button button--ghost" type="button"
                onClick={() => {
                  const next = explanations.filter((_, position) => position !== index)
                  patch({
                    explanation_options: next,
                    explanation_answer: level.explanation_answer === option ? next[0] ?? '' : level.explanation_answer,
                  })
                }}
              ><Icon name="close" size={14} />{text.remove}</button>
            </div>
          </div>
        ))}
      </EditorSection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// timeline_map
// ---------------------------------------------------------------------------

export function TimelineMapEditor({ level, onChange }: { level: TimelineMapLevel; onChange: (level: TimelineMapLevel) => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const mode = level.mode ?? 'timeline'
  const events = level.events ?? []
  const [selected, setSelected] = useState(0)
  const patch = (next: Partial<TimelineMapLevel>) => onChange({ ...level, ...next })

  const needsYear = mode === 'timeline' || mode === 'both'
  const needsPlace = mode === 'map' || mode === 'both'
  const timeline = level.timeline ?? { from: 600, to: 1500, unit: 'gregorian_year' as const, display_calendar: 'auto' as const, anchors: [] }
  const map = level.map ?? { region: 'middle_east_north_africa', projection: 'equirectangular' as const, mirror_in_rtl: false as const }
  const bounds = boundsForRegion(map.region)
  const anchors = timeline.anchors ?? []

  /// تبديل النمط يبني الكتلة التي يفرضها المخطَّط للنمط الجديد.
  function switchMode(next: TimelineMapLevel['mode']) {
    patch({
      mode: next,
      timeline: next === 'map' ? level.timeline : timeline,
      map: next === 'timeline' ? level.map : map,
    })
  }

  function addEvent() {
    const id = nextId(events.map((event) => event.id), 'e')
    const event: TimelineEvent = {
      id,
      label_key: `game.timeline_map.level_${level.level}.event_${id}`,
      image: '',
    }
    if (needsYear) {
      event.year = Math.round((timeline.from + timeline.to) / 2)
      event.tolerance_years = 50
    }
    if (needsPlace) {
      event.lat = Math.round(((bounds.minLat + bounds.maxLat) / 2) * 100) / 100
      event.lon = Math.round(((bounds.minLon + bounds.maxLon) / 2) * 100) / 100
      event.tolerance_km = 200
    }
    patch({ events: [...events, event] })
    setSelected(events.length)
  }

  const patchEvent = (index: number, next: Partial<TimelineEvent>) =>
    patch({ events: events.map((entry, position) => (position === index ? { ...entry, ...next } : entry)) })

  const current = events[Math.min(selected, Math.max(events.length - 1, 0))]
  const yearRatio = (year: number) => (year - timeline.from) / Math.max(1, timeline.to - timeline.from)

  function onRailPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!current || !needsYear) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    patchEvent(events.indexOf(current), { year: Math.round(timeline.from + ratio * (timeline.to - timeline.from)) })
  }

  function onMapPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!current || !needsPlace) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    patchEvent(events.indexOf(current), {
      // الإسقاط متساوي المستطيلات: خطّ الطول خطّي أفقيًا وخطّ العرض خطّي رأسيًا
      // ومقلوب (الشمال أعلى). هذا هو ما يرسمه المحرّك، فأي إسقاط آخر هنا يعني
      // موضعًا يراه المحرّر مختلفًا عمّا يراه الطفل.
      lon: Math.round((bounds.minLon + x * (bounds.maxLon - bounds.minLon)) * 100) / 100,
      lat: Math.round((bounds.maxLat - y * (bounds.maxLat - bounds.minLat)) * 100) / 100,
    })
  }

  return (
    <div className="engine-editor">
      <div className="form-grid form-grid--three">
        <label className="field">
          <span>{text.mode}</span>
          <select value={mode} onChange={(event) => switchMode(event.target.value as TimelineMapLevel['mode'])}>
            {TIMELINE_MODES.map((value) => <option value={value} key={value}>{text.modes[value]}</option>)}
          </select>
        </label>
        <label className="checkbox-control">
          <input type="checkbox" checked={level.show_reference_anchor !== false} onChange={(event) => patch({ show_reference_anchor: event.target.checked })} />
          <span>{text.showAnchor}</span>
        </label>
      </div>

      {needsYear && (
        <EditorSection title={text.timeline} hint={text.railHint}>
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.from}</span>
              <input type="number" dir="ltr" value={timeline.from} onChange={(event) => patch({ timeline: { ...timeline, from: Number(event.target.value) } })} />
            </label>
            <label className="field">
              <span>{text.to}</span>
              <input type="number" dir="ltr" value={timeline.to} onChange={(event) => patch({ timeline: { ...timeline, to: Number(event.target.value) } })} />
            </label>
            <label className="field">
              <span>{text.calendar}</span>
              <select value={timeline.display_calendar} onChange={(event) => patch({ timeline: { ...timeline, display_calendar: event.target.value as typeof timeline.display_calendar } })}>
                {DISPLAY_CALENDARS.map((value) => <option value={value} key={value}>{text.calendars[value]}</option>)}
              </select>
              <small>{text.calendarNote}</small>
            </label>
          </div>

          <div
            className="engine-rail"
            dir="ltr"
            role="button"
            tabIndex={0}
            aria-label={text.railHint}
            onPointerDown={onRailPointerDown}
            onKeyDown={(event) => {
              if (!current || !needsYear) return
              const stepBy = event.shiftKey ? 50 : 10
              if (event.key === 'ArrowRight') {
                event.preventDefault()
                patchEvent(events.indexOf(current), { year: Math.min(timeline.to, (current.year ?? timeline.from) + stepBy) })
              }
              if (event.key === 'ArrowLeft') {
                event.preventDefault()
                patchEvent(events.indexOf(current), { year: Math.max(timeline.from, (current.year ?? timeline.from) - stepBy) })
              }
            }}
          >
            <span className="engine-rail__end">{timeline.from}</span>
            <span className="engine-rail__end engine-rail__end--to">{timeline.to}</span>
            {anchors.map((anchor, index) => (
              <span className="engine-rail__anchor" style={{ left: `${yearRatio(anchor.year) * 100}%` }} key={index} title={`${anchor.year}`} />
            ))}
            {events.map((event, index) => (
              event.year === undefined ? null : (
                <span
                  className={event === current ? 'engine-rail__event engine-rail__event--current' : 'engine-rail__event'}
                  style={{ left: `${Math.min(100, Math.max(0, yearRatio(event.year) * 100))}%` }}
                  key={event.id}
                  title={`${event.id} · ${event.year}`}
                >{index + 1}</span>
              )
            ))}
          </div>
          {current?.year !== undefined && (current.year < timeline.from || current.year > timeline.to) && (
            <p className="inline-alert inline-alert--error">{text.outsideRail}</p>
          )}

          <EditorSection
            title={`${text.anchors} (${anchors.length}/3)`}
            hint={text.anchorsHint}
            actions={
              <button
                className="button button--ghost" type="button" disabled={anchors.length >= 3}
                onClick={() => patch({ timeline: { ...timeline, anchors: [...anchors, { year: Math.round((timeline.from + timeline.to) / 2), label_key: `game.timeline_map.level_${level.level}.anchor_${anchors.length + 1}` }] } })}
              ><Icon name="plus" size={15} />{text.addAnchor}</button>
            }
          >
            {anchors.map((anchor, index) => (
              <div className="form-grid form-grid--three" key={index}>
                <label className="field">
                  <span>{text.year}</span>
                  <input
                    type="number" dir="ltr" value={anchor.year}
                    onChange={(event) => patch({ timeline: { ...timeline, anchors: anchors.map((entry, position) => (position === index ? { ...entry, year: Number(event.target.value) } : entry)) } })}
                  />
                </label>
                <KeyField
                  label={text.label}
                  value={anchor.label_key}
                  onChange={(value) => patch({ timeline: { ...timeline, anchors: anchors.map((entry, position) => (position === index ? { ...entry, label_key: value } : entry)) } })}
                  required
                />
                <div className="field">
                  <span>&nbsp;</span>
                  <button
                    className="button button--ghost" type="button"
                    onClick={() => patch({ timeline: { ...timeline, anchors: anchors.filter((_, position) => position !== index) } })}
                  ><Icon name="close" size={14} />{text.remove}</button>
                </div>
              </div>
            ))}
          </EditorSection>
        </EditorSection>
      )}

      {needsPlace && (
        <EditorSection title={text.map} hint={text.mapHint}>
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.region}</span>
              <select value={map.region} onChange={(event) => patch({ map: { ...map, region: event.target.value } })}>
                {KNOWN_REGIONS.map((value) => <option value={value} key={value}>{value}</option>)}
              </select>
              <small>{text.regionHint}</small>
            </label>
            <div className="field">
              <span>{text.projection}</span>
              <strong dir="ltr">equirectangular</strong>
            </div>
            <div className="field">
              <span>{text.mirror}</span>
              <strong>false</strong>
              <small>{text.mirrorLocked}</small>
            </div>
          </div>

          <div
            className="engine-map"
            dir="ltr"
            role="button"
            tabIndex={0}
            aria-label={text.mapHint}
            onPointerDown={onMapPointerDown}
          >
            <span className="engine-map__bounds" dir="ltr">
              {bounds.minLat}..{bounds.maxLat} · {bounds.minLon}..{bounds.maxLon}
            </span>
            {events.map((event, index) => (
              event.lat === undefined || event.lon === undefined ? null : (
                <span
                  className={event === current ? 'engine-map__pin engine-map__pin--current' : 'engine-map__pin'}
                  style={{
                    left: `${((event.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 100}%`,
                    top: `${((bounds.maxLat - event.lat) / (bounds.maxLat - bounds.minLat)) * 100}%`,
                  }}
                  key={event.id}
                  title={`${event.id} · ${event.lat}, ${event.lon}`}
                >{index + 1}</span>
              )
            ))}
          </div>
          {current?.lat !== undefined && current?.lon !== undefined
            && (current.lat < bounds.minLat || current.lat > bounds.maxLat || current.lon < bounds.minLon || current.lon > bounds.maxLon) && (
            <p className="inline-alert inline-alert--error">{text.outsideMap}</p>
          )}
        </EditorSection>
      )}

      <EditorSection
        title={`${text.events} (${events.length}/5)`}
        hint={text.eventsHint}
        actions={<button className="button button--secondary" type="button" onClick={addEvent} disabled={events.length >= 5}><Icon name="plus" size={15} />{text.addEvent}</button>}
      >
        {!events.length && <p className="data-unavailable">{text.noEvent}</p>}
        {events.map((event, index) => (
          <EditorCard
            key={event.id}
            badge={<AssetThumb assetId={event.image} size={44} />}
            title={
              <>
                <code dir="ltr">{event.id}</code>
                {event === current && <span className="library-pill library-pill--age">{text.selected}</span>}
              </>
            }
            tone={event === current ? 'default' : 'default'}
            removeLabel={text.remove}
            onRemove={() => {
              if (!confirmRemoval(locale, `${text.addEvent} ${event.id}`)) return
              patch({ events: events.filter((_, position) => position !== index) })
              setSelected(0)
            }}
          >
            <div className="trace-editor__row">
              <button
                className={event === current ? 'button button--secondary is-active' : 'button button--ghost'}
                type="button" aria-pressed={event === current} onClick={() => setSelected(index)}
              >{text.select}</button>
            </div>
            <div className="form-grid form-grid--three">
              <AssetField label={text.map} kind="image" value={event.image} onChange={(value) => patchEvent(index, { image: value })} required />
              <KeyField label={text.label} value={event.label_key} onChange={(value) => patchEvent(index, { label_key: value })} required suggest={`game.timeline_map.level_${level.level}.event_${event.id}`} />
              <KeyField label={text.explainKey} value={event.explain_key} onChange={(value) => patchEvent(index, { explain_key: value || undefined })} />
            </div>
            {needsYear && (
              <div className="form-grid form-grid--three">
                <label className="field">
                  <span>{text.year}</span>
                  <input type="number" dir="ltr" value={event.year ?? ''} onChange={(changed) => patchEvent(index, { year: Number(changed.target.value) })} />
                </label>
                <label className="field">
                  <span>{text.toleranceYears}</span>
                  <input type="number" dir="ltr" min="10" max="200" value={event.tolerance_years ?? ''} onChange={(changed) => patchEvent(index, { tolerance_years: Number(changed.target.value) })} />
                </label>
              </div>
            )}
            {needsPlace && (
              <div className="form-grid form-grid--three">
                <label className="field">
                  <span>{text.lat}</span>
                  <input type="number" dir="ltr" step="0.01" min="-90" max="90" value={event.lat ?? ''} onChange={(changed) => patchEvent(index, { lat: Number(changed.target.value) })} />
                </label>
                <label className="field">
                  <span>{text.lon}</span>
                  <input type="number" dir="ltr" step="0.01" min="-180" max="180" value={event.lon ?? ''} onChange={(changed) => patchEvent(index, { lon: Number(changed.target.value) })} />
                </label>
                <label className="field">
                  <span>{text.toleranceKm}</span>
                  <input type="number" dir="ltr" min="50" max="500" value={event.tolerance_km ?? ''} onChange={(changed) => patchEvent(index, { tolerance_km: Number(changed.target.value) })} />
                </label>
              </div>
            )}
          </EditorCard>
        ))}
      </EditorSection>
    </div>
  )
}
