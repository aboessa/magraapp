import { useState } from 'react'

export function PackagesPage() {
  const [packages] = useState([
    { id: 'free', name: 'Free', price: '0', children: 1, devices: 1, offline: false },
    { id: 'family', name: 'Family', price: '99.90 EGP', children: 4, devices: 4, offline: true },
    { id: 'family_plus', name: 'Family Plus', price: '149.90 EGP', children: 4, devices: 8, offline: true },
  ])

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">التجارة</span><h2>الباقات والأسعار</h2><p>إدارة الباقات حسب الدولة/العملة/المتجر + Promo Codes + Grandfathered</p></div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {packages.map(p => (
          <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontWeight: 800 }}>{p.name}</h3>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0B1026', marginTop: 8 }}>{p.price}</div>
            <ul style={{ fontSize: 12, color: '#475569', lineHeight: 1.8, marginTop: 10, paddingInlineStart: 16 }}>
              <li>{p.children} أطفال</li>
              <li>{p.devices} أجهزة</li>
              <li>{p.offline ? 'Offline ✓' : 'Offline ✗'}</li>
            </ul>
            <button className="button button--ghost" style={{ marginTop: 12, width: '100%' }} onClick={() => alert('تعديل الأسعار حسب الدولة')}>تعديل</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontWeight: 700 }}>Promo Codes & Gift</h3>
        <p style={{ fontSize: 12, color: '#64748b' }}>أنشئ كوبونات للويب، عروض موسمية، وأكواد هدايا</p>
        <button className="button button--primary" style={{ marginTop: 8 }} onClick={() => alert('إنشاء كود')}>إنشاء كود</button>
      </div>
    </div>
  )
}
