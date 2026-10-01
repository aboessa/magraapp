import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../home/application/home_providers.dart';
import '../../home/domain/content_models.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// One watched/read/played item for a child, from `GET /family/progress`.
class ProgressEntry {
  const ProgressEntry({
    required this.contentType,
    required this.contentId,
    required this.positionMs,
    required this.durationMs,
    required this.completed,
    required this.updatedAt,
  });

  factory ProgressEntry.fromJson(Map<String, Object?> json) {
    int intOf(String k) {
      final v = json[k];
      if (v is int) return v;
      if (v is num) return v.toInt();
      if (v is String) return int.tryParse(v) ?? 0;
      return 0;
    }

    return ProgressEntry(
      contentType: (json['content_type'] as String?)?.trim() ?? '',
      contentId: (json['content_id'] as String?)?.trim() ?? '',
      positionMs: intOf('position_ms'),
      durationMs: intOf('duration_ms'),
      completed: json['completed'] == 1 || json['completed'] == true,
      updatedAt: intOf('updated_at'),
    );
  }

  final String contentType;
  final String contentId;
  final int positionMs;
  final int durationMs;
  final bool completed;
  final int updatedAt;

  /// Fraction watched in 0..1. Zero when the duration is unknown, so a missing
  /// duration reads as "not started" rather than a misleading full bar.
  double get fraction {
    if (durationMs <= 0) return completed ? 1 : 0;
    return (positionMs / durationMs).clamp(0.0, 1.0);
  }
}

/// One mastered/attempted learning objective, from `GET /family/mastery`.
class MasteryEntry {
  const MasteryEntry({
    required this.objectiveId,
    required this.level,
    required this.attempts,
    required this.correctAttempts,
  });

  factory MasteryEntry.fromJson(Map<String, Object?> json) {
    int intOf(String k) {
      final v = json[k];
      if (v is int) return v;
      if (v is num) return v.toInt();
      return 0;
    }

    return MasteryEntry(
      objectiveId: (json['objective_id'] as String?)?.trim() ?? '',
      level: (json['level'] as String?)?.trim() ?? '',
      attempts: intOf('attempts'),
      correctAttempts: intOf('correct_attempts'),
    );
  }

  final String objectiveId;
  final String level;
  final int attempts;
  final int correctAttempts;

  double get accuracy =>
      attempts <= 0 ? 0 : (correctAttempts / attempts).clamp(0.0, 1.0);
}

/// An aggregated, privacy-conscious summary for the dashboard.
///
/// Deliberately a set of family-friendly totals and a short "recent" list, not a
/// raw behavioural timeline: the product asks for useful summaries, not
/// surveillance. Every field here is derived from real server rows.
class ChildActivitySummary {
  const ChildActivitySummary({
    required this.inProgress,
    required this.completed,
    required this.recent,
    required this.rewardsCount,
    required this.mastery,
  });

  /// Items started but not finished.
  final List<ProgressEntry> inProgress;

  /// Items marked complete.
  final List<ProgressEntry> completed;

  /// Most-recent items regardless of state, newest first (capped).
  final List<ProgressEntry> recent;

  final int rewardsCount;
  final List<MasteryEntry> mastery;

  bool get isEmpty => recent.isEmpty && rewardsCount == 0 && mastery.isEmpty;
}

/// Resolves a progress row's content id to a human title using the catalogue.
///
/// Returns the id itself as a last resort so a title is never invented; an id is
/// at least truthful and lets a parent recognise repeated items.
String resolveContentTitle(HomeCatalog? catalog, ProgressEntry entry) {
  if (catalog == null) return entry.contentId;
  for (final e in catalog.episodes) {
    if (e.id == entry.contentId) return e.title;
  }
  for (final s in catalog.series) {
    if (s.id == entry.contentId) return s.title;
  }
  for (final b in catalog.books) {
    if (b.id == entry.contentId) return b.title;
  }
  for (final x in catalog.experiences) {
    if (x.id == entry.contentId) return x.title;
  }
  return entry.contentId;
}

/// Fetches and aggregates the active child's activity from the three real
/// endpoints. Keyed by child id so switching profiles refetches.
final childActivitySummaryProvider =
    FutureProvider.family<ChildActivitySummary, String>((ref, childId) async {
      final api = ref.watch(majarraApiClientProvider);

      // Fetched together; a failure in one must not blank the whole dashboard, so
      // each is guarded and contributes what it can.
      final progressRows = await api
          .fetchProgress(childId: childId)
          .catchError((_) => <Map<String, Object?>>[]);
      final rewardRows = await api
          .fetchRewards(childId: childId)
          .catchError((_) => <Map<String, Object?>>[]);
      final masteryRows = await api
          .fetchMastery(childId: childId)
          .catchError((_) => <Map<String, Object?>>[]);

      final progress = progressRows.map(ProgressEntry.fromJson).toList();
      final mastery = masteryRows.map(MasteryEntry.fromJson).toList();

      final completed = progress.where((p) => p.completed).toList();
      final inProgress = progress
          .where((p) => !p.completed && p.positionMs > 0)
          .toList();
      final recent = progress.take(8).toList();

      return ChildActivitySummary(
        inProgress: inProgress,
        completed: completed,
        recent: recent,
        rewardsCount: rewardRows.length,
        mastery: mastery,
      );
    });

/// `APP-207`: one week of a child's activity, from `GET /family/reports/weekly`.
///
/// The minutes are the same seconds the screen-time limits count, by the
/// family's local date. Totals and short lists only, like [ChildActivitySummary].
class WeeklyReport {
  const WeeklyReport({
    required this.weekStart,
    required this.localDate,
    required this.daily,
    required this.minutesThisWeek,
    required this.minutesLastWeek,
    required this.changePercent,
    required this.activeDays,
    required this.dailyLimitMinutes,
    required this.topSeries,
    required this.completed,
    required this.attempts,
    required this.gamesPlayed,
    required this.accuracy,
    required this.mastered,
    required this.needsReview,
  });

  factory WeeklyReport.fromJson(Map<String, dynamic> json) {
    int toInt(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
    int? toIntOrNull(Object? v) => v is num ? v.toInt() : null;
    List<Map<String, dynamic>> maps(Object? v) =>
        v is List ? v.whereType<Map<String, dynamic>>().toList() : const [];
    String? title(Map<String, dynamic> m) {
      final t = m['title'];
      return t is String && t.trim().isNotEmpty ? t.trim() : null;
    }

    return WeeklyReport(
      weekStart: '${json['week_start'] ?? ''}',
      localDate: '${json['local_date'] ?? ''}',
      daily: maps(json['daily'])
          .map(
            (d) => WeeklyDay(
              date: '${d['date'] ?? ''}',
              minutes: toInt(d['minutes']),
            ),
          )
          .toList(),
      minutesThisWeek: toInt(json['minutes_this_week']),
      minutesLastWeek: toInt(json['minutes_last_week']),
      changePercent: toIntOrNull(json['change_percent']),
      activeDays: toInt(json['active_days']),
      dailyLimitMinutes: toIntOrNull(json['daily_limit_minutes']),
      topSeries: maps(json['top_series'])
          .map(
            (s) => WeeklyTitled(
              id: '${s['series_id'] ?? ''}',
              title: title(s),
              minutes: toInt(s['minutes']),
            ),
          )
          .toList(),
      completed: maps(json['completed'])
          .map(
            (c) => WeeklyTitled(
              id: '${c['content_id'] ?? ''}',
              title: title(c),
              contentType: '${c['content_type'] ?? ''}',
            ),
          )
          .toList(),
      attempts: toInt(json['attempts']),
      gamesPlayed: toInt(json['games_played']),
      accuracy: toIntOrNull(json['accuracy']),
      mastered: maps(json['mastered'])
          .map(
            (m) =>
                WeeklyTitled(id: '${m['objective_id'] ?? ''}', title: title(m)),
          )
          .toList(),
      needsReview: maps(json['needs_review'])
          .map(
            (m) =>
                WeeklyTitled(id: '${m['objective_id'] ?? ''}', title: title(m)),
          )
          .toList(),
    );
  }

  final String weekStart;
  final String localDate;
  final List<WeeklyDay> daily;
  final int minutesThisWeek;
  final int minutesLastWeek;

  /// Null when last week had no minutes: a percentage from zero means nothing.
  final int? changePercent;
  final int activeDays;
  final int? dailyLimitMinutes;
  final List<WeeklyTitled> topSeries;
  final List<WeeklyTitled> completed;
  final int attempts;
  final int gamesPlayed;

  /// Null when nothing scored was played (drawings are unscored).
  final int? accuracy;
  final List<WeeklyTitled> mastered;
  final List<WeeklyTitled> needsReview;

  bool get isEmpty =>
      minutesThisWeek == 0 &&
      completed.isEmpty &&
      attempts == 0 &&
      mastered.isEmpty;

  int get peakMinutes =>
      daily.fold<int>(0, (max, d) => d.minutes > max ? d.minutes : max);
}

class WeeklyDay {
  const WeeklyDay({required this.date, required this.minutes});
  final String date;
  final int minutes;

  /// Arabic weekday initial for the chart, from the local date string.
  String get weekdayLabel {
    final parsed = DateTime.tryParse(date);
    if (parsed == null) return '';
    final names = [
      AppLocalizationsAr().parentparentreportsGet01,
      AppLocalizationsAr().parentparentreportsGet02,
      AppLocalizationsAr().parentparentreportsGet03,
      AppLocalizationsAr().parentparentreportsGet04,
      AppLocalizationsAr().parentparentreportsGet05,
      AppLocalizationsAr().parentparentreportsGet06,
      AppLocalizationsAr().parentparentreportsGet07,
    ];
    return names[parsed.weekday - 1];
  }
}

class WeeklyTitled {
  const WeeklyTitled({
    required this.id,
    this.title,
    this.minutes = 0,
    this.contentType = '',
  });
  final String id;
  final String? title;
  final int minutes;
  final String contentType;
}

/// Null for the demo child or when the report is unavailable for that child.
final weeklyReportProvider = FutureProvider.family<WeeklyReport?, String>((
  ref,
  childId,
) async {
  final json = await ref
      .watch(majarraApiClientProvider)
      .fetchWeeklyReport(childId: childId);
  return json == null ? null : WeeklyReport.fromJson(json);
});

/// Parent-facing label for a server mastery level (`lib/mastery.ts`).
String masteryLevelLabel(String level) => switch (level) {
  'independent' => AppLocalizationsAr().parentparentreportsMasteryLevelLabel01,
  'assisted' => AppLocalizationsAr().parentparentreportsMasteryLevelLabel02,
  'practicing' => AppLocalizationsAr().parentparentreportsMasteryLevelLabel03,
  'introduced' => AppLocalizationsAr().parentparentreportsMasteryLevelLabel04,
  'needs_review' => AppLocalizationsAr().parentparentreportsMasteryLevelLabel05,
  'not_started' => AppLocalizationsAr().parentparentreportsMasteryLevelLabel06,
  _ => AppLocalizationsAr().parentparentreportsMasteryLevelLabel07,
};
