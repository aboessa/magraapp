/// The tracing state machine for one level.
///
/// Pure Dart, so stroke ordering, coverage and the help ladder are testable
/// without a widget. The widget calls [beginStroke], [extend] and [endStroke] as
/// pointer events arrive and renders whatever [strokeStates] says.
///
/// ## The rule that shapes everything
///
/// This class cannot fail a child. There is no failure state, no attempt limit
/// and no restart-from-zero, because `docs/games/engines/02-trace-color.md` says
/// so: "لا فشل · لا إعادة من البداية · لا عدّ محاولات". Leaving the path ends the
/// current attempt at the last valid point and escalates *guidance*. A stall is
/// counted only to decide how much help to offer, never to judge the child.
library;

import 'game_pack.dart';
import 'trace_geometry.dart';

enum StrokeStatus {
  /// Not yet reachable: an earlier stroke in the order is still incomplete.
  locked,

  /// The stroke the child should draw now.
  active,

  /// Done.
  complete,
}

class StrokeState {
  const StrokeState({
    required this.stroke,
    required this.status,
    required this.coverage,
    required this.maxDeviation,
    required this.assisted,
  });

  final TraceStroke stroke;
  final StrokeStatus status;
  final double coverage;
  final double maxDeviation;

  /// True when this stroke was only completed after tolerance was widened or the
  /// solution was shown. Mastery needs this to tell `assisted` from
  /// `independent`.
  final bool assisted;
}

/// Per-stroke metrics safe to report to the server.
///
/// Deliberately not the raw points. Stroke coordinates are a child's hand
/// movement and have no analytical value once coverage and deviation are known,
/// so they never leave the device.
class StrokeMetric {
  const StrokeMetric({
    required this.strokeId,
    required this.coverage,
    required this.deviationDp,
    required this.completed,
    required this.helpLevel,
  });

  final String strokeId;
  final double coverage;
  final double deviationDp;
  final bool completed;
  final int helpLevel;

  Map<String, Object?> toJson() => {
        'stroke': strokeId,
        // Two decimals: enough to see progress, not enough to reconstruct a path.
        'coverage': double.parse(coverage.toStringAsFixed(2)),
        'deviation_dp': deviationDp.round(),
        'completed': completed,
        'help_level': helpLevel,
      };
}

class TraceSession {
  TraceSession({
    required this.level,
    required this.accessibility,
    required this.canvasWidth,
    required this.canvasHeight,
    this.simplifiedMotor = false,
  }) {
    _rebuildCheckpoints();
  }

  final GameLevel level;
  final PackAccessibility accessibility;
  double canvasWidth;
  double canvasHeight;

  /// When true the level runs with the mandatory easier thresholds.
  bool simplifiedMotor;

  final Map<String, _StrokeProgress> _progress = {};
  final Map<String, List<Offset2D>> _checkpoints = {};

  /// Points of the stroke currently being drawn, in dp.
  final List<Offset2D> _current = [];
  String? _currentStrokeId;

  /// Stalls on the *active* stroke only, which is what the help ladder escalates
  /// on. Reset when the stroke completes so help does not carry over.
  int _stalls = 0;

  void resize(double width, double height) {
    if (width == canvasWidth && height == canvasHeight) return;
    canvasWidth = width;
    canvasHeight = height;
    _rebuildCheckpoints();
  }

  void _rebuildCheckpoints() {
    _checkpoints.clear();
    for (final stroke in level.strokes) {
      if (stroke.isDot) {
        _checkpoints[stroke.id] = [
          stroke.points.first.scale(canvasWidth, canvasHeight),
        ];
        continue;
      }
      final scaled = stroke.points
          .map((point) => point.scale(canvasWidth, canvasHeight))
          .toList(growable: false);
      // Checkpoint spacing at half the tolerance: dense enough that coverage
      // means the path rather than the author's clicks, sparse enough to stay
      // cheap to evaluate on every pointer move.
      _checkpoints[stroke.id] = resamplePath(scaled, _tolerance.toleranceDp / 2);
    }
  }

  TraceTolerance get _tolerance => resolveTolerance(
        levelToleranceDp: level.toleranceDp,
        levelCoverageRequired: level.coverageRequired,
        simplifiedMotor: simplifiedMotor,
        simplifiedToleranceDp: accessibility.simplifiedMotor.toleranceDp,
        simplifiedCoverageRequired: accessibility.simplifiedMotor.coverageRequired,
        stallCount: _stalls,
      );

  /// The thresholds in force right now, for display and for tests.
  TraceTolerance get activeTolerance => _tolerance;

  TraceHelpLevel get helpLevel => helpLevelForStalls(_stalls);

  int get stalls => _stalls;

  /// The stroke the child should draw next, or null when the level is done.
  ///
  /// Order is authoritative: for `geometric_ordered` levels only the
  /// lowest-numbered incomplete stroke is active, which is how "body before
  /// dots" is enforced rather than merely rendered.
  TraceStroke? get activeStroke {
    for (final stroke in level.strokes) {
      if (!(_progress[stroke.id]?.complete ?? false)) {
        return stroke;
      }
    }
    return null;
  }

  /// Whether [stroke] may accept input now.
  ///
  /// Unordered levels let any incomplete stroke be drawn, because there is no
  /// pedagogical order to protect.
  bool acceptsInput(TraceStroke stroke) {
    if (_progress[stroke.id]?.complete ?? false) return false;
    if (!level.scoring.enforcesOrder) return true;
    return activeStroke?.id == stroke.id;
  }

  List<StrokeState> get strokeStates {
    final active = activeStroke;
    return level.strokes.map((stroke) {
      final progress = _progress[stroke.id];
      final complete = progress?.complete ?? false;
      final status = complete
          ? StrokeStatus.complete
          : (!level.scoring.enforcesOrder || active?.id == stroke.id)
              ? StrokeStatus.active
              : StrokeStatus.locked;
      return StrokeState(
        stroke: stroke,
        status: status,
        coverage: progress?.coverage ?? 0,
        maxDeviation: progress?.maxDeviation ?? 0,
        assisted: progress?.assisted ?? false,
      );
    }).toList(growable: false);
  }

  /// True when every stroke is complete.
  bool get levelComplete => level.strokes.isNotEmpty &&
      level.strokes.every((stroke) => _progress[stroke.id]?.complete ?? false);

  /// Score for this level: completed strokes, per the mastery document's table.
  int get score {
    if (!level.scoring.isScored) return 0;
    return level.strokes
        .where((stroke) => _progress[stroke.id]?.complete ?? false)
        .length;
  }

  /// True when any stroke was completed with real assistance.
  bool get usedAssistance =>
      _progress.values.any((progress) => progress.assisted);

  /// Registers a tap, used for dot strokes and the sequential-tap alternative.
  ///
  /// Returns true when the tap completed a stroke.
  bool tap(Offset2D point) {
    final stroke = activeStroke;
    if (stroke == null) return false;

    if (stroke.isDot) {
      final target = _checkpoints[stroke.id]!.first;
      final hit = dotHit(
        tap: point,
        target: target,
        toleranceDp: _tolerance.toleranceDp,
        minTouchTargetDp: accessibility.minTouchTargetDp,
      );
      if (!hit) {
        _stalls++;
        return false;
      }
      _progress[stroke.id] = _StrokeProgress(
        coverage: 1,
        maxDeviation: point.distanceTo(target),
        complete: true,
        assisted: helpCountsAsAssistance(helpLevelForStalls(_stalls)),
      );
      _stalls = 0;
      return true;
    }

    // Sequential-tap alternative: tapping the checkpoints in turn is the
    // mandatory substitute for continuous dragging. Each tap covers every
    // checkpoint within tolerance, so a child who cannot drag can still finish.
    if (!accessibility.sequentialTapAlternative) return false;
    return _accumulate(stroke, [point], endAttempt: false);
  }

  void beginStroke(TraceStroke stroke, Offset2D point) {
    if (!acceptsInput(stroke)) return;
    _currentStrokeId = stroke.id;
    _current
      ..clear()
      ..add(point);
  }

  void extend(Offset2D point) {
    if (_currentStrokeId == null) return;
    _current.add(point);
  }

  /// Ends the current drag and folds it into the stroke's progress.
  ///
  /// Returns true when the stroke is now complete.
  bool endStroke() {
    final strokeId = _currentStrokeId;
    if (strokeId == null) return false;
    final stroke = level.strokes.firstWhere((entry) => entry.id == strokeId);
    final points = List<Offset2D>.of(_current);
    _current.clear();
    _currentStrokeId = null;
    return _accumulate(stroke, points, endAttempt: true);
  }

  /// Folds [points] into [stroke]'s accumulated coverage.
  ///
  /// Coverage accumulates across attempts rather than resetting, which is the
  /// mechanical expression of "no restart from the beginning": a child who
  /// traces half, lifts their finger, and traces the rest has traced the whole
  /// stroke.
  bool _accumulate(TraceStroke stroke, List<Offset2D> points, {required bool endAttempt}) {
    final checkpoints = _checkpoints[stroke.id] ?? const <Offset2D>[];
    final previous = _progress[stroke.id];
    final combined = <Offset2D>[...?previous?.points, ...points];

    final evaluation = evaluateStroke(
      checkpoints: checkpoints,
      drawn: combined,
      toleranceDp: _tolerance.toleranceDp,
      coverageRequired: _tolerance.coverageRequired,
    );

    final assisted = (previous?.assisted ?? false) ||
        helpCountsAsAssistance(helpLevelForStalls(_stalls));

    _progress[stroke.id] = _StrokeProgress(
      coverage: evaluation.coverage,
      maxDeviation: evaluation.maxDeviation,
      complete: evaluation.complete,
      assisted: assisted,
      points: combined,
    );

    if (evaluation.complete) {
      _stalls = 0;
      return true;
    }
    // An attempt that ended without completing the stroke is a stall, which
    // moves the help ladder up one rung. Nothing else happens: no message, no
    // counter shown to the child, no progress lost.
    if (endAttempt) {
      _stalls++;
      // Widening tolerance can retroactively satisfy the stroke the child just
      // drew, so re-evaluate rather than making them trace it again at the
      // easier setting.
      if (_stalls >= 3) {
        final relaxed = evaluateStroke(
          checkpoints: checkpoints,
          drawn: combined,
          toleranceDp: _tolerance.toleranceDp,
          coverageRequired: _tolerance.coverageRequired,
        );
        if (relaxed.complete) {
          _progress[stroke.id] = _StrokeProgress(
            coverage: relaxed.coverage,
            maxDeviation: relaxed.maxDeviation,
            complete: true,
            assisted: true,
            points: combined,
          );
          _stalls = 0;
          return true;
        }
      }
    }
    return false;
  }

  /// Clears everything the child drew on this level.
  ///
  /// Offered as an explicit child action. It does not reset the stall count,
  /// because help already earned should not be taken away by tidying up.
  void clear() {
    _progress.clear();
    _current.clear();
    _currentStrokeId = null;
  }

  /// Undoes the last completed stroke, or the in-progress drag.
  void undo() {
    if (_current.isNotEmpty) {
      _current.clear();
      _currentStrokeId = null;
      return;
    }
    for (final stroke in level.strokes.reversed) {
      if (_progress.containsKey(stroke.id)) {
        _progress.remove(stroke.id);
        return;
      }
    }
  }

  /// Metrics for the attempt report. Contains no coordinates.
  List<StrokeMetric> metrics() {
    return level.strokes.map((stroke) {
      final progress = _progress[stroke.id];
      return StrokeMetric(
        strokeId: stroke.id,
        coverage: progress?.coverage ?? 0,
        deviationDp: progress?.maxDeviation ?? 0,
        completed: progress?.complete ?? false,
        helpLevel: progress?.assisted ?? false ? 1 : 0,
      );
    }).toList(growable: false);
  }
}

class _StrokeProgress {
  const _StrokeProgress({
    required this.coverage,
    required this.maxDeviation,
    required this.complete,
    required this.assisted,
    this.points = const [],
  });

  final double coverage;
  final double maxDeviation;
  final bool complete;
  final bool assisted;

  /// Retained only for the lifetime of the level so a lifted finger can resume a
  /// partly traced stroke. Never reported, never persisted.
  final List<Offset2D> points;
}
