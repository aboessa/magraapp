import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { adminPath } from '../lib/adminPath'
import { usePreferences } from '../context/preferences'

export default function ReferenceDrawingDetailPage() {
  const { id } = useParams()
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const [data, setData] = useState<any>(null)
  const [steps, setSteps] = useState<any[]>([])
  const [previewMode, setPreviewMode] = useState<'phone' | 'tablet'>('phone')

  useEffect(() => {
    fetch(`/api/admin/reference-activities/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setData(j.data)
          setSteps(j.data.steps || [])
        }
      })
  }, [id])

  if (!data) return <div className="page-stack" style={{ padding: 40, textAlign: 'center' }}>{ar ? 'جارٍ التحميل...' : 'Loading...'}</div>

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('creative-studio/reference')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{ar ? 'الأنشطة المرجعية' : 'Reference Hub'}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {data.title_ar}
              </h1>
              <span className="track-badge">{data.category}</span>
              <span className={`status-badge status-badge--${data.status === 'published' ? 'published' : 'review'}`}>
                {data.status}
              </span>
            </div>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              {ar ? `نموذج رسم وتلوين تفاعلي · الفئة العمرية: ${data.age_min}–${data.age_max} سنوات` : `Interactive drawing model · Age: ${data.age_min}–${data.age_max}`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="button button--primary button--small">
            <Icon name="check" size={14} />
            <span>{ar ? 'حفظ التعديلات' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الفئة الفنية' : 'Art Category'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>{data.category}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'تصنيف معتمد' : 'Verified category'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'خطوات الرسم' : 'Steps Count'}</span>
            <div className="bento-glass-card__icon"><Icon name="pen" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{steps.length}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'خطوة متتابعة' : 'Sequential steps'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'مستوى الصعوبة' : 'Difficulty'}</span>
            <div className="bento-glass-card__icon"><Icon name="star" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>{data.difficulty}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{data.age_min}–{data.age_max} {ar ? 'سنوات' : 'years'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'جاهزية النشر' : 'Publish Readiness'}</span>
            <div className="bento-glass-card__icon"><Icon name="shield" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>
            {data.reference_asset_id ? 'Ready' : 'Incomplete'}
          </div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${data.reference_asset_id ? 'positive' : 'negative'}`}>
              {data.reference_asset_id ? (ar ? 'الأصل مكتمل' : 'Asset verified') : (ar ? 'ناقص أصل' : 'Missing asset')}
            </span>
          </div>
        </article>
      </section>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Metadata Form */}
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Icon name="file-text" size={18} />
              <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'البيانات الأساسية للنموذج' : 'Model Specifications'}</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  {ar ? 'العنوان بالعربية' : 'Arabic Title'}
                </label>
                <input
                  defaultValue={data.title_ar}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-sunken)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  {ar ? 'الفئة الفنية' : 'Category'}
                </label>
                <select
                  defaultValue={data.category}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-sunken)' }}
                >
                  <option>حيوانات</option>
                  <option>فضاء</option>
                  <option>طبيعة</option>
                  <option>مركبات</option>
                  <option>بيت</option>
                  <option>زخارف</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  {ar ? 'المدى العمري' : 'Age Range'}
                </label>
                <input
                  defaultValue={`${data.age_min}-${data.age_max}`}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-sunken)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  {ar ? 'درجة الصعوبة' : 'Difficulty Level'}
                </label>
                <select
                  defaultValue={data.difficulty}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-sunken)' }}
                >
                  <option>سهل</option>
                  <option>متوسط</option>
                  <option>مفصل</option>
                </select>
              </div>
            </div>
          </div>

          {/* Steps Authoring */}
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="pen" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  {ar ? `خطوات الرسم التدريجي (${steps.length} خطوات)` : `Step-by-Step Drawing (${steps.length} steps)`}
                </h3>
              </div>
              <button
                className="button button--secondary button--small"
                onClick={() => setSteps([...steps, { step_order: steps.length + 1, instruction_ar: 'خطوة جديدة' }])}
              >
                <Icon name="plus" size={14} />
                <span>{ar ? 'إضافة خطوة' : 'Add Step'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {steps.map((s, i) => (
                <div
                  key={s.id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    background: 'var(--surface-sunken)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    #{s.step_order || i + 1}
                  </span>
                  <input
                    defaultValue={s.instruction_ar}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-elevated, #fff)', fontSize: 13 }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="button button--ghost button--small">صورة</button>
                    <button className="button button--ghost button--small">صوت</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Device Canvas Simulator */}
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="devices" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'محاكاة شاشة الطفل' : 'Child Canvas Simulation'}</h3>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className={`button ${previewMode === 'phone' ? 'button--primary' : 'button--ghost'} button--small`}
                  onClick={() => setPreviewMode('phone')}
                >
                  هاتف عمودي (9:16)
                </button>
                <button
                  className={`button ${previewMode === 'tablet' ? 'button--primary' : 'button--ghost'} button--small`}
                  onClick={() => setPreviewMode('tablet')}
                >
                  تابلت أفقي (16:9)
                </button>
              </div>
            </div>

            <div
              style={{
                border: '1px solid var(--border)',
                aspectRatio: previewMode === 'phone' ? '9/16' : '16/9',
                maxWidth: previewMode === 'phone' ? 320 : 540,
                margin: '0 auto',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#09090b',
                boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: previewMode === 'phone' ? 'column' : 'row', height: '100%' }}>
                <div style={{ flex: previewMode === 'phone' ? '0 0 40%' : '0 0 40%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: previewMode === 'phone' ? '1px solid #e2e8f0' : 'none', borderInlineEnd: previewMode === 'tablet' ? '1px solid #e2e8f0' : 'none' }}>
                  {data.reference_asset_id ? (
                    <img src={`/api/media/${data.reference_asset_id}`} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>المرجع الفني</span>
                  )}
                </div>
                <div style={{ flex: 1, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
                  لوحة رسم الطفل الحرة
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Verification Checklist */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="check" size={16} />
              <span>{ar ? 'فحص اكتمال النشاط' : 'Readiness Checklist'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>الصورة المرجعية:</span>
                <span className={`badge badge--pill ${data.reference_asset_id ? 'badge--success' : ''}`}>
                  {data.reference_asset_id ? '✓ متوفرة' : '✗ ناقصة'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>الصورة المصغرة:</span>
                <span className={`badge badge--pill ${data.thumbnail_asset_id ? 'badge--success' : ''}`}>
                  {data.thumbnail_asset_id ? '✓ متوفرة' : '✗ ناقصة'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>النصوص والتعليمات:</span>
                <span className="badge badge--pill badge--success">✓ معتمدة</span>
              </div>
            </div>
          </div>

          {/* AI Creative Copilot */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار الرسم التفاعلي' : 'Drawing Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {ar
                ? 'تأكد من أن الخطوط الأولية تعتمد على أشكال هندسية بسيطة (دائرة، مثلث، مستطيل) لتسهيل محاكاة الطفل للنموذج.'
                : 'Initial strokes should anchor on primitive geometry to ensure successful child reproduction.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
