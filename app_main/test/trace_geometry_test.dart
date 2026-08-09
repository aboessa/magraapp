/// Tests for the tracing maths and the pedagogy encoded around it.
///
/// Pure Dart, no widget pumping: every rule here is a property of the geometry
/// layer and should be provable without a canvas.

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/engine/trace_geometry.dart';

/// Walks a straight line, sampling as a finger would.
List<Offset2D> walk(Offset2D from, Offset2D to, int samples) {
  return List.generate(samples + 1, (index) {
    final t = index / samples;
    return Offset2D(
      from.dx + (to.dx - from.dx) * t,
      from.dy + (to.dy - from.dy) * t,
    );
  });
}

void main() {
  group('resamplePath', () {
    test('densifies a sparse authored stroke', () {
      // An Arabic letter body can be three authored points. Coverage measured
      // against those alone would be satisfied by touching three spots and
      // skipping everything between them.
      final path = [const Offset2D(0, 0), const Offset2D(100, 0)];
      final resampled = resamplePath(path, 10);
      expect(resampled.length, 11);
      expect(resampled.first.dx, 0);
      expect(resampled.last.dx, 100);
    });

    test('keeps a single point and tolerates zero-length segments', () {
      expect(resamplePath([const Offset2D(5, 5)], 10).length, 1);
      expect(resamplePath([], 10), isEmpty);
      final duplicated = resamplePath(
        [const Offset2D(0, 0), const Offset2D(0, 0), const Offset2D(10, 0)],
        5,
      );
      expect(duplicated.length, greaterThan(1));
    });
  });

  group('distanceToSegment', () {
    test('measures to the segment, not its infinite extension', () {
      // A child tracing near the middle of a stroke must not be judged against
      // the line continued beyond its endpoints.
      const a = Offset2D(0, 0);
      const b = Offset2D(10, 0);
      expect(distanceToSegment(const Offset2D(5, 3), a, b), closeTo(3, 0.001));
      // Beyond the end: distance to the endpoint, which is 10, not 0.
      expect(distanceToSegment(const Offset2D(20, 0), a, b), closeTo(10, 0.001));
    });

    test('handles a degenerate segment', () {
      expect(
        distanceToSegment(const Offset2D(3, 4), const Offset2D(0, 0), const Offset2D(0, 0)),
        closeTo(5, 0.001),
      );
    });
  });

  group('evaluateStroke', () {
    final checkpoints = resamplePath(
      [const Offset2D(0, 0), const Offset2D(100, 0)],
      12,
    );

    test('a full trace completes the stroke', () {
      final result = evaluateStroke(
        checkpoints: checkpoints,
        drawn: walk(const Offset2D(0, 0), const Offset2D(100, 0), 50),
        toleranceDp: 24,
        coverageRequired: 0.8,
      );
      expect(result.coverage, 1.0);
      expect(result.complete, isTrue);
      expect(result.maxDeviation, closeTo(0, 0.001));
    });

    test('half a trace does not reach 80% coverage', () {
      final result = evaluateStroke(
        checkpoints: checkpoints,
        drawn: walk(const Offset2D(0, 0), const Offset2D(50, 0), 25),
        toleranceDp: 10,
        coverageRequired: 0.8,
      );
      expect(result.coverage, lessThan(0.8));
      expect(result.complete, isFalse);
    });

    test('deviation is measured but never fails the stroke', () {
      // The engine contract has no failure state: wandering off the path is
      // reported, and the stroke still completes if coverage was reached.
      final wobbly = <Offset2D>[
        ...walk(const Offset2D(0, 0), const Offset2D(100, 0), 60),
        const Offset2D(50, 40),
      ];
      final result = evaluateStroke(
        checkpoints: checkpoints,
        drawn: wobbly,
        toleranceDp: 24,
        coverageRequired: 0.8,
      );
      expect(result.maxDeviation, greaterThan(24));
      expect(result.complete, isTrue,
          reason: 'high deviation must not fail a stroke that met coverage');
    });

    test('a wider tolerance forgives an imprecise trace', () {
      final offset = walk(const Offset2D(0, 18), const Offset2D(100, 18), 50);
      final strict = evaluateStroke(
        checkpoints: checkpoints, drawn: offset,
        toleranceDp: 12, coverageRequired: 0.8,
      );
      final relaxed = evaluateStroke(
        checkpoints: checkpoints, drawn: offset,
        toleranceDp: 24, coverageRequired: 0.8,
      );
      expect(strict.complete, isFalse);
      expect(relaxed.complete, isTrue);
    });

    test('an empty guide path cannot be completed or crash', () {
      final result = evaluateStroke(
        checkpoints: const [], drawn: const [Offset2D(0, 0)],
        toleranceDp: 24, coverageRequired: 0.8,
      );
      expect(result.complete, isFalse);
      expect(result.checkpointCount, 0);
    });
  });

  group('dotHit', () {
    test('a diacritic is never harder to hit than a button', () {
      // With a 24dp trace tolerance a dot would be a 24dp target, smaller than
      // anything else in the app. The radius is the larger of the tolerance and
      // half the minimum touch target.
      final hit = dotHit(
        tap: const Offset2D(30, 0),
        target: const Offset2D(0, 0),
        toleranceDp: 24,
        minTouchTargetDp: 64,
      );
      expect(hit, isTrue);
    });

    test('a clear miss is still a miss', () {
      expect(
        dotHit(
          tap: const Offset2D(200, 200),
          target: const Offset2D(0, 0),
          toleranceDp: 24,
          minTouchTargetDp: 64,
        ),
        isFalse,
      );
    });
  });

  group('resolveTolerance', () {
    test('simplified motor mode is easier, never stricter', () {
      final resolved = resolveTolerance(
        levelToleranceDp: 24,
        levelCoverageRequired: 0.8,
        simplifiedMotor: true,
        simplifiedToleranceDp: 40,
        simplifiedCoverageRequired: 0.6,
      );
      expect(resolved.toleranceDp, 40);
      expect(resolved.coverageRequired, 0.6);
    });

    test('a badly authored simplified mode cannot make tracing harder', () {
      // An accessibility path that raised the bar would be worse than none,
      // because it would be applied to the children least able to meet it.
      final resolved = resolveTolerance(
        levelToleranceDp: 32,
        levelCoverageRequired: 0.7,
        simplifiedMotor: true,
        simplifiedToleranceDp: 16,
        simplifiedCoverageRequired: 0.95,
      );
      expect(resolved.toleranceDp, 32);
      expect(resolved.coverageRequired, 0.7);
    });

    test('the third stall widens tolerance automatically', () {
      // The engine contract's third rung: 24dp becomes 36dp.
      final resolved = resolveTolerance(
        levelToleranceDp: 24,
        levelCoverageRequired: 0.8,
        simplifiedMotor: false,
        stallCount: 3,
      );
      expect(resolved.toleranceDp, 36);
    });

    test('normal mode leaves the authored values alone', () {
      final resolved = resolveTolerance(
        levelToleranceDp: 24,
        levelCoverageRequired: 0.8,
        simplifiedMotor: false,
      );
      expect(resolved.toleranceDp, 24);
      expect(resolved.coverageRequired, 0.8);
    });
  });

  group('help ladder', () {
    test('escalates guidance and never terminates', () {
      expect(helpLevelForStalls(0), TraceHelpLevel.none);
      expect(helpLevelForStalls(1), TraceHelpLevel.glowNextPoint);
      expect(helpLevelForStalls(2), TraceHelpLevel.directionArrow);
      expect(helpLevelForStalls(3), TraceHelpLevel.widenTolerance);
      expect(helpLevelForStalls(4), TraceHelpLevel.showFullMotion);
      // There is no rung beyond showing the motion: it repeats rather than
      // locking the child out.
      expect(helpLevelForStalls(99), TraceHelpLevel.showFullMotion);
    });

    test('ambient glow is not assistance, widening and solving are', () {
      // Mastery depends on this: a child who succeeded only at 36dp is
      // `assisted`, not `independent`.
      expect(helpCountsAsAssistance(TraceHelpLevel.none), isFalse);
      expect(helpCountsAsAssistance(TraceHelpLevel.glowNextPoint), isFalse);
      expect(helpCountsAsAssistance(TraceHelpLevel.directionArrow), isTrue);
      expect(helpCountsAsAssistance(TraceHelpLevel.widenTolerance), isTrue);
      expect(helpCountsAsAssistance(TraceHelpLevel.showFullMotion), isTrue);
    });
  });

  group('NormalizedPoint', () {
    test('scales into canvas pixels', () {
      const point = NormalizedPoint(0.5, 0.25);
      final scaled = point.scale(200, 400);
      expect(scaled.dx, 100);
      expect(scaled.dy, 100);
    });

    test('parses the pack representation', () {
      final point = NormalizedPoint.fromJson([0.8, 0.45]);
      expect(point.x, 0.8);
      expect(point.y, 0.45);
    });
  });
}
