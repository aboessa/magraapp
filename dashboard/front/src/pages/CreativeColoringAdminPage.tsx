import { useEffect, useMemo, useState } from 'react';
import { creativeStudioAdmin } from '../lib/creativeStudioApi';

type Drawing = {
  id: string;
  category: string;
  sub_category: string | null;
  title_ar: string;
  title_en: string | null;
  age_min: number;
  age_max: number;
  difficulty: string;
  r2_key: string;
  thumb_r2_key: string | null;
  transparent_r2_key: string | null;
  url?: string | null;
  image_url?: string | null;
  thumb_url: string | null;
  transparent_url: string | null;
  urls?: { main?: string | null; thumb?: string | null; transparent?: string | null; best?: string | null };
  palette: string[];
  status: string;
  is_featured: boolean;
  is_new: boolean;
  sort_order: number;
  tags: string | null;
};

const SUBS = [
  { id: 'all', label: 'الكل' },
  { id: 'birds', label: 'طيور' },
  { id: 'animals', label: 'حيوانات' },
  { id: 'vehicles', label: 'مركبات' },
  { id: 'space', label: 'فضاء' },
  { id: 'flowers', label: 'زهور' },
  { id: 'sea', label: 'بحرية' },
  { id: 'fruits', label: 'فواكه' },
  { id: 'toys', label: 'ألعاب' },
];

const COLORING_V2_DRAWING_IDS: Record<string, string> = {
  'bird.png': 'coloring-bird',
  'cat.png': 'coloring-cat',
  'dino.png': 'coloring-dino',
  'fish.png': 'coloring-fish',
  'vehicles.png': 'coloring-vehicles',
  'space.png': 'coloring-space',
  'flowers.png': 'coloring-flowers',
  'animals.png': 'coloring-animals',
  'birds.png': 'coloring-birds',
  'sea.png': 'coloring-sea',
  'fruits.png': 'coloring-fruits',
  'toys.png': 'coloring-toys',
};

const api = creativeStudioAdmin;
const apiRaw = creativeStudioAdmin;

function getImg(d: Drawing): string | null {
  return d.transparent_url || d.url || (d as any).image_url || d.urls?.transparent || d.urls?.best || d.urls?.main || d.thumb_url || null;
}

export default function CreativeColoringAdminPage() {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [sub, setSub] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string|null>(null);
  const [view, setView] = useState<'grid'|'list'>('grid');
  const [bulkUploading, setBulkUploading] = useState(false);

  const [drawer, setDrawer] = useState<null | { mode:'create'|'edit', id?:string }>(null);
  const [form, setForm] = useState<any>({ title_ar:'', sub_category:'birds', difficulty:'سهل', age_min:3, age_max:6, status:'draft', sort_order:0, tags:'', is_featured:false, is_new:true });
  const [previewUrl, setPreviewUrl] = useState<string|null>(null);

  const stats = useMemo(()=>{
    const total = drawings.length;
    const ready = drawings.filter(d=>d.status==='ready'||d.status==='published').length;
    const featured = drawings.filter(d=>d.is_featured).length;
    const missing = drawings.filter(d=>!getImg(d)).length;
    return { total, ready, featured, missing };
  }, [drawings]);

  const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'https://api.majarra.app/api/v1';
  async function publicFetch(path: string) {
    const r = await fetch(`${API_BASE}${path}`);
    const j = await r.json().catch(()=>({ success:false, error: r.statusText })) as any;
    if (!r.ok && !j.error) j.error = `HTTP ${r.status}`;
    return j as { success:boolean; data?:any; error?:string };
  }

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('category','coloring');
    if (sub !== 'all') params.set('sub_category', sub);
    if (status !== 'all') params.set('status', status);
    if (search.trim()) params.set('q', search.trim());
    if (onlyFeatured) params.set('featured','1');
    params.set('limit','200');
    const res = await publicFetch(`/creative-studio/drawings?${params.toString()}`);
    if (res.success) {
      let list = res.data as Drawing[];
      if (sub !== 'all') list = list.filter(d => (d.sub_category||d.category) === sub);
      if (sub !== 'all' && ['birds','animals','vehicles','space','flowers','sea','fruits','toys'].includes(sub)) {
        const res2 = await publicFetch(`/creative-studio/drawings?category=${sub}&limit=200`);
        if (res2.success) {
          const extra = res2.data as Drawing[];
          const map = new Map(list.map(d=>[d.id,d]));
          for (const e of extra) if (!map.has(e.id)) map.set(e.id, e);
          list = Array.from(map.values());
        }
      }
      if (onlyFeatured) list = list.filter(d=>d.is_featured);
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(d=> d.title_ar.toLowerCase().includes(q) || d.id.toLowerCase().includes(q));
      }
      list.sort((a,b)=> a.sort_order - b.sort_order || a.id.localeCompare(b.id));
      setDrawings(list);
      setMsg(null);
    } else {
      setMsg(`خطأ تحميل: ${res.error}`);
      setDrawings([]);
    }
    setLoading(false);
  }

  useEffect(()=>{ load(); }, [sub, status, onlyFeatured]);
  useEffect(()=>{ const t=setTimeout(()=>{ if(search) load(); else if(search==='') load(); },400); return ()=>clearTimeout(t); }, [search]);

  function openCreate() {
    setForm({ title_ar:'', sub_category: sub==='all'?'birds':sub, difficulty:'سهل', age_min:3, age_max:6, status:'draft', sort_order:drawings.length, tags:'', is_featured:false, is_new:true });
    setPreviewUrl(null);
    setDrawer({ mode:'create' });
  }
  function openEdit(d: Drawing) {
    setForm({ title_ar:d.title_ar, sub_category:d.sub_category||d.category, difficulty:d.difficulty, age_min:d.age_min, age_max:d.age_max, status:d.status, sort_order:d.sort_order, tags:d.tags||'', is_featured:d.is_featured, is_new:d.is_new });
    setPreviewUrl(getImg(d));
    setDrawer({ mode:'edit', id:d.id });
  }

  async function submit() {
    if (!form.title_ar?.trim()) { setMsg('العنوان مطلوب'); return; }
    const id = drawer?.mode==='edit' && drawer.id ? drawer.id : `coloring-${form.sub_category}-${form.title_ar.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').slice(0,30)}`;
    const payload: any = {
      id,
      category:'coloring',
      sub_category: form.sub_category,
      title_ar: form.title_ar.trim(),
      difficulty: form.difficulty,
      age_min: form.age_min, age_max: form.age_max,
      status: form.status,
      sort_order: form.sort_order,
      tags: form.tags||null,
      is_featured: form.is_featured,
      is_new: form.is_new,
    };
    const res = await api('/creative-studio/drawings', { method:'POST', body: JSON.stringify(payload) });
    if (res.success) { setMsg(drawer?.mode==='edit' ? 'تم التحديث' : 'تم الإنشاء - ارفع PNG الآن'); setDrawer(null); load(); }
    else setMsg(`خطأ: ${res.error}`);
  }

  async function toggleField(id:string, field:string, val:any) {
    const res = await api(`/creative-studio/drawings/${id}`, { method:'PATCH', body: JSON.stringify({ [field]: val }) });
    if (res.success) load(); else setMsg(`خطأ: ${res.error}`);
  }

  async function doUpload(id:string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind','transparent');
    setMsg(`جارٍ رفع ${file.name}...`);
    const res = await apiRaw(`/creative-studio/drawings/${id}/upload`, { method:'POST', body: fd } as any);
    if (res.success) { setMsg(`تم الرفع`); load(); }
    else setMsg(`خطأ رفع: ${res.error}`);
  }

  async function uploadV2Files(files: FileList | null) {
    if (!files?.length || bulkUploading) return;
    const selected = Array.from(files);
    const seenIds = new Set<string>();
    const uploads: Array<{ id:string; file:File }> = [];
    const skipped: string[] = [];
    for (const file of selected) {
      const id = COLORING_V2_DRAWING_IDS[file.name.toLowerCase()];
      if (!id || seenIds.has(id)) {
        skipped.push(file.name);
        continue;
      }
      seenIds.add(id);
      uploads.push({ id, file });
    }
    if (!uploads.length) {
      setMsg('اختر ملفات PNG V2 المعتمدة مثل bird.png أو dino.png');
      return;
    }

    setBulkUploading(true);
    const failed: string[] = [];
    try {
      for (let index = 0; index < uploads.length; index += 1) {
        const { id, file } = uploads[index];
        setMsg(`جارٍ رفع ${index + 1} من ${uploads.length}: ${file.name}`);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', 'transparent');
        const res = await apiRaw(`/creative-studio/drawings/${id}/upload`, { method:'POST', body:fd } as any);
        if (!res.success) failed.push(`${file.name}: ${res.error || 'فشل الرفع'}`);
      }
      await load();
      const details = [
        `تم رفع ${uploads.length - failed.length} من ${uploads.length} ملف`,
        skipped.length ? `تم تخطي ${skipped.length} ملف غير مطابق` : '',
        failed.length ? `فشل: ${failed.join('، ')}` : '',
      ].filter(Boolean).join(' — ');
      setMsg(details);
    } finally {
      setBulkUploading(false);
    }
  }

  return (
    <div className="page-stack" dir="rtl">
      <div className="cs-hero">
        <div className="cs-hero__row">
          <div>
            <h1>تلوين<span className="cs-hero__tag">PNG شفاف 1024</span></h1>
            <p>إدارة رسومات التلوين — PNG شفاف بخطوط سوداء. تُحفظ في R2 وتُعرض عبر CDN.</p>
          </div>
          <div className="cs-hero__actions">
            <label className="button button--secondary" aria-disabled={bulkUploading}>
              {bulkUploading ? 'جارٍ الرفع...' : 'رفع صور V2 دفعة واحدة'}
              <input type="file" accept=".png,image/png" multiple disabled={bulkUploading} style={{ display:'none' }} onChange={e=>{ void uploadV2Files(e.target.files); e.currentTarget.value=''; }} />
            </label>
            <button className="button button--primary" onClick={openCreate}>رسمة جديدة</button>
            <button className="button button--secondary" onClick={load}>تحديث</button>
          </div>
        </div>
        <div className="cs-stats">
          {[
            { label:'الإجمالي', value:stats.total, sub:'من 12' },
            { label:'جاهز', value:stats.ready, sub:'ready/published' },
            { label:'مميز', value:stats.featured, sub:'في الرئيسية' },
            { label:'ينقصه رفع', value:stats.missing, sub:'بدون R2', danger:true },
          ].map(s=> (
            <div key={s.label} className="cs-stat">
              <div className="cs-stat__label">{s.label}</div>
              <div className={`cs-stat__value ${s.danger && s.value>0 ? 'cs-stat__value--danger' : ''}`}>{s.value}</div>
              <div className="cs-stat__sub">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {msg && <div className="creative-studio-notice"><span>{msg}</span><button className="creative-studio-notice__close" onClick={()=>setMsg(null)}>إغلاق</button></div>}

      <div className="cs-toolbar">
        <div className="cs-chip-row">
          {SUBS.map(s=> (
            <button key={s.id} onClick={()=>setSub(s.id)} className={`cs-chip ${sub===s.id ? 'cs-chip--active' : ''}`}>{s.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={()=>setView(view==='grid'?'list':'grid')} className="button button--secondary">{view==='grid'?'قائمة':'شبكة'}</button>
          <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="بحث بالعنوان..." className="cs-toolbar__search" />
        </div>
        <div className="cs-toolbar__row2" style={{ width:'100%' }}>
          {(['all','draft','ready','published'] as const).map(s=> (
            <button key={s} onClick={()=>setStatus(s)} className={`cs-chip ${status===s ? 'cs-chip--active' : ''}`} style={{ fontSize:11, padding:'5px 12px' }}>{s==='all'?'الكل':s}</button>
          ))}
          <label style={{ display:'flex', gap:6, alignItems:'center', fontSize:12, marginInlineStart:8, color:'var(--text-soft)', cursor:'pointer' }}><input type="checkbox" checked={onlyFeatured} onChange={e=> setOnlyFeatured(e.target.checked)} /> مميزة فقط</label>
          <span className="cs-count">{drawings.length} نتيجة</span>
        </div>
      </div>

      {loading ? (
        <div className="cs-grid">
          {Array.from({length:8}).map((_,i)=> <div key={i} className="cs-skeleton" />)}
        </div>
      ) : drawings.length===0 ? (
        <div className="cs-empty">
          <div className="cs-empty__icon">—</div>
          <div style={{ fontWeight:800, marginTop:12, color:'var(--text)' }}>لا يوجد رسومات</div>
          <div style={{ opacity:0.7, fontSize:13, marginTop:4 }}>أنشئ أول رسمة أو تأكد من البيانات</div>
          <button onClick={openCreate} className="button button--primary" style={{ marginTop:16 }}>إنشاء</button>
        </div>
      ) : view==='grid' ? (
        <div className="cs-grid">
          {drawings.map(d=> {
            const img = getImg(d);
            const hasImg = !!img;
            return (
              <div key={d.id} className="cs-card">
                <div className="cs-card__preview">
                  {hasImg ? <img src={img!} alt={d.title_ar} loading="lazy" /> : <span className="cs-card__placeholder" />}
                  <span className={`cs-card__badge cs-card__badge--status-${d.status}`}>{d.status}</span>
                  {(d.is_featured || d.is_new) && <span className="cs-card__badge cs-card__badge--feature">{d.is_featured ? 'مميزة' : ''} {d.is_new ? 'جديدة' : ''}</span>}
                  {!hasImg && <span className="cs-card__badge cs-card__badge--missing">ينقصه PNG</span>}
                </div>
                <div className="cs-card__body">
                  <div className="cs-card__title">{d.title_ar}</div>
                  <div className="cs-card__meta">
                    <span className="cs-card__meta-badge">{d.sub_category||d.category}</span>
                    <span>{d.age_min}-{d.age_max} سنوات</span>
                  </div>
                  <div className="cs-card__actions">
                    <button onClick={()=>openEdit(d)} className="button button--secondary">تعديل</button>
                    <label className="button button--primary" style={{ cursor:'pointer' }}>
                      رفع PNG
                      <input type="file" accept=".png,.webp,.jpg" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f) doUpload(d.id,f); e.currentTarget.value=''; }} />
                    </label>
                  </div>
                  <div className="cs-card__toggle-row">
                    <button onClick={()=>toggleField(d.id,'is_featured',!d.is_featured)} className={`button ${d.is_featured ? 'button--primary' : 'button--secondary'}`} style={{ flex:1 }}>{d.is_featured?'مميزة':'غير مميزة'}</button>
                    <button onClick={()=>{ if(confirm(`أرشفة ${d.title_ar}?`)) toggleField(d.id,'status','archived'); }} className="button button--ghost">حذف</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cs-table">
          <table>
            <thead><tr><th>صورة</th><th>عنوان</th><th>فئة</th><th>حالة</th><th>مميزة</th><th>إجراءات</th></tr></thead>
            <tbody>
              {drawings.map(d=> {
                const img = getImg(d);
                return (
                <tr key={d.id}>
                  <td><div className="cs-table__thumb">{img ? <img src={img!} /> : <span>—</span>}</div></td>
                  <td style={{ fontWeight:700 }}>{d.title_ar}<div style={{ fontSize:10, opacity:0.6 }}>{d.id}</div></td>
                  <td style={{ color:'var(--muted)' }}>{d.sub_category}</td>
                  <td><select value={d.status} onChange={e=>toggleField(d.id,'status',e.target.value)}><option>draft</option><option>ready</option><option>published</option></select></td>
                  <td><input type="checkbox" checked={d.is_featured} onChange={e=>toggleField(d.id,'is_featured',e.target.checked)} /></td>
                  <td><div style={{ display:'flex', gap:6 }}><button onClick={()=>openEdit(d)} className="button button--secondary">تعديل</button><label className="button button--primary" style={{ cursor:'pointer' }}>رفع<input type="file" hidden accept=".png" onChange={e=>{ const f=e.target.files?.[0]; if(f) doUpload(d.id,f); }} /></label></div></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {drawer && (
        <div className="cs-drawer">
          <div onClick={()=>setDrawer(null)} className="cs-drawer__overlay" />
          <div className="cs-drawer__panel">
            <div className="cs-drawer__header">
              <h3>{drawer.mode==='edit' ? 'تعديل رسمة' : 'رسمة جديدة'}</h3>
              <button onClick={()=>setDrawer(null)} className="cs-drawer__close">إغلاق</button>
            </div>
            <div className="cs-drawer__body">
              {previewUrl && <div className="cs-drawer__preview"><img src={previewUrl} /></div>}
              <label className="cs-field-label">العنوان العربي *</label>
              <input value={form.title_ar} onChange={e=> setForm((f:any)=>({...f, title_ar:e.target.value}))} placeholder="مثال: ديناصور" />
              <label className="cs-field-label">الفئة الفرعية</label>
              <select value={form.sub_category} onChange={e=> setForm((f:any)=>({...f, sub_category:e.target.value}))}>
                {SUBS.filter(s=>s.id!=='all').map(s=> <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <div className="cs-field-row">
                <div><label className="cs-field-label">العمر من</label><input type="number" value={form.age_min} onChange={e=> setForm((f:any)=>({...f, age_min:parseInt(e.target.value)||3}))} /></div>
                <div><label className="cs-field-label">إلى</label><input type="number" value={form.age_max} onChange={e=> setForm((f:any)=>({...f, age_max:parseInt(e.target.value)||6}))} /></div>
              </div>
              <div className="cs-field-row">
                <div><label className="cs-field-label">الصعوبة</label><select value={form.difficulty} onChange={e=> setForm((f:any)=>({...f, difficulty:e.target.value}))}><option>سهل</option><option>متوسط</option><option>مفصل</option></select></div>
                <div><label className="cs-field-label">الحالة</label><select value={form.status} onChange={e=> setForm((f:any)=>({...f, status:e.target.value}))}><option>draft</option><option>ready</option><option>published</option></select></div>
              </div>
              <label className="cs-field-label">تاغز</label><input value={form.tags} onChange={e=> setForm((f:any)=>({...f, tags:e.target.value}))} placeholder="ديناصور, حيوانات" />
              <label className="cs-field-label">ترتيب</label><input type="number" value={form.sort_order} onChange={e=> setForm((f:any)=>({...f, sort_order:parseInt(e.target.value)||0}))} />
              <div className="cs-checkbox-row">
                <label><input type="checkbox" checked={form.is_featured} onChange={e=> setForm((f:any)=>({...f, is_featured:e.target.checked}))}/> مميزة</label>
                <label><input type="checkbox" checked={form.is_new} onChange={e=> setForm((f:any)=>({...f, is_new:e.target.checked}))}/> جديدة</label>
              </div>
            </div>
            <div className="cs-drawer__footer">
              <button onClick={submit} className="button button--primary" style={{ flex:1 }}>حفظ</button>
              <button onClick={()=>setDrawer(null)} className="button button--secondary" style={{ flex:1 }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
