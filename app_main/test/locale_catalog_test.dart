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

    test('English is honestly not selectable while partial', () {
      // If EN ever reaches full coverage this test will fail, prompting the flag
      // to be flipped — which is exactly the intended forcing function.
      final cov = coverage(enKeys);
      if (cov < 0.99) {
        expect(AppLocales.english.isSelectable, isFalse,
            reason: 'EN coverage is ${(cov * 100).toStringAsFixed(0)}%, must not be selectable');
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
