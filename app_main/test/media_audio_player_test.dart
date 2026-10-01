import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/application/game_providers.dart';
import 'package:majarra/features/games/engine/game_audio_service.dart';
import 'package:majarra/features/games/engine/game_services.dart';
import 'package:majarra/features/games/engine/media_audio_player.dart';

class _FakePlayer implements GameAudioPlayer {
  final List<String> preloaded = [];
  final List<String> played = [];
  bool stopped = false;
  bool disposed = false;
  Object? preloadFailure;
  Object? playFailure;
  Object? stopFailure;

  @override
  Future<void> preload(String url) async {
    if (preloadFailure case final failure?) throw failure;
    preloaded.add(url);
  }

  @override
  Future<void> playUrl(String url) async {
    if (playFailure case final failure?) throw failure;
    played.add(url);
  }

  @override
  Future<void> stop() async {
    stopped = true;
    if (stopFailure case final failure?) throw failure;
  }

  @override
  void dispose() {
    disposed = true;
  }
}

String _mediaUrl(String assetId, String token) {
  return 'https://media.example.test/assets/${Uri.encodeComponent(assetId)}'
      '?token=${Uri.encodeComponent(token)}';
}

Map<String, dynamic> _envelopeWithTokens(Map<String, dynamic> tokens) {
  return {
    'data': {
      'id': 'game-1',
      'engine_id': 'memory_flip',
      'engine': {'supports_dpad': true},
      'content_pack': {
        'pack_version': 1,
        'levels': [
          {'level': 1},
        ],
      },
      'assets': {'tokens': tokens},
    },
  };
}

void main() {
  test('the envelope keeps only non-empty string capability tokens', () {
    final game = resolvedGameFromEnvelope(
      'fallback',
      _envelopeWithTokens({
        ' asset-valid ': ' token-valid ',
        'asset-empty': '   ',
        '': 'token-without-asset',
        'asset-not-string': 7,
      }),
    );

    expect(game.assetTokens, {'asset-valid': 'token-valid'});
  });

  test('a valid token reaches playback through an encoded URL', () async {
    final player = _FakePlayer();
    final builderCalls = <(String, String)>[];
    final service = CapTokenGameAudioService(
      player: player,
      assetTokens: const {'asset/intro': 'token +/='},
      urlBuilder: (assetId, token) {
        builderCalls.add((assetId, token));
        return _mediaUrl(assetId, token);
      },
    );

    await service.preload(const {VoiceKeys.intro: 'asset/intro'});
    await service.play(VoiceKeys.intro);

    expect(builderCalls, [('asset/intro', 'token +/=')]);
    expect(player.preloaded.single, contains('asset%2Fintro'));
    expect(player.played.single, contains('token%20%2B%2F%3D'));
  });

  test('missing, empty, and invalid capabilities fail closed', () async {
    for (final tokens in <Map<String, String>>[
      const {},
      const {'asset-intro': ''},
    ]) {
      final player = _FakePlayer();
      final service = CapTokenGameAudioService(
        player: player,
        assetTokens: tokens,
        urlBuilder: _mediaUrl,
      );

      await expectLater(
        service.preload(const {VoiceKeys.intro: 'asset-intro'}),
        completes,
      );
      await expectLater(service.play(VoiceKeys.intro), completes);
      expect(player.played, isEmpty);
      expect(service.missingKeys, contains(VoiceKeys.intro));
    }

    final invalidUrlPlayer = _FakePlayer();
    final invalidUrlService = CapTokenGameAudioService(
      player: invalidUrlPlayer,
      assetTokens: const {'asset-intro': 'token'},
      urlBuilder: (_, _) => 'not a media URL',
    );
    await expectLater(
      invalidUrlService.preload(const {VoiceKeys.intro: 'asset-intro'}),
      completes,
    );
    await expectLater(invalidUrlService.play(VoiceKeys.intro), completes);
    expect(invalidUrlPlayer.preloaded, isEmpty);
    expect(invalidUrlPlayer.played, isEmpty);
  });

  test('builder and player failures never escape start or replay', () async {
    final builderService = CapTokenGameAudioService(
      player: _FakePlayer(),
      assetTokens: const {'asset-repeat': 'token'},
      urlBuilder: (_, _) => throw StateError('builder failure'),
    );
    await expectLater(
      builderService.preload(const {
        VoiceKeys.instructionRepeat: 'asset-repeat',
      }),
      completes,
    );
    await expectLater(builderService.repeatInstruction(), completes);

    final player = _FakePlayer()
      ..preloadFailure = StateError('preload failure')
      ..playFailure = StateError('play failure');
    final playerService = CapTokenGameAudioService(
      player: player,
      assetTokens: const {'asset-repeat': 'token'},
      urlBuilder: _mediaUrl,
    );
    await expectLater(
      playerService.preload(const {
        VoiceKeys.instructionRepeat: 'asset-repeat',
      }),
      completes,
    );
    await expectLater(playerService.repeatInstruction(), completes);
  });

  test(
    'repeat plays its authored key and preload resets session state',
    () async {
      final player = _FakePlayer();
      final service = CapTokenGameAudioService(
        player: player,
        assetTokens: const {
          'asset-repeat': 'token-repeat',
          'asset-intro': 'token-intro',
        },
        urlBuilder: _mediaUrl,
      );

      await service.preload(const {
        VoiceKeys.instructionRepeat: 'asset-repeat',
      });
      await service.repeatInstruction();
      expect(player.played.single, contains('asset-repeat'));
      expect(service.played, [VoiceKeys.instructionRepeat]);

      await service.preload(const {VoiceKeys.intro: 'asset-intro'});
      expect(service.played, isEmpty);
      expect(service.missingKeys, isEmpty);
    },
  );

  test('stop and disposal are forwarded to the owned player', () async {
    final player = _FakePlayer();
    final service = CapTokenGameAudioService(
      player: player,
      assetTokens: const {},
      urlBuilder: _mediaUrl,
    );

    service.stopAll();
    await Future<void>.delayed(Duration.zero);
    service.dispose();
    service.dispose();

    expect(player.stopped, isTrue);
    expect(player.disposed, isTrue);
  });

  test('diagnostics never reveal media or identity secrets', () async {
    final logs = <String>[];
    final previousDebugPrint = debugPrint;
    debugPrint = (message, {wrapWidth}) {
      if (message != null) logs.add(message);
    };
    addTearDown(() => debugPrint = previousDebugPrint);

    const assetId = 'asset-child-123';
    const token = 'secret-capability-token';
    const signedUrl =
        'https://media.example.test/assets/asset-child-123?token=secret-capability-token';
    final player = _FakePlayer()
      ..preloadFailure = StateError('preload leaked $signedUrl')
      ..playFailure = StateError('play leaked child-123');
    final service = CapTokenGameAudioService(
      player: player,
      assetTokens: const {assetId: token},
      urlBuilder: (_, _) => signedUrl,
    );

    await service.preload(const {VoiceKeys.intro: assetId});
    await service.play(VoiceKeys.intro);

    final output = logs.join('\n');
    expect(output, isNotEmpty);
    for (final secret in [assetId, token, signedUrl, 'child-123']) {
      expect(output, isNot(contains(secret)));
    }
  });
}
