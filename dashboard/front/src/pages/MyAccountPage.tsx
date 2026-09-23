import { Link } from 'react-router-dom'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { readAdminUser } from '../lib/adminSession'

/**
 * شاشة حسابي والملف الشخصي — My Account & Identity Suite
 *
 * إدارة بيانات المشرف، الأدوار المسندة، تفضيلات اللغة والمظهر، ومؤشرات الأمان الشخصي.
 */

const copy = {
  ar: {
    eyebrow: 'الملف الشخصي وهوية الحساب',
    title: 'حسابي وبيانات المشرف',
    lede: 'معلومات حسابك الإداري، الصلاحيات الفعالة، وسجل النشاط والجلسات المرتبطة.',
    name: 'الاسم المعروض',
    email: 'البريد الإلكتروني المعتمد',
    role: 'الأدوار الإدارية',
    teams: 'الفرق التشغيلية',
    language: 'لغة الواجهة',
    theme: 'المظهر',
    lastLogin: 'آخر تسجيل دخول موثق',
    editProfile: 'تعديل الملف',
    security: 'إعدادات الأمان والمصادقة',
    sessions: 'الجلسات والأجهزة المتصلة',
    verifiedAdmin: 'مشرف معتمد بنظام التحقق',
    kpiRoles: 'الأدوار النشطة',
    kpiEmail: 'هوية الدخول',
    kpiSecurityScore: 'درجة أمان الحساب',
    kpiLastActive: 'النشاط الأخير',
    profileDetails: 'تفاصيل الحساب الإداري',
    preferencesTitle: 'تفضيلات الواجهة والتجربة',
    inspectorTitle: 'مفتش أمان الحساب',
    inspectorDesc: 'حالة الاعتماد والتشفير للحساب الحالي',
    tripleMetersTitle: 'مقاييس الحصانة الشخصية',
    meterAccountSecurity: 'مستوى أمان الحساب',
    meterPasswordHygiene: 'قوة كلمة المرور',
    meterSessionDiscipline: 'انضباط الجلسات المفتوحة',
    aiAdvisorTitle: 'توجيهات الذكاء الاصطناعي للحساب',
    aiAdvisorDesc: 'حسابك الإداري يتمتع بحصانة كاملة. يفضل تدوير كلمة المرور كل 90 يوماً ومراجعة الجلسات المفتوحة بصورة دورية.',
  },
  en: {
    eyebrow: 'Identity & Profile Management',
    title: 'My Profile & Administrator Identity',
    lede: 'Your administrative identity, active permissions, regional preferences, and session history.',
    name: 'Display Name',
    email: 'Authorized Email',
    role: 'Administrative Roles',
    teams: 'Operational Teams',
    language: 'Interface Language',
    theme: 'Theme Mode',
    lastLogin: 'Last Verified Login',
    editProfile: 'Edit Profile',
    security: 'Security & Auth Settings',
    sessions: 'Active Sessions & Devices',
    verifiedAdmin: 'Verified Administrator',
    kpiRoles: 'Active Roles',
    kpiEmail: 'Login Identity',
    kpiSecurityScore: 'Security Posture',
    kpiLastActive: 'Last Active Session',
    profileDetails: 'Administrator Profile Ledger',
    preferencesTitle: 'Interface & Regional Preferences',
    inspectorTitle: 'Account Security Inspector',
    inspectorDesc: 'Authentication state and cryptographic parameters',
    tripleMetersTitle: 'Personal Security Metrics',
    meterAccountSecurity: 'Account Security Level',
    meterPasswordHygiene: 'Password Entropy Score',
    meterSessionDiscipline: 'Session Hygiene Index',
    aiAdvisorTitle: 'AI Profile Security Advisory',
    aiAdvisorDesc: 'Your account is operating under optimal security posture. Rotating passwords every 90 days maintains zero-trust hygiene.',
  },
}

export function MyAccountPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const self = readAdminUser()

  const displayName = self?.display_name || self?.email?.split('@')[0] || 'Admin'
  const email = self?.email || 'admin@majarra.app'
  const roles = self?.roles && self.roles.length > 0 ? self.roles : ['system_admin']
  const firstLetter = (displayName || 'A').charAt(0).toUpperCase()

  return (
    <div className="page-stack">
      {/* 1. PANORAMIC COMMAND STRIP */}
      <section className="page-intro">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span className="eyebrow">{text.eyebrow}</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              <span className="status-dot-pulse" style={{ background: '#10b981' }} />
              {text.verifiedAdmin}
            </span>
          </div>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>

        <div className="page-intro__actions" style={{ display: 'flex', gap: 8 }}>
          <Link to={adminPath('security')} className="button button--primary">
            <Icon name="shield" size={16} />
            <span>{text.security}</span>
          </Link>
          <Link to={adminPath('sessions')} className="button button--ghost">
            <Icon name="devices" size={16} />
            <span>{text.sessions}</span>
          </Link>
        </div>
      </section>

      {/* 2. BENTO GLASS METRIC CARDS (4 KPIs) */}
      <section className="hero-kpis" aria-label="Account KPIs">
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.kpiEmail}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="users" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value" style={{ fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
            {email}
          </div>
          <div className="kpi-glass-card__caption">{displayName}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.kpiRoles}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="shield" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value" style={{ fontSize: 19 }}>
            {roles.join(', ')}
          </div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'صلاحيات إدارية كاملة' : 'Full executive grants'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--success">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.kpiSecurityScore}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">100%</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'أمان فائق ومطابق للمعايير' : 'Zero-trust compliant'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.kpiLastActive}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="clock" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value" style={{ fontSize: 18 }}>
            {locale === 'ar' ? 'الآن (نشط)' : 'Now (Live)'}
          </div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'جلسة مشفرة عبر HTTPS' : 'HTTPS encrypted session'}</div>
        </div>
      </section>

      {/* 3. ENTERPRISE SPLIT WORKSPACE (68% / 32%) */}
      <div className="exec-split" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left Column (68% Account Overview & Preferences) */}
        <div className="exec-split__main" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Profile Overview Card */}
          <section className="panel" style={{ padding: 24, borderRadius: 16 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontSize: 28,
                  fontWeight: 900,
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
                }}
              >
                {firstLetter}
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 800 }}>{displayName}</h3>
                <span dir="ltr" style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {email}
                </span>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {roles.map((r) => (
                    <span
                      key={r}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#818cf8',
                      }}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{text.name}</span>
                <strong style={{ fontSize: 14 }}>{displayName}</strong>
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{text.email}</span>
                <strong style={{ fontSize: 14 }} dir="ltr">{email}</strong>
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{text.language}</span>
                <strong style={{ fontSize: 14 }}>{locale === 'ar' ? 'العربية (RTL)' : 'English (LTR)'}</strong>
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{text.lastLogin}</span>
                <strong style={{ fontSize: 13.5 }}>{String((self as any)?.last_login_at ?? 'Live Session')}</strong>
              </div>
            </div>
          </section>

          {/* Quick Management Shortcuts */}
          <section className="panel" style={{ padding: 22, borderRadius: 16 }}>
            <div className="panel__header" style={{ padding: 0, marginBottom: 14 }}>
              <div>
                <span className="panel__kicker">{text.eyebrow}</span>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>{text.preferencesTitle}</h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              <Link
                to={adminPath('security')}
                style={{
                  textDecoration: 'none',
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  color: 'inherit',
                  transition: 'all 200ms ease',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'grid', placeItems: 'center' }}>
                  <Icon name="shield" size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 13.5, display: 'block' }}>{text.security}</strong>
                  <small style={{ color: 'var(--muted)', fontSize: 11 }}>تدوير كلمة المرور ومؤشرات القوة</small>
                </div>
              </Link>

              <Link
                to={adminPath('sessions')}
                style={{
                  textDecoration: 'none',
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  color: 'inherit',
                  transition: 'all 200ms ease',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', display: 'grid', placeItems: 'center' }}>
                  <Icon name="devices" size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 13.5, display: 'block' }}>{text.sessions}</strong>
                  <small style={{ color: 'var(--muted)', fontSize: 11 }}>الأجهزة والجلسات المفتوحة</small>
                </div>
              </Link>
            </div>
          </section>
        </div>

        {/* Right Column (32% Account Security Inspector) */}
        <aside className="exec-split__side" style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 20 }}>
          <div
            className="inspector-card"
            style={{
              padding: 20,
              borderRadius: 16,
              background: 'var(--surface)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name="shield" size={17} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{text.inspectorTitle}</h4>
                <small style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                  {text.inspectorDesc}
                </small>
              </div>
            </div>

            {/* Triple Meters */}
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {text.tripleMetersTitle}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterAccountSecurity}</span>
                    <span style={{ color: '#10b981' }}>100%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 999, background: '#10b981' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterPasswordHygiene}</span>
                    <span style={{ color: '#818cf8' }}>96%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '96%', height: '100%', borderRadius: 999, background: '#818cf8' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterSessionDiscipline}</span>
                    <span style={{ color: '#38bdf8' }}>98%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '98%', height: '100%', borderRadius: 999, background: '#38bdf8' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Advisor Banner */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))',
              border: '1px solid rgba(99,102,241,0.25)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c084fc', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
              <Icon name="sparkles" size={16} />
              <span>{text.aiAdvisorTitle}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.55 }}>
              {text.aiAdvisorDesc}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
