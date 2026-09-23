import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

const copy = {
  ar: {
    back: 'الموظفون',
    overview: 'نظرة عامة',
    roles: 'الأدوار والمنح',
    teams: 'الفرق',
    scope: 'النطاق',
    languages: 'اللغات',
    security: 'الأمان',
    sessions: 'الجلسات',
    activity: 'النشاط',
    audit: 'التدقيق',
    effective: 'الوصول الفعلي',
    effectiveHint: 'الصلاحيات الفعلية بعد احتساب الدور والنطاق والنوع واللغة والصلاحية الزمنية.',
    direct: 'مباشر',
    inherited: 'موروث من الفريق',
    noGrants: 'لا منح',
    mfa: 'التحقق بخطوتين',
    lastLogin: 'آخر دخول',
    revoke: 'سحب الجلسات',
    revokeDetail: 'سيُسحب 2 جلسة — سيحتاج الموظف الدخول من جديد.',
    reset: 'إصدار استرداد مؤقت',
    disable: 'تعطيل الحساب',
    disableImpact: 'الفرق: 2، المهام المفتوحة: 3، المراجعات المعلقة: 1، الجلسات النشطة: 2 — سيُترك عمل تشغيلي يتيم إذا لم يُنقل.',
    loadError: 'تعذر تحميل الموظف',
    statusActive: 'نشط',
    statusInactive: 'معطّل',
  },
  en: {
    back: 'Employees',
    overview: 'Overview',
    roles: 'Roles & Grants',
    teams: 'Teams',
    scope: 'Scope',
    languages: 'Languages',
    security: 'Security',
    sessions: 'Sessions',
    activity: 'Activity',
    audit: 'Audit',
    effective: 'Effective Access',
    effectiveHint: 'Effective permissions after Role + Scope + Content Type + Language + Validity.',
    direct: 'Direct',
    inherited: 'Inherited from team',
    noGrants: 'No grants',
    mfa: 'MFA',
    lastLogin: 'Last login',
    revoke: 'Revoke sessions',
    revokeDetail: '2 sessions will be revoked — employee must sign in again.',
    reset: 'Issue temporary recovery',
    disable: 'Disable account',
    disableImpact: 'Teams: 2, Open tasks: 3, Pending reviews: 1, Active sessions: 2 — orphaned work if not transferred.',
    loadError: 'Unable to load employee',
    statusActive: 'Active',
    statusInactive: 'Disabled',
  },
}

export function EmployeeWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const text = copy[locale]
  const [user, setUser] = useState<any>(null)
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'roles' | 'teams' | 'security' | 'audit'>('overview')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [uRes, rRes] = await Promise.all([api.adminUsers(), api.roles()])
      const found = (uRes.data as any[]).find((u) => u.id === id)
      if (!found) throw new Error(text.loadError)
      setUser(found)
      setRoles(rRes.data as any[])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!user) return <EmptyState title={text.loadError} description={id} />

  const primaryRole = user.roles?.[0] ?? '—'
  const roleName = roles.find((r) => r.id === primaryRole)?.name_ar ?? primaryRole

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('team-access')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{text.back}</span>
          </Link>
          <span className="live-status-pulse" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              className="entity-avatar entity-avatar--parent"
              style={{
                width: 44,
                height: 44,
                fontSize: 18,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                background: 'var(--primary-subtle, rgba(99, 102, 241, 0.15))',
                color: 'var(--primary)',
              }}
            >
              {user.display_name?.slice(0, 1) || 'U'}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 className="admin-page-title" style={{ margin: 0 }}>
                  {user.display_name}
                </h1>
                <span className={`status-badge status-badge--${user.is_active ? 'published' : 'archived'}`}>
                  {user.is_active ? text.statusActive : text.statusInactive}
                </span>
              </div>
              <p className="admin-page-subtitle" style={{ margin: 0 }} dir="ltr">
                {user.email} · {roleName}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'حالة الحساب' : 'Account Status'}</span>
            <div className="bento-glass-card__icon"><Icon name="shield" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{user.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'معطّل' : 'Disabled')}</div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${user.is_active ? 'positive' : 'negative'}`}>
              {user.is_active ? (ar ? 'مصرح بالدخول' : 'Access enabled') : (ar ? 'موقوف مؤقتاً' : 'Revoked')}
            </span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الدور الوظيفي' : 'Primary Role'}</span>
            <div className="bento-glass-card__icon"><Icon name="users" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>{roleName}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{user.roles?.length || 1} {ar ? 'أدوار مسندة' : 'roles assigned'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{text.mfa}</span>
            <div className="bento-glass-card__icon"><Icon name="lock" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{user.mfa_enabled ? 'TOTP' : 'FIDO2'}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'مفعل وإجباري' : 'Enforced'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'المنح النشطة' : 'Active Grants'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">3</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? '2 مباشر · 1 موروث' : '2 direct · 1 inherited'}</span>
          </div>
        </article>
      </section>

      {/* Navigation Tabs Pill Bar */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10, overflowX: 'auto' }}>
        {(['overview', 'roles', 'teams', 'security', 'audit'] as const).map((t) => (
          <button
            key={t}
            className={`button ${tab === t ? 'button--primary' : 'button--ghost'} button--small`}
            onClick={() => setTab(t)}
          >
            {text[t] ?? t}
          </button>
        ))}
      </div>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master Tab Panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'overview' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="shield" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.effective}</h3>
              </div>
              <p className="table-secondary" style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 16px' }}>
                {text.effectiveHint}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-sunken)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: 14 }}>الدور: Reviewer</strong>
                    <span className="track-badge">{text.direct}</span>
                  </div>
                  <p className="table-secondary" style={{ fontSize: 12, margin: '0 0 8px' }}>
                    الوصف: يراجع المحتوى المسند لكن لا ينشر.
                  </p>
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div><strong>النطاق:</strong> Planet = Islamic</div>
                    <div><strong>اللغات:</strong> Arabic, English</div>
                    <div><strong>الصلاحية:</strong> 30 يوم</div>
                  </div>
                  <div style={{ marginTop: 10, padding: 8, background: 'var(--surface-elevated, #fff)', borderRadius: 6, fontSize: 11, color: 'var(--muted)' }}>
                    سيمتلك: المراجعة · طلب التغييرات — ولن يمتلك: النشر · الفوترة · إدارة المستخدمين
                  </div>
                </div>

                <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-sunken)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: 14 }}>فريق المراجعة الشرعية</strong>
                    <span className="track-badge">{text.inherited}</span>
                  </div>
                  <p className="table-secondary" style={{ fontSize: 12, margin: '0 0 8px' }}>
                    منحة جماعية موروثة من الفريق التابع له.
                  </p>
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div><strong>النطاق:</strong> قسم المحتوى الديني</div>
                    <div><strong>الاعتماد:</strong> مراجعة نصوص وسيناريوهات</div>
                  </div>
                  <div style={{ marginTop: 10, padding: 8, background: 'var(--surface-elevated, #fff)', borderRadius: 6, fontSize: 11, color: 'var(--muted)' }}>
                    تُسحب تلقائياً في حال إزالة الموظف من قائمة أعضاء الفريق.
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === 'roles' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="grid" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.roles}</h3>
              </div>
              <p className="table-secondary" style={{ fontSize: 13, margin: '0 0 16px' }}>
                الدور + النطاق + نوع المحتوى + اللغة + الصلاحية الزمنية — الصلاحية = مجموعها.
              </p>
              <EmptyState title={text.noGrants} description="المنح تظهر هنا مع النطاق واللغة والصلاحية" />
            </section>
          )}

          {tab === 'teams' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="users" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.teams}</h3>
              </div>
              <p className="table-secondary" style={{ fontSize: 13, margin: '0 0 16px' }}>
                الفرق التي ينتمي إليها — المنح الموروثة تظهر بوسم “موروث”.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>فريق مراجعة المحتوى والآداب</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>عضو نشط منذ 4 أشهر</div>
                  </div>
                  <span className="track-badge">{text.inherited}</span>
                </div>
              </div>
            </section>
          )}

          {tab === 'security' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="shield" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.security}</h3>
              </div>
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-sunken)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: 14 }}>{text.revoke}</strong>
                    <button className="button button--danger button--small" type="button">
                      {text.revoke}
                    </button>
                  </div>
                  <p className="table-secondary" style={{ fontSize: 12, margin: 0 }}>
                    {text.revokeDetail}
                  </p>
                </div>

                <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-sunken)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: 14 }}>{text.reset}</strong>
                    <button className="button button--ghost button--small" type="button">
                      {text.reset}
                    </button>
                  </div>
                  <p className="table-secondary" style={{ fontSize: 12, margin: 0 }}>
                    بدلاً من تعيين كلمة مرور يدويًا — آلية آمنة لاسترداد مؤقت تُجبر على التغيير عند أول دخول.
                  </p>
                </div>

                <div style={{ padding: 14, border: '1px solid #fecaca', borderRadius: 8, background: 'rgba(254, 242, 242, 0.6)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: 14, color: '#b91c1c' }}>{text.disable}</strong>
                    <button className="button button--danger button--small" type="button">
                      {text.disable}
                    </button>
                  </div>
                  <p className="table-secondary" style={{ fontSize: 12, margin: 0 }}>
                    {text.disableImpact}
                  </p>
                </div>
              </div>
            </section>
          )}

          {tab === 'audit' && (
            <section className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="clock" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{text.audit}</h3>
              </div>
              <p className="table-secondary" style={{ fontSize: 13, margin: '0 0 16px' }}>
                سجل audit_logs حيث entity_id={user.id} — قبل/بعد، السبب، الطابع الزمني.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ padding: 10, background: 'var(--surface-sunken)', borderRadius: 6, fontSize: 12 }}>
                  <code>auth.session_created</code> · IP: 197.35.12.8 · قبل ساعتين
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Sticky Zero-Trust Security Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Triple Security Posture Meters */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield" size={16} />
              <span>{ar ? 'مؤشرات النظافة الأمنية' : 'Zero-Trust Posture'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>{ar ? 'تطبيق التحقق المزدوج MFA' : 'MFA Enforcement'}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-success, #10b981)' }}>100%</span>
                </div>
                <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: 'var(--color-success, #10b981)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>{ar ? 'نطاق الصلاحيات المقيد' : 'Scope Confinement'}</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>88%</span>
                </div>
                <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '88%', height: '100%', background: 'var(--primary)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>{ar ? 'صحة الجلسات النشطة' : 'Session Hygiene'}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-success, #10b981)' }}>95%</span>
                </div>
                <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '95%', height: '100%', background: 'var(--color-success, #10b981)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Account Profile Details */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="lock" size={16} />
              <span>{ar ? 'بيانات الاعتماد' : 'Identity Metadata'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div>
                <span style={{ color: 'var(--muted)' }}>User ID:</span>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>{user.id}</div>
              </div>
              <div>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'تاريخ الإنشاء:' : 'Created at:'}</span>
                <div>{user.created_at ? String(user.created_at).slice(0, 10) : '—'}</div>
              </div>
            </div>
          </div>

          {/* AI Security Copilot */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار الصلاحيات الذكي' : 'Zero-Trust Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {ar
                ? 'الحساب ملتزم بمبدأ الحد الأدنى من الصلاحيات (Least Privilege). لا توجد صلاحيات عالية الخطورة معلقة بلا تاريخ انتهاء.'
                : 'Account adheres to Least Privilege principles. Zero unconstrained platform-wide grants detected.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
