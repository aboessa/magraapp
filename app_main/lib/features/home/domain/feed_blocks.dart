import 'content_models.dart';

/// Dynamic Feed Blocks — the rows a Home screen can contain.
///
/// ## Why these values exist
///
/// The list below is the complete vocabulary the Home Builder can order. It grew
/// because six rows used to be emitted directly by `home_feed.dart` as fixed
/// slivers — Creative Studio, Continue Drawing, Explore Majarra, New Episodes,
/// Recently Added and Recommended — outside any contract, so no configuration
/// could move, retitle or hide them. They are block types now, which is what
/// makes the ordering in the dashboard authoritative.
///
/// Every value maps to a server `block_type` in
/// `application/home_layout.dart`; a value with no mapping cannot be configured.
enum BlockType {
  heroSlider,
  continueJourney, // تابع المشاهدة
  comingSoon, // قريباً
  watchFree, // شاهد مجاناً
  newReleases, // أعمال جديدة
  mostWatched, // الأكثر مشاهدة
  becauseYouWatched, // لأنك شاهدت
  worldOrbit,
  contentRail,
  featureBanner,
  learningJourney,
  audioRail,
  characterOrbit,
  seasonalBanner,
  welcomeJourney,
  languageRail, // مدبلج بالعربية
  tvGamesRail, // ألعاب صالحة للريموت
  creativeStudio, // استوديو الإبداع
  continueDrawing, // أكمل رسمتك
  exploreMajarra, // استكشف مجرة
  newEpisodes, // حلقات جديدة
  recentlyAdded, // جديد في مجرة
  recommended, // اخترنا لك
}

enum CardStyle { portrait, landscape, story, square, audio, hero, soon }

class HomeBlock {
  const HomeBlock({
    required this.id,
    required this.type,
    this.title,
    this.subtitle,
    this.cardStyle = CardStyle.portrait,
    this.maxItems,
    this.hideWhenEmpty = false,
    this.filters,
  });
  final String id;
  final BlockType type;
  final String? title;
  final String? subtitle;
  final CardStyle cardStyle;
  final int? maxItems;
  final bool hideWhenEmpty;
  final Map<String, dynamic>? filters;
}

class HomeFeedContract {
  const HomeFeedContract({
    required this.version,
    required this.blocks,
    this.platform = 'mobile',
    this.track = 'kids',
  });
  final String version;
  final List<HomeBlock> blocks;
  final String platform;
  final String track;

  static HomeFeedContract forNewcomer() => const HomeFeedContract(
    version: 'home-feed-v1-honest',
    track: 'kids',
    blocks: [
      HomeBlock(id: 'hero-main', type: BlockType.heroSlider, maxItems: 5),
      HomeBlock(id: 'welcome', type: BlockType.welcomeJourney, title: 'مرحبًا بك في مجرة — ابدأ من هنا', hideWhenEmpty: true),
      HomeBlock(id: 'worlds', type: BlockType.worldOrbit, title: 'الكواكب', subtitle: 'اختر عالمًا وابدأ الرحلة', hideWhenEmpty: true),
      HomeBlock(id: 'watch-free', type: BlockType.watchFree, title: 'شاهد مجاناً', subtitle: 'عناوين متاحة بدون اشتراك', cardStyle: CardStyle.portrait, hideWhenEmpty: true),
      HomeBlock(id: 'stories-short', type: BlockType.contentRail, title: 'قصص قصيرة', cardStyle: CardStyle.story, hideWhenEmpty: true),
      HomeBlock(id: 'play-learn', type: BlockType.contentRail, title: 'العب وتعلّم', subtitle: 'ألعاب منشورة ومناسبة للملف الحالي', cardStyle: CardStyle.square, hideWhenEmpty: true),
      HomeBlock(id: 'arabic-dub', type: BlockType.languageRail, title: 'مدبلج بالعربية', cardStyle: CardStyle.landscape, hideWhenEmpty: true, filters: {'audioLanguage': 'ar'}),
      HomeBlock(id: 'faith', type: BlockType.contentRail, title: 'الإيمان والآداب', cardStyle: CardStyle.portrait, hideWhenEmpty: true),
      HomeBlock(id: 'listen', type: BlockType.audioRail, title: 'استمع قبل النوم', cardStyle: CardStyle.audio, hideWhenEmpty: true),
      HomeBlock(id: 'explore-more', type: BlockType.contentRail, title: 'اكتشف المزيد', cardStyle: CardStyle.portrait, hideWhenEmpty: true),
    ],
  );

  static HomeFeedContract forReturning() => const HomeFeedContract(
    version: 'home-feed-v1-honest',
    track: 'kids',
    blocks: [
      HomeBlock(id: 'hero-main', type: BlockType.heroSlider, maxItems: 5),
      HomeBlock(id: 'continue', type: BlockType.continueJourney, title: 'استمر من حيث توقفت', hideWhenEmpty: true),
      HomeBlock(id: 'picked-for-you', type: BlockType.contentRail, title: 'مختار لك', cardStyle: CardStyle.portrait, hideWhenEmpty: true),
      HomeBlock(id: 'new-from-followed', type: BlockType.newReleases, title: 'إصدار جديد من سلسلة تتابعها', hideWhenEmpty: true),
      HomeBlock(id: 'because-you-watched', type: BlockType.becauseYouWatched, title: 'لأنك شاهدت', hideWhenEmpty: true),
      HomeBlock(id: 'learning', type: BlockType.learningJourney, title: 'رحلة التعلّم الحالية', hideWhenEmpty: true),
      HomeBlock(id: 'stories-new', type: BlockType.contentRail, title: 'قصص وكوميكس جديدة', cardStyle: CardStyle.story, hideWhenEmpty: true),
      HomeBlock(id: 'games-fit', type: BlockType.contentRail, title: 'ألعاب مناسبة', cardStyle: CardStyle.square, hideWhenEmpty: true),
      HomeBlock(id: 'lang', type: BlockType.languageRail, title: 'محتوى باللغة المناسبة', cardStyle: CardStyle.landscape, hideWhenEmpty: true),
      HomeBlock(id: 'most-watched', type: BlockType.mostWatched, title: 'الأكثر مشاهدة', hideWhenEmpty: true),
      HomeBlock(id: 'seasonal', type: BlockType.seasonalBanner, hideWhenEmpty: true),
      HomeBlock(id: 'listen-now', type: BlockType.audioRail, title: 'استمع الآن', hideWhenEmpty: true),
    ],
  );

  /// The built-in layout used when the Home Builder configuration cannot be
  /// reached.
  ///
  /// This is a real fallback, not the normal path: it exists so a configuration
  /// outage degrades to a working Home instead of a blank screen. It deliberately
  /// contains only rows that render from the catalogue the client already has.
  ///
  /// `isReturning` still selects between the two built-in variants, because a
  /// returning child should not be shown the welcome journey — but neither variant
  /// is used when the server answers.
  static HomeFeedContract fallback({bool isReturning = false}) =>
      isReturning ? forReturning() : forNewcomer();
}

class BlockRenderer {
  /// Whether a block has anything to show.
  ///
  /// A block that returns false is skipped entirely rather than rendered as an
  /// empty rail. The rows returning an unconditional `false` are the honest ones:
  /// they have no truthful data source yet, and hiding them is preferable to
  /// inventing rankings or progress.
  static bool shouldShowBlock(HomeBlock block, HomeCatalog catalog) {
    return switch (block.type) {
      BlockType.heroSlider => catalog.series.isNotEmpty,
      BlockType.worldOrbit ||
      BlockType.welcomeJourney => catalog.planets.isNotEmpty,
      BlockType.watchFree => catalog.series.any((item) => item.isFree),
      // Real progress decides visibility inside the sliver, which needs a
      // provider; the sliver renders nothing when there is no resumable item.
      BlockType.continueJourney => true,
      BlockType.comingSoon => catalog.series.isNotEmpty,
      BlockType.newReleases => catalog.series.isNotEmpty,
      // Hidden until real analytics/recommendations exist — no fake ranking.
      BlockType.mostWatched => false,
      BlockType.becauseYouWatched => false,
      BlockType.featureBanner => catalog.series.isNotEmpty,
      BlockType.learningJourney => false,
      BlockType.audioRail => catalog.books.isNotEmpty || catalog.stories.isNotEmpty,
      BlockType.characterOrbit => catalog.series.isNotEmpty,
      // Rendered only from a configured title: the card's Ramadan copy was
      // hardcoded, so without a title from the Home Builder there is nothing
      // truthful to show.
      BlockType.seasonalBanner => (block.title ?? '').isNotEmpty,
      BlockType.languageRail => catalog.episodes.isNotEmpty || catalog.series.isNotEmpty,
      BlockType.tvGamesRail => catalog.experiences.any((e) => e.isServerBacked),
      // Always available: the studio needs no catalogue content to enter.
      BlockType.creativeStudio => true,
      // Decided inside the sliver from the child's own saved drawings.
      BlockType.continueDrawing => true,
      BlockType.exploreMajarra => catalog.planets.isNotEmpty || catalog.series.isNotEmpty,
      // Two episodes was the previous threshold for the "new episodes" rail; kept
      // so a single episode does not become a rail of one.
      BlockType.newEpisodes => catalog.episodes.length >= 2,
      BlockType.recentlyAdded => catalog.series.length >= 3,
      // Decided inside the sliver from the recommendations provider.
      BlockType.recommended => true,
      BlockType.contentRail => switch (block.cardStyle) {
        CardStyle.landscape => catalog.episodes.isNotEmpty,
        CardStyle.story => catalog.stories.isNotEmpty || catalog.books.isNotEmpty,
        CardStyle.square => catalog.experiences.any((item) => item.isServerBacked),
        _ => catalog.series.isNotEmpty,
      },
    };
  }
}
