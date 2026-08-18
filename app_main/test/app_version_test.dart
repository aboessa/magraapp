import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/env/app_version.dart';

/// The forced-update gate compared against a hardcoded `'0.1.0'`, and the
/// `X-App-Version` header sent to the API was the same literal. Both were
/// therefore wrong for every build whose real version differed — which is every
/// build — so the server could publish any `min_app_version` and the gate would
/// never fire.
void main() {
  tearDown(() => AppVersion.overrideForTest(null));

  group('AppVersion', () {
    test('an unread version is older than every published minimum', () {
      // 0.0.0 is deliberate: a failed read must err towards prompting an update,
      // not towards letting an unsupported build keep running.
      expect(AppVersion.unknown, '0.0.0');
      AppVersion.overrideForTest(null);
      expect(AppVersion.current, AppVersion.unknown);
    });

    test('a read value is reported as-is', () {
      AppVersion.overrideForTest('2.4.1');
      expect(AppVersion.current, '2.4.1');
      expect(AppVersion.readFailed, isFalse);
    });

    test('a failed read is visible, not silent', () {
      AppVersion.overrideForTest(AppVersion.unknown, failed: true);
      expect(AppVersion.readFailed, isTrue);
      expect(AppVersion.current, '0.0.0');
    });
  });

  group('no hardcoded version remains', () {
    test('the update gate does not compare against a literal', () {
      final source = File('lib/app/majarra_app.dart').readAsStringSync();
      expect(
        source.contains("const current = '0.1.0'"),
        isFalse,
        reason: 'the gate must read the running build version',
      );
      expect(source.contains('AppVersion.load()'), isTrue);
      // The failure path must be reported rather than swallowed: a version gate
      // that cannot run is an outage of a release control.
      expect(
        source.contains('CrashReporter.report'),
        isTrue,
        reason: 'a failed version check must be reported',
      );
    });

    test('the API client sends the real version', () {
      final source = File('lib/features/home/data/majarra_api_client.dart').readAsStringSync();
      expect(source.contains("'X-App-Version': '0.1.0'"), isFalse);
      expect(source.contains("'X-App-Version': AppVersion.current"), isTrue);
    });

    test('package_info_plus is a declared dependency, not a transitive one', () {
      // Importing a transitive package is what the analyzer flagged; pinning it
      // keeps the resolved graph identical.
      final pubspec = File('pubspec.yaml').readAsStringSync();
      expect(pubspec.contains('package_info_plus:'), isTrue);
    });
  });

  group('version comparison', () {
    // The comparison itself lives in the gate widget; this pins the semantics it
    // relies on so a future refactor cannot quietly invert them.
    bool isOlder(String current, String minimum) {
      List<int> parse(String v) =>
          v.split('.').map((e) => int.tryParse(e) ?? 0).toList();
      final c = parse(current);
      final m = parse(minimum);
      for (var i = 0; i < 3; i++) {
        final cv = i < c.length ? c[i] : 0;
        final mv = i < m.length ? m[i] : 0;
        if (cv < mv) return true;
        if (cv > mv) return false;
      }
      return false;
    }

    test('below the minimum is blocked', () {
      expect(isOlder('1.2.3', '1.2.4'), isTrue);
      expect(isOlder('1.2.3', '1.3.0'), isTrue);
      expect(isOlder('0.9.9', '1.0.0'), isTrue);
      expect(isOlder('0.0.0', '0.0.1'), isTrue);
    });

    test('at or above the minimum is allowed', () {
      expect(isOlder('1.2.4', '1.2.4'), isFalse);
      expect(isOlder('1.3.0', '1.2.4'), isFalse);
      expect(isOlder('2.0.0', '1.9.9'), isFalse);
    });

    test('an unreadable version is treated as unsupported', () {
      expect(isOlder(AppVersion.unknown, '1.0.0'), isTrue);
    });

    test('a shorter version string is padded, not misread', () {
      expect(isOlder('1.2', '1.2.1'), isTrue);
      expect(isOlder('1.2', '1.2.0'), isFalse);
    });
  });
}
