/**
 * Creative Studio Admin — R2-first complete manager
 * Covers all 10 studio categories: coloring, trace, letters, numbers,
 * connect_dots, complete, copy_pattern, free_draw, prompt_draw, draw_like_me.
 *
 * Features:
 * - List / filter by category, status, featured, search
 * - Create / edit drawing (title, category, difficulty, age, tags, palette)
 * - Upload to R2 (main, thumb, transparent) — no APK bundling
 * - PlayVeo generate: prompt -> T2I -> remove-bg -> auto-upload to R2 -> D1 update
 * - Publish / unpublish / feature / set new / reorder
 * - Preview via CDN URL
 * - Bulk actions
 */
import { useEffect, useState } from 'react';
import { creativeStudioAdmin, creativeStudioPublic } from '../lib/creativeStudioApi';

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
  url: string | null;
  thumb_url: string | null;
  transparent_url: string | null;
  image_url?: string | null;
  urls?: { main?: string | null; thumb?: string | null; transparent?: string | null; best?: string | null };
  palette: string[];
  status: string;
  is_featured: boolean;
  is_new: boolean;
  sort_order: number;
  tags: string | null;
  playveo_job_id: string | null;
  created_at: string;
  updated_at: string;
};

const CATS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'coloring', label: 'تلوين' },
  { id: 'birds', label: 'طيور (تلوين)' },
  { id: 'animals', label: 'حيوانات' },
  { id: 'vehicles', label: 'مركبات' },
  { id: 'space', label: 'فضاء' },
  { id: 'flowers', label: 'زهور' },
  { id: 'sea', label: 'بحرية' },
  { id: 'fruits', label: 'فواكه' },
  { id: 'toys', label: 'ألعاب' },
  { id: 'trace', label: 'تتبّع' },
  { id: 'letters', label: 'حروف' },
  { id: 'numbers', label: 'أرقام' },
  { id: 'connect_dots', label: 'وصل النقاط' },
  { id: 'complete', label: 'أكمل الرسمة' },
  { id: 'copy_pattern', label: 'انسخ النمط' },
  { id: 'free_draw', label: 'رسم حر' },
  { id: 'prompt_draw', label: 'ارسم من الفكرة' },
  { id: 'draw_like_me', label: 'ارسم مثلي' },
];

const STATUSES = ['all','draft','review','ready','published','archived'];

const api = creativeStudioAdmin;

export default function CreativeStudioAdminPage() {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [total, setTotal] = useState(0);
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string|null>(null);
  const [catalogueFallback, setCatalogueFallback] = useState(false);

  // create/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm] = useState<any>({ title_ar:'', category:'coloring', difficulty:'سهل', age_min:3, age_max:8, status:'draft', sort_order:0, tags:'', is_featured:false, is_new:true, palette:['#2B5AD8','#FF7E3A','#FFD400','#2EAC5A','#6A3DF2','#FF3E78','#111111','#FF8F2A'] });

  // generate
  const [showGen, setShowGen] = useState(false);
  const [genForm, setGenForm] = useState({ prompt:'', category:'coloring', title_ar:'', transparent:true, aspect_ratio:'1:1' });
  const [genBusy, setGenBusy] = useState(false);
  const [genLog, setGenLog] = useState<string>('');

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (cat !== 'all') params.set('category', cat);
    if (status !== 'all') params.set('status', status);
    if (search.trim()) params.set('q', search.trim());
    if (onlyFeatured) params.set('featured','1');
    params.set('limit','200');
    try {
      const res = await api(`/creative-studio/drawings?${params.toString()}`);
      if (res.success) {
        setDrawings(res.data as Drawing[]);
        setTotal((res.meta as any)?.total ?? (res.data as any[]).length);
        setCatalogueFallback(false);
        setMsg(null);
        return;
      }

      // A Pages deployment is hosted separately from the Worker. Keep the real,
      // ready catalogue visible if a staff session is unavailable.
      const publicStatus = status === 'all' ? 'ready,published' : status;
      if (!['ready', 'published', 'ready,published'].includes(publicStatus)) {
        setDrawings([]);
        setTotal(0);
        setCatalogueFallback(true);
        setMsg('تتطلب رؤية المسودات والمراجعات جلسة إدارة صالحة.');
        return;
      }
      const publicParams = new URLSearchParams(params);
      publicParams.set('status', publicStatus);
      const fallback = await creativeStudioPublic(`/creative-studio/drawings?${publicParams.toString()}`);
      if (fallback.success) {
        setDrawings(fallback.data as Drawing[]);
        setTotal((fallback.meta as any)?.total ?? (fallback.data as any[]).length);
        setCatalogueFallback(true);
        setMsg('تظهر قائمة الأنشطة الجاهزة. سجّل الدخول لإدارة المسودات والرفع والنشر.');
        return;
      }

      setDrawings([]);
      setTotal(0);
      setCatalogueFallback(false);
      setMsg(`تعذر تحميل الأنشطة: ${res.error || fallback.error || 'تحقق من الجلسة والاتصال'}`);
    } catch {
      setDrawings([]);
      setTotal(0);
      setCatalogueFallback(false);
      setMsg('تعذر الاتصال بخدمة الأنشطة. حاول التحديث مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, [cat, status, onlyFeatured]);
  // debounce search
  useEffect(()=>{ const t = setTimeout(()=>{ if (search!=='' ) load(); }, 600); return ()=>clearTimeout(t); }, [search]);

  function openCreate() {
    setEditingId(null);
    setForm({ title_ar:'', category: cat==='all' ? 'coloring' : cat, difficulty:'سهل', age_min:3, age_max:8, status:'draft', sort_order:drawings.length, tags:'', is_featured:false, is_new:true, palette:['#2B5AD8','#FF7E3A','#FFD400','#2EAC5A','#6A3DF2','#FF3E78','#111111','#FF8F2A'] });
    setShowForm(true);
  }
  function openEdit(d: Drawing) {
    setEditingId(d.id);
    setForm({ title_ar: d.title_ar, category: d.category, difficulty: d.difficulty, age_min: d.age_min, age_max: d.age_max, status: d.status, sort_order: d.sort_order, tags: d.tags||'', is_featured: d.is_featured, is_new: d.is_new, palette: d.palette });
    setShowForm(true);
  }

  async function submitForm() {
    if (!form.title_ar?.trim()) { setMsg('العنوان مطلوب'); return; }
    const payload: any = { ...form, id: editingId || form.title_ar.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').slice(0,60) || `drawing-${Date.now()}`, tags: form.tags?.toString().trim()||null };
    const res = await api('/creative-studio/drawings', { method:'POST', body: JSON.stringify(payload) });
    if (res.success) { setMsg('تم الحفظ'); setShowForm(false); load(); }
    else setMsg(`خطأ: ${res.error}`);
  }

  async function doGenerate() {
    if (!genForm.prompt.trim() || genForm.prompt.trim().length < 10) { setMsg('البرومبت قصير'); return; }
    setGenBusy(true); setGenLog('جاري الإرسال إلى PlayVeo...\n');
    const res = await api('/creative-studio/generate', { method:'POST', body: JSON.stringify({
      prompt: genForm.prompt,
      category: genForm.category,
      title_ar: genForm.title_ar || genForm.prompt.slice(0,80),
      transparent: genForm.transparent,
      aspect_ratio: genForm.aspect_ratio,
      count:1,
      model:'nano_banana_2',
    }) });
    if (res.success) {
      setGenLog(prev => prev + `نجح\nJob: ${res.data?.jobId}\nCDN: ${res.data?.cdnUrl}\nOriginal: ${res.data?.originalUrl}\nTransparent: ${res.data?.transparentUrl||'—'}\n`);
      setMsg('تم التوليد والرفع إلى R2'); load();
    } else {
      setGenLog(prev => prev + `فشل: ${res.error}\n`);
      setMsg(`فشل التوليد: ${res.error}`);
    }
    setGenBusy(false);
  }

  return (
    <div className="page-stack" dir="rtl">
      <div className="creative-studio-header">
        <div>
          <span className="creative-studio-header__eyebrow">مكتبة الأنشطة</span>
          <h1>استوديو الإبداع</h1>
          <p>راجع الرسومات، افتح محرر النشاط المناسب، وتابع حالة النشر من مكان واحد.</p>
        </div>
        <div className="row gap">
          <span className="creative-studio-count">{total} نشاطاً</span>
          <button className="button button--secondary" onClick={openCreate} disabled={catalogueFallback}>نشاط جديد</button>
          <button className="button button--secondary" onClick={()=> setShowGen(v=>!v)} disabled={catalogueFallback}>توليد</button>
          <button className="button button--primary" onClick={load}>تحديث القائمة</button>
        </div>
      </div>

      {msg && <div className="creative-studio-notice"><span>{msg}</span><button className="creative-studio-notice__close" onClick={()=>setMsg(null)} aria-label="إغلاق">إغلاق</button></div>}

      {/* Filters */}
      <div className="creative-studio-filters">
        <label>نوع النشاط<select value={cat} onChange={e=>setCat(e.target.value)}>{CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>الحالة<select value={status} onChange={e=>setStatus(e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'كل الحالات' : s}</option>)}</select></label>
        <label className="creative-studio-search"><span>ابحث</span><input placeholder="العنوان أو المعرّف أو الوسم" value={search} onChange={e=> setSearch(e.target.value)} onKeyDown={e=> e.key==='Enter' && load()} /></label>
        <label className="creative-studio-featured"><input type="checkbox" checked={onlyFeatured} onChange={e=> setOnlyFeatured(e.target.checked)} /> الأنشطة المميزة فقط</label>
      </div>

      {/* معلومات النظام: تفاصيل تقنية للمطوّرين فقط، مطوية بشكل افتراضي بدل عرضها دائمًا فوق الجدول. */}
      <details className="creative-studio-sysinfo">
        <summary>معلومات النظام</summary>
        <ul>
          <li>كل رسومات الاستوديو تُحفظ في THUMBS_BUCKET وتُقرأ عبر CDN <code dir="ltr">https://cdn.majarra.app/public/studio/{'{category}'}/*.png</code> مباشرة بلا تضمين في التطبيق.</li>
          <li>التطبيق يعمل R2-first مع نسخة محلية عبر Hive cache و fallback عند انقطاع الاتصال.</li>
          <li>الشفافية ضرورية للتلوين — يجب أن يكون PNG ب rounded أبيض شفاف لأن القماش يرسم Multiply، وخلفية JPEG لا تنفع.</li>
          <li>مسار التوليد: <code dir="ltr">POST /v1/images/text-to-image</code> (pending) ← <code dir="ltr">GET /v1/images/:id</code> (poll) ← resultUrls[0] JPEG ← <code dir="ltr">POST /v1/images/remove-background</code> (url) ← PNG شفاف ← رفع R2 ← تحديث D1.</li>
          <li>الحفظ على الموبايل: <code dir="ltr">RepaintBoundary.toImage</code> ← PNG bytes ← <code dir="ltr">image_gallery_saver</code> و <code dir="ltr">share_plus</code>.</li>
        </ul>
      </details>

      {/* Generate panel */}
      {showGen && (
        <div className="creative-studio-panel">
          <h3>توليد صورة جديدة</h3>
          <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label>البرومبت (يجب أن يكون Line Art مغلق للتلوين)</label>
              <textarea className="input" style={{ minHeight:100, width:'100%' }} value={genForm.prompt} onChange={e=> setGenForm(f=>({...f, prompt:e.target.value}))}
                placeholder="مثال: cute kawaii bird with big eyes, thick bold outlines, pure white background, closed shapes only, no shading, centered" />
            </div>
            <div className="stack gap">
              <label>عنوان عربي</label><input className="input" value={genForm.title_ar} onChange={e=> setGenForm(f=>({...f, title_ar:e.target.value}))} placeholder="عصفور صغير" />
              <label>قسم</label><select className="select" value={genForm.category} onChange={e=> setGenForm(f=>({...f, category:e.target.value}))}>{CATS.filter(c=>c.id!=='all').map(c=> <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              <div className="row gap">
                <label className="row gap"><input type="checkbox" checked={genForm.transparent} onChange={e=> setGenForm(f=>({...f, transparent:e.target.checked}))}/> شفافة (إزالة الخلفية)</label>
                <select className="select" value={genForm.aspect_ratio} onChange={e=> setGenForm(f=>({...f, aspect_ratio:e.target.value}))}><option value="1:1">1:1</option><option value="16:9">16:9</option></select>
              </div>
              <button className="button button--primary" disabled={genBusy} onClick={doGenerate}>{genBusy? 'جاري التوليد...' : 'ولّد وارفع'}</button>
              {genLog && <pre style={{ background:'#111', color:'#0f0', padding:8, maxHeight:200, overflow:'auto', fontSize:12, whiteSpace:'pre-wrap' }}>{genLog}</pre>}
            </div>
          </div>
          <p className="text-xs opacity-70 mt-2">التكلفة: 0.1$ للتوليد + 0.05$ لإزالة الخلفية = 0.15$ لكل رسمة تلوين شفافة.</p>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="creative-studio-panel">
          <h3>{editingId ? `تعديل ${editingId}` : 'رسمة جديدة'}</h3>
          <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="stack gap">
              <label>العنوان العربي *</label><input className="input" value={form.title_ar} onChange={e=> setForm((f:any)=>({...f, title_ar:e.target.value}))} />
              <label>القسم</label><select className="select" value={form.category} onChange={e=> setForm((f:any)=>({...f, category:e.target.value}))}>{CATS.filter(c=>c.id!=='all').map(c=> <option key={c.id} value={c.id}>{c.id} — {c.label}</option>)}</select>
              <div className="row gap">
                <div style={{ flex:1 }}><label>العمر من</label><input type="number" className="input" value={form.age_min} onChange={e=> setForm((f:any)=>({...f, age_min:parseInt(e.target.value)||3}))} /></div>
                <div style={{ flex:1 }}><label>العمر إلى</label><input type="number" className="input" value={form.age_max} onChange={e=> setForm((f:any)=>({...f, age_max:parseInt(e.target.value)||12}))} /></div>
              </div>
              <div className="row gap">
                <div style={{ flex:1 }}><label>الصعوبة</label><select className="select" value={form.difficulty} onChange={e=> setForm((f:any)=>({...f, difficulty:e.target.value}))}><option>سهل</option><option>متوسط</option><option>مفصل</option><option>easy</option><option>medium</option><option>hard</option></select></div>
                <div style={{ flex:1 }}><label>الحالة</label><select className="select" value={form.status} onChange={e=> setForm((f:any)=>({...f, status:e.target.value}))}><option>draft</option><option>ready</option><option>published</option><option>archived</option></select></div>
              </div>
              <label>تاغز (فاصلة)</label><input className="input" value={form.tags} onChange={e=> setForm((f:any)=>({...f, tags:e.target.value}))} placeholder="طيور, سهل" />
              <label>ترتيب</label><input type="number" className="input" value={form.sort_order} onChange={e=> setForm((f:any)=>({...f, sort_order:parseInt(e.target.value)||0}))} />
            </div>
            <div className="stack gap">
              <div className="row gap">
                <label className="row gap"><input type="checkbox" checked={form.is_featured} onChange={e=> setForm((f:any)=>({...f, is_featured:e.target.checked}))}/> مميزة</label>
                <label className="row gap"><input type="checkbox" checked={form.is_new} onChange={e=> setForm((f:any)=>({...f, is_new:e.target.checked}))}/> جديدة</label>
              </div>
              <label>باليت الألوان (JSON array)</label>
              <input className="input" value={JSON.stringify(form.palette)} onChange={e=>{ try{ const p = JSON.parse(e.target.value); setForm((f:any)=>({...f, palette:p})); } catch{} }} />
              <div className="row gap" style={{ flexWrap:'wrap' }}>{form.palette?.map((c:string,i:number)=><span key={i} style={{ width:22, height:22, borderRadius:11, background:c, border:'1px solid #ccc', display:'inline-block' }} title={c}></span>)}</div>
              {editingId && <p className="text-xs opacity-60">ID: {editingId} — بعد الحفظ استخدم رفع R2 أسفل الجدول</p>}
            </div>
          </div>
          <div className="row gap mt-3">
            <button className="button button--primary" onClick={submitForm}>حفظ</button>
            <button className="button button--secondary" onClick={()=> setShowForm(false)}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="creative-studio-catalogue" aria-live="polite">
        {loading ? <div className="creative-studio-empty"><span className="spinner" aria-hidden="true" /><strong>جارٍ تحميل الأنشطة</strong></div> : drawings.map((drawing) => (
          <article className="creative-studio-activity" key={drawing.id}>
            <div className="creative-studio-activity__preview">
              {imageFor(drawing)
                ? <img src={imageFor(drawing)!} alt={`معاينة ${drawing.title_ar}`} onError={(event) => { event.currentTarget.style.display = 'none' }} />
                : <span className="creative-studio-activity__placeholder" aria-hidden="true" />}
            </div>
            <div className="creative-studio-activity__body">
              <div className="creative-studio-activity__topline">
                <span>{categoryLabel(drawing.category)}</span>
                <span className={`creative-studio-status creative-studio-status--${drawing.status}`}>{statusLabel(drawing.status)}</span>
              </div>
              <h2>{drawing.title_ar}</h2>
              <p>{drawing.age_min} إلى {drawing.age_max} سنوات <b>·</b> {drawing.difficulty}</p>
              <small>{drawing.id}</small>
            </div>
            <div className="creative-studio-activity__actions">
              {imageFor(drawing) && <a className="button button--ghost" href={imageFor(drawing)!} target="_blank" rel="noreferrer">معاينة</a>}
              <button className="button button--secondary" disabled={catalogueFallback} onClick={() => openEdit(drawing)}>تعديل</button>
            </div>
          </article>
        ))}
        {!loading && !drawings.length && <div className="creative-studio-empty"><strong>لا توجد أنشطة مطابقة</strong><span>غيّر الفلاتر أو حدّث القائمة.</span></div>}
      </div>

    </div>
  );
}

function imageFor(drawing: Drawing) {
  return drawing.transparent_url || drawing.url || drawing.image_url || drawing.urls?.transparent || drawing.urls?.best || drawing.urls?.main || drawing.thumb_url || null;
}

function categoryLabel(category: string) {
  return CATS.find((item) => item.id === category)?.label ?? category
}

function statusLabel(status: string) {
  return ({ draft: 'مسودة', review: 'قيد المراجعة', ready: 'جاهز', published: 'منشور', archived: 'مؤرشف' } as Record<string, string>)[status] ?? status
}
