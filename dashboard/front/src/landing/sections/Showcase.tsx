import { useRef, useState } from 'react'
import { Ico } from '../icons'
import { accessLabel, SHOWCASE_TABS } from '../data'
import type { PosterItem } from '../data'

function PosterCard({ item }: { item: PosterItem }) {
  const badgeClass = item.access === 'free' ? 'mj-badge mj-badge--free' : 'mj-badge mj-badge--premium'

  return (
    <article className="mj-poster">
      <div className="mj-poster-media">
        <img src={item.image} alt={item.alt} loading="lazy" />
        <div className="mj-poster-badges">
          <span className={badgeClass}>{accessLabel(item.access)}</span>
          {/* dir=ltr يمنع قواعد الاتجاه الثنائي من عكس النطاق فيظهر 12–9 */}
          <span className="mj-badge" dir="ltr">{item.age}</span>
        </div>
        {item.playable && (
          <div className="mj-poster-play">
            <span><Ico name="play" solid /></span>
          </div>
        )}
      </div>
      <div className="mj-poster-body">
        <h3>{item.title}</h3>
        <p className="mj-poster-meta">
          {item.meta.map((entry) => <span key={entry}>{entry}</span>)}
        </p>
        <div className="mj-poster-actions">
          <a className="is-solid" href={`/content/${item.slug}`}>التفاصيل</a>
          <a href={`/content/${item.slug}${item.secondary.hash}`}>{item.secondary.label}</a>
        </div>
      </div>
    </article>
  )
}

export function Showcase() {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    let next: number | null = null
    // في RTL يتقدّم السهم الأيسر ويرجع الأيمن
    if (event.key === 'ArrowLeft') next = (index + 1) % SHOWCASE_TABS.length
    else if (event.key === 'ArrowRight') next = (index - 1 + SHOWCASE_TABS.length) % SHOWCASE_TABS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = SHOWCASE_TABS.length - 1
    if (next === null) return
    event.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className="mj-section mj-section-alt" id="showcase" data-section="showcase">
      <div className="mj-container">
        <div className="mj-head mj-reveal">
          <span className="mj-kicker">محتوى حقيقي قبل تسجيل الدخول</span>
          <h2>شاهد ما ستحصل عليه فعلًا</h2>
          <p>
            صفحات المحتوى والتريلرات والعينات المجانية متاحة للزائر دون حساب.
            كل عمل يعرض العمر واللغة والمدة، وهل هو مجاني أم داخل الاشتراك.
          </p>
        </div>

        <div className="mj-tabs" role="tablist" aria-label="تصنيفات المحتوى">
          {SHOWCASE_TABS.map((tab, index) => (
            <button
              key={tab.key}
              ref={(node) => { tabRefs.current[index] = node }}
              className="mj-tab"
              type="button"
              role="tab"
              id={`mj-tab-${tab.key}`}
              aria-selected={index === active}
              aria-controls={`mj-panel-${tab.key}`}
              tabIndex={index === active ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {SHOWCASE_TABS.map((tab, index) => (
          <div
            key={tab.key}
            role="tabpanel"
            id={`mj-panel-${tab.key}`}
            aria-labelledby={`mj-tab-${tab.key}`}
            hidden={index !== active}
          >
            <div className="mj-poster-row">
              {tab.items.map((item) => <PosterCard item={item} key={`${tab.key}-${item.slug}`} />)}
            </div>
          </div>
        ))}

        <div className="mj-center mj-mt-lg">
          <a className="mj-btn mj-btn-ghost" href="/explore">
            استكشف كل المحتوى
            <Ico name="arrowNext" />
          </a>
        </div>
      </div>
    </section>
  )
}
