import { useEffect, useMemo, useState } from 'react';
import { polygonArea, validateRegions, containsPoint, type Point, type Region } from '../lib/coloringPolygon';

export function TracePathEditor({ value, onChange }: { value: Point[]; onChange: (pts: Point[]) => void }) {
  const [pts, setPts] = useState<Point[]>(value);
  useEffect(() => setPts(value), [value]);
  const add = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const next = [...pts, [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as Point];
    setPts(next); onChange(next);
  };
  const removeLast = () => {
    const next = pts.slice(0, -1); setPts(next); onChange(next);
  };
  return (
    <div className="stack">
      <svg viewBox="0 0 1 1" onClick={add} style={{ border: '1px solid #e2e8f0', aspectRatio: '1', width: '100%', maxWidth: 420 }}>
        <rect width="1" height="1" fill="#fff" />
        {pts.length > 1 && <polyline points={pts.map((p) => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke="#0F172A" strokeWidth="0.012" strokeLinejoin="round" />}
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="0.018" fill={i === 0 ? '#22C55E' : '#0F172A'} />)}
      </svg>
      <div className="row gap">
        <button className="btn" onClick={removeLast} disabled={pts.length === 0}>تراجع</button>
        <button className="btn" onClick={() => { setPts([]); onChange([]); }}>مسح</button>
        <span className="text-sm opacity-70">{pts.length} نقاط — اضغط لإضافة • إحداثيات 0..1</span>
      </div>
      {pts.length > 0 && pts.length < 2 && <p className="text-xs" style={{ color: '#B45309' }}>يحتاج نقطتين على الأقل ليكون قابلًا للتتبع</p>}
    </div>
  );
}

export function ColorRegionEditor({ polygon, onChange, templateSrc }: { polygon: Point[]; onChange: (p: Point[]) => void; templateSrc?: string }) {
  const [pts, setPts] = useState<Point[]>(polygon);
  useEffect(() => setPts(polygon), [polygon]);
  const add = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const next = [...pts, [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as Point];
    setPts(next); onChange(next);
  };
  const removeLast = () => { const n = pts.slice(0, -1); setPts(n); onChange(n); };
  const area = polygonArea(pts);
  const valid = pts.length >= 3 && area >= 0.0005;
  return (
    <div className="stack">
      <svg viewBox="0 0 1 1" onClick={add} style={{ border: '1px solid #e2e8f0', aspectRatio: '1', width: '100%', maxWidth: 420 }}>
        {/* Template image behind polygon — same 0..1 space as runtime */}
        {templateSrc ? <image href={templateSrc} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid meet" opacity={0.35} /> : <rect width="1" height="1" fill="#fff" />}
        {pts.length >= 3 && <polygon points={pts.map((p) => `${p[0]},${p[1]}`).join(' ')} fill="#FEF3C7" fillOpacity={0.55} stroke="#F59E0B" strokeWidth="0.008" />}
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="0.016" fill={i === 0 ? '#22C55E' : '#0F172A'} stroke="#fff" strokeWidth="0.003" />)}
      </svg>
      <div className="row gap">
        <button className="btn" onClick={removeLast} disabled={pts.length === 0}>تراجع</button>
        <button className="btn" onClick={() => { setPts([]); onChange([]); }}>مسح المنطقة</button>
        <span className="text-sm opacity-70">{pts.length} رؤوس • مساحة {area.toFixed(4)} {valid ? '✓' : '— يحتاج ≥3 ومساحة ≥0.0005'}</span>
      </div>
    </div>
  );
}

export function ConnectDotsEditor({ dots, onChange }: { dots: { id: string; at: Point }[]; onChange: (d: any[]) => void }) {
  const [ds, setDs] = useState(dots);
  useEffect(() => setDs(dots), [dots]);
  const add = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const next = [...ds, { id: `d${ds.length + 1}`, order: ds.length + 1, at: [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as Point }];
    setDs(next); onChange(next);
  };
  return (
    <div className="stack">
      <svg viewBox="0 0 1 1" onClick={add} style={{ border: '1px solid #e2e8f0', aspectRatio: '1', width: '100%', maxWidth: 420 }}>
        <rect width="1" height="1" fill="#fff" />
        {ds.length >= 2 && <polyline points={ds.map((d) => `${d.at[0]},${d.at[1]}`).join(' ')} fill="none" stroke="#CBD5E1" strokeWidth="0.008" strokeDasharray="0.02 0.02" />}
        {ds.map((d, i) => <g key={d.id}><circle cx={d.at[0]} cy={d.at[1]} r="0.03" fill="#fff" stroke="#0F172A" strokeWidth="0.006" /><text x={d.at[0]} y={d.at[1] + 0.008} textAnchor="middle" fontSize="0.04" fill="#0F172A">{i + 1}</text></g>)}
      </svg>
      <div className="row gap">
        <button className="btn" onClick={() => { const n = ds.slice(0, -1); setDs(n); onChange(n); }} disabled={ds.length === 0}>تراجع</button>
        <button className="btn" onClick={() => { setDs([]); onChange([]); }}>مسح النقاط</button>
        <span className="text-sm opacity-70">{ds.length} نقطة</span>
      </div>
    </div>
  );
}

type TemplateMeta = { id: string; label: string; assetId: string };

function ColoringWorkspace({ template, onSave }: { template: TemplateMeta; onSave: (regions: Region[]) => void }) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [regionId, setRegionId] = useState('bird.body');
  const active = regions[activeIdx];
  const previewSrc = `/assets/images/drawing/coloring/${template.assetId.replace('asset-color-', 'color-')}.svg`;

  const errors = useMemo(() => validateRegions(regions), [regions]);
  const canSave = errors.length === 0 && regions.length >= 1 && regions.every((r) => r.polygon.length >= 3);

  const addRegion = () => {
    const id = `${template.id}.${regions.length + 1}`;
    const next: Region = { id, polygon: [] };
    setRegions((prev) => [...prev, next]);
    setActiveIdx(regions.length);
    setRegionId(id);
  };

  const updateActive = (poly: Point[]) => {
    setRegions((prev) => prev.map((r, i) => i === activeIdx ? { ...r, polygon: poly, id: regionId } : r));
  };

  const deleteActive = () => {
    setRegions((prev) => prev.filter((_, i) => i !== activeIdx));
    setActiveIdx((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="card p-4">
      <div className="row gap" style={{ justifyContent: 'space-between' }}>
        <h3>مناطق تلوين — {template.label} <span className="text-xs opacity-60">({template.id})</span></h3>
        <span className="text-xs opacity-60">الخلفية: {template.assetId} • 0..1 مطابقة للـ runtime</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <div className="row gap mb-2">
            <select className="select" value={activeIdx} onChange={(e) => { setActiveIdx(Number(e.target.value)); setRegionId(regions[Number(e.target.value)]?.id ?? ''); }}>
              {regions.map((r, i) => <option key={r.id + i} value={i}>{r.id} ({r.polygon.length})</option>)}
              {regions.length === 0 && <option value={0}>— لا مناطق —</option>}
            </select>
            <button className="btn btn-sm" onClick={addRegion}>+ منطقة</button>
            <button className="btn btn-sm" onClick={deleteActive} disabled={regions.length === 0}>حذف</button>
          </div>
          <label className="text-xs">معرّف المنطقة</label>
          <input className="input mt-1" value={regionId} onChange={(e) => setRegionId(e.target.value)} placeholder="bird.body" />
          {active ? (
            <div className="mt-3">
              <ColorRegionEditor key={active.id} polygon={active.polygon} onChange={updateActive} templateSrc={previewSrc} />
            </div>
          ) : (
            <p className="text-sm opacity-60 mt-3">اضغط + منطقة للبدء</p>
          )}
        </div>
        <div>
          <h4 className="text-sm">معاينة مطابقة للـ runtime</h4>
          <svg viewBox="0 0 1 1" style={{ border: '1px solid #e2e8f0', width: '100%', aspectRatio: '1', background: '#fff' }}>
            <image href={previewSrc} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid meet" opacity={0.3} />
            {regions.map((r) => (
              <polygon key={r.id} points={r.polygon.map((p) => `${p[0]},${p[1]}`).join(' ')} fill="#60A5FA" fillOpacity={r.id === regionId ? 0.35 : 0.18} stroke={r.id === regionId ? '#2563EB' : '#93C5FD'} strokeWidth="0.006" />
            ))}
          </svg>
          <p className="text-xs opacity-60 mt-1">النقر في runtime يستخدم نفس hitRegionAt (ترتيب الطلاء: الأخير = الأعلى). جرّب النقر هنا:</p>
          <div
            className="text-xs mt-2"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const x = (e as any).nativeEvent ? ((e as any).nativeEvent.offsetX / rect.width) : 0.5;
              const y = (e as any).nativeEvent ? ((e as any).nativeEvent.offsetY / rect.height) : 0.5;
              // demo hit test
              const pt: Point = [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as Point;
              const hit = regions.slice().reverse().find((r) => containsPoint(r.polygon, pt))?.id ?? '(لا شيء)';
              (e.currentTarget as HTMLDivElement).dataset.hit = hit;
            }}
          >
            {errors.length > 0 ? (
              <ul className="text-xs" style={{ color: '#B45309' }}>{errors.map((er) => <li key={er.regionId + er.message}>{er.regionId}: {er.message}</li>)}</ul>
            ) : (
              <span className="text-xs" style={{ color: '#15803D' }}>✓ صالح — {regions.length} منطقة</span>
            )}
          </div>
          <pre className="text-xs mt-2 overflow-auto" style={{ maxHeight: 160 }}>{JSON.stringify(regions, null, 2)}</pre>
          <button className="btn btn-primary mt-2" disabled={!canSave} onClick={() => onSave(regions)}>{canSave ? 'حفظ المناطق' : 'أكمل المناطق أولًا'}</button>
        </div>
      </div>
    </div>
  );
}

export default function DrawingAuthoringPage() {
  const [path, setPath] = useState<Point[]>([[0.2, 0.5], [0.8, 0.5]]);
  const [region, setRegion] = useState<Point[]>([[0.2, 0.3], [0.8, 0.3], [0.8, 0.7], [0.2, 0.7]]);
  const [dots, setDots] = useState<{ id: string; at: Point }[]>([{ id: 'd1', at: [0.3, 0.3] }, { id: 'd2', at: [0.7, 0.3] }]);
  const [templateId, setTemplateId] = useState('bird');
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  useEffect(() => {
    fetch('/api/v1/creative/coloring').then((r) => r.json()).then((j) => {
      if (j.success && Array.isArray(j.data)) setTemplates(j.data.slice(0, 40).map((x: any) => ({ id: x.id, label: x.label, assetId: x.assetId })));
    }).catch(() => {});
  }, []);
  const currentTemplate = templates.find((t) => t.id === templateId) ?? { id: templateId, label: templateId, assetId: `asset-color-${templateId}` };
  return (
    <div className="page-stack">
      <h1>محرر الرسم — مسارات / مناطق تلوين / وصل النقاط</h1>
      <p className="text-sm opacity-70">النقر يضيف نقطة في مساحة 0..1 — نفس عقد trace_color.v1. المناطق تُحفظ كـ polygon 0..1 (لا بكسل).</p>

      <div className="card p-4">
        <h3>اختر قالب التلوين</h3>
        <div className="row gap mt-2" style={{ flexWrap: 'wrap' }}>
          <select className="select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {(templates.length ? templates : [{ id: 'bird', label: 'عصفور', assetId: 'asset-color-bird' } as TemplateMeta]).map((t) => (
              <option key={t.id} value={t.id}>{t.label} — {t.id}</option>
            ))}
          </select>
          <span className="text-xs opacity-60">يُظهر الصورة الأصلية خلف المضلع — نفس إحداثيات الـ runtime</span>
        </div>
      </div>

      <ColoringWorkspace template={currentTemplate} onSave={(regs) => { setRegion(regs[0]?.polygon ?? region); }} />

      <div className="grid grid-cols-2 gap-4 mt-4">
        <section className="card p-4">
          <h3>مسار التتبع</h3>
          <TracePathEditor value={path} onChange={setPath} />
          <pre className="text-xs mt-2 overflow-auto">{JSON.stringify({ id: 's1', order: 1, points: path }, null, 2)}</pre>
        </section>
        <section className="card p-4">
          <h3>وصل النقاط</h3>
          <ConnectDotsEditor dots={dots} onChange={setDots} />
          <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(dots, null, 2)}</pre>
        </section>
      </div>

      <div className="card p-4 mt-4">
        <h3>منطقة تلوين (سريعة)</h3>
        <ColorRegionEditor polygon={region} onChange={setRegion} />
        <pre className="text-xs mt-2 overflow-auto">{JSON.stringify({ id: 'bird.body', polygon: region }, null, 2)}</pre>
      </div>

      <div className="card p-4 mt-4">
        <h3>اختيار وسائط — مكتبة الوسائط</h3>
        <p className="text-sm opacity-70">template_asset / background_asset تُختار من مكتبة الوسائط (لا مفاتيح R2 خام). المعاينة تستخدم <code>GET /admin/games/:id/preview</code> بنفس عقد التشغيل.</p>
        <button className="btn">فتح مكتبة الوسائط</button>
      </div>
    </div>
  );
}
