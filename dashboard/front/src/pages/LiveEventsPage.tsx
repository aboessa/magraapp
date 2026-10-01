import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ErrorState, LoadingState } from '../components/PageState'
import { api } from '../lib/api'
import { usePreferences } from '../context/preferences'
import { formatDate } from '../lib/labels'
import type { LiveEvent } from '../types/api'

export function LiveEventsPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  const [events, setEvents] = useState<LiveEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // New event modal
  const [createModal, setCreateModal] = useState(false)
  const [titleAr, setTitleAr] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [descAr, setDescAr] = useState('')
  const [bannerColor, setBannerColor] = useState('#8b5cf6')
  const [targetTrack, setTargetTrack] = useState<LiveEvent['target_track']>('all')
  const [multiplier, setMultiplier] = useState(2.0)
  const [badgeName, setBadgeName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.liveEvents()
      if (res.data) setEvents(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : (ar ? 'تعذر تحميل الفعاليات' : 'Failed to load events'))
    } finally {
      setLoading(false)
    }
  }, [ar])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createLiveEvent({
        title_ar: titleAr,
        title_en: titleEn || titleAr,
        description_ar: descAr,
        banner_color: bannerColor,
        target_track: targetTrack,
        reward_multiplier: Number(multiplier),
        badge_reward_name: badgeName || (ar ? 'وسام التحدي' : 'Challenge Badge'),
        is_active: true,
      })
      setCreateModal(false)
      setTitleAr('')
      setTitleEn('')
      setDescAr('')
      void load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setSaving(false)
    }
  }

  const toggleEventActive = async (event: LiveEvent) => {
    try {
      await api.updateLiveEvent(event.id, { is_active: !event.is_active })
      void load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(ar ? 'هل أنت متأكد من حذف هذه الفعالية؟' : 'Are you sure you want to delete this event?')) return
    try {
      await api.deleteLiveEvent(id)
      void load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="page-container" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13, marginBottom: 4 }}>
            <span>{ar ? 'النمو والتفاعل' : 'Growth & Engagement'}</span>
            <span>/</span>
            <span>{ar ? 'الفعاليات والتحديات الحية' : 'Live Events & Quests'}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🎪</span>
            {ar ? 'محرك الفعاليات الحية والتحديات الموسمية' : 'Live Events & Seasonal Quests'}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {ar
              ? 'إدارة الحملات والتحديات التفاعلية داخل تطبيق الأطفال مع مضاعفة نقاط النجوم والأوسمة الحصرية لرفع معدلات البقاء.'
              : 'Configure seasonal in-app events with point multipliers, exclusive badges, and banner takeovers.'}
          </p>
        </div>

        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreateModal(true)}
        >
          <Icon name="plus" size={16} />
          {ar ? 'إنشاء فعالية جديدة' : 'New Live Event'}
        </button>
      </div>

      {loading && <LoadingState label={ar ? 'جارٍ تحميل الفعاليات...' : 'Loading events...'} />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {events.length === 0 ? (
            <div className="panel" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
              <p>{ar ? 'لا توجد فعاليات مسجلة حالياً.' : 'No live events recorded yet.'}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="panel"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Event Color Banner Header */}
                  <div
                    style={{
                      background: evt.banner_color,
                      padding: '16px 20px',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, background: 'rgba(0,0,0,0.25)', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                        {evt.target_track === 'all'
                          ? (ar ? 'جميع المسارات' : 'All Tracks')
                          : `مسار ${evt.target_track}`}
                      </span>
                      <h3 style={{ margin: '8px 0 0', fontSize: 18, color: '#fff', fontWeight: 800 }}>
                        {evt.title_ar}
                      </h3>
                    </div>
                    <span style={{ fontSize: 28 }}>🏆</span>
                  </div>

                  <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {evt.description_ar}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 12, background: 'var(--surface-sunken)', borderRadius: 8, marginBottom: 16 }}>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{ar ? 'مضاعف النجوم' : 'Stars Multiplier'}</span>
                        <strong style={{ fontSize: 15, color: '#f59e0b' }}>★ {evt.reward_multiplier}x</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{ar ? 'المشاركون' : 'Participants'}</span>
                        <strong style={{ fontSize: 15 }}>{evt.participants_count.toLocaleString()}</strong>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{ar ? 'الوسام الممنوح' : 'Badge Awarded'}</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>🎖️ {evt.badge_reward_name}</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>{ar ? 'فترة الفعالية' : 'Event Period'}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          📅 {formatDate(evt.starts_at, locale)} &larr; {formatDate(evt.ends_at, locale)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                      <button
                        type="button"
                        className={`button ${evt.is_active ? 'button--primary' : 'button--ghost'} button--small`}
                        onClick={() => toggleEventActive(evt)}
                      >
                        {evt.is_active ? (ar ? '🟢 نشطة الآن' : '🟢 Active') : (ar ? '⚪ معطلة' : '⚪ Inactive')}
                      </button>

                      <button
                        type="button"
                        className="button button--ghost button--small"
                        onClick={() => handleDelete(evt.id)}
                        style={{ color: '#ef4444' }}
                      >
                        <Icon name="trash" size={14} />
                        {ar ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Event Modal */}
      {createModal && (
        <Modal open={createModal} title={ar ? 'إنشاء فعالية موسمية جديدة' : 'Create Seasonal Event'} onClose={() => setCreateModal(false)}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="field">
              <span className="field__label">{ar ? 'عنوان الفعالية (بالعربية)' : 'Event Title (Arabic)'}</span>
              <input
                type="text"
                className="input"
                value={titleAr}
                onChange={e => setTitleAr(e.target.value)}
                placeholder={ar ? 'مثال: تحدي الربيع للقصص' : 'e.g. Spring Reading Challenge'}
                required
              />
            </label>

            <label className="field">
              <span className="field__label">{ar ? 'الوصف والتفاصيل للطفل والأسرة' : 'Description'}</span>
              <textarea
                className="textarea"
                rows={3}
                value={descAr}
                onChange={e => setDescAr(e.target.value)}
                placeholder={ar ? 'اشرح ما المطلوب من الطفل والمكافأة التي سيحصل عليها...' : 'Describe what the child needs to accomplish...'}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="field">
                <span className="field__label">{ar ? 'المسار المستهدف' : 'Target Track'}</span>
                <select className="select" value={targetTrack} onChange={e => setTargetTrack(e.target.value as any)}>
                  <option value="all">{ar ? 'كافة المسارات' : 'All Tracks'}</option>
                  <option value="preschool">{ar ? 'الروضة (3-5)' : 'Preschool (3-5)'}</option>
                  <option value="kids">{ar ? 'المستكشف (6-8)' : 'Kids (6-8)'}</option>
                  <option value="junior">{ar ? 'الرواد (9-12)' : 'Junior (9-12)'}</option>
                </select>
              </label>

              <label className="field">
                <span className="field__label">{ar ? 'مضاعف النجوم' : 'Stars Multiplier'}</span>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="5"
                  className="input"
                  value={multiplier}
                  onChange={e => setMultiplier(Number(e.target.value))}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="field">
                <span className="field__label">{ar ? 'اسم الوسام الحصري' : 'Exclusive Badge Name'}</span>
                <input
                  type="text"
                  className="input"
                  value={badgeName}
                  onChange={e => setBadgeName(e.target.value)}
                  placeholder={ar ? 'مثال: وسام عبقري الرياضيات' : 'e.g. Math Genius Badge'}
                />
              </label>

              <label className="field">
                <span className="field__label">{ar ? 'لون اللافتة (Hex)' : 'Banner Color'}</span>
                <input
                  type="color"
                  className="input"
                  value={bannerColor}
                  onChange={e => setBannerColor(e.target.value)}
                  style={{ height: 40, padding: 2 }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button type="button" className="button button--ghost" onClick={() => setCreateModal(false)}>
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="button button--primary" disabled={saving}>
                {saving ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ وإطلاق الفعالية' : 'Launch Event')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
