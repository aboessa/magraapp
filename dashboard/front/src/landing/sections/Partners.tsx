import { useState } from 'react'
import { Ico } from '../icons'
import { useLandingLocale } from '../i18n'
import { submitPartnership, type PartnershipKind } from '../partnershipApi'
import { useLandingContent } from '../useContent'

const KINDS: PartnershipKind[] = ['school', 'nursery', 'publisher', 'producer', 'creator', 'other']

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Status = 'idle' | 'sending' | 'sent'

const EMPTY = {
  kind: 'school' as PartnershipKind,
  name: '',
  organization: '',
  email: '',
  phone: '',
  country: '',
  message: '',
  website: '',
}

export function Partners() {
  const { copy, partnerAudiences } = useLandingContent()
  const { locale } = useLandingLocale()
  const text = copy.partners
  const form = text.form

  const [values, setValues] = useState(EMPTY)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!values.name.trim() || !values.organization.trim() || !values.message.trim()) {
      setError(form.errorRequired)
      return
    }
    if (!EMAIL_PATTERN.test(values.email.trim())) {
      setError(form.errorEmail)
      return
    }

    setStatus('sending')
    const result = await submitPartnership({
      kind: values.kind,
      name: values.name.trim(),
      organization: values.organization.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || undefined,
      country: values.country.trim() || undefined,
      message: values.message.trim(),
      website: values.website,
      locale,
    })

    if (result.ok) {
      setStatus('sent')
      setValues(EMPTY)
      return
    }

    setStatus('idle')
    if (result.reason === 'rate') setError(form.errorRate)
    else if (result.reason === 'validation') setError(result.message || form.errorRequired)
    else setError(form.errorGeneric)
  }

  return (
    <section className="mj-section mj-section-alt" id="partners" data-section="partners">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">{text.kicker}</span>
          <h2>{text.heading} <span className="mj-grad">{text.accent}</span></h2>
          <p>{text.copy}</p>
        </div>

        <div className="mj-partners">
          <div className="mj-partner-audiences mj-reveal">
            {partnerAudiences.map((audience) => (
              <article className="mj-partner-card" key={audience.title}>
                <span className="mj-partner-ico"><Ico name={audience.icon} /></span>
                <h3>{audience.title}</h3>
                <p>{audience.copy}</p>
              </article>
            ))}
          </div>

          <div className="mj-partner-form-wrap mj-reveal">
            {status === 'sent' ? (
              <div className="mj-partner-done" role="status">
                <span className="mj-partner-done-ico"><Ico name="check" /></span>
                <h3>{form.successTitle}</h3>
                <p>{form.successBody}</p>
                <button className="mj-btn mj-btn-ghost" type="button" onClick={() => setStatus('idle')}>
                  {form.sendAnother}
                </button>
              </div>
            ) : (
              <form className="mj-partner-form" onSubmit={onSubmit} noValidate>
                <h3>{form.heading}</h3>
                <p className="mj-partner-lead">{form.lead}</p>

                <div className="mj-field">
                  <label htmlFor="mj-p-kind">{form.type}</label>
                  <select
                    id="mj-p-kind"
                    value={values.kind}
                    onChange={(event) => set('kind', event.target.value as PartnershipKind)}
                  >
                    {KINDS.map((kind) => (
                      <option value={kind} key={kind}>{form.types[kind]}</option>
                    ))}
                  </select>
                </div>

                <div className="mj-field-row">
                  <div className="mj-field">
                    <label htmlFor="mj-p-name">{form.name}</label>
                    <input
                      id="mj-p-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder={form.namePlaceholder}
                      value={values.name}
                      onChange={(event) => set('name', event.target.value)}
                    />
                  </div>
                  <div className="mj-field">
                    <label htmlFor="mj-p-org">{form.organization}</label>
                    <input
                      id="mj-p-org"
                      type="text"
                      required
                      autoComplete="organization"
                      placeholder={form.organizationPlaceholder}
                      value={values.organization}
                      onChange={(event) => set('organization', event.target.value)}
                    />
                  </div>
                </div>

                <div className="mj-field-row">
                  <div className="mj-field">
                    <label htmlFor="mj-p-email">{form.email}</label>
                    <input
                      id="mj-p-email"
                      type="email"
                      required
                      dir="ltr"
                      autoComplete="email"
                      placeholder={form.emailPlaceholder}
                      value={values.email}
                      onChange={(event) => set('email', event.target.value)}
                    />
                  </div>
                  <div className="mj-field">
                    <label htmlFor="mj-p-phone">
                      {form.phone} <small>({form.optional})</small>
                    </label>
                    <input
                      id="mj-p-phone"
                      type="tel"
                      dir="ltr"
                      autoComplete="tel"
                      placeholder={form.phonePlaceholder}
                      value={values.phone}
                      onChange={(event) => set('phone', event.target.value)}
                    />
                  </div>
                </div>

                <div className="mj-field">
                  <label htmlFor="mj-p-country">
                    {form.country} <small>({form.optional})</small>
                  </label>
                  <input
                    id="mj-p-country"
                    type="text"
                    autoComplete="country-name"
                    placeholder={form.countryPlaceholder}
                    value={values.country}
                    onChange={(event) => set('country', event.target.value)}
                  />
                </div>

                <div className="mj-field">
                  <label htmlFor="mj-p-message">{form.message}</label>
                  <textarea
                    id="mj-p-message"
                    rows={5}
                    required
                    placeholder={form.messagePlaceholder}
                    value={values.message}
                    onChange={(event) => set('message', event.target.value)}
                  />
                </div>

                {/* فخ للبوتات: مخفي عن المستخدم وعن قارئ الشاشة */}
                <div className="mj-honeypot" aria-hidden="true">
                  <label htmlFor="mj-p-website">Website</label>
                  <input
                    id="mj-p-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={values.website}
                    onChange={(event) => set('website', event.target.value)}
                  />
                </div>

                {error && <p className="mj-field-error" role="alert">{error}</p>}

                <button
                  className="mj-btn mj-btn-primary mj-btn-block"
                  type="submit"
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? form.submitting : form.submit}
                  {status !== 'sending' && <Ico name="arrowStart" />}
                </button>

                <p className="mj-partner-privacy">{form.privacy}</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
