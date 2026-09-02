/// ملف طفل كما يرسله الخادم (`APP-102`).
///
/// كان مُعلَنًا داخل `presentation/pages/child_switcher_page.dart` — نموذج نطاق
/// في ملف صفحة، تقرأه لوحة وليّ الأمر ونموذج الملف وصفحة العمر. أي أن ميزة
/// `child` كانت بلا `domain/` مع أن لها نموذجها.
library;

class ChildProfile {
  const ChildProfile({
    required this.id,
    required this.nickname,
    required this.ageTrack,
    required this.birthMonth,
    required this.birthYear,
    this.avatarId = '',
    this.interests = const [],
    this.language = 'ar',
    this.onboardingCompletedAt,
  });

  factory ChildProfile.fromJson(Map<String, Object?> json) {
    String text(String key) {
      final v = json[key];
      return v is String ? v.trim() : '';
    }

    int number(String key) {
      final v = json[key];
      if (v is int) return v;
      if (v is num) return v.toInt();
      if (v is String) return int.tryParse(v) ?? 0;
      return 0;
    }

    // `interests` arrives as a resolved JSON array (`FamilyState.getChildren`
    // parses `interests_json` server-side already), not a nested string —
    // no extra decoding step is needed here, only the usual defensive cast.
    List<String> stringList(String key) {
      final v = json[key];
      if (v is List) return v.whereType<String>().toList(growable: false);
      return const [];
    }

    // `onboarding_completed_at` arrives as a millisecond epoch (the same
    // shape as every other `_at` column `FamilyState` stores) once
    // `FAMILY_SCHEMA_STEPS` version 14 exists on an object; `null`/absent
    // means this child never completed (or never went through) onboarding.
    DateTime? epochMillis(String key) {
      final v = json[key];
      if (v is int) return DateTime.fromMillisecondsSinceEpoch(v);
      if (v is num) return DateTime.fromMillisecondsSinceEpoch(v.toInt());
      return null;
    }

    return ChildProfile(
      id: text('id'),
      nickname: text('nickname'),
      ageTrack: text('age_track'),
      birthMonth: number('birth_month'),
      birthYear: number('birth_year'),
      avatarId: text('avatar_id'),
      interests: stringList('interests'),
      language: text('language').isEmpty ? 'ar' : text('language'),
      onboardingCompletedAt: epochMillis('onboarding_completed_at'),
    );
  }

  final String id;
  final String nickname;
  final String ageTrack;
  final int birthMonth;
  final int birthYear;
  final String avatarId;
  final List<String> interests;
  final String language;

  /// When this child's profile completed the first-run onboarding journey
  /// (Requirement 8.4). `null` means it never has.
  final DateTime? onboardingCompletedAt;

  String get displayName => nickname.isEmpty ? 'ملف طفل' : nickname;

  int? get ageYears {
    if (birthYear <= 0 || birthMonth <= 0) return null;
    final now = DateTime.now();
    var years = now.year - birthYear;
    if (now.month < birthMonth) years -= 1;
    return years < 0 ? null : years;
  }

  String get trackLabel => switch (ageTrack) {
        'preschool' => 'براعم',
        'kids' => 'مستكشفون',
        'junior' => 'روّاد',
        _ => 'غير محدد',
      };
}
