import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Ico } from '../icons'
import { AGE_TRACKS } from '../data'

export function AgeTracks() {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    let next: number | null = null
    if (event.key === 'ArrowLeft') next = (index + 1) % AGE_TRACKS.length
    else if (event.key === 'ArrowRight') next = (index - 1 + AGE_TRACKS.length) % AGE_TRACKS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = AGE_TRACKS.length - 1
    if (next === null) return
    event.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className="mj-section" id="ages" data-section="ages">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">ثلاث تجارب في منصة واحدة</span>
          <h2>المحتوى والواجهة يتغيران <span className="mj-grad">مع عمر طفلك</span></h2>
          <p>
            أدخل عمر الطفل عند إنشاء ملفه، فتتحدد طبيعة المحتوى ومستوى القراءة ومدة الجلسة ونوع الألعاب.
            غيّر العمر أدناه لترى كيف تتغير التوصيات.
          </p>
        </div>

        <div className="mj-age-switch" role="tablist" aria-label="اختيار المرحلة العمرية">
          {AGE_TRACKS.map((track, index) => (
            <button
              key={track.key}
              ref={(node) => { tabRefs.current[index] = node }}
              type="button"
              role="tab"
              id={`mj-age-tab-${track.key}`}
              aria-selected={index === active}
              aria-controls={`mj-age-panel-${track.key}`}
              tabIndex={index === active ? 0 : -1}
              style={{ '--mj-tc': track.accent } as CSSProperties}
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {track.tabLabel}
            </button>
          ))}
        </div>

        {AGE_TRACKS.map((track, index) => (
          <div
            key={track.key}
            role="tabpanel"
            id={`mj-age-panel-${track.key}`}
            aria-labelledby={`mj-age-tab-${track.key}`}
            hidden={index !== active}
          >
            <div className={`mj-age-card mj-track--${track.key} mj-reveal`}>
              <div className="mj-age-info">
                <span className="mj-age-pill">{track.pill}</span>
                <h3>{track.title}</h3>
                <p>{track.copy}</p>

                <div className="mj-specs">
                  {track.specs.map((spec) => (
                    <div className="mj-spec" key={spec.label}>
                      <Ico name={spec.icon} />
                      <span>
                        <b>{spec.label}</b>
                        <span>{spec.value}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mj-samples">
                <h4>نماذج محتوى مقترحة لهذا العمر</h4>
                <div className="mj-sample-grid">
                  {track.samples.map((sample) => (
                    <div className="mj-sample" key={sample.title}>
                      <img src={sample.image} alt="" loading="lazy" />
                      <div>
                        <b>{sample.title}</b>
                        <small>{sample.meta}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
