// @ts-nocheck
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
  },
}

export function EmployeeWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
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

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!user) return <EmptyState title={text.loadError} description={id} />

  const primaryRole = user.roles?.[0] ?? '—'
  const roleName = roles.find((r) => r.id === primaryRole)?.name_ar ?? primaryRole

  return (
    <div className="page-stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to={adminPath('team-access')} className="table-secondary">
          {text.back}
        </Link>
        <Icon name="arrow" size={12} />
        <strong>{user.display_name}</strong>
      </div>

      <section className="page-intro" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span className="entity-avatar entity-avatar--parent" style={{ width: 48, height: 48, fontSize: 20 }}>
            {user.display_name.slice(0, 1)}
          </span>
          <div>
            <h2 style={{ margin: 0 }}>{user.display_name}</h2>
            <p className="table-secondary" dir="ltr">
              {user.email} · {roleName}
            </p>
            <span className={`account-status account-status--${user.is_active ? 'active' : 'archived'}`}>{user.is_active ? 'نشط' : 'معطّل'}</span>
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8, overflowX: 'auto' }}>
        {(['overview', 'roles', 'teams', 'security', 'audit'] as const).map((t) => (
          <button key={t} className={`button ${tab === t ? 'button--primary' : 'button--ghost'} button--small`} onClick={() => setTab(t)}>
            {text[t] ?? t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.effective}</h3>
          <p className="table-secondary" style={{ fontSize: 12 }}>{text.effectiveHint}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
              <strong>الدور: Reviewer</strong>
              <p className="table-secondary" style={{ fontSize: 12 }}>الوصف: يراجع المحتوى المسند لكن لا ينشر.</p>
              <p>النطاق: Planet = Islamic, Languages: Arabic, Validity: 30 يوم</p>
              <p className="table-secondary" style={{ fontSize: 12 }}>سيمتلك: المراجعة · طلب التغييرات — ولن يمتلك: النشر · الفوترة · إدارة المستخدمين</p>
            </div>
            <div>
              <h4>المنح النشطة</h4>
              <p><span className="track-badge">{text.direct}</span> 2 منح مباشرة</p>
              <p><span className="track-badge">{text.inherited}</span> 1 موروثة من فريق المراجعة الشرعية</p>
            </div>
          </div>
        </section>
      )}

      {tab === 'roles' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.roles}</h3>
          <p className="table-secondary">الدور + النطاق + نوع المحتوى + اللغة + الصلاحية الزمنية — الصلاحية = مجموعها.</p>
          <EmptyState title={text.noGrants} description="المنح تظهر هنا مع النطاق واللغة والصلاحية" />
        </section>
      )}

      {tab === 'teams' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.teams}</h3>
          <p className="table-secondary">الفرق التي ينتمي إليها — المنح الموروثة تظهر بوسم “موروث”.</p>
        </section>
      )}

      {tab === 'security' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.security}</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
              <strong>{text.revoke}</strong>
              <p className="table-secondary">{text.revokeDetail}</p>
              <button className="button button--danger button--small" type="button">
                {text.revoke}
              </button>
            </div>
            <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
              <strong>{text.reset}</strong>
              <p className="table-secondary">بدلاً من تعيين كلمة مرور يدويًا — آلية آمنة لاسترداد مؤقت تُجبر على التغيير عند أول دخول.</p>
              <button className="button button--ghost button--small" type="button">
                {text.reset}
              </button>
            </div>
            <div style={{ padding: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2' }}>
              <strong>{text.disable}</strong>
              <p className="table-secondary">{text.disableImpact}</p>
              <button className="button button--danger button--small" type="button">
                {text.disable}
              </button>
            </div>
          </div>
        </section>
      )}

      {tab === 'audit' && (
        <section className="panel" style={{ padding: 16 }}>
          <h3>{text.audit}</h3>
          <p className="table-secondary">سجل audit_logs حيث entity_id={user.id} — قبل/بعد، السبب، الطابع الزمني.</p>
        </section>
      )}
    </div>
  )
}
