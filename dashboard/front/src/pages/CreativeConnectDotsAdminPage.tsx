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
    .filter(dot => Array.isArray(dot.at) && dot.at.length === 2)
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
  const [activeDotIndex, setActiveDotIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedDotCount, setSimulatedDotCount] = useState(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  async function load(preferredId?: string) {
    setLoading(true);
    let result = await admin('/creative-studio/drawings?category=connect_dots&limit=100');
    if (!result.success) {
      result = await creativeStudioPublic('/creative-studio/drawings?category=connect_dots&status=ready,published&limit=100');
    }
    if (!result.success) {
      setItems([]);
      setNotice(`تعذر تحميل الأنشطة: ${result.error || 'خطأ غير معروف'}`);
      setLoading(false);
      return;
    }
    const list = (result.data as Drawing[]).sort((a, b) => a.sort_order - b.sort_order);
    const next = list.find(item => item.id === preferredId) ?? list.find(item => item.id === selected?.id) ?? list[0] ?? null;
    setItems(list);
    setSelected(next);
    setDots(normalizedDots(next?.geometry ?? null));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function select(item: Drawing) {
    setSelected(item);
    setDots(normalizedDots(item.geometry));
    setActiveDotIndex(null);
    setNotice(null);
    setIsSimulating(false);
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
    if (isSimulating) return;
    const point = position(event);
    if (!point) return;
    const hit = dots.findIndex(dot => Math.hypot(dot.at[0] - point[0], dot.at[1] - point[1]) < 0.055);
    if (hit >= 0) {
      dragging.current = hit;
      setActiveDotIndex(hit);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    // Add new dot
    const nextOrder = dots.length + 1;
    const newDot: Dot = { id: `d${nextOrder}`, order: nextOrder, at: point };
    setDots(current => [...current, newDot]);
    setActiveDotIndex(dots.length);
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current === null) return;
    const point = position(event);
    if (!point) return;
    const index = dragging.current;
    setDots(current =>
      current.map((dot, i) => (i === index ? { ...dot, at: point } : dot))
    );
  }

  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current !== null) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // pointer capture release fallback
      }
      dragging.current = null;
    }
  }

  async function upload(file: File | undefined) {
    if (!selected || !file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('kind', 'main');
    setNotice(`جارٍ رفع ${file.name}...`);
    const result = await admin(`/creative-studio/drawings/${selected.id}/upload`, {
      method: 'POST',
      body: form,
    });
    if (!result.success) {
      setNotice(`فشل الرفع: ${result.error || 'خطأ غير معروف'}`);
      return;
    }
    setNotice(`تم رفع ${file.name} بنجاح ✅`);
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
    setNotice(`تم حفظ ${ordered.length} نقطة بالترتيب بنجاح ✨`);
    await load(selected.id);
  }

  async function setStatus(status: 'draft' | 'ready' | 'published') {
    if (!selected) return;
    if (dots.length < 2 && status !== 'draft') {
      setNotice('يتطلب النشر أو الجاهزية نقطتين صحيحتين على الأقل.');
      return;
    }
    const result = await admin(`/creative-studio/drawings/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (!result.success) setNotice(`تعذر تغيير الحالة: ${result.error || 'خطأ غير معروف'}`);
    else {
      setNotice(`تم تغيير الحالة إلى ${status} بنجاح.`);
      await load(selected.id);
    }
  }

  // Simulation playback for kids experience
  function runSimulation() {
    if (dots.length < 2) return;
    setIsSimulating(true);
    setSimulatedDotCount(1);
    let current = 1;
    const interval = setInterval(() => {
      current += 1;
      if (current > dots.length) {
        clearInterval(interval);
        setTimeout(() => setIsSimulating(false), 800);
      } else {
        setSimulatedDotCount(current);
      }
    }, 350);
  }

  const filteredItems = items.filter(
    item => item.title_ar.includes(search) || item.id.includes(search.toLowerCase())
  );

  return (
    <div className="studio-page" dir="rtl">
      <div className="studio-ambient" />

      {/* Hero Header */}
      <header className="studio-hero">
        <div className="studio-hero__header">
          <div className="studio-hero__brand">
            <div className="studio-hero__icon-badge">🔢</div>
            <div className="studio-hero__title-wrap">
              <h1>
                محرر وصل النقاط التفاعلي
                <span className="studio-hero__pill">Smart Node Canvas</span>
              </h1>
              <p className="studio-hero__desc">
                انقر على اللوحة لإضافة نقطة جديدة، واسحب أي نقطة لتعديل موقعها. الخطوط الزرقاء تمثل المسار الفعلي الذي سيربطه الطفل بالترتيب من 1 إلى N.
              </p>
            </div>
          </div>
          <div className="studio-hero__actions">
            <button className="studio-btn studio-btn--primary" onClick={save}>
              <span>💾</span>
              <span>حفظ النقاط ({dots.length})</span>
            </button>
            <button className="studio-btn studio-btn--secondary studio-btn--sm" onClick={() => void load(selected?.id)}>
              <span>🔄</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notice */}
      {notice && (
        <div className="studio-notice">
          <span>{notice}</span>
          <button className="studio-btn studio-btn--secondary studio-btn--sm" onClick={() => setNotice(null)}>إغلاق</button>
        </div>
      )}

      {/* Studio Workstation Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', gap: 20 }}>
        {/* Left Side: Activity List Selector */}
        <aside className="studio-card" style={{ padding: 16, height: 'fit-content' }}>
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800 }}>أنشطة وصل النقاط</h4>
            <div className="studio-search" style={{ width: '100%' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث في الأنشطة..."
              />
              <span className="studio-search__icon">🔍</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 620, overflowY: 'auto' }}>
            {loading ? (
              <p style={{ color: 'var(--studio-text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>جارٍ التحميل...</p>
            ) : filteredItems.length === 0 ? (
              <p style={{ color: 'var(--studio-text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>لا توجد أنشطة مطابقة</p>
            ) : (
              filteredItems.map(item => {
                const isCurrent = selected?.id === item.id;
                const dotCount = normalizedDots(item.geometry).length;
                return (
                  <button
                    key={item.id}
                    onClick={() => select(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: isCurrent ? 'var(--studio-primary-glow)' : 'var(--studio-surface-raised)',
                      border: `1px solid ${isCurrent ? 'var(--studio-primary)' : 'var(--studio-border)'}`,
                      color: 'var(--studio-text)',
                      textAlign: 'right',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        backgroundColor: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {item.url ? (
                        <img src={item.url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: 16 }}>🔢</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title_ar}
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11, marginTop: 2, color: 'var(--studio-text-muted)' }}>
                        <span style={{ color: item.status === 'published' ? '#34d399' : '#f59e0b' }}>{item.status}</span>
                        <span>· {dotCount} نقطة</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Center / Right: Canvas and Studio Controls */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selected && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 16 }}>
              {/* Interactive Node Canvas Area */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  ref={canvasRef}
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={pointerUp}
                  className="studio-node-canvas"
                >
                  {selected.url ? (
                    <img src={selected.url} alt={selected.title_ar} draggable={false} />
                  ) : (
                    <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#64748b' }}>
                      ارفع ملف PNG للنشاط لبدء وضع النقاط
                    </div>
                  )}

                  {/* SVG Connecting Paths */}
                  <svg
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                    }}
                  >
                    {dots.map((dot, index) => {
                      if (index === 0) return null;
                      const prev = dots[index - 1];
                      const isConnectedInSim = isSimulating ? index < simulatedDotCount : true;
                      return (
                        <line
                          key={`line-${index}`}
                          x1={`${prev.at[0] * 100}%`}
                          y1={`${prev.at[1] * 100}%`}
                          x2={`${dot.at[0] * 100}%`}
                          y2={`${dot.at[1] * 100}%`}
                          stroke={isConnectedInSim ? '#3b82f6' : '#cbd5e1'}
                          strokeWidth={isConnectedInSim ? '3.5' : '1.5'}
                          strokeDasharray={isConnectedInSim ? '6 4' : '4 4'}
                        />
                      );
                    })}
                  </svg>

                  {/* Numbered Node Pins */}
                  {dots.map((dot, index) => {
                    const isActive = activeDotIndex === index;
                    const isSimActive = isSimulating && dot.order <= simulatedDotCount;
                    return (
                      <span
                        key={dot.id}
                        className={`studio-node-pin ${isActive || isSimActive ? 'studio-node-pin--active' : ''}`}
                        style={{
                          left: `${dot.at[0] * 100}%`,
                          top: `${dot.at[1] * 100}%`,
                        }}
                      >
                        {dot.order}
                      </span>
                    );
                  })}
                </div>

                {/* Floating Canvas Action Bar */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    onClick={runSimulation}
                    disabled={isSimulating || dots.length < 2}
                    className="studio-btn studio-btn--primary studio-btn--sm"
                  >
                    <span>▶️</span>
                    <span>{isSimulating ? 'جارٍ المحاكاة...' : 'محاكاة التوصيل'}</span>
                  </button>
                  <label className="studio-btn studio-btn--secondary studio-btn--sm" style={{ cursor: 'pointer' }}>
                    <span>📤 رفع صورة</span>
                    <input
                      hidden
                      type="file"
                      accept=".png,image/png"
                      onChange={event => {
                        void upload(event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <button
                    onClick={() => {
                      setDots(current => current.slice(0, -1).map((dot, index) => ({ ...dot, order: index + 1 })));
                      setActiveDotIndex(null);
                    }}
                    disabled={dots.length === 0}
                    className="studio-btn studio-btn--secondary studio-btn--sm"
                  >
                    ↩️ حذف الأخيرة
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('هل تريد مسح كافة النقاط؟')) setDots([]);
                    }}
                    disabled={dots.length === 0}
                    className="studio-btn studio-btn--danger studio-btn--sm"
                  >
                    🗑️ مسح الكل
                  </button>
                </div>
              </div>

              {/* Right Side: Activity Inspector */}
              <div className="studio-card" style={{ padding: 18, height: 'fit-content' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>{selected.title_ar}</h4>
                <div style={{ fontSize: 12, color: 'var(--studio-text-muted)', marginBottom: 12 }}>
                  {selected.age_min} - {selected.age_max} سنوات · الصعوبة: {selected.difficulty}
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
                  <div style={{ fontWeight: 700, color: 'var(--studio-text)' }}>📊 إحصاء المسار:</div>
                  <div>• عدد النقاط: <strong>{dots.length}</strong></div>
                  <div>• الحالة الحالية: <span style={{ color: '#10b981', fontWeight: 700 }}>{selected.status}</span></div>
                  <div>• التسلسل: من 1 إلى {dots.length || 0}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={() => void setStatus('ready')}
                    className="studio-btn studio-btn--primary"
                  >
                    جاهز للمراجعة
                  </button>
                  <button
                    onClick={() => void setStatus('published')}
                    className="studio-btn studio-btn--secondary"
                  >
                    نشر في التطبيق
                  </button>
                  <button
                    onClick={() => void setStatus('draft')}
                    className="studio-btn studio-btn--secondary"
                  >
                    إرجاع لمسودة
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
