import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Ico } from '../icons'
import { WORLDS } from '../data'

/** يحوّل نصف القطر والزاوية إلى موضع مئوي داخل مشهد المدار */
function orbitStyle(radius: number, angle: number): CSSProperties {
  const rad = (angle * Math.PI) / 180
  return {
    left: `${50 + radius * Math.cos(rad)}%`,
    top: `${50 + radius * Math.sin(rad)}%`,
  }
}

export function Worlds() {
  const [activeKey, setActiveKey] = useState(WORLDS[0].key)
  const world = WORLDS.find((item) => item.key === activeKey) ?? WORLDS[0]

  return (
    <section className="mj-section" id="worlds" data-section="worlds">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">تسعة كواكب</span>
          <h2>كواكب مجرة ليست تصنيفات… <span className="mj-grad">بل عوالم معرفة</span></h2>
          <p>
            كل كوكب عالم له محتواه الخاص: حلقات وقصص وصوتيات وألعاب ومشروعات مرتبطة بمهارة واضحة.
            اختر كوكبًا لترى ما داخله.
          </p>
        </div>

        <div className="mj-worlds">
          <div className="mj-reveal">
            <div className="mj-orbit">
              <span className="mj-ring mj-ring--1" aria-hidden="true" />
              <span className="mj-ring mj-ring--2" aria-hidden="true" />
              <span className="mj-ring mj-ring--3" aria-hidden="true" />
              <span className="mj-core" aria-hidden="true" />

              {WORLDS.map((item) => (
                <button
                  key={item.key}
                  className="mj-planet"
                  type="button"
                  style={orbitStyle(item.orbit.radius, item.orbit.angle)}
                  aria-pressed={item.key === activeKey}
                  onClick={() => setActiveKey(item.key)}
                >
                  <img src={item.image} alt={item.name} loading="lazy" />
                  <span className="mj-planet-name">{item.name.replace('كوكب ', '')}</span>
                </button>
              ))}
            </div>
          </div>

          <div
            className="mj-wpanel mj-reveal"
            style={{ '--mj-wglow': world.glow } as CSSProperties}
          >
            <div className="mj-wpanel-head">
              <img src={world.image} alt="" />
              <div>
                <h3>{world.name}</h3>
                <div className="mj-wage">{world.age}</div>
              </div>
            </div>

            <p>{world.desc}</p>

            <div className="mj-wtypes">
              {world.types.map((type) => <span className="mj-chip" key={type}>{type}</span>)}
            </div>

            <div className="mj-wpicks">
              {world.picks.map((pick) => (
                <div className="mj-wpick" key={pick.label}>
                  <img src={pick.image} alt="" loading="lazy" />
                  <span>{pick.label}</span>
                </div>
              ))}
            </div>

            <a className="mj-btn mj-btn-primary" href={world.href}>
              اكتشف الكوكب
              <Ico name="arrowNext" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
