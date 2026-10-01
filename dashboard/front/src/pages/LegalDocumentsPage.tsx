import { useEffect, useState } from 'react'
import { LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { hasPermission } from '../lib/adminSession'
import { api, ApiError, type LegalDocument } from '../lib/api'
import { renderLegalBody } from './LegalPage'

/// «الصفحات القانونية»: privacy policy, children's privacy, terms, account
/// deletion. Edit the draft, preview it exactly as the site renders it, then
/// publish. Publishing is refused while a `{{placeholder}}` is left.

const PUBLIC_ORIGIN = 'https://majarra.app'

function Editor({ doc, onChange }: { doc: LegalDocument; onChange: (next: LegalDocument) => void }) {
  const [title, setTitle] = useState(doc.title_ar)
  const [body, setBody] = useState(doc.body_ar)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const canEdit = hasPermission('publish')
  const dirty = title !== doc.title_ar || body !== doc.body_ar
  const placeholders = [...new Set(`${title}\n${body}`.match(/\{\{[^}]{1,80}\}\}/g) ?? [])]

  const run = async (action: () => Promise<LegalDocument | null>, ok: string) => {
    setBusy(true)
    setMessage(null)
    try {
      const next = await action()
      if (next) onChange(next)
      setMessage({ ok: true, text: ok })
    } catch (caught) {
      const text = caught instanceof ApiError && caught.status === 422
        ? 'فيه خانات لسه ماتملتش. املاها واحفظ الأول.'
        : caught instanceof Error ? caught.message : 'حصل خطأ'
      setMessage({ ok: false, text })
    } finally {
      setBusy(false)
    }
  }

  const save = () => run(async () => (await api.saveLegalDocument(doc.slug, { title_ar: title, body_ar: body })).data, 'اتحفظت المسودة. لسه مش منشورة.')
  const publish = () => {
    if (!window.confirm(`نشر «${title}» على الموقع والتطبيق؟ اتأكد إن النص اتراجع قانونيًا.`)) return
    void run(async () => (await api.publishLegalDocument(doc.slug)).data, 'اتنشرت.')
  }
  const unpublish = () => {
    if (!window.confirm('شيل الصفحة من الموقع والتطبيق؟')) return
    void run(async () => { await api.unpublishLegalDocument(doc.slug); return { ...doc, status: 'draft' } }, 'اتشالت من النشر.')
  }

  return (
    <section className="panel" aria-labelledby={`legal-${doc.slug}`}>
      <h2 id={`legal-${doc.slug}`} className="panel__title">
        {doc.title_ar}{' '}
        <small>
          {doc.status === 'published' ? `منشورة (إصدار ${doc.version})` : 'مسودة'}
          {doc.status === 'published' && doc.draft_differs && ' · فيه تعديلات مش منشورة'}
        </small>
      </h2>
      <p className="panel__note">
        الرابط العام: <a href={`${PUBLIC_ORIGIN}/legal/${doc.slug}`} target="_blank" rel="noreferrer" dir="ltr">{PUBLIC_ORIGIN}/legal/{doc.slug}</a>
        {' '}· الصيغة: <code>## عنوان</code> و<code>- نقطة</code> و<code>1. خطوة</code> وسطر فاضي بين الفقرات.
      </p>
      {placeholders.length > 0 && (
        <p className="panel__note" role="status">
          خانات لازم تتملى قبل النشر: {placeholders.map((p) => <code key={p} style={{ marginInlineEnd: 6 }}>{p}</code>)}
        </p>
      )}
      <div className="field field--wide">
        <label htmlFor={`legal-title-${doc.slug}`}>العنوان</label>
        <input id={`legal-title-${doc.slug}`} value={title} maxLength={120} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 6, margin: '10px 0' }} role="group" aria-label="العرض">
        <button type="button" className={`button button--small ${preview ? 'button--ghost' : 'button--primary'}`} aria-pressed={!preview} onClick={() => setPreview(false)}>تحرير</button>
        <button type="button" className={`button button--small ${preview ? 'button--primary' : 'button--ghost'}`} aria-pressed={preview} onClick={() => setPreview(true)}>معاينة</button>
      </div>
      {preview ? (
        <div dir="rtl" style={{ border: '1px solid var(--border, #2a3566)', borderRadius: 10, padding: 16, maxHeight: 520, overflow: 'auto' }}>
          {renderLegalBody(body)}
        </div>
      ) : (
        <div className="field field--wide">
          <label htmlFor={`legal-body-${doc.slug}`}>النص</label>
          <textarea id={`legal-body-${doc.slug}`} dir="rtl" rows={18} value={body} maxLength={40000} disabled={!canEdit} onChange={(e) => setBody(e.target.value)} style={{ fontFamily: 'inherit', lineHeight: 1.7 }} />
        </div>
      )}
      {message && <p role={message.ok ? 'status' : 'alert'} className="panel__note">{message.text}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button className="button button--ghost" type="button" disabled={!canEdit || busy || !dirty} onClick={() => void save()}>
          <Icon name="check" size={15} />حفظ المسودة
        </button>
        <button className="button button--primary" type="button" disabled={!canEdit || busy || dirty || placeholders.length > 0} title={dirty ? 'احفظ الأول' : placeholders.length ? 'املا الخانات الأول' : undefined} onClick={publish}>
          <Icon name="globe" size={15} />نشر
        </button>
        {doc.status === 'published' && (
          <button className="button button--ghost" type="button" disabled={!canEdit || busy} onClick={unpublish}>إلغاء النشر</button>
        )}
      </div>
    </section>
  )
}

export function LegalDocumentsPage() {
  const [docs, setDocs] = useState<LegalDocument[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.legalDocuments().then((r) => setDocs(r.data)).catch((e) => setError(e instanceof Error ? e.message : 'Error'))
  }, [])

  const replace = (next: LegalDocument) => setDocs((current) => current?.map((d) => (d.slug === next.slug ? next : d)) ?? null)

  return (
    <div className="content-studio-root">
      <section className="catalog-hero">
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta"><span className="catalog-hero__eyebrow">الموقع</span></div>
          <h1 className="catalog-hero__title">الصفحات القانونية</h1>
          <p className="catalog-hero__desc">
            الخصوصية وخصوصية الأطفال والشروط وحذف الحساب. النص الحالي مسودة مكتوبة من اللي التطبيق بيخزّنه فعلًا،
            ولازم يتراجع قانونيًا قبل النشر. بتظهر على الموقع وفي التطبيق بعد النشر، حتى والموقع تحت الإنشاء.
          </p>
        </div>
      </section>
      {error && <div className="panel panel--notice panel--notice--bad" role="alert"><strong>{error}</strong></div>}
      {!docs && !error && <LoadingState />}
      {docs?.map((doc) => <Editor key={`${doc.slug}:${doc.version}:${doc.status}`} doc={doc} onChange={replace} />)}
    </div>
  )
}
