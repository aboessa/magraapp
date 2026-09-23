import { useEffect, useState } from 'react';
import { creativeStudioAdmin } from '../lib/creativeStudioApi';

type Drawing = {
  id: string;
  title_ar: string;
  difficulty: string;
  age_min: number;
  age_max: number;
  status: string;
  is_featured: boolean;
  sort_order: number;
  urls?: { main?: string | null; thumb?: string | null };
  reference_full_url?: string | null;
  extra?: { group?: string } | null;
};

const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || 'https://api.majarra.app/api/v1';
const groups = [
  { id: 'all', label: 'الكل' },
  { id: 'animals', label: 'حيوانات 🦁' },
  { id: 'space', label: 'فضاء 🚀' },
  { id: 'nature', label: 'طبيعة 🌿' },
  { id: 'vehicles', label: 'مركبات 🚗' },
  { id: 'home', label: 'أدوات منزلية 🏠' },
  { id: 'food', label: 'أطعمة 🍎' },
  { id: 'fantasy', label: 'خيال وأساطير 🦄' },
];

const admin = creativeStudioAdmin;

export default function CreativeCompleteAdminPage() {
  const [items, setItems] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [search, setSearch] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [form, setForm] = useState({ title: '', group: 'animals', difficulty: 'سهل', ageMin: 4, ageMax: 6 });

  async function load() {
    setLoading(true);
    const response = await fetch(`${apiBase}/creative-studio/drawings?category=complete&status=draft,ready,published&limit=100`);
    const body = await response.json().catch(() => ({ success: false, error: response.statusText }));
    if (response.ok && body.success) {
      setItems((body.data as Drawing[]).sort((a, b) => a.sort_order - b.sort_order));
      setNotice(null);
    } else {
      setItems([]);
      setNotice(`خطأ تحميل: ${body.error || response.statusText}`);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function upload(item: Drawing, kind: 'main' | 'reference' | 'thumb', file: File | undefined) {
    if (!file) return;
    const data = new FormData();
    data.append('file', file);
    data.append('kind', kind);
    setNotice(`جارٍ رفع ${file.name}...`);
    const result = await admin(`/creative-studio/drawings/${item.id}/upload`, { method: 'POST', body: data });
    if (!result.success) {
      setNotice(`فشل الرفع: ${result.error || 'خطأ غير معروف'}`);
      return;
    }
    setNotice(`تم رفع ملف ${kind === 'main' ? 'التحدي' : kind === 'reference' ? 'المرجع' : 'المصغرة'} بنجاح ✅`);
    await load();
  }

  async function create() {
    const title = form.title.trim();
    if (!title || creating) return;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `activity-${Date.now()}`;
    const id = `complete-${slug}`;
    const base = `public/studio/complete-drawing/${slug}`;
    setCreating(true);
    const result = await admin('/creative-studio/drawings', {
      method: 'POST',
      body: JSON.stringify({
        id,
        category: 'complete',
        title_ar: title,
        difficulty: form.difficulty,
        age_min: form.ageMin,
        age_max: form.ageMax,
        status: 'draft',
        sort_order: items.length + 1,
        r2_key: `${base}/challenge.png`,
        thumb_r2_key: `${base}/thumbnail.jpg`,
        extra: { group: form.group, reference_full: `${base}/reference_full.png` },
      }),
    });
    setCreating(false);
    if (!result.success) {
      setNotice(`تعذر الإنشاء: ${result.error || 'خطأ غير معروف'}`);
      return;
    }
    setForm({ title: '', group: 'animals', difficulty: 'سهل', ageMin: 4, ageMax: 6 });
    setShowDrawer(false);
    setNotice('تم إنشاء النشاط بنجاح! يمكنك الآن رفع ملفات التحدي والمرجع.');
    await load();
  }

  async function setItemStatus(id: string, status: string) {
    const res = await admin(`/creative-studio/drawings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (res.success) {
      setNotice(`تم تغيير الحالة إلى ${status}`);
      await load();
    } else {
      setNotice(`فشل التحديث: ${res.error}`);
    }
  }

  const filteredItems = items.filter(item => {
    const matchesGroup = selectedGroup === 'all' || item.extra?.group === selectedGroup;
    const matchesSearch = !search.trim() || item.title_ar.includes(search) || item.id.includes(search.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  return (
    <div className="studio-page" dir="rtl">
      <div className="studio-ambient" />

      {/* Hero Header */}
      <header className="studio-hero">
        <div className="studio-hero__header">
          <div className="studio-hero__brand">
            <div className="studio-hero__icon-badge">🧩</div>
            <div className="studio-hero__title-wrap">
              <h1>
                استوديو أكمل الرسمة (Complete the Drawing)
                <span className="studio-hero__pill">ثنائية التحدي والمرجع</span>
              </h1>
              <p className="studio-hero__desc">
                كل نشاط يحتوي على صورة «تحدي» ناقصة يرسم عليها الطفل ليكملها، وصورة «مرجع» كاملة يُعرض عليها الحل، وصورة مصغرة للعرض.
              </p>
            </div>
          </div>
          <div className="studio-hero__actions">
            <button className="studio-btn studio-btn--primary" onClick={() => setShowDrawer(true)}>
              <span>✨</span>
              <span>نشاط جديد</span>
            </button>
            <button className="studio-btn studio-btn--secondary studio-btn--sm" onClick={load} title="تحديث">
              <span>🔄</span>
            </button>
          </div>
        </div>

        {/* Bento Metrics */}
        <div className="studio-metrics">
          <div className="studio-metric-card">
            <div className="studio-metric-card__label">إجمالي الأنشطة</div>
            <div className="studio-metric-card__value">{items.length}</div>
            <div className="studio-metric-card__sub">نشاط إكمال رسم</div>
          </div>
          <div className="studio-metric-card">
            <div className="studio-metric-card__label">أنشطة منشورة</div>
            <div className="studio-metric-card__value studio-metric-card__value--success">
              {items.filter(i => i.status === 'published' || i.status === 'ready').length}
            </div>
            <div className="studio-metric-card__sub">متاحة في التطبيق</div>
          </div>
          <div className="studio-metric-card">
            <div className="studio-metric-card__label">المجموعات المصنفة</div>
            <div className="studio-metric-card__value">{groups.length - 1}</div>
            <div className="studio-metric-card__sub">فئات موضوعية</div>
          </div>
        </div>
      </header>

      {/* Notice Bar */}
      {notice && (
        <div className="studio-notice">
          <span>{notice}</span>
          <button className="studio-btn studio-btn--secondary studio-btn--sm" onClick={() => setNotice(null)}>إغلاق</button>
        </div>
      )}

      {/* Filter Bar */}
      <section className="studio-bar">
        <div className="studio-bar__row1">
          <div className="studio-chips">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g.id)}
                className={`studio-chip ${selectedGroup === g.id ? 'studio-chip--active' : ''}`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="studio-search">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث في الأنشطة..."
            />
            <span className="studio-search__icon">🔍</span>
          </div>
        </div>
      </section>

      {/* Grid of Dual-Viewport Cards */}
      {loading ? (
        <div className="studio-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="studio-card" style={{ height: 350, opacity: 0.5 }} />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="studio-card" style={{ padding: '60px 20px', textAlign: 'center', alignItems: 'center' }}>
          <div style={{ fontSize: 50, marginBottom: 12 }}>🧩</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>لا توجد أنشطة إكمال رسم حالياً</h3>
          <p style={{ margin: '0 0 18px', color: 'var(--studio-text-muted)', fontSize: 13 }}>
            أنشئ أول نشاط يتحدى الطفل لإكمال الرسمة!
          </p>
          <button onClick={() => setShowDrawer(true)} className="studio-btn studio-btn--primary">
            إنشاء نشاط
          </button>
        </div>
      ) : (
        <div className="studio-grid">
          {filteredItems.map(item => (
            <article key={item.id} className="studio-card">
              {/* Dual Viewport Split Screen */}
              <div className="studio-split-view">
                <div className="studio-split-pane">
                  {item.urls?.main ? (
                    <img src={item.urls.main} alt="التحدي" />
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>لا توجد صورة</span>
                  )}
                  <span className="studio-split-label">✏️ التحدي الناقص</span>
                </div>

                <div className="studio-split-pane" style={{ borderInlineStart: '1px solid var(--studio-border)' }}>
                  {item.reference_full_url ? (
                    <img src={item.reference_full_url} alt="المرجع" />
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>لا توجد صورة</span>
                  )}
                  <span className="studio-split-label">🌟 المرجع المكتمل</span>
                </div>
              </div>

              {/* Card Body */}
              <div className="studio-card__body">
                <div className="studio-card__title-row">
                  <div>
                    <h4 className="studio-card__title">{item.title_ar}</h4>
                    <span className="studio-card__id">{item.id}</span>
                  </div>
                </div>

                <div className="studio-card__meta">
                  <span className="studio-card__tag">📁 {item.extra?.group || 'عام'}</span>
                  <span className="studio-card__tag">🎯 {item.difficulty}</span>
                  <span className="studio-card__tag">👶 {item.age_min}-{item.age_max} سنوات</span>
                </div>

                {/* Upload Buttons for Challenge, Reference, Thumbnail */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '6px 0' }}>
                  <label className="studio-btn studio-btn--secondary studio-btn--sm" style={{ cursor: 'pointer', fontSize: 11, padding: '0 6px' }}>
                    <span>✏️ التحدي</span>
                    <input
                      hidden
                      type="file"
                      accept=".png,image/png"
                      onChange={event => {
                        void upload(item, 'main', event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <label className="studio-btn studio-btn--secondary studio-btn--sm" style={{ cursor: 'pointer', fontSize: 11, padding: '0 6px' }}>
                    <span>🌟 المرجع</span>
                    <input
                      hidden
                      type="file"
                      accept=".png,image/png"
                      onChange={event => {
                        void upload(item, 'reference', event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <label className="studio-btn studio-btn--secondary studio-btn--sm" style={{ cursor: 'pointer', fontSize: 11, padding: '0 6px' }}>
                    <span>🖼️ المصغرة</span>
                    <input
                      hidden
                      type="file"
                      accept=".jpg,.jpeg,.webp,image/jpeg"
                      onChange={event => {
                        void upload(item, 'thumb', event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>

                {/* Status Switcher */}
                <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--studio-border)' }}>
                  <select
                    value={item.status}
                    onChange={e => void setItemStatus(item.id, e.target.value)}
                    className="studio-select"
                    style={{ height: 32, fontSize: 11, flex: 1 }}
                  >
                    <option value="draft">مسودة (draft)</option>
                    <option value="ready">جاهز (ready)</option>
                    <option value="published">منشور (published)</option>
                  </select>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create Modal Drawer */}
      {showDrawer && (
        <div className="studio-drawer">
          <div onClick={() => setShowDrawer(false)} className="studio-drawer__backdrop" />
          <div className="studio-drawer__panel">
            <div className="studio-drawer__header">
              <h3>إضافة نشاط أكمل الرسمة جديد</h3>
              <button onClick={() => setShowDrawer(false)} className="studio-btn studio-btn--secondary studio-btn--sm">✕</button>
            </div>

            <div className="studio-drawer__body">
              <div className="studio-field-group">
                <label>العنوان العربي *</label>
                <input
                  className="studio-input"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: أكمل وجه الدب"
                />
              </div>

              <div className="studio-field-group">
                <label>المجموعة</label>
                <select
                  className="studio-select"
                  value={form.group}
                  onChange={e => setForm({ ...form, group: e.target.value })}
                >
                  {groups.filter(g => g.id !== 'all').map(g => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div className="studio-field-group">
                <label>الصعوبة</label>
                <select
                  className="studio-select"
                  value={form.difficulty}
                  onChange={e => setForm({ ...form, difficulty: e.target.value })}
                >
                  <option>سهل</option>
                  <option>متوسط</option>
                  <option>مفصل</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="studio-field-group">
                  <label>العمر من</label>
                  <input
                    type="number"
                    className="studio-input"
                    value={form.ageMin}
                    onChange={e => setForm({ ...form, ageMin: Number(e.target.value) || 3 })}
                  />
                </div>
                <div className="studio-field-group">
                  <label>العمر إلى</label>
                  <input
                    type="number"
                    className="studio-input"
                    value={form.ageMax}
                    onChange={e => setForm({ ...form, ageMax: Number(e.target.value) || 12 })}
                  />
                </div>
              </div>
            </div>

            <div className="studio-drawer__footer">
              <button onClick={() => void create()} disabled={creating} className="studio-btn studio-btn--primary" style={{ flex: 1 }}>
                {creating ? 'جارٍ الإنشاء...' : 'إنشاء النشاط'}
              </button>
              <button onClick={() => setShowDrawer(false)} className="studio-btn studio-btn--secondary">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
