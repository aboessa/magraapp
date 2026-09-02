import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts'
import { auditStatement, actorId } from '../lib/auditLog.ts'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()
route.use('*', requireAdmin)

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Schools list with stats ──
route.get('/schools', async (c) => {
  const q = c.req.query('q')?.trim()
  const country = c.req.query('country')?.trim()
  const type = c.req.query('type')?.trim()
  const status = c.req.query('status')?.trim()
  const limit = Math.min(Math.max(Number(c.req.query('limit') || 25), 1), 100)
  const offset = Math.max(Number(c.req.query('offset') || 0), 0)

  const clauses: string[] = []
  const params: any[] = []

  if (q) { clauses.push('(s.name_ar LIKE ? OR s.name_en LIKE ? OR s.code LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (country) { clauses.push('s.country = ?'); params.push(country) }
  if (type) { clauses.push('s.type = ?'); params.push(type) }
  if (status) { clauses.push('s.status = ?'); params.push(status) }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const totalRow = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) as total FROM schools s ${where}`, params)
  const total = totalRow?.total ?? 0

  const rows = await queryAll<any>(c.env.DB, `
    SELECT s.*,
      (SELECT COUNT(*) FROM classrooms cl WHERE cl.school_id = s.id AND cl.status='active') as classrooms_count,
      (SELECT COUNT(*) FROM school_enrollments se WHERE se.school_id = s.id AND se.enrollment_status='active') as students_count,
      (SELECT COUNT(*) FROM school_teachers st WHERE st.school_id = s.id AND st.is_active=1) as teachers_count
    FROM schools s
    ${where}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])

  return c.json({ success: true, data: rows, meta: { total, limit, offset } })
})

// ── School detail with classrooms + enrollments summary ──
route.get('/schools/:id', async (c) => {
  const id = c.req.param('id')
  const school = await queryFirst<any>(c.env.DB, `SELECT * FROM schools WHERE id=?`, [id])
  if (!school) return c.json({ success: false, error: 'School not found' }, 404)

  const classrooms = await queryAll<any>(c.env.DB, `
    SELECT cl.*,
      (SELECT COUNT(*) FROM school_enrollments se WHERE se.classroom_id = cl.id AND se.enrollment_status='active') as enrolled,
      au.display_name as teacher_name
    FROM classrooms cl
    LEFT JOIN admin_users au ON au.id = cl.teacher_id
    WHERE cl.school_id = ?
    ORDER BY cl.grade_level, cl.section
  `, [id])

  const teachers = await queryAll<any>(c.env.DB, `
    SELECT st.*, au.display_name, au.email
    FROM school_teachers st
    LEFT JOIN admin_users au ON au.id = st.teacher_id
    WHERE st.school_id = ? AND st.is_active=1
    ORDER BY st.role, au.display_name
  `, [id])

  const enrollments = await queryAll<any>(c.env.DB, `
    SELECT se.*,
      cp.nickname as child_nickname, cp.age_track,
      fp.display_name as parent_name
    FROM school_enrollments se
    LEFT JOIN child_projection cp ON cp.child_id = se.child_id
    LEFT JOIN family_projection fp ON fp.parent_id = se.parent_id
    WHERE se.school_id = ?
    ORDER BY se.created_at DESC
    LIMIT 100
  `, [id])

  // Aggregated stats with privacy threshold
  const stats = {
    total_classrooms: classrooms.length,
    total_students: enrollments.filter((e:any)=> e.enrollment_status==='active').length,
    total_teachers: teachers.length,
    by_grade: {} as Record<string, number>,
    anonymized: false,
  }
  for (const cl of classrooms) {
    stats.by_grade[cl.grade_level] = (stats.by_grade[cl.grade_level] || 0) + (cl.enrolled || 0)
  }
  // Anonymize if below threshold
  const minThreshold = Math.min(...classrooms.map((c:any)=> c.min_anonymize_threshold ?? 5), 5)
  if (stats.total_students > 0 && stats.total_students < minThreshold) {
    stats.anonymized = true
  }

  return c.json({ success: true, data: { ...school, classrooms, teachers, enrollments, stats } })
})

// ── Create school ──
route.post('/schools', requirePermission('manage_team'), async (c) => {
  const body = await c.req.json().catch(() => null) as any
  if (!body) return c.json({ success: false, error: 'JSON body required' }, 400)

  const name_ar = String(body.name_ar || '').trim()
  const country = String(body.country || '').trim().toUpperCase()
  if (!name_ar || name_ar.length < 2) return c.json({ success: false, error: 'name_ar required (2+ chars)' }, 400)
  if (!country || country.length !== 2) return c.json({ success: false, error: 'country required (2-letter code)' }, 400)

  const id = body.id ? String(body.id).trim() : genId('school')
  const code = body.code ? String(body.code).trim().toUpperCase() : `SCH-${Date.now().toString(36).toUpperCase()}`

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO schools (id, code, name_ar, name_en, type, country, region, city, district, address, contact_name, contact_email, contact_phone, subscription_plan, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, code,
        name_ar,
        body.name_en ? String(body.name_en).trim() : null,
        body.type || 'public',
        country,
        body.region ? String(body.region).trim() : null,
        body.city ? String(body.city).trim() : null,
        body.district ? String(body.district).trim() : null,
        body.address ? String(body.address).trim() : null,
        body.contact_name ? String(body.contact_name).trim() : null,
        body.contact_email ? String(body.contact_email).trim() : null,
        body.contact_phone ? String(body.contact_phone).trim() : null,
        body.subscription_plan || 'school_basic',
        body.status || 'active',
        actorId(c),
      ),
      auditStatement(c.env.DB, actorId(c), 'create', 'school', id, { name_ar, country, code }),
    ])
    return c.json({ success: true, data: { id, code } }, 201)
  } catch (e:any) {
    if (String(e?.message||'').includes('UNIQUE')) return c.json({ success: false, error: 'School code already exists' }, 409)
    return c.json({ success: false, error: 'Unable to create school' }, 500)
  }
})

// ── Update school ──
route.patch('/schools/:id', requirePermission('manage_team'), async (c) => {
  const id = c.req.param('id') as string
  const existing = await queryFirst<any>(c.env.DB, `SELECT id, is_system FROM schools WHERE id=?`, [id])
  if (!existing) return c.json({ success: false, error: 'School not found' }, 404)

  const body = await c.req.json().catch(() => null) as any
  if (!body) return c.json({ success: false, error: 'JSON body required' }, 400)

  const allowed = ['name_ar','name_en','type','country','region','city','district','address','contact_name','contact_email','contact_phone','subscription_plan','subscription_status','status','notes']
  const updates: string[] = []
  const params: any[] = []

  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates.push(`${key}=?`)
      params.push(body[key] === '' ? null : body[key])
    }
  }
  if (!updates.length) return c.json({ success: false, error: 'No fields to update' }, 400)

  updates.push(`updated_at=datetime('now')`)
  params.push(id)

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE schools SET ${updates.join(', ')} WHERE id=?`).bind(...params),
    auditStatement(c.env.DB, actorId(c), 'update', 'school', id, body),
  ])

  return c.json({ success: true, data: { id } })
})

// ── Classrooms ──
route.get('/schools/:id/classrooms', async (c) => {
  const schoolId = c.req.param('id') as string
  const rows = await queryAll<any>(c.env.DB, `
    SELECT cl.*,
      (SELECT COUNT(*) FROM school_enrollments se WHERE se.classroom_id=cl.id AND se.enrollment_status='active') as enrolled,
      au.display_name as teacher_name
    FROM classrooms cl
    LEFT JOIN admin_users au ON au.id = cl.teacher_id
    WHERE cl.school_id=?
    ORDER BY cl.grade_level, cl.section
  `, [schoolId])
  return c.json({ success: true, data: rows })
})

route.post('/schools/:id/classrooms', requirePermission('manage_team'), async (c) => {
  const schoolId = c.req.param('id') as string
  const school = await queryFirst<any>(c.env.DB, `SELECT id FROM schools WHERE id=?`, [schoolId])
  if (!school) return c.json({ success: false, error: 'School not found' }, 404)

  const body = await c.req.json().catch(() => null) as any
  if (!body) return c.json({ success: false, error: 'JSON body required' }, 400)

  const name_ar = String(body.name_ar || '').trim()
  const grade_level = String(body.grade_level || '').trim()
  const academic_year = String(body.academic_year || '').trim()
  if (!name_ar) return c.json({ success: false, error: 'name_ar required' }, 400)
  if (!grade_level) return c.json({ success: false, error: 'grade_level required' }, 400)
  if (!academic_year) return c.json({ success: false, error: 'academic_year required' }, 400)

  const id = body.id ? String(body.id).trim() : genId('class')
  const code = body.code ? String(body.code).trim().toUpperCase() : `${schoolId.slice(0,8).toUpperCase()}-${grade_level.toUpperCase()}-${Date.now().toString(36).slice(-3).toUpperCase()}`

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO classrooms (id, school_id, code, name_ar, name_en, grade_level, section, academic_year, teacher_id, student_capacity, anonymize_reports, min_anonymize_threshold, parent_visibility, teacher_can_see_parent_contact, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, schoolId, code, name_ar,
        body.name_en ? String(body.name_en).trim() : null,
        grade_level,
        body.section ? String(body.section).trim() : null,
        academic_year,
        body.teacher_id ? String(body.teacher_id).trim() : null,
        body.student_capacity ? Number(body.student_capacity) : 30,
        body.anonymize_reports !== false ? 1 : 0,
        body.min_anonymize_threshold ? Number(body.min_anonymize_threshold) : 5,
        body.parent_visibility || 'own_child_only',
        body.teacher_can_see_parent_contact ? 1 : 0,
        body.status || 'active',
      ),
      auditStatement(c.env.DB, actorId(c), 'create', 'classroom', id, { school_id: schoolId, name_ar, grade_level }),
    ])
    return c.json({ success: true, data: { id, code } }, 201)
  } catch (e:any) {
    if (String(e?.message||'').includes('UNIQUE')) return c.json({ success: false, error: 'Classroom code already exists in this school' }, 409)
    return c.json({ success: false, error: 'Unable to create classroom' }, 500)
  }
})

// ── Enrollments (privacy-aware) ──
route.get('/schools/:id/enrollments', async (c) => {
  const schoolId = c.req.param('id') as string
  const classroomId = c.req.query('classroom_id')?.trim()
  const status = c.req.query('status')?.trim() || 'active'
  const limit = Math.min(Math.max(Number(c.req.query('limit') || 50), 1), 100)
  const offset = Math.max(Number(c.req.query('offset') || 0), 0)

  // Privacy: teachers see only aggregated or own classroom — enforced via role check in future
  // For now, admin sees all but parent contact is hidden unless teacher_can_see_parent_contact

  const clauses = [`se.school_id = ?`, `se.enrollment_status = ?`]
  const params: any[] = [schoolId, status]
  if (classroomId) { clauses.push(`se.classroom_id = ?`); params.push(classroomId) }

  const rows = await queryAll<any>(c.env.DB, `
    SELECT se.*,
      cl.name_ar as classroom_name, cl.grade_level, cl.section,
      cl.teacher_can_see_parent_contact,
      cp.nickname as child_nickname, cp.age_track, cp.status as child_status,
      fp.display_name as parent_name
      -- parent email/phone intentionally NOT selected for privacy
    FROM school_enrollments se
    LEFT JOIN classrooms cl ON cl.id = se.classroom_id
    LEFT JOIN child_projection cp ON cp.child_id = se.child_id
    LEFT JOIN family_projection fp ON fp.parent_id = se.parent_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY se.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset])

  // Anonymize if below threshold for non-admin viewing classroom
  // For admin view, show count only if anonymized flag set and below threshold
  return c.json({ success: true, data: rows, meta: { limit, offset, privacy: 'parent_contact_hidden_by_default' } })
})

route.post('/schools/:id/enrollments', requirePermission('manage_team'), async (c) => {
  const schoolId = c.req.param('id') as string
  const body = await c.req.json().catch(() => null) as any
  if (!body) return c.json({ success: false, error: 'JSON body required' }, 400)

  const classroom_id = String(body.classroom_id || '').trim()
  const child_id = String(body.child_id || '').trim()
  const parent_id = String(body.parent_id || '').trim()
  if (!classroom_id || !child_id || !parent_id) return c.json({ success: false, error: 'classroom_id, child_id, parent_id required' }, 400)

  // Verify classroom belongs to school
  const cl = await queryFirst<any>(c.env.DB, `SELECT id, school_id, student_capacity, current_students FROM classrooms WHERE id=? AND school_id=?`, [classroom_id, schoolId])
  if (!cl) return c.json({ success: false, error: 'Classroom not found in this school' }, 404)

  // Check capacity
  const enrolledCount = await queryFirst<{ cnt: number }>(c.env.DB, `SELECT COUNT(*) as cnt FROM school_enrollments WHERE classroom_id=? AND enrollment_status='active'`, [classroom_id])
  if ((enrolledCount?.cnt ?? 0) >= (cl.student_capacity ?? 30)) return c.json({ success: false, error: 'Classroom capacity reached' }, 403)

  // Verify child exists and is active
  const child = await queryFirst<any>(c.env.DB, `SELECT child_id, parent_id FROM child_projection WHERE child_id=? AND status='active'`, [child_id])
  if (!child) return c.json({ success: false, error: 'Child not found or not active' }, 404)
  if (child.parent_id !== parent_id) return c.json({ success: false, error: 'Child does not belong to this parent' }, 400)

  const id = genId('enroll')

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO school_enrollments (id, school_id, classroom_id, parent_id, child_id, enrollment_status, enrolled_by)
        VALUES (?, ?, ?, ?, ?, 'active', ?)
      `).bind(id, schoolId, classroom_id, parent_id, child_id, actorId(c)),
      c.env.DB.prepare(`UPDATE classrooms SET current_students = current_students + 1, updated_at = datetime('now') WHERE id=?`).bind(classroom_id),
      auditStatement(c.env.DB, actorId(c), 'enroll', 'school_enrollment', id, { school_id: schoolId, classroom_id, child_id }),
    ])
    return c.json({ success: true, data: { id } }, 201)
  } catch (e:any) {
    if (String(e?.message||'').includes('UNIQUE')) return c.json({ success: false, error: 'Child already enrolled in this classroom' }, 409)
    return c.json({ success: false, error: 'Unable to enroll' }, 500)
  }
})

// ── Teachers assignment ──
route.post('/schools/:id/teachers', requirePermission('manage_team'), async (c) => {
  const schoolId = c.req.param('id') as string
  const body = await c.req.json().catch(() => null) as any
  if (!body?.teacher_id) return c.json({ success: false, error: 'teacher_id required' }, 400)

  const teacher_id = String(body.teacher_id).trim()
  const classroom_id = body.classroom_id ? String(body.classroom_id).trim() : null
  const role = body.role || 'teacher'

  // Verify teacher is admin_user
  const teacher = await queryFirst<any>(c.env.DB, `SELECT id FROM admin_users WHERE id=? AND is_active=1`, [teacher_id])
  if (!teacher) return c.json({ success: false, error: 'Teacher admin user not found or inactive' }, 404)

  const id = genId('st')

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO school_teachers (id, school_id, teacher_id, role, classroom_id, permissions, assigned_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(id, schoolId, teacher_id, role, classroom_id, JSON.stringify(body.permissions || ['view_classroom_progress','view_aggregated_reports']), actorId(c)),
      auditStatement(c.env.DB, actorId(c), 'assign_teacher', 'school', schoolId, { teacher_id, role, classroom_id }),
    ])
    return c.json({ success: true, data: { id } }, 201)
  } catch (e:any) {
    if (String(e?.message||'').includes('UNIQUE')) return c.json({ success: false, error: 'Teacher already assigned to this classroom in this school' }, 409)
    return c.json({ success: false, error: 'Unable to assign teacher' }, 500)
  }
})

export default route
