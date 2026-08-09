/// Where a game's content actually comes from.
///
/// ## Why this exists
///
/// `game_screen.dart` says it deliberately knows nothing about Riverpod so it can
/// be pumped with a pack built in a test, and it names this file as the place the
/// real pack is fetched. Until now that file did not exist, and the consequence was
/// visible: the `/game/:id` route rendered `game_page.dart`, a memory board whose
/// deck was eight emoji faces and whose difficulty curve was a four-entry
/// pairs-per-level constant, both compiled into the app.
///
/// That is the failure this file prevents. `docs/games/00-overview.md` requires a
/// new game to be a CMS row rather than an app release; content compiled into the
/// binary makes that impossible in the most literal way — the card faces could only
/// be changed by shipping to the stores, and no CMS row could ever affect them.
///
/// ## What is authoritative here
///
/// Nothing. Every gameplay decision — how many pairs, which assets, how long a
/// tile stays face up, what the child is told — arrives inside
/// `data.content_pack` from `GET /api/v1/games/:id`. This file only resolves *who*
/// is playing and *which* pack, then hands both to the engine layer.
///
/// The one place data is copied rather than passed through is [_packJsonFrom],
/// which folds `engine_id` and `engine.supports_dpad` from the envelope into the
/// pack map. Those two live beside the pack rather than inside it because they
/// describe the engine registration, not the content; [GamePack] needs them to
/// resolve an engine and to decide TV playability, and inferring either one in the
/// client would make the client a second, disagreeing authority.
library;

import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../home/application/home_providers.dart';
import '../../home/data/majarra_api_client.dart';
import '../engine/game_pack.dart';
import '../engine/game_services.dart';

/// Identifies one fetch: a game, for one child, in one language.
///
/// A value type because `FutureProvider.family` keys on equality. Without `==`
/// every rebuild would look like a new key and refetch the pack, which for a child
/// mid-level would mean a fresh session and a lost board.
@immutable
class GameRequest {
  const GameRequest({required this.gameId, required this.childId, this.language});

  final String gameId;
  final String childId;

  /// Null lets the server choose from the child's profile. The server reports
  /// which language it actually served, so the client never has to guess.
  final String? language;

  @override
  bool operator ==(Object other) =>
      other is GameRequest &&
      other.gameId == gameId &&
      other.childId == childId &&
      other.language == language;

  @override
  int get hashCode => Object.hash(gameId, childId, language);
}

/// A pack plus the few facts about the game that live outside it.
///
/// Kept separate from [GamePack] because these come from the `games` row rather
/// than the authored pack: a title and an age range belong to the catalogue entry,
/// and folding them into the pack would blur which of the two a CMS editor is
/// changing.
@immutable
class ResolvedGame {
  const ResolvedGame({
    required this.gameId,
    required this.pack,
    required this.title,
    required this.ageTrack,
    required this.engineVersion,
    required this.objectiveId,
    required this.episodeId,
    required this.missingPromptKeys,
    required this.missingVoiceKeys,
  });

  final String gameId;
  final GamePack pack;

  /// The localised title, already resolved by the server's language chain.
  final String title;

  /// Derived from the game's authored age range, which is what sets the tone of
  /// feedback. Not taken from the child's own age: a pack authored for 3–5 should
  /// sound like a preschool pack even if an older sibling opens it.
  final AgeTrack ageTrack;

  /// `engine_version` the pack was authored against. Compared with what this build
  /// implements so a newer pack degrades to a clear message instead of running
  /// half-understood.
  final int engineVersion;

  final String? objectiveId;
  final String? episodeId;

  /// Content gaps the server reported. Surfaced rather than hidden: a missing
  /// prompt is a content gap the app can report, and inventing a replacement
  /// string in the client is precisely the habit this file exists to end.
  final List<String> missingPromptKeys;
  final List<String> missingVoiceKeys;

  bool get hasContentGaps =>
      missingPromptKeys.isNotEmpty || missingVoiceKeys.isNotEmpty;
}

/// The published pack for one game.
///
/// Errors are left to propagate. A game that cannot be fetched must not fall back
/// to something invented locally — that is the whole point — so the route renders
/// an honest unavailable state from the [AsyncValue] error instead.
final gamePackProvider =
    FutureProvider.family<ResolvedGame, GameRequest>((ref, request) async {
  final api = ref.watch(majarraApiClientProvider);
  final envelope = await api.fetchGame(
    gameId: request.gameId,
    childId: request.childId,
    language: request.language,
  );
  return resolvedGameFromEnvelope(request.gameId, envelope);
});

/// Turns the `GET /api/v1/games/:id` envelope into a [ResolvedGame].
///
/// A top-level function rather than a method on the provider so it can be unit
/// tested against a captured response without a network, a container or a widget.
ResolvedGame resolvedGameFromEnvelope(
  String fallbackGameId,
  Map<String, dynamic> envelope,
) {
  final data = _asMap(envelope['data']);
  if (data == null) {
    throw GamePackParseException('games response has no data object');
  }

  final pack = GamePack.fromJson(_packJsonFrom(data));
  final gaps = _asMap(data['gaps']) ?? const <String, dynamic>{};
  final objective = _asMap(data['objective']);

  return ResolvedGame(
    gameId: data['id'] as String? ?? fallbackGameId,
    pack: pack,
    // The title is content, so there is no default string here. An empty title
    // renders as an empty title, which is visible and reportable; a placeholder
    // would look like real content and hide the gap.
    title: data['title'] as String? ?? '',
    ageTrack: ageTrackForRange(
      (data['age_min'] as num?)?.toInt() ?? 3,
      (data['age_max'] as num?)?.toInt() ?? 12,
    ),
    engineVersion: (data['engine_version'] as num?)?.toInt() ?? 1,
    objectiveId: objective?['id'] as String?,
    episodeId: data['episode_id'] as String?,
    missingPromptKeys: _stringList(gaps['missing_prompt_keys']),
    missingVoiceKeys: _stringList(gaps['missing_voice_keys']),
  );
}

/// The pack map, with the two engine-level facts the envelope keeps beside it.
///
/// `content_pack` is copied before being written to: the decoded response may be
/// shared (a cache, a second parse) and mutating it in place would make a second
/// read of the same response see fields it did not contain.
Map<String, dynamic> _packJsonFrom(Map<String, dynamic> data) {
  final pack = _asMap(data['content_pack']);
  if (pack == null) {
    throw GamePackParseException('games response has no content_pack');
  }
  final engine = _asMap(data['engine']) ?? const <String, dynamic>{};
  return <String, dynamic>{
    ...pack,
    // The envelope's engine_id wins: it is the row the registry is keyed on, and a
    // pack whose embedded copy disagrees is a publishing bug the client must not
    // paper over by picking the pack's value.
    if (data['engine_id'] != null) 'engine_id': data['engine_id'],
    'supports_dpad': engine['supports_dpad'] == true,
  };
}

Map<String, dynamic>? _asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return <String, dynamic>{
      for (final entry in value.entries) entry.key.toString(): entry.value,
    };
  }
  return null;
}

List<String> _stringList(Object? value) =>
    value is List ? value.whereType<String>().toList(growable: false) : const [];

/// Sends attempts to `POST /api/v1/family/progress`.
///
/// Failures are swallowed on purpose. A dropped connection must not interrupt a
/// child mid-level, and `event_id` is stable for the attempt, so the write is
/// idempotent and a later retry cannot double-count it. [failures] keeps the count
/// visible so a silently unreported session is still observable in development
/// rather than looking like a child who never played.
class ApiAttemptReporter implements AttemptReporter {
  ApiAttemptReporter(this._api);

  final MajarraApiClient _api;

  int failures = 0;

  @override
  Future<void> report(GameAttempt attempt) async {
    try {
      await _api.postGameAttempt(attempt.toJson());
    } catch (error) {
      failures++;
      // Reported, never rethrown: the engine's next step is a level transition the
      // child is waiting for.
      debugPrint('attempt report failed (${attempt.eventId}): $error');
    }
  }
}

final attemptReporterProvider = Provider<AttemptReporter>((ref) {
  return ApiAttemptReporter(ref.watch(majarraApiClientProvider));
});

/// The audio player for packs.
///
/// [SilentGameAudioService] is still the honest implementation: no voice-over has
/// been recorded for any pack, and it records what *would* have played. A real
/// player is a swap here and nowhere else, because every engine speaks through the
/// session rather than reaching for audio itself.
final gameAudioServiceProvider = Provider<GameAudioService>((ref) {
  return SilentGameAudioService();
});

/// A stable-per-attempt id for the idempotent progress write.
///
/// Time plus randomness rather than a UUID package: the value only needs to be
/// unique among a family's writes, and the server treats it as an opaque key.
String newEventId() {
  final random = Random();
  final suffix = random.nextInt(1 << 32).toRadixString(16).padLeft(8, '0');
  return 'evt-${DateTime.now().microsecondsSinceEpoch.toRadixString(16)}-$suffix';
}
