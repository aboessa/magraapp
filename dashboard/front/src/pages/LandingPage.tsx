import { useEffect, useRef, useState } from 'react'
import { AgeTracks } from '../landing/sections/AgeTracks'
import { Hero } from '../landing/sections/Hero'
import { Languages } from '../landing/sections/Languages'
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
import '../styles/landing.css'

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
  const pageRef = useRef<HTMLDivElement>(null)
  const reduceMotion = usePrefersReducedMotion()
  useRevealOnScroll(pageRef, !reduceMotion)

  // الصفحة داكنة دائمًا ومحتواها عربي، بصرف النظر عن تفضيلات لوحة الإدارة
  useEffect(() => {
    const root = document.documentElement
    const previousLang = root.lang
    const previousDir = root.dir
    root.lang = 'ar'
    root.dir = 'rtl'
    return () => {
      root.lang = previousLang
      root.dir = previousDir
    }
  }, [])

  return (
    <div className="mj-landing" ref={pageRef}>
      <a className="mj-skip" href="#main">تجاوز إلى المحتوى</a>

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
        <DownloadCta />
      </main>

      <SiteFooter />
    </div>
  )
}
