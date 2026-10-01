import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/features/child/application/child_provider.dart';
import 'package:majarra/features/child/domain/child_profile.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/features/tv/application/tv_command_handler.dart';
import 'package:majarra/features/tv/application/tv_playback_bridge.dart';
import 'package:majarra/features/tv/data/tv_link_connection.dart';
import 'package:majarra/features/tv/presentation/pages/tv_remote_page.dart';
import 'package:majarra/features/tv/presentation/tv_cast_sheet.dart';

/// TV-002/003: play on the TV from the phone, and remote control.

const _laila = ChildProfile(
  id: 'child-1',
  nickname: 'ليلى',
  ageTrack: 'kids',
  birthMonth: 1,
  birthYear: 2019,
);

class _Target implements TvPlaybackTarget {
  final calls = <String>[];
  @override
  Future<void> pause() async => calls.add('pause');
  @override
  Future<void> resume() async => calls.add('resume');
  @override
  Future<void> stop() async => calls.add('stop');
  @override
  Future<void> seekTo(Duration position) async =>
      calls.add('seekTo:${position.inMilliseconds}');
  @override
  Future<void> seekBy(Duration delta) async =>
      calls.add('seekBy:${delta.inMilliseconds}');
}

({TvCommandHandler handler, TvPlaybackBridge bridge, List<String> log})
_handler({List<ChildProfile> children = const [_laila]}) {
  final bridge = TvPlaybackBridge();
  final log = <String>[];
  final handler = TvCommandHandler(
    bridge: bridge,
    loadChildren: () async => children,
    selectChild: (child) => log.add('child:${child.id}'),
    openEpisode: (id, position) => log.add('open:$id@$position'),
  );
  return (handler: handler, bridge: bridge, log: log);
}

class _FakeConnection extends TvLinkConnection {
  _FakeConnection({required super.onMessage})
    : super(api: MajarraApiClient(http.Client()), role: 'remote');
  bool started = false;
  bool stopped = false;
  @override
  void start() => started = true;
  @override
  void stop() => stopped = true;
  @override
  void send(Map<String, Object?> message) {}
}

class _LinkApi extends MajarraApiClient {
  _LinkApi() : super(http.Client());
  final commands = <Map<String, Object?>>[];
  List<Map<String, Object?>> devices = const [];
  MajarraApiException? failWith;

  @override
  Future<List<Map<String, Object?>>> tvLinkDevices() async => devices;

  @override
  Future<Map<String, dynamic>> tvLinkCommand({
    required String deviceId,
    required String command,
    String? episodeId,
    String? childId,
    int? positionMs,
    int? deltaMs,
    String? from,
  }) async {
    commands.add({
      'device': deviceId,
      'command': command,
      'episode': episodeId,
      'child': childId,
      'position': positionMs,
      'delta': deltaMs,
    });
    if (failWith != null) throw failWith!;
    return {
      'success': true,
      'data': {'delivered': true},
    };
  }
}

void main() {
  group('the TV follows commands', () {
    test(
      'play switches to the named child, opens the episode, and acks once it plays',
      () async {
        final h = _handler();
        final ack = h.handler.handle({
          'command': 'play',
          'episode_id': 'ep-1',
          'child_id': 'child-1',
          'position_ms': 90000,
          'from': 'موبايل',
        });
        await Future<void>.delayed(Duration.zero);
        expect(h.log, ['child:child-1', 'open:ep-1@90000']);
        expect(h.bridge.pendingBanner, 'بيتفرج دلوقتي: ليلى · من موبايل');

        h.bridge.report(
          const TvPlaybackSnapshot(status: 'loading', episodeId: 'ep-1'),
        );
        h.bridge.report(
          const TvPlaybackSnapshot(status: 'playing', episodeId: 'other'),
        );
        h.bridge.report(
          const TvPlaybackSnapshot(status: 'playing', episodeId: 'ep-1'),
        );
        expect(await ack, (ok: true, reason: null));
      },
    );

    test(
      'a child from outside the family is refused before anything changes',
      () async {
        final h = _handler();
        final ack = await h.handler.handle({
          'command': 'play',
          'episode_id': 'ep-1',
          'child_id': 'stranger',
        });
        expect(ack, (ok: false, reason: 'child_not_found'));
        expect(h.log, isEmpty);
      },
    );

    test('a player that fails says why, e.g. screen time', () async {
      final h = _handler();
      final ack = h.handler.handle({
        'command': 'play',
        'episode_id': 'ep-1',
        'child_id': 'child-1',
      });
      await Future<void>.delayed(Duration.zero);
      h.bridge.report(
        const TvPlaybackSnapshot(
          status: 'error',
          episodeId: 'ep-1',
          reason: 'playback_dailyLimit',
        ),
      );
      expect(await ack, (ok: false, reason: 'playback_dailyLimit'));
    });

    test('a player that never starts times out rather than hanging', () async {
      final bridge = TvPlaybackBridge();
      final handler = TvCommandHandler(
        bridge: bridge,
        loadChildren: () async => const [_laila],
        selectChild: (_) {},
        openEpisode: (_, __) {},
        startTimeout: const Duration(milliseconds: 30),
      );
      final ack = await handler.handle({
        'command': 'play',
        'episode_id': 'ep-1',
        'child_id': 'child-1',
      });
      expect(ack, (ok: false, reason: 'start_timeout'));
    });

    test('pause, resume, stop and seek reach the player on screen', () async {
      final h = _handler();
      expect(await h.handler.handle({'command': 'pause'}), (
        ok: false,
        reason: 'not_playing',
      ));
      final target = _Target();
      h.bridge.attach(target);
      for (final message in <Map<String, Object?>>[
        {'command': 'pause'},
        {'command': 'resume'},
        {'command': 'seek', 'delta_ms': -10000},
        {'command': 'seek', 'position_ms': 5000},
        {'command': 'stop'},
      ]) {
        expect((await h.handler.handle(message)).ok, isTrue);
      }
      expect(target.calls, [
        'pause',
        'resume',
        'seekBy:-10000',
        'seekTo:5000',
        'stop',
      ]);
      expect(
        (await h.handler.handle({'command': 'seek'})).reason,
        'invalid_command',
      );
      expect(
        (await h.handler.handle({'command': 'reboot'})).reason,
        'unknown_command',
      );
    });

    test('a player leaving the screen tells the remote it is idle', () {
      final bridge = TvPlaybackBridge();
      final seen = <String>[];
      bridge.onState = (s) => seen.add(s.status);
      final target = _Target();
      bridge.attach(target);
      bridge.detach(_Target()); // not the attached one: ignored
      expect(bridge.target, same(target));
      bridge.detach(target);
      expect(bridge.target, isNull);
      expect(seen, ['idle']);
    });

    test('the banner is shown by one player only', () {
      final bridge = TvPlaybackBridge()..pendingBanner = 'x';
      expect(bridge.takeBanner(), 'x');
      expect(bridge.takeBanner(), isNull);
    });
  });

  test('the socket URL carries only the ticket and upgrades https to wss', () {
    final uri = MajarraApiClient(http.Client()).tvLinkSocketUri('ticket-1');
    expect(uri.scheme, anyOf('wss', 'ws'));
    expect(uri.path, '/api/v1/tv/link/connect');
    expect(uri.queryParameters, {'ticket': 'ticket-1'});
  });

  group('the phone', () {
    testWidgets('casting sends play for the active child and returns the TV', (
      tester,
    ) async {
      final api = _LinkApi()
        ..devices = [
          {'device_id': 'tv-1', 'name': 'تلفزيون الصالة', 'state': null},
        ];
      TvCastChoice? chosen;
      final container = ProviderContainer(
        overrides: [majarraApiClientProvider.overrideWithValue(api)],
      );
      addTearDown(container.dispose);
      container
          .read(childProvider.notifier)
          .selectChild(childId: 'child-1', ageTrack: 'kids');

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: Builder(
              builder: (context) => Scaffold(
                body: TextButton(
                  onPressed: () async {
                    chosen = await showTvCastSheet(
                      context,
                      episodeId: 'ep-1',
                      positionMs: 42000,
                    );
                  },
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('تلفزيون الصالة'), findsOneWidget);
      await tester.tap(find.text('تلفزيون الصالة'));
      await tester.pumpAndSettle();

      expect(api.commands.single, {
        'device': 'tv-1',
        'command': 'play',
        'episode': 'ep-1',
        'child': 'child-1',
        'position': 42000,
        'delta': null,
      });
      expect(chosen?.deviceId, 'tv-1');
    });

    testWidgets('no connected TV is explained instead of an empty list', (
      tester,
    ) async {
      final api = _LinkApi();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [majarraApiClientProvider.overrideWithValue(api)],
          child: const MaterialApp(
            home: Scaffold(body: TvCastSheet(episodeId: 'ep-1', positionMs: 0)),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('مفيش تلفزيون متصل'), findsOneWidget);
    });

    testWidgets('the remote shows live TV state and sends controls', (
      tester,
    ) async {
      final api = _LinkApi();
      late _FakeConnection connection;
      final router = GoRouter(
        initialLocation: '/start',
        routes: [
          GoRoute(path: '/start', builder: (_, __) => const Text('START')),
          GoRoute(
            path: '/tv-remote',
            builder: (_, __) =>
                const TvRemotePage(deviceId: 'tv-1', initialName: 'الصالة'),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            majarraApiClientProvider.overrideWithValue(api),
            tvLinkConnectionFactoryProvider.overrideWithValue(
              ({required role, required onMessage, deviceName}) =>
                  connection = _FakeConnection(onMessage: onMessage),
            ),
          ],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      unawaited(router.push('/tv-remote'));
      await tester.pumpAndSettle();
      expect(connection.started, isTrue);

      connection.onMessage({
        'type': 'state',
        'device_id': 'tv-1',
        'state': {
          'status': 'playing',
          'title': 'الحلقة الأولى',
          'position_ms': 30000,
          'duration_ms': 600000,
        },
      });
      // A state for another TV must not overwrite this one.
      connection.onMessage({
        'type': 'state',
        'device_id': 'tv-2',
        'state': {
          'status': 'paused',
          'title': 'غيرها',
          'position_ms': 0,
          'duration_ms': 1,
        },
      });
      await tester.pump();
      expect(find.text('الحلقة الأولى'), findsOneWidget);
      expect(find.text('شغّال على التلفزيون'), findsOneWidget);
      expect(find.text('0:30'), findsOneWidget);

      await tester.tap(find.byTooltip('إيقاف مؤقت'));
      await tester.pump();
      await tester.tap(find.byTooltip('قدّام ١٠ ثواني'));
      await tester.pump();
      expect(api.commands.map((c) => c['command']), ['pause', 'seek']);
      expect(api.commands.last['delta'], 10000);

      await tester.tap(find.text('إيقاف التشغيل على التلفزيون'));
      await tester.pumpAndSettle();
      expect(api.commands.last['command'], 'stop');
      expect(
        find.text('START'),
        findsOneWidget,
        reason: 'stopping returns from the remote',
      );
      expect(connection.stopped, isTrue);
    });

    testWidgets(
      'a TV that leaves shows as disconnected and disables the controls',
      (tester) async {
        late _FakeConnection connection;
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              majarraApiClientProvider.overrideWithValue(_LinkApi()),
              tvLinkConnectionFactoryProvider.overrideWithValue(
                ({required role, required onMessage, deviceName}) =>
                    connection = _FakeConnection(onMessage: onMessage),
              ),
            ],
            child: const MaterialApp(home: TvRemotePage(deviceId: 'tv-1')),
          ),
        );
        connection.onMessage({'type': 'devices', 'devices': <Object>[]});
        await tester.pump();
        expect(find.text('التلفزيون مش متصل'), findsOneWidget);
        final play = tester.widget<IconButton>(
          find.ancestor(
            of: find.byIcon(Icons.play_arrow_rounded),
            matching: find.byType(IconButton),
          ),
        );
        expect(play.onPressed, isNull);
        await tester.pumpWidget(const SizedBox());
      },
    );
  });
}
