import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// User-facing preferences that currently have real consumers.
class AppSettings {
  const AppSettings({
    this.autoplayNext = false,
    this.downloadOverWifiOnly = true,
  });

  final bool autoplayNext;
  final bool downloadOverWifiOnly;

  AppSettings copyWith({bool? autoplayNext, bool? downloadOverWifiOnly}) =>
      AppSettings(
        autoplayNext: autoplayNext ?? this.autoplayNext,
        downloadOverWifiOnly: downloadOverWifiOnly ?? this.downloadOverWifiOnly,
      );
}

/// Persists the settings that playback and downloads actually consume.
class SettingsStore {
  static const _autoplay = 'majarra_settings_autoplay';
  static const _wifiOnly = 'majarra_settings_download_wifi_only';

  Future<AppSettings> load() async {
    final preferences = await SharedPreferences.getInstance();
    return AppSettings(
      autoplayNext: preferences.getBool(_autoplay) ?? false,
      downloadOverWifiOnly: preferences.getBool(_wifiOnly) ?? true,
    );
  }

  Future<void> save(AppSettings settings) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool(_autoplay, settings.autoplayNext);
    await preferences.setBool(_wifiOnly, settings.downloadOverWifiOnly);
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
}

final settingsStoreProvider = Provider<SettingsStore>((ref) => SettingsStore());

final settingsProvider = StateNotifierProvider<SettingsNotifier, AppSettings>(
  (ref) => SettingsNotifier(ref.watch(settingsStoreProvider)),
);
