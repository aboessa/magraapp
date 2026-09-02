import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/home/data/content_dtos.dart';
import 'package:majarra/features/home/domain/content_models.dart';

void main() {
  test('mojibake decoder preserves correct Arabic', () {
    const correct = 'أبجد';
    expect(
      PlanetDto.fromJson({'id': 'abjad', 'name_ar': correct}).name,
      'أبجد',
    );
  });

  test('PlanetDto displayNames override remote name', () {
    final dto = PlanetDto.fromJson({'id': 'islamic', 'name_ar': 'Remote Name'});
    expect(dto.name, 'الإيمان'); // not Remote Name
    final alias = PlanetDto.fromJson({'id': 'iman', 'name_ar': 'Remote'});
    expect(alias.name, 'الإيمان'); // alias
  });

  test('boolean tolerates 0/1 and true/false', () {
    expect(
      SeriesDto.fromJson({'id': 's', 'title_ar': 't', 'is_free': 1}).isFree,
      isTrue,
    );
    expect(
      SeriesDto.fromJson({'id': 's', 'title_ar': 't', 'is_free': 0}).isFree,
      isFalse,
    );
    expect(
      SeriesDto.fromJson({'id': 's', 'title_ar': 't', 'is_free': true}).isFree,
      isTrue,
    );
    expect(
      SeriesDto.fromJson({'id': 's', 'title_ar': 't', 'is_free': false}).isFree,
      isFalse,
    );
  });

  test('age clamping 3-12', () {
    final dto = SeriesDto.fromJson({
      'id': 's',
      'title_ar': 't',
      'age_min': 1,
      'age_max': 20,
    });
    expect(dto.ageMin, 3);
    expect(dto.ageMax, 12);
  });

  test('story keeps its optional series association', () {
    final story = StoryDto.fromJson({
      'id': 'story-1',
      'title_ar': 'قصة',
      'series_id': 'series-1',
    });

    expect(story.seriesId, 'series-1');
  });

  test('story parses all extended detail fields from a full JSON payload', () {
    final story = StoryDto.fromJson({
      'id': 'story-1',
      'title_ar': 'قصة',
      'pages_count': 12,
      'reading_level': 'emerging',
      'languages': ['ar', 'en'],
      'narrators': [
        {'language': 'ar', 'asset_id': 'ignored-should-stay-null'},
      ],
      'listen_duration_ms': 5480,
      'characters': [
        {
          'id': 'char-1',
          'name_ar': 'زُغب',
          'name_en': null,
          'avatar_url': 'https://cdn/x.jpg',
        },
      ],
      'similar': [
        {'id': 'story-2', 'title_ar': 'أخرى', 'cover_url': 'https://cdn/y.jpg'},
      ],
      'chapters': [
        {'title': 'ف1'},
      ],
      'activities': [
        {'kind': 'quiz'},
      ],
    });

    expect(story.pagesCount, 12);
    expect(story.readingLevel, 'emerging');
    expect(story.availableLanguages, ['ar', 'en']);
    expect(story.narrators.single.language, 'ar');
    // The DTO does not actually discard `asset_id` despite the server (task
    // 8) always sending it as null — it reads whatever value is present.
    expect(story.narrators.single.assetId, 'ignored-should-stay-null');
    expect(story.listenDurationMs, 5480);
    expect(story.characters.single.avatarUrl, 'https://cdn/x.jpg');
    expect(story.similar.single.title, 'أخرى');
    expect(story.chapters.single['title'], 'ف1');
    expect(story.activities.single['kind'], 'quiz');
  });

  test('story defaults extended detail fields when absent from JSON', () {
    final story = StoryDto.fromJson({'id': 'story-1', 'title_ar': 'قصة'});

    expect(story.pagesCount, isNull);
    expect(story.readingLevel, isNull);
    expect(story.availableLanguages, isEmpty);
    expect(story.narrators, isEmpty);
    // `_nullableInteger`, not `_integer`: an absent listen duration must stay
    // null, not coerce to 0.
    expect(story.listenDurationMs, isNull);
    expect(story.characters, isEmpty);
    expect(story.similar, isEmpty);
    expect(story.chapters, isEmpty);
    expect(story.activities, isEmpty);
  });

  test('story tolerates completely wrong-typed fields without throwing', () {
    final story = StoryDto.fromJson({
      'id': 'story-1',
      'title_ar': 'قصة',
      'narrators': 'not-a-list',
      'characters': 42,
      'similar': {'not': 'a-list'},
      'chapters': null,
      'activities': true,
      'listen_duration_ms': 'not-a-number',
      'pages_count': <Object?>[],
      'languages': 'ar,en',
    });

    expect(story.narrators, isEmpty);
    expect(story.characters, isEmpty);
    expect(story.similar, isEmpty);
    expect(story.chapters, isEmpty);
    expect(story.activities, isEmpty);
    expect(story.listenDurationMs, isNull);
    expect(story.pagesCount, isNull);
    expect(story.availableLanguages, isEmpty);
  });

  test('story silently drops non-map entries within a mostly-valid list', () {
    final story = StoryDto.fromJson({
      'id': 'story-1',
      'title_ar': 'قصة',
      'narrators': [
        {'language': 'ar'},
        'not-a-map',
        42,
        null,
      ],
    });

    expect(story.narrators.length, 1);
    expect(story.narrators.single.language, 'ar');
  });

  test('toDomain carries every extended field into StoryItem unchanged', () {
    final story = StoryDto.fromJson({
      'id': 'story-1',
      'title_ar': 'قصة',
      'pages_count': 12,
      'reading_level': 'emerging',
      'languages': ['ar', 'en'],
      'narrators': [
        {'language': 'ar', 'asset_id': 'ignored-should-stay-null'},
      ],
      'listen_duration_ms': 5480,
      'characters': [
        {
          'id': 'char-1',
          'name_ar': 'زُغب',
          'name_en': null,
          'avatar_url': 'https://cdn/x.jpg',
        },
      ],
      'similar': [
        {'id': 'story-2', 'title_ar': 'أخرى', 'cover_url': 'https://cdn/y.jpg'},
      ],
      'chapters': [
        {'title': 'ف1'},
      ],
      'activities': [
        {'kind': 'quiz'},
      ],
    });

    final item = story.toDomain();

    expect(item.pagesCount, story.pagesCount);
    expect(item.readingLevel, story.readingLevel);
    expect(item.availableLanguages, story.availableLanguages);
    expect(item.narrators, story.narrators);
    expect(item.listenDurationMs, story.listenDurationMs);
    expect(item.characters, story.characters);
    expect(item.similar, story.similar);
    expect(item.chapters, story.chapters);
    expect(item.activities, story.activities);
  });

  test('catalog returns only stories associated with a series', () {
    const catalog = HomeCatalog(
      planets: [],
      spotlights: [],
      series: [],
      episodes: [],
      experiences: [],
      stories: [
        StoryItem(
          id: 'story-1',
          seriesId: 'series-1',
          title: 'Story one',
          description: '',
          type: 'picture_book',
          ageMin: 3,
          ageMax: 5,
        ),
        StoryItem(
          id: 'story-2',
          seriesId: 'series-2',
          title: 'Story two',
          description: '',
          type: 'picture_book',
          ageMin: 6,
          ageMax: 8,
        ),
      ],
      source: ContentSource.remote,
    );

    expect(catalog.storiesFor('series-1').map((story) => story.id), ['story-1']);
  });
}