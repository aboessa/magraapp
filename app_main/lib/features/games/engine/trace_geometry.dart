/// Tracing geometry and scoring.
///
/// Pure Dart on purpose: no Flutter imports, so every rule below is unit
/// testable without pumping a widget. The widget layer in
/// `trace_color_engine.dart` owns pixels and gestures; this file owns the maths
/// and the pedagogy.
///
/// ## Coordinate space
///
/// Packs store points normalised 0..1 (`docs/games/schemas/trace_color.v1`), so
/// one geometry serves every screen. Everything here works in *logical pixels*
/// after the caller multiplies by the canvas size, because `tolerance_dp` is a
/// physical forgiveness budget and only means something in dp.
///
/// ## What is and is not measured
///
/// Coverage of the guide path is the pass condition. Deviation is measured and
/// reported but is deliberately **not** a failure condition: the engine contract
/// says leaving the path stops the line at the last valid point and glows the
/// next one — "لا فشل · لا إعادة من البداية · لا عدّ محاولات". Nothing in this
/// file can fail a child.
library;

import 'dart:math' as math;

/// A point in normalised pack space (0..1 on both axes).
class NormalizedPoint {
  const NormalizedPoint(this.x, this.y);

  factory NormalizedPoint.fromJson(List<dynamic> json) {
    return NormalizedPoint(
      (json[0] as num).toDouble(),
      (json[1] as num).toDouble(),
    );
  }

  final double x;
  final double y;

  /// Scales into logical pixels for a square-ish canvas of [width] x [height].
  Offset2D scale(double width, double height) => Offset2D(x * width, y * height);

  @override
  String toString() => '($x, $y)';
}

/// A minimal 2D point so this library stays free of Flutter's `Offset`.
class Offset2D {
  const Offset2D(this.dx, this.dy);

  final double dx;
  final double dy;

  double distanceTo(Offset2D other) {
    final dx0 = dx - other.dx;
    final dy0 = dy - other.dy;
    return math.sqrt(dx0 * dx0 + dy0 * dy0);
  }

  @override
  String toString() => '($dx, $dy)';
}

enum StrokeKind { stroke, dot }

/// One stroke of a glyph or path, as authored.
class TraceStroke {
  const TraceStroke({
    required this.id,
    required this.order,
    required this.points,
    this.kind = StrokeKind.stroke,
    this.reversed = false,
  });

  factory TraceStroke.fromJson(Map<String, dynamic> json) {
    final rawPoints = (json['points'] as List<dynamic>? ?? const [])
        .map((entry) => NormalizedPoint.fromJson(entry as List<dynamic>))
        .toList(growable: false);
    return TraceStroke(
      id: json['id'] as String? ?? '',
      order: (json['order'] as num?)?.toInt() ?? 1,
      points: rawPoints,
      kind: json['type'] == 'dot' ? StrokeKind.dot : StrokeKind.stroke,
      reversed: json['direction'] == 'reverse',
    );
  }

  final String id;
  final int order;
  final List<NormalizedPoint> points;
  final StrokeKind kind;
  final bool reversed;

  /// A dot is tapped rather than dragged, so it is complete the moment it is hit.
  bool get isDot => kind == StrokeKind.dot;
}

/// Resamples a polyline into points spaced at most [spacing] apart.
///
/// Authored strokes are sparse — an Arabic letter body can be three points — so
/// coverage measured against the raw points would be satisfied by touching three
/// spots and skipping everything between them. Resampling turns the path into a
/// dense set of checkpoints, which is what makes "80% coverage" mean 80% of the
/// *path* rather than 80% of the author's clicks.
List<Offset2D> resamplePath(List<Offset2D> points, double spacing) {
  if (points.isEmpty) return const [];
  if (points.length == 1 || spacing <= 0) return List<Offset2D>.of(points);

  final output = <Offset2D>[points.first];
  for (var i = 1; i < points.length; i++) {
    final start = points[i - 1];
    final end = points[i];
    final segmentLength = start.distanceTo(end);
    if (segmentLength == 0) continue;
    final steps = (segmentLength / spacing).ceil();
    for (var step = 1; step <= steps; step++) {
      final t = step / steps;
      output.add(Offset2D(
        start.dx + (end.dx - start.dx) * t,
        start.dy + (end.dy - start.dy) * t,
      ));
    }
  }
  return output;
}

/// Shortest distance from [point] to the segment [a]..[b].
///
/// Point-to-*segment*, not point-to-line: a child tracing near the middle of a
/// stroke must not be judged against the infinite extension of that stroke.
double distanceToSegment(Offset2D point, Offset2D a, Offset2D b) {
  final dx = b.dx - a.dx;
  final dy = b.dy - a.dy;
  final lengthSquared = dx * dx + dy * dy;
  if (lengthSquared == 0) return point.distanceTo(a);
  var t = ((point.dx - a.dx) * dx + (point.dy - a.dy) * dy) / lengthSquared;
  t = t.clamp(0.0, 1.0);
  return point.distanceTo(Offset2D(a.dx + dx * t, a.dy + dy * t));
}

/// Shortest distance from [point] to a polyline.
double distanceToPath(Offset2D point, List<Offset2D> path) {
  if (path.isEmpty) return double.infinity;
  if (path.length == 1) return point.distanceTo(path.first);
  var best = double.infinity;
  for (var i = 1; i < path.length; i++) {
    final distance = distanceToSegment(point, path[i - 1], path[i]);
    if (distance < best) best = distance;
  }
  return best;
}

/// The measurement for one stroke attempt.
class StrokeEvaluation {
  const StrokeEvaluation({
    required this.coverage,
    required this.maxDeviation,
    required this.complete,
    required this.coveredCount,
    required this.checkpointCount,
  });

  /// 0..1 fraction of the guide path's checkpoints the child came within
  /// tolerance of.
  final double coverage;

  /// Largest distance, in dp, from any of the child's points to the guide path.
  /// Reported for the parent report and for hint escalation. Never a failure.
  final double maxDeviation;

  final bool complete;
  final int coveredCount;
  final int checkpointCount;
}

/// Scores one stroke against what the child drew.
///
/// [checkpoints] is the resampled guide path in dp. [drawn] is the child's
/// sampled pointer positions in dp. [toleranceDp] is the forgiveness radius, and
/// [coverageRequired] the fraction of checkpoints that must be touched.
StrokeEvaluation evaluateStroke({
  required List<Offset2D> checkpoints,
  required List<Offset2D> drawn,
  required double toleranceDp,
  required double coverageRequired,
}) {
  if (checkpoints.isEmpty) {
    return const StrokeEvaluation(
      coverage: 0,
      maxDeviation: 0,
      complete: false,
      coveredCount: 0,
      checkpointCount: 0,
    );
  }

  final covered = List<bool>.filled(checkpoints.length, false);
  var maxDeviation = 0.0;

  for (final point in drawn) {
    for (var i = 0; i < checkpoints.length; i++) {
      if (covered[i]) continue;
      if (point.distanceTo(checkpoints[i]) <= toleranceDp) covered[i] = true;
    }
    final deviation = distanceToPath(point, checkpoints);
    if (deviation > maxDeviation) maxDeviation = deviation;
  }

  final coveredCount = covered.where((value) => value).length;
  final coverage = coveredCount / checkpoints.length;
  return StrokeEvaluation(
    coverage: coverage,
    maxDeviation: maxDeviation,
    complete: coverage >= coverageRequired,
    coveredCount: coveredCount,
    checkpointCount: checkpoints.length,
  );
}

/// Whether a tap lands on a dot stroke.
bool dotHit({
  required Offset2D tap,
  required Offset2D target,
  required double toleranceDp,
  required double minTouchTargetDp,
}) {
  // A dot is a single authored point, so the hit radius is the *larger* of the
  // trace tolerance and half the minimum touch target. Using the trace tolerance
  // alone would make a 24dp diacritic harder to hit than any button in the app.
  final radius = math.max(toleranceDp, minTouchTargetDp / 2);
  return tap.distanceTo(target) <= radius;
}

/// The active accessibility profile for a level.
///
/// `simplified` is not a lesser mode: it is the mandatory alternative from
/// `docs/games/06-accessibility.md`, without which children with motor
/// difficulty are excluded from the one engine built for motor skills.
class TraceTolerance {
  const TraceTolerance({
    required this.toleranceDp,
    required this.coverageRequired,
  });

  final double toleranceDp;
  final double coverageRequired;
}

/// Resolves the thresholds actually applied to a level.
///
/// Three inputs combine, and the order matters:
///  1. the level's authored values;
///  2. simplified motor mode, which replaces them wholesale when enabled;
///  3. the help ladder, which widens tolerance after repeated stalling.
///
/// The result can only ever be *easier* than the authored values. That is
/// asserted by tests, because an accessibility path that made tracing harder
/// would be worse than having none.
TraceTolerance resolveTolerance({
  required double levelToleranceDp,
  required double levelCoverageRequired,
  required bool simplifiedMotor,
  double? simplifiedToleranceDp,
  double? simplifiedCoverageRequired,
  int stallCount = 0,
}) {
  var tolerance = levelToleranceDp;
  var coverage = levelCoverageRequired;

  if (simplifiedMotor) {
    if (simplifiedToleranceDp != null) {
      tolerance = math.max(tolerance, simplifiedToleranceDp);
    }
    if (simplifiedCoverageRequired != null) {
      coverage = math.min(coverage, simplifiedCoverageRequired);
    }
  }

  // The engine contract's third rung: after the third stall the deviation
  // budget widens automatically. 24dp -> 36dp for the authored default.
  if (stallCount >= 3) {
    tolerance = math.max(tolerance, levelToleranceDp * 1.5);
  }

  return TraceTolerance(toleranceDp: tolerance, coverageRequired: coverage);
}

/// The help ladder from `docs/games/engines/02-trace-color.md`.
///
/// Escalates guidance and never blocks: rung 4 shows the whole motion and lets
/// the child try again. There is no rung that says "you failed".
enum TraceHelpLevel {
  /// Nothing yet.
  none,

  /// The next checkpoint glows.
  glowNextPoint,

  /// An animated direction arrow appears.
  directionArrow,

  /// Tolerance widens automatically.
  widenTolerance,

  /// The full guided motion plays, then the child retries.
  showFullMotion,
}

TraceHelpLevel helpLevelForStalls(int stallCount) {
  if (stallCount <= 0) return TraceHelpLevel.none;
  if (stallCount == 1) return TraceHelpLevel.glowNextPoint;
  if (stallCount == 2) return TraceHelpLevel.directionArrow;
  if (stallCount == 3) return TraceHelpLevel.widenTolerance;
  return TraceHelpLevel.showFullMotion;
}

/// Whether help at [level] counts as assistance for the mastery model.
///
/// Glowing the next point is ambient feedback that is always on screen, so it is
/// not assistance. Widening tolerance or showing the solution is, and mastery
/// must record it: a child who succeeded at 36dp after three stalls is
/// `assisted`, not `independent`.
bool helpCountsAsAssistance(TraceHelpLevel level) {
  return level == TraceHelpLevel.widenTolerance ||
      level == TraceHelpLevel.showFullMotion ||
      level == TraceHelpLevel.directionArrow;
}
