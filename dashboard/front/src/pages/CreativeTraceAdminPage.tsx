import { useEffect, useState } from 'react';
import { creativeStudioAdmin, creativeStudioPublic } from '../lib/creativeStudioApi';

type Point = [number, number];
type Stroke = { id: string; order: number; type: 'stroke' | 'dot'; points: Point[] };
type Drawing = { id: string; category: 'trace' | 'letters' | 'numbers'; title_ar: string; status: string; url: string | null; geometry: { strokePaths?: Stroke[] } | null; sort_order: number };
const categories: Drawing['category'][] = ['trace', 'letters', 'numbers'];
const categoryLabel: Record<Drawing['category'], string> = { trace: 'تتبّع', letters: 'حروف', numbers: 'أرقام' };

const admin = creativeStudioAdmin;
function normalize(value: Drawing['geometry']): Stroke[] {
  return (value?.strokePaths ?? []).map((stroke, index) => ({ ...stroke, id: stroke.id || `s${index + 1}`, order: index + 1, type: stroke.type === 'dot' ? 'dot' : 'stroke', points: stroke.points ?? [] }));
}

export default function CreativeTraceAdminPage() {
  const [category, setCategory] = useState<Drawing['category']>('trace');
  const [items, setItems] = useState<Drawing[]>([]);
  const [selected, setSelected] = useState<Drawing | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  async function load(preferred?: string) {
    let result = await admin(`/creative-studio/drawings?category=${category}&limit=100`);
    if (!result.success) result = await creativeStudioPublic(`/creative-studio/drawings?category=${category}&status=ready,published&limit=100`);
    if (!result.success) { setNotice(`تعذر التحميل: ${result.error || 'خطأ غير معروف'}`); return; }
    const list = (result.data as Drawing[]).sort((a, b) => a.sort_order - b.sort_order);
    const next = list.find((item) => item.id === preferred) ?? list[0] ?? null;
    setItems(list); setSelected(next); setStrokes(normalize(next?.geometry ?? null)); setActive(0);
  }
  useEffect(() => { void load(); }, [category]);
  function choose(item: Drawing) { setSelected(item); setStrokes(normalize(item.geometry)); setActive(0); setNotice(null); }
  function addPoint(event: React.MouseEvent<SVGSVGElement>) {
    if (!strokes[active]) return;
    const box = event.currentTarget.getBoundingClientRect();
    const point: Point = [Math.round(((event.clientX - box.left) / box.width) * 100) / 100, Math.round(((event.clientY - box.top) / box.height) * 100) / 100];
    setStrokes((current) => current.map((stroke, index) => index === active ? { ...stroke, points: [...stroke.points, point] } : stroke));
  }
  function addStroke(type: Stroke['type']) { setStrokes((current) => [...current, { id: `s${current.length + 1}`, order: current.length + 1, type, points: [] }]); setActive(strokes.length); }
  function removePoint() { setStrokes((current) => current.map((stroke, index) => index === active ? { ...stroke, points: stroke.points.slice(0, -1) } : stroke)); }
  async function upload(file: File | undefined) {
    if (!selected || !file) return;
    const form = new FormData(); form.append('kind', 'main'); form.append('file', file);
    const result = await admin(`/creative-studio/drawings/${selected.id}/upload`, { method: 'POST', body: form });
    if (!result.success) setNotice(`فشل الرفع: ${result.error || 'خطأ غير معروف'}`); else { setNotice('تم رفع SVG إلى R2.'); await load(selected.id); }
  }
  async function save(status?: 'ready' | 'published') {
    if (!selected) return;
    const geometry = { strokePaths: strokes.map((stroke, index) => ({ ...stroke, id: `s${index + 1}`, order: index + 1 })) };
    const result = await admin(`/creative-studio/drawings/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ geometry, ...(status ? { status } : {}) }) });
    if (!result.success) setNotice(`تعذر الحفظ: ${result.error || 'خطأ غير معروف'}`); else { setNotice(status ? `تم تغيير الحالة إلى ${status}.` : 'تم حفظ المسارات.'); await load(selected.id); }
  }

  return (
    <div dir="rtl" style={{ display: 'grid', gridTemplateColumns: '250px minmax(0,1fr)', gap: 16, paddingBottom: 28 }}>
      <aside className="cs-table" style={{ overflow: 'hidden', alignSelf: 'start' }}>
        <div style={{ display: 'flex', gap: 6, padding: 12, borderBottom: '1px solid var(--line)' }}>
          {categories.map((item) => (
            <button key={item} onClick={() => setCategory(item)} className={`cs-chip ${category === item ? 'cs-chip--active' : ''}`} style={{ flex: 1, textAlign: 'center' }}>{categoryLabel[item]}</button>
          ))}
        </div>
        {items.map((item) => (
          <button key={item.id} onClick={() => choose(item)} className="cs-trace-item" style={{ background: selected?.id === item.id ? 'var(--surface-3)' : 'transparent' }}>
            <strong>{item.title_ar}</strong>
            <small style={{ display: 'block', color: item.status === 'draft' ? 'var(--warning)' : 'var(--success)' }}>{item.status} · {normalize(item.geometry).length} مسار</small>
          </button>
        ))}
      </aside>
      <main style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <div className="cs-hero">
          <h1>محرر التتبع</h1>
          <p>ارفع SVG، ثم ألّف المسارات بإحداثيات 0..1. النشر يتطلب SVG موجوداً ومسارات صالحة.</p>
        </div>
        {notice && <div className="creative-studio-notice"><span>{notice}</span><button className="creative-studio-notice__close" onClick={()=>setNotice(null)}>إغلاق</button></div>}
        {selected && (
          <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 240px', gap: 14 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <svg viewBox="0 0 1 1" onClick={addPoint} style={{ width: '100%', maxWidth: 680, aspectRatio: '1', justifySelf: 'center', background: '#fff', borderRadius: 14, cursor: 'crosshair' }}>
                {selected.url && <image href={selected.url} x="0" y="0" width="1" height="1" opacity=".32" preserveAspectRatio="xMidYMid meet" />}
                {strokes.map((stroke, index) => (
                  <g key={stroke.id}>
                    {stroke.points.length > 1 && <polyline points={stroke.points.map((point) => point.join(',')).join(' ')} fill="none" stroke={index === active ? '#2563eb' : '#94a3b8'} strokeWidth=".014" />}
                    {stroke.points.map((point, pointIndex) => <circle key={pointIndex} cx={point[0]} cy={point[1]} r=".02" fill={index === active ? '#2563eb' : '#94a3b8'} />)}
                  </g>
                ))}
              </svg>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label className="button button--secondary" style={{ cursor: 'pointer' }}>رفع SVG<input hidden type="file" accept=".svg,image/svg+xml" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
                <button onClick={() => addStroke('stroke')} className="button button--secondary">مسار جديد</button>
                <button onClick={() => addStroke('dot')} className="button button--secondary">نقطة جديدة</button>
                <button onClick={removePoint} className="button button--secondary">حذف النقطة</button>
                <button onClick={() => void save()} className="button button--primary">حفظ</button>
              </div>
            </div>
            <section className="creative-studio-panel">
              <strong>{selected.title_ar}</strong>
              <select value={active} onChange={(event) => setActive(Number(event.target.value))} style={{ marginTop: 12 }}>
                {strokes.map((stroke, index) => <option key={stroke.id} value={index}>{stroke.id} · {stroke.type} · {stroke.points.length} نقاط</option>)}
              </select>
              <p style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 10 }}>تحتاج stroke نقطتين، وتحتاج dot نقطة واحدة.</p>
              <button onClick={() => void save('ready')} className="button button--primary" style={{ width: '100%' }}>جاهز</button>
              <button onClick={() => void save('published')} className="button button--secondary" style={{ width: '100%', marginTop: 8 }}>نشر</button>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
