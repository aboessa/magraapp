import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/crypto/file_crypto.dart';
import '../../profile/data/billing_status.dart';
import '../../profile/data/settings_store.dart';
import '../data/download_repository.dart';
import '../domain/download_models.dart';
import 'download_manager.dart';

/// Provides the app's [SharedPreferences] instance.
///
/// Overridden in `main()` with the awaited instance so synchronous consumers
/// (like [DownloadManager] restoring its metadata in its constructor) do not
/// have to be async. Throwing here makes a missing override a loud startup
/// error rather than a silent empty store.
final sharedPreferencesProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError(
    'sharedPreferencesProvider must be overridden in main()',
  ),
);

final fileCryptoProvider = Provider<FileCrypto>((ref) => FileCrypto());

final downloadRepositoryProvider = Provider<DownloadRepository>((ref) {
  return DownloadRepository(
    prefs: ref.watch(sharedPreferencesProvider),
    crypto: ref.watch(fileCryptoProvider),
    // Application support dir, not documents: downloads are managed app data the
    // user should not see or hand-edit in a file browser.
    directory: getApplicationSupportDirectory,
  );
});

final connectivityProvider = Provider<Connectivity>((ref) => Connectivity());

/// Whether downloading is currently permitted by the network policy.
///
/// Refuses when fully offline, and when the "download over Wi-Fi only" setting
/// is on and the active connection is mobile. Ethernet counts as Wi-Fi-equivalent
/// for large-screen/TV use.
Future<bool> _networkAllowsDownload(Ref ref) async {
  final results = await ref.read(connectivityProvider).checkConnectivity();
  if (results.isEmpty || results.every((r) => r == ConnectivityResult.none)) {
    return false;
  }
  final wifiOnly = ref.read(settingsProvider).downloadOverWifiOnly;
  if (!wifiOnly) return true;
  return results.any(
    (r) => r == ConnectivityResult.wifi || r == ConnectivityResult.ethernet,
  );
}

/// Whether the family's plan entitles it to offline downloads.
///
/// Downloads are a paid feature: the plan must be paid and grant at least one
/// download device. The server remains the authority — this only avoids starting
/// a download the backend would refuse anyway.
Future<bool> _isEntitledToDownload(Ref ref) async {
  final billing = await ref.read(billingStatusProvider.future);
  return billing.plan.isPaid && billing.limits.downloadDevices > 0;
}

final downloadManagerProvider =
    StateNotifierProvider<DownloadManager, List<DownloadItem>>((ref) {
      return DownloadManager(
        repository: ref.watch(downloadRepositoryProvider),
        client: http.Client(),
        isEntitled: () => _isEntitledToDownload(ref),
        networkAllowsDownload: () => _networkAllowsDownload(ref),
      );
    });
