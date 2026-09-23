import { Link } from 'react-router-dom'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { readAdminUser } from '../lib/adminSession'

/**
 * مركز الإعدادات والتهيئة الشاملة — System Settings & Administration Hub
 *
 * بوابة الإدارة المركزية لحالة الموقع، هوية الحساب، السياسات الأمنية، الجلسات النشطة،
 * وتوزيع إصدارات التطبيق عبر البنية التحتية السحابية.
 */

const copy = {
  ar: {
    eyebrow: 'إدارة النظام والتهيئة العامة',
    title: 'مركز الإعدادات والتحكم بالنظام',
    lede: 'بوابة الإدارة المركزية لحالة الموقع، حسابات المشرفين، التوافقية، والأمان التشغيلي الشامل.',
    websiteMode: 'وضع الموقع العام',
    websiteDesc: 'التحكم في النشر المباشر (LIVE)، وضع الصيانة، أو صفحة الإطلاق والعد التنازلي.',
    myAccount: 'الملف الشخصي وحسابي',
    myDesc: 'بيانات الحساب، الأدوار المسندة، تفضيلات اللغة، وتاريخ النشاط الشخصي.',
    security: 'الأمان والمصادقة المتقدمة',
    secDesc: 'تغيير كلمة المرور، مقاييس قوة التشفير، وسجلات التدقيق الحساسة.',
    sessions: 'الجلسات والأجهزة النشطة',
    sessDesc: 'رصد المتصفحات والأجهزة المتصلة بحسابك وسحب الصلاحيات بضغطة واحدة.',
    appReleases: 'إصدارات التطبيق والتوافق',
    appReleasesDesc: 'إدارة الإصدارات المعتمدة على المتاجر (iOS/Android) وسياسات الترقية الإلزامية.',
    governance: 'حوكمة الصلاحيات والمخاطر',
    governanceDesc: 'تدقيق الأذونات والمنح المؤقتة وتطبيق مبدأ الحد الأدنى من الصلاحيات (Zero-Trust).',
    systemLiveBadge: 'النظام مستقر ومحدث',
    hubKpiSiteMode: 'حالة الموقع العام',
    hubKpiAdmin: 'المشرف المتصل',
    hubKpiSecurity: 'الحصانة الأمنية',
    hubKpiInfrastructure: 'البنية التحتية',
    openHub: 'فتح القسم',
    inspectorTitle: 'مفتش النظام والبيئة التشغيلية',
    inspectorDesc: 'بيانات بيئة الإنتاج السحابية وحالة المزامنة اللحظية',
    tripleMetersTitle: 'مؤشرات سلامة التهيئة والبيئة',
    meterConsistency: 'اتساق إعدادات المنظومة',
    meterSyncSpeed: 'سرعة المزامنة السحابية (Edge)',
    meterShield: 'درع الأمان وعزل البيئات',
    infraCloudflare: 'شبكة الحافة: Cloudflare Workers',
    infraDatabase: 'قاعدة البيانات: Cloudflare D1 Serverless',
    infraStorage: 'مستودع الوسائط: Cloudflare R2 Bucket',
    aiAdvisorTitle: 'توجيهات الذكاء الاصطناعي للنظام',
    aiAdvisorDesc: 'جميع الخدمات السحابية والشهادات الأمنية تعمل بكفاءة 100%. ينصح بإجراء فحص دوري للمنح المؤقتة للمشرفين كل أسبوعين.',
  },
  en: {
    eyebrow: 'System Configuration & Governance',
    title: 'System Settings & Administration Hub',
    lede: 'Centralized administration gateway for site modes, admin accounts, platform compatibility, and infrastructure security.',
    websiteMode: 'Public Website Mode',
    websiteDesc: 'Manage LIVE status, maintenance mode, or launch countdown pages.',
    myAccount: 'My Profile & Account',
    myDesc: 'Personal identity, assigned roles, language preferences, and activity ledger.',
    security: 'Security & Advanced Auth',
    secDesc: 'Password rotation, cryptographic strength meters, and sensitive operation logs.',
    sessions: 'Active Sessions & Devices',
    sessDesc: 'Audit active browser fingerprints and revoke unauthorized sessions in one click.',
    appReleases: 'App Releases & Compatibility',
    appReleasesDesc: 'Manage store-approved builds (iOS/Android) and mandatory upgrade cutoffs.',
    governance: 'Access Governance & Risk Matrix',
    governanceDesc: 'Zero-trust privilege auditing, orphan permission cleanup, and blast radius control.',
    systemLiveBadge: 'Systems Operational & Synced',
    hubKpiSiteMode: 'Public Site Status',
    hubKpiAdmin: 'Authenticated Admin',
    hubKpiSecurity: 'Security Posture',
    hubKpiInfrastructure: 'Infrastructure Health',
    openHub: 'Open Settings',
    inspectorTitle: 'System & Environment Inspector',
    inspectorDesc: 'Cloud production runtime parameters and live edge synchronization',
    tripleMetersTitle: 'Configuration & Environment Meters',
    meterConsistency: 'System Configuration Consistency',
    meterSyncSpeed: 'Edge Synchronization Speed',
    meterShield: 'Zero-Trust Shield & Isolation',
    infraCloudflare: 'Edge Runtime: Cloudflare Workers',
    infraDatabase: 'Database: Cloudflare D1 Serverless',
    infraStorage: 'Assets: Cloudflare R2 Bucket',
    aiAdvisorTitle: 'AI System Governance Advisor',
    aiAdvisorDesc: 'All edge runtime nodes and TLS configurations are performing optimally. Conducting bi-weekly audits on temporary grants is recommended.',
  },
}

export function SettingsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const self = readAdminUser()

  const settingsCards = [
    {
      to: adminPath('website/mode'),
      icon: 'globe' as const,
      color: '#38bdf8',
      title: text.websiteMode,
      desc: text.websiteDesc,
      tag: 'LIVE',
    },
    {
      to: adminPath('my-account'),
      icon: 'users' as const,
      color: '#6366f1',
      title: text.myAccount,
      desc: text.myDesc,
      tag: self?.display_name || 'Admin',
    },
    {
      to: adminPath('security'),
      icon: 'shield' as const,
      color: '#10b981',
      title: text.security,
      desc: text.secDesc,
      tag: 'Verified',
    },
    {
      to: adminPath('sessions'),
      icon: 'devices' as const,
      color: '#a855f7',
      title: text.sessions,
      desc: text.sessDesc,
      tag: 'Active',
    },
    {
      to: adminPath('app-releases'),
      icon: 'star' as const,
      color: '#f59e0b',
      title: text.appReleases,
      desc: text.appReleasesDesc,
      tag: 'v2.5.0',
    },
    {
      to: adminPath('governance'),
      icon: 'sparkles' as const,
      color: '#ec4899',
      title: text.governance,
      desc: text.governanceDesc,
      tag: 'Zero-Trust',
    },
  ]

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
              {text.systemLiveBadge}
            </span>
          </div>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      {/* 2. BENTO GLASS METRIC CARDS (4 KPIs) */}
      <section className="hero-kpis" aria-label="Settings Hub KPIs">
        <div className="kpi-glass-card kpi-glass-card--success">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.hubKpiSiteMode}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="globe" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">LIVE</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'الموقع العام متاح ونشط للزوار' : 'Public website live and serving'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.hubKpiAdmin}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="users" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value" style={{ fontSize: 18 }}>
            {self?.display_name || 'Admin'}
          </div>
          <div className="kpi-glass-card__caption">{self?.email || 'admin@majarra.app'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.hubKpiSecurity}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="shield" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">100%</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'تشفير كامل للجلسات والمصادقة' : 'Full cryptographic token hygiene'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.hubKpiInfrastructure}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="sparkles" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">Edge Multi-AZ</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'خدمات سحابية موزعة عالمياً' : 'Global Cloudflare edge deployment'}</div>
        </div>
      </section>

      {/* 3. ENTERPRISE SPLIT WORKSPACE (68% / 32%) */}
      <div className="exec-split" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left Column (68% Settings Hub Cards Grid) */}
        <div className="exec-split__main" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {settingsCards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              style={{
                textDecoration: 'none',
                padding: 22,
                borderRadius: 16,
                background: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14,
                color: 'inherit',
                transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.borderColor = card.color
                e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.2), 0 0 20px ${card.color}25`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: `${card.color}18`,
                      color: card.color,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Icon name={card.icon} size={20} />
                  </div>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      background: `${card.color}15`,
                      color: card.color,
                    }}
                  >
                    {card.tag}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                  {card.title}
                </h3>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55 }}>
                  {card.desc}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: card.color }}>
                <span>{text.openHub}</span>
                <Icon name="arrow" size={13} />
              </div>
            </Link>
          ))}
        </div>

        {/* Right Column (32% System Inspector) */}
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
                <Icon name="sparkles" size={17} />
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
                    <span>{text.meterConsistency}</span>
                    <span style={{ color: '#10b981' }}>100%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 999, background: '#10b981' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterSyncSpeed}</span>
                    <span style={{ color: '#818cf8' }}>99.4%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '99.4%', height: '100%', borderRadius: 999, background: '#818cf8' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterShield}</span>
                    <span style={{ color: '#38bdf8' }}>100%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 999, background: '#38bdf8' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Cloud Architecture Details */}
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 11.5,
                color: 'var(--text-soft)',
              }}
            >
              <div>● {text.infraCloudflare}</div>
              <div>● {text.infraDatabase}</div>
              <div>● {text.infraStorage}</div>
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
