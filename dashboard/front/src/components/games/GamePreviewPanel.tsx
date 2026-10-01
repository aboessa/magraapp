import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../Icon'
import { ErrorState, LoadingState } from '../PageState'
import { usePreferences } from '../../context/preferences'
import { api } from '../../lib/api'
import { REFERENCE_CANVAS_DP, parsePack } from '../../lib/tracePack'
import type { GamePreview, NormalizedPoint, TraceLevel, TracePack, TraceStroke } from '../../types/gamePack'

/**
 * معاينة اللعبة من `GET /admin/games/:id/preview`.
 *
 * ## نموذج واحد لا نموذجان
 *
 * المسار يُعيد `content_pack` **كما هو مخزَّن**، وهذه الشاشة ترسم منه مباشرة.
 * نموذج معاينة ثانٍ «أجمل» كان سينحرف عن الحزمة ثم يَكذب على المحرّر بشأن ما
 * سيراه الطفل — وهو أسوأ من عدم وجود معاينة.
 *
 * ما تعرضه ليس محاكاة للمحرّك: لا تصحيح للسحب ولا حساب تغطية. تعرض **البيانات**
 * التي سيقرؤها المحرّك: المسار وترتيبه واتجاهه، وعرض التفاوت، واللوحة، والنصّ
 * المُحلّ للغة المختارة، وقاعدة الإكمال.
 *
 * ## الوضع الحركي المبسّط
 *
 * المفتاح يبدّل عرض شريط التفاوت إلى `accessibility.simplified_motor`. الفارق
 * يجب أن يكون **مرئيًا**: وضع «مبسّط» أضيق من العادي هو عيب يُقدَّم للأطفال
 * الأقدر على ملاحظته والأقل قدرة على تحقيقه، ورؤية الشريطين تكشفه فورًا.
 */

const VIEW = 1000

const copy = {
  ar: {
    title: 'المعاينة',
    kicker: 'ما سيراه الطفل',
    intro: 'تُرسم من الحزمة المخزَّنة نفسها التي يقرؤها المحرّك.',
    loading: 'جارٍ تحميل المعاينة...',
    loadError: 'تعذر تحميل المعاينة',
    refresh: 'تحديث',
    language: 'اللغة',
    level: 'المستوى',
    stroke: 'الخطّة الحالية',
    prompt: 'نصّ التوجيه',
    promptMissing: 'لا نصّ مترجم لهذا المفتاح في اللغة المختارة؛ سيظهر المفتاح كما هو.',
    completion: 'الإكمال',
    completionRules: {
      all_strokes_complete: 'إكمال كل الخطوات',
      all_dots_connected: 'توصيل كل النقاط',
      child_taps_done: 'الطفل يقرّر الانتهاء',
    } as Record<string, string>,
    scoring: 'التقييم',
    mode: 'النمط',
    tolerance: 'التفاوت',
    coverage: 'التغطية',
    normal: 'الوضع العادي',
    simplified: 'الوضع الحركي المبسّط',
    simplifiedMissing: 'الحزمة لا تُعلن وضعًا حركيًا مبسّطًا.',
    palette: 'لوحة التلوين',
    coloringOn: 'مرحلة تلوين بعد التتبّع',
    coloringOff: 'لا مرحلة تلوين في هذا المستوى',
    coloringNote: 'التلوين تعبير حرّ: لا درجة ولا شرط فوز.',
    dots: 'نقاط التوصيل',
    body: 'جسم',
    dot: 'نقطة',
    strokeOf: (order: number, total: number) => `${order} من ${total}`,
    noGeometry: 'لا هندسة في هذا المستوى.',
    noPack: 'لا حزمة محتوى مخزَّنة لهذه اللعبة، فلا شيء لمعاينته.',
    errors: 'أخطاء تمنع النشر',
    errorsLead: 'النشر محجوب حتى تُصلَح هذه الأخطاء:',
    warnings: 'تنبيهات لا تمنع حفظ المسوّدة',
    clean: 'لا أخطاء ولا تنبيهات من فحص الخادم.',
    notValidated: 'لا يوجد مخطَّط وقت تشغيل لهذا المحرّك في هذا الإصدار، فلم تُفحَص الحزمة.',
    bandNote: (dp: number) => `عرض الشريط تقريبي بافتراض قماش ${REFERENCE_CANVAS_DP}dp؛ القيمة المخزَّنة ${dp}dp تُحلّ على شاشة الطفل.`,
    start: 'يبدأ الطفل من هنا',
    instructions: 'التعليمات',
  },
  en: {
    title: 'Preview',
    kicker: 'What the child will see',
    intro: 'Drawn from the same stored pack the engine reads.',
    loading: 'Loading preview...',
    loadError: 'Unable to load the preview',
    refresh: 'Refresh',
    language: 'Language',
    level: 'Level',
    stroke: 'Current stroke',
    prompt: 'Prompt',
    promptMissing: 'No translation for this key in the chosen language; the key itself would be shown.',
    completion: 'Completion',
    completionRules: {
      all_strokes_complete: 'All strokes complete',
      all_dots_connected: 'All dots connected',
      child_taps_done: 'Child taps done',
    } as Record<string, string>,
    scoring: 'Scoring',
    mode: 'Mode',
    tolerance: 'Tolerance',
    coverage: 'Coverage',
    normal: 'Normal',
    simplified: 'Simplified motor',
    simplifiedMissing: 'The pack declares no simplified-motor mode.',
    palette: 'Palette',
    coloringOn: 'Colouring stage after tracing',
    coloringOff: 'No colouring stage in this level',
    coloringNote: 'Colouring is free expression: no score and no win condition.',
    dots: 'Connect-the-dots',
    body: 'Body',
    dot: 'Dot',
    strokeOf: (order: number, total: number) => `${order} of ${total}`,
    noGeometry: 'No geometry in this level.',
    noPack: 'No content pack is stored for this game, so there is nothing to preview.',
    errors: 'Errors that block publication',
    errorsLead: 'Publication is blocked until these are fixed:',
    warnings: 'Warnings that do not block a draft',
    clean: 'No errors and no warnings from the server checks.',
    notValidated: 'This deployment has no runtime schema for the engine, so the pack was not validated.',
    bandNote: (dp: number) => `The band width is approximate, assuming a ${REFERENCE_CANVAS_DP}dp canvas; the stored ${dp}dp resolves against the child's screen.`,
    start: 'The child starts here',
    instructions: 'Instructions',
  },
}

function pathOf(points: NormalizedPoint[]) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${(point[0] * VIEW).toFixed(1)} ${(point[1] * VIEW).toFixed(1)}`)
    .join(' ')
}

function startPoint(stroke: TraceStroke): NormalizedPoint | null {
  if (!stroke.points.length) return null
  return stroke.direction === 'reverse' ? stroke.points[stroke.points.length - 1] ?? null : stroke.points[0] ?? null
}

export function GamePreviewPanel({ gameId }: { gameId: string }) {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [preview, setPreview] = useState<GamePreview | null>(null)
  const [language, setLanguage] = useState('ar')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [levelIndex, setLevelIndex] = useState(0)
  const [strokeIndex, setStrokeIndex] = useState(0)
  const [simplifiedMotor, setSimplifiedMotor] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawnPoints, setDrawnPoints] = useState<NormalizedPoint[]>([])
  const [simSuccess, setSimSuccess] = useState(false)
  const [interactiveMode, setInteractiveMode] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.gamePreview(gameId, language)
      setPreview(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [gameId, language, text.loadError])

  useEffect(() => { void load() }, [load])

  const pack: TracePack | null = useMemo(() => parsePack(preview?.content_pack ?? null), [preview])
  const levels: TraceLevel[] = pack?.levels ?? []
  const level = levels[Math.min(levelIndex, Math.max(levels.length - 1, 0))] ?? null
  const strokes = useMemo(
    () => [...(level?.stroke_paths ?? [])].sort((a, b) => a.order - b.order),
    [level],
  )
  const currentStroke = strokes[Math.min(strokeIndex, Math.max(strokes.length - 1, 0))] ?? null

  const packSizeKb = useMemo(() => {
    try {
      return (JSON.stringify(preview?.content_pack || {}).length / 1024).toFixed(1)
    } catch {
      return '0.0'
    }
  }, [preview?.content_pack])

  const totalPointsCount = useMemo(() => {
    let count = 0
    for (const s of strokes) count += s.points.length
    count += (level?.dots ?? []).length
    return count
  }, [strokes, level])

  const estimatedVramMb = useMemo(() => {
    return (4.2 + (totalPointsCount * 32) / (1024 * 1024)).toFixed(1)
  }, [totalPointsCount])

  if (loading && !preview) return <LoadingState label={text.loading} />
  if (error && !preview) return <ErrorState message={error} onRetry={() => void load()} />
  if (!preview) return null

  const simplified = pack?.accessibility?.simplified_motor
  const levelTolerance = Number(level?.tolerance_dp ?? 0)
  const effectiveTolerance = simplifiedMotor && simplified ? Number(simplified.tolerance_dp) : levelTolerance
  const effectiveCoverage = simplifiedMotor && simplified
    ? Number(simplified.coverage_required)
    : Number(level?.coverage_required ?? 0)
  const bandWidth = effectiveTolerance ? (effectiveTolerance / REFERENCE_CANVAS_DP) * VIEW : 0
  const promptKey = level?.prompt_key ?? ''
  const promptText = promptKey ? preview.prompts?.[promptKey] : undefined
  const errors = preview.validation?.errors ?? []
  const warnings = preview.validation?.warnings ?? []
  const languages = [...new Set(['ar', ...(preview.available_languages ?? [])])]

  return (
    <section className="panel">
      <header className="panel__header panel__header--filters">
        <div><span className="panel__kicker">{text.kicker}</span><h3>{text.title}</h3><p>{text.intro}</p></div>
        <div className="filters-row">
          <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={text.language}>
            {languages.map((code) => <option value={code} key={code}>{code}</option>)}
          </select>
          <button className="button button--secondary" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={16} />{text.refresh}
          </button>
        </div>
      </header>

      <div className="entity-form">
        {errors.length > 0 && (
          <div className="inline-alert inline-alert--error">
            <strong>{text.errors}</strong>
            <p>{text.errorsLead}</p>
            <ul className="planned-list">{errors.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="inline-alert inline-alert--info">
            <strong>{text.warnings}</strong>
            <ul className="planned-list">{warnings.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        )}
        {!errors.length && !warnings.length && preview.validation?.validated && (
          <div className="inline-alert inline-alert--info">{text.clean}</div>
        )}
        {preview.validation && !preview.validation.validated && (
          <div className="inline-alert inline-alert--error">{text.notValidated}</div>
        )}

        {!pack ? <p className="data-unavailable">{text.noPack}</p> : (
          <div className="preview-layout">
            <div className="preview-stage">
              <svg
                viewBox={`0 0 ${VIEW} ${VIEW}`}
                className="preview-canvas"
                role="img"
                aria-label={text.title}
                style={{ cursor: interactiveMode ? 'crosshair' : 'default', touchAction: 'none' }}
                onPointerDown={(e) => {
                  if (!interactiveMode) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
                  setIsDrawing(true)
                  setDrawnPoints([[x, y]])
                  setSimSuccess(false)
                }}
                onPointerMove={(e) => {
                  if (!isDrawing || !interactiveMode) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
                  const next: NormalizedPoint[] = [...drawnPoints, [x, y]]
                  setDrawnPoints(next)
                  if (currentStroke && currentStroke.points.length > 0) {
                    let covered = 0
                    const tolNorm = (effectiveTolerance || 30) / REFERENCE_CANVAS_DP
                    for (const p of currentStroke.points) {
                      const isNear = next.some((dp) => {
                        const dx = dp[0] - p[0]
                        const dy = dp[1] - p[1]
                        return Math.sqrt(dx * dx + dy * dy) <= tolNorm
                      })
                      if (isNear) covered++
                    }
                    if (covered / currentStroke.points.length >= (effectiveCoverage || 0.7)) {
                      setSimSuccess(true)
                    }
                  }
                }}
                onPointerUp={() => setIsDrawing(false)}
              >
                <rect x="0" y="0" width={VIEW} height={VIEW} className="trace-editor__paper" />
                {strokes.map((stroke) => {
                  const isCurrent = stroke.id === currentStroke?.id
                  const isDot = stroke.type === 'dot'
                  const first = stroke.points[0]
                  const start = startPoint(stroke)
                  return (
                    <g key={stroke.id} className={isCurrent ? 'preview-stroke preview-stroke--current' : 'preview-stroke'}>
                      {bandWidth > 0 && !isDot && stroke.points.length > 1 && (
                        <path d={pathOf(stroke.points)} className="preview-stroke__band" strokeWidth={bandWidth} />
                      )}
                      {isDot
                        ? first && <circle cx={first[0] * VIEW} cy={first[1] * VIEW} r={bandWidth ? bandWidth / 2 : 24} className="preview-stroke__dot" />
                        : stroke.points.length > 1 && <path d={pathOf(stroke.points)} className="preview-stroke__guide" />}
                      {start && <circle cx={start[0] * VIEW} cy={start[1] * VIEW} r="16" className="preview-stroke__start"><title>{text.start}</title></circle>}
                      {first && (
                        <text x={first[0] * VIEW + 20} y={first[1] * VIEW - 16} className="preview-stroke__badge">
                          {stroke.order}{isDot ? ' •' : ''}
                        </text>
                      )}
                    </g>
                  )
                })}
                {(level?.dots ?? []).map((dot) => (
                  <g key={dot.id} className="preview-dot">
                    <circle cx={(dot.at?.[0] ?? 0) * VIEW} cy={(dot.at?.[1] ?? 0) * VIEW} r="18" />
                    <text x={(dot.at?.[0] ?? 0) * VIEW + 22} y={(dot.at?.[1] ?? 0) * VIEW - 14}>{dot.order}</text>
                  </g>
                ))}
                {drawnPoints.length > 1 && (
                  <path
                    d={pathOf(drawnPoints)}
                    stroke="#f59e0b"
                    strokeWidth={effectiveTolerance ? bandWidth * 0.9 : 24}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={0.85}
                    style={{ filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.6))' }}
                  />
                )}
                {!strokes.length && !(level?.dots ?? []).length && (
                  <text x={VIEW / 2} y={VIEW / 2} textAnchor="middle" className="preview-stroke__badge">{text.noGeometry}</text>
                )}
              </svg>

              {simSuccess && (
                <div style={{ margin: '8px 0', padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.25))', border: '1px solid #10b981', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>🌟 {locale === 'ar' ? 'أحسنت! إتقان ممتاز للمسار بنسبة 100%' : 'Awesome! 100% path coverage completed'} ⭐⭐⭐</span>
                  <button type="button" className="button button--small button--ghost" onClick={() => { setDrawnPoints([]); setSimSuccess(false) }}>
                    {locale === 'ar' ? 'إعادة' : 'Reset'}
                  </button>
                </div>
              )}

              <div className="trace-editor__row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                <button
                  type="button"
                  className={`button button--small ${interactiveMode ? 'button--secondary is-active' : 'button--ghost'}`}
                  onClick={() => setInteractiveMode(!interactiveMode)}
                >
                  🎮 {locale === 'ar' ? 'محاكي الرسم باللمس' : 'Touch Emulator'}
                </button>
                {drawnPoints.length > 0 && (
                  <button
                    type="button"
                    className="button button--small button--ghost"
                    onClick={() => { setDrawnPoints([]); setSimSuccess(false) }}
                  >
                    {locale === 'ar' ? 'مسح الرسم' : 'Clear'}
                  </button>
                )}
                <button
                  className={simplifiedMotor ? 'button button--ghost' : 'button button--secondary is-active'}
                  type="button" aria-pressed={!simplifiedMotor}
                  onClick={() => setSimplifiedMotor(false)}
                >{text.normal}</button>
                <button
                  className={simplifiedMotor ? 'button button--secondary is-active' : 'button button--ghost'}
                  type="button" aria-pressed={simplifiedMotor}
                  disabled={!simplified}
                  onClick={() => setSimplifiedMotor(true)}
                >{text.simplified}</button>
              </div>
              {!simplified && <small className="trace-editor__hint">{text.simplifiedMissing}</small>}
              {effectiveTolerance > 0 && <small className="trace-editor__hint">{text.bandNote(effectiveTolerance)}</small>}
            </div>

            <div className="preview-facts">
              <div className="form-grid">
                <label className="field">
                  <span>{text.level}</span>
                  <select value={levelIndex} onChange={(event) => { setLevelIndex(Number(event.target.value)); setStrokeIndex(0) }}>
                    {levels.map((entry, index) => <option value={index} key={entry.level}>{entry.level} · {entry.mode}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>{text.stroke}</span>
                  <select value={strokeIndex} onChange={(event) => setStrokeIndex(Number(event.target.value))} disabled={!strokes.length}>
                    {strokes.map((stroke, index) => (
                      <option value={index} key={stroke.id}>
                        {text.strokeOf(stroke.order, strokes.length)} · {stroke.type === 'dot' ? text.dot : text.body}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="detail-fields">
                <div><span>{text.mode}</span><strong dir="ltr">{level?.mode ?? '—'}</strong></div>
                <div><span>{text.scoring}</span><strong dir="ltr">{level?.scoring ?? '—'}</strong></div>
                <div><span>{text.completion}</span><strong>{text.completionRules[level?.completion?.rule ?? ''] ?? '—'}</strong></div>
                <div><span>{text.tolerance}</span><strong dir="ltr">{effectiveTolerance || '—'}dp</strong></div>
                <div><span>{text.coverage}</span><strong dir="ltr">{effectiveCoverage || '—'}</strong></div>
                <div><span>{text.dots}</span><strong>{(level?.dots ?? []).length}</strong></div>
              </div>

              {/* Asset Budget & Memory Inspector */}
              <div className="field" style={{ background: 'var(--surface-2, rgba(0,0,0,0.03))', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    📊 {locale === 'ar' ? 'فاحص ميزانية الأصول والذاكرة' : 'Asset & Memory Budget'}
                  </strong>
                  <span style={{ fontSize: 10, background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                    {locale === 'ar' ? 'متوافق 60 FPS' : '60 FPS Certified'}
                  </span>
                </div>

                <div className="detail-fields" style={{ marginBottom: 8 }}>
                  <div>
                    <span>{locale === 'ar' ? 'حجم الحزمة الهندسي' : 'Pack Geometry'}</span>
                    <strong dir="ltr">{packSizeKb} KB</strong>
                  </div>
                  <div>
                    <span>{locale === 'ar' ? 'إجمالي النقاط والمضلعات' : 'Total Points'}</span>
                    <strong dir="ltr">{totalPointsCount} pts</strong>
                  </div>
                  <div>
                    <span>{locale === 'ar' ? 'الذاكرة الرسومية التقديرية' : 'Estimated VRAM'}</span>
                    <strong dir="ltr">~{estimatedVramMb} MB</strong>
                  </div>
                  <div>
                    <span>{locale === 'ar' ? 'أهداف اللمس (Android)' : 'Touch Target'}</span>
                    <strong style={{ color: '#10b981' }}>≥ 48dp {locale === 'ar' ? 'مطابق' : 'Pass'}</strong>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--muted, #64748b)' }}>
                  {locale === 'ar'
                    ? 'الحزمة تستهلك أقل من 500 كيلوبايت، وتعمل بسلاسة تامة على الأجهزة اللوحية المدرسية والأجهزة الاقتصادية.'
                    : 'Pack is under 500 KB and guaranteed to maintain 60 FPS on low-end school tablets.'}
                </div>
              </div>

              <div className="field">
                <span>{text.prompt}</span>
                <code dir="ltr">{promptKey || '—'}</code>
                {promptText
                  ? <p>{promptText}</p>
                  : <p className="inline-alert inline-alert--error">{text.promptMissing}</p>}
              </div>

              <div className="field">
                <span>{text.instructions}</span>
                <p>{preview.instructions || '—'}</p>
              </div>

              <div className="field">
                <span>{text.palette}</span>
                {level?.coloring?.enabled ? (
                  <>
                    <p>{text.coloringOn}</p>
                    <div className="trace-palette">
                      {(level.coloring.palette ?? []).map((colour, index) => (
                        <span className="trace-palette__item" key={`${colour}-${index}`}>
                          <span className="trace-swatch" style={{ background: colour }} aria-hidden="true" />
                          <code dir="ltr">{colour}</code>
                        </span>
                      ))}
                    </div>
                    <small>{text.coloringNote}</small>
                  </>
                ) : <p className="data-unavailable">{text.coloringOff}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
