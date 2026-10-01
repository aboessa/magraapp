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

  group('WeeklyReport (APP-207)', () {
    final json = <String, dynamic>{
      'week_start': '2026-09-22',
      'local_date': '2026-09-28',
      'daily': [
        for (var i = 22; i <= 28; i++)
          {'date': '2026-09-$i', 'minutes': i == 28 ? 10 : (i == 22 ? 5 : 0)},
      ],
      'minutes_this_week': 15,
      'minutes_last_week': 20,
      'change_percent': -25,
      'active_days': 2,
      'daily_limit_minutes': null,
      'top_series': [
        {'series_id': 's1', 'title': 'سلسلة', 'minutes': 12},
      ],
      'completed': [
        {
          'content_type': 'episode',
          'content_id': 'e1',
          'title': null,
          'completed_at': 1,
        },
      ],
      'attempts': 3,
      'games_played': 2,
      'accuracy': null,
      'mastered': [
        {'objective_id': 'o1', 'title': 'العد لعشرة'},
      ],
      'needs_review': <Object>[],
    };

    test('parses the server report', () {
      final r = WeeklyReport.fromJson(json);
      expect(r.minutesThisWeek, 15);
      expect(r.changePercent, -25);
      expect(r.daily, hasLength(7));
      expect(r.peakMinutes, 10);
      expect(r.topSeries.single.title, 'سلسلة');
      expect(
        r.completed.single.title,
        isNull,
        reason: 'a missing title stays null, never invented',
      );
      expect(r.accuracy, isNull, reason: 'no scored games is not 0%');
      expect(r.mastered.single.title, 'العد لعشرة');
      expect(r.isEmpty, isFalse);
    });

    test('an empty week is empty', () {
      final r = WeeklyReport.fromJson({
        'daily': <Object>[],
        'minutes_this_week': 0,
      });
      expect(r.isEmpty, isTrue);
      expect(r.changePercent, isNull);
    });

    test('weekday labels come from the local date', () {
      // 2026-09-28 is a Monday.
      expect(
        const WeeklyDay(date: '2026-09-28', minutes: 0).weekdayLabel,
        'إثنين',
      );
      expect(const WeeklyDay(date: 'bad', minutes: 0).weekdayLabel, '');
    });

    test('server mastery levels get parent labels', () {
      expect(masteryLevelLabel('independent'), 'متقَن');
      expect(masteryLevelLabel('needs_review'), 'محتاج مراجعة');
    });
  });
}
