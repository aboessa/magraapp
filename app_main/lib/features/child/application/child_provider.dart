import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/auth_guard.dart';
import '../../home/application/home_providers.dart';
import '../../home/data/local_catalog.dart';
import '../../home/domain/content_models.dart';

class ChildState {
  const ChildState({
    this.activeChildId,
    this.ageTrack,
    this.displayName,
    this.interests = const [],
    this.language,
    this.onboardingCompletedAt,
  });
  final String? activeChildId;
  final String? ageTrack; // preschool/kids/junior

  /// Name shown by the profile chooser for the active selection.
  ///
  /// Held here so the parent area can name the profile the user actually picked
  /// instead of keeping its own separate list. The profile source itself is
  /// still the on-device demo list until the family endpoint is wired.
  final String? displayName;

  /// The closed interest list the active child picked in
  /// `ChildProfileFormPage` (Requirement 10.6) — surfaced here so later
  /// content-recommendation surfaces can read it without a second fetch.
  final List<String> interests;

  /// The active child's content language, e.g. `'ar'`.
  final String? language;

  /// When the onboarding journey (a later task in this spec) was completed
  /// for this child profile. `null` means it has not been completed yet.
  final DateTime? onboardingCompletedAt;

  bool get hasSelection => activeChildId != null && ageTrack != null;

  /// Arabic label for the resolved age track.
  String get trackLabel => switch (ageTrack) {
    'preschool' => 'البراعم · 3–5 سنوات',
    'kids' => 'المستكشفون · 6–8 سنوات',
    'junior' => 'الروّاد · 9–12 سنة',
    _ => 'غير محدد',
  };
}

class ChildNotifier extends StateNotifier<ChildState> {
  ChildNotifier() : super(const ChildState());

  /// Explicit demo selection — used by the login page's guest button.

  void selectChild({
    required String childId,
    required String ageTrack,
    String? displayName,
    List<String> interests = const [],
    String? language,
    DateTime? onboardingCompletedAt,
  }) {
    state = ChildState(
      activeChildId: childId,
      ageTrack: ageTrack,
      displayName: displayName,
      interests: interests,
      language: language,
      onboardingCompletedAt: onboardingCompletedAt,
    );
  }

  void selectDemoChild() {
    selectChild(
      childId: 'demo-child',
      ageTrack: 'preschool',
      displayName: 'الضيف',
    );
  }

  void clear() => state = const ChildState();
}

void syncAuthGuardWithChild(ChildState child, AuthGuard guard) {
  guard.setHasChild(child.hasSelection);
}

final childProvider = StateNotifierProvider<ChildNotifier, ChildState>(
  (ref) => ChildNotifier(),
);

final filteredCatalogProvider = Provider<AsyncValue<HomeCatalog>>((ref) {
  final child = ref.watch(childProvider);
  final guard = ref.read(authGuardProvider);
  // The guest session has no family credentials and must remain useful even
  // when the public CMS currently has no titles published for ages 3–5. Its
  // packaged catalogue is deliberately isolated from real-account content.
  final catalogAsync = guard.isDemo && child.activeChildId == 'demo-child'
      ? const AsyncValue<HomeCatalog>.data(LocalCatalog.catalog)
      : ref.watch(homeCatalogProvider);
  return catalogAsync.whenData((catalog) {
    if (child.ageTrack == null) return catalog;

    // Demo child (ليلى تجريبي) should see hero even if age filter is strict.
    // Preserve hero by keeping spotlights if filtering would empty series.
    final isDemoPreschool = guard.isDemo && child.activeChildId == 'demo-child';

    bool matchesAge(int ageMin, int ageMax) {
      if (isDemoPreschool) {
        // Demo: more permissive – show 3-8 for preschool demo to include hero content
        if (ageMax < 3 || ageMin > 8) return false;
        return true;
      }
      if (child.ageTrack == 'preschool' && ageMin > 5) return false;
      if (child.ageTrack == 'kids' && (ageMax < 6 || ageMin > 8)) return false;
      if (child.ageTrack == 'junior' && ageMax < 9) return false;
      return true;
    }

    bool matchesSeries(SeriesItem series) => matchesAge(series.ageMin, series.ageMax);

    final filteredSeries = catalog.series.where(matchesSeries).toList();

    // If filtering would empty hero, keep at least 3 series for hero visibility (demo safeguard)
    final effectiveSeries = filteredSeries.isEmpty && isDemoPreschool
        ? catalog.series.take(3).toList()
        : filteredSeries;

    List<HomeSpotlight> effectiveSpotlights;
    if (isDemoPreschool && catalog.series.isNotEmpty && filteredSeries.isEmpty) {
      effectiveSpotlights = catalog.spotlights;
    } else {
      final matched = catalog.spotlights
          .where((sp) => effectiveSeries.any((s) => s.id == sp.seriesId))
          .toList();
      effectiveSpotlights = matched.isEmpty ? catalog.spotlights : matched;
    }

    return HomeCatalog(
      planets: catalog.planets,
      spotlights: effectiveSpotlights.isEmpty ? catalog.spotlights : effectiveSpotlights,
      series: effectiveSeries,
      episodes: catalog.episodes
          .where(
            (episode) => catalog.series.any(
              (series) =>
                  series.id == episode.seriesId && matchesSeries(series),
            ),
          )
          .toList(),
      experiences: catalog.experiences
          .where(
            (experience) =>
                experience.planetId == _planetForTrack(child.ageTrack!) ||
                experience.planetId == 'abjad',
          )
          .toList(),
      books: catalog.books
          .where((book) => matchesAge(book.ageMin, book.ageMax))
          .toList(),
      stories: catalog.stories
          .where((story) => matchesAge(story.ageMin, story.ageMax))
          .toList(),
      source: catalog.source,
    );
  });
});

String _planetForTrack(String track) {
  switch (track) {
    case 'preschool':
      return 'qisas';
    case 'kids':
      return 'arqam';
    case 'junior':
      return 'oloom';
    default:
      return 'abjad';
  }
}
