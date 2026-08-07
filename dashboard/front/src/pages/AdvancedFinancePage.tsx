export function AdvancedFinancePage() {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">المالية المتقدمة</span><h2>ربحية المحتوى</h2><p>تكلفة الإنتاج + الترجمة + الترخيص مقابل الإيراد</p></div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}><div style={{ fontSize: 11, color: '#64748b' }}>تكلفة القصة</div><div style={{ fontSize: 18, fontWeight: 800 }}>EGP 4,200</div><small style={{ color: '#16a34a' }}>إيراد 12,400 +194%</small></div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}><div style={{ fontSize: 11, color: '#64748b' }}>ميزانية الكوكب</div><div style={{ fontSize: 18, fontWeight: 800 }}>45,000 / 60,000</div><div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, marginTop: 8 }}><div style={{ width: '75%', height: '100%', background: '#3b82f6', borderRadius: 99 }} /></div></div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}><div style={{ fontSize: 11, color: '#64748b' }}>LTV</div><div style={{ fontSize: 18, fontWeight: 800 }}>EGP 420</div><small style={{ color: '#64748b' }}>متوسط عمر 8.4 شهر</small></div>
      </div>
      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontWeight: 700 }}>تصدير</h3>
        <p style={{ fontSize: 12, color: '#64748b' }}>لا حاجة لبرنامج محاسبة كامل - صدّر CSV لـ Excel/Sheets</p>
        <button className="button button--ghost" style={{ marginTop: 8 }} onClick={() => alert('تصدير CSV')}>تصدير</button>
      </div>
    </div>
  )
}
