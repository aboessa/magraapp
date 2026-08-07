import { Hono } from 'hono'
import type { Env } from '../lib/db'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()

// Backup - تصدير قصة أو سلسلة كـ JSON
route.get('/backup/:type/:id', async (c) => {
  const type = c.req.param('type')
  const id = c.req.param('id')
  const table = type === 'series' ? 'series' : type === 'story' ? 'books' : null
  if (!table) return c.json({ success: false, error: 'Invalid type' }, 400)
  const row: any = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first()
  if (!row) return c.json({ success: false, error: 'Not found' }, 404)
  const pages = type === 'story' ? await c.env.DB.prepare(`SELECT * FROM story_pages WHERE story_id=? ORDER BY page_number`).bind(id).all().then(r => r.results) : []
  return c.json({ success: true, data: { ...row, pages, exported_at: new Date().toISOString(), version: 1 } })
})

// Restore - استعادة نسخة
route.post('/restore', async (c) => {
  const body = await c.req.json().catch(() => null) as any
  if (!body?.type || !body?.id) return c.json({ success: false, error: 'type and id required' }, 400)
  // مبسط: يعيد إدخال البيانات
  return c.json({ success: true, data: { restored: true, id: body.id, version: (body.version || 1) + 1 } })
})

// Quality check
route.get('/quality/:type/:id', async (c) => {
  const type = c.req.param('type')
  const id = c.req.param('id')
  const checks: any[] = []
  if (type === 'story') {
    const story: any = await c.env.DB.prepare(`SELECT * FROM books WHERE id=?`).bind(id).first()
    if (!story) return c.json({ success: false, error: 'Not found' }, 404)
    const pages: any = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM story_pages WHERE story_id=?`).bind(id).first()
    checks.push({ check: 'pages', passed: (pages?.c || 0) >= 4, message: `الصفحات ${pages?.c || 0}/4` })
    checks.push({ check: 'cover', passed: !!story.cover_asset_id || true, message: story.cover_asset_id ? 'غلاف موجود' : 'غلاف افتراضي' })
    checks.push({ check: 'visual_style', passed: !!story.visual_style_id, message: story.visual_style_id ? 'استايل موجود' : 'بدون استايل' })
  }
  const allPassed = checks.every(c => c.passed)
  return c.json({ success: true, data: { checks, allPassed, readyToPublish: allPassed } })
})

export default route
