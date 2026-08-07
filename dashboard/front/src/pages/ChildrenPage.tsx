import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import type { ChildPayload, ChildRecord, ParentRecord } from '../types/api'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { TrackBadge } from '../components/StatusBadge'
import { accountStatusLabels, formatNumber, planLabels, trackLabels } from '../lib/labels'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 11 }, (_, index) => currentYear - 3 - index)
const months: Record<Locale, string[]> = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

const copy = {
  ar: {
    loadError: 'تعذر تحميل ملفات الأطفال', required: 'ولي الأمر والاسم المستعار مطلوبان.', saveError: 'تعذر حفظ ملف الطفل', updateError: 'تعذر تحديث الملف',
    archiveConfirm: (name: string) => `هل تريد أرشفة ملف «${name}»؟`, activateConfirm: (name: string) => `هل تريد إعادة تفعيل ملف «${name}»؟`,
    independent: 'ملفات مستقلة', title: 'ملفات الأطفال', intro: 'يحدد الخادم المسار من شهر وسنة الميلاد، وتبقى بيانات كل طفل معزولة.', newProfile: 'ملف طفل', needsParent: 'يلزم وجود حساب ولي أمر نشط قبل إنشاء ملف طفل.',
    familyProfiles: 'ملفات الأسرة', allProfiles: 'كل الملفات', search: 'اسم الطفل أو ولي الأمر...', allTracks: 'كل المسارات', loading: 'جارٍ تحميل ملفات الأطفال...',
    child: 'الطفل', parent: 'ولي الأمر', birth: 'الميلاد', computedTrack: 'المسار المحسوب', interests: 'الاهتمامات', status: 'الحالة', actions: 'إجراءات', noName: 'من دون اسم', unspecified: 'لم تُحدد',
    edit: 'تعديل', archive: 'أرشفة', reactivate: 'إعادة تفعيل', empty: 'لا توجد ملفات أطفال', emptyDesc: 'ستظهر الملفات عند إضافتها إلى حسابات أولياء الأمور الحقيقية.', addProfile: 'إضافة ملف',
    editTitle: 'تعديل ملف الطفل', createTitle: 'إضافة ملف طفل', modalDesc: 'لا نخزن تاريخ الميلاد كاملًا؛ الشهر والسنة فقط.', parentRequired: 'ولي الأمر *', selectParent: 'اختر ولي الأمر', nickname: 'الاسم المستعار *', avatar: 'معرف الصورة',
    birthMonth: 'شهر الميلاد', birthYear: 'سنة الميلاد', language: 'لغة المحتوى', active: 'نشط', archived: 'مؤرشف', interestsPlaceholder: 'علوم، قصص، أرقام', interestsHelp: 'افصل بين الاهتمامات بفاصلة.',
    calculation: 'المسار لا يُختار يدويًا؛ سيحسبه الخادم تلقائيًا ضمن 3–12.', cancel: 'إلغاء', saving: 'جارٍ الحفظ...', save: 'حفظ الملف', arabic: 'العربية', english: 'الإنجليزية',
  },
  en: {
    loadError: 'Unable to load child profiles', required: 'Parent and nickname are required.', saveError: 'Unable to save the child profile', updateError: 'Unable to update the profile',
    archiveConfirm: (name: string) => `Archive “${name}” profile?`, activateConfirm: (name: string) => `Reactivate “${name}” profile?`,
    independent: 'Independent profiles', title: 'Child profiles', intro: 'The server derives the track from birth month and year while each child’s data remains isolated.', newProfile: 'Child profile', needsParent: 'An active parent account is required before creating a child profile.',
    familyProfiles: 'Family profiles', allProfiles: 'All profiles', search: 'Child or parent name...', allTracks: 'All tracks', loading: 'Loading child profiles...',
    child: 'Child', parent: 'Parent', birth: 'Birth', computedTrack: 'Calculated track', interests: 'Interests', status: 'Status', actions: 'Actions', noName: 'No name', unspecified: 'Not specified',
    edit: 'Edit', archive: 'Archive', reactivate: 'Reactivate', empty: 'No child profiles', emptyDesc: 'Profiles will appear when they are added to real parent accounts.', addProfile: 'Add profile',
    editTitle: 'Edit child profile', createTitle: 'Add child profile', modalDesc: 'The full birth date is not stored—only month and year.', parentRequired: 'Parent *', selectParent: 'Select a parent', nickname: 'Nickname *', avatar: 'Avatar ID',
    birthMonth: 'Birth month', birthYear: 'Birth year', language: 'Content language', active: 'Active', archived: 'Archived', interestsPlaceholder: 'Science, stories, numbers', interestsHelp: 'Separate interests with commas.',
    calculation: 'The track is not selected manually; the server calculates it automatically within ages 3–12.', cancel: 'Cancel', saving: 'Saving...', save: 'Save profile', arabic: 'Arabic', english: 'English',
  },
}

type ChildForm = { parent_id: string; nickname: string; birth_month: string; birth_year: string; avatar_id: string; interests: string; language: string; status: ChildRecord['status'] }
const emptyForm: ChildForm = { parent_id: '', nickname: '', birth_month: '1', birth_year: String(currentYear - 6), avatar_id: 'avatar-default', interests: '', language: 'ar', status: 'active' }

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
  const [parents, setParents] = useState<ParentRecord[]>([])
  const [query, setQuery] = useState('')
  const [track, setTrack] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ChildRecord | null>(null)
  const [form, setForm] = useState<ChildForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { const response = await api.children({ q: query, track, limit: 100 }); setRecords(response.data) }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.loadError) }
    finally { setLoading(false) }
  }, [query, text.loadError, track])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer) }, [load])
  useEffect(() => { void api.parents({ status: 'active', limit: 100 }).then((response) => setParents(response.data)).catch(() => setParents([])) }, [])

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, parent_id: parents[0]?.id ?? '' })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(child: ChildRecord) {
    setEditing(child)
    setForm({ parent_id: child.parent_id, nickname: child.nickname, birth_month: String(child.birth_month), birth_year: String(child.birth_year), avatar_id: child.avatar_id, interests: interestsText(child.interests, locale), language: child.language, status: child.status })
    setFormError('')
    setModalOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.parent_id || !form.nickname.trim()) { setFormError(text.required); return }
    const payload: ChildPayload = {
      parent_id: form.parent_id, nickname: form.nickname.trim(), birth_month: Number(form.birth_month), birth_year: Number(form.birth_year),
      avatar_id: form.avatar_id.trim() || 'avatar-default', interests: form.interests.split(/[،,]/).map((item) => item.trim()).filter(Boolean), language: form.language, status: form.status,
    }
    setSaving(true)
    setFormError('')
    try {
      if (editing) await api.updateChild(editing.id, payload)
      else await api.createChild(payload)
      setModalOpen(false)
      await load()
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : text.saveError) }
    finally { setSaving(false) }
  }

  async function toggleStatus(child: ChildRecord) {
    const nextStatus = child.status === 'active' ? 'archived' : 'active'
    const message = nextStatus === 'archived' ? text.archiveConfirm(child.nickname) : text.activateConfirm(child.nickname)
    if (!window.confirm(message)) return
    setBusyId(child.id)
    try { await api.updateChild(child.id, { status: nextStatus }); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.updateError) }
    finally { setBusyId('') }
  }

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.independent}</span><h2>{text.title}</h2><p>{text.intro}</p></div><button className="button button--primary" type="button" onClick={openCreate} disabled={!parents.length}><Icon name="plus" size={17}/>{text.newProfile}</button></section>
      {!parents.length && !loading && <div className="inline-alert inline-alert--info">{text.needsParent}</div>}
      <section className="panel panel--table"><header className="panel__header panel__header--filters"><div><span className="panel__kicker">{text.familyProfiles}</span><h3>{text.allProfiles} <span className="title-count">{formatNumber(records.length, locale)}</span></h3></div><div className="filters-row"><label className="search-field"><Icon name="search" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search}/></label><select value={track} onChange={(event) => setTrack(event.target.value)}><option value="">{text.allTracks}</option>{Object.entries(trackLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div></header>
        {loading && !records.length ? <LoadingState label={text.loading}/> : error && !records.length ? <ErrorState message={error} onRetry={() => void load()}/> : records.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>{text.child}</th><th>{text.parent}</th><th>{text.birth}</th><th>{text.computedTrack}</th><th>{text.interests}</th><th>{text.status}</th><th>{text.actions}</th></tr></thead><tbody>{records.map((child) => <tr key={child.id}><td><div className="entity-cell"><span className={`entity-avatar child-avatar child-avatar--${child.age_track}`}>{child.nickname.charAt(0)}</span><div><strong>{child.nickname}</strong><small>{child.avatar_id}</small></div></div></td><td><strong className="table-primary">{child.parent_name || text.noName}</strong><small className="table-secondary">{child.parent_email || child.parent_id}</small></td><td>{months[locale][child.birth_month - 1]} {formatNumber(child.birth_year, locale)}</td><td><TrackBadge track={child.age_track}/></td><td className="cell-wrap">{interestsText(child.interests, locale) || text.unspecified}</td><td><span className={`account-status account-status--${child.status}`}>{accountStatusLabels[locale][child.status]}</span></td><td><div className="table-actions"><button className="icon-button icon-button--small" type="button" onClick={() => openEdit(child)} title={text.edit}><Icon name="edit" size={16}/></button><button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void toggleStatus(child)} disabled={busyId === child.id} title={child.status === 'active' ? text.archive : text.reactivate}><Icon name={child.status === 'active' ? 'archive' : 'refresh'} size={16}/></button></div></td></tr>)}</tbody></table></div> : <EmptyState title={text.empty} description={text.emptyDesc} action={parents.length ? <button className="button button--primary" type="button" onClick={openCreate}><Icon name="plus" size={17}/>{text.addProfile}</button> : undefined}/>} 
      </section>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? text.editTitle : text.createTitle} description={text.modalDesc}>
        <form className="entity-form" onSubmit={submit}>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field"><span>{text.parentRequired}</span><select value={form.parent_id} onChange={(event) => setForm({ ...form, parent_id: event.target.value })}><option value="">{text.selectParent}</option>{parents.map((parent) => <option value={parent.id} key={parent.id}>{parent.display_name || parent.email || parent.id} — {planLabels[locale][parent.plan]}</option>)}</select></label>
          <div className="form-grid"><label className="field"><span>{text.nickname}</span><input autoFocus value={form.nickname} maxLength={40} onChange={(event) => setForm({ ...form, nickname: event.target.value })}/></label><label className="field"><span>{text.avatar}</span><input value={form.avatar_id} onChange={(event) => setForm({ ...form, avatar_id: event.target.value })}/></label></div>
          <div className="form-grid form-grid--three"><label className="field"><span>{text.birthMonth}</span><select value={form.birth_month} onChange={(event) => setForm({ ...form, birth_month: event.target.value })}>{months[locale].map((month, index) => <option value={index + 1} key={month}>{month}</option>)}</select></label><label className="field"><span>{text.birthYear}</span><select value={form.birth_year} onChange={(event) => setForm({ ...form, birth_year: event.target.value })}>{years.map((year) => <option value={year} key={year}>{formatNumber(year, locale)}</option>)}</select></label><label className="field"><span>{text.status}</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ChildRecord['status'] })}><option value="active">{text.active}</option><option value="archived">{text.archived}</option></select></label></div>
          <div className="form-grid"><label className="field"><span>{text.language}</span><select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}><option value="ar">{text.arabic}</option><option value="en">{text.english}</option></select></label><label className="field"><span>{text.interests}</span><input value={form.interests} onChange={(event) => setForm({ ...form, interests: event.target.value })} placeholder={text.interestsPlaceholder}/><small>{text.interestsHelp}</small></label></div>
          <div className="calculation-note"><Icon name="sparkles" size={18}/><span>{text.calculation}</span></div>
          <div className="form-actions"><button className="button button--ghost" type="button" onClick={() => setModalOpen(false)} disabled={saving}>{text.cancel}</button><button className="button button--primary" type="submit" disabled={saving}>{saving ? text.saving : text.save}</button></div>
        </form>
      </Modal>
    </div>
  )
}
