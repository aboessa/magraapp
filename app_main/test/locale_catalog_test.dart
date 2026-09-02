import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/l10n/locale_catalog.dart';

/// Reads an ARB file and returns its message keys (ignoring @-metadata and the
/// @@locale header).
Set<String> _arbKeys(String path) {
  final json = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
  return json.keys.where((k) => !k.startsWith('@')).toSet();
}

/// Arabic strings written straight into the source, bypassing every catalogue.
///
/// Counted rather than assumed, because this is the number that actually decides
/// whether a second language can render (`I18N-101`). The generated `l10n`
/// directory is excluded: its Arabic **is** the Arabic catalogue.
({int total, int files}) _hardCodedArabicLiterals() {
  final literal = RegExp('''['"][^'"]*[\u0600-\u06FF][^'"]*['"]''');
  var total = 0;
  var files = 0;
  for (final entity in Directory('lib').listSync(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('.dart')) continue;
    if (entity.path.contains('l10n')) continue;
    final matches = literal.allMatches(entity.readAsStringSync()).length;
    if (matches > 0) {
      files += 1;
      total += matches;
    }
  }
  return (total: total, files: files);
}

void main() {
  final arKeys = _arbKeys('lib/l10n/app_ar.arb');
  final enKeys = _arbKeys('lib/l10n/app_en.arb');

  double coverage(Set<String> locale) =>
      arKeys.isEmpty ? 0 : locale.intersection(arKeys).length / arKeys.length;

  group('locale completeness matches real ARB coverage', () {
    test('Arabic is the complete reference', () {
      expect(AppLocales.arabic.completeness, LocaleCompleteness.complete);
      expect(arKeys, isNotEmpty);
    });

    test('a locale flagged complete must have >=99% coverage', () {
      // Guards against optimistically flipping a flag: any locale marked
      // complete has to actually be translated.
      for (final locale in AppLocales.all) {
        if (locale.completeness != LocaleCompleteness.complete) continue;
        if (locale.code == 'ar') continue; // the reference itself.
        final keys = _arbKeys('lib/l10n/app_${locale.code}.arb');
        expect(coverage(keys), greaterThanOrEqualTo(0.99),
            reason: '${locale.code} is marked complete but under-covered');
      }
    });

    test('ARB coverage alone cannot decide that a locale is ready', () {
      // ## The forcing function that was not one (`I18N-101`)
      //
      // This test used to read:
      //
      //     final cov = coverage(enKeys);
      //     if (cov < 0.99) { expect(AppLocales.english.isSelectable, isFalse); }
      //
      // above a comment promising "if EN ever reaches full coverage this test will
      // fail, prompting the flag to be flipped". The assertion sat **inside** the
      // `if`, so reaching coverage skipped it: the test passed by doing nothing.
      // And English is at **100%** ARB coverage today — so it had already stopped
      // asserting anything at all, silently, while the comment still described a
      // guard.
      //
      // Worse, the measure itself was wrong. 255 ARB keys are fully translated
      // while the UI holds **thousands** of hard-coded Arabic strings that never
      // pass through `AppLocalizations`. So ARB coverage can read 100% while the
      // screens remain Arabic. Flipping the flag on that number would have offered
      // users a language the app cannot render.
      expect(coverage(enKeys), greaterThanOrEqualTo(0.99),
          reason: 'EN ARB is fully keyed; this records the fact the old test hid');
      expect(AppLocales.english.isSelectable, isFalse,
          reason: 'ARB keys are complete, the screens are not — see the literal count below');
    });

    test('a locale stays unselectable while the UI bypasses its catalogue', () {
      // The real blocker, measured rather than assumed: strings written straight
      // into widgets never reach any ARB, so no amount of translation work on the
      // ARB can make a second language render.
      //
      // This is the honest forcing function: it goes green only when the strings
      // are actually extracted, and it does not presume the language policy
      // (`DECIDE-105`). If the product stays Arabic-only, it simply stays true.
      final hardCoded = _hardCodedArabicLiterals();
      if (hardCoded.total > 0) {
        for (final locale in AppLocales.selectable) {
          expect(locale.code, 'ar',
              reason: 'only Arabic may be offered while ${hardCoded.total} Arabic '
                  'literals in ${hardCoded.files} files bypass AppLocalizations');
        }
      }
    });
  });

  group('selection gating', () {
    test('only complete locales are selectable', () {
      for (final locale in AppLocales.selectable) {
        expect(locale.completeness, LocaleCompleteness.complete);
      }
      // Arabic is always selectable at launch.
      expect(AppLocales.selectable.map((l) => l.code), contains('ar'));
    });

    test('direction is correct per language', () {
      expect(AppLocales.arabic.isRtl, isTrue);
      expect(AppLocales.english.isRtl, isFalse);
      expect(AppLocales.french.isRtl, isFalse);
    });

    test('material supported locales include ar and en delegates', () {
      final codes = AppLocales.materialSupported.map((l) => l.languageCode);
      expect(codes, containsAll(['ar', 'en']));
    });
  });
}
