import { Link } from 'react-router-dom'
import { Icon } from '../Icon'
import { adminPath } from '../../lib/adminPath'

export function BulkOpsPanel({ locale }: { locale: 'ar'|'en' }) {
  return (
    <article className="panel">
      <header className="panel__header">
        <div><span className="panel__kicker">{locale==='ar'?'جماعي':'Bulk'}</span><h3>{locale==='ar'?'عمليات جماعية':'Bulk operations'}</h3></div>
        <span style={{ fontSize:10, padding:'3px 7px', borderRadius:999, background:'rgba(34,184,120,.10)', border:'1px solid rgba(34,184,120,.22)', color:'#0e6340' }}>Phase 14</span>
      </header>
      <div style={{ padding:'12px 14px', display:'grid', gap:10 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
          {[
            { label: locale==='ar'?'تعيين مراجع':'Assign reviewer', to: 'content-reviews', icon:'reviews' as const },
            { label: locale==='ar'?'تغيير التصنيف':'Change category', to: 'series', icon:'books' as const },
            { label: locale==='ar'?'تغيير المسار العمري':'Change track', to: 'series', icon:'children' as const },
            { label: locale==='ar'?'جدولة':'Schedule', to: 'calendar', icon:'calendar' as const },
            { label: locale==='ar'?'إضافة وسوم':'Add tags', to: 'series', icon:'search' as const },
            { label: locale==='ar'?'أرشفة':'Archive', to: 'series', icon:'archive' as const },
            { label: locale==='ar'?'تصدير':'Export', to: 'revenue', icon:'upload' as const },
            { label: locale==='ar'?'إسناد ترجمة':'Assign translation', to: 'translation', icon:'globe' as const },
          ].map(item=> (
            <Link key={item.label} to={adminPath(item.to)} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 9px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)', textDecoration:'none', color:'var(--text)', fontSize:12 }}>
              <Icon name={item.icon} size={14} /> {item.label}
            </Link>
          ))}
        </div>
        <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'العمليات المدمّرة تتطلب تأكيدًا قويًا وصلاحية — ليست fake buttons':'Destructive bulk actions require strong confirmation & authorization — no fake buttons'}</small>
      </div>
    </article>
  )
}
