import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'

const copy = {
  ar: {
    eyebrow: 'إدارة الالتزامات والخدمة',
    title: 'اتفاقيات مستوى الخدمة (SLA) والتصعيد الذكي',
    lede: 'سياسات موجهة حسب كل مجال تشغيلي — قياس منفصل لوقت أول استجابة ووقت الحل، مع إيقاف مؤقت ذكي عند انتظار رد العميل (waiting_customer).',
    addPolicy: 'سياسة SLA جديدة',
    refresh: 'تحديث البيانات',
    tabPolicies: 'سياسات الـ SLA',
    tabCommand: 'مركز قيادة الـ SLA',
    tabWork: 'طابور المهام النشط',
    domain: 'المجال',
    applies: 'ينطبق على',
    priority: 'الأولوية',
    firstResponse: 'أول استجابة',
    resolution: 'الحل النهائي',
    calendar: 'التقويم',
    escalations: 'قواعد التصعيد',
    status: 'الحالة',
    support: 'خدمة العملاء',
    review: 'مراجعة المحتوى',
    workflow: 'سير العمل',
    queue: 'طوابير الرسائل',
    incident: 'الحوادث',
    breached: 'متجاوز للـ SLA',
    atRisk: 'على وشك التجاوز',
    dueSoon: 'مستحق قريباً',
    paused: 'موقوف مؤقتاً',
    completed: 'مكتمل بنجاح',
    supportHint: 'الدعم الفني: عداد أول رد يتوقف نهائياً عند أول رسالة دعم، وعداد الحل يتوقف مؤقتاً في حالة waiting_customer.',
    queueHint: 'طوابير الرسائل: يُقاس الـ SLA بعمر أقدم رسالة غير معالجة.',
    workflowHint: 'سير العمل: يُقاس زمن كل مرحلة إنتاجية بشكل مستقل.',
    createTitle: 'إنشاء سياسة SLA جديدة',
    nameLabel: 'اسم السياسة',
    domainLabel: 'المجال التشغيلي',
    priorityLabel: 'مستوى الأولوية',
    firstLabel: 'الهدف لأول استجابة (بالدقائق)',
    resolutionLabel: 'الهدف للحل النهائي (بالدقائق)',
    pauseLabel: 'شرط الإيقاف المؤقت (مثال: waiting_customer)',
    save: 'حفظ واعتماد السياسة',
    cancel: 'إلغاء',
    loadError: 'تعذر تحميل سياسات الـ SLA',
    emptyPolicies: 'لا توجد سياسات SLA معرفة',
    systemBeacon: 'محرك تتبع الـ SLA والتصعيد',
    beaconSub: 'تتبع زمني منفصل لأول رد والحل',
  },
  en: {
    eyebrow: 'Service Commitments & Ops',
    title: 'SLA Operations & Intelligent Escalations',
    lede: 'Domain-specific SLA policies — separate dual clocks for first response and resolution, with automated pausing on waiting_customer.',
    addPolicy: 'New SLA Policy',
    refresh: 'Refresh Data',
    tabPolicies: 'SLA Policies',
    tabCommand: 'Command Center',
    tabWork: 'Active Work Items',
    domain: 'Domain',
    applies: 'Applies to',
    priority: 'Priority',
    firstResponse: 'First Response',
    resolution: 'Final Resolution',
    calendar: 'Calendar',
    escalations: 'Escalation Rules',
    status: 'Status',
    support: 'Support',
    review: 'Review',
    workflow: 'Workflow',
    queue: 'Queue',
    incident: 'Incident',
    breached: 'Breached',
    atRisk: 'At Risk',
    dueSoon: 'Due Soon',
    paused: 'Paused',
    completed: 'Completed',
    supportHint: 'Support dual clocks: first_response stops on first agent reply, resolution pauses in waiting_customer.',
    queueHint: 'Queue SLA: calculated based on oldest message age in DLQ/pipeline.',
    workflowHint: 'Workflow SLA: measured per pipeline stage independently.',
    createTitle: 'Create New SLA Policy',
    nameLabel: 'Policy Name',
    domainLabel: 'Operational Domain',
    priorityLabel: 'Priority Level',
    firstLabel: 'First Response Target (min)',
    resolutionLabel: 'Final Resolution Target (min)',
    pauseLabel: 'Pause Condition (e.g. waiting_customer)',
    save: 'Save & Activate Policy',
    cancel: 'Cancel',
    loadError: 'Unable to load SLA policies',
    emptyPolicies: 'No SLA policies found',
    systemBeacon: 'SLA & Escalation Engine',
    beaconSub: 'Dual-clock response & resolution tracker',
  },
}

export function OpsSlaPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [tab, setTab] = useState<'policies' | 'command' | 'work'>('policies')
  const [policies, setPolicies] = useState<any[]>([])
  const [command, setCommand] = useState<any>(null)
  const [work, setWork] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    domain: 'support',
    priority: 'high',
    first_response_minutes: 60,
    resolution_minutes: 1440,
    pause_condition: 'waiting_customer',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [p, c] = await Promise.all([
        api.slaPolicies(),
        api.slaCommandCenter().catch(() => ({ data: { breached: 0, at_risk: 0, due_soon: 0, paused: 0, recently_resolved: 0 } } as any)),
      ])
      setPolicies((p as any).data ?? [])
      setCommand((c as any).data)
      if (tab === 'work') {
        const tickets = (await (api as any).supportTickets?.({ limit: 10 } as any).catch(() => ({ data: [] }))) as any
        setWork(tickets.data ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [tab, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    await api.createSlaPolicy({
      name: form.name,
      domain: form.domain,
      priority: form.priority,
      first_response_minutes: Number(form.first_response_minutes),
      resolution_minutes: Number(form.resolution_minutes),
      pause_condition: form.pause_condition || null,
    })
    setShowCreate(false)
    void load()
  }

  if (loading) return <LoadingState />
  if (error && !policies.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="content-studio-root">
      {/* 1. Master Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className="status-beacon__dot status-beacon__dot--indigo" />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">{text.systemBeacon}</span>
              <span className="status-beacon__sub">{text.beaconSub}</span>
            </div>
          </div>

          <div className="filter-pill-group" style={{ marginInlineStart: 12 }}>
            <button
              className={`filter-pill ${tab === 'policies' ? 'filter-pill--active' : ''}`}
              onClick={() => setTab('policies')}
            >
              <Icon name="objectives" size={13} />
              <span>{text.tabPolicies}</span>
            </button>
            <button
              className={`filter-pill ${tab === 'command' ? 'filter-pill--active' : ''}`}
              onClick={() => setTab('command')}
            >
              <Icon name="check" size={13} />
              <span>{text.tabCommand}</span>
            </button>
            <button
              className={`filter-pill ${tab === 'work' ? 'filter-pill--active' : ''}`}
              onClick={() => setTab('work')}
            >
              <Icon name="chat" size={13} />
              <span>{text.tabWork}</span>
            </button>
          </div>
        </div>

        <div className="commercial-command-strip__right">
          <button className="button button--primary button--small" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={14} />
            <span>{text.addPolicy}</span>
          </button>
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
            <span>{text.refresh}</span>
          </button>
        </div>
      </section>

      {/* 2. Executive Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, rgba(168, 85, 247, 0.16) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#6366f1' }} />
              {policies.length} {locale === 'ar' ? 'سياسات مفعلة' : 'Active Policies'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Bento Live Metrics Matrix */}
      {command && (
        <div className="commercial-bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          <Link
            to={adminPath('support-center')}
            className="commercial-bento-card stat-card commercial-bento-card--rose"
            style={{ textDecoration: 'none' }}
          >
            <div className="commercial-bento-card__header">
              <span className="commercial-bento-card__title">{text.breached}</span>
              <div className="commercial-bento-card__icon">
                <Icon name="warning" size={18} />
              </div>
            </div>
            <div className="commercial-bento-card__metric">{command.breached}</div>
            <div className="commercial-bento-card__footer">
              <span className="commercial-bento-card__trend">
                {locale === 'ar' ? 'تجاوزت مهلة الـ SLA' : 'Breached resolution time'}
              </span>
            </div>
          </Link>

          <div className="commercial-bento-card stat-card commercial-bento-card--amber">
            <div className="commercial-bento-card__header">
              <span className="commercial-bento-card__title">{text.atRisk}</span>
              <div className="commercial-bento-card__icon">
                <Icon name="clock" size={18} />
              </div>
            </div>
            <div className="commercial-bento-card__metric">{command.at_risk}</div>
            <div className="commercial-bento-card__footer">
              <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
                {locale === 'ar' ? 'أقل من 30 دقيقة' : '< 30m remaining'}
              </span>
            </div>
          </div>

          <div className="commercial-bento-card stat-card commercial-bento-card--indigo">
            <div className="commercial-bento-card__header">
              <span className="commercial-bento-card__title">{text.dueSoon}</span>
              <div className="commercial-bento-card__icon">
                <Icon name="calendar" size={18} />
              </div>
            </div>
            <div className="commercial-bento-card__metric">{command.due_soon}</div>
            <div className="commercial-bento-card__footer">
              <span className="commercial-bento-card__trend">
                {locale === 'ar' ? 'مستحق خلال الساعات القادمة' : 'Due next few hours'}
              </span>
            </div>
          </div>

          <div className="commercial-bento-card stat-card commercial-bento-card--purple">
            <div className="commercial-bento-card__header">
              <span className="commercial-bento-card__title">{text.paused}</span>
              <div className="commercial-bento-card__icon">
                <Icon name="objectives" size={18} />
              </div>
            </div>
            <div className="commercial-bento-card__metric">{command.paused}</div>
            <div className="commercial-bento-card__footer">
              <span className="commercial-bento-card__trend">
                waiting_customer
              </span>
            </div>
          </div>

          <div className="commercial-bento-card stat-card commercial-bento-card--emerald">
            <div className="commercial-bento-card__header">
              <span className="commercial-bento-card__title">{text.completed}</span>
              <div className="commercial-bento-card__icon">
                <Icon name="check" size={18} />
              </div>
            </div>
            <div className="commercial-bento-card__metric">{command.recently_resolved}</div>
            <div className="commercial-bento-card__footer">
              <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
                {locale === 'ar' ? 'تم الحل ضمن المهلة' : 'Resolved within SLA'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Tab 1: Domain-Specific Policies */}
      {tab === 'policies' && (
        <section
          className="panel panel--table"
          style={{
            marginTop: 24,
            background: 'var(--surface-1)',
            borderRadius: 16,
            border: '1px solid var(--cs-glass-border)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--cs-glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              {locale === 'ar' ? 'سياسات الـ SLA المعتمدة' : 'Configured SLA Policies'} ({policies.length})
            </h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Domain-specific, not universal</span>
          </div>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.domain}</th>
                  <th>{text.nameLabel}</th>
                  <th>{text.priority}</th>
                  <th>{text.firstResponse}</th>
                  <th>{text.resolution}</th>
                  <th>{text.escalations}</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <span className="track-badge">{p.domain}</span>
                      {p.pause_condition && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                          pause: <code>{p.pause_condition}</code>
                        </div>
                      )}
                    </td>
                    <td>
                      <Link to={adminPath(`ops-sla/policy/${p.id}`)} style={{ textDecoration: 'none', color: 'var(--primary)' }}>
                        <strong>{p.name}</strong>
                      </Link>
                      {p.applies_to && (
                        <small style={{ display: 'block', color: 'var(--muted)' }}>{p.applies_to}</small>
                      )}
                    </td>
                    <td>
                      <span className="counter-badge counter-badge--muted">{p.priority ?? '—'}</span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text)' }}>{p.first_response_minutes ?? '—'}</strong>{' '}
                      <small style={{ color: 'var(--muted)' }}>دقيقة</small>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text)' }}>{p.resolution_minutes ?? '—'}</strong>{' '}
                      <small style={{ color: 'var(--muted)' }}>دقيقة</small>
                    </td>
                    <td>
                      <span className="status-badge status-badge--review">
                        {Array.isArray(p.escalation_rules) ? p.escalation_rules.length : 0} rules
                      </span>
                    </td>
                  </tr>
                ))}
                {!policies.length && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title={text.emptyPolicies} description="Add policy per domain" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--cs-glass-border)',
              background: 'var(--surface-2)',
              fontSize: 12,
              color: 'var(--muted)',
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: '0 0 4px' }}>💡 {text.supportHint}</p>
            <p style={{ margin: '0 0 4px' }}>💡 {text.queueHint}</p>
            <p style={{ margin: 0 }}>💡 {text.workflowHint}</p>
          </div>
        </section>
      )}

      {/* 5. Tab 2: Command Center Summary */}
      {tab === 'command' && (
        <section
          style={{
            marginTop: 24,
            padding: 24,
            borderRadius: 16,
            background: 'var(--surface-1)',
            border: '1px solid var(--cs-glass-border)',
          }}
        >
          <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800 }}>{text.tabCommand}</h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            {text.lede}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link to={adminPath('support-center')} className="button button--primary">
              <Icon name="chat" size={15} />
              <span>{locale === 'ar' ? 'فتح طابور التذاكر المباشر' : 'Open Live Support Queue'}</span>
            </Link>
            <Link to={adminPath('ops')} className="button button--secondary">
              <Icon name="objectives" size={15} />
              <span>{locale === 'ar' ? 'رادار مراقبة العمليات Ops 360' : 'Operations Radar'}</span>
            </Link>
          </div>
        </section>
      )}

      {/* 6. Tab 3: Active Work Items */}
      {tab === 'work' && (
        <section
          className="panel panel--table"
          style={{
            marginTop: 24,
            background: 'var(--surface-1)',
            borderRadius: 16,
            border: '1px solid var(--cs-glass-border)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--cs-glass-border)' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{text.tabWork}</h3>
          </div>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Work</th>
                  <th>Domain</th>
                  <th>Priority</th>
                  <th>First Due</th>
                  <th>Resolution Due</th>
                  <th>SLA state</th>
                  <th>Escalation</th>
                </tr>
              </thead>
              <tbody>
                {work.slice(0, 10).map((w: any) => (
                  <tr key={w.id}>
                    <td>
                      <Link to={adminPath('support-center')} style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {w.reference ?? w.id.slice(0, 6)}
                      </Link>
                    </td>
                    <td>support</td>
                    <td>{w.priority}</td>
                    <td>{String(w.first_response_due_at ?? '').slice(0, 16)}</td>
                    <td>{String(w.resolution_due_at ?? '').slice(0, 16)}</td>
                    <td>
                      <span className={`status-badge ${w.sla?.resolution_breached ? 'status-badge--review' : ''}`}>
                        {w.sla?.resolution_breached ? text.breached : w.sla?.paused ? text.paused : 'on_track'}
                      </span>
                    </td>
                    <td>{w.escalated_at ? 'escalated' : '—'}</td>
                  </tr>
                ))}
                {!work.length && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                      No work — filtered via SLA policies
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 7. New SLA Policy Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={text.createTitle}>
        <div style={{ display: 'grid', gap: 14 }}>
          <label className="field">
            <span>{text.nameLabel}</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field">
            <span>{text.domainLabel}</span>
            <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
              <option value="support">support</option>
              <option value="content_review">content_review</option>
              <option value="workflow">workflow</option>
              <option value="queue">queue</option>
              <option value="incident">incident</option>
            </select>
          </label>
          <label className="field">
            <span>{text.priorityLabel}</span>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="high">high</option>
              <option value="normal">normal</option>
              <option value="low">low</option>
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="field">
              <span>{text.firstLabel}</span>
              <input
                type="number"
                value={form.first_response_minutes}
                onChange={(e) => setForm({ ...form, first_response_minutes: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>{text.resolutionLabel}</span>
              <input
                type="number"
                value={form.resolution_minutes}
                onChange={(e) => setForm({ ...form, resolution_minutes: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="field">
            <span>{text.pauseLabel}</span>
            <input
              value={form.pause_condition}
              onChange={(e) => setForm({ ...form, pause_condition: e.target.value })}
              placeholder="waiting_customer"
            />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="button button--primary" onClick={() => void create()}>
              {text.save}
            </button>
            <button className="button button--ghost" onClick={() => setShowCreate(false)}>
              {text.cancel}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}