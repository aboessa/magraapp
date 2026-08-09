import { useEffect, useState } from 'react'
import { Ico } from '../icons'
import { HERO_STAGE } from '../structure'
import { useLandingContent } from '../useContent'

const SLIDE_MS = 7000

export function Hero({ reduceMotion }: { reduceMotion: boolean }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const { copy, heroSlides } = useLandingContent()
  const hero = copy.hero

  useEffect(() => {
    if (reduceMotion || paused) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % heroSlides.length)
    }, SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [reduceMotion, paused, heroSlides.length])

  const slide = heroSlides[index] ?? heroSlides[0]

  return (
    <section
      className="mj-hero"
      id="top"
      data-section="hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
    >
      <div
        className="mj-hero-bg"
        style={{ backgroundImage: `url('${slide.background}')` }}
        aria-hidden="true"
      />
      <div className="mj-hero-stars" aria-hidden="true" />
      <span className="mj-hero-planet mj-hero-planet--a" aria-hidden="true" />
      <span className="mj-hero-planet mj-hero-planet--b" aria-hidden="true" />

      <div className="mj-container mj-hero-grid">
        <div className="mj-reveal">
          <div className="mj-eyebrow"><span className="mj-dot" />{hero.eyebrow}</div>

          <div className="mj-slides" aria-live="polite">
            {/* المفتاح يعيد تشغيل حركة الظهور عند تغيير الشريحة */}
            <article className="mj-slide" key={index}>
              <h1>{slide.title}<em>{slide.accent}</em></h1>
              <p className="mj-hero-copy">{slide.copy}</p>
            </article>
          </div>

          <div className="mj-hero-actions">
            <a className="mj-btn mj-btn-primary mj-btn-lg" href="#start">
              {hero.ctaPrimary}
              <Ico name="arrowStart" />
            </a>
            <a className="mj-btn mj-btn-ghost mj-btn-lg" href="#showcase">
              {hero.ctaSecondary}
              <Ico name="play" />
            </a>
          </div>

          <p className="mj-hero-note">
            {hero.notes.map((note) => (
              <span key={note}>
                <span className="mj-tick"><Ico name="check" /></span>
                {note}
              </span>
            ))}
          </p>

          <div className="mj-hero-dots" role="tablist" aria-label={hero.dotsAria}>
            {heroSlides.map((item, i) => (
              <button
                key={item.background}
                type="button"
                role="tab"
                aria-current={i === index}
                aria-label={hero.slideAria(i + 1, item.title)}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </div>

        <div className="mj-reveal">
          <div className="mj-stage">
            <div>
              <div className="mj-tv">
                <img src={HERO_STAGE.tv} alt={hero.tvAlt} />
              </div>
              <span className="mj-tv-stand" aria-hidden="true" />
            </div>

            <div className="mj-tablet">
              <img src={HERO_STAGE.tablet} alt={hero.tabletAlt} />
            </div>
            <div className="mj-phone">
              <img src={HERO_STAGE.phone} alt={hero.phoneAlt} />
            </div>

            <div className="mj-float mj-float--a">
              <span className="mj-float-ico" style={{ color: '#ffd34d', background: 'rgba(255,211,77,.12)' }}>
                <Ico name="star" />
              </span>
              <span>
                <strong>{hero.floatA.title}</strong>
                <span>{hero.floatA.text}</span>
              </span>
            </div>
            <div className="mj-float mj-float--b">
              <span className="mj-float-ico" style={{ color: '#00d6f5', background: 'rgba(0,214,245,.12)' }}>
                <Ico name="report" />
              </span>
              <span>
                <strong>{hero.floatB.title}</strong>
                <span>{hero.floatB.text}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
