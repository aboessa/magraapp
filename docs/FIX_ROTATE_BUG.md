# إصلاح مشكلة الـ Rotate – العرض بيبوظ لما أعمل Rotate على الموبايل

## المشكلة

> فيه مشكله كبيرة في التطبيق علي الموبايل لما بعمل Rotate بيبوظ خالص والعرض بييبوظ في كل الصفحات

## السبب الجذري

1. **مفيش أي `setPreferredOrientations` في التطبيق كله** – grep أظهر صفر نتائج لـ orientation lock قبل الإصلاح
2. `AndroidManifest.xml` فيه `configChanges="orientation|..."` – يعني الـ Activity ما بيعملش recreate، والـ Flutter هو المسؤول
3. `Info.plist` كان سامح `LandscapeLeft + LandscapeRight` للـ iPhone
4. `PlaybackPage` كان بيعمل `setPreferredOrientations(DeviceOrientation.values)` عند الخروج – يسمح لكل الاتجاهات ويخلي التطبيق لاندسكيب بعد الفيديو!
5. كل الـ home pages فيها `LayoutBuilder` و `Scaffold` مبني على width صغير (compact) – في لاندسكيب 844x390 الـ layout بيحسب نفسه tablet ويبوظ

## الحل

### 1. lock portrait globally في `main.dart`

```dart
if (!kIsWeb) {
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
}
```

ده هو الحل الأساسي – نمنع الـ OS نفسه ي rotate. Web غير متأثر.

### 2. إصلاح `PlaybackPage` – لا يترك App في landscape بعد الفيديو

قبل:
```dart
_exit: setPreferredOrientations(DeviceOrientation.values) // يسمح كله!
```

بعد:
```dart
_exit: portraitUp + portraitDown // يرجع portrait
_toggle: نفس الشيء
```

### 3. iOS plist – iPhone portrait only, iPad كل الاتجاهات

```xml
UISupportedInterfaceOrientations (iPhone): Portrait + PortraitUpsideDown فقط
UISupportedInterfaceOrientations~ipad: كل الاتجاهات (tablet layout موجود)
```

### 4. Global safety net في `majarra_app.dart`

لو حصل rotate غير متوقع (keyboard, system dialog, multi-window):
- ن detect `width > height && width < 900` = phone landscape
- نعرض `_PortraitRequiredScreen` – شاشة بريميم "اقلب الجهاز عمودياً" بدل layout مكسور
- الفيديو exempt من الـ overlay

```dart
builder: (context, child) {
  final isLandscapeTooWide = width > height && width < 900;
  final isVideo = route contains 'playback';
  if (isLandscapeTooWide && !isVideo) return _PortraitRequiredScreen();
  return child;
}
```

### 5. `_PortraitRequiredScreen`

شاشة بريميم بنفس ثيم التطبيق:
- دائرة ذهبية مع أيقونة screen_rotation
- نص: "اقلب الجهاز عمودياً"
- وصف: "مجرة مصممة للعرض العمودي فقط على الهاتف. الفيديو يدعم الأفقي تلقائياً."

## النتيجة

- الموبايل: portrait فقط – لا ي rotate أبداً – لا layout يبوظ
- الفيديو: يسمح landscape مؤقتاً، ويرجع portrait عند الخروج – لا يترك App في landscape
- iPad/Tablet: يسمح كل الاتجاهات (layout adaptive موجود)
- Safety net: لو حصل rotate غير متوقع، نعرض شاشة توجيه بدل UI مكسور

## اختبار

1. افتح التطبيق على موبايل حقيقي – حاول تعمل rotate – لازم يبقى portrait
2. افتح فيديو – اعمل rotate – الفيديو يبقى landscape
3. اخرج من الفيديو – يرجع portrait فوراً
4. على Web – لا تأثير (browser يتحكم)

## ملاحظة عن أفلام الكارتون

التطبيق للأطفال 3-12 – معظمهم ماسك الموبايل عمودي. فيديو الأطفال قصير – لا حاجة ل landscape دائم. الحل الحالي مطابق لـ YouTube Kids و Disney+ Kids: portrait للـ browsing، landscape للـ player فقط.
