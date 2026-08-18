/// Route target for `/game/:gameId`.
///
/// This is the only layer that knows how a selected child, a server-authored
/// game, session services and the pack-driven [GameScreen] fit together. A game
/// the server will not serve remains unavailable; it never falls back to an
/// invented local board that could hide a publication or entitlement problem.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/device/device_profile.dart';
import '../../../child/application/child_provider.dart';
import '../../application/creation_cloud_service.dart';
import '../../application/game_providers.dart';
import '../../engine/game_pack.dart';
import '../../engine/game_session_controller.dart';
import 'game_screen.dart';

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
      return const _GameMessage(
        icon: Icons.face_outlined,
        title: 'اختر طفلًا أولًا',
        body: 'الألعاب تُفتح لطفل واحد، حتى يُحفظ تقدّمه في المكان الصحيح.',
      );
    }

    final request = GameRequest(gameId: gameId, childId: childId);
    final resolved = ref.watch(gamePackProvider(request));

    return resolved.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) {
        final malformed = error is GamePackParseException;
        return _GameMessage(
          icon: malformed
              ? Icons.extension_off_outlined
              : Icons.cloud_off_outlined,
          title: 'لم نتمكّن من فتح هذه اللعبة',
          body: malformed
              ? 'بيانات اللعبة غير مكتملة الآن. جرّب لعبة أخرى أو أعد المحاولة.'
              : 'تحقق من الاتصال ثم أعد المحاولة.',
          detail: kDebugMode ? '$error' : null,
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

  @override
  void initState() {
    super.initState();
    _controller = GameSessionController(
      pack: widget.game.pack,
      gameId: widget.game.gameId,
      childId: widget.childId,
      objectiveId: widget.game.objectiveId,
      episodeId: widget.game.episodeId,
      ageTrack: widget.game.ageTrack,
      audio: ref.read(gameAudioServiceProvider),
      reporter: ref.read(attemptReporterProvider),
      eventIdFactory: newEventId,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
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
    required this.icon,
    required this.title,
    required this.body,
    this.detail,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final String? detail;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 64),
                const SizedBox(height: 16),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  body,
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                if (detail != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    detail!,
                    style: Theme.of(context).textTheme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                ],
                if (onAction != null && actionLabel != null) ...[
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: onAction,
                    icon: const Icon(Icons.refresh_rounded),
                    label: Text(actionLabel!),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
