export function RevenuePage() {
  const rows = [
    { month: '2026-08', mrr: 'EGP 12,400', newSubs: 42, churn: '3.2%' },
    { month: '2026-07', mrr: 'EGP 8,100', newSubs: 28, churn: '4.1%' },
  ]
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">المالية</span><h2>الإيرادات والتحويل</h2><p>MRR/ARR/Churn/Retention - Store vs Net</p></div></section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}><div style={{ fontSize: 11, color: '#64748b' }}>MRR</div><div style={{ fontSize: 20, fontWeight: 800 }}>EGP 12,400</div></div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}><div style={{ fontSize: 11, color: '#64748b' }}>التحويل Free→Paid</div><div style={{ fontSize: 20, fontWeight: 800 }}>18%</div></div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}><div style={{ fontSize: 11, color: '#64748b' }}>Retention 30d</div><div style={{ fontSize: 20, fontWeight: 800 }}>72%</div></div>
      </div>
      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f8fafc' }}><th style={{ padding: 10, textAlign: 'start' }}>الشهر</th><th>MRR</th><th>جدد</th><th>Churn</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.month} style={{ borderTop: '1px solid #e2e8f0' }}><td style={{ padding: 10 }}>{r.month}</td><td>{r.mrr}</td><td>{r.newSubs}</td><td>{r.churn}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}
