import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../child/application/child_provider.dart';
import 'home_providers.dart';

/// `APP-204`: the capability URL for a series' muted preview, or null.
/// Auto-disposed so a stale (180 s) capability is never reused later.
final seriesTrailerUrlProvider = FutureProvider.autoDispose
    .family<String?, String>((ref, seriesId) async {
      final childId = ref.watch(childProvider).activeChildId;
      if (childId == null) return null;
      return ref
          .watch(majarraApiClientProvider)
          .fetchSeriesTrailerUrl(seriesId: seriesId, childId: childId);
    });
