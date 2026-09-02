import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:majarra/core/diagnostics/ignored_errors.dart';
import 'package:majarra/core/network/secure_http_client.dart';
import 'package:majarra/features/playback/data/caption_repository.dart';

/// `APP-102` — لا شبكة داخل `presentation/`.
///
/// ## العلّة المقيسة
///
/// تسع ميزات بلا `data/` ولا `domain/`، فكل نداء شبكة مكتوبٌ داخل `State`
/// بأيدٍ مختلفة. والأثر الذي ظهر عند القياس أخطر من عدم الاتساق: **موضعان
/// كانا ينفّذان `http.get` عاريًا**، أي بمخزن ثقة النظام لا بالعميل المثبَّت
/// (`SEC-105`) — أحدهما يحمّل **نصّ ترجمة يُعرَض على طفل**، والآخر صورة تلوين.
/// فأي جذر مزروع على الجهاز يستطيع استبدال ما يقرأه الطفل.
///
/// وأحدهما كان **بلا مهلة** أصلًا، والآخر بمهلةٍ ثالثة (٢٠ ثانية) لا تشبه مهلة
/// العميل. والخدمة التي يحتاجها الثاني كانت موجودة، مثبَّتةً وبمهلة، فكان
/// التطبيقان لعملٍ واحد وأحدهما انحرف إلى ما هو أقل أمنًا.

void main() {
  group('لا مسار شبكة ثانٍ في طبقة العرض', () {
    test('لا ملف في `presentation/` يستورد `package:http`', () {
      // خاصيّة لا موضع: أي ملف عرضٍ **جديد** يفتح مسارًا شبكيًّا بنفسه يُفشل
      // هذه الجولة. وهذا هو معيار قبول `APP-102` بصيغة تُنفَّذ.
      final offenders = <String>[];
      for (final file in _dartFilesUnder('lib/features')) {
        if (!file.path.replaceAll(r'\', '/').contains('/presentation/')) continue;
        final source = file.readAsStringSync();
        if (RegExp(r"""import\s+'package:http/http\.dart'""").hasMatch(source)) {
          offenders.add(file.path);
        }
      }
      expect(
        offenders,
        isEmpty,
        reason: 'الشبكة تُستدعى من `data/` عبر مزوّد يحمل العميل المثبَّت',
      );
    });

    test('خدمة الأصول الإبداعية لا تُبنى داخل طبقة العرض', () {
      // ثلاث صفحات كانت تكتب `CreativeRemoteAssetsService()` بنفسها، وكل نسخة
      // تُنشئ عميلًا مثبَّتًا جديدًا **لا يُغلَق**.
      final offenders = <String>[];
      for (final file in _dartFilesUnder('lib/features')) {
        if (!file.path.replaceAll(r'\', '/').contains('/presentation/')) continue;
        if (_withoutComments(file.readAsStringSync())
            .contains('CreativeRemoteAssetsService(')) {
          offenders.add(file.path);
        }
      }
      expect(offenders, isEmpty, reason: 'تُقرأ من `creativeRemoteAssetsServiceProvider`');
    });

    test('لا مزوّد يجلب من الشبكة مُعلَنٌ داخل ملف صفحة', () {
      // ثلاثة مزوّدات كانت مُعلَنة في ملفات صفحات، وأخطرها `familyChildrenProvider`:
      // يقرأه `app_router.dart` ليقرّر ما إذا كانت الأسرة أكملت التهيئة. أي أن
      // سبعة مواضع كانت تستورد **ملف صفحة** لتصل إلى حالة تخصّ التطبيق كلّه، ولا
      // شيء منها يُستبدَل في اختبار بلا بناء شجرة عناصر.
      //
      // والفحص على `FutureProvider`/`StreamProvider` وحدهما: مزوّدٌ متزامن لعنصر
      // عرضٍ محليّ (لون، حالة تمرير) موضعه الصفحة، ومنعُه تزمُّتٌ بلا سبب.
      final offenders = <String>[];
      final declaration = RegExp(
        r'^final\s+\w+\s*=\s*(Future|Stream)Provider',
        multiLine: true,
      );
      for (final file in _dartFilesUnder('lib/features')) {
        final path = file.path.replaceAll(r'\', '/');
        if (!path.contains('/presentation/')) continue;
        if (declaration.hasMatch(_withoutComments(file.readAsStringSync()))) {
          offenders.add(file.path);
        }
      }
      expect(offenders, isEmpty, reason: 'مزوّدات الجلب تُعلَن في `application/`');
    });

    test('العميل المثبَّت هو الافتراضي في مستودع الترجمة ومزوّده', () {
      // المزوّد يقرأ `httpClientProvider` — العميل الوحيد المثبَّت والمُغلَق مع
      // دورة حياة التطبيق. وقراءته من هناك هي ما يمنع عودة عميل خاصّ.
      final providers = File(
        'lib/features/playback/application/playback_providers.dart',
      ).readAsStringSync();
      expect(providers, contains('httpClientProvider'));
      final creative = File(
        'lib/features/games/application/creative_providers.dart',
      ).readAsStringSync();
      expect(creative, contains('httpClientProvider'));
    });
  });

  group('CaptionRepository', () {
    setUp(resetIgnoredErrors);

    test('يعيد نصّ WebVTT كما هو عند 200', () async {
      // `http.Response(String, …)` يرمّز بـlatin-1 حين لا `charset` في الترويسة،
      // فلا يقبل عربيًّا أصلًا. البايتات هي الشكل الصادق لما يصل من الشبكة.
      final repository = CaptionRepository(
        MockClient(
          (_) async => http.Response.bytes(
            utf8.encode('WEBVTT\n\n00:00.000 --> 00:01.000\nمرحبًا'),
            200,
          ),
        ),
      );
      final vtt = await repository.load('https://cdn.majarra.app/c/ar.vtt');
      expect(vtt, contains('WEBVTT'));
      expect(vtt, contains('مرحبًا'));
      expect(ignoredErrors, isEmpty);
    });

    test('يفكّ الترميز utf8 لا حسب ترويسة النوع', () async {
      // ملفات VTT تُخدَم أحيانًا بلا `charset`، و`response.body` حينها يقرأ
      // latin-1 فيظهر العربي مشوَّهًا — والطفل يرى رموزًا.
      final arabic = 'WEBVTT\n\nمرحبًا بالعالم';
      final repository = CaptionRepository(
        MockClient(
          (_) async => http.Response.bytes(
            utf8.encode(arabic),
            200,
            headers: const {'content-type': 'text/vtt'},
          ),
        ),
      );
      expect(await repository.load('https://cdn.majarra.app/c/ar.vtt'), arabic);
    });

    test('حالة غير 200 تعيد null وتُسجَّل', () async {
      final repository = CaptionRepository(
        MockClient((_) async => http.Response('not found', 404)),
      );
      expect(await repository.load('https://cdn.majarra.app/c/ar.vtt'), isNull);
      expect(ignoredErrorCounts['caption_repository.status'], 1);
    });

    test('فشل الشبكة يعيد null ويُسجَّل — ولا يُرفَع', () async {
      // الرفع كان سيُسقط المشاهدة لأن ملف ترجمة لم يُحمَّل.
      final repository = CaptionRepository(
        MockClient((_) async => throw const SocketException('offline')),
      );
      expect(await repository.load('https://cdn.majarra.app/c/ar.vtt'), isNull);
      expect(ignoredErrorCounts['caption_repository.load'], 1);
    });

    test('فشل التحقّق من هوية الخادم يُهمَل بلا إعادة محاولة ويُسجَّل', () async {
      // اعتراضٌ على الشبكة لا يُعرَض على طفل ولا تُعاد المحاولة عليه.
      final repository = CaptionRepository(
        MockClient((_) async => throw const TlsVerificationException('cdn.majarra.app')),
      );
      expect(await repository.load('https://cdn.majarra.app/c/ar.vtt'), isNull);
      expect(ignoredErrorCounts['caption_repository.load'], 1);
    });

    test('المهلة تُطبَّق، فلا تعليق أبدي', () async {
      // العلّة الأصلية: هذا الطلب وحده كان بلا مهلة، فشبكةٌ تقبل الاتصال ولا
      // تُجيب تُعلّق تحميل الترجمة إلى الأبد.
      final repository = CaptionRepository(
        MockClient((_) async {
          await Future<void>.delayed(const Duration(seconds: 5));
          return http.Response('WEBVTT', 200);
        }),
        timeout: const Duration(milliseconds: 20),
      );
      expect(await repository.load('https://cdn.majarra.app/c/ar.vtt'), isNull);
      expect(ignoredErrorCounts['caption_repository.load'], 1);
    });

    test('عنوان فارغ أو غير صالح لا يُطلَب أصلًا', () async {
      var requested = 0;
      final repository = CaptionRepository(
        MockClient((_) async {
          requested++;
          return http.Response('WEBVTT', 200);
        }),
      );
      expect(await repository.load(''), isNull);
      expect(await repository.load('لا-مخطَّط-هنا'), isNull);
      expect(requested, 0);
      expect(ignoredErrorCounts['caption_repository.url'], 1);
    });

    test('null لا نصّ فارغ عند الفشل', () async {
      // الفارغ يمرّ إلى `WebVTTCaptionFile` كملفٍّ صالح بلا أسطر، فيستوي عند كل
      // قارئ لاحق «لا ترجمة لهذه الحلقة» و«ترجمة فشل تحميلها».
      final repository = CaptionRepository(
        MockClient((_) async => http.Response('', 500)),
      );
      expect(await repository.load('https://cdn.majarra.app/c/ar.vtt'), isNull);
    });
  });
}

/// يُسقط تعليقات السطر.
///
/// بلا هذا يرصد الحرسُ **التعليق الذي يشرح العطل** فيبلّغ عن الملف الذي أُصلح —
/// وحرسٌ يصرخ في السليم يُعطَّل في أوّل أسبوع.
String _withoutComments(String source) => source
    .split('\n')
    .where((line) => !line.trimLeft().startsWith('//'))
    .join('\n');

Iterable<File> _dartFilesUnder(String path) => Directory(path)
    .listSync(recursive: true)
    .whereType<File>()
    .where((file) => file.path.endsWith('.dart'));
