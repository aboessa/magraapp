import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class DeviceProfile {
  const DeviceProfile({required this.isTelevision});

  final bool isTelevision;
}

class DeviceProfileService {
  static const _channel = MethodChannel('com.majarra/device');
  static const _tvOverride = bool.fromEnvironment('MAJARRA_TV_MODE');

  Future<DeviceProfile> load() async {
    // A web browser always uses the standard responsive shell. This check must
    // precede the TV override so a global development define cannot turn Chrome
    // into a television experience.
    if (kIsWeb) return const DeviceProfile(isTelevision: false);
    if (_tvOverride) return const DeviceProfile(isTelevision: true);
    if (defaultTargetPlatform != TargetPlatform.android) {
      return const DeviceProfile(isTelevision: false);
    }

    try {
      final isTelevision =
          await _channel.invokeMethod<bool>('isTelevision') ?? false;
      return DeviceProfile(isTelevision: isTelevision);
    } on PlatformException {
      return const DeviceProfile(isTelevision: false);
    } on MissingPluginException {
      return const DeviceProfile(isTelevision: false);
    }
  }
}

final deviceProfileProvider = FutureProvider<DeviceProfile>((ref) {
  return DeviceProfileService().load();
});
