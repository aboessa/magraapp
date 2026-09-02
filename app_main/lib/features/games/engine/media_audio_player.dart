/// Real just_audio wrapper for game voice-over.
/// Uses just_audio + audio_session for real playback via capability tokens.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:audio_session/audio_session.dart';

import 'game_audio_service.dart';
import 'game_services.dart';

/// A real audio service that resolves assetId -> media URL via capability tokens
/// returned by GET /api/v1/games/:id in data.assets.tokens map.
///
/// Wiring:
///   final tokens = resolvedGame.assetTokens; // `Map<assetId, capabilityToken>`
///   final baseUrl = AppConfig.baseUrl;
///   RealGameAudioService(
///     player: JustAudioPlayerAdapter(),
///     urlResolver: (assetId) async {
///       final token = tokens[assetId];
///       if (token == null) return null;
///       return '$baseUrl/api/v1/media/assets/$assetId?token=${Uri.encodeComponent(token)}';
///     }
///   )
class CapTokenGameAudioService implements GameAudioService {
  CapTokenGameAudioService({
    required GameAudioPlayer player,
    required Map<String, String> assetTokens,
    required String Function(String assetId, String token) urlBuilder,
  })  : _player = player,
        _assetTokens = assetTokens,
        _urlBuilder = urlBuilder;

  final GameAudioPlayer _player;
  final Map<String, String> _assetTokens;
  final String Function(String assetId, String token) _urlBuilder;

  Map<String, String> _voiceManifest = const {};
  final Map<String, String> _urlCache = {};
  final List<String> _played = [];
  final Set<String> _missing = {};

  List<String> get played => List.unmodifiable(_played);
  List<String> get missingKeys => List.unmodifiable(_missing);

  @override
  Future<void> preload(Map<String, String> voiceManifest) async {
    _voiceManifest = Map.from(voiceManifest);
    _urlCache.clear();

    // Resolve only intros + instructions eagerly
    for (final key in _voiceManifest.keys) {
      if (!key.startsWith('vo.intro') && !key.startsWith('vo.instruction') && key != 'vo.count.1') continue;
      final assetId = _voiceManifest[key];
      if (assetId == null) continue;
      final token = _assetTokens[assetId];
      if (token == null) {
        _missing.add(key);
        continue;
      }
      final url = _urlBuilder(assetId, token);
      _urlCache[key] = url;
      unawaited(_player.preload(url));
    }
  }

  @override
  Future<void> play(String voiceKey) async {
    _played.add(voiceKey);
    final cached = _urlCache[voiceKey];
    if (cached != null) {
      try {
        await _player.playUrl(cached);
        return;
      } catch (e) {
        debugPrint('CapToken play cached failed $voiceKey: $e');
      }
    }

    final assetId = _voiceManifest[voiceKey];
    if (assetId == null || assetId.isEmpty) {
      _missing.add(voiceKey);
      return;
    }

    final token = _assetTokens[assetId];
    if (token == null) {
      _missing.add(voiceKey);
      debugPrint('CapToken no token for asset $assetId (voiceKey $voiceKey)');
      return;
    }

    final url = _urlBuilder(assetId, token);
    _urlCache[voiceKey] = url;
    try {
      await _player.playUrl(url);
    } catch (e) {
      debugPrint('CapToken play failed $voiceKey asset $assetId: $e');
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

class JustAudioAdapter implements GameAudioPlayer {
  JustAudioAdapter() : _player = AudioPlayer();

  final AudioPlayer _player;
  bool _sessionReady = false;

  Future<void> _ensureSession() async {
    if (_sessionReady) return;
    _sessionReady = true;
    try {
      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration(
        avAudioSessionCategory: AVAudioSessionCategory.playback,
        avAudioSessionCategoryOptions: AVAudioSessionCategoryOptions.duckOthers,
        androidAudioAttributes: AndroidAudioAttributes(
          contentType: AndroidAudioContentType.sonification,
          usage: AndroidAudioUsage.game,
        ),
        androidAudioFocusGainType: AndroidAudioFocusGainType.gainTransientMayDuck,
      ));
    } catch (e) {
      debugPrint('[JustAudio] audio_session configure failed: $e');
    }
  }

  @override
  Future<void> preload(String url) async {
    await _ensureSession();
    try {
      // Warm the URL — setUrl preloads header, doesn't auto-play
      // Guard with timeout so a stale token doesn't block level start
      await _player.setUrl(url).timeout(const Duration(seconds: 3));
      await _player.pause();
    } catch (e) {
      debugPrint('[JustAudio] preload failed $url: $e');
    }
  }

  @override
  Future<void> playUrl(String url) async {
    await _ensureSession();
    try {
      await _player.setUrl(url);
      await _player.play();
    } catch (e) {
      debugPrint('[JustAudio] playUrl failed $url: $e');
    }
  }

  @override
  Future<void> stop() async {
    try {
      await _player.stop();
    } catch (_) {}
  }

  @override
  void dispose() {
    try {
      _player.dispose();
    } catch (_) {}
  }
}

void unawaited(Future<void> f) {
  // ignore: discarded_futures
  f;
}
