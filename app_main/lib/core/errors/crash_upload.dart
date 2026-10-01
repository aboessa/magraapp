import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../env/app_environment.dart';
import '../env/app_version.dart';

/// First-party crash upload (`OPS-202`). The other end is
/// `POST /api/v1/analytics/crashes`.
///
/// ## What leaves the device
///
/// Only [CrashPayload]: the error's runtime type, up to 12 stack frames shaped
/// `package:…:line member` or `dart:…`, a fixed context category, and the
/// platform. **Never** `error.toString()`: messages carry request bodies and, in
/// a children's app, names. The server refuses anything outside that shape.
///
/// ## Why a disk queue
///
/// A fatal error can end the process before a request finishes. Reports are
/// written to SharedPreferences first and flushed on the next launch, so the
/// crash that kills the app is the one most likely to arrive.
@immutable
class CrashPayload {
  const CrashPayload({
    required this.errorType,
    required this.frames,
    required this.context,
    required this.fatal,
    required this.occurredAt,
  });

  final String errorType;
  final List<String> frames;
  final String context;
  final bool fatal;
  final int occurredAt;

  static const maxFrames = 12;

  /// Builds the privacy-shaped payload from a raw error.
  factory CrashPayload.from(
    Object error,
    StackTrace? stack, {
    String? context,
    bool fatal = false,
    DateTime? at,
  }) {
    return CrashPayload(
      errorType: sanitizeErrorType(error.runtimeType.toString()),
      frames: stack == null ? const [] : sanitizeFrames(stack.toString()),
      context: contextCategory(context),
      fatal: fatal,
      occurredAt: (at ?? DateTime.now()).millisecondsSinceEpoch,
    );
  }

  Map<String, Object?> toJson({
    required String platform,
    required String deviceKind,
  }) => {
    'error_type': errorType,
    'frames': frames,
    'context': context,
    'fatal': fatal,
    'platform': platform,
    'device_kind': deviceKind,
    'occurred_at': occurredAt,
  };

  Map<String, Object?> toStored() => {
    'error_type': errorType,
    'frames': frames,
    'context': context,
    'fatal': fatal,
    'occurred_at': occurredAt,
  };

  static CrashPayload? fromStored(Object? raw) {
    if (raw is! Map) return null;
    final type = raw['error_type'];
    final frames = raw['frames'];
    final at = raw['occurred_at'];
    if (type is! String || frames is! List || at is! int) return null;
    return CrashPayload(
      errorType: sanitizeErrorType(type),
      frames: frames
          .whereType<String>()
          .where(_frameShape.hasMatch)
          .take(maxFrames)
          .toList(),
      context: contextCategory(raw['context'] as String?),
      fatal: raw['fatal'] == true,
      occurredAt: at,
    );
  }

  /// Same shape the server enforces (`crashIngest.ts` `FRAME_PATTERN`).
  static final _frameShape = RegExp(
    r'^(package:[a-z0-9_]+/[\w./-]{1,160}|dart:[\w./-]{1,80})(:\d{1,6}(:\d{1,5})?)?( [\w.<>$]{1,80})?$',
  );

  /// `#3      HomePage.build (package:majarra/x.dart:42:7)` → `package:majarra/x.dart:42:7 HomePage.build`.
  static final _vmFrame = RegExp(r'^#\d+\s+(.+?)\s+\((.+)\)$');

  @visibleForTesting
  static List<String> sanitizeFrames(String stack) {
    final out = <String>[];
    for (final line in const LineSplitter().convert(stack)) {
      final match = _vmFrame.firstMatch(line.trim());
      if (match == null) continue;
      final location = match.group(2)!;
      if (!location.startsWith('package:') && !location.startsWith('dart:')) {
        continue;
      }
      var member = match.group(1)!.replaceAll(RegExp(r'[^\w.<>$]'), '_');
      if (member.length > 80) member = member.substring(0, 80);
      final frame = member.isEmpty ? location : '$location $member';
      if (_frameShape.hasMatch(frame)) {
        out.add(frame);
      } else if (_frameShape.hasMatch(location)) {
        out.add(location);
      }
      if (out.length >= maxFrames) break;
    }
    return out;
  }

  @visibleForTesting
  static String sanitizeErrorType(String raw) {
    final cleaned = raw.replaceAll(RegExp(r'[^\w<>$.,\s]'), '').trim();
    if (cleaned.isEmpty) return 'Unknown';
    return cleaned.length > 80 ? cleaned.substring(0, 80) : cleaned;
  }

  /// A fixed category, never the raw description: Flutter's context text can
  /// name widgets and, through them, their text content.
  @visibleForTesting
  static String contextCategory(String? raw) {
    final value = (raw ?? '').toLowerCase();
    if (value.isEmpty) return 'unknown';
    if (RegExp(r'^[a-z_]{1,32}$').hasMatch(value)) return value;
    if (value.contains('building')) return 'build';
    if (value.contains('layout')) return 'layout';
    if (value.contains('paint')) return 'paint';
    if (value.contains('gesture') || value.contains('pointer')) {
      return 'gesture';
    }
    if (value.contains('image')) return 'image';
    if (value.contains('callback') || value.contains('task')) return 'callback';
    return 'flutter';
  }
}

/// Queues and sends [CrashPayload]s. Installed once from `main.dart`.
class CrashUploader {
  CrashUploader({
    required this.deviceKind,
    http.Client? client,
    Future<SharedPreferences> Function()? prefs,
    Uri? endpoint,
  }) : _client = client ?? http.Client(),
       _prefs = prefs ?? SharedPreferences.getInstance,
       _endpoint =
           endpoint ??
           Uri.parse('${AppConfig.baseUrl}/api/v1/analytics/crashes');

  final String deviceKind;
  final http.Client _client;
  final Future<SharedPreferences> Function() _prefs;
  final Uri _endpoint;

  static const _key = 'crash_reports.pending.v1';
  static const maxQueued = 20;

  /// Identical crashes in a loop are sent at most this many times per session.
  static const maxPerFingerprint = 3;
  final Map<String, int> _seen = {};
  Future<void>? _flushing;

  String get _platform {
    if (kIsWeb) return 'web';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'android';
      case TargetPlatform.iOS:
        return 'ios';
      default:
        return 'other';
    }
  }

  /// Persists first, then tries to send. Never throws.
  Future<void> enqueue(CrashPayload payload) async {
    try {
      final key = '${payload.errorType}|${payload.frames.take(5).join('|')}';
      final count = (_seen[key] ?? 0) + 1;
      _seen[key] = count;
      if (count > maxPerFingerprint) return;

      final prefs = await _prefs();
      final queue = _read(prefs)..add(payload.toStored());
      while (queue.length > maxQueued) {
        queue.removeAt(0);
      }
      await prefs.setString(_key, jsonEncode(queue));
      unawaited(flush());
    } catch (_) {
      // The crash path must never crash.
    }
  }

  /// Sends everything queued. Reports the server refuses (4xx) are dropped so a
  /// malformed one cannot block the queue; network failures keep them.
  Future<void> flush() =>
      _flushing ??= _flush().whenComplete(() => _flushing = null);

  Future<void> _flush() async {
    try {
      final prefs = await _prefs();
      final queue = _read(prefs);
      if (queue.isEmpty) return;
      final remaining = <Map<String, Object?>>[];
      for (var i = 0; i < queue.length; i++) {
        final payload = CrashPayload.fromStored(queue[i]);
        if (payload == null) continue;
        try {
          final res = await _client
              .post(
                _endpoint,
                headers: {
                  'Content-Type': 'application/json',
                  'X-App-Version': AppVersion.current,
                  'X-Platform': 'flutter',
                },
                body: jsonEncode(
                  payload.toJson(platform: _platform, deviceKind: deviceKind),
                ),
              )
              .timeout(const Duration(seconds: 10));
          if (res.statusCode >= 500 || res.statusCode == 429) {
            remaining.addAll(queue.sublist(i).cast<Map<String, Object?>>());
            break;
          }
        } catch (_) {
          remaining.addAll(queue.sublist(i).cast<Map<String, Object?>>());
          break;
        }
      }
      await prefs.setString(_key, jsonEncode(remaining));
    } catch (_) {
      // Reporting a failure of the crash path through the crash path would loop;
      // the queue stays on disk and the next launch retries.
    }
  }

  List<Map<String, Object?>> _read(SharedPreferences prefs) {
    final raw = prefs.getString(_key);
    if (raw == null) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .whereType<Map<dynamic, dynamic>>()
          .map((e) => e.cast<String, Object?>())
          .toList();
    } catch (_) {
      return [];
    }
  }
}
