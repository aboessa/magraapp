import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/home/application/home_layout.dart';
import 'package:majarra/features/home/domain/content_models.dart';
import 'package:majarra/features/home/domain/feed_blocks.dart';

/// The app must render the Home order the dashboard saved (ADMIN-002).
///
/// ## What was wrong
///
/// `home_feed.dart` emitted a fixed sequence of slivers under a comment reading
/// `=== CANONICAL V1 SUPER-APP ORDER ===`, consulting the contract only for the
/// hero and then for "remaining curated blocks". Six rows — Creative Studio,
/// Continue Drawing, Explore Majarra, New Episodes, Recently Added and
/// Recommended — were emitted unconditionally and could not be moved, retitled or
/// hidden by any configuration. `resolvedHomeProvider` fetched the configuration
/// and had no consumers at all.
///
/// These tests cover the mapping and the fallback, which is where the ordering
/// decision now lives.

ResolvedHomeBlockConfig block(
  String type, {
  String? id,
  String? title,
  String? subtitle,
  String? cardStyle,
  int? maxItems,
}) => ResolvedHomeBlockConfig(
  id: id ?? 'block-$type',
  type: type,
  title: title,
  subtitle: subtitle,
  cardStyle: cardStyle,
  maxItems: maxItems,
);

void main() {
  test('the server order is preserved exactly', () {
    final unsupported = <String>[];
    final contract = contractFromResolvedBlocks([
      block('games'),
      block('hero_slider'),
      block('continue_watching'),
      block('planet_orbit'),
    ], unsupported: unsupported);

    // Not reordered, not reprioritised: the hero is second because the dashboard
    // put it second.
    expect(contract!.blocks.map((item) => item.type).toList(), [
      BlockType.contentRail,
      BlockType.heroSlider,
      BlockType.continueJourney,
      BlockType.worldOrbit,
    ]);
    expect(unsupported, isEmpty);
  });

  test('the six formerly hardcoded rows are now configurable block types', () {
    final unsupported = <String>[];
    final contract = contractFromResolvedBlocks([
      block('creative_studio'),
      block('continue_drawing'),
      block('explore_majarra'),
      block('new_episodes'),
      block('recently_added'),
      block('recommended'),
    ], unsupported: unsupported);

    expect(
      unsupported,
      isEmpty,
      reason: 'every one must map to a real block type',
    );
    expect(contract!.blocks.map((item) => item.type).toList(), [
      BlockType.creativeStudio,
      BlockType.continueDrawing,
      BlockType.exploreMajarra,
      BlockType.newEpisodes,
      BlockType.recentlyAdded,
      BlockType.recommended,
    ]);
  });

  test('titles and subtitles come from the configuration', () {
    final contract = contractFromResolvedBlocks([
      block('games', title: 'العب الآن', subtitle: 'ألعاب مختارة', maxItems: 4),
    ], unsupported: []);
    final row = contract!.blocks.single;
    expect(row.title, 'العب الآن');
    expect(row.subtitle, 'ألعاب مختارة');
    expect(row.maxItems, 4);
  });

  test('a blank title is treated as absent so the widget default applies', () {
    final contract = contractFromResolvedBlocks([
      block('games', title: '   ', subtitle: ''),
    ], unsupported: []);
    expect(contract!.blocks.single.title, isNull);
    expect(contract.blocks.single.subtitle, isNull);
  });

  test('the card style decides what a generic rail renders', () {
    final contract = contractFromResolvedBlocks([
      block('content_rail', id: 'a', cardStyle: 'landscape'),
      // `games` and `stories` imply their style, so a configuration need not set it.
      block('games', id: 'b'),
      block('stories', id: 'c'),
      // An unspecified style falls back to portrait, matching the previous default.
      block('content_rail', id: 'd'),
    ], unsupported: []);

    expect(contract!.blocks.map((item) => item.cardStyle).toList(), [
      CardStyle.landscape,
      CardStyle.square,
      CardStyle.story,
      CardStyle.portrait,
    ]);
  });

  test('a block type this build cannot render is skipped and reported', () {
    final unsupported = <String>[];
    final contract = contractFromResolvedBlocks([
      block('hero_slider'),
      block('a_type_from_a_newer_server'),
    ], unsupported: unsupported);

    // Skipped rather than rendered as an empty row, and recorded so the gap is
    // observable instead of silent.
    expect(contract!.blocks.length, 1);
    expect(unsupported, ['a_type_from_a_newer_server']);
  });

  test(
    'a configuration with nothing renderable yields null, not an empty Home',
    () {
      final unsupported = <String>[];
      // The caller must be able to tell "no usable configuration" from "a
      // configuration with zero rows", because only the first should fall back.
      expect(contractFromResolvedBlocks([], unsupported: unsupported), isNull);
      expect(
        contractFromResolvedBlocks([
          block('unknown_type'),
        ], unsupported: unsupported),
        isNull,
      );
      expect(unsupported, ['unknown_type']);
    },
  );

  test('configured rows hide when empty, except the hero', () {
    final contract = contractFromResolvedBlocks([
      block('hero_slider'),
      block('games'),
    ], unsupported: []);
    expect(
      contract!.blocks.first.hideWhenEmpty,
      isFalse,
      reason: 'hero anchors the screen',
    );
    expect(contract.blocks.last.hideWhenEmpty, isTrue);
  });

  test('the fallback layout is non-empty and marked as a fallback', () {
    // The safe built-in Home must survive: a configuration outage cannot leave a
    // child with a blank screen.
    final newcomer = HomeFeedContract.fallback();
    final returning = HomeFeedContract.fallback(isReturning: true);
    expect(newcomer.blocks, isNotEmpty);
    expect(returning.blocks, isNotEmpty);
    // A returning child is not shown the welcome journey.
    expect(
      returning.blocks.map((item) => item.type),
      isNot(contains(BlockType.welcomeJourney)),
    );

    final layout = HomeLayout(
      contract: newcomer,
      source: HomeLayoutSource.localFallback,
    );
    expect(layout.usesFallback, isTrue);
    expect(
      HomeLayout(
        contract: newcomer,
        source: HomeLayoutSource.server,
      ).usesFallback,
      isFalse,
    );
    // The server's own fallback is also a fallback, and distinguishable from it.
    expect(
      HomeLayout(
        contract: newcomer,
        source: HomeLayoutSource.serverFallback,
      ).usesFallback,
      isTrue,
    );
  });

  test('the resolved contract is labelled so its origin is visible', () {
    final contract = contractFromResolvedBlocks([
      block('hero_slider'),
    ], unsupported: []);
    expect(contract!.version, 'home-resolved-v1');
    expect(HomeFeedContract.fallback().version, isNot('home-resolved-v1'));
  });

  test('a seasonal block needs configured copy and artwork', () {
    // Seasonal copy and artwork must describe the same configured campaign. A
    // title-only block would fall back to a generic visual and misrepresent it.
    const catalogueless = HomeBlock(id: 's', type: BlockType.seasonalBanner);
    const titled = HomeBlock(
      id: 's2',
      type: BlockType.seasonalBanner,
      title: 'موسم الشتاء',
    );
    const complete = HomeBlock(
      id: 's3',
      type: BlockType.seasonalBanner,
      title: 'موسم الشتاء',
      artworkAsset: 'assets/images/seasonal/winter.webp',
    );
    final empty = _emptyCatalog();
    expect(BlockRenderer.shouldShowBlock(catalogueless, empty), isFalse);
    expect(BlockRenderer.shouldShowBlock(titled, empty), isFalse);
    expect(BlockRenderer.shouldShowBlock(complete, empty), isTrue);
  });

  test('rows with no truthful data source stay hidden', () {
    // These are deliberate: there is no analytics or recommendation ranking to
    // render, and inventing one would be worse than an absent row.
    final empty = _emptyCatalog();
    for (final type in [
      BlockType.mostWatched,
      BlockType.becauseYouWatched,
      BlockType.learningJourney,
    ]) {
      expect(
        BlockRenderer.shouldShowBlock(HomeBlock(id: 'x', type: type), empty),
        isFalse,
        reason: '$type has no truthful source yet',
      );
    }
  });
}

/// A catalogue with no content, so a visibility rule is tested on its own terms.
HomeCatalog _emptyCatalog() => const HomeCatalog(
  planets: [],
  spotlights: [],
  series: [],
  episodes: [],
  experiences: [],
  books: [],
  stories: [],
  source: ContentSource.remote,
);
