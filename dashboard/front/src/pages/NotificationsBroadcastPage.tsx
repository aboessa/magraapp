import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { api } from '../lib/api'
import { usePreferences } from '../context/preferences'
import { formatDate, formatMetric, metricAvailabilityProps } from '../lib/labels'

interface NotificationItem {
  id: string
  parent_id: string | null
  child_id: string | null
  kind: string
  title_ar: string
  body_ar: string | null
  deep_link: string | null
  is_read: number
  created_at: string
}

const KIND_LABELS: Record<string, { ar: string; en: string; icon: string }> = {
  new_episode: { ar: 'حلقة جديدة', en: 'New Episode', icon: '🎬' },
  new_series: { ar: 'سلسلة جديدة', en: 'New Series', icon: '✨' },
  creative_update: { ar: 'تلوين وإبداع', en: 'Creative Studio', icon: '🎨' },
  continue_watching: { ar: 'متابعة المشاهدة', en: 'Continue Watching', icon: '▶️' },
  subscription_issue: { ar: 'تنبيه اشتراك', en: 'Subscription Notice', icon: '💳' },
  download_complete: { ar: 'اكتمل التنزيل', en: 'Download Complete', icon: '📥' },
}

export function NotificationsBroadcastPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [unread, setUnread] = useState<number | null>(null)

  // Form State
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState('new_episode')
  const [target, setTarget] = useState<'all' | 'active_subscribers' | 'specific'>('all')
  const [parentId, setParentId] = useState('')
  const [deepLink, setDeepLink] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.broadcastNotifications({ limit: 50 })
      setNotifications(res.data)
      setTotal(res.meta?.total ?? res.data.length)
      setUnread(res.meta?.unread ?? null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحميل الإشعارات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSending(true)
    setFeedback(null)
    try {
      const res = await api.sendBroadcastNotification({
        title_ar: title.trim(),
        body_ar: body.trim() || undefined,
        kind,
        target,
        parent_id: target === 'specific' ? parentId.trim() : undefined,
        deep_link: deepLink.trim() || undefined,
      })
      setFeedback({
        type: 'success',
        text: ar ? `تم إرسال الإشعار بنجاح إلى (${res.data.sent}) مستلم!` : `Broadcast sent successfully to (${res.data.sent}) recipients!`,
      })
      setTitle('')
      setBody('')
      setDeepLink('')
      await load()
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'فشل إرسال البث',
      })
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(ar ? 'هل أنت متأكد من حذف هذا الإشعار من السجل؟' : 'Delete this notification from history?')) return
    try {
      await api.deleteBroadcastNotification(id)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="page-stack">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="live-status-pulse" />
            <h1 className="admin-page-title" style={{ margin: 0 }}>
              {ar ? 'مركز بث الإشعارات (Push Notifications Hub)' : 'Push Notifications Broadcast Hub'}
            </h1>
          </div>
          <p className="admin-page-subtitle">
            {ar
              ? 'إرسال التنبيهات الفورية وإشعارات الحلقات والأنشطة إلى أولياء الأمور وتطبيق الأطفال مع التوجيه العميق والمعاينة الحية.'
              : 'Broadcast instant push alerts, new episodes, and activities to families with live mobile preview.'}
          </p>
        </div>
        <button className="button button--secondary button--small" onClick={() => void load()}>
          <Icon name="refresh" size={14} />
          <span>{ar ? 'تحديث' : 'Refresh'}</span>
        </button>
      </div>

      {/* Bento Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'إجمالي الإشعارات المسجلة' : 'Total Broadcasts'}</span>
            <div className="bento-glass-card__icon"><Icon name="bell" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{total}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'سجل البث النشط' : 'Active record'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الإشعارات غير المقروءة' : 'Unread Notices'}</span>
            <div className="bento-glass-card__icon"><Icon name="eye" size={16} /></div>
          </div>
          <div
            className="bento-glass-card__value"
            style={{ color: 'var(--primary)' }}
            {...metricAvailabilityProps(unread, locale)}
          >
            {formatMetric(unread, locale)}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{ar ? 'في انتظار فتح التطبيق' : 'Pending open'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'قنوات الإرسال المعتمدة' : 'Channels Ready'}</span>
            <div className="bento-glass-card__icon"><Icon name="devices" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>Android · iOS · Web</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'ربط سحابي متزامن' : 'Synced'}</span>
          </div>
        </article>
      </section>

      {/* Workspace Split */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: 20, alignItems: 'start' }}>
        {/* Left Column: Form & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* New Broadcast Composer */}
          <div className="panel" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Icon name="sparkles" size={18} />
              <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'إنشاء بث إشعار فوري جديد' : 'Compose Push Notification'}</h3>
            </div>

            {feedback && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 16,
                  background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
                  color: feedback.type === 'success' ? '#10b981' : '#ef4444',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {feedback.text}
              </div>
            )}

            <form onSubmit={handleBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="field">
                <span className="field__label">{ar ? 'عنوان الإشعار (Title)' : 'Notification Title'} *</span>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder={ar ? 'مثال: حلقة جديدة ومغامرة في جزيرة الألوان! 🎨' : 'e.g. New adventure episode released!'}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </label>

              <label className="field">
                <span className="field__label">{ar ? 'نص الإشعار التوضيحي (Body)' : 'Body Message'}</span>
                <textarea
                  className="input"
                  rows={3}
                  placeholder={ar ? 'مثال: انضموا إلى بدر وسارة في واحة الأسرار مع نشاط تلوين عائلي ممتع.' : 'e.g. Join the characters in a fun new journey.'}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field">
                  <span className="field__label">{ar ? 'نوع المحتوى (Kind)' : 'Kind / Category'}</span>
                  <select className="input" value={kind} onChange={e => setKind(e.target.value)}>
                    <option value="new_episode">🎬 حلقة جديدة (new_episode)</option>
                    <option value="new_series">✨ سلسلة جديدة (new_series)</option>
                    <option value="creative_update">🎨 استوديو الرسم (creative_update)</option>
                    <option value="continue_watching">▶️ متابعة المشاهدة (continue_watching)</option>
                    <option value="subscription_issue">💳 شؤون الاشتراك (subscription_issue)</option>
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">{ar ? 'الجمهور المستهدف (Target)' : 'Audience'}</span>
                  <select className="input" value={target} onChange={e => setTarget(e.target.value as any)}>
                    <option value="all">🌍 كافة العائلات (All Families)</option>
                    <option value="active_subscribers">⭐ المشتركون النشطون فقط (Subscribers)</option>
                    <option value="specific">👤 عائلة محددة (Single Parent ID)</option>
                  </select>
                </label>
              </div>

              {target === 'specific' && (
                <label className="field">
                  <span className="field__label">{ar ? 'معرّف ولي الأمر (Parent ID)' : 'Target Parent ID'} *</span>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="parent_..."
                    value={parentId}
                    onChange={e => setParentId(e.target.value)}
                  />
                </label>
              )}

              <label className="field">
                <span className="field__label">{ar ? 'الرابط العميق في التطبيق (Deep Link)' : 'In-App Deep Link'}</span>
                <input
                  type="text"
                  className="input"
                  placeholder={ar ? 'مثال: majarra://episodes/ep-123 أو /creative-studio/coloring' : 'e.g. majarra://episodes/ep-1'}
                  value={deepLink}
                  onChange={e => setDeepLink(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="button button--ghost button--small" onClick={() => setDeepLink('majarra://episodes')}>
                    {ar ? '+ الحلقات' : '+ Episodes'}
                  </button>
                  <button type="button" className="button button--ghost button--small" onClick={() => setDeepLink('majarra://creative/coloring')}>
                    {ar ? '+ التلوين' : '+ Coloring'}
                  </button>
                  <button type="button" className="button button--ghost button--small" onClick={() => setDeepLink('majarra://parent/billing')}>
                    {ar ? '+ الاشتراكات' : '+ Billing'}
                  </button>
                </div>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="submit" className="button button--primary" disabled={sending || !title.trim()}>
                  <Icon name="bell" size={16} />
                  <span>{sending ? (ar ? 'جارٍ البث...' : 'Broadcasting...') : (ar ? 'إرسال الإشعار الآن' : 'Broadcast Now')}</span>
                </button>
              </div>
            </form>
          </div>

          {/* History */}
          <div className="panel" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>{ar ? 'سجل الإشعارات المرسلة' : 'Broadcast History'}</h3>
            {loading ? (
              <LoadingState label={ar ? 'جارٍ جلب السجل...' : 'Loading history...'} />
            ) : error ? (
              <ErrorState message={error} onRetry={() => void load()} />
            ) : notifications.length === 0 ? (
              <EmptyState title={ar ? 'لا توجد إشعارات مرسلة بعد' : 'No notifications found'} description="" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notifications.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: 'var(--surface-sunken)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ fontSize: 20 }}>{KIND_LABELS[item.kind]?.icon || '🔔'}</span>
                      <div>
                        <strong style={{ fontSize: 14, display: 'block', marginBottom: 2 }}>{item.title_ar}</strong>
                        {item.body_ar && <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>{item.body_ar}</p>}
                        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--muted)', alignItems: 'center' }}>
                          <span style={{ padding: '1px 6px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            {KIND_LABELS[item.kind]?.[locale] || item.kind}
                          </span>
                          <span>{item.parent_id ? `👤 ${item.parent_id.slice(0, 10)}...` : '🌍 عام للكل'}</span>
                          <span>· {formatDate(item.created_at, locale)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      style={{ color: 'var(--color-danger, #ef4444)' }}
                      onClick={() => void handleDelete(item.id)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Mobile Push Simulation */}
        <aside style={{ position: 'sticky', top: 16 }}>
          <div className="panel" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>{ar ? 'معاينة حية على شاشة الهاتف (Mobile Preview)' : 'Live Mobile Push Preview'}</h4>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              {ar ? 'هكذا سيظهر الإشعار لولي الأمر أو الطفل فور إرساله عبر مركز الإشعارات في النظام:' : 'Here is how the push notification card renders on customer lockscreens:'}
            </p>

            {/* Smartphone Card Screen Mockup */}
            <div
              style={{
                background: 'linear-gradient(145deg, #1e1e2d, #14141f)',
                borderRadius: 24,
                padding: '24px 16px',
                border: '4px solid #2d2d3f',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                color: '#fff',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              <div style={{ textAlign: 'center', fontSize: 11, color: '#888', marginBottom: 16 }}>
                {ar ? 'شاشة القفل · Lockscreen' : 'Lockscreen'}
              </div>

              {/* Push Notification Card */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 16,
                  padding: 14,
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                      }}
                    >
                      🚀
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#f3f4f6' }}>
                      {ar ? 'تطبيق مجرّة للأطفال' : 'Majarra App'}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>{ar ? 'الآن' : 'now'}</span>
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#fff', lineHeight: 1.3 }}>
                  {title.trim() || (ar ? 'عنوان الإشعار يظهر هنا' : 'Notification title appears here')}
                </div>
                <div style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.4 }}>
                  {body.trim() || (ar ? 'النص التوضيحي للإشعار يظهر هنا مع كافة التفاصيل والتوجيه التلقائي.' : 'Body text of the notification appears here in real time.')}
                </div>

                {deepLink && (
                  <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 10, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>🔗</span>
                    <span dir="ltr" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deepLink}</span>
                  </div>
                )}
              </div>

              {/* Best practice tips */}
              <div style={{ marginTop: 20, padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.3)', fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
                <strong style={{ color: '#fbbf24', display: 'block', marginBottom: 4 }}>
                  💡 {ar ? 'نصيحة لزيادة معدل الفتح (CTR):' : 'CTR Optimization Tip:'}
                </strong>
                {ar
                  ? 'أفضل أوقات الإرسال لعائلات الأطفال هي بين 4:00 عصراً و 7:00 مساءً. استخدام الرموز التعبيرية يعزز تفاعل الصغار بنسبة 35%.'
                  : 'Best send times for families are 4–7 PM. Including kid-friendly emojis boosts click rates by 35%.'}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
export default NotificationsBroadcastPage
