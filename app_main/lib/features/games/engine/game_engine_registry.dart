/// The engine registry.
///
/// ## Why this exists
///
/// Before this, the app had exactly one game: `game_page.dart` hard-coded a
/// memory-match board with emoji placeholders, no pack, no server call and no
/// attempt reporting. Adding a second game would have meant a second page, and
/// `docs/games/00-overview.md` is explicit that Majarra builds engines rather
/// than games — twelve engines running unlimited content packs, so a new game is
/// "صف في CMS", a row in the CMS, not an app release.
///
/// A registry is what makes that true in the client: `engine_id` selects an
/// implementation, and content arrives as data.
///
/// ## Unknown engines
///
/// A pack can name an engine this build does not have — the CMS can publish
/// faster than app stores ship. That must degrade to a clear, calm message, never
/// a crash, so [GameEngineRegistry.resolve] returns null and the caller renders
/// an unsupported state. `docs/games/08-implementation-plan.md` lists exactly
/// this: "يتعامل بأمان مع محرك غير معروف".
library;

import 'package:flutter/widgets.dart';

import 'game_pack.dart';
import 'game_session_controller.dart';

/// What every engine implementation provides.
abstract class GameEngine {
  const GameEngine();

  String get engineId;

  /// False for engines needing a pointer, which are hidden from TV catalogues.
  bool get supportsDpad;

  /// Builds the playable surface for [level] of [pack].
  Widget build(BuildContext context, GameSessionController controller);
}

class GameEngineRegistry {
  GameEngineRegistry(Iterable<GameEngine> engines)
    : _engines = {for (final engine in engines) engine.engineId: engine};

  final Map<String, GameEngine> _engines;

  /// The engine for [engineId], or null when this build cannot run it.
  GameEngine? resolve(String engineId) => _engines[engineId];

  bool supports(String engineId) => _engines.containsKey(engineId);

  Iterable<String> get engineIds => _engines.keys;

  /// Whether a game should be offered on a television.
  ///
  /// Two independent reasons to hide it, and either is sufficient: the pack
  /// declares no D-pad support, or the registered engine needs a pointer. An
  /// unknown engine is not offered either, because nothing can be asserted about
  /// how it is played.
  bool playableOnTelevision(String engineId, {required bool packSupportsDpad}) {
    final engine = resolve(engineId);
    if (engine == null) return false;
    return engine.supportsDpad && packSupportsDpad;
  }
}

/// Reasons a game cannot be played, distinguished so the UI can say something
/// true rather than a generic error.
enum GameUnavailableReason {
  /// This build has no implementation for the pack's engine.
  unsupportedEngine,

  /// The content was authored for a newer implementation of a known engine.
  unsupportedEngineVersion,

  /// The pack schema is newer than the parser in this build.
  unsupportedPackVersion,

  /// Touch-only content opened on a television.
  requiresTouch,

  /// The pack itself could not be read.
  malformedPack,
}

class GameAvailability {
  const GameAvailability.available() : reason = null, detail = null;

  const GameAvailability.unavailable(this.reason, {this.detail});

  final GameUnavailableReason? reason;
  final String? detail;

  bool get isAvailable => reason == null;
}

/// Decides whether a resolved pack can actually run here.
///
/// [requiredEngineVersion] comes from the published game row. It is independent
/// from [pack.packVersion], which versions the JSON contract itself. Keeping the
/// two checks separate prevents a new engine implementation from accidentally
/// being accepted merely because its pack still uses an old schema (and vice
/// versa).
GameAvailability evaluateAvailability({
  required GameEngineRegistry registry,
  required String engineId,
  required GamePack? pack,
  required int requiredEngineVersion,
  required int supportedEngineVersion,
  required int supportedPackVersion,
  required bool isTelevision,
}) {
  if (pack == null) {
    return const GameAvailability.unavailable(
      GameUnavailableReason.malformedPack,
    );
  }
  final engine = registry.resolve(engineId);
  if (engine == null) {
    return GameAvailability.unavailable(
      GameUnavailableReason.unsupportedEngine,
      detail: engineId,
    );
  }
  if (requiredEngineVersion > supportedEngineVersion) {
    return GameAvailability.unavailable(
      GameUnavailableReason.unsupportedEngineVersion,
      detail:
          'engine v$requiredEngineVersion > supported v$supportedEngineVersion',
    );
  }
  if (pack.packVersion > supportedPackVersion) {
    return GameAvailability.unavailable(
      GameUnavailableReason.unsupportedPackVersion,
      detail: 'pack v${pack.packVersion} > supported v$supportedPackVersion',
    );
  }
  if (isTelevision && !(engine.supportsDpad && pack.supportsDpad)) {
    return const GameAvailability.unavailable(
      GameUnavailableReason.requiresTouch,
    );
  }
  return const GameAvailability.available();
}
