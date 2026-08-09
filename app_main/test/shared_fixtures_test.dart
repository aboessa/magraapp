/// The Dart half of the shared-fixture agreement.
///
/// Two implementations of `block_code`'s semantics exist on purpose: this one plays
/// the game, and `dashboard/api/src/lib/blockCodeSim.ts` verifies that an authored
/// `reference_solution` actually solves its level before the pack may publish. Two
/// implementations can drift, so both are driven by the same file —
/// `docs/games/fixtures/block_code_cases.json` — and a divergence fails one of the
/// two suites rather than shipping a hint that walks into a wall.
///
/// The same arrangement covers the map region bounds, which the client uses to draw
/// and hit-test and the server uses to reject an event placed off the edge of the
/// map a child will see.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/engine/block_code_engine.dart';
import 'package:majarra/features/games/engine/timeline_map_engine.dart';

/// Reads a fixture at group-declaration time.
///
/// Throws rather than using `expect`, because the fixture is read while the test
/// tree is being built and matchers are only valid inside a running test.
Map<String, dynamic> loadFixture(String name) {
  final file = File('../docs/games/fixtures/$name');
  if (!file.existsSync()) {
    throw StateError('missing shared fixture ${file.path}');
  }
  return jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
}

void main() {
  group('block_code shared fixture', () {
    final fixture = loadFixture('block_code_cases.json');
    final cases = (fixture['cases'] as List).cast<Map<String, dynamic>>();

    test('the fixture is not empty, so a silent pass is impossible', () {
      expect(cases.length, greaterThanOrEqualTo(10));
    });

    for (final testCase in cases) {
      test('${testCase['name']}', () {
        final gridJson = Map<String, dynamic>.from(testCase['grid'] as Map);
        final grid = BlockGrid.fromJson(gridJson);
        final program = BlockProgram(
          main: (testCase['program'] as List)
              .cast<String>()
              .map(ProgramBlock.parse)
              .whereType<ProgramBlock>()
              .toList(),
          function: ((testCase['function'] as List?) ?? const [])
              .cast<String>()
              .map(ProgramBlock.parse)
              .whereType<ProgramBlock>()
              .toList(),
        );

        final interpreter = BlockInterpreter(grid: grid);
        final trace = interpreter.run(program);
        final last = trace.last;
        final expected = Map<String, dynamic>.from(testCase['expect'] as Map);

        expect(last.x, expected['x'], reason: 'x');
        expect(last.y, expected['y'], reason: 'y');
        expect(last.facing.name, expected['facing'], reason: 'facing');
        expect(last.collected.length, expected['collected'], reason: 'collected');
        expect(last.collided, expected['collided'], reason: 'collided');
        expect(interpreter.reachedGoal(last), expected['reached_goal'], reason: 'reached_goal');
      });
    }
  });

  group('map region shared fixture', () {
    final fixture = loadFixture('map_regions.json');

    test('every documented region has the documented bounds', () {
      final regions = Map<String, dynamic>.from(fixture['regions'] as Map);
      for (final entry in regions.entries) {
        final expected = Map<String, dynamic>.from(entry.value as Map);
        final bounds = MapBounds.forRegion(entry.key);
        expect(bounds.minLat, expected['min_lat'], reason: '${entry.key} minLat');
        expect(bounds.maxLat, expected['max_lat'], reason: '${entry.key} maxLat');
        expect(bounds.minLon, expected['min_lon'], reason: '${entry.key} minLon');
        expect(bounds.maxLon, expected['max_lon'], reason: '${entry.key} maxLon');
      }
    });

    test('known places fall inside exactly the regions the fixture names', () {
      final places = (fixture['known_places'] as List).cast<Map<String, dynamic>>();
      final regions = Map<String, dynamic>.from(fixture['regions'] as Map).keys;
      for (final place in places) {
        final lat = (place['lat'] as num).toDouble();
        final lon = (place['lon'] as num).toDouble();
        final inside = (place['inside'] as List).cast<String>();
        for (final region in regions) {
          final bounds = MapBounds.forRegion(region);
          final within = lat >= bounds.minLat && lat <= bounds.maxLat
              && lon >= bounds.minLon && lon <= bounds.maxLon;
          expect(within, inside.contains(region), reason: '${place['name']} in $region');
        }
      }
    });

    test('distances match the fixture within its stated tolerance', () {
      final distances = (fixture['distances_km'] as List).cast<Map<String, dynamic>>();
      for (final entry in distances) {
        final from = (entry['from'] as List).cast<num>();
        final to = (entry['to'] as List).cast<num>();
        final km = distanceKm(
          from[0].toDouble(), from[1].toDouble(),
          to[0].toDouble(), to[1].toDouble(),
        );
        expect(
          km,
          closeTo((entry['expect_km'] as num).toDouble(), (entry['tolerance_km'] as num).toDouble()),
        );
      }
    });
  });
}
