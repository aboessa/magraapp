import { useMemo } from 'react'
import { copyFor, type LandingCopy } from './content'
import { useLandingLocale, type LandingLocale } from './i18n'
import {
  AGE_TRACK_STRUCTURE,
  COMPARE_TONES,
  CURRENCY_CODES,
  DEVICE_ICONS,
  FOOTER_STRUCTURE,
  HERO_BACKGROUNDS,
  IDENTITY_POSTER_IMAGES,
  LEARNING_FLOW_ICONS,
  LEARNING_TAG_ICONS,
  MEGA_STRUCTURE,
  NAV_STRUCTURE,
  PARTNER_AUDIENCE_ICONS,
  PILLAR_STRUCTURE,
  PLAN_STRUCTURE,
  READING_MODE_ICONS,
  REVIEW_AVATARS,
  REVIEW_METHOD_ICONS,
  SAFETY_ICONS,
  SHOWCASE_STRUCTURE,
  SOCIAL_STRUCTURE,
  SPEC_ICONS,
  SPEC_ORDER,
  STORY_FEATURE_ICONS,
  TRUST_ICONS,
  UNIVERSE_STEP_ICONS,
  WORLD_STRUCTURE,
  type Access,
  type BillingCycle,
  type Currency,
} from './structure'
import type { IconName } from './icons'

/**
 * يدمج بنية الصفحة (صور/أيقونات/روابط/أسعار) مع نصوص اللغة الحالية،
 * فتحصل المكوّنات على نفس الأشكال التي كانت تقرأها من data.ts سابقًا
 * لكن بلغة الزائر.
 */
export function buildContent(locale: LandingLocale) {
  const copy = copyFor(locale)

  const nav = NAV_STRUCTURE.map((entry) => ({
    key: entry.key,
    href: entry.href,
    label: copy.nav[entry.key],
  }))

  const mega = MEGA_STRUCTURE.map((column) => ({
    key: column.key,
    icon: column.icon,
    title: copy.mega[column.key].title,
    links: copy.mega[column.key].links.map((label, index) => ({
      label,
      href: column.hrefs[index] ?? column.hrefs[0],
    })),
  }))

  const heroSlides = copy.hero.slides.map((slide, index) => ({
    ...slide,
    background: HERO_BACKGROUNDS[index] ?? HERO_BACKGROUNDS[0],
  }))

  const trust = copy.trust.map((label, index) => ({ label, icon: TRUST_ICONS[index] }))

  const pillars = PILLAR_STRUCTURE.map((pillar) => ({
    key: pillar.key,
    icon: pillar.icon,
    href: pillar.href,
    previews: pillar.previews,
    title: copy.pillars.items[pillar.key].title,
    copy: copy.pillars.items[pillar.key].copy,
    linkLabel: copy.pillars.items[pillar.key].link,
  }))

  const showcaseTabs = SHOWCASE_STRUCTURE.map((tab) => ({
    key: tab.key,
    label: copy.showcase.tabs[tab.key],
    items: tab.items.map((item) => {
      const text = copy.showcase.items[item.slug as keyof typeof copy.showcase.items]
      return {
        slug: item.slug,
        image: item.image,
        access: item.access as Access,
        age: item.age,
        playable: item.playable,
        title: text.title,
        alt: text.alt,
        meta: text.meta,
        secondary: { label: copy.showcase.secondary[item.secondary], hash: item.hash },
      }
    }),
  }))

  const worlds = WORLD_STRUCTURE.map((world) => {
    const text = copy.worlds.items[world.key]
    return {
      key: world.key,
      glow: world.glow,
      image: world.image,
      href: world.href,
      orbit: world.orbit,
      name: text.name,
      short: text.short,
      age: text.age,
      desc: text.desc,
      types: text.types,
      picks: text.picks.map((label, index) => ({ label, image: world.picks[index] ?? world.picks[0] })),
    }
  })

  const readingModes = copy.stories.modes.map((mode, index) => ({
    ...mode,
    icon: READING_MODE_ICONS[index],
  }))

  const storyFeatures = copy.stories.features.map((label, index) => ({
    label,
    icon: STORY_FEATURE_ICONS[index],
  }))

  const ageTracks = AGE_TRACK_STRUCTURE.map((track) => {
    const text = copy.ages.tracks[track.key]
    return {
      key: track.key,
      accent: track.accent,
      tabLabel: text.tabLabel,
      pill: text.pill,
      title: text.title,
      copy: text.copy,
      specs: SPEC_ORDER.map((spec) => ({
        icon: SPEC_ICONS[spec],
        label: copy.ages.specLabels[spec],
        value: text.specs[spec],
      })),
      samples: text.samples.map((sample, index) => ({
        ...sample,
        image: track.samples[index] ?? track.samples[0],
      })),
    }
  })

  const safety = copy.parents.features.map((label, index) => ({ label, icon: SAFETY_ICONS[index] }))

  const learningFlow = copy.learning.flow.map((step, index) => ({
    ...step,
    icon: LEARNING_FLOW_ICONS[index],
  }))

  const learningTags = copy.learning.tags.map((label, index) => ({
    label,
    icon: LEARNING_TAG_ICONS[index],
  }))

  const identityPosters = copy.identity.posters.map((poster, index) => ({
    ...poster,
    image: IDENTITY_POSTER_IMAGES[index] ?? IDENTITY_POSTER_IMAGES[0],
  }))

  const devices = copy.devices.items.map((device, index) => ({
    ...device,
    icon: DEVICE_ICONS[index],
  }))

  const universeSteps = copy.originals.steps.map((step, index) => ({
    ...step,
    icon: UNIVERSE_STEP_ICONS[index],
  }))

  const currencies = CURRENCY_CODES.map((code) => ({
    code,
    label: copy.plans.currencies[code],
    symbol: copy.plans.symbols[code],
  }))

  const plans = PLAN_STRUCTURE.map((plan) => {
    const text = copy.plans.items[plan.key]
    const off = new Set(plan.offIndexes ?? [])
    return {
      key: plan.key,
      featured: plan.featured,
      primaryCta: plan.primaryCta,
      ctaHref: plan.ctaHref,
      price: plan.price,
      name: text.name,
      tagline: text.tagline,
      ctaLabel: text.cta,
      flag: plan.featured ? copy.plans.flagBest : undefined,
      features: text.features.map((label, index) => ({ label, off: off.has(index) })),
    }
  })

  const compareRows = copy.plans.compareRows.map((row, index) => ({
    ...row,
    tone: COMPARE_TONES[index],
  }))

  const reviewMethod = copy.reviews.method.map((step, index) => ({
    ...step,
    icon: REVIEW_METHOD_ICONS[index],
  }))

  const reviews = copy.reviews.items.map((review, index) => ({
    ...review,
    avatar: REVIEW_AVATARS[index] ?? REVIEW_AVATARS[0],
  }))

  const partnerAudiences = copy.partners.audiences.map((audience, index) => ({
    ...audience,
    icon: PARTNER_AUDIENCE_ICONS[index],
  }))

  const footerColumns = FOOTER_STRUCTURE.map((column) => ({
    key: column.key,
    title: copy.footer.columns[column.key].title,
    links: copy.footer.columns[column.key].links.map((label, index) => ({
      label,
      href: column.hrefs[index] ?? column.hrefs[0],
    })),
  }))

  const social = SOCIAL_STRUCTURE.map((entry, index) => ({
    ...entry,
    label: copy.footer.social[index],
  }))

  return {
    copy,
    nav,
    mega,
    heroSlides,
    trust,
    pillars,
    showcaseTabs,
    worlds,
    readingModes,
    storyFeatures,
    ageTracks,
    safety,
    learningFlow,
    learningTags,
    identityPosters,
    devices,
    universeSteps,
    currencies,
    plans,
    compareRows,
    reviewMethod,
    reviews,
    partnerAudiences,
    footerColumns,
    social,
  }
}

export type LandingContent = ReturnType<typeof buildContent>

export function useLandingContent() {
  const { locale } = useLandingLocale()
  return useMemo(() => buildContent(locale), [locale])
}

/** اختصار للمكوّنات التي تحتاج النصوص المباشرة فقط */
export function useCopy(): LandingCopy {
  const { locale } = useLandingLocale()
  return useMemo(() => copyFor(locale), [locale])
}

export type { BillingCycle, Currency, IconName }
