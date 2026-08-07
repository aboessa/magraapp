import { useState } from 'react'
import { Ico } from '../icons'
import { COMPARE_ROWS, CURRENCIES, PLANS } from '../data'
import type { BillingCycle, Currency, Plan } from '../data'

/** ينسّق السعر بأرقام لاتينية وفاصلة آلاف، ويبقي الكسور للدولار فقط */
function formatPrice(value: number) {
  const hasFraction = !Number.isInteger(value)
  return value.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

function savingPercent(plan: Plan, currency: Currency) {
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
  const symbol = CURRENCIES.find((item) => item.code === currency)?.symbol ?? currency

  return (
    <section className="mj-section" id="plans" data-section="plans">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">الباقات</span>
          <h2>اختر ما يناسب عائلتك</h2>
          <p>
            السعر ظاهر من أول خطوة، والإلغاء متاح في أي وقت.
            لا نخفي فرق الباقات ولا نطلب بطاقة لبدء التجربة المجانية.
          </p>
        </div>

        <div className="mj-plans-controls mj-reveal">
          <div className="mj-billing" role="group" aria-label="دورة الفوترة">
            <button type="button" aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>
              شهري
            </button>
            <button type="button" aria-pressed={cycle === 'yearly'} onClick={() => setCycle('yearly')}>
              سنوي <span className="mj-save">وفّر حتى 25%</span>
            </button>
          </div>

          <label className="mj-sr-only" htmlFor="mj-currency">العملة</label>
          <select
            className="mj-currency"
            id="mj-currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
          >
            {CURRENCIES.map((item) => (
              <option value={item.code} key={item.code}>{item.label}</option>
            ))}
          </select>
        </div>

        <div className="mj-plans">
          {PLANS.map((plan) => {
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
                      <span className="mj-cur">مجانًا</span>
                    </>
                  ) : (
                    <>
                      <span className="mj-amount">{formatPrice(amount)}</span>
                      <span className="mj-cur">{symbol}</span>
                      <span className="mj-per">/ {cycle === 'monthly' ? 'شهريًا' : 'سنويًا'}</span>
                    </>
                  )}
                </div>

                <p className="mj-plan-note">
                  {amount === null
                    ? 'للأبد · بلا بطاقة'
                    : cycle === 'monthly'
                      ? 'يُجدد شهريًا · إلغاء في أي وقت'
                      : `يُجدد سنويًا${saving > 0 ? ` · وفّر ${saving}%` : ''} · إلغاء في أي وقت`}
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
            جدول مقارنة تفصيلي
            <Ico name="chevronDown" />
          </summary>
          <div className="mj-table-wrap">
            <table className="mj-cmp">
              <thead>
                <tr>
                  <th scope="col">الميزة</th>
                  <th scope="col">مجانية</th>
                  <th scope="col">Lite</th>
                  <th scope="col">Family</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
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
          التجربة المجانية لباقة Family متاحة دون بطاقة، وتنتهي تلقائيًا بلا خصم إن لم تُكمل الاشتراك.
          الإلغاء من لوحة ولي الأمر في أي وقت، ويستمر الاشتراك حتى نهاية المدة المدفوعة.
          <br />
          الأسعار المعروضة إرشادية قبل الإطلاق، وتُثبَّت نهائيًا بعملة بلدك عند فتح الاشتراك.
        </p>
      </div>
    </section>
  )
}
