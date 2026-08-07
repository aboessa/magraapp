import { useEffect, useState } from 'react'

export function RemoteConfigPage() {
  const [flags, setFlags] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/v1/admin/remote-config', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } }).then(r => r.json()).then(j => setFlags(j.data || [])).catch(() => setFlags([
      { key: 'hero_enabled', value: true, rollout: 100 },
      { key: 'offline_enabled', value: true, rollout: 100 },
      { key: 'gate_enabled', value: false, rollout: 0 },
    ]))
  }, [])

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">التحكم في التطبيق</span><h2>Remote Config & Feature Flags</h2><p>تفعيل/تعطيل ميزة، إخفاء كوكب، Kill Switch، Force Update بدون إصدار جديد</p></div>
      </section>
      <div style={{ display: 'grid', gap: 10 }}>
        {flags.map((f: any) => (
          <div key={f.key} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}><strong style={{ fontSize: 13 }}>{f.key}</strong><br/><small style={{ color: '#64748b' }}>Rollout {f.rollout ?? 100}% • {f.targeting || 'الجميع'}</small></div>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: f.value ? '#dcfce7' : '#f1f5f9', color: f.value ? '#16a34a' : '#64748b', fontSize: 12 }}>{f.value ? 'مفعل' : 'معطل'}</span>
            <button className="button button--ghost" onClick={() => alert('تغيير Rollout/استهداف')}>تعديل</button>
          </div>
        ))}
      </div>
    </div>
  )
}
