import { useEffect, useState } from 'react'
import { LoadingState } from '../components/PageState'

export function MyTasksPage() {
  const [tasks, setTasks] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/v1/admin/tasks', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } }).then(r => r.json()).then(j => setTasks(j.data || [])).catch(() => setTasks([
      { id: '1', title_ar: 'رفع الصوت العربي للقصة 04', content_id: 'book-qisas-k1', status: 'pending', priority: 'high', due_date: '2026-08-10' },
      { id: '2', title_ar: 'مراجعة لغوية - نجمة تنام', content_id: 'book-qisas-p2', status: 'review', priority: 'medium' },
    ]))
  }, [])

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">مهامي</span><h2>ما المطلوب مني الآن</h2><p>مطلوب مني / بانتظار المراجعة / تعديلات مطلوبة / متأخرة</p></div>
      </section>
      <div style={{ display: 'grid', gap: 10 }}>
        {tasks.length ? tasks.map((t: any) => (
          <div key={t.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: t.priority === 'high' ? '#ef4444' : t.status === 'review' ? '#f59e0b' : '#22c55e' }} />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 13 }}>{t.title_ar}</strong><br/><small style={{ color: '#64748b' }}>{t.content_id} • {t.status} • {t.due_date || 'بدون موعد'}</small>
            </div>
            <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: t.priority === 'high' ? '#fef2f2' : '#f8fafc', color: t.priority === 'high' ? '#b91c1c' : '#475569' }}>{t.priority}</span>
          </div>
        )) : <LoadingState />}
      </div>
    </div>
  )
}
