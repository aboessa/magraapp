import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { usePreferences } from '../context/preferences'
import type {
  ProductionItem,
  ProductionQueueRow,
  ProductionRequirementRow,
  RequirementState,
} from '../types/api'

/**
 * مركز الإنتاج: ما يحتاجه كل عنصر قبل أن يُشحن.
 *
 * ## الحالة مشتقّة، والإسناد مخزَّن
 *
 * كل حالة في هذه الشاشة محسوبة على الخادم من الأصول نفسها: حالة أصل الفيديو،
 * الصفحات التي لها رسم جاهز، اللغات التي لها نصّ فعلي، سجلات المراجعة، وحُكم
 * بوابة النشر. لا يوجد حقل «حالة» يمكن للمشغّل ضبطه.
 *
 * هذا قرار لا اختصار: حالة مخزَّنة تنحرف عن الواقع لحظة استبدال أصل أو أرشفته،
 * ولوحة تقول «الرسوم مكتملة» فوق حلقة بلا رسوم أسوأ من غياب اللوحة — لأن الناس
 * يتوقّفون عن تصديقها. وقد سبق أن أُزيلت من هذه اللوحة صفحات تعرض نِسب إنجاز
 * مخترعة لهذا السبب بالضبط.
 *
 * ما يملكه الإنسان هو الطبقة البشرية: المسؤول، الاستحقاق، العائق، الملاحظة —
 * وهي ما يُكتب هنا.
 *
 * ## النِسب حيث يوجد مقام فقط
 *
 * «الرسوم 60%» ذات معنى لقصة: ٣ من ٥ صفحات. وهي بلا معنى لحلقة، لأن رسومها ليست
 * مجموعة قابلة للعدّ — فتُعرض حالة بلا نسبة بدل اختراع مقام لتعبئة العمود.
 */

const STATE_ORDER: RequirementState[] = ['blocked', 'missing', 'in_progress', 'partial', 'ready', 'not_applicable']

const copy = {
  ar: {
    eyebrow: 'الإنتاج',
    title: 'مركز الإنتاج',
    lede: 'كل حالة هنا مشتقّة من الأصول نفسها لا من عمود حالة: لا يمكن وسم متطلب بأنه مكتمل. المُخزَّن هو المسؤول والاستحقاق والعائق والملاحظة.',
    tableView: 'جدول',
    kanbanView: 'كانبان',
    queueView: 'مهامي',
    episodes: 'الحلقات',
    stories: 'القصص',
    typeLabel: 'النوع',
    withPublish: 'تقييم بوابة النشر',
    publishEvaluated: 'مُقيَّم',
    publishSkipped: 'غير مُقيَّم',
    withPublishHint: 'تقييم البوابة لكل عنصر مكلف؛ إطفاؤه يعرض بقية المصفوفة ويُعلن أن صفّ النشر غير مُقيَّم.',
    item: 'العنصر',
    progress: 'الإنجاز',
    publish: 'النشر',
    open: 'المصفوفة',
    detailTitle: 'مصفوفة الإنتاج',
    requirement: 'المتطلب',
    state: 'الحالة',
    detail: 'التفصيل',
    owner: 'الفريق',
    assignee: 'المسؤول',
    due: 'الاستحقاق',
    blocker: 'العائق',
    note: 'ملاحظة',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    cancel: 'إلغاء',
    assign: 'إسناد',
    dependsOn: 'يعتمد على',
    empty: 'لا عناصر مطابقة',
    emptyHint: 'غيّر النوع أو الحالة.',
    emptyQueue: 'لا متطلبات مُسنَدة إليك',
    loadError: 'تعذر تحميل مركز الإنتاج',
    capped: (limit: number) => `اللوحة محدودة بـ${limit} عنصرًا لكل صفحة؛ ما تراه ليس كل السلات.`,
    publishNotEvaluated: 'صفّ النشر غير مُقيَّم في هذا التحميل.',
    states: {
      ready: 'مكتمل', partial: 'جزئي', in_progress: 'قيد العمل',
      missing: 'ناقص', blocked: 'متوقّف', not_applicable: 'لا ينطبق',
    } as Record<string, string>,
    openContent: 'فتح العنصر',
  },
  en: {
    eyebrow: 'Production',
    title: 'Production centre',
    lede: 'Every state here is derived from the artefacts themselves rather than from a status column: a requirement cannot be marked done. What is stored is the owner, the due date, the blocker and the note.',
    tableView: 'Table',
    kanbanView: 'Kanban',
    queueView: 'My queue',
    episodes: 'Episodes',
    stories: 'Stories',
    typeLabel: 'Type',
    withPublish: 'Evaluate the publish gate',
    publishEvaluated: 'Evaluated',
    publishSkipped: 'Not evaluated',
    withPublishHint: 'Evaluating the gate per item is expensive; turning it off shows the rest of the matrix and declares the publish row unevaluated.',
    item: 'Item',
    progress: 'Progress',
    publish: 'Publish',
    open: 'Matrix',
    detailTitle: 'Production matrix',
    requirement: 'Requirement',
    state: 'State',
    detail: 'Detail',
    owner: 'Team',
    assignee: 'Assignee',
    due: 'Due',
    blocker: 'Blocker',
    note: 'Note',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    assign: 'Assign',
    dependsOn: 'Depends on',
    empty: 'No matching items',
    emptyHint: 'Change the type or the status.',
    emptyQueue: 'No requirements assigned to you',
    loadError: 'Unable to load the production centre',
    capped: (limit: number) => `The board is capped at ${limit} items per page; this is not the whole slate.`,
    publishNotEvaluated: 'The publish row was not evaluated in this load.',
    states: {
      ready: 'Ready', partial: 'Partial', in_progress: 'In progress',
      missing: 'Missing', blocked: 'Blocked', not_applicable: 'Not applicable',
    } as Record<string, string>,
    openContent: 'Open item',
  },
}

const stateClass = (state: RequirementState) => {
  if (state === 'ready') return 'pass'
  if (state === 'blocked' || state === 'missing') return 'blocked'
  if (state === 'not_applicable') return 'not_applicable'
  return 'warn'
}

const LIMIT = 20

/// مفاتيح الفلاتر هي أسماء معاملات الاستعلام التي يقبلها
/// `GET /admin/production/board` بالحرف (`type`, `status`, `series_id`,
/// `with_publish`, `limit`, `offset` في `api/src/routes/adminProduction.ts`).
/// هذه الشاشة هدف غوص من اللوحة التنفيذية، فاسم المعامل هنا ليس تفصيلًا: رابط
/// المقياس يكتب المعامل الذي يفهمه المعالِج، وأي ترجمة وسيطة تعني قائمة غير
/// المجموعة التي عُدَّت. تُعرض هنا الفلاتر التي كانت الشاشة تُرسلها فعلًا؛
/// `status` و`series_id` يقبلهما المعالِج ولا تعرضهما الشاشة، فلا يُرسَلان.
const DEFAULT_FILTERS = { type: 'episode', with_publish: '1' }

/// حقول الدرج بيانات لا JSX: نفس التعريف يقود الدرج والشرائح وعدّاد الفلاتر
/// النشطة، فلكل `select` تسمية مقروءة بالضرورة لا بالتذكّر. القائمة السابقة
/// كانت `<select aria-label={text.episodes}>`، أي تسمية اسمها «الحلقات» على
/// حقل يختار بين الحلقات والقصص.
const FILTER_FIELDS = (text: (typeof copy)['ar']): FilterField[] => [
  {
    key: 'type',
    label: text.typeLabel,
    type: 'select',
    options: [
      { value: 'episode', label: text.episodes },
      { value: 'story', label: text.stories },
    ],
  },
  {
    key: 'with_publish',
    label: text.withPublish,
    type: 'select',
    hint: text.withPublishHint,
    options: [
      { value: '1', label: text.publishEvaluated },
      { value: '0', label: text.publishSkipped },
    ],
  },
]

export function ProductionPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const navigate = useNavigate()

  // حالة اللوحة في العنوان لا في الذاكرة.
  //
  // كانت طريقة العرض والنوع والترقيم في `useState`، فرابطٌ إلى «مركز الإنتاج»
  // يفتح دائمًا جدول الحلقات من الصفحة الأولى مهما كان ما يراه من أرسله. وهذه
  // الشاشة تُقرأ في اجتماع: «انظر عمود المتوقّف في كانبان القصص» كان يحتاج ثلاث
  // نقرات من المستلم بدل رابط واحد. طريقة العرض الآن معامل `view` في العنوان،
  // فالرابط يفتح ما كان معروضًا.
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { filters, offset, limit } = list
  const { type, with_publish: withPublish } = filters
  /// قيمة غير معروفة في `view` تُقرأ كجدول: عنوان مُحرَّر بيد لا يجوز أن يُفرغ الشاشة.
  const view: 'table' | 'kanban' | 'queue' = list.view === 'kanban' || list.view === 'queue' ? list.view : 'table'

  const [items, setItems] = useState<ProductionItem[]>([])
  const [queue, setQueue] = useState<ProductionQueueRow[]>([])
  const [total, setTotal] = useState(0)
  const [boardLimit, setBoardLimit] = useState(LIMIT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [detail, setDetail] = useState<ProductionItem | null>(null)
  const [editing, setEditing] = useState<ProductionRequirementRow | null>(null)
  const [form, setForm] = useState({ assignee_id: '', due_at: '', blocker: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (view === 'queue') {
        const response = await api.productionQueue()
        setQueue(response.data)
      } else {
        const response = await api.productionBoard({
          type,
          with_publish: withPublish,
          limit,
          offset,
        })
        setItems(response.data)
        setTotal(response.meta?.total ?? response.data.length)
        const meta = response.meta as { board_limit?: number } | undefined
        if (meta?.board_limit) setBoardLimit(meta.board_limit)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [limit, offset, text.loadError, type, view, withPublish])

  // لا `setOffset(0)` عند تغيير النوع: `useUrlListState` يُصفّر الترقيم مع كل
  // تغيير فلتر، وأثرٌ إضافي يفعل الشيء نفسه كان يكتب في العنوان مرتين.

  useEffect(() => { void load() }, [load])

  async function openItem(item: ProductionItem) {
    setModalError('')
    try {
      // إعادة القراءة مع تقييم البوابة دائمًا: تفاصيل عنصر واحد تحتمل التكلفة،
      // ولا يجوز أن تُعرض تفاصيله بصفّ نشر «غير مُقيَّم» بلا داعٍ.
      const response = await api.productionItem(item.content_type, item.content_id)
      setDetail(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }

  async function saveAssignment() {
    if (!detail || !editing) return
    setSaving(true)
    setModalError('')
    try {
      await api.saveProductionAssignment(detail.content_type, detail.content_id, editing.key, {
        assignee_id: form.assignee_id.trim() || null,
        due_at: form.due_at ? `${form.due_at}T23:59:59.999Z` : null,
        blocker: form.blocker.trim() || null,
        note: form.note.trim() || null,
      })
      setEditing(null)
      const response = await api.productionItem(detail.content_type, detail.content_id)
      setDetail(response.data)
      await load()
    } catch (caught) {
      setModalError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  const contentLink = (item: { content_type: 'episode' | 'story'; content_id: string }) =>
    adminPath(item.content_type === 'episode' ? `episodes/${item.content_id}` : `stories/${item.content_id}`)

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      <ListToolbar
        fields={view === 'queue' ? [] : FILTER_FIELDS(text)}
        values={filters}
        defaults={DEFAULT_FILTERS}
        onApply={(next) => list.setFilters(next)}
        onClear={list.clearFilters}
        onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, DEFAULT_FILTERS[key as keyof typeof DEFAULT_FILTERS])}
        trailing={
          <>
            {(['table', 'kanban', 'queue'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`button ${view === item ? 'button--primary' : 'button--ghost'}`}
                onClick={() => list.setView(item)}
              >
                {item === 'table' ? text.tableView : item === 'kanban' ? text.kanbanView : text.queueView}
              </button>
            ))}
            <SavedViewsMenu
              storageKey="production"
              currentSearch={list.search}
              onApply={(search) => navigate(`${adminPath('production')}${search}`)}
            />
          </>
        }
      />
      {view !== 'queue' && <p className="readiness-note">{text.withPublishHint}</p>}

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && view === 'table' && (items.length ? (
        <section className="panel panel--table">
          <p className="readiness-note">{text.capped(boardLimit)}</p>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.item}</th><th>{text.progress}</th>
                  {items[0].requirements.map((requirement) => (
                    <th key={requirement.key}>{requirement.label_ar}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.content_id}>
                    <td>
                      <Link className="entity-cell entity-cell--button" to={contentLink(item)}>
                        <div><strong>{item.title}</strong><small>{item.status}</small></div>
                      </Link>
                    </td>
                    <td><strong>{item.summary.percent}%</strong></td>
                    {item.requirements.map((requirement) => (
                      <td key={requirement.key} title={requirement.detail}>
                        <span className={`readiness-item readiness-item--${stateClass(requirement.state)} readiness-pill`}>
                          {requirement.percent !== null && requirement.state !== 'ready'
                            ? `${requirement.percent}%`
                            : text.states[requirement.state]}
                        </span>
                      </td>
                    ))}
                    <td>
                      <button className="button button--ghost" type="button" onClick={() => void openItem(item)}>
                        {text.open}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
        </section>
      ) : <EmptyState title={text.empty} description={text.emptyHint} />)}

      {!loading && !error && view === 'kanban' && (items.length ? (
        <section className="panel">
          <p className="readiness-note">{text.capped(boardLimit)}</p>
          {/* أعمدة بحالة المتطلب لا بحالة العنصر: سؤال الإنتاج «ما المتوقّف وما
              الناقص» يقع على مستوى المتطلب، وعنصر واحد يظهر في عمودين بحق. */}
          <div className="kanban">
            {STATE_ORDER.filter((state) => state !== 'not_applicable').map((state) => {
              const cards = items.flatMap((item) => item.requirements
                .filter((requirement) => requirement.state === state)
                .map((requirement) => ({ item, requirement })))
              return (
                <div className="kanban__column" key={state}>
                  <header className="kanban__header">
                    <strong>{text.states[state]}</strong>
                    <span className="title-count">{cards.length}</span>
                  </header>
                  <ul className="kanban__list">
                    {cards.map(({ item, requirement }) => (
                      <li key={`${item.content_id}:${requirement.key}`} className={`kanban__card readiness-item readiness-item--${stateClass(state)}`}>
                        <div className="readiness-item__head">
                          <span className="readiness-item__label">{requirement.label_ar}</span>
                          <span className="readiness-item__owner">{requirement.owner_role}</span>
                        </div>
                        <p className="readiness-item__detail">{item.title}</p>
                        <p className="readiness-item__detail">{requirement.detail}</p>
                        {requirement.assignee_id && <p className="readiness-item__action" dir="ltr">{requirement.assignee_id}</p>}
                        <button className="button button--ghost" type="button" onClick={() => void openItem(item)}>
                          {text.open}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>
      ) : <EmptyState title={text.empty} description={text.emptyHint} />)}

      {!loading && !error && view === 'queue' && (queue.length ? (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.item}</th><th>{text.requirement}</th><th>{text.due}</th><th>{text.blocker}</th><th /></tr></thead>
              <tbody>
                {queue.map((row) => (
                  <tr key={`${row.content_id}:${row.requirement}`}>
                    <td>
                      <Link className="entity-cell entity-cell--button" to={contentLink(row)}>
                        <div><strong>{row.title ?? row.content_id}</strong><small>{row.content_status ?? '—'}</small></div>
                      </Link>
                    </td>
                    <td>{row.requirement}</td>
                    <td dir="ltr">{row.due_at?.slice(0, 10) ?? '—'}</td>
                    <td>{row.blocker ?? '—'}</td>
                    <td>
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => void openItem({
                          content_type: row.content_type,
                          content_id: row.content_id,
                          title: row.title ?? row.content_id,
                          status: row.content_status ?? '',
                          requirements: [],
                          summary: {
                            total: 0, ready: 0, partial: 0, in_progress: 0, missing: 0,
                            blocked: 0, not_applicable: 0, percent: 0, publish_state: 'not_applicable',
                          },
                        })}
                      >
                        {text.open}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : <EmptyState title={text.emptyQueue} description={text.queueView} />)}

      {detail && (
        <Modal
          open
          title={`${text.detailTitle} — ${detail.title}`}
          description={`${detail.summary.percent}% · ${text.publish}: ${text.states[detail.summary.publish_state]}`}
          onClose={() => { setDetail(null); setEditing(null) }}
        >
          <div className="form-actions">
            <Link className="button button--ghost" to={contentLink(detail)}>{text.openContent}</Link>
          </div>
          <ul className="readiness-list">
            {detail.requirements.map((requirement) => (
              <li key={requirement.key} className={`readiness-item readiness-item--${stateClass(requirement.state)}`}>
                <div className="readiness-item__head">
                  <span className="readiness-item__label">{requirement.label_ar}</span>
                  <span className="readiness-item__owner">
                    {text.states[requirement.state]}
                    {requirement.percent !== null ? ` · ${requirement.percent}%` : ''}
                    {` · ${requirement.owner_role}`}
                  </span>
                </div>
                <p className="readiness-item__detail">{requirement.detail}</p>
                {requirement.items.length > 0 && (
                  <ul className="readiness-item__items">
                    {requirement.items.slice(0, 12).map((entry) => <li key={entry}>{entry}</li>)}
                  </ul>
                )}
                {requirement.depends_on.length > 0 && (
                  <p className="readiness-item__detail" dir="ltr">
                    {text.dependsOn}: {requirement.depends_on.join(', ')}
                  </p>
                )}
                {(requirement.assignee_id || requirement.due_at || requirement.blocker || requirement.note) && (
                  <p className="readiness-item__action">
                    {requirement.assignee_id ? `${text.assignee}: ${requirement.assignee_id} ` : ''}
                    {requirement.due_at ? `· ${text.due}: ${requirement.due_at.slice(0, 10)} ` : ''}
                    {requirement.blocker ? `· ${text.blocker}: ${requirement.blocker} ` : ''}
                    {requirement.note ? `· ${requirement.note}` : ''}
                  </p>
                )}
                <div className="form-actions">
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => {
                      setEditing(requirement)
                      setForm({
                        assignee_id: requirement.assignee_id ?? '',
                        due_at: requirement.due_at?.slice(0, 10) ?? '',
                        blocker: requirement.blocker ?? '',
                        note: requirement.note ?? '',
                      })
                      setModalError('')
                    }}
                  >
                    {text.assign}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {editing && (
        <Modal open title={`${text.assign} — ${editing.label_ar}`} onClose={() => setEditing(null)}>
          <div className="entity-form">
            {modalError && <p className="inline-alert inline-alert--error" role="alert">{modalError}</p>}
            {/* لا حقل حالة هنا بقصد: الحالة تُشتق من الأصول، وإتاحة ضبطها تعني
                السماح للوحة بأن تكذب. */}
            <div className="form-grid">
              <label className="field">
                <span>{text.assignee}</span>
                <input value={form.assignee_id} dir="ltr" onChange={(event) => setForm({ ...form, assignee_id: event.target.value })} />
              </label>
              <label className="field date-field">
                <span>{text.due}</span>
                <input type="date" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>{text.blocker}</span>
              <input value={form.blocker} onChange={(event) => setForm({ ...form, blocker: event.target.value })} />
            </label>
            <label className="field">
              <span>{text.note}</span>
              <textarea rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </label>
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setEditing(null)}>{text.cancel}</button>
              <button className="button button--primary" type="button" disabled={saving} onClick={() => void saveAssignment()}>
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
