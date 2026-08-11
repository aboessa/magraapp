import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EntityHeader } from '../components/EntityHeader'
import { DetailTabs } from '../components/DetailTabs'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { VisualStyleRecord } from '../types/api'
import { familyLabels, familyOf } from '../lib/visualStyleFamilies'
import { StylePreview } from '../components/visualStyles/StylePreview'

const TABS = ['overview','dna','references','characters','environments','generation','animation','usage','testing','versions','reviews','history'] as const
type TabKey = typeof TABS[number]

const copy = {
  ar: {
    breadcrumb: 'الاستايلات البصرية',
    loading: 'جارٍ تحميل الاستايل...',
    notFound: 'الاستايل غير موجود',
    tabs: { overview:'نظرة عامة', dna:'الحمض البصري', references:'المراجع', characters:'الشخصيات', environments:'البيئات', generation:'التوليد', animation:'التحريك', usage:'الاستخدام', testing:'الاختبار', versions:'الإصدارات', reviews:'المراجعات', history:'السجل' },
    hero: 'معاينة بطولية',
    palette: 'لوحة الألوان', line: 'الخط', rendering: 'الرسم', lighting: 'الإضاءة', proportions: 'النسب', background: 'الخلفية',
    doDont: 'افعل / لا تفعل', generationContract: 'عقد التوليد', prompt: 'الوصف الأساسي', negative: 'القيود', aspect: 'نسب العرض', model: 'توافق النماذج',
    characters: 'ثبات الشخصيات', environments: 'البيئات', animation: 'توافق التحريك', imageGen: 'توليد الصور', videoGen: 'تحويل لصورة فيديو', lipSync: 'مزامنة الشفاه',
    usage: 'الاستخدام الفعلي', series: 'سلاسل', stories: 'قصص', planets: 'كواكب', inheritance: 'الوراثة', platformDefault: 'افتراضي المنصة', planetDefault: 'افتراضي الكوكب', seriesStyle: 'استايل السلسلة', episodeOverride: 'تجاوز الحلقة',
    testLab: 'مختبر الاختبار', benchmark: 'مشاهد معيارية', characterTest: 'اختبار الشخصية — 6 وضعيات', videoTest: 'اختبار فيديو — 5 ثوانٍ',
    version: 'الإصدار', pinned: 'المحتوى مثبت على الإصدار', islamic: 'حوكمة إسلامية: لا يطبق الاستايل المجسم تلقائياً على المحتوى الإسلامي.',
  },
  en: {
    breadcrumb: 'Visual Styles',
    loading: 'Loading style...',
    notFound: 'Style not found',
    tabs: { overview:'Overview', dna:'Visual DNA', references:'References', characters:'Characters', environments:'Environments', generation:'Generation', animation:'Animation', usage:'Usage', testing:'Testing', versions:'Versions', reviews:'Reviews', history:'History' },
    hero: 'Hero preview',
    palette: 'Palette', line: 'Line', rendering: 'Rendering', lighting: 'Lighting', proportions: 'Proportions', background: 'Background',
    doDont: 'Do / Don’t', generationContract: 'Generation contract', prompt: 'Base prompt', negative: 'Constraints', aspect: 'Aspect guidance', model: 'Model compatibility',
    characters: 'Character consistency', environments: 'Environments', animation: 'Animation compatibility', imageGen: 'Image generation', videoGen: 'Image-to-video', lipSync: 'Lip sync',
    usage: 'Actual usage', series: 'Series', stories: 'Stories', planets: 'Planets', inheritance: 'Inheritance', platformDefault: 'Platform default', planetDefault: 'Planet default', seriesStyle: 'Series style', episodeOverride: 'Episode override',
    testLab: 'Test lab', benchmark: 'Benchmark scenes', characterTest: 'Character test — 6 poses', videoTest: 'Video test — 5s',
    version: 'Version', pinned: 'Content pinned to version', islamic: 'Islamic governance: figurative styles not auto-applied to Islamic content.',
  },
}

export function VisualStyleWorkspacePage() {
  const { locale } = usePreferences()
  const text = copy[locale] as any
  const { id = '' } = useParams()
  const [style, setStyle] = useState<VisualStyleRecord | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')
  const [state, setState] = useState<'loading'|'ok'|'missing'|'error'>('loading')
  const [error, setError] = useState('')
  const [seriesUsing, setSeriesUsing] = useState<any[]>([])

  const load = useCallback(async () => {
    setState('loading'); setError('')
    try {
      const all = await api.visualStyles(true)
      const found = all.data.find((s) => s.id === id || s.slug === id)
      if (!found) { setState('missing'); return }
      setStyle(found); setState('ok')
      // usage
      try {
        const series = await api.series({ status: 'all', limit: 100 })
        setSeriesUsing(series.data.filter((s: any) => s.visual_style_id === found.id))
      } catch {}
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setState('missing')
      else { setState('error'); setError(e instanceof Error ? e.message : text.loading) }
    }
  }, [id, text.loading])

  useEffect(() => { void load() }, [load])

  if (state === 'loading') return <LoadingState label={text.loading} />
  if (state === 'missing') return <div className="page-stack"><EmptyState title={text.notFound} description="" action={<Link className="button button--ghost" to={adminPath('visual-styles')}>{text.breadcrumb}</Link>} /></div>
  if (state === 'error' || !style) return <div className="page-stack"><ErrorState message={error} onRetry={() => void load()} /></div>

  const fam = familyOf(style)
  const overview = (
    <div className="workspace-stack">
      <section className="panel"><header className="panel__header"><h3>{text.hero}</h3></header><StylePreview style={style} size="hero" /></section>
      <section className="panel"><header className="panel__header"><h3>{text.tabs.overview}</h3></header><div className="panel__body">
        <div className="metric-row">
          <div className="metric-cell"><strong>{(familyLabels as any)[locale][fam]}</strong><span>Family</span></div>
          <div className="metric-cell"><strong>{style.medium}</strong><span>Medium</span></div>
          <div className="metric-cell"><strong>{style.age_tracks.join(' · ')}</strong><span>Age</span></div>
          <div className="metric-cell"><strong>{Number(style.series_count ?? 0)}</strong><span>{text.series}</span></div>
          <div className="metric-cell"><strong>{Number(style.stories_count ?? 0)}</strong><span>{text.stories}</span></div>
        </div>
        <div className="inline-alert inline-alert--warning" style={{ marginTop: 12 }}>{text.islamic}</div>
        <div style={{ marginTop: 12 }} className="detail-fields">
          <div><span>Slug</span><strong dir="ltr">{style.slug}</strong></div>
          <div><span>Production</span><strong>{style.production_level}</strong></div>
          <div><span>Status</span><strong>{style.is_active ? 'Approved' : 'Archived'}</strong></div>
          <div><span>Version</span><strong>v1.2 · {text.pinned}</strong></div>
        </div>
      </div></section>
      <section className="panel"><header className="panel__header"><h3>{text.inheritance}</h3></header><div className="panel__body"><div className="vs-inheritance"><span>{text.platformDefault}</span><span>→</span><span>{text.planetDefault}</span><span>→</span><strong>{text.seriesStyle}: {locale === 'ar' ? style.name_ar : style.name_en}</strong><span>→</span><span>{text.episodeOverride}</span></div><p className="panel__note">INHERITED FROM PLANET where no series override; SERIES OVERRIDE shown on series detail.</p></div></section>
    </div>
  )

  const dna = (
    <div className="workspace-stack">
      <section className="panel"><header className="panel__header"><h3>{text.tabs.dna}</h3></header><div className="panel__body">
        <div className="detail-fields">
          <div><span>{text.palette}</span><strong>Warm cream / muted green / soft blue / warm gold</strong></div>
          <div><span>{text.line}</span><strong>Soft rounded, clean silhouette</strong></div>
          <div><span>{text.rendering}</span><strong>Painterly, subtle texture</strong></div>
          <div><span>{text.lighting}</span><strong>Soft natural / gentle volumetric</strong></div>
          <div><span>{text.proportions}</span><strong>Child friendly / rounded / expressive</strong></div>
          <div><span>{text.background}</span><strong>Medium complexity</strong></div>
        </div>
        <div style={{ marginTop: 12 }} className="vs-dodont">
          <div><h4>Do</h4><ul><li>Soft natural light</li><li>Rounded child-friendly forms</li><li>Calm volumetric depth</li></ul></div>
          <div><h4>Don’t</h4><ul><li>Photorealistic skin</li><li>Hard horror shadows</li><li>Hyper-detailed clutter</li></ul></div>
        </div>
      </div></section>
    </div>
  )

  const references = (
    <section className="panel"><header className="panel__header"><h3>{text.tabs.references}</h3></header><div className="panel__body">
      <div className="vs-ref-grid">
        {['Character','Environment','Interior','Exterior','Day','Night','Close-up','Wide shot'].map((c) => (
          <div key={c} className="vs-ref-card">
            <div className="vs-ref-card__img" style={{ height: 120, background: '#f1f5f9', display: 'grid', placeItems: 'center', borderRadius: 8 }}>{c}</div>
            <small>{c} · approved</small>
          </div>
        ))}
      </div>
      <p className="panel__note">Each reference: image + category + approved/rejected + notes + version. Managed via Media Picker.</p>
    </div></section>
  )

  const generation = (
    <section className="panel"><header className="panel__header"><h3>{text.generationContract}</h3></header><div className="panel__body">
      <div className="detail-fields">
        <div><span>{text.prompt}</span><strong dir="ltr" style={{ fontWeight: 400 }}>{style.prompt_fragment.slice(0, 160)}</strong></div>
        <div><span>{text.negative}</span><strong dir="ltr" style={{ fontWeight: 400 }}>{style.negative_prompt ?? '—'}</strong></div>
        <div><span>{text.aspect}</span><strong>16:9 hero, 1:1 cover, 3:4 story</strong></div>
        <div><span>{text.model}</span><strong>Not verified — no provider claim</strong></div>
      </div>
    </div></section>
  )

  const animationTab = (
    <section className="panel"><header className="panel__header"><h3>{text.animation}</h3></header><div className="panel__body">
      <div className="metric-row">
        <div className="metric-cell"><strong>Supported</strong><span>{text.imageGen}</span></div>
        <div className="metric-cell"><strong>Supported</strong><span>{text.videoGen}</span></div>
        <div className="metric-cell metric-cell--warn"><strong>Limited</strong><span>{text.lipSync}</span></div>
        <div className="metric-cell"><strong>Slow</strong><span>Camera</span></div>
      </div>
      <p className="panel__note">Attractive image style ≠ good animation style — tested separately.</p>
    </div></section>
  )

  const usage = (
    <section className="panel"><header className="panel__header"><h3>{text.usage}</h3></header><div className="panel__body">
      <div className="metric-row">
        <div className="metric-cell"><strong>{seriesUsing.length}</strong><span>{text.series}</span></div>
        <div className="metric-cell"><strong>{Number(style.stories_count ?? 0)}</strong><span>{text.stories}</span></div>
      </div>
      {seriesUsing.length ? <ul style={{ marginTop: 12 }}>{seriesUsing.slice(0,6).map((s: any)=>(<li key={s.id}><Link to={adminPath(`series/${s.id}`)}>{s.title_ar}</Link></li>))}</ul> : <p className="panel__note">No series pinned to this version.</p>}
    </div></section>
  )

  const testing = (
    <section className="panel"><header className="panel__header"><h3>{text.testLab}</h3></header><div className="panel__body">
      <p>{text.benchmark}: Character portrait · Two-character dialogue · Interior · Exterior · Night · Close-up · Group shot · Educational object</p>
      <div className="vs-test-grid">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="vs-test-card" style={{ height: 100, background: '#f8fafc', borderRadius: 8, display: 'grid', placeItems: 'center' }}>Scene {i+1}</div>)}
      </div>
      <div style={{ marginTop: 12 }} className="detail-fields">
        <div><span>{text.characterTest}</span><strong>front / 3/4 / side / happy / sad / surprised</strong></div>
        <div><span>{text.videoTest}</span><strong>Same image → 5–8s clip (TEST media)</strong></div>
      </div>
    </div></section>
  )

  const tabs = [
    { key: 'overview', label: text.tabs.overview, content: overview },
    { key: 'dna', label: text.tabs.dna, content: dna },
    { key: 'references', label: text.tabs.references, content: references },
    { key: 'characters', label: text.tabs.characters, content: <section className="panel"><div className="panel__body"><p>Character consistency: front / 3/4 / side / happy / sad / surprised / action pose</p></div></section> },
    { key: 'environments', label: text.tabs.environments, content: <section className="panel"><div className="panel__body"><p>Interior / Exterior / Morning / Night / Nature / City / Educational</p></div></section> },
    { key: 'generation', label: text.tabs.generation, content: generation },
    { key: 'animation', label: text.tabs.animation, content: animationTab },
    { key: 'usage', label: text.tabs.usage, content: usage },
    { key: 'testing', label: text.tabs.testing, content: testing },
    { key: 'versions', label: text.tabs.versions, content: <section className="panel"><div className="panel__body"><p>{text.version} v1.0 → v1.2 · {text.pinned}. Changing palette/prompt does not migrate old content.</p></div></section> },
    { key: 'reviews', label: text.tabs.reviews, content: <section className="panel"><div className="panel__body"><p>Draft → In Testing → Review → Approved → Deprecated → Archived</p></div></section> },
    { key: 'history', label: text.tabs.history, content: <section className="panel"><div className="panel__body"><p>Audit history + actor + version</p></div></section> },
  ]

  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[{ label: text.breadcrumb, to: adminPath('visual-styles') }, { label: locale === 'ar' ? style.name_ar : style.name_en }]}
        thumbnail={<div style={{ width: 48, height: 48, borderRadius: 8, background: '#e8f0ff', display: 'grid', placeItems: 'center' }}>{style.medium}</div>}
        title={locale === 'ar' ? style.name_ar : style.name_en}
        subtitle={`${(familyLabels as any)[locale][familyOf(style)]} · ${style.slug} · v1.2`}
        meta={<><span>{style.medium}</span><span>{style.age_tracks.join(' · ')}</span><span>{Number(style.series_count ?? 0)} series</span></>}
        status={<StatusBadge status={style.is_active ? 'published' : 'archived'} />}
      />
      <DetailTabs tabs={tabs as any} active={tab} onChange={(k) => setTab(k as TabKey)} />
    </div>
  )
}
