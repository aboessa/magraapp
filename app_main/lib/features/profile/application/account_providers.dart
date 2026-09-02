/// أوّل طبقة `application/` لميزة الحساب (`APP-102`).
///
/// كانت `profile` تملك `data/` بلا `application/`، فمزوّدات الجلب مُعلَنة داخل
/// ملفات صفحات: اثنان في `account_data_page.dart` وواحد في `devices_page.dart`.
///
/// وهذه المزوّدات وجدها **حرسُ الدفعة** لا جردي: كتبتُ الاختبار ليمنع رجوع الثلاثة
/// التي نقلتها، فأشار إلى ثلاثة لم أكن أعرفها. وهو الفرق بين حرسٍ يثبّت خاصيّة
/// وحرسٍ يثبّت قائمةً كتبها إنسان.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../home/application/home_providers.dart';
import '../presentation/pages/account_data_page.dart' show AccountProfile;
import '../presentation/pages/devices_page.dart' show FamilyDevice;

/// ملفّ الحساب لوليّ الأمر.
///
/// `autoDispose` مُبقاة كما كانت: الصفحة تُفتَح من الإعدادات ولا يُنتظَر منها أن
/// تُبقي بيانات الحساب في الذاكرة بعد الخروج.
final accountProfileProvider = FutureProvider.autoDispose<AccountProfile>((ref) async {
  final envelope = await ref.watch(majarraApiClientProvider).getAccountProfile();
  return AccountProfile.fromEnvelope(envelope);
});

/// صفوف أطفال الأسرة كما يرسلها الخادم.
///
/// خامٌ عن قصد: هذه الشاشة تعرض بيانات الحساب للتصدير والحذف، وتشترك مع
/// `familyChildrenProvider` في المصدر لا في الشكل.
final accountChildrenProvider =
    FutureProvider.autoDispose<List<Map<String, Object?>>>((ref) {
      return ref.watch(majarraApiClientProvider).fetchChildren();
    });

/// أجهزة الأسرة المسجَّلة.
///
/// `GET /api/v1/family/devices` و`POST .../revoke` كانا مُنفَّذَين على الخادم بلا
/// أي مُنادٍ، والصفحة تعرض ثلاثة عناصر ثابتة وعدّادًا نصّيًّا `'3 من 4 أجهزة'`.
/// الاثنان موصولان الآن، والصفحة تطلب وليَّ أمر مُسجَّلًا فتظهر دعوةُ دخول صريحة بدل
/// قائمة فارغة.
final familyDevicesProvider = FutureProvider<List<FamilyDevice>>((ref) async {
  final api = ref.watch(majarraApiClientProvider);
  final rows = await api.fetchDevices();
  return rows.map(FamilyDevice.fromJson).toList(growable: false);
});
