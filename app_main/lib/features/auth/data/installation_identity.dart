import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A random, app-installation-scoped identifier used to register a device.
///
/// It is intentionally stored outside [AuthStorage]: signing out ends a family
/// session, but it must not turn the same physical installation into a new
/// device. The value is random and contains no email, account id, or hardware
/// identifier.
class InstallationIdentityStore {
  const InstallationIdentityStore();

  static const _storageKey = 'majarra_installation_id';

  Future<String> getOrCreate() async {
    final preferences = await SharedPreferences.getInstance();
    final existing = preferences.getString(_storageKey)?.trim();
    if (existing != null && existing.length >= 16) return existing;

    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    // UUID v4 layout. The server treats this as an opaque value; the layout
    // simply gives logs and diagnostics a familiar, validated shape.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
        .join();
    final id =
        '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
    await preferences.setString(_storageKey, id);
    return id;
  }
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
  if (kIsWeb) return 'متصفح ويب';
  return switch (defaultTargetPlatform) {
    TargetPlatform.android => 'جهاز Android',
    TargetPlatform.iOS => 'جهاز Apple محمول',
    TargetPlatform.windows => 'جهاز Windows',
    TargetPlatform.macOS => 'جهاز macOS',
    TargetPlatform.linux => 'جهاز Linux',
    TargetPlatform.fuchsia => 'جهاز Fuchsia',
  };
}

final installationIdentityProvider = Provider<InstallationIdentityStore>(
  (ref) => const InstallationIdentityStore(),
);
