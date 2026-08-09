import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { TaskRecord } from '../types/api'

/**
 * مهامي.
 *
 * ## ما كانت عليه
 *
 * `.catch()` كان يضع **مهمتين مخترعتين**، إحداهما بأولوية عالية وموعد تسليم
 * `2026-08-10`. مهمة مخترعة بموعد قد يتصرّف المستخدم بناءً عليها.
 *
 * وكان `LoadingState` يُعرض عند فراغ القائمة (`tasks.length ? ... : <LoadingState/>`)،
 * فقائمة مهام فارغة فعلًا تبدو كأنها تُحمّل إلى الأبد.
 */

const copy = {
  ar: {
    eyebrow: 'مهامي',
    title: 'ما المطلوب مني الآن',
    lede: 'المهام المسنَدة إليّ من سير العمل: مطلوبة، بانتظار المراجعة، تعديلات مطلوبة، أو متأخرة.',
    empty: 'لا مهام مسنَدة إليك',
    emptyHint: 'المهام تُنشأ من سير عمل المحتوى. لا شيء ينتظرك الآن.',
    loadError: 'تعذر تحميل المهام',
    noDue: 'بدون موعد',
    overdue: 'متأخرة',
  },
  en: {
    eyebrow: 'My tasks',
    title: 'What needs my attention',
    lede: 'Tasks assigned to me by the workflow: required, awaiting review, changes requested, or overdue.',
    empty: 'No tasks assigned to you',
    emptyHint: 'Tasks are created by the content workflow. Nothing is waiting on you.',
    loadError: 'Unable to load tasks',
    noDue: 'No due date',
    overdue: 'Overdue',
  },
}

/// لون النقطة يتبع الأولوية ثم الحالة، بنفس ترتيب الأهمية للقارئ
function dotColor(task: TaskRecord) {
  if (task.priority === 'high') return 'var(--danger)'
  if (task.status === 'review') return 'var(--warning)'
  return 'var(--success)'
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

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.tasks()
      setTasks(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      {tasks.length ? (
        <section className="panel panel--table">
          <div className="table-scroll">
            <table className="data-table data-table--wide">
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td style={{ width: 20 }}>
                      <span
                        className="track-dot"
                        style={{ background: dotColor(task) }}
                        aria-hidden="true"
                      />
                    </td>
                    <td>
                      <span className="table-primary">{task.title_ar}</span>
                      <span className="table-secondary">
                        {task.series_title ?? task.content_id ?? '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-badge--${task.status}`}>{task.status}</span>
                    </td>
                    <td>
                      {task.due_date
                        ? (
                          <span className={isOverdue(task.due_date) ? 'size-warning' : 'table-secondary'}>
                            {task.due_date}{isOverdue(task.due_date) ? ` · ${text.overdue}` : ''}
                          </span>
                        )
                        : <span className="table-secondary">{text.noDue}</span>}
                    </td>
                    <td>
                      {task.priority ? <span className="track-badge">{task.priority}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        // فراغ حقيقي لا مؤشّر تحميل دائم
        <EmptyState title={text.empty} description={text.emptyHint} />
      )}
    </div>
  )
}
