import { useState } from 'react'

export function TranslationCenterPage() {
  const [langs] = useState([
    { code: 'ar', name: 'العربية', progress: 100, status: 'مكتمل' },
    { code: 'en', name: 'English', progress: 72, status: 'قيد المراجعة' },
    { code: 'fr', name: 'Français', progress: 18, status: 'غير مكتمل' },
  ])

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">الترجمة والدبلجة</span><h2>مركز الترجمة</h2><p>Glossary + Memory + استيراد/تصدير + مقارنة النص الأصلي</p></div>
        <button className="button button--primary" onClick={() => alert('استيراد Excel')}>استيراد</button>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {langs.map(l => (
          <div key={l.code} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{l.name}</strong><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: l.progress === 100 ? '#dcfce7' : l.progress > 50 ? '#fef3c7' : '#f1f5f9', color: l.progress === 100 ? '#16a34a' : '#475569' }}>{l.status}</span>
            </div>
            <div style={{ marginTop: 12, height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${l.progress}%`, height: '100%', background: l.progress === 100 ? '#16a34a' : '#3b82f6' }} /></div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>{l.progress}% مكتمل</div>
            {l.progress < 100 && <div style={{ marginTop: 8, fontSize: 11, color: '#d97706' }}>تنبيه: تغير النص الأصلي - أعد فتح المراجعة</div>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 13 }}>Glossary</h3>
          <ul style={{ fontSize: 12, lineHeight: 1.8, paddingInlineStart: 16 }}>
            <li>زيد - Zaid (ثابت)</li>
            <li>مجرة - Majarra (لا تترجم)</li>
            <li>كوكب - Planet</li>
          </ul>
          <button className="button button--ghost" style={{ marginTop: 8, fontSize: 12 }} onClick={() => alert('إضافة مصطلح')}>إضافة</button>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 13 }}>ذاكرة الترجمة</h3>
          <p style={{ fontSize: 12, color: '#64748b' }}>عند تغيير النص الأصلي، يُعاد فتح مراجعة اللغة تلقائياً</p>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button className="button button--ghost" onClick={() => alert('تصدير TMX')}>تصدير</button>
            <button className="button button--ghost" onClick={() => alert('استيراد')}>استيراد</button>
          </div>
        </div>
      </div>
    </div>
  )
}
