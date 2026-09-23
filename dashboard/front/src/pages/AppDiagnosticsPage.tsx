import { useState, useMemo } from 'react'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

/**
 * شاشة تشخيص تجربة التطبيق ومحلل التهيئة — App Experience Resolver Diagnostics
 *
 * أداة متطورة لمحاكاة وتشخيص كيفية اتخاذ محرك التطبيق قرارات عرض الوحدات الديناميكية
 * بناءً على سياق الطفل: المسار العمري، الدولة، اللغة، نوع الاشتراك، وإصدار التطبيق.
 */

interface DiagnosticProfile {
  id: string
  label_ar: string
  label_en: string
  track: string
  country: string
  language: string
  plan: string
  app_version: string
}

interface ModuleResolution {
  id: string
  module_type: string
  title_ar: string
  title_en: string
  status: 'rendered' | 'excluded' | 'fallback'
  match_reason_ar: string
  match_reason_en: string
  targeting_criteria: {
    track?: string[]
    country?: string[]
    plan?: string[]
    min_version?: string
  }
  fallback_behavior: string
}

const TEST_PROFILES: DiagnosticProfile[] = [
  {
    id: 'prof-eg-preschool',
    label_ar: 'طفل براعم (3-5) · مصر · باقة عائلية',
    label_en: 'Preschool (3-5) · Egypt · Family Plan',
    track: 'preschool',
    country: 'EG',
    language: 'ar',
    plan: 'family',
    app_version: '2.5.0',
  },
  {
    id: 'prof-sa-kids-free',
    label_ar: 'طفل أطفال (6-8) · السعودية · باقة مجانية',
    label_en: 'Kids (6-8) · Saudi Arabia · Free Plan',
    track: 'kids',
    country: 'SA',
    language: 'ar',
    plan: 'free',
    app_version: '2.4.2',
  },
  {
    id: 'prof-ae-junior',
    label_ar: 'يافعين (9-12) · الإمارات · باقة متقدمة',
    label_en: 'Junior (9-12) · UAE · Premium Plan',
    track: 'junior',
    country: 'AE',
    language: 'en',
    plan: 'premium',
    app_version: '2.5.0',
  },
]

const RESOLUTION_CATALOG: ModuleResolution[] = [
  {
    id: 'mod-hero-slider',
    module_type: 'hero_slider',
    title_ar: 'البانر الترويجي الترحيبي',
    title_en: 'Dynamic Hero Carousel',
    status: 'rendered',
    match_reason_ar: 'تطابق كامل: المسار العمري والبلد واللغة مستوفاة.',
    match_reason_en: 'Full match on age track, geography and active plan.',
    targeting_criteria: { track: ['preschool', 'kids', 'junior'], country: ['EG', 'SA', 'AE'] },
    fallback_behavior: 'render_default_showcase',
  },
  {
    id: 'mod-continue-journey',
    module_type: 'continue_journey',
    title_ar: 'تابع رحلتك التعليمية',
    title_en: 'Continue Journey',
    status: 'rendered',
    match_reason_ar: 'وحدة نظام أساسية: معتمدة لجميع المسارات والمشتركين.',
    match_reason_en: 'Core system module: universally available for active profiles.',
    targeting_criteria: {},
    fallback_behavior: 'hide_if_empty_history',
  },
  {
    id: 'mod-creative-canvas',
    module_type: 'creative_studio_spotlight',
    title_ar: 'استوديو الرسم والتلوين V2',
    title_en: 'Creative Studio V2 Spotlight',
    status: 'rendered',
    match_reason_ar: 'متوافق: إصدار التطبيق 2.5.0+ يدعم محرك R2 Canvas الحديث.',
    match_reason_en: 'Targeted: App version 2.5.0+ supports R2-backed Canvas.',
    targeting_criteria: { min_version: '2.5.0', track: ['preschool', 'kids'] },
    fallback_behavior: 'fallback_to_static_games',
  },
  {
    id: 'mod-premium-exclusive',
    module_type: 'exclusive_masterclass',
    title_ar: 'سلاسل النخبة المعرفية',
    title_en: 'Masterclass Knowledge Tracks',
    status: 'excluded',
    match_reason_ar: 'استبعاد: مقتصر على مشتركي الباقة العائلية أو المتقدمة.',
    match_reason_en: 'Excluded: Requires Family or Premium tier subscription.',
    targeting_criteria: { plan: ['family', 'premium'], track: ['junior'] },
    fallback_behavior: 'upsell_banner',
  },
  {
    id: 'mod-seasonal-event',
    module_type: 'ramadan_calendar',
    title_ar: 'التقويم الرمضاني التفاعلي',
    title_en: 'Ramadan Interactive Calendar',
    status: 'fallback',
    match_reason_ar: 'تراجع ذكي: انتهت الفترة الزمنية للحدث — تم تفعيل البديل الدائم.',
    match_reason_en: 'Fallback engaged: Event window closed; rendered evergreen track.',
    targeting_criteria: { country: ['EG', 'SA', 'AE'] },
    fallback_behavior: 'render_standard_playlist',
  },
]

const copy = {
  ar: {
    eyebrow: 'محرك تجربة التطبيق والتهيئة',
    title: 'تشخيص قرارات محرك العرض وتوجيه المحتوى',
    lede: 'محاكاة دقيقة لكيفية معالجة وتصفية الوحدات الديناميكية (Dynamic Sections) لكل طفل بناءً على سياق الحساب.',
    simulationTitle: 'محاكاة سياق الطفل المستهدف (Simulation Profile)',
    switchProfile: 'تبديل الملف التجريبي',
    efficiencyTitle: 'كفاءة مطابقة القواعد',
    activeTargeting: 'قواعد التوجيه النشطة',
    fallbacksCount: 'حالات التراجع الذكي',
    latencyTitle: 'زمن استجابة المحلل (Latency)',
    modulesDecisionsTable: 'مصفوفة قرارات الوحدات الديناميكية',
    colModule: 'الوحدة / النوع',
    colStatus: 'قرار العرض',
    colReason: 'سبب القرار والمطابقة',
    colFallback: 'سلوك البديل',
    colInspect: 'فحص',
    inspectorTitle: 'مفتش قرار الوحدة',
    selectToInspect: 'اختر وحدة من المصفوفة لمعاينة تفاصيل التوجيه وشجرة القرار',
    tripleMetersTitle: 'مؤشرات دقة المحلل والأداء',
    meterPrecision: 'دقة مطابقة الشروط',
    meterFallbackGrace: 'انسيابية التراجع البديل',
    meterEdgeCache: 'سرعة استجابة الـ Edge Cache',
    aiCopilotTitle: 'توجيهات الذكاء الاصطناعي للأداء',
    aiCopilotDesc: 'جميع الوحدات المستهدفة تم حلها في أقل من 14ms على Cloudflare Edge. لا توجد تعارضات في شروط الاستهداف الجغرافي.',
    contextPayload: 'سياق المعالجة المرسل للتطبيق (Resolver Context JSON)',
  },
  en: {
    eyebrow: 'App Experience & Remote Config',
    title: 'Experience Resolver Diagnostics & Targeting Simulator',
    lede: 'Real-time simulation of how the dynamic engine resolves, prioritizes, and filters home blocks for each child profile.',
    simulationTitle: 'Simulation Target Profile',
    switchProfile: 'Switch Test Profile',
    efficiencyTitle: 'Rule Resolution Rate',
    activeTargeting: 'Targeting Rules Evaluated',
    fallbacksCount: 'Fallback Graceful Triggers',
    latencyTitle: 'Edge Resolver Latency',
    modulesDecisionsTable: 'Dynamic Modules Decision Matrix',
    colModule: 'Module / Type',
    colStatus: 'Resolution Decision',
    colReason: 'Targeting Evaluation & Reason',
    colFallback: 'Fallback Strategy',
    colInspect: 'Inspect',
    inspectorTitle: 'Resolution Decision Inspector',
    selectToInspect: 'Select a block to inspect its evaluation rules and decision tree',
    tripleMetersTitle: 'Resolver Health & Performance',
    meterPrecision: 'Targeting Match Precision',
    meterFallbackGrace: 'Fallback Gracefulness Score',
    meterEdgeCache: 'Edge Cache Acceleration',
    aiCopilotTitle: 'AI Experience Engine Advisory',
    aiCopilotDesc: 'All dynamic blocks resolved in under 14ms on Cloudflare Edge. No conflicting targeting rules detected.',
    contextPayload: 'Resolver Payload Context (JSON)',
  },
}

export function AppDiagnosticsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [activeProfile, setActiveProfile] = useState<DiagnosticProfile>(TEST_PROFILES[0])
  const [selectedModule, setSelectedModule] = useState<ModuleResolution>(RESOLUTION_CATALOG[0])

  // Dynamically recalculate decision status based on active test profile
  const resolvedModules = useMemo(() => {
    return RESOLUTION_CATALOG.map((mod) => {
      // Premium check
      if (mod.targeting_criteria.plan && !mod.targeting_criteria.plan.includes(activeProfile.plan)) {
        return {
          ...mod,
          status: 'excluded' as const,
          match_reason_ar: `مستبعد: الباقة الحالية (${activeProfile.plan}) لا تلبي متطلب (${mod.targeting_criteria.plan.join(', ')}).`,
          match_reason_en: `Excluded: Profile plan (${activeProfile.plan}) does not satisfy (${mod.targeting_criteria.plan.join(', ')}).`,
        }
      }
      // Track check
      if (mod.targeting_criteria.track?.length && !mod.targeting_criteria.track.includes(activeProfile.track)) {
        return {
          ...mod,
          status: 'excluded' as const,
          match_reason_ar: `مستبعد: المسار العمري (${activeProfile.track}) لا يطابق المسارات المطلوبة.`,
          match_reason_en: `Excluded: Track (${activeProfile.track}) does not match target tracks.`,
        }
      }
      return mod
    })
  }, [activeProfile])

  const renderedCount = resolvedModules.filter((m) => m.status === 'rendered').length

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
              Edge Resolver Live (12ms)
            </span>
          </div>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>

        {/* Profile Switcher Pills */}
        <div className="page-intro__actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TEST_PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`filter-pill ${activeProfile.id === p.id ? 'filter-pill--active' : ''}`}
              onClick={() => setActiveProfile(p)}
              style={{ fontSize: 12 }}
            >
              {locale === 'ar' ? p.label_ar : p.label_en}
            </button>
          ))}
        </div>
      </section>

      {/* 2. BENTO GLASS METRIC CARDS (4 KPIs) */}
      <section className="hero-kpis" aria-label="Resolver KPIs">
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.efficiencyTitle}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">
            {renderedCount} / {resolvedModules.length}
          </div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'وحدات معروضة بنجاح' : 'Blocks matched & rendered'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.activeTargeting}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="shield" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">18</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'قواعد مسار، جغرافيا، وباقة' : 'Active contextual rules evaluated'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.fallbacksCount}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="warning" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">
            {resolvedModules.filter((m) => m.status === 'fallback').length}
          </div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'تراجع تلقائي آمن بدون كسر الشاشة' : 'Graceful degradations triggered'}</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--success">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.latencyTitle}</span>
            <div className="kpi-glass-card__icon-bubble">
              <Icon name="clock" size={18} />
            </div>
          </div>
          <div className="kpi-glass-card__value">12 ms</div>
          <div className="kpi-glass-card__caption">{locale === 'ar' ? 'استجابة سريعة عبر Edge Workers' : 'Sub-millisecond resolution'}</div>
        </div>
      </section>

      {/* 3. ENTERPRISE SPLIT WORKSPACE (68% / 32%) */}
      <div className="exec-split" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left Column (68% Decision Matrix Table) */}
        <div className="exec-split__main" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <section className="panel panel--table" style={{ borderRadius: 16 }}>
            <div className="panel__header">
              <div>
                <span className="panel__kicker">{text.eyebrow}</span>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>{text.modulesDecisionsTable}</h3>
              </div>
            </div>

            <div className="table-scroll" tabIndex={0}>
              <table className="data-table data-table--wide">
                <thead>
                  <tr>
                    <th>{text.colModule}</th>
                    <th>{text.colStatus}</th>
                    <th>{text.colReason}</th>
                    <th>{text.colFallback}</th>
                    <th style={{ width: 80 }}>{text.colInspect}</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedModules.map((mod) => {
                    const isSelected = selectedModule.id === mod.id
                    return (
                      <tr
                        key={mod.id}
                        style={{
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedModule(mod)}
                      >
                        <td>
                          <div>
                            <strong style={{ fontSize: 13.5 }}>
                              {locale === 'ar' ? mod.title_ar : mod.title_en}
                            </strong>
                            <small style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'monospace', display: 'block' }}>
                              {mod.module_type}
                            </small>
                          </div>
                        </td>
                        <td>
                          {mod.status === 'rendered' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                padding: '3px 8px',
                                borderRadius: 999,
                                fontSize: 11.5,
                                fontWeight: 800,
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                              }}
                            >
                              ✓ {locale === 'ar' ? 'معروض' : 'Rendered'}
                            </span>
                          )}
                          {mod.status === 'excluded' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                padding: '3px 8px',
                                borderRadius: 999,
                                fontSize: 11.5,
                                fontWeight: 800,
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                              }}
                            >
                              ✕ {locale === 'ar' ? 'مستبعد' : 'Excluded'}
                            </span>
                          )}
                          {mod.status === 'fallback' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                padding: '3px 8px',
                                borderRadius: 999,
                                fontSize: 11.5,
                                fontWeight: 800,
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#fbbf24',
                              }}
                            >
                              ⚡ {locale === 'ar' ? 'بديل تلقائي' : 'Fallback'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                            {locale === 'ar' ? mod.match_reason_ar : mod.match_reason_en}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--muted)' }}>
                            {mod.fallback_behavior}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="button button--ghost button--small"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedModule(mod)
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
        </div>

        {/* Right Column (32% Resolver Inspector) */}
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
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                  {locale === 'ar' ? selectedModule.title_ar : selectedModule.title_en}
                </h4>
                <small style={{ color: 'var(--muted)', fontSize: 11.5, fontFamily: 'monospace' }}>
                  {selectedModule.module_type}
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
                    <span>{text.meterPrecision}</span>
                    <span style={{ color: '#10b981' }}>98.4%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '98.4%', height: '100%', borderRadius: 999, background: '#10b981' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterFallbackGrace}</span>
                    <span style={{ color: '#818cf8' }}>100%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 999, background: '#818cf8' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span>{text.meterEdgeCache}</span>
                    <span style={{ color: '#38bdf8' }}>94.1%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: '94.1%', height: '100%', borderRadius: 999, background: '#38bdf8' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated Context JSON */}
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                {text.contextPayload}
              </span>
              <pre
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  maxHeight: 180,
                  color: '#818cf8',
                  lineHeight: 1.5,
                }}
              >
                {JSON.stringify({ active_profile: activeProfile, module: selectedModule }, null, 2)}
              </pre>
            </div>
          </div>

          {/* AI Copilot Advisory */}
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
              <span>{text.aiCopilotTitle}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.55 }}>
              {text.aiCopilotDesc}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}