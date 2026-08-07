import { useEffect, useState } from 'react'
import { LoadingState } from '../components/PageState'

export function RolesPage() {
  const [roles, setRoles] = useState<any[]>([])
  const [grants, setGrants] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/v1/admin/roles', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } }).then(r => r.json()).then(j => setRoles(j.data || [])).catch(() => setRoles([
      { id: 'content_creator', name_ar: 'منشئ المحتوى', permissions_count: 9 },
      { id: 'reviewer', name_ar: 'المراجع', permissions_count: 4 },
      { id: 'publisher', name_ar: 'مسؤول النشر', permissions_count: 5 },
    ]))
    fetch('/api/v1/admin/grants', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } }).then(r => r.json()).then(j => setGrants(j.data || [])).catch(() => {})
  }, [])

  if (!roles.length) return <LoadingState />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">الأدوار والصلاحيات</span><h2>4 طبقات: دور + نطاق + نوع محتوى + لغة</h2><p>مثال: محرر محتوى - كوكب القصص/مصورة - قصة مصورة - العربية</p></div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 700 }}>الأدوار (12)</h3>
          <ul style={{ fontSize: 13, lineHeight: 1.9, paddingInlineStart: 16 }}>
            {roles.map((r: any) => <li key={r.id}>{r.name_ar} <small style={{ color: '#64748b' }}>({r.permissions_count ?? 0} صلاحيات)</small></li>)}
          </ul>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontWeight: 700 }}>المنح النشطة</h3>
          <p style={{ fontSize: 12, color: '#64748b' }}>grantee_type/role/scope/content_type/language/valid_until</p>
          <pre style={{ fontSize: 11, maxHeight: 180, overflow: 'auto', background: '#f8fafc', padding: 8, borderRadius: 8 }}>{JSON.stringify(grants.slice(0, 3), null, 2) || 'لا يوجد منح بعد - أنشئ فريقاً'}</pre>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 14 }}>
        <h3 style={{ fontWeight: 700 }}>مصفوفة مبسطة</h3>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid #e2e8f0' }}><th>العملية</th><th>منشئ</th><th>قائد</th><th>مراجع</th><th>ناشر</th></tr></thead>
          <tbody>
            <tr><td>إنشاء</td><td>✓</td><td>✓</td><td></td><td></td></tr>
            <tr><td>إرسال للمراجعة</td><td>✓</td><td>✓</td><td></td><td></td></tr>
            <tr><td>اعتماد</td><td></td><td>حسب السياسة</td><td>✓</td><td></td></tr>
            <tr><td>نشر</td><td></td><td></td><td></td><td>✓</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
