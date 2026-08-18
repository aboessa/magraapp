import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { pathParam } from '../lib/routeParams.ts'
import { queryAll, queryFirst } from '../lib/db.ts'
import { requirePermission } from '../lib/adminAuth.ts'
import { actorId, auditStatement } from '../lib/auditLog.ts'
import { parsePagination } from '../lib/catalogueValidation.ts'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()

function isConstraint(e:unknown){ return /UNIQUE|constraint|FOREIGN KEY/i.test(e instanceof Error? e.message:String(e)) }
async function readBody(c:any):Promise<Record<string,unknown>|null>{ const v=await c.req.json().catch(()=>null); return v && typeof v==='object' && !Array.isArray(v)? v as Record<string,unknown>:null }
function text(v:unknown):string|null{ return typeof v==='string'&&v.trim()? v.trim():null }
function nullableText(v:unknown):string|null|undefined{ if(v===null||v==='') return null; if(typeof v==='string') return v.trim()||null; return undefined }

// Translation units — queue over story_page_localizations + other entities
// For now aggregates story pages; other entity types are extensible via translation_units table.

route.get('/translation/queue', async (c)=>{
  const db=c.env.DB
  const { limit, offset }=parsePagination(c.req.query('limit'), c.req.query('offset'))
  const entityType=c.req.query('entity_type')
  const targetLang=c.req.query('target_language')
  const status=c.req.query('status')
  const stale=c.req.query('stale')
  const planet=c.req.query('planet_id')
  const search=c.req.query('q')?.trim()

  // If translation_units has rows, serve them; otherwise compute queue from story_page_localizations + story_pages
  const countTU=await queryFirst<{c:number}>(db, `SELECT COUNT(*) as c FROM translation_units`)
  if(Number(countTU?.c??0)>0){
    const clauses:string[]=[]; const params:unknown[]=[]
    if(entityType){ clauses.push('entity_type = ?'); params.push(entityType) }
    if(targetLang){ clauses.push('target_language = ?'); params.push(targetLang) }
    if(status){ clauses.push('status = ?'); params.push(status) }
    if(stale==='1'){ clauses.push("status='stale'") }
    if(search){ clauses.push('(source_text LIKE ? OR target_text LIKE ?)'); params.push(`%${search}%`,`%${search}%`) }
    const where=clauses.length? `WHERE ${clauses.join(' AND ')}`:''
    const totalRow=await queryFirst<{total:number}>(db, `SELECT COUNT(*) as total FROM translation_units ${where}`, params)
    const rows=await queryAll<any>(db, `SELECT tu.*, s.title_ar as context_title FROM translation_units tu LEFT JOIN stories s ON s.id=tu.entity_id ${where} ORDER BY tu.updated_at DESC LIMIT ? OFFSET ?`,[...params, limit, offset])
    const summary=await queryFirst<any>(db, `SELECT
      (SELECT COUNT(*) FROM translation_units WHERE status='pending') as pending,
      (SELECT COUNT(*) FROM translation_units WHERE status='in_translation') as in_translation,
      (SELECT COUNT(*) FROM translation_units WHERE status='ready_for_review') as ready_for_review,
      (SELECT COUNT(*) FROM translation_units WHERE status='approved') as approved,
      (SELECT COUNT(*) FROM translation_units WHERE status='stale') as stale,
      (SELECT COUNT(*) FROM translation_units WHERE target_language='en') as en_total,
      (SELECT COUNT(*) FROM translation_units WHERE target_language='en' AND status='approved') as en_approved,
      (SELECT COUNT(*) FROM translation_units WHERE target_language='fr') as fr_total,
      (SELECT COUNT(*) FROM translation_units WHERE target_language='fr' AND status='approved') as fr_approved
    `)
    return c.json({ success:true, data: rows, meta:{ total: Number(totalRow?.total??0), limit, offset, summary }})
  }

  // Fallback: compute from story_page_localizations
  // Each story_page * language is a unit. Source is AR page text.
  const clauses:string[]=[]; const params:unknown[]=[]
  if(search){ clauses.push('(sp.id LIKE ? OR s.title_ar LIKE ? OR spl.body_text LIKE ?)'); params.push(`%${search}%`,`%${search}%`,`%${search}%`) }
  if(planet){
    clauses.push('s.series_id IN (SELECT id FROM series WHERE planet_id=?)'); params.push(planet)
  }
  const whereExtra=clauses.length? `AND ${clauses.join(' AND ')}`:''

  // languages to check: en, fr. For each page, check if localization exists
  const allPages=await queryAll<any>(db, `
    SELECT sp.id as page_id, sp.story_id, sp.page_number, s.title_ar, s.slug, s.default_language,
      sp.image_asset_id, spl_en.body_text as en_text, spl_fr.body_text as fr_text, spl_ar.body_text as ar_text,
      spl_en.updated_at as en_updated, spl_fr.updated_at as fr_updated, sp.updated_at as source_updated
    FROM story_pages sp
    JOIN stories s ON s.id=sp.story_id
    LEFT JOIN story_page_localizations spl_ar ON spl_ar.page_id=sp.id AND spl_ar.language='ar'
    LEFT JOIN story_page_localizations spl_en ON spl_en.page_id=sp.id AND spl_en.language='en'
    LEFT JOIN story_page_localizations spl_fr ON spl_fr.page_id=sp.id AND spl_fr.language='fr'
    WHERE 1=1 ${whereExtra}
    ORDER BY s.title_ar, sp.page_number
    LIMIT ? OFFSET ?
  `,[...params, limit, offset])

  const totalPagesRow=await queryFirst<{total:number}>(db, `SELECT COUNT(*) as total FROM story_pages sp JOIN stories s ON s.id=sp.story_id WHERE 1=1 ${whereExtra}`, params)

  // Expand each page into translation units (en, fr)
  const queue:any[]=[]
  for(const p of allPages){
    const sourceText = p.ar_text || ''
    const isStaleEn = p.en_text && p.source_updated && p.en_updated && p.source_updated > p.en_updated
    const isStaleFr = p.fr_text && p.source_updated && p.fr_updated && p.source_updated > p.fr_updated
    if(!targetLang || targetLang==='en'){
      const statusEn = !p.en_text? 'pending': isStaleEn? 'stale': 'approved'
      if(!status || status===statusEn){
        queue.push({
          id: `${p.page_id}:en`,
          entity_type: 'story_page',
          entity_id: p.page_id,
          field: 'body_text',
          source_language: 'ar',
          source_text: sourceText.slice(0,200),
          source_version: 1,
          target_language: 'en',
          target_text: p.en_text? p.en_text.slice(0,200): null,
          status: statusEn,
          stale: !!isStaleEn,
          context_title: `${p.title_ar} — ص ${p.page_number}`,
          context_image: p.image_asset_id,
          story_id: p.story_id,
          page_number: p.page_number,
        })
      }
    }
    if(!targetLang || targetLang==='fr'){
      const statusFr = !p.fr_text? 'pending': isStaleFr? 'stale': 'approved'
      if(!status || status===statusFr){
        queue.push({
          id: `${p.page_id}:fr`,
          entity_type: 'story_page',
          entity_id: p.page_id,
          field: 'body_text',
          source_language: 'ar',
          source_text: sourceText.slice(0,200),
          source_version: 1,
          target_language: 'fr',
          target_text: p.fr_text? p.fr_text.slice(0,200): null,
          status: statusFr,
          stale: !!isStaleFr,
          context_title: `${p.title_ar} — ص ${p.page_number}`,
          context_image: p.image_asset_id,
          story_id: p.story_id,
          page_number: p.page_number,
        })
      }
    }
  }

  // Summary from computed queue (approx)
  const enApproved = queue.filter(q=>q.target_language==='en' && q.status==='approved').length
  const frApproved = queue.filter(q=>q.target_language==='fr' && q.status==='approved').length
  const pending = queue.filter(q=>q.status==='pending').length
  const staleCount = queue.filter(q=>q.status==='stale').length

  return c.json({ success:true, data: queue, meta:{ total: Number(totalPagesRow?.total??0)*2, limit, offset, summary:{ pending, stale: staleCount, en_approved: enApproved, fr_approved: frApproved } }})
})

route.get('/translation/units/:id', async (c)=>{
  const db=c.env.DB
  const id=pathParam(c,'id')
  // Try translation_units first
  let unit=await queryFirst<any>(db, `SELECT * FROM translation_units WHERE id=?`,[id])
  if(unit){
    // enrich context
    if(unit.entity_type==='story_page'){
      const page=await queryFirst<any>(db, `SELECT sp.*, s.title_ar, s.slug, sp.image_asset_id FROM story_pages sp JOIN stories s ON s.id=sp.story_id WHERE sp.id=?`,[unit.entity_id])
      const siblings=await queryAll<any>(db, `SELECT id, page_number FROM story_pages WHERE story_id=? ORDER BY page_number`,[page?.story_id])
      const tm=await queryAll<any>(db, `SELECT * FROM translation_memory WHERE source_text=? AND source_language=? AND target_language=? LIMIT 5`,[unit.source_text, unit.source_language, unit.target_language])
      const glossary=await queryAll<any>(db, `SELECT * FROM glossary_terms WHERE ? LIKE '%' || source_term || '%' LIMIT 5`,[unit.source_text])
      return c.json({ success:true, data:{ ...unit, context: page, siblings, translation_memory: tm, glossary } })
    }
    return c.json({ success:true, data: unit })
  }
  // Fallback: story_page composite id like pageId:lang
  const [pageId, lang]=id.split(':')
  if(pageId && lang){
    const page=await queryFirst<any>(db, `SELECT sp.*, s.title_ar, s.slug, s.default_language FROM story_pages sp JOIN stories s ON s.id=sp.story_id WHERE sp.id=?`,[pageId])
    if(page){
      const loc=await queryFirst<any>(db, `SELECT * FROM story_page_localizations WHERE page_id=? AND language=?`,[pageId, lang])
      const sourceLoc=await queryFirst<any>(db, `SELECT * FROM story_page_localizations WHERE page_id=? AND language='ar'`,[pageId])
      const siblings=await queryAll<any>(db, `SELECT id, page_number FROM story_pages WHERE story_id=? ORDER BY page_number`,[page.story_id])
      const tm=await queryAll<any>(db, `SELECT * FROM translation_memory WHERE source_text=? AND source_language='ar' AND target_language=? LIMIT 5`,[sourceLoc?.body_text?.slice(0,100)??'', lang])
      const glossary=await queryAll<any>(db, `SELECT * FROM glossary_terms LIMIT 5`)
      return c.json({ success:true, data:{
        id,
        entity_type:'story_page',
        entity_id: pageId,
        field:'body_text',
        source_language:'ar',
        source_text: sourceLoc?.body_text??'',
        source_version:1,
        target_language:lang,
        target_text: loc?.body_text??'',
        status: loc? (loc.updated_at < page.updated_at ? 'stale':'approved'):'pending',
        context: page,
        siblings,
        translation_memory: tm,
        glossary,
        thumbnail: page.image_asset_id
      }})
    }
  }
  return c.json({ success:false, error:'Translation unit not found' },404)
})

route.put('/translation/units/:id', requirePermission('edit_text'), async (c)=>{
  const db=c.env.DB
  const id=pathParam(c,'id')
  const body=await readBody(c); if(!body) return c.json({ success:false, error:'A JSON object is required' },400)
  const targetText=text(body.target_text)
  if(!targetText) return c.json({ success:false, error:'target_text is required' },400)
  const status=text(body.status)??'in_translation'

  // Check if it's a translation_units row
  const existing=await queryFirst<any>(db, `SELECT * FROM translation_units WHERE id=?`,[id])
  if(existing){
    const isReauthor = body.is_reauthor===true?1:0
    await db.batch([
      db.prepare(`UPDATE translation_units SET target_text=?, status=?, updated_at=datetime('now'), translator_id=? WHERE id=?`).bind(targetText, status, actorId(c), id),
      auditStatement(db, actorId(c), 'update','translation_unit',id,{ target_text: targetText.slice(0,50), status })
    ])
    // upsert translation memory if approved
    if(status==='approved'){
      await db.prepare(`INSERT OR REPLACE INTO translation_memory (id, source_text, source_language, target_language, target_text, entity_type, usage_count) VALUES (?,?,?,?,?,?, COALESCE((SELECT usage_count FROM translation_memory WHERE source_text=? AND source_language=? AND target_language=?),0)+1)`).bind(
        crypto.randomUUID(), existing.source_text, existing.source_language, existing.target_language, targetText, existing.entity_type, existing.source_text, existing.source_language, existing.target_language
      ).run()
    }
    return c.json({ success:true, data:{ id, status } })
  }
  // Fallback: write to story_page_localizations
  const [pageId, lang]=id.split(':')
  if(pageId && lang && ['en','fr'].includes(lang)){
    const page=await queryFirst<any>(db, `SELECT id FROM story_pages WHERE id=?`,[pageId])
    if(!page) return c.json({ success:false, error:'Story page not found' },404)
    // Glossary check: flag if source contains character name but target doesn't contain approved translation
    await db.batch([
      db.prepare(`INSERT INTO story_page_localizations (page_id, language, body_text, updated_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(page_id, language) DO UPDATE SET body_text=excluded.body_text, updated_at=datetime('now')`).bind(pageId, lang, targetText),
      auditStatement(db, actorId(c), 'update','story_page_localization',pageId,{ language: lang, target_text: targetText.slice(0,50) })
    ])
    return c.json({ success:true, data:{ id, status:'approved' } })
  }
  return c.json({ success:false, error:'Translation unit not found' },404)
})

route.post('/translation/units/:id/review', requirePermission('review'), async (c)=>{
  const db=c.env.DB
  const id=pathParam(c,'id')
  const body=await readBody(c); if(!body) return c.json({ success:false, error:'A JSON object is required' },400)
  const status=text(body.status); if(!status || !['approved','rejected','needs_changes','pending'].includes(status)) return c.json({ success:false, error:'Invalid status' },400)
  const comments=nullableText(body.comments)
  const unit=await queryFirst<any>(db, `SELECT * FROM translation_units WHERE id=?`,[id])
  if(unit){
    const newStatus=status==='approved'? 'approved': status==='rejected'? 'changes_requested':'ready_for_review'
    await db.batch([
      db.prepare(`INSERT INTO translation_reviews (id, unit_id, reviewer_role, reviewer_id, status, comments) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(), id, 'lang', actorId(c), status, comments),
      db.prepare(`UPDATE translation_units SET status=?, reviewer_id=?, updated_at=datetime('now') WHERE id=?`).bind(newStatus, actorId(c), id),
      auditStatement(db, actorId(c), 'review','translation_unit',id,{ status })
    ])
    return c.json({ success:true, data:{ id, status: newStatus } })
  }
  return c.json({ success:false, error:'Translation unit not found' },404)
})

// Glossary
route.get('/glossary', async (c)=>{
  const db=c.env.DB
  const { limit, offset }=parsePagination(c.req.query('limit'), c.req.query('offset'))
  const q=c.req.query('q')?.trim()
  const category=c.req.query('category')
  const clauses:string[]=[]; const params:unknown[]=[]
  if(q){ clauses.push('(source_term LIKE ? OR translations LIKE ?)'); params.push(`%${q}%`,`%${q}%`) }
  if(category){ clauses.push('category = ?'); params.push(category) }
  const where=clauses.length? `WHERE ${clauses.join(' AND ')}`:''
  const totalRow=await queryFirst<{total:number}>(db, `SELECT COUNT(*) as total FROM glossary_terms ${where}`, params)
  const rows=await queryAll<any>(db, `SELECT * FROM glossary_terms ${where} ORDER BY source_term LIMIT ? OFFSET ?`,[...params, limit, offset])
  return c.json({ success:true, data: rows.map((r:any)=>({ ...r, translations: JSON.parse(r.translations||'{}') })), meta:{ total: Number(totalRow?.total??0), limit, offset }})
})

route.post('/glossary', requirePermission('create'), async (c)=>{
  const body=await readBody(c); if(!body) return c.json({ success:false, error:'A JSON object is required' },400)
  const sourceTerm=text(body.source_term); if(!sourceTerm) return c.json({ success:false, error:'source_term is required' },400)
  const translations=body.translations
  if(!translations || typeof translations!=='object' || Array.isArray(translations)) return c.json({ success:false, error:'translations must be object' },400)
  const scope=text(body.scope)??'global'
  const category=text(body.category)??'general'
  const status=text(body.status)??'approved'
  const notes=nullableText(body.notes)
  const id=crypto.randomUUID()
  try{
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO glossary_terms (id, source_term, source_language, translations, scope, category, status, notes) VALUES (?,?,?,?,?,?,?,?)`).bind(id, sourceTerm, 'ar', JSON.stringify(translations), scope, category, status, notes),
      auditStatement(c.env.DB, actorId(c), 'create','glossary_term',id,{ source_term: sourceTerm })
    ])
  }catch(e){ if(isConstraint(e)) return c.json({ success:false, error:'Glossary term already exists for this scope' },409); throw e }
  return c.json({ success:true, data:{ id } },201)
})

route.patch('/glossary/:id', requirePermission('edit_metadata'), async (c)=>{
  const db=c.env.DB
  const id=pathParam(c,'id')
  if(!await queryFirst(db, `SELECT id FROM glossary_terms WHERE id=?`,[id])) return c.json({ success:false, error:'Glossary term not found' },404)
  const body=await readBody(c); if(!body) return c.json({ success:false, error:'A JSON object is required' },400)
  const sets:string[]=[]; const params:unknown[]=[]
  if(body.source_term!==undefined){ const v=text(body.source_term); if(!v) return c.json({ success:false, error:'source_term cannot be empty' },400); sets.push('source_term=?'); params.push(v) }
  if(body.translations!==undefined){ if(typeof body.translations!=='object' || Array.isArray(body.translations)) return c.json({ success:false, error:'translations must be object' },400); sets.push('translations=?'); params.push(JSON.stringify(body.translations)) }
  if(body.scope!==undefined){ const v=text(body.scope); if(!v) return c.json({ success:false, error:'scope cannot be empty' },400); sets.push('scope=?'); params.push(v) }
  if(body.category!==undefined){ const v=text(body.category); if(!v) return c.json({ success:false, error:'category cannot be empty' },400); sets.push('category=?'); params.push(v) }
  if(body.status!==undefined){ const v=text(body.status); if(!v) return c.json({ success:false, error:'status cannot be empty' },400); sets.push('status=?'); params.push(v) }
  if(body.notes!==undefined){ const v=nullableText(body.notes); if(v===undefined) return c.json({ success:false, error:'notes must be text or null' },400); sets.push('notes=?'); params.push(v) }
  if(!sets.length) return c.json({ success:false, error:'No supported fields supplied' },400)
  sets.push(`updated_at=datetime('now')`)
  await db.batch([ db.prepare(`UPDATE glossary_terms SET ${sets.join(', ')} WHERE id=?`).bind(...params, id), auditStatement(db, actorId(c), 'update','glossary_term',id,body) ])
  return c.json({ success:true, data:{ id } })
})

route.delete('/glossary/:id', requirePermission('archive'), async (c)=>{
  const id=pathParam(c,'id')
  if(!await queryFirst(c.env.DB, `SELECT id FROM glossary_terms WHERE id=?`,[id])) return c.json({ success:false, error:'Glossary term not found' },404)
  await c.env.DB.batch([ c.env.DB.prepare(`DELETE FROM glossary_terms WHERE id=?`).bind(id), auditStatement(c.env.DB, actorId(c), 'delete','glossary_term',id,{}) ])
  return c.json({ success:true, data:{ id, deleted:true } })
})

// Translation memory search
route.get('/translation/memory', async (c)=>{
  const db=c.env.DB
  const q=c.req.query('q')?.trim()
  const sourceLang=c.req.query('source_language')??'ar'
  const targetLang=c.req.query('target_language')??'en'
  if(!q) return c.json({ success:true, data:[] })
  const rows=await queryAll<any>(db, `SELECT * FROM translation_memory WHERE source_language=? AND target_language=? AND source_text LIKE ? ORDER BY usage_count DESC LIMIT 5`,[sourceLang, targetLang, `%${q.slice(0,30)}%`])
  return c.json({ success:true, data: rows })
})

export default route
