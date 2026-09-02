import '../../../core/env/app_environment.dart';
import '../domain/content_models.dart';

abstract final class LocalCatalog {
  static const planets = <Planet>[
    Planet(
      id: 'abjad',
      name: 'كوكب أبجد',
      description: 'حروف وكلمات وحكايات عربية ممتعة',
      colorHex: '#2580FF',
      imageAsset: 'assets/images/planets/planet-abjad.webp',
    ),
    Planet(
      id: 'arqam',
      name: 'كوكب الأرقام',
      description: 'ألغاز وعدّ ومغامرات منطقية',
      colorHex: '#FFB52E',
      imageAsset: 'assets/images/planets/planet-numbers.webp',
    ),
    Planet(
      id: 'oloom',
      name: 'كوكب العلوم',
      description: 'اكتشافات وتجارب آمنة من حولنا',
      colorHex: '#32C979',
      imageAsset: 'assets/images/planets/planet-science.webp',
    ),
    Planet(
      id: 'qiyam',
      name: 'كوكب القيم',
      description: 'مواقف تساعدنا أن نختار بلطف وحكمة',
      colorHex: '#FF6FAE',
      imageAsset: 'assets/images/planets/planet-values-islamic.webp',
    ),
    Planet(
      id: 'qisas',
      name: 'كوكب القصص',
      description: 'حكايات دافئة قبل النوم وفي كل وقت',
      colorHex: '#9D68FF',
      imageAsset: 'assets/images/planets/planet-stories.webp',
    ),
    Planet(
      id: 'alam',
      name: 'عالمنا',
      description: 'نستكشف بيئتنا ومدننا وطرقنا اليومية',
      colorHex: '#6A3DF2',
      imageAsset: 'assets/images/planets/planet-alamna.webp',
    ),
    Planet(
      id: 'maharat',
      name: 'كوكب المهارات',
      description: 'اصنع وجرّب وتعلّم خطوة بخطوة',
      colorHex: '#00BFA6',
      imageAsset: 'assets/images/planets/planet-maharat.webp',
    ),
    Planet(
      id: 'tarikh',
      name: 'كوكب التاريخ',
      description: 'حضارات وأمجاد ورحلات عبر الزمن',
      colorHex: '#D9903D',
      imageAsset: 'assets/images/planets/planet-tarikh.webp',
    ),
    Planet(
      id: 'islamic',
      name: 'كوكب الإيمان',
      description: 'آداب وقيم تضيء القلب',
      colorHex: '#2FBF8F',
      imageAsset: 'assets/images/planets/planet-iman.webp',
    ),
  ];

  static const series = <SeriesItem>[
    SeriesItem(
      id: 'adventures-of-numbers',
      title: 'مغامرات الأرقام',
      description:
          'ينطلق أصدقاؤنا في رحلة مرحة لحل الألغاز واكتشاف الأعداد في كل مكان.',
      planetName: 'كوكب الأرقام',
      planetId: 'arqam',
      posterAsset:
          'assets/images/series/posters/adventures-of-numbers-poster.webp',
      bannerAsset:
          'assets/images/series/banners/adventures-of-numbers-banner.webp',
      ageMin: 5,
      ageMax: 8,
      // Counts match the `episodes` list below, one entry per bundled episode.
      //
      // These were 8 / 10 / 7 / 12 / 6 against seven bundled episodes in total —
      // 43 advertised, 7 shipped. The offline fallback is what a child sees when
      // the catalogue is unreachable, so an inflated count here is the same defect
      // as the 17 seasons in D1, just on the client. `localCatalogueCountsMatch`
      // in `test/local_catalog_counts_test.dart` fails if they drift again.
      episodesCount: 2,
      type: 'knowledge',
      isFree: true,
    ),
    SeriesItem(
      id: 'hekaya-wa-hikma',
      title: 'حكاية وحكمة',
      description:
          'قصص عربية قصيرة تفتح باب الحديث عن الصدق والتعاون والشجاعة.',
      planetName: 'كوكب القيم',
      planetId: 'qiyam',
      posterAsset: 'assets/images/series/posters/hekaya-wa-hikma-poster.webp',
      bannerAsset: 'assets/images/series/banners/hekaya-wa-hikma-banner.webp',
      ageMin: 6,
      ageMax: 10,
      episodesCount: 1,
      type: 'anthology',
      isFree: true,
    ),
    SeriesItem(
      id: 'discover-your-body',
      title: 'اكتشف جسمك',
      description:
          'رحلة علمية مبسطة نتعرف فيها إلى حواسنا وأجسامنا وعاداتنا الصحية.',
      planetName: 'كوكب العلوم',
      planetId: 'oloom',
      posterAsset:
          'assets/images/series/posters/discover-your-body-poster.webp',
      bannerAsset:
          'assets/images/series/banners/discover-your-body-banner.webp',
      ageMin: 7,
      ageMax: 12,
      episodesCount: 2,
      type: 'knowledge',
      isFree: false,
    ),
    SeriesItem(
      id: 'bedtime-stories',
      title: 'حكايات قبل النوم',
      description:
          'حكايات هادئة وصور حالمة تساعد العائلة على إنهاء اليوم بلحظة جميلة.',
      planetName: 'كوكب القصص',
      planetId: 'qisas',
      posterAsset: 'assets/images/series/posters/bedtime-stories-poster.webp',
      bannerAsset: 'assets/images/series/banners/bedtime-stories-banner.webp',
      ageMin: 3,
      ageMax: 8,
      episodesCount: 1,
      type: 'anthology',
      isFree: true,
    ),
    SeriesItem(
      id: 'try-it-at-home',
      title: 'جرّبها في البيت',
      description:
          'تجارب وأنشطة عائلية بسيطة بمواد متاحة وتعليمات واضحة وآمنة.',
      planetName: 'كوكب المهارات',
      planetId: 'maharat',
      posterAsset: 'assets/images/series/posters/try-it-at-home-poster.webp',
      bannerAsset: 'assets/images/series/banners/try-it-at-home-banner.webp',
      ageMin: 6,
      ageMax: 12,
      episodesCount: 1,
      type: 'presenter',
      isFree: false,
    ),
  ];

  /// This is the editorial home-slider source. Add, remove, or disable records
  /// here to control what can appear in the random initial slide.
  static const spotlights = <HomeSpotlight>[
    HomeSpotlight(
      id: 'numbers-journey',
      seriesId: 'adventures-of-numbers',
      eyebrow: 'اختيار اليوم • كوكب الأرقام',
      primaryActionLabel: 'ابدأ المغامرة',
    ),
    HomeSpotlight(
      id: 'wisdom-journey',
      seriesId: 'hekaya-wa-hikma',
      eyebrow: 'حكاية عائلية • كوكب القيم',
      primaryActionLabel: 'شاهد الحكاية',
    ),
    HomeSpotlight(
      id: 'body-journey',
      seriesId: 'discover-your-body',
      eyebrow: 'اكتشافات مدهشة • كوكب العلوم',
      primaryActionLabel: 'استكشف الآن',
    ),
    HomeSpotlight(
      id: 'bedtime-journey',
      seriesId: 'bedtime-stories',
      eyebrow: 'لحظة هادئة • كوكب القصص',
      primaryActionLabel: 'ابدأ الحكاية',
    ),
    HomeSpotlight(
      id: 'home-journey',
      seriesId: 'try-it-at-home',
      eyebrow: 'تجارب مع العائلة • كوكب المهارات',
      primaryActionLabel: 'جرّبها معنا',
    ),
  ];

  static const episodes = <EpisodeItem>[
    EpisodeItem(
      id: 'numbers-hidden-pattern',
      seriesId: 'adventures-of-numbers',
      title: 'النمط المختبئ',
      description: 'نبحث عن النمط ونكمل السلسلة بخطوات صغيرة.',
      seriesTitle: 'مغامرات الأرقام',
      thumbnailAsset: 'assets/images/episodes/numbers-hidden-pattern.webp',
      durationSeconds: 480,
    ),
    EpisodeItem(
      id: 'numbers-great-race',
      seriesId: 'adventures-of-numbers',
      title: 'سباق الأعداد',
      description: 'نقارن الكميات ونرتبها في مغامرة سريعة.',
      seriesTitle: 'مغامرات الأرقام',
      thumbnailAsset: 'assets/images/episodes/numbers-great-race.webp',
      durationSeconds: 540,
    ),
    EpisodeItem(
      id: 'wisdom-honest-seed',
      seriesId: 'hekaya-wa-hikma',
      title: 'البذرة الصادقة',
      description: 'حكاية عن الصدق حتى عندما يبدو الاختيار صعبًا.',
      seriesTitle: 'حكاية وحكمة',
      thumbnailAsset: 'assets/images/episodes/wisdom-honest-seed.webp',
      durationSeconds: 620,
    ),
    EpisodeItem(
      id: 'body-five-senses',
      seriesId: 'discover-your-body',
      title: 'حواسنا الخمس',
      description: 'كيف تساعدنا الحواس في فهم العالم من حولنا؟',
      seriesTitle: 'اكتشف جسمك',
      thumbnailAsset: 'assets/images/episodes/body-five-senses.webp',
      durationSeconds: 690,
    ),
    EpisodeItem(
      id: 'body-heart-beat',
      seriesId: 'discover-your-body',
      title: 'لماذا ينبض القلب؟',
      description: 'نتتبع رحلة الدم ونجرّب قياس النبض بأمان.',
      seriesTitle: 'اكتشف جسمك',
      thumbnailAsset: 'assets/images/episodes/body-heart-beat.webp',
      durationSeconds: 720,
    ),
    EpisodeItem(
      id: 'bedtime-little-star',
      seriesId: 'bedtime-stories',
      title: 'النجمة الصغيرة',
      description: 'حكاية هادئة عن الأمل ومساعدة الأصدقاء.',
      seriesTitle: 'حكايات قبل النوم',
      thumbnailAsset: 'assets/images/episodes/bedtime-little-star.webp',
      durationSeconds: 510,
    ),
    EpisodeItem(
      id: 'home-rainbow',
      seriesId: 'try-it-at-home',
      title: 'قوس قزح في كوب',
      description: 'تجربة كثافة بسيطة بإشراف أحد الوالدين.',
      seriesTitle: 'جرّبها في البيت',
      thumbnailAsset: 'assets/images/episodes/home-rainbow.webp',
      durationSeconds: 660,
    ),
  ];

  static const experiences = <ExperienceItem>[
    // Legacy core
    ExperienceItem(
      id: 'letter-tracing',
      title: 'ارسم الحرف',
      subtitle: 'حروف • 3–6 سنوات',
      imageAsset: 'assets/images/games/game-letter-tracing-cover.webp',
      planetId: 'abjad',
    ),
    ExperienceItem(
      id: 'number-maze',
      title: 'متاهة الأرقام',
      subtitle: 'منطق • 6–9 سنوات',
      imageAsset: 'assets/images/games/game-number-maze-cover.webp',
      planetId: 'arqam',
    ),
    ExperienceItem(
      id: 'animal-memory',
      title: 'ذاكرة الحيوانات',
      subtitle: 'ذاكرة • 4–8 سنوات',
      imageAsset: 'assets/images/games/game-animal-memory-cover.webp',
      planetId: 'qisas',
    ),
    ExperienceItem(
      id: 'shape-matching',
      title: 'طابق الأشكال',
      subtitle: 'أشكال • 3–6 سنوات',
      imageAsset: 'assets/images/games/game-shape-matching-cover.webp',
      planetId: 'arqam',
    ),
    ExperienceItem(
      id: 'butterfly-sequence',
      title: 'ترتيب الفراشة',
      subtitle: 'تسلسل • 5–8 سنوات',
      imageAsset: 'assets/images/games/game-butterfly-sequence-cover.webp',
      planetId: 'oloom',
    ),
    // Wave 1-3 existing (18) — mapped to server ids
    // Wave1 — each unique CDN cover via PlayVeo (no local duplicates)
    ExperienceItem(
      id: 'game-wave1-memory-animals',
      title: 'ذاكرة الحيوانات',
      subtitle: 'الذاكرة • 3–5 • 4 أزواج',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave1-memory-animals/cover.jpg',
      planetId: 'abjad',
    ),
    ExperienceItem(
      id: 'game-wave1-picture-match',
      title: 'طابق الصورة',
      subtitle: 'المطابقة • 3–5',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave1-picture-match/cover.jpg',
      planetId: 'abjad',
    ),
    ExperienceItem(
      id: 'game-wave1-color-sort',
      title: 'صنف الألوان',
      subtitle: 'التصنيف • 3–5 • سلة حمراء/زرقاء',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave1-color-sort/cover.jpg',
      planetId: 'abjad',
    ),
    ExperienceItem(
      id: 'game-wave1-count-place',
      title: 'عدّ وضع',
      subtitle: 'العدّ • 3–5 • 1-5 نجوم',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave1-count-place/cover.jpg',
      planetId: 'arqam',
    ),
    ExperienceItem(
      id: 'game-wave1-sequence-kids',
      title: 'رتب المراحل',
      subtitle: 'التسلسل • 6–8',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave1-sequence-kids/cover.jpg',
      planetId: 'oloom',
    ),
    ExperienceItem(
      id: 'game-wave1-logic-kids',
      title: 'أكمل النمط',
      subtitle: 'المنطق • 6–8 • مصفوفة 2×2',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave1-logic-kids/cover.jpg',
      planetId: 'arqam',
    ),
    ExperienceItem(
      id: 'game-wave1-word-kids',
      title: 'كوّن الكلمة',
      subtitle: 'بناء الكلمات • 6–8 • بيت',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave1-word-kids/cover.jpg',
      planetId: 'abjad',
    ),
    ExperienceItem(
      id: 'game-wave1-block-code',
      title: 'برمج الروبوت',
      subtitle: 'البرمجة • 9–12 • 4×4',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave1-block-code/cover.jpg',
      planetId: 'maharat',
    ),
    ExperienceItem(
      id: 'game-wave1-sim-lab',
      title: 'المختبر',
      subtitle: 'المختبر • 9–12 • حرارة',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave1-sim-lab/cover.jpg',
      planetId: 'oloom',
    ),
    // Wave2
    ExperienceItem(
      id: 'game-wave2-memory-2',
      title: 'ذاكرة ثانية',
      subtitle: 'الذاكرة • 6–8 • أسد/سلحفاة',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave2-memory-2/cover.jpg',
      planetId: 'qisas',
    ),
    ExperienceItem(
      id: 'game-wave2-match-2',
      title: 'مطابقة ثانية',
      subtitle: 'المطابقة • 6–8 • قمر/قوس',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave2-match-2/cover.jpg',
      planetId: 'arqam',
    ),
    ExperienceItem(
      id: 'game-wave2-sort-junior',
      title: 'صندوق التصنيف',
      subtitle: 'التصنيف • 9–12 • دائرة/نجمة',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave2-sort-junior/cover.jpg',
      planetId: 'arqam',
    ),
    ExperienceItem(
      id: 'game-wave2-count-drag',
      title: 'اسحب العدد',
      subtitle: 'العدّ • 6–8 • اسحب 4 تفاحات',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave2-count-drag/cover.jpg',
      planetId: 'arqam',
    ),
    ExperienceItem(
      id: 'game-wave2-timeline',
      title: 'خط الحضارات',
      subtitle: 'الزمن • 9–12 • الأهرام -2600',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave2-timeline/cover.jpg',
      planetId: 'tarikh',
    ),
    ExperienceItem(
      id: 'game-wave2-rhythm',
      title: 'أنشودة الإيقاع',
      subtitle: 'الإيقاع • 6–8 • lanes 2 • ترفيه',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave2-rhythm/cover.jpg',
      planetId: 'qisas',
    ),
    // Wave3
    ExperienceItem(
      id: 'game-wave3-timeline-detail',
      title: 'رحلة الحضارة',
      subtitle: 'الزمن والخريطة • 9–12 • both',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave3-timeline-detail/cover.jpg',
      planetId: 'tarikh',
    ),
    ExperienceItem(
      id: 'game-wave3-block-advanced',
      title: 'مسار متقدم',
      subtitle: 'البرمجة • 9–12 • 5×5 optimal 8',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave3-block-advanced/cover.jpg',
      planetId: 'maharat',
    ),
    ExperienceItem(
      id: 'game-wave3-sim-saturating',
      title: 'توازن الماء',
      subtitle: 'المختبر • 9–12 • تشبع • إشراف',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-wave3-sim-saturating/cover.jpg',
      planetId: 'oloom',
    ),
    // Wave 4 NEW — 18 games × 5 levels each (goal 36 total)
    ExperienceItem(
      id: 'game-match-nature-3',
      title: 'طابق الطبيعة',
      subtitle: 'المطابقة • 3–5 • 5 مستويات • قطة/طائر',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/match-nature-3/cover.jpg',
      planetId: 'abjad',
    ),
    ExperienceItem(
      id: 'game-count-nature-3',
      title: 'عدّ الطبيعة',
      subtitle: 'العدّ • 3–5 • 5 مستويات • 4 modes',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/count-nature-3/cover.jpg',
      planetId: 'arqam',
    ),
    ExperienceItem(
      id: 'game-sort-animals-3',
      title: 'صنف الحيوانات',
      subtitle: 'التصنيف • 3–5 • 5 مستويات • 3 سلال',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/sort-animals-3/cover.jpg',
      planetId: 'abjad',
    ),
    ExperienceItem(
      id: 'game-memory-shapes-3',
      title: 'ذاكرة الأشكال',
      subtitle: 'الذاكرة • 3–5 • 5 مستويات • 2×2→3×4',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/memory-shapes-3/cover.jpg',
      planetId: 'abjad',
    ),
    ExperienceItem(
      id: 'game-sequence-story-3a',
      title: 'قصة نمو',
      subtitle: 'التسلسل • 6–8 • بذرة→زهرة→فاكهة',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-sequence-story-3a/cover.jpg',
      planetId: 'oloom',
    ),
    ExperienceItem(
      id: 'game-sequence-daily-3b',
      title: 'يومي بالترتيب',
      subtitle: 'التسلسل • 3–5 • روتين الصباح',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-sequence-daily-3b/cover.jpg',
      planetId: 'oloom',
    ),
    ExperienceItem(
      id: 'game-logic-colors-3a',
      title: 'أنماط الألوان',
      subtitle: 'المنطق • 6–8 • linear→matrix 2×2',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/logic-colors-3a/cover.jpg',
      planetId: 'arqam',
    ),
    ExperienceItem(
      id: 'game-logic-sequence-3b',
      title: 'منطق التسلسل',
      subtitle: 'المنطق • 9–12 • checkerboard شرح',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-logic-sequence-3b/cover.jpg',
      planetId: 'arqam',
    ),
    ExperienceItem(
      id: 'game-block-maze-3',
      title: 'متاهة البرمجة',
      subtitle: 'البرمجة • 9–12 • 4×4→6×6 + function',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/block-maze-3/cover.jpg',
      planetId: 'maharat',
    ),
    ExperienceItem(
      id: 'game-rhythm-nature-3a',
      title: 'إيقاع الطبيعة',
      subtitle: 'الإيقاع • 6–8 • bpm 80→120 • ترفيه',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/rhythm-nature-3a/cover.jpg',
      planetId: 'qisas',
    ),
    ExperienceItem(
      id: 'game-rhythm-festive-3b',
      title: 'إيقاع الفرح',
      subtitle: 'الإيقاع • 3–5 • احتفالي',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-rhythm-festive-3b/cover.jpg',
      planetId: 'qisas',
    ),
    ExperienceItem(
      id: 'game-sim-plant-3',
      title: 'مختبر النبات',
      subtitle: 'المختبر • 9–12 • ضوء/ماء→طول',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/sim-plant-3/cover.jpg',
      planetId: 'oloom',
    ),
    ExperienceItem(
      id: 'game-timeline-egypt-3',
      title: 'خط مصر',
      subtitle: 'الزمن والخريطة • 9–12 • الأهرام→السد',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/timeline-egypt-3/cover.jpg',
      planetId: 'tarikh',
    ),
    ExperienceItem(
      id: 'game-shape-trace-3',
      title: 'تتبع الأشكال',
      subtitle: 'التتبّع • 3–5 • دائرة/مربع/مثلث/نجمة + تلوين',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/shape-trace-3/cover.jpg',
      planetId: 'abjad',
    ),
    ExperienceItem(
      id: 'game-number-trace-3',
      title: 'تتبع الأرقام',
      subtitle: 'التتبّع • 3–5 • 1,2,3,8 + توصيل',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/number-trace-3/cover.jpg',
      planetId: 'arqam',
    ),
    ExperienceItem(
      id: 'game-word-family-3a',
      title: 'عائلتي كلمات',
      subtitle: 'بناء الكلمات • 6–8 • أب/أم/بيت',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-word-family-3a/cover.jpg',
      planetId: 'abjad',
    ),
    ExperienceItem(
      id: 'game-word-animals-3b',
      title: 'حيواناتي كلمات',
      subtitle: 'بناء الكلمات • 6–8 • قط/كلب/أسد',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-word-animals-3b/cover.jpg',
      planetId: 'abjad',
    ),
    ExperienceItem(
      id: 'game-trace-color-advanced-3',
      title: 'خطي الجميل',
      subtitle: 'التتبّع • 6–8 • أ/ب + كلمة أمل',
      imageAsset: '',
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/games/game-trace-color-advanced-3/cover.jpg',
      planetId: 'abjad',
    ),
  ];

  static const books = <BookItem>[
    BookItem(
      id: 'book-qisas-p1',
      title: 'أرنوب والجزرة الذهبية',
      description: 'حكاية عن المشاركة',
      type: 'picture_book',
      ageMin: 3,
      ageMax: 5,
      posterAsset: 'assets/images/books/book-qisas-p1.webp',
    ),
    BookItem(
      id: 'book-qisas-p2',
      title: 'نجمة تنام',
      description: 'حكاية هادئة قبل النوم',
      type: 'picture_book',
      ageMin: 3,
      ageMax: 5,
      posterAsset: 'assets/images/books/book-qisas-p2.webp',
    ),
    BookItem(
      id: 'book-qisas-p3',
      title: 'صوت الغابة',
      description: 'قصة صوتية',
      type: 'audio_story',
      ageMin: 4,
      ageMax: 5,
      posterAsset: 'assets/images/books/book-qisas-p3.webp',
    ),
    BookItem(
      id: 'book-qisas-p4',
      title: 'ألوان السماء',
      description: 'ألوان',
      type: 'picture_book',
      ageMin: 3,
      ageMax: 5,
      posterAsset: 'assets/images/books/book-qisas-p4.webp',
    ),
    BookItem(
      id: 'book-qisas-k1',
      title: 'حكاية الصدق',
      description: 'قيمة الصدق',
      type: 'picture_book',
      ageMin: 6,
      ageMax: 8,
      posterAsset: 'assets/images/books/book-qisas-k1.webp',
    ),
    BookItem(
      id: 'book-qisas-k2',
      title: 'مغامرة التعاون',
      description: 'اختيارات',
      type: 'interactive',
      ageMin: 6,
      ageMax: 8,
      posterAsset: 'assets/images/books/book-qisas-k2.webp',
    ),
    BookItem(
      id: 'book-qisas-k3',
      title: 'كوميكس الفضاء',
      description: 'كوميكس',
      type: 'comic',
      ageMin: 7,
      ageMax: 8,
      posterAsset: 'assets/images/books/book-qisas-k3.webp',
    ),
    BookItem(
      id: 'book-qisas-k4',
      title: 'أنشودة الحروف',
      description: 'صوت',
      type: 'audio_story',
      ageMin: 6,
      ageMax: 7,
      posterAsset: 'assets/images/books/book-qisas-k4.webp',
    ),
    BookItem(
      id: 'book-qisas-k5',
      title: 'لغز الغابة',
      description: 'لغز',
      type: 'picture_book',
      ageMin: 6,
      ageMax: 8,
      posterAsset: 'assets/images/books/book-qisas-k5.webp',
    ),
    BookItem(
      id: 'book-qisas-k6',
      title: 'أصدقاء البحر',
      description: 'صوت',
      type: 'audio_story',
      ageMin: 6,
      ageMax: 8,
      posterAsset: 'assets/images/books/book-qisas-k6.webp',
    ),
    BookItem(
      id: 'book-qisas-k7',
      title: 'حكاية الشجاعة',
      description: 'شجاعة',
      type: 'interactive',
      ageMin: 6,
      ageMax: 8,
      posterAsset: 'assets/images/books/book-qisas-k7.webp',
    ),
    BookItem(
      id: 'book-qisas-j1',
      title: 'كوميكس الأبطال',
      description: 'أبطال',
      type: 'comic',
      ageMin: 9,
      ageMax: 12,
      posterAsset: 'assets/images/books/book-qisas-j1.webp',
    ),
    BookItem(
      id: 'book-qisas-j2',
      title: 'لغز الحضارة',
      description: 'حضارة',
      type: 'interactive',
      ageMin: 9,
      ageMax: 11,
      posterAsset: 'assets/images/books/book-qisas-j2.webp',
    ),
    BookItem(
      id: 'book-qisas-j3',
      title: 'حكاية المخترع',
      description: 'اختراع',
      type: 'picture_book',
      ageMin: 9,
      ageMax: 12,
      posterAsset: 'assets/images/books/book-qisas-j3.webp',
    ),
    BookItem(
      id: 'book-qisas-j4',
      title: 'كوميكس المستقبل',
      description: 'مستقبل',
      type: 'comic',
      ageMin: 10,
      ageMax: 12,
      posterAsset: 'assets/images/books/book-qisas-j4.webp',
    ),
    BookItem(
      id: 'book-qisas-j5',
      title: 'قصة الصوت والصدى',
      description: 'صوت',
      type: 'audio_story',
      ageMin: 9,
      ageMax: 10,
      posterAsset: 'assets/images/books/book-qisas-j5.webp',
    ),
  ];

  static const stories = <StoryItem>[
    // a-calm-tale (preschool 3-5) - 4 stories
    StoryItem(
      id: 'story-bird-home',
      title: 'بيت الطائر',
      description: 'طائر صغير يطير بعيدًا، ثم يعود إلى عشّه',
      type: 'picture_book',
      ageMin: 3,
      ageMax: 5,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/stories/act-s1-playveo/cover.jpg',
      pagesCount: 8,
    ),
    StoryItem(
      id: 'story-goodnight-toys',
      title: 'تصبح على خير يا ألعاب',
      description: 'حكاية هادئة عن ترتيب الألعاب قبل النوم',
      type: 'picture_book',
      ageMin: 3,
      ageMax: 5,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/stories/act-s2-playveo/cover.e0c31900591b2711.webp',
      pagesCount: 8,
    ),
    StoryItem(
      id: 'story-moon-sleeps',
      title: 'القمر ينام',
      description: 'آدم وأبوه يراقبان القمر الذي يستعد للنوم',
      type: 'picture_book',
      ageMin: 3,
      ageMax: 5,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/stories/act-s3-playveo/cover.7d32c7640098980a.webp',
      pagesCount: 8,
    ),
    StoryItem(
      id: 'story-warm-hugs',
      title: 'أحضان الدفء',
      description: 'نور وجدتها تبحث عن بطانيتها الدافئة',
      type: 'picture_book',
      ageMin: 3,
      ageMax: 5,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/act-s4/cover.webp',
      pagesCount: 8,
    ),
    // bedtime-stories (kids 6-8) - 6 stories
    StoryItem(
      id: 'story-ant-journey',
      title: 'رحلة النملة',
      description: 'نملة تحمل حبّة أكبر منها، وتكتشف أن الطلب ليس ضعفًا',
      type: 'picture_book',
      ageMin: 6,
      ageMax: 8,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/bs-s1/cover.webp',
      pagesCount: 12,
    ),
    StoryItem(
      id: 'story-garden-secret',
      title: 'سر الحدائق',
      description: 'بشير وجده يكتشفان كيف ينمو الزرع من الشقوق',
      type: 'picture_book',
      ageMin: 6,
      ageMax: 8,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/bs-s2/cover.webp',
      pagesCount: 12,
    ),
    StoryItem(
      id: 'story-new-friend',
      title: 'صديق جديد',
      description: 'سامي ومازن يختلفان، ثم يجدان طريقة للعب معًا',
      type: 'picture_book',
      ageMin: 6,
      ageMax: 8,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/bs-s3/cover.webp',
      pagesCount: 12,
    ),
    StoryItem(
      id: 'story-rainy-night',
      title: 'ليلة المطر',
      description: 'ليلى تسمع المطر، وأمها تعلمها كيف تعد النجوم',
      type: 'picture_book',
      ageMin: 6,
      ageMax: 8,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/bs-s4/cover.webp',
      pagesCount: 12,
    ),
    StoryItem(
      id: 'story-old-lantern',
      title: 'الفانوس القديم',
      description: 'سلمى تجد فانوساً قديماً وتتعلم أن الذكرى ليست في المعدن',
      type: 'picture_book',
      ageMin: 6,
      ageMax: 8,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/bs-s5/cover.webp',
      pagesCount: 12,
    ),
    StoryItem(
      id: 'story-lost-star',
      title: 'نجمة تائهة',
      description: 'نور ترى انعكاس نجمة في بركة وتظنها سقطت',
      type: 'picture_book',
      ageMin: 6,
      ageMax: 8,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/bs-s6/cover.webp',
      pagesCount: 12,
    ),
    // qisas-min-alhayat (junior 9-12) - 5 stories
    StoryItem(
      id: 'story-promised-friday',
      title: 'الجمعة الموعودة',
      description: 'وعدٌ قُطِع في الشتاء، وأول ريح جاءت في اليوم الخطأ',
      type: 'picture_book',
      ageMin: 9,
      ageMax: 12,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/qml-the-promised-friday/cover.webp',
      pagesCount: 18,
    ),
    StoryItem(
      id: 'story-nine-metres',
      title: 'تسعة أمتار',
      description: 'قالت رقمًا أمام صفّين، ثم جاء الشريط برقم آخر',
      type: 'picture_book',
      ageMin: 9,
      ageMax: 12,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/qml-nine-metres/cover.webp',
      pagesCount: 18,
    ),
    StoryItem(
      id: 'story-taller-than-me',
      title: 'أطول منّي',
      description: 'شريط قياس على الحائط يكشف فرقاً لم يكن متوقعاً',
      type: 'picture_book',
      ageMin: 9,
      ageMax: 12,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/qml-taller-than-me/cover.webp',
      pagesCount: 20,
    ),
    StoryItem(
      id: 'story-key-left',
      title: 'المفتاح الذي بقي',
      description: 'مهمة لا يراها أحد في مخزن المدرسة',
      type: 'picture_book',
      ageMin: 9,
      ageMax: 12,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/qml-the-key-that-was-left/cover.webp',
      pagesCount: 16,
    ),
    StoryItem(
      id: 'story-extra-page',
      title: 'الورقة الزائدة',
      description: 'حقيقة يجب أن تقال، ولكن هل الآن؟',
      type: 'picture_book',
      ageMin: 9,
      ageMax: 12,
      coverUrl:
          '${AppConfig.assetBaseUrl}/public/catalog/stories/qml-the-extra-page/cover.webp',
      pagesCount: 18,
    ),
  ];

  static const catalog = HomeCatalog(
    planets: planets,
    spotlights: spotlights,
    series: series,
    episodes: episodes,
    experiences: experiences,
    books: books,
    stories: stories,
    source: ContentSource.bundled,
  );
}
