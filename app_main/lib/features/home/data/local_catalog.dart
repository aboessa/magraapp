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
      id: 'ibdaa',
      name: 'كوكب الإبداع',
      description: 'ألوان وألحان وخيال بلا حدود',
      colorHex: '#6A3DF2',
      imageAsset: 'assets/images/planets/planet-creativity.webp',
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
      id: 'iman',
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
      episodesCount: 8,
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
      episodesCount: 10,
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
      episodesCount: 7,
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
      episodesCount: 12,
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
      bannerAsset: 'assets/images/landing/landing-family-learning-scene.webp',
      ageMin: 6,
      ageMax: 12,
      episodesCount: 6,
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
  ];

  static const books = <BookItem>[
    BookItem(id: 'book-qisas-p1', title: 'أرنوب والجزرة الذهبية', description: 'حكاية عن المشاركة', type: 'picture_book', ageMin: 3, ageMax: 5, posterAsset: 'assets/images/series/posters/bedtime-stories-poster.webp'),
    BookItem(id: 'book-qisas-p2', title: 'نجمة تنام', description: 'حكاية هادئة قبل النوم', type: 'picture_book', ageMin: 3, ageMax: 5, posterAsset: 'assets/images/series/posters/bedtime-stories-poster.webp'),
    BookItem(id: 'book-qisas-p3', title: 'صوت الغابة', description: 'قصة صوتية', type: 'audio_story', ageMin: 4, ageMax: 5, posterAsset: 'assets/images/series/posters/bedtime-stories-poster.webp'),
    BookItem(id: 'book-qisas-p4', title: 'ألوان السماء', description: 'ألوان', type: 'picture_book', ageMin: 3, ageMax: 5, posterAsset: 'assets/images/series/posters/bedtime-stories-poster.webp'),
    BookItem(id: 'book-qisas-k1', title: 'حكاية الصدق', description: 'قيمة الصدق', type: 'picture_book', ageMin: 6, ageMax: 8, posterAsset: 'assets/images/series/posters/hekaya-wa-hikma-poster.webp'),
    BookItem(id: 'book-qisas-k2', title: 'مغامرة التعاون', description: 'اختيارات', type: 'interactive', ageMin: 6, ageMax: 8, posterAsset: 'assets/images/series/posters/hekaya-wa-hikma-poster.webp'),
    BookItem(id: 'book-qisas-k3', title: 'كوميكس الفضاء', description: 'كوميكس', type: 'comic', ageMin: 7, ageMax: 8, posterAsset: 'assets/images/series/posters/hekaya-wa-hikma-poster.webp'),
    BookItem(id: 'book-qisas-k4', title: 'أنشودة الحروف', description: 'صوت', type: 'audio_story', ageMin: 6, ageMax: 7, posterAsset: 'assets/images/series/posters/hekaya-wa-hikma-poster.webp'),
    BookItem(id: 'book-qisas-k5', title: 'لغز الغابة', description: 'لغز', type: 'picture_book', ageMin: 6, ageMax: 8, posterAsset: 'assets/images/series/posters/hekaya-wa-hikma-poster.webp'),
    BookItem(id: 'book-qisas-k6', title: 'أصدقاء البحر', description: 'صوت', type: 'audio_story', ageMin: 6, ageMax: 8, posterAsset: 'assets/images/series/posters/bedtime-stories-poster.webp'),
    BookItem(id: 'book-qisas-k7', title: 'حكاية الشجاعة', description: 'شجاعة', type: 'interactive', ageMin: 6, ageMax: 8, posterAsset: 'assets/images/series/posters/hekaya-wa-hikma-poster.webp'),
    BookItem(id: 'book-qisas-j1', title: 'كوميكس الأبطال', description: 'أبطال', type: 'comic', ageMin: 9, ageMax: 12, posterAsset: 'assets/images/series/posters/discover-your-body-poster.webp'),
    BookItem(id: 'book-qisas-j2', title: 'لغز الحضارة', description: 'حضارة', type: 'interactive', ageMin: 9, ageMax: 11, posterAsset: 'assets/images/series/posters/discover-your-body-poster.webp'),
    BookItem(id: 'book-qisas-j3', title: 'حكاية المخترع', description: 'اختراع', type: 'picture_book', ageMin: 9, ageMax: 12, posterAsset: 'assets/images/series/posters/discover-your-body-poster.webp'),
    BookItem(id: 'book-qisas-j4', title: 'كوميكس المستقبل', description: 'مستقبل', type: 'comic', ageMin: 10, ageMax: 12, posterAsset: 'assets/images/series/posters/discover-your-body-poster.webp'),
    BookItem(id: 'book-qisas-j5', title: 'قصة الصوت والصدى', description: 'صوت', type: 'audio_story', ageMin: 9, ageMax: 10, posterAsset: 'assets/images/series/posters/discover-your-body-poster.webp'),
  ];

  static const catalog = HomeCatalog(
    planets: planets,
    spotlights: spotlights,
    series: series,
    episodes: episodes,
    experiences: experiences,
    books: books,
    source: ContentSource.local,
  );
}
