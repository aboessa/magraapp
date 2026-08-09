import { useEffect, useRef, useState } from 'react'
import logo from '../../assets/majarra-logo.webp'
import { Ico } from '../icons'
import { LANDING_LOCALES, useLandingLocale } from '../i18n'
import { APP_URL } from '../structure'
import { useCopy, useLandingContent } from '../useContent'

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  const copy = useCopy()
  return (
    <a className="mj-brand" href="#top" aria-label={copy.common.brandLabel} onClick={onNavigate}>
      <span className="mj-brand-mark"><img src={logo} alt="" /></span>
      <span className="mj-brand-name">مجرة<small>Majarra</small></span>
    </a>
  )
}

export function LangSwitch({ compact }: { compact?: boolean }) {
  const { locale, setLocale } = useLandingLocale()
  const copy = useCopy()

  return (
    <div className="mj-lang" role="group" aria-label={copy.common.langAria}>
      {LANDING_LOCALES.map((entry) => (
        <button
          key={entry.code}
          type="button"
          lang={entry.htmlLang}
          aria-pressed={entry.code === locale}
          title={entry.native}
          onClick={() => setLocale(entry.code)}
        >
          {compact ? entry.short : entry.native}
        </button>
      ))}
    </div>
  )
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [megaOpen, setMegaOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const { copy, nav, mega } = useLandingContent()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('mj-nav-open', navOpen)
    return () => document.body.classList.remove('mj-nav-open')
  }, [navOpen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMegaOpen(false)
      setNavOpen(false)
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMegaOpen(false)
    }
    const onResize = () => {
      if (window.innerWidth > 860) setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const closeAll = () => {
    setNavOpen(false)
    setMegaOpen(false)
  }

  return (
    <header
      className={scrolled ? 'mj-header is-scrolled' : 'mj-header'}
      ref={headerRef}
      data-section="header"
    >
      <div className="mj-container mj-header-inner">
        <Brand onNavigate={closeAll} />

        <nav className={navOpen ? 'mj-nav is-open' : 'mj-nav'} id="mj-nav" aria-label={copy.nav.mainAria}>
          <a className="mj-nav-link" href={nav[0].href} onClick={closeAll}>{nav[0].label}</a>

          <button
            className="mj-nav-link"
            type="button"
            aria-expanded={megaOpen}
            aria-controls="mj-mega"
            onClick={() => setMegaOpen((open) => !open)}
          >
            {copy.nav.discover}
            <Ico name="chevronDown" className="mj-caret" />
          </button>

          {/* داخل الـnav حتى تعمل ضمن القائمة المنسدلة على الموبايل */}
          {megaOpen && (
            <div className="mj-mega" id="mj-mega" role="region" aria-label={copy.nav.discoverAria}>
              <div className="mj-mega-inner">
                {mega.map((column) => (
                  <div className="mj-mega-col" key={column.key}>
                    <h3><Ico name={column.icon} />{column.title}</h3>
                    {column.links.map((link) => (
                      <a href={link.href} key={link.label} onClick={closeAll}>{link.label}</a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {nav.slice(1).map((link) => (
            <a className="mj-nav-link" href={link.href} key={link.key} onClick={closeAll}>{link.label}</a>
          ))}

          <div className="mj-nav-extra">
            <LangSwitch />
            <a className="mj-btn mj-btn-ghost" href={APP_URL}>{copy.common.login}</a>
          </div>
        </nav>

        <div className="mj-header-actions">
          <LangSwitch compact />
          <a className="mj-login" href={APP_URL}>{copy.common.login}</a>
          <a className="mj-btn mj-btn-primary" href="#start">{copy.common.startFree}</a>
          <button
            className="mj-burger"
            type="button"
            aria-expanded={navOpen}
            aria-controls="mj-nav"
            aria-label={navOpen ? copy.common.menuClose : copy.common.menuOpen}
            onClick={() => setNavOpen((open) => !open)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  )
}
