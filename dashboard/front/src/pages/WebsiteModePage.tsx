/**
 * وضع الموقع العام — /admin/website/mode
 *
 * ## ما تغيّر عن النسخة السابقة، ولماذا
 *
 * ١. **البانر كان يكذب.** «الوضع الحالي» كان يُقرأ من حالة الراديو، فبمجرّد لمس
 *    بطاقة تُعلن الشاشة أن الموقع صار «تحت الصيانة» قبل أي حفظ. هنا صار للشاشة
 *    مصدران منفصلان: `published` (ما أعاده الخادم آخر مرة، وهو ما يراه الزائر
 *    فعلًا) و`draft` (ما يحرّره المسؤول). اللوحة العليا تقرأ من الأول حصرًا،
 *    والفرق بينهما يظهر كشارة «تغييرات غير محفوظة».
 *
 * ٢. **الحفظ لا يعمل إلا على فرق فعلي.** زرّ حفظ نشط دائمًا يدفع المسؤول إلى
 *    كتابة سجلّ تدقيق (`site_mode_changed`) لا يقابله تغيير.
 *
 * ٣. **الانتقال من «مباشر» يمرّ بتأكيد صريح** عبر `Modal` المشترك لا عبر
 *    `confirm()` الأصلي: النافذة الأصلية بلا لغة الشاشة ولا اتجاهها، ولا تشرح
 *    الأثر. كان في الكود `confirmChange` معطَّلًا لا يقرأه أحد و`doSave(newMode)`
 *    لا يُستدعى بمعامل قطّ، أي أن التأكيد كان ميتًا أصلًا.
 *
 * ٤. **الأثر مكتوب لكل وضع** بدل جملة إنجليزية واحدة داخل واجهة عربية. والنصّ
 *    مطابق للمنفَّذ فعلًا: تحقّقتُ من `api/src/routes/siteMode.ts` — نقطة الحالة
 *    تُعيد 200 دائمًا وتضيف `Retry-After` في وضع الصيانة فقط، وصفحات الحالة
 *    تُرسم في المتصفح (`App.tsx` + `StatusPages.tsx`) فلا 503 ولا `noindex` على
 *    الصفحة نفسها. الوصف القديم «503 للمحركات — يحافظ على الفهرسة» كان يَعِد
 *    بسلوك غير موجود، وهو أسوأ نوع من نصّ الواجهة: قرار SEO يُبنى عليه.
 *
 * ٥. **لا أنماط سطرية.** كانت الشاشة تكتب `background:'#f0fdf4'` و`'#fff'`
 *    و`borderColor:'red'` وتستدعي `var(--border)` — توكن غير موجود — فتظهر
 *    كتلًا فاتحة داخل لوحة داكنة. كل الهيئة الآن في `dashboard.css` تحت
 *    `.mode-*`، وهي أصلًا مكتوبة هناك ولم تكن الشاشة تُصدر أصنافها.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'
import { hasPermission } from '../lib/adminSession'
import { api } from '../lib/api'
import { formatDate, formatNumber, localeCode } from '../lib/labels'
import type { SiteMode, SiteModeEnvelope, SiteModeSettings } from '../types/api'

const EMPTY: SiteModeSettings = {
  site_mode: 'construction',
  site_launch_at: '',
  site_status_message: '',
  maintenance_eta_minutes: '',
}

const MODE_ICON: Record<SiteMode, IconName> = {
  live: 'globe',
  construction: 'sparkles',
  maintenance: 'settings',
}

const MESSAGE_LIMIT = 500

type ModeCopy = {
  title: string
  desc: string
  /** ما يراه الزائر بالضبط */
  visitor: string
  /** ما تراه محركات البحث — منقول عن المنفَّذ لا عن المنشود */
  crawlers: string
}

type PageCopy = {
  eyebrow: string
  title: string
  lede: string
  refresh: string
  visitorSees: string
  pending: string
  factLaunch: string
  factRetry: string
  factMessage: string
  factAdmin: string
  shown: string
  none: string
  alwaysOn: string
  seconds: string
  minute: string
  chooseKicker: string
  chooseTitle: string
  chooseHint: string
  currentPill: string
  launchLabel: string
  launchHint: string
  launchPast: string
  messageLabel: string
  messageHint: string
  messageCount: string
  etaLabel: string
  etaHint: string
  impactVisitor: string
  impactCrawlers: string
  impactAdmin: string
  impactAdminValue: string
  save: string
  saving: string
  savedTitle: string
  savedBody: string
  discard: string
  noChanges: string
  dirtyHint: string
  denied: string
  errorTitle: string
  confirmTitle: string
  confirmDescription: string
  confirmLead: string
  confirmGo: string
  cancel: string
  preview: string
  previewKicker: string
  previewHint: string
  previewOpen: string
  previewLangNote: string
  previewCards: Record<'construction' | 'maintenance' | 'notFound', { title: string; desc: string }>
  modes: Record<SiteMode, ModeCopy>
}

const copy: Record<Locale, PageCopy> = {
  ar: {
    eyebrow: 'الموقع العام',
    title: 'وضع الموقع',
    lede: 'يحدّد ما يراه زائر majarra.app. لوحة الإدارة تبقى متاحة في كل الأوضاع.',
    refresh: 'إعادة قراءة الحالة من الخادم',
    visitorSees: 'ما يراه الزائر الآن',
    pending: 'تغييرات غير محفوظة',
    factLaunch: 'موعد الإطلاق',
    factRetry: 'ترويسة Retry-After',
    factMessage: 'رسالة الزائر',
    factAdmin: 'لوحة الإدارة',
    shown: 'معروضة',
    none: 'لا توجد',
    alwaysOn: 'متاحة',
    seconds: 'ثانية',
    minute: 'دقيقة',
    chooseKicker: 'الإعداد',
    chooseTitle: 'اختر الوضع',
    chooseHint: 'يُطبَّق على الزوار بعد الحفظ فقط.',
    currentPill: 'المنشور الآن',
    launchLabel: 'موعد الإطلاق',
    launchHint: 'اختياري — يظهر كعدّاد في صفحة «قريبًا». بتوقيت جهازك.',
    launchPast: 'الموعد في الماضي، فلن يظهر عدّاد.',
    messageLabel: 'رسالة للزائر',
    messageHint: 'اختيارية — تُعرض بدل النصّ الافتراضي كما كتبتها.',
    messageCount: 'حرفًا',
    etaLabel: 'مدة الصيانة المتوقّعة (دقائق)',
    etaHint: 'تُترجم إلى Retry-After على نقطة حالة الموقع.',
    impactVisitor: 'الزائر',
    impactCrawlers: 'محركات البحث',
    impactAdmin: 'لوحة الإدارة',
    impactAdminValue: '/admin يبقى متاحًا في كل الأوضاع — لا يمكن أن يحجب هذا الإعداد عنك اللوحة.',
    save: 'حفظ ونشر',
    saving: 'جارٍ الحفظ…',
    savedTitle: 'حُفظ',
    savedBody: 'صار هذا ما يراه الزائر الآن.',
    discard: 'تجاهل التغييرات',
    noChanges: 'لا تغييرات بعد. عدّل شيئًا ليُفعَّل الحفظ.',
    dirtyHint: 'الزوار لا يرون هذه التعديلات حتى تحفظها.',
    denied: 'تحتاج صلاحية النشر لتغيير وضع الموقع.',
    errorTitle: 'تعذّر الحفظ',
    confirmTitle: 'إخراج الموقع من وضع «مباشر»؟',
    confirmDescription: 'الموقع منشور الآن، والحفظ سيُخفيه عن كل زائر.',
    confirmLead: 'كل زائر لصفحة الهبوط سيرى صفحة الحالة بدلًا منها فورًا بعد الحفظ. لوحة الإدارة لا تتأثر.',
    confirmGo: 'نعم، غيّر الوضع',
    cancel: 'إلغاء',
    preview: 'معاينة صفحات الحالة',
    previewKicker: 'قبل النشر',
    previewHint: 'تفتح الصفحة كما يراها الزائر بلا تغيير أي إعداد.',
    previewOpen: 'يفتح في تبويب جديد',
    previewLangNote: 'اللغة تتبع متصفّح الزائر، فالمعاينة تظهر بلغة جهازك.',
    previewCards: {
      construction: { title: 'تحت الإنشاء', desc: 'صفحة «قريبًا» مع العدّاد إن حُدِّد موعد.' },
      maintenance: { title: 'تحت الصيانة', desc: 'صفحة الانقطاع مع المدة المتوقّعة.' },
      notFound: { title: '404', desc: 'صفحة المسار غير الموجود ومراسيها.' },
    },
    modes: {
      live: {
        title: 'مباشر',
        desc: 'صفحة الهبوط مرئية لكل زائر.',
        visitor: 'صفحة الهبوط كاملة كما هي.',
        crawlers: 'الصفحة تُخدَم بحالة 200 وتُفهرس كالمعتاد.',
      },
      construction: {
        title: 'تحت الإنشاء',
        desc: 'ما قبل الإطلاق: صفحة «قريبًا».',
        visitor: 'صفحة «قريبًا»، ومعها عدّاد إن حُدِّد موعد الإطلاق.',
        crawlers: 'تُخدَم بحالة 200 كذلك — هذا المسار لا يُرسل 503 ولا noindex.',
      },
      maintenance: {
        title: 'تحت الصيانة',
        desc: 'انقطاع مؤقّت معلن لموقع منشور.',
        visitor: 'صفحة الصيانة، ومعها المدة المتوقّعة إن حُدِّدت.',
        crawlers: 'Retry-After تُرسل على نقطة حالة الموقع؛ الصفحة نفسها تُخدَم بحالة 200.',
      },
    },
  },
  en: {
    eyebrow: 'Public website',
    title: 'Website mode',
    lede: 'What a visitor to majarra.app sees. The admin panel stays reachable in every mode.',
    refresh: 'Re-read the state from the server',
    visitorSees: 'What visitors see right now',
    pending: 'Unsaved changes',
    factLaunch: 'Launch date',
    factRetry: 'Retry-After header',
    factMessage: 'Visitor message',
    factAdmin: 'Admin panel',
    shown: 'Shown',
    none: 'None',
    alwaysOn: 'Reachable',
    seconds: 'seconds',
    minute: 'min',
    chooseKicker: 'Setting',
    chooseTitle: 'Choose a mode',
    chooseHint: 'Applies to visitors only once saved.',
    currentPill: 'Published now',
    launchLabel: 'Launch date',
    launchHint: 'Optional — drives the countdown on the coming-soon page. In your device time.',
    launchPast: 'This date is in the past, so no countdown will show.',
    messageLabel: 'Visitor message',
    messageHint: 'Optional — replaces the default text exactly as written.',
    messageCount: 'characters',
    etaLabel: 'Expected maintenance window (minutes)',
    etaHint: 'Becomes Retry-After on the site status endpoint.',
    impactVisitor: 'Visitor',
    impactCrawlers: 'Search engines',
    impactAdmin: 'Admin panel',
    impactAdminValue: '/admin stays reachable in every mode — this setting cannot lock you out.',
    save: 'Save and publish',
    saving: 'Saving…',
    savedTitle: 'Saved',
    savedBody: 'This is what visitors see now.',
    discard: 'Discard changes',
    noChanges: 'Nothing changed yet. Edit something to enable saving.',
    dirtyHint: 'Visitors do not see these edits until you save.',
    denied: 'Changing the website mode requires the publish permission.',
    errorTitle: 'Could not save',
    confirmTitle: 'Take the site out of Live?',
    confirmDescription: 'The site is published, and saving will hide it from every visitor.',
    confirmLead: 'Everyone who opens the landing page will get the status page instead, immediately after saving. The admin panel is unaffected.',
    confirmGo: 'Yes, change the mode',
    cancel: 'Cancel',
    preview: 'Preview status pages',
    previewKicker: 'Before publishing',
    previewHint: 'Opens the page as a visitor sees it without changing any setting.',
    previewOpen: 'Opens in a new tab',
    previewLangNote: 'Language follows the visitor browser, so the preview uses your device language.',
    previewCards: {
      construction: { title: 'Coming soon', desc: 'The pre-launch page, with a countdown when a date is set.' },
      maintenance: { title: 'Maintenance', desc: 'The outage page with the expected window.' },
      notFound: { title: '404', desc: 'The unknown-route page and its anchors.' },
    },
    modes: {
      live: {
        title: 'Live',
        desc: 'The landing page is visible to every visitor.',
        visitor: 'The full landing page as it is.',
        crawlers: 'Served with 200 and indexed as usual.',
      },
      construction: {
        title: 'Coming soon',
        desc: 'Pre-launch: the coming-soon page.',
        visitor: 'The coming-soon page, plus a countdown when a launch date is set.',
        crawlers: 'Also served with 200 — this path sends neither 503 nor noindex.',
      },
      maintenance: {
        title: 'Maintenance',
        desc: 'A declared temporary outage of a published site.',
        visitor: 'The maintenance page, plus the expected window when set.',
        crawlers: 'Retry-After is sent on the site status endpoint; the page itself is served with 200.',
      },
    },
  },
}

const PREVIEW_CARDS: { key: 'construction' | 'maintenance' | 'notFound'; href: string; icon: IconName }[] = [
  { key: 'construction', href: '/?preview=construction', icon: 'sparkles' },
  { key: 'maintenance', href: '/?preview=maintenance', icon: 'settings' },
  { key: 'notFound', href: '/_not-found-preview', icon: 'search' },
]

export function WebsiteModePage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  /// المسوّدة: ما يحرّره المسؤول ولم يُنشَر بعد.
  const [draft, setDraft] = useState<SiteModeSettings>(EMPTY)
  /// المنشور: آخر ما أعاده الخادم. مصدر كل ما تعلنه اللوحة العليا.
  const [published, setPublished] = useState<SiteModeSettings>(EMPTY)
  const [meta, setMeta] = useState<SiteModeEnvelope | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  /// إعلان النجاح يُعرض ما دامت المسوّدة مطابقة للمنشور. أوّل تعديل جديد يُخفيه
  /// تلقائيًّا، فلا تبقى على الشاشة عبارة «حُفظ» فوق حقول تغيّرت بعدها.
  const [saved, setSaved] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  /// يُحدَّث كل نصف دقيقة ليبقى «بعد ثلاثة أيام» صحيحًا بلا إعادة تحميل.
  const [now, setNow] = useState(() => Date.now())

  const canPublish = hasPermission('publish')

  /// اللغة تُقرأ من مرجع لا من مغلّف `load`: لو كانت في تبعيّاته لأعاد تبديل
  /// اللغة القراءة من الخادم، فيمحو مسوّدة لم تُحفظ بعد. تبديل اللغة عرضٌ لا
  /// إعادة تحميل.
  const localeRef = useRef(locale)
  localeRef.current = locale

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.siteMode()
      const settings = { ...EMPTY, ...response.data.settings }
      setDraft(settings)
      setPublished(settings)
      setMeta(response.data)
      setSaved(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : localeRef.current === 'ar' ? 'تعذّرت القراءة' : 'Unable to read')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const dirty = useMemo(
    () => (Object.keys(EMPTY) as (keyof SiteModeSettings)[]).some((key) => draft[key] !== published[key]),
    [draft, published],
  )

  const save = useCallback(async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const response = await api.saveSiteMode(draft)
      const settings = { ...EMPTY, ...response.data.settings }
      setDraft(settings)
      setPublished(settings)
      setMeta(response.data)
      setSaved(true)
      setConfirmOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.errorTitle)
      setConfirmOpen(false)
    } finally {
      setSaving(false)
    }
  }, [draft, text.errorTitle])

  /// إخفاء موقع منشور قرار لا رجعة فيه من جهة الزائر، فيمرّ بتأكيد يشرح الأثر.
  /// بقية الانتقالات تُحفظ مباشرة: الطريق إلى «مباشر» لا يحجب أحدًا.
  const requestSave = () => {
    if (published.site_mode === 'live' && draft.site_mode !== 'live') { setConfirmOpen(true); return }
    void save()
  }

  if (loading) return <LoadingState />
  if (error && !meta) return <ErrorState message={error} onRetry={() => void load()} />

  const visitorMode = meta?.preview.mode ?? published.site_mode
  const visitorCopy = text.modes[visitorMode]
  const draftMode = draft.site_mode
  const modes = meta?.modes ?? (['live', 'construction', 'maintenance'] as SiteMode[])
  const launchAt = meta?.preview.launchAt ?? null
  const retryAfter = meta?.preview.retryAfterSeconds ?? null
  const draftLaunchIsPast = draftMode === 'construction'
    && draft.site_launch_at.trim() !== ''
    && new Date(draft.site_launch_at).getTime() < now

  return (
    <div className="page-stack mode-page">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <div className="page-intro__actions">
          <button className="icon-button" type="button" onClick={() => void load()} disabled={saving} title={text.refresh} aria-label={text.refresh}>
            <Icon name="refresh" size={17} />
          </button>
        </div>
      </section>

      {saved && !dirty && (
        <div className="panel panel--notice panel--notice--ok" role="status">
          <span className="mode-notice__icon"><Icon name="check" size={17} /></span>
          <strong>{text.savedTitle}</strong>
          <p>{text.savedBody}</p>
        </div>
      )}
      {error && (
        <div className="panel panel--notice panel--notice--bad" role="alert">
          <span className="mode-notice__icon"><Icon name="warning" size={17} /></span>
          <strong>{text.errorTitle}</strong>
          <p>{error}</p>
        </div>
      )}
      {!canPublish && (
        <div className="panel panel--notice" role="status">
          <span className="mode-notice__icon"><Icon name="rights" size={17} /></span>
          <strong>{text.denied}</strong>
        </div>
      )}

      {/* اللوحة العليا تقرأ من الخادم لا من المسوّدة: هذه هي الحقيقة المنشورة */}
      <section className="panel mode-hero" data-mode={visitorMode}>
        <div className="mode-hero__row">
          <div className="mode-hero__state">
            <span className="mode-hero__icon"><Icon name={MODE_ICON[visitorMode]} size={24} /></span>
            <div className="mode-hero__text">
              <span className="mode-hero__kicker">
                <span className="mode-dot mode-dot--pulse" aria-hidden="true" />
                {text.visitorSees}
              </span>
              <span className="mode-hero__title">{visitorCopy.title}</span>
              <p className="mode-hero__desc">{visitorCopy.visitor}</p>
            </div>
          </div>
          {dirty && (
            <span className="mode-pending">
              <Icon name="warning" size={14} />
              {text.pending}
            </span>
          )}
        </div>

        <div className="mode-hero__facts">
          {launchAt && (
            <div className="mode-fact mode-fact--accent">
              <span>{text.factLaunch}</span>
              <strong>{formatDate(launchAt, locale, true)}</strong>
              <small>{relativeTime(launchAt, locale, now)}</small>
            </div>
          )}
          {retryAfter !== null && (
            <div className="mode-fact mode-fact--accent">
              <span>{text.factRetry}</span>
              <strong>{`${formatNumber(retryAfter, locale)} ${text.seconds}`}</strong>
              <small>{`${formatNumber(Math.round(retryAfter / 60), locale)} ${text.minute}`}</small>
            </div>
          )}
          <div className="mode-fact">
            <span>{text.factMessage}</span>
            <strong>{meta?.preview.message ? text.shown : text.none}</strong>
          </div>
          <div className="mode-fact">
            <span>{text.factAdmin}</span>
            <strong>{text.alwaysOn}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__kicker">{text.chooseKicker}</span>
            <h3>{text.chooseTitle}</h3>
            <p className="panel__note">{text.chooseHint}</p>
          </div>
        </header>

        <div className="mode-grid" role="radiogroup" aria-label={text.chooseTitle}>
          {modes.map((mode) => {
            const item = text.modes[mode]
            return (
              <label
                key={mode}
                className={`mode-card${draftMode === mode ? ' mode-card--active' : ''}${canPublish ? '' : ' mode-card--locked'}`}
                data-mode={mode}
              >
                <input
                  type="radio"
                  name="site_mode"
                  value={mode}
                  checked={draftMode === mode}
                  disabled={!canPublish}
                  onChange={() => setDraft((current) => ({ ...current, site_mode: mode }))}
                />
                <span className="mode-card__head">
                  <span className="mode-card__icon"><Icon name={MODE_ICON[mode]} size={18} /></span>
                  <span className="mode-card__check" aria-hidden="true"><Icon name="check" size={13} /></span>
                </span>
                <strong>{item.title}</strong>
                <small>{item.desc}</small>
                {published.site_mode === mode && (
                  <span className="mode-card__live">
                    <span className="mode-dot" aria-hidden="true" />
                    {text.currentPill}
                  </span>
                )}
              </label>
            )
          })}
        </div>

        {(draftMode === 'construction' || draftMode === 'maintenance') && (
          <div className="mode-fields">
            {draftMode === 'construction' && (
              <label className="field">
                <span>{text.launchLabel}</span>
                <input
                  type="datetime-local"
                  value={toLocalInput(draft.site_launch_at)}
                  disabled={!canPublish}
                  onChange={(event) => setDraft((current) => ({ ...current, site_launch_at: fromLocalInput(event.target.value) }))}
                />
                <small>{draftLaunchIsPast ? <span className="mode-warn">{text.launchPast}</span> : text.launchHint}</small>
              </label>
            )}

            {draftMode === 'maintenance' && (
              <label className="field">
                <span>{text.etaLabel}</span>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  dir="ltr"
                  value={draft.maintenance_eta_minutes}
                  disabled={!canPublish}
                  onChange={(event) => setDraft((current) => ({ ...current, maintenance_eta_minutes: event.target.value.replace(/[^\d]/g, '') }))}
                />
                <small>{text.etaHint}</small>
              </label>
            )}

            <label className="field field--wide">
              <span>{text.messageLabel}</span>
              <textarea
                rows={3}
                maxLength={MESSAGE_LIMIT}
                value={draft.site_status_message}
                disabled={!canPublish}
                onChange={(event) => setDraft((current) => ({ ...current, site_status_message: event.target.value }))}
              />
              <small className="mode-counter">
                <span>{text.messageHint}</span>
                <span dir="ltr"><b>{draft.site_status_message.length}</b>{`/${MESSAGE_LIMIT} ${text.messageCount}`}</span>
              </small>
            </label>
          </div>
        )}

        {/* أثر الوضع المختار — لا الوضع المنشور: هذا ما سيحدث عند الحفظ */}
        <dl className="mode-impact" data-mode={draftMode}>
          <div>
            <dt><span className="mode-impact__icon"><Icon name="eye" size={15} /></span>{text.impactVisitor}</dt>
            <dd>{text.modes[draftMode].visitor}</dd>
          </div>
          <div>
            <dt><span className="mode-impact__icon"><Icon name="seo" size={15} /></span>{text.impactCrawlers}</dt>
            <dd>{text.modes[draftMode].crawlers}</dd>
          </div>
          <div>
            <dt><span className="mode-impact__icon"><Icon name="rights" size={15} /></span>{text.impactAdmin}</dt>
            <dd>{text.impactAdminValue}</dd>
          </div>
        </dl>

        <div className="mode-actions">
          <p className="mode-actions__hint">{dirty ? text.dirtyHint : text.noChanges}</p>
          <div className="mode-actions__buttons">
            <button
              className="button button--ghost"
              type="button"
              onClick={() => { setDraft(published); setError(''); setSaved(false) }}
              disabled={!dirty || saving}
            >
              <Icon name="refresh" size={15} />
              {text.discard}
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={requestSave}
              disabled={!dirty || saving || !canPublish}
              title={canPublish ? undefined : text.denied}
            >
              <Icon name="check" size={15} />
              {saving ? text.saving : text.save}
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__kicker">{text.previewKicker}</span>
            <h3>{text.preview}</h3>
            <p className="panel__note">{text.previewHint}</p>
          </div>
        </header>
        <div className="mode-preview-grid">
          {PREVIEW_CARDS.map((card) => {
            const item = text.previewCards[card.key]
            return (
              <a key={card.key} className="mode-preview-card" href={card.href} target="_blank" rel="noreferrer">
                <span className="mode-preview-card__top">
                  <Icon name={card.icon} size={19} />
                  <Icon name="link" size={14} />
                </span>
                <strong>{item.title}</strong>
                <small>{item.desc}</small>
                {/* ltr صريح: رموز اللغات لاتينية، وفي سياق rtl يُقلب ترتيبها
                    فتُقرأ «Mobile Desktop FR EN AR» — تتابع بلا معنى. */}
                <span className="mode-preview-card__meta" dir="ltr">
                  <span>AR</span><span>EN</span><span>FR</span>
                  <span>Desktop</span><span>Mobile</span>
                </span>
                <small>{text.previewOpen}</small>
              </a>
            )
          })}
        </div>
        <p className="mode-preview-note">{text.previewLangNote}</p>
      </section>

      <Modal
        open={confirmOpen}
        onClose={() => !saving && setConfirmOpen(false)}
        title={text.confirmTitle}
        description={text.confirmDescription}
      >
        <div className="mode-confirm">
          <div className="mode-confirm__from">
            <span className="mode-dot mode-dot--live" aria-hidden="true" />
            <strong>{text.modes.live.title}</strong>
            <span className="mode-confirm__arrow" aria-hidden="true"><Icon name="arrow" size={15} /></span>
            <span className={`mode-dot mode-dot--${draftMode}`} aria-hidden="true" />
            <strong>{text.modes[draftMode].title}</strong>
          </div>
          <p className="mode-confirm__lead">{text.confirmLead}</p>
          <p className="mode-confirm__lead">{text.modes[draftMode].visitor}</p>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setConfirmOpen(false)} disabled={saving}>
              {text.cancel}
            </button>
            <button className="button button--danger" type="button" onClick={() => void save()} disabled={saving}>
              {saving ? text.saving : text.confirmGo}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/** ISO مخزَّن ← قيمة `datetime-local` بتوقيت الجهاز */
function toLocalInput(iso: string) {
  if (!iso.trim()) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** قيمة `datetime-local` ← ISO للتخزين */
function fromLocalInput(value: string) {
  if (!value.trim()) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

/**
 * «بعد ثلاثة أيام» بدل طابع زمني خام.
 *
 * الطابع وحده يجبر القارئ على حساب الفرق ذهنيًّا، وهو الحساب الذي يُخطئ فيه
 * أحدهم فيُطلق الموقع بعد أسبوع من الموعد. التاريخ الكامل يبقى معروضًا فوقه،
 * فالنسبي إضافة لا بديل.
 */
function relativeTime(iso: string, locale: Locale, now: number) {
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return ''
  const diff = target - now
  const formatter = new Intl.RelativeTimeFormat(localeCode(locale), { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86_400_000], ['hour', 3_600_000], ['minute', 60_000]]
  for (const [unit, span] of units) {
    if (Math.abs(diff) >= span) return formatter.format(Math.round(diff / span), unit)
  }
  return formatter.format(Math.round(diff / 1000), 'second')
}
