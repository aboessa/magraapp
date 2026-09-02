import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/crypto/file_crypto.dart';
import '../../../core/env/app_environment.dart';
import '../../../core/licensing/license_guard.dart';
import '../../../core/network/secure_http_client.dart';
import '../../../core/security/device_integrity.dart';
import '../../home/application/home_providers.dart';
import '../../home/data/majarra_api_client.dart';
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

/// راصد سلامة الجهاز (`SEC-107`). يرصد ولا يقرّر.
final deviceIntegrityProvider = Provider<DeviceIntegrityService>(
  (ref) => const DeviceIntegrityService(),
);

/// حافظ التراخيص. مفاتيحه العامة من `--dart-define` لا من المصدر.
final licenseGuardProvider = Provider<LicenseGuard>((ref) => LicenseGuard());

/// يفتح جلسة تنزيل خادمية ويحوّل ردّها إلى تخويل (`ENC-001`/`ENC-008`).
///
/// كل قرار هنا للخادم: الاستحقاق، وحدّ أجهزة التنزيل، وحدّ العناصر، ومدّة
/// الترخيص. والعميل يترجم رموز الرفض إلى أنواع يفهمها المدير.
Future<DownloadAuthorization> _authorizeDownload(Ref ref, DownloadRequest request) async {
  final api = ref.read(majarraApiClientProvider);
  final Map<String, dynamic> response;
  try {
    response = await api.createDownloadSession(
      childId: request.childId,
      // نوع العنصر كما يعرفه الخادم: `episode` أو `book` أو `story`.
      entityType: request.contentType == 'audio_story' ? 'story' : request.contentType,
      entityId: request.id,
      // SEC-107: تُرسَل مع طلب التنزيل وحده. المشاهدة المتّصلة لا تُفحص أبدًا،
      // فنتيجة إيجابية خاطئة لا تمنع طفلًا من مشاهدة شيء.
      integrity: await ref.read(deviceIntegrityProvider).reportForServer(),
    );
  } on MajarraApiException catch (error) {
    // 402 = الباقة لا تسمح أو المحتوى فوقها · 409 = حدّ بلغ منتهاه.
    if (error.statusCode == 402) throw const DownloadNotEntitled();
    if (error.statusCode == 409) throw const DownloadLimitReached();
    rethrow;
  }

  final data = response['data'];
  if (data is! Map) throw const MajarraApiException('Download session response is invalid');
  final payload = Map<String, Object?>.from(data);
  final assets = payload['assets'];
  final licence = payload['licence'];
  final licenceId = payload['licence_id'];
  if (licence is! String || licenceId is! String || assets is! List || assets.isEmpty) {
    throw const MajarraApiException('Download session response is invalid');
  }
  // أصل واحد لكل عنصر تنزيل اليوم. الحزمة متعدّدة الأصول (صفحات + صوت لكل لغة)
  // صيغة مستقلّة تحت `ENC-015`، وتجاهل البقية بصمت كان سيُنتج تنزيلًا ناقصًا
  // يظهر مكتملًا.
  final first = Map<String, Object?>.from(assets.first as Map);
  final url = first['url'];
  final authorization = first['authorization'];
  if (url is! String || authorization is! String) {
    throw const MajarraApiException('Download session response is invalid');
  }
  final expiresAt = payload['expires_at'];

  final sourceSha256 = first['source_sha256'];

  return DownloadAuthorization(
    licenceId: licenceId,
    licenceToken: licence,
    url: url.startsWith('http') ? url : '${AppConfig.baseUrl}$url',
    authorization: authorization,
    expiresAt: expiresAt is String ? DateTime.tryParse(expiresAt) : null,
    // ENC-007: البصمة من الخادم، ويقارنها المدير بما وصل فعلًا.
    sourceSha256: sourceSha256 is String && sourceSha256.length == 64 ? sourceSha256 : null,
  );
}

/// يجدّد قدرة الوسائط لترخيص قائم. الترخيص لا يُمَس (`ENC-008`).
Future<DownloadAuthorization> _refreshDownloadCapability(Ref ref, String licenceId) async {
  final response = await ref.read(majarraApiClientProvider).refreshDownloadSession(licenceId);
  final data = response['data'];
  if (data is! Map) throw const MajarraApiException('Refresh response is invalid');
  final assets = Map<String, Object?>.from(data)['assets'];
  if (assets is! List || assets.isEmpty) {
    throw const MajarraApiException('Refresh response is invalid');
  }
  final first = Map<String, Object?>.from(assets.first as Map);
  final url = first['url'];
  final authorization = first['authorization'];
  if (url is! String || authorization is! String) {
    throw const MajarraApiException('Refresh response is invalid');
  }
  return DownloadAuthorization(
    licenceId: licenceId,
    // التجديد لا يُعيد ترخيصًا: المحفوظ في التخزين الآمن يبقى هو المرجع.
    licenceToken: '',
    url: url.startsWith('http') ? url : '${AppConfig.baseUrl}$url',
    authorization: authorization,
  );
}

/// معرّفات التراخيص التي يعتبرها الخادم نشطة الآن (`ENC-010`).
Future<Set<String>> _activeLicenceIds(Ref ref) async {
  final response = await ref.read(majarraApiClientProvider).listOfflineLicences();
  final data = response['data'];
  if (data is! Map) return const <String>{};
  final licences = Map<String, Object?>.from(data)['licences'];
  if (licences is! List) return const <String>{};
  return {
    for (final entry in licences)
      if (entry is Map && entry['id'] is String) entry['id'] as String,
  };
}

final downloadManagerProvider =
    StateNotifierProvider<DownloadManager, List<DownloadItem>>((ref) {
      return DownloadManager(
        repository: ref.watch(downloadRepositoryProvider),
        // SEC-105: التنزيل يجلب وسائط مُرخَّصة برابط مُوقَّع، فهو أولى ما لا
        // يجوز أن يُقرأ عبر وكيل اعتراض.
        client: createAppHttpClient(),
        isEntitled: () => _isEntitledToDownload(ref),
        networkAllowsDownload: () => _networkAllowsDownload(ref),
        // ENC-001/ENC-005/ENC-008: الإذن والترخيص من الخادم، والتحقّق قبل كل
        // تشغيل. بلا هذين السطرين تبقى الطبقة الخادمية غير مستهلَكة.
        authorize: (request) => _authorizeDownload(ref, request),
        refreshAuthorization: (licenceId) => _refreshDownloadCapability(ref, licenceId),
        // ENC-010: سحب جهاز من اللوحة كان بلا أثر على الجهاز. المصالحة تُنسي
        // الترخيص المسحوب عند أول اتصال، فيصير الملف غير قابل للفك.
        fetchActiveLicences: () => _activeLicenceIds(ref),
        onDownloadCompleted: (licenceId) =>
            ref.read(majarraApiClientProvider).completeDownloadSession(licenceId),
        licenseGuard: ref.watch(licenseGuardProvider),
      );
    });
