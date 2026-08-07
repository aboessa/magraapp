import type { IconName } from './icons'

/**
 * محتوى صفحة الهبوط التعريفية.
 * كل النصوص هنا حتى تُستبدل لاحقًا بمصدر من لوحة الإدارة بدون لمس مكوّنات العرض.
 * المحتوى بالعربية فقط في هذه المرحلة.
 */

/** الموقع العام مقابل تطبيق الويب */
export const APP_URL = 'https://app.majarra.app'
export const SIGNUP_URL = `${APP_URL}/signup`

/**
 * يعزل مقطعًا لاتينيًا أو نطاقًا رقميًا داخل نص عربي.
 * بدون العزل تعكس قواعد الاتجاه الثنائي النطاق فيظهر مقلوبًا،
 * وتنتقل نقطة نهاية الجملة إلى يسار الكلمة اللاتينية.
 * U+2066 = LEFT-TO-RIGHT ISOLATE، U+2069 = POP DIRECTIONAL ISOLATE.
 */
export function ltr(value: string) {
  return `\u2066${value}\u2069`
}

/* ------------------------------------------------------------------ header */

export type MegaColumn = {
  title: string
  icon: IconName
  links: { label: string; href: string }[]
}

export const NAV_LINKS = [
  { label: 'الرئيسية', href: '#top' },
  { label: 'الكواكب', href: '#worlds' },
  { label: 'للأهل', href: '#parents' },
  { label: 'الباقات', href: '#plans' },
  { label: 'الأجهزة', href: '#devices' },
] as const

export const MEGA_COLUMNS: MegaColumn[] = [
  {
    title: 'شاهد',
    icon: 'tv',
    links: [
      { label: 'مسلسلات', href: '/series' },
      { label: 'أفلام', href: '/series?type=film' },
      { label: 'حلقات قصيرة', href: '/series?type=short' },
      { label: 'محتوى تعليمي', href: '/learning' },
    ],
  },
  {
    title: 'اقرأ',
    icon: 'book',
    links: [
      { label: 'قصص مصورة', href: '/stories' },
      { label: 'كوميكس', href: '/stories?type=comics' },
      { label: 'كتب', href: '/stories?type=books' },
      { label: 'كوكب القصص', href: '/worlds/stories' },
    ],
  },
  {
    title: 'استمع',
    icon: 'headphones',
    links: [
      { label: 'قصص صوتية', href: '/audio' },
      { label: 'قبل النوم', href: '/audio?type=bedtime' },
      { label: 'أناشيد', href: '/audio?type=nasheed' },
    ],
  },
  {
    title: 'العب',
    icon: 'gamepad',
    links: [
      { label: 'ألعاب تعليمية', href: '/games' },
      { label: 'تحديات', href: '/games?type=challenge' },
      { label: 'أنشطة', href: '/games?type=activity' },
    ],
  },
  {
    title: 'تعلّم',
    icon: 'graduation',
    links: [
      { label: 'اللغة', href: '/worlds/language' },
      { label: 'العلوم', href: '/worlds/science' },
      { label: 'الأرقام', href: '/worlds/numbers' },
      { label: 'التاريخ', href: '/worlds/history' },
      { label: 'المهارات', href: '/worlds/skills' },
    ],
  },
]

/* -------------------------------------------------------------------- hero */

export type HeroSlide = {
  title: string
  accent: string
  copy: string
  background: string
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    title: 'عالم كامل من الحكايات',
    accent: 'والمعرفة لطفلك',
    copy: 'شاهدوا المسلسلات، اقرأوا القصص، استمعوا للحكايات، والعبوا ألعابًا تعليمية آمنة بالعربية ولغات متعددة.',
    background: '/landing/hero/landing-hero-poster-wall-desktop.webp',
  },
  {
    title: 'قصة يقرأها طفلك…',
    accent: 'أو تستيقظ وتروي نفسها',
    copy: 'قصص مصورة وكوميكس بأربعة أوضاع قراءة، مع صوت راوٍ لكل صفحة، وإبراز الجملة أثناء القراءة، وتحميل للقراءة دون إنترنت.',
    background: '/landing/hero/landing-library-poster-mosaic.webp',
  },
  {
    title: 'طفلك يستكشف بحرية…',
    accent: 'وأنت تظل مطمئنًا',
    copy: 'ملف مستقل لكل طفل، ومحتوى مناسب لعمره، ورمز PIN للأهل، وحدود وقت الشاشة، وتقرير أسبوعي واضح عن التعلم والقراءة.',
    background: '/landing/hero/landing-family-learning-scene.webp',
  },
]

export const HERO_NOTES = [
  'آمن للأطفال',
  'بدون إعلانات في باقة العائلة',
  'يعمل على جميع أجهزتك',
]

/* ------------------------------------------------------------------- trust */

export const TRUST_ITEMS: { icon: IconName; label: string }[] = [
  { icon: 'shield', label: `مناسب للأعمار ${ltr('3–12')}` },
  { icon: 'globe', label: 'محتوى عربي وعالمي' },
  { icon: 'users', label: 'ملفات أطفال متعددة' },
  { icon: 'download', label: 'تحميل للمشاهدة دون إنترنت' },
  { icon: 'devices', label: 'موبايل وتابلت وتلفزيون' },
  { icon: 'report', label: 'رقابة وتقارير للأهل' },
]

/* ----------------------------------------------------------------- pillars */

export type Pillar = {
  key: string
  icon: IconName
  title: string
  copy: string
  linkLabel: string
  href: string
  previews: string[]
}

export const PILLARS: Pillar[] = [
  {
    key: 'watch',
    icon: 'tv',
    title: 'شاهد',
    copy: 'مسلسلات وأفلام وحلقات قصيرة ومحتوى تعليمي يناسب عمر الطفل، بجودة عالية وترتيب واضح للمواسم والحلقات.',
    linkLabel: 'تصفح المسلسلات',
    href: '/series',
    previews: [
      '/landing/series/posters/kids-explorers-adventures-poster.webp',
      '/landing/series/posters/adventures-of-numbers-poster.webp',
      '/landing/series/posters/discover-your-body-poster.webp',
    ],
  },
  {
    key: 'read',
    icon: 'book',
    title: 'اقرأ',
    copy: 'قصص مصورة وكوميكس متعددة اللغات، مع قراءة ذاتية أو صوت الراوي، وإبراز الجملة أثناء القراءة.',
    linkLabel: 'تصفح القصص',
    href: '/stories',
    previews: [
      '/landing/books/covers/book-kindness-cover.webp',
      '/landing/books/covers/book-nature-cover.webp',
      '/landing/books/covers/book-counting-cover.webp',
    ],
  },
  {
    key: 'listen',
    icon: 'headphones',
    title: 'استمع',
    copy: 'قصص صوتية وحكايات قبل النوم وأناشيد بأصوات ومؤثرات مريحة، بمستوى صوت ونبرة مناسبين للنوم.',
    linkLabel: 'تصفح الصوتيات',
    href: '/audio',
    previews: [
      '/landing/audio/covers/audio-bedtime-stories-cover.webp',
      '/landing/audio/covers/audio-letters-rhythm-cover.webp',
      '/landing/series/posters/bedtime-stories-poster.webp',
    ],
  },
  {
    key: 'play',
    icon: 'gamepad',
    title: 'العب',
    copy: 'ألعاب وتحديات تربط المتعة بالمهارات والتعلم، بلا عدادات ضغط ولا مكافآت مرتبطة بزمن الشاشة.',
    linkLabel: 'تصفح الألعاب',
    href: '/games',
    previews: [
      '/landing/games/game-letter-tracing-cover.webp',
      '/landing/games/game-number-maze-cover.webp',
      '/landing/games/game-shape-matching-cover.webp',
    ],
  },
  {
    key: 'learn',
    icon: 'graduation',
    title: 'تعلّم',
    copy: 'محتوى منظم حسب العمر والمهارة، مع تقدم واضح وتقارير للأسرة تشرح ما تعلمه الطفل فعلًا.',
    linkLabel: 'الإطار التعليمي',
    href: '/learning',
    previews: [
      '/landing/series/posters/junior-science-in-a-minute-poster.webp',
      '/landing/projects/covers/junior-project-solar-oven-cover.webp',
      '/landing/series/posters/try-it-at-home-poster.webp',
    ],
  },
]

/* ---------------------------------------------------------------- showcase */

export type PosterItem = {
  slug: string
  title: string
  image: string
  alt: string
  access: 'free' | 'premium' | 'original'
  /** نطاق عمري مجرد، يُعرض داخل عنصر dir="ltr" */
  age: string
  meta: string[]
  secondary: { label: string; hash: string }
  /** الأعمال بلا فيديو لا تعرض زر التشغيل */
  playable?: boolean
}

export type ShowcaseTab = {
  key: string
  label: string
  items: PosterItem[]
}

const ACCESS_LABEL: Record<PosterItem['access'], string> = {
  free: 'مجاني',
  premium: 'Premium',
  original: 'Majarra Original',
}

export function accessLabel(access: PosterItem['access']) {
  return ACCESS_LABEL[access]
}

export const SHOWCASE_TABS: ShowcaseTab[] = [
  {
    key: 'top',
    label: 'الأكثر مشاهدة',
    items: [
      {
        slug: 'kids-explorers-adventures', title: 'مغامرات المستكشفين', playable: true,
        image: '/landing/series/posters/kids-explorers-adventures-poster.webp',
        alt: 'ملصق مسلسل مغامرات المستكشفين', access: 'free', age: '6–8',
        meta: ['مسلسل', 'عربي · EN', '13 دقيقة'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'adventures-of-numbers', title: 'مغامرات الأرقام', playable: true,
        image: '/landing/series/posters/adventures-of-numbers-poster.webp',
        alt: 'ملصق مسلسل مغامرات الأرقام', access: 'free', age: '3–5',
        meta: ['مسلسل', 'عربي', '8 دقائق'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'discover-your-body', title: 'اكتشف جسمك', playable: true,
        image: '/landing/series/posters/discover-your-body-poster.webp',
        alt: 'ملصق مسلسل اكتشف جسمك', access: 'premium', age: '6–8',
        meta: ['تعليمي', 'عربي · FR', '11 دقيقة'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'hekaya-wa-hikma', title: 'حكاية وحكمة', playable: true,
        image: '/landing/series/posters/hekaya-wa-hikma-poster.webp',
        alt: 'ملصق مسلسل حكاية وحكمة', access: 'free', age: '3–8',
        meta: ['قيم', 'عربي', '7 دقائق'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'bedtime-stories', title: 'حكايات قبل النوم', playable: true,
        image: '/landing/series/posters/bedtime-stories-poster.webp',
        alt: 'ملصق حكايات قبل النوم', access: 'premium', age: '3–6',
        meta: ['صوتي', 'عربي · EN', '6 دقائق'], secondary: { label: 'عينة صوتية', hash: '#sample' },
      },
      {
        slug: 'try-it-at-home', title: 'جرّبها في البيت', playable: true,
        image: '/landing/series/posters/try-it-at-home-poster.webp',
        alt: 'ملصق برنامج جرّبها في البيت', access: 'free', age: '9–12',
        meta: ['أنشطة', 'عربي', '9 دقائق'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
    ],
  },
  {
    key: 'new',
    label: 'قصص جديدة',
    items: [
      {
        slug: 'book-arabic-letters', title: 'حروفي العربية',
        image: '/landing/books/covers/book-arabic-letters-cover.webp',
        alt: 'غلاف قصة حروفي العربية', access: 'free', age: '3–5',
        meta: ['قصة مصورة', '16 صفحة', '7 دقائق قراءة'], secondary: { label: 'معاينة', hash: '#preview' },
      },
      {
        slug: 'book-kindness', title: 'بذرة اللطف',
        image: '/landing/books/covers/book-kindness-cover.webp',
        alt: 'غلاف قصة بذرة اللطف', access: 'free', age: '6–8',
        meta: ['قصة مصورة', '20 صفحة', 'عربي · EN'], secondary: { label: 'معاينة', hash: '#preview' },
      },
      {
        slug: 'book-counting', title: 'أعدّ معي',
        image: '/landing/books/covers/book-counting-cover.webp',
        alt: 'غلاف قصة أعدّ معي', access: 'premium', age: '3–5',
        meta: ['قصة تفاعلية', '14 صفحة', 'اقرأ لي'], secondary: { label: 'معاينة', hash: '#preview' },
      },
      {
        slug: 'book-nature', title: 'في الطبيعة',
        image: '/landing/books/covers/book-nature-cover.webp',
        alt: 'غلاف قصة في الطبيعة', access: 'premium', age: '6–8',
        meta: ['قصة مصورة', '22 صفحة', 'عربي · FR'], secondary: { label: 'معاينة', hash: '#preview' },
      },
      {
        slug: 'book-human-body', title: 'رحلة داخل الجسم',
        image: '/landing/books/covers/book-human-body-cover.webp',
        alt: 'غلاف كتاب رحلة داخل الجسم', access: 'premium', age: '9–12',
        meta: ['كتاب مصور', '32 صفحة', 'قراءة مستقلة'], secondary: { label: 'معاينة', hash: '#preview' },
      },
      {
        slug: 'junior-solar-rover-guide', title: 'دليل العربة الشمسية',
        image: '/landing/books/covers/junior-solar-rover-guide-cover.webp',
        alt: 'غلاف دليل العربة الشمسية', access: 'premium', age: '9–12',
        meta: ['كوميكس', '28 صفحة', 'مشروع مرتبط'], secondary: { label: 'معاينة', hash: '#preview' },
      },
    ],
  },
  {
    key: 'originals',
    label: 'مجـرة الأصلية',
    items: [
      {
        slug: 'junior-robo-codes', title: 'روبو والشيفرات', playable: true,
        image: '/landing/series/posters/junior-robo-codes-poster.webp',
        alt: 'ملصق سلسلة روبو والشيفرات', access: 'original', age: '9–12',
        meta: ['مسلسل + لعبة', 'عربي · EN', 'موسمان'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'junior-future-lab', title: 'مختبر المستقبل', playable: true,
        image: '/landing/series/posters/junior-future-lab-poster.webp',
        alt: 'ملصق سلسلة مختبر المستقبل', access: 'original', age: '9–12',
        meta: ['مسلسل + مشروع', 'عربي', '12 حلقة'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'junior-journey-civilizations', title: 'رحلة الحضارات', playable: true,
        image: '/landing/series/posters/junior-journey-civilizations-poster.webp',
        alt: 'ملصق سلسلة رحلة الحضارات', access: 'original', age: '9–12',
        meta: ['مسلسل + كوميكس', 'عربي', '10 حلقات'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'preschool-luna-discovers-words', title: 'لونا تكتشف الكلمات', playable: true,
        image: '/landing/series/posters/preschool-luna-discovers-words-poster.webp',
        alt: 'ملصق سلسلة لونا تكتشف الكلمات', access: 'free', age: '3–5',
        meta: ['مسلسل + قصص', 'عربي', 'شخصية أصلية'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'preschool-count-with-me', title: 'عُدّ معي', playable: true,
        image: '/landing/series/posters/preschool-count-with-me-poster.webp',
        alt: 'ملصق سلسلة عُدّ معي', access: 'free', age: '3–5',
        meta: ['مسلسل + لعبة', 'عربي', '16 حلقة'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'preschool-colors-around-us', title: 'ألوان حولنا', playable: true,
        image: '/landing/series/posters/preschool-colors-around-us-poster.webp',
        alt: 'ملصق سلسلة ألوان حولنا', access: 'original', age: '3–5',
        meta: ['مسلسل + نشاط', 'عربي', '14 حلقة'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
    ],
  },
  {
    key: 'science',
    label: 'العلوم',
    items: [
      {
        slug: 'junior-science-in-a-minute', title: 'العلم في دقيقة', playable: true,
        image: '/landing/series/posters/junior-science-in-a-minute-poster.webp',
        alt: 'ملصق برنامج العلم في دقيقة', access: 'free', age: '9–12',
        meta: ['حلقات قصيرة', 'عربي', 'دقيقة واحدة'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'discover-your-body', title: 'اكتشف جسمك', playable: true,
        image: '/landing/series/posters/discover-your-body-poster.webp',
        alt: 'ملصق مسلسل اكتشف جسمك', access: 'premium', age: '6–8',
        meta: ['تعليمي', 'عربي · FR', '11 دقيقة'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'junior-everyday-forces', title: 'قوى من حولنا',
        image: '/landing/books/covers/junior-everyday-forces-cover.webp',
        alt: 'غلاف كتاب قوى من حولنا', access: 'premium', age: '9–12',
        meta: ['كوميكس علمي', '26 صفحة', 'عربي'], secondary: { label: 'معاينة', hash: '#preview' },
      },
      {
        slug: 'try-it-at-home', title: 'جرّبها في البيت', playable: true,
        image: '/landing/series/posters/try-it-at-home-poster.webp',
        alt: 'ملصق برنامج جرّبها في البيت', access: 'free', age: '9–12',
        meta: ['تجارب آمنة', 'عربي', '9 دقائق'], secondary: { label: 'التريلر', hash: '#trailer' },
      },
      {
        slug: 'junior-science-evidence', title: 'الدليل العلمي',
        image: '/landing/games/junior-science-evidence-cover.webp',
        alt: 'غلاف لعبة الدليل العلمي', access: 'premium', age: '9–12',
        meta: ['لعبة', 'مهارة الاستنتاج', 'تعمل Offline'], secondary: { label: 'كيف تلعب', hash: '#how' },
      },
      {
        slug: 'junior-project-solar-oven', title: 'مشروع الفرن الشمسي',
        image: '/landing/projects/covers/junior-project-solar-oven-cover.webp',
        alt: 'غلاف مشروع الفرن الشمسي', access: 'premium', age: '9–12',
        meta: ['مشروع', '4 خطوات', 'مع تقرير تقدم'], secondary: { label: 'الخطوات', hash: '#steps' },
      },
    ],
  },
  {
    key: 'faith',
    label: 'الإيمان والقيم',
    items: [
      {
        slug: 'kids-prophets-stories', title: 'قصص الأنبياء', playable: true,
        image: '/landing/islamic/posters/kids-prophets-stories-poster.webp',
        alt: 'ملصق قصص الأنبياء', access: 'free', age: '6–8',
        meta: ['مسلسل', 'عربي', 'مراجَع شرعيًا'], secondary: { label: 'منهج المراجعة', hash: '#review' },
      },
      {
        slug: 'kids-quran-treasures', title: 'كنوز القرآن', playable: true,
        image: '/landing/islamic/posters/kids-quran-treasures-poster.webp',
        alt: 'ملصق كنوز القرآن', access: 'premium', age: '6–8',
        meta: ['تعليمي', 'عربي', 'مصادر معلنة'], secondary: { label: 'منهج المراجعة', hash: '#review' },
      },
      {
        slug: 'preschool-noor-qalbi', title: 'نور قلبي', playable: true,
        image: '/landing/islamic/posters/preschool-noor-qalbi-poster.webp',
        alt: 'ملصق سلسلة نور قلبي', access: 'free', age: '3–5',
        meta: ['مسلسل قصير', 'عربي', '5 دقائق'], secondary: { label: 'منهج المراجعة', hash: '#review' },
      },
      {
        slug: 'kids-prayer-step-by-step', title: 'الصلاة خطوة بخطوة', playable: true,
        image: '/landing/islamic/posters/kids-prayer-step-by-step-poster.webp',
        alt: 'ملصق الصلاة خطوة بخطوة', access: 'premium', age: '6–8',
        meta: ['تعليمي', 'عربي', 'سلسلة مصورة'], secondary: { label: 'منهج المراجعة', hash: '#review' },
      },
      {
        slug: 'junior-seerah-journey', title: 'رحلة السيرة', playable: true,
        image: '/landing/islamic/posters/junior-seerah-journey-poster.webp',
        alt: 'ملصق رحلة السيرة', access: 'premium', age: '9–12',
        meta: ['مسلسل', 'عربي', 'مراجَع شرعيًا'], secondary: { label: 'منهج المراجعة', hash: '#review' },
      },
      {
        slug: 'preschool-adhkar-manners', title: 'أذكاري وآدابي', playable: true,
        image: '/landing/islamic/posters/preschool-adhkar-manners-prayer-poster.webp',
        alt: 'ملصق أذكاري وآدابي', access: 'free', age: '3–5',
        meta: ['أناشيد وآداب', 'عربي', '4 دقائق'], secondary: { label: 'منهج المراجعة', hash: '#review' },
      },
    ],
  },
  {
    key: 'games',
    label: 'ألعاب وتحديات',
    items: [
      {
        slug: 'game-letter-tracing', title: 'تتبّع الحروف',
        image: '/landing/games/game-letter-tracing-cover.webp',
        alt: 'غلاف لعبة تتبّع الحروف', access: 'free', age: '3–5',
        meta: ['لعبة', 'مهارة الكتابة', 'تعمل Offline'], secondary: { label: 'كيف تلعب', hash: '#how' },
      },
      {
        slug: 'game-number-maze', title: 'متاهة الأرقام',
        image: '/landing/games/game-number-maze-cover.webp',
        alt: 'غلاف لعبة متاهة الأرقام', access: 'free', age: '6–8',
        meta: ['لعبة', 'الحساب الذهني', '5 دقائق'], secondary: { label: 'كيف تلعب', hash: '#how' },
      },
      {
        slug: 'game-shape-matching', title: 'مطابقة الأشكال',
        image: '/landing/games/game-shape-matching-cover.webp',
        alt: 'غلاف لعبة مطابقة الأشكال', access: 'free', age: '3–5',
        meta: ['لعبة', 'الإدراك البصري', 'تعمل Offline'], secondary: { label: 'كيف تلعب', hash: '#how' },
      },
      {
        slug: 'game-animal-memory', title: 'ذاكرة الحيوانات',
        image: '/landing/games/game-animal-memory-cover.webp',
        alt: 'غلاف لعبة ذاكرة الحيوانات', access: 'premium', age: '3–8',
        meta: ['لعبة', 'الذاكرة العاملة', '4 دقائق'], secondary: { label: 'كيف تلعب', hash: '#how' },
      },
      {
        slug: 'junior-code-sequence', title: 'تسلسل الشيفرة',
        image: '/landing/games/junior-code-sequence-cover.webp',
        alt: 'غلاف لعبة تسلسل الشيفرة', access: 'premium', age: '9–12',
        meta: ['تحدي', 'التفكير المنطقي', 'مرتبط بروبو'], secondary: { label: 'كيف تلعب', hash: '#how' },
      },
      {
        slug: 'junior-circuit-builder', title: 'باني الدوائر',
        image: '/landing/games/junior-circuit-builder-cover.webp',
        alt: 'غلاف لعبة باني الدوائر', access: 'premium', age: '9–12',
        meta: ['تحدي', 'الهندسة الكهربية', 'تعمل Offline'], secondary: { label: 'كيف تلعب', hash: '#how' },
      },
    ],
  },
]

/* ------------------------------------------------------------------ worlds */

export type World = {
  key: string
  name: string
  age: string
  glow: string
  image: string
  desc: string
  types: string[]
  href: string
  picks: { image: string; label: string }[]
  /**
   * الموضع على المدار: نصف القطر بالنسبة المئوية والزاوية بالدرجات.
   * القيم محسوبة بحيث لا يتلامس كوكب مع آخر ولا مع النواة
   * (الكوكب 17% والنواة 18% من عرض المشهد).
   */
  orbit: { radius: number; angle: number }
}

export const WORLDS: World[] = [
  {
    key: 'language', name: 'كوكب اللغة', age: `${ltr('3–12')} سنة`, glow: 'rgba(37,128,255,.24)',
    image: '/landing/planets/planet-abjad.webp', href: '/worlds/language',
    desc: 'حروف وكلمات وقراءة وتعبير، من أول صوت للحرف حتى تكوين جملة كاملة والتعبير عن رأي.',
    types: ['حلقات', 'قصص مصورة', 'قصص صوتية', 'ألعاب'],
    orbit: { radius: 42, angle: -90 },
    picks: [
      { image: '/landing/series/posters/preschool-luna-discovers-words-poster.webp', label: 'لونا تكتشف الكلمات' },
      { image: '/landing/books/covers/book-arabic-letters-cover.webp', label: 'حروفي العربية' },
      { image: '/landing/games/game-letter-tracing-cover.webp', label: 'تتبّع الحروف' },
    ],
  },
  {
    key: 'numbers', name: 'كوكب الأرقام', age: `${ltr('3–12')} سنة`, glow: 'rgba(255,181,46,.24)',
    image: '/landing/planets/planet-numbers.webp', href: '/worlds/numbers',
    desc: 'العدّ والحساب والأنماط والمنطق الرياضي، عبر مغامرات وألعاب تجعل الرقم شخصية لا رمزًا.',
    types: ['حلقات', 'ألعاب', 'قصص', 'تحديات'],
    orbit: { radius: 42, angle: -18 },
    picks: [
      { image: '/landing/series/posters/adventures-of-numbers-poster.webp', label: 'مغامرات الأرقام' },
      { image: '/landing/books/covers/book-counting-cover.webp', label: 'أعدّ معي' },
      { image: '/landing/games/game-number-maze-cover.webp', label: 'متاهة الأرقام' },
    ],
  },
  {
    key: 'science', name: 'كوكب العلوم', age: `${ltr('5–12')} سنة`, glow: 'rgba(50,201,121,.24)',
    image: '/landing/planets/planet-science.webp', href: '/worlds/science',
    desc: 'الجسم والطبيعة والفضاء والقوى، مع تجارب آمنة تُنفّذ في البيت ومشروعات تنتهي بنتيجة ملموسة.',
    types: ['تعليمي', 'تجارب', 'كوميكس', 'مشروعات'],
    orbit: { radius: 42, angle: 54 },
    picks: [
      { image: '/landing/series/posters/discover-your-body-poster.webp', label: 'اكتشف جسمك' },
      { image: '/landing/series/posters/junior-science-in-a-minute-poster.webp', label: 'العلم في دقيقة' },
      { image: '/landing/projects/covers/junior-project-solar-oven-cover.webp', label: 'الفرن الشمسي' },
    ],
  },
  {
    key: 'stories', name: 'كوكب القصص', age: `${ltr('3–12')} سنة`, glow: 'rgba(157,104,255,.26)',
    image: '/landing/planets/planet-stories.webp', href: '/worlds/stories',
    desc: 'قصص مصورة وكوميكس وقصص صوتية وحكايات تفاعلية بلغات متعددة، بأربعة أوضاع قراءة.',
    types: ['قصص مصورة', 'كوميكس', 'صوتيات', 'قبل النوم'],
    orbit: { radius: 42, angle: 126 },
    picks: [
      { image: '/landing/books/covers/book-nature-cover.webp', label: 'في الطبيعة' },
      { image: '/landing/audio/covers/audio-bedtime-stories-cover.webp', label: 'حكايات قبل النوم' },
      { image: '/landing/books/covers/book-kindness-cover.webp', label: 'بذرة اللطف' },
    ],
  },
  {
    key: 'creativity', name: 'كوكب الإبداع', age: `${ltr('3–12')} سنة`, glow: 'rgba(200,75,255,.24)',
    image: '/landing/planets/planet-creativity.webp', href: '/worlds/creativity',
    desc: 'رسم وتلوين وبناء وصناعة أشياء بالورق والأدوات المنزلية، مع أنشطة تُصوَّر وتُشارك مع الأسرة.',
    types: ['أنشطة', 'مشروعات', 'ألعاب', 'حلقات'],
    orbit: { radius: 42, angle: 198 },
    picks: [
      { image: '/landing/series/posters/preschool-colors-around-us-poster.webp', label: 'ألوان حولنا' },
      { image: '/landing/projects/covers/junior-project-paper-bridge-cover.webp', label: 'جسر الورق' },
      { image: '/landing/activities/covers/activity-safe-experiment-cover.webp', label: 'تجربة آمنة' },
    ],
  },
  {
    key: 'skills', name: 'كوكب المهارات', age: `${ltr('5–12')} سنة`, glow: 'rgba(0,191,166,.24)',
    image: '/landing/planets/planet-maharat.webp', href: '/worlds/skills',
    desc: 'مهارات الحياة والتفكير: التنظيم، حل المشكلات، البرمجة المبدئية، والعمل على مشروع حتى النهاية.',
    types: ['تحديات', 'مشروعات', 'حلقات', 'ألعاب'],
    orbit: { radius: 23, angle: -45 },
    picks: [
      { image: '/landing/series/posters/junior-robo-codes-poster.webp', label: 'روبو والشيفرات' },
      { image: '/landing/games/junior-code-sequence-cover.webp', label: 'تسلسل الشيفرة' },
      { image: '/landing/games/junior-circuit-builder-cover.webp', label: 'باني الدوائر' },
    ],
  },
  {
    key: 'history', name: 'كوكب التاريخ', age: `${ltr('7–12')} سنة`, glow: 'rgba(217,144,61,.24)',
    image: '/landing/planets/planet-tarikh.webp', href: '/worlds/history',
    desc: 'حضارات وابتكارات وخطوط زمنية، بسرد يربط ما تعلّمه الطفل بما يراه حوله اليوم.',
    types: ['مسلسلات', 'كوميكس', 'ألعاب', 'مشروعات'],
    orbit: { radius: 23, angle: 45 },
    picks: [
      { image: '/landing/series/posters/junior-journey-civilizations-poster.webp', label: 'رحلة الحضارات' },
      { image: '/landing/books/covers/junior-civilization-innovations-cover.webp', label: 'ابتكارات الحضارات' },
      { image: '/landing/games/junior-civilizations-timeline-cover.webp', label: 'الخط الزمني' },
    ],
  },
  {
    key: 'ourworld', name: 'كوكب عالمنا', age: `${ltr('4–12')} سنة`, glow: 'rgba(37,128,255,.2)',
    image: '/landing/planets/planet-alamna.webp', href: '/worlds/our-world',
    desc: 'البيئة والحيوانات والبلدان والمجتمع، ومسؤولية الطفل تجاه ما حوله من كائنات وأماكن.',
    types: ['تعليمي', 'قصص', 'أنشطة', 'ألعاب'],
    orbit: { radius: 23, angle: 135 },
    picks: [
      { image: '/landing/series/posters/kids-explorers-adventures-poster.webp', label: 'مغامرات المستكشفين' },
      { image: '/landing/activities/covers/activity-nature-observation-cover.webp', label: 'مراقبة الطبيعة' },
      { image: '/landing/games/game-animal-memory-cover.webp', label: 'ذاكرة الحيوانات' },
    ],
  },
  {
    key: 'faith', name: 'كوكب الإيمان والآداب', age: `${ltr('3–12')} سنة`, glow: 'rgba(47,191,143,.24)',
    image: '/landing/planets/planet-iman.webp', href: '/worlds/faith',
    desc: 'قصص الأنبياء والسيرة والآداب والأذكار، بمحتوى مراجَع تُذكر مصادره على صفحة كل عمل.',
    types: ['مسلسلات', 'أناشيد', 'قصص', 'آداب'],
    orbit: { radius: 23, angle: 225 },
    picks: [
      { image: '/landing/islamic/posters/kids-prophets-stories-poster.webp', label: 'قصص الأنبياء' },
      { image: '/landing/islamic/posters/junior-seerah-journey-poster.webp', label: 'رحلة السيرة' },
      { image: '/landing/islamic/posters/preschool-adhkar-manners-prayer-poster.webp', label: 'أذكاري وآدابي' },
    ],
  },
]

/* ------------------------------------------------------------ stories plane */

export const READING_MODES: { icon: IconName; title: string; copy: string }[] = [
  { icon: 'bookPlain', title: 'اقرأ بنفسي', copy: 'نص فقط، بلا صوت، للقارئ المستقل' },
  { icon: 'headphonesTop', title: 'اقرأ لي', copy: 'الراوي يقرأ والصفحات تُقلب تلقائيًا' },
  { icon: 'lines', title: 'اقرأ معي', copy: 'إبراز الجملة أثناء القراءة لمتابعة العين' },
  { icon: 'speaker', title: 'استمع فقط', copy: 'الشاشة تهدأ والصوت يكمل الحكاية' },
]

export const STORY_FEATURES: { icon: IconName; label: string }[] = [
  { icon: 'headphonesTop', label: 'صوت مستقل لكل صفحة' },
  { icon: 'globeHalf', label: 'العربية والإنجليزية والفرنسية' },
  { icon: 'pageTurn', label: 'تقليب تلقائي للصفحات' },
  { icon: 'highlight', label: 'إبراز الجملة أثناء القراءة' },
  { icon: 'moon', label: 'قصص قبل النوم' },
  { icon: 'download', label: 'تحميل للقراءة دون إنترنت' },
  { icon: 'continuity', label: 'استكمال القراءة على جهاز آخر' },
  { icon: 'tv', label: 'عرض سينمائي تلقائي على التلفزيون' },
]

/* -------------------------------------------------------------- age tracks */

export type AgeTrack = {
  key: string
  tabLabel: string
  pill: string
  title: string
  copy: string
  specs: { icon: IconName; label: string; value: string }[]
  samples: { image: string; title: string; meta: string }[]
  accent: string
}

export const AGE_TRACKS: AgeTrack[] = [
  {
    key: 'preschool', tabLabel: `المستكشف الصغير · ${ltr('3–5')}`, pill: `${ltr('3–5')} سنوات`,
    title: 'المستكشف الصغير', accent: '#ffd34d',
    copy: 'مساحات واسعة وبطاقات كبيرة وخيارات قليلة. الطفل لا يحتاج قراءة ليتنقل، فالصوت والصورة يقودانه.',
    specs: [
      { icon: 'tvPlain', label: 'طبيعة المحتوى', value: 'حلقات قصيرة هادئة، أناشيد، قصص بسيطة عن الألوان والحروف والأرقام' },
      { icon: 'bookPlain', label: 'مستوى القراءة', value: 'ما قبل القراءة · وضع «اقرأ لي» افتراضيًا مع دعم صوتي كامل' },
      { icon: 'clock', label: 'مدة الجلسة', value: `${ltr('10–15')} دقيقة، بلا عدادات ولا سلاسل يومية تضغط الطفل` },
      { icon: 'gamepad', label: 'الألعاب', value: 'سحب وإفلات، مطابقة، تتبّع بالإصبع، بأهداف لمس كبيرة' },
      { icon: 'graduation', label: 'المهارات', value: 'التعرف على الأصوات والألوان والأشكال، والعدّ حتى 10' },
    ],
    samples: [
      { image: '/landing/series/posters/preschool-luna-discovers-words-poster.webp', title: 'لونا تكتشف الكلمات', meta: 'مسلسل · 5 دقائق' },
      { image: '/landing/series/posters/preschool-colors-around-us-poster.webp', title: 'ألوان حولنا', meta: 'مسلسل · 4 دقائق' },
      { image: '/landing/books/covers/book-arabic-letters-cover.webp', title: 'حروفي العربية', meta: 'قصة · اقرأ لي' },
      { image: '/landing/games/game-shape-matching-cover.webp', title: 'مطابقة الأشكال', meta: 'لعبة · Offline' },
    ],
  },
  {
    key: 'kids', tabLabel: `المنطلق · ${ltr('6–8')}`, pill: `${ltr('6–8')} سنوات`,
    title: 'المنطلق', accent: '#00d6f5',
    copy: 'القراءة تبدأ تستقل، والمحتوى يصبح سلاسل بحلقات متتابعة، مع تقدم ظاهر وشارات إتقان.',
    specs: [
      { icon: 'tvPlain', label: 'طبيعة المحتوى', value: 'مسلسلات مغامرة، محتوى علمي مبسط، قصص قيم وسلوك' },
      { icon: 'bookPlain', label: 'مستوى القراءة', value: 'قراءة مبكرة · وضع «اقرأ معي» مع إبراز الجملة' },
      { icon: 'clock', label: 'مدة الجلسة', value: `${ltr('15–25')} دقيقة، مع نشاط قصير بعد المحتوى` },
      { icon: 'gamepad', label: 'الألعاب', value: 'ألغاز، متاهات، ذاكرة، تحديات قراءة وحساب' },
      { icon: 'graduation', label: 'المهارات', value: 'الفهم القرائي، الجمع والطرح، الملاحظة العلمية، آداب التعامل' },
    ],
    samples: [
      { image: '/landing/series/posters/kids-explorers-adventures-poster.webp', title: 'مغامرات المستكشفين', meta: 'مسلسل · 13 دقيقة' },
      { image: '/landing/series/posters/discover-your-body-poster.webp', title: 'اكتشف جسمك', meta: 'تعليمي · 11 دقيقة' },
      { image: '/landing/books/covers/book-kindness-cover.webp', title: 'بذرة اللطف', meta: 'قصة · اقرأ معي' },
      { image: '/landing/games/game-number-maze-cover.webp', title: 'متاهة الأرقام', meta: 'لعبة · 5 دقائق' },
    ],
  },
  {
    key: 'junior', tabLabel: `المغامر · ${ltr('9–12')}`, pill: `${ltr('9–12')} سنة`,
    title: 'المغامر', accent: '#a98bff',
    copy: 'واجهة أهدأ وأكثر نضجًا، ومعلومات أعلى كثافة، ومشروعات حقيقية تُنجَز على خطوات لا مكافآت لحظية.',
    specs: [
      { icon: 'tvPlain', label: 'طبيعة المحتوى', value: 'سلاسل علمية وتاريخية، كوميكس، مشروعات، تفكير منطقي وبرمجة' },
      { icon: 'bookPlain', label: 'مستوى القراءة', value: 'قراءة مستقلة · نصوص أطول وتدرج طباعي واضح' },
      { icon: 'clock', label: 'مدة الجلسة', value: `${ltr('25–40')} دقيقة، أو جلسة مشروع تمتد على عدة أيام` },
      { icon: 'gamepad', label: 'الألعاب', value: 'تحديات منطق وبرمجة، بناء دوائر، خطوط زمنية، أدلة علمية' },
      { icon: 'graduation', label: 'المهارات', value: 'التفكير النقدي، حل المشكلات، إدارة المشروع، الكتابة والتعبير' },
    ],
    samples: [
      { image: '/landing/series/posters/junior-robo-codes-poster.webp', title: 'روبو والشيفرات', meta: 'مسلسل + لعبة' },
      { image: '/landing/series/posters/junior-journey-civilizations-poster.webp', title: 'رحلة الحضارات', meta: 'مسلسل · 10 حلقات' },
      { image: '/landing/books/covers/junior-everyday-forces-cover.webp', title: 'قوى من حولنا', meta: 'كوميكس · 26 صفحة' },
      { image: '/landing/projects/covers/junior-project-paper-bridge-cover.webp', title: 'مشروع جسر الورق', meta: 'مشروع · 4 خطوات' },
    ],
  },
]

/* ----------------------------------------------------------------- parents */

export const SAFETY_FEATURES: { icon: IconName; label: string }[] = [
  { icon: 'usersPlain', label: 'ملف منفصل لكل طفل' },
  { icon: 'shield', label: 'محتوى مناسب للعمر' },
  { icon: 'lock', label: 'رمز PIN للأهل' },
  { icon: 'clock', label: 'حدود وقت الشاشة' },
  { icon: 'plus', label: 'منع محتوى أو السماح به' },
  { icon: 'reportPlain', label: 'تقارير أسبوعية' },
  { icon: 'bars', label: 'متابعة تقدم القراءة والتعلم' },
  { icon: 'download', label: 'تحكم في التنزيلات' },
  { icon: 'continuity', label: 'إدارة الأجهزة المرتبطة' },
  { icon: 'external', label: 'وضع آمن دون روابط خارجية' },
  { icon: 'tvPlain', label: `إعلانات محدودة ومراجعة يدويًا في ${ltr('Lite')}` },
  { icon: 'check', label: 'باقة العائلة بلا إعلانات' },
]

/* ---------------------------------------------------------------- learning */

export const LEARNING_FLOW: { icon: IconName; title: string; copy: string }[] = [
  { icon: 'tvPlain', title: 'شاهد حلقة عن الفضاء', copy: 'محتوى ممتع أولًا، بلا مقدمة تعليمية ثقيلة' },
  { icon: 'bookPlain', title: 'اقرأ قصة قصيرة', copy: 'القصة تعيد الفكرة بلغة وسياق مختلفين' },
  { icon: 'gamepad', title: 'العب تحديًا', copy: 'تطبيق عملي يكشف ما فُهم وما يحتاج مراجعة' },
  { icon: 'star', title: 'احصل على نجوم', copy: 'مكافأة على الإتقان لا على زمن الشاشة' },
  { icon: 'report', title: 'يظهر التقدم في تقرير الأهل', copy: 'بصياغة مفهومة، لا أرقام بلا معنى' },
]

export const LEARNING_TAGS: { icon: IconName; label: string }[] = [
  { icon: 'graduationPlain', label: 'مهارة' },
  { icon: 'target', label: 'هدف تعليمي' },
  { icon: 'usersPlain', label: 'عمر' },
  { icon: 'bars', label: 'مستوى' },
  { icon: 'heart', label: 'قيمة' },
  { icon: 'doc', label: 'نشاط بعد المحتوى' },
]

/* ---------------------------------------------------------------- identity */

export const IDENTITY_POINTS = [
  'العربية الفصحى المبسطة في النص والصوت',
  'قصص من الثقافة العربية وبيئتها',
  'قيم وسلوكيات إيجابية داخل الحكاية',
  'محتوى إيماني مراجَع مع ذكر المصادر',
  'مراجعة متخصصة للمحتوى الديني قبل النشر',
  'تعلّم العربية للأطفال خارج الوطن العربي',
  'اختيار لغة النص ولغة الصوت بصورة مستقلة',
]

export const IDENTITY_POSTERS = [
  { image: '/landing/islamic/posters/preschool-noor-qalbi-poster.webp', alt: 'ملصق سلسلة نور قلبي', caption: `نور قلبي · ${ltr('3–5')}` },
  { image: '/landing/islamic/posters/kids-prophets-stories-poster.webp', alt: 'ملصق قصص الأنبياء', caption: `قصص الأنبياء · ${ltr('6–8')}` },
  { image: '/landing/islamic/posters/junior-seerah-journey-poster.webp', alt: 'ملصق رحلة السيرة', caption: `رحلة السيرة · ${ltr('9–12')}` },
  { image: '/landing/series/posters/hekaya-wa-hikma-poster.webp', alt: 'ملصق حكاية وحكمة', caption: 'حكاية وحكمة · قيم' },
  { image: '/landing/islamic/posters/kids-quran-treasures-poster.webp', alt: 'ملصق كنوز القرآن', caption: `كنوز القرآن · ${ltr('6–8')}` },
  { image: '/landing/islamic/posters/preschool-adhkar-manners-prayer-poster.webp', alt: 'ملصق أذكاري وآدابي', caption: `أذكاري وآدابي · ${ltr('3–5')}` },
]

/* --------------------------------------------------------------- languages */

export type LangCode = 'ar' | 'en' | 'fr'

export const LANG_SAMPLE: Record<LangCode, { dir: 'rtl' | 'ltr'; label: string; text: string }> = {
  ar: { dir: 'rtl', label: 'العربية', text: 'خرجت نُهى إلى الحديقة، ورأت نملة صغيرة تحمل حبة أكبر منها.' },
  en: { dir: 'ltr', label: 'English', text: 'Noha went out to the garden and saw a tiny ant carrying a seed bigger than itself.' },
  fr: { dir: 'ltr', label: 'Français', text: 'Noha est sortie dans le jardin et a vu une petite fourmi porter une graine plus grosse qu’elle.' },
}

/* ----------------------------------------------------------------- devices */

export const DEVICES: { icon: IconName; name: string; note: string }[] = [
  { icon: 'phone', name: 'Android', note: 'هاتف وتابلت' },
  { icon: 'phoneApple', name: 'iPhone و iPad', note: 'iOS و iPadOS' },
  { icon: 'tvWide', name: 'Android TV', note: `تنقّل ${ltr('D-pad')} كامل` },
  { icon: 'tvPlain', name: 'Apple TV', note: 'لاحقًا' },
  { icon: 'tvSmart', name: 'Smart TV', note: 'حسب الدعم' },
  { icon: 'globeHalf', name: 'Web', note: 'app.majarra.app' },
]

/* --------------------------------------------------------------- originals */

export const UNIVERSE_STEPS: { icon: IconName; title: string; note: string }[] = [
  { icon: 'tv', title: 'شاهد السلسلة', note: 'حلقات بشخصيات وعالم متكامل' },
  { icon: 'bookPlain', title: 'اقرأ القصة', note: 'كوميكس يوسّع أحداث الحلقة' },
  { icon: 'gamepad', title: 'العب اللعبة', note: 'لعبة مبنية على مهارة السلسلة' },
  { icon: 'doc', title: 'أكمل التحدي', note: 'مشروع عملي بخطوات وتقرير' },
]

/* ------------------------------------------------------------------- start */

export const START_STEPS = [
  {
    title: 'أنشئ حساب الأسرة',
    copy: 'بريد ولي الأمر ورمز PIN. الحساب ملك ولي الأمر، وكل ما يخص الدفع والموافقات والحذف يبقى في شاشته لا في جلسة الطفل.',
  },
  {
    title: 'أضف ملف طفلك وعمره واهتماماته',
    copy: 'الاسم المستعار وشهر وسنة الميلاد وبعض الاهتمامات. مجرة تحدد المسار المناسب تلقائيًا، ويمكنك تعديله في أي وقت.',
  },
  {
    title: 'ابدأ رحلة مخصصة وآمنة',
    copy: 'يفتح الطفل ملفه فيجد محتوى عمره فقط. أنت تتابع من لوحة ولي الأمر، وتضبط وقت الشاشة والتنزيلات والتقارير.',
  },
]

/* ------------------------------------------------------------------- plans */

export type BillingCycle = 'monthly' | 'yearly'
export type Currency = 'SAR' | 'AED' | 'EGP' | 'USD'

export const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: 'SAR', label: 'السعودية · ر.س', symbol: 'ر.س' },
  { code: 'AED', label: 'الإمارات · د.إ', symbol: 'د.إ' },
  { code: 'EGP', label: 'مصر · ج.م', symbol: 'ج.م' },
  { code: 'USD', label: `دولي · ${ltr('USD')}`, symbol: 'USD' },
]

export type Plan = {
  key: string
  name: string
  tagline: string
  featured?: boolean
  flag?: string
  ctaLabel: string
  ctaHref: string
  primaryCta?: boolean
  /** الباقة المجانية بلا سعر */
  price?: Record<BillingCycle, Record<Currency, number>>
  features: { label: string; off?: boolean }[]
}

export const PLANS: Plan[] = [
  {
    key: 'free', name: 'مجانية',
    tagline: 'جرّب مجرة بلا بطاقة وبلا التزام، وتعرّف على شكل المحتوى.',
    ctaLabel: 'ابدأ مجانًا', ctaHref: SIGNUP_URL,
    features: [
      { label: 'مكتبة محدودة من الحلقات والقصص' },
      { label: 'عينات من كل كوكب' },
      { label: 'ملف طفل واحد' },
      { label: 'لا تحميل للمشاهدة دون إنترنت', off: true },
      { label: 'لا تقارير تفصيلية', off: true },
    ],
  },
  {
    key: 'lite', name: 'Majarra Lite',
    tagline: 'المكتبة الأساسية كاملة عبر الإنترنت، بإعلانات آمنة ومحدودة.',
    ctaLabel: `اختر ${ltr('Lite')}`, ctaHref: `${APP_URL}/subscribe?plan=lite`,
    price: {
      monthly: { SAR: 19, AED: 19, EGP: 149, USD: 4.99 },
      yearly: { SAR: 179, AED: 179, EGP: 1399, USD: 47.99 },
    },
    features: [
      { label: `المكتبة الأساسية كاملة ${ltr('Online')}` },
      { label: 'إعلانات آمنة ومحدودة ومراجعة يدويًا' },
      { label: 'ملف طفل واحد' },
      { label: 'تقارير مبسطة' },
      { label: `لا تحميل ${ltr('Offline')}`, off: true },
    ],
  },
  {
    key: 'family', name: 'Majarra Family',
    tagline: `كل مجرة بلا إعلانات، لعدة أطفال وعدة أجهزة، مع تحميل ${ltr('Offline')}.`,
    featured: true, flag: 'الأفضل للعائلة', primaryCta: true,
    ctaLabel: 'ابدأ التجربة المجانية', ctaHref: `${APP_URL}/subscribe?plan=family`,
    price: {
      monthly: { SAR: 39, AED: 39, EGP: 299, USD: 9.99 },
      yearly: { SAR: 349, AED: 349, EGP: 2690, USD: 89.99 },
    },
    features: [
      { label: 'دون إعلانات نهائيًا' },
      { label: 'كامل المحتوى: حلقات وقصص وصوتيات وألعاب' },
      { label: `تحميل ${ltr('Offline')} للحلقات والقصص` },
      { label: 'حتى 5 ملفات أطفال' },
      { label: 'حتى 4 أجهزة، وبثّان في الوقت نفسه' },
      { label: 'تقارير متقدمة لكل طفل' },
      { label: 'جميع اللغات المتاحة نصًا وصوتًا' },
    ],
  },
]

export type CompareRow = {
  feature: string
  free: string
  lite: string
  family: string
  /** لتلوين خلايا نعم/لا */
  tone?: { free?: 'yes' | 'no'; lite?: 'yes' | 'no'; family?: 'yes' | 'no' }
}

export const COMPARE_ROWS: CompareRow[] = [
  { feature: 'حجم المكتبة', free: 'عينات', lite: 'المكتبة الأساسية', family: 'كامل المحتوى' },
  { feature: 'الإعلانات', free: 'محدودة', lite: 'محدودة ومراجعة', family: 'بدون', tone: { family: 'yes' } },
  { feature: 'ملفات الأطفال', free: '1', lite: '1', family: 'حتى 5' },
  { feature: 'الأجهزة المرتبطة', free: '1', lite: '2', family: 'حتى 4' },
  { feature: 'بثّ متزامن', free: '1', lite: '1', family: '2' },
  { feature: 'جودة الفيديو', free: 'SD', lite: 'HD', family: 'Full HD' },
  { feature: `تحميل ${ltr('Offline')}`, free: 'لا', lite: 'لا', family: 'نعم', tone: { free: 'no', lite: 'no', family: 'yes' } },
  { feature: 'القصص المصورة والكوميكس', free: 'عينات', lite: 'نعم', family: 'نعم', tone: { lite: 'yes', family: 'yes' } },
  { feature: 'القصص الصوتية', free: 'عينات', lite: 'نعم', family: 'نعم', tone: { lite: 'yes', family: 'yes' } },
  { feature: 'الألعاب والمشروعات', free: 'عينات', lite: 'جزئي', family: 'كامل', tone: { family: 'yes' } },
  { feature: 'تقارير الأهل', free: 'لا', lite: 'مبسطة', family: 'متقدمة', tone: { free: 'no', family: 'yes' } },
  { feature: 'حدود وقت الشاشة', free: 'نعم', lite: 'نعم', family: 'نعم', tone: { free: 'yes', lite: 'yes', family: 'yes' } },
  { feature: 'لغات النص والصوت', free: 'العربية', lite: 'العربية + لغة', family: 'الثلاث لغات', tone: { family: 'yes' } },
  { feature: 'دعم التلفزيون', free: 'لا', lite: 'نعم', family: 'نعم', tone: { free: 'no', lite: 'yes', family: 'yes' } },
]

/* ----------------------------------------------------------------- reviews */

export const REVIEW_METHOD: { icon: IconName; title: string; copy: string }[] = [
  {
    icon: 'doc', title: '1 · مراجعة تربوية',
    copy: 'متخصص في تعليم الطفولة يراجع الهدف التعليمي ومناسبة العمر ومستوى اللغة قبل الإنتاج.',
  },
  {
    icon: 'shield', title: '2 · مراجعة سلامة',
    copy: 'فحص المشاهد والصوت والمؤثرات: لا مشاهد مخيفة، ولا وميض سريع، ولا روابط خارجية داخل تجربة الطفل.',
  },
  {
    icon: 'graduation', title: '3 · مراجعة متخصصة للمحتوى الديني',
    copy: 'المحتوى الإيماني يمر على مراجع مختص، وتُذكر مصادره على صفحة العمل نفسها.',
  },
]

export const REVIEWS = [
  {
    tag: 'من برنامج الاختبار المبكر',
    quote: '«أول مرة ابني يقعد يقرأ من نفسه. وضع «اقرأ معي» خلاه يتابع الجملة بعينه بدل ما يستنى الصوت.»',
    avatar: '/landing/app/avatars/avatar-girl-lavender-hijab.webp',
    name: 'أم لطفلين', note: 'الرياض · 5 و 8 سنوات',
  },
  {
    tag: 'من برنامج الاختبار المبكر',
    quote: '«التقرير الأسبوعي هو اللي فرق. مش عدد ساعات، لكن يقول لي المهارة اللي محتاجة مراجعة فعلًا.»',
    avatar: '/landing/app/avatars/avatar-boy-neat-hair.webp',
    name: 'أب لثلاثة أطفال', note: 'القاهرة · 4 و 7 و 10 سنوات',
  },
  {
    tag: 'مراجعة تربوية',
    quote: '«ربط الحلقة بقصة ثم بلعبة ثم بنشاط منزلي يثبّت الفكرة أكثر من مشاهدة متكررة لنفس المحتوى.»',
    avatar: '/landing/app/avatars/avatar-girl-curly-glasses.webp',
    name: 'مراجعة تربوية', note: 'تخصص تعليم الطفولة المبكرة',
  },
]

/* --------------------------------------------------------------------- FAQ */

export const FAQ_ITEMS = [
  {
    q: 'ما الأعمار المناسبة؟',
    a: `من 3 إلى 12 سنة، موزعة على ثلاثة مسارات: ${ltr('3–5')} و ${ltr('6–8')} و ${ltr('9–12')}. تتغير الواجهة ومستوى القراءة ومدة الجلسة ونوع الألعاب مع كل مسار، ويبقى التقدم محفوظًا عند انتقال الطفل من مرحلة لأخرى.`,
  },
  {
    q: 'هل يمكن استخدام التطبيق مجانًا؟',
    a: `نعم. الباقة المجانية دائمة وتتيح مكتبة محدودة وعينات من كل كوكب وملف طفل واحد، بلا بطاقة بنكية. باقة ${ltr('Family')} لها تجربة مجانية منفصلة تنتهي تلقائيًا بلا خصم.`,
  },
  {
    q: 'هل المحتوى آمن؟',
    a: 'كل عمل يمر على مراجعة تربوية ومراجعة سلامة قبل النشر: لا مشاهد مخيفة، ولا وميض سريع، ولا روابط خارجية داخل جلسة الطفل. الشراء والموافقات والحذف تحدث في شاشة ولي الأمر فقط.',
  },
  {
    q: 'ما اللغات المتاحة؟',
    a: 'العربية والإنجليزية والفرنسية. اللغة تمتد إلى الواجهة والفيديو والقصص والصوت، ويمكن اختيار لغة النص ولغة الصوت بصورة مستقلة لكل ملف طفل.',
  },
  {
    q: 'هل يعمل دون إنترنت؟',
    a: `نعم في باقة ${ltr('Family')}: تنزيل الحلقات والقصص وبعض الألعاب للمشاهدة والقراءة دون إنترنت. التنزيلات تحت تحكم ولي الأمر، ويمكن تحديدها أو منعها لكل ملف طفل.`,
  },
  {
    q: 'كم عدد الأجهزة؟',
    a: `المجانية جهاز واحد، ${ltr('Lite')} جهازان، ${ltr('Family')} حتى أربعة أجهزة مع بثّين في الوقت نفسه. إدارة الأجهزة وإزالتها تتم من لوحة ولي الأمر.`,
  },
  {
    q: 'هل يمكن إنشاء ملف لكل طفل؟',
    a: `نعم، حتى خمسة ملفات في باقة ${ltr('Family')}. كل ملف له مسار عمري وتوصيات وتقدم ومفضلة وتقارير مستقلة، ولا تُدمج نتائج أعمار مختلفة في درجة واحدة.`,
  },
  {
    q: `ما الفرق بين ${ltr('Lite')} و ${ltr('Family')}؟`,
    a: `${ltr('Lite')} هي المكتبة الأساسية عبر الإنترنت لطفل واحد بإعلانات محدودة وتقارير مبسطة. ${ltr('Family')} بلا إعلانات، بكامل المحتوى والقصص والصوتيات والألعاب، مع تحميل ${ltr('Offline')} وعدة ملفات وأجهزة وتقارير متقدمة.`,
  },
  {
    q: 'هل توجد إعلانات؟',
    a: `في المجانية و ${ltr('Lite')} توجد إعلانات محدودة تُراجع يدويًا، ولا تستهدف الطفل سلوكيًا ولا تخرجه من التطبيق. باقة ${ltr('Family')} بلا إعلانات نهائيًا.`,
  },
  {
    q: 'كيف تعمل تقارير الأهل؟',
    a: 'تقرير أسبوعي لكل طفل يوضح ما شاهده وقرأه ولعبه، والمهارات التي أتقنها وتلك التي تحتاج مراجعة، وتقدم القراءة. الصياغة مفهومة بلا مصطلحات، ولا يُعرض ترتيب أو مقارنة بأطفال آخرين.',
  },
  {
    q: 'كيف يتم اختيار المحتوى الإيماني؟',
    a: 'يمر على مراجع مختص قبل النشر، وتُذكر مصادره على صفحة العمل. يُعرض كتصنيف داخل مجرة مثل بقية العوالم، ولا يُستخدم لقياس تدين الطفل ولا لإظهار أي «تقييم إيماني».',
  },
  {
    q: 'هل يمكن إلغاء الاشتراك؟',
    a: 'نعم من لوحة ولي الأمر في أي وقت وبخطوتين، دون مكالمة أو مراسلة. يستمر وصولك حتى نهاية المدة المدفوعة، ولا يُخصم تجديد بعدها.',
  },
  {
    q: 'هل يعمل على التلفزيون؟',
    a: `نعم على ${ltr('Android TV')} مع تنقّل ${ltr('D-pad')} كامل ونصوص أكبر وصفوف أفقية مناسبة لمسافة المشاهدة. ${ltr('Apple TV')} لاحقًا، و${ltr('Smart TV')} حسب الدعم. الاقتران يتم برمز ${ltr('QR')} أو رمز قصير من شاشة ولي الأمر.`,
  },
  {
    q: 'هل يمكن تغيير العمر أو مستوى القراءة؟',
    a: 'نعم. يمكن تعديل تاريخ الميلاد أو رفع مستوى القراءة يدويًا إن كان طفلك متقدمًا، أو تخفيضه لتجربة أهدأ. التغيير يطبَّق على التوصيات مباشرة ويحفظ التقدم السابق.',
  },
]

/* ------------------------------------------------------------------ footer */

export const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'مجرة',
    links: [
      { label: 'عن مجرة', href: '/about' },
      { label: 'رسالتنا', href: '/about#mission' },
      { label: 'فريق المراجعة', href: '/safety#review' },
      { label: 'الوظائف', href: '/about#careers' },
      { label: 'تواصل معنا', href: '/help#contact' },
    ],
  },
  {
    title: 'اكتشف',
    links: [
      { label: 'الكواكب', href: '/worlds' },
      { label: 'المسلسلات', href: '/series' },
      { label: 'القصص', href: '/stories' },
      { label: 'الألعاب', href: '/games' },
      { label: 'المحتوى الصوتي', href: '/audio' },
      { label: 'مجرة الأصلية', href: '/originals' },
    ],
  },
  {
    title: 'للأهل',
    links: [
      { label: 'الأمان', href: '/safety' },
      { label: 'التعلم', href: '/learning' },
      { label: 'التحكم الأبوي', href: '/parents' },
      { label: 'الباقات', href: '/plans' },
      { label: 'الأجهزة', href: '/devices' },
      { label: 'مركز المساعدة', href: '/help' },
    ],
  },
  {
    title: 'الشراكات',
    links: [
      { label: 'منتجو المحتوى', href: '/partners#producers' },
      { label: 'دور النشر', href: '/partners#publishers' },
      { label: 'المدارس', href: '/partners#schools' },
      { label: 'المعلّقون والمبدعون', href: '/partners#creators' },
      { label: 'الرعايات', href: '/partners#sponsorship' },
    ],
  },
  {
    title: 'قانوني',
    links: [
      { label: 'الخصوصية', href: '/legal/privacy' },
      { label: 'خصوصية الأطفال', href: '/legal/children-privacy' },
      { label: 'الشروط', href: '/legal/terms' },
      { label: 'سياسة ملفات الارتباط', href: '/legal/cookies' },
      { label: 'سياسة الإعلانات', href: '/legal/ads' },
      { label: 'طلب حذف الحساب', href: '/legal/delete-account' },
      { label: 'حقوق المحتوى', href: '/legal/content-rights' },
    ],
  },
]

export const SOCIAL_LINKS: { icon: IconName; label: string; href: string }[] = [
  { icon: 'youtube', label: 'مجرة على يوتيوب', href: '#' },
  { icon: 'instagram', label: 'مجرة على إنستغرام', href: '#' },
  { icon: 'xSocial', label: 'مجرة على إكس', href: '#' },
  { icon: 'tiktok', label: 'مجرة على تيك توك', href: '#' },
]
