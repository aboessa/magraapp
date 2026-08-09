import { Ico, QrCode } from '../icons'
import { isLandingLocale, LANDING_LOCALES, useLandingLocale } from '../i18n'
import {
  APP_URL,
  DEVICE_STAGE,
  ORIGINALS_HERO_IMAGE,
  PARENT_IMAGES,
  SIGNUP_URL,
  STORY_PAGE_IMAGE,
} from '../structure'
import { useLandingContent } from '../useContent'
import { Brand } from './SiteHeader'
import { StoryAudio } from './StoryAudio'

/* ------------------------------------------------------------------- trust */

export function TrustStrip() {
  const { trust } = useLandingContent()
  return (
    <div className="mj-trust" data-section="trust">
      <div className="mj-container">
        <div className="mj-trust-grid">
          {trust.map((item) => (
            <div className="mj-trust-item" key={item.label}>
              <Ico name={item.icon} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- pillars */

export function Pillars() {
  const { copy, pillars } = useLandingContent()
  const text = copy.pillars

  return (
    <section className="mj-section" id="pillars" data-section="pillars">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">{text.kicker}</span>
          <h2>{text.heading} <span className="mj-grad">{text.accent}</span></h2>
          <p>{text.copy}</p>
        </div>

        <div className="mj-pillars">
          {pillars.map((pillar) => (
            <article className={`mj-pillar mj-pillar--${pillar.key} mj-reveal`} key={pillar.key}>
              <span className="mj-pillar-ico"><Ico name={pillar.icon} /></span>
              <h3>{pillar.title}</h3>
              <p>{pillar.copy}</p>
              <div className="mj-pillar-preview" aria-hidden="true">
                {pillar.previews.map((src) => <img src={src} alt="" key={src} loading="lazy" />)}
              </div>
              <a className="mj-pillar-link" href={pillar.href}>
                {pillar.linkLabel}
                <Ico name="arrowNext" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------- stories planet  */

export function StoriesPlanet() {
  const { copy, readingModes, storyFeatures } = useLandingContent()
  const text = copy.stories

  return (
    <section className="mj-section mj-section-alt" id="stories" data-section="stories">
      <div className="mj-container">
        <div className="mj-stories">
          <div className="mj-reveal">
            <div className="mj-reader">
              <div className="mj-reader-screen">
                <img src={STORY_PAGE_IMAGE} alt={text.pageAlt} loading="lazy" />
                <div className="mj-page-text">
                  <p>
                    {text.pageText.before}
                    <mark>{text.pageText.highlight}</mark>
                    {text.pageText.after}
                  </p>
                </div>
              </div>
              <StoryAudio />
            </div>
          </div>

          <div className="mj-reveal">
            <span className="mj-kicker">{text.kicker}</span>
            <h2 className="mj-subhead">{text.heading}</h2>
            <p className="mj-lead">{text.lead}</p>

            <div className="mj-modes">
              {readingModes.map((mode) => (
                <div className="mj-mode" key={mode.title}>
                  <Ico name={mode.icon} />
                  <span>
                    <strong>{mode.title}</strong>
                    <span>{mode.copy}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mj-fchips">
              {storyFeatures.map((feature) => (
                <span className="mj-fchip" key={feature.label}>
                  <Ico name={feature.icon} />
                  {feature.label}
                </span>
              ))}
            </div>

            <div className="mj-mt-lg">
              <a className="mj-btn mj-btn-primary" href="/worlds/stories">
                {text.cta}
                <Ico name="arrowNext" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- parents */

export function Parents() {
  const { copy, safety } = useLandingContent()
  const text = copy.parents

  return (
    <section className="mj-section mj-section-alt" id="parents" data-section="parents">
      <div className="mj-container">
        <div className="mj-parents mj-reveal">
          <div className="mj-parents-grid">
            <div className="mj-parents-copy">
              <span className="mj-kicker">{text.kicker}</span>
              <h2 className="mj-subhead">{text.heading}</h2>
              <p className="mj-lead">{text.lead}</p>

              <div className="mj-safety">
                {safety.map((feature) => (
                  <span className="mj-fchip" key={feature.label}>
                    <Ico name={feature.icon} />
                    {feature.label}
                  </span>
                ))}
              </div>

              <div className="mj-inline-chips mj-mt-lg">
                <a className="mj-btn mj-btn-primary" href="/parents">
                  {text.ctaPrimary}
                  <Ico name="arrowNext" />
                </a>
                <a className="mj-btn mj-btn-ghost" href="/safety">{text.ctaSecondary}</a>
              </div>
            </div>

            <div className="mj-parents-visual">
              <div className="mj-dash">
                <div className="mj-dash-bar" aria-hidden="true">
                  <i /><i /><i />
                  <span>{text.dashBar}</span>
                </div>
                <img src={PARENT_IMAGES.dash} alt={text.dashAlt} loading="lazy" />
              </div>

              <div className="mj-dash-mini">
                <figure>
                  <img src={PARENT_IMAGES.report} alt={text.miniOne.alt} loading="lazy" />
                  <figcaption>{text.miniOne.caption}</figcaption>
                </figure>
                <figure>
                  <img src={PARENT_IMAGES.screenTime} alt={text.miniTwo.alt} loading="lazy" />
                  <figcaption>{text.miniTwo.caption}</figcaption>
                </figure>
              </div>

              <p className="mj-dash-caption">
                <strong>{text.captionStrong}</strong> {text.caption}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- learning */

export function Learning() {
  const { copy, learningFlow, learningTags } = useLandingContent()
  const text = copy.learning

  return (
    <section className="mj-section" id="learning" data-section="learning">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">{text.kicker}</span>
          <h2>{text.heading} <span className="mj-grad">{text.accent}</span></h2>
          <p>{text.copy}</p>
        </div>

        <div className="mj-flow">
          {learningFlow.map((step) => (
            <div className="mj-flow-step mj-reveal" key={step.title}>
              <span className="mj-flow-num"><Ico name={step.icon} /></span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </div>
          ))}
        </div>

        <div className="mj-meta-tags mj-reveal">
          {learningTags.map((tag) => (
            <span className="mj-chip" key={tag.label}>
              <Ico name={tag.icon} />
              {tag.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- identity */

export function Identity() {
  const { copy, identityPosters } = useLandingContent()
  const text = copy.identity

  return (
    <section className="mj-section mj-section-alt" id="identity" data-section="identity">
      <div className="mj-container">
        <div className="mj-identity mj-reveal">
          <div className="mj-identity-grid">
            <div>
              <span className="mj-kicker">{text.kicker}</span>
              <h2 className="mj-subhead">{text.heading}</h2>
              <p className="mj-lead">{text.lead}</p>

              <ul className="mj-identity-list">
                {text.points.map((point) => (
                  <li key={point}>
                    <Ico name="check" />
                    {point}
                  </li>
                ))}
              </ul>

              <p className="mj-review-note">{text.note}</p>
            </div>

            <div className="mj-identity-posters">
              {identityPosters.map((poster) => (
                <figure key={poster.caption}>
                  <img src={poster.image} alt={poster.alt} loading="lazy" />
                  <figcaption>{poster.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- devices */

export function Devices() {
  const { copy, devices } = useLandingContent()
  const text = copy.devices

  return (
    <section className="mj-section mj-section-alt" id="devices" data-section="devices">
      <div className="mj-container">
        <div className="mj-devices">
          <div className="mj-reveal">
            <span className="mj-kicker">{text.kicker}</span>
            <h2 className="mj-subhead">{text.heading}</h2>
            <p className="mj-lead">{text.lead}</p>

            <div className="mj-device-list">
              {devices.map((device) => (
                <div className="mj-device" key={device.name}>
                  <Ico name={device.icon} />
                  <span>
                    <b>{device.name}</b>
                    <small>{device.note}</small>
                  </span>
                </div>
              ))}
            </div>

            <div className="mj-continuity">
              <strong>{text.offlineStrong}</strong> {text.offline}
            </div>

            <div className="mj-store-row">
              <a className="mj-store" href="/download">
                <Ico name="googlePlay" />
                <span>
                  <b>Google Play</b>
                  <small>{text.storeNote}</small>
                </span>
              </a>
              <a className="mj-store" href="/download">
                <Ico name="appStore" />
                <span>
                  <b>App Store</b>
                  <small>{text.storeNote}</small>
                </span>
              </a>
              <div className="mj-qr-box">
                <QrCode label={text.qrLabel} />
                <p>{text.qr}</p>
              </div>
            </div>
          </div>

          <div className="mj-reveal">
            <div className="mj-stage">
              <div>
                <div className="mj-tv">
                  <img src={DEVICE_STAGE.tv} alt={text.tvAlt} loading="lazy" />
                </div>
                <span className="mj-tv-stand" aria-hidden="true" />
              </div>
              <div className="mj-tablet">
                <img src={DEVICE_STAGE.tablet} alt={text.tabletAlt} loading="lazy" />
              </div>
              <div className="mj-phone">
                <img src={DEVICE_STAGE.phone} alt={text.phoneAlt} loading="lazy" />
              </div>
              <div className="mj-float mj-float--a">
                <span className="mj-float-ico" style={{ color: '#38d996', background: 'rgba(56,217,150,.12)' }}>
                  <Ico name="download" />
                </span>
                <span>
                  <strong>{text.floatTitle}</strong>
                  <span>{text.floatText}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- originals */

export function Originals() {
  const { copy, universeSteps } = useLandingContent()
  const text = copy.originals

  return (
    <section className="mj-section" id="originals" data-section="originals">
      <div className="mj-container">
        <div className="mj-head mj-reveal">
          <span className="mj-kicker">{text.kicker}</span>
          <h2>{text.heading} <span className="mj-grad">{text.accent}</span></h2>
          <p>{text.copy}</p>
        </div>

        <div className="mj-orig-hero mj-reveal">
          <img src={ORIGINALS_HERO_IMAGE} alt={text.heroAlt} loading="lazy" />
          <div className="mj-orig-caption">
            <h3>{text.heroTitle}</h3>
            <p>{text.heroCopy}</p>
            <div className="mj-inline-chips">
              {text.heroChips.map((chip, index) => (
                <span
                  className={index === text.heroChips.length - 1 ? 'mj-chip mj-chip-premium' : 'mj-chip'}
                  key={chip}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mj-universe">
          {universeSteps.map((step) => (
            <div className="mj-universe-step mj-reveal" key={step.title}>
              <Ico name={step.icon} />
              <b>{step.title}</b>
              <small>{step.note}</small>
            </div>
          ))}
        </div>

        <div className="mj-center mj-mt-lg mj-reveal">
          <a className="mj-btn mj-btn-ghost" href="/originals">
            {text.cta}
            <Ico name="arrowNext" />
          </a>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------- start */

export function StartSteps() {
  const { copy } = useLandingContent()
  const text = copy.start

  return (
    <section className="mj-section mj-section-alt" id="start" data-section="start">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">{text.kicker}</span>
          <h2>{text.heading}</h2>
          <p>{text.copy}</p>
        </div>

        <div className="mj-steps">
          {text.steps.map((step, index) => (
            <article className="mj-step mj-reveal" key={step.title}>
              <span className="mj-step-num">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>

        <div className="mj-center mj-mt-lg mj-reveal">
          <a className="mj-btn mj-btn-primary mj-btn-lg" href={SIGNUP_URL}>
            {text.cta}
            <Ico name="arrowStart" />
          </a>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- reviews */

export function Reviews() {
  const { copy, reviewMethod, reviews } = useLandingContent()
  const text = copy.reviews

  return (
    <section className="mj-section mj-section-alt" id="reviews" data-section="reviews">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">{text.kicker}</span>
          <h2>{text.heading}</h2>
          <p>{text.copy}</p>
        </div>

        <div className="mj-method">
          {reviewMethod.map((step) => (
            <div className="mj-method-step mj-reveal" key={step.title}>
              <Ico name={step.icon} />
              <b>{step.title}</b>
              <p>{step.copy}</p>
            </div>
          ))}
        </div>

        <div className="mj-reviews">
          {reviews.map((review) => (
            <article className="mj-review mj-reveal" key={review.quote}>
              <span className="mj-review-tag">{review.tag}</span>
              <blockquote>{review.quote}</blockquote>
              <div className="mj-review-who">
                <img src={review.avatar} alt="" loading="lazy" />
                <div>
                  <b>{review.name}</b>
                  <small>{review.note}</small>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mj-honesty">{text.honesty}</p>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------- FAQ */

export function Faq() {
  const { copy } = useLandingContent()
  const text = copy.faq

  return (
    <section className="mj-section" id="faq" data-section="faq">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">{text.kicker}</span>
          <h2>{text.heading}</h2>
        </div>

        <div className="mj-faq-grid">
          {text.items.map((item) => (
            <details className="mj-faq mj-reveal" key={item.q}>
              <summary>
                {item.q}
                <Ico name="plus" />
              </summary>
              <div className="mj-faq-body">{item.a}</div>
            </details>
          ))}
        </div>

        <div className="mj-center mj-mt-lg mj-reveal">
          <a className="mj-btn mj-btn-ghost" href="/help">
            {text.helpCta}
            <Ico name="arrowNext" />
          </a>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- download */

export function DownloadCta() {
  const { copy } = useLandingContent()
  const text = copy.download

  return (
    <section className="mj-cta-section" id="download" data-section="download">
      <div className="mj-container">
        <div className="mj-cta mj-reveal">
          <h2>{text.heading}</h2>
          <p>{text.copy}</p>
          <div className="mj-cta-actions">
            <a className="mj-btn mj-btn-primary mj-btn-lg" href={SIGNUP_URL}>
              {text.ctaPrimary}
              <Ico name="arrowStart" />
            </a>
            <a className="mj-btn mj-btn-ghost mj-btn-lg" href="/download">
              {text.ctaSecondary}
              <Ico name="download" />
            </a>
          </div>
          <p className="mj-cta-fine">{text.fine}</p>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ footer */

export function SiteFooter() {
  const { copy, footerColumns, social } = useLandingContent()
  const { locale, setLocale } = useLandingLocale()
  const text = copy.footer

  return (
    <footer className="mj-footer" data-section="footer">
      <div className="mj-container">
        <div className="mj-footer-grid">
          <div className="mj-footer-about">
            <Brand />
            <p>{text.about}</p>
          </div>

          {footerColumns.map((column) => (
            <div className="mj-footer-col" key={column.key}>
              <h3>{column.title}</h3>
              {column.links.map((link) => (
                <a href={link.href} key={link.label}>{link.label}</a>
              ))}
            </div>
          ))}
        </div>

        <div className="mj-footer-meta">
          <div className="mj-footer-meta-group">
            <label className="mj-sr-only" htmlFor="mj-footer-lang">{text.langLabel}</label>
            <select
              className="mj-footer-select"
              id="mj-footer-lang"
              value={locale}
              onChange={(event) => {
                const next = event.target.value
                if (isLandingLocale(next)) setLocale(next)
              }}
            >
              {LANDING_LOCALES.map((entry) => (
                <option value={entry.code} key={entry.code} lang={entry.htmlLang}>
                  {entry.native}
                </option>
              ))}
            </select>

            <a className="mj-footer-select mj-store-link" href="/download">
              <Ico name="download" />
              {text.stores}
            </a>

            <a className="mj-footer-select mj-store-link" href={APP_URL}>
              <Ico name="globeHalf" />
              app.majarra.app
            </a>
          </div>

          <div className="mj-footer-meta-group">
            <div className="mj-social">
              {social.map((entry) => (
                <a href={entry.href} aria-label={entry.label} key={entry.label}>
                  <Ico name={entry.icon} />
                </a>
              ))}
            </div>
            <span className="mj-copyright">
              © {new Date().getFullYear()} مجرة · {text.rights}
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
