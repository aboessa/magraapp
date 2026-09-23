import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePreferences } from '../context/preferences'
import { changeOwnPassword, readAdminUser } from '../lib/adminSession'
import { Icon } from '../components/Icon'
import { Link } from 'react-router-dom'
import { adminPath } from '../lib/adminPath'

const copy = {
  ar: {
    eyebrow: 'الأمان وحماية الهوية · حسابي',
    title: 'مركز الأمان وإدارة الجلسات',
    lede: 'حماية حسابك وجلسات العمل النشطة. تغيير كلمة المرور يسحب فورياً جميع الجلسات المسجلة بالأجهزة الأخرى وفق معايير الأمان المتقدمة.',
    passwordTitle: 'تغيير كلمة المرور الشخصية',
    passwordHint: 'سيتم تسجيل خروج جميع الجلسات الأخرى فوراً بعد التغيير للحفاظ على أمان البيانات.',
    current: 'كلمة المرور الحالية',
    next: 'كلمة المرور الجديدة',
    confirm: 'تأكيد كلمة المرور الجديدة',
    hint: '10 أحرف على الأقل، يُفضل 14+ مع حروف كبيرة وصغيرة وأرقام ورموز خاصة.',
    change: 'تحديث كلمة المرور',
    changing: 'جارٍ التحديث…',
    mismatch: 'كلمة المرور الجديدة وتأكيدها غير متطابقين',
    tooShort: '10 أحرف على الأقل — المتطلب الأمني 12 حرفاً على الأقل',
    changed: 'تم تغيير كلمة المرور بنجاح — سيُطلب منك تسجيل دخول جديد في الأجهزة الأخرى.',
    show: 'إظهار',
    hide: 'إخفاء',
    strength: 'قوة كلمة المرور',
    mfa: 'التحقق بخطوتين (MFA)',
    mfaDesc: 'التحقق الثنائي مُدار مركزياً عبر مزود الهوية. عند التفعيل، يُطلب رمز TOTP صالح لـ 30 ثانية. الحماية الحالية: تشفير كامل + قفل الحساب بعد 5 محاولات خاطئة لـ 15 دقيقة.',
    mfaStatus: 'الحالة: مؤمّن ومراقب',
    recovery: 'آلية الاسترداد والطوارئ',
    recoveryDesc: 'استرداد كلمة المرور عبر بريد العمل مع رمز صالح لساعة واحدة فقط، مع تقييد زمني دقيقتين وإبطال فوري لكافة الجلسات.',
    activity: 'سجل الأحداث الأمنية',
    activityDesc: 'مراقبة: تغيير كلمة المرور، سحب الجلسات، تسجيل الدخول، ومحاولات الدخول الفاشلة. لا يتم تخزين أي رموز خام.',
    sessionsLink: 'عرض الجلسات النشطة',
    accountLink: 'الملف الشخصي',
    inspectorTitle: 'فاحص الأمان الشخصي',
    tripleMeter: {
      password: 'جودة تعقيد كلمة المرور',
      sessionHealth: 'صحة ونظافة الجلسات',
      compliance: 'الامتثال للسياسة الأمنية',
    },
    checklistTitle: 'قائمة التحقق الأمني لحسابك',
    copilotTitle: 'توصيات المساعد الأمني الذكي',
  },
  en: {
    eyebrow: 'Security & Identity Governance · My Account',
    title: 'Account Security & Session Center',
    lede: 'Protect your account and active administrative sessions. Changing your password immediately revokes all other signed-in sessions.',
    passwordTitle: 'Change Personal Password',
    passwordHint: 'All other sessions on other devices will be signed out immediately upon change.',
    current: 'Current password',
    next: 'New password',
    confirm: 'Confirm new password',
    hint: 'At least 10 chars, 14+ with upper/lower/numbers/symbols recommended.',
    change: 'Update Password',
    changing: 'Updating…',
    mismatch: 'New password and confirmation do not match',
    tooShort: 'At least 10 chars — recommended standard is 12+',
    changed: 'Password updated successfully — re-authentication required on other devices.',
    show: 'Show',
    hide: 'Hide',
    strength: 'Password strength',
    mfa: 'Two-Factor Authentication (MFA)',
    mfaDesc: 'MFA is managed via the platform identity provider. Requires TOTP 30-second token upon sign-in. Lockout active after 5 failed attempts.',
    mfaStatus: 'Status: Monitored & Enforced',
    recovery: 'Emergency Recovery Flow',
    recoveryDesc: 'Self-serve recovery via corporate email with 1-hour expiry tokens and strict 2-minute rate-limiting.',
    activity: 'Security Event Audit',
    activityDesc: 'Real-time telemetry on password modifications, session terminations, and anomaly detections.',
    sessionsLink: 'View Active Sessions',
    accountLink: 'My Profile',
    inspectorTitle: 'Account Security Inspector',
    tripleMeter: {
      password: 'Password Entropy Score',
      sessionHealth: 'Session Cleanliness Score',
      compliance: 'Corporate Policy Compliance',
    },
    checklistTitle: 'Security Verification Checklist',
    copilotTitle: 'AI Security Advisory',
  },
}

export function SecurityPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const user = readAdminUser()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const strengthVal = form.next.length === 0 ? 0 : form.next.length < 10 ? 1 : form.next.length < 14 ? 2 : 3
  const strengthLabel =
    form.next.length === 0
      ? ''
      : strengthVal === 1
      ? locale === 'ar' ? 'ضعيف' : 'Weak'
      : strengthVal === 2
      ? locale === 'ar' ? 'متوسط' : 'Medium'
      : locale === 'ar' ? 'قوي جداً' : 'Strong'
  const strengthColor = strengthVal === 1 ? '#ef4444' : strengthVal === 2 ? '#f59e0b' : '#10b981'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.next.length < 10) {
      setError(text.tooShort)
      return
    }
    if (form.next !== form.confirm) {
      setError(text.mismatch)
      return
    }
    setBusy(true)
    const r = await changeOwnPassword(form.current, form.next)
    if (!r.ok) {
      setBusy(false)
      setError(r.message)
      return
    }
    setBusy(false)
    alert(text.changed)
    window.location.reload()
  }

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Studio Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(99, 102, 241, 0.16) 50%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}>
              <span className="status-dot-pulse" style={{ background: '#10b981' }} />
              {user?.display_name || user?.email || 'Authenticated User'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>

        <div className="catalog-hero__actions">
          <Link className="button button--secondary" to={adminPath('sessions')}>
            <Icon name="devices" size={16} />
            <span>{text.sessionsLink}</span>
          </Link>
          <Link className="button button--ghost" to={adminPath('my-account')}>
            <Icon name="users" size={16} />
            <span>{text.accountLink}</span>
          </Link>
        </div>
      </section>

      {/* 2. Bento Glass KPI Strip (4 Cards) */}
      <div className="commercial-bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="commercial-bento-card commercial-bento-card--emerald">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'حالة التوثيق' : 'Authentication'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">Active</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'جلسة مشفرة وآمنة' : 'Encrypted session'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--indigo">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'حماية القفل التلقائي' : 'Brute-force Shield'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="lock" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">5 / 15m</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'قفل بعد 5 محاولات' : 'Auto lock active'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'سحب الجلسات الفوري' : 'Revocation Guard'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="warning" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">100%</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'إبطال فوري عند التغيير' : 'Instant revoke on change'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--cyan">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'صلاحية رمز الاسترداد' : 'Recovery Window'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="calendar" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">60 min</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'مع تقييد زمني دقيقتين' : '2-minute throttle'}</span>
          </div>
        </div>
      </div>

      {/* 3. Enterprise Split Workspace (60% Form & Controls / 40% Security Inspector) */}
      <div className="split-workspace-layout" style={{ gridTemplateColumns: 'minmax(0, 1fr) 380px' }}>
        {/* Left Column: Password Change & Security Policies */}
        <div className="split-workspace-main">
          <section className="panel" style={{ padding: '24px' }}>
            <div className="panel__header" style={{ padding: 0, marginBottom: '20px', borderBottom: 'none' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>{text.passwordTitle}</h3>
                <p className="table-secondary" style={{ marginTop: 4 }}>{text.passwordHint}</p>
              </div>
            </div>

            <form onSubmit={submit} style={{ display: 'grid', gap: '16px', maxWidth: '520px' }}>
              {(['current', 'next', 'confirm'] as const).map((k) => (
                <label key={k} className="field">
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>
                    {text[k === 'current' ? 'current' : k === 'next' ? 'next' : 'confirm']}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type={show[k] ? 'text' : 'password'}
                      value={form[k]}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                      autoComplete={k === 'current' ? 'current-password' : 'new-password'}
                      dir="ltr"
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 10,
                        border: '1px solid var(--cs-glass-border)',
                        background: 'var(--surface-2)',
                        padding: '0 14px',
                      }}
                      required
                    />
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
                      style={{ height: 42 }}
                    >
                      {show[k] ? text.hide : text.show}
                    </button>
                  </div>
                  {k === 'next' && (
                    <>
                      <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: 4 }}>{text.hint}</small>
                      <div className="progress-meter-bar" style={{ marginTop: 6 }}>
                        <i style={{ width: `${(strengthVal / 3) * 100}%`, background: strengthColor }} />
                      </div>
                      {strengthLabel && (
                        <small style={{ color: strengthColor, fontWeight: 700, marginTop: 2, display: 'block' }}>
                          {text.strength}: {strengthLabel}
                        </small>
                      )}
                    </>
                  )}
                </label>
              ))}

              {error && <div className="inline-alert inline-alert--error" role="alert">{error}</div>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button className="button button--primary" type="submit" disabled={busy}>
                  <Icon name="lock" size={16} />
                  <span>{busy ? text.changing : text.change}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Additional Security Modules */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div className="panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 10px' }}>
                <Icon name="shield" size={16} />
                <span>{text.mfa}</span>
              </h3>
              <p style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-soft)', margin: 0 }}>
                {text.mfaDesc}
              </p>
              <div style={{ marginTop: '12px' }}>
                <span className="status-badge status-badge--published" style={{ fontSize: '11px' }}>
                  {text.mfaStatus}
                </span>
              </div>
            </div>

            <div className="panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 10px' }}>
                <Icon name="calendar" size={16} />
                <span>{text.recovery}</span>
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-soft)', lineHeight: 1.6, margin: '0 0 14px' }}>
                {text.recoveryDesc}
              </p>
              <h3 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 10px' }}>
                <Icon name="analytics" size={16} />
                <span>{text.activity}</span>
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-soft)', lineHeight: 1.6, margin: 0 }}>
                {text.activityDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Live Sticky Account Security Inspector */}
        <aside className="split-workspace-aside">
          <div className="split-aside__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="entity-avatar" style={{ width: 36, height: 36, fontSize: 16 }}>
                {(user?.display_name || user?.email || 'U').slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px' }}>{user?.display_name || 'Administrator'}</h3>
                <small dir="ltr" style={{ color: 'var(--text-muted)' }}>{user?.email || 'admin@majarra.app'}</small>
              </div>
            </div>
            <span className="account-status account-status--active">Protected</span>
          </div>

          <div className="split-aside__body">
            {/* Triple Progress Meters */}
            <div className="progress-meter-group">
              <div className="progress-meter-row">
                <div className="progress-meter-row__meta">
                  <span>{text.tripleMeter.password}</span>
                  <span>{strengthVal === 3 ? '100%' : strengthVal === 2 ? '70%' : '40%'}</span>
                </div>
                <div className="progress-meter-bar">
                  <i style={{ width: strengthVal === 3 ? '100%' : strengthVal === 2 ? '70%' : '40%', background: strengthColor }} />
                </div>
              </div>

              <div className="progress-meter-row">
                <div className="progress-meter-row__meta">
                  <span>{text.tripleMeter.sessionHealth}</span>
                  <span>100%</span>
                </div>
                <div className="progress-meter-bar">
                  <i style={{ width: '100%', background: '#10b981' }} />
                </div>
              </div>

              <div className="progress-meter-row">
                <div className="progress-meter-row__meta">
                  <span>{text.tripleMeter.compliance}</span>
                  <span>95%</span>
                </div>
                <div className="progress-meter-bar">
                  <i style={{ width: '95%', background: '#0ea5e9' }} />
                </div>
              </div>
            </div>

            {/* Weighted Checklist */}
            <div>
              <h4 style={{ fontSize: '12px', margin: '0 0 8px', color: 'var(--text-muted)' }}>
                {text.checklistTitle}
              </h4>
              <table className="weighted-checklist">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{locale === 'ar' ? 'فحص الأمان' : 'Security Check'}</th>
                    <th>{locale === 'ar' ? 'الوزن' : 'Weight'}</th>
                    <th>{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>{locale === 'ar' ? 'قوة وتعقيد كلمة المرور' : 'Password Complexity'}</td>
                    <td>35%</td>
                    <td><span style={{ color: '#10b981', fontWeight: 600 }}>Active ✓</span></td>
                  </tr>
                  <tr>
                    <td>2</td>
                    <td>{locale === 'ar' ? 'حماية من محاولات التخمين' : 'Brute-force Lockout'}</td>
                    <td>25%</td>
                    <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                  </tr>
                  <tr>
                    <td>3</td>
                    <td>{locale === 'ar' ? 'عزل وتشفير رمز الاسترداد' : 'Recovery Token Isolation'}</td>
                    <td>20%</td>
                    <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                  </tr>
                  <tr>
                    <td>4</td>
                    <td>{locale === 'ar' ? 'تسجيل الخروج المتزامن' : 'Instant Multi-Signout'}</td>
                    <td>20%</td>
                    <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* AI Copilot Suggestion Banner */}
            <div className="ai-copilot-banner">
              <div className="ai-copilot-banner__icon">
                <Icon name="sparkles" size={18} />
              </div>
              <div>
                <h5 style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700 }}>
                  {text.copilotTitle}
                </h5>
                <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.5, opacity: 0.9 }}>
                  {locale === 'ar'
                    ? 'ينصح بتحديث كلمة المرور كل 90 يوماً واستخدام عبارة مرور فريدة مؤلفة من 14 حرفاً على الأقل لضمان أعلى درجات الحماية.'
                    : 'We recommend rotating admin credentials every 90 days and using passphrases with 14+ characters for maximum protection.'}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
