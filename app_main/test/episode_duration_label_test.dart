import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/home/domain/content_models.dart';
import 'package:majarra/features/search/domain/search_engine.dart';

/// مدةٌ غير مقيسة لا تُعرض وصفًا (`CNT-108`).
///
/// ## العطل
///
/// `durationLabel` كانت تُعيد «قصيرة» عند `durationSeconds == 0`. وكل حلقة منشورة
/// بلا مدة مسجَّلة، فكل بطاقة كانت **تُقرّ بأن الحلقة قصيرة** — وهي ليست حقلًا
/// فارغًا بل **دعوى عن المحتوى لم يقِسها أحد**، تُعرض لوليّ أمرٍ يختار شيئًا قصيرًا
/// قبل النوم.
///
/// ## ما تحرسه هذه الاختبارات
///
/// أن المجهول يبقى مجهولًا (`null`)، وأن المقيس يظهر بدقّة — بما فيه ما دون الدقيقة،
/// فهو **مقيس** ويستحق تسمية لا كلمةً غامضة كانت تُستخدَم أيضًا بمعنى «لا أعرف».
void main() {
  EpisodeItem episode({required int seconds}) => EpisodeItem(
    id: 'ep-1',
    seriesId: 's-1',
    seriesTitle: 'سلسلة',
    title: 'حلقة',
    description: 'وصف',
    thumbnailAsset: 'assets/x.webp',
    durationSeconds: seconds,
    episodeNumber: 1,
  );

  group('durationLabel', () {
    test('صفرٌ يعني «لا أعرف» لا «قصيرة»', () {
      expect(episode(seconds: 0).durationLabel, isNull);
    });

    test('مدة سالبة أو معطوبة تبقى مجهولة', () {
      expect(episode(seconds: -5).durationLabel, isNull);
    });

    test('ما دون الدقيقة مقيسٌ فيُسمّى بدقّة', () {
      // الكلمة القديمة «قصيرة» كانت تخدم معنيين: مقيسٌ قصير، ومجهول. وأي كلمة
      // تخدم معنيين لا تُبلّغ أيًّا منهما.
      expect(episode(seconds: 45).durationLabel, 'أقل من دقيقة');
    });

    test('المقيس يُعرض بالدقائق', () {
      expect(episode(seconds: 480).durationLabel, '8 د');
      expect(episode(seconds: 61).durationLabel, '1 د');
    });
  });

  group('نتيجة البحث', () {
    HomeCatalog catalogWith(EpisodeItem item) => HomeCatalog(
      planets: const [],
      spotlights: const [],
      series: const [],
      episodes: [item],
      experiences: const [],
      source: ContentSource.remote,
    );

    test('بلا مدة مقيسة يبقى العنوان الفرعي اسم السلسلة وحده', () {
      final results = searchCatalog(catalogWith(episode(seconds: 0)), 'حلقة');
      expect(results, isNotEmpty);
      expect(results.first.subtitle, 'سلسلة');
      expect(
        results.first.subtitle,
        isNot(contains('قصيرة')),
        reason: 'لا وصف لمدة لم تُقَس',
      );
    });

    test('مع مدة مقيسة تُضاف بعد الفاصل', () {
      final results = searchCatalog(catalogWith(episode(seconds: 480)), 'حلقة');
      expect(results.first.subtitle, 'سلسلة • 8 د');
    });
  });
}
