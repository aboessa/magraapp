import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { apiRoot } from '../lib/api'

/// Public legal pages: `/legal/privacy`, `/legal/children-privacy`,
/// `/legal/terms`, `/legal/delete-account`.
///
/// Outside the site-mode gate on purpose: store listings and the app link here
/// while the site is still "under construction". Only the published copy is
/// served by the API. The body is a small Markdown subset rendered as React
/// elements; no HTML from the server is ever injected.

type LegalDoc = { slug: string; title: string; body: string; version: number; published_at: string }
type State = { kind: 'loading' } | { kind: 'ready'; doc: LegalDoc } | { kind: 'missing' } | { kind: 'error' }

const LINKS = [
  { slug: 'privacy', label: 'سياسة الخصوصية' },
  { slug: 'children-privacy', label: 'خصوصية الأطفال' },
  { slug: 'terms', label: 'شروط الاستخدام' },
  { slug: 'delete-account', label: 'حذف الحساب' },
]

/// `## heading`, `- bullet`, `1. step`, blank-line paragraphs. Everything is text.
export function renderLegalBody(body: string): ReactNode[] {
  const out: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let paragraph: string[] = []
  const flushParagraph = () => {
    if (paragraph.length) out.push(<p key={`p${out.length}`} style={{ lineHeight: 1.9, margin: '0 0 14px' }}>{paragraph.join(' ')}</p>)
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    const items = list.items.map((item, i) => <li key={i} style={{ marginBottom: 6, lineHeight: 1.8 }}>{item}</li>)
    out.push(list.ordered
      ? <ol key={`l${out.length}`} style={{ paddingInlineStart: 22, margin: '0 0 14px' }}>{items}</ol>
      : <ul key={`l${out.length}`} style={{ paddingInlineStart: 22, margin: '0 0 14px' }}>{items}</ul>)
    list = null
  }
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    const step = /^\d+[.)]\s+(.*)$/.exec(line)
    if (!line) { flushParagraph(); flushList(); continue }
    if (line.startsWith('## ')) {
      flushParagraph(); flushList()
      out.push(<h2 key={`h${out.length}`} style={{ fontSize: 19, margin: '26px 0 10px', color: '#ffd34d' }}>{line.slice(3)}</h2>)
      continue
    }
    if (bullet || step) {
      flushParagraph()
      const ordered = Boolean(step)
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push((bullet ?? step)![1])
      continue
    }
    flushList()
    paragraph.push(line)
  }
  flushParagraph(); flushList()
  return out
}

export function LegalPage() {
  const { slug = '' } = useParams()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    fetch(`${apiRoot}/legal/${encodeURIComponent(slug)}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (response.status === 404) return setState({ kind: 'missing' })
        if (!response.ok) return setState({ kind: 'error' })
        const payload = await response.json() as { data?: LegalDoc }
        setState(payload.data ? { kind: 'ready', doc: payload.data } : { kind: 'error' })
      })
      .catch((error) => { if ((error as Error).name !== 'AbortError') setState({ kind: 'error' }) })
    return () => controller.abort()
  }, [slug])

  useEffect(() => {
    const previous = { lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title }
    document.documentElement.lang = 'ar'
    document.documentElement.dir = 'rtl'
    document.title = `${state.kind === 'ready' ? state.doc.title : 'الصفحات القانونية'} · مجرة`
    return () => { document.documentElement.lang = previous.lang; document.documentElement.dir = previous.dir; document.title = previous.title }
  }, [state])

  return (
    <div dir="rtl" lang="ar" style={{ minHeight: '100vh', background: '#06091a', color: '#e8edfb', fontFamily: 'inherit' }}>
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px' }}>
        <nav aria-label="الصفحات القانونية" style={{ maxWidth: 860, margin: '0 auto', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <a href="/" style={{ color: '#fff', fontWeight: 900, textDecoration: 'none', marginInlineEnd: 'auto' }}>مجرة</a>
          {LINKS.map((link) => (
            <a key={link.slug} href={`/legal/${link.slug}`} aria-current={link.slug === slug ? 'page' : undefined}
              style={{ color: link.slug === slug ? '#ffd34d' : '#a9b4d0', textDecoration: 'none', fontSize: 14 }}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 60px' }}>
        {state.kind === 'loading' && <p role="status">جارٍ التحميل…</p>}
        {state.kind === 'missing' && (
          <>
            <h1 style={{ fontSize: 26 }}>الصفحة غير منشورة بعد</h1>
            <p style={{ color: '#a9b4d0', lineHeight: 1.8 }}>هذه الصفحة قيد الإعداد وستُنشر قريبًا. للاستفسار تواصل معنا من صفحة الدعم في التطبيق.</p>
          </>
        )}
        {state.kind === 'error' && <p role="alert">تعذّر تحميل الصفحة. حاول مرة أخرى بعد قليل.</p>}
        {state.kind === 'ready' && (
          <article>
            <h1 style={{ fontSize: 28, margin: '0 0 6px' }}>{state.doc.title}</h1>
            <p style={{ color: '#7e8bb0', fontSize: 13, margin: '0 0 22px' }}>
              الإصدار {state.doc.version} · آخر تحديث <span dir="ltr">{state.doc.published_at.slice(0, 10)}</span>
            </p>
            {renderLegalBody(state.doc.body)}
          </article>
        )}
      </main>
    </div>
  )
}
