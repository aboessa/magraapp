import { useEffect, useState } from 'react'
import { Ico } from '../icons'
import { HERO_NOTES, HERO_SLIDES } from '../data'

const SLIDE_MS = 7000

const WAVE_BARS = [40, 75, 55, 95, 60, 85, 45, 70, 50, 90, 35, 65]

export function Hero({ reduceMotion }: { reduceMotion: boolean }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reduceMotion || paused) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % HERO_SLIDES.length)
    }, SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [reduceMotion, paused])

  const slide = HERO_SLIDES[index]

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
          <div className="mj-eyebrow"><span className="mj-dot" />منصة عربية آمنة للأطفال من 3 إلى 12 سنة</div>

          <div className="mj-slides" aria-live="polite">
            {/* المفتاح يعيد تشغيل حركة الظهور عند تغيير الشريحة */}
            <article className="mj-slide" key={index}>
              <h1>{slide.title}<em>{slide.accent}</em></h1>
              <p className="mj-hero-copy">{slide.copy}</p>
            </article>
          </div>

          <div className="mj-hero-actions">
            <a className="mj-btn mj-btn-primary mj-btn-lg" href="#start">
              ابدأ تجربتك المجانية
              <Ico name="arrowStart" />
            </a>
            <a className="mj-btn mj-btn-ghost mj-btn-lg" href="#showcase">
              استكشف محتوى مجرة
              <Ico name="play" />
            </a>
          </div>

          <p className="mj-hero-note">
            {HERO_NOTES.map((note) => (
              <span key={note}>
                <span className="mj-tick"><Ico name="check" /></span>
                {note}
              </span>
            ))}
          </p>

          <div className="mj-hero-dots" role="tablist" aria-label="شرائح العرض">
            {HERO_SLIDES.map((item, i) => (
              <button
                key={item.background}
                type="button"
                role="tab"
                aria-current={i === index}
                aria-label={`الشريحة ${i + 1}: ${item.title}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </div>

        <div className="mj-reveal">
          <div className="mj-stage">
            <div>
              <div className="mj-tv">
                <img
                  src="/landing/series/banners/kids-explorers-adventures-banner.webp"
                  alt="مشهد من سلسلة مغامرات المستكشفين معروضًا على شاشة التلفزيون"
                />
              </div>
              <span className="mj-tv-stand" aria-hidden="true" />
            </div>

            <div className="mj-tablet">
              <img src="/landing/books/covers/book-arabic-letters-cover.webp" alt="قصة مصورة معروضة على تابلت" />
            </div>
            <div className="mj-phone">
              <img
                src="/landing/series/posters/preschool-luna-discovers-words-poster.webp"
                alt="ملصق سلسلة لونا تكتشف الكلمات على الهاتف"
              />
            </div>

            <div className="mj-float mj-float--a">
              <span className="mj-float-ico" style={{ color: '#ffd34d', background: 'rgba(255,211,77,.12)' }}>
                <Ico name="star" />
              </span>
              <span>
                <strong>ابدأ على التابلت</strong>
                <span>وأكمل على التلفزيون من الصفحة نفسها</span>
              </span>
            </div>
            <div className="mj-float mj-float--b">
              <span className="mj-float-ico" style={{ color: '#00d6f5', background: 'rgba(0,214,245,.12)' }}>
                <Ico name="report" />
              </span>
              <span>
                <strong>تقرير أسبوعي للأهل</strong>
                <span>تقدم القراءة والمهارات بوضوح</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** موجة صوتية توضيحية تستخدمها بطاقة القارئ في قسم كوكب القصص */
export function AudioWave() {
  return (
    <span className="mj-wave" aria-hidden="true">
      {WAVE_BARS.map((height, i) => (
        <i key={`${height}-${i}`} style={{ '--mj-h': `${height}%`, '--mj-d': `${i * 0.1}s` } as React.CSSProperties} />
      ))}
    </span>
  )
}
