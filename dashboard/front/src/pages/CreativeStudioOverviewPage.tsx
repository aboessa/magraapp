import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface RefRow { id:string; title_ar:string; category:string; age_min:number; age_max:number; difficulty:string; status:string; thumbnail_asset_id:string; }

export default function CreativeStudioOverviewPage(){
  const [refs, setRefs] = useState<RefRow[]>([]);
  const [filterCat, setFilterCat] = useState('الكل');
  const [filterAge, setFilterAge] = useState('الكل');
  useEffect(()=>{
    fetch('/api/admin/reference-activities').then(r=>r.json()).then(j=>{
      if(j.success) setRefs(j.data);
    }).catch(()=> setRefs([]));
  },[]);
  const metrics = {
    total: refs.length,
    draft: refs.filter(r=>r.status==='draft').length,
    ready: refs.filter(r=>r.status==='ready').length,
    published: refs.filter(r=>r.status==='published').length,
    animals: refs.filter(r=>r.category==='حيوانات').length,
  };
  const filtered = refs.filter(r=> (filterCat==='الكل'||r.category===filterCat) && (filterAge==='الكل'|| `${r.age_min}-${r.age_max}`===filterAge));
  return (
    <div className="page-stack">
      <h1>استوديو الإبداع — نظرة عامة</h1>
      <div className="grid grid-cols-4 gap-4">
        <Link to="/creative-studio/reference" className="card p-4"><div className="text-2xl font-bold">{metrics.total}</div><div>أنشطة مرجعية</div></Link>
        <div className="card p-4"><div className="text-2xl font-bold">{metrics.ready}</div><div>جاهزة</div></div>
        <div className="card p-4"><div className="text-2xl font-bold">40</div><div>قوالب تلوين</div></div>
        <div className="card p-4"><div className="text-2xl font-bold">12</div><div>أكمل الرسمة</div></div>
      </div>
      <div className="card p-4 mt-4">
        <h3>أنشطة ارسم مثلي</h3>
        <div className="flex gap-2 mb-3">
          {['الكل','حيوانات','فضاء','طبيعة','مركبات','بيت','زخارف'].map(c=> <button key={c} className={`btn ${filterCat===c?'btn-primary':''}`} onClick={()=> setFilterCat(c)}>{c}</button>)}
          <select value={filterAge} onChange={e=> setFilterAge(e.target.value)} className="select"><option>الكل</option><option>4-5</option><option>6-7</option><option>8-9</option></select>
        </div>
        <table className="table">
          <thead><tr><th>صورة</th><th>عنوان</th><th>فئة</th><th>عمر</th><th>صعوبة</th><th>حالة</th><th>إجراءات</th></tr></thead>
          <tbody>
            {filtered.map(r=> <tr key={r.id}><td><img src={`/api/media/${r.thumbnail_asset_id}`} alt="" width={48} height={48} /></td><td>{r.title_ar}</td><td>{r.category}</td><td>{r.age_min}-{r.age_max}</td><td>{r.difficulty}</td><td>{r.status}</td><td><Link to={`/creative-studio/reference/${r.id}`} className="btn btn-sm">فتح</Link></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
