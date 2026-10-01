import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { ErrorState, LoadingState } from '../components/PageState'
import { api } from '../lib/api'
import { usePreferences } from '../context/preferences'
import type { ScreentimeConfig, ScreentimeTrackPolicy } from '../types/api'

export function ScreentimePoliciesPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  const [config, setConfig] = useState<ScreentimeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.screentimePolicies()
      if (res.data) setConfig(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : (ar ? 'تعذر تحميل سياسات وقت الشاشة' : 'Failed to load screentime policies'))
    } finally {
      setLoading(false)
    }
  }, [ar])

  useEffect(() => {
    void load()
  }, [load])

  const handleUpdatePolicy = (trackIndex: number, field: keyof ScreentimeTrackPolicy, value: any) => {
    if (!config) return
    const updatedPolicies = [...config.policies]
    updatedPolicies[trackIndex] = {
      ...updatedPolicies[trackIndex],
      [field]: value,
    }
    setConfig({ ...config, policies: updatedPolicies })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!config) return
    setSaving(true)
    setNotice('')
    try {
      const res = await api.updateScreentimePolicies(config)
      if (res.data) {
        setConfig(res.data)
        setNotice(ar ? 'تم حفظ سياسات وقت الشاشة والرقابة الأبوية بنجاح' : 'Policies saved successfully')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13, marginBottom: 4 }}>
            <span>{ar ? 'رعاية الأسرة والطفل' : 'Family Care'}</span>
            <span>/</span>
            <span>{ar ? 'سياسات وقت الشاشة' : 'Screentime Policies'}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>⏳</span>
            {ar ? 'سياسات وقت الشاشة والرقابة الأبوية الافتراضية' : 'Default Screentime & Parental Controls'}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {ar
              ? 'تحديد الحدود الزمنية اليومية، أوقات النوم، وفترات الراحة الإلزامية وقاعدة "التعلم أولاً" لحماية الأطفال وضمان التوازن الرقمي.'
              : 'Define daily limits, bedtime locks, mandatory eye breaks, and Learn-Before-Play requirements per age track.'}
          </p>
        </div>

        <button
          type="button"
          className="button button--primary"
          onClick={handleSave}
          disabled={saving || !config}
        >
          <Icon name="check" size={16} />
          {saving ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ السياسات' : 'Save Policies')}
        </button>
      </div>

      {loading && <LoadingState label={ar ? 'جارٍ تحميل السياسات...' : 'Loading policies...'} />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {notice && (
        <div className="panel" style={{ padding: 12, marginBottom: 20, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600, borderRadius: 8, border: '1px solid #10b981' }}>
          ✓ {notice}
        </div>
      )}

      {!loading && !error && config && (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Global Safety Switches */}
          <div className="panel" style={{ padding: 22 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield" size={18} />
              {ar ? 'الضوابط العامة للسلامة الأبوية' : 'Global Safety Controls'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 8, background: 'var(--surface-sunken)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.strict_pin_lock}
                  onChange={e => setConfig({ ...config, strict_pin_lock: e.target.checked })}
                  style={{ width: 18, height: 18, marginTop: 2 }}
                />
                <div>
                  <strong style={{ fontSize: 14, display: 'block' }}>{ar ? 'قفل PIN الصارم لبوابة الوالدين' : 'Strict PIN Lock'}</strong>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {ar ? 'يمنع الطفل من الخروج أو تعديل إعدادات المشاهدة دون إدخال رمز الـ PIN المكون من 4 أرقام.' : 'Prevents children from exiting to settings without parent 4-digit PIN.'}
                  </span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 8, background: 'var(--surface-sunken)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.eye_care_blue_light_reminder}
                  onChange={e => setConfig({ ...config, eye_care_blue_light_reminder: e.target.checked })}
                  style={{ width: 18, height: 18, marginTop: 2 }}
                />
                <div>
                  <strong style={{ fontSize: 14, display: 'block' }}>{ar ? 'تذكير إراحة العين والضوء الأزرق' : 'Eye Care & Break Reminders'}</strong>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {ar ? 'إظهار تمرين رمش وإراحة العين للطفل كل 20 دقيقة مشاهدة متواصلة.' : 'Show eye resting exercise popup every 20 minutes of continuous watch.'}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Age Tracks Specific Configurations */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            {config.policies.map((pol, idx) => (
              <div
                key={pol.track}
                className="panel"
                style={{
                  padding: 22,
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, color: 'var(--primary, #3b82f6)' }}>
                      {pol.track === 'preschool'
                        ? (ar ? '🌱 مسار الروضة (3–5 سنوات)' : '🌱 Preschool (3-5 yrs)')
                        : pol.track === 'kids'
                        ? (ar ? '🚀 مسار المستكشف (6–8 سنوات)' : '🚀 Kids Explorers (6-8 yrs)')
                        : (ar ? '🎓 مسار الرواد (9–12 سنة)' : '🎓 Junior Pioneers (9-12 yrs)')}
                    </h3>
                  </div>
                </div>

                {/* Daily limit minutes */}
                <label className="field">
                  <span className="field__label">{ar ? 'الحد اليومي للشاشة (بالدقائق)' : 'Daily Screen Time (Minutes)'}</span>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    step={15}
                    className="input"
                    value={pol.daily_limit_minutes}
                    onChange={e => handleUpdatePolicy(idx, 'daily_limit_minutes', Number(e.target.value))}
                  />
                  <small style={{ color: 'var(--muted)', marginTop: 4 }}>
                    {ar ? `يعادل ${(pol.daily_limit_minutes / 60).toFixed(1)} ساعة يومياً` : `Equivalent to ${(pol.daily_limit_minutes / 60).toFixed(1)} hrs/day`}
                  </small>
                </label>

                {/* Bedtime Lock */}
                <div style={{ padding: 12, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
                    <input
                      type="checkbox"
                      checked={pol.bedtime_lock_enabled}
                      onChange={e => handleUpdatePolicy(idx, 'bedtime_lock_enabled', e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <strong style={{ fontSize: 13 }}>{ar ? 'تفعيل قفل وقت النوم (Bedtime Lock)' : 'Enable Bedtime Lock'}</strong>
                  </label>

                  {pol.bedtime_lock_enabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                      <label className="field">
                        <span className="field__label" style={{ fontSize: 11 }}>{ar ? 'يبدأ الإغلاق' : 'Lock Starts'}</span>
                        <input
                          type="time"
                          className="input"
                          value={pol.bedtime_start}
                          onChange={e => handleUpdatePolicy(idx, 'bedtime_start', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="field__label" style={{ fontSize: 11 }}>{ar ? 'ينتهي الإغلاق' : 'Lock Ends'}</span>
                        <input
                          type="time"
                          className="input"
                          value={pol.bedtime_end}
                          onChange={e => handleUpdatePolicy(idx, 'bedtime_end', e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Learn before play */}
                <div style={{ padding: 12, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
                    <input
                      type="checkbox"
                      checked={pol.learn_before_play}
                      onChange={e => handleUpdatePolicy(idx, 'learn_before_play', e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <strong style={{ fontSize: 13 }}>{ar ? 'قاعدة "التعلم أولاً قبل اللعب"' : 'Learn Before Play'}</strong>
                  </label>

                  {pol.learn_before_play && (
                    <label className="field" style={{ marginTop: 8 }}>
                      <span className="field__label" style={{ fontSize: 11 }}>{ar ? 'دقائق المحتوى التعليمي المطلوبة' : 'Required Learning Minutes'}</span>
                      <input
                        type="number"
                        min={5}
                        max={60}
                        step={5}
                        className="input"
                        value={pol.learn_required_minutes}
                        onChange={e => handleUpdatePolicy(idx, 'learn_required_minutes', Number(e.target.value))}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        </form>
      )}
    </div>
  )
}
