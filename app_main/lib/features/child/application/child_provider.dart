import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../home/application/home_providers.dart';
import '../../home/domain/content_models.dart';

class ChildState {
  const ChildState({this.activeChildId, this.ageTrack});
  final String? activeChildId;
  final String? ageTrack; // preschool/kids/junior
}

class ChildNotifier extends StateNotifier<ChildState> {
  ChildNotifier() : super(const ChildState());

  void selectChild({required String childId, required String ageTrack}) {
    state = ChildState(activeChildId: childId, ageTrack: ageTrack);
  }

  void clear() => state = const ChildState();
}

final childProvider = StateNotifierProvider<ChildNotifier, ChildState>((ref) => ChildNotifier());

final filteredCatalogProvider = Provider<AsyncValue<HomeCatalog>>((ref) {
  final catalogAsync = ref.watch(homeCatalogProvider);
  final child = ref.watch(childProvider);
  return catalogAsync.whenData((catalog) {
    if (child.ageTrack == null) return catalog;

    bool matches(SeriesItem s) {
      if (child.ageTrack == 'preschool' && s.ageMin > 5) return false;
      if (child.ageTrack == 'kids' && (s.ageMax < 6 || s.ageMin > 8)) return false;
      if (child.ageTrack == 'junior' && s.ageMax < 9) return false;
      return true;
    }

    return HomeCatalog(
      planets: catalog.planets,
      spotlights: catalog.spotlights,
      series: catalog.series.where(matches).toList(),
      episodes: catalog.episodes.where((e) => catalog.series.any((s) => s.id == e.seriesId && matches(s))).toList(),
      experiences: catalog.experiences.where((e) => e.planetId == _planetForTrack(child.ageTrack!) || e.planetId == 'abjad').toList(),
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
