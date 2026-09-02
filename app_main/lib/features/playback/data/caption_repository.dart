import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/diagnostics/ignored_errors.dart';

/// تحميل ملفات الترجمة (WebVTT) للمُشغِّل (`APP-102`).
///
/// ## ما كان في الصفحة
///
/// كان `playback_page.dart` ينفّذ `http.get(Uri.parse(url))` عاريًا، ثم
/// `utf8.decode` ثم `WebVTTCaptionFile(...)` داخل `_captionsLoader`. وفيه ثلاث
/// علل مجتمعة:
///
/// 1. **بلا تثبيت شهادات.** `http.get` من مكتبة `http` مباشرةً يستخدم مخزن ثقة
///    النظام، فأي جذر مزروع على الجهاز — أداة تحليل، وكيل مؤسسي، اعتراض على
///    شبكة عامّة — يستطيع تقديم **نصّ ترجمة من عنده يُعرَض على الطفل**. وهذا هو
///    تحديدًا ما بُني `SEC-105` لمنعه، متجاوَزًا في موضعين.
/// 2. **بلا مهلة.** كل طلبات العميل المشترك لها مهلة، وهذا الطلب وحده كان
///    يستطيع التعليق إلى الأبد على شبكة تقبل الاتصال ولا تُجيب.
/// 3. **فشلٌ صامت تمامًا.** `catch (_) { return WebVTTCaptionFile(''); }` — لا
///    تُسجَّل، فترجمةٌ معطوبة أو محجوبة تُقرأ كـ«لا ترجمة لهذه الحلقة».
///
/// ## القرار: الفشل يبقى ترجمةً فارغة، ولكنه يُسجَّل
///
/// لم يُحوَّل الفشل إلى خطأ يوقف التشغيل. الطفل يشاهد حلقةً، وإسقاط المشاهدة
/// لأن ملف ترجمة لم يُحمَّل مقايضةٌ خاطئة. لكن الفشل **يُسجَّل** عبر قناة
/// `APP-106` التي لا ترفع ولا تعرض، فيصير نقصُ الترجمة قابلًا للرصد بدل أن
/// يُستنتَج من شكوى.
class CaptionRepository {
  const CaptionRepository(this._client, {Duration timeout = _defaultTimeout})
    : _timeout = timeout;

  /// نفس مهلة العميل المشترك (‏`MajarraApiClient._timeout`).
  ///
  /// ملف الترجمة أصغر من أي ردّ كاتالوج، فمهلةٌ أطول لا تشتري شيئًا: تُطيل
  /// انتظار الطفل أمام شاشةٍ تعمل بلا ترجمة.
  static const Duration _defaultTimeout = Duration(seconds: 8);

  final http.Client _client;
  final Duration _timeout;

  /// نصّ WebVTT، أو `null` إن لم يتوفّر.
  ///
  /// `null` لا نصّ فارغ: الفارغ يمرّ إلى `WebVTTCaptionFile` كملفٍّ صالح بلا
  /// أسطر، فيستوي «لا ترجمة» و«ترجمة فشل تحميلها» عند كل قارئ لاحق.
  Future<String?> load(String url) async {
    if (url.isEmpty) return null;
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme) {
      reportIgnoredError('caption_repository.url', 'عنوان ترجمة غير صالح: $url', null);
      return null;
    }
    try {
      final response = await _client.get(uri).timeout(_timeout);
      if (response.statusCode != 200) {
        reportIgnoredError(
          'caption_repository.status',
          'ترجمة ${response.statusCode} من ${uri.host}',
          null,
        );
        return null;
      }
      // `utf8.decode` لا `response.body`: الأخير يتبع ترويسة النوع، وملفات VTT
      // تُخدَم أحيانًا بلا `charset` فتُقرأ latin-1 ويظهر العربي مشوَّهًا.
      return utf8.decode(response.bodyBytes, allowMalformed: true);
    } catch (error, stack) {
      // يشمل `TlsVerificationException`: فشل التحقّق من هوية الخادم **لا
      // تُعاد المحاولة عليه** هنا، ولا يُعرض على طفل. يُسجَّل ويُعامَل كغياب
      // ترجمة.
      reportIgnoredError('caption_repository.load', error, stack);
      return null;
    }
  }
}
