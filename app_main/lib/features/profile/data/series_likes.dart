import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../child/application/child_provider.dart';
import '../../home/application/home_providers.dart';
import '../../home/data/majarra_api_client.dart';

/// `APP-209`: series the active child marked «عجبني».
///
/// Stored as a favourite with `entity_type: 'series_like'` in the family's
/// Durable Object, next to «احفظ» (`'series'`, `watchlist_store.dart`). The
/// server projects both into `child_series_signals`, which recommendations read.
///
/// Simpler than the watchlist on purpose: a like is a one-tap signal, not a list
/// a child relies on offline, so a failed request reverts the heart and says so
/// instead of keeping a durable outbox.
class SeriesLikesNotifier extends StateNotifier<Set<String>> {
  SeriesLikesNotifier(this._api, this._childId) : super(const {}) {
    _load();
  }

  final MajarraApiClient _api;
  final String? _childId;
  static const entityType = 'series_like';

  bool get _enabled =>
      _childId != null && _childId.isNotEmpty && _childId != 'demo-child';

  Future<void> _load() async {
    if (!_enabled) return;
    try {
      final envelope = await _api.getFamilyState();
      final data = envelope['data'];
      final rows = data is Map<String, dynamic> ? data['favorites'] : null;
      if (rows is! List || !mounted) return;
      state = {
        for (final row in rows.whereType<Map<String, dynamic>>())
          if (row['child_id'] == _childId &&
              row['entity_type'] == entityType &&
              row['entity_id'] is String)
            row['entity_id'] as String,
      };
    } catch (_) {
      // Unknown likes read as "not liked yet"; the next tap still reaches the server.
    }
  }

  /// Returns false when the server refused or could not be reached.
  Future<bool> toggle(String seriesId) async {
    if (!_enabled) return false;
    final liked = !state.contains(seriesId);
    state = liked ? {...state, seriesId} : ({...state}..remove(seriesId));
    try {
      await _api.updateFavorite(
        childId: _childId!,
        entityId: seriesId,
        entityType: entityType,
        add: liked,
      );
      return true;
    } catch (_) {
      if (mounted) {
        state = liked ? ({...state}..remove(seriesId)) : {...state, seriesId};
      }
      return false;
    }
  }
}

final seriesLikesProvider =
    StateNotifierProvider<SeriesLikesNotifier, Set<String>>(
      (ref) => SeriesLikesNotifier(
        ref.watch(majarraApiClientProvider),
        ref.watch(childProvider).activeChildId,
      ),
    );
