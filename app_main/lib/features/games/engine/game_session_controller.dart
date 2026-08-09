/// Orchestrates one play session: which level, what the child has done, when to
/// speak, and what to report.
///
/// A `ChangeNotifier` rather than a Riverpod notifier so the engine widgets can
/// be pumped in tests without a `ProviderScope`, and because a session is
/// short-lived state owned by one screen.
///
/// Level progression, scoring and attempt reporting live here rather than in each
/// engine, so a second engine cannot invent its own rules for them.
library;

import 'package:flutter/foundation.dart';

import 'game_pack.dart';
import 'game_services.dart';
import 'trace_geometry.dart';
import 'trace_session.dart';

/// What the child is currently doing within a level.
enum LevelPhase {
  /// Tracing, connecting or copying — the measured part, if any.
  drawing,

  /// The free colouring stage that follows tracing. Never scored.
  coloring,

  /// The level is finished and the child may move on.
  finished,
}

class GameSessionController extends ChangeNotifier {
  GameSessionController({
    required this.pack,
    required this.gameId,
    required this.childId,
    required this.ageTrack,
    required GameAudioService audio,
    required AttemptReporter reporter,
    required String Function() eventIdFactory,
    this.objectiveId,
    this.episodeId,
    this.helpLadder = const HelpLadder(),
    this.feedback = const FeedbackService(),
    GameAccessibilitySettings settings = const GameAccessibilitySettings(),
    DateTime Function()? clock,
  })  : _audio = audio,
        _reporter = reporter,
        _eventIdFactory = eventIdFactory,
        _settings = settings,
        _clock = clock ?? DateTime.now {
    _levelStartedAt = _clock();
    _openLevel(0);
  }

  final GamePack pack;
  final String gameId;
  final String childId;
  final String? objectiveId;
  final String? episodeId;
  final AgeTrack ageTrack;
  final HelpLadder helpLadder;
  final FeedbackService feedback;

  final GameAudioService _audio;
  final AttemptReporter _reporter;
  final String Function() _eventIdFactory;
  final DateTime Function() _clock;

  GameAccessibilitySettings _settings;
  GameAccessibilitySettings get settings => _settings;

  int _levelIndex = 0;
  LevelPhase _phase = LevelPhase.drawing;
  TraceSession? _traceSession;
  /// Set in the constructor body and again on every level open, so it is `late`
  /// rather than nullable: there is no meaningful "no start time" state.
  late DateTime _levelStartedAt;

  /// Dots connected so far, for `connect_dots`.
  final List<String> _connectedDots = [];

  /// Region -> colour, for colouring. Held on the device; nothing is uploaded
  /// unless the child explicitly saves.
  final Map<String, String> _regionColors = {};

  /// Stable per-level attempt id, so a retried network call cannot double-count.
  String _eventId = '';

  bool _reportedForLevel = false;

  GameLevel get level => pack.levels[_levelIndex];
  int get levelIndex => _levelIndex;
  int get levelCount => pack.levels.length;
  LevelPhase get phase => _phase;
  TraceSession? get traceSession => _traceSession;
  Map<String, String> get regionColors => Map.unmodifiable(_regionColors);
  List<String> get connectedDots => List.unmodifiable(_connectedDots);

  /// True once every level required to finish has been completed.
  bool get gameComplete => _levelIndex >= pack.progression.levelsToFinish - 1 &&
      _phase == LevelPhase.finished;

  TraceHelpLevel get helpLevel =>
      helpLadder.levelFor(_traceSession?.stalls ?? 0);

  /// The prompt to show, or null when this pack is not localised for the chosen
  /// language. The UI shows the instruction fallback rather than a raw key.
  String? get prompt => level.prompt;

  void _openLevel(int index) {
    _levelIndex = index;
    _phase = LevelPhase.drawing;
    _connectedDots.clear();
    _regionColors.clear();
    _reportedForLevel = false;
    _eventId = _eventIdFactory();
    _levelStartedAt = _clock();

    final current = pack.levels[index];
    _traceSession = current.strokes.isEmpty
        ? null
        : TraceSession(
            level: current,
            accessibility: pack.accessibility,
            canvasWidth: 1,
            canvasHeight: 1,
            simplifiedMotor: _settings.simplifiedMotor,
          );

    // A level with nothing to trace starts in its own terminal phase: colouring
    // when there is a template, otherwise straight to free drawing which the
    // child ends themselves.
    if (current.strokes.isEmpty && current.dots.isEmpty) {
      _phase = current.hasColoringStage ? LevelPhase.coloring : LevelPhase.drawing;
    }
  }

  Future<void> start() async {
    await _audio.preload(pack.voiceManifest);
    await _audio.play(VoiceKeys.intro);
    await _audio.play(VoiceKeys.instruction);
  }

  Future<void> repeatInstruction() => _audio.repeatInstruction();

  /// Plays one voice key from the pack's manifest.
  ///
  /// [FeedbackService.voiceKeyFor] covers the five events every engine shares.
  /// Wave 2 engines have contracted keys of their own — `vo.count.7`,
  /// `vo.stage_predict`, `vo.hint_older`, `vo.block.move` — enumerated in
  /// `docs/games/engines/*.md`. Routing them through the session keeps the audio
  /// service the single player, so a missing recording is reported in one place
  /// instead of each engine inventing a fallback.
  Future<void> speakVoiceKey(String voiceKey) => _audio.play(voiceKey);

  void resizeCanvas(double width, double height) {
    _traceSession?.resize(width, height);
  }

  void updateSettings(GameAccessibilitySettings next) {
    _settings = next;
    final session = _traceSession;
    if (session != null && session.simplifiedMotor != next.simplifiedMotor) {
      // Applied to the live session rather than requiring a restart: a child who
      // is struggling should benefit the moment a parent enables it.
      session.simplifiedMotor = next.simplifiedMotor;
      session.resize(session.canvasWidth, session.canvasHeight);
    }
    notifyListeners();
  }

  // --- tracing -------------------------------------------------------------

  void beginStroke(Offset2D point) {
    final session = _traceSession;
    final stroke = session?.activeStroke;
    if (session == null || stroke == null) return;
    session.beginStroke(stroke, point);
    notifyListeners();
  }

  void extendStroke(Offset2D point) {
    _traceSession?.extend(point);
    notifyListeners();
  }

  Future<void> endStroke() async {
    final session = _traceSession;
    if (session == null) return;
    final completed = session.endStroke();
    notifyListeners();
    if (completed) {
      await _afterStrokeComplete(session);
    } else if (helpLevel != TraceHelpLevel.none) {
      await _speak(FeedbackEvent.guidance);
    }
  }

  Future<void> tap(Offset2D point) async {
    final session = _traceSession;
    if (session == null) return;
    final completed = session.tap(point);
    notifyListeners();
    if (completed) await _afterStrokeComplete(session);
  }

  Future<void> _afterStrokeComplete(TraceSession session) async {
    await _speak(FeedbackEvent.strokeComplete);
    if (!session.levelComplete) return;
    await _finishDrawingPhase();
  }

  Future<void> _speak(FeedbackEvent event) async {
    // Haptic first and unawaited: it is decoration, and the state machine must not
    // queue behind it.
    feedback.emit(event, track: ageTrack);
    final key = feedback.voiceKeyFor(event);
    if (key != null) await _audio.play(key);
  }

  // --- connect the dots ----------------------------------------------------

  /// Registers a tap on a dot. Only the next dot in order counts, which is what
  /// makes the measurement a sequence rather than a set.
  Future<void> connectDot(String dotId) async {
    if (level.mode != DrawingMode.connectDots) return;
    final expected = level.dots
        .firstWhere((dot) => !_connectedDots.contains(dot.id),
            orElse: () => level.dots.last);
    if (expected.id != dotId || _connectedDots.contains(dotId)) {
      // Out-of-order taps are ignored, not punished.
      return;
    }
    _connectedDots.add(dotId);
    notifyListeners();
    if (_connectedDots.length == level.dots.length) {
      await _finishDrawingPhase();
    }
  }

  // --- colouring and free drawing -----------------------------------------

  /// Paints a region. Never scored, and never validated against a "correct"
  /// colour: the engine contract gives colouring no success condition at all.
  void paintRegion(String regionId, String color) {
    _regionColors[regionId] = color;
    notifyListeners();
  }

  Future<void> _finishDrawingPhase() async {
    // The measured part is over, so the attempt is reported now. Colouring that
    // follows cannot change the score, and reporting here means a child who
    // wanders off during colouring still has their tracing recorded.
    await _reportAttempt(completed: true);

    if (level.hasColoringStage) {
      _phase = LevelPhase.coloring;
      notifyListeners();
      await _speak(FeedbackEvent.coloringIntro);
      return;
    }
    await _completeLevel();
  }

  /// The child's own "done" button. Available at all times during colouring and
  /// free drawing.
  Future<void> markDone() async {
    if (_phase == LevelPhase.finished) return;
    if (!_reportedForLevel) {
      // Reached when the level had nothing to measure. `score` is 0 out of a
      // `maxScore` of 0, which is what an unscored level should contribute.
      await _reportAttempt(completed: true);
    }
    await _completeLevel();
  }

  Future<void> _completeLevel() async {
    _phase = LevelPhase.finished;
    notifyListeners();
    await _speak(FeedbackEvent.levelComplete);
    if (_levelIndex >= pack.progression.levelsToFinish - 1) {
      await _speak(FeedbackEvent.gameComplete);
    }
  }

  /// Advances to the next level, if there is one.
  void nextLevel() {
    if (_levelIndex + 1 >= pack.levels.length) return;
    _openLevel(_levelIndex + 1);
    notifyListeners();
  }

  void undo() {
    _traceSession?.undo();
    notifyListeners();
  }

  void clear() {
    _traceSession?.clear();
    _regionColors.clear();
    _connectedDots.clear();
    notifyListeners();
  }

  // --- reporting -----------------------------------------------------------

  /// The raw level JSON for the current level, for engines whose level shape
  /// [GameLevel] does not model.
  Map<String, dynamic> get rawLevel =>
      _levelIndex < pack.rawLevels.length ? pack.rawLevels[_levelIndex] : const {};

  /// Reports an attempt on behalf of an engine that computes its own score.
  ///
  /// Trace levels go through [_reportAttempt], which derives the score from the
  /// session. The other engines measure different things — matched pairs, sorted
  /// items, a correct order — so they supply the numbers, and this keeps the
  /// event id, idempotency and payload shape identical for all of them.
  ///
  /// `maxScore` may be 0 for an entertainment-first engine, which reports that it
  /// was played without producing a mark.
  Future<void> reportEngineAttempt({
    required int score,
    required int maxScore,
    required List<Map<String, Object?>> answers,
    bool helpUsed = false,
    bool completed = true,
  }) async {
    if (_reportedForLevel) return;
    _reportedForLevel = true;
    final seconds = _clock().difference(_levelStartedAt).inSeconds;
    await _reporter.report(GameAttempt(
      eventId: _eventId,
      childId: childId,
      gameId: gameId,
      episodeId: episodeId,
      objectiveId: objectiveId,
      score: score,
      maxScore: maxScore,
      timeSpentSeconds: seconds < 0 ? 0 : seconds,
      helpUsed: helpUsed,
      answers: answers,
      completed: completed,
    ));
  }

  /// Ends the level from an engine, after it has reported.
  Future<void> finishLevelFromEngine() => _completeLevel();

  Future<void> _reportAttempt({required bool completed}) async {
    if (_reportedForLevel) return;
    _reportedForLevel = true;

    final session = _traceSession;
    final seconds = _clock().difference(_levelStartedAt).inSeconds;

    final answers = <Map<String, Object?>>[
      if (session != null)
        for (final metric in session.metrics()) metric.toJson(),
      if (level.mode == DrawingMode.connectDots)
        {
          'dots_connected': _connectedDots.length,
          'dots_total': level.dots.length,
        },
    ];

    await _reporter.report(GameAttempt(
      eventId: _eventId,
      childId: childId,
      gameId: gameId,
      episodeId: episodeId,
      objectiveId: objectiveId,
      // An unscored level reports 0/0: it happened, and it is not a mark.
      score: session?.score ?? 0,
      maxScore: level.maxScore,
      timeSpentSeconds: seconds < 0 ? 0 : seconds,
      helpUsed: session?.usedAssistance ?? false,
      answers: answers,
      completed: completed,
    ));
  }

  @override
  void dispose() {
    _audio.stopAll();
    super.dispose();
  }
}
