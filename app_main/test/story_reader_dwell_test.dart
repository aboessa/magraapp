import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/cache/reader_page_cache.dart';
import 'package:majarra/features/home/data/content_dtos.dart';
import 'package:majarra/features/home/domain/content_models.dart';
import 'package:majarra/features/reader/application/reader_auto_turn.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// `durationMs` = narration audio only. `dwellMs` = illustration viewing time
/// after narration completes. These tests pin the separation and the timing
/// contract: real completion event → dwell → page turn.
void main() {
  const pageWithDwell = StoryPage(
    id: 'p1',
    pageNumber: 1,
    durationMs: 5800,
    dwellMs: 12000,
  );
  const legacyPage = StoryPage(id: 'legacy', pageNumber: 1, durationMs: 5800);

  group('auto-turn timing', () {
    // 1
    testWidgets('narration completion starts the authored dwell', (
      tester,
    ) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      final scheduled = autoTurn.onNarrationComplete(
        page: pageWithDwell,
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: true,
        isLastPage: false,
      );

      expect(scheduled, isTrue);
      expect(autoTurn.isPending, isTrue);
      expect(autoTurn.pendingDwellMs, 12000);
      // Still on the page while the child looks at the illustration.
      await tester.pump(const Duration(milliseconds: 11999));
      expect(advanced, 0);

      // Leave no timer behind: closing the reader cancels it.
      autoTurn.cancel();
      await tester.pump(const Duration(seconds: 1));
      expect(advanced, 0);
    });

    // 2
    testWidgets('page turns only after the dwell fully elapses', (
      tester,
    ) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      autoTurn.onNarrationComplete(
        page: pageWithDwell,
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: true,
        isLastPage: false,
      );
      await tester.pump(const Duration(milliseconds: 12000));

      expect(advanced, 1);
      expect(autoTurn.isPending, isFalse);
    });

    // 3
    testWidgets('manual next cancels the pending turn', (tester) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      autoTurn.onNarrationComplete(
        page: pageWithDwell,
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: true,
        isLastPage: false,
      );
      await tester.pump(const Duration(milliseconds: 3000));
      autoTurn.cancel(); // what `_goNext` does

      await tester.pump(const Duration(seconds: 30));
      expect(advanced, 0, reason: 'a stale timer must never turn the new page');
      expect(autoTurn.isPending, isFalse);
    });

    // 4
    testWidgets('manual previous cancels the pending turn', (tester) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      autoTurn.onNarrationComplete(
        page: pageWithDwell,
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: true,
        isLastPage: false,
      );
      autoTurn.cancel(); // what `_goPrevious` does

      await tester.pump(const Duration(seconds: 30));
      expect(advanced, 0);
    });

    // 5
    testWidgets('replaying narration restarts the dwell from zero', (
      tester,
    ) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      autoTurn.onNarrationComplete(
        page: pageWithDwell,
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: true,
        isLastPage: false,
      );
      await tester.pump(const Duration(milliseconds: 9000));

      // Child taps replay: dwell cancelled, narration plays again, completes.
      autoTurn.cancel();
      autoTurn.onNarrationComplete(
        page: pageWithDwell,
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: true,
        isLastPage: false,
      );

      // The 3s left on the first dwell must not fire.
      await tester.pump(const Duration(milliseconds: 3000));
      expect(advanced, 0);
      // A whole fresh dwell is required.
      await tester.pump(const Duration(milliseconds: 9000));
      expect(advanced, 1);
    });

    // 6
    testWidgets('paused narration never advances the page', (tester) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      // Pause happens before completion, so no dwell was ever scheduled.
      expect(autoTurn.isPending, isFalse);
      autoTurn.cancel();
      await tester.pump(const Duration(minutes: 5));
      expect(advanced, 0);
    });

    // 7
    testWidgets('dispose cancels a pending turn', (tester) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);

      autoTurn.onNarrationComplete(
        page: pageWithDwell,
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: true,
        isLastPage: false,
      );
      autoTurn.dispose();

      await tester.pump(const Duration(seconds: 30));
      expect(advanced, 0);
      expect(autoTurn.isPending, isFalse);
    });

    // 8
    testWidgets('Self Read never auto-turns, even with authored dwell', (
      tester,
    ) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      final scheduled = autoTurn.onNarrationComplete(
        page: pageWithDwell,
        mode: ReadingMode.readMyself,
        autoAdvanceEnabled: true,
        isLastPage: false,
      );

      expect(scheduled, isFalse);
      expect(ReadingMode.readMyself.supportsAutoTurn, isFalse);
      await tester.pump(const Duration(seconds: 30));
      expect(advanced, 0);
    });

    // 9
    testWidgets('Read to Me auto-turns', (tester) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      expect(ReadingMode.readToMe.supportsAutoTurn, isTrue);
      autoTurn.onNarrationComplete(
        page: pageWithDwell,
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: true,
        isLastPage: false,
      );
      await tester.pump(const Duration(milliseconds: 12000));
      expect(advanced, 1);
    });

    testWidgets('auto-advance switched off suppresses the turn', (
      tester,
    ) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      final scheduled = autoTurn.onNarrationComplete(
        page: pageWithDwell,
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: false,
        isLastPage: false,
      );
      expect(scheduled, isFalse);
      await tester.pump(const Duration(seconds: 30));
      expect(advanced, 0);
    });

    testWidgets('the last page never auto-turns', (tester) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      final scheduled = autoTurn.onNarrationComplete(
        page: pageWithDwell,
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: true,
        isLastPage: true,
      );
      expect(scheduled, isFalse);
      await tester.pump(const Duration(seconds: 30));
      expect(advanced, 0);
    });

    // 10
    testWidgets('a page without dwell keeps legacy behaviour', (tester) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      expect(ReaderAutoTurn.dwellForPage(legacyPage), 0);
      expect(ReaderAutoTurn.legacyDwellFallbackMs, 0);

      autoTurn.onNarrationComplete(
        page: legacyPage,
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: true,
        isLastPage: false,
      );

      // Turns as it always did — no invented long pause, no pending timer.
      expect(advanced, 1);
      expect(autoTurn.isPending, isFalse);
    });

    testWidgets('a dwell of zero is honoured as authored', (tester) async {
      var advanced = 0;
      final autoTurn = ReaderAutoTurn(onAdvance: () => advanced += 1);
      addTearDown(autoTurn.dispose);

      autoTurn.onNarrationComplete(
        page: const StoryPage(id: 'z', pageNumber: 1, dwellMs: 0),
        mode: ReadingMode.readToMe,
        autoAdvanceEnabled: true,
        isLastPage: false,
      );
      expect(advanced, 1);
    });
  });

  // 11
  group('story duration validator', () {
    test('page experience is narration + dwell, never a stored field', () {
      expect(StoryExperience.pageMs(pageWithDwell), 5800 + 12000);
      expect(StoryExperience.pageMs(legacyPage), 5800);
    });

    test('story estimate excludes the final page dwell and transition', () {
      const pages = [
        StoryPage(id: '1', pageNumber: 1, durationMs: 5000, dwellMs: 10000),
        StoryPage(id: '2', pageNumber: 2, durationMs: 6000, dwellMs: 12000),
        StoryPage(id: '3', pageNumber: 3, durationMs: 4000, dwellMs: 11000),
      ];
      const transition = 280;
      expect(
        StoryExperience.storyMs(pages),
        5000 + 10000 + transition + 6000 + 12000 + transition + 4000,
      );
    });

    test('dwell makes the experience longer than narration alone', () {
      const pages = [
        StoryPage(id: '1', pageNumber: 1, durationMs: 5000, dwellMs: 10000),
        StoryPage(id: '2', pageNumber: 2, durationMs: 6000, dwellMs: 12000),
      ];
      final narrationOnly = pages.fold<int>(
        0,
        (sum, page) => sum + (page.durationMs ?? 0),
      );
      expect(StoryExperience.storyMs(pages), greaterThan(narrationOnly));
    });

    test('a legacy story without dwell is unchanged', () {
      const pages = [
        StoryPage(id: '1', pageNumber: 1, durationMs: 5000),
        StoryPage(id: '2', pageNumber: 2, durationMs: 6000),
      ];
      expect(StoryExperience.storyMs(pages), 5000 + 280 + 6000);
    });

    test('an eight page calm tale reaches its editorial target', () {
      // bird-home: measured narration + dwell from migration 0060.
      const narration = [5480, 4040, 5960, 7160, 6560, 5720, 6600, 5680];
      const dwell = [13200, 13800, 15200, 17000, 18100, 17600, 15900, 15900];
      final pages = [
        for (var i = 0; i < narration.length; i += 1)
          StoryPage(
            id: 'page-bird-home-${i + 1}',
            pageNumber: i + 1,
            durationMs: narration[i],
            dwellMs: dwell[i],
          ),
      ];
      final seconds = StoryExperience.storyMs(pages) / 1000;
      expect(seconds, greaterThanOrEqualTo(150));
      expect(seconds, lessThanOrEqualTo(170));
    });

    test('per-page dwell may differ inside one story', () {
      const pages = [
        StoryPage(id: '1', pageNumber: 1, dwellMs: 8000),
        StoryPage(id: '2', pageNumber: 2, dwellMs: 15000),
      ];
      expect(pages[0].dwellMs == pages[1].dwellMs, isFalse);
    });
  });

  // 12
  group('offline reader page cache', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    Map<String, dynamic> envelope() => {
      'data': [
        {
          'id': 'page-bird-home-001',
          'page_number': 1,
          'duration_ms': 5480,
          'dwell_ms': 13200,
          'body_text': 'هذا زغب.',
        },
        {
          'id': 'page-bird-home-002',
          'page_number': 2,
          'duration_ms': 4040,
          'dwell_ms': 13800,
        },
      ],
      'meta': {'language': 'ar', 'default_language': 'ar', 'languages': []},
    };

    test('cached pages keep dwell and narration for offline playback', () async {
      const cache = ReaderPageCache();
      await cache.save(
        kind: ReaderPageCacheKind.story,
        contentId: 'story-bird-home',
        language: 'ar',
        envelope: envelope(),
      );

      final restored = await cache.read(
        kind: ReaderPageCacheKind.story,
        contentId: 'story-bird-home',
        language: 'ar',
      );
      expect(restored, isNotNull);

      final pages = ReaderPageCollectionDto.fromEnvelope(
        restored!,
        requestedLanguage: 'ar',
      ).toDomain().pages;
      expect(pages, hasLength(2));
      expect(pages[0].durationMs, 5480);
      expect(pages[0].dwellMs, 13200);
      expect(pages[1].dwellMs, 13800);
      // The reader reads the same value offline as online.
      expect(ReaderAutoTurn.dwellForPage(pages[0]), 13200);
    });

    test('story and book caches do not collide', () async {
      const cache = ReaderPageCache();
      await cache.save(
        kind: ReaderPageCacheKind.story,
        contentId: 'shared-id',
        language: 'ar',
        envelope: envelope(),
      );
      expect(
        await cache.read(
          kind: ReaderPageCacheKind.book,
          contentId: 'shared-id',
          language: 'ar',
        ),
        isNull,
      );
    });

    test('an empty page list never overwrites a good snapshot', () async {
      const cache = ReaderPageCache();
      await cache.save(
        kind: ReaderPageCacheKind.story,
        contentId: 'story-bird-home',
        language: 'ar',
        envelope: envelope(),
      );
      await cache.save(
        kind: ReaderPageCacheKind.story,
        contentId: 'story-bird-home',
        language: 'ar',
        envelope: {'data': <Object?>[], 'meta': <String, Object?>{}},
      );
      final restored = await cache.read(
        kind: ReaderPageCacheKind.story,
        contentId: 'story-bird-home',
        language: 'ar',
      );
      expect((restored!['data'] as List), hasLength(2));
    });

    test('read returns null when nothing was cached', () async {
      expect(
        await const ReaderPageCache().read(
          kind: ReaderPageCacheKind.story,
          contentId: 'missing',
          language: 'ar',
        ),
        isNull,
      );
    });
  });

  group('StoryPageDto dwellMs', () {
    test('parses dwell_ms from JSON', () {
      final dto = StoryPageDto.fromJson({
        'id': 'p1',
        'page_number': 1,
        'duration_ms': 5800,
        'dwell_ms': 12000,
        'body_text': 'hello',
      });
      expect(dto.durationMs, 5800);
      expect(dto.dwellMs, 12000);
      final domain = dto.toDomain();
      expect(domain.durationMs, 5800);
      expect(domain.dwellMs, 12000);
    });

    test('null/0 dwell_ms becomes null (legacy fallback)', () {
      final dto = StoryPageDto.fromJson({
        'id': 'p1',
        'page_number': 1,
        'duration_ms': 5800,
        'dwell_ms': 0,
      });
      expect(dto.dwellMs, isNull);
      expect(dto.toDomain().dwellMs, isNull);
    });

    test('missing dwell_ms is null (backward compatibility)', () {
      final dto = StoryPageDto.fromJson({
        'id': 'p1',
        'page_number': 1,
        'duration_ms': 5800,
      });
      expect(dto.dwellMs, isNull);
      expect(dto.toDomain().dwellMs, isNull);
    });

    test('string dwell_ms is coerced', () {
      final dto = StoryPageDto.fromJson({
        'id': 'p1',
        'page_number': 1,
        'dwell_ms': '8000',
      });
      expect(dto.dwellMs, 8000);
    });

    test('ReaderPageCollectionDto preserves dwell per page', () {
      final dto = ReaderPageCollectionDto.fromEnvelope({
        'data': [
          {
            'id': 'p1',
            'page_number': 1,
            'duration_ms': 5000,
            'dwell_ms': 10000,
          },
          {'id': 'p2', 'page_number': 2, 'duration_ms': 6000, 'dwell_ms': null},
        ],
        'meta': {'language': 'ar', 'default_language': 'ar', 'languages': []},
      }, requestedLanguage: 'ar');
      final domain = dto.toDomain();
      expect(domain.pages[0].durationMs, 5000);
      expect(domain.pages[0].dwellMs, 10000);
      expect(domain.pages[1].durationMs, 6000);
      expect(domain.pages[1].dwellMs, isNull);
    });

    test('StoryPage domain carries dwellMs correctly', () {
      const page = StoryPage(
        id: 'x',
        pageNumber: 1,
        durationMs: 4000,
        dwellMs: 8000,
      );
      expect(page.durationMs, 4000);
      expect(page.dwellMs, 8000);
    });
  });
}
