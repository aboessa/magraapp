import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ErrorState, LoadingState } from '../components/PageState'
import { api } from '../lib/api'
import { usePreferences } from '../context/preferences'
import { formatDate } from '../lib/labels'
import type { ParentTicket } from '../types/api'

export function SupportTicketsPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  const [tickets, setTickets] = useState<ParentTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const [meta, setMeta] = useState({ total: 0, open: 0, in_progress: 0, resolved: 0 })

  // Active ticket modal
  const [activeTicket, setActiveTicket] = useState<ParentTicket | null>(null)
  const [replyText, setReplyText] = useState('')
  const [newStatus, setNewStatus] = useState<ParentTicket['status']>('resolved')
  const [updating, setUpdating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.parentTickets()
      if (res.data) {
        setTickets(res.data)
        if (res.meta) setMeta(res.meta)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (ar ? 'تعذر تحميل تذاكر الدعم' : 'Failed to load tickets'))
    } finally {
      setLoading(false)
    }
  }, [ar])

  useEffect(() => {
    void load()
  }, [load])

  const openTicketModal = (ticket: ParentTicket) => {
    setActiveTicket(ticket)
    setReplyText(ticket.reply_note || '')
    setNewStatus(ticket.status)
  }

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTicket) return

    setUpdating(true)
    try {
      await api.updateParentTicket(activeTicket.id, {
        status: newStatus,
        reply_note: replyText,
      })
      setActiveTicket(null)
      void load()
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : (ar ? 'فشل تحديث التذكرة' : 'Failed to update ticket'))
    } finally {
      setUpdating(false)
    }
  }

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus === 'all') return true
    return t.status === filterStatus
  })

  if (loading) return <LoadingState label={ar ? 'جاري تحميل صندوق تذاكر واستفسارات أولياء الأمور...' : 'Loading support tickets...'} />
  if (error && tickets.length === 0) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="admin-page-container space-y-6 pb-12" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>🎫</span>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {ar ? 'مركز تذاكر واستفسارات أولياء الأمور (Parent Helpdesk)' : 'Parent Support Tickets & Helpdesk'}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1" style={{ color: 'var(--text-secondary, #6b7280)', marginTop: '4px' }}>
            {ar
              ? 'متابعة وحل استفسارات الأهل، مشاكل الفوترة، وتصفير الرموز بنقرة واحدة مع توثيق الردود'
              : 'Unified inbox for parent requests, billing inquiries, and one-click resolutions'}
          </p>
        </div>

        <button
          onClick={load}
          style={{
            padding: '10px 16px',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Icon name="refresh" size={16} />
          {ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div
          onClick={() => setFilterStatus('all')}
          style={{ padding: '18px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: filterStatus === 'all' ? '2px solid #3b82f6' : '1px solid #e5e7eb', cursor: 'pointer' }}
        >
          <div style={{ fontSize: '13px', color: '#6b7280' }}>{ar ? 'إجمالي التذاكر' : 'Total Tickets'}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '6px' }}>{meta.total}</div>
        </div>

        <div
          onClick={() => setFilterStatus('open')}
          style={{ padding: '18px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: filterStatus === 'open' ? '2px solid #ef4444' : '1px solid #e5e7eb', cursor: 'pointer' }}
        >
          <div style={{ fontSize: '13px', color: '#dc2626', fontWeight: 'bold' }}>{ar ? 'تذاكر جديدة مفتوحة' : 'Open Tickets'}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626', marginTop: '6px' }}>{meta.open}</div>
        </div>

        <div
          onClick={() => setFilterStatus('in_progress')}
          style={{ padding: '18px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: filterStatus === 'in_progress' ? '2px solid #f59e0b' : '1px solid #e5e7eb', cursor: 'pointer' }}
        >
          <div style={{ fontSize: '13px', color: '#d97706', fontWeight: 'bold' }}>{ar ? 'قيد المتابعة' : 'In Progress'}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#d97706', marginTop: '6px' }}>{meta.in_progress}</div>
        </div>

        <div
          onClick={() => setFilterStatus('resolved')}
          style={{ padding: '18px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: filterStatus === 'resolved' ? '2px solid #10b981' : '1px solid #e5e7eb', cursor: 'pointer' }}
        >
          <div style={{ fontSize: '13px', color: '#059669', fontWeight: 'bold' }}>{ar ? 'تم الحل بنجاح' : 'Resolved'}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#059669', marginTop: '6px' }}>{meta.resolved}</div>
        </div>
      </div>

      {/* Tickets List */}
      <div style={{ padding: '24px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span>📬</span> {ar ? 'قائمة الطلبات والاستفسارات' : 'Tickets Queue'}
        </h2>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: ar ? 'right' : 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontSize: '12px' }}>
                <th style={{ padding: '12px' }}>{ar ? 'الحالة والأولوية' : 'Status / Priority'}</th>
                <th style={{ padding: '12px' }}>{ar ? 'موضوع التذكرة' : 'Subject'}</th>
                <th style={{ padding: '12px' }}>{ar ? 'ولي الأمر' : 'Parent'}</th>
                <th style={{ padding: '12px' }}>{ar ? 'التصنيف' : 'Category'}</th>
                <th style={{ padding: '12px' }}>{ar ? 'تاريخ الورود' : 'Date'}</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>{ar ? 'الإجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          background:
                            ticket.status === 'open'
                              ? '#fee2e2'
                              : ticket.status === 'in_progress'
                              ? '#fef3c7'
                              : '#dcfce7',
                          color:
                            ticket.status === 'open'
                              ? '#dc2626'
                              : ticket.status === 'in_progress'
                              ? '#b45309'
                              : '#15803d',
                        }}
                      >
                        {ticket.status === 'open'
                          ? (ar ? 'جديدة' : 'Open')
                          : ticket.status === 'in_progress'
                          ? (ar ? 'قيد المتابعة' : 'Pending')
                          : (ar ? 'محلولة' : 'Resolved')}
                      </span>
                      {ticket.priority === 'urgent' && (
                        <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold' }}>🔥 {ar ? 'عاجل' : 'Urgent'}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text-primary, #111827)' }}>
                    {ticket.subject}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div>{ticket.parent_name}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{ticket.parent_email}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f3f4f6', fontSize: '12px' }}>
                      {ticket.category === 'billing' ? (ar ? '💳 فوترة' : 'Billing') : ticket.category === 'parental_controls' ? (ar ? '🛡️ تحكم أبوي' : 'Controls') : (ar ? '💡 استفسار' : 'Inquiry')}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#6b7280', fontSize: '12px' }}>
                    {formatDate(ticket.created_at, locale)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => openTicketModal(ticket)}
                      style={{
                        padding: '6px 14px',
                        background: '#3b82f6',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      {ar ? 'معالجة والرد' : 'Handle'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Response Modal */}
      {activeTicket && (
        <Modal
          open={Boolean(activeTicket)}
          title={activeTicket.subject}
          onClose={() => setActiveTicket(null)}
        >
          <form onSubmit={handleUpdateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {ar ? 'من:' : 'From:'} <strong>{activeTicket.parent_name}</strong> ({activeTicket.parent_email})
              </div>
              <div style={{ fontSize: '14px', marginTop: '6px', color: '#1e293b', lineHeight: '1.5' }}>
                {activeTicket.message}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                {ar ? 'حالة التذكرة' : 'Status'}
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ParentTicket['status'])}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
              >
                <option value="open">{ar ? 'مفتوحة (Open)' : 'Open'}</option>
                <option value="in_progress">{ar ? 'قيد المتابعة (In Progress)' : 'In Progress'}</option>
                <option value="resolved">{ar ? 'تم الحل بنجاح (Resolved)' : 'Resolved'}</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                {ar ? 'ملاحظة أو رد المشرف (Agent Resolution Note)' : 'Resolution Note'}
              </label>
              <textarea
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={ar ? 'اكتب تفاصيل الحل أو ما تم اتخاذه من إجراءات...' : 'Write resolution notes...'}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setActiveTicket(null)}
                style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={updating}
                style={{ padding: '8px 20px', background: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {updating ? (ar ? 'جاري الحفظ...' : 'Saving...') : (ar ? 'حفظ التحديث' : 'Save')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
