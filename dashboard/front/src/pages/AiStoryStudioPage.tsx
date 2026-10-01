import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { AiStoryGenerated } from '../types/api'

export function AiStoryStudioPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  // Wizard Form State
  const [title, setTitle] = useState('')
  const [ageTrack, setAgeTrack] = useState<'preschool' | 'kids' | 'junior'>('kids')
  const [theme, setTheme] = useState('التعاون والصداقة')
  const [characters, setCharacters] = useState('بسمة، زيد، الروبوت نور')
  const [setting, setSetting] = useState('كوكب العلوم والمختبر الفضائي')
  const [pagesCount, setPagesCount] = useState(4)

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [generatedStory, setGeneratedStory] = useState<AiStoryGenerated | null>(null)
  const [error, setError] = useState('')

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState('')

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setError('')
    setExportSuccess('')

    try {
      const res = await api.aiStoryGenerate({
        title: title || undefined,
        age_track: ageTrack,
        theme,
        characters: characters.split(/[,،]/).map(s => s.trim()).filter(Boolean),
        setting,
        pages_count: Number(pagesCount),
      })

      if (res.data) {
        setGeneratedStory(res.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (ar ? 'فشل توليد القصة' : 'Failed to generate story'))
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async () => {
    if (!generatedStory) return
    setExporting(true)
    setExportSuccess('')

    try {
      const minAge = ageTrack === 'preschool' ? 3 : ageTrack === 'kids' ? 6 : 9
      const maxAge = ageTrack === 'preschool' ? 5 : ageTrack === 'kids' ? 8 : 12

      const res = await api.aiStoryExport({
        title_ar: generatedStory.title_ar,
        description_ar: `قصة تربوية بموضوع: ${generatedStory.theme} - الفئة المستهدفة: مسار ${ageTrack}`,
        age_min: minAge,
        age_max: maxAge,
      })

      if (res.data) {
        setExportSuccess(ar ? `تم تصدير القصة بنجاح كمسودة برقم: ${res.data.id}` : `Exported story draft id: ${res.data.id}`)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : (ar ? 'تعذر التصدير' : 'Failed to export'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-container" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13, marginBottom: 4 }}>
            <span>{ar ? 'الذكاء الاصطناعي والإبداع' : 'Creative AI'}</span>
            <span>/</span>
            <span>{ar ? 'استوديو تأليف القصص' : 'AI Story Studio'}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>✨</span>
            {ar ? 'استوديو تأليف القصص التفاعلية بالذكاء الاصطناعي' : 'AI Interactive Story Studio'}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {ar
              ? 'توليد قصص أطفال تربوية مكتملة بالتشكيل الفصيح وتوجيهات الرسام (Art Prompts) وتصديرها لمكتبة القصص بنقرة واحدة.'
              : 'Generate complete educational children stories with full Arabic tashkeel, illustrator prompts, and 1-click library export.'}
          </p>
        </div>

        <Link to={adminPath('stories')} className="button button--secondary button--small">
          <Icon name="books" size={16} />
          {ar ? 'مكتبة القصص الحالية' : 'Stories Library'}
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
        {/* Left: Input Wizard */}
        <div className="panel" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="sliders" size={18} />
            {ar ? 'معايير وتوجيهات التأليف' : 'Story Generation Parameters'}
          </h3>

          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="field">
              <span className="field__label">{ar ? 'المسار العمري المستهدف' : 'Target Age Track'}</span>
              <select className="select" value={ageTrack} onChange={e => setAgeTrack(e.target.value as any)}>
                <option value="preschool">{ar ? 'مسار الروضة والبراعم (3–5 سنوات)' : 'Preschool (3-5 years)'}</option>
                <option value="kids">{ar ? 'مسار المستكشف (6–8 سنوات)' : 'Kids Explorers (6-8 years)'}</option>
                <option value="junior">{ar ? 'مسار الرواد واليافعين (9–12 سنة)' : 'Junior Pioneers (9-12 years)'}</option>
              </select>
            </label>

            <label className="field">
              <span className="field__label">{ar ? 'القيمة التربوية أو الفكرة المركزية' : 'Moral Value / Main Theme'}</span>
              <input
                type="text"
                className="input"
                value={theme}
                onChange={e => setTheme(e.target.value)}
                placeholder={ar ? 'مثال: الصدق، بر الوالدين، الفضول العلمي...' : 'e.g. Curiosity, Kindness, Honesty...'}
                required
              />
            </label>

            <label className="field">
              <span className="field__label">{ar ? 'عنوان القصة (اختياري، يولد تلقائياً)' : 'Story Title (Optional)'}</span>
              <input
                type="text"
                className="input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={ar ? 'اتركه فارغاً ليقترح الذكاء الاصطناعي عنواناً جذاباً' : 'Leave empty for auto-generation'}
              />
            </label>

            <label className="field">
              <span className="field__label">{ar ? 'الشخصيات المشاركة' : 'Characters'}</span>
              <input
                type="text"
                className="input"
                value={characters}
                onChange={e => setCharacters(e.target.value)}
                placeholder={ar ? 'افصل بين الأسماء بفواصل' : 'Comma-separated names'}
              />
            </label>

            <label className="field">
              <span className="field__label">{ar ? 'البيئة ومكان الأحداث' : 'Setting & Environment'}</span>
              <input
                type="text"
                className="input"
                value={setting}
                onChange={e => setSetting(e.target.value)}
                placeholder={ar ? 'مثال: غابة الأسرار، سفينة فضاء، متحف العلوم...' : 'e.g. Space observatory, lush forest...'}
              />
            </label>

            <label className="field">
              <span className="field__label">{ar ? 'عدد الصفحات' : 'Page Count'}</span>
              <select className="select" value={pagesCount} onChange={e => setPagesCount(Number(e.target.value))}>
                <option value={3}>3 {ar ? 'صفحات (قصة قصيرة للبراعم)' : 'Pages'}</option>
                <option value={4}>4 {ar ? 'صفحات (معيارية)' : 'Pages'}</option>
                <option value={6}>6 {ar ? 'صفحات (موسعة)' : 'Pages'}</option>
                <option value={8}>8 {ar ? 'صفحات (قصة كاملة)' : 'Pages'}</option>
              </select>
            </label>

            {error && (
              <div style={{ padding: 10, borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button type="submit" className="button button--primary" disabled={generating} style={{ marginTop: 8 }}>
              <Icon name="sparkles" size={16} />
              {generating ? (ar ? 'جارٍ التأليف والتشكيل...' : 'Generating & Formatting...') : (ar ? 'تأليف القصة الآن' : 'Generate Story')}
            </button>
          </form>
        </div>

        {/* Right: Generated Output / Reader Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {exportSuccess && (
            <div className="panel" style={{ padding: 14, background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#10b981', fontWeight: 600, fontSize: 14 }}>✓ {exportSuccess}</span>
              <Link to={adminPath('stories')} className="button button--secondary button--small">
                {ar ? 'فتح مكتبة القصص' : 'Open Stories'}
              </Link>
            </div>
          )}

          {generatedStory ? (
            <div className="panel" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <span style={{ fontSize: 11, background: '#ede9fe', color: '#6d28d9', fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                    {ar ? 'مسودة ذكية مكتملة' : 'AI Generated Story'}
                  </span>
                  <h2 style={{ margin: '8px 0 4px', fontSize: 22, color: 'var(--primary, #3b82f6)' }}>
                    {generatedStory.title_ar}
                  </h2>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)' }}>
                    <span>🎯 {generatedStory.theme}</span>
                    <span>👥 {generatedStory.characters.join(' · ')}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="button button--primary"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  <Icon name="upload" size={16} />
                  {exporting ? (ar ? 'جارٍ التصدير...' : 'Exporting...') : (ar ? 'تصدير لمكتبة القصص' : 'Export to Stories')}
                </button>
              </div>

              {/* Story Pages Carousel / Stack */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {generatedStory.pages.map((p) => (
                  <div
                    key={p.page_number}
                    style={{
                      padding: 18,
                      borderRadius: 10,
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border)',
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
                      gap: 16,
                    }}
                  >
                    {/* Arabic Text with Tashkeel */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                          {p.page_number}
                        </span>
                        <strong style={{ fontSize: 13 }}>{ar ? `الصفحة ${p.page_number}` : `Page ${p.page_number}`}</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: 17, lineHeight: 1.8, fontFamily: 'serif', direction: 'rtl' }}>
                        {p.text_ar}
                      </p>
                    </div>

                    {/* Illustration Guidance */}
                    <div style={{ background: 'var(--surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                          🎨 {ar ? 'توجيه المشهد والرسام (Prompt)' : 'Illustration Prompt'}
                        </span>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, fontStyle: 'italic' }}>
                          "{p.illustration_prompt}"
                        </p>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                        {p.scene_summary}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--text)' }}>
                {ar ? 'معاينة القصة' : 'Story Preview'}
              </h3>
              <p style={{ margin: 0, fontSize: 14, maxWidth: 420, marginInline: 'auto' }}>
                {ar
                  ? 'املأ خيارات التأليف في القائمة واضغط "تأليف القصة الآن" لتوليد مسودة القصة التفاعلية وتشكيلها بالعربية الفصحى.'
                  : 'Configure generation parameters on the left and click "Generate Story" to preview story cards here.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
