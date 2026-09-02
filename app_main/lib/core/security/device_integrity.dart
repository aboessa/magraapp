import 'package:flutter/services.dart';

/// رصد إشارات سلامة الجهاز (`SEC-107`).
///
/// ## ما ترصده وما لا ترصده
///
/// `تشفير المحتوي.md:22` يطلب مؤشرات Root/Jailbreak/Debugger/Emulator/Hooking.
/// وهذا الملف يقرؤها من الطبقة الأصلية ويرسلها **كبيانات**: لا قرار هنا ولا
/// حجب. السياسة كلها في الخادم (`lib/deviceIntegrity.ts`)، لأن تغييرها هناك لا
/// يحتاج تحديث تطبيق، ولأن جهازًا مكسورًا هو أسوأ من يُؤتمن على سياسة عن نفسه.
///
/// ## ولماذا الفشل يعني «لا شيء» لا «خطر»
///
/// منصّة بلا تنفيذ أصلي — ويب، سطح مكتب، اختبار — تُنتج مجموعة فارغة، وكذلك أي
/// استثناء. ولو كان الغياب يُقرأ خطرًا لصار كل جهاز لا نعرفه مشتبهًا به، وهذا
/// عكس السياسة: الإشارة إرشادية، وغيابها ليس دليلًا.
class DeviceIntegrityService {
  const DeviceIntegrityService({MethodChannel? channel})
      : _channel = channel ?? _defaultChannel;

  static const _defaultChannel = MethodChannel('com.majarra/device');

  final MethodChannel _channel;

  /// أسماء الإشارات كما يعرفها الخادم.
  ///
  /// نفس القائمة المغلقة في `INTEGRITY_SIGNALS`: ما ليس فيها يُهمَل هناك، فلا
  /// معنى لإرساله من هنا.
  static const knownSignals = <String>{
    'root_binaries',
    'root_manager_app',
    'test_keys',
    'jailbreak_paths',
    'sandbox_escape',
    'hooking',
    'emulator',
    'debugger',
  };

  /// الإشارات المرصودة الآن، أو مجموعة فارغة إن لم يكن الرصد متاحًا.
  Future<Set<String>> signals() async {
    try {
      final result = await _channel.invokeMapMethod<String, Object?>('deviceIntegrity');
      if (result == null) return const <String>{};
      return {
        for (final entry in result.entries)
          if (entry.value == true && knownSignals.contains(entry.key)) entry.key,
      };
    } on MissingPluginException {
      return const <String>{};
    } on PlatformException {
      return const <String>{};
    }
  }

  /// الشكل الذي يرسله طلب جلسة التنزيل: أسماء إشارات وقيَم `true` فقط.
  ///
  /// و`null` حين لا شيء لتُرصد — الحالة الطبيعية لا ترسل حقلًا فارغًا.
  Future<Map<String, bool>?> reportForServer() async {
    final detected = await signals();
    if (detected.isEmpty) return null;
    return {for (final signal in detected) signal: true};
  }
}
