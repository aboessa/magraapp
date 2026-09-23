import { useEffect, useState } from 'react';
import { creativeStudioAdmin, creativeStudioPublic } from '../lib/creativeStudioApi';

type Point = [number, number];
type Stroke = { id: string; order: number; type: 'stroke' | 'dot'; points: Point[] };
type Drawing = {
  id: string;
  category: 'trace' | 'letters' | 'numbers';
  title_ar: string;
  status: string;
  url: string | null;
  geometry: { strokePaths?: Stroke[] } | null;
  sort_order: number;
};

const categories: Drawing['category'][] = ['trace', 'letters', 'numbers'];
const categoryLabel: Record<Drawing['category'], { label: string; icon: string }> = {
  trace: { label: 'تتبّع مسارات', icon: '〰️' },
  letters: { label: 'حروف الهجاء', icon: '🔤' },
  numbers: { label: 'الأرقام العربية', icon: '🔢' },
};

const admin = creativeStudioAdmin;

function normalize(value: Drawing['geometry']): Stroke[] {
  return (value?.strokePaths ?? []).map((stroke, index) => ({
    ...stroke,
    id: stroke.id || `s${index + 1}`,
    order: index + 1,
    type: stroke.type === 'dot' ? 'dot' : 'stroke',
    points: stroke.points ?? [],
  }));
}

export default function CreativeTraceAdminPage() {
  const [category, setCategory] = useState<Drawing['category']>('trace');
  const [items, setItems] = useState<Drawing[]>([]);
  const [selected, setSelected] = useState<Drawing | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);

  async function load(preferred?: string) {
    let result = await admin(`/creative-studio/drawings?category=${category}&limit=100`);
    if (!result.success) {
      result = await creativeStudioPublic(`/creative-studio/drawings?category=${category}&status=ready,published&limit=100`);
    }
    if (!result.success) {
      setNotice(`تعذر التحميل: ${result.error || 'خطأ غير معروف'}`);
      return;
    }
    const list = (result.data as Drawing[]).sort((a, b) => a.sort_order - b.sort_order);
    const next = list.find(item => item.id === preferred) ?? list[0] ?? null;
    setItems(list);
    setSelected(next);
    setStrokes(normalize(next?.geometry ?? null));
    setActive(0);
  }

  useEffect(() => { void load(); }, [category]);

  function choose(item: Drawing) {
    setSelected(item);
    setStrokes(normalize(item.geometry));
    setActive(0);
    setNotice(null);
    setAnimating(false);
  }

  function addPoint(event: React.MouseEvent<SVGSVGElement>) {
    if (animating || !strokes[active]) return;
    const box = event.currentTarget.getBoundingClientRect();
    const point: Point = [
      Math.round(((event.clientX - box.left) / box.width) * 100) / 100,
      Math.round(((event.clientY - box.top) / box.height) * 100) / 100,
    ];
    setStrokes(current =>
      current.map((stroke, index) =>
        index === active ? { ...stroke, points: [...stroke.points, point] } : stroke
      )
    );
  }

  function addStroke(type: Stroke['type']) {
    setStrokes(current => [
      ...current,
      { id: `s${current.length + 1}`, order: current.length + 1, type, points: [] },
    ]);
    setActive(strokes.length);
  }

  function removePoint() {
    setStrokes(current =>
      current.map((stroke, index) =>
        index === active ? { ...stroke, points: stroke.points.slice(0, -1) } : stroke
      )
    );
  }

  async function upload(file: File | undefined) {
    if (!selected || !file) return;
    const form = new FormData();
    form.append('kind', 'main');
    form.append('file', file);
    const result = await admin(`/creative-studio/drawings/${selected.id}/upload`, { method: 'POST', body: form });
    if (!result.success) setNotice(`فشل الرفع: ${result.error || 'خطأ غير معروف'}`);
    else {
      setNotice('تم رفع ملف SVG بنجاح إلى السحابة ✅');
      await load(selected.id);
    }
  }

  async function save(status?: 'ready' | 'published') {
    if (!selected) return;
    const geometry = {
      strokePaths: strokes.map((stroke, index) => ({
        ...stroke,
        id: `s${index + 1}`,
        order: index + 1,
      })),
    };
    const result = await admin(`/creative-studio/drawings/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ geometry, ...(status ? { status } : {}) }),
    });
    if (!result.success) setNotice(`تعذر الحفظ: ${result.error || 'خطأ غير معروف'}`);
    else {
      setNotice(status ? `تم تغيير الحالة إلى ${status}.` : 'تم حفظ المسارات بنجاح ✨');
      await load(selected.id);
    }
  }

  // Trace animation playback
  function playTraceSimulation() {
    const activeStroke = strokes[active];
    if (!activeStroke || activeStroke.points.length < 2) return;
    setAnimating(true);
    setAnimProgress(0);
    let p = 0;
    const total = activeStroke.points.length;
    const interval = setInterval(() => {
      p += 1;
      if (p >= total) {
        clearInterval(interval);
        setTimeout(() => setAnimating(false), 600);
      } else {
        setAnimProgress(p);
      }
    }, 280);
  }

  return (
    <div className="studio-page" dir="rtl">
      <div className="studio-ambient" />

      {/* Hero Header */}
      <header className="studio-hero">
        <div className="studio-hero__header">
          <div className="studio-hero__brand">
            <div className="studio-hero__icon-badge">🖋️</div>
            <div className="studio-hero__title-wrap">
              <h1>
                استوديو التتبع والمتجهات (Precision Vector Tracing)
                <span className="studio-hero__pill">SVG + Bézier Strokes</span>
              </h1>
              <p className="studio-hero__desc">
                تأليف مسارات تتبع الأصابع للأطفال لتعليم كتابة الحروف والأرقام العربية والمسارات الملتوية. انقر على اللوحة لإضافة عقد المسار.
              </p>
            </div>
          </div>
          <div className="studio-hero__actions">
            <button className="studio-btn studio-btn--primary" onClick={() => void save()}>
              <span>💾</span>
              <span>حفظ المسارات</span>
            </button>
            <button className="studio-btn studio-btn--secondary studio-btn--sm" onClick={() => void load(selected?.id)}>
              <span>🔄</span>
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="studio-chips">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`studio-chip ${category === cat ? 'studio-chip--active' : ''}`}
            >
              <span>{categoryLabel[cat].icon}</span>
              <span>{categoryLabel[cat].label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Notice */}
      {notice && (
        <div className="studio-notice">
          <span>{notice}</span>
          <button className="studio-btn studio-btn--secondary studio-btn--sm" onClick={() => setNotice(null)}>إغلاق</button>
        </div>
      )}

      {/* Workstation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 300px) minmax(0, 1fr)', gap: 20 }}>
        {/* Left Side: Items List */}
        <aside className="studio-card" style={{ padding: 14, height: 'fit-content' }}>
          <div style={{ paddingBottom: 10, borderBottom: '1px solid var(--studio-border)', marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>قائمة عناصر {categoryLabel[category].label}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 600, overflowY: 'auto' }}>
            {items.map(item => {
              const isSelected = selected?.id === item.id;
              const strokeCount = normalize(item.geometry).length;
              return (
                <button
                  key={item.id}
                  onClick={() => choose(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: isSelected ? 'var(--studio-primary-glow)' : 'var(--studio-surface-raised)',
                    border: `1px solid ${isSelected ? 'var(--studio-primary)' : 'var(--studio-border)'}`,
                    color: 'var(--studio-text)',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{item.title_ar}</div>
                    <div style={{ fontSize: 11, color: item.status === 'published' ? '#34d399' : '#f59e0b', marginTop: 2 }}>
                      {item.status} · {strokeCount} مسار
                    </div>
                  </div>
                  <span style={{ fontSize: 18 }}>✏️</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center Canvas & Inspector */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selected && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 16 }}>
              {/* SVG Vector Canvas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <svg
                  viewBox="0 0 1 1"
                  onClick={addPoint}
                  className="studio-vector-svg"
                >
                  {/* Template Image */}
                  {selected.url && (
                    <image
                      href={selected.url}
                      x="0"
                      y="0"
                      width="1"
                      height="1"
                      opacity=".35"
                      preserveAspectRatio="xMidYMid meet"
                    />
                  )}

                  {/* Strokes and Lines */}
                  {strokes.map((stroke, index) => {
                    const isSelectedStroke = index === active;
                    const strokeColor = isSelectedStroke ? '#6366f1' : '#94a3b8';
                    const pointsToRender = animating && isSelectedStroke
                      ? stroke.points.slice(0, animProgress + 1)
                      : stroke.points;

                    return (
                      <g key={stroke.id}>
                        {pointsToRender.length > 1 && (
                          <polyline
                            points={pointsToRender.map(p => p.join(',')).join(' ')}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={isSelectedStroke ? '0.016' : '0.010'}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={isSelectedStroke ? 'none' : '0.02 0.01'}
                          />
                        )}
                        {pointsToRender.map((point, pointIndex) => (
                          <circle
                            key={pointIndex}
                            cx={point[0]}
                            cy={point[1]}
                            r={pointIndex === 0 ? '0.026' : '0.018'}
                            fill={pointIndex === 0 ? '#10b981' : strokeColor}
                            stroke="#ffffff"
                            strokeWidth="0.004"
                          />
                        ))}
                      </g>
                    );
                  })}
                </svg>

                {/* Floating Vector Action Bar */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    onClick={playTraceSimulation}
                    disabled={animating}
                    className="studio-btn studio-btn--primary studio-btn--sm"
                  >
                    <span>▶️</span>
                    <span>{animating ? 'محاكاة الحركة...' : 'محاكاة التتبع'}</span>
                  </button>
                  <label className="studio-btn studio-btn--secondary studio-btn--sm" style={{ cursor: 'pointer' }}>
                    <span>📤 رفع SVG</span>
                    <input
                      hidden
                      type="file"
                      accept=".svg,image/svg+xml"
                      onChange={event => {
                        void upload(event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <button onClick={() => addStroke('stroke')} className="studio-btn studio-btn--secondary studio-btn--sm">
                    ➕ مسار جديد
                  </button>
                  <button onClick={() => addStroke('dot')} className="studio-btn studio-btn--secondary studio-btn--sm">
                    🔘 نقطة منفردة
                  </button>
                  <button onClick={removePoint} className="studio-btn studio-btn--secondary studio-btn--sm">
                    ↩️ حذف النقطة
                  </button>
                </div>
              </div>

              {/* Right Side: Stroke Inspector */}
              <div className="studio-card" style={{ padding: 18, height: 'fit-content' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>{selected.title_ar}</h4>
                <div style={{ fontSize: 12, color: 'var(--studio-text-muted)', marginBottom: 14 }}>
                  الفئة: {categoryLabel[selected.category].label}
                </div>

                <div className="studio-field-group" style={{ marginBottom: 14 }}>
                  <label>المسار النشط للتحرير:</label>
                  <select
                    className="studio-select"
                    value={active}
                    onChange={event => setActive(Number(event.target.value))}
                  >
                    {strokes.map((stroke, index) => (
                      <option key={stroke.id} value={index}>
                        {stroke.id} · {stroke.type === 'dot' ? 'نقطة' : 'مسار متصل'} ({stroke.points.length} نقاط)
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    padding: 12,
                    background: 'var(--studio-surface-raised)',
                    borderRadius: 10,
                    marginBottom: 16,
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ color: 'var(--studio-text-muted)' }}>
                    • النقطة الخضراء الكبيرة تمثل بداية المسار.
                  </div>
                  <div style={{ color: 'var(--studio-text-muted)' }}>
                    • يحتاج المسار المتصل نقطتين على الأقل.
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => void save('ready')} className="studio-btn studio-btn--primary">
                    جاهز للمراجعة
                  </button>
                  <button onClick={() => void save('published')} className="studio-btn studio-btn--secondary">
                    نشر في التطبيق
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
