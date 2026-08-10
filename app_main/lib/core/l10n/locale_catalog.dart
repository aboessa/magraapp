import 'dart:ui';

/// How complete a locale's translation actually is.
///
/// The distinction is the whole point of this module (§16): a language is
/// offered to users only when its catalogue is genuinely translated, never
/// because a flag was flipped optimistically. [partial] and [planned] locales
/// are declared so the architecture (delegates, direction, resolution) is ready
/// for them, but they are withheld from the picker until real coverage lands.
enum LocaleCompleteness { complete, partial, planned }

/// A language the app knows how to render, with its truthful readiness.
class AppLocaleInfo {
  const AppLocaleInfo({
    required this.code,
    required this.nativeLabel,
    required this.englishLabel,
    required this.textDirection,
    required this.completeness,
  });

  final String code;
  final String nativeLabel;
  final String englishLabel;
  final TextDirection textDirection;
  final LocaleCompleteness completeness;

  Locale get locale => Locale(code);
  bool get isRtl => textDirection == TextDirection.rtl;

  /// Only complete locales are offered for selection. This is the single gate
  /// the UI must consult; there is no separate "enabled" flag that could drift.
  bool get isSelectable => completeness == LocaleCompleteness.complete;
}

/// The declared locale catalogue.
///
/// Arabic is the launch language and is complete. English is partially
/// translated (many strings are still Arabic-only), so it is declared but not
/// selectable. French is planned: the direction and slot exist so adding it is
/// a translation drop plus a completeness flip, not an architecture change.
///
/// The completeness flags here are asserted by `test/locale_catalog_test.dart`
/// against actual ARB key coverage, so a flag cannot silently disagree with the
/// real translation state.
abstract final class AppLocales {
  static const arabic = AppLocaleInfo(
    code: 'ar',
    nativeLabel: 'العربية',
    englishLabel: 'Arabic',
    textDirection: TextDirection.rtl,
    completeness: LocaleCompleteness.complete,
  );

  static const english = AppLocaleInfo(
    code: 'en',
    nativeLabel: 'English',
    englishLabel: 'English',
    textDirection: TextDirection.ltr,
    completeness: LocaleCompleteness.partial,
  );

  static const french = AppLocaleInfo(
    code: 'fr',
    nativeLabel: 'Français',
    englishLabel: 'French',
    textDirection: TextDirection.ltr,
    completeness: LocaleCompleteness.planned,
  );

  /// Every locale the app declares, in display order.
  static const all = [arabic, english, french];

  /// Locales with generated delegates today. French is declared but has no ARB
  /// yet, so it is not passed to `MaterialApp.supportedLocales` until its
  /// resources exist.
  static List<Locale> get materialSupported =>
      [arabic.locale, english.locale];

  /// Locales that may be shown in the language picker — real, complete ones only.
  static List<AppLocaleInfo> get selectable =>
      all.where((l) => l.isSelectable).toList();

  /// The launch/default locale.
  static AppLocaleInfo get fallback => arabic;

  static AppLocaleInfo byCode(String? code) =>
      all.firstWhere((l) => l.code == code, orElse: () => fallback);
}
