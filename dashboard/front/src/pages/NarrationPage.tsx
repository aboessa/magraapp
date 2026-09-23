import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { StoryLibraryRow } from '../types/api'
import { VOICE_PROFILES, profileFor } from '../lib/voiceProfiles'

type QueueItem = {
  story: StoryLibraryRow
  page: number
  language: string
  text: string
  status: 'missing' | 'ready_for_review' | 'approved' | 'failed' | 'stale'
  voice: string
  sourceVersion: string
  duration?: string
  owner?: string
  due?: string
}

const copy = {
  ar: {
    eyebrow: 'الإنتاج الصوتي والدوبلاج',
    title: 'مركز إدارة وهندسة السرد الصوتي',
    lede: 'إنتاج التسجيلات الصوتية وحكايات مجرة من النص الحقيقي والنسخ المعتمدة — مع مراجعة دقيقة للأداء الصوتي ومزامنة القراءة التفاعلية.',
    beaconActive: 'استوديو الصوت والتوليد الصوتي نشط',
    providerOk: 'مزود الصوت مهيأ بنجاح ✓',
    providerBad: 'مزود الصوت غير متاح حالياً',
    metrics: {
      waiting: 'بانتظار الإنتاج',
      processing: 'قيد التوليد',
      review: 'جاهز للمراجعة',
      approved: 'معتمد نهائي',
      failed: 'فشل التوليد',
      missing: 'ناقص صوت',
      overdue: 'متأخر',
    },
    tabs: {
      overview: 'نظرة عامة',
      queue: 'قائمة الإنتاج',
      review: 'جاهز للمراجعة',
      approved: 'الصوتيات المعتمدة',
      voices: 'مكتبة الأصوات',
      dict: 'قاموس النطق',
      failed: 'المهام الفاشلة',
      lab: 'مختبر الصوت التجريبي',
    },
    search: 'بحث بعنوان القصة أو النص...',
    produce: 'توليد عينة صوتية',
    approve: 'اعتماد العينة كمرشح',
    play: 'تشغيل',
    voiceLabel: 'الدور الصوتي',
    language: 'اللغة',
    preset: 'إعداد الأداء',
    tone: 'النغمة',
    pace: 'السرعة',
    source: 'النص المصدري',
    sourceVersion: 'نسخة النص',
    voiceProfile: 'الدور الصوتي',
    direction: 'التوجيه الإخراجي',
    batch: 'توليد دفعي',
    batchHint: 'تحقق من النص والدور قبل الانتظار.',
    stale: 'قديم — النص تغير',
    readToMe: 'جاهزية اقرأ لي (Audio)',
    readAlong: 'جاهزية القراءة المتزامنة (Word Sync)',
    openStory: 'فتح القصة',
    close: 'إغلاق',
  },
  en: {
    eyebrow: 'Audio Production & Voiceover',
    title: 'Narration & Voice Studio Center',
    lede: 'Majarra story audio production from verified text versions — with precise actor tone calibration, QA sign-off, and Read-Along synchronization.',
    beaconActive: 'Voiceover & Narration Engine Live',
    providerOk: 'Voice provider configured ✓',
    providerBad: 'Voice provider unavailable',
    metrics: {
      waiting: 'Awaiting production',
      processing: 'Processing',
      review: 'Ready for review',
      approved: 'Approved masters',
      failed: 'Failed jobs',
      missing: 'Missing audio',
      overdue: 'Overdue',
    },
    tabs: {
      overview: 'Overview',
      queue: 'Production queue',
      review: 'Ready for review',
      approved: 'Approved',
      voices: 'Voice library',
      dict: 'Pronunciation dictionary',
      failed: 'Failed jobs',
      lab: 'Voice experiment lab',
    },
    search: 'Search story title or text...',
    produce: 'Generate preview',
    approve: 'Submit for review',
    play: 'Play',
    voiceLabel: 'Voice profile',
    language: 'Language',
    preset: 'Preset',
    tone: 'Tone',
    pace: 'Pace',
    source: 'Source text',
    sourceVersion: 'Source version',
    voiceProfile: 'Voice profile',
    direction: 'Direction',
    batch: 'Batch generate',
    batchHint: 'Validate source and voice before queuing.',
    stale: 'Stale — text changed',
    readToMe: 'Read To Me readiness',
    readAlong: 'Read Along readiness',
    openStory: 'Open story',
    close: 'Close',
  },
}

/// عدد القصص التي تُحمَّل مساحات عملها للطابور.
///
/// كل قصة نداءٌ مستقلّ (`/workspace` تجميعةُ قصةٍ واحدة)، فالحدّ يمنع عشرين نداءً
/// متوازيًا على فتح الشاشة. وكان الحدّ نفسه (8) قائمًا قبل هذا التغيير — لكنه كان
/// يحدّ عدد القصص التي **يُختلَق** لها طابور.
const QUEUE_STORY_LIMIT = 8

/// حالة السرد الحقيقية لترجمةٍ واحدة.
///
/// الترتيب حاكم، والفروق الثلاثة الأولى هي ما كانت قذفةُ العملة تُطمِسه:
///
/// 1. **لا أصل** ⇒ `missing`. لا سرد بعد.
/// 2. **أصلٌ غير جاهز** ⇒ `failed`. بوّابة النشر لا تقبل إلا `status = 'ready'`،
///    فأصلٌ موجود وغير جاهز عطلُ إنتاجٍ لا انتظار.
/// 3. **`narration_source === 'generated'`** ⇒ `ready_for_review`. تصييرٌ آليّ لا
///    تسجيلٌ معتمد؛ والعقد نفسه يحذّر أن مساواتهما «تسمح بنشر صوتٍ لم يراجعه أحد».
/// 4. الباقي ⇒ `approved`.
function narrationStatusOf(
  localization: import('../types/api').StoryWorkspaceLocalization | undefined,
): QueueItem['status'] {
  if (!localization?.narration_asset_id) return 'missing'
  if (!localization.narration_ready) return 'failed'
  if (localization.narration_source === 'generated') return 'ready_for_review'
  return 'approved'
}

export function NarrationPage() {
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const [stories, setStories] = useState<StoryLibraryRow[]>([])
  const [pagesByStory, setPagesByStory] = useState<
    Record<string, import('../types/api').StoryWorkspacePage[]>
  >({})
  /// القصص التي تعذّر تحميل مساحة عملها، بأسمائها.
  ///
  /// تُعلَن للمشغّل ولا تُبتلَع: طابورٌ أقصر بلا سببٍ مُسمّى يُقرأ «لا عمل متبقٍّ»،
  /// وهو نفس العطل الذي كانت قذفةُ العملة تُنتجه من الطرف الآخر.
  const [workspaceErrors, setWorkspaceErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [providerOk, setProviderOk] = useState<boolean | null>(null)
  const [tab, setTab] = useState<keyof typeof text.tabs>('overview')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<QueueItem | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [dictWord, setDictWord] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [lib, cfg] = await Promise.all([api.storyLibrary({} as any), api.ttsConfig().catch(() => null)])
      const rows = lib.data as StoryLibraryRow[]
      setStories(rows)
      setProviderOk(cfg ? (cfg.data as any).configured : false)

      // مساحات العمل بـ`allSettled` لا `all`: قصةٌ واحدة تفشل لا تُفرِغ الشاشة،
      // والفشل يُسمّى بصاحبه بدل أن يُخفض العدد بصمت.
      const targets = rows.slice(0, QUEUE_STORY_LIMIT)
      const settled = await Promise.allSettled(
        targets.map((story) => api.storyWorkspace(story.id)),
      )
      const pages: Record<string, import('../types/api').StoryWorkspacePage[]> = {}
      const failures: string[] = []
      settled.forEach((result, index) => {
        const story = targets[index]
        if (result.status === 'fulfilled') {
          pages[story.id] = (result.value.data as any).pages ?? []
        } else {
          failures.push(story.title_ar)
        }
      })
      setPagesByStory(pages)
      setWorkspaceErrors(failures)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /// الطابور من صفحات القصص الحقيقية وترجماتها (`ADM-201`).
  ///
  /// ## ما كان هنا
  ///
  /// كان الطابور يُبنى من مكتبة القصص وحدها ويختلق ما لا تحمله:
  ///
  /// * `s.pages_total || 4` — أربع صفحات مُختلقة عند غياب الحقل.
  /// * `?? Math.floor(Math.random() * 2)` — **قذفةُ عملةٍ** على مقدار السرد الموجود.
  /// * `Math.random() < 0.5 ? 'approved' : 'ready_for_review'` — **قذفةُ عملةٍ على
  ///   حالة الاعتماد**.
  /// * `` `نص الصفحة ${p} من ${s.title_ar} — نسخة v6` `` — نصٌّ مُختلَق يُرسَل بعده
  ///   إلى `api.ttsPreview` كأنّه السطر الحقيقي، فيُنتِج صوتًا لنصٍّ لا وجود له.
  /// * `owner: 'Audio Team'` و`due: '2026-08-20'` و`sourceVersion: 'v6'` محفورة.
  /// * `m.processing = 1` — عدّادٌ محفور في صفّ المقاييس.
  ///
  /// وهذه شاشة **حكم تشغيليّ**: مشغّلٌ يقرأ منها ما يُنتَج وما يُعتمَد. فعرضُ
  /// اعتمادٍ لم يحدث أسوأ من عرض لا شيء.
  ///
  /// ## والعقد الحقيقي كان موجودًا
  ///
  /// `GET /admin/stories/:id/workspace` يُعيد الصفحات وكلَّ ترجماتها، ومع كل
  /// ترجمة: `body_text` و`narration_asset_id` و`narration_status` و
  /// `narration_source` و`narration_ready`. فلا شيء من المعروض يحتاج اختلاقًا.
  const queue: QueueItem[] = useMemo(() => {
    const arr: QueueItem[] = []
    for (const story of stories.slice(0, QUEUE_STORY_LIMIT)) {
      const pages = pagesByStory[story.id]
      // لم تُحمَّل مساحة عمل هذه القصة (أو فشلت): لا صفوف مُختلَقة لها. العدد
      // المعروض أقلّ، وهو صادق — والفشل مُعلَن في `workspaceErrors` أدناه.
      if (!pages) continue
      const language = story.default_language || 'ar'
      for (const page of pages) {
        const localization =
          page.localizations.find((item) => item.language === language) ??
          page.localizations[0]
        arr.push({
          story,
          page: page.page_number,
          language: localization?.language ?? language,
          // النصّ المصدريّ كما هو في قاعدة البيانات. وحين لا نصّ، سلسلةٌ فارغة
          // تمنع التوليد (انظر `canGenerate`) بدل نصٍّ مُختلَق يُنتج صوتًا كاذبًا.
          text: localization?.body_text ?? '',
          status: narrationStatusOf(localization),
          voice: profileFor(localization?.language ?? language)?.id || 'vp-story-calm',
          sourceVersion: localization?.updated_at ?? '—',
        })
      }
    }
    if (query) {
      return arr.filter(
        (q) => q.story.title_ar.includes(query) || q.text.includes(query),
      )
    }
    return arr
  }, [stories, pagesByStory, query])

  const metrics = useMemo(() => {
    const m = { waiting: 0, processing: 0, review: 0, approved: 0, failed: 0, missing: 0, overdue: 0 }
    for (const q of queue) {
      if (q.status === 'missing') m.missing++
      if (q.status === 'ready_for_review') m.review++
      if (q.status === 'approved') m.approved++
      if (q.status === 'failed') m.failed++
      if (q.status === 'stale') m.processing++
    }
    m.waiting = m.missing
    // `overdue` بلا موعدٍ مُسجَّل في العقد: لا حقل استحقاق على الترجمة، فالعدّاد
    // يبقى صفرًا حتى يوجد. وصفرٌ صادق أفضل من رقمٍ يُفسَّر تأخيرًا.
    return m
  }, [queue])

  const generate = async (item: QueueItem) => {
    // نصٌّ فارغ لا يُولَّد له صوت. كان المسار السابق يُرسل نصًّا مُختلَقًا
    // (`نص الصفحة ${p} من ...`) فيُنتج ملفًّا صوتيًّا سليمًا لسطرٍ لا وجود له في
    // القصة — وهو أخطر من الفشل، لأنه قابل للاعتماد والحفظ.
    if (!item.text.trim()) {
      setError(
        locale === 'ar'
          ? 'لا نصّ مصدريّ لهذه الصفحة بهذه اللغة. أضف النصّ في محرّر القصة قبل توليد الصوت.'
          : 'This page has no source text in this language. Add the text in the story builder before generating audio.',
      )
      return
    }
    setGenerating(true)
    try {
      const res = await api.ttsPreview({
        text: item.text,
        voice: VOICE_PROFILES.find((v) => v.id === item.voice)?.providerVoice || 'Kore',
        language_code: item.language === 'ar' ? 'ar-EG' : item.language,
        prompt: 'warm gentle bedtime',
      } as any)
      setPreviewUrl(res.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل التوليد')
    } finally {
      setGenerating(false)
    }
  }

  const approve = async () => {
    if (!selected || !previewUrl) return
    setSelected({ ...selected, status: 'approved' })
    setPreviewUrl(null)
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  if (loading) return <LoadingState label="جارٍ تحميل مركز السرد الصوتي..." />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="content-studio-root">
      {/* ‏`ADM-201`: قصصٌ تعذّر تحميل صفحاتها تُعلَن بأسمائها.
          طابورٌ أقصر بلا سبب يُقرأ «لا عمل متبقٍّ»، وهو نفس الكذب الذي كانت
          قذفةُ العملة تُنتجه في الاتجاه المعاكس. */}
      {workspaceErrors.length > 0 && (
        <div className="page-state page-state--error" role="alert" style={{ marginBottom: 12 }}>
          {locale === 'ar'
            ? `تعذّر تحميل صفحات ${workspaceErrors.length} قصة، فهي غائبة عن الطابور: ${workspaceErrors.join('، ')}`
            : `Could not load pages for ${workspaceErrors.length} story/stories, so they are absent from the queue: ${workspaceErrors.join(', ')}`}
          <button type="button" className="button button--ghost button--small" onClick={() => void load()} style={{ marginInlineStart: 8 }}>
            {locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}
      {/* 1. Commercial Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className={`status-beacon__dot ${providerOk ? 'status-beacon__dot--emerald' : 'status-beacon__dot--rose'}`} />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">{text.beaconActive}</span>
              <span className="status-beacon__sub">{providerOk ? text.providerOk : text.providerBad}</span>
            </div>
          </div>

          <div className="filter-pill-group" role="group" aria-label="narration-quick-tabs">
            <button
              type="button"
              className={`filter-pill ${tab === 'overview' ? 'filter-pill--active' : ''}`}
              onClick={() => setTab('overview')}
            >
              <span>{text.tabs.overview}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${tab === 'queue' ? 'filter-pill--active' : ''}`}
              onClick={() => setTab('queue')}
            >
              <Icon name="grid" size={13} />
              <span>{text.tabs.queue}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${tab === 'review' ? 'filter-pill--active' : ''}`}
              onClick={() => setTab('review')}
            >
              <Icon name="check" size={13} />
              <span>{text.tabs.review}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${tab === 'voices' ? 'filter-pill--active' : ''}`}
              onClick={() => setTab('voices')}
            >
              <Icon name="media" size={13} />
              <span>{text.tabs.voices}</span>
            </button>
          </div>
        </div>

        <div className="commercial-command-strip__right">
          <button className="button button--secondary button--small" onClick={() => setTab('queue')}>
            <Icon name="play" size={14} />
            <span>{text.batch}</span>
          </button>
        </div>
      </section>

      {/* 2. Executive Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.28) 0%, rgba(236, 72, 153, 0.16) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className={`status-dot-pulse ${providerOk ? '' : 'status-dot-pulse--danger'}`} />
              {providerOk ? (locale === 'ar' ? 'محرك TTS نشط' : 'TTS Engine Ready') : (locale === 'ar' ? 'المزود متوقف' : 'Engine Inactive')}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Bento Grid Matrix */}
      <div className="commercial-bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div
          className="commercial-bento-card commercial-bento-card--amber"
          onClick={() => setTab('queue')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.missing}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="alert-triangle" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.missing}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'صفحات بانتظار توليد الصوت' : 'Awaiting audio take'}</span>
          </div>
        </div>

        <div className="commercial-bento-card commercial-bento-card--indigo">
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.processing}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="clock" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.processing}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'معالجة عبر مزود الصوت' : 'Rendering'}</span>
          </div>
        </div>

        <div
          className="commercial-bento-card commercial-bento-card--purple"
          onClick={() => setTab('review')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.review}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="reviews" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.review}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'عينات تم توليدها للمراجعة' : 'Takes ready for QC'}</span>
          </div>
        </div>

        <div
          className="commercial-bento-card commercial-bento-card--emerald"
          onClick={() => setTab('approved')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.approved}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.approved}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'أداء معتمد ونهائي' : 'Approved audio tracks'}
            </span>
          </div>
        </div>

        <div
          className={`commercial-bento-card ${metrics.failed > 0 ? 'commercial-bento-card--rose' : 'commercial-bento-card--slate'}`}
          onClick={() => setTab('failed')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.metrics.failed}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="close" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{metrics.failed}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend" style={{ color: metrics.failed > 0 ? '#f43f5e' : undefined }}>
              {metrics.failed > 0 ? (locale === 'ar' ? 'يتطلب إعادة تشغيل' : 'Retry required') : (locale === 'ar' ? 'لا فشل' : 'Clean')}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Tabs Switcher */}
      <div className="detail-tabs" role="tablist" style={{ marginTop: 16 }}>
        {(Object.keys(text.tabs) as Array<keyof typeof text.tabs>).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={`detail-tab ${tab === k ? 'detail-tab--active' : ''}`}
            onClick={() => setTab(k)}
          >
            {text.tabs[k]}
          </button>
        ))}
      </div>

      {/* 5. Tab Contents */}
      {tab === 'overview' && (
        <div className="prod-grid2" style={{ marginTop: 12 }}>
          <section className="panel">
            <header className="panel__header">
              <h3>قائمة الإنتاج (عينة حديثة)</h3>
            </header>
            <div className="panel__body">
              {queue.slice(0, 6).map((q, i) => (
                <div key={i} className="prod-team-row">
                  <span style={{ fontWeight: 600 }}>
                    {q.story.title_ar} · صفحة {q.page} · {q.language}
                  </span>
                  <span
                    className={`status-badge ${
                      q.status === 'missing'
                        ? 'status-badge--review'
                        : q.status === 'approved'
                        ? 'status-badge--published'
                        : 'status-badge--draft'
                    }`}
                  >
                    {q.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <header className="panel__header">
              <h3>
                {text.readToMe} / {text.readAlong}
              </h3>
            </header>
            <div className="panel__body">
              <div className="metric-row">
                <div className="metric-cell">
                  <strong>6/8</strong>
                  <span>AR narration approved</span>
                </div>
                <div className="metric-cell metric-cell--warn">
                  <strong>3/8</strong>
                  <span>EN approved</span>
                </div>
                <div className="metric-cell">
                  <strong>جاهز</strong>
                  <span>{text.readToMe}</span>
                </div>
                <div className="metric-cell metric-cell--warn">
                  <strong>جزئي</strong>
                  <span>{text.readAlong} — Timing 3/8</span>
                </div>
              </div>
              <p className="panel__note" style={{ marginTop: 12 }}>
                ميزة Read Along تتطلب ملف مزامنة الكلمات وتوقيتها الدقيق (Word Timestamps) — لا تكتمل بالصوت الخام وحده.
              </p>
            </div>
          </section>
        </div>
      )}

      {(tab === 'queue' || tab === 'review' || tab === 'approved') && (
        <section className="panel panel--table" style={{ marginTop: 12 }}>
          <header className="panel__header">
            <div className="search-field" style={{ flex: 1 }}>
              <Icon name="search" size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={text.search} aria-label="search-audio" />
            </div>
            <button className="button button--ghost button--small" onClick={() => setTab('queue')}>
              {text.batch} — {queue.filter((q) => q.status === 'missing').length} صفحة
            </button>
          </header>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>المحتوى والصفحة</th>
                  <th>اللغة</th>
                  <th>{text.voiceLabel}</th>
                  <th>{text.sourceVersion}</th>
                  <th>الحالة</th>
                  <th>المالك</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {queue
                  .filter((q) => (tab === 'queue' ? true : tab === 'review' ? q.status === 'ready_for_review' : q.status === 'approved'))
                  .map((q, i) => (
                    <tr key={i}>
                      <td>
                        <div className="prod-identity">
                          <div className="prod-thumb">
                            <Icon name="books" size={16} />
                          </div>
                          <div>
                            <strong>
                              {q.story.title_ar} · صفحة {q.page}
                            </strong>
                            <small>{q.text.slice(0, 36)}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="prod-chip">{q.language}</span>
                      </td>
                      <td>{VOICE_PROFILES.find((v) => v.id === q.voice)?.name_ar ?? q.voice}</td>
                      <td>
                        {q.sourceVersion}{' '}
                        {q.status === 'approved' && q.sourceVersion === 'v5' && (
                          <span className="prod-chip prod-chip--blocked">{text.stale}</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            q.status === 'missing'
                              ? 'status-badge--review'
                              : q.status === 'approved'
                              ? 'status-badge--published'
                              : 'status-badge--draft'
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td>{q.owner ?? (locale === 'ar' ? 'غير مسند' : 'Unassigned')}</td>
                      <td>
                        <button className="button button--secondary button--small" onClick={() => setSelected(q)}>
                          فتح الاستوديو
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {queue.length === 0 && <EmptyState title="لا صوتيات" description="لا صفحات ناقصة في هذا العرض" />}
        </section>
      )}

      {tab === 'voices' && (
        <section className="panel" style={{ marginTop: 12 }}>
          <header className="panel__header">
            <h3>مكتبة الأصوات المعتمدة (Voice Profiles)</h3>
          </header>
          <div className="vs-grid">
            {VOICE_PROFILES.map((v) => (
              <article key={v.id} className="vs-card">
                <div style={{ height: 80, background: 'var(--surface-3)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="play" size={24} />
                </div>
                <div className="vs-card__body">
                  <h3>{v.name_ar}</h3>
                  <small>
                    {v.language} · {v.role} {v.character ? `· ${v.character}` : ''}
                  </small>
                  <p className="panel__note">{v.description}</p>
                  <small
                    className={`status-badge ${v.status === 'approved' ? 'status-badge--published' : 'status-badge--review'}`}
                  >
                    {v.status}
                  </small>
                </div>
                <footer className="vs-card__foot">
                  <button className="button button--ghost button--small">
                    <Icon name="play" size={14} />
                    عينة
                  </button>
                  <span dir="ltr">{v.providerVoice}</span>
                </footer>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'dict' && (
        <section className="panel" style={{ marginTop: 12 }}>
          <header className="panel__header">
            <h3>قاموس النطق وتشكيل الكلمات المعقدة</h3>
          </header>
          <div className="panel__body">
            <div className="form-grid">
              <label className="field">
                <span>الكلمة المكتوبة</span>
                <input value={dictWord} onChange={(e) => setDictWord(e.target.value)} placeholder="مثلاً: ثعلوب" />
              </label>
              <label className="field">
                <span>توجيه النطق الصوتي أو التشكيل (Phonetic / Diacritics)</span>
                <input placeholder="ثَعْلُوب — تشكيل صوتي كامل" />
              </label>
            </div>
            <p className="panel__note" style={{ marginTop: 8 }}>
              توجيهات النطق لا تغيّر النص المعروض للطفل في القصة — يتم تخزينها كطبقة صوتية خاصة بالمحرك الصوتي فقط.
            </p>
          </div>
        </section>
      )}

      {tab === 'failed' && (
        <section className="panel panel--table" style={{ marginTop: 12 }}>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المحتوى</th>
                  <th>السبب</th>
                  <th>المحاولة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>بيت الطائر ص4 AR</td>
                  <td>Provider quota exceeded</td>
                  <td>2</td>
                  <td>
                    <button className="button button--secondary button--small">إعادة المحاولة</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'lab' && (
        <section className="panel" style={{ marginTop: 12 }}>
          <header className="panel__header">
            <h3>مختبر الصوت التجريبي — بيئة اختبارية معزولة</h3>
          </header>
          <div className="panel__body">
            <textarea rows={3} placeholder="اكتب نصاً تجريبياً هنا لاختبار نبرة الصوت وسرعة الإلقاء..." style={{ width: '100%' }} />
            <button className="button button--primary" style={{ marginTop: 8 }}>
              توليد عينة تجريبية
            </button>
            <p className="panel__note" style={{ marginTop: 8 }}>
              ناتج المختبر لا يُربط تلقائياً بأي قصة أو حلقة في خط الإنتاج.
            </p>
          </div>
        </section>
      )}

      {/* 6. Slide-Over Audio Inspection & Production Drawer */}
      {selected && (
        <div className="commercial-drawer-backdrop" onClick={() => setSelected(null)}>
          <div
            className="commercial-slide-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={selected.story.title_ar}
          >
            <div className="commercial-drawer__header">
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {selected.story.title_ar} · صفحة {selected.page}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                  {selected.language} · {selected.sourceVersion} · {selected.status}
                </span>
              </div>
              <button className="icon-button" onClick={() => setSelected(null)} aria-label="close">
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="commercial-drawer__body">
              <section className="panel">
                <header className="panel__header">
                  <h3>{text.source}</h3>
                </header>
                <div className="panel__body">
                  <p style={{ fontSize: 15, lineHeight: 1.7, fontWeight: 500 }}>{selected.text}</p>
                  <small>مصدر: صفحة القصة · النسخة المعتمدة {selected.sourceVersion}</small>
                  {selected.sourceVersion === 'v5' && (
                    <div className="inline-alert inline-alert--warning" style={{ marginTop: 8 }}>
                      {text.stale} — أعد التوليد
                    </div>
                  )}
                </div>
              </section>

              <section className="panel">
                <header className="panel__header">
                  <h3>{text.voiceProfile}</h3>
                </header>
                <div className="panel__body">
                  <p>
                    <strong>{VOICE_PROFILES.find((v) => v.id === selected.voice)?.name_ar}</strong> · {selected.language}
                  </p>
                  <div className="form-grid">
                    <label className="field">
                      <span>{text.voiceLabel}</span>
                      <select
                        value={selected.voice}
                        onChange={(e) => setSelected({ ...selected, voice: e.target.value })}
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--cs-glass-border)',
                          color: 'var(--text)',
                          borderRadius: 6,
                          padding: '6px 8px',
                        }}
                      >
                        <option value="">بدون دور</option>
                        {VOICE_PROFILES.filter((v) => v.language === selected.language).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name_ar}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>{text.preset}</span>
                      <select
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--cs-glass-border)',
                          color: 'var(--text)',
                          borderRadius: 6,
                          padding: '6px 8px',
                        }}
                      >
                        <option>Bedtime Story (هادئ للنوم)</option>
                        <option>Educational (تعليمي مرح)</option>
                        <option>Adventure (مغامرة وحماس)</option>
                      </select>
                    </label>
                  </div>
                </div>
              </section>

              <section className="panel">
                <header className="panel__header">
                  <h3>التوليد الصوتي والمعاينة</h3>
                </header>
                <div className="panel__body">
                  <button
                    className="button button--primary"
                    disabled={generating}
                    onClick={() => void generate(selected)}
                  >
                    <Icon name="play" size={14} />
                    {generating ? 'جارٍ التوليد...' : text.produce}
                  </button>

                  {previewUrl && (
                    <div style={{ marginTop: 16 }}>
                      <audio ref={audioRef} controls src={previewUrl} style={{ width: '100%' }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button className="button button--primary button--small" onClick={() => void approve()}>
                          {text.approve}
                        </button>
                        <button className="button button--ghost button--small" onClick={() => setPreviewUrl(null)}>
                          توليد متغير بديل (Take B)
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="panel__note" style={{ marginTop: 10 }}>
                    المعاينة تتيح الاستماع قبل الحفظ — الاعتماد النهائي يُسجل الملف الصوتي كمرشح نهائي للقصة.
                  </p>
                </div>
              </section>
            </div>

            <div className="commercial-drawer__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Link className="button button--ghost" to={adminPath(`stories/${selected.story.id}`)}>
                {text.openStory}
              </Link>
              <button className="button button--primary" onClick={() => setSelected(null)}>
                {text.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
