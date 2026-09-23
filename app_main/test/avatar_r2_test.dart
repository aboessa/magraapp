/// يحرس عقد الأڤاتارات R2-أوّلًا: الكود يُشتق رابط CDN لكلّ أڤاتار، والحزمة
/// تحمل بديل عدم الاتصال وحده.
///
/// ## سبب وجود هذا الملف
///
/// بعد ترحيل الأڤاتارات إلى R2 (‏25.5MB ‏← 0.9MB بتحويل WebP) صار `assetPath`
/// بديلَ عدم اتصال لا مصدرًا. و`avatar_bundle_test.dart` القديم كان يفحص
/// «كلّ مستعمل مُعلَن» — وهو عكس العقد الجديد: أيّ أڤاتار يُعاد إعلانه هنا
/// يعود وزنًا ميتًا إلى الـAPK بصمت. فحُوِّلَت الحراسة:
///
///   * المبندل الوحيد المسموح: `luna-full.png` (بديل `byId(null)` للتشغيل
///     الأوّل دون شبكة)،
///   * وكلّ أڤاتار في `ChildAvatars.all` له `avatarUrl` مشتقّ على نطاق
///     `AppConfig` لا حرفيًّا (يحرسه `play_catalog_test.dart` أيضًا).
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/env/app_environment.dart';
import 'package:majarra/features/child/presentation/widgets/child_avatars.dart';

/// أسطر إعلان الأصول التي تُشير إلى الأڤاتارات (بلا تعليقات YAML).
List<String> _declaredAvatarEntries() {
  final pubspec = File('pubspec.yaml').readAsStringSync();
  return pubspec
      .split('\n')
      .map((line) => line.trim())
      .where((line) => !line.startsWith('#'))
      .where((line) => line.startsWith('- assets/avatars/'))
      .map((line) => line.substring('- '.length).trim())
      .toList();
}

void main() {
  group('عقد الأڤاتارات R2-أوّلًا', () {
    test('لا يُعلَن مجلّد أڤاتارات جملةً', () {
      final sweeping = _declaredAvatarEntries()
          .where((entry) => entry.endsWith('/'))
          .toList();
      expect(
        sweeping,
        isEmpty,
        reason: 'إعلان المجلّد جارف: يُعيد عشرات الميغابايت إلى الـAPK بصمت.',
      );
    });

    test('المبندل الوحيد هو بديل عدم الاتصال', () {
      // `byId(null)` هو ما يراه كلّ طفل بلا أڤاتار محفوظ، بما فيه التشغيل
      // الأوّل دون شبكة — إزالته تعني شاشة اختيار طفل بلا أيّ صورة.
      expect(
        _declaredAvatarEntries(),
        ['assets/avatars/characters/luna-full.webp'],
        reason: 'أيّ سطر زائد هنا وزنٌ ميت في الـAPK: الصور تُحمَّل من R2.',
      );
    });

    test('كلّ أڤاتار له رابط CDN مشتقّ على نطاق `AppConfig`', () {
      for (final avatar in ChildAvatars.all) {
        final url = avatar.avatarUrl;
        expect(url, isNotNull, reason: '${avatar.id} بلا رابط CDN');
        expect(
          url!,
          startsWith('${AppConfig.assetBaseUrl}/public/avatars/'),
          reason: '${avatar.id}: $url',
        );
        expect(url.endsWith('.webp'), isTrue, reason: '${avatar.id}: $url');
      }
      // البديل نفسه له توأم شبكي: متصلٌ يُحمَّل WebP الأخفّ لا PNG المبندل.
      expect(
        ChildAvatars.byId(null).avatarUrl,
        '${AppConfig.assetBaseUrl}/public/avatars/characters/luna-full.webp',
      );
    });

    test('لا نطاق CDN حرفيًّا في ملفّ الأڤاتارات', () {
      final source = File(
        'lib/features/child/presentation/widgets/child_avatars.dart',
      ).readAsStringSync().split('\n').where(
        (line) => !line.trimLeft().startsWith('//'),
      ).join('\n');
      expect(
        source.contains('cdn.majarra.app'),
        isFalse,
        reason: 'النطاق مصدرٌ واحد: `AppConfig.assetBaseUrl`.',
      );
    });

    test('بديل عدم الاتصال موجود على القرص فعلًا (WebP لا PNG)', () {
      // كان PNG (1.6MB) فصار WebP (65KB): نفس الصورة، 4% من الوزن.
      expect(
        File('assets/avatars/characters/luna-full.webp').existsSync(),
        isTrue,
      );
    });
  });
}
