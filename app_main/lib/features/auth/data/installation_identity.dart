import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// An app-installation-scoped identifier used to register a device.
///
/// It is intentionally stored outside [AuthStorage]: signing out ends a family
/// session, but it must not turn the same physical installation into a new
/// device. The value contains no email, account id, or readable hardware
/// identifier.
///
/// ## Surviving a reinstall (`TV-004`)
///
/// A purely random value lived in app storage, so uninstalling and reinstalling
/// made the same TV a *new* device that took another slot on the plan. On
/// Android the id is now derived from `ANDROID_ID`, which survives a reinstall
/// and, since Android 8, is scoped to this app's signing key, so it cannot link
/// us to other apps. It is hashed with an app-specific prefix before use, so the
/// raw value never leaves the device. An id already stored is kept as-is, so
/// existing installations do not become new devices; other platforms, and
/// Android when the seed is unavailable, fall back to a random value.
class InstallationIdentityStore {
  const InstallationIdentityStore({Future<String?> Function()? seed})
    : _seed = seed;

  static final _storageKey = 'majarra_installation_id';
  static final _channel = MethodChannel('com.majarra/device');

  final Future<String?> Function()? _seed;

  Future<String?> _platformSeed() async {
    if (_seed != null) return _seed();
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return null;
    try {
      return await _channel.invokeMethod<String>('installationSeed');
    } on PlatformException {
      return null;
    } on MissingPluginException {
      return null;
    }
  }

  Future<String> getOrCreate() async {
    final preferences = await SharedPreferences.getInstance();
    final existing = preferences.getString(_storageKey)?.trim();
    if (existing != null && existing.length >= 16) return existing;

    final seed = (await _platformSeed())?.trim();
    final List<int> bytes;
    if (seed != null && seed.length >= 8) {
      bytes = sha256
          .convert(utf8.encode('majarra:installation:v1:$seed'))
          .bytes
          .sublist(0, 16);
    } else {
      final random = Random.secure();
      bytes = List<int>.generate(16, (_) => random.nextInt(256));
    }
    final id = formatInstallationId(bytes);
    await preferences.setString(_storageKey, id);
    return id;
  }
}

/// UUID v4 layout. The server treats this as opaque; the layout only gives logs
/// a familiar, validated shape.
@visibleForTesting
String formatInstallationId(List<int> source) {
  final bytes = List<int>.of(source);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
      '${hex.substring(20)}';
}

/// Platform values accepted by the parent-auth API.
String get currentAuthPlatform {
  if (kIsWeb) return 'web';
  return switch (defaultTargetPlatform) {
    TargetPlatform.android => 'android',
    TargetPlatform.iOS => 'ios',
    TargetPlatform.windows => 'windows',
    TargetPlatform.macOS => 'macos',
    TargetPlatform.linux => 'linux',
    TargetPlatform.fuchsia => 'android',
  };
}

/// Honest, non-identifying label shown in the family's device list.
String get currentDeviceLabel {
  if (kIsWeb) return AppLocalizationsAr().authinstallationidentityGet01;
  return switch (defaultTargetPlatform) {
    TargetPlatform.android =>
      AppLocalizationsAr().authinstallationidentityGet02,
    TargetPlatform.iOS => AppLocalizationsAr().authinstallationidentityGet03,
    TargetPlatform.windows =>
      AppLocalizationsAr().authinstallationidentityGet04,
    TargetPlatform.macOS => AppLocalizationsAr().authinstallationidentityGet05,
    TargetPlatform.linux => 'جهاز Linux',
    TargetPlatform.fuchsia => 'جهاز Fuchsia',
  };
}

/// TV-004: "تلفزيون Xiaomi MIBOX4", so two TVs in one home can be told apart
/// in the device list and the cast sheet. Falls back to "تلفزيون".
Future<String> televisionLabel() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
    return 'تلفزيون';
  }
  try {
    final model = (await const MethodChannel(
      'com.majarra/device',
    ).invokeMethod<String>('deviceLabel'))?.trim();
    if (model == null || model.isEmpty) return 'تلفزيون';
    // 40 characters in all: the link ticket's `device_name` limit.
    final label = 'تلفزيون $model';
    return label.length > 40 ? label.substring(0, 40).trimRight() : label;
  } on PlatformException {
    return 'تلفزيون';
  } on MissingPluginException {
    return 'تلفزيون';
  }
}

final installationIdentityProvider = Provider<InstallationIdentityStore>(
  (ref) => const InstallationIdentityStore(),
);
