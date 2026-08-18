import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/features/profile/data/watchlist_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('WatchlistStore persistence', () {
    test('save then load round-trips ids', () async {
      final store = WatchlistStore();
      await store.save({'a', 'b', 'c'});
      final loaded = await store.load();
      expect(loaded, containsAll(['a', 'b', 'c']));
    });

    test('empty by default', () async {
      expect(await WatchlistStore().load(), isEmpty);
    });
  });

  group('WatchlistNotifier toggle flow', () {
    // childId=null keeps the server mirror a no-op, so no network is touched and
    // the local add/read/remove flow can be verified deterministically.
    WatchlistNotifier build() => WatchlistNotifier(
      WatchlistStore(),
      MajarraApiClient(http.Client()),
      null,
    );

    test('add then read then remove', () async {
      final notifier = build();
      await Future<void>.delayed(Duration.zero); // let _restore run.

      expect(notifier.contains('s1'), isFalse);

      await notifier.toggle('s1');
      expect(notifier.contains('s1'), isTrue);

      await notifier.toggle('s1');
      expect(notifier.contains('s1'), isFalse);
    });

    test('newest addition is ordered first', () async {
      final notifier = build();
      await Future<void>.delayed(Duration.zero);

      await notifier.toggle('older');
      await notifier.toggle('newer');
      expect(notifier.state.first, 'newer');
    });

    test('persists across a fresh notifier (single source of truth)', () async {
      final a = build();
      await Future<void>.delayed(Duration.zero);
      await a.toggle('kept');

      final b = build();
      await Future<void>.delayed(Duration.zero);
      expect(b.contains('kept'), isTrue);
    });
  });
}
