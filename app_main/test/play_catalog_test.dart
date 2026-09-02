import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/env/app_environment.dart';
import 'package:majarra/features/games/application/play_catalog.dart';
import 'package:majarra/features/home/domain/content_models.dart';

/// `APP-103` — الكاتالوج المبندل بديلُ انقطاعٍ مُعلَن، لا مصدرٌ دائم.
///
/// ## ما كان
///
/// شاشة «العب» تدمج ثلاثة مصادر **بلا شرط**: ألعاب الخادم، ثم
/// `LocalCatalog.experiences` مباشرةً، ثم `catalog.experiences` — ثم إن خلا الكل
/// أضافت **ثلاث ألعاب مكتوبة في الكود** كـ«بديل مطلق».
///
/// فيرى الطفل ألعابًا من الحزمة **والشبكة سليمة تمامًا**. وردّ
/// `fetchGames(childId:)` هو ما يطبّق حالة النشر والمسار العمري والاستحقاق،
/// والعنصر المبندل لا يحمل حالةً ولا عمرًا — فلا شيء منها يُطبَّق عليه. أي أن
/// سياسة النشر كانت تُتجاوز في **كل** جولة، لا في الانقطاع وحده.
///
/// ومزوّد ألعاب الخادم كان يبتلع فشله بـ`catch (_)` ويعيد `[]` **بينما وصفُه
/// المكتوب فوقه يقول إن الفشل يبقى خطأً وإن الشرائح المبندلة لا تُحيا أبدًا**.
/// التوثيق كان يصف عكس ما يفعله الكود.

ExperienceItem _item(String id) =>
    ExperienceItem(id: id, title: id, subtitle: '', imageAsset: '');

void main() {
  final server = [_item('game-server-1'), _item('game-server-2')];
  final bundled = [_item('game-bundled-1'), _item('game-bundled-2')];

  group('الخادم هو المصدر', () {
    test('الحزمة لا تُضاف حين ينجح الخادم', () {
      // العطل الأصلي: كانت تُضاف دائمًا.
      final resolved = resolvePlayableGames(
        server: server,
        catalog: const [],
        bundled: bundled,
        catalogIsBundled: false,
      );
      expect(resolved.games.map((game) => game.id), ['game-server-1', 'game-server-2']);
      expect(resolved.usesBundled, isFalse);
    });

    test('الحزمة لا تُضاف حتى لو أعلن الكاتالوج أنه مبندل، ما دام الخادم أجاب', () {
      // شبكةٌ نصف عاملة: الكاتالوج من الكاش والألعاب حيّة. المنشور يفوز.
      final resolved = resolvePlayableGames(
        server: server,
        catalog: const [],
        bundled: bundled,
        catalogIsBundled: true,
      );
      expect(resolved.games.map((game) => game.id), ['game-server-1', 'game-server-2']);
      expect(resolved.usesBundled, isFalse);
    });

    test('ردٌّ فارغ صحيح يبقى فارغًا — ليس انقطاعًا', () {
      // الطفل التجريبي يُعيد `[]` بقصد، فحشرُ الحزمة له يجعل «لا ألعاب لهذا
      // الطفل» تُقرأ «هذه ألعابه».
      final resolved = resolvePlayableGames(
        server: const [],
        catalog: const [],
        bundled: bundled,
        catalogIsBundled: false,
      );
      expect(resolved.games, isEmpty);
      expect(resolved.usesBundled, isFalse);
    });
  });

  group('البديل المبندل', () {
    test('يُستخدم عند الانقطاع، ويُعلن أنه مبندل', () {
      final resolved = resolvePlayableGames(
        server: const [],
        catalog: const [],
        bundled: bundled,
        catalogIsBundled: true,
      );
      expect(resolved.games.map((game) => game.id), ['game-bundled-1', 'game-bundled-2']);
      // العلَم هو ما يجعل الإشعار يظهر. وبلا إشعار يُقرأ المبندل كأنه المنشور.
      expect(resolved.usesBundled, isTrue);
    });

    test('حزمةٌ فارغة لا تُعلن استخدامًا', () {
      final resolved = resolvePlayableGames(
        server: const [],
        catalog: const [],
        bundled: const [],
        catalogIsBundled: true,
      );
      expect(resolved.games, isEmpty);
      expect(resolved.usesBundled, isFalse, reason: 'إشعارٌ بلا محتوًى يربك');
    });
  });

  group('التطبيع عند إزالة التكرار', () {
    test('نفس اللعبة بسابقة وبدونها تُعدّ واحدة', () {
      // الحزمة تكتب `letter-tracing` والخادم `game-letter-tracing`.
      final resolved = resolvePlayableGames(
        server: [_item('game-letter-tracing')],
        catalog: const [],
        bundled: [_item('letter-tracing')],
        catalogIsBundled: true,
      );
      expect(resolved.games, hasLength(1));
      expect(resolved.games.single.id, 'game-letter-tracing');
    });

    test('الكاتالوج لا يُكرّر ما جاء من الخادم', () {
      final resolved = resolvePlayableGames(
        server: [_item('game-a')],
        catalog: [_item('game-a'), _item('game-b')],
        bundled: const [],
        catalogIsBundled: false,
      );
      expect(resolved.games.map((game) => game.id), ['game-a', 'game-b']);
    });
  });

  group('الشاشة', () {
    final source = File(
      'lib/features/home/presentation/pages/play_page.dart',
    ).readAsStringSync();

    test('لا ألعاب مكتوبة في الكود كـ«بديل مطلق»', () {
      // كانت ثلاثة عناصر `const ExperienceItem(...)` تُضاف حين يخلو كل شيء.
      // مصدرٌ رابع لا يزيد يقينًا: يزيد احتمال عرض ما لا يعرفه الخادم.
      expect(source.contains('const ExperienceItem('), isFalse);
    });

    test('الشاشة تُعلن استخدام الحزمة', () {
      expect(source, contains('resolved.usesBundled'));
      expect(source, contains('_OfflineLibraryNotice'));
    });

    test('الشاشة تقرأ فشل مزوّد الألعاب صريحًا', () {
      // `valueOrNull` وحدها كانت ستحوّل الخطأ إلى «لا ألعاب» في صمت.
      expect(source, contains('gamesAsync.hasError'));
    });
  });

  group('نطاق الأصول مصدرٌ واحد', () {
    test('لا ملف في `lib/` يكتب نطاق الـCDN حرفيًّا', () {
      // كان مكتوبًا ٥١ مرّة في `local_catalog.dart` ومرّة في `content_dtos.dart`
      // مستقلًّا عن إعداد البيئة. ونسيان سطرٍ عند تغيير النطاق لا يظهر كخطأ
      // ترجمة، بل كصورةٍ مكسورة عند طفل.
      final offenders = <String>[];
      for (final file in Directory('lib')
          .listSync(recursive: true)
          .whereType<File>()
          .where((file) => file.path.endsWith('.dart'))) {
        // الملف الذي يُعلن النطاق مُستثنًى بالاسم: هو المصدر.
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

    test('`assetBaseUrl` ثابتٌ صالح للاستخدام في سياق `const`', () {
      expect(AppConfig.assetBaseUrl, 'https://cdn.majarra.app');
      // ‏`const` لا getter: خرائط الأغلفة `const`، وgetter كان يُجبر على إسقاطها.
      expect(
        File('lib/core/env/app_environment.dart').readAsStringSync(),
        contains('static const String assetBaseUrl'),
      );
    });
  });
}
