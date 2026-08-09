/**
 * صفحات الحالة: تحت الإنشاء · تحت الصيانة · 404.
 *
 * ملف واحد لأن الثلاثة يتشاركون الهيكل والحركة والنصوص، والفصل إلى ثلاثة
 * ملفات كان سيكرّر الغلاف ثلاث مرات. الاختلاف بينها بيانات لا بنية.
 *
 * لا تستورد أي قسم من صفحة الهبوط ولا landing.css: هذه الصفحات تُعرض *بدل*
 * الهبوط، فتحميل أنماط أقسام لن تُركَّب هدر خالص. الأنماط في styles/status.css.
 *
 * ## ما تغيّر في هذه النسخة
 *
 * النسخة الأولى كانت لوحة إدارية: أيقونات خطّية رمادية وخلفية نجوم ثابتة، بلا
 * لوجو ولا أصول التطبيق. مجرة تطبيق كرتون للأطفال، ومن يفتح رابطًا قبل الإطلاق
 * يجب أن يرى المنصّة نفسها. الآن:
 *
 * - اللوجو الحقيقي من assets/majarra-logo.webp في المدار وفي الترويسة
 * - الكواكب التسعة من public/landing/planets تدور في مدار حقيقي
 * - أفاتار الأطفال الثلاثة من public/landing/app/avatars
 * - أغلفة الأقسام في روابط 404 بدل سهم مكرّر
 *
 * كل هذه الأصول كانت موجودة ومستخدمة في صفحة الهبوط بالفعل، ولم تكن مستخدمة هنا.
 */

import { useEffect, useMemo, useState } from 'react'
import { localeMeta, type LandingLocale } from '../landing/i18n'
import type { SiteStatus } from '../landing/siteModeApi'
import logo from '../assets/majarra-logo.webp'
import '../styles/status.css'

/* ------------------------------------------------------------------- أصول */

/**
 * الكواكب المعروضة في المدار.
 *
 * نفس ملفات صفحة الهبوط (structure.ts). الزوايا موزّعة بالتساوي على حلقتين:
 * خمسة على الخارجية وأربعة على الداخلية، بنفس منطق `orbitStyle` هناك، فلا
 * يتلامس كوكبان.
 */
const ORBIT_PLANETS: { src: string; alt: string; radius: number; angle: number }[] = [
  { src: '/landing/planets/planet-abjad.webp', alt: 'أبجد', radius: 44, angle: -90 },
  { src: '/landing/planets/planet-numbers.webp', alt: 'أرقام', radius: 44, angle: -18 },
  { src: '/landing/planets/planet-science.webp', alt: 'علوم', radius: 44, angle: 54 },
  { src: '/landing/planets/planet-stories.webp', alt: 'قصص', radius: 44, angle: 126 },
  { src: '/landing/planets/planet-creativity.webp', alt: 'مهارات', radius: 44, angle: 198 },
  { src: '/landing/planets/planet-iman.webp', alt: 'إيمان', radius: 22, angle: -45 },
  { src: '/landing/planets/planet-tarikh.webp', alt: 'تاريخ', radius: 22, angle: 45 },
  { src: '/landing/planets/planet-alamna.webp', alt: 'عالمنا', radius: 22, angle: 135 },
  { src: '/landing/planets/planet-maharat.webp', alt: 'حياة', radius: 22, angle: 225 },
]

/// أفاتار الأطفال الحقيقية من أصول التطبيق.
const CREW = [
  '/landing/app/avatars/avatar-girl-lavender-hijab.webp',
  '/landing/app/avatars/avatar-boy-neat-hair.webp',
  '/landing/app/avatars/avatar-girl-curly-glasses.webp',
]

/// يحوّل زاوية ونصف قطر إلى موضع مئوي، بنفس حساب Worlds.tsx في الهبوط.
function orbitStyle(radius: number, angle: number) {
  const rad = (angle * Math.PI) / 180
  return {
    insetInlineStart: `${50 + radius * Math.cos(rad)}%`,
    insetBlockStart: `${50 + radius * Math.sin(rad)}%`,
  }
}

/* ------------------------------------------------------------------ أيقونات */

const ICONS = {
  /* ترس صيانة: يدور فعلًا في وضع الصيانة عبر status.css */
  gear: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3M5.4 5.4l2.1 2.1M16.5 16.5l2.1 2.1M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20H4z" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  rocket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3c3 2 4.5 5 4.5 8.5L12 16l-4.5-4.5C7.5 8 9 5 12 3Z" />
      <path d="M9.5 15.5 8 20l4-2 4 2-1.5-4.5" />
    </svg>
  ),
} as const

/* -------------------------------------------------------------------- نصوص */

type StatusCopy = {
  brandSub: string
  crewAlt: string
  orbitAlt: string
  construction: { kicker: string; title: string; titleAccent: string; lede: string; launchLabel: string }
  maintenance: { kicker: string; title: string; titleAccent: string; lede: string; eta: (minutes: number) => string; etaUnknown: string; retry: string }
  notFound: { kicker: string; title: string; titleAccent: string; lede: string; suggestions: string }
  units: { days: string; hours: string; minutes: string; seconds: string }
  home: string
  explore: string
  rights: string
  links: { plans: string; worlds: string; ages: string; faq: string; partners: string }
}

const COPY: Record<LandingLocale, StatusCopy> = {
  ar: {
    brandSub: 'منصّة تعلّم عربية للأطفال',
    crewAlt: 'شخصيات مجرة',
    orbitAlt: 'عوالم مجرة التسعة',
    construction: {
      kicker: 'قريبًا',
      title: 'نبني شيئًا ',
      titleAccent: 'يستحق الانتظار',
      lede: 'تسع عوالم مليئة بالقصص والحلقات والألعاب، في مكان واحد آمن لأطفالك. نضع اللمسات الأخيرة الآن.',
      launchLabel: 'الوقت المتوقّع للإطلاق',
    },
    maintenance: {
      kicker: 'صيانة جارية',
      title: 'نُجري بعض ',
      titleAccent: 'أعمال الصيانة',
      lede: 'نُحدّث المنصّة لتعمل أسرع وأكثر استقرارًا. لا شيء من بيانات أطفالك في خطر، وسنعود قريبًا.',
      eta: (minutes) => `المدة المتوقّعة: ${formatDuration(minutes, 'ar')}`,
      etaUnknown: 'نعمل على ذلك الآن',
      retry: 'إعادة المحاولة',
    },
    notFound: {
      kicker: 'صفحة غير موجودة',
      title: 'هذه الصفحة ',
      titleAccent: 'تاهت بين الكواكب',
      lede: 'الرابط الذي فتحته لا يؤدّي إلى صفحة موجودة. قد يكون قديمًا أو فيه خطأ مطبعي.',
      suggestions: 'ربما تقصد',
    },
    units: { days: 'يوم', hours: 'ساعة', minutes: 'دقيقة', seconds: 'ثانية' },
    home: 'الصفحة الرئيسية',
    explore: 'استعرض المنصّة',
    rights: 'جميع الحقوق محفوظة',
    links: { plans: 'الخطط والأسعار', worlds: 'عوالم مجرة', ages: 'المراحل العمرية', faq: 'الأسئلة الشائعة', partners: 'الشراكات' },
  },
  en: {
    brandSub: 'Arabic learning for children',
    crewAlt: 'Majarra characters',
    orbitAlt: 'The nine Majarra worlds',
    construction: {
      kicker: 'Coming soon',
      title: 'Building something ',
      titleAccent: 'worth the wait',
      lede: 'Nine worlds full of stories, episodes and games, in one safe place for your children. We are putting on the finishing touches.',
      launchLabel: 'Estimated time to launch',
    },
    maintenance: {
      kicker: 'Maintenance in progress',
      title: 'We are running some ',
      titleAccent: 'maintenance work',
      lede: 'We are updating the platform to run faster and more reliably. None of your children\u2019s data is at risk, and we will be back shortly.',
      eta: (minutes) => `Estimated duration: ${formatDuration(minutes, 'en')}`,
      etaUnknown: 'We are working on it right now',
      retry: 'Try again',
    },
    notFound: {
      kicker: 'Page not found',
      title: 'This page got ',
      titleAccent: 'lost among the planets',
      lede: 'The link you opened does not lead to an existing page. It may be outdated or contain a typo.',
      suggestions: 'You might be looking for',
    },
    units: { days: 'days', hours: 'hours', minutes: 'min', seconds: 'sec' },
    home: 'Home page',
    explore: 'Explore Majarra',
    rights: 'All rights reserved',
    links: { plans: 'Plans and pricing', worlds: 'Majarra worlds', ages: 'Age tracks', faq: 'FAQ', partners: 'Partnerships' },
  },
  fr: {
    brandSub: 'Apprentissage arabe pour enfants',
    crewAlt: 'Personnages Majarra',
    orbitAlt: 'Les neuf mondes Majarra',
    construction: {
      kicker: 'Bient\u00f4t disponible',
      title: 'Nous construisons quelque chose ',
      titleAccent: 'qui vaut l\u2019attente',
      lede: 'Neuf mondes remplis d\u2019histoires, d\u2019\u00e9pisodes et de jeux, dans un seul endroit s\u00fbr pour vos enfants. Nous apportons les derni\u00e8res touches.',
      launchLabel: 'Temps estim\u00e9 avant le lancement',
    },
    maintenance: {
      kicker: 'Maintenance en cours',
      title: 'Nous effectuons des ',
      titleAccent: 'travaux de maintenance',
      lede: 'Nous mettons \u00e0 jour la plateforme pour la rendre plus rapide et plus stable. Aucune donn\u00e9e de vos enfants n\u2019est en danger, et nous revenons bient\u00f4t.',
      eta: (minutes) => `Dur\u00e9e estim\u00e9e : ${formatDuration(minutes, 'fr')}`,
      etaUnknown: 'Nous y travaillons en ce moment',
      retry: 'R\u00e9essayer',
    },
    notFound: {
      kicker: 'Page introuvable',
      title: 'Cette page s\u2019est ',
      titleAccent: 'perdue entre les plan\u00e8tes',
      lede: 'Le lien que vous avez ouvert ne m\u00e8ne \u00e0 aucune page existante. Il est peut-\u00eatre obsol\u00e8te ou contient une faute.',
      suggestions: 'Vous cherchez peut-\u00eatre',
    },
    units: { days: 'jours', hours: 'heures', minutes: 'min', seconds: 'sec' },
    home: 'Page d\u2019accueil',
    explore: 'D\u00e9couvrir Majarra',
    rights: 'Tous droits r\u00e9serv\u00e9s',
    links: { plans: 'Offres et tarifs', worlds: 'Mondes Majarra', ages: 'Tranches d\u2019\u00e2ge', faq: 'FAQ', partners: 'Partenariats' },
  },
}

function formatDuration(minutes: number, locale: LandingLocale) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const units = COPY[locale].units
  if (hours && rest) return `${hours} ${units.hours} ${rest} ${units.minutes}`
  if (hours) return `${hours} ${units.hours}`
  return `${minutes} ${units.minutes}`
}

/* ------------------------------------------------------------------ العدّاد */

type Remaining = { days: number; hours: number; minutes: number; seconds: number }

function remainingUntil(iso: string): Remaining | null {
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  const diff = target - Date.now()
  // موعد فات: العدّاد لا معنى له، والصفحة تعرض بقية محتواها بلا عدّاد
  if (diff <= 0) return null
  const seconds = Math.floor(diff / 1000)
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  }
}

/** عدّاد يتوقّف تلقائيًا عند انتهاء المدة، فلا يترك مؤقّتًا يعمل بلا فائدة */
function useCountdown(iso: string | null): Remaining | null {
  const [remaining, setRemaining] = useState<Remaining | null>(() => (iso ? remainingUntil(iso) : null))

  useEffect(() => {
    if (!iso) { setRemaining(null); return }
    setRemaining(remainingUntil(iso))
    const timer = window.setInterval(() => {
      const next = remainingUntil(iso)
      setRemaining(next)
      if (!next) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [iso])

  return remaining
}

/* ------------------------------------------------------------------ الهيكل */

/**
 * يضبط lang/dir وعنوان الصفحة.
 *
 * الكتابة مباشرة على <html> مقبولة هنا وحدها: صفحات الحالة تُعرض بدل صفحة
 * الهبوط لا معها، فلا تنازع على الملكية مع documentLocale.
 */
function useStatusDocument(locale: LandingLocale, title: string) {
  const meta = localeMeta(locale)
  useEffect(() => {
    document.documentElement.lang = meta.htmlLang
    document.documentElement.dir = meta.dir
    document.title = title
  }, [meta.htmlLang, meta.dir, title])
}

type ShellProps = {
  mode: 'construction' | 'maintenance' | 'notfound'
  locale: LandingLocale
  /// يُعرض في نواة المدار. اللوجو افتراضًا، والترس في وضع الصيانة.
  core?: React.ReactNode
  kicker: string
  children: React.ReactNode
}

function StatusShell({ mode, locale, core, kicker, children }: ShellProps) {
  const copy = COPY[locale]
  const year = new Date().getFullYear()

  return (
    <div className="mj-status" data-mode={mode}>
      <div className="st-stars" aria-hidden="true" />
      <div className="st-stars st-stars--far" aria-hidden="true" />
      <span className="st-comet" aria-hidden="true" />
      <span className="st-comet st-comet--two" aria-hidden="true" />

      <div className="st-shell">
        <a className="st-brand" href="/">
          {/* اللوجو الحقيقي لا أيقونة مجرّدة */}
          <img className="st-brand-logo" src={logo} alt="" />
          <span>
            <span className="st-brand-name">مجرة</span>
            <span className="st-brand-sub">{copy.brandSub}</span>
          </span>
        </a>

        {/* المدار: كواكب التطبيق الحقيقية تدور حول اللوجو */}
        <div className="st-orbit" role="img" aria-label={copy.orbitAlt}>
          <span className="st-ring st-ring--1" aria-hidden="true" />
          <span className="st-ring st-ring--2" aria-hidden="true" />

          <span className="st-planets" aria-hidden="true">
            {ORBIT_PLANETS.map((planet) => (
              <span
                className="st-planet"
                key={planet.src}
                style={orbitStyle(planet.radius, planet.angle)}
              >
                <img src={planet.src} alt="" loading="lazy" />
              </span>
            ))}
          </span>

          <span className="st-core">
            {core ?? <img src={logo} alt="" />}
          </span>
        </div>

        <span className="st-kicker">
          <span className="st-pulse" aria-hidden="true" />
          {kicker}
        </span>

        {children}

        {/* الأطفال: يذكّرون بمن هي المنصّة له */}
        <span className="st-crew" role="img" aria-label={copy.crewAlt}>
          {CREW.map((src) => <img src={src} alt="" key={src} loading="lazy" />)}
        </span>

        <p className="st-foot">
          © {year} مجرة · {copy.rights} · <a href="mailto:hello@majarra.app">hello@majarra.app</a>
        </p>
      </div>
    </div>
  )
}

function Countdown({ remaining, locale }: { remaining: Remaining; locale: LandingLocale }) {
  const units = COPY[locale].units
  const cells: [number, string][] = [
    [remaining.days, units.days],
    [remaining.hours, units.hours],
    [remaining.minutes, units.minutes],
    [remaining.seconds, units.seconds],
  ]
  return (
    <div className="st-countdown" role="timer" aria-live="off">
      {cells.map(([value, label]) => (
        <span className="st-unit" key={label}>
          <b>{String(value).padStart(2, '0')}</b>
          <span>{label}</span>
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------ تحت الإنشاء */

export function ConstructionPage({ locale, status }: { locale: LandingLocale; status: SiteStatus | null }) {
  const copy = COPY[locale].construction
  const remaining = useCountdown(status?.launchAt ?? null)
  useStatusDocument(locale, `${copy.kicker} · مجرة`)

  return (
    <StatusShell mode="construction" locale={locale} kicker={copy.kicker}>
      <h1 className="st-title">
        {copy.title}<em>{copy.titleAccent}</em>
      </h1>
      <p className="st-lede">{copy.lede}</p>

      {status?.message ? <p className="st-note">{status.message}</p> : null}

      {remaining ? (
        <>
          <span className="st-kicker">
            {ICONS.rocket}
            {copy.launchLabel}
          </span>
          <Countdown remaining={remaining} locale={locale} />
        </>
      ) : null}
    </StatusShell>
  )
}

/* ------------------------------------------------------- تحت الصيانة */

export function MaintenancePage({ locale, status }: { locale: LandingLocale; status: SiteStatus | null }) {
  const copy = COPY[locale].maintenance
  useStatusDocument(locale, `${copy.kicker} · مجرة`)
  const minutes = status?.retryAfterSeconds ? Math.round(status.retryAfterSeconds / 60) : null

  return (
    // النواة ترس يدور بدل اللوجو: الحركة تشرح الحالة بلا نص
    <StatusShell mode="maintenance" locale={locale} kicker={copy.kicker} core={ICONS.gear}>
      <h1 className="st-title">
        {copy.title}<em>{copy.titleAccent}</em>
      </h1>
      <p className="st-lede">{copy.lede}</p>

      {status?.message ? <p className="st-note">{status.message}</p> : null}

      <span className="st-eta">
        {ICONS.clock}
        {minutes ? copy.eta(minutes) : copy.etaUnknown}
      </span>

      <div className="st-actions">
        {/* إعادة تحميل كاملة مقصودة: الهدف إعادة سؤال الخادم عن الحالة */}
        <button className="st-btn st-btn--primary" type="button" onClick={() => window.location.reload()}>
          {ICONS.refresh}
          {copy.retry}
        </button>
      </div>
    </StatusShell>
  )
}

/* ------------------------------------------------------------------- 404 */

export function NotFoundPage({ locale }: { locale: LandingLocale }) {
  const copy = COPY[locale].notFound
  const all = COPY[locale]
  useStatusDocument(locale, `404 · مجرة`)

  // مراسي حقيقية موجودة في صفحة الهبوط، لا روابط مخترعة. وصورة كل رابط كوكب
  // حقيقي، فيُعرَف القسم بصريًا قبل قراءة نصّه.
  const links = useMemo(() => ([
    { href: '/#worlds', label: all.links.worlds, img: '/landing/planets/planet-stories.webp' },
    { href: '/#ages', label: all.links.ages, img: '/landing/planets/planet-abjad.webp' },
    { href: '/#plans', label: all.links.plans, img: '/landing/planets/planet-numbers.webp' },
    { href: '/#faq', label: all.links.faq, img: '/landing/planets/planet-science.webp' },
    { href: '/#partners', label: all.links.partners, img: '/landing/planets/planet-maharat.webp' },
  ]), [all.links])

  return (
    <StatusShell mode="notfound" locale={locale} kicker={copy.kicker}>
      <span className="st-code">404</span>
      <h1 className="st-title">
        {copy.title}<em>{copy.titleAccent}</em>
      </h1>
      <p className="st-lede">{copy.lede}</p>

      <div className="st-actions">
        <a className="st-btn st-btn--primary" href="/">
          {ICONS.home}
          {all.home}
        </a>
        <a className="st-btn st-btn--ghost" href="/#showcase">
          {ICONS.arrow}
          {all.explore}
        </a>
      </div>

      <div>
        <p className="st-lede" style={{ marginBottom: 10 }}>{copy.suggestions}</p>
        <nav className="st-links" aria-label={copy.suggestions}>
          {links.map((link) => (
            <a className="st-link" href={link.href} key={link.href}>
              <img src={link.img} alt="" loading="lazy" />
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </StatusShell>
  )
}
