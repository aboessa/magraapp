import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/errors/crash_reporter.dart';

void main() {
  setUp(CrashReporter.recent.clear);

  group('CrashReporter', () {
    test('records an error with context and fatal flag', () {
      CrashReporter.report(StateError('boom'), StackTrace.current, context: 'test', fatal: true);
      expect(CrashReporter.recent, hasLength(1));
      expect(CrashReporter.recent.last.context, 'test');
      expect(CrashReporter.recent.last.fatal, isTrue);
    });

    test('is bounded so a crash loop cannot grow without limit', () {
      for (var i = 0; i < 120; i++) {
        CrashReporter.report(Exception('e$i'), null);
      }
      expect(CrashReporter.recent.length, lessThanOrEqualTo(50));
    });

    test('does not throw on a null stack', () {
      expect(() => CrashReporter.report(Exception('x'), null), returnsNormally);
    });
  });
}
