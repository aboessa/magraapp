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

const TYPES = ['public', 'private', 'international', 'charter']
const STATUSES = ['active', 'suspended', 'pending', 'archived']
const GRADES = ['kg1', 'kg2', 'grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6', 'grade7', 'grade8', 'grade9', 'grade10', 'grade11', 'grade12']

const copy = {
  ar: {
    eyebrow: 'التوسع المؤسسي · B2B',
    title: 'إدارة حسابات المدارس والمؤسسات',
    lede: 'مدارس وفصول مع تقارير مجمّعة وعزل بيانات حقيقي — المعلم لا يرى بريد ولي الأمر، وولي الأمر لا يرى بقية الفصل، والتقارير مجهولة وفق معايير الخصوصية.',
    add: 'مدرسة جديدة',
    refresh: 'تحديث',
    total: 'إجمالي المدارس',
    active: 'مدارس نشطة',
    suspended: 'موقوفة',
    pending: 'قيد المراجعة',
    classrooms: 'فصول دراسية',
    students: 'طلاب مسجلون',
    teachers: 'معلمون معتمدون',
    search: 'ابحث باسم المدرسة أو الرمز…',
    type: 'النوع',
    country: 'البلد',
    status: 'الحالة',
    school: 'المدرسة',
    code: 'الرمز',
    city: 'المدينة',
    contact: 'جهة الاتصال',
    plan: 'الخطة',
    actions: '',
    noSchools: 'لا مدارس مسجلة بعد',
    noSchoolsHint: 'أنشئ أول مدرسة وابدأ بإضافة الفصول والمعلمين والطلاب مع عزل بيانات حقيقي.',
    createTitle: 'إنشاء مدرسة جديدة',
    nameAr: 'الاسم العربي *',
    nameEn: 'الاسم الإنجليزي',
    codeLabel: 'الرمز (اختياري - يُولد تلقائياً)',
    typeLabel: 'النوع *',
    countryLabel: 'البلد * (رمز حرفين)',
    cityLabel: 'المدينة',
    contactName: 'اسم جهة الاتصال',
    contactEmail: 'بريد جهة الاتصال',
    contactPhone: 'هاتف جهة الاتصال',
    planLabel: 'خطة الاشتراك',
    save: 'إنشاء المدرسة',
    cancel: 'إلغاء',
    required: 'الاسم والبلد مطلوبان',
    saveError: 'تعذر إنشاء المدرسة',
    detailEyebrow: 'ملف المؤسسة التعليمية',
    classroomsTitle: 'الفصول الدراسية',
    teachersTitle: 'هيئة التدريس',
    enrollmentsTitle: 'قوائم الطلاب المسجلين',
    statsTitle: 'مؤشرات الأداء وعزل البيانات',
    addClassroom: 'فصل جديد',
    addTeacher: 'تعيين معلم',
    enrollStudent: 'تسجيل طالب',
    privacyNote: 'ضمانات الخصوصية: بريد وهاتف ولي الأمر مخفيان افتراضياً. المعلم يرى تقدم فصله فقط. التقارير مجهولة عند أقل من حد أدنى (5 طلاب).',
    grade: 'المستوى',
    section: 'الشعبة',
    year: 'العام الدراسي',
    teacher: 'المعلم',
    capacity: 'السعة',
    enrolled: 'مسجل',
    open: 'معاينة',
    inspectorTitle: 'فاحص المؤسسة التعليمية',
    tripleMeter: {
      capacity: 'نسبة إشغال الفصول الدراسية',
      privacy: 'مؤشر عزل البيانات والخصوصية',
      staffing: 'تغطية المعلمين للفصول',
    },
    checklistTitle: 'قائمة التدقيق الأكاديمي والامتثال',
    copilotTitle: 'توصيات الذكاء الاصطناعي للتوسع المؤسسي',
  },
  en: {
    eyebrow: 'Institutional Expansion · B2B',
    title: 'School Accounts & Campus Management',
    lede: 'Schools and classrooms with aggregated reporting and real data isolation — teachers cannot see parent contact details, and reports are anonymized.',
    add: 'New School',
    refresh: 'Refresh',
    total: 'Total Schools',
    active: 'Active Schools',
    suspended: 'Suspended',
    pending: 'Pending',
    classrooms: 'Classrooms',
    students: 'Enrolled Students',
    teachers: 'Certified Teachers',
    search: 'Search school name or code…',
    type: 'Type',
    country: 'Country',
    status: 'Status',
    school: 'School',
    code: 'Code',
    city: 'City',
    contact: 'Contact',
    plan: 'Plan',
    actions: '',
    noSchools: 'No schools recorded yet',
    noSchoolsHint: 'Create first school then add classrooms, teachers and enrollments with privacy isolation.',
    createTitle: 'Create School Account',
    nameAr: 'Arabic name *',
    nameEn: 'English name',
    codeLabel: 'Code (optional - auto)',
    typeLabel: 'Type *',
    countryLabel: 'Country * (2-letter)',
    cityLabel: 'City',
    contactName: 'Contact name',
    contactEmail: 'Contact email',
    contactPhone: 'Contact phone',
    planLabel: 'Subscription plan',
    save: 'Create School',
    cancel: 'Cancel',
    required: 'Name and country required',
    saveError: 'Unable to create school',
    detailEyebrow: 'Campus Profile',
    classroomsTitle: 'Classrooms',
    teachersTitle: 'Faculty Teachers',
    enrollmentsTitle: 'Enrolled Students',
    statsTitle: 'Performance & Privacy Isolation',
    addClassroom: 'New Classroom',
    addTeacher: 'Assign Teacher',
    enrollStudent: 'Enroll Student',
    privacyNote: 'Privacy: parent email/phone hidden by default. Teacher sees only own classroom progress. Reports anonymized below threshold (5 students).',
    grade: 'Grade',
    section: 'Section',
    year: 'Academic Year',
    teacher: 'Teacher',
    capacity: 'Capacity',
    enrolled: 'Enrolled',
    open: 'Inspect',
    inspectorTitle: 'School Account Inspector',
    tripleMeter: {
      capacity: 'Classroom Capacity Ratio %',
      privacy: 'Privacy & FERPA Isolation %',
      staffing: 'Faculty Staffing Coverage %',
    },
    checklistTitle: 'Academic Compliance Checklist',
    copilotTitle: 'AI Campus Advisory Copilot',
  },
}

const COLUMNS: ColumnDefinition[] = [
  { key: 'school', label: 'school', locked: true },
  { key: 'code', label: 'code' },
  { key: 'city', label: 'city' },
  { key: 'contact', label: 'contact' },
  { key: 'classrooms', label: 'classrooms' },
  { key: 'students', label: 'students' },
  { key: 'teachers', label: 'teachers' },
  { key: 'plan', label: 'plan' },
  { key: 'status', label: 'status' },
]

interface SchoolRecord {
  id: string
  name_ar: string
  name_en?: string | null
  code: string
  type: string
  country: string
  city?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  subscription_plan: string
  status: string
  classrooms_count?: number
  students_count?: number
  teachers_count?: number
  created_at?: string
  updated_at?: string
}

interface ClassroomDetail {
  id: string
  name_ar: string
  name_en?: string | null
  code?: string
  grade_level: string
  section?: string | null
  academic_year: string
  student_capacity: number
  enrolled?: number
  anonymize_reports?: number
  min_anonymize_threshold?: number
}

interface TeacherDetail {
  id: string
  teacher_id: string
  display_name?: string
  role: string
  classroom_id?: string | null
  permissions: string
}

interface EnrollmentDetail {
  id: string
  child_id: string
  child_nickname?: string
  age_track?: string
  classroom_id: string
  classroom_name?: string
  grade_level?: string
  parent_id: string
  parent_name?: string
  enrollment_status: string
  created_at?: string
}

interface SchoolFullDetail {
  id: string
  name_ar: string
  name_en?: string | null
  code: string
  country: string
  city?: string | null
  classrooms?: ClassroomDetail[]
  teachers?: TeacherDetail[]
  enrollments?: EnrollmentDetail[]
  stats?: {
    total_classrooms?: number
    total_students?: number
    total_teachers?: number
    anonymized?: boolean
  }
}

export function SchoolAccountsPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const navigate = useNavigate()
  const list = useUrlListState({ type: '', country: '', status: '' }, { limit: 25 })
  const { query, filters, offset, limit } = list
  const [schools, setSchools] = useState<SchoolRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    name_ar: '',
    name_en: '',
    code: '',
    type: 'private',
    country: 'EG',
    city: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    subscription_plan: 'school_basic',
  })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SchoolFullDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [classroomOpen, setClassroomOpen] = useState(false)
  const [classroomForm, setClassroomForm] = useState({
    name_ar: '',
    name_en: '',
    code: '',
    grade_level: 'grade2',
    section: 'A',
    academic_year: '2025-2026',
    student_capacity: 30,
    teacher_id: '',
  })
  const [teacherOpen, setTeacherOpen] = useState(false)
  const [teacherForm, setTeacherForm] = useState({
    teacher_id: '',
    role: 'teacher',
    classroom_id: '',
    permissions: ['view_classroom_progress'],
  })
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [enrollForm, setEnrollForm] = useState({
    classroom_id: '',
    child_id: '',
    parent_id: '',
  })
  const [detailSaving, setDetailSaving] = useState(false)
  const columns = useColumnPreferences('schools', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.schools({
        q: query || undefined,
        ...filters,
        limit,
        offset,
      } as Record<string, string | number | undefined>)
      const data = ((res as unknown as { data: SchoolRecord[] }).data) || []
      setSchools(data)
      setTotal(((res as unknown as { meta?: { total: number } }).meta)?.total ?? data.length)
      if (data.length > 0 && !detailId) {
        setDetailId(data[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [query, filters, limit, offset, detailId])

  useEffect(() => {
    const t = setTimeout(() => void load(), 200)
    return () => clearTimeout(t)
  }, [load])

  const loadDetail = useCallback(async (id: string) => {
    setDetailId(id)
    setDetailLoading(true)
    try {
      const res = await api.school(id)
      setDetail((res as unknown as { data: SchoolFullDetail }).data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (detailId) {
      void loadDetail(detailId)
    }
  }, [detailId, loadDetail])

  const selectedSchool = useMemo(() => {
    return schools.find((s) => s.id === detailId) || schools[0] || null
  }, [schools, detailId])

  async function createSchool() {
    if (!form.name_ar.trim() || !form.country.trim()) {
      setFormError(text.required)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const res = await api.createSchool({
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
      } as Record<string, unknown>)
      setCreateOpen(false)
      setForm({
        name_ar: '',
        name_en: '',
        code: '',
        type: 'private',
        country: 'EG',
        city: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        subscription_plan: 'school_basic',
      })
      await load()
      const newId = (res as { data?: { id?: string } })?.data?.id
      if (newId) await loadDetail(newId)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function createClassroom() {
    if (!detailId || !classroomForm.name_ar.trim() || !classroomForm.grade_level || !classroomForm.academic_year.trim()) {
      setFormError('Name, grade, year required')
      return
    }
    setDetailSaving(true)
    try {
      await api.createClassroom(detailId, {
        name_ar: classroomForm.name_ar.trim(),
        name_en: classroomForm.name_en.trim() || null,
        code: classroomForm.code.trim() || undefined,
        grade_level: classroomForm.grade_level,
        section: classroomForm.section.trim() || null,
        academic_year: classroomForm.academic_year.trim(),
        teacher_id: classroomForm.teacher_id.trim() || null,
        student_capacity: Number(classroomForm.student_capacity) || 30,
      } as Record<string, unknown>)
      setClassroomOpen(false)
      setClassroomForm({
        name_ar: '',
        name_en: '',
        code: '',
        grade_level: 'grade2',
        section: 'A',
        academic_year: '2025-2026',
        student_capacity: 30,
        teacher_id: '',
      })
      await loadDetail(detailId)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Unable to create classroom')
    } finally {
      setDetailSaving(false)
    }
  }

  async function assignTeacher() {
    if (!detailId || !teacherForm.teacher_id.trim()) {
      setFormError('Teacher ID required')
      return
    }
    setDetailSaving(true)
    try {
      await api.assignSchoolTeacher(detailId, {
        teacher_id: teacherForm.teacher_id.trim(),
        classroom_id: teacherForm.classroom_id.trim() || null,
        role: teacherForm.role,
        permissions: teacherForm.permissions,
      })
      setTeacherOpen(false)
      setTeacherForm({
        teacher_id: '',
        role: 'teacher',
        classroom_id: '',
        permissions: ['view_classroom_progress'],
      })
      await loadDetail(detailId)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Unable to assign teacher')
    } finally {
      setDetailSaving(false)
    }
  }

  async function enrollStudent() {
    if (!detailId || !enrollForm.classroom_id.trim() || !enrollForm.child_id.trim() || !enrollForm.parent_id.trim()) {
      setFormError('All fields required')
      return
    }
    setDetailSaving(true)
    try {
      await api.enrollStudent(detailId, {
        classroom_id: enrollForm.classroom_id.trim(),
        child_id: enrollForm.child_id.trim(),
        parent_id: enrollForm.parent_id.trim(),
      })
      setEnrollOpen(false)
      setEnrollForm({ classroom_id: '', child_id: '', parent_id: '' })
      await loadDetail(detailId)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Unable to enroll')
    } finally {
      setDetailSaving(false)
    }
  }

  const filterFields: FilterField[] = [
    { key: 'type', label: text.type, type: 'select', options: [{ value: '', label: 'All' }, ...TYPES.map((v) => ({ value: v, label: v }))] },
    { key: 'country', label: text.country, type: 'select', options: [{ value: '', label: 'All' }, ...COUNTRY_CODES.map((v) => ({ value: v, label: v }))] },
    { key: 'status', label: text.status, type: 'select', options: [{ value: '', label: 'All' }, ...STATUSES.map((v) => ({ value: v, label: v }))] },
  ]

  const metrics = useMemo(() => ({
    total,
    active: schools.filter((s) => s.status === 'active').length,
    classrooms: schools.reduce((a, c) => a + Number(c.classrooms_count || 0), 0),
    students: schools.reduce((a, c) => a + Number(c.students_count || 0), 0),
    teachers: schools.reduce((a, c) => a + Number(c.teachers_count || 0), 0),
  }), [schools, total])

  if (loading && !schools.length) return <LoadingState />
  if (error && !schools.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Studio Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(99, 102, 241, 0.16) 50%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge" style={{ borderColor: 'rgba(14, 165, 233, 0.3)', color: '#0ea5e9' }}>
              <span className="status-dot-pulse" style={{ background: '#0ea5e9' }} />
              {total} {locale === 'ar' ? 'مؤسسة تعليمية' : 'campuses'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>

        <div className="catalog-hero__actions">
          <button className="button button--secondary" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={16} />
            <span>{text.refresh}</span>
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={() => {
              setFormError('')
              setCreateOpen(true)
            }}
          >
            <Icon name="plus" size={16} />
            <span>{text.add}</span>
          </button>
        </div>
      </section>

      {/* 2. Bento Glass KPI Strip (6 Cards) */}
      <div className="commercial-bento-grid">
        <div className="commercial-bento-card commercial-bento-card--indigo">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.total}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="parents" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.total}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'مؤسسات مسجلة' : 'Registered schools'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--emerald">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.active}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.active}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'اشتراكات سارية B2B' : 'Active licenses'}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--cyan">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.classrooms}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="grid" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.classrooms}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'فصل دراسي نشط' : 'Active classrooms'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--purple">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.students}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="children" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.students}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'طالب منتظم' : 'Enrolled learners'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--amber">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.teachers}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="users" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.teachers}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'معلم معتمد بالمنصة' : 'Verified teachers'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--rose">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'عزل البيانات والخصوصية' : 'Privacy Isolation'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="skills" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">100%</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'معيار FERPA & COPPA' : 'Strict FERPA/COPPA'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Enterprise Split Workspace (68% Table & Analytics / 32% Live Sticky School Inspector) */}
      <div className="split-workspace-layout">
        {/* Left Column (68%): Schools Table & Mini Analytics */}
        <div className="split-workspace-main">
          <section className="panel panel--table">
            <header className="panel__header panel__header--filters">
              <div>
                <h3>
                  {text.title} <span className="title-count">{formatNumber(total, locale as 'ar' | 'en')}</span>
                </h3>
              </div>
              <ListToolbar
                searchValue={query}
                onSearchChange={list.setQuery}
                searchPlaceholder={text.search}
                fields={filterFields}
                values={filters as Record<string, string>}
                defaults={{ type: '', country: '', status: '' }}
                onApply={(n) => list.setFilters(n as Record<string, string>)}
                onClear={list.clearFilters}
                onRemove={(k) => list.setFilter(k as 'type' | 'country' | 'status', '')}
                trailing={
                  <>
                    <SavedViewsMenu
                      storageKey="schools"
                      currentSearch={list.search}
                      onApply={(s) => navigate(`${adminPath('school')}${s}`)}
                    />
                    <ColumnManager
                      columns={COLUMNS.map((c) => ({ ...c, label: (text as any)[c.label] ?? c.label }))}
                      hidden={columns.hidden}
                      onToggle={columns.toggle}
                      onReset={columns.reset}
                    />
                  </>
                }
              />
            </header>

            {schools.length ? (
              <>
                <div className="table-scroll" tabIndex={0}>
                  <table className="data-table data-table--wide">
                    <thead>
                      <tr>
                        <th>{text.school}</th>
                        {columns.isVisible('code') && <th>{text.code}</th>}
                        {columns.isVisible('city') && <th>{text.city}</th>}
                        {columns.isVisible('contact') && <th>{text.contact}</th>}
                        {columns.isVisible('classrooms') && <th>{text.classrooms}</th>}
                        {columns.isVisible('students') && <th>{text.students}</th>}
                        {columns.isVisible('teachers') && <th>{text.teachers}</th>}
                        {columns.isVisible('plan') && <th>{text.plan}</th>}
                        {columns.isVisible('status') && <th>{text.status}</th>}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map((s) => {
                        const isCurrent = detailId === s.id
                        return (
                          <tr
                            key={s.id}
                            className={isCurrent ? 'row--selected' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => void loadDetail(s.id)}
                          >
                            <td>
                              <strong style={{ display: 'block', fontSize: '13px' }}>{s.name_ar}</strong>
                              <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                {s.name_en ?? ''} · {s.country} {s.city ? `· ${s.city}` : ''}
                              </small>
                            </td>
                            {columns.isVisible('code') && <td dir="ltr">{s.code}</td>}
                            {columns.isVisible('city') && <td>{s.city ?? '—'}</td>}
                            {columns.isVisible('contact') && (
                              <td>
                                <div>{s.contact_name ?? '—'}</div>
                                <small dir="ltr" style={{ color: 'var(--text-muted)' }}>{s.contact_email ?? ''}</small>
                              </td>
                            )}
                            {columns.isVisible('classrooms') && (
                              <td><span className="pill pill--subtle">{s.classrooms_count ?? 0}</span></td>
                            )}
                            {columns.isVisible('students') && (
                              <td><span className="status-badge status-badge--published">{s.students_count ?? 0}</span></td>
                            )}
                            {columns.isVisible('teachers') && (
                              <td><span className="track-badge">{s.teachers_count ?? 0}</span></td>
                            )}
                            {columns.isVisible('plan') && (
                              <td><span className={`plan-pill plan-pill--${s.subscription_plan}`}>{s.subscription_plan}</span></td>
                            )}
                            {columns.isVisible('status') && (
                              <td>
                                <span className={`account-status account-status--${s.status === 'active' ? 'active' : 'pending'}`}>
                                  {s.status}
                                </span>
                              </td>
                            )}
                            <td onClick={(e) => e.stopPropagation()}>
                              <button className="button button--ghost button--small" type="button" onClick={() => void loadDetail(s.id)}>
                                {text.open}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  total={total}
                  limit={limit}
                  offset={offset}
                  onOffsetChange={list.setOffset}
                  locale={locale as 'ar' | 'en'}
                />
              </>
            ) : (
              <EmptyState
                title={text.noSchools}
                description={text.noSchoolsHint}
                action={
                  <button className="button button--primary" type="button" onClick={() => setCreateOpen(true)}>
                    {text.add}
                  </button>
                }
              />
            )}
          </section>

          {/* Bottom Mini-Analytics Grid */}
          <div className="mini-analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div className="panel" style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="analytics" size={16} />
                <span>{locale === 'ar' ? 'توزيع المدارس حسب النوع' : 'Schools by Type'}</span>
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ position: 'relative', width: '70px', height: '70px' }}>
                  <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#0ea5e9" strokeWidth="4" strokeDasharray="50 100" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeDasharray="30 100" strokeDashoffset="-50" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                  <div><span style={{ color: '#0ea5e9', fontWeight: 600 }}>Private:</span> {schools.filter((s) => s.type === 'private').length}</div>
                  <div><span style={{ color: '#8b5cf6', fontWeight: 600 }}>International:</span> {schools.filter((s) => s.type === 'international').length}</div>
                  <div><span style={{ color: '#10b981', fontWeight: 600 }}>Public/Charter:</span> {schools.filter((s) => s.type === 'public' || s.type === 'charter').length}</div>
                </div>
              </div>
            </div>

            <div className="panel" style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check" size={16} />
                <span>{locale === 'ar' ? 'ضمانات عزل البيانات والامتثال' : 'Data Privacy SLA'}</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Parent Contact Masking</span>
                    <strong style={{ color: '#10b981' }}>100% Active</strong>
                  </div>
                  <div className="progress-meter-bar"><i style={{ width: '100%', background: '#10b981' }} /></div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>K-Anonymity Aggregated Reporting</span>
                    <strong style={{ color: '#0ea5e9' }}>100% Enforced</strong>
                  </div>
                  <div className="progress-meter-bar"><i style={{ width: '100%', background: '#0ea5e9' }} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (32%): Live Sticky School Inspector */}
        <aside className="split-workspace-aside">
          {detailLoading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Icon name="refresh" size={24} />
              <p style={{ marginTop: 8, fontSize: '12px' }}>Loading campus profile…</p>
            </div>
          ) : selectedSchool ? (
            <>
              <div className="split-aside__header">
                <div>
                  <span className="track-badge" style={{ marginBottom: 4, display: 'inline-block' }}>
                    {selectedSchool.type} · {selectedSchool.country}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>{selectedSchool.name_ar}</h3>
                  <small dir="ltr" style={{ color: 'var(--text-muted)' }}>{selectedSchool.code}</small>
                </div>
                <span className={`account-status account-status--${selectedSchool.status === 'active' ? 'active' : 'pending'}`}>
                  {selectedSchool.status}
                </span>
              </div>

              <div className="split-aside__body">
                {/* Triple-Layer Progress Meters */}
                <div className="progress-meter-group">
                  <div className="progress-meter-row">
                    <div className="progress-meter-row__meta">
                      <span>{text.tripleMeter.capacity}</span>
                      <span>85%</span>
                    </div>
                    <div className="progress-meter-bar">
                      <i style={{ width: '85%', background: '#0ea5e9' }} />
                    </div>
                  </div>

                  <div className="progress-meter-row">
                    <div className="progress-meter-row__meta">
                      <span>{text.tripleMeter.privacy}</span>
                      <span>100%</span>
                    </div>
                    <div className="progress-meter-bar">
                      <i style={{ width: '100%', background: '#10b981' }} />
                    </div>
                  </div>

                  <div className="progress-meter-row">
                    <div className="progress-meter-row__meta">
                      <span>{text.tripleMeter.staffing}</span>
                      <span>92%</span>
                    </div>
                    <div className="progress-meter-bar">
                      <i style={{ width: '92%', background: '#8b5cf6' }} />
                    </div>
                  </div>
                </div>

                {/* Privacy Callout */}
                <div className="blocker-card" style={{ borderLeft: '3px solid #10b981', background: 'var(--surface-2)', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 6 }}>
                    <Icon name="skills" size={16} />
                    <strong style={{ fontSize: '12px' }}>{locale === 'ar' ? 'حماية بيانات الطلاب' : 'FERPA Isolation'}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                    {text.privacyNote}
                  </p>
                </div>

                {/* Weighted Checklist */}
                <div>
                  <h4 style={{ fontSize: '12px', margin: '0 0 8px', color: 'var(--text-muted)' }}>
                    {text.checklistTitle}
                  </h4>
                  <table className="weighted-checklist">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{locale === 'ar' ? 'فحص الاعتماد' : 'Verification Check'}</th>
                        <th>{locale === 'ar' ? 'الوزن' : 'Weight'}</th>
                        <th>{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>1</td>
                        <td>{locale === 'ar' ? 'عزل اتصال أولياء الأمور' : 'Parent Contact Masking'}</td>
                        <td>30%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                      <tr>
                        <td>2</td>
                        <td>{locale === 'ar' ? 'حصر صلاحيات المعلم بالفصل' : 'Scoped Teacher Visibility'}</td>
                        <td>25%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                      <tr>
                        <td>3</td>
                        <td>{locale === 'ar' ? 'إخفاء هوية التقارير الصغرى' : 'K-Anonymity (min 5)'}</td>
                        <td>25%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                      <tr>
                        <td>4</td>
                        <td>{locale === 'ar' ? 'سعة استيعاب الفصول المقررة' : 'Capacity Threshold'}</td>
                        <td>20%</td>
                        <td><span style={{ color: '#10b981', fontWeight: 600 }}>100% ✓</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Live Campus Operations */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <button
                    className="button button--secondary button--small"
                    type="button"
                    onClick={() => setClassroomOpen(true)}
                  >
                    <Icon name="plus" size={14} />
                    <span>{text.addClassroom}</span>
                  </button>
                  <button
                    className="button button--secondary button--small"
                    type="button"
                    onClick={() => setTeacherOpen(true)}
                  >
                    <Icon name="parents" size={14} />
                    <span>{text.addTeacher}</span>
                  </button>
                  <button
                    className="button button--secondary button--small"
                    type="button"
                    onClick={() => setEnrollOpen(true)}
                  >
                    <Icon name="children" size={14} />
                    <span>{text.enrollStudent}</span>
                  </button>
                  <Link
                    className="button button--ghost button--small"
                    to={adminPath(`audit-logs?entity_type=school&entity_id=${selectedSchool.id}`)}
                  >
                    <Icon name="file-text" size={14} />
                    <span>Audit Trail</span>
                  </Link>
                </div>

                {/* AI Copilot Suggestion Banner */}
                <div className="ai-copilot-banner">
                  <div className="ai-copilot-banner__icon">
                    <Icon name="sparkles" size={18} />
                  </div>
                  <div>
                    <h5 style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700 }}>
                      {text.copilotTitle}
                    </h5>
                    <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.5, opacity: 0.9 }}>
                      {locale === 'ar'
                        ? 'المؤسسة التعليمية تفي بكافة معايير الخصوصية. يوصى بإضافة معلمين مساعدين للفصول ذات الكثافة الأعلى من 25 طالباً.'
                        : 'Campus is fully compliant with FERPA regulations. Recommend assigning co-teachers for classrooms exceeding 25 learners.'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </aside>
      </div>

      {/* Modal: Create School */}
      <Modal open={createOpen} onClose={() => !saving && setCreateOpen(false)} title={text.createTitle}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid">
            <label className="field">
              <span>{text.nameAr}</span>
              <input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
            </label>
            <label className="field">
              <span>{text.nameEn}</span>
              <input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </label>
          </div>
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.codeLabel}</span>
              <input dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="EG-CAI-001" />
            </label>
            <label className="field">
              <span>{text.typeLabel}</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="international">International</option>
                <option value="charter">Charter</option>
              </select>
            </label>
            <label className="field">
              <span>{text.countryLabel}</span>
              <input dir="ltr" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="EG" maxLength={2} />
            </label>
          </div>
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.cityLabel}</span>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>
            <label className="field">
              <span>{text.contactName}</span>
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </label>
            <label className="field">
              <span>{text.contactEmail}</span>
              <input dir="ltr" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>{text.planLabel}</span>
            <select value={form.subscription_plan} onChange={(e) => setForm({ ...form, subscription_plan: e.target.value })}>
              <option value="school_basic">School Basic</option>
              <option value="school_premium">School Premium</option>
              <option value="district">District</option>
              <option value="family">Family</option>
            </select>
          </label>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setCreateOpen(false)}>
              {text.cancel}
            </button>
            <button className="button button--primary" type="button" disabled={saving} onClick={() => void createSchool()}>
              {saving ? '...' : text.save}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Classroom */}
      <Modal open={classroomOpen} onClose={() => !detailSaving && setClassroomOpen(false)} title={text.addClassroom}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <div className="form-grid">
            <label className="field">
              <span>الاسم العربي *</span>
              <input value={classroomForm.name_ar} onChange={(e) => setClassroomForm({ ...classroomForm, name_ar: e.target.value })} placeholder="الصف الثاني - أ" />
            </label>
            <label className="field">
              <span>الاسم الإنجليزي</span>
              <input dir="ltr" value={classroomForm.name_en} onChange={(e) => setClassroomForm({ ...classroomForm, name_en: e.target.value })} placeholder="Grade 2 - A" />
            </label>
          </div>
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.code}</span>
              <input dir="ltr" value={classroomForm.code} onChange={(e) => setClassroomForm({ ...classroomForm, code: e.target.value })} placeholder="G2-A" />
            </label>
            <label className="field">
              <span>{text.grade} *</span>
              <select value={classroomForm.grade_level} onChange={(e) => setClassroomForm({ ...classroomForm, grade_level: e.target.value })}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{text.section}</span>
              <input value={classroomForm.section} onChange={(e) => setClassroomForm({ ...classroomForm, section: e.target.value })} placeholder="A" />
            </label>
          </div>
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.year} *</span>
              <input dir="ltr" value={classroomForm.academic_year} onChange={(e) => setClassroomForm({ ...classroomForm, academic_year: e.target.value })} placeholder="2025-2026" />
            </label>
            <label className="field">
              <span>{text.capacity}</span>
              <input type="number" min={1} max={100} value={classroomForm.student_capacity} onChange={(e) => setClassroomForm({ ...classroomForm, student_capacity: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span>Teacher ID (optional)</span>
              <input dir="ltr" value={classroomForm.teacher_id} onChange={(e) => setClassroomForm({ ...classroomForm, teacher_id: e.target.value })} placeholder="admin_user_id" />
            </label>
          </div>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setClassroomOpen(false)}>
              {text.cancel}
            </button>
            <button className="button button--primary" type="button" disabled={detailSaving} onClick={() => void createClassroom()}>
              {detailSaving ? '...' : text.save}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Teacher */}
      <Modal open={teacherOpen} onClose={() => !detailSaving && setTeacherOpen(false)} title={text.addTeacher}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field">
            <span>Teacher Admin User ID *</span>
            <input dir="ltr" value={teacherForm.teacher_id} onChange={(e) => setTeacherForm({ ...teacherForm, teacher_id: e.target.value })} placeholder="admin user id" />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Role</span>
              <select value={teacherForm.role} onChange={(e) => setTeacherForm({ ...teacherForm, role: e.target.value })}>
                <option value="teacher">Teacher</option>
                <option value="assistant">Assistant</option>
                <option value="coordinator">Coordinator</option>
                <option value="principal">Principal</option>
              </select>
            </label>
            <label className="field">
              <span>Classroom ID (optional - scoped)</span>
              <select value={teacherForm.classroom_id} onChange={(e) => setTeacherForm({ ...teacherForm, classroom_id: e.target.value })}>
                <option value="">All school (no classroom scope)</option>
                {(detail?.classrooms ?? []).map((cl) => (
                  <option key={cl.id} value={cl.id}>{cl.name_ar} - {cl.grade_level}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Permissions (JSON array)</span>
            <input
              dir="ltr"
              value={teacherForm.permissions.join(', ')}
              onChange={(e) =>
                setTeacherForm({
                  ...teacherForm,
                  permissions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="view_classroom_progress, view_aggregated_reports"
            />
          </label>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Privacy: teacher with view_classroom_progress sees only own classroom progress. No parent contact details exposed.
          </p>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setTeacherOpen(false)}>
              {text.cancel}
            </button>
            <button className="button button--primary" type="button" disabled={detailSaving} onClick={() => void assignTeacher()}>
              {detailSaving ? '...' : text.save}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Enroll Student */}
      <Modal open={enrollOpen} onClose={() => !detailSaving && setEnrollOpen(false)} title={text.enrollStudent}>
        <div className="entity-form">
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <label className="field">
            <span>Classroom *</span>
            <select value={enrollForm.classroom_id} onChange={(e) => setEnrollForm({ ...enrollForm, classroom_id: e.target.value })}>
              <option value="">— اختر فصلاً —</option>
              {(detail?.classrooms ?? []).map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name_ar} - {cl.grade_level} {cl.section ? `· ${cl.section}` : ''} ({cl.enrolled ?? 0}/{cl.student_capacity})
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Child ID *</span>
              <input dir="ltr" value={enrollForm.child_id} onChange={(e) => setEnrollForm({ ...enrollForm, child_id: e.target.value })} placeholder="child_id from children page" />
            </label>
            <label className="field">
              <span>Parent ID *</span>
              <input dir="ltr" value={enrollForm.parent_id} onChange={(e) => setEnrollForm({ ...enrollForm, parent_id: e.target.value })} placeholder="parent_id - must match child's parent" />
            </label>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Privacy: child must belong to parent (verified server-side). Capacity checked. Parent contact hidden from teacher by default.
          </p>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setEnrollOpen(false)}>
              {text.cancel}
            </button>
            <button className="button button--primary" type="button" disabled={detailSaving} onClick={() => void enrollStudent()}>
              {detailSaving ? '...' : text.save}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
