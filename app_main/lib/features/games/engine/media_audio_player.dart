/// Real just_audio wrapper for game voice-over.
/// Uses just_audio + audio_session for real playback via capability tokens.
library;

import 'dart:async';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import 'game_audio_service.dart';
import 'game_services.dart';

/// Resolves game voice assets through the short-lived capability tokens returned
/// by `GET /api/v1/games/:id`.
class CapTokenGameAudioService implements GameAudioService {
  CapTokenGameAudioService({
    required GameAudioPlayer player,
    required Map<String, String> assetTokens,
    required String Function(String assetId, String token) urlBuilder,
  }) : _player = player,
       _assetTokens = _sanitizeTokens(assetTokens),
       _urlBuilder = urlBuilder;

  final GameAudioPlayer _player;
  final Map<String, String> _assetTokens;
  final String Function(String assetId, String token) _urlBuilder;

  Map<String, String> _voiceManifest = const {};
  final Map<String, String> _urlCache = {};
  final List<String> _played = [];
  final Set<String> _missing = {};
  bool _disposed = false;

  List<String> get played => List.unmodifiable(_played);
  List<String> get missingKeys => List.unmodifiable(_missing);

  @override
  Future<void> preload(Map<String, String> voiceManifest) async {
    if (_disposed) return;

    _voiceManifest = <String, String>{
      for (final entry in voiceManifest.entries)
        if (entry.key.trim().isNotEmpty && entry.value.trim().isNotEmpty)
          entry.key.trim(): entry.value.trim(),
    };
    _urlCache.clear();
    _played.clear();
    _missing.clear();

    // Warm only the first instructions. Serial awaiting prevents these setUrl
    // calls from racing playback on the adapter's single AudioPlayer.
    for (final key in _voiceManifest.keys) {
      if (!key.startsWith('vo.intro') &&
          !key.startsWith('vo.instruction') &&
          key != 'vo.count.1') {
        continue;
      }
      final url = _resolveUrl(key);
      if (url == null) continue;
      try {
        await _player.preload(url);
        _urlCache[key] = url;
      } catch (_) {
        _missing.add(key);
        debugPrint('[GameAudio] media preload failed.');
      }
    }
  }

  @override
  Future<void> play(String voiceKey) async {
    if (_disposed) return;
    _played.add(voiceKey);

    final cached = _urlCache[voiceKey];
    if (cached != null) {
      try {
        await _player.playUrl(cached);
      } catch (_) {
        _missing.add(voiceKey);
        debugPrint('[GameAudio] media playback failed.');
      }
      return;
    }

    final url = _resolveUrl(voiceKey);
    if (url == null) return;
    _urlCache[voiceKey] = url;
    try {
      await _player.playUrl(url);
    } catch (_) {
      _missing.add(voiceKey);
      debugPrint('[GameAudio] media playback failed.');
    }
  }

  String? _resolveUrl(String voiceKey) {
    final assetId = _voiceManifest[voiceKey]?.trim();
    if (assetId == null || assetId.isEmpty) {
      _missing.add(voiceKey);
      return null;
    }

    final token = _assetTokens[assetId]?.trim();
    if (token == null || token.isEmpty) {
      _missing.add(voiceKey);
      debugPrint('[GameAudio] media capability unavailable.');
      return null;
    }

    try {
      final url = _urlBuilder(assetId, token).trim();
      final uri = Uri.tryParse(url);
      if (uri == null ||
          !uri.hasScheme ||
          !uri.hasAuthority ||
          (uri.scheme != 'https' && uri.scheme != 'http')) {
        _missing.add(voiceKey);
        debugPrint('[GameAudio] media URL unavailable.');
        return null;
      }
      return url;
    } catch (_) {
      _missing.add(voiceKey);
      debugPrint('[GameAudio] media URL unavailable.');
      return null;
    }
  }

  @override
  Future<void> repeatInstruction() => play(VoiceKeys.instructionRepeat);

  @override
  void stopAll() {
    if (_disposed) return;
    unawaited(
      _player.stop().catchError((_) {
        debugPrint('[GameAudio] media stop failed.');
      }),
    );
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _player.dispose();
  }
}

Map<String, String> _sanitizeTokens(Map<String, String> tokens) {
  return Map<String, String>.unmodifiable({
    for (final entry in tokens.entries)
      if (entry.key.trim().isNotEmpty && entry.value.trim().isNotEmpty)
        entry.key.trim(): entry.value.trim(),
  });
}

/// Serial, timeout-bound adapter around one [AudioPlayer].
///
/// Failures deliberately propagate to [CapTokenGameAudioService], which owns the
/// safe fallback and sanitized diagnostics. This layer never logs media URLs.
class JustAudioAdapter implements GameAudioPlayer {
  JustAudioAdapter() : _player = AudioPlayer();

  final AudioPlayer _player;
  Future<void> _tail = Future<void>.value();
  bool _sessionReady = false;
  bool _disposeRequested = false;

  static const _loadTimeout = Duration(seconds: 5);
  static const _playTimeout = Duration(seconds: 45);

  Future<void> _ensureSession() async {
    if (_sessionReady) return;
    final session = await AudioSession.instance.timeout(_loadTimeout);
    await session
        .configure(
          const AudioSessionConfiguration(
            avAudioSessionCategory: AVAudioSessionCategory.playback,
            avAudioSessionCategoryOptions:
                AVAudioSessionCategoryOptions.duckOthers,
            androidAudioAttributes: AndroidAudioAttributes(
              contentType: AndroidAudioContentType.sonification,
              usage: AndroidAudioUsage.game,
            ),
            androidAudioFocusGainType:
                AndroidAudioFocusGainType.gainTransientMayDuck,
          ),
        )
        .timeout(_loadTimeout);
    _sessionReady = true;
  }

  Future<void> _enqueue(Future<void> Function() operation) {
    if (_disposeRequested) {
      return Future<void>.error(StateError('Audio player is disposed'));
    }
    final result = _tail.then((_) => operation());
    _tail = result.then<void>((_) {}, onError: (Object _, StackTrace __) {});
    return result;
  }

  @override
  Future<void> preload(String url) {
    return _enqueue(() async {
      await _ensureSession();
      await _player.setUrl(url).timeout(_loadTimeout);
      await _player.pause().timeout(_loadTimeout);
    });
  }

  @override
  Future<void> playUrl(String url) {
    return _enqueue(() async {
      await _ensureSession();
      await _player.setUrl(url).timeout(_loadTimeout);
      await _player.play().timeout(_playTimeout);
    });
  }

  @override
  Future<void> stop() {
    return _enqueue(() => _player.stop().timeout(_loadTimeout));
  }

  @override
  void dispose() {
    if (_disposeRequested) return;
    _disposeRequested = true;
    final result = _tail.then((_) => _player.dispose().timeout(_loadTimeout));
    _tail = result.then<void>((_) {}, onError: (Object _, StackTrace __) {});
    unawaited(result);
  }
}
