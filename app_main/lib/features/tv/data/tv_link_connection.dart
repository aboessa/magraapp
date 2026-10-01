import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../home/application/home_providers.dart';
import '../../home/data/majarra_api_client.dart';

/// TV-002: one socket to the family's link object, kept alive while the app is
/// in the foreground.
///
/// - Authenticates with a 60-second ticket fetched just before connecting, so
///   the long-lived session token never travels in a URL.
/// - Sends `ping` every 30 s. The server answers without waking the Durable
///   Object, so keep-alives cost nothing.
/// - Reconnects with capped exponential backoff and jitter after a drop.
/// - Stops for good when the server closes with 4001 (the session ended) or
///   4000 (a newer connection from this device replaced it).
class TvLinkConnection {
  TvLinkConnection({
    required this.api,
    required this.role,
    required this.onMessage,
    this.deviceName,
    WebSocketChannel Function(Uri uri)? connect,
  }) : _connect = connect ?? WebSocketChannel.connect;

  final MajarraApiClient api;
  final String role;
  final String? deviceName;
  final void Function(Map<String, Object?> message) onMessage;
  final WebSocketChannel Function(Uri uri) _connect;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _ping;
  Timer? _retry;
  int _attempt = 0;
  int _generation = 0;
  bool _running = false;

  bool get isConnected => _channel != null;

  static const _closeReplaced = 4000;
  static const _closeRevoked = 4001;

  void start() {
    if (_running) return;
    _running = true;
    unawaited(_open());
  }

  void stop() {
    _running = false;
    _generation += 1;
    _retry?.cancel();
    _teardown();
  }

  void send(Map<String, Object?> message) {
    final channel = _channel;
    if (channel == null) return;
    try {
      channel.sink.add(jsonEncode(message));
    } catch (_) {
      // A dying socket; the close handler schedules the reconnect.
    }
  }

  Future<void> _open() async {
    if (!_running) return;
    final generation = ++_generation;
    try {
      final ticket = await api.tvLinkTicket(role: role, deviceName: deviceName);
      if (!_running || generation != _generation) return;
      final channel = _connect(api.tvLinkSocketUri(ticket));
      await channel.ready;
      if (!_running || generation != _generation) {
        await channel.sink.close();
        return;
      }
      _channel = channel;
      _attempt = 0;
      _subscription = channel.stream.listen(
        (data) => _handle(data),
        onDone: () => _dropped(generation, channel.closeCode),
        onError: (_) => _dropped(generation, null),
        cancelOnError: true,
      );
      _ping = Timer.periodic(const Duration(seconds: 30), (_) {
        try {
          channel.sink.add('ping');
        } catch (_) {
          // The socket is closing; `onDone` reconnects.
        }
      });
    } on MajarraApiException catch (error) {
      // Signed out or revoked: retrying cannot help until the user signs in.
      if (error.statusCode == 401) {
        _running = false;
        return;
      }
      _scheduleRetry(generation);
    } catch (_) {
      _scheduleRetry(generation);
    }
  }

  void _handle(dynamic data) {
    if (data is! String || data == 'pong') return;
    try {
      final decoded = jsonDecode(data);
      if (decoded is Map) onMessage(decoded.cast<String, Object?>());
    } catch (_) {
      // Ignore anything that is not a JSON object.
    }
  }

  void _dropped(int generation, int? code) {
    if (generation != _generation) return;
    _teardown();
    if (code == _closeRevoked || code == _closeReplaced) {
      _running = false;
      return;
    }
    _scheduleRetry(generation);
  }

  void _scheduleRetry(int generation) {
    if (!_running || generation != _generation) return;
    _attempt += 1;
    final base = min(60, pow(2, min(_attempt, 6)).toInt());
    final jitter = Random().nextInt(1000);
    _retry?.cancel();
    _retry = Timer(
      Duration(seconds: base, milliseconds: jitter),
      () => unawaited(_open()),
    );
  }

  void _teardown() {
    _ping?.cancel();
    _ping = null;
    unawaited(_subscription?.cancel());
    _subscription = null;
    final channel = _channel;
    _channel = null;
    if (channel != null) {
      unawaited(channel.sink.close().catchError((Object _) {}));
    }
  }
}

typedef TvLinkConnectionFactory =
    TvLinkConnection Function({
      required String role,
      required void Function(Map<String, Object?> message) onMessage,
      String? deviceName,
    });

/// Overridden in tests with a connection that never touches the network.
final tvLinkConnectionFactoryProvider = Provider<TvLinkConnectionFactory>((
  ref,
) {
  return ({required role, required onMessage, deviceName}) => TvLinkConnection(
    api: ref.read(majarraApiClientProvider),
    role: role,
    onMessage: onMessage,
    deviceName: deviceName,
  );
});
