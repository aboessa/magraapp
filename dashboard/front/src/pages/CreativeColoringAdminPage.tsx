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
  { id: 'all', label: 'الكل', icon: '✨' },
  { id: 'birds', label: 'طيور', icon: '🐦' },
  { id: 'animals', label: 'حيوانات', icon: '🦁' },
  { id: 'vehicles', label: 'مركبات', icon: '🚗' },
  { id: 'space', label: 'فضاء', icon: '🚀' },
  { id: 'flowers', label: 'زهور', icon: '🌸' },
  { id: 'sea', label: 'بحرية', icon: '🐠' },
  { id: 'fruits', label: 'فواكه', icon: '🍎' },
  { id: 'toys', label: 'ألعاب', icon: '🧸' },
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
  const [form, setForm] = useState<any>({
    title_ar: '',
    sub_category: 'birds',
    difficulty: 'سهل',
    age_min: 3,
    age_max: 6,
    status: 'draft',
    sort_order: 0,
    tags: '',
    is_featured: false,
    is_new: true,
  });
  const [previewUrl, setPreviewUrl] = useState<string|null>(null);

  const stats = useMemo(() => {
    const total = drawings.length;
    const ready = drawings.filter(d => d.status === 'ready' || d.status === 'published').length;
    const featured = drawings.filter(d => d.is_featured).length;
    const missing = drawings.filter(d => !getImg(d)).length;
    return { total, ready, featured, missing };
  }, [drawings]);

  const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'https://api.majarra.app/api/v1';
  async function publicFetch(path: string) {
    const r = await fetch(`${API_BASE}${path}`);
    const j = await r.json().catch(() => ({ success: false, error: r.statusText })) as any;
    if (!r.ok && !j.error) j.error = `HTTP ${r.status}`;
    return j as { success: boolean; data?: any; error?: string };
  }

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('category', 'coloring');
    if (sub !== 'all') params.set('sub_category', sub);
    if (status !== 'all') params.set('status', status);
    if (search.trim()) params.set('q', search.trim());
    if (onlyFeatured) params.set('featured', '1');
    params.set('limit', '200');

    const res = await publicFetch(`/creative-studio/drawings?${params.toString()}`);
    if (res.success) {
      let list = res.data as Drawing[];
      if (sub !== 'all') list = list.filter(d => (d.sub_category || d.category) === sub);
      if (sub !== 'all' && ['birds', 'animals', 'vehicles', 'space', 'flowers', 'sea', 'fruits', 'toys'].includes(sub)) {
        const res2 = await publicFetch(`/creative-studio/drawings?category=${sub}&limit=200`);
        if (res2.success) {
          const extra = res2.data as Drawing[];
          const map = new Map(list.map(d => [d.id, d]));
          for (const e of extra) if (!map.has(e.id)) map.set(e.id, e);
          list = Array.from(map.values());
        }
      }
      if (onlyFeatured) list = list.filter(d => d.is_featured);
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(d => d.title_ar.toLowerCase().includes(q) || d.id.toLowerCase().includes(q));
      }
      list.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
      setDrawings(list);
      setMsg(null);
    } else {
      setMsg(`خطأ تحميل: ${res.error}`);
      setDrawings([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [sub, status, onlyFeatured]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (search) load();
      else if (search === '') load();
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  function openCreate() {
    setForm({
      title_ar: '',
      sub_category: sub === 'all' ? 'birds' : sub,
      difficulty: 'سهل',
      age_min: 3,
      age_max: 6,
      status: 'draft',
      sort_order: drawings.length,
      tags: '',
      is_featured: false,
      is_new: true,
    });
    setPreviewUrl(null);
    setDrawer({ mode: 'create' });
  }

  function openEdit(d: Drawing) {
    setForm({
      title_ar: d.title_ar,
      sub_category: d.sub_category || d.category,
      difficulty: d.difficulty,
      age_min: d.age_min,
      age_max: d.age_max,
      status: d.status,
      sort_order: d.sort_order,
      tags: d.tags || '',
      is_featured: d.is_featured,
      is_new: d.is_new,
    });
    setPreviewUrl(getImg(d));
    setDrawer({ mode: 'edit', id: d.id });
  }

  async function submit() {
    if (!form.title_ar?.trim()) { setMsg('العنوان مطلوب'); return; }
    const id = drawer?.mode === 'edit' && drawer.id
      ? drawer.id
      : `coloring-${form.sub_category}-${form.title_ar.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 30)}`;

    const payload: any = {
      id,
      category: 'coloring',
      sub_category: form.sub_category,
      title_ar: form.title_ar.trim(),
      difficulty: form.difficulty,
      age_min: form.age_min,
      age_max: form.age_max,
      status: form.status,
      sort_order: form.sort_order,
      tags: form.tags,
      is_featured: form.is_featured,
      is_new: form.is_new,
      r2_key: `public/studio/coloring/${form.sub_category}/${id}.png`,
      transparent_r2_key: `public/studio/coloring/${form.sub_category}/${id}.png`,
    };

    if (drawer?.mode === 'edit') {
      const res = await api(`/creative-studio/drawings/${drawer.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      if (res.success) {
        setMsg(`تم حفظ الرسمة "${form.title_ar}" بنجاح ✨`);
        setDrawer(null);
        await load();
      } else {
        setMsg(`خطأ حفظ: ${res.error}`);
      }
    } else {
      const res = await api('/creative-studio/drawings', { method: 'POST', body: JSON.stringify(payload) });
      if (res.success) {
        setMsg(`تمت إضافة الرسمة "${form.title_ar}". يمكنك الآن رفع صورة الـ PNG.`);
        setDrawer(null);
        await load();
      } else {
        setMsg(`خطأ إضافة: ${res.error}`);
      }
    }
  }

  async function doUpload(id: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'transparent');
    setMsg(`جارٍ رفع ${file.name} إلى السحابة...`);
    const res = await apiRaw(`/creative-studio/drawings/${id}/upload`, { method: 'POST', body: fd } as any);
    if (res.success) {
      setMsg(`تم رفع ${file.name} بنجاح ✅`);
      await load();
    } else {
      setMsg(`فشل الرفع: ${res.error || 'خطأ غير معروف'}`);
    }
  }

  async function toggleField(id: string, field: 'is_featured' | 'status', value: any) {
    const res = await api(`/creative-studio/drawings/${id}`, { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
    if (res.success) await load();
    else setMsg(`فشل التحديث: ${res.error}`);
  }

  async function uploadV2Files(files: FileList | null) {
    if (!files || files.length === 0) return;
    const uploads: Array<{ id: string; file: File }> = [];
    const skipped: string[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const name = file.name.toLowerCase();
      const matchedId = COLORING_V2_DRAWING_IDS[name];
      if (matchedId) uploads.push({ id: matchedId, file });
      else skipped.push(file.name);
    }

    if (uploads.length === 0) {
      setMsg(`لم يتم العثور على ملفات مطابقة. الملفات المدعومة: ${Object.keys(COLORING_V2_DRAWING_IDS).join(', ')}`);
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
        const res = await apiRaw(`/creative-studio/drawings/${id}/upload`, { method: 'POST', body: fd } as any);
        if (!res.success) failed.push(`${file.name}: ${res.error || 'فشل الرفع'}`);
      }
      await load();
      const details = [
        `تم رفع ${uploads.length - failed.length} من ${uploads.length} ملف بنجاح`,
        skipped.length ? `تم تخطي ${skipped.length} ملف` : '',
        failed.length ? `فشل: ${failed.join('، ')}` : '',
      ].filter(Boolean).join(' — ');
      setMsg(details);
    } finally {
      setBulkUploading(false);
    }
  }

  return (
    <div className="studio-page" dir="rtl">
      <div className="studio-ambient" />

      {/* Hero Header */}
      <header className="studio-hero">
        <div className="studio-hero__header">
          <div className="studio-hero__brand">
            <div className="studio-hero__icon-badge">🎨</div>
            <div className="studio-hero__title-wrap">
              <h1>
                استوديو التلوين الفائق
                <span className="studio-hero__pill">PNG شفاف 1024×1024</span>
              </h1>
              <p className="studio-hero__desc">
                إدارة رسومات التلوين للأطفال بدقة عالية بخلفية شفافة وخطوط كرتونية داكنة. تُحفظ الأصول في Cloudflare R2 وتُبث للتطبيق عبر شبكة CDN فائقة السرعة.
              </p>
            </div>
          </div>
          <div className="studio-hero__actions">
            <label className="studio-btn studio-btn--secondary" aria-disabled={bulkUploading}>
              <span>📤</span>
              <span>{bulkUploading ? 'جارٍ الرفع...' : 'رفع دفعة V2'}</span>
              <input
                type="file"
                accept=".png,image/png"
                multiple
                disabled={bulkUploading}
                style={{ display: 'none' }}
                onChange={e => { void uploadV2Files(e.target.files); e.currentTarget.value = ''; }}
              />
            </label>
            <button className="studio-btn studio-btn--primary" onClick={openCreate}>
              <span>✨</span>
              <span>رسمة جديدة</span>
            </button>
            <button className="studio-btn studio-btn--secondary studio-btn--sm" onClick={load} title="تحديث البيانات">
              <span>🔄</span>
            </button>
          </div>
        </div>

        {/* Bento Metrics Cards */}
        <div className="studio-metrics">
          <div className="studio-metric-card">
            <div className="studio-metric-card__label">إجمالي الرسومات</div>
            <div className="studio-metric-card__value">{stats.total}</div>
            <div className="studio-metric-card__sub">لوحة تلوين جاهزة</div>
          </div>
          <div className="studio-metric-card">
            <div className="studio-metric-card__label">منشور وجاهز</div>
            <div className="studio-metric-card__value studio-metric-card__value--success">{stats.ready}</div>
            <div className="studio-metric-card__sub">متاح في التطبيق</div>
          </div>
          <div className="studio-metric-card">
            <div className="studio-metric-card__label">المميزة في الرئيسية</div>
            <div className="studio-metric-card__value">{stats.featured}</div>
            <div className="studio-metric-card__sub">في قسم الصدارة ⭐</div>
          </div>
          <div className="studio-metric-card">
            <div className="studio-metric-card__label">ينقصها رفع ملف R2</div>
            <div className={`studio-metric-card__value ${stats.missing > 0 ? 'studio-metric-card__value--danger' : ''}`}>
              {stats.missing}
            </div>
            <div className="studio-metric-card__sub">{stats.missing === 0 ? 'كل الأصول مكتملة ✅' : 'تحتاج لرفع PNG'}</div>
          </div>
        </div>
      </header>

      {/* Notice Message */}
      {msg && (
        <div className="studio-notice">
          <span>{msg}</span>
          <button className="studio-btn studio-btn--secondary studio-btn--sm" onClick={() => setMsg(null)}>إغلاق</button>
        </div>
      )}

      {/* Control Bar: Categories & Filters */}
      <section className="studio-bar">
        <div className="studio-bar__row1">
          <div className="studio-chips">
            {SUBS.map(s => (
              <button
                key={s.id}
                onClick={() => setSub(s.id)}
                className={`studio-chip ${sub === s.id ? 'studio-chip--active' : ''}`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="studio-search">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث باسم الرسمة أو الرمز..."
              />
              <span className="studio-search__icon">🔍</span>
            </div>
            <button
              onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
              className="studio-btn studio-btn--secondary studio-btn--sm"
              title="تبديل العرض"
            >
              {view === 'grid' ? '📋 جدول' : '🔲 شبكة'}
            </button>
          </div>
        </div>

        <div className="studio-bar__row2">
          <div className="studio-bar__filters">
            {(['all', 'draft', 'ready', 'published'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`studio-chip ${status === s ? 'studio-chip--active' : ''}`}
                style={{ height: 28, padding: '0 12px', fontSize: 11 }}
              >
                {s === 'all' ? 'جميع الحالات' : s}
              </button>
            ))}
            <label className="studio-toggle-label">
              <input
                type="checkbox"
                checked={onlyFeatured}
                onChange={e => setOnlyFeatured(e.target.checked)}
              />
              <span>⭐ المميزة فقط</span>
            </label>
          </div>
          <div className="studio-count-badge">{drawings.length} رسمة معروضة</div>
        </div>
      </section>

      {/* Main Content Area */}
      {loading ? (
        <div className="studio-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="studio-card" style={{ height: 320, opacity: 0.5 }}>
              <div className="studio-card__preview" style={{ background: 'var(--studio-surface-raised)' }} />
            </div>
          ))}
        </div>
      ) : drawings.length === 0 ? (
        <div className="studio-card" style={{ padding: '60px 20px', textAlign: 'center', alignItems: 'center' }}>
          <div style={{ fontSize: 50, marginBottom: 12 }}>🎨</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>لا توجد رسومات تطابق خيارات البحث</h3>
          <p style={{ margin: '0 0 18px', color: 'var(--studio-text-muted)', fontSize: 13 }}>
            يمكنك إنشاء أول رسمة تلوين أو إعادة ضبط الفلاتر الحالية.
          </p>
          <button onClick={openCreate} className="studio-btn studio-btn--primary">
            إنشاء رسمة جديدة
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="studio-grid">
          {drawings.map(d => {
            const img = getImg(d);
            const hasImg = !!img;
            return (
              <article key={d.id} className="studio-card">
                {/* Transparent Checkerboard Canvas */}
                <div className="studio-card__preview" onClick={() => openEdit(d)}>
                  {hasImg ? (
                    <img src={img!} alt={d.title_ar} loading="lazy" />
                  ) : (
                    <div className="studio-card__placeholder">
                      <span className="studio-card__placeholder-icon">🖼️</span>
                      <span>لم يُرفع ملف PNG بعد</span>
                    </div>
                  )}

                  {/* Status Badges */}
                  <span className={`studio-badge studio-badge--status-${d.status}`}>
                    {d.status === 'published' ? 'منشور' : d.status === 'ready' ? 'جاهز' : 'مسودة'}
                  </span>

                  {(d.is_featured || d.is_new) && (
                    <span className="studio-badge studio-badge--featured">
                      {d.is_featured ? '⭐ مميزة' : ''} {d.is_new ? '✨ جديدة' : ''}
                    </span>
                  )}

                  {hasImg ? (
                    <span className="studio-badge studio-badge--specs">1024×1024 PNG</span>
                  ) : (
                    <span className="studio-badge studio-badge--missing">⚠️ بدون ملف</span>
                  )}
                </div>

                {/* Card Information */}
                <div className="studio-card__body">
                  <div className="studio-card__title-row">
                    <div>
                      <h4 className="studio-card__title">{d.title_ar}</h4>
                      <span className="studio-card__id">{d.id}</span>
                    </div>
                  </div>

                  <div className="studio-card__meta">
                    <span className="studio-card__tag">📁 {d.sub_category || d.category}</span>
                    <span className="studio-card__tag">👶 {d.age_min}-{d.age_max} سنوات</span>
                    <span className="studio-card__tag">🎯 {d.difficulty}</span>
                  </div>

                  {/* Actions Bar */}
                  <div className="studio-card__actions">
                    <button onClick={() => openEdit(d)} className="studio-btn studio-btn--secondary studio-btn--sm">
                      تعديل
                    </button>
                    <label className="studio-btn studio-btn--primary studio-btn--sm" style={{ cursor: 'pointer' }}>
                      رفع PNG
                      <input
                        type="file"
                        accept=".png,.webp"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) void doUpload(d.id, f);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <button
                      onClick={() => toggleField(d.id, 'is_featured', !d.is_featured)}
                      className={`studio-btn studio-btn--sm ${d.is_featured ? 'studio-btn--primary' : 'studio-btn--secondary'}`}
                      title={d.is_featured ? 'إلغاء التمييز' : 'تمييز في الصدارة'}
                    >
                      {d.is_featured ? '⭐' : '☆'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من أرشفة "${d.title_ar}"؟`)) {
                          void toggleField(d.id, 'status', 'archived');
                        }
                      }}
                      className="studio-btn studio-btn--danger studio-btn--sm"
                      title="أرشفة"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Organized Table View */
        <div className="studio-card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--studio-surface-raised)', borderBottom: '1px solid var(--studio-border)' }}>
                <th style={{ padding: '14px 18px' }}>المعاينة</th>
                <th style={{ padding: '14px 18px' }}>العنوان والرمز</th>
                <th style={{ padding: '14px 18px' }}>الفئة</th>
                <th style={{ padding: '14px 18px' }}>الأعمار</th>
                <th style={{ padding: '14px 18px' }}>الحالة</th>
                <th style={{ padding: '14px 18px' }}>مميزة</th>
                <th style={{ padding: '14px 18px' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {drawings.map(d => {
                const img = getImg(d);
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--studio-border)' }}>
                    <td style={{ padding: '10px 18px' }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          overflow: 'hidden',
                          backgroundColor: 'var(--studio-checkers)',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {img ? (
                          <img src={img!} style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--studio-text-muted)' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 18px' }}>
                      <div style={{ fontWeight: 800 }}>{d.title_ar}</div>
                      <div style={{ fontSize: 10, color: 'var(--studio-text-muted)', fontFamily: 'monospace' }}>{d.id}</div>
                    </td>
                    <td style={{ padding: '10px 18px', color: 'var(--studio-text-soft)' }}>{d.sub_category || d.category}</td>
                    <td style={{ padding: '10px 18px', color: 'var(--studio-text-soft)' }}>{d.age_min} - {d.age_max} سنوات</td>
                    <td style={{ padding: '10px 18px' }}>
                      <select
                        value={d.status}
                        onChange={e => toggleField(d.id, 'status', e.target.value)}
                        className="studio-select"
                        style={{ height: 32, fontSize: 11 }}
                      >
                        <option value="draft">draft (مسودة)</option>
                        <option value="ready">ready (جاهز)</option>
                        <option value="published">published (منشور)</option>
                        <option value="archived">archived (مؤرشف)</option>
                      </select>
                    </td>
                    <td style={{ padding: '10px 18px' }}>
                      <input
                        type="checkbox"
                        checked={d.is_featured}
                        onChange={e => toggleField(d.id, 'is_featured', e.target.checked)}
                      />
                    </td>
                    <td style={{ padding: '10px 18px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(d)} className="studio-btn studio-btn--secondary studio-btn--sm">
                          تعديل
                        </button>
                        <label className="studio-btn studio-btn--primary studio-btn--sm" style={{ cursor: 'pointer' }}>
                          رفع
                          <input
                            type="file"
                            hidden
                            accept=".png,.webp"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) void doUpload(d.id, f);
                            }}
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over Glass Drawer for Create / Edit */}
      {drawer && (
        <div className="studio-drawer">
          <div onClick={() => setDrawer(null)} className="studio-drawer__backdrop" />
          <div className="studio-drawer__panel">
            <div className="studio-drawer__header">
              <h3>{drawer.mode === 'edit' ? 'تعديل تفاصيل الرسمة' : 'إضافة رسمة تلوين جديدة'}</h3>
              <button onClick={() => setDrawer(null)} className="studio-btn studio-btn--secondary studio-btn--sm">
                ✕
              </button>
            </div>

            <div className="studio-drawer__body">
              {/* Image Preview Box */}
              {previewUrl && (
                <div
                  className="studio-card__preview"
                  style={{ height: 200, borderRadius: 14, border: '1px solid var(--studio-border)' }}
                >
                  <img src={previewUrl} alt="معاينة" />
                  <span className="studio-badge studio-badge--specs">معاينة مباشرة</span>
                </div>
              )}

              <div className="studio-field-group">
                <label>العنوان العربي *</label>
                <input
                  className="studio-input"
                  value={form.title_ar}
                  onChange={e => setForm((f: any) => ({ ...f, title_ar: e.target.value }))}
                  placeholder="مثال: ديناصور لطيف"
                />
              </div>

              <div className="studio-field-group">
                <label>الفئة الفرعية</label>
                <select
                  className="studio-select"
                  value={form.sub_category}
                  onChange={e => setForm((f: any) => ({ ...f, sub_category: e.target.value }))}
                >
                  {SUBS.filter(s => s.id !== 'all').map(s => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="studio-field-group">
                  <label>الفئة العمرية (من)</label>
                  <input
                    type="number"
                    className="studio-input"
                    value={form.age_min}
                    onChange={e => setForm((f: any) => ({ ...f, age_min: parseInt(e.target.value) || 3 }))}
                  />
                </div>
                <div className="studio-field-group">
                  <label>الفئة العمرية (إلى)</label>
                  <input
                    type="number"
                    className="studio-input"
                    value={form.age_max}
                    onChange={e => setForm((f: any) => ({ ...f, age_max: parseInt(e.target.value) || 6 }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="studio-field-group">
                  <label>مستوى الصعوبة</label>
                  <select
                    className="studio-select"
                    value={form.difficulty}
                    onChange={e => setForm((f: any) => ({ ...f, difficulty: e.target.value }))}
                  >
                    <option value="سهل">سهل (خطوط عريضة)</option>
                    <option value="متوسط">متوسط</option>
                    <option value="مفصل">مفصل (تفاصيل دقيقة)</option>
                  </select>
                </div>
                <div className="studio-field-group">
                  <label>حالة النشر</label>
                  <select
                    className="studio-select"
                    value={form.status}
                    onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="draft">مسودة (draft)</option>
                    <option value="ready">جاهز (ready)</option>
                    <option value="published">منشور (published)</option>
                    <option value="archived">مؤرشف (archived)</option>
                  </select>
                </div>
              </div>

              <div className="studio-field-group">
                <label>الوسوم (مفصولة بفواصل)</label>
                <input
                  className="studio-input"
                  value={form.tags}
                  onChange={e => setForm((f: any) => ({ ...f, tags: e.target.value }))}
                  placeholder="حيوانات, ديناصورات, مرح"
                />
              </div>

              <div className="studio-field-group">
                <label>ترتيب الظهور في التطبيق</label>
                <input
                  type="number"
                  className="studio-input"
                  value={form.sort_order}
                  onChange={e => setForm((f: any) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div style={{ display: 'flex', gap: 20, paddingTop: 6 }}>
                <label className="studio-toggle-label">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={e => setForm((f: any) => ({ ...f, is_featured: e.target.checked }))}
                  />
                  <span>تمييز في القسم الرئيسي ⭐</span>
                </label>
                <label className="studio-toggle-label">
                  <input
                    type="checkbox"
                    checked={form.is_new}
                    onChange={e => setForm((f: any) => ({ ...f, is_new: e.target.checked }))}
                  />
                  <span>رسمة جديدة ✨</span>
                </label>
              </div>
            </div>

            <div className="studio-drawer__footer">
              <button onClick={submit} className="studio-btn studio-btn--primary" style={{ flex: 1 }}>
                حفظ الرسمة
              </button>
              <button onClick={() => setDrawer(null)} className="studio-btn studio-btn--secondary">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
