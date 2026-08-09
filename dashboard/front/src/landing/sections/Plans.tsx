import { useState } from 'react'
import { Ico } from '../icons'
import type { BillingCycle, Currency } from '../structure'
import { useLandingContent } from '../useContent'
import type { LandingContent } from '../useContent'

type PlanView = LandingContent['plans'][number]

/** ينسّق السعر بأرقام لاتينية وفاصلة آلاف، ويبقي الكسور للدولار فقط */
function formatPrice(value: number) {
  const hasFraction = !Number.isInteger(value)
  return value.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

function savingPercent(plan: PlanView, currency: Currency) {
  if (!plan.price) return 0
  const monthly = plan.price.monthly[currency]
  const yearly = plan.price.yearly[currency]
  if (!monthly || !yearly) return 0
  return Math.round((1 - yearly / (monthly * 12)) * 100)
}

function toneClass(tone: 'yes' | 'no' | undefined) {
  if (tone === 'yes') return 'is-yes'
  if (tone === 'no') return 'is-no'
  return undefined
}

export function Plans() {
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [currency, setCurrency] = useState<Currency>('SAR')
  const { copy, plans, compareRows, currencies } = useLandingContent()
  const text = copy.plans
  const symbol = currencies.find((item) => item.code === currency)?.symbol ?? currency

  return (
    <section className="mj-section" id="plans" data-section="plans">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">{text.kicker}</span>
          <h2>{text.heading}</h2>
          <p>{text.copy}</p>
        </div>

        <div className="mj-plans-controls mj-reveal">
          <div className="mj-billing" role="group" aria-label={text.billingAria}>
            <button type="button" aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>
              {text.monthly}
            </button>
            <button type="button" aria-pressed={cycle === 'yearly'} onClick={() => setCycle('yearly')}>
              {text.yearly} <span className="mj-save">{text.saveUpTo}</span>
            </button>
          </div>

          <label className="mj-sr-only" htmlFor="mj-currency">{text.currencyLabel}</label>
          <select
            className="mj-currency"
            id="mj-currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
          >
            {currencies.map((item) => (
              <option value={item.code} key={item.code}>{item.label}</option>
            ))}
          </select>
        </div>

        <div className="mj-plans">
          {plans.map((plan) => {
            const amount = plan.price ? plan.price[cycle][currency] : null
            const saving = cycle === 'yearly' ? savingPercent(plan, currency) : 0

            return (
              <article
                className={`mj-plan mj-plan--${plan.key}${plan.featured ? ' is-featured' : ''} mj-reveal`}
                key={plan.key}
              >
                {plan.flag && <span className="mj-plan-flag">{plan.flag}</span>}

                <div className="mj-plan-name">
                  <span className="mj-plan-swatch" />
                  {plan.name}
                </div>
                <p className="mj-plan-tagline">{plan.tagline}</p>

                <div className="mj-plan-price">
                  {amount === null ? (
                    <>
                      <span className="mj-amount">0</span>
                      <span className="mj-cur">{text.freeAmount}</span>
                    </>
                  ) : (
                    <>
                      <span className="mj-amount">{formatPrice(amount)}</span>
                      <span className="mj-cur">{symbol}</span>
                      <span className="mj-per">{cycle === 'monthly' ? text.perMonth : text.perYear}</span>
                    </>
                  )}
                </div>

                <p className="mj-plan-note">
                  {amount === null
                    ? text.freeNote
                    : cycle === 'monthly'
                      ? text.renewMonthly
                      : saving > 0
                        ? text.renewYearlyWithSave(saving)
                        : text.renewYearly}
                </p>

                <a
                  className={`mj-btn mj-btn-block ${plan.primaryCta ? 'mj-btn-primary' : 'mj-btn-ghost'}`}
                  href={plan.ctaHref}
                >
                  {plan.ctaLabel}
                </a>

                <ul className="mj-plan-features">
                  {plan.features.map((feature) => (
                    <li className={feature.off ? 'is-off' : undefined} key={feature.label}>
                      <Ico name={feature.off ? 'cross' : 'check'} />
                      {feature.label}
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>

        <details className="mj-compare mj-reveal">
          <summary>
            {text.compare}
            <Ico name="chevronDown" />
          </summary>
          <div className="mj-table-wrap">
            <table className="mj-cmp">
              <thead>
                <tr>
                  {text.compareHeaders.map((header) => (
                    <th scope="col" key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    <td className={toneClass(row.tone?.free)}>{row.free}</td>
                    <td className={toneClass(row.tone?.lite)}>{row.lite}</td>
                    <td className={toneClass(row.tone?.family)}>{row.family}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <p className="mj-plans-note">
          {text.note}
          <br />
          {text.noteFine}
        </p>
      </div>
    </section>
  )
}
