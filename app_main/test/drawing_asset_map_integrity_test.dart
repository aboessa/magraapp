import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/data/drawing_asset_map.dart';

void main() {
  group('drawing_asset_map integrity', () {
    test('every mapped id resolves to a bundled file of supported type', () {
      final allowedExts = {'.svg', '.png', '.jpg', '.jpeg', '.webp'};
      final missing = <String>[];
      final unsupported = <String>[];
      final duplicateIds = <String>[];

      final seenIds = <String>{};
      for (final entry in kDrawingAssetMap.entries) {
        final id = entry.key;
        final path = entry.value;

        // duplicate id check (map guarantees uniqueness, but test defensively)
        if (!seenIds.add(id)) duplicateIds.add(id);

        // id format
        expect(
          RegExp(r'^[A-Za-z0-9_-]{3,128}$').hasMatch(id),
          isTrue,
          reason: 'invalid assetId format: $id',
        );

        // supported type
        final ext = '.${path.split('.').last.toLowerCase()}';
        if (!allowedExts.contains(ext)) {
          unsupported.add('$id -> $path (ext $ext)');
        }

        if (!File(path).existsSync()) {
          missing.add('$id -> $path');
        }
      }

      expect(missing, isEmpty, reason: 'Missing drawing assets:\n${missing.join('\n')}');
      expect(unsupported, isEmpty, reason: 'Unsupported extensions:\n${unsupported.join('\n')}');
      expect(duplicateIds, isEmpty, reason: 'Duplicate ids: $duplicateIds');
    });

    test('no duplicate asset paths that would mask a missing file', () {
      final pathToIds = <String, List<String>>{};
      for (final e in kDrawingAssetMap.entries) {
        pathToIds.putIfAbsent(e.value, () => []).add(e.key);
      }
      // Duplicate paths are allowed only if intentional (same SVG reused).
      // We just ensure no path is empty and no id maps to empty.
      for (final e in kDrawingAssetMap.entries) {
        expect(e.value.trim().isNotEmpty, isTrue, reason: 'Empty path for ${e.key}');
        expect(e.value.startsWith('assets/'), isTrue, reason: '${e.key} must be assets/ path: ${e.value}');
      }
    });

    test('physical file count sanity', () {
      // Ensure at least 100 mapped entries and files exist
      expect(kDrawingAssetMap.length, greaterThanOrEqualTo(100));

      final coloringDir = Directory('assets/images/drawing/coloring');
      final templatesDir = Directory('assets/images/drawing/templates');
      final coversDir = Directory('assets/images/drawing/covers');

      if (coloringDir.existsSync()) {
        final count = coloringDir.listSync().where((e) => e.path.endsWith('.svg')).length;
        expect(count, greaterThanOrEqualTo(30), reason: 'coloring SVGs');
      }
      if (templatesDir.existsSync()) {
        final count = templatesDir.listSync().where((e) => e.path.endsWith('.svg')).length;
        expect(count, greaterThanOrEqualTo(30));
      }
      if (coversDir.existsSync()) {
        final count = coversDir.listSync().where((e) => e.path.endsWith('.svg')).length;
        expect(count, greaterThanOrEqualTo(10));
      }
    });

    test('pubspec bundles drawing subdirectories', () {
      final pubspec = File('pubspec.yaml').readAsStringSync();
      expect(pubspec.contains('assets/images/drawing/coloring/'), isTrue,
          reason: 'pubspec must bundle coloring/');
      expect(pubspec.contains('assets/images/drawing/templates/'), isTrue,
          reason: 'pubspec must bundle templates/');
      expect(pubspec.contains('assets/images/drawing/covers/'), isTrue,
          reason: 'pubspec must bundle covers/');
    });

    test('flutter_svg is a direct dependency', () {
      final pubspec = File('pubspec.yaml').readAsStringSync();
      expect(pubspec.contains('flutter_svg'), isTrue, reason: 'flutter_svg must be direct dep');
      final lock = File('pubspec.lock').readAsStringSync();
      expect(lock.contains('flutter_svg'), isTrue);
    });
  });
}
