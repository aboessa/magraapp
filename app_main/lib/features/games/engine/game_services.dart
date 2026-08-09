/// Shared services every engine uses.
///
/// `docs/games/08-implementation-plan.md` marks the encouragement layer, the help
/// ladder and the accessibility layer as critical and explains why: implemented
/// per engine they would produce "12 سلوكًا مختلفًا" — twelve different
/// behaviours — and the guarantee that a child never gets stuck would be
/// unenforceable. They live here, once.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'game_pack.dart';
import 'trace_geometry.dart';

/// Age tracks, which set the tone of feedback.
enum AgeTrack { preschool, kids, junior }

AgeTrack ageTrackForRange(int ageMin, int ageMax) {
  if (ageMax <= 5) return AgeTrack.preschool;
  if (ageMax <= 8) return AgeTrack.kids;
  return AgeTrack.junior;
}

/// What the child is told, and when.
///
/// The vocabulary is deliberately narrow. There is no `onIncorrect`, because the
/// engines that use this have no incorrect state — the closest thing is a stall,
/// which asks for guidance rather than announcing a mistake.
enum FeedbackEvent {
  strokeComplete,
  levelComplete,
  gameComplete,
  guidance,
  coloringIntro,
}

/// Voice keys, matching `voice_manifest` in the pack.
class VoiceKeys {
  static const intro = 'vo.intro';
  static const instruction = 'vo.instruction';
  static const instructionRepeat = 'vo.instruction_repeat';
  static const hint = 'vo.hint';
  static const strokeComplete = 'vo.stroke_complete';
  static const coloringIntro = 'vo.coloring_intro';
  static const levelComplete = 'vo.level_complete';
  static const gameComplete = 'vo.game_complete';
  static const exitConfirm = 'vo.exit_confirm';
}

/// Plays the pack's voice-over.
///
/// An interface rather than a concrete player because no audio has been recorded
/// for any pack yet. [SilentGameAudioService] is the honest default: it records
/// what *would* have played, which keeps the engine's call sites real and
/// testable without inventing audio files that do not exist.
abstract class GameAudioService {
  Future<void> preload(Map<String, String> voiceManifest);
  Future<void> play(String voiceKey);
  Future<void> repeatInstruction();
  void stopAll();
}

class SilentGameAudioService implements GameAudioService {
  SilentGameAudioService();

  final List<String> played = [];
  Map<String, String> _manifest = const {};

  @override
  Future<void> preload(Map<String, String> voiceManifest) async {
    _manifest = voiceManifest;
  }

  /// Voice keys with no asset behind them. Surfaced rather than swallowed so an
  /// unrecorded pack is visible in development.
  List<String> get missingKeys => _manifest.entries
      .where((entry) => entry.value.isEmpty)
      .map((entry) => entry.key)
      .toList(growable: false);

  @override
  Future<void> play(String voiceKey) async {
    played.add(voiceKey);
  }

  @override
  Future<void> repeatInstruction() => play(VoiceKeys.instructionRepeat);

  @override
  void stopAll() {}
}

/// Encouragement and haptics.
///
/// Praise names what the child did rather than judging them, which is the
/// yadi-tasnaa series rule — "تسمية لا مدح", naming not praising. The strings
/// themselves come from the pack's localisation, so this only decides *when* and
/// with what emphasis.
class FeedbackService {
  const FeedbackService({this.hapticsEnabled = true});

  final bool hapticsEnabled;

  /// Fires the haptic for [event].
  ///
  /// Deliberately not awaited and deliberately `void`. Haptics are decoration; a
  /// slow or missing platform channel must not delay a level transition or an
  /// attempt report. Making this awaitable once meant the whole pedagogical flow
  /// queued behind a buzz, which was observable as a completed stroke that never
  /// advanced the level.
  void emit(FeedbackEvent event, {required AgeTrack track}) {
    if (!hapticsEnabled) return;
    switch (event) {
      case FeedbackEvent.strokeComplete:
        HapticFeedback.lightImpact().ignore();
      case FeedbackEvent.levelComplete:
        HapticFeedback.mediumImpact().ignore();
      case FeedbackEvent.gameComplete:
        HapticFeedback.mediumImpact().ignore();
      case FeedbackEvent.guidance:
      case FeedbackEvent.coloringIntro:
        // No haptic for guidance: a buzz when a child is already struggling
        // reads as a buzzer.
        break;
    }
  }

  /// The voice key for an event, or null when nothing should be said.
  String? voiceKeyFor(FeedbackEvent event) {
    switch (event) {
      case FeedbackEvent.strokeComplete: return VoiceKeys.strokeComplete;
      case FeedbackEvent.levelComplete: return VoiceKeys.levelComplete;
      case FeedbackEvent.gameComplete: return VoiceKeys.gameComplete;
      case FeedbackEvent.guidance: return VoiceKeys.hint;
      case FeedbackEvent.coloringIntro: return VoiceKeys.coloringIntro;
    }
  }
}

/// The help ladder, shared so every engine escalates identically.
class HelpLadder {
  const HelpLadder({
    this.hintAfterStalls = 2,
    this.simplifyAfterStalls = 3,
    this.solutionAfterStalls = 4,
  });

  factory HelpLadder.fromJson(Map<String, dynamic>? json) {
    final data = json ?? const <String, dynamic>{};
    return HelpLadder(
      hintAfterStalls: (data['hint_after_failed_attempts'] as num?)?.toInt() ?? 2,
      simplifyAfterStalls: (data['simplify_after_failed_attempts'] as num?)?.toInt() ?? 3,
      solutionAfterStalls: (data['solution_after_failed_attempts'] as num?)?.toInt() ?? 4,
    );
  }

  final int hintAfterStalls;
  final int simplifyAfterStalls;
  final int solutionAfterStalls;

  /// The rung for [stalls].
  ///
  /// Delegates to [helpLevelForStalls] so the ladder cannot disagree with the
  /// tolerance widening that the geometry layer applies at the same rung.
  TraceHelpLevel levelFor(int stalls) => helpLevelForStalls(stalls);

  /// Whether the repeat-instruction button is shown. Always true: the data
  /// contract makes `repeat_instructions_button` mandatory in every pack.
  bool get showsRepeatButton => true;
}

/// One attempt, as reported to the server.
///
/// Shape matches `POST /api/v1/family/progress`. `eventId` is stable for the
/// life of the attempt so a retry cannot double-count it.
@immutable
class GameAttempt {
  const GameAttempt({
    required this.eventId,
    required this.childId,
    required this.gameId,
    required this.score,
    required this.maxScore,
    required this.timeSpentSeconds,
    required this.helpUsed,
    required this.answers,
    required this.completed,
    this.episodeId,
    this.objectiveId,
  });

  final String eventId;
  final String childId;
  final String gameId;
  final String? episodeId;
  final String? objectiveId;
  final int score;
  final int maxScore;
  final int timeSpentSeconds;
  final bool helpUsed;
  final bool completed;

  /// Per-stroke metrics only. No coordinates, no free text, no pixels.
  final List<Map<String, Object?>> answers;

  Map<String, Object?> toJson() => {
        'child_id': childId,
        'content_type': 'game',
        'content_id': gameId,
        'game_id': gameId,
        if (episodeId != null) 'episode_id': episodeId,
        if (objectiveId != null) 'objective_id': objectiveId,
        'event_id': eventId,
        'position_ms': 0,
        'duration_ms': 0,
        'completed': completed,
        'score': score,
        'max_score': maxScore,
        'answers': answers,
        'time_spent': timeSpentSeconds,
        'help_used': helpUsed,
      };
}

/// Sends attempts. An interface so the engine can be tested without a network.
abstract class AttemptReporter {
  Future<void> report(GameAttempt attempt);
}

/// Collects attempts in memory. Used by tests and by the CMS preview, where
/// nothing should be written to a child's record.
class RecordingAttemptReporter implements AttemptReporter {
  final List<GameAttempt> attempts = [];

  @override
  Future<void> report(GameAttempt attempt) async {
    attempts.add(attempt);
  }
}

/// Accessibility settings that apply across engines.
@immutable
class GameAccessibilitySettings {
  const GameAccessibilitySettings({
    this.simplifiedMotor = false,
    this.reduceMotion = false,
    this.hapticsEnabled = true,
  });

  /// The mandatory easier tracing mode.
  final bool simplifiedMotor;

  /// Honours the platform's reduce-motion preference: guided animations are
  /// shortened rather than removed, so the guidance still exists.
  final bool reduceMotion;

  final bool hapticsEnabled;

  GameAccessibilitySettings copyWith({
    bool? simplifiedMotor,
    bool? reduceMotion,
    bool? hapticsEnabled,
  }) {
    return GameAccessibilitySettings(
      simplifiedMotor: simplifiedMotor ?? this.simplifiedMotor,
      reduceMotion: reduceMotion ?? this.reduceMotion,
      hapticsEnabled: hapticsEnabled ?? this.hapticsEnabled,
    );
  }
}

/// Minimum touch target, never smaller than the platform floor.
///
/// The pack may ask for more (64dp for preschool) but never less than 48dp, so a
/// badly authored pack cannot produce targets a small hand misses.
double effectiveTouchTarget(PackAccessibility accessibility) {
  const platformFloor = 48.0;
  return accessibility.minTouchTargetDp < platformFloor
      ? platformFloor
      : accessibility.minTouchTargetDp;
}
