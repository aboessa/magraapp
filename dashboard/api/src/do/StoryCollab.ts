export class StoryCollab {
  private sql: SqlStorage

  constructor(private state: DurableObjectState) {
    this.sql = state.storage.sql
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS presence (user_id TEXT PRIMARY KEY, name TEXT, cursor_page INTEGER, updated_at INTEGER);
      CREATE TABLE IF NOT EXISTS locks (page_id TEXT PRIMARY KEY, user_id TEXT, locked_at INTEGER);
      CREATE TABLE IF NOT EXISTS ab_flags (key TEXT PRIMARY KEY, value_json TEXT);
    `)
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    if (path.endsWith('/presence') && request.method === 'POST') {
      const body: any = await request.json().catch(() => ({}))
      this.sql.exec(`INSERT OR REPLACE INTO presence (user_id, name, cursor_page, updated_at) VALUES (?,?,?,?)`, body.user_id, body.name, body.cursor_page ?? 1, Date.now())
      const rows = this.sql.exec(`SELECT * FROM presence WHERE updated_at > ?`, Date.now() - 60_000).toArray()
      return Response.json({ success: true, data: rows })
    }
    if (path.endsWith('/lock') && request.method === 'POST') {
      const body: any = await request.json().catch(() => ({}))
      const existing = this.sql.exec(`SELECT user_id FROM locks WHERE page_id=?`, body.page_id).toArray()[0] as any
      if (existing && existing.user_id !== body.user_id) return Response.json({ success: false, error: 'Page locked by another editor' }, { status: 409 })
      this.sql.exec(`INSERT OR REPLACE INTO locks (page_id, user_id, locked_at) VALUES (?,?,?)`, body.page_id, body.user_id, Date.now())
      return Response.json({ success: true, data: { locked: true } })
    }
    if (path.endsWith('/ab') && request.method === 'GET') {
      const rows = this.sql.exec(`SELECT * FROM ab_flags`).toArray()
      return Response.json({ success: true, data: rows })
    }
    return Response.json({ success: false, error: 'Not found' }, { status: 404 })
  }
}
