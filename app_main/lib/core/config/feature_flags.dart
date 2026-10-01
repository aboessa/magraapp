import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/home/application/home_providers.dart';

/// ADM-305: features the operator can switch off from the dashboard
/// ("أعلام الميزات") without a new build.
///
/// Keys match the dashboard. A flag absent from the server, or a failed read,
/// means **on**: a network hiccup must not hide features, and switching one off
/// is an explicit decision recorded with a reason.
abstract final class FeatureFlag {
  static const tvCast = 'tv_cast';
  static const continueWatching = 'continue_watching';
}

class FeatureFlags {
  const FeatureFlags(this._values);

  final Map<String, bool> _values;

  bool isOn(String key) => _values[key] ?? true;
}

final featureFlagsProvider = FutureProvider<FeatureFlags>((ref) async {
  try {
    final envelope = await ref.read(majarraApiClientProvider).fetchAppConfig();
    final data = envelope['data'];
    final raw = data is Map ? data['feature_flags'] : null;
    if (raw is! Map) return const FeatureFlags({});
    return FeatureFlags({
      for (final entry in raw.entries)
        if (entry.key is String && entry.value is bool)
          entry.key as String: entry.value as bool,
    });
  } catch (_) {
    return const FeatureFlags({});
  }
});

/// Synchronous read for widgets: on until the server says otherwise.
bool featureOn(WidgetRef ref, String key) =>
    ref.watch(featureFlagsProvider).valueOrNull?.isOn(key) ?? true;
