import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Video quality preference.
///
/// Stored as a stable key rather than the Arabic label so the persisted value
/// survives a copy change or a future translation.
enum VideoQuality { auto, high, dataSaver }

extension VideoQualityLabel on VideoQuality {
  String get storageKey => switch (this) {
    VideoQuality.auto => 'auto',
    VideoQuality.high => 'high',
    VideoQuality.dataSaver => 'data_saver',
  };

  String get label => switch (this) {
    VideoQuality.auto => 'تلقائي',
    VideoQuality.high => 'جودة عالية',
    VideoQuality.dataSaver => 'توفير البيانات',
  };

  static VideoQuality fromStorage(String? value) => switch (value) {
    'high' => VideoQuality.high,
    'data_saver' => VideoQuality.dataSaver,
    _ => VideoQuality.auto,
  };
}

/// User-facing app preferences.
class AppSettings {
  const AppSettings({
    this.autoplayNext = false,
    this.downloadOverWifiOnly = true,
    this.contentNotifications = true,
    this.quality = VideoQuality.auto,
  });

  final bool autoplayNext;
  final bool downloadOverWifiOnly;
  final bool contentNotifications;
  final VideoQuality quality;

  AppSettings copyWith({
    bool? autoplayNext,
    bool? downloadOverWifiOnly,
    bool? contentNotifications,
    VideoQuality? quality,
  }) => AppSettings(
    autoplayNext: autoplayNext ?? this.autoplayNext,
    downloadOverWifiOnly: downloadOverWifiOnly ?? this.downloadOverWifiOnly,
    contentNotifications: contentNotifications ?? this.contentNotifications,
    quality: quality ?? this.quality,
  );
}

/// Persists [AppSettings] on the device.
///
/// The settings page previously held these values in plain widget state, so every
/// toggle was forgotten as soon as the page was popped and nothing else in the
/// app could read them. They now survive a restart and are readable by the
/// player and the download service.
class SettingsStore {
  static const _autoplay = 'majarra_settings_autoplay';
  static const _wifiOnly = 'majarra_settings_download_wifi_only';
  static const _notifications = 'majarra_settings_notifications';
  static const _quality = 'majarra_settings_quality';

  Future<AppSettings> load() async {
    final prefs = await SharedPreferences.getInstance();
    return AppSettings(
      autoplayNext: prefs.getBool(_autoplay) ?? false,
      downloadOverWifiOnly: prefs.getBool(_wifiOnly) ?? true,
      contentNotifications: prefs.getBool(_notifications) ?? true,
      quality: VideoQualityLabel.fromStorage(prefs.getString(_quality)),
    );
  }

  Future<void> save(AppSettings settings) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_autoplay, settings.autoplayNext);
    await prefs.setBool(_wifiOnly, settings.downloadOverWifiOnly);
    await prefs.setBool(_notifications, settings.contentNotifications);
    await prefs.setString(_quality, settings.quality.storageKey);
  }
}

class SettingsNotifier extends StateNotifier<AppSettings> {
  SettingsNotifier(this._store) : super(const AppSettings()) {
    _restore();
  }

  final SettingsStore _store;

  Future<void> _restore() async {
    final saved = await _store.load();
    if (!mounted) return;
    state = saved;
  }

  Future<void> _commit(AppSettings next) async {
    state = next;
    await _store.save(next);
  }

  Future<void> setAutoplay(bool value) =>
      _commit(state.copyWith(autoplayNext: value));

  Future<void> setDownloadOverWifiOnly(bool value) =>
      _commit(state.copyWith(downloadOverWifiOnly: value));

  Future<void> setContentNotifications(bool value) =>
      _commit(state.copyWith(contentNotifications: value));

  Future<void> setQuality(VideoQuality value) =>
      _commit(state.copyWith(quality: value));
}

final settingsStoreProvider = Provider<SettingsStore>((ref) => SettingsStore());

final settingsProvider = StateNotifierProvider<SettingsNotifier, AppSettings>(
  (ref) => SettingsNotifier(ref.watch(settingsStoreProvider)),
);
