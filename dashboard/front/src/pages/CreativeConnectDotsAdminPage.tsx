import { useEffect, useRef, useState } from 'react';
import { creativeStudioAdmin, creativeStudioPublic } from '../lib/creativeStudioApi';

type Dot = { id: string; order: number; at: [number, number] };
type Drawing = {
  id: string;
  title_ar: string;
  age_min: number;
  age_max: number;
  difficulty: string;
  status: string;
  sort_order: number;
  url: string | null;
  geometry: { dots?: Dot[] } | null;
};

const admin = creativeStudioAdmin;

function normalizedDots(value: Drawing['geometry']): Dot[] {
  const dots = value?.dots ?? [];
  return dots
    .filter((dot) => Array.isArray(dot.at) && dot.at.length === 2)
    .map((dot, index) => ({
      id: dot.id || `d${index + 1}`,
      order: index + 1,
      at: [Math.max(0, Math.min(1, dot.at[0])), Math.max(0, Math.min(1, dot.at[1]))] as [number, number],
    }))
    .sort((a, b) => a.order - b.order)
    .map((dot, index) => ({ ...dot, order: index + 1 }));
}

export default function CreativeConnectDotsAdminPage() {
  const [items, setItems] = useState<Drawing[]>([]);
  const [selected, setSelected] = useState<Drawing | null>(null);
  const [dots, setDots] = useState<Dot[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  async function load(preferredId?: string) {
    setLoading(true);
    let result = await admin('/creative-studio/drawings?category=connect_dots&limit=100');
    if (!result.success) result = await creativeStudioPublic('/creative-studio/drawings?category=connect_dots&status=ready,published&limit=100');
    if (!result.success) {
      setItems([]);
      setNotice(`تعذر تحميل الأنشطة: ${result.error || 'خطأ غير معروف'}`);
      setLoading(false);
      return;
    }
    const list = (result.data as Drawing[]).sort((a, b) => a.sort_order - b.sort_order);
    const next = list.find((item) => item.id === preferredId) ?? list.find((item) => item.id === selected?.id) ?? list[0] ?? null;
    setItems(list);
    setSelected(next);
    setDots(normalizedDots(next?.geometry ?? null));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function select(item: Drawing) {
    setSelected(item);
    setDots(normalizedDots(item.geometry));
    setNotice(null);
  }

  function position(event: React.PointerEvent<HTMLDivElement>): [number, number] | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return [
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    ];
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const point = position(event);
    if (!point) return;
    const hit = dots.findIndex((dot) => Math.hypot(dot.at[0] - point[0], dot.at[1] - point[1]) < 0.055);
    if (hit >= 0) {
      dragging.current = hit;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    setDots((current) => [...current, { id: `d${current.length + 1}`, order: current.length + 1, at: point }]);
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const index = dragging.current;
    const point = position(event);
    if (index == null || !point) return;
    setDots((current) => current.map((dot, itemIndex) => itemIndex === index ? { ...dot, at: point } : dot));
  }

  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current != null && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragging.current = null;
  }

  async function upload(file: File | undefined) {
    if (!selected || !file) return;
    const data = new FormData();
    data.append('kind', 'main');
    data.append('file', file);
    setNotice(`جارٍ رفع ${file.name}...`);
    const result = await admin(`/creative-studio/drawings/${selected.id}/upload`, { method: 'POST', body: data });
    if (!result.success) {
      setNotice(`فشل الرفع: ${result.error || 'خطأ غير معروف'}`);
      return;
    }
    setNotice('تم رفع PNG. احفظ النقاط ثم غيّر الحالة إلى ready عند اكتمال المراجعة.');
    await load(selected.id);
  }

  async function save() {
    if (!selected) return;
    if (dots.length < 2) {
      setNotice('أضف نقطتين على الأقل قبل الحفظ.');
      return;
    }
    const ordered = dots.map((dot, index) => ({ ...dot, id: `d${index + 1}`, order: index + 1 }));
    const result = await admin(`/creative-studio/drawings/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ geometry: { dots: ordered } }),
    });
    if (!result.success) {
      setNotice(`تعذر حفظ النقاط: ${result.error || 'خطأ غير معروف'}`);
      return;
    }
    setDots(ordered);
    setNotice(`تم حفظ ${ordered.length} نقطة بالترتيب.`);
    await load(selected.id);
  }

  async function setStatus(status: 'draft' | 'ready' | 'published') {
    if (!selected) return;
    if (dots.length < 2) {
      setNotice('يتطلب ready نقطتين صحيحتين على الأقل.');
      return;
    }
    const result = await admin(`/creative-studio/drawings/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (!result.success) setNotice(`تعذر تغيير الحالة: ${result.error || 'خطأ غير معروف'}`);
    else await load(selected.id);
  }

  return (
    <div dir="rtl" style={{ display: 'grid', gridTemplateColumns: 'minmax(210px, 280px) minmax(0, 1fr)', gap: 16, paddingBottom: 28 }}>
      <aside className="cs-table" style={{ overflow: 'hidden', alignSelf: 'start' }}>
        <div style={{ padding: 15, borderBottom: '1px solid var(--line)' }}>
          <strong>وصل النقاط</strong>
          <small style={{ display: 'block', color: 'var(--muted)', marginTop: 5 }}>10 أنشطة PNG مع نقاط مرتبة</small>
        </div>
        {loading ? <p style={{ color: 'var(--text-soft)', padding: 14 }}>جارٍ التحميل...</p> : items.map((item) => (
          <button key={item.id} onClick={() => select(item)} className="cs-trace-item" style={{ background: selected?.id === item.id ? 'var(--surface-3)' : 'transparent' }}>
            <strong>{item.title_ar}</strong>
            <small style={{ display: 'block', color: item.status === 'draft' ? 'var(--warning)' : 'var(--success)', marginTop: 4 }}>{item.status} · {normalizedDots(item.geometry).length} نقطة</small>
          </button>
        ))}
      </aside>
      <main style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <div className="cs-hero">
          <h1>محرر وصل النقاط</h1>
          <p>اضغط لإضافة نقطة، واسحب نقطة موجودة لتغيير مكانها. يعاد ترقيم النقاط تلقائياً عند الحفظ.</p>
        </div>
        {notice && <div className="creative-studio-notice"><span>{notice}</span><button className="creative-studio-notice__close" onClick={()=>setNotice(null)}>إغلاق</button></div>}
        {selected && (
          <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', gap: 14 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} style={{ position: 'relative', aspectRatio: '1', maxWidth: 680, width: '100%', justifySelf: 'center', overflow: 'hidden', touchAction: 'none', background: '#fff', borderRadius: 16, cursor: 'crosshair' }}>
                {selected.url ? <img src={selected.url} alt={selected.title_ar} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }} /> : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#64748b' }}>ارفع ملف PNG لبدء المعاينة</div>}
                {dots.map((dot) => <span key={dot.id} style={{ position: 'absolute', left: `${dot.at[0] * 100}%`, top: `${dot.at[1] * 100}%`, transform: 'translate(-50%,-50%)', display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 99, color: '#fff', background: '#2563eb', border: '3px solid #fff', boxShadow: '0 1px 5px #0008', fontSize: 12, fontWeight: 900, pointerEvents: 'none' }}>{dot.order}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label className="button button--secondary" style={{ cursor: 'pointer' }}>رفع PNG<input hidden type="file" accept=".png,image/png" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
                <button onClick={() => setDots((current) => current.slice(0, -1).map((dot, index) => ({ ...dot, order: index + 1 })))} className="button button--secondary">حذف الأخيرة</button>
                <button onClick={() => setDots([])} className="button button--secondary">مسح النقاط</button>
                <button onClick={() => void save()} className="button button--primary">حفظ النقاط</button>
              </div>
            </div>
            <section className="creative-studio-panel">
              <strong>{selected.title_ar}</strong>
              <small style={{ display: 'block', color: 'var(--muted)', marginTop: 5 }}>{selected.age_min}-{selected.age_max} سنوات · {selected.difficulty}</small>
              <p style={{ color: 'var(--text-soft)', fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>{dots.length} نقطة. لا يمكن نشر النشاط قبل رفع PNG وحفظ نقطتين على الأقل.</p>
              <div style={{ display: 'grid', gap: 7 }}>
                <button onClick={() => void setStatus('ready')} className="button button--primary">جاهز للمراجعة</button>
                <button onClick={() => void setStatus('published')} className="button button--secondary">نشر</button>
                <button onClick={() => void setStatus('draft')} className="button button--secondary">إرجاع لمسودة</button>
              </div>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
