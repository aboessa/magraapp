import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/app_router.dart';
import '../../../app/router/auth_guard.dart';
import '../../../core/device/device_profile.dart';
import '../../auth/data/installation_identity.dart';
import '../../child/application/child_provider.dart';
import '../../child/application/family_children_provider.dart';
import '../application/tv_command_handler.dart';
import '../application/tv_playback_bridge.dart';
import '../data/tv_link_connection.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// TV-002: keeps a signed-in television reachable from the family's phones.
///
/// Wraps the app. On a television with a real (non-demo) session it holds the
/// link socket while the app is in the foreground, runs incoming commands
/// through [TvCommandHandler], answers each with an ack, and streams the
/// player's state back. Everywhere else it is a pass-through.
class TvReceiverHost extends ConsumerStatefulWidget {
  const TvReceiverHost({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<TvReceiverHost> createState() => _TvReceiverHostState();
}

class _TvReceiverHostState extends ConsumerState<TvReceiverHost>
    with WidgetsBindingObserver {
  TvLinkConnection? _connection;
  TvCommandHandler? _handler;
  bool _foreground = true;

  /// TV-004: the name the phone's cast list shows, e.g. «تلفزيون Xiaomi MIBOX4».
  String _label = AppLocalizationsAr().tvtvreceiverhostLabel01;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(televisionLabel().then((label) => _label = label));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _disconnect();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Closed in the background: an app the user cannot see must not be
    // steerable, and a closed socket costs nothing.
    _foreground = state == AppLifecycleState.resumed;
    _sync();
  }

  bool get _shouldConnect {
    final isTv =
        ref.read(deviceProfileProvider).valueOrNull?.isTelevision ?? false;
    final guard = ref.read(authGuardProvider);
    return isTv && _foreground && guard.isAuthenticated && !guard.isDemo;
  }

  void _sync() {
    if (!mounted) return;
    if (_shouldConnect) {
      _connect();
    } else {
      _disconnect();
    }
  }

  void _connect() {
    if (_connection != null) return;
    final bridge = ref.read(tvPlaybackBridgeProvider);
    _handler = TvCommandHandler(
      bridge: bridge,
      loadChildren: () => ref.read(familyChildrenProvider.future),
      selectChild: (child) => ref
          .read(childProvider.notifier)
          .selectChild(
            childId: child.id,
            ageTrack: child.ageTrack,
            displayName: child.displayName,
            interests: child.interests,
            language: child.language,
          ),
      openEpisode: (episodeId, positionMs) {
        final router = ref.read(routerProvider);
        router.go('/');
        unawaited(
          router.push(
            Uri(
              path: '/playback/$episodeId',
              queryParameters: {if (positionMs > 0) 't': '$positionMs'},
            ).toString(),
          ),
        );
      },
    );
    final connection = ref.read(tvLinkConnectionFactoryProvider)(
      role: 'tv',
      deviceName: _label,
      onMessage: _onMessage,
    );
    _connection = connection;
    bridge.onState = (snapshot) => connection.send(snapshot.toMessage());
    connection.start();
  }

  void _disconnect() {
    final connection = _connection;
    if (connection == null) return;
    _connection = null;
    _handler = null;
    final bridge = ref.read(tvPlaybackBridgeProvider);
    bridge.onState = null;
    connection.stop();
  }

  Future<void> _onMessage(Map<String, Object?> message) async {
    final connection = _connection;
    final handler = _handler;
    if (message['type'] == 'hello') {
      // Tell a newly opened remote what is on screen right now.
      final last = ref.read(tvPlaybackBridgeProvider).last;
      if (last != null && connection != null) connection.send(last.toMessage());
      return;
    }
    if (message['type'] != 'command' || connection == null || handler == null) {
      return;
    }
    final commandId = message['command_id'];
    if (commandId is! String) return;
    final ack = await handler.handle(message);
    connection.send({
      'type': 'ack',
      'command_id': commandId,
      'ok': ack.ok,
      'reason': ack.reason,
    });
  }

  @override
  Widget build(BuildContext context) {
    // Re-evaluated whenever the device profile or the session changes.
    ref.listen(deviceProfileProvider, (_, __) => _sync());
    ref.listen(authSessionKeyProvider, (_, __) => _sync());
    WidgetsBinding.instance.addPostFrameCallback((_) => _sync());
    return widget.child;
  }
}
