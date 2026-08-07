export function SchoolAccountsPage() {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">التوسع</span><h2>حسابات مدرسية</h2><p>فصل/مدرسة/منطقة - تقارير مجمعة - خصوصية</p></div>
        <button className="button button--primary">إنشاء مدرسة</button>
      </section>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 700 }}>مدرسة النور - 3 فصول - 78 طالب</h3>
          <p style={{ fontSize: 12, color: '#64748b' }}>المعلم يرى تقدم فصله فقط - لا يرى بيانات أولياء الأمور</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <span style={{ padding: '4px 8px', borderRadius: 6, background: '#eef2ff', fontSize: 11 }}>الصف 3أ - 26 طالب</span>
            <span style={{ padding: '4px 8px', borderRadius: 6, background: '#f0fdf4', fontSize: 11 }}>متوسط الإتقان 68%</span>
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 13 }}>الخصوصية</h3>
          <ul style={{ fontSize: 12, lineHeight: 1.8, paddingInlineStart: 16 }}>
            <li>المعلم لا يرى البريد/الهاتف</li>
            <li>ولي الأمر لا يرى بيانات الفصل</li>
            <li>التقارير مجمعة ومجهولة عند 5+ طلاب</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
