import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { pathParam } from '../lib/routeParams.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { requirePermission } from '../lib/adminAuth.ts'
import { actorId, auditStatement } from '../lib/auditLog.ts'
import { parsePagination } from '../lib/catalogueValidation.ts'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()

const TYPES = ['MULTIPLE_CHOICE','TRUE_FALSE','ORDERING','MATCHING','IMAGE_CHOICE'] as const
const STATUSES = ['draft','in_review','approved','archived'] as const
const DIFFICULTIES = ['easy','medium','hard'] as const

function isConstraint(e: unknown){ return /UNIQUE|constraint|FOREIGN KEY/i.test(e instanceof Error? e.message:String(e)) }

async function readBody(c:any):Promise<Record<string,unknown>|null>{
  const v=await c.req.json().catch(()=>null)
  return v && typeof v==='object' && !Array.isArray(v)? v as Record<string,unknown>: null
}
function text(v:unknown):string|null{ return typeof v==='string'&&v.trim()? v.trim(): null }
function nullableText(v:unknown):string|null|undefined{
  if(v===null||v==='') return null
  if(typeof v==='string') return v.trim()||null
  return undefined
}
function integer(v:unknown):number|null{ const n= typeof v==='number'? v: Number(v); return Number.isInteger(n)? n:null }

function validateQuestion(body: Record<string,unknown>, isUpdate=false){
  const out:any={}
  const errors:string[]=[]
  if(!isUpdate || body.code!==undefined){
    const code=text(body.code); if(!code) errors.push('code is required'); else out.code=code
  }
  if(!isUpdate || body.type!==undefined){
    const t=text(body.type); if(!t || !TYPES.includes(t as any)) errors.push('type must be one of: '+TYPES.join(', ')); else out.type=t
  }
  if(!isUpdate || body.prompt_ar!==undefined){
    const p=text(body.prompt_ar); if(!p) errors.push('prompt_ar is required'); else out.prompt_ar=p
  }
  if(body.prompt_en!==undefined){ const v=nullableText(body.prompt_en); if(v===undefined) errors.push('prompt_en must be text or null'); else out.prompt_en=v }
  if(body.explanation_ar!==undefined){ const v=nullableText(body.explanation_ar); if(v===undefined) errors.push('explanation_ar must be text or null'); else out.explanation_ar=v }
  if(body.learning_objective_id!==undefined){
    const v=nullableText(body.learning_objective_id); if(v===undefined) errors.push('learning_objective_id must be text or null'); else out.learning_objective_id=v
  }
  if(body.skill_id!==undefined){
    const v=nullableText(body.skill_id); if(v===undefined) errors.push('skill_id must be text or null'); else out.skill_id=v
  }
  const ageMin = body.age_min===undefined? (isUpdate? undefined: 3) : integer(body.age_min)
  const ageMax = body.age_max===undefined? (isUpdate? undefined: 5) : integer(body.age_max)
  if(ageMin!==undefined){
    if(ageMin===null || ageMin<3 || ageMin>12) errors.push('age_min must be 3-12'); else out.age_min=ageMin
  }
  if(ageMax!==undefined){
    if(ageMax===null || ageMax<3 || ageMax>12) errors.push('age_max must be 3-12'); else out.age_max=ageMax
  }
  if(out.age_min!==undefined && out.age_max!==undefined && out.age_max < out.age_min) errors.push('age_max must be >= age_min')
  if(body.difficulty!==undefined){
    const d=text(body.difficulty); if(!d || !DIFFICULTIES.includes(d as any)) errors.push('difficulty must be easy|medium|hard'); else out.difficulty=d
  }
  if(body.status!==undefined){
    const s=text(body.status); if(!s || !STATUSES.includes(s as any)) errors.push('status must be draft|in_review|approved|archived'); else out.status=s
  }
  if(body.correct_answer!==undefined){
    if(typeof body.correct_answer!=='object' || body.correct_answer===null || Array.isArray(body.correct_answer)) errors.push('correct_answer must be object')
    else out.correct_answer=body.correct_answer
  }
  if(body.distractors!==undefined){
    if(!Array.isArray(body.distractors)) errors.push('distractors must be array')
    else out.distractors=body.distractors
  }
  if(body.media_asset_id!==undefined){
    const v=nullableText(body.media_asset_id); if(v===undefined) errors.push('media_asset_id must be text or null'); else out.media_asset_id=v
  }
  return { errors, out }
}

route.get('/questions', async (c)=>{
  const db=c.env.DB
  const { limit, offset }=parsePagination(c.req.query('limit'), c.req.query('offset'))
  const q=c.req.query('q')?.trim()
  const type=c.req.query('type')
  const status=c.req.query('status')
  const objective=c.req.query('objective_id')
  const skill=c.req.query('skill_id')
  const difficulty=c.req.query('difficulty')
  const language=c.req.query('language')

  const clauses:string[]=[]; const params:unknown[]=[]
  if(q){ clauses.push('(q.code LIKE ? OR q.prompt_ar LIKE ? OR q.prompt_en LIKE ?)'); params.push(`%${q}%`,`%${q}%`,`%${q}%`) }
  if(type){ clauses.push('q.type = ?'); params.push(type) }
  if(status){ clauses.push('q.status = ?'); params.push(status) }
  if(objective){ clauses.push('q.learning_objective_id = ?'); params.push(objective) }
  if(skill){ clauses.push('q.skill_id = ?'); params.push(skill) }
  if(difficulty){ clauses.push('q.difficulty = ?'); params.push(difficulty) }
  if(language){
    clauses.push('EXISTS (SELECT 1 FROM question_localizations ql WHERE ql.question_id=q.id AND ql.language=?)'); params.push(language)
  }
  const where=clauses.length? `WHERE ${clauses.join(' AND ')}`:''
  const totalRow=await queryFirst<{total:number}>(db, `SELECT COUNT(*) as total FROM questions q ${where}`, params)
  const rows=await queryAll<any>(db, `
    SELECT q.*, lo.title_ar as objective_title, lo.code as objective_code, s.name_ar as skill_name,
      (SELECT COUNT(*) FROM question_localizations ql WHERE ql.question_id=q.id) as languages_count,
      (SELECT COUNT(*) FROM question_usage qu WHERE qu.question_id=q.id) as usage_count
    FROM questions q
    LEFT JOIN learning_objectives lo ON lo.id=q.learning_objective_id
    LEFT JOIN skills s ON s.id=q.skill_id
    ${where}
    ORDER BY q.updated_at DESC
    LIMIT ? OFFSET ?
  `,[...params, limit, offset])

  // summary metrics (unfiltered where meaningful, filtered where not)
  const summary=await queryFirst<any>(db, `SELECT
    (SELECT COUNT(*) FROM questions) as total,
    (SELECT COUNT(*) FROM questions WHERE status='draft') as draft,
    (SELECT COUNT(*) FROM questions WHERE status='in_review') as in_review,
    (SELECT COUNT(*) FROM questions WHERE status='approved') as approved,
    (SELECT COUNT(*) FROM questions WHERE learning_objective_id IS NULL) as missing_objective,
    (SELECT COUNT(*) FROM questions WHERE media_asset_id IS NULL) as missing_media
  `)

  return c.json({ success:true, data: rows.map((r:any)=>({ ...r, correct_answer: JSON.parse(r.correct_answer||'{}'), distractors: JSON.parse(r.distractors||'[]'), media_asset_ids: JSON.parse(r.media_asset_ids||'[]') })), meta:{ total: Number(totalRow?.total??0), limit, offset, summary }})
})

route.get('/questions/:id', async (c)=>{
  const db=c.env.DB
  const id=pathParam(c,'id')
  const row=await queryFirst<any>(db, `SELECT q.*, lo.title_ar as objective_title, lo.code as objective_code, s.name_ar as skill_name FROM questions q LEFT JOIN learning_objectives lo ON lo.id=q.learning_objective_id LEFT JOIN skills s ON s.id=q.skill_id WHERE q.id=?`,[id])
  if(!row) return c.json({ success:false, error:'Question not found' },404)
  const localizations=await queryAll<any>(db, `SELECT * FROM question_localizations WHERE question_id=? ORDER BY language`,[id])
  const reviews=await queryAll<any>(db, `SELECT * FROM question_reviews WHERE question_id=? ORDER BY created_at DESC`,[id])
  const usage=await queryAll<any>(db, `SELECT * FROM question_usage WHERE question_id=?`,[id])
  const history=await queryAll<any>(db, `SELECT * FROM audit_logs WHERE entity_type='question' AND entity_id=? ORDER BY created_at DESC LIMIT 20`,[id])
  return c.json({ success:true, data:{
    ...row,
    correct_answer: JSON.parse(row.correct_answer||'{}'),
    distractors: JSON.parse(row.distractors||'[]'),
    media_asset_ids: JSON.parse(row.media_asset_ids||'[]'),
    localizations: localizations.map((l:any)=>({ ...l, correct_answer: JSON.parse(l.correct_answer||'{}'), distractors: JSON.parse(l.distractors||'[]') })),
    reviews, usage, history
  }})
})

route.post('/questions', requirePermission('create'), async (c)=>{
  const body=await readBody(c); if(!body) return c.json({ success:false, error:'A JSON object is required' },400)
  const { errors, out }=validateQuestion(body,false)
  if(errors.length) return c.json({ success:false, error: errors[0], details: errors },400)
  // objective linkage required for assessment
  if(!out.learning_objective_id) return c.json({ success:false, error:'learning_objective_id is required for assessment questions' },400)
  const db=c.env.DB
  if(out.learning_objective_id && !await queryFirst(db, `SELECT id FROM learning_objectives WHERE id=?`,[out.learning_objective_id])) return c.json({ success:false, error:'Learning objective not found' },400)
  if(out.skill_id && !await queryFirst(db, `SELECT id FROM skills WHERE id=?`,[out.skill_id])) return c.json({ success:false, error:'Skill not found' },400)
  const id=crypto.randomUUID()
  try{
    await db.batch([
      db.prepare(`INSERT INTO questions (id, code, type, prompt_ar, prompt_en, explanation_ar, learning_objective_id, skill_id, age_min, age_max, difficulty, status, correct_answer, distractors, media_asset_id, media_asset_ids, version, created_by, updated_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        id, out.code, out.type, out.prompt_ar, out.prompt_en??null, out.explanation_ar??null, out.learning_objective_id??null, out.skill_id??null, out.age_min, out.age_max, out.difficulty??'medium', out.status??'draft', JSON.stringify(out.correct_answer??{}), JSON.stringify(out.distractors??[]), out.media_asset_id??null, JSON.stringify([]), 1, actorId(c), actorId(c)
      ),
      auditStatement(db, actorId(c), 'create','question',id,{ code: out.code, type: out.type, objective_id: out.learning_objective_id })
    ])
  }catch(e){ if(isConstraint(e)) return c.json({ success:false, error:'Question code already exists' },409); throw e }
  return c.json({ success:true, data:{ id, code: out.code } },201)
})

route.patch('/questions/:id', requirePermission('edit_metadata'), async (c)=>{
  const db=c.env.DB
  const id=pathParam(c,'id')
  const existing=await queryFirst<any>(db, `SELECT * FROM questions WHERE id=?`,[id])
  if(!existing) return c.json({ success:false, error:'Question not found' },404)
  if(existing.status==='approved' && (await queryFirst<{c:number}>(db, `SELECT COUNT(*) as c FROM attempts WHERE answers LIKE ?`,[`%${id}%`]))?.c){
    // versioning: approved questions with attempts cannot be silently mutated — increment version
  }
  const body=await readBody(c); if(!body) return c.json({ success:false, error:'A JSON object is required' },400)
  const { errors, out }=validateQuestion(body,true)
  if(errors.length) return c.json({ success:false, error: errors[0], details: errors },400)
  if(Object.keys(out).length===0) return c.json({ success:false, error:'No supported fields supplied' },400)
  if(out.learning_objective_id && !await queryFirst(db, `SELECT id FROM learning_objectives WHERE id=?`,[out.learning_objective_id])) return c.json({ success:false, error:'Learning objective not found' },400)
  if(out.skill_id && !await queryFirst(db, `SELECT id FROM skills WHERE id=?`,[out.skill_id])) return c.json({ success:false, error:'Skill not found' },400)

  const sets:string[]=[]; const params:unknown[]=[]
  const add=(col:string, val:unknown)=>{ sets.push(`${col} = ?`); params.push(val) }
  for(const [k,v] of Object.entries(out)){
    if(k==='correct_answer' || k==='distractors') add(k, JSON.stringify(v))
    else add(k, v)
  }
  // version bump if approved
  if(existing.status==='approved') add('version', Number(existing.version)+1)
  add('updated_at', new Date().toISOString())
  add('updated_by', actorId(c))

  try{
    await db.batch([
      db.prepare(`UPDATE questions SET ${sets.join(', ')} WHERE id=?`).bind(...params, id),
      auditStatement(db, actorId(c), 'update','question',id, body)
    ])
  }catch(e){ if(isConstraint(e)) return c.json({ success:false, error:'Question values conflict' },409); throw e }
  return c.json({ success:true, data:{ id, updated:true } })
})

route.delete('/questions/:id', requirePermission('archive'), async (c)=>{
  const db=c.env.DB
  const id=pathParam(c,'id')
  const row=await queryFirst<any>(db, `SELECT id, status FROM questions WHERE id=?`,[id])
  if(!row) return c.json({ success:false, error:'Question not found' },404)
  const usage=await queryFirst<{c:number}>(db, `SELECT COUNT(*) as c FROM question_usage WHERE question_id=?`,[id])
  const attempts=await queryFirst<{c:number}>(db, `SELECT COUNT(*) as c FROM attempts WHERE answers LIKE ?`,[`%${id}%`])
  if(Number(usage?.c??0)>0 || Number(attempts?.c??0)>0){
    await db.batch([
      db.prepare(`UPDATE questions SET status='archived', updated_at=datetime('now') WHERE id=?`).bind(id),
      auditStatement(db, actorId(c), 'archive','question',id,{ usage: usage?.c, attempts: attempts?.c })
    ])
    return c.json({ success:true, data:{ id, archived:true } })
  }
  await db.batch([ db.prepare(`DELETE FROM questions WHERE id=?`).bind(id), auditStatement(db, actorId(c), 'delete','question',id,{}) ])
  return c.json({ success:true, data:{ id, deleted:true } })
})

route.post('/questions/:id/review', requirePermission('review'), async (c)=>{
  const db=c.env.DB
  const id=pathParam(c,'id')
  if(!await queryFirst(db, `SELECT id FROM questions WHERE id=?`,[id])) return c.json({ success:false, error:'Question not found' },404)
  const body=await readBody(c); if(!body) return c.json({ success:false, error:'A JSON object is required' },400)
  const status=text(body.status); if(!status || !['pending','approved','rejected','needs_changes'].includes(status)) return c.json({ success:false, error:'Invalid status' },400)
  const comments=nullableText(body.comments); if(comments===undefined) return c.json({ success:false, error:'comments must be text or null' },400)
  if((status==='rejected' || status==='needs_changes') && !comments) return c.json({ success:false, error:'comments required for rejected/needs_changes' },400)
  const reviewRole=text(body.reviewer_role)??'edu'
  const rid=crypto.randomUUID()
  // map review status to question status
  const qStatus = status==='approved'? 'approved': status==='rejected'? 'draft': status==='needs_changes'? 'in_review':'in_review'
  await db.batch([
    db.prepare(`INSERT INTO question_reviews (id, question_id, reviewer_role, reviewer_id, status, comments) VALUES (?,?,?,?,?,?)`).bind(rid, id, reviewRole, actorId(c), status, comments),
    db.prepare(`UPDATE questions SET status=?, updated_at=datetime('now') WHERE id=?`).bind(qStatus, id),
    auditStatement(db, actorId(c), 'review','question',id,{ status, reviewer_role: reviewRole })
  ])
  return c.json({ success:true, data:{ id, status: qStatus } })
})

route.post('/questions/import', requirePermission('create'), async (c)=>{
  const body=await readBody(c); if(!body) return c.json({ success:false, error:'A JSON object is required' },400)
  const rows=body.questions
  if(!Array.isArray(rows)) return c.json({ success:false, error:'questions must be an array' },400)
  const errors:any[]=[]; const toInsert:any[]=[]
  for(let i=0;i<rows.length;i++){
    const r=rows[i] as Record<string,unknown>
    const { errors: e, out }=validateQuestion(r,false)
    if(e.length){ errors.push({ row:i+1, errors:e }); continue }
    if(!out.learning_objective_id) { errors.push({ row:i+1, errors:['learning_objective_id is required'] }); continue }
    toInsert.push(out)
  }
  if(errors.length) return c.json({ success:false, error:'Validation failed', details: errors.map(e=>`Row ${e.row}: ${e.errors.join(', ')}`), data:{ errors } },400)
  const ids:string[]=[]
  const batches: D1PreparedStatement[]=[]
  for(const out of toInsert){
    const id=crypto.randomUUID(); ids.push(id)
    batches.push(c.env.DB.prepare(`INSERT INTO questions (id, code, type, prompt_ar, prompt_en, explanation_ar, learning_objective_id, skill_id, age_min, age_max, difficulty, status, correct_answer, distractors, version, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id, out.code, out.type, out.prompt_ar, out.prompt_en??null, out.explanation_ar??null, out.learning_objective_id, out.skill_id??null, out.age_min, out.age_max, out.difficulty??'medium','draft', JSON.stringify(out.correct_answer??{}), JSON.stringify(out.distractors??[]),1, actorId(c), actorId(c)
    ))
  }
  batches.push(auditStatement(c.env.DB, actorId(c), 'import','question','batch',{ count: ids.length }))
  await c.env.DB.batch(batches)
  return c.json({ success:true, data:{ imported: ids.length, ids } })
})

route.get('/questions/export', async (c)=>{
  const db=c.env.DB
  const q=c.req.query('q')?.trim()
  const status=c.req.query('status')
  const clauses:string[]=[]; const params:unknown[]=[]
  if(q){ clauses.push('(code LIKE ? OR prompt_ar LIKE ?)'); params.push(`%${q}%`,`%${q}%`) }
  if(status){ clauses.push('status = ?'); params.push(status) }
  const where=clauses.length? `WHERE ${clauses.join(' AND ')}`:''
  const rows=await queryAll<any>(db, `SELECT * FROM questions ${where} ORDER BY code LIMIT 500`, params)
  return c.json({ success:true, data: rows.map((r:any)=>({ ...r, correct_answer: JSON.parse(r.correct_answer||'{}'), distractors: JSON.parse(r.distractors||'[]') })) })
})

export default route
