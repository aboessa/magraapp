export function CampaignsPage() {
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">التسويق</span><h2>الحملات والإشعارات</h2><p>Push / In-app / Email / Banner - مع استهداف وجدولة و A/B</p></div><button className="button button--primary">حملة جديدة</button></section>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center' }}>
        <h3 style={{ fontWeight: 700 }}>لا يوجد حملات</h3>
        <p style={{ fontSize: 12, color: '#64748b' }}>أنشئ أول حملة: الدولة/اللغة/الباقة/العمر - جدولة - Deep Link - Frequency Cap</p>
      </div>
    </div>
  )
}
