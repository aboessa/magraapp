import 'content_models.dart';

/// Dynamic Feed Blocks - MAJARRA_CINEMATIC_STREAMING_UX_PLAN.md:205
/// Long feed of 12+ rails so the library feels continuous.
enum BlockType {
  heroSlider,
  continueJourney, // تابع المشاهدة
  comingSoon,      // قريباً
  watchFree,       // شاهد مجاناً
  newReleases,     // أعمال جديدة
  mostWatched,     // الأكثر مشاهدة
  becauseYouWatched, // لأنك شاهدت
  worldOrbit,
  contentRail,
  featureBanner,
  learningJourney,
  audioRail,
  characterOrbit,
  seasonalBanner,
  welcomeJourney,
}

enum CardStyle { portrait, landscape, story, square, audio, hero, soon }

class HomeBlock {
  const HomeBlock({required this.id, required this.type, this.title, this.subtitle, this.cardStyle = CardStyle.portrait, this.maxItems, this.hideWhenEmpty = false, this.filters});
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
  const HomeFeedContract({required this.version, required this.blocks, this.platform = 'mobile', this.track = 'kids'});
  final String version;
  final List<HomeBlock> blocks;
  final String platform;
  final String track;

  // مستخدم جديد: Hero -> الكواكب مباشرة تحت السلايدر (كما في الصورة) -> باقي المحتوى
  static HomeFeedContract forNewcomer() => const HomeFeedContract(
        version: 'home-feed-v1',
        track: 'kids',
        blocks: [
          HomeBlock(id: 'hero-main', type: BlockType.heroSlider, maxItems: 5),
          HomeBlock(id: 'worlds', type: BlockType.worldOrbit, title: 'الكواكب', subtitle: 'اختر عالمًا، ثم شاهد سلاسله وحلقاته وأنشطته'),
          HomeBlock(id: 'welcome', type: BlockType.welcomeJourney, title: 'مرحبًا بك في مجرة — ابدأ من هنا', subtitle: 'اختر كوكبك وانطلق'),
          HomeBlock(id: 'coming-soon', type: BlockType.comingSoon, title: 'قريباً في مجرة', subtitle: 'لا تفوت العروض القادمة', cardStyle: CardStyle.soon),
          HomeBlock(id: 'watch-free', type: BlockType.watchFree, title: 'شاهد مجاناً', subtitle: 'استمتع بدون اشتراك', cardStyle: CardStyle.portrait),
          HomeBlock(id: 'new-releases', type: BlockType.newReleases, title: 'أعمال جديدة', subtitle: 'أضيف مؤخراً', cardStyle: CardStyle.portrait),
          HomeBlock(id: 'most-watched', type: BlockType.mostWatched, title: 'الأكثر مشاهدة', subtitle: 'الأكثر حباً هذا الأسبوع', cardStyle: CardStyle.portrait),
          HomeBlock(id: 'feature-week', type: BlockType.featureBanner, title: 'حملة الأسبوع'),
          HomeBlock(id: 'arabic-dub', type: BlockType.contentRail, title: 'مدبلج بالعربية', cardStyle: CardStyle.landscape),
          HomeBlock(id: 'stories', type: BlockType.contentRail, title: 'قصص قصيرة', cardStyle: CardStyle.story),
          HomeBlock(id: 'games', type: BlockType.contentRail, title: 'العب وتعلّم', cardStyle: CardStyle.square),
          HomeBlock(id: 'characters', type: BlockType.characterOrbit, title: 'شخصيات محبوبة'),
          HomeBlock(id: 'seasonal', type: BlockType.seasonalBanner, title: 'محتوى موسمي'),
        ],
      );

  // عائد: تابع -> الكواكب مباشرة تحت السلايدر -> باقي التوصيات
  static HomeFeedContract forReturning() => const HomeFeedContract(
        version: 'home-feed-v1',
        track: 'kids',
        blocks: [
          HomeBlock(id: 'hero-main', type: BlockType.heroSlider, maxItems: 5),
          HomeBlock(id: 'continue', type: BlockType.continueJourney, title: 'تابع المشاهدة', subtitle: 'أكمل من حيث توقفت', hideWhenEmpty: false),
          HomeBlock(id: 'worlds', type: BlockType.worldOrbit, title: 'الكواكب', subtitle: 'اختر عالمًا'),
          HomeBlock(id: 'because', type: BlockType.becauseYouWatched, title: 'لأنك شاهدت مغامرات الأرقام', subtitle: 'قد يعجبك أيضاً', cardStyle: CardStyle.portrait),
          HomeBlock(id: 'coming-soon', type: BlockType.comingSoon, title: 'قريباً', subtitle: 'قادم هذا الشهر', cardStyle: CardStyle.soon),
          HomeBlock(id: 'watch-free', type: BlockType.watchFree, title: 'شاهد مجاناً', subtitle: 'مفتوح للجميع', cardStyle: CardStyle.portrait),
          HomeBlock(id: 'new-releases', type: BlockType.newReleases, title: 'أعمال جديدة', subtitle: 'وصل حديثاً', cardStyle: CardStyle.portrait),
          HomeBlock(id: 'most-watched', type: BlockType.mostWatched, title: 'الأكثر مشاهدة', subtitle: 'يتصدر المشاهدات', cardStyle: CardStyle.portrait),
          HomeBlock(id: 'feature-week', type: BlockType.featureBanner, title: 'حملة الأسبوع'),
          HomeBlock(id: 'learning', type: BlockType.learningJourney, title: 'رحلتك التعليمية', subtitle: 'خطوة جديدة'),
          HomeBlock(id: 'audio-now', type: BlockType.audioRail, title: 'استمع الآن', cardStyle: CardStyle.audio),
          HomeBlock(id: 'characters', type: BlockType.characterOrbit, title: 'شخصيات محبوبة'),
          HomeBlock(id: 'seasonal', type: BlockType.seasonalBanner, title: 'محتوى موسمي'),
        ],
      );

  static HomeFeedContract fallback() => forNewcomer();
}

class BlockRenderer {
  static bool shouldShowBlock(HomeBlock block, HomeCatalog catalog) {
    if (block.hideWhenEmpty && block.type == BlockType.continueJourney) return false;
    if (block.hideWhenEmpty && block.type == BlockType.learningJourney) return false;
    return true;
  }
}
