import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/text/arabic_search.dart';
import 'package:majarra/features/home/domain/content_models.dart';
import 'package:majarra/features/search/domain/search_engine.dart';

void main() {
  group('ArabicSearch.normalize', () {
    test('strips tashkeel diacritics', () {
      expect(ArabicSearch.normalize('عُلُوم'), ArabicSearch.normalize('علوم'));
    });

    test('unifies alef forms', () {
      expect(ArabicSearch.normalize('أحمد'), ArabicSearch.normalize('احمد'));
      expect(ArabicSearch.normalize('إيمان'), ArabicSearch.normalize('ايمان'));
      expect(ArabicSearch.normalize('آفاق'), ArabicSearch.normalize('افاق'));
    });

    test('folds teh marbuta to heh and alef maqsura to yeh', () {
      expect(ArabicSearch.normalize('حكاية'), ArabicSearch.normalize('حكايه'));
      expect(ArabicSearch.normalize('مصطفى'), ArabicSearch.normalize('مصطفي'));
    });

    test('removes tatweel', () {
      expect(ArabicSearch.normalize('كتـــاب'), ArabicSearch.normalize('كتاب'));
    });

    test('converts Arabic-Indic digits', () {
      expect(ArabicSearch.normalize('١٢٣'), '123');
    });

    test('lowercases and collapses whitespace for Latin', () {
      expect(ArabicSearch.normalize('  Majarra   App '), 'majarra app');
    });
  });

  group('ArabicSearch.matches', () {
    test('matches despite diacritic and teh-marbuta differences', () {
      expect(ArabicSearch.matches('حكايه', 'حكاية وحكمة'), isTrue);
    });

    test('empty needle matches nothing', () {
      expect(ArabicSearch.matches('', 'anything'), isFalse);
    });

    test('all tokens must be present, order-independent', () {
      expect(ArabicSearch.matchesAllTokens('ارقام مغامرات', 'مغامرات الأرقام'), isTrue);
      expect(ArabicSearch.matchesAllTokens('ارقام حكايات', 'مغامرات الأرقام'), isFalse);
    });
  });

  group('searchCatalog', () {
    final catalog = HomeCatalog(
      planets: const [
        Planet(id: 'p1', name: 'كوكب العلوم', description: 'اكتشف', colorHex: '#fff', imageAsset: 'a'),
      ],
      spotlights: const [],
      series: const [
        SeriesItem(
          id: 's1',
          title: 'مغامرات الأرقام',
          description: 'سلسلة',
          planetName: 'كوكب الأرقام',
          posterAsset: 'a',
          bannerAsset: 'b',
          ageMin: 6,
          ageMax: 8,
          episodesCount: 4,
          type: 'series',
          isFree: true,
        ),
      ],
      episodes: const [
        EpisodeItem(
          id: 'e1',
          seriesId: 's1',
          title: 'السباق الكبير',
          description: 'حلقة',
          seriesTitle: 'مغامرات الأرقام',
          thumbnailAsset: 'a',
          durationSeconds: 300,
        ),
      ],
      experiences: const [
        ExperienceItem(id: 'g1', title: 'لعبة الذاكرة', subtitle: 'تدريب', imageAsset: 'a'),
      ],
      books: const [
        BookItem(
          id: 'b1',
          title: 'حكاية البذرة',
          description: 'قصة',
          type: 'story',
          ageMin: 3,
          ageMax: 6,
          posterAsset: 'a',
        ),
      ],
      source: ContentSource.local,
    );

    test('empty query returns nothing', () {
      expect(searchCatalog(catalog, '   '), isEmpty);
    });

    test('finds a series by normalised title', () {
      final results = searchCatalog(catalog, 'الارقام');
      expect(results.any((r) => r.kind == SearchResultKind.series && r.id == 's1'), isTrue);
    });

    test('searches across content types', () {
      expect(searchCatalog(catalog, 'حكايه').any((r) => r.kind == SearchResultKind.book), isTrue);
      expect(searchCatalog(catalog, 'الذاكره').any((r) => r.kind == SearchResultKind.game), isTrue);
      expect(searchCatalog(catalog, 'العلوم').any((r) => r.kind == SearchResultKind.planet), isTrue);
      expect(searchCatalog(catalog, 'السباق').any((r) => r.kind == SearchResultKind.episode), isTrue);
    });

    test('result routes point at the right destinations', () {
      final series = searchCatalog(catalog, 'الارقام').firstWhere((r) => r.kind == SearchResultKind.series);
      expect(series.route, '/series/s1');
    });
  });
}
