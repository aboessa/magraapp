/// Real audio service for games using just_audio for playback of voice-over.
/// Falls back silently when no audio asset is available.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';

import 'game_services.dart';

/// Audio player interface to avoid hard dependency on just_audio in tests.
/// Platform implementation uses `just_audio` when available.
abstract class GameAudioPlayer {
  Future<void> preload(String url);
  Future<void> playUrl(String url);
  Future<void> stop();
  void dispose();
}

/// Null player for tests and when audio is not configured.
class NullGameAudioPlayer implements GameAudioPlayer {
  @override
  Future<void> preload(String url) async {}

  @override
  Future<void> playUrl(String url) async {}

  @override
  Future<void> stop() async {}

  @override
  void dispose() {}
}

/// The real game audio service that resolves voice keys via asset IDs
/// from `voice_manifest` to actual audio URLs delivered via the app's
/// media capability system (same as episode playback).
class RealGameAudioService implements GameAudioService {
  RealGameAudioService({
    required GameAudioPlayer player,
    required Future<String?> Function(String assetId) urlResolver,
    this.onMissingKey,
  }) : _player = player,
       _urlResolver = urlResolver;

  final GameAudioPlayer _player;
  final Future<String?> Function(String assetId) _urlResolver;
  final void Function(String voiceKey)? onMissingKey;

  Map<String, String> _manifest = const {};
  final Map<String, String> _resolvedUrls = {};
  final Set<String> _missing = {};

  List<String> get missingKeys => List.unmodifiable(_missing);
  List<String> get playedKeys => List.unmodifiable(_played);
  final List<String> _played = [];

  @override
  Future<void> preload(Map<String, String> voiceManifest) async {
    _manifest = Map<String, String>.from(voiceManifest);
    _resolvedUrls.clear();
    _missing.clear();
    _played.clear();

    // Preload is best-effort. We resolve URLs for the mandatory keys only
    // to avoid N parallel capability requests on every level load.
    const mandatory = [
      VoiceKeys.intro,
      VoiceKeys.instruction,
      VoiceKeys.levelComplete,
      VoiceKeys.gameComplete,
    ];

    for (final key in mandatory) {
      final assetId = _manifest[key];
      if (assetId == null || assetId.trim().isEmpty) {
        _missing.add(key);
        continue;
      }
      try {
        final url = await _urlResolver(assetId);
        if (url == null || url.trim().isEmpty) {
          _missing.add(key);
          continue;
        }
        _resolvedUrls[key] = url;
        await _player.preload(url);
      } catch (_) {
        _missing.add(key);
        debugPrint('[GameAudio] media preload failed.');
      }
    }
  }

  @override
  Future<void> play(String voiceKey) async {
    _played.add(voiceKey);
    final cached = _resolvedUrls[voiceKey];
    if (cached != null) {
      try {
        await _player.playUrl(cached);
      } catch (_) {
        debugPrint('[GameAudio] media playback failed.');
      }
      return;
    }

    final assetId = _manifest[voiceKey];
    if (assetId == null || assetId.trim().isEmpty) {
      _missing.add(voiceKey);
      onMissingKey?.call(voiceKey);
      return;
    }

    try {
      final url = await _urlResolver(assetId);
      if (url == null || url.trim().isEmpty) {
        _missing.add(voiceKey);
        return;
      }
      _resolvedUrls[voiceKey] = url;
      await _player.playUrl(url);
    } catch (_) {
      _missing.add(voiceKey);
      debugPrint('[GameAudio] media playback failed.');
    }
  }

  @override
  Future<void> repeatInstruction() => play(VoiceKeys.instructionRepeat);

  @override
  void stopAll() {
    unawaited(_player.stop());
  }

  void dispose() {
    _player.dispose();
  }
}

/// Legacy no-op adapter retained for callers that explicitly request it.
/// Production capability-token playback is implemented by `JustAudioAdapter`.
class JustAudioGameAudioPlayer implements GameAudioPlayer {
  JustAudioGameAudioPlayer();

  dynamic _internalPlayer;
  bool _initialized = false;

  Future<void> _ensure() async {
    if (_initialized) return;
    _initialized = true;
  }

  @override
  Future<void> preload(String url) async {
    await _ensure();
  }

  @override
  Future<void> playUrl(String url) async {
    await _ensure();
    if (_internalPlayer == null) return;
    await _internalPlayer.setUrl(url);
    await _internalPlayer.play();
  }

  @override
  Future<void> stop() async {
    try {
      await _internalPlayer?.stop();
    } catch (_) {}
  }

  @override
  void dispose() {
    try {
      _internalPlayer?.dispose();
    } catch (_) {}
  }
}

/// Returns a silent player for legacy callers.
GameAudioPlayer createDefaultAudioPlayer() => NullGameAudioPlayer();
