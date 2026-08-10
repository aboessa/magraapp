import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/analytics/analytics.dart';

/// These tests assert the privacy guards do not throw and that the typed
/// helpers exist for the instrumented events. Dispatch is a no-op in the test
/// (analytics disabled off-production), so we exercise the safe-shaping path.
void main() {
  group('MajarraAnalytics privacy-safe logging', () {
    test('disallowed events are dropped silently (no throw)', () {
      expect(() => MajarraAnalytics.log('totally_unknown_event'), returnsNormally);
    });

    test('allowed event with PII-ish params does not throw', () {
      // nickname / query / transcript keys must be stripped, not crash.
      expect(
        () => MajarraAnalytics.log('search_performed', params: {
          'result_count': 3,
          'nickname': 'child-name',
          'query': 'raw typed text',
          'transcript': 'spoken words',
        }),
        returnsNormally,
      );
    });

    test('typed helpers run without throwing', () {
      expect(() {
        MajarraAnalytics.searchPerformed(resultCount: 5);
        MajarraAnalytics.voiceSearchUsed(available: true);
        MajarraAnalytics.contentStarted('episode', 'e1');
        MajarraAnalytics.contentCompleted('episode', 'e1');
        MajarraAnalytics.downloadSucceeded('audio_story');
        MajarraAnalytics.downloadFailed('audio_story');
        MajarraAnalytics.gameStarted('g1');
        MajarraAnalytics.readerOpened('b1');
      }, returnsNormally);
    });
  });
}
