import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { ViewSwitcher, useStoredViewMode } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'
import { EmptyState, ErrorState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import { hasPermission } from '../lib/adminSession'
import { useUrlListState } from '../hooks/useUrlListState'
import type { GameDifficulty, GameEngineRecord, GamePayload, GameRecord, ContentStatus, InteractionMode, ReadingLevel, SupervisionLevel } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'مكتبة المحتوى / الألعاب التفاعلية',
    title: 'استوديو الألعاب',
    intro: 'استوديو إنتاج وهندسة ألعاب الأطفال: محركات الألعاب، مستويات الرسم، الأهداف التربوية، واختبار وقت التشغيل السريع.',
    create: 'لعبة جديدة',
    search: 'بحث باسم اللعبة أو المحرك...',
    engine: 'المحرك',
    status: 'الحالة',
    total: 'إجمالي الألعاب',
    ready: 'جاهزة للتشغيل',
    blocked: 'قيد التطوير والإنتاج',
    enginesCount: 'محركات مدعومة',
    open: 'مساحة العمل',
    play: 'تجربة اللعب',
    colGame: 'اللعبة',
    colEngine: 'المحرك',
    colLevels: 'المستويات',
    colObjective: 'الهدف التربوي',
    colRuntime: 'التشغيل',
    colStatus: 'الحالة',
    empty: 'لا توجد ألعاب مسجلة',
    noMatch: 'لا توجد نتائج مطابقة لبحثك',
    clear: 'مسح الفلاتر',
    loading: 'جارٍ تحميل الألعاب والمحركات...',
    all: 'الكل',
    allEngines: 'جميع المحركات',
    levelsCount: (n: number) => `${n} مستويات`,
    createDenied: 'إنشاء الألعاب يحتاج صلاحية المشرف',
    saveGame: 'حفظ اللعبة وإنشاء الحزمة',
    saving: 'جارٍ الحفظ...',
    difficulties: { easy: 'سهل', medium: 'متوسط', hard: 'صعب' } as Record<string, string>,
  },
  en: {
    eyebrow: 'Content Library / Interactive Games',
    title: 'Game Studio',
    intro: 'Game authoring & engineering studio for children: engines, tracing levels, educational objectives, and instant runtime previews.',
    create: 'New Game',
    search: 'Search by title or engine...',
    engine: 'Engine',
    status: 'Status',
    total: 'Total Games',
    ready: 'Ready to Play',
    blocked: 'In Production / QA',
    enginesCount: 'Supported Engines',
    open: 'Workspace',
    play: 'Play Test',
    colGame: 'Game',
    colEngine: 'Engine',
    colLevels: 'Levels',
    colObjective: 'Educational Goal',
    colRuntime: 'Runtime',
    colStatus: 'Status',
    empty: 'No games recorded',
    noMatch: 'No matching games found',
    clear: 'Clear Filters',
    loading: 'Loading games and engines...',
    all: 'All',
    allEngines: 'All Engines',
    levelsCount: (n: number) => `${n} lvls`,
    createDenied: 'Creating games requires admin permissions',
    saveGame: 'Save Game & Create Pack',
    saving: 'Saving...',
    difficulties: { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as Record<string, string>,
  },
}

const DEFAULT_FILTERS = { engine: '', status: '' }
const COLUMNS: ColumnDefinition[] = [
  { key: 'game', label: 'colGame', locked: true },
  { key: 'engine', label: 'colEngine' },
  { key: 'levels', label: 'colLevels' },
  { key: 'objective', label: 'colObjective' },
  { key: 'runtime', label: 'colRuntime' },
  { key: 'status', label: 'colStatus' },
]

function GameCover({ assetId, title }: { assetId?: string | null; title?: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!assetId) return
    let live = true
    let obj = ''
    void api.assetBlob(assetId).then((b) => {
      if (!live) return
      obj = URL.createObjectURL(b)
      setUrl(obj)
    }).catch(() => {})
    return () => {
      live = false
      if (obj) URL.revokeObjectURL(obj)
    }
  }, [assetId])

  return (
    <div className="game-card-item__thumb-wrapper">
      {url ? (
        <img src={url} alt={title || ''} className="game-card-item__thumb-img" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.35)' }}>
          <Icon name="games" size={42} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{title || 'Game Canvas'}</span>
        </div>
      )}
      <div className="game-play-hover-btn">
        <Icon name="play" size={24} />
      </div>
    </div>
  )
}

interface NewGameFormState {
  title_ar: string
  engine_id: string
  difficulty: GameDifficulty
  age_min: number
  age_max: number
  status: ContentStatus
}

const emptyNewGame: NewGameFormState = {
  title_ar: '',
  engine_id: 'drawing-engine',
  difficulty: 'easy',
  age_min: 3,
  age_max: 7,
  status: 'draft',
}

export function GamesPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const list = useUrlListState(DEFAULT_FILTERS, { defaultView: 'grid' })
  const columns = useColumnPreferences('games-coll', COLUMNS)
  const [storedView, setStoredView] = useStoredViewMode('games-coll', 'grid')
  const view: ViewMode = list.rawView === 'grid' || list.rawView === 'table' ? list.rawView : storedView === 'grid' ? 'grid' : 'table'
  const setView = (m: ViewMode) => { setStoredView(m); list.setView(m) }

  const [rows, setRows] = useState<GameRecord[]>([])
  const [engines, setEngines] = useState<GameEngineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<NewGameFormState>(emptyNewGame)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const canCreate = hasPermission('create')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.games({ q: list.query || undefined, status: list.filters.status as any || undefined })
      let data = res.data as GameRecord[]
      if (list.filters.engine) data = data.filter((r) => r.engine_id === list.filters.engine)
      if (list.query) {
        const q = list.query.toLowerCase()
        data = data.filter((r) => r.title_ar.toLowerCase().includes(q) || (r.engine_id || '').toLowerCase().includes(q))
      }
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error')
    } finally {
      setLoading(false)
    }
  }, [list.query, list.filters.status, list.filters.engine])

  useEffect(() => {
    const t = setTimeout(() => void load(), 180)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    void api.gameEngines().then((r) => setEngines(r.data)).catch(() => {})
  }, [])

  const summary = useMemo(() => ({
    total: rows.length,
    ready: rows.filter((r) => r.status === 'ready' || r.status === 'published').length,
    blocked: rows.filter((r) => r.status === 'production' || r.status === 'qa' || r.status === 'draft').length,
    enginesCount: engines.length || 3,
  }), [rows, engines])

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title_ar.trim()) {
      setFormError(locale === 'ar' ? 'يرجى كتابة اسم اللعبة' : 'Please provide a game title')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload: GamePayload = {
        title_ar: form.title_ar.trim(),
        engine_id: form.engine_id || 'drawing-engine',
        series_id: null,
        episode_id: null,
        age_min: Number(form.age_min) || 3,
        age_max: Number(form.age_max) || 7,
        reading_level: 'emerging' as ReadingLevel,
        interaction_mode: 'tap' as InteractionMode,
        supervision_level: 'none' as SupervisionLevel,
        difficulty: form.difficulty,
        content_pack: { levels: [] },
        instructions_ar: null,
        max_attempts: null,
        help_system: {},
        is_free: true,
        status: form.status,
      }
      const res = await api.createGame(payload)
      setModalOpen(false)
      setForm(emptyNewGame)
      await load()
      if (res.data?.id) {
        navigate(adminPath(`games/${res.data.id}`))
      }
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const fields: FilterField[] = [
    { key: 'engine', label: text.engine, type: 'select', options: [{ value: '', label: text.all }, ...engines.map((e) => ({ value: e.id, label: e.name_ar }))] },
    { key: 'status', label: text.status, type: 'select', options: [{ value: '', label: text.all }, ...(['draft', 'ready', 'published', 'production', 'qa'] as ContentStatus[]).map((s) => ({ value: s, label: s }))] },
  ]

  const table = (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table data-table--wide">
        <thead>
          <tr>
            <th>{text.colGame}</th>
            {columns.isVisible('engine') && <th>{text.colEngine}</th>}
            {columns.isVisible('levels') && <th>{text.colLevels}</th>}
            {columns.isVisible('objective') && <th>{text.colObjective}</th>}
            {columns.isVisible('runtime') && <th>{text.colRuntime}</th>}
            {columns.isVisible('status') && <th>{text.colStatus}</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link className="entity-cell entity-cell--button" to={adminPath(`games/${row.id}`)}>
                  <div className="entity-thumb" style={{ width: 44, height: 44 }}>
                    <span className="entity-thumb__letter"><Icon name="games" size={18} /></span>
                  </div>
                  <div>
                    <strong>{row.title_ar}</strong>
                    <small>{row.age_min}–{row.age_max} سنوات</small>
                  </div>
                </Link>
              </td>
              {columns.isVisible('engine') && <td dir="ltr"><span className="game-engine-badge" style={{ position: 'static' }}>{(row as any).engine_name || row.engine_id}</span></td>}
              {columns.isVisible('levels') && <td>{(row.content_pack as any)?.levels?.length ?? 0}</td>}
              {columns.isVisible('objective') && <td>{(row as any).learning_objective_title || '—'}</td>}
              {columns.isVisible('runtime') && <td><span style={{ color: '#10b981', fontWeight: 800 }}>✓ جاهز</span></td>}
              {columns.isVisible('status') && <td><StatusBadge status={row.status as any} /></td>}
              <td>
                <Link className="button button--ghost button--small" to={adminPath(`games/${row.id}`)}>
                  {text.open}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const cards = (
    <div className="game-studio-grid" role="list">
      {rows.map((row) => {
        const levelsCount = (row.content_pack as any)?.levels?.length ?? 0
        const diff = row.difficulty || 'easy'
        return (
          <article key={row.id} className="game-card-item" role="listitem">
            <Link to={adminPath(`games/${row.id}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ position: 'relative' }}>
                <GameCover assetId={(row as any).cover_asset_id} title={row.title_ar} />
                <span className="game-engine-badge">
                  {(row as any).engine_name || row.engine_id}
                </span>
                <span className={`game-difficulty-pill game-difficulty--${diff}`}>
                  {text.difficulties[diff] || diff}
                </span>
              </div>
            </Link>

            <div className="game-card-item__body">
              <Link to={adminPath(`games/${row.id}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
                <h3 className="game-card-item__title">{row.title_ar}</h3>
              </Link>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="character-trait-pill">{row.age_min}–{row.age_max} سنوات</span>
                <span className="character-trait-pill">{text.levelsCount(levelsCount)}</span>
                <span className="character-trait-pill">HTML5 Canvas</span>
              </div>
            </div>

            <footer className="game-card-item__footer">
              <StatusBadge status={row.status as any} />
              <Link className="button button--primary button--small" to={adminPath(`games/${row.id}`)}>
                <Icon name="play" size={14} />
                {text.open}
              </Link>
            </footer>
          </article>
        )
      })}
    </div>
  )

  return (
    <div className="page-stack">
      {/* 1. PANORAMIC HERO HEADER */}
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <div className="page-intro__actions">
          <button
            className="button button--primary"
            disabled={!canCreate}
            onClick={() => {
              setForm(emptyNewGame)
              setFormError('')
              setModalOpen(true)
            }}
          >
            <Icon name="plus" size={16} />
            {text.create}
          </button>
        </div>
      </section>

      {/* 2. LIVE BENTO KPI METRICS */}
      <section className="hero-kpis" aria-label={text.title}>
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.total}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="games" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.total, locale)}</div>
          <div className="kpi-glass-card__caption">ألعاب تفاعلية مسجلة</div>
        </div>

        <div
          className="kpi-glass-card kpi-glass-card--success"
          style={{ cursor: 'pointer' }}
          onClick={() => list.setFilter('status', list.filters.status === 'ready' ? '' : 'ready')}
        >
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.ready}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="check" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.ready, locale)}</div>
          <div className="kpi-glass-card__caption">جاهزة للعب على المنصة</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.blocked}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="clock" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(summary.blocked, locale)}</div>
          <div className="kpi-glass-card__caption">بانتظار أصول أو مراجعة</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.enginesCount}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="layers" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{summary.enginesCount}</div>
          <div className="kpi-glass-card__caption">محركات ألعاب مدمجة</div>
        </div>
      </section>

      {/* 3. QUICK ENGINE FILTER PILLS */}
      <section className="catalog-control-strip">
        <button
          type="button"
          className={`filter-pill ${!list.filters.engine ? 'active' : ''}`}
          onClick={() => list.setFilter('engine', '')}
        >
          🎮 {text.allEngines} ({rows.length})
        </button>
        {engines.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`filter-pill ${list.filters.engine === e.id ? 'active' : ''}`}
            onClick={() => list.setFilter('engine', list.filters.engine === e.id ? '' : e.id)}
          >
            🕹️ {e.name_ar}
          </button>
        ))}
      </section>

      {/* 4. MAIN PANEL */}
      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{text.title}</span>
            <h3>{formatNumber(rows.length, locale)}</h3>
          </div>
          <ListToolbar
            searchValue={list.query}
            onSearchChange={list.setQuery}
            searchPlaceholder={text.search}
            fields={fields}
            values={list.filters}
            defaults={DEFAULT_FILTERS}
            onApply={(n) => list.setFilters(n)}
            onClear={list.clearFilters}
            onRemove={(k) => list.setFilter(k as any, '')}
            trailing={
              <>
                <SavedViewsMenu storageKey="games-coll" currentSearch={list.search} onApply={(s) => navigate(`${adminPath('games')}${s}`)} />
                {view === 'table' && (
                  <ColumnManager
                    columns={COLUMNS.map((c) => ({ ...c, label: (text as any)[c.label] || c.label }))}
                    hidden={columns.hidden}
                    onToggle={columns.toggle}
                    onReset={columns.reset}
                  />
                )}
                <ViewSwitcher value={view} onChange={setView} modes={['grid', 'table']} locale={locale} />
              </>
            }
          />
        </header>

        {loading ? (
          <p className="planet-loading">{text.loading}</p>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={list.query || list.activeFilterCount ? text.noMatch : text.empty}
            description=""
            action={
              list.activeFilterCount ? (
                <button className="button button--ghost" onClick={() => { list.clearFilters(); list.setQuery('') }}>
                  {text.clear}
                </button>
              ) : undefined
            }
          />
        ) : view === 'grid' ? (
          cards
        ) : (
          table
        )}
      </section>

      {/* 5. ADD NEW GAME LIQUID GLASS MODAL */}
      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={text.create}>
        <form className="entity-form" onSubmit={handleCreateSubmit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field">
            <span>اسم اللعبة بالعربية *</span>
            <input
              type="text"
              required
              placeholder="مثال: لغز الكواكب السبعة"
              value={form.title_ar}
              onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span>محرك اللعبة (Engine) *</span>
              <select
                value={form.engine_id}
                onChange={(e) => setForm({ ...form, engine_id: e.target.value })}
              >
                {engines.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name_ar} ({eng.id})
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>درجة الصعوبة</span>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value as GameDifficulty })}
              >
                <option value="easy">سهل (Easy)</option>
                <option value="medium">متوسط (Medium)</option>
                <option value="hard">صعب (Hard)</option>
              </select>
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>أدنى عمر</span>
              <input
                type="number"
                min={2}
                max={16}
                value={form.age_min}
                onChange={(e) => setForm({ ...form, age_min: Number(e.target.value) })}
              />
            </label>

            <label className="field">
              <span>أقصى عمر</span>
              <input
                type="number"
                min={3}
                max={18}
                value={form.age_max}
                onChange={(e) => setForm({ ...form, age_max: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="form-actions">
            <button
              className="button button--ghost"
              type="button"
              disabled={saving}
              onClick={() => setModalOpen(false)}
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="button button--primary" type="submit" disabled={saving}>
              <Icon name="check" size={16} />
              {saving ? text.saving : text.saveGame}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
