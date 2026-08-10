import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ChildRecord } from '../types/api'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { TrackBadge } from '../components/StatusBadge'
import { accountStatusLabels, formatNumber, trackLabels } from '../lib/labels'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'

const months: Record<Locale, string[]> = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

/**
 * ملفات الأطفال — سجل إداري للقراءة فقط.
 *
 * ## لماذا لا يوجد إنشاء أو تعديل أو أرشفة من هذه الصفحة
 *
 * كانت الصفحة تعرض نموذج إنشاء/تعديل كاملًا وزرّ أرشفة/تفعيل يبدوان فعّالين،
 * ويستدعيان `api.createChild`/`api.updateChild` فعليًا. لكن الخادم
 * (`adminFamilyProjection.ts`) يرفض `POST /admin/children` و`PATCH
 * /admin/children/:id` و`DELETE /admin/children/:id` **دائمًا** بـ405:
 *
 *   Family administration is read-only; mutate family state through
 *   authenticated Family APIs
 *
 * `child_projection` إسقاطٌ من أحداث العائلة، لا مصدر الحقيقة: `FamilyState`
 * وحده يملك ملفات الأطفال والمسار العمري المشتق منها. أي كتابة من هنا كانت
 * ستُخالف نفس القاعدة التي تحترمها `ParentsPage` و`DevicesAdminPage` بالفعل:
 * لا كتابة مزدوجة على حالة تملكها FamilyState.
 *
 * النتيجة العملية قبل هذا الإصلاح: كل نقرة "حفظ" أو "أرشفة" كانت تفشل 100%
 * من الوقت، والمستخدم يرى رسالة خطأ عامة بلا أي تفسير لسبب الفشل البنيوي.
 * الآن — بدل زرّ يَعِد بعملية لا تعمل — تُعرض القائمة للقراءة فقط مع توضيح
 * صريح، بنفس نمط `DevicesAdminPage`.
 */

const copy = {
  ar: {
    loadError: 'تعذر تحميل ملفات الأطفال',
    independent: 'ملفات مستقلة', title: 'ملفات الأطفال', intro: 'سجل إداري للقراءة فقط، مبنيّ من إسقاط أحداث العائلة. يحدد الخادم المسار من شهر وسنة الميلاد، وتبقى بيانات كل طفل معزولة.',
    familyProfiles: 'ملفات الأسرة', allProfiles: 'كل الملفات', search: 'اسم الطفل أو ولي الأمر...', allTracks: 'كل المسارات', loading: 'جارٍ تحميل ملفات الأطفال...',
    child: 'الطفل', parent: 'ولي الأمر', birth: 'الميلاد', computedTrack: 'المسار المحسوب', interests: 'الاهتمامات', status: 'الحالة', noName: 'من دون اسم', unspecified: 'لم تُحدد',
    empty: 'لا توجد ملفات أطفال', emptyDesc: 'ستظهر الملفات عند إضافتها من التطبيق إلى حسابات أولياء الأمور الحقيقية.',
    authorityTitle: 'الإنشاء والتعديل غير متاحين من هنا',
    authorityHint: 'ملفات الأطفال تُدار حصريًا عبر Family APIs الموثّقة التي تكتب إلى FamilyState. مسارات إدارة اللوحة (/admin/children) للقراءة فقط عمدًا وترفض أي كتابة بـ405، لمنع كتابة مزدوجة تتعارض مع FamilyState كمصدر السلطة الوحيد لبيانات الأسرة.',
  },
  en: {
    loadError: 'Unable to load child profiles',
    independent: 'Independent profiles', title: 'Child profiles', intro: 'A read-only administrative record built from the family event projection. The server derives the track from birth month and year while each child’s data remains isolated.',
    familyProfiles: 'Family profiles', allProfiles: 'All profiles', search: 'Child or parent name...', allTracks: 'All tracks', loading: 'Loading child profiles...',
    child: 'Child', parent: 'Parent', birth: 'Birth', computedTrack: 'Calculated track', interests: 'Interests', status: 'Status', noName: 'No name', unspecified: 'Not specified',
    empty: 'No child profiles', emptyDesc: 'Profiles will appear once they are added from the app to real parent accounts.',
    authorityTitle: 'Creating and editing are unavailable here',
    authorityHint: 'Child profiles are managed exclusively through authenticated Family APIs that write to FamilyState. The dashboard\u2019s admin routes (/admin/children) are intentionally read-only and reject any write with 405, to prevent a double write that would conflict with FamilyState as the sole authority for family data.',
  },
}

function interestsText(value: string, locale: Locale) {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').join(locale === 'ar' ? '، ' : ', ') : ''
  } catch { return '' }
}

export function ChildrenPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [records, setRecords] = useState<ChildRecord[]>([])
  const [query, setQuery] = useState('')
  const [track, setTrack] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { const response = await api.children({ q: query, track, limit: 100 }); setRecords(response.data) }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.loadError) }
    finally { setLoading(false) }
  }, [query, text.loadError, track])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer) }, [load])

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.independent}</span><h2>{text.title}</h2><p>{text.intro}</p></div></section>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><span className="panel__kicker">{text.familyProfiles}</span><h3>{text.allProfiles} <span className="title-count">{formatNumber(records.length, locale)}</span></h3></div>
          <div className="filters-row">
            <label className="search-field"><Icon name="search" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search}/></label>
            <select value={track} onChange={(event) => setTrack(event.target.value)}><option value="">{text.allTracks}</option>{Object.entries(trackLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          </div>
        </header>
        {loading && !records.length ? <LoadingState label={text.loading}/> : error && !records.length ? <ErrorState message={error} onRetry={() => void load()}/> : records.length ? (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.child}</th><th>{text.parent}</th><th>{text.birth}</th><th>{text.computedTrack}</th><th>{text.interests}</th><th>{text.status}</th></tr></thead>
              <tbody>
                {records.map((child) => (
                  <tr key={child.id}>
                    <td><div className="entity-cell"><span className={`entity-avatar child-avatar child-avatar--${child.age_track}`}>{child.nickname.charAt(0)}</span><div><strong>{child.nickname}</strong><small>{child.avatar_id}</small></div></div></td>
                    <td><strong className="table-primary">{child.parent_name || text.noName}</strong><small className="table-secondary">{child.parent_email || child.parent_id}</small></td>
                    <td>{months[locale][child.birth_month - 1]} {formatNumber(child.birth_year, locale)}</td>
                    <td><TrackBadge track={child.age_track}/></td>
                    <td className="cell-wrap">{interestsText(child.interests, locale) || text.unspecified}</td>
                    <td><span className={`account-status account-status--${child.status}`}>{accountStatusLabels[locale][child.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title={text.empty} description={text.emptyDesc} />}
      </section>

      <section className="panel panel--notice">
        <strong>{text.authorityTitle}</strong>
        <p>{text.authorityHint}</p>
      </section>
    </div>
  )
}
