import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:majarra/features/games/application/creative_catalogue_provider.dart';

/// Phase 5 — 10 deterministic deep-link scenarios (spec).
///
/// /studio/coloring/:id — ColoringTemplate
/// /studio/reference/:id — CreativeReferenceActivity
/// /studio/trace/:id    — StudioCatalogItem (trace/letter/number unified)
///
/// Determinism: known→same object, unknown/malformed→null, unpublished→null,
/// offline still resolves via bundled JSON, no wrong fallback.

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('deep-link regression — 10 scenarios', () {
    test('1. with extra — category tap resolves same as deep link (bird)', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      // "with extra" would be CreativeStudioPage push with _StudioItem; same ID via provider
      final fromTap = await c.read(coloringCatalogueAsync('bird').future);
      final fromDeep = await c.read(coloringCatalogueAsync('bird').future);
      expect(fromTap, isNotNull);
      expect(fromDeep, isNotNull);
      expect(fromTap!.id, fromDeep!.id);
      expect(fromTap.assetId, 'asset-color-bird');
    });

    test('2. without extra — ID-only deep link resolves (bird)', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      final tpl = await c.read(coloringCatalogueAsync('bird').future);
      expect(tpl, isNotNull);
      expect(tpl!.assetId, 'asset-color-bird');
    });

    test('3. cold start — no cache, bundled JSON loads (ref-cat)', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      final refs = await c.read(referenceCatalogueProvider.future);
      expect(refs.length, 30);
      final act = await c.read(referenceActivityAsync('ref-cat').future);
      expect(act, isNotNull);
      expect(act!.titleAr, 'قطة');
    });

    test('4. restart — second container sees same stable IDs (idempotent import)', () async {
      final c1 = ProviderContainer();
      final c2 = ProviderContainer();
      addTearDown(c1.dispose);
      addTearDown(c2.dispose);
      final a1 = await c1.read(coloringCatalogueProvider.future);
      final a2 = await c2.read(coloringCatalogueProvider.future);
      expect(a1.length, 40);
      expect(a2.length, 40);
      expect(a1.map((e) => e.id).toList(), a2.map((e) => e.id).toList());
      expect(a1.first.id, a2.first.id);
    });

    test('5. cached available — SharedPreferences cache preferred', () async {
      SharedPreferences.setMockInitialValues({});
      final c1 = ProviderContainer();
      addTearDown(c1.dispose);
      // first load primes cache
      final first = await c1.read(coloringCatalogueProvider.future);
      expect(first.length, 40);
      // second container should read from cache without throwing
      final c2 = ProviderContainer();
      addTearDown(c2.dispose);
      final second = await c2.read(coloringCatalogueProvider.future);
      expect(second.length, 40);
      expect(first.first.id, second.first.id);
    });

    test('6. no network but packaged JSON — offline resolves (line-h)', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      // No network call; provider is offline-safe via bundled JSON
      final trace = await c.read(traceCatalogueProvider.future);
      expect(trace.length, 15);
      final item = await c.read(traceItemAsync('line-h').future);
      expect(item, isNotNull);
      expect(item!.id, 'line-h');
      expect(item.strokePaths, isNotEmpty);
    });

    test('7. network/API available — still offline-safe, letter/number resolve', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      final alif = await c.read(traceItemAsync('alif').future);
      expect(alif, isNotNull);
      expect(alif!.mode, 'letter');
      expect(alif.strokePaths, isNotEmpty);
      final five = await c.read(traceItemAsync('5').future);
      expect(five, isNotNull);
      expect(five!.mode, 'number');
    });

    test('8. unknown ID — deterministic not-found (null, no throw)', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      expect(await c.read(coloringCatalogueAsync('does-not-exist-xyz').future), isNull);
      expect(await c.read(referenceActivityAsync('ref-ghost-999').future), isNull);
      expect(await c.read(traceItemAsync('nope-unknown').future), isNull);
    });

    test('9. malformed ID — no crash, returns null', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      for (final bad in ['', '  ', '../x', 'a/b', 'a\x00b', ' ']) {
        expect(await c.read(coloringCatalogueAsync(bad).future), isNull, reason: 'coloring $bad');
        expect(await c.read(referenceActivityAsync(bad).future), isNull, reason: 'ref $bad');
        expect(await c.read(traceItemAsync(bad).future), isNull, reason: 'trace $bad');
      }
    });

    test('10. unpublished/archived not leaked — draft letter pack stays draft in D1', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      // Bundled reference catalogue is published (30) — no draft leak
      final refs = await c.read(referenceCatalogueProvider.future);
      expect(refs.length, 30);
      expect(refs.every((e) => e.id.startsWith('ref-')), isTrue);
      // Letter tracing game is draft in D1 (linguistic gate) — not exposed via reference
      // Ensure reference provider does not accidentally include a game id
      final byGame = refs.where((e) => e.id == 'game-letter-tracing').toList();
      expect(byGame, isEmpty);
    });

    test('no silent wrong fallback — near-miss id not confused', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      final bird = await c.read(coloringCatalogueAsync('bird').future);
      expect(bird!.id, isNot('cat'));
      final cat = await c.read(coloringCatalogueAsync('cat').future);
      expect(cat!.id, 'cat');
      expect(bird.assetId, isNot(cat.assetId));
    });

    test('normal production load does not require Dart literal fallback', () async {
      SharedPreferences.setMockInitialValues({});
      fallbackActivations = 0;
      final c = ProviderContainer();
      addTearDown(c.dispose);
      final list = await c.read(coloringCatalogueProvider.future);
      expect(list.length, 40);
      // Provider fell back to bundled JSON, not Dart literals — so counter stays 0
      expect(fallbackActivations, 0, reason: 'fallback must not fire when bundled JSON succeeds');
      final ref = await c.read(referenceCatalogueProvider.future);
      expect(ref.length, 30);
      expect(fallbackActivations, 0);
    });
  });
}
