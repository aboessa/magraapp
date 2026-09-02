import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// حماية العرض أثناء تشغيل محتوى مرخَّص.
///
/// ## طبقتان مختلفتان، ولكل منصّة ما تسمح به
///
/// **Android — منع.** `FLAG_SECURE` يمنع لقطة الشاشة وتسجيلها والمرآة إلى شاشة
/// غير آمنة على نافذة التطبيق. يُطبَّق أثناء التشغيل وحده لأنه يمنع أيضًا لقطات
/// مشروعة لبقية الشاشات، وعلى بعض الأجهزة يزعج أدوات إمكانية الوصول.
///
/// **منصّات Apple — رصد لا منع (`ENC-014`).** لا واجهة عامة تمنع تسجيل الشاشة
/// أو المرآة على iOS/iPadOS/tvOS. الموجود `UIScreen.isCaptured` (iOS 11+) وهو
/// **إشارة** تصير `true` عند تسجيل الشاشة وعند المرآة وعند AirPlay. فالسلوك
/// الممكن — وهو ما تطلبه §24 — أن نرصد ونوقف المحتوى، لا أن نمنع.
///
/// وهذا حدّ صريح لا نُخفيه: من يسجّل بكاميرا خارجية لا يُرصد على أي منصّة،
/// والمنع الحقيقي للتدفق يحتاج DRM بخادم تراخيص لا يملكه المشروع (`ENC-009`).
///
/// ## ما لا يفعله هذا الصف عن قصد
///
/// لا يحذف بيانات، ولا يُبطل جلسة، ولا يسجّل عقوبة على إشارة رصد واحدة
/// (معيار قبول صريح في `ENC-014`). إشارة `isCaptured` تصير `true` أيضًا عند
/// عرض مشروع تمامًا: أب يعرض حلقة على تلفاز عبر AirPlay. العقاب على ذلك خطأ
/// في حقّ مستخدم يدفع.
class ScreenCaptureGuard {
  const ScreenCaptureGuard();

  static const _channel = MethodChannel('com.majarra/device');

  /// تدفّق تغيّرات حالة الرصد من الطبقة الأصلية.
  ///
  /// قناة أحداث لا استقصاء دوري: الاستقصاء إمّا متأخّر — فتُسجَّل ثوانٍ من
  /// المحتوى قبل أن نلاحظ — أو مكلف على البطارية أثناء التشغيل.
  static const _captureEvents = EventChannel('com.majarra/device/capture');

  /// المنصّات التي فيها علامة نافذة آمنة (منع فعلي).
  static bool get supportsSecureWindow =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  /// المنصّات التي يمكن فيها **رصد** التسجيل أو المرآة.
  ///
  /// منصّات Apple وحدها: على Android المنع نفسه قائم فلا حاجة للرصد، وعلى
  /// الويب والحاسب لا سبيل إلى أيّهما.
  static bool get supportsCaptureDetection =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.macOS);

  Future<void> enable() => _setSecure(true);
  Future<void> disable() => _setSecure(false);

  Future<void> _setSecure(bool enabled) async {
    if (!supportsSecureWindow) return;
    try {
      await _channel.invokeMethod<void>('setSecureFlag', {'enabled': enabled});
    } on PlatformException {
      // An older build of the host app may not implement the handler. Failing
      // to set the flag must never prevent playback.
    } on MissingPluginException {
      // Same reasoning: the channel is absent in unit tests.
    }
  }

  /// حالة الرصد الآن. `false` حيث لا رصد ممكن.
  ///
  /// الافتراض عند أي فشل هو «غير مسجَّل»: بناء مضيف أقدم لا يعرف الطريقة، أو
  /// قناة غائبة في الاختبار، لا يجوز أن يمنع طفلًا من مشاهدة ما يحقّ له.
  /// الرصد إجراء تخفيف، وتحويل فشله إلى منع يعاقب المستخدم على عيب فينا.
  Future<bool> isCaptured() async {
    if (!supportsCaptureDetection) return false;
    try {
      return await _channel.invokeMethod<bool>('isCaptured') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  /// تغيّرات حالة الرصد. تدفّق فارغ حيث لا رصد ممكن.
  Stream<bool> captureChanges() {
    if (!supportsCaptureDetection) return const Stream<bool>.empty();
    return _captureEvents
        .receiveBroadcastStream()
        .map((event) => event == true)
        // خطأ في القناة لا يُسقِط التشغيل: يُقرأ كـ«غير مسجَّل» ويستمر التدفّق.
        .handleError((Object _) {});
  }
}
