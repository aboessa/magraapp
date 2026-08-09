import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from '../Icon'
import { usePreferences } from '../../context/preferences'
import { api } from '../../lib/api'
import {
  MAX_STROKES_PER_LEVEL,
  REFERENCE_CANVAS_DP,
  nextStrokeId,
  normalizePoint,
  renumberStrokes,
  simplifyPath,
  strokeIssues,
} from '../../lib/tracePack'
import { LETTER_FORMS, WRITING_DIRECTIONS } from '../../types/gamePack'
import type {
  LetterForm,
  NormalizedPoint,
  StrokeKind,
  TraceMode,
  TraceStroke,
  WritingDirection,
} from '../../types/gamePack'

/**
 * محرّر مسارات الرسم: قماش مربّع هو فضاء الحزمة 0..1 نفسه.
 *
 * ## العلّة التي يُغلقها
 *
 * الهندسة الوحيدة المؤلَّفة في المنصّة كُتبت يدويًا داخل SQL: قوائم إحداثيّات
 * بثلاث خانات عشرية لكل نقطة. تأليف حرف جديد بهذه الطريقة يعني تخيّل شكله
 * بالأرقام، ومراجعته تعني قراءة أرقام. أي محرّر محتوى — وهو المستخدم المقصود —
 * لا يستطيع ذلك، فبقيت الألعاب حبيسة من يكتب SQL.
 *
 * القماش هنا **هو** فضاء الحزمة: viewBox من 0 إلى 1000 يُقسم على 1000، فلا
 * تحويل ولا نظام إحداثيّات ثانٍ يمكن أن ينحرف.
 *
 * ## ما لا يفعله هذا المحرّر
 *
 * **لا يمنح صحّة لغوية.** ترتيب رسم الحرف العربي حكم لغوي، وهذه الأداة ترسم ما
 * يُملى عليها. تنبيه «الجسم قبل النقطة» يُعرض ولا يُصلَح تلقائيًا: الإصلاح
 * الصامت يعني أداةً تدّعي معرفة لا تملكها. الاعتماد يبقى بمراجعة عربية معتمدة
 * تُسجَّل في `review.linguistic_review` ويقرؤها مسار الجاهزية.
 *
 * ## لماذا pointer events لا مكتبة رسم
 *
 * `pointerdown/move/up` تغطّي الفأرة والقلم واللمس بمسار واحد، و
 * `setPointerCapture` يُبقي السحب متّصلًا حتى لو خرج المؤشّر عن القماش. أي
 * مكتبة رسم كانت ستضيف تبعية لأجل ما تفعله المتصفّحات أصلًا.
 */

const VIEW = 1000
/// أقصى عدد نقاط لخطّة واحدة. السحب يولّد نقاطًا بلا حدّ، والحزمة تُخزَّن في
/// عمود واحد في D1: حدٌّ صريح أفضل من حزمة بحجم غير متوقَّع.
const MAX_POINTS_PER_STROKE = 400
/// أدنى مسافة (في فضاء 0..1) بين نقطتين متتاليتين أثناء السحب. بلا هذا الحدّ
/// يُسجَّل حدث حركة لكل بكسل، فتصير الخطّة مئات النقاط المتلاصقة.
const MIN_POINT_GAP = 0.012

type Tool = 'add' | 'move' | 'delete'

const copy = {
  ar: {
    title: 'محرّر مسار الرسم',
    intro: 'القماش هو فضاء الحزمة 0..1. اسحب لإضافة نقاط إلى الخطّة المحدَّدة.',
    tools: 'الأداة',
    toolAdd: 'إضافة نقاط',
    toolMove: 'تحريك نقطة',
    toolDelete: 'حذف نقطة',
    strokes: 'الخطوات',
    addStroke: 'خطّة جديدة',
    addDot: 'نقطة حرف',
    stroke: 'خطّة',
    dot: 'نقطة',
    body: 'جسم',
    type: 'النوع',
    direction: 'الاتجاه',
    forward: 'من البداية',
    reverse: 'بالعكس',
    points: 'نقاط',
    up: 'تقديم',
    down: 'تأخير',
    remove: 'حذف الخطّة',
    select: 'تحديد',
    undo: 'تراجع',
    redo: 'إعادة',
    removeLastPoint: 'حذف آخر نقطة',
    clear: 'مسح الكل',
    clearConfirm: 'سيُمسح كل مسار الرسم في هذا المستوى. متابعة؟',
    removeStrokeConfirm: 'ستُحذف هذه الخطّة ونقاطها. متابعة؟',
    simplify: 'تبسيط',
    simplifyAll: 'تبسيط كل الخطوات',
    tolerance: 'حدّ التبسيط',
    toleranceHint: 'أكبر انحراف مسموح عند حذف نقطة، بوحدات 0..1.',
    grid: 'محاذاة إلى شبكة 0.05',
    reference: 'صورة مرجعية',
    referenceHint: 'تُعرض تحت القماش للتتبّع فقط ولا تُحفَظ في الحزمة.',
    referenceClear: 'إزالة المرجع',
    opacity: 'شفافية المرجع',
    band: 'شريط التفاوت',
    bandHint: (dp: number) => `يُرسم بافتراض قماش ${REFERENCE_CANVAS_DP}dp؛ العرض الفعلي عند الطفل يتغيّر بحجم شاشته (${dp}dp).`,
    empty: 'لا خطوات بعد. أضف خطّة ثم اسحب على القماش.',
    noSelection: 'حدّد خطّة أولًا.',
    letterIdentity: 'هويّة الحرف',
    glyph: 'الرسم (الحرف أو الرقم)',
    language: 'اللغة',
    letterForm: 'صورة الحرف',
    writingDirection: 'اتجاه الكتابة',
    letterForms: { isolated: 'منفصل', initial: 'أوّل', medial: 'وسط', final: 'آخر' } as Record<LetterForm, string>,
    directions: { rtl: 'من اليمين إلى اليسار', ltr: 'من اليسار إلى اليمين' } as Record<WritingDirection, string>,
    reviewNotice:
      'ترتيب رسم الحروف حكم لغوي. هذه الأداة ترسم ما يُملى عليها ولا تمنح اعتمادًا: '
      + 'النشر يظلّ محجوبًا حتى تُسجَّل مراجعة عربية معتمدة في review.linguistic_review.',
    dotHint: 'النقطة تُلمَس ولا تُسحَب، فتحمل نقطة واحدة بالضبط؛ إضافة نقطة أخرى تستبدلها.',
    issues: 'تنبيهات الهندسة',
    coordinates: 'الإحداثيّات',
    startMarker: 'نقطة البداية عند الطفل',
  },
  en: {
    title: 'Stroke path editor',
    intro: 'The canvas is the pack space 0..1. Drag to add points to the selected stroke.',
    tools: 'Tool',
    toolAdd: 'Add points',
    toolMove: 'Move a point',
    toolDelete: 'Delete a point',
    strokes: 'Strokes',
    addStroke: 'New stroke',
    addDot: 'Letter dot',
    stroke: 'Stroke',
    dot: 'Dot',
    body: 'Body',
    type: 'Type',
    direction: 'Direction',
    forward: 'Forward',
    reverse: 'Reverse',
    points: 'points',
    up: 'Earlier',
    down: 'Later',
    remove: 'Delete stroke',
    select: 'Select',
    undo: 'Undo',
    redo: 'Redo',
    removeLastPoint: 'Delete last point',
    clear: 'Clear all',
    clearConfirm: 'Every stroke path in this level will be cleared. Continue?',
    removeStrokeConfirm: 'This stroke and its points will be deleted. Continue?',
    simplify: 'Simplify',
    simplifyAll: 'Simplify every stroke',
    tolerance: 'Simplify tolerance',
    toleranceHint: 'Largest deviation allowed when dropping a point, in 0..1 units.',
    grid: 'Snap to a 0.05 grid',
    reference: 'Reference image',
    referenceHint: 'Shown under the canvas for tracing only; never stored in the pack.',
    referenceClear: 'Remove reference',
    opacity: 'Reference opacity',
    band: 'Tolerance band',
    bandHint: (dp: number) => `Drawn assuming a ${REFERENCE_CANVAS_DP}dp canvas; the real width on a child's device scales with the screen (${dp}dp).`,
    empty: 'No strokes yet. Add a stroke, then drag on the canvas.',
    noSelection: 'Select a stroke first.',
    letterIdentity: 'Letter identity',
    glyph: 'Glyph (letter or digit)',
    language: 'Language',
    letterForm: 'Letter form',
    writingDirection: 'Writing direction',
    letterForms: { isolated: 'Isolated', initial: 'Initial', medial: 'Medial', final: 'Final' } as Record<LetterForm, string>,
    directions: { rtl: 'Right to left', ltr: 'Left to right' } as Record<WritingDirection, string>,
    reviewNotice:
      'Arabic stroke order is a linguistic judgement. This tool draws what it is told and grants no approval: '
      + 'publication stays blocked until an approved Arabic review is recorded in review.linguistic_review.',
    dotHint: 'A dot is tapped, not dragged, so it holds exactly one point; adding another replaces it.',
    issues: 'Geometry warnings',
    coordinates: 'Coordinates',
    startMarker: 'Where the child starts',
  },
}

export interface StrokeMeta {
  glyph?: string
  language?: string
  letter_form?: LetterForm
  writing_direction?: WritingDirection
}

export interface TracePathEditorProps {
  strokes: TraceStroke[]
  onChange: (strokes: TraceStroke[]) => void
  mode: TraceMode
  toleranceDp?: number
  meta?: StrokeMeta
  onMetaChange?: (meta: StrokeMeta) => void
  /// `background_asset` أو `coloring.template_asset` من المستوى، يُعرض للتتبّع.
  backgroundAssetId?: string | null
}

function snap(value: number, enabled: boolean) {
  return enabled ? Math.round(value * 20) / 20 : value
}

export function TracePathEditor(props: TracePathEditorProps) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const { strokes, onChange, mode, meta, onMetaChange } = props

  const [activeId, setActiveId] = useState<string | null>(strokes[0]?.id ?? null)
  const [tool, setTool] = useState<Tool>('add')
  const [tolerance, setTolerance] = useState(0.012)
  const [gridSnap, setGridSnap] = useState(false)
  const [opacity, setOpacity] = useState(50)
  const [past, setPast] = useState<TraceStroke[][]>([])
  const [future, setFuture] = useState<TraceStroke[][]>([])
  const [referenceUrl, setReferenceUrl] = useState('')
  const [localReferenceUrl, setLocalReferenceUrl] = useState('')

  const svgRef = useRef<SVGSVGElement | null>(null)
  /// حالة السحب الحالية. تُحفَظ في ref لا في state: حدث الحركة يسبق إعادة
  /// التصيير، فقراءة النقاط من state تُنتج نقاطًا مفقودة عند السحب السريع.
  const dragRef = useRef<{
    strokeId: string
    base: TraceStroke[]
    startPoints: NormalizedPoint[]
    added: NormalizedPoint[]
    handleIndex: number | null
  } | null>(null)

  const active = strokes.find((stroke) => stroke.id === activeId) ?? null

  useEffect(() => {
    // الخطّة المحدَّدة قد تُحذف من الخارج (تغيير مستوى مثلًا)
    if (activeId && !strokes.some((stroke) => stroke.id === activeId)) {
      setActiveId(strokes[0]?.id ?? null)
    }
  }, [activeId, strokes])

  useEffect(() => {
    const assetId = props.backgroundAssetId
    setReferenceUrl('')
    if (!assetId) return
    let live = true
    let objectUrl = ''
    void api.assetBlob(assetId).then((blob) => {
      if (!live) return
      objectUrl = URL.createObjectURL(blob)
      setReferenceUrl(objectUrl)
    }).catch(() => setReferenceUrl(''))
    return () => {
      live = false
      // كل معاينة تحتجز ذاكرة حتى تُحرَّر
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [props.backgroundAssetId])

  useEffect(() => () => { if (localReferenceUrl) URL.revokeObjectURL(localReferenceUrl) }, [localReferenceUrl])

  const commit = useCallback((next: TraceStroke[], previous: TraceStroke[]) => {
    // خمسون خطوة تراجع تكفي جلسة تأليف وتمنع نموّ الذاكرة بلا حدّ
    setPast((entries) => [...entries.slice(-49), previous])
    setFuture([])
    onChange(next)
  }, [onChange])

  const update = useCallback((next: TraceStroke[]) => commit(next, strokes), [commit, strokes])

  function undo() {
    const previous = past[past.length - 1]
    if (!previous) return
    setPast(past.slice(0, -1))
    setFuture([strokes, ...future])
    onChange(previous)
  }

  function redo() {
    const next = future[0]
    if (!next) return
    setFuture(future.slice(1))
    setPast([...past, strokes])
    onChange(next)
  }

  function pointFrom(event: ReactPointerEvent<SVGElement>): NormalizedPoint {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return [0, 0]
    // القياس من المستطيل الفعلي لا من عرض CSS: الاتجاه من اليمين لليسار لا
    // يقلب محتوى SVG، وclientX يبقى مقاسًا من حافة الشاشة اليسرى في الحالتين.
    const x = snap((event.clientX - rect.left) / rect.width, gridSnap)
    const y = snap((event.clientY - rect.top) / rect.height, gridSnap)
    return normalizePoint(x, y)
  }

  function addStroke(type: StrokeKind) {
    const id = nextStrokeId(strokes)
    const next = renumberStrokes([...strokes, { id, order: strokes.length + 1, points: [], type, direction: 'forward' }])
    update(next)
    setActiveId(id)
  }

  function patchStroke(id: string, patch: Partial<TraceStroke>) {
    update(strokes.map((stroke) => (stroke.id === id ? { ...stroke, ...patch } : stroke)))
  }

  function removeStroke(id: string) {
    if (!window.confirm(text.removeStrokeConfirm)) return
    update(renumberStrokes(strokes.filter((stroke) => stroke.id !== id)))
  }

  /// إعادة الترتيب تُعيد الترقيم 1..n فورًا: الخادم يرفض الفراغ في الترتيب لأن
  /// المحرّك يسير عليه، فخطوة برقم مفقود تصير غير قابلة للوصول.
  function moveStroke(id: string, offset: number) {
    const ordered = [...strokes].sort((a, b) => a.order - b.order)
    const index = ordered.findIndex((stroke) => stroke.id === id)
    const target = index + offset
    if (index < 0 || target < 0 || target >= ordered.length) return
    const moved = ordered[index]
    const displaced = ordered[target]
    if (!moved || !displaced) return
    ordered[index] = displaced
    ordered[target] = moved
    update(renumberStrokes(ordered))
  }

  function setPoints(id: string, points: NormalizedPoint[]) {
    patchStroke(id, { points })
  }

  function removeLastPoint() {
    if (!active || !active.points.length) return
    setPoints(active.id, active.points.slice(0, -1))
  }

  function clearAll() {
    if (!strokes.length) return
    if (!window.confirm(text.clearConfirm)) return
    update([])
    setActiveId(null)
  }

  function simplifyStroke(id: string) {
    const stroke = strokes.find((entry) => entry.id === id)
    if (!stroke || stroke.type === 'dot' || stroke.points.length < 3) return
    setPoints(id, simplifyPath(stroke.points, tolerance).map((point) => normalizePoint(point[0], point[1])))
  }

  function simplifyEvery() {
    update(strokes.map((stroke) => (
      stroke.type === 'dot' || stroke.points.length < 3
        ? stroke
        : { ...stroke, points: simplifyPath(stroke.points, tolerance).map((point) => normalizePoint(point[0], point[1])) }
    )))
  }

  function onCanvasPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (tool !== 'add' || !active) return
    const point = pointFrom(event)
    event.currentTarget.setPointerCapture(event.pointerId)

    // النقطة تحمل نقطة واحدة بالضبط: الإضافة تستبدل ولا تُلحق، لأن خطّة نقطة
    // بنقطتين يرفضها الخادم ولا يستطيع الطفل تحقيقها أصلًا.
    if (active.type === 'dot') {
      dragRef.current = null
      commit(strokes.map((stroke) => (stroke.id === active.id ? { ...stroke, points: [point] } : stroke)), strokes)
      return
    }

    dragRef.current = {
      strokeId: active.id,
      base: strokes,
      startPoints: active.points,
      added: [point],
      handleIndex: null,
    }
    onChange(strokes.map((stroke) => (
      stroke.id === active.id ? { ...stroke, points: [...active.points, point] } : stroke
    )))
  }

  function onCanvasPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag) return
    const point = pointFrom(event)

    if (drag.handleIndex !== null) {
      const points = [...drag.startPoints]
      points[drag.handleIndex] = point
      onChange(drag.base.map((stroke) => (stroke.id === drag.strokeId ? { ...stroke, points } : stroke)))
      return
    }

    const last = drag.added[drag.added.length - 1]
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_POINT_GAP) return
    if (drag.startPoints.length + drag.added.length >= MAX_POINTS_PER_STROKE) return
    drag.added.push(point)
    const points = [...drag.startPoints, ...drag.added]
    onChange(drag.base.map((stroke) => (stroke.id === drag.strokeId ? { ...stroke, points } : stroke)))
  }

  function endDrag(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    // خطوة تراجع واحدة للسحب كله لا واحدة لكل نقطة
    setPast((entries) => [...entries.slice(-49), drag.base])
    setFuture([])
  }

  function onHandlePointerDown(event: ReactPointerEvent<SVGCircleElement>, stroke: TraceStroke, index: number) {
    if (tool === 'add') return
    event.stopPropagation()
    setActiveId(stroke.id)

    if (tool === 'delete') {
      update(strokes.map((entry) => (
        entry.id === stroke.id ? { ...entry, points: entry.points.filter((_, position) => position !== index) } : entry
      )))
      return
    }

    const svg = svgRef.current
    if (svg) svg.setPointerCapture(event.pointerId)
    dragRef.current = {
      strokeId: stroke.id,
      base: strokes,
      startPoints: stroke.points,
      added: [],
      handleIndex: index,
    }
  }

  const ordered = useMemo(() => [...strokes].sort((a, b) => a.order - b.order), [strokes])
  const issues = useMemo(() => strokeIssues(strokes, mode, locale), [strokes, mode, locale])
  const toleranceDp = props.toleranceDp ?? 0
  /// نصف عرض الشريط بوحدات viewBox. النسبة إلى قماش مرجعي لأن dp تُحلّ على شاشة
  /// الطفل وقت التشغيل: هذا تقريب صادق لا قياس نهائي.
  const bandWidth = toleranceDp ? (toleranceDp / REFERENCE_CANVAS_DP) * VIEW : 0
  const showLetterIdentity = mode === 'letter' || mode === 'number'
  const background = localReferenceUrl || referenceUrl

  function pathOf(stroke: TraceStroke) {
    return stroke.points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${(point[0] * VIEW).toFixed(1)} ${(point[1] * VIEW).toFixed(1)}`)
      .join(' ')
  }

  /// النقطة التي يبدأ منها الطفل: أوّل نقطة في الاتجاه المُعلَن لا أوّل نقطة
  /// مؤلَّفة. الاتجاه بيانات في الحزمة، فيجب أن يُرى أثره هنا.
  function startPoint(stroke: TraceStroke): NormalizedPoint | null {
    if (!stroke.points.length) return null
    return stroke.direction === 'reverse'
      ? stroke.points[stroke.points.length - 1] ?? null
      : stroke.points[0] ?? null
  }

  return (
    <div className="trace-editor">
      <div className="trace-editor__stage">
        <svg
          ref={svgRef}
          className="trace-editor__canvas"
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          role="application"
          aria-label={text.title}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <rect x="0" y="0" width={VIEW} height={VIEW} className="trace-editor__paper" />
          {background && (
            <image
              href={background}
              x="0" y="0" width={VIEW} height={VIEW}
              opacity={opacity / 100}
              preserveAspectRatio="xMidYMid slice"
            />
          )}
          <g className="trace-editor__grid" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => (index + 1) * (VIEW / 10)).map((offset) => (
              <g key={offset}>
                <line x1={offset} y1="0" x2={offset} y2={VIEW} />
                <line x1="0" y1={offset} x2={VIEW} y2={offset} />
              </g>
            ))}
          </g>

          {ordered.map((stroke) => {
            const isActive = stroke.id === activeId
            const isDot = stroke.type === 'dot'
            const first = stroke.points[0]
            const start = startPoint(stroke)
            return (
              <g key={stroke.id} className={isActive ? 'trace-path trace-path--active' : 'trace-path'}>
                {bandWidth > 0 && !isDot && stroke.points.length > 1 && (
                  <path d={pathOf(stroke)} className="trace-path__band" strokeWidth={bandWidth} />
                )}
                {isDot
                  ? first && <circle cx={first[0] * VIEW} cy={first[1] * VIEW} r={bandWidth ? bandWidth / 2 : 26} className="trace-path__dot" />
                  : stroke.points.length > 1 && <path d={pathOf(stroke)} className="trace-path__line" />}
                {start && (
                  <circle cx={start[0] * VIEW} cy={start[1] * VIEW} r="20" className="trace-path__start">
                    <title>{text.startMarker}</title>
                  </circle>
                )}
                {stroke.points.map((point, index) => (
                  <circle
                    key={`${stroke.id}-${index}`}
                    cx={point[0] * VIEW}
                    cy={point[1] * VIEW}
                    r={isActive ? 11 : 8}
                    className="trace-path__handle"
                    onPointerDown={(event) => onHandlePointerDown(event, stroke, index)}
                  />
                ))}
                {first && (
                  <text x={first[0] * VIEW + 22} y={first[1] * VIEW - 18} className="trace-path__badge">
                    {stroke.order}{isDot ? ' •' : ''}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        <div className="trace-editor__tools">
          <fieldset className="trace-editor__group">
            <legend>{text.tools}</legend>
            <div className="trace-editor__row">
              {([['add', text.toolAdd], ['move', text.toolMove], ['delete', text.toolDelete]] as Array<[Tool, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={tool === value ? 'button button--secondary is-active' : 'button button--ghost'}
                  aria-pressed={tool === value}
                  onClick={() => setTool(value)}
                >{label}</button>
              ))}
            </div>
            <div className="trace-editor__row">
              <button className="button button--ghost" type="button" onClick={undo} disabled={!past.length}>
                <Icon name="refresh" size={15} />{text.undo}
              </button>
              <button className="button button--ghost" type="button" onClick={redo} disabled={!future.length}>
                <Icon name="refresh" size={15} />{text.redo}
              </button>
              <button className="button button--ghost" type="button" onClick={removeLastPoint} disabled={!active?.points.length}>
                {text.removeLastPoint}
              </button>
              <button className="button button--ghost" type="button" onClick={clearAll} disabled={!strokes.length}>
                <Icon name="archive" size={15} />{text.clear}
              </button>
            </div>
          </fieldset>

          <fieldset className="trace-editor__group">
            <legend>{text.simplify}</legend>
            <label className="field">
              <span>{text.tolerance} <small dir="ltr">{tolerance.toFixed(3)}</small></span>
              <input
                type="range" min="0.002" max="0.06" step="0.002"
                value={tolerance}
                onChange={(event) => setTolerance(Number(event.target.value))}
              />
              <small>{text.toleranceHint}</small>
            </label>
            <div className="trace-editor__row">
              <button className="button button--secondary" type="button" onClick={() => active && simplifyStroke(active.id)} disabled={!active || active.type === 'dot' || active.points.length < 3}>
                {text.simplify}
              </button>
              <button className="button button--ghost" type="button" onClick={simplifyEvery} disabled={!strokes.length}>
                {text.simplifyAll}
              </button>
            </div>
            <label className="checkbox-control">
              <input type="checkbox" checked={gridSnap} onChange={(event) => setGridSnap(event.target.checked)} />
              <span>{text.grid}</span>
            </label>
          </fieldset>

          <fieldset className="trace-editor__group">
            <legend>{text.reference}</legend>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (localReferenceUrl) URL.revokeObjectURL(localReferenceUrl)
                setLocalReferenceUrl(file ? URL.createObjectURL(file) : '')
              }}
            />
            <small>{text.referenceHint}</small>
            {localReferenceUrl && (
              <button className="button button--ghost" type="button" onClick={() => { URL.revokeObjectURL(localReferenceUrl); setLocalReferenceUrl('') }}>
                {text.referenceClear}
              </button>
            )}
            <label className="field">
              <span>{text.opacity} <small dir="ltr">{opacity}%</small></span>
              <input type="range" min="0" max="100" step="5" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} />
            </label>
            {toleranceDp > 0 && <p className="trace-editor__hint">{text.band}: {text.bandHint(toleranceDp)}</p>}
          </fieldset>
        </div>
      </div>

      <div className="trace-editor__strokes">
        <header className="trace-editor__strokes-head">
          <strong>{text.strokes} <span className="title-count">{strokes.length}/{MAX_STROKES_PER_LEVEL}</span></strong>
          <div className="trace-editor__row">
            <button className="button button--primary" type="button" onClick={() => addStroke('stroke')}>
              <Icon name="plus" size={15} />{text.addStroke}
            </button>
            <button className="button button--secondary" type="button" onClick={() => addStroke('dot')}>
              <Icon name="plus" size={15} />{text.addDot}
            </button>
          </div>
        </header>

        {!strokes.length && <p className="data-unavailable">{text.empty}</p>}

        {ordered.map((stroke) => {
          const isActive = stroke.id === activeId
          const isDot = stroke.type === 'dot'
          return (
            <article className={isActive ? 'trace-stroke trace-stroke--active' : 'trace-stroke'} key={stroke.id}>
              <header>
                <button className="button button--ghost" type="button" onClick={() => setActiveId(stroke.id)} aria-pressed={isActive}>
                  <span className="trace-stroke__order">{stroke.order}</span>
                  <span dir="ltr">{stroke.id}</span>
                  <span className={isDot ? 'library-pill library-pill--paid' : 'library-pill library-pill--age'}>
                    {isDot ? text.dot : text.body}
                  </span>
                  <span className="table-secondary">{stroke.points.length} {text.points}</span>
                </button>
                <div className="table-actions">
                  <button className="icon-button icon-button--small" type="button" title={text.up} onClick={() => moveStroke(stroke.id, -1)} disabled={stroke.order <= 1}>▲</button>
                  <button className="icon-button icon-button--small" type="button" title={text.down} onClick={() => moveStroke(stroke.id, 1)} disabled={stroke.order >= strokes.length}>▼</button>
                  <button className="icon-button icon-button--small icon-button--danger" type="button" title={text.remove} onClick={() => removeStroke(stroke.id)}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              </header>
              <div className="form-grid">
                <label className="field">
                  <span>{text.type}</span>
                  <select
                    value={stroke.type ?? 'stroke'}
                    onChange={(event) => {
                      const nextType = event.target.value as StrokeKind
                      // التحويل إلى نقطة يُبقي نقطة واحدة: خطّة نقطة بنقطتين
                      // يرفضها الخادم، وحذف الزائد صراحةً أوضح من تركه ليُرفض.
                      const points = nextType === 'dot' && stroke.points.length > 1
                        ? stroke.points.slice(0, 1)
                        : stroke.points
                      patchStroke(stroke.id, { type: nextType, points })
                    }}
                  >
                    <option value="stroke">{text.body}</option>
                    <option value="dot">{text.dot}</option>
                  </select>
                  {isDot && <small>{text.dotHint}</small>}
                </label>
                <label className="field">
                  <span>{text.direction}</span>
                  <select
                    value={stroke.direction ?? 'forward'}
                    onChange={(event) => patchStroke(stroke.id, { direction: event.target.value as TraceStroke['direction'] })}
                  >
                    <option value="forward">{text.forward}</option>
                    <option value="reverse">{text.reverse}</option>
                  </select>
                </label>
              </div>
              {isActive && stroke.points.length > 0 && (
                <p className="trace-stroke__coords" dir="ltr">
                  <span>{text.coordinates}: </span>
                  {stroke.points.map((point) => `[${point[0]},${point[1]}]`).join(' ')}
                </p>
              )}
            </article>
          )
        })}

        {!active && strokes.length > 0 && <p className="inline-alert inline-alert--info">{text.noSelection}</p>}
      </div>

      {showLetterIdentity && (
        <section className="trace-editor__identity">
          <h4>{text.letterIdentity}</h4>
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.glyph}</span>
              <input
                maxLength={4}
                value={meta?.glyph ?? ''}
                onChange={(event) => onMetaChange?.({ ...meta, glyph: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{text.language}</span>
              <input
                dir="ltr" placeholder="ar"
                value={meta?.language ?? ''}
                onChange={(event) => onMetaChange?.({ ...meta, language: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{text.writingDirection}</span>
              <select
                value={meta?.writing_direction ?? ''}
                onChange={(event) => onMetaChange?.({ ...meta, writing_direction: (event.target.value || undefined) as WritingDirection | undefined })}
              >
                <option value="">—</option>
                {WRITING_DIRECTIONS.map((value) => <option value={value} key={value}>{text.directions[value]}</option>)}
              </select>
            </label>
          </div>
          {mode === 'letter' && (
            <label className="field">
              <span>{text.letterForm}</span>
              <select
                value={meta?.letter_form ?? ''}
                onChange={(event) => onMetaChange?.({ ...meta, letter_form: (event.target.value || undefined) as LetterForm | undefined })}
              >
                <option value="">—</option>
                {LETTER_FORMS.map((value) => <option value={value} key={value}>{text.letterForms[value]}</option>)}
              </select>
            </label>
          )}
          {mode === 'letter' && <p className="panel--notice trace-editor__notice">{text.reviewNotice}</p>}
        </section>
      )}

      {issues.length > 0 && (
        <section className="trace-editor__issues">
          <h4>{text.issues}</h4>
          <ul className="planned-list">
            {issues.map((issue) => <li className="pack-issue pack-issue--error" key={issue}>{issue}</li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
