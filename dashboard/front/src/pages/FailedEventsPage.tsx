import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { formatDate, formatNumber } from '../lib/labels'
import type { FailedEventStatus, FailedFamilyEventRecord } from '../types/api'

/**
 * أحداث العائلة الفاشلة.
 *
 * ## لماذا هذه الصفحة موجودة
 *
 * `queue/dlq.ts` كان يـ`ack()` كل رسالة فاشلة بعد سطر سجل، والـack يعني للطابور
 * أن الرسالة عُولجت فتُحذف. أي أن حدث عائلة استنفد محاولاته كان يُفقَد نهائيًا،
 * ويبقى إسقاط `family_projection` لتلك العائلة متأخّرًا بلا طريقة لملاحظته.
 *
 * صار يُكتب في `failed_family_events` (المهاجرة 0021)، وبُنيت له ثلاثة مسارات.
 * لكن جدولًا يُقرأ بـcurl فقط لا يختلف عمليًّا عن سطر سجل: هذه الصفحة هي ما
 * يجعل الإصلاح قابلًا للاستخدام.
 *
 * ## قواعد من الخادم تُحترم هنا
 *
 * ١. **الاستبعاد يتطلّب سببًا مكتوبًا.** الخادم يرفض بـ400 بلا `note`، لأن صفًّا
 *    مُستبعَدًا بلا سبب يُعيد المشكلة الأصلية: فقدان المعلومة عن سبب الفقدان.
 *
 * ٢. **النائب لا يُعاد تشغيله.** `payload` قد يكون
 *    `{ error: 'payload_truncated' }` عندما تعذّر حفظ الجسم كاملًا. الخادم يرفض
 *    بـ422، فيُعطَّل الزرّ هنا ويُشرح السبب بدل انتظار الرفض.
 *
 * ٣. **إعادة التشغيل قد تكون «مكرَّرة» ولا تعني فشلًا.** `processFamilyEvent`
 *    يفحص `processed_family_events` أولًا، فحدث نجح لاحقًا بطريق آخر يُعَدّ
 *    مكرَّرًا ويُوسَم `replayed` بلا تطبيق مزدوج.
 */

const copy = {
  ar: {
    eyebrow: 'سلامة البيانات',
    title: 'أحداث العائلة الفاشلة',
    intro: 'أحداث استنفدت محاولاتها وسقطت في طابور الرسائل الميتة. كل صفّ يعني إسقاط عائلة متأخّرًا عن حالتها الحقيقية.',
    refresh: 'تحديث',
    list: 'الأحداث',
    total: 'الإجمالي',
    pendingCount: 'معلَّقة',
    allStatuses: 'كل الحالات',
    parentFilter: 'معرّف ولي الأمر...',
    when: 'وقت الفشل',
    event: 'الحدث',
    family: 'العائلة',
    attempts: 'المحاولات',
    status: 'الحالة',
    resolution: 'المعالجة',
    payload: 'الجسم المحفوظ',
    replay: 'إعادة تشغيل',
    discard: 'استبعاد',
    inspect: 'فحص الجسم',
    loading: 'جارٍ تحميل الأحداث...',
    loadError: 'تعذر تحميل الأحداث الفاشلة',
    empty: 'لا أحداث فاشلة',
    emptyDesc: 'كل أحداث العائلة عُولجت بنجاح. هذه هي الحالة المرجوّة.',
    emptyFiltered: 'لا أحداث مطابقة',
    emptyFilteredDesc: 'غيّر عوامل التصفية لرؤية أحداث بحالة أخرى.',
    unknownEvent: 'حدث مجهول الهوية',
    unknownHint: 'رسالة مشوّهة لا تحمل معرّفًا. تُسجَّل رغم ذلك بدل أن تُفقَد.',
    noParent: 'بلا عائلة معروفة',
    placeholderPayload: 'جسم غير قابل لإعادة التشغيل',
    truncated: 'الجسم حُفظ مقتطعًا لأنه كان أكبر من الحدّ',
    unserializable: 'الجسم لم يكن قابلًا للترميز',
    cannotReplay: 'لا يمكن إعادة التشغيل: الجسم المحفوظ نائبٌ لا حدثٌ. استبعده.',
    discardTitle: 'استبعاد حدث',
    discardLede: 'الاستبعاد نهائي: الحدث لن يُطبَّق على الإسقاط. السبب يُسجَّل مع هويتك.',
    noteField: 'سبب الاستبعاد *',
    notePlaceholder: 'مثال: حدث تجريبي من بيئة التطوير، لا يخصّ عائلة حقيقية.',
    noteRequired: 'السبب مطلوب.',
    cancel: 'إلغاء',
    confirmDiscard: 'استبعاد',
    replaying: 'جارٍ إعادة التشغيل...',
    replayedOk: 'أُعيد تشغيل الحدث بنجاح.',
    replayedDuplicate: 'الحدث كان مُسقَطًا سلفًا، فوُسم كمُعاد تشغيله بلا تطبيق مزدوج.',
    discardedOk: 'استُبعد الحدث.',
    actionError: 'تعذر تنفيذ الإجراء',
    close: 'إغلاق',
    resolvedBy: 'بواسطة',
    more: 'تحميل المزيد',
    showing: (shown: string, total: string) => `يُعرض ${shown} من ${total}`,
    pendingNote: 'الأحداث المعلَّقة تحتاج قرارًا: إعادة تشغيل بعد إصلاح السبب، أو استبعاد بسبب مكتوب.',
  },
  en: {
    eyebrow: 'Data integrity',
    title: 'Failed family events',
    intro: 'Events that exhausted every retry and landed in the dead-letter queue. Each row means one family\u2019s projection is behind its true state.',
    refresh: 'Refresh',
    list: 'Events',
    total: 'Total',
    pendingCount: 'Pending',
    allStatuses: 'All statuses',
    parentFilter: 'Parent id...',
    when: 'Failed at',
    event: 'Event',
    family: 'Family',
    attempts: 'Attempts',
    status: 'Status',
    resolution: 'Resolution',
    payload: 'Stored payload',
    replay: 'Replay',
    discard: 'Discard',
    inspect: 'Inspect payload',
    loading: 'Loading failed events...',
    loadError: 'Unable to load failed events',
    empty: 'No failed events',
    emptyDesc: 'Every family event was processed successfully. This is the desired state.',
    emptyFiltered: 'No matching events',
    emptyFilteredDesc: 'Adjust the filters to see events in another state.',
    unknownEvent: 'Unidentified event',
    unknownHint: 'A malformed message carrying no id. Recorded anyway rather than lost.',
    noParent: 'No known family',
    placeholderPayload: 'Payload is not replayable',
    truncated: 'The payload was stored truncated because it exceeded the size cap',
    unserializable: 'The payload could not be serialized',
    cannotReplay: 'Cannot replay: the stored payload is a placeholder, not an event. Discard it.',
    discardTitle: 'Discard event',
    discardLede: 'Discarding is final: the event will never be applied to the projection. The reason is recorded with your identity.',
    noteField: 'Reason for discarding *',
    notePlaceholder: 'For example: a test event from development, not tied to a real family.',
    noteRequired: 'A reason is required.',
    cancel: 'Cancel',
    confirmDiscard: 'Discard',
    replaying: 'Replaying...',
    replayedOk: 'The event was replayed successfully.',
    replayedDuplicate: 'The event was already projected, so it was marked replayed without applying it twice.',
    discardedOk: 'The event was discarded.',
    actionError: 'Unable to complete the action',
    close: 'Close',
    resolvedBy: 'by',
    more: 'Load more',
    showing: (shown: string, total: string) => `Showing ${shown} of ${total}`,
    pendingNote: 'Pending events need a decision: replay after fixing the cause, or discard with a written reason.',
  },
}

const STATUSES: FailedEventStatus[] = ['pending', 'replayed', 'discarded']

const statusLabels: Record<'ar' | 'en', Record<FailedEventStatus, string>> = {
  ar: { pending: 'معلَّق', replayed: 'أُعيد تشغيله', discarded: 'مُستبعَد' },
  en: { pending: 'Pending', replayed: 'Replayed', discarded: 'Discarded' },
}

/// تعيين الحالة إلى صنف شارة موجود في dashboard.css
const statusBadge: Record<FailedEventStatus, string> = {
  pending: 'status-badge--review',
  replayed: 'status-badge--published',
  discarded: 'status-badge--archived',
}

/**
 * يفحص الجسم المحفوظ: هل هو حدث حقيقي أم نائب حفظٍ؟
 *
 * الخادم يحفظ `{ error: 'payload_truncated' | 'payload_not_serializable' }` عندما
 * تعذّر حفظ الجسم كاملًا، ويرفض إعادة تشغيله بـ422. يُفحص هنا ليُعطَّل الزرّ
 * بسبب معروض بدل نداءٍ يُرفض.
 */
function inspectPayload(raw: string): { replayable: boolean; placeholder?: 'truncated' | 'unserializable' | 'invalid' } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // الخادم يرفض بـ422 عند تعذّر التحليل
    return { replayable: false, placeholder: 'invalid' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { replayable: false, placeholder: 'invalid' }
  }
  const error = (parsed as Record<string, unknown>).error
  if (error === 'payload_truncated') return { replayable: false, placeholder: 'truncated' }
  if (error === 'payload_not_serializable') return { replayable: false, placeholder: 'unserializable' }
  if (typeof error === 'string') return { replayable: false, placeholder: 'invalid' }
  return { replayable: true }
}

/// تنسيق الجسم للعرض. يُترك كما هو عند تعذّر التحليل: النصّ الخام معلومة.
function prettyPayload(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

const PAGE_SIZE = 50

export function FailedEventsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [records, setRecords] = useState<FailedFamilyEventRecord[]>([])
  const [total, setTotal] = useState(0)
  const [pending, setPending] = useState(0)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState<string>('pending')
  const [parentId, setParentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [busyId, setBusyId] = useState<string | null>(null)
  const [inspecting, setInspecting] = useState<FailedFamilyEventRecord | null>(null)
  const [discarding, setDiscarding] = useState<FailedFamilyEventRecord | null>(null)
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')

  const load = useCallback(async (nextOffset: number, append: boolean) => {
    setLoading(true)
    setError('')
    try {
      const response = await api.failedFamilyEvents({
        status,
        parent_id: parentId.trim(),
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      setRecords((current) => append ? [...current, ...response.data] : response.data)
      setTotal(response.meta?.total ?? response.data.length)
      setPending(response.meta?.pending ?? 0)
      setOffset(nextOffset)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [parentId, status, text.loadError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(0, false), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  async function replay(row: FailedFamilyEventRecord) {
    setBusyId(row.id)
    setError('')
    setNotice('')
    try {
      const response = await api.replayFailedFamilyEvent(row.id)
      // «مكرَّر» ليس فشلًا: الحدث كان مُسقَطًا سلفًا فلم يُطبَّق مرتين
      setNotice(response.data.duplicate ? text.replayedDuplicate : text.replayedOk)
      await load(0, false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.actionError)
    } finally {
      setBusyId(null)
    }
  }

  function openDiscard(row: FailedFamilyEventRecord) {
    setDiscarding(row)
    setNote('')
    setFormError('')
  }

  async function confirmDiscard() {
    if (!discarding) return
    const reason = note.trim()
    // نفس شرط الخادم، فيُمنع نداء يُرفض بـ400
    if (!reason) { setFormError(text.noteRequired); return }

    setBusyId(discarding.id)
    setFormError('')
    try {
      await api.discardFailedFamilyEvent(discarding.id, reason)
      setDiscarding(null)
      setNotice(text.discardedOk)
      await load(0, false)
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.actionError)
    } finally {
      setBusyId(null)
    }
  }

  const hasMore = records.length < total
  const filtered = Boolean(status || parentId.trim())

  if (loading && !records.length) return <LoadingState label={text.loading} />
  if (error && !records.length) return <ErrorState message={error} onRetry={() => void load(0, false)} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--secondary" type="button" onClick={() => void load(0, false)}>
            <Icon name="refresh" size={17} />{text.refresh}
          </button>
        </div>
      </section>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}
      {notice && <div className="inline-alert inline-alert--info">{notice}</div>}

      {/* العدد المعلَّق أبرز من الإجمالي: هو وحده ما يحتاج تصرّفًا */}
      {pending > 0 && (
        <section className="panel panel--notice">
          <strong>{text.pendingCount}: {formatNumber(pending, locale)}</strong>
          <p>{text.pendingNote}</p>
        </section>
      )}

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{text.list}</span>
            <h3>{text.total} <span className="title-count">{formatNumber(total, locale)}</span></h3>
          </div>
          <div className="filters-row">
            <label className="search-field">
              <Icon name="search" size={17} />
              <input
                value={parentId}
                dir="ltr"
                onChange={(event) => setParentId(event.target.value)}
                placeholder={text.parentFilter}
              />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{text.allStatuses}</option>
              {STATUSES.map((item) => (
                <option value={item} key={item}>{statusLabels[locale][item]}</option>
              ))}
            </select>
          </div>
        </header>

        {records.length ? (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.when}</th>
                    <th>{text.event}</th>
                    <th>{text.family}</th>
                    <th>{text.attempts}</th>
                    <th>{text.status}</th>
                    <th>{text.resolution}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {records.map((row) => {
                    const payload = inspectPayload(row.payload)
                    const isPending = row.status === 'pending'
                    const busy = busyId === row.id
                    return (
                      <tr key={row.id}>
                        <td><span className="table-secondary">{formatDate(row.failed_at, locale, true)}</span></td>
                        <td>
                          {row.event_type || row.event_id ? (
                            <div>
                              <strong dir="ltr">{row.event_type ?? '—'}</strong>
                              {row.event_id && <small className="table-secondary" dir="ltr">{row.event_id}</small>}
                            </div>
                          ) : (
                            // رسالة مشوّهة بلا هوية: تُعلَن كذلك بدل عرض شُرَط فارغة
                            <span className="table-secondary" title={text.unknownHint}>{text.unknownEvent}</span>
                          )}
                        </td>
                        <td>
                          {row.parent_id
                            ? <span className="table-primary" dir="ltr">{row.parent_id}</span>
                            : <span className="table-secondary">{text.noParent}</span>}
                        </td>
                        <td dir="ltr">{formatNumber(row.attempts, locale)}</td>
                        <td>
                          <span className={`status-badge ${statusBadge[row.status]}`}>
                            {statusLabels[locale][row.status]}
                          </span>
                        </td>
                        <td>
                          {row.resolved_at ? (
                            <div>
                              <small className="table-secondary">{formatDate(row.resolved_at, locale, true)}</small>
                              {row.resolved_by && (
                                <small className="table-secondary" dir="ltr">
                                  {text.resolvedBy} {row.resolved_by}
                                </small>
                              )}
                              {row.resolution_note && (
                                <small className="table-secondary">{row.resolution_note}</small>
                              )}
                            </div>
                          ) : <span className="table-secondary">—</span>}
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="icon-button icon-button--small"
                              type="button"
                              title={text.inspect}
                              onClick={() => setInspecting(row)}
                            >
                              <Icon name="search" size={15} />
                            </button>
                            {isPending && (
                              <>
                                <button
                                  className="icon-button icon-button--small"
                                  type="button"
                                  // النائب يُرفض بـ422 في الخادم، فيُعطَّل بسبب معروض
                                  title={payload.replayable ? text.replay : text.cannotReplay}
                                  disabled={busy || !payload.replayable}
                                  onClick={() => void replay(row)}
                                >
                                  <Icon name="refresh" size={15} />
                                </button>
                                <button
                                  className="icon-button icon-button--small icon-button--danger"
                                  type="button"
                                  title={text.discard}
                                  disabled={busy}
                                  onClick={() => openDiscard(row)}
                                >
                                  <Icon name="archive" size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <footer className="panel__footer">
              <span>{text.showing(formatNumber(records.length, locale), formatNumber(total, locale))}</span>
              {hasMore && (
                <button
                  className="button button--ghost"
                  type="button"
                  disabled={loading}
                  onClick={() => void load(offset + PAGE_SIZE, true)}
                >
                  {text.more}
                </button>
              )}
            </footer>
          </>
        ) : (
          <EmptyState
            title={filtered ? text.emptyFiltered : text.empty}
            description={filtered ? text.emptyFilteredDesc : text.emptyDesc}
          />
        )}
      </section>

      <Modal
        open={Boolean(inspecting)}
        onClose={() => setInspecting(null)}
        title={text.payload}
        description={inspecting?.event_id ?? inspecting?.id}
      >
        {inspecting && (
          <div className="entity-form">
            {(() => {
              const payload = inspectPayload(inspecting.payload)
              if (payload.replayable) return null
              const reason = payload.placeholder === 'truncated'
                ? text.truncated
                : payload.placeholder === 'unserializable'
                  ? text.unserializable
                  : text.placeholderPayload
              return (
                <div className="inline-alert inline-alert--error">
                  <strong>{text.placeholderPayload}</strong> — {reason}
                </div>
              )
            })()}
            <pre className="payload-view" dir="ltr">{prettyPayload(inspecting.payload)}</pre>
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setInspecting(null)}>
                {text.close}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(discarding)}
        onClose={() => !busyId && setDiscarding(null)}
        title={text.discardTitle}
        description={text.discardLede}
      >
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field">
            <span>{text.noteField}</span>
            <textarea
              autoFocus
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={text.notePlaceholder}
            />
          </label>
          <div className="form-actions">
            <button
              className="button button--ghost"
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => setDiscarding(null)}
            >
              {text.cancel}
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => void confirmDiscard()}
            >
              {text.confirmDiscard}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
