import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { ErrorState, LoadingState } from '../components/PageState'
import { api } from '../lib/api'
import { usePreferences } from '../context/preferences'
import type { ParentDigestConfig, ParentDigestPreview } from '../types/api'

export function ParentDigestsPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  const [config, setConfig] = useState<ParentDigestConfig | null>(null)
  const [preview, setPreview] = useState<ParentDigestPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [testSuccess, setTestSuccess] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')
  const [testEmail, setTestEmail] = useState('parent@majarra.app')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [configRes, previewRes] = await Promise.all([
        api.parentDigestsConfig(),
        api.parentDigestsPreview(),
      ])
      if (configRes.data) setConfig(configRes.data)
      if (previewRes.data) setPreview(previewRes.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (ar ? 'تعذر تحميل إعدادات تقارير الأهل' : 'Failed to load parent digests'))
    } finally {
      setLoading(false)
    }
  }, [ar])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setError('')
    setSaveSuccess(false)
    try {
      await api.updateParentDigestsConfig(config)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (ar ? 'تعذر حفظ الإعدادات' : 'Failed to save settings'))
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    setSendingTest(true)
    setTestSuccess('')
    setError('')
    try {
      await api.parentDigestsSendTest(testEmail)
      setTestSuccess(ar ? `✅ تم إرسال تقرير تجريبي إلى ${testEmail} بنجاح!` : `✅ Test digest sent to ${testEmail}!`)
      setTimeout(() => setTestSuccess(''), 4000)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (ar ? 'فشل إرسال التقرير التجريبي' : 'Failed to send test digest'))
    } finally {
      setSendingTest(false)
    }
  }

  if (loading) return <LoadingState label={ar ? 'جاري تحميل محرك تقارير المتابعة الأسبوعية...' : 'Loading parent digests engine...'} />
  if (error && !config) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="admin-page-container space-y-6 pb-12" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>💌</span>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {ar ? 'محرك تقارير المتابعة الأسبوعية للأهل (Parent Weekly Digest)' : 'Parent Weekly Progress Digest'}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1" style={{ color: 'var(--text-secondary, #6b7280)', marginTop: '4px' }}>
            {ar
              ? 'إرسال تقرير إنجازات وتطور الطفل أسبوعياً للوالدين لتعزيز الشفافية وخفض معدل إلغاء الاشتراكات (Churn Reduction)'
              : 'Automated weekly progress reports to boost parent engagement and retention'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {saveSuccess && (
            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>
              ✓ {ar ? 'تم الحفظ' : 'Saved'}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 24px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
            }}
          >
            <Icon name="sparkles" size={18} />
            {saving ? (ar ? 'جاري الحفظ...' : 'Saving...') : (ar ? 'حفظ إعدادات القوالب' : 'Save Config')}
          </button>
        </div>
      </div>

      {testSuccess && (
        <div style={{ padding: '14px 18px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', color: '#166534', fontWeight: 'bold' }}>
          {testSuccess}
        </div>
      )}

      {/* Retention Impact Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>{ar ? 'معدل فتح أولياء الأمور' : 'Parent Open Rate'}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a', marginTop: '6px' }}>
            {preview?.retention_impact.opened_rate ?? '68.4%'}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            {ar ? 'أعلى بـ 3 أضعاف من النشرات الإخبارية العادية' : '3x industry standard'}
          </div>
        </div>

        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>{ar ? 'رضا الأهل عن تطور أطفالهم' : 'Parent Satisfaction'}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb', marginTop: '6px' }}>
            {preview?.retention_impact.active_parent_satisfaction ?? '94%'}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            {ar ? 'بناءً على استبيانات متابعة الأثر التربوي' : 'Based on ongoing feedback'}
          </div>
        </div>

        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>{ar ? 'أثر خفض إلغاء الاشتراكات' : 'Churn Reduction'}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#059669', marginTop: '6px' }}>
            {preview?.retention_impact.churn_reduction_estimate ?? '-22%'}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            {ar ? 'الأهل المتابعون للتقارير يجددون دائماً' : 'Parents who see progress renew'}
          </div>
        </div>
      </div>

      {/* Main Grid: Template Config & Live Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Left: Settings & Template Editor */}
        <div style={{ padding: '24px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span>⚙️</span> {ar ? 'جدولة وقوالب الرسائل' : 'Digest Schedule & Templates'}
          </h2>

          {config && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig((prev) => prev ? { ...prev, enabled: e.target.checked } : null)}
                  style={{ width: '18px', height: '18px' }}
                />
                {ar ? 'تفعيل الإرسال التلقائي الأسبوعي' : 'Enable Automated Weekly Dispatch'}
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                    {ar ? 'يوم الإرسال' : 'Delivery Day'}
                  </label>
                  <select
                    value={config.delivery_day}
                    onChange={(e) => setConfig((prev) => prev ? { ...prev, delivery_day: e.target.value } : null)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  >
                    <option value="thursday">{ar ? 'الخميس' : 'Thursday'}</option>
                    <option value="friday">{ar ? 'الجمعة' : 'Friday'}</option>
                    <option value="saturday">{ar ? 'السبت' : 'Saturday'}</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                    {ar ? 'وقت الإرسال' : 'Delivery Time'}
                  </label>
                  <input
                    type="time"
                    value={config.delivery_time}
                    onChange={(e) => setConfig((prev) => prev ? { ...prev, delivery_time: e.target.value } : null)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  >
                  </input>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {ar ? 'عنوان الرسالة البريدية' : 'Email Subject'}
                </label>
                <input
                  type="text"
                  value={config.email_subject_template}
                  onChange={(e) => setConfig((prev) => prev ? { ...prev, email_subject_template: e.target.value } : null)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {ar ? 'نص تقرير الأسبوع (يدعم المتغيرات الذكية)' : 'Digest Message Body Template'}
                </label>
                <textarea
                  rows={8}
                  value={config.message_template_ar}
                  onChange={(e) => setConfig((prev) => prev ? { ...prev, message_template_ar: e.target.value } : null)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', lineHeight: '1.6' }}
                />
              </div>

              {/* Send Test Dispatch */}
              <div style={{ paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
                  {ar ? 'تجربة إرسال مباشر (Test Dispatch)' : 'Send Sample Digest'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="parent@example.com"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={sendingTest}
                    style={{
                      padding: '8px 16px',
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      cursor: sendingTest ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {sendingTest ? (ar ? 'جاري الإرسال...' : 'Sending...') : (ar ? 'إرسال عينة' : 'Send Test')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Digest Card Preview */}
        <div style={{ padding: '24px', borderRadius: '12px', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: '#ffffff', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8, fontWeight: 'bold' }}>
              📱 {ar ? 'معاينة رسالة ولي الأمر' : 'Parent Live Digest Card'}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>
              {ar ? 'عينة حية' : 'Live Sample'}
            </span>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px', backdropFilter: 'blur(8px)', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                🌟
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {ar ? `تقرير أسبوع البطل ${preview?.child_name}` : `Weekly Report for ${preview?.child_name}`}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  {ar ? 'المسار المعرفي: مستكشف الفضاء' : 'Cognitive Track: Space Explorer'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>⏱️ {ar ? 'وقت التعلم' : 'Screen Time'}</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '2px' }}>{preview?.screen_time_hours} {ar ? 'ساعات' : 'hrs'}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>⭐ {ar ? 'النجوم المكتسبة' : 'Stars Earned'}</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '2px' }}>+{preview?.stars_earned}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>🧠 {ar ? 'مهارات أتقنها' : 'Mastered Skills'}</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '2px' }}>{preview?.skills_mastered}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>🏆 {ar ? 'وسام الأسبوع' : 'Badge Awarded'}</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '4px' }}>{preview?.badge_awarded}</div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.12)', padding: '14px', borderRadius: '8px', borderRight: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fde68a' }}>
                💡 {ar ? 'توصية تربوية مخصصة للأسرة' : 'Parental Family Tip'}
              </div>
              <div style={{ fontSize: '13px', marginTop: '4px', opacity: 0.95, lineHeight: '1.5' }}>
                {ar
                  ? `أظهر ${preview?.child_name} شغفاً كبيراً في ${preview?.top_category}. ننصحكم بمشاهدة قصة "${preview?.recommended_story}" معاً في نهاية الأسبوع!`
                  : `Discuss cooperation together with the story "${preview?.recommended_story}"!`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
