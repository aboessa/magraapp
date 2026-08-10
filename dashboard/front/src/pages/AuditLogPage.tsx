import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useUrlListState } from '../hooks/useUrlListState'
import { formatDate, formatNumber } from '../lib/labels'
import type { AuditRecord } from '../types/api'

/**
 * سجل التدقيق.
 *
 * ## لماذا كانت هذه الصفحة غائبة
 *
 * `audit_logs` يُكتب فيه من كل وحدة إدارة — المحتوى والأصول والصلاحيات ووضع
 * الموقع والأجهزة — و`view_audit_log` صلاحية مستقلة في المهاجرة 0014. لكن
 * `GET /admin/audit-logs` لم يكن له أي مستدعٍ في الواجهة.
 *
 * النتيجة: سجل يُكتب ولا يُقرأ. سؤال «من غيّر هذا ومتى» كان بلا جواب عمليّ رغم
 * أن الجواب مخزَّن.
 *
 * ## `details` نصّ لا كائن
 *
 * العمود `TEXT NOT NULL DEFAULT '{}'`، ويُبنى في `lib/auditLog.ts` عبر
 * `redactForAudit` الذي يحجب الرموز وكلمات المرور وبيانات الأطفال. فما يظهر هنا
 * مُنقّى سلفًا من الخادم — لكن يبقى نصًّا يجب فكّ تحليله بحذر: قيمة واحدة فاسدة
 * لا يجوز أن تُسقط الصفحة.
 */

const copy = {
  ar: {
    eyebrow: 'المساءلة',
    title: 'سجل التدقيق',
    intro: 'من فعل ماذا ومتى. يُكتب تلقائيًا من كل وحدة إدارة، ولا يمكن تعديله من اللوحة.',
    refresh: 'تحديث',
    list: 'السجلات',
    total: 'الإجمالي',
    allActions: 'كل الأفعال',
    allEntities: 'كل الأنواع',
    actorFilter: 'معرّف الفاعل...',
    fromDate: 'من تاريخ',
    toDate: 'إلى تاريخ',
    invalidRange: 'تاريخ البداية يجب ألا يكون بعد تاريخ النهاية.',
    when: 'التاريخ',
    actor: 'الفاعل',
    action: 'الفعل',
    entity: 'المورد',
    details: 'التفاصيل',
    loading: 'جارٍ تحميل السجل...',
    loadError: 'تعذر تحميل سجل التدقيق',
    empty: 'لا سجلات مطابقة',
    emptyDesc: 'يُكتب السجل عند أي تعديل. غيّر عوامل التصفية أو نفّذ عملية لتظهر هنا.',
    systemActor: 'مفتاح مشترك',
    systemActorHint: 'عملية نُفِّذت بالمفتاح المشترك قبل بذر أول مستخدم، فلا هوية لها.',
    noDetails: 'لا تفاصيل',
    redacted: 'محجوب',
    redactedHint: 'الرموز وكلمات المرور وبيانات الأطفال تُحجب في الخادم قبل الكتابة.',
  },
  en: {
    eyebrow: 'Accountability',
    title: 'Audit log',
    intro: 'Who did what and when. Written automatically by every admin module and not editable from the dashboard.',
    refresh: 'Refresh',
    list: 'Entries',
    total: 'Total',
    allActions: 'All actions',
    allEntities: 'All types',
    actorFilter: 'Actor id...',
    fromDate: 'From date',
    toDate: 'To date',
    invalidRange: 'The start date must not be after the end date.',
    when: 'When',
    actor: 'Actor',
    action: 'Action',
    entity: 'Resource',
    details: 'Details',
    loading: 'Loading the audit log...',
    loadError: 'Unable to load the audit log',
    empty: 'No matching entries',
    emptyDesc: 'An entry is written on every change. Adjust the filters, or perform an action to see it here.',
    systemActor: 'Shared key',
    systemActorHint: 'An action performed with the shared key before the first user was seeded, so it carries no identity.',
    noDetails: 'No details',
    redacted: 'Redacted',
    redactedHint: 'Tokens, passwords and child data are redacted on the server before writing.',
  },
}

/// الأفعال المعروفة في الكود. تُستخدم للتصفية فقط، والعمود نصّ حرّ بلا CHECK
/// فقد يحمل فعلًا لا يظهر في هذه القائمة — ولذلك تبقى «كل الأفعال» هي الافتراض.
const KNOWN_ACTIONS = ['create', 'update', 'delete', 'archive', 'rederive_tracks'] as const

const actionLabels: Record<'ar' | 'en', Record<string, string>> = {
  ar: {
    create: 'إنشاء',
    update: 'تعديل',
    delete: 'حذف',
    archive: 'أرشفة',
    rederive_tracks: 'إعادة اشتقاق المسارات',
  },
  en: {
    create: 'Create',
    update: 'Update',
    delete: 'Delete',
    archive: 'Archive',
    rederive_tracks: 'Re-derive tracks',
  },
}

/// تعيين الفعل إلى صنف شارة موجود في dashboard.css
const actionBadge: Record<string, string> = {
  create: 'status-badge--published',
  update: 'status-badge--review',
  delete: 'status-badge--archived',
  archive: 'status-badge--archived',
}

/// هويات لا تمثّل مستخدمًا حقيقيًا. مطابقة لـNON_IDENTITIES في
/// lib/separationOfDuties.ts، فالمعنى واحد على الطرفين.
const NON_IDENTITIES = ['admin-api-key', 'legacy-admin-key', 'admin']

/**
 * يحوّل `details` من نصّ إلى أزواج مقروءة.
 *
 * لا يُعرض JSON خامًا: المسؤول يقرأ «ما تغيّر» لا بنية تخزين. والفشل في التحليل
 * يُعاد كسطر واحد بالنصّ كما هو بدل إسقاط الصف — الصفّ نفسه معلومة تدقيقية
 * حتى لو تعذّر فهم تفاصيله.
 */
function readDetails(raw: string): { key: string; value: string }[] | { raw: string } {
  if (!raw || raw === '{}') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { raw }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { raw }

  return Object.entries(parsed as Record<string, unknown>)
    // claimed_actor يُسجَّل ليُراجَع لا ليُثق به، وعرضه بجانب الفاعل الحقيقي
    // يوحي بأنهما نِدّان. يُخفى ما لم يخالف الفاعل المُصادَق.
    .filter(([key]) => key !== 'claimed_actor')
    .map(([key, value]) => ({
      key,
      value: typeof value === 'string'
        ? value
        : value === null || value === undefined
          ? '—'
          : JSON.stringify(value),
    }))
}

const LIMIT = 50

/// مفاتيح الفلاتر هي أسماء معاملات `GET /admin/audit-logs` بالحرف: `actor_id`،
/// `entity_type`، `action`، `from`، `to` (مع `entity_id` و`limit` و`offset`) كما
/// في `api/src/routes/adminTeams.ts`. لا `q` هنا: المسار لا يقبل بحثًا نصيًّا
/// حرًّا، وحقل البحث المعروض هو `actor_id` نفسه لا اسم آخر يُترجَم في الطريق.
const DEFAULT_FILTERS = { actor_id: '', action: '', entity_type: '', from: '', to: '' }

const FILTER_FIELDS = (
  text: (typeof copy)['ar'],
  locale: 'ar' | 'en',
  entityTypes: string[],
): FilterField[] => [
  {
    key: 'actor_id',
    label: text.actor,
    type: 'text',
    chip: (value) => `${text.actor}: ${value}`,
  },
  {
    key: 'action',
    label: text.action,
    type: 'select',
    options: [
      { value: '', label: text.allActions },
      ...KNOWN_ACTIONS.map((item) => ({ value: item, label: actionLabels[locale][item] ?? item })),
    ],
  },
  {
    key: 'entity_type',
    label: text.entity,
    type: 'select',
    options: [{ value: '', label: text.allEntities }, ...entityTypes.map((item) => ({ value: item, label: item }))],
  },
  { key: 'from', label: text.fromDate, type: 'date', chip: (value) => `${text.fromDate}: ${value}` },
  { key: 'to', label: text.toDate, type: 'date', chip: (value) => `${text.toDate}: ${value}` },
]

export function AuditLogPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()

  // حالة القائمة في العنوان: «من غيّر هذا» سؤال يُحوَّل إلى تذكرة، والتذكرة
  // تحتاج رابطًا يفتح نفس التصفية لا وصفًا لخطوات النقر.
  const list = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT })
  const { filters, offset, limit } = list
  const { actor_id: actor, action, entity_type: entityType, from: fromDate, to: toDate } = filters
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // مدى معكوس يُعرض محليًا فورًا بدل انتظار رفض الخادم بـ400، فلا يبدو النداء
  // معطوبًا بلا سبب واضح.
  const rangeInvalid = Boolean(fromDate && toDate && fromDate > toDate)

  /// الترقيم صفحة صفحة لا «تحميل المزيد»: بعد أن صار `offset` في العنوان، الرابط
  /// يصف موقعًا في السجل. الإضافة التراكمية كانت ستجعل `?offset=100` يعني عند
  /// المشاركة شيئًا آخر عمّا رآه صاحب الرابط.
  const load = useCallback(async () => {
    if (rangeInvalid) return
    setLoading(true)
    setError('')
    try {
      const response = await api.auditLogs({
        action,
        entity_type: entityType,
        actor_id: actor.trim(),
        from: fromDate,
        to: toDate,
        limit,
        offset,
      })
      setRecords(response.data)
      setTotal(response.meta?.total ?? response.data.length)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [action, actor, entityType, fromDate, toDate, limit, offset, rangeInvalid, text.loadError])

  // تأخير بسيط: حقل الفاعل نصّ حرّ فلا يُنادى الخادم على كل حرف
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  /// أنواع الموارد المعروضة مبنية من الصفوف المحمَّلة لا من قائمة مكتوبة:
  /// `entity_type` نصّ حرّ في الخادم وأي وحدة جديدة تكتب نوعها الخاص.
  const entityTypes = useMemo(
    () => [...new Set(records.map((row) => row.entity_type).filter(Boolean))].sort(),
    [records],
  )

  if (loading && !records.length) return <LoadingState label={text.loading} />
  if (error && !records.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--secondary" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={17} />{text.refresh}
          </button>
        </div>
      </section>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <span className="panel__kicker">{text.list}</span>
            <h3>{text.total} <span className="title-count">{formatNumber(total, locale)}</span></h3>
          </div>
          <ListToolbar
            searchValue={actor}
            onSearchChange={(value) => list.setFilter('actor_id', value)}
            searchPlaceholder={text.actorFilter}
            fields={FILTER_FIELDS(text, locale, entityTypes)}
            values={filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => list.setFilters(next)}
            onClear={list.clearFilters}
            onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')}
            trailing={
              <SavedViewsMenu
                storageKey="audit-logs"
                currentSearch={list.search}
                onApply={(search) => navigate(`${adminPath('audit-logs')}${search}`)}
              />
            }
          />
        </header>

        {rangeInvalid && <div className="inline-alert inline-alert--error">{text.invalidRange}</div>}

        {records.length ? (
          <>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.when}</th>
                    <th>{text.actor}</th>
                    <th>{text.action}</th>
                    <th>{text.entity}</th>
                    <th>{text.details}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((row) => {
                    const details = readDetails(row.details)
                    const isSystem = !row.actor_id || NON_IDENTITIES.includes(row.actor_id)
                    return (
                      <tr key={row.id}>
                        <td><span className="table-secondary">{formatDate(row.created_at, locale, true)}</span></td>
                        <td>
                          {isSystem ? (
                            // المفتاح المشترك ليس شخصًا: يُعلَن كذلك بدل عرض نصّ
                            // يبدو كمعرّف مستخدم
                            <span className="table-secondary" title={text.systemActorHint}>
                              {text.systemActor}
                            </span>
                          ) : (
                            <span className="table-primary" dir="ltr">{row.actor_id}</span>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${actionBadge[row.action] ?? 'status-badge--draft'}`}>
                            {actionLabels[locale][row.action] ?? row.action}
                          </span>
                        </td>
                        <td>
                          <div>
                            <strong>{row.entity_type}</strong>
                            {row.entity_id && <small className="table-secondary" dir="ltr">{row.entity_id}</small>}
                          </div>
                        </td>
                        <td>
                          {Array.isArray(details) ? (
                            details.length ? (
                              <dl className="audit-details">
                                {details.map((entry) => (
                                  <div key={entry.key}>
                                    <dt dir="ltr">{entry.key}</dt>
                                    <dd
                                      dir="auto"
                                      title={entry.value === '[redacted]' ? text.redactedHint : undefined}
                                    >
                                      {entry.value === '[redacted]' ? text.redacted : entry.value}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            ) : <span className="table-secondary">{text.noDetails}</span>
                          ) : (
                            // تفاصيل تعذّر تحليلها: تُعرض كما هي، فالصفّ معلومة
                            // تدقيقية حتى بلا فهم تفاصيله
                            <code className="audit-details__raw" dir="ltr">{details.raw}</code>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </>
        ) : <EmptyState title={text.empty} description={text.emptyDesc} />}
      </section>
    </div>
  )
}