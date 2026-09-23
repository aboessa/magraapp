import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { TaskRecord } from '../types/api'

/**
 * شاشة مهامي ومركز سير العمل — My Workflow Tasks Suite
 *
 * تجربة متطورة لإدارة وتتبع مهام سير العمل التحريري والإنتاجي المسندة للموظف:
 * مراجعات المحتوى، التدقيق التربوي واللغوي، مواعيد التسليم، ومفتش المهام اللحظي.
 */

const copy = {
  ar: {
    eyebrow: 'إدارة سير العمل الشخصي',
    title: 'مهامي وما ينتظر اهتمامي',
    lede: 'المهام المسنَدة إليّ من محرك سير عمل المحتوى: مراجعات معلقة، متطلبات إنتاجية، وتدقيق تعليمي.',
    empty: 'لا توجد مهام مسنَدة إليك حالياً',
    emptyHint: 'المهام تُنشأ تلقائياً من سير عمل المحتوى عند كل مرحلة. جدولك مكتمل ومحدّث.',
    loadError: 'تعذر تحميل قائمة المهام',
    noDue: 'بدون موعد نهائي',
    overdue: 'متأخرة عن الموعد',
    refresh: 'تحديث المهام',
    liveStream: 'محرك المهام متزامن',
    totalTasks: 'إجمالي المهام المسندة',
    highPriority: 'مهام عالية الأولوية',
    inReview: 'بانتظار المراجعة والاعتماد',
    overdueCount: 'مهام متأخرة التسليم',
    tasksLedger: 'جدول المهام التشغيلية',
    colTask: 'المهمة / العنوان',
    colContext: 'السلسلة / الكيان المرتبط',
    colStatus: 'حالة المهمة',
    colDue: 'موعد التسليم',
    colPriority: 'الأولوية',
    colAction: 'إجراء',
    inspectorTitle: 'مفتش تفاصيل المهمة',
    selectToInspect: 'اختر مهمة من الجدول لمعاينة تفاصيل التكليف وسير العمل',
    tripleMetersTitle: 'مؤشرات الإنجاز والانضباط',
    meterSla: 'الالتزام بمواعيد التسليم (SLA)',
    meterVelocity: 'سرعة إغلاق المهام',
    meterQuality: 'جودة مراجعة المحتوى',
    aiCopilotTitle: 'توجيهات الذكاء الاصطناعي للمهام',
    aiCopilotDesc: 'لديك مهمتان قريبتان من موعد الاستحقاق في مسار إنتاج السلاسل. إنجازهما مبكراً يضمن عدم تعطيل مرحلة التسجيل الصوتي.',
    filterAll: 'كل المهام',
    filterHigh: '🔴 عالي',
    filterReview: '🟡 مراجعة',
    filterOverdue: '⚠️ متأخرة',
    filterSearch: 'بحث باسم المهمة أو السلسلة...',
    openEntity: 'فتح مساحة عمل الكيان',
  },
  en: {
    eyebrow: 'Personal Workflow Management',
    title: 'My Tasks & Pending Action Items',
    lede: 'Tasks assigned to you by the content engine: editorial review, script edits, and educational compliance.',
    empty: 'No tasks currently assigned to you',
    emptyHint: 'Tasks are dispatched dynamically as content advances through pipeline stages. You are all caught up.',
    loadError: 'Unable to load tasks list',
    noDue: 'No due date',
    overdue: 'Overdue',
    refresh: 'Refresh Tasks',
    liveStream: 'Workflow Engine Synced',
    totalTasks: 'Total Assigned Tasks',
    highPriority: 'High Priority Items',
    inReview: 'Pending Editorial Review',
    overdueCount: 'Overdue Deadlines',
    tasksLedger: 'Workflow Tasks Ledger',
    colTask: 'Task / Description',
    colContext: 'Linked Series / Entity',
    colStatus: 'Status',
    colDue: 'Due Date',
    colPriority: 'Priority',
    colAction: 'Action',
    inspectorTitle: 'Task Inspector',
    selectToInspect: 'Select a task to review workflow dependencies and delivery status',
    tripleMetersTitle: 'Productivity & Delivery Metrics',
    meterSla: 'SLA Delivery Adherence',
    meterVelocity: 'Resolution Velocity',
    meterQuality: 'Review Compliance Score',
    aiCopilotTitle: 'AI Workflow Copilot',
    aiCopilotDesc: 'Two tasks linked to the preschool track are approaching deadline. Prioritizing them unblocks narration recording queues.',
    filterAll: 'All Tasks',
    filterHigh: '🔴 High Priority',
    filterReview: '🟡 In Review',
    filterOverdue: '⚠️ Overdue',
    filterSearch: 'Search by title or series...',
    openEntity: 'Open Entity Workspace',
  },
}

function dotColor(task: TaskRecord) {
  if (task.priority === 'high') return '#ef4444'
  if (task.status === 'review') return '#f59e0b'
  return '#10b981'
}

function isOverdue(due: string | null) {
  if (!due) return false
  const parsed = new Date(due)
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now()
}

export function MyTasksPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.tasks()
      const list = response.data ?? []
      setTasks(list)
      if (list.length > 0 && !selectedTask) {
        setSelectedTask(list[0])
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [selectedTask, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  // KPIs calculation
  const metrics = useMemo(() => {
    const total = tasks.length
    const high = tasks.filter((t) => t.priority === 'high').length
    const review = tasks.filter((t) => t.status === 'review').length
    const overdue = tasks.filter((t) => isOverdue(t.due_date)).length
    return { total, high, review, overdue }
  }, [tasks])

  // Filtered task rows
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const q = searchQuery.toLowerCase().trim()
      const title = (t.title_ar || '').toLowerCase()
      const context = (t.series_title || t.content_id || '').toLowerCase()
      const matchesSearch = !q || title.includes(q) || context.includes(q)

      let matchesFilter = true
      if (filterType === 'high') matchesFilter = t.priority === 'high'
      else if (filterType === 'review') matchesFilter = t.status === 'review'
      else if (filterType === 'overdue') matchesFilter = isOverdue(t.due_date)

      return matchesSearch && matchesFilter
    })
  }, [tasks, searchQuery, filterType])

  if (loading && !tasks.length) return <LoadingState />
  if (error && !tasks.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      {/* 1. PANORAMIC COMMAND STRIP */}
      <section className="page-intro">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span className="eyebrow">{text.eyebrow}</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              <span className="status-dot-pulse" style={{ background: '#10b981' }} />
              {text.liveStream}
            </span>
          </div>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>

        <div className="page-intro__actions">
          <button className="button button--ghost" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={16} />
            <span>{text.refresh}</span>
          </button>
        </div>
      </section>

      {/* 2. BENTO GLASS METRIC CARDS (4 KPIs) */}
      <section className="hero-kpis" aria-label="Task KPIs">
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.totalTasks}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(metrics.total, locale)}</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'مهام نشطة مسندة لحسابك' : 'Active workflow assignments'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.highPriority}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="warning" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value" style={{ color: metrics.high > 0 ? '#ef4444' : undefined }}>
            {formatNumber(metrics.high, locale)}
          </div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'تتطلب تدخلاً عاجلاً' : 'Immediate attention required'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.inReview}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="eye" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">{formatNumber(metrics.review, locale)}</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'بانتظار التحقق والمصادقة' : 'Awaiting sign-off'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--success">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.overdueCount}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="clock" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value" style={{ color: metrics.overdue > 0 ? '#f59e0b' : undefined }}>
            {formatNumber(metrics.overdue, locale)}
          </div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'تجاوزت التاريخ المحدد' : 'Past due target'}</div>
        </div>
      </section>

      {/* 3. ENTERPRISE SPLIT WORKSPACE (68% / 32%) */}
      <div className="exec-split" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left Column (68% Tasks Ledger) */}
        <div className="exec-split__main" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <section className="panel panel--table" style={{ borderRadius: 16 }}>
            <div className="panel__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="panel__kicker">{text.eyebrow}</span>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>{text.tasksLedger}</h3>
              </div>

              {/* Filter pills & search */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder={text.filterSearch}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12.5,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'inherit',
                  }}
                />
                <button
                  type="button"
                  className={`filter-pill ${filterType === 'all' ? 'filter-pill--active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  {text.filterAll}
                </button>
                <button
                  type="button"
                  className={`filter-pill ${filterType === 'high' ? 'filter-pill--active' : ''}`}
                  onClick={() => setFilterType('high')}
                >
                  {text.filterHigh}
                </button>
                <button
                  type="button"
                  className={`filter-pill ${filterType === 'review' ? 'filter-pill--active' : ''}`}
                  onClick={() => setFilterType('review')}
                >
                  {text.filterReview}
                </button>
                <button
                  type="button"
                  className={`filter-pill ${filterType === 'overdue' ? 'filter-pill--active' : ''}`}
                  onClick={() => setFilterType('overdue')}
                >
                  {text.filterOverdue}
                </button>
              </div>
            </div>

            {filteredTasks.length ? (
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table data-table--wide">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }} />
                      <th>{text.colTask}</th>
                      <th>{text.colContext}</th>
                      <th>{text.colStatus}</th>
                      <th>{text.colDue}</th>
                      <th>{text.colPriority}</th>
                      <th style={{ width: 80 }}>{text.colAction}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => {
                      const isSelected = selectedTask?.id === task.id
                      const overdue = isOverdue(task.due_date)
                      return (
                        <tr
                          key={task.id}
                          style={{
                            background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedTask(task)}
                        >
                          <td>
                            <span
                              className="track-dot"
                              style={{ background: dotColor(task), width: 10, height: 10, borderRadius: '50%', display: 'inline-block' }}
                              aria-hidden="true"
                            />
                          </td>
                          <td>
                            <strong style={{ fontSize: 13.5, display: 'block' }}>{task.title_ar}</strong>
                            <small style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'monospace' }}>
                              #{task.id.slice(0, 10)}
                            </small>
                          </td>
                          <td>
                            <span className="table-secondary" style={{ fontSize: 12 }}>
                              {task.series_title ?? task.content_id ?? '—'}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                background:
                                  task.status === 'review'
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : 'rgba(99, 102, 241, 0.15)',
                                color: task.status === 'review' ? '#fbbf24' : '#818cf8',
                              }}
                            >
                              {task.status}
                            </span>
                          </td>
                          <td>
                            {task.due_date ? (
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: overdue ? 800 : 500,
                                  color: overdue ? '#ef4444' : 'var(--text-soft)',
                                }}
                              >
                                {task.due_date} {overdue ? ` · ⚠️ ${text.overdue}` : ''}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{text.noDue}</span>
                            )}
                          </td>
                          <td>
                            {task.priority ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  padding: '2px 7px',
                                  borderRadius: 999,
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  background:
                                    task.priority === 'high'
                                      ? 'rgba(239, 68, 68, 0.15)'
                                      : 'rgba(255, 255, 255, 0.06)',
                                  color: task.priority === 'high' ? '#f87171' : 'inherit',
                                }}
                              >
                                {task.priority}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="button button--ghost button--small"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedTask(task)
                              }}
                              style={{ padding: '3px 8px', fontSize: 11.5 }}
                            >
                              <Icon name="eye" size={13} />
                              {text.colAction}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title={text.empty} description={text.emptyHint} />
            )}
          </section>
        </div>

        {/* Right Column (32% Task Inspector) */}
        <aside className="exec-split__side" style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 20 }}>
          <div
            className="inspector-card"
            style={{
              padding: 20,
              borderRadius: 16,
              background: 'var(--surface)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name="check" size={17} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{text.inspectorTitle}</h4>
                <small style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                  {selectedTask ? selectedTask.title_ar : text.selectToInspect}
                </small>
              </div>
            </div>

            {/* Triple Delivery Meters */}
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {text.tripleMetersTitle}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterSla}</span>
                    <span style={{ color: '#10b981' }}>95%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '95%', height: '100%', borderRadius: 999, background: '#10b981' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterVelocity}</span>
                    <span style={{ color: '#818cf8' }}>88%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '88%', height: '100%', borderRadius: 999, background: '#818cf8' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterQuality}</span>
                    <span style={{ color: '#38bdf8' }}>100%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 999, background: '#38bdf8' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Task Details */}
            {selectedTask && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)' }}>المعرف: </span>
                  <span style={{ fontFamily: 'monospace' }}>{selectedTask.id}</span>
                </div>
                {selectedTask.series_title && (
                  <div>
                    <span style={{ color: 'var(--muted)' }}>السلسلة: </span>
                    <strong>{selectedTask.series_title}</strong>
                  </div>
                )}
                {selectedTask.due_date && (
                  <div>
                    <span style={{ color: 'var(--muted)' }}>الاستحقاق: </span>
                    <span style={{ color: isOverdue(selectedTask.due_date) ? '#ef4444' : undefined }}>
                      {selectedTask.due_date}
                    </span>
                  </div>
                )}
                {selectedTask.content_id && (
                  <Link
                    to={adminPath(`series/${selectedTask.content_id}`)}
                    className="button button--ghost button--small"
                    style={{ marginTop: 6, justifyContent: 'center' }}
                  >
                    <Icon name="arrow" size={13} />
                    <span>{text.openEntity}</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* AI Copilot Advisory */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))',
              border: '1px solid rgba(99,102,241,0.25)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c084fc', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
              <Icon name="sparkles" size={16} />
              <span>{text.aiCopilotTitle}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.55 }}>
              {text.aiCopilotDesc}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
