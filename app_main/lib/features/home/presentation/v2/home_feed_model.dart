import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../domain/content_models.dart';
import 'home_billboard.dart';
import 'home_v2_tokens.dart';

/// The kind of row a [HomeRow] renders as.
enum HomeRowKind { poster, wide, ranked, orb }

/// One resolved row of the v2 feed.
///
/// The v1 feed carried a `BlockType` enum with fifteen cases and a switch in the
/// widget layer, which meant adding a row meant touching the renderer. Here the
/// model already knows which card shape to use, so the renderer is a single
/// generic loop.
class HomeRow {
  const HomeRow({
    required this.id,
    required this.title,
    required this.kind,
    required this.entries,
    this.subtitle,
    this.showSeeAll = false,
  });

  final String id;
  final String title;
  final String? subtitle;
  final HomeRowKind kind;
  final List<HomeEntry> entries;
  final bool showSeeAll;
}

/// A single card's worth of data, already flattened out of the domain models so
/// the card widgets never need to know about [SeriesItem] vs [EpisodeItem].
class HomeEntry {
  const HomeEntry({
    required this.id,
    required this.title,
    required this.meta,
    required this.assetPath,
    required this.onOpenRoute,
    this.networkUrl,
    this.badge,
    this.badgeColor,
    this.progress,
    this.accent,
  });

  final String id;
  final String title;
  final String meta;
  final String assetPath;
  final String? networkUrl;

  /// Route pushed when the card is activated.
  final String onOpenRoute;
  final String? badge;
  final Color? badgeColor;
  final double? progress;
  final Color? accent;
}

/// Builds the v2 feed from a catalog.
///
/// This is deliberately a pure function of the catalog: no provider access, no
/// context. That keeps the ordering logic testable and makes it obvious that the
/// home screen does no data fetching of its own.
abstract final class HomeFeedBuilder {
  // The pseudo-random seed that used to live here was only needed to fabricate
  // continue-watching progress. Real progress now comes from
  // `GET /api/v1/family/progress`, so nothing in this builder is randomised.

  static List<BillboardItem> billboard(HomeCatalog catalog) {
    final planetColors = {
      for (final planet in catalog.planets) planet.id: planet.colorHex,
    };

    final items = <BillboardItem>[];

    // Curated spotlights come first, in editorial order.
    for (final spotlight in catalog.spotlights) {
      if (!spotlight.enabled) continue;
      final series = catalog.seriesById(spotlight.seriesId);
      if (series == null) continue;
      items.add(
        BillboardItem(
          series: series,
          accent: parsePlanetColor(planetColors[series.planetId]),
          eyebrow: spotlight.eyebrow,
          actionLabel: spotlight.primaryActionLabel,
        ),
      );
    }

    // If editorial data is missing, fall back to the catalog so the screen is
    // never headless.
    if (items.isEmpty) {
      for (final series in catalog.series.take(5)) {
        items.add(
          BillboardItem(
            series: series,
            accent: parsePlanetColor(planetColors[series.planetId]),
            eyebrow: series.planetName,
            actionLabel: 'شاهد الآن',
          ),
        );
      }
    }

    return items.take(6).toList(growable: false);
  }

  /// Builds the feed rows.
  ///
  /// [progress] maps a content id to its saved watch fraction, supplied by the
  /// caller from `GET /api/v1/family/progress`. Passing it in keeps this a pure
  /// function; an empty map simply omits the continue-watching row.
  static List<HomeRow> rows(
    HomeCatalog catalog, {
    Map<String, double> progress = const {},
  }) {
    final rows = <HomeRow>[];

    // 1. Continue watching. Placed above everything else because a returning
    //    user's most likely intent is resuming, not browsing.
    //
    //    Only episodes the child has genuinely started appear here. The row used
    //    to show the first six catalogue episodes with a fabricated progress bar
    //    (`0.2 + random`), which told the user they had watched things they had
    //    not. With no saved progress the row is omitted entirely.
    final resumable = catalog.episodes
        .where((episode) => progress.containsKey(episode.id))
        .toList();
    if (resumable.isNotEmpty) {
      rows.add(
        HomeRow(
          id: 'continue',
          title: 'تابع المشاهدة',
          subtitle: 'أكمل من حيث توقفت',
          kind: HomeRowKind.wide,
          entries: [
            for (final episode in resumable)
              HomeEntry(
                id: episode.id,
                title: episode.title,
                meta: '${episode.seriesTitle} • ${episode.durationLabel}',
                assetPath: episode.thumbnailAsset,
                networkUrl: episode.thumbnailUrl,
                onOpenRoute: '/playback/${episode.id}',
                progress: progress[episode.id],
              ),
          ],
        ),
      );
    }

    // 2. Planets. The brand's primary navigation metaphor, kept high.
    if (catalog.planets.isNotEmpty) {
      rows.add(
        HomeRow(
          id: 'planets',
          title: 'الكواكب',
          subtitle: 'اختر عالمًا وابدأ الرحلة',
          kind: HomeRowKind.orb,
          showSeeAll: true,
          entries: [
            for (final planet in catalog.planets)
              HomeEntry(
                id: planet.id,
                title: planet.name,
                meta: planet.description,
                assetPath: planet.imageAsset,
                accent: parsePlanetColor(planet.colorHex),
                onOpenRoute: '/planets?planetId=${planet.id}',
              ),
          ],
        ),
      );
    }

    // 3. Top 10. Ranked rows are the single highest-engagement row type on
    //    every major platform, so it sits before generic browse rows.
    final ranked = catalog.series.take(10).toList();
    if (ranked.length >= 3) {
      rows.add(
        HomeRow(
          id: 'top10',
          title: 'الأكثر مشاهدة هذا الأسبوع',
          kind: HomeRowKind.ranked,
          entries: [
            for (final series in ranked)
              HomeEntry(
                id: series.id,
                title: series.title,
                meta: series.ageLabel,
                assetPath: series.posterAsset,
                networkUrl: series.coverUrl,
                onOpenRoute: '/series/${series.id}',
              ),
          ],
        ),
      );
    }

    // 4. Free to watch. Conversion-relevant and honest: only genuinely free
    //    titles appear, so the row is empty rather than padded if none are.
    final free = catalog.series.where((item) => item.isFree).toList();
    if (free.isNotEmpty) {
      rows.add(
        HomeRow(
          id: 'free',
          title: 'شاهد مجانًا',
          subtitle: 'بدون اشتراك',
          kind: HomeRowKind.poster,
          entries: _seriesEntries(free, badge: 'مجاني'),
        ),
      );
    }

    // 5. Per-planet browse rows. Generated from the catalog rather than
    //    hardcoded, so a new planet adds a row with no code change.
    for (final planet in catalog.planets) {
      final planetSeries = catalog.seriesForPlanet(planet);
      if (planetSeries.length < 2) continue;
      rows.add(
        HomeRow(
          id: 'planet-${planet.id}',
          title: planet.name,
          subtitle: planet.description,
          kind: HomeRowKind.poster,
          showSeeAll: true,
          entries: _seriesEntries(planetSeries),
        ),
      );
    }

    // 6. Stories, then games. Reading and play close the feed because they are
    //    session-extenders rather than entry points.
    if (catalog.books.isNotEmpty) {
      rows.add(
        HomeRow(
          id: 'books',
          title: 'اقرأ واستمع',
          subtitle: 'قصص مصورة وحكايات صوتية',
          kind: HomeRowKind.poster,
          entries: [
            for (final book in catalog.books)
              HomeEntry(
                id: book.id,
                title: book.title,
                meta: '${_bookTypeLabel(book.type)} • ${book.ageLabel}',
                assetPath: book.posterAsset,
                networkUrl: book.coverUrl,
                // Audio stories open the narration player; everything else opens
                // the reader. Routing both to `/reader` meant an audio story
                // rendered as a silent page turner.
                onOpenRoute: book.type == 'audio_story'
                    ? '/audio?bookId=${book.id}'
                    : '/reader/${book.id}',
              ),
          ],
        ),
      );
    }

    if (catalog.experiences.isNotEmpty) {
      rows.add(
        HomeRow(
          id: 'games',
          title: 'العب وتعلّم',
          subtitle: 'تحديات قصيرة تثبّت المهارة',
          kind: HomeRowKind.poster,
          entries: [
            for (final experience in catalog.experiences)
              HomeEntry(
                id: experience.id,
                title: experience.title,
                meta: experience.subtitle,
                assetPath: experience.imageAsset,
                onOpenRoute: '/game/${experience.id}',
              ),
          ],
        ),
      );
    }

    return rows;
  }

  static List<HomeEntry> _seriesEntries(
    List<SeriesItem> items, {
    String? badge,
  }) {
    return [
      for (final series in items)
        HomeEntry(
          id: series.id,
          title: series.title,
          meta: '${series.ageLabel} • ${series.episodesCount} حلقة',
          assetPath: series.posterAsset,
          networkUrl: series.coverUrl,
          badge: badge,
          badgeColor: badge == null ? null : AppColors.success,
          onOpenRoute: '/series/${series.id}',
        ),
    ];
  }

  static String _bookTypeLabel(String type) => switch (type) {
    'comic' => 'كوميكس',
    'audio_story' => 'قصة صوتية',
    'interactive' => 'تفاعلية',
    _ => 'قصة مصورة',
  };
}
