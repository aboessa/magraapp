import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/home/domain/content_models.dart';
import 'package:majarra/features/parent/application/parent_reports.dart';

void main() {
  group('ProgressEntry', () {
    test('parses server row and computes fraction', () {
      final e = ProgressEntry.fromJson({
        'content_type': 'episode',
        'content_id': 'e1',
        'position_ms': 30000,
        'duration_ms': 60000,
        'completed': 0,
        'updated_at': 123,
      });
      expect(e.contentType, 'episode');
      expect(e.fraction, closeTo(0.5, 0.001));
      expect(e.completed, isFalse);
    });

    test('completed row reads as full even without duration', () {
      final e = ProgressEntry.fromJson({
        'content_id': 'e1',
        'position_ms': 0,
        'duration_ms': 0,
        'completed': 1,
      });
      expect(e.completed, isTrue);
      expect(e.fraction, 1);
    });

    test('tolerates boolean completed', () {
      final e = ProgressEntry.fromJson({
        'completed': true,
        'duration_ms': 10,
        'position_ms': 10,
      });
      expect(e.completed, isTrue);
    });
  });

  group('MasteryEntry', () {
    test('computes accuracy', () {
      final m = MasteryEntry.fromJson({
        'objective_id': 'obj-1',
        'level': 'practicing',
        'attempts': 4,
        'correct_attempts': 3,
      });
      expect(m.accuracy, closeTo(0.75, 0.001));
    });

    test('zero attempts is zero accuracy, not NaN', () {
      final m = MasteryEntry.fromJson({
        'objective_id': 'x',
        'attempts': 0,
        'correct_attempts': 0,
      });
      expect(m.accuracy, 0);
    });
  });

  group('resolveContentTitle', () {
    final catalog = HomeCatalog(
      planets: const [],
      spotlights: const [],
      series: const [
        SeriesItem(
          id: 's1',
          title: 'مغامرات',
          description: '',
          planetName: 'p',
          posterAsset: 'a',
          bannerAsset: 'b',
          ageMin: 6,
          ageMax: 8,
          episodesCount: 1,
          type: 'series',
          isFree: true,
        ),
      ],
      episodes: const [
        EpisodeItem(
          id: 'e1',
          seriesId: 's1',
          title: 'الحلقة الأولى',
          description: '',
          seriesTitle: 'مغامرات',
          thumbnailAsset: 'a',
          durationSeconds: 60,
        ),
      ],
      experiences: const [],
      books: const [],
      source: ContentSource.bundled,
    );

    test('resolves an episode title from the catalogue', () {
      const entry = ProgressEntry(
        contentType: 'episode',
        contentId: 'e1',
        positionMs: 1,
        durationMs: 2,
        completed: false,
        updatedAt: 0,
      );
      expect(resolveContentTitle(catalog, entry), 'الحلقة الأولى');
    });

    test('falls back to the id rather than inventing a title', () {
      const entry = ProgressEntry(
        contentType: 'episode',
        contentId: 'unknown-id',
        positionMs: 1,
        durationMs: 2,
        completed: false,
        updatedAt: 0,
      );
      expect(resolveContentTitle(catalog, entry), 'unknown-id');
    });
  });
}
