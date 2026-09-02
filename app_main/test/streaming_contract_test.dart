import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/home/data/content_dtos.dart';
import 'package:majarra/features/home/domain/content_models.dart';

/// `APP-110` — عقد البثّ **مشحون ومُحلَّل**، والمُظلم هو البيانات.
///
/// ## ما وجدته
///
/// كان في `playback_page.dart` تعليق «Backend TODO» يسرد حقولًا مطلوب إضافتها إلى
/// `EpisodeDto.fromJson` «عندما يشحنها الخادم»: `preview_sprite_url` و
/// `intro_start_ms` و`audio_tracks` و`quality_renditions` وغيرها.
///
/// **وقد شُحنت كلّها.** `0047_episode_streaming_contract.sql` أضاف الأعمدة وجدولَي
/// المسارات، و`0048` أضاف `episode_renditions`، و`routes/episodes.ts` يُرسلها، و
/// `EpisodeDto.fromJson` يحلّلها، و`playback_page.dart` يستخدمها (تخطّي المقدمة،
/// معاينة التمرير، قائمة الترجمات، قائمة الجودة).
///
/// فالمُظلم اليوم **بيانات**: ثلاثة وثلاثون حلقة، وصفرُ صفٍّ في الجداول الثلاثة،
/// وصفرُ حلقةٍ لها `preview_sprite_url` أو `intro_start_ms`. تعبئتها عملُ تحرير
/// (`CNT-101`).
///
/// وهذا الملف يمنع رجوع الوهم من الجهتين: يُثبِّت أن التحليل قائم (فلا يُحذف
/// فيُقال «لم يُشحن»)، ويُثبِّت أن التعليق المُضلِّل لم يعد في المصدر.

/// البديل الذي يطلبه `toDomain`: لا يحمل شيئًا من عقد البثّ، فما يظهر في النتيجة
/// جاء من الردّ لا منه.
const _fallback = EpisodeItem(
  id: 'ep-1',
  seriesId: 'series-1',
  title: 'بديل',
  description: '',
  seriesTitle: '',
  thumbnailAsset: '',
  durationSeconds: 0,
);

void main() {
  /// حلقة كما يرسلها `GET /api/v1/episodes/:id` بعد `0047`/`0048`.
  Map<String, Object?> serverEpisode() => <String, Object?>{
    'id': 'ep-1',
    'series_id': 'series-1',
    'title_ar': 'الحلقة الأولى',
    'duration_seconds': 600,
    'intro_start_ms': 3000,
    'intro_end_ms': 18000,
    'recap_start_ms': 0,
    'recap_end_ms': 2000,
    'credits_start_ms': 570000,
    'preview_sprite_url': 'https://cdn.majarra.app/public/sprites/ep-1.jpg',
    'preview_sprite_vtt_url': 'https://cdn.majarra.app/public/sprites/ep-1.vtt',
    'quality_renditions': [
      {'label': '720p', 'asset_id': 'asset-720'},
      {'label': '1080p', 'asset_id': 'asset-1080'},
    ],
    'audio_tracks': [
      {'language': 'ar', 'label': 'العربية', 'is_default': 1},
      {'language': 'en', 'label': 'English', 'is_default': 0},
    ],
    'subtitle_tracks': [
      {'language': 'ar', 'label': 'العربية', 'format': 'vtt', 'is_default': 1},
    ],
  };

  group('العقد يُحلَّل كما يُرسَل', () {
    test('علامات المقدمة والملخّص والنهاية', () {
      final dto = EpisodeDto.fromJson(serverEpisode());
      expect(dto.introStartMs, 3000);
      expect(dto.introEndMs, 18000);
      expect(dto.recapStartMs, 0);
      expect(dto.recapEndMs, 2000);
      expect(dto.creditsStartMs, 570000);
    });

    test('مدى المقدمة يُشتقّ، وهو ما يُظهر «تخطي المقدمة»', () {
      final episode = EpisodeDto.fromJson(serverEpisode()).toDomain(fallback: _fallback);
      final intro = episode.introRange;
      expect(intro, isNotNull);
      expect(intro!.start, const Duration(milliseconds: 3000));
      expect(intro.end, const Duration(milliseconds: 18000));
    });

    test('مدى غير صالح لا يُشتقّ، فلا يظهر زرّ يقفز إلى الخلف', () {
      // النهاية قبل البداية: بيانات محرِّر خاطئة، لا حالة يجب أن يراها طفل.
      final invalid = serverEpisode()
        ..['intro_start_ms'] = 18000
        ..['intro_end_ms'] = 3000;
      expect(EpisodeDto.fromJson(invalid).toDomain(fallback: _fallback).introRange, isNull);
    });

    test('معاينة التمرير: الصورة وملف الـVTT', () {
      final dto = EpisodeDto.fromJson(serverEpisode());
      expect(dto.previewSpriteUrl, contains('/sprites/ep-1.jpg'));
      expect(dto.previewSpriteVttUrl, contains('/sprites/ep-1.vtt'));
    });

    test('الجودة والمسارات الصوتية والترجمات', () {
      final dto = EpisodeDto.fromJson(serverEpisode());
      expect(dto.qualityRenditions, hasLength(2));
      expect(dto.audioTracks, hasLength(2));
      expect(dto.subtitleTracks, hasLength(1));
    });

    test('حلقة بلا أي من هذه الحقول تبقى صالحة للتشغيل', () {
      // هذه هي حالة الإنتاج اليوم: الحقول كلّها `null`/فارغة، والمشغّل يعمل.
      final bare = EpisodeDto.fromJson(<String, Object?>{
        'id': 'ep-2',
        'series_id': 'series-1',
        'title_ar': 'حلقة بلا عقد بثّ',
      }).toDomain(fallback: _fallback);
      expect(bare.introRange, isNull);
      expect(bare.previewSpriteUrl, isNull);
      expect(bare.qualityRenditions, isEmpty);
      expect(bare.audioTracks, isEmpty);
      expect(bare.subtitleTracks, isEmpty);
    });
  });

  group('التوثيق لا يصف عالمًا لم يبقَ', () {
    final playback = File(
      'lib/features/playback/presentation/playback_page.dart',
    ).readAsStringSync();

    test('لا «Backend TODO» يطلب إضافة ما هو مُضاف', () {
      // تعليقٌ كهذا أسوأ من غيابه: يقرؤه المطوّر فيستنتج أن الميزة غير مُنفَّذة،
      // فيعيد بناء ما هو مبنيّ — أو يخبر صاحب المنتج أنها «تنتظر الخادم» وهي
      // تنتظر محرّرًا.
      expect(playback.contains('Backend TODO'), isFalse);
    });

    test('والسبب الحقيقي مكتوب: البيانات لا الكود', () {
      expect(playback, contains('CNT-101'));
      expect(playback, contains('0047_episode_streaming_contract.sql'));
    });
  });
}
