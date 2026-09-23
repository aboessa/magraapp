import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../home/application/home_providers.dart';
import '../data/caption_repository.dart';
import '../data/media_probe_repository.dart';

/// أوّل طبقة `application/` لميزة المُشغِّل (`APP-102`).
///
/// كانت `features/playback` تحتوي `presentation/` وحدها: ملفٌّ واحد بـ٣٥٣٨ سطرًا
/// فيه جلسات التشغيل ونبضاتها وتحميل الترجمة والتحقّق من رمز وليّ الأمر. وأثر
/// ذلك المقيس أن **لا شيء منها يُختبَر بلا `pumpWidget`** — فلم يُختبَر شيء.
///
/// وهذا المزوّد لا يدّعي إصلاح الملف: هو يُخرج منه **الطلب الشبكي الوحيد الذي
/// كان يتجاوز العميل المثبَّت**، ويجعله قابلًا للاختبار وحدةً. وبقيّة نداءات
/// الجلسة تمرّ أصلًا بـ`MajarraApiClient`، فمكسب نقلها ترتيبيّ لا أمنيّ، وهو
/// مُسجَّل في `APP-102` بما بقي منه.
///
/// والعميل من [httpClientProvider]: مثبَّتٌ، ويُغلَق مع الـProviderScope.
final captionRepositoryProvider = Provider<CaptionRepository>(
  (ref) => CaptionRepository(ref.watch(httpClientProvider)),
);

/// فحص الوسائط قبل التهيئة (`APP-102`): نفس استخراج `CaptionRepository` —
/// كان `http.Client()` عاريًا داخل الصفحة، فصار مستودعًا بالعميل المثبَّت.
final mediaProbeRepositoryProvider = Provider<MediaProbeRepository>(
  (ref) => MediaProbeRepository(ref.watch(httpClientProvider)),
);
