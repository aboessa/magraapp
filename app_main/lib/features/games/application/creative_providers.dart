import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../home/application/home_providers.dart';
import '../data/creative_remote_assets.dart';

/// خدمة أصول الاستوديو الإبداعي — نسخة واحدة على عميل HTTP واحد (`APP-102`).
///
/// ## علّتان أصلحهما هذا المزوّد
///
/// **الأولى: ثلاث صفحات كانت تبني الخدمة بنفسها** بـ
/// `final _service = CreativeRemoteAssetsService()`. وكل نسخة تُنشئ عميلًا
/// مثبَّتًا جديدًا (‏`createAppHttpClient()`)، **ولا يُغلَق أحدها** — فكل زيارة
/// للاستوديو تترك اتصالات مفتوحة وسياق ثقة محمَّلًا في الذاكرة.
///
/// **الثانية: لوحة التلوين لم تستخدم الخدمة أصلًا.** كانت تُنفّذ `http.get`
/// عاريًا على نفس عنوان الـCDN — بلا تثبيت شهادات. والخدمة كانت تملك الدالّة
/// المطلوبة (`fetchImageBytes`) مثبَّتةً وبمهلة. أي تطبيقان لعمل واحد، أحدهما
/// انحرف إلى ما هو أقل أمنًا: وهو بالحرف الأثر الذي يصفه `APP-102`.
///
/// والعميل من [httpClientProvider] لا من داخل الخدمة: هناك يُبنى مرّة ويُغلَق
/// مع دورة حياة الـProviderScope، وهو **المسار نفسه** الذي تمرّ به بقية طلبات
/// التطبيق. فلا يبقى مسار شبكة ثانٍ بسياسة ثقة خاصّة به.
final creativeRemoteAssetsServiceProvider = Provider<CreativeRemoteAssetsService>(
  (ref) => CreativeRemoteAssetsService(httpClient: ref.watch(httpClientProvider)),
);
