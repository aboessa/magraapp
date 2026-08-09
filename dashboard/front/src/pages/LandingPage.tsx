import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AgeTracks } from '../landing/sections/AgeTracks'
import { Hero } from '../landing/sections/Hero'
import { Languages } from '../landing/sections/Languages'
import { Partners } from '../landing/sections/Partners'
import { Plans } from '../landing/sections/Plans'
import { Showcase } from '../landing/sections/Showcase'
import { SiteHeader } from '../landing/sections/SiteHeader'
import { Worlds } from '../landing/sections/Worlds'
import {
  Devices,
  DownloadCta,
  Faq,
  Identity,
  Learning,
  Originals,
  Parents,
  Pillars,
  Reviews,
  SiteFooter,
  StartSteps,
  StoriesPlanet,
  TrustStrip,
} from '../landing/sections/Static'
import {
  initialLandingLocale,
  LandingLocaleContext,
  localeMeta,
  STORAGE_KEY,
  type LandingLocale,
} from '../landing/i18n'
import { useCopy } from '../landing/useContent'
import { applyDocumentLocale, claimDocumentLocale, releaseDocumentLocale } from '../lib/documentLocale'
import '../styles/landing.css'

const LOCALE_OWNER = 'landing'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * يظهر العناصر تدريجيًا عند الوصول إليها.
 * يراقب إضافة عناصر جديدة أيضًا، لأن أقسام التبويبات تُركّب بعد التحميل.
 */
function useRevealOnScroll(root: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const node = root.current
    if (!node) return

    const showAll = () => {
      node.querySelectorAll('.mj-reveal').forEach((element) => element.classList.add('is-in'))
    }

    if (!enabled || !('IntersectionObserver' in window)) {
      showAll()
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-in')
        observer.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

    const observeAll = () => {
      node.querySelectorAll('.mj-reveal:not(.is-in)').forEach((element) => observer.observe(element))
    }

    observeAll()
    const mutations = new MutationObserver(observeAll)
    mutations.observe(node, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutations.disconnect()
    }
  }, [root, enabled])
}

export function LandingPage() {
  const [locale, setLocaleState] = useState<LandingLocale>(() => initialLandingLocale())
  const meta = localeMeta(locale)

  const setLocale = useCallback((next: LandingLocale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // التخزين قد يكون محجوبًا في وضع التصفح الخاص، وهذا لا يمنع تغيير اللغة
    }
  }, [])

  const value = useMemo(
    () => ({ locale, dir: meta.dir, setLocale }),
    [locale, meta.dir, setLocale],
  )

  // الصفحة داكنة دائمًا بصرف النظر عن تفضيلات لوحة الإدارة،
  // لكن اللغة والاتجاه يتبعان اختيار الزائر.
  // الملكية تُطلب في تأثير تخطيطي حتى تُحسم قبل تأثير مزوّد التفضيلات في الأب.
  useLayoutEffect(() => {
    const root = document.documentElement
    const previousLang = root.lang
    const previousDir = root.dir as 'rtl' | 'ltr'
    claimDocumentLocale(LOCALE_OWNER)
    return () => {
      releaseDocumentLocale(LOCALE_OWNER)
      root.lang = previousLang
      root.dir = previousDir
    }
  }, [])

  useLayoutEffect(() => {
    applyDocumentLocale(LOCALE_OWNER, meta.htmlLang, meta.dir)
  }, [meta.htmlLang, meta.dir])

  return (
    <LandingLocaleContext.Provider value={value}>
      <LandingBody />
    </LandingLocaleContext.Provider>
  )
}

function LandingBody() {
  const pageRef = useRef<HTMLDivElement>(null)
  const reduceMotion = usePrefersReducedMotion()
  useRevealOnScroll(pageRef, !reduceMotion)
  const copy = useCopy()

  useEffect(() => {
    document.title = copy.meta.title
    const description = document.querySelector('meta[name="description"]')
    if (description) description.setAttribute('content', copy.meta.description)
  }, [copy.meta.title, copy.meta.description])

  return (
    <div className="mj-landing" ref={pageRef}>
      <a className="mj-skip" href="#main">{copy.common.skip}</a>

      <SiteHeader />

      <main id="main">
        <Hero reduceMotion={reduceMotion} />
        <TrustStrip />
        <Pillars />
        <Showcase />
        <Worlds />
        <StoriesPlanet />
        <AgeTracks />
        <Parents />
        <Learning />
        <Identity />
        <Languages />
        <Devices />
        <Originals />
        <StartSteps />
        <Plans />
        <Reviews />
        <Faq />
        <Partners />
        <DownloadCta />
      </main>

      <SiteFooter />
    </div>
  )
}
