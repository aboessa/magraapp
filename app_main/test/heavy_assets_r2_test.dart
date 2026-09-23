/// يحرس عقد ترحيل الصور الثقيلة إلى R2: لا إعلان مبندل، واشتقاق منتظم.
///
/// ## سبب وجود هذا الملف
///
/// 135 ملفًّا raster (‏49.8MB ‏← 5.5MB بتحويل WebP q82) رُفعت إلى
/// `public/catalog/assets/images/<rel>.webp` بسكربت `tools/upload_heavy_r2.mjs`.
/// والانحدار المخيف هنا صامتٌ تمامًا: إعادة سطر `- assets/images/coloring/v2/`
/// إلى `pubspec.yaml` تُعيد 3.7MB دون خطأ بناء أو تحذير — فقط تطبيقٌ أكبر.
///
/// ## ما يُفحَص
///
///   * المجلّدات المُرحَّلة غير مُعلَنة (لا جملةً ولا ضمنًا)،
///   * `heavyCdnUrl` يشتقّ التوأم لكلّ raster مُرحَّل ويعيد `null` لغيره
///     (SVG يبقى مبندلًا عمدًا: 111 ملفًّا بـ60KB)،
///   * ولا نطاق CDN حرفيًّا خارج `app_environment.dart` (قاعدة `APP-103`).
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/env/app_environment.dart';
import 'package:majarra/core/images/heavy_assets.dart';

/// أسطر إعلان الأصول (بلا تعليقات YAML — الشرح يذكر المسارات نصًّا).
List<String> _declaredAssetLines() {
  return File('pubspec.yaml')
      .readAsStringSync()
      .split('\n')
      .map((line) => line.trim())
      .where((line) => !line.startsWith('#'))
      .where((line) => line.startsWith('- assets/'))
      .map((line) => line.substring('- '.length).trim())
      .toList();
}

void main() {
  group('عقد ترحيل الصور الثقيلة', () {
    test('المجلّدات المُرحَّلة غير مُعلَنة في `pubspec.yaml`', () {
      const migrated = [
        'assets/images/coloring/v2/',
        'assets/images/connect_dots/',
        'assets/images/draw_like_me/v2/',
        'assets/images/draw_like_me/v2-final/',
        'assets/images/draw_like_me/heroes/',
      ];
      final declared = _declaredAssetLines();
      for (final dir in migrated) {
        expect(
          declared,
          isNot(contains(dir)),
          reason: '$dir على R2 — إعلانه يُعيد ميغابايتات إلى الـAPK بصمت.',
        );
      }
    });

    test('`heavyCdnUrl` يشتقّ التوأم WebP للـraster المُرحَّل', () {
      expect(
        heavyCdnUrl('assets/images/coloring/v2/bird.png'),
        '${AppConfig.assetBaseUrl}/public/catalog/assets/images/coloring/v2/bird.webp',
      );
      expect(
        heavyCdnUrl('assets/images/draw_like_me/v2-final/animal-01-bird-branch.png'),
        '${AppConfig.assetBaseUrl}/public/catalog/assets/images/draw_like_me/v2-final/animal-01-bird-branch.webp',
      );
      expect(
        heavyCdnUrl('assets/images/landing/login-bg-landscape.png'),
        '${AppConfig.assetBaseUrl}/public/catalog/assets/images/landing/login-bg-landscape.webp',
      );
      // JPG أيضًا له توأم (رُفع webp).
      expect(
        heavyCdnUrl('assets/images/landing/login-tv.jpg'),
        '${AppConfig.assetBaseUrl}/public/catalog/assets/images/landing/login-tv.webp',
      );
      // WebP مصدرًا له توأم مُعاد الترميز (كتب `books/` مبندلة WebP أصلًا —
      // فلتر raster-only القديم أسقطها من الرفع وترك 404، والسكربت حُذف فلتره).
      expect(
        heavyCdnUrl('assets/images/books/book-qisas-p1.webp'),
        '${AppConfig.assetBaseUrl}/public/catalog/assets/images/books/book-qisas-p1.webp',
      );
    });

    test('`heavyCdnUrl` يعيد `null` لغير المُرحَّل (SVG يبقى مبندلًا)', () {
      // SVG المتجهي: 111 ملفًّا بمجموع 60KB — رحلة شبكة تشتري صفرًا.
      expect(
        heavyCdnUrl('assets/images/drawing/coloring/color-bird.svg'),
        isNull,
      );
      // خارج النطاق المُرحَّل: chrome الاستوديو وواجهة التطبيق.
      expect(
        heavyCdnUrl('assets/images/studio/card-coloring.webp'),
        isNull,
      );
      expect(heavyCdnUrl(''), isNull);
      expect(
        heavyCdnUrl('assets/images/coloring/bird.png'),
        isNull,
        reason: 'ملفّ مفرد خارج المجلّدات المُرحَّلة — البادئة على المجلّد.',
      );
    });

    test('`heavyStudioBannerUrl` يشتقّ اللافتات الخمس ويرفض البطاقات', () {
      // كلّ لافتة PNG مبندلة سابقة لها توأم WebP مرفوع
      // (`tools/upload_studio_banners_r2.mjs`) — والـwebp المبندل يرسم فورًا.
      for (final banner in [
        'assets/images/studio/coloring-banner.png',
        'assets/images/studio/connect-dots-banner.png',
        'assets/images/studio/draw-like-me-banner.png',
        'assets/images/studio/studio-main-banner.png',
        'assets/images/studio/homebgaart.png',
      ]) {
        final name = banner.split('/').last.replaceAll('.png', '.webp');
        expect(
          heavyStudioBannerUrl(banner),
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/studio/$name',
          reason: banner,
        );
      }
      // البطاقات chrome صغير مبندل (8–20KB): لا توأم، لا رابط — اشتقاقٌ لها
      // كان يعِد بما لم يُرفَع (فجوة `books/` نفسها).
      expect(
        heavyStudioBannerUrl('assets/images/studio/card-coloring.webp'),
        isNull,
      );
      expect(
        heavyStudioBannerUrl('assets/images/studio/hero-connect-dots.webp'),
        isNull,
        reason: 'لا PNG مصدر ولا توأم مرفوع — خارج البوابة عمدًا.',
      );
    });

    test('لا نطاق CDN حرفيًّا في `lib/` خارج مصدره', () {
      final offenders = <String>[];
      for (final file in Directory('lib')
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
      expect(
        offenders,
        isEmpty,
        reason: 'النطاق مصدرٌ واحد (`AppConfig.assetBaseUrl`) — انظر `APP-103`.',
      );
    });
  });
}
