import { useState } from 'react'

export function RecommendationsPage() {
  const [pins, setPins] = useState<string[]>(['series-1'])
  const [boosts] = useState([{ id: 'series-2', boost: 2.0 }])
  const [excludes] = useState<string[]>([])

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">التوصيات</span><h2>إدارة التوصيات</h2><p>Pin / Boost / Exclude + معاينة على حساب تجريبي</p></div>
        <button className="button button--primary" onClick={() => alert('إضافة قاعدة: لأنك شاهدت -> Pin')}>قاعدة جديدة</button>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 13 }}>Pin 📌</h3>
          <p style={{ fontSize: 11, color: '#64748b' }}>ثبت محتوى في الأعلى</p>
          <ul style={{ fontSize: 12, marginTop: 8, paddingInlineStart: 16 }}>{pins.map(id => <li key={id}>{id} <button onClick={() => setPins(pins.filter(x => x !== id))} style={{ color: '#dc2626', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer' }}>×</button></li>)}</ul>
          <button className="button button--ghost" style={{ marginTop: 8, fontSize: 12 }} onClick={() => { const id = prompt('ID المحتوى'); if (id) setPins([...pins, id]) }}>+ Pin</button>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 13 }}>Boost 🚀</h3>
          <p style={{ fontSize: 11, color: '#64748b' }}>ارفع ترتيب محتوى</p>
          <ul style={{ fontSize: 12 }}>{boosts.map(b => <li key={b.id}>{b.id} - x{b.boost}</li>)}</ul>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 13 }}>Exclude 🚫</h3>
          <p style={{ fontSize: 11, color: '#64748b' }}>امنع اقتراح محتوى أعلى من العمر</p>
          <ul style={{ fontSize: 12 }}>{excludes.length ? excludes.map(e => <li key={e}>{e}</li>) : <li style={{ color: '#94a3b8' }}>لا يوجد</li>}</ul>
        </div>
      </div>

      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontWeight: 700, fontSize: 13 }}>قواعد "لأنك شاهدت"</h3>
        <p style={{ fontSize: 11, color: '#64748b' }}>إذا شاهد الطفل X → اقترح Y • حد تكرار 3/أسبوع • منع أعلى من العمر</p>
        <pre style={{ fontSize: 11, background: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 8 }}>{JSON.stringify({ rule: 'because_you_watched', source: 'series-1', target: 'series-2', max_per_week: 3, age_check: true }, null, 2)}</pre>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button className="button button--ghost" onClick={() => alert('معاينة على حساب تجريبي: عمر 7 - كوكب القصص')}>معاينة</button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#64748b', alignSelf: 'center' }}>حد تكرار + منع أعلى من العمر مفعل</span>
      </div>
    </div>
  )
}
