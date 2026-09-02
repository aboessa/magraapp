import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu, useColumnPreferences, ColumnManager } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import { COUNTRY_CODES } from '../lib/constants'

const TYPES = ['public','private','international','charter']
const STATUSES = ['active','suspended','pending','archived']
const GRADES = ['kg1','kg2','grade1','grade2','grade3','grade4','grade5','grade6','grade7','grade8','grade9','grade10','grade11','grade12']

const copy={
  ar:{
    eyebrow:'التوسع · B2B',
    title:'حسابات المدارس',
    lede:'مدارس وفصول مع تقارير مجمّعة وعزل بيانات حقيقي - المعلم لا يرى بريد ولي الأمر، وولي الأمر لا يرى بقية الفصل، والتقارير مجهولة تحت حد أدنى.',
    add:'مدرسة جديدة', refresh:'تحديث',
    total:'الإجمالي', active:'نشطة', suspended:'موقوفة', pending:'قيد المراجعة', classrooms:'فصول', students:'طلاب', teachers:'معلمون',
    search:'ابحث باسم المدرسة أو الرمز…', type:'النوع', country:'البلد', status:'الحالة',
    school:'المدرسة', code:'الرمز', city:'المدينة', contact:'جهة الاتصال', plan:'الخطة', actions:'',
    noSchools:'لا مدارس', noSchoolsHint:'أنشئ أول مدرسة وابدأ بإضافة الفصول والمعلمين والطلاب مع عزل بيانات حقيقي',
    // create
    createTitle:'إنشاء مدرسة',
    nameAr:'الاسم العربي *', nameEn:'الاسم الإنجليزي', codeLabel:'الرمز (اختياري - يُولد تلقائياً)', typeLabel:'النوع *', countryLabel:'البلد * (رمز حرفين)', cityLabel:'المدينة', contactName:'اسم جهة الاتصال', contactEmail:'بريد جهة الاتصال', contactPhone:'هاتف جهة الاتصال', planLabel:'خطة الاشتراك',
    save:'إنشاء', cancel:'إلغاء', required:'الاسم والبلد مطلوبان', saveError:'تعذر الإنشاء',
    // detail
    detailEyebrow:'مدرسة', classroomsTitle:'الفصول', teachersTitle:'المعلمون', enrollmentsTitle:'التسجيلات', statsTitle:'إحصائيات مع الخصوصية',
    addClassroom:'فصل جديد', addTeacher:'تعيين معلم', enrollStudent:'تسجيل طالب',
    privacyNote:'الخصوصية: بريد/هاتف ولي الأمر مخفي افتراضياً. المعلم يرى فقط تقدم فصله. التقارير مجهولة عند أقل من حد أدنى (افتراضي 5 طلاب).',
    grade:'المستوى', section:'الشعبة', year:'العام الدراسي', teacher:'المعلم', capacity:'السعة', enrolled:'مسجل', anonymize:'إخفاء هوية', parentVisibility:'رؤية ولي الأمر', teacherContact:'المعلم يرى اتصال ولي الأمر',
    open:'فتح', manage:'إدارة',
  },
  en:{
    eyebrow:'Expansion · B2B',
    title:'School accounts',
    lede:'Schools and classrooms with aggregated reporting and real data isolation - teachers cannot see parent email/phone, parents cannot see other students, reports anonymized below threshold.',
    add:'New school', refresh:'Refresh',
    total:'Total', active:'Active', suspended:'Suspended', pending:'Pending', classrooms:'Classrooms', students:'Students', teachers:'Teachers',
    search:'Search school name or code…', type:'Type', country:'Country', status:'Status',
    school:'School', code:'Code', city:'City', contact:'Contact', plan:'Plan', actions:'',
    noSchools:'No schools', noSchoolsHint:'Create first school then add classrooms, teachers and enrollments with real privacy isolation',
    createTitle:'Create school',
    nameAr:'Arabic name *', nameEn:'English name', codeLabel:'Code (optional - auto)', typeLabel:'Type *', countryLabel:'Country * (2-letter)', cityLabel:'City', contactName:'Contact name', contactEmail:'Contact email', contactPhone:'Contact phone', planLabel:'Subscription plan',
    save:'Create', cancel:'Cancel', required:'Name and country required', saveError:'Unable to create',
    detailEyebrow:'School', classroomsTitle:'Classrooms', teachersTitle:'Teachers', enrollmentsTitle:'Enrollments', statsTitle:'Stats with privacy',
    addClassroom:'New classroom', addTeacher:'Assign teacher', enrollStudent:'Enroll student',
    privacyNote:'Privacy: parent email/phone hidden by default. Teacher sees only own classroom progress. Reports anonymized below threshold (default 5 students).',
    grade:'Grade', section:'Section', year:'Academic year', teacher:'Teacher', capacity:'Capacity', enrolled:'Enrolled', anonymize:'Anonymize reports', parentVisibility:'Parent visibility', teacherContact:'Teacher sees parent contact',
    open:'Open', manage:'Manage',
  }
}

const COLUMNS: ColumnDefinition[]=[
  { key:'school', label:'school', locked:true },
  { key:'code', label:'code' },
  { key:'city', label:'city' },
  { key:'contact', label:'contact' },
  { key:'classrooms', label:'classrooms' },
  { key:'students', label:'students' },
  { key:'teachers', label:'teachers' },
  { key:'plan', label:'plan' },
  { key:'status', label:'status' },
]

export function SchoolAccountsPage(){
  const { locale }=usePreferences()
  const text=copy[locale] as any
  const navigate=useNavigate()
  const list=useUrlListState({ type:'', country:'', status:'' } as any, { limit:25 })
  const { query, filters, offset, limit }=list
  const [schools,setSchools]=useState<any[]>([])
  const [total,setTotal]=useState(0)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [createOpen,setCreateOpen]=useState(false)
  const [form,setForm]=useState<any>({ name_ar:'', name_en:'', code:'', type:'private', country:'EG', city:'', contact_name:'', contact_email:'', contact_phone:'', subscription_plan:'school_basic' })
  const [formError,setFormError]=useState('')
  const [saving,setSaving]=useState(false)
  const [detailId,setDetailId]=useState<string|null>(null)
  const [detail,setDetail]=useState<any>(null)
  const [detailLoading,setDetailLoading]=useState(false)
  const [classroomOpen,setClassroomOpen]=useState(false)
  const [classroomForm,setClassroomForm]=useState<any>({ name_ar:'', name_en:'', code:'', grade_level:'grade2', section:'A', academic_year:'2025-2026', student_capacity:30, teacher_id:'' })
  const [teacherOpen,setTeacherOpen]=useState(false)
  const [teacherForm,setTeacherForm]=useState<any>({ teacher_id:'', role:'teacher', classroom_id:'', permissions:['view_classroom_progress'] })
  const [enrollOpen,setEnrollOpen]=useState(false)
  const [enrollForm,setEnrollForm]=useState<any>({ classroom_id:'', child_id:'', parent_id:'' })
  const [detailSaving,setDetailSaving]=useState(false)
  const columns=useColumnPreferences('schools', COLUMNS)

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const res=await api.schools({ q: query || undefined, ...filters, limit, offset } as any)
      setSchools(res.data); setTotal(res.meta?.total ?? res.data.length)
    }catch(e){ setError(e instanceof Error? e.message: 'Error') } finally{ setLoading(false) }
  },[query, filters, limit, offset])

  useEffect(()=>{ const t=setTimeout(()=>void load(), 200); return ()=>clearTimeout(t) },[load])

  const loadDetail=useCallback(async(id:string)=>{
    setDetailId(id); setDetailLoading(true)
    try{ const res=await api.school(id); setDetail(res.data) } catch{ setDetail(null) } finally{ setDetailLoading(false) }
  },[])

  async function createSchool(){
    if(!form.name_ar.trim() || !form.country.trim()){ setFormError(text.required); return }
    setSaving(true); setFormError('')
    try{
      const res=await api.createSchool({
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim() || null,
        code: form.code.trim() || undefined,
        type: form.type,
        country: form.country.trim().toUpperCase(),
        city: form.city.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        subscription_plan: form.subscription_plan,
      } as any)
      setCreateOpen(false); setForm({ name_ar:'', name_en:'', code:'', type:'private', country:'EG', city:'', contact_name:'', contact_email:'', contact_phone:'', subscription_plan:'school_basic' }); await load(); if(res.data?.id) await loadDetail(res.data.id)
    }catch(e){ setFormError(e instanceof Error? e.message: text.saveError) } finally{ setSaving(false) }
  }

  async function createClassroom(){
    if(!detailId || !classroomForm.name_ar.trim() || !classroomForm.grade_level || !classroomForm.academic_year.trim()){ setFormError('Name, grade, year required'); return }
    setDetailSaving(true)
    try{
      await api.createClassroom(detailId, {
        name_ar: classroomForm.name_ar.trim(),
        name_en: classroomForm.name_en.trim() || null,
        code: classroomForm.code.trim() || undefined,
        grade_level: classroomForm.grade_level,
        section: classroomForm.section.trim() || null,
        academic_year: classroomForm.academic_year.trim(),
        teacher_id: classroomForm.teacher_id.trim() || null,
        student_capacity: Number(classroomForm.student_capacity) || 30,
      } as any)
      setClassroomOpen(false); setClassroomForm({ name_ar:'', name_en:'', code:'', grade_level:'grade2', section:'A', academic_year:'2025-2026', student_capacity:30, teacher_id:'' }); await loadDetail(detailId)
    }catch(e){ setFormError(e instanceof Error? e.message: 'Unable to create classroom') } finally{ setDetailSaving(false) }
  }

  async function assignTeacher(){
    if(!detailId || !teacherForm.teacher_id.trim()){ setFormError('Teacher ID required'); return }
    setDetailSaving(true)
    try{
      await api.assignSchoolTeacher(detailId, {
        teacher_id: teacherForm.teacher_id.trim(),
        classroom_id: teacherForm.classroom_id.trim() || null,
        role: teacherForm.role,
        permissions: teacherForm.permissions,
      } as any)
      setTeacherOpen(false); setTeacherForm({ teacher_id:'', role:'teacher', classroom_id:'', permissions:['view_classroom_progress'] }); await loadDetail(detailId)
    }catch(e){ setFormError(e instanceof Error? e.message: 'Unable to assign teacher') } finally{ setDetailSaving(false) }
  }

  async function enrollStudent(){
    if(!detailId || !enrollForm.classroom_id.trim() || !enrollForm.child_id.trim() || !enrollForm.parent_id.trim()){ setFormError('All fields required'); return }
    setDetailSaving(true)
    try{
      await api.enrollStudent(detailId, {
        classroom_id: enrollForm.classroom_id.trim(),
        child_id: enrollForm.child_id.trim(),
        parent_id: enrollForm.parent_id.trim(),
      })
      setEnrollOpen(false); setEnrollForm({ classroom_id:'', child_id:'', parent_id:'' }); await loadDetail(detailId); await load()
    }catch(e){ setFormError(e instanceof Error? e.message: 'Unable to enroll') } finally{ setDetailSaving(false) }
  }

  const filterFields: FilterField[]=[
    { key:'type', label:text.type, type:'select', options:[{value:'',label:'All'}, ...TYPES.map(v=>({value:v,label:v}))] },
    { key:'country', label:text.country, type:'select', options:[{value:'',label:'All'}, ...COUNTRY_CODES.map(v=>({value:v,label:v}))] },
    { key:'status', label:text.status, type:'select', options:[{value:'',label:'All'}, ...STATUSES.map(v=>({value:v,label:v}))] },
  ]

  const metrics=useMemo(()=>({
    total,
    active: schools.filter(s=> s.status==='active').length,
    classrooms: schools.reduce((a,c)=> a+Number(c.classrooms_count||0),0),
    students: schools.reduce((a,c)=> a+Number(c.students_count||0),0),
    teachers: schools.reduce((a,c)=> a+Number(c.teachers_count||0),0),
  }),[schools, total])

  if(loading && !schools.length) return <LoadingState/>
  if(error && !schools.length) return <ErrorState message={error} onRetry={()=>void load()} />

  return (
    <div className="page-stack" style={{ gap:18 }}>
      <style>{`
        .school-hero{position:relative;border-radius:20px;border:1px solid var(--line);background:linear-gradient(160deg, var(--surface), var(--surface-2));padding:22px;overflow:hidden}
        .school-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(520px 200px at 85% -10%, rgba(86,121,242,.12), transparent 60%), radial-gradient(380px 200px at 5% 110%, rgba(0,214,245,.08), transparent 70%)}
        .school-hero>*{position:relative}
        .school-kicker{display:inline-flex;gap:6px;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);font-size:10px;font-weight:700;color:var(--muted)}
        .school-grid{display:grid;grid-template-columns:repeat(5, minmax(0,1fr));gap:12px}
        @media(max-width:1100px){.school-grid{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:640px){.school-grid{grid-template-columns:repeat(2,1fr)}}
        .s-card{border-radius:16px;border:1px solid var(--line);background:linear-gradient(180deg, var(--surface), var(--surface-2));padding:14px}
        .s-card__value{font-size:22px;font-weight:800;margin-top:8px}
        .privacy-callout{padding:12px 14px;border-radius:12px;background:linear-gradient(135deg, rgba(16,185,129,.08), rgba(0,214,245,.05));border:1px solid rgba(16,185,129,.18);font-size:11px;line-height:1.7;color:var(--text-soft)}
        .detail-panel{border:1px solid var(--line);border-radius:16px;background:var(--surface);overflow:hidden}
        .detail-panel__head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
      `}</style>

      <section className="school-hero">
        <div style={{ display:'flex', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div><span className="school-kicker"><Icon name="parents" size={12}/>{text.eyebrow}</span><h2 style={{ marginTop:12, fontSize:26, letterSpacing:'-.04em' }}>{text.title}</h2><p style={{ marginTop:8, maxWidth:720, color:'var(--text-soft)', fontSize:11, lineHeight:1.7 }}>{text.lede}</p></div>
          <div style={{ display:'flex', gap:8, alignItems:'start' }}><button className="button button--secondary" onClick={()=>void load()}><Icon name="refresh" size={14}/>{text.refresh}</button><button className="button button--primary" onClick={()=> { setFormError(''); setCreateOpen(true) }}><Icon name="plus" size={14}/>{text.add}</button></div>
        </div>
      </section>

      <div className="school-grid">
        <div className="s-card"><div style={{ fontSize:10, color:'var(--muted)', fontWeight:700 }}>{text.total}</div><div className="s-card__value">{metrics.total}</div></div>
        <div className="s-card"><div style={{ fontSize:10, color:'var(--muted)', fontWeight:700 }}>{text.active}</div><div className="s-card__value">{metrics.active}</div></div>
        <div className="s-card"><div style={{ fontSize:10, color:'var(--muted)', fontWeight:700 }}>{text.classrooms}</div><div className="s-card__value">{metrics.classrooms}</div></div>
        <div className="s-card"><div style={{ fontSize:10, color:'var(--muted)', fontWeight:700 }}>{text.students}</div><div className="s-card__value">{metrics.students}</div></div>
        <div className="s-card"><div style={{ fontSize:10, color:'var(--muted)', fontWeight:700 }}>{text.teachers}</div><div className="s-card__value">{metrics.teachers}</div></div>
      </div>

      <div className="privacy-callout"><strong style={{ display:'flex', alignItems:'center', gap:6 }}>{/* `shield` ليست في `IconName`، فكان `Icon` يُعيد `undefined` ولا تُرسَم
            أيقونة أصلًا. و`skills` هي درعٌ بعلامة صحّ — نفس الدلالة الموجودة. */}
        <Icon name="skills" size={14}/> {locale==='ar'?'ضمانات الخصوصية المنفذة:':'Implemented privacy guarantees:'}</strong><div style={{ marginTop:6, display:'grid', gap:4 }}><span>• {text.privacyNote}</span><span>• المعلم يرى تقدم فصله فقط (scoped via classroom_id) - لا يرى بريد/هاتف ولي الأمر إلا إذا teacher_can_see_parent_contact=true</span><span>• ولي الأمر يرى طفله فقط - لا بيانات بقية الفصل</span><span>• التقارير مجهولة عند أقل من min_anonymize_threshold (افتراضي 5)</span></div></div>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div><h3>{text.title} <span className="title-count">{formatNumber(total, locale as any)}</span></h3></div>
          <ListToolbar searchValue={query} onSearchChange={list.setQuery} searchPlaceholder={text.search} fields={filterFields} values={filters as any} defaults={{ type:'', country:'', status:'' } as any} onApply={n=>list.setFilters(n as any)} onClear={list.clearFilters} onRemove={k=>list.setFilter(k as any,'')} trailing={<><SavedViewsMenu storageKey="schools" currentSearch={list.search} onApply={s=> navigate(`${adminPath('school')}${s}`)} /><ColumnManager columns={COLUMNS.map(c=> ({...c, label: (text as any)[c.label] ?? c.label }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset} /></>} />
        </header>

        {schools.length ? (
          <>
            <div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr><th>{text.school}</th>{columns.isVisible('code')&&<th>{text.code}</th>}{columns.isVisible('city')&&<th>{text.city}</th>}{columns.isVisible('contact')&&<th>{text.contact}</th>}{columns.isVisible('classrooms')&&<th>{text.classrooms}</th>}{columns.isVisible('students')&&<th>{text.students}</th>}{columns.isVisible('teachers')&&<th>{text.teachers}</th>}{columns.isVisible('plan')&&<th>{text.plan}</th>}{columns.isVisible('status')&&<th>{text.status}</th>}<th></th></tr></thead><tbody>
              {schools.map(s=>(
                <tr key={s.id} style={{ background: detailId===s.id ? 'var(--surface-2)' : undefined }}>
                  <td><button onClick={()=> void loadDetail(s.id)} style={{ textAlign:'start', background:'transparent', border:0, cursor:'pointer' }}><strong style={{ display:'block', fontSize:12 }}>{s.name_ar}</strong><small style={{ color:'var(--muted)', fontSize:10 }}>{s.name_en ?? ''} · {s.country} {s.city?`· ${s.city}`:''}</small></button></td>
                  {columns.isVisible('code')&&<td dir="ltr" style={{ fontSize:11 }}>{s.code}</td>}
                  {columns.isVisible('city')&&<td style={{ fontSize:11 }}>{s.city ?? '—'}</td>}
                  {columns.isVisible('contact')&&<td style={{ fontSize:11 }}>{s.contact_name ?? '—'}<br/><small style={{ color:'var(--muted)' }}>{s.contact_email ?? ''}</small></td>}
                  {columns.isVisible('classrooms')&&<td><span className="status-badge status-badge--review">{s.classrooms_count ?? 0}</span></td>}
                  {columns.isVisible('students')&&<td><span className="status-badge status-badge--published">{s.students_count ?? 0}</span></td>}
                  {columns.isVisible('teachers')&&<td><span className="track-badge">{s.teachers_count ?? 0}</span></td>}
                  {columns.isVisible('plan')&&<td><span className={`plan-pill plan-pill--${s.subscription_plan}`}>{s.subscription_plan}</span></td>}
                  {columns.isVisible('status')&&<td><span className={`status-badge ${s.status==='active'?'status-badge--published': s.status==='suspended'?'status-badge--review':'status-badge--archived'}`}>{s.status}</span></td>}
                  <td><div className="table-actions"><button className="button button--ghost button--small" onClick={()=> void loadDetail(s.id)}>{text.open}</button></div></td>
                </tr>
              ))}
            </tbody></table></div>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale} />
          </>
        ) : <EmptyState title={text.noSchools} description={text.noSchoolsHint} action={<button className="button button--primary" onClick={()=> setCreateOpen(true)}>{text.add}</button>} />}
      </section>

          {detailId && (
        <section className="detail-panel">
          <div className="detail-panel__head">
            <div><span className="eyebrow">{text.detailEyebrow}</span><h3 style={{ fontSize:14, marginTop:4 }}>{detail?.name_ar ?? detailId}</h3><small style={{ color:'var(--muted)' }}>{detail?.code ?? ''} · {detail?.country ?? ''} · {detail?.city ?? ''}</small></div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}><button className="button button--ghost button--small" onClick={()=> setClassroomOpen(true)}><Icon name="plus" size={12}/> {text.addClassroom}</button><button className="button button--ghost button--small" onClick={()=> setTeacherOpen(true)}><Icon name="parents" size={12}/> {text.addTeacher}</button><button className="button button--ghost button--small" onClick={()=> setEnrollOpen(true)}><Icon name="children" size={12}/> {text.enrollStudent}</button><button className="button button--ghost button--small" onClick={()=> { setDetailId(null); setDetail(null) }}>{text.cancel ?? 'Close'}</button><Link className="button button--secondary button--small" to={adminPath(`audit-logs?entity_type=school&entity_id=${detailId}`)}>Audit</Link></div>
          </div>
          {detailLoading ? <div style={{ padding:20 }}><LoadingState/></div> : detail ? (
            <div style={{ padding:16, display:'grid', gap:16 }}>
              {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div><h4 style={{ fontSize:12 }}>{text.statsTitle}</h4><div style={{ marginTop:8, display:'grid', gap:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:8, borderRadius:8, background:'var(--surface-2)', border:'1px solid var(--line)' }}><span>Total classrooms</span><strong>{detail.stats?.total_classrooms ?? detail.classrooms?.length ?? 0}</strong></div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:8, borderRadius:8, background:'var(--surface-2)', border:'1px solid var(--line)' }}><span>Total students</span><strong>{detail.stats?.total_students ?? 0} {detail.stats?.anonymized ? <span style={{ fontSize:10, color:'#b45309' }}>(anonymized &lt; threshold)</span> : ''}</strong></div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:8, borderRadius:8, background:'var(--surface-2)', border:'1px solid var(--line)' }}><span>Teachers</span><strong>{detail.stats?.total_teachers ?? detail.teachers?.length ?? 0}</strong></div>
                  <div style={{ padding:8, borderRadius:8, background:'rgba(16,185,129,.06)', border:'1px solid rgba(16,185,129,.18)', fontSize:11 }}><strong>Privacy:</strong> parent_contact hidden by default · reports anonymized below {detail.classrooms?.[0]?.min_anonymize_threshold ?? 5}</div>
                </div></div>
                <div><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}><h4 style={{ fontSize:12 }}>{text.classroomsTitle} ({detail.classrooms?.length ?? 0})</h4><button className="button button--ghost button--small" onClick={()=> setClassroomOpen(true)}>+ {text.addClassroom}</button></div><div style={{ marginTop:8, display:'grid', gap:6, maxHeight:240, overflowY:'auto' }}>
                  {(detail.classrooms ?? []).map((cl:any)=> <div key={cl.id} style={{ padding:8, borderRadius:8, border:'1px solid var(--line)', background:'var(--surface-2)', display:'flex', justifyContent:'space-between', gap:8 }}><span><strong style={{ fontSize:11 }}>{cl.name_ar}</strong><br/><small style={{ color:'var(--muted)', fontSize:10 }}>{cl.grade_level} {cl.section?`· ${cl.section}`:''} · {cl.academic_year} · Enrolled {cl.enrolled ?? 0}/{cl.student_capacity}</small></span><span style={{ fontSize:10 }}><span className="track-badge">{cl.grade_level}</span><br/><small>Anon: {cl.anonymize_reports? 'Yes':'No'} min {cl.min_anonymize_threshold}</small></span></div>)}
                  {!detail.classrooms?.length && <small style={{ color:'var(--muted)' }}>No classrooms yet - create first</small>}
                </div></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}><h4 style={{ fontSize:12 }}>{text.teachersTitle} ({detail.teachers?.length ?? 0})</h4><button className="button button--ghost button--small" onClick={()=> setTeacherOpen(true)}>+ {text.addTeacher}</button></div><div style={{ marginTop:8, display:'grid', gap:6 }}>
                  {(detail.teachers ?? []).map((t:any)=> <div key={t.id} style={{ padding:8, borderRadius:8, border:'1px solid var(--line)', background:'var(--surface-2)' }}><strong style={{ fontSize:11 }}>{t.display_name ?? t.teacher_id}</strong><br/><small style={{ color:'var(--muted)', fontSize:10 }}>{t.role} {t.classroom_id?`· Classroom ${t.classroom_id.slice(0,8)}`:''} · perms: {(JSON.parse(t.permissions||'[]') as string[]).slice(0,2).join(', ')}</small></div>)}
                  {!detail.teachers?.length && <small style={{ color:'var(--muted)' }}>No teachers assigned - assign first teacher</small>}
                </div></div>
                <div><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}><h4 style={{ fontSize:12 }}>{text.enrollmentsTitle} ({detail.enrollments?.length ?? 0})</h4><button className="button button--ghost button--small" onClick={()=> setEnrollOpen(true)}>+ {text.enrollStudent}</button></div><div style={{ marginTop:8, display:'grid', gap:6, maxHeight:240, overflowY:'auto' }}>
                  {(detail.enrollments ?? []).map((e:any)=> <div key={e.id} style={{ padding:8, borderRadius:8, border:'1px solid var(--line)', background:'var(--surface-2)' }}><strong style={{ fontSize:11 }}>{e.child_nickname ?? e.child_id.slice(0,8)} · {e.age_track ?? ''}</strong><br/><small style={{ color:'var(--muted)', fontSize:10 }}>{e.classroom_name ?? e.classroom_id.slice(0,8)} · {e.grade_level ?? ''} · Parent: {e.parent_name ?? e.parent_id.slice(0,8)} (contact hidden)</small><br/><small style={{ fontSize:10, color:'var(--muted)' }}>{e.enrollment_status} · {e.created_at?.slice(0,16) ?? ''}</small></div>)}
                  {!detail.enrollments?.length && <small style={{ color:'var(--muted)' }}>No enrollments yet - enroll first student</small>}
                </div><p style={{ fontSize:10, color:'var(--muted)', marginTop:8 }}>Privacy: parent email/phone intentionally NOT selected in query - hidden by default · Teacher sees only own classroom progress</p></div>
              </div>
            </div>
          ) : <div style={{ padding:16 }}><EmptyState title="No detail" description={detailId} /></div>}
        </section>
      )}

      <Modal open={createOpen} onClose={()=> !saving && setCreateOpen(false)} title={text.createTitle}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid"><label className="field"><span>{text.nameAr}</span><input value={form.name_ar} onChange={e=> setForm({...form, name_ar:e.target.value})} /></label><label className="field"><span>{text.nameEn}</span><input dir="ltr" value={form.name_en} onChange={e=> setForm({...form, name_en:e.target.value})} /></label></div>
          <div className="form-grid form-grid--three"><label className="field"><span>{text.codeLabel}</span><input dir="ltr" value={form.code} onChange={e=> setForm({...form, code:e.target.value})} placeholder="EG-CAI-001" /></label><label className="field"><span>{text.typeLabel}</span><select value={form.type} onChange={e=> setForm({...form, type:e.target.value})}><option value="public">Public</option><option value="private">Private</option><option value="international">International</option><option value="charter">Charter</option></select></label><label className="field"><span>{text.countryLabel}</span><input dir="ltr" value={form.country} onChange={e=> setForm({...form, country:e.target.value})} placeholder="EG" maxLength={2} /></label></div>
          <div className="form-grid form-grid--three"><label className="field"><span>{text.cityLabel}</span><input value={form.city} onChange={e=> setForm({...form, city:e.target.value})} /></label><label className="field"><span>{text.contactName}</span><input value={form.contact_name} onChange={e=> setForm({...form, contact_name:e.target.value})} /></label><label className="field"><span>{text.contactEmail}</span><input dir="ltr" value={form.contact_email} onChange={e=> setForm({...form, contact_email:e.target.value})} /></label></div>
          <label className="field"><span>{text.planLabel}</span><select value={form.subscription_plan} onChange={e=> setForm({...form, subscription_plan:e.target.value})}><option value="school_basic">School Basic</option><option value="school_premium">School Premium</option><option value="district">District</option><option value="family">Family</option></select></label>
          <div className="form-actions"><button className="button button--ghost" onClick={()=> setCreateOpen(false)}>{text.cancel}</button><button className="button button--primary" disabled={saving} onClick={()=> void createSchool()}>{saving?'...':text.save}</button></div>
        </div>
      </Modal>

      <Modal open={classroomOpen} onClose={()=> !detailSaving && setClassroomOpen(false)} title={text.addClassroom}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid"><label className="field"><span>الاسم العربي *</span><input value={classroomForm.name_ar} onChange={e=> setClassroomForm({...classroomForm, name_ar:e.target.value})} placeholder="الصف الثاني - أ" /></label><label className="field"><span>الاسم الإنجليزي</span><input dir="ltr" value={classroomForm.name_en} onChange={e=> setClassroomForm({...classroomForm, name_en:e.target.value})} placeholder="Grade 2 - A" /></label></div>
          <div className="form-grid form-grid--three"><label className="field"><span>{text.code}</span><input dir="ltr" value={classroomForm.code} onChange={e=> setClassroomForm({...classroomForm, code:e.target.value})} placeholder="G2-A" /></label><label className="field"><span>{text.grade} *</span><select value={classroomForm.grade_level} onChange={e=> setClassroomForm({...classroomForm, grade_level:e.target.value})}>{GRADES.map(g=> <option key={g} value={g}>{g}</option>)}</select></label><label className="field"><span>{text.section}</span><input value={classroomForm.section} onChange={e=> setClassroomForm({...classroomForm, section:e.target.value})} placeholder="A" /></label></div>
          <div className="form-grid form-grid--three"><label className="field"><span>{text.year} *</span><input dir="ltr" value={classroomForm.academic_year} onChange={e=> setClassroomForm({...classroomForm, academic_year:e.target.value})} placeholder="2025-2026" /></label><label className="field"><span>{text.capacity}</span><input type="number" min={1} max={100} value={classroomForm.student_capacity} onChange={e=> setClassroomForm({...classroomForm, student_capacity:e.target.value})} /></label><label className="field"><span>Teacher ID (optional)</span><input dir="ltr" value={classroomForm.teacher_id} onChange={e=> setClassroomForm({...classroomForm, teacher_id:e.target.value})} placeholder="admin_user_id" /></label></div>
          <div className="form-actions"><button className="button button--ghost" onClick={()=> setClassroomOpen(false)}>{text.cancel}</button><button className="button button--primary" disabled={detailSaving} onClick={()=> void createClassroom()}>{detailSaving?'...':text.save}</button></div>
        </div>
      </Modal>

      <Modal open={teacherOpen} onClose={()=> !detailSaving && setTeacherOpen(false)} title={text.addTeacher}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field"><span>Teacher Admin User ID *</span><input dir="ltr" value={teacherForm.teacher_id} onChange={e=> setTeacherForm({...teacherForm, teacher_id:e.target.value})} placeholder="admin user id - from team-access page" /></label>
          <div className="form-grid"><label className="field"><span>Role</span><select value={teacherForm.role} onChange={e=> setTeacherForm({...teacherForm, role:e.target.value})}><option value="teacher">Teacher</option><option value="assistant">Assistant</option><option value="coordinator">Coordinator</option><option value="principal">Principal</option></select></label><label className="field"><span>Classroom ID (optional - scoped)</span><select value={teacherForm.classroom_id} onChange={e=> setTeacherForm({...teacherForm, classroom_id:e.target.value})}><option value="">All school (no classroom scope)</option>{(detail?.classrooms ?? []).map((cl:any)=> <option key={cl.id} value={cl.id}>{cl.name_ar} - {cl.grade_level}</option>)}</select></label></div>
          <label className="field"><span>Permissions (JSON array)</span><input dir="ltr" value={teacherForm.permissions.join(', ')} onChange={e=> setTeacherForm({...teacherForm, permissions: e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)})} placeholder="view_classroom_progress, view_aggregated_reports" /></label>
          <p style={{ fontSize:11, color:'var(--muted)' }}>Privacy: teacher with view_classroom_progress sees only own classroom progress. No parent email/phone unless teacher_can_see_parent_contact=true in classroom.</p>
          <div className="form-actions"><button className="button button--ghost" onClick={()=> setTeacherOpen(false)}>{text.cancel}</button><button className="button button--primary" disabled={detailSaving} onClick={()=> void assignTeacher()}>{detailSaving?'...':text.save}</button></div>
        </div>
      </Modal>

      <Modal open={enrollOpen} onClose={()=> !detailSaving && setEnrollOpen(false)} title={text.enrollStudent}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field"><span>Classroom *</span><select value={enrollForm.classroom_id} onChange={e=> setEnrollForm({...enrollForm, classroom_id:e.target.value})}><option value="">— اختر فصلاً —</option>{(detail?.classrooms ?? []).map((cl:any)=> <option key={cl.id} value={cl.id}>{cl.name_ar} - {cl.grade_level} {cl.section?`· ${cl.section}`:''} ({cl.enrolled ?? 0}/{cl.student_capacity})</option>)}</select></label>
          <div className="form-grid"><label className="field"><span>Child ID *</span><input dir="ltr" value={enrollForm.child_id} onChange={e=> setEnrollForm({...enrollForm, child_id:e.target.value})} placeholder="child_id from children page" /></label><label className="field"><span>Parent ID *</span><input dir="ltr" value={enrollForm.parent_id} onChange={e=> setEnrollForm({...enrollForm, parent_id:e.target.value})} placeholder="parent_id - must match child's parent" /></label></div>
          <p style={{ fontSize:11, color:'var(--muted)' }}>Privacy: child must belong to parent (verified server-side). Capacity checked. Parent contact hidden from teacher by default. Enrollment increments current_students.</p>
          <div className="form-actions"><button className="button button--ghost" onClick={()=> setEnrollOpen(false)}>{text.cancel}</button><button className="button button--primary" disabled={detailSaving} onClick={()=> void enrollStudent()}>{detailSaving?'...':text.save}</button></div>
        </div>
      </Modal>
    </div>
  )
}
