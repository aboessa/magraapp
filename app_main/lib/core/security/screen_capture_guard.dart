import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Blocks platform screen capture while licensed video is on screen.
///
/// Backed by Android's `FLAG_SECURE`, which suppresses screenshots, screen
/// recording, and mirroring to non-secure displays for the app window.
///
/// Scope, stated plainly: this is a deterrent, not DRM. It defeats the platform
/// capture APIs and casual recording. It does not stop an external camera, a
/// rooted device, or a modified build. Protecting the stream itself requires
/// Widevine, which needs a licence server the project does not have.
///
/// Applied only during playback rather than app-wide: `FLAG_SECURE` also blocks
/// legitimate screenshots of ordinary screens, so restricting it keeps the
/// protection targeted at the content that warrants it.
class ScreenCaptureGuard {
  const ScreenCaptureGuard();

  static const _channel = MethodChannel('com.majarra/device');

  /// True on platforms where a secure-window flag exists.
  ///
  /// Only Android is handled: iOS has no equivalent public API, and desktop and
  /// web cannot restrict capture at all. Callers do not need to branch — enable
  /// and disable are no-ops elsewhere.
  static bool get isSupported =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  Future<void> enable() => _set(true);
  Future<void> disable() => _set(false);

  Future<void> _set(bool enabled) async {
    if (!isSupported) return;
    try {
      await _channel.invokeMethod<void>('setSecureFlag', {'enabled': enabled});
    } on PlatformException {
      // An older build of the host app may not implement the handler. Failing
      // to set the flag must never prevent playback.
    } on MissingPluginException {
      // Same reasoning: the channel is absent in unit tests.
    }
  }
}
