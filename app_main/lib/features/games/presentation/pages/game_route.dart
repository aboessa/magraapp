/// Route target for `/game/:gameId`.
///
/// ## What this replaced
///
/// The route used to build `game_page.dart`: a memory board with eight emoji
/// compiled into the app, a `_pairsPerLevel = [3, 4, 6, 8]` difficulty curve, a
/// deck seeded from an `ExperienceItem.id`, and no pack, no server call and no
/// attempt reporting. It looked like a game and was really a demo — the same
/// mechanic `memory_flip` now implements in `engine/wave_one_engines.dart`, except
/// that nothing a CMS editor could publish had any effect on it.
///
/// Deleting the page without replacing the route would have left a dead entry
/// point: `home_feed.dart` and `home_feed_model.dart` both push `/game/${id}`.
/// Pointing the route at the pack-driven [GameScreen] keeps those call sites
/// unchanged and makes the same tap open real content instead of placeholder
/// content.
///
/// ## Why this file is separate from the screen
///
/// [GameScreen] takes a pack and a controller as plain arguments so a widget test
/// can pump it without a `ProviderScope`. This file is the only place that knows
/// where a child id, a pack, an audio service and an attempt reporter come from,
/// which is the same split `my_collection_route.dart` uses.
///
/// ## Why an unavailable state is the correct outcome, not a fallback game
///
/// A game id that the server will not serve — unpublished, outside the child's age
/// range, or simply not in the CMS yet — renders a calm message. It deliberately
/// does *not* fall back to a locally generated board. A local fallback is what made
/// the emoji deck look acceptable for as long as it did: the app appeared to have
/// content, so the missing content was invisible.
///
/// The catalogue's `experiences` list is still local (`LocalCatalog.experiences`),
/// so its ids are not real `games` rows and will legitimately produce this state
/// until the catalogue carries server game ids. That is a visible content gap
/// rather than a hidden one, which is the intended trade.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/device/device_profile.dart';
import '../../../child/application/child_provider.dart';
import '../../application/creation_cloud_service.dart';
import '../../application/game_providers.dart';
import '../../engine/game_pack.dart';
import '../../engine/game_session_controller.dart';
import 'game_screen.dart';

/// The highest `pack_version` this build implements.
///
/// A pack that declares more is refused with "update the app" rather than run
/// half-understood: the CMS can publish faster than app stores ship, and a level
/// shape this build cannot read is not something to guess at.
const int kSupportedPackVersion = 1;

class GameRoute extends ConsumerWidget {
  const GameRoute({required this.gameId, super.key});

  final String gameId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final child = ref.watch(childProvider);
    final childId = child.activeChildId;

    // Resolved from the active selection rather than the path, so a deep link
    // cannot name another child and cannot report progress against them.
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
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => _GameMessage(
        icon: error is GamePackParseException
            ? Icons.extension_off_outlined
            : Icons.cloud_off_outlined,
        title: 'لم نتمكّن من فتح هذه اللعبة',
        body: 'جرّب لعبة أخرى، وسنعيد المحاولة لاحقًا.',
        // Useful in development, harmless to a child, and never the headline.
        detail: '$error',
      ),
      data: (game) => _GameHost(
        game: game,
        childId: childId,
        isTelevision: ref
            .watch(deviceProfileProvider)
            .maybeWhen(data: (profile) => profile.isTelevision, orElse: () => false),
      ),
    );
  }
}

/// Owns the session for one resolved game.
///
/// Stateful because [GameSessionController] is a `ChangeNotifier` with a lifetime:
/// it must be built once per pack and disposed, or the audio service keeps playing
/// into a screen that is gone. Building it inside `build` would restart the level
/// on every rebuild, which a child would see as a board that resets itself.
class _GameHost extends ConsumerStatefulWidget {
  const _GameHost({
    required this.game,
    required this.childId,
    required this.isTelevision,
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
      engineVersionSupported: kSupportedPackVersion,
      // Only drawing levels ever show a save button; the store is passed
      // unconditionally because the screen already decides that from the level.
      creationStore: ref.watch(localCreationStoreProvider),
    );
  }
}

/// A calm, honest dead end.
///
/// Shaped like `game_screen.dart`'s unavailable view on purpose: a child should not
/// be able to tell whether the reason was "no child selected", "not published" or
/// "no network", because none of those are their fault and none of them are errors
/// they can act on.
class _GameMessage extends StatelessWidget {
  const _GameMessage({
    required this.icon,
    required this.title,
    required this.body,
    this.detail,
  });

  final IconData icon;
  final String title;
  final String body;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Center(
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
                Text(detail!, style: Theme.of(context).textTheme.bodySmall),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
