import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Ico } from '../icons'
import { useLandingLocale } from '../i18n'
import { useLandingContent } from '../useContent'

export function AgeTracks() {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const { copy, ageTracks } = useLandingContent()
  const { dir } = useLandingLocale()
  const text = copy.ages

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
    let next: number | null = null
    if (event.key === forward) next = (index + 1) % ageTracks.length
    else if (event.key === backward) next = (index - 1 + ageTracks.length) % ageTracks.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = ageTracks.length - 1
    if (next === null) return
    event.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className="mj-section" id="ages" data-section="ages">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">{text.kicker}</span>
          <h2>{text.heading} <span className="mj-grad">{text.accent}</span></h2>
          <p>{text.copy}</p>
        </div>

        <div className="mj-age-switch" role="tablist" aria-label={text.switchAria}>
          {ageTracks.map((track, index) => (
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

        {ageTracks.map((track, index) => (
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
                <h4>{text.samplesHeading}</h4>
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
