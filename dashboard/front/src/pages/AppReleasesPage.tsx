import { useState } from 'react'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

/**
 * شاشة إصدارات التطبيق والتوافق والترقية الإلزامية — App Releases & Compatibility Suite
 *
 * تجربة متقدمة لإدارة توزيع إصدارات التطبيق على المتاجر (iOS App Store و Google Play)،
 * ضبط الحد الأدنى المطلوب للتشغيل (min_app_version)، والتحقق من التوافقية العكسية.
 */

interface AppRelease {
  id: string
  version: string
  build_number: number
  platform: 'ios' | 'android' | 'all'
  released_at: string
  min_required_version: string
  force_update: boolean
  rollout_percentage: number
  store_status: 'live' | 'pending' | 'draft' | 'deprecated'
  changelog_ar: string
  changelog_en: string
  features: string[]
}

const INITIAL_RELEASES: AppRelease[] = [
  {
    id: 'rel-2-5-0',
    version: '2.5.0',
    build_number: 250,
    platform: 'all',
    released_at: '2026-08-01',
    min_required_version: '2.4.0',
    force_update: false,
    rollout_percentage: 100,
    store_status: 'live',
    changelog_ar: 'دعم استوديو المبدعين V2، تحسينات سرعة تحميل الحلقات، ومعالجة مزامنة السرد الصوتي.',
    changelog_en: 'Creative Studio V2 R2-backed engine, faster episode pre-buffering, and audio narration sync.',
    features: ['creative_v2', 'audio_sync_v2', 'dynamic_home'],
  },
  {
    id: 'rel-2-4-2',
    version: '2.4.2',
    build_number: 242,
    platform: 'android',
    released_at: '2026-07-15',
    min_required_version: '2.4.0',
    force_update: false,
    rollout_percentage: 100,
    store_status: 'live',
    changelog_ar: 'إصلاح التوافق مع شاشات الأجهزة اللوحية وتحديث مكتبات الرسوم.',
    changelog_en: 'Tablet layout refinement and graphics driver performance patch.',
    features: ['tablet_ui_fix', 'audio_sync_v1'],
  },
  {
    id: 'rel-2-4-0',
    version: '2.4.0',
    build_number: 240,
    platform: 'all',
    released_at: '2026-06-20',
    min_required_version: '2.3.0',
    force_update: true,
    rollout_percentage: 100,
    store_status: 'live',
    changelog_ar: 'تحديث معمارية البيانات والتحول لنظام المزامنة الآمنة للوالدين.',
    changelog_en: 'Core database migration and secure family-sync protocol enforcement.',
    features: ['family_sync', 'offline_books'],
  },
  {
    id: 'rel-2-3-0',
    version: '2.3.0',
    build_number: 230,
    platform: 'all',
    released_at: '2026-04-10',
    min_required_version: '2.1.0',
    force_update: true,
    rollout_percentage: 100,
    store_status: 'deprecated',
    changelog_ar: 'إصدار مرحلي قديم — تم إيقاف دعمه عبر Remote Config.',
    changelog_en: 'Legacy build — completely phased out via Remote Config.',
    features: ['legacy_engine'],
  },
]

const copy = {
  ar: {
    eyebrow: 'إدارة وتوزيع التطبيق',
    title: 'إصدارات التطبيق والتوافق والترقية الإلزامية',
    lede: 'التحكم في الحد الأدنى المطلوب للإصدارات (min_app_version)، الترقية الإلزامية، والتوافق العكسي لمتاجر Apple و Google.',
    currentProd: 'الإصدار المباشر الحالي',
    minRequired: 'الحد الأدنى الإلزامي',
    rolloutStatus: 'معدل التبني والتحديث',
    legacyClients: 'عملاء الإصدارات القديمة',
    newRelease: 'تسجيل إصدار جديد',
    refresh: 'مزامنة مع Remote Config',
    releasesTable: 'سجل الإصدارات المعتمدة',
    colVersion: 'الإصدار / البناء',
    colPlatform: 'المنصة',
    colReleased: 'تاريخ الإطلاق',
    colMinReq: 'الحد الأدنى المطلوب',
    colForce: 'ترقية إجبارية',
    colRollout: 'مرحلة النشر',
    colStatus: 'حالة المتجر',
    colInspect: 'فحص',
    compatMatrixTitle: 'مصفوفة توافق الميزات التقنية',
    compatDesc: 'يوضح هذا الجدول الحد الأدنى المطلوب من التطبيق لكل ميزة في المنصة:',
    inspectorTitle: 'مفتش الإصدار والتوافقية',
    selectToInspect: 'اختر إصداراً لمعاينة التفاصيل وقائمة التغييرات',
    tripleMetersTitle: 'مؤشرات التوزيع وسلامة المتجر',
    meterAdoption: 'نسبة تبني التحديث الجديد',
    meterCompat: 'معدل استقرار التوافق العكسي',
    meterCompliance: 'الامتثال لسياسات المتاجر',
    forceWarning: 'تنبيه الترقية الإلزامية',
    forceWarningDesc: 'رفع الحد الأدنى يجبر الأجهزة الأقدم على التحديث الفوري قبل المتابعة، مما قد يحجب عملاء الإصدارات غير المتوافقة.',
    aiAdvisorTitle: 'توصيات الذكاء الاصطناعي للتوزيع',
    aiAdvisorDesc: 'تبلغ نسبة عملاء 2.4.x أقل من 1.4% من إجمالي الجلسات. يمكنك رفع الحد الأدنى إلى 2.5.0 بأمان لتقليل تكلفة الحفاظ على المعمارية القديمة.',
  },
  en: {
    eyebrow: 'App Distribution & Lifecycle',
    title: 'App Releases, Compatibility & Force Update',
    lede: 'Control minimum supported builds (min_app_version), enforce mandatory upgrades, and monitor store compliance.',
    currentProd: 'Latest Production Release',
    minRequired: 'Minimum Required Build',
    rolloutStatus: 'Adoption & Rollout',
    legacyClients: 'Legacy Client Footprint',
    newRelease: 'Register New Release',
    refresh: 'Sync with Remote Config',
    releasesTable: 'Approved Releases Registry',
    colVersion: 'Version / Build',
    colPlatform: 'Platform',
    colReleased: 'Release Date',
    colMinReq: 'Min Required',
    colForce: 'Force Update',
    colRollout: 'Rollout',
    colStatus: 'Store Status',
    colInspect: 'Inspect',
    compatMatrixTitle: 'Feature Compatibility Matrix',
    compatDesc: 'Demonstrates the minimum build requirement for major platform engines:',
    inspectorTitle: 'Release & Compatibility Inspector',
    selectToInspect: 'Select a release build to examine detailed metrics and changelogs',
    tripleMetersTitle: 'Distribution & Store Health Meters',
    meterAdoption: 'New Version Adoption Velocity',
    meterCompat: 'Backward Compatibility Score',
    meterCompliance: 'App Store Guidelines Compliance',
    forceWarning: 'Mandatory Update Guardrail',
    forceWarningDesc: 'Bumping the minimum supported version forces legacy devices into immediate updates, which may lock out unsupported hardware.',
    aiAdvisorTitle: 'AI Release Governance Advisor',
    aiAdvisorDesc: 'Legacy 2.4.x client base has dropped below 1.4% of active traffic. You can safely enforce 2.5.0 as the global floor next sprint.',
  },
}

export function AppReleasesPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [releases] = useState<AppRelease[]>(INITIAL_RELEASES)
  const [selectedRelease, setSelectedRelease] = useState<AppRelease>(INITIAL_RELEASES[0])

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
              Remote Config Active
            </span>
          </div>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>

        <div className="page-intro__actions">
          <button className="button button--ghost" type="button">
            <Icon name="refresh" size={16} />
            <span>{text.refresh}</span>
          </button>
        </div>
      </section>

      {/* 2. BENTO GLASS METRIC CARDS (4 KPIs) */}
      <section className="hero-kpis" aria-label="App Release KPIs">
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.currentProd}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="devices" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">v2.5.0</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'البناء 250 المعتمد عالمياً' : 'Global production build 250'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.minRequired}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="shield" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">v2.4.0</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'أي إصدار أقدم يواجه شاشة الترقية' : 'Older clients receive force update'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--success">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.rolloutStatus}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">97.8%</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'نسبة المستخدمين على الإصدار الأحدث' : 'Active users on latest release'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.legacyClients}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="clock" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">2.2%</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'أجهزة تحتاج الترقية قريباً' : 'Clients pending update rollout'}</div>
        </div>
      </section>

      {/* 3. ENTERPRISE SPLIT WORKSPACE (68% / 32%) */}
      <div className="exec-split" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left Column (68% Releases Table & Feature Compatibility) */}
        <div className="exec-split__main" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Main Releases Table */}
          <section className="panel panel--table" style={{ borderRadius: 16 }}>
            <div className="panel__header">
              <div>
                <span className="panel__kicker">{text.eyebrow}</span>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>{text.releasesTable}</h3>
              </div>
            </div>

            <div className="table-scroll" tabIndex={0}>
              <table className="data-table data-table--wide">
                <thead>
                  <tr>
                    <th>{text.colVersion}</th>
                    <th>{text.colPlatform}</th>
                    <th>{text.colReleased}</th>
                    <th>{text.colMinReq}</th>
                    <th>{text.colForce}</th>
                    <th>{text.colRollout}</th>
                    <th>{text.colStatus}</th>
                    <th style={{ width: 80 }}>{text.colInspect}</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((rel) => {
                    const isSelected = selectedRelease.id === rel.id
                    return (
                      <tr
                        key={rel.id}
                        style={{
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedRelease(rel)}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
                              v{rel.version}
                            </strong>
                            <small style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'monospace' }}>
                              #{rel.build_number}
                            </small>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: 'rgba(255,255,255,0.06)',
                              textTransform: 'uppercase',
                            }}
                          >
                            {rel.platform}
                          </span>
                        </td>
                        <td>
                          <span className="table-secondary" style={{ fontSize: 12 }}>
                            {rel.released_at}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-soft)' }}>
                            v{rel.min_required_version}
                          </span>
                        </td>
                        <td>
                          {rel.force_update ? (
                            <span style={{ color: '#ef4444', fontWeight: 800, fontSize: 11.5 }}>
                              ⚠️ {locale === 'ar' ? 'إلزامي' : 'Enforced'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                              {locale === 'ar' ? 'اختياري' : 'Optional'}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 50, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <div style={{ width: `${rel.rollout_percentage}%`, height: '100%', background: '#10b981', borderRadius: 999 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700 }}>{rel.rollout_percentage}%</span>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 800,
                              background:
                                rel.store_status === 'live'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                              color: rel.store_status === 'live' ? '#10b981' : '#f87171',
                            }}
                          >
                            {rel.store_status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="button button--ghost button--small"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRelease(rel)
                            }}
                            style={{ padding: '3px 8px', fontSize: 11.5 }}
                          >
                            <Icon name="eye" size={13} />
                            {text.colInspect}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Feature Compatibility Matrix */}
          <section className="panel" style={{ padding: 22, borderRadius: 16 }}>
            <div className="panel__header" style={{ padding: 0, marginBottom: 14 }}>
              <div>
                <span className="panel__kicker">{locale === 'ar' ? 'التوافقية التقنية' : 'Technical Matrix'}</span>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>{text.compatMatrixTitle}</h3>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>{text.compatDesc}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>Creative Studio V2</strong>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>v2.5.0+</span>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
                  {locale === 'ar' ? 'تلوين، ارسم مثلي، تتبع النقاط المدعومة من R2.' : 'R2-backed drawing canvas engines.'}
                </p>
              </div>

              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>Audio Sync V2</strong>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>v2.5.0+</span>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
                  {locale === 'ar' ? 'تزامن الكلمات اللحظي أثناء السرد الصوتي.' : 'Real-time highlight cues for audio narration.'}
                </p>
              </div>

              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>Family Multi-device Sync</strong>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>v2.4.0+</span>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
                  {locale === 'ar' ? 'تزامن حالة الطفل عبر أجهزة متعددة.' : 'Cross-device child profile state sync.'}
                </p>
              </div>

              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>Dynamic Home Modules</strong>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>v2.5.0+</span>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
                  {locale === 'ar' ? 'وحدات مخصصة بحسب مسار الطفل واشتراكه.' : 'Dynamic conditional home blocks.'}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column (32% Release Inspector) */}
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
                <Icon name="devices" size={17} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>v{selectedRelease.version}</h4>
                <small style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                  {locale === 'ar' ? `البناء #${selectedRelease.build_number} · ${selectedRelease.platform}` : `Build #${selectedRelease.build_number} · ${selectedRelease.platform}`}
                </small>
              </div>
            </div>

            {/* Force update warning */}
            {selectedRelease.force_update && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontWeight: 800, fontSize: 12 }}>
                  <Icon name="warning" size={14} />
                  <span>{text.forceWarning}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.45 }}>
                  {text.forceWarningDesc}
                </p>
              </div>
            )}

            {/* Triple Meters */}
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {text.tripleMetersTitle}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterAdoption}</span>
                    <span style={{ color: '#10b981' }}>{selectedRelease.rollout_percentage}%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${selectedRelease.rollout_percentage}%`, height: '100%', borderRadius: 999, background: '#10b981' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterCompat}</span>
                    <span style={{ color: '#818cf8' }}>99.2%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '99.2%', height: '100%', borderRadius: 999, background: '#818cf8' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterCompliance}</span>
                    <span style={{ color: '#38bdf8' }}>100%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 999, background: '#38bdf8' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Changelog Card */}
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                {locale === 'ar' ? 'ملاحظات الإصدار (Changelog)' : 'Release Notes (Changelog)'}
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: 'var(--text-soft)',
                  lineHeight: 1.55,
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {locale === 'ar' ? selectedRelease.changelog_ar : selectedRelease.changelog_en}
              </p>
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