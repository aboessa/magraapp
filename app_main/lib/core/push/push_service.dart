import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../diagnostics/ignored_errors.dart';
import '../../features/home/data/majarra_api_client.dart';

/// `APP-203`: family push notifications (FCM).
///
/// Android phones and tablets only: TVs are never registered (no parent reads
/// a notification on a TV), web and iOS have no Firebase configuration yet.
/// Permission is asked in the parent area, where a parent is present, never in
/// the child's screens. Every step fails soft: notifications are a bonus, and
/// no failure here may affect the app.
class PushService {
  PushService._();
  static final instance = PushService._();

  bool _initialised = false;
  StreamSubscription<String>? _refresh;
  void Function(String route)? _open;

  static bool get supported =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  /// Initialises Firebase and routes taps. Safe to call more than once.
  Future<void> init({
    required bool isTelevision,
    required void Function(String route) onOpen,
  }) async {
    _open = onOpen;
    if (_initialised || !supported || isTelevision) return;
    try {
      await Firebase.initializeApp();
      _initialised = true;
      FirebaseMessaging.onMessageOpenedApp.listen(
        (message) => _route(message.data['route']),
      );
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) _route(initial.data['route']);
    } catch (error, stack) {
      reportIgnoredError('push.init', error, stack);
    }
  }

  void _route(Object? route) {
    if (route is String &&
        RegExp(
          r'^/(parent|membership|series/[a-z0-9-]{1,120}|)$',
        ).hasMatch(route)) {
      _open?.call(route);
    }
  }

  /// Asks for permission (Android 13+) and registers this device for the
  /// signed-in family. Returns whether notifications are allowed.
  Future<bool> enable(MajarraApiClient api) async {
    if (!_initialised) return false;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        return false;
      }
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return false;
      await api.registerPushToken(token, platform: 'android');
      await _refresh?.cancel();
      _refresh = FirebaseMessaging.instance.onTokenRefresh.listen((next) {
        unawaited(
          api.registerPushToken(next, platform: 'android').catchError((
            Object e,
            StackTrace s,
          ) {
            reportIgnoredError('push.refresh', e, s);
          }),
        );
      });
      return true;
    } catch (error, stack) {
      reportIgnoredError('push.enable', error, stack);
      return false;
    }
  }

  /// On sign-out: this device stops receiving the family's notifications.
  Future<void> disable(MajarraApiClient api) async {
    if (!_initialised) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await api.unregisterPushToken(token);
      await FirebaseMessaging.instance.deleteToken();
    } catch (error, stack) {
      reportIgnoredError('push.disable', error, stack);
    }
  }
}
