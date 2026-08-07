import { useEffect, useState } from 'react'

export function WorkflowPage() {
  const [runs, setRuns] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/v1/admin/workflows/runs', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } })
      .then(r => r.json()).then(j => setRuns(j.data || [])).catch(() => setRuns([
        { id: 'wf-1', content_type: 'illustrated_story', content_id: 'book-qisas-p1', current_step: 'lang_review', status: 'running' },
        { id: 'wf-2', content_type: 'series', content_id: 'series-1', current_step: 'approved', status: 'approved' },
      ]))
  }, [])

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">سير العمل</span><h2>Workflow Engine</h2><p>مسار القصة الإيمانية: إنشاء → تحرير → لغوي → ديني → صوت → QA → اعتماد → جدولة → نشر</p></div>
      </section>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f8fafc', textAlign: 'start' }}><th style={{ padding: 10 }}>المحتوى</th><th>الخطوة</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            {runs.map((r: any) => (
              <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: 10 }}>{r.content_type} • {r.content_id}</td>
                <td>{r.current_step}</td>
                <td><span style={{ padding: '2px 8px', borderRadius: 6, background: r.status === 'approved' ? '#dcfce7' : '#fef3c7', fontSize: 11 }}>{r.status}</span></td>
                <td><button className="button button--ghost" style={{ fontSize: 12 }} onClick={async () => { const d = prompt('اعتماد/رفض/طلب تعديل؟ (approved/rejected/changes_requested)'); if (!d) return; await fetch(`/api/v1/admin/workflows/runs/${r.id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` }, body: JSON.stringify({ decision: d, step: r.current_step }) }); location.reload() }}>مراجعة</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
