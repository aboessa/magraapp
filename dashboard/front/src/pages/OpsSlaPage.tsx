export function OpsSlaPage() {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">التشغيل</span><h2>إدارة SLA والتكاملات</h2><p>مهلة المراجعة + تصعيد + Slack + AI</p></div>
      </section>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 13 }}>SLA للمراجعات</h3>
          <p style={{ fontSize: 12, color: '#64748b' }}>مراجعة لغوية: 24 ساعة • دينية: 48 ساعة • تصعيد تلقائي عند التأخير</p>
          <div style={{ marginTop: 10, height: 6, background: '#f1f5f9', borderRadius: 99 }}><div style={{ width: '68%', height: '100%', background: '#f59e0b', borderRadius: 99 }} /></div>
          <small style={{ color: '#d97706' }}>68% التزام - 3 متأخرة</small>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, display: 'flex', gap: 10 }}>
          <button className="button button--primary" onClick={() => alert('ربط Slack')}>ربط Slack</button>
          <button className="button button--ghost" onClick={() => alert('AI مساعد: اقتراح Metadata و QC')}>AI مساعد</button>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#64748b', alignSelf: 'center' }}>تكامل Teams قادم</span>
        </div>
      </div>
    </div>
  )
}
