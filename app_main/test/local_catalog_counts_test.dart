import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/home/data/local_catalog.dart';

/// The bundled fallback catalogue must not advertise content it does not carry.
///
/// ## Why this test exists
///
/// The offline catalogue is what a child sees when the API is unreachable, and its
/// five series declared 8, 10, 7, 12 and 6 episodes — 43 in total — while the file
/// shipped **seven** `EpisodeItem`s. `cinematic_hero.dart` renders that number as
/// "8 حلقات" and `series_details_page.dart` prefers the declared figure over the
/// loaded list, so the fallback promised episodes that could never open.
///
/// This is the same defect as CONTENT-003's 17 seasons, on the client instead of
/// in D1, and it needs a test rather than a one-time correction because the counts
/// are hand-written constants that nothing else keeps honest.
void main() {
  test('every bundled series declares exactly the episodes it ships', () {
    for (final series in LocalCatalog.series) {
      final actual = LocalCatalog.episodes
          .where((episode) => episode.seriesId == series.id)
          .length;
      expect(
        series.episodesCount,
        actual,
        reason:
            'series "${series.id}" declares ${series.episodesCount} episodes but '
            'the bundled catalogue contains $actual. Either add the episodes or '
            'lower the count — the offline fallback must not advertise content '
            'a child cannot open.',
      );
    }
  });

  test('the declared total matches the bundled episode list', () {
    final declared = LocalCatalog.series
        .fold<int>(0, (sum, series) => sum + series.episodesCount);
    // Bundled episodes may belong to a series that is not listed, so the declared
    // total can legitimately be lower — never higher.
    expect(declared, lessThanOrEqualTo(LocalCatalog.episodes.length));
  });

  test('a series with no bundled episodes advertises none', () {
    // Zero is what makes the UI hide the label: `cinematic_hero.dart` checks
    // `episodesCount > 0` and the details chip falls back to the loaded list.
    final withoutEpisodes = LocalCatalog.series.where((series) =>
        !LocalCatalog.episodes.any((episode) => episode.seriesId == series.id));
    for (final series in withoutEpisodes) {
      expect(series.episodesCount, 0, reason: 'series "${series.id}"');
    }
  });
}
