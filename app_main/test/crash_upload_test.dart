import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:majarra/core/errors/crash_upload.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// OPS-202: what leaves the device, and the disk queue that survives a crash.
void main() {
  const stack = '''
#0      HomePage.build (package:majarra/features/home/presentation/home_page.dart:42:7)
#1      <anonymous closure> (package:majarra/app/majarra_app.dart:10:3)
#2      _rootRun (dart:async/zone.dart:1399:13)
#3      main (file:///C:/Users/someone/app/lib/main.dart:5:1)
''';

  group('CrashPayload', () {
    test('never carries the error message', () {
      final payload = CrashPayload.from(
        StateError('child Ahmed has no PIN'),
        StackTrace.fromString(stack),
        context: 'zone',
        fatal: true,
      );
      final json = jsonEncode(
        payload.toJson(platform: 'android', deviceKind: 'tv'),
      );
      expect(json, isNot(contains('Ahmed')));
      expect(payload.errorType, 'StateError');
      expect(payload.fatal, isTrue);
    });

    test('keeps package and dart frames, drops file paths', () {
      final frames = CrashPayload.sanitizeFrames(stack);
      expect(frames, [
        'package:majarra/features/home/presentation/home_page.dart:42:7 HomePage.build',
        'package:majarra/app/majarra_app.dart:10:3 <anonymous_closure>',
        'dart:async/zone.dart:1399:13 _rootRun',
      ]);
      expect(frames.join(), isNot(contains('someone')));
    });

    test('free-form Flutter context becomes a fixed category', () {
      expect(
        CrashPayload.contextCategory('while building Text("Ahmed")'),
        'build',
      );
      expect(CrashPayload.contextCategory('during performLayout()'), 'layout');
      expect(
        CrashPayload.contextCategory('platform_dispatcher'),
        'platform_dispatcher',
      );
      expect(CrashPayload.contextCategory(null), 'unknown');
      expect(CrashPayload.contextCategory('something "odd"'), 'flutter');
    });

    test('caps frames at 12', () {
      final many = List.generate(
        30,
        (i) => '#$i      f$i (package:majarra/a.dart:$i:1)',
      ).join('\n');
      expect(CrashPayload.sanitizeFrames(many), hasLength(12));
    });
  });

  group('CrashUploader', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    test('sends a queued report and clears the queue', () async {
      final bodies = <Map<String, dynamic>>[];
      final uploader = CrashUploader(
        deviceKind: 'phone',
        endpoint: Uri.parse('https://api.test/api/v1/analytics/crashes'),
        client: MockClient((req) async {
          bodies.add(jsonDecode(req.body) as Map<String, dynamic>);
          return http.Response('{"success":true}', 201);
        }),
      );
      await uploader.enqueue(
        CrashPayload.from(RangeError('x'), StackTrace.fromString(stack)),
      );
      await uploader.flush();
      expect(bodies, hasLength(1));
      expect(bodies.single['error_type'], 'RangeError');
      expect(bodies.single['device_kind'], 'phone');
      final prefs = await SharedPreferences.getInstance();
      expect(jsonDecode(prefs.getString('crash_reports.pending.v1')!), isEmpty);
    });

    test(
      'keeps the report when the network fails, sends it next launch',
      () async {
        final offline = CrashUploader(
          deviceKind: 'tv',
          endpoint: Uri.parse('https://api.test/x'),
          client: MockClient(
            (_) async => throw http.ClientException('offline'),
          ),
        );
        await offline.enqueue(
          CrashPayload.from(StateError('x'), null, fatal: true),
        );
        await offline.flush();

        var sent = 0;
        final nextLaunch = CrashUploader(
          deviceKind: 'tv',
          endpoint: Uri.parse('https://api.test/x'),
          client: MockClient((_) async {
            sent++;
            return http.Response('{}', 201);
          }),
        );
        await nextLaunch.flush();
        expect(sent, 1);
      },
    );

    test('a crash loop is sent at most three times per session', () async {
      var sent = 0;
      final uploader = CrashUploader(
        deviceKind: 'phone',
        endpoint: Uri.parse('https://api.test/x'),
        client: MockClient((_) async {
          sent++;
          return http.Response('{}', 201);
        }),
      );
      for (var i = 0; i < 10; i++) {
        await uploader.enqueue(
          CrashPayload.from(StateError('x'), StackTrace.fromString(stack)),
        );
        await uploader.flush();
      }
      expect(sent, CrashUploader.maxPerFingerprint);
    });
  });
}
