import type { IconName } from './icons'

/**
 * البنية غير اللغوية لصفحة الهبوط: الأيقونات والصور والروابط والأسعار والمدارات.
 * كل النصوص المعروضة تأتي من content/{ar,en,fr}.ts وتُدمج هنا في useContent.ts،
 * فإضافة لغة جديدة لا تلمس هذا الملف.
 */

/** الموقع العام مقابل تطبيق الويب */
export const APP_URL = 'https://app.majarra.app'
export const SIGNUP_URL = `${APP_URL}/signup`

/* ------------------------------------------------------------------ header */

export type NavKey = 'home' | 'worlds' | 'parents' | 'plans' | 'devices' | 'partners'

export const NAV_STRUCTURE: { key: NavKey; href: string }[] = [
  { key: 'home', href: '#top' },
  { key: 'worlds', href: '#worlds' },
  { key: 'parents', href: '#parents' },
  { key: 'plans', href: '#plans' },
  { key: 'devices', href: '#devices' },
  { key: 'partners', href: '#partners' },
]

export type MegaKey = 'watch' | 'read' | 'listen' | 'play' | 'learn'

export const MEGA_STRUCTURE: { key: MegaKey; icon: IconName; hrefs: string[] }[] = [
  { key: 'watch', icon: 'tv', hrefs: ['/series', '/series?type=film', '/series?type=short', '/learning'] },
  { key: 'read', icon: 'book', hrefs: ['/stories', '/stories?type=comics', '/stories?type=books', '/worlds/stories'] },
  { key: 'listen', icon: 'headphones', hrefs: ['/audio', '/audio?type=bedtime', '/audio?type=nasheed'] },
  { key: 'play', icon: 'gamepad', hrefs: ['/games', '/games?type=challenge', '/games?type=activity'] },
  {
    key: 'learn',
    icon: 'graduation',
    hrefs: ['/worlds/language', '/worlds/science', '/worlds/numbers', '/worlds/history', '/worlds/skills'],
  },
]

/* -------------------------------------------------------------------- hero */

export const HERO_BACKGROUNDS = [
  '/landing/hero/landing-hero-poster-wall-desktop.webp',
  '/landing/hero/landing-library-poster-mosaic.webp',
  '/landing/hero/landing-family-learning-scene.webp',
]

export const HERO_STAGE = {
  tv: '/landing/series/banners/kids-explorers-adventures-banner.webp',
  tablet: '/landing/books/covers/book-arabic-letters-cover.webp',
  phone: '/landing/series/posters/preschool-luna-discovers-words-poster.webp',
}

/* ------------------------------------------------------------------- trust */

export const TRUST_ICONS: IconName[] = ['shield', 'globe', 'users', 'download', 'devices', 'report']

/* ----------------------------------------------------------------- pillars */

export type PillarKey = 'watch' | 'read' | 'listen' | 'play' | 'learn'

export const PILLAR_STRUCTURE: { key: PillarKey; icon: IconName; href: string; previews: string[] }[] = [
  {
    key: 'watch', icon: 'tv', href: '/series',
    previews: [
      '/landing/series/posters/kids-explorers-adventures-poster.webp',
      '/landing/series/posters/adventures-of-numbers-poster.webp',
      '/landing/series/posters/discover-your-body-poster.webp',
    ],
  },
  {
    key: 'read', icon: 'book', href: '/stories',
    previews: [
      '/landing/books/covers/book-kindness-cover.webp',
      '/landing/books/covers/book-nature-cover.webp',
      '/landing/books/covers/book-counting-cover.webp',
    ],
  },
  {
    key: 'listen', icon: 'headphones', href: '/audio',
    previews: [
      '/landing/audio/covers/audio-bedtime-stories-cover.webp',
      '/landing/audio/covers/audio-letters-rhythm-cover.webp',
      '/landing/series/posters/bedtime-stories-poster.webp',
    ],
  },
  {
    key: 'play', icon: 'gamepad', href: '/games',
    previews: [
      '/landing/games/game-letter-tracing-cover.webp',
      '/landing/games/game-number-maze-cover.webp',
      '/landing/games/game-shape-matching-cover.webp',
    ],
  },
  {
    key: 'learn', icon: 'graduation', href: '/learning',
    previews: [
      '/landing/series/posters/junior-science-in-a-minute-poster.webp',
      '/landing/projects/covers/junior-project-solar-oven-cover.webp',
      '/landing/series/posters/try-it-at-home-poster.webp',
    ],
  },
]

/* ---------------------------------------------------------------- showcase */

export type Access = 'free' | 'premium' | 'original'
export type SecondaryKey = 'trailer' | 'preview' | 'sample' | 'how' | 'steps' | 'review'
export type ShowcaseTabKey = 'top' | 'new' | 'originals' | 'science' | 'faith' | 'games'

export type ShowcaseEntry = {
  slug: string
  image: string
  access: Access
  /** نطاق عمري مجرد، يُعرض داخل عنصر dir="ltr" */
  age: string
  /** الأعمال بلا فيديو لا تعرض زر التشغيل */
  playable?: boolean
  secondary: SecondaryKey
  hash: string
}

export const SHOWCASE_STRUCTURE: { key: ShowcaseTabKey; items: ShowcaseEntry[] }[] = [
  {
    key: 'top',
    items: [
      { slug: 'kids-explorers-adventures', image: '/landing/series/posters/kids-explorers-adventures-poster.webp', access: 'free', age: '6–8', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'adventures-of-numbers', image: '/landing/series/posters/adventures-of-numbers-poster.webp', access: 'free', age: '3–5', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'discover-your-body', image: '/landing/series/posters/discover-your-body-poster.webp', access: 'premium', age: '6–8', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'hekaya-wa-hikma', image: '/landing/series/posters/hekaya-wa-hikma-poster.webp', access: 'free', age: '3–8', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'bedtime-stories', image: '/landing/series/posters/bedtime-stories-poster.webp', access: 'premium', age: '3–6', playable: true, secondary: 'sample', hash: '#sample' },
      { slug: 'try-it-at-home', image: '/landing/series/posters/try-it-at-home-poster.webp', access: 'free', age: '9–12', playable: true, secondary: 'trailer', hash: '#trailer' },
    ],
  },
  {
    key: 'new',
    items: [
      { slug: 'book-arabic-letters', image: '/landing/books/covers/book-arabic-letters-cover.webp', access: 'free', age: '3–5', secondary: 'preview', hash: '#preview' },
      { slug: 'book-kindness', image: '/landing/books/covers/book-kindness-cover.webp', access: 'free', age: '6–8', secondary: 'preview', hash: '#preview' },
      { slug: 'book-counting', image: '/landing/books/covers/book-counting-cover.webp', access: 'premium', age: '3–5', secondary: 'preview', hash: '#preview' },
      { slug: 'book-nature', image: '/landing/books/covers/book-nature-cover.webp', access: 'premium', age: '6–8', secondary: 'preview', hash: '#preview' },
      { slug: 'book-human-body', image: '/landing/books/covers/book-human-body-cover.webp', access: 'premium', age: '9–12', secondary: 'preview', hash: '#preview' },
      { slug: 'junior-solar-rover-guide', image: '/landing/books/covers/junior-solar-rover-guide-cover.webp', access: 'premium', age: '9–12', secondary: 'preview', hash: '#preview' },
    ],
  },
  {
    key: 'originals',
    items: [
      { slug: 'junior-robo-codes', image: '/landing/series/posters/junior-robo-codes-poster.webp', access: 'original', age: '9–12', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'junior-future-lab', image: '/landing/series/posters/junior-future-lab-poster.webp', access: 'original', age: '9–12', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'junior-journey-civilizations', image: '/landing/series/posters/junior-journey-civilizations-poster.webp', access: 'original', age: '9–12', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'preschool-luna-discovers-words', image: '/landing/series/posters/preschool-luna-discovers-words-poster.webp', access: 'free', age: '3–5', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'preschool-count-with-me', image: '/landing/series/posters/preschool-count-with-me-poster.webp', access: 'free', age: '3–5', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'preschool-colors-around-us', image: '/landing/series/posters/preschool-colors-around-us-poster.webp', access: 'original', age: '3–5', playable: true, secondary: 'trailer', hash: '#trailer' },
    ],
  },
  {
    key: 'science',
    items: [
      { slug: 'junior-science-in-a-minute', image: '/landing/series/posters/junior-science-in-a-minute-poster.webp', access: 'free', age: '9–12', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'discover-your-body', image: '/landing/series/posters/discover-your-body-poster.webp', access: 'premium', age: '6–8', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'junior-everyday-forces', image: '/landing/books/covers/junior-everyday-forces-cover.webp', access: 'premium', age: '9–12', secondary: 'preview', hash: '#preview' },
      { slug: 'try-it-at-home', image: '/landing/series/posters/try-it-at-home-poster.webp', access: 'free', age: '9–12', playable: true, secondary: 'trailer', hash: '#trailer' },
      { slug: 'junior-science-evidence', image: '/landing/games/junior-science-evidence-cover.webp', access: 'premium', age: '9–12', secondary: 'how', hash: '#how' },
      { slug: 'junior-project-solar-oven', image: '/landing/projects/covers/junior-project-solar-oven-cover.webp', access: 'premium', age: '9–12', secondary: 'steps', hash: '#steps' },
    ],
  },
  {
    key: 'faith',
    items: [
      { slug: 'kids-prophets-stories', image: '/landing/islamic/posters/kids-prophets-stories-poster.webp', access: 'free', age: '6–8', playable: true, secondary: 'review', hash: '#review' },
      { slug: 'kids-quran-treasures', image: '/landing/islamic/posters/kids-quran-treasures-poster.webp', access: 'premium', age: '6–8', playable: true, secondary: 'review', hash: '#review' },
      { slug: 'preschool-noor-qalbi', image: '/landing/islamic/posters/preschool-noor-qalbi-poster.webp', access: 'free', age: '3–5', playable: true, secondary: 'review', hash: '#review' },
      { slug: 'kids-prayer-step-by-step', image: '/landing/islamic/posters/kids-prayer-step-by-step-poster.webp', access: 'premium', age: '6–8', playable: true, secondary: 'review', hash: '#review' },
      { slug: 'junior-seerah-journey', image: '/landing/islamic/posters/junior-seerah-journey-poster.webp', access: 'premium', age: '9–12', playable: true, secondary: 'review', hash: '#review' },
      { slug: 'preschool-adhkar-manners', image: '/landing/islamic/posters/preschool-adhkar-manners-prayer-poster.webp', access: 'free', age: '3–5', playable: true, secondary: 'review', hash: '#review' },
    ],
  },
  {
    key: 'games',
    items: [
      { slug: 'game-letter-tracing', image: '/landing/games/game-letter-tracing-cover.webp', access: 'free', age: '3–5', secondary: 'how', hash: '#how' },
      { slug: 'game-number-maze', image: '/landing/games/game-number-maze-cover.webp', access: 'free', age: '6–8', secondary: 'how', hash: '#how' },
      { slug: 'game-shape-matching', image: '/landing/games/game-shape-matching-cover.webp', access: 'free', age: '3–5', secondary: 'how', hash: '#how' },
      { slug: 'game-animal-memory', image: '/landing/games/game-animal-memory-cover.webp', access: 'premium', age: '3–8', secondary: 'how', hash: '#how' },
      { slug: 'junior-code-sequence', image: '/landing/games/junior-code-sequence-cover.webp', access: 'premium', age: '9–12', secondary: 'how', hash: '#how' },
      { slug: 'junior-circuit-builder', image: '/landing/games/junior-circuit-builder-cover.webp', access: 'premium', age: '9–12', secondary: 'how', hash: '#how' },
    ],
  },
]

/* ------------------------------------------------------------------ worlds */

export type WorldKey =
  | 'language' | 'numbers' | 'science' | 'stories' | 'creativity'
  | 'skills' | 'history' | 'ourworld' | 'faith'

export type WorldStructure = {
  key: WorldKey
  glow: string
  image: string
  href: string
  /** صور المختارات بترتيب أسماء picks في ملف اللغة */
  picks: string[]
  /**
   * الموضع على المدار: نصف القطر بالنسبة المئوية والزاوية بالدرجات.
   * القيم محسوبة بحيث لا يتلامس كوكب مع آخر ولا مع النواة
   * (الكوكب 17% والنواة 18% من عرض المشهد).
   */
  orbit: { radius: number; angle: number }
}

export const WORLD_STRUCTURE: WorldStructure[] = [
  {
    key: 'language', glow: 'rgba(37,128,255,.24)', image: '/landing/planets/planet-abjad.webp',
    href: '/worlds/language', orbit: { radius: 42, angle: -90 },
    picks: [
      '/landing/series/posters/preschool-luna-discovers-words-poster.webp',
      '/landing/books/covers/book-arabic-letters-cover.webp',
      '/landing/games/game-letter-tracing-cover.webp',
    ],
  },
  {
    key: 'numbers', glow: 'rgba(255,181,46,.24)', image: '/landing/planets/planet-numbers.webp',
    href: '/worlds/numbers', orbit: { radius: 42, angle: -18 },
    picks: [
      '/landing/series/posters/adventures-of-numbers-poster.webp',
      '/landing/books/covers/book-counting-cover.webp',
      '/landing/games/game-number-maze-cover.webp',
    ],
  },
  {
    key: 'science', glow: 'rgba(50,201,121,.24)', image: '/landing/planets/planet-science.webp',
    href: '/worlds/science', orbit: { radius: 42, angle: 54 },
    picks: [
      '/landing/series/posters/discover-your-body-poster.webp',
      '/landing/series/posters/junior-science-in-a-minute-poster.webp',
      '/landing/projects/covers/junior-project-solar-oven-cover.webp',
    ],
  },
  {
    key: 'stories', glow: 'rgba(157,104,255,.26)', image: '/landing/planets/planet-stories.webp',
    href: '/worlds/stories', orbit: { radius: 42, angle: 126 },
    picks: [
      '/landing/books/covers/book-nature-cover.webp',
      '/landing/audio/covers/audio-bedtime-stories-cover.webp',
      '/landing/books/covers/book-kindness-cover.webp',
    ],
  },
  {
    key: 'creativity', glow: 'rgba(200,75,255,.24)', image: '/landing/planets/planet-creativity.webp',
    href: '/worlds/creativity', orbit: { radius: 42, angle: 198 },
    picks: [
      '/landing/series/posters/preschool-colors-around-us-poster.webp',
      '/landing/projects/covers/junior-project-paper-bridge-cover.webp',
      '/landing/activities/covers/activity-safe-experiment-cover.webp',
    ],
  },
  {
    key: 'skills', glow: 'rgba(0,191,166,.24)', image: '/landing/planets/planet-maharat.webp',
    href: '/worlds/skills', orbit: { radius: 23, angle: -45 },
    picks: [
      '/landing/series/posters/junior-robo-codes-poster.webp',
      '/landing/games/junior-code-sequence-cover.webp',
      '/landing/games/junior-circuit-builder-cover.webp',
    ],
  },
  {
    key: 'history', glow: 'rgba(217,144,61,.24)', image: '/landing/planets/planet-tarikh.webp',
    href: '/worlds/history', orbit: { radius: 23, angle: 45 },
    picks: [
      '/landing/series/posters/junior-journey-civilizations-poster.webp',
      '/landing/books/covers/junior-civilization-innovations-cover.webp',
      '/landing/games/junior-civilizations-timeline-cover.webp',
    ],
  },
  {
    key: 'ourworld', glow: 'rgba(37,128,255,.2)', image: '/landing/planets/planet-alamna.webp',
    href: '/worlds/our-world', orbit: { radius: 23, angle: 135 },
    picks: [
      '/landing/series/posters/kids-explorers-adventures-poster.webp',
      '/landing/activities/covers/activity-nature-observation-cover.webp',
      '/landing/games/game-animal-memory-cover.webp',
    ],
  },
  {
    key: 'faith', glow: 'rgba(47,191,143,.24)', image: '/landing/planets/planet-iman.webp',
    href: '/worlds/faith', orbit: { radius: 23, angle: 225 },
    picks: [
      '/landing/islamic/posters/kids-prophets-stories-poster.webp',
      '/landing/islamic/posters/junior-seerah-journey-poster.webp',
      '/landing/islamic/posters/preschool-adhkar-manners-prayer-poster.webp',
    ],
  },
]

/* ----------------------------------------------------------- stories planet */

export const READING_MODE_ICONS: IconName[] = ['bookPlain', 'headphonesTop', 'lines', 'speaker']

export const STORY_FEATURE_ICONS: IconName[] = [
  'headphonesTop', 'globeHalf', 'pageTurn', 'highlight', 'moon', 'download', 'continuity', 'tv',
]

export const STORY_PAGE_IMAGE = '/landing/books/covers/book-nature-cover.webp'

/* -------------------------------------------------------------- age tracks */

export type AgeTrackKey = 'preschool' | 'kids' | 'junior'

export const SPEC_ICONS: Record<'content' | 'reading' | 'session' | 'games' | 'skills', IconName> = {
  content: 'tvPlain',
  reading: 'bookPlain',
  session: 'clock',
  games: 'gamepad',
  skills: 'graduation',
}

export const SPEC_ORDER = ['content', 'reading', 'session', 'games', 'skills'] as const

export const AGE_TRACK_STRUCTURE: { key: AgeTrackKey; accent: string; samples: string[] }[] = [
  {
    key: 'preschool', accent: '#ffd34d',
    samples: [
      '/landing/series/posters/preschool-luna-discovers-words-poster.webp',
      '/landing/series/posters/preschool-colors-around-us-poster.webp',
      '/landing/books/covers/book-arabic-letters-cover.webp',
      '/landing/games/game-shape-matching-cover.webp',
    ],
  },
  {
    key: 'kids', accent: '#00d6f5',
    samples: [
      '/landing/series/posters/kids-explorers-adventures-poster.webp',
      '/landing/series/posters/discover-your-body-poster.webp',
      '/landing/books/covers/book-kindness-cover.webp',
      '/landing/games/game-number-maze-cover.webp',
    ],
  },
  {
    key: 'junior', accent: '#a98bff',
    samples: [
      '/landing/series/posters/junior-robo-codes-poster.webp',
      '/landing/series/posters/junior-journey-civilizations-poster.webp',
      '/landing/books/covers/junior-everyday-forces-cover.webp',
      '/landing/projects/covers/junior-project-paper-bridge-cover.webp',
    ],
  },
]

/* ----------------------------------------------------------------- parents */

export const SAFETY_ICONS: IconName[] = [
  'usersPlain', 'shield', 'lock', 'clock', 'plus', 'reportPlain',
  'bars', 'download', 'continuity', 'external', 'tvPlain', 'check',
]

export const PARENT_IMAGES = {
  dash: '/landing/app/parent/parent-dashboard-hero.webp',
  report: '/landing/app/parent/weekly-report-illustration.webp',
  screenTime: '/landing/app/parent/screen-time-control-illustration.webp',
}

/* ---------------------------------------------------------------- learning */

export const LEARNING_FLOW_ICONS: IconName[] = ['tvPlain', 'bookPlain', 'gamepad', 'star', 'report']

export const LEARNING_TAG_ICONS: IconName[] = [
  'graduationPlain', 'target', 'usersPlain', 'bars', 'heart', 'doc',
]

/* ---------------------------------------------------------------- identity */

export const IDENTITY_POSTER_IMAGES = [
  '/landing/islamic/posters/preschool-noor-qalbi-poster.webp',
  '/landing/islamic/posters/kids-prophets-stories-poster.webp',
  '/landing/islamic/posters/junior-seerah-journey-poster.webp',
  '/landing/series/posters/hekaya-wa-hikma-poster.webp',
  '/landing/islamic/posters/kids-quran-treasures-poster.webp',
  '/landing/islamic/posters/preschool-adhkar-manners-prayer-poster.webp',
]

/* --------------------------------------------------------- عيّنة السرد الصوتي */

export type LangCode = 'ar' | 'en' | 'fr'

export type StoryClip = {
  src: string
  durationSeconds: number
  waveform: number[]
}

/**
 * نفس صفحة القصة مسجّلة بثلاث لغات، تُشغَّل فعليًا في الصفحة.
 * الموجة قمم مقيسة من كل ملف على حدة (tools/landing-assets/build-audio.mjs)
 * لا أرقام تزيينية، فتطابق ما يسمعه الزائر.
 */
export const STORY_CLIPS: Record<LangCode, StoryClip> = {
  ar: {
    src: '/landing/audio/story-nature-page4-ar.wav',
    durationSeconds: 12.84,
    waveform: [
      39, 37, 35, 34, 48, 19, 50, 48, 44, 30, 46, 53, 70, 100,
      94, 48, 18, 54, 34, 63, 47, 18, 80, 75, 73, 57, 57, 27,
    ],
  },
  en: {
    src: '/landing/audio/story-nature-page4-en.wav',
    durationSeconds: 8.52,
    waveform: [
      22, 66, 80, 94, 84, 71, 84, 30, 27, 79, 81, 35, 19, 74,
      77, 73, 52, 100, 48, 51, 18, 21, 95, 88, 77, 67, 39, 20,
    ],
  },
  fr: {
    src: '/landing/audio/story-nature-page4-fr.wav',
    durationSeconds: 8.4,
    waveform: [
      18, 41, 61, 34, 100, 51, 93, 76, 18, 23, 93, 84, 82, 22,
      81, 81, 95, 90, 19, 19, 20, 90, 72, 38, 89, 46, 73, 58,
    ],
  },
}

/** نص العيّنة اللغوية: نفس الجملة بثلاث لغات، مستقلة عن لغة الواجهة */
export const LANG_SAMPLE: Record<LangCode, { dir: 'rtl' | 'ltr'; label: string; text: string }> = {
  ar: { dir: 'rtl', label: 'العربية', text: 'خرجت نُهى إلى الحديقة، ورأت نملة صغيرة تحمل حبة أكبر منها.' },
  en: { dir: 'ltr', label: 'English', text: 'Noha went out to the garden and saw a tiny ant carrying a seed bigger than itself.' },
  fr: { dir: 'ltr', label: 'Français', text: 'Noha est sortie dans le jardin et a vu une petite fourmi porter une graine plus grosse qu’elle.' },
}

/* ----------------------------------------------------------------- devices */

export const DEVICE_ICONS: IconName[] = ['phone', 'phoneApple', 'tvWide', 'tvPlain', 'tvSmart', 'globeHalf']

export const DEVICE_STAGE = {
  tv: '/landing/series/banners/junior-journey-civilizations-banner.webp',
  tablet: '/landing/books/covers/book-human-body-cover.webp',
  phone: '/landing/series/posters/junior-robo-codes-poster.webp',
}

/* --------------------------------------------------------------- originals */

export const UNIVERSE_STEP_ICONS: IconName[] = ['tv', 'bookPlain', 'gamepad', 'doc']

export const ORIGINALS_HERO_IMAGE = '/landing/series/banners/junior-robo-codes-banner.webp'

/* ------------------------------------------------------------------- plans */

export type BillingCycle = 'monthly' | 'yearly'
export type Currency = 'SAR' | 'AED' | 'EGP' | 'USD'
export type PlanKey = 'free' | 'lite' | 'family'

export const CURRENCY_CODES: Currency[] = ['SAR', 'AED', 'EGP', 'USD']

export type PlanStructure = {
  key: PlanKey
  featured?: boolean
  primaryCta?: boolean
  ctaHref: string
  /** الباقة المجانية بلا سعر */
  price?: Record<BillingCycle, Record<Currency, number>>
  /** المزايا المشطوبة، بترتيب features في ملف اللغة */
  offIndexes?: number[]
}

export const PLAN_STRUCTURE: PlanStructure[] = [
  { key: 'free', ctaHref: SIGNUP_URL, offIndexes: [3, 4] },
  {
    key: 'lite',
    ctaHref: `${APP_URL}/subscribe?plan=lite`,
    offIndexes: [4],
    price: {
      monthly: { SAR: 19, AED: 19, EGP: 149, USD: 4.99 },
      yearly: { SAR: 179, AED: 179, EGP: 1399, USD: 47.99 },
    },
  },
  {
    key: 'family',
    featured: true,
    primaryCta: true,
    ctaHref: `${APP_URL}/subscribe?plan=family`,
    price: {
      monthly: { SAR: 39, AED: 39, EGP: 299, USD: 9.99 },
      yearly: { SAR: 349, AED: 349, EGP: 2690, USD: 89.99 },
    },
  },
]

export type CompareTone = { free?: 'yes' | 'no'; lite?: 'yes' | 'no'; family?: 'yes' | 'no' }

/** تلوين خلايا نعم/لا، بترتيب compareRows في ملف اللغة */
export const COMPARE_TONES: (CompareTone | undefined)[] = [
  undefined,
  { family: 'yes' },
  undefined,
  undefined,
  undefined,
  undefined,
  { free: 'no', lite: 'no', family: 'yes' },
  { lite: 'yes', family: 'yes' },
  { lite: 'yes', family: 'yes' },
  { family: 'yes' },
  { free: 'no', family: 'yes' },
  { free: 'yes', lite: 'yes', family: 'yes' },
  { family: 'yes' },
  { free: 'no', lite: 'yes', family: 'yes' },
]

/* ----------------------------------------------------------------- reviews */

export const REVIEW_METHOD_ICONS: IconName[] = ['doc', 'shield', 'graduation']

export const REVIEW_AVATARS = [
  '/landing/app/avatars/avatar-girl-lavender-hijab.webp',
  '/landing/app/avatars/avatar-boy-neat-hair.webp',
  '/landing/app/avatars/avatar-girl-curly-glasses.webp',
]

/* ------------------------------------------------------------- partnerships */

export type PartnerAudienceKey = 'schools' | 'nurseries' | 'publishers' | 'creators'

export const PARTNER_AUDIENCE_ICONS: IconName[] = ['graduation', 'heart', 'book', 'headphones']

/* ------------------------------------------------------------------ footer */

export type FooterColumnKey = 'majarra' | 'discover' | 'parents' | 'partners' | 'legal'

export const FOOTER_STRUCTURE: { key: FooterColumnKey; hrefs: string[] }[] = [
  { key: 'majarra', hrefs: ['/about', '/about#mission', '/safety#review', '/about#careers', '/help#contact'] },
  { key: 'discover', hrefs: ['/worlds', '/series', '/stories', '/games', '/audio', '/originals'] },
  { key: 'parents', hrefs: ['/safety', '/learning', '/parents', '/plans', '/devices', '/help'] },
  { key: 'partners', hrefs: ['#partners', '#partners', '#partners', '#partners', '#partners'] },
  {
    key: 'legal',
    hrefs: [
      '/legal/privacy', '/legal/children-privacy', '/legal/terms', '/legal/cookies',
      '/legal/ads', '/legal/delete-account', '/legal/content-rights',
    ],
  },
]

export const SOCIAL_STRUCTURE: { icon: IconName; href: string }[] = [
  { icon: 'youtube', href: '#' },
  { icon: 'instagram', href: '#' },
  { icon: 'xSocial', href: '#' },
  { icon: 'tiktok', href: '#' },
]
