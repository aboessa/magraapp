import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/env/app_environment.dart';
import 'package:majarra/features/games/application/play_catalog.dart';
import 'package:majarra/features/home/data/local_catalog.dart';
import 'package:majarra/features/home/domain/content_models.dart';

ExperienceItem _item(String id) =>
    ExperienceItem(id: id, title: id, subtitle: '', imageAsset: '');

void main() {
  final server = [_item('game-server-1'), _item('game-server-2')];
  final remoteCatalog = [_item('game-catalog-1'), _item('game-catalog-2')];
  final bundled = [_item('game-bundled-1'), _item('game-bundled-2')];

  group('أولوية المصادر', () {
    test('الخادم يفوز وحده ولا يُدمج معه catalog أو bundled', () {
      final resolved = resolvePlayableGames(
        serverState: PlayServerState.completed,
        server: server,
        catalog: remoteCatalog,
        bundled: bundled,
        catalogIsBundled: false,
        allowBundledFallback: true,
      );

      expect(resolved.games.map((game) => game.id), [
        'game-server-1',
        'game-server-2',
      ]);
      expect(resolved.usesBundled, isFalse);
    });

    test('الكاتالوج البعيد يفوز وحده عند غياب ألعاب الخادم', () {
      final resolved = resolvePlayableGames(
        serverState: PlayServerState.error,
        server: const [],
        catalog: remoteCatalog,
        bundled: bundled,
        catalogIsBundled: false,
        allowBundledFallback: true,
      );

      expect(resolved.games.map((game) => game.id), [
        'game-catalog-1',
        'game-catalog-2',
      ]);
      expect(resolved.usesBundled, isFalse);
    });

    test('الكاتالوج المبندل لا يُعامل ككاتالوج بعيد', () {
      final resolved = resolvePlayableGames(
        serverState: PlayServerState.error,
        server: const [],
        catalog: [_item('game-catalog-bundled-copy')],
        bundled: bundled,
        catalogIsBundled: true,
        allowBundledFallback: true,
      );

      expect(resolved.games.map((game) => game.id), [
        'game-bundled-1',
        'game-bundled-2',
      ]);
      expect(resolved.usesBundled, isTrue);
    });
  });

  group('البديل المبندل', () {
    test('رد الخادم الفارغ المكتمل حاكم ولا يحيي remote catalog', () {
      final resolved = resolvePlayableGames(
        serverState: PlayServerState.completed,
        server: const [],
        catalog: remoteCatalog,
        bundled: bundled,
        catalogIsBundled: false,
        allowBundledFallback: true,
      );

      expect(resolved.games, isEmpty);
      expect(resolved.usesBundled, isFalse);
    });

    test('التحميل لا يعرض كتالوجًا أقدم قبل اكتمال الخادم', () {
      final resolved = resolvePlayableGames(
        serverState: PlayServerState.loading,
        server: const [],
        catalog: remoteCatalog,
        bundled: bundled,
        catalogIsBundled: false,
        allowBundledFallback: true,
      );

      expect(resolved.games, isEmpty);
      expect(resolved.usesBundled, isFalse);
    });

    test('يُستخدم عند الانقطاع المعلن ويُعلن أنه مبندل', () {
      final resolved = resolvePlayableGames(
        serverState: PlayServerState.error,
        server: const [],
        catalog: const [],
        bundled: bundled,
        catalogIsBundled: false,
        allowBundledFallback: true,
      );

      expect(resolved.games.map((game) => game.id), [
        'game-bundled-1',
        'game-bundled-2',
      ]);
      expect(resolved.usesBundled, isTrue);
    });

    test('حزمة فارغة تمثل production ولا تعيد ألعابًا محلية', () {
      final resolved = resolvePlayableGames(
        serverState: PlayServerState.error,
        server: const [],
        catalog: [_item('game-local-copy')],
        bundled: const [],
        catalogIsBundled: true,
        allowBundledFallback: true,
      );

      expect(resolved.games, isEmpty);
      expect(resolved.usesBundled, isFalse);
    });
  });

  group('عقد الكتالوج المحلي', () {
    test('كل fallback ID canonical وتغيب معرّفات legacy الخمسة', () {
      const legacyIds = {
        'letter-tracing',
        'number-maze',
        'animal-memory',
        'shape-matching',
        'butterfly-sequence',
      };
      final ids = LocalCatalog.experiences.map((game) => game.id).toList();

      expect(ids, everyElement(startsWith('game-')));
      expect(ids.where(legacyIds.contains), isEmpty);
    });
  });

  group('الشاشة', () {
    final source = File(
      'lib/features/home/presentation/pages/play_page.dart',
    ).readAsStringSync();

    test('لا ألعاب مكتوبة في الكود كـ«بديل مطلق»', () {
      expect(source.contains('const ExperienceItem('), isFalse);
    });

    test('الشاشة تُعلن استخدام الحزمة', () {
      expect(source, contains('resolved.usesBundled'));
      expect(source, contains('_OfflineLibraryNotice'));
    });

    test('الشاشة تحمل حالة مزوّد الألعاب إلى قرار المصدر', () {
      expect(source, contains('PlayServerState.completed'));
      expect(source, contains('PlayServerState.error'));
      expect(source, contains('PlayServerState.loading'));
    });

    test('الحالة الفارغة عربية وتسمح بإعادة المحاولة', () {
      expect(source, contains('لا توجد ألعاب مناسبة لك الآن'));
      expect(source, contains("Key('play_empty_retry')"));
      expect(source, contains('ref.invalidate(gameCatalogProvider)'));
    });

    test('تفتح المعرّف canonical مباشرة بلا prefix guessing', () {
      expect(source, contains("context.push('/game/\${item.id}')"));
      expect(source, isNot(contains('serverGameId')));
    });

    test('الإنتاج يمنع تمرير الحزمة المحلية', () {
      expect(source, contains('AppConfig.isProduction'));
      expect(source, contains('const <ExperienceItem>[]'));
    });
  });

  group('نطاق الأصول مصدر واحد', () {
    test('لا ملف في `lib/` يكتب نطاق الـCDN حرفيًّا', () {
      final offenders = <String>[];
      for (final file
          in Directory('lib')
              .listSync(recursive: true)
              .whereType<File>()
              .where((file) => file.path.endsWith('.dart'))) {
        if (file.path.endsWith('app_environment.dart')) continue;
        final code = file
            .readAsStringSync()
            .split('\n')
            .where((line) => !line.trimLeft().startsWith('//'))
            .join('\n');
        if (code.contains('cdn.majarra.app')) offenders.add(file.path);
      }
      expect(offenders, isEmpty, reason: 'استخدم AppConfig.assetBaseUrl');
    });

    test('`assetBaseUrl` ثابت صالح للاستخدام في سياق `const`', () {
      expect(AppConfig.assetBaseUrl, 'https://cdn.majarra.app');
      expect(
        File('lib/core/env/app_environment.dart').readAsStringSync(),
        contains('static const String assetBaseUrl'),
      );
    });
  });
}
