import { useEffect, useRef, useState } from 'react'
import logo from '../../assets/majarra-logo.webp'
import { Ico } from '../icons'
import { APP_URL, MEGA_COLUMNS, NAV_LINKS } from '../data'

const LANGS = [
  { code: 'ar', short: 'العربية', abbr: 'العربية', available: true },
  { code: 'en', short: 'English', abbr: 'EN', available: false },
  { code: 'fr', short: 'Français', abbr: 'FR', available: false },
] as const

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <a className="mj-brand" href="#top" aria-label="مجرة، الصفحة الرئيسية" onClick={onNavigate}>
      <span className="mj-brand-mark"><img src={logo} alt="" /></span>
      <span className="mj-brand-name">مجرة<small>Majarra</small></span>
    </a>
  )
}

function LangSwitch({ compact }: { compact?: boolean }) {
  return (
    <div className="mj-lang" role="group" aria-label="اختيار اللغة">
      {LANGS.map((lang) => (
        <button
          key={lang.code}
          type="button"
          aria-pressed={lang.available}
          disabled={!lang.available}
          title={lang.available ? lang.short : 'قريبًا'}
        >
          {compact ? lang.abbr : lang.short}
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

        <nav className={navOpen ? 'mj-nav is-open' : 'mj-nav'} id="mj-nav" aria-label="التنقل الرئيسي">
          <a className="mj-nav-link" href={NAV_LINKS[0].href} onClick={closeAll}>{NAV_LINKS[0].label}</a>

          <button
            className="mj-nav-link"
            type="button"
            aria-expanded={megaOpen}
            aria-controls="mj-mega"
            onClick={() => setMegaOpen((open) => !open)}
          >
            اكتشف
            <Ico name="chevronDown" className="mj-caret" />
          </button>

          {/* داخل الـnav حتى تعمل ضمن القائمة المنسدلة على الموبايل */}
          {megaOpen && (
            <div className="mj-mega" id="mj-mega" role="region" aria-label="قائمة اكتشف">
              <div className="mj-mega-inner">
                {MEGA_COLUMNS.map((column) => (
                  <div className="mj-mega-col" key={column.title}>
                    <h3><Ico name={column.icon} />{column.title}</h3>
                    {column.links.map((link) => (
                      <a href={link.href} key={link.label} onClick={closeAll}>{link.label}</a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {NAV_LINKS.slice(1).map((link) => (
            <a className="mj-nav-link" href={link.href} key={link.href} onClick={closeAll}>{link.label}</a>
          ))}

          <div className="mj-nav-extra">
            <LangSwitch />
            <a className="mj-btn mj-btn-ghost" href={APP_URL}>تسجيل الدخول</a>
          </div>
        </nav>

        <div className="mj-header-actions">
          <LangSwitch compact />
          <a className="mj-login" href={APP_URL}>تسجيل الدخول</a>
          <a className="mj-btn mj-btn-primary" href="#start">ابدأ مجانًا</a>
          <button
            className="mj-burger"
            type="button"
            aria-expanded={navOpen}
            aria-controls="mj-nav"
            aria-label={navOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            onClick={() => setNavOpen((open) => !open)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  )
}
