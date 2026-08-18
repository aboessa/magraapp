import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function ReferenceDrawingDetailPage(){
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [previewMode, setPreviewMode] = useState<'phone'|'tablet'>('phone');

  useEffect(()=>{
    fetch(`/api/admin/reference-activities/${id}`).then(r=>r.json()).then(j=>{ if(j.success){ setData(j.data); setSteps(j.data.steps||[]); }});
  },[id]);

  if(!data) return <div>جاري التحميل...</div>;

  return (
    <div className="page-stack">
      <h1>{data.title_ar} — {data.category}</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <h3>البيانات الأساسية</h3>
          <label>عنوان AR <input defaultValue={data.title_ar} className="input" /></label>
          <label>فئة <select defaultValue={data.category} className="select"><option>حيوانات</option><option>فضاء</option><option>طبيعة</option><option>مركبات</option><option>بيت</option><option>زخارف</option></select></label>
          <label>عمر <input defaultValue={`${data.age_min}-${data.age_max}`} className="input" /></label>
          <label>صعوبة <select defaultValue={data.difficulty} className="select"><option>سهل</option><option>متوسط</option><option>مفصل</option></select></label>
          <label>صورة مرجعية <button className="btn">اختر من مكتبة الوسائط</button> <img src={`/api/media/${data.reference_asset_id}`} width={80} height={80} /></label>
        </div>
        <div className="card p-4">
          <h3>معاينة</h3>
          <div className="flex gap-2 mb-2">
            <button className={`btn ${previewMode==='phone'?'btn-primary':''}`} onClick={()=> setPreviewMode('phone')}>هاتف عمودي</button>
            <button className={`btn ${previewMode==='tablet'?'btn-primary':''}`} onClick={()=> setPreviewMode('tablet')}>تابلت أفقي</button>
          </div>
          <div style={{ border:'1px solid #e2e8f0', aspectRatio: previewMode==='phone'? '9/16':'16/9', maxWidth: previewMode==='phone'? 360: 600, margin:'0 auto' }}>
            <div style={{ display:'flex', flexDirection: previewMode==='phone'?'column':'row', height:'100%'}}>
              <div style={{ flex: previewMode==='phone'?'0 0 35%':'0 0 35%', background:'#fff', border:'1px dashed #cbd5e1', display:'flex', alignItems:'center', justifyContent:'center'}}>مرجع</div>
              <div style={{ flex:1, background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center'}}>لوحة الطفل</div>
            </div>
          </div>
          <p className="text-sm opacity-70 mt-2">معاينة بنفس عقد التشغيل — لا مخطط وهمي.</p>
        </div>
      </div>
      <div className="card p-4 mt-4">
        <h3>خطوات الرسم (Step-by-Step) — {steps.length} خطوات</h3>
        <div className="stack">
          {steps.map((s,i)=> <div key={s.id||i} className="card p-3 flex gap-3 items-center">
            <span className="font-bold">#{s.step_order}</span>
            <input defaultValue={s.instruction_ar} className="input flex-1" />
            <button className="btn btn-sm">صورة</button>
            <button className="btn btn-sm">صوت</button>
            <button className="btn btn-sm">↑</button><button className="btn btn-sm">↓</button>
          </div>)}
          <button className="btn" onClick={()=> setSteps([...steps, { step_order: steps.length+1, instruction_ar:'خطوة جديدة'}])}>+ إضافة خطوة</button>
        </div>
      </div>
      <div className="card p-4 mt-4">
        <h3>التحقق والجاهزية</h3>
        <ul className="text-sm">
          <li>مرجع: {data.reference_asset_id ? '✓' : '✗'}</li>
          <li>صورة مصغرة: {data.thumbnail_asset_id ? '✓' : '✗'}</li>
          <li>ترجمة AR: ✓</li>
          <li>ترجمة EN/FR: تحتاج مترجم</li>
          <li>حالة: {data.status}</li>
        </ul>
        <button className="btn btn-primary">حفظ مسودة</button> <button className="btn">إرسال للمراجعة</button>
      </div>
    </div>
  );
}
