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
const groups = ['animals', 'space', 'nature', 'vehicles', 'home', 'food', 'fantasy'];

const admin = creativeStudioAdmin;

export default function CreativeCompleteAdminPage() {
  const [items, setItems] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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
    setNotice('تم الرفع. تظهر المعاينة بعد التحديث.');
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
    setNotice('تم إنشاء النشاط. ارفع الصور الثلاث الآن.');
    await load();
  }

  return (
    <div className="page-stack" dir="rtl">
      <div className="cs-hero">
        <h1>أكمل الرسمة<span className="cs-hero__tag">زوج تحدي + مرجع مكتمل</span></h1>
        <p>كل نشاط يحتاج تحدياً يرسم عليه الطفل، مرجعاً كاملاً، وصورة مصغرة. تحفظ الصور في R2 وتصل للتطبيق فور التحديث.</p>
      </div>

      <div className="creative-studio-panel">
        <h3>نشاط جديد</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="العنوان العربي" style={{ minWidth: 160 }} />
          <select value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value })} style={{ minWidth: 120 }}>{groups.map((group) => <option key={group}>{group}</option>)}</select>
          <select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })} style={{ minWidth: 120 }}><option>سهل</option><option>متوسط</option><option>مفصل</option></select>
          <input type="number" value={form.ageMin} onChange={(event) => setForm({ ...form, ageMin: Number(event.target.value) || 3 })} aria-label="العمر من" style={{ width: 82 }} />
          <input type="number" value={form.ageMax} onChange={(event) => setForm({ ...form, ageMax: Number(event.target.value) || 12 })} aria-label="العمر إلى" style={{ width: 82 }} />
          <button onClick={() => void create()} disabled={creating} className="button button--primary">{creating ? 'جارٍ الإنشاء...' : 'إنشاء النشاط'}</button>
        </div>
      </div>

      {notice && <div className="creative-studio-notice"><span>{notice}</span><button className="creative-studio-notice__close" onClick={()=>setNotice(null)}>إغلاق</button></div>}

      {loading ? (
        <div className="cs-grid">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="cs-skeleton" />)}
        </div>
      ) : (
        <div className="cs-grid">
          {items.map((item) => (
            <article key={item.id} className="cs-card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#fff', minHeight: 130 }}>
                <Preview label="التحدي" url={item.urls?.main} />
                <Preview label="المرجع" url={item.reference_full_url} />
              </div>
              <div className="cs-card__body">
                <div>
                  <div className="cs-card__title">{item.title_ar}</div>
                  <div className="cs-card__meta">{item.extra?.group || 'uncategorized'} · {item.difficulty} · {item.age_min}-{item.age_max}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  <UploadLabel label="التحدي" accept=".png,image/png" onFile={(file) => void upload(item, 'main', file)} />
                  <UploadLabel label="المرجع" accept=".png,image/png" onFile={(file) => void upload(item, 'reference', file)} />
                  <UploadLabel label="المصغرة" accept=".jpg,.jpeg,image/jpeg" onFile={(file) => void upload(item, 'thumb', file)} />
                </div>
                <span className={`creative-studio-status creative-studio-status--${item.status}`}>{item.status} · {item.id}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Preview({ label, url }: { label: string; url?: string | null }) {
  return (
    <div style={{ position: 'relative', display: 'grid', placeItems: 'center', borderInlineStart: label === 'المرجع' ? '1px solid #ddd' : undefined }}>
      {url ? <img src={url} alt={label} style={{ width: '100%', height: 130, objectFit: 'contain', padding: 7 }} /> : <span style={{ color: '#94a3b8' }}>لا توجد صورة</span>}
      <small style={{ position: 'absolute', top: 5, insetInlineEnd: 5, color: '#fff', background: 'rgba(0,0,0,.55)', padding: '2px 6px', borderRadius: 999 }}>{label}</small>
    </div>
  );
}

function UploadLabel({ label, accept, onFile }: { label: string; accept: string; onFile: (file: File | undefined) => void }) {
  return (
    <label className="button button--secondary" style={{ fontSize: 11, cursor: 'pointer', justifyContent: 'center' }}>
      {label}
      <input hidden type="file" accept={accept} onChange={(event) => { onFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
    </label>
  );
}
