import '../domain/feed_blocks.dart';

/// Turns the server's resolved Home configuration into a [HomeFeedContract].
///
/// ## Why this file exists
///
/// The Home screen was assembled twice and neither copy came from the server. A
/// `HomeFeedContract.forNewcomer()` / `forReturning()` pair listed rows in code,
/// and `home_feed.dart` then ignored that order and emitted its own hardcoded
/// sequence of slivers under a comment reading `=== CANONICAL V1 SUPER-APP ORDER
/// ===`. Meanwhile `resolvedHomeProvider` fetched `/api/v1/home/resolved` and had
/// **no consumers**, so the Home Builder in the dashboard wrote configuration
/// that nothing read.
///
/// The mapping lives here rather than in the widget so it can be tested without
/// pumping a frame, and so the widget has exactly one source of order.
class ResolvedHomeBlockConfig {
  const ResolvedHomeBlockConfig({
    required this.id,
    required this.type,
    this.title,
    this.subtitle,
    this.cardStyle,
    this.maxItems,
    this.artworkAsset,
    this.isSystem = false,
  });

  final String id;
  final String type;
  final String? title;
  final String? subtitle;
  final String? cardStyle;
  final int? maxItems;
  final String? artworkAsset;
  final bool isSystem;
}

/// A server `block_type` paired with the card style it implies, when the type
/// alone does not determine the layout.
class _Mapping {
  const _Mapping(this.type, [this.cardStyle]);
  final BlockType type;
  final CardStyle? cardStyle;
}

/// The server `block_type` values this client can render.
///
/// The table's CHECK constraint accepts 25 types. A type absent from this map is
/// one the app has no widget for; it is **skipped** rather than rendered as an
/// empty row, and [HomeLayout.unsupportedTypes] reports it so the gap is
/// observable instead of silent.
const Map<String, _Mapping> _blockTypeMap = {
  'hero_slider': _Mapping(BlockType.heroSlider),
  'planet_orbit': _Mapping(BlockType.worldOrbit),
  'welcome': _Mapping(BlockType.welcomeJourney),
  'coming_soon': _Mapping(BlockType.comingSoon),
  'watch_free': _Mapping(BlockType.watchFree),
  'new_releases': _Mapping(BlockType.newReleases),
  'most_watched': _Mapping(BlockType.mostWatched),
  'because_you_watched': _Mapping(BlockType.becauseYouWatched),
  'feature_banner': _Mapping(BlockType.featureBanner),
  'learning_journey': _Mapping(BlockType.learningJourney),
  'character_orbit': _Mapping(BlockType.characterOrbit),
  'seasonal_banner': _Mapping(BlockType.seasonalBanner),
  'seasonal': _Mapping(BlockType.seasonalBanner),
  'audio_rail': _Mapping(BlockType.audioRail),
  'audio': _Mapping(BlockType.audioRail),
  'continue_watching': _Mapping(BlockType.continueJourney),
  'continue_drawing': _Mapping(BlockType.continueDrawing),
  'creative_studio': _Mapping(BlockType.creativeStudio),
  'explore_majarra': _Mapping(BlockType.exploreMajarra),
  'new_episodes': _Mapping(BlockType.newEpisodes),
  'recently_added': _Mapping(BlockType.recentlyAdded),
  'recommended': _Mapping(BlockType.recommended),
  // The generic rail's meaning comes from its card style, which the server sends
  // in `config.card_style`.
  'content_rail': _Mapping(BlockType.contentRail),
  'games': _Mapping(BlockType.contentRail, CardStyle.square),
  'stories': _Mapping(BlockType.contentRail, CardStyle.story),
};

CardStyle? _cardStyleFromName(String? name) => switch (name) {
  'portrait' => CardStyle.portrait,
  'landscape' => CardStyle.landscape,
  'story' => CardStyle.story,
  'square' => CardStyle.square,
  'audio' => CardStyle.audio,
  'hero' => CardStyle.hero,
  'soon' => CardStyle.soon,
  _ => null,
};

/// The Home layout the app will render, and where it came from.
class HomeLayout {
  const HomeLayout({
    required this.contract,
    required this.source,
    this.unsupportedTypes = const [],
  });

  final HomeFeedContract contract;

  /// Whether the order came from the server or from the built-in fallback.
  ///
  /// Carried so the UI can be honest about which it is showing. A configured Home
  /// and a fallback Home are different states, and the previous
  /// `/home/resolved` handler made them indistinguishable by returning hardcoded
  /// blocks inside a success envelope after a failed query.
  final HomeLayoutSource source;

  /// Server block types this build has no widget for.
  final List<String> unsupportedTypes;

  bool get usesFallback => source != HomeLayoutSource.server;
}

enum HomeLayoutSource {
  /// Resolved from the Home Builder configuration.
  server,

  /// The server reported that it is serving its own fallback, or returned nothing
  /// this client can render.
  serverFallback,

  /// The request failed, or produced no usable blocks.
  localFallback,
}

/// Builds a contract from resolved blocks, preserving the server's order.
///
/// Returns `null` when no block maps to something renderable, so the caller can
/// fall back rather than show an empty Home.
HomeFeedContract? contractFromResolvedBlocks(
  List<ResolvedHomeBlockConfig> blocks, {
  required List<String> unsupported,
}) {
  final mapped = <HomeBlock>[];
  for (final block in blocks) {
    final mapping = _blockTypeMap[block.type];
    if (mapping == null) {
      if (!unsupported.contains(block.type)) unsupported.add(block.type);
      continue;
    }
    mapped.add(
      HomeBlock(
        id: block.id,
        type: mapping.type,
        title: (block.title?.trim().isEmpty ?? true)
            ? null
            : block.title!.trim(),
        subtitle: (block.subtitle?.trim().isEmpty ?? true)
            ? null
            : block.subtitle!.trim(),
        // An explicit card style from config wins; otherwise the block type's own
        // style applies; otherwise portrait, matching the previous default.
        cardStyle:
            _cardStyleFromName(block.cardStyle) ??
            mapping.cardStyle ??
            CardStyle.portrait,
        maxItems: block.maxItems,
        artworkAsset: (block.artworkAsset?.trim().isEmpty ?? true)
            ? null
            : block.artworkAsset!.trim(),
        // Server-configured rows hide when they have no content rather than
        // rendering an empty rail. The hero is the exception: it is the screen's
        // anchor and its own visibility rule already covers the empty case.
        hideWhenEmpty: mapping.type != BlockType.heroSlider,
      ),
    );
  }
  if (mapped.isEmpty) return null;
  return HomeFeedContract(version: 'home-resolved-v1', blocks: mapped);
}
