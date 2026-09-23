import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
import { EntityThumbnail } from '../components/EntityThumbnail'
import type { CharacterRecord, SeriesRecord } from '../types/api'

type Role = NonNullable<CharacterRecord['role']>
type Form = { series_id: string; name_ar: string; role: Role; age: string; description_ar: string; traits: string; speech_style: string; voice_actor: string }
const initial: Form = { series_id: '', name_ar: '', role: 'hero', age: '', description_ar: '', traits: '', speech_style: '', voice_actor: '' }
const roles: Role[] = ['hero', 'side', 'villain', 'narrator', 'presenter']
const labels = { ar: { hero: 'بطل', side: 'مساند', villain: 'خصم', narrator: 'راوٍ', presenter: 'مقدم' }, en: { hero: 'Hero', side: 'Supporting', villain: 'Antagonist', narrator: 'Narrator', presenter: 'Presenter' } }

/// المفتاح هو اسم معامل الاستعلام الذي يقبله `GET /admin/characters` بالحرف:
/// `series_id` (والمسار يقبل كذلك `include_archived` و`limit` و`offset` كما في
/// `api/src/routes/adminContent.ts`)، فرابط «شخصيات هذه السلسلة» من أي شاشة يفتح
/// نفس المجموعة.
const DEFAULT_FILTERS = { series_id: '' }

/// `api.characters(seriesId)` لا تُرسل `limit` ولا `offset`، فالخادم يُعيد أول
/// عشرين صفًّا بالافتراض. الترقيم هنا على المجموعة المحمَّلة، وحدّ الخادم مُعلَن
/// في الواجهة بدل قائمة مقتطعة صامتة.
const SERVER_PAGE = 20
const LIMIT = 20

const FILTER_FIELDS = (ar: boolean, locale: 'ar' | 'en', series: SeriesRecord[]): FilterField[] => [
  {
    key: 'series_id',
    label: ar ? 'السلسلة' : 'Series',
    type: 'select',
    options: [
      { value: '', label: ar ? 'كل السلاسل' : 'All series' },
      ...series.map((item) => ({ value: item.id, label: locale === 'en' ? item.title_en || item.title_ar : item.title_ar })),
    ],
  },
]

export function CharactersPage() {
  const { locale } = usePreferences(); const ar = locale === 'ar'
  const navigate = useNavigate()
  // الفلتر في العنوان: رابط شخصيات سلسلة واحدة يُشارك ويُحدَّث ويعود بزرّ الرجوع.
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { filters, offset, limit } = list
  const filter = filters.series_id
  const [items, setItems] = useState<CharacterRecord[]>([]); const [series, setSeries] = useState<SeriesRecord[]>([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<CharacterRecord | null>(null); const [form, setForm] = useState<Form>(initial); const [saving, setSaving] = useState(false)
  const load = useCallback(async () => { setLoading(true); try { const [characters, allSeries] = await Promise.all([api.characters({ series_id: filter || undefined, limit, offset }), api.series({ status: 'all', limit: 100 })]); setItems(characters.data); setTotal(characters.meta.total); setSeries(allSeries.data.filter((item) => item.status !== 'archived')); setError('') } catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الشخصيات' : 'Unable to load characters') } finally { setLoading(false) } }, [ar, filter, limit, offset])
  useEffect(() => { void load() }, [load])
  /// الترقيم على الخادم: `GET /admin/characters` يقبل limit و offset، وعميل الـAPI
  /// يُرسلهما الآن. كان الترقيم على المجموعة المحمَّلة وحدّ الخادم عشرون صفًّا، فما
  /// بعد الصفحة الأولى لم يكن قابلًا للوصول إطلاقًا.
  const paged = items
  function create() { setEditing(null); setForm({ ...initial, series_id: filter || series[0]?.id || '' }); setOpen(true) }
  function edit(item: CharacterRecord) { setEditing(item); setForm({ series_id: item.series_id, name_ar: item.name_ar, role: item.role || 'hero', age: item.age ? String(item.age) : '', description_ar: item.description_ar ?? '', traits: item.traits.join('، '), speech_style: item.speech_style ?? '', voice_actor: item.voice_actor ?? '' }); setOpen(true) }
  async function submit(event: FormEvent) { event.preventDefault(); if (!form.series_id || !form.name_ar.trim()) return; setSaving(true); const payload = { ...form, age: form.age ? Number(form.age) : null, traits: form.traits.split(/[,،]/).map((item) => item.trim()).filter(Boolean), languages: ['ar'] }; try { if (editing) await api.updateCharacter(editing.id, payload); else await api.createCharacter(payload); setOpen(false); await load() } catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر الحفظ' : 'Unable to save') } finally { setSaving(false) } }
  async function archive(id: string) { if (!window.confirm(ar ? 'أرشفة الشخصية؟' : 'Archive character?')) return; await api.archiveCharacter(id); await load() }

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [roleFilter, setRoleFilter] = useState<string>('')

  const displayedItems = roleFilter ? paged.filter(item => item.role === roleFilter) : paged

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{ar ? 'دليل الإنتاج' : 'Production bible'}</span>
          <h2>{ar ? 'الشخصيات' : 'Characters'}</h2>
          <p>{ar ? 'ثبّت وصف الشخصية وسماتها وصوتها ومراجعها داخل سلسلتها.' : 'Keep character descriptions, traits, voice, and references scoped to their series.'}</p>
        </div>
        <button className="button button--primary" type="button" onClick={create} disabled={!series.length}>
          <Icon name="plus" size={17}/>{ar ? 'شخصية جديدة' : 'New character'}
        </button>
      </section>

      {/* Hero KPIs */}
      <section className="hero-kpis" aria-label="Characters KPIs">
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{ar ? 'إجمالي الشخصيات' : 'Total characters'}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="characters" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{total}</div>
          <div className="kpi-glass-card__caption">{ar ? 'مسجلة في النظام' : 'In production bible'}</div>
        </div>
        <div className="kpi-glass-card kpi-glass-card--success">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{ar ? 'أبطال السلاسل' : 'Heroes'}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="check" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{items.filter(i => i.role === 'hero').length}</div>
          <div className="kpi-glass-card__caption">{ar ? 'شخصيات رئيسية' : 'Lead characters'}</div>
        </div>
        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{ar ? 'أدوار مساندة' : 'Supporting'}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="clock" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{items.filter(i => i.role === 'side').length}</div>
          <div className="kpi-glass-card__caption">{ar ? 'شخصيات ثانوية' : 'Side characters'}</div>
        </div>
        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{ar ? 'السلاسل المرتبطة' : 'Linked series'}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="series" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{series.length}</div>
          <div className="kpi-glass-card__caption">{ar ? 'عالم الإنتاج' : 'Active universes'}</div>
        </div>
      </section>

      {/* Modern Catalog Control Strip */}
      <section className="catalog-control-strip">
        <div className="catalog-control-strip__left">
          <div className="filter-pill-group" aria-label="Role filters">
            <button
              type="button"
              className={`filter-pill ${!roleFilter ? 'filter-pill--active' : ''}`}
              onClick={() => setRoleFilter('')}
            >
              {ar ? 'الكل 🎭' : 'All'}
            </button>
            <button
              type="button"
              className={`filter-pill ${roleFilter === 'hero' ? 'filter-pill--active' : ''}`}
              onClick={() => setRoleFilter('hero')}
            >
              🌟 {labels[locale].hero}
            </button>
            <button
              type="button"
              className={`filter-pill ${roleFilter === 'side' ? 'filter-pill--active' : ''}`}
              onClick={() => setRoleFilter('side')}
            >
              🤝 {labels[locale].side}
            </button>
            <button
              type="button"
              className={`filter-pill ${roleFilter === 'narrator' ? 'filter-pill--active' : ''}`}
              onClick={() => setRoleFilter('narrator')}
            >
              🎙️ {labels[locale].narrator}
            </button>
            <button
              type="button"
              className={`filter-pill ${roleFilter === 'presenter' ? 'filter-pill--active' : ''}`}
              onClick={() => setRoleFilter('presenter')}
            >
              🎤 {labels[locale].presenter}
            </button>
          </div>
        </div>

        <div className="catalog-control-strip__right">
          <div className="view-mode-toggle" aria-label="View mode">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'grid' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setViewMode('grid')}
              title={ar ? 'معرض الشخصيات' : 'Gallery view'}
            >
              <Icon name="grid" size={15} />
              <span>{ar ? 'معرض' : 'Gallery'}</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'table' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setViewMode('table')}
              title={ar ? 'عرض جدول' : 'Table view'}
            >
              <Icon name="bars" size={15} />
              <span>{ar ? 'جدول' : 'Table'}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{ar ? 'كل الشخصيات' : 'All characters'}</span>
            <h3>{total}</h3>
            <p className="panel__note">
              {ar
                ? `يُعيد المسار أول ${SERVER_PAGE} شخصية لكل استعلام؛ ضيّق بالسلسلة لرؤية البقية.`
                : `The endpoint returns the first ${SERVER_PAGE} characters per query; narrow by series to see the rest.`}
            </p>
          </div>
          <ListToolbar
            fields={FILTER_FIELDS(ar, locale, series)}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')}
            trailing={
              <SavedViewsMenu
                storageKey="characters"
                currentSearch={list.search}
                onApply={(search) => navigate(`${adminPath('characters')}${search}`)}
              />
            }
          />
        </header>

        {loading ? <LoadingState label={ar ? 'جارٍ التحميل...' : 'Loading...'}/> : error && !items.length ? <ErrorState message={error} onRetry={() => void load()}/> : items.length ? (
          <>
            {viewMode === 'grid' ? (
              /* CHARACTERS CAST GALLERY */
              <div style={{ padding: '20px' }}>
                <div className="characters-cast-grid">
                  {displayedItems.map((item) => (
                    <article className="character-cast-card" key={item.id}>
                      <div className="character-cast-card__avatar">
                        {item.reference_images[0] ? (
                          <img src={item.reference_images[0]} alt={item.name_ar} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                          item.name_ar.slice(0, 1)
                        )}
                      </div>

                      <div>
                        <h3 className="character-cast-card__name">
                          <Link to={adminPath(`characters/${item.id}`)} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {item.name_ar}
                          </Link>
                        </h3>
                        <div className="character-cast-card__series">{item.series_title}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.role && (
                          <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
                            {labels[locale][item.role]}
                          </span>
                        )}
                        {item.age && (
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {item.age} {ar ? 'سنوات' : 'years'}
                          </span>
                        )}
                      </div>

                      {item.traits.length > 0 && (
                        <div className="character-traits-list">
                          {item.traits.slice(0, 3).map((t, i) => (
                            <span className="character-trait-pill" key={i}>{t}</span>
                          ))}
                        </div>
                      )}

                      {item.voice_actor && (
                        <div style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>🎙️</span>
                          <span>{item.voice_actor}</span>
                        </div>
                      )}

                      <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--cs-glass-border)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Link to={adminPath(`characters/${item.id}`)} style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>{ar ? 'التفاصيل' : 'Details'}</span>
                          <Icon name="arrow" size={13} />
                        </Link>
                        <div className="table-actions">
                          <button className="icon-button icon-button--small" type="button" onClick={() => edit(item)} title={ar ? 'تعديل' : 'Edit'}>
                            <Icon name="edit" size={15}/>
                          </button>
                          <button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void archive(item.id)} title={ar ? 'أرشفة' : 'Archive'}>
                            <Icon name="archive" size={15}/>
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              /* DENSE TABLE VIEW */
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{ar ? 'الشخصية' : 'Character'}</th>
                      <th>{ar ? 'السلسلة' : 'Series'}</th>
                      <th>{ar ? 'الدور' : 'Role'}</th>
                      <th>{ar ? 'السمات' : 'Traits'}</th>
                      <th>{ar ? 'الصوت' : 'Voice'}</th>
                      <th/>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link className="entity-cell entity-cell--button" to={adminPath(`characters/${item.id}`)}>
                            <EntityThumbnail src={item.reference_images[0]} alt={item.name_ar} label={item.name_ar} icon="characters" size={34}/>
                            <div><strong>{item.name_ar}</strong><small>{item.age ? `${item.age} ${ar ? 'سنوات' : 'years'}` : '—'}</small></div>
                          </Link>
                        </td>
                        <td>{item.series_title}</td>
                        <td>{item.role ? labels[locale][item.role] : '—'}</td>
                        <td className="cell-wrap">{item.traits.join('، ') || '—'}</td>
                        <td>{item.voice_actor || '—'}</td>
                        <td>
                          <div className="table-actions">
                            <button className="icon-button icon-button--small" type="button" onClick={() => edit(item)} title={ar ? 'تعديل' : 'Edit'}><Icon name="edit" size={15}/></button>
                            <button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void archive(item.id)} title={ar ? 'أرشفة' : 'Archive'}><Icon name="archive" size={15}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </>
        ) : <EmptyState title={ar ? 'لا توجد شخصيات' : 'No characters'} description={ar ? 'أضف الشخصيات الثابتة ومقدمي البرامج.' : 'Add recurring characters and presenters.'}/>}
      </section>

      <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? (ar ? 'تعديل الشخصية' : 'Edit character') : (ar ? 'شخصية جديدة' : 'New character')}>
        <form className="entity-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field"><span>{ar ? 'السلسلة *' : 'Series *'}</span><select value={form.series_id} onChange={(event) => setForm({ ...form, series_id: event.target.value })}>{series.map((item) => <option value={item.id} key={item.id}>{item.title_ar}</option>)}</select></label>
            <label className="field"><span>{ar ? 'الاسم *' : 'Name *'}</span><input value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })}/></label>
          </div>
          <div className="form-grid">
            <label className="field"><span>{ar ? 'الدور' : 'Role'}</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>{roles.map((role) => <option value={role} key={role}>{labels[locale][role]}</option>)}</select></label>
            <label className="field"><span>{ar ? 'العمر' : 'Age'}</span><input type="number" min="0" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })}/></label>
          </div>
          <label className="field"><span>{ar ? 'الوصف' : 'Description'}</span><textarea rows={3} value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })}/></label>
          <label className="field"><span>{ar ? 'السمات — افصل بفاصلة' : 'Traits — comma separated'}</span><input value={form.traits} onChange={(event) => setForm({ ...form, traits: event.target.value })}/></label>
          <div className="form-grid">
            <label className="field"><span>{ar ? 'أسلوب الكلام' : 'Speech style'}</span><input value={form.speech_style} onChange={(event) => setForm({ ...form, speech_style: event.target.value })}/></label>
            <label className="field"><span>{ar ? 'المؤدي الصوتي' : 'Voice actor'}</span><input value={form.voice_actor} onChange={(event) => setForm({ ...form, voice_actor: event.target.value })}/></label>
          </div>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button>
            <button className="button button--primary" disabled={saving}>{ar ? 'حفظ' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
