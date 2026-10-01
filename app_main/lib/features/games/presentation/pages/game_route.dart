/// Route target for `/game/:gameId`.
///
/// This is the only layer that knows how a selected child, a server-authored
/// game, session services and the pack-driven [GameScreen] fit together. A game
/// the server will not serve remains unavailable; it never falls back to an
/// invented local board that could hide a publication or entitlement problem.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/device/device_profile.dart';
import '../../../../core/env/app_environment.dart';
import '../../../child/application/child_provider.dart';
import '../../application/creation_cloud_service.dart';
import '../../application/game_providers.dart';
import '../../engine/game_board_kit.dart';
import '../../engine/game_pack.dart';
import '../../engine/game_session_controller.dart';
import '../../engine/media_audio_player.dart';
import 'game_screen.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// Highest pack schema this build can parse safely.
const int kSupportedPackVersion = 1;

/// Highest implementation version supplied by the registered engines in this
/// build. This is intentionally separate from [kSupportedPackVersion].
const int kSupportedEngineVersion = 1;

class GameRoute extends ConsumerWidget {
  const GameRoute({required this.gameId, super.key});

  final String gameId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childId = ref.watch(childProvider).activeChildId;

    if (childId == null || childId.isEmpty) {
      return _GameMessage(
        title: AppLocalizationsAr().gamesgamerouteTitle01,
        body: AppLocalizationsAr().gamesgamerouteBody01,
      );
    }

    final request = GameRequest(gameId: gameId, childId: childId);
    final resolved = ref.watch(gamePackProvider(request));

    return resolved.when(
      loading: () => const GameStateScaffold(
        panel: GameStatePanel(
          kind: GameStateKind.loading,
          title: 'نجهّز اللعبة',
          message: 'لحظات وتبدأ المغامرة.',
        ),
      ),
      error: (error, _) {
        final malformed = error is GamePackParseException;
        return _GameMessage(
          kind: GameStateKind.error,
          title: 'لم نتمكّن من فتح هذه اللعبة',
          body: malformed
              ? 'بيانات اللعبة غير مكتملة الآن. جرّب لعبة أخرى أو أعد المحاولة.'
              : 'تحقق من الاتصال ثم أعد المحاولة.',
          actionLabel: 'إعادة المحاولة',
          onAction: () => ref.invalidate(gamePackProvider(request)),
        );
      },
      data: (game) => _GameHost(
        key: ValueKey(
          '${game.gameId}:${game.pack.packId}:${game.engineVersion}',
        ),
        game: game,
        childId: childId,
        isTelevision: ref
            .watch(deviceProfileProvider)
            .maybeWhen(
              data: (profile) => profile.isTelevision,
              orElse: () => false,
            ),
      ),
    );
  }
}

class _GameHost extends ConsumerStatefulWidget {
  const _GameHost({
    required this.game,
    required this.childId,
    required this.isTelevision,
    super.key,
  });

  final ResolvedGame game;
  final String childId;
  final bool isTelevision;

  @override
  ConsumerState<_GameHost> createState() => _GameHostState();
}

class _GameHostState extends ConsumerState<_GameHost> {
  late final GameSessionController _controller;
  CapTokenGameAudioService? _ownedAudioService;

  @override
  void initState() {
    super.initState();
    final tokens = widget.game.assetTokens;
    final audioService = tokens.isNotEmpty
        ? (_ownedAudioService = CapTokenGameAudioService(
            player: JustAudioAdapter(),
            assetTokens: tokens,
            urlBuilder: (assetId, token) =>
                '${AppConfig.baseUrl}/api/v1/media/assets/${Uri.encodeComponent(assetId)}?token=${Uri.encodeComponent(token)}',
          ))
        : ref.read(gameAudioServiceProvider);

    _controller = GameSessionController(
      pack: widget.game.pack,
      gameId: widget.game.gameId,
      childId: widget.childId,
      objectiveId: widget.game.objectiveId,
      episodeId: widget.game.episodeId,
      ageTrack: widget.game.ageTrack,
      audio: audioService,
      reporter: ref.read(attemptReporterProvider),
      eventIdFactory: newEventId,
    );
  }

  @override
  void dispose() {
    // The controller queues stop first; disposal is then queued by the owned
    // adapter, so a preload/play operation cannot race either lifecycle action.
    _controller.dispose();
    _ownedAudioService?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GameScreen(
      pack: widget.game.pack,
      controller: _controller,
      registry: buildDefaultRegistry(),
      isTelevision: widget.isTelevision,
      requiredEngineVersion: widget.game.engineVersion,
      supportedEngineVersion: kSupportedEngineVersion,
      supportedPackVersion: kSupportedPackVersion,
      creationStore: ref.watch(localCreationStoreProvider),
    );
  }
}

/// A calm, honest dead end with an optional recovery action.
class _GameMessage extends StatelessWidget {
  const _GameMessage({
    required this.title,
    required this.body,
    this.kind = GameStateKind.unavailable,
    this.actionLabel,
    this.onAction,
  });

  final GameStateKind kind;
  final String title;
  final String body;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return GameStateScaffold(
      panel: GameStatePanel(
        kind: kind,
        title: title,
        message: body,
        actionLabel: actionLabel,
        onAction: onAction,
      ),
    );
  }
}
