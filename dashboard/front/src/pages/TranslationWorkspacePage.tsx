import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { Icon } from '../components/Icon'

const copy = {
  ar: {
    back: 'العودة لمركز الترجمة',
    loading: 'جارٍ تحميل وحدة الترجمة…',
    loadError: 'تعذر تحميل وحدة الترجمة',
    source: 'النص المصدر (العربية — للقراءة فقط)',
    target: 'الترجمة إلى الهدف',
    save: 'حفظ المسودة',
    submitReview: 'إرسال للمراجعة والتدقيق',
    approve: 'اعتماد الترجمة',
    reject: 'رفض الترجمة',
    glossary: 'مصطلحات المسرد المطابقة',
    memory: 'اقتراحات ذاكرة الترجمة المعتمدة',
    comments: 'الملاحظات',
    version: 'إصدار المصدر',
    status: 'الحالة',
    stale: 'النص قديم — تم تحديث المصدر العربي',
    diff: 'تحديث المحتوى',
    context: 'سياق العنصر وموضعه',
    preview: 'معاينة السياق',
    reauthor: 'تنبيه: يتطلب إعادة تأليف تربوي — لا ترجمة حرفية',
    languageSpecific: 'محتوى مرتبط بخصائص اللغة العربية وثقافتها — الترجمة الحرفية تفقد المعنى.',
  },
  en: {
    back: 'Back to Center',
    loading: 'Loading Translation Unit…',
    loadError: 'Unable to load translation unit',
    source: 'Source Text (Arabic — Read Only)',
    target: 'Target Translation',
    save: 'Save Draft',
    submitReview: 'Submit for Review',
    approve: 'Approve Translation',
    reject: 'Reject Translation',
    glossary: 'Matched Glossary Terms',
    memory: 'Translation Memory Matches',
    comments: 'Comments',
    version: 'Source Version',
    status: 'Status',
    stale: 'Stale: Source text updated',
    diff: 'Content Update',
    context: 'Element Context',
    preview: 'Preview',
    reauthor: 'Note: Re-authoring required — avoid literal translation',
    languageSpecific: 'Culturally specific content — literal translation loses meaning.',
  },
}

export function TranslationWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [data, setData] = useState<any>(null)
  const [target, setTarget] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.translationUnit(id)
      setData(res.data)
      setTarget(res.data.target_text ?? '')
      if (res.data.source_text) {
        const tm = await api
          .translationMemory(res.data.source_text.slice(0, 40), res.data.target_language)
          .catch(() => ({ data: [] }))
        setSuggestions((tm as any).data ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  async function save(status?: string) {
    setSaving(true)
    try {
      await api.saveTranslation(id, { target_text: target, status: status ?? 'in_translation' })
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'خطأ في الحفظ')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return <EmptyState title={text.loadError} description={id} />

  const isRTL = data.source_language === 'ar'
  const targetRTL = data.target_language === 'ar'

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{ background: 'radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, rgba(99, 102, 241, 0.1) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">
              {data.entity_type} · الحقل: {data.field}
            </span>
            <span
              className="catalog-hero__status-badge"
              style={{
                borderColor: data.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.3)',
                color: data.status === 'approved' ? '#10b981' : '#38bdf8',
              }}
            >
              <span className="status-dot-pulse" style={{ background: '#38bdf8' }} />
              AR → {data.target_language?.toUpperCase()} · الحالة: {data.status}
            </span>
          </div>
          <h1 className="catalog-hero__title" style={{ fontSize: 22 }}>
            محرر تعريب: {data.context_title ?? data.entity_id}
          </h1>
        </div>
        <div className="catalog-hero__actions">
          <Link className="button button--secondary" to={adminPath('translation')} style={{ backdropFilter: 'blur(8px)' }}>
            <Icon name="chevron-left" size={14} />
            <span>{text.back}</span>
          </Link>
        </div>
      </section>

      {data.status === 'stale' && (
        <div className="inline-alert inline-alert--warn" style={{ margin: '16px 0' }}>
          <strong>{text.stale}</strong> — تم تعديل النص المصدر بعد اعتماد هذه الترجمة. يرجى مراجعة التغييرات والتحديث.
        </div>
      )}
      {data.is_reauthor && (
        <div className="inline-alert inline-alert--warn" style={{ margin: '16px 0' }}>
          <strong>{text.reauthor}</strong> — {text.languageSpecific}
        </div>
      )}

      {/* 2. Side-by-side Translation Workbench Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 1.1fr) minmax(300px, 1.1fr) minmax(260px, 0.8fr)',
          gap: 16,
          alignItems: 'start',
          marginTop: 16,
        }}
      >
        {/* Source Text Panel */}
        <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{text.source}</h4>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>v{data.source_version}</span>
          </div>
          <div
            style={{
              border: '1px solid var(--cs-glass-border)',
              borderRadius: 12,
              padding: 16,
              minHeight: 220,
              direction: isRTL ? 'rtl' : 'ltr',
              textAlign: isRTL ? 'right' : 'left',
              background: 'var(--surface-2)',
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--text)',
            }}
          >
            {data.source_text || '—'}
          </div>
          {data.context && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--muted)' }}>
              <strong>{text.context}:</strong> {data.context.title ?? data.entity_type}{' '}
              {data.page_number ? `· ص ${data.page_number}` : ''}
            </div>
          )}
        </div>

        {/* Target Editor Panel */}
        <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
              {text.target} — {data.target_language?.toUpperCase()}
            </h4>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{targetRTL ? 'RTL' : 'LTR'}</span>
          </div>
          <textarea
            dir={targetRTL ? 'rtl' : 'ltr'}
            style={{
              width: '100%',
              minHeight: 220,
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--cs-glass-border)',
              background: 'var(--surface-2)',
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--text)',
              resize: 'vertical',
            }}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="اكتب أو راجع الترجمة المعتمدة هنا..."
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              className="button button--primary"
              disabled={saving || !target.trim()}
              onClick={() => save('in_translation')}
            >
              {saving ? 'جارٍ الحفظ...' : text.save}
            </button>
            <button
              className="button button--ghost"
              disabled={saving}
              onClick={() => save('ready_for_review')}
            >
              {text.submitReview}
            </button>
            <button
              className="button button--primary"
              style={{ background: '#10b981', borderColor: '#10b981' }}
              disabled={saving}
              onClick={async () => {
                await api.reviewTranslation(id, { status: 'approved' })
                await load()
              }}
            >
              <Icon name="check" size={13} />
              <span>{text.approve}</span>
            </button>
          </div>
        </div>

        {/* Knowledge & Memory Sidecars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Matched Glossary */}
          <div className="panel" style={{ padding: 18, borderRadius: 18 }}>
            <h5 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
              {text.glossary}
            </h5>
            {data.glossary?.length ? (
              <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.glossary.map((g: any) => (
                  <li key={g.id}>
                    <strong>{g.source_term}</strong> → {g.translations?.[data.target_language] ?? '—'}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>لا توجد مصطلحات خاصة مطابقة</p>
            )}
          </div>

          {/* Translation Memory Suggestions */}
          <div className="panel" style={{ padding: 18, borderRadius: 18 }}>
            <h5 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
              {text.memory}
            </h5>
            {suggestions.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {suggestions.map((s: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--cs-glass-border)',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ color: 'var(--muted)', marginBottom: 4 }}>{s.source_text?.slice(0, 50)}…</div>
                    <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{s.target_text}</div>
                    <button
                      className="button button--ghost button--small"
                      onClick={() => setTarget(s.target_text)}
                    >
                      استخدام الترجمة
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>لا توجد اقتراحات مطابقة في الذاكرة</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
