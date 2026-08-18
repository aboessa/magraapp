// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTitle => 'مجرة';

  @override
  String get loginTitle => 'أهلاً بك في مجرة';

  @override
  String get loginSubtitle => 'مساحة آمنة للخيال ومجرة كاملة للتعلم';

  @override
  String get emailLabel => 'البريد الإلكتروني';

  @override
  String get passwordLabel => 'كلمة المرور';

  @override
  String get loginButton => 'تسجيل دخول';

  @override
  String get enterEmailAndPassword => 'أدخل البريد وكلمة المرور';

  @override
  String get termsNotice =>
      'يمكنك مراجعة معلومات الخصوصية والبيانات قبل المتابعة';

  @override
  String get registerButton => 'إنشاء حساب';

  @override
  String get forgotPassword => 'نسيت كلمة المرور؟';

  @override
  String get noAccount => 'ليس لديك حساب؟';

  @override
  String get hasAccount => 'لديك حساب؟';

  @override
  String get createFamilyAccount => 'أنشئ حساب العائلة';

  @override
  String get oneAccountPerFamily => 'حساب واحد لكل العائلة';

  @override
  String get parentNameLabel => 'اسم ولي الأمر';

  @override
  String passwordMinLength(int count) {
    return 'كلمة المرور $count حرفًا على الأقل';
  }

  @override
  String get accountCreatedCheckEmail => 'تم إنشاء الحساب - تحقق من بريدك';

  @override
  String get back => 'رجوع';

  @override
  String get parentArea => 'منطقة ولي الأمر';

  @override
  String get createParentPin => 'أنشئ رمز ولي الأمر';

  @override
  String get enterParentPin => 'أدخل رمز ولي الأمر';

  @override
  String get savePin => 'حفظ الرمز';

  @override
  String get enter => 'دخول';

  @override
  String pinRangeHint(int min, int max) {
    return 'اختر رمزًا من $min إلى $max أرقام يعرفه ولي الأمر فقط';
  }

  @override
  String get pinConfirmLabel => 'تأكيد الرمز';

  @override
  String get pinMismatch => 'الرمزان غير متطابقين';

  @override
  String get pinEmpty => 'أدخل الرمز';

  @override
  String get pinIncorrect => 'رمز غير صحيح';

  @override
  String get pinIncorrectOneLeft => 'رمز غير صحيح. محاولة واحدة متبقية';

  @override
  String pinIncorrectAttemptsLeft(int count) {
    return 'رمز غير صحيح. $count محاولات متبقية';
  }

  @override
  String pinLockedOut(String label) {
    return 'محاولات كثيرة. حاول بعد $label';
  }

  @override
  String get pinNotEnrolledYet => 'لم يُنشأ رمز بعد. أنشئ رمزًا الآن.';

  @override
  String pinSavedLocallyOnly(String reason) {
    return 'تم حفظ الرمز محليًا؛ تعذّر حفظه على الخادم: $reason';
  }

  @override
  String minutesLabel(int count) {
    return '$count دقيقة';
  }

  @override
  String get momentsLabel => 'لحظات';

  @override
  String get serverErrorGeneric => 'خطأ في الخادم';

  @override
  String get serverUnreachable => 'تعذّر الاتصال بالخادم';

  @override
  String get tooManyAttemptsShort => 'محاولات كثيرة — حاول لاحقًا';

  @override
  String get sessionExpiredShort => 'انتهت الجلسة — سجّل الدخول مجددًا';

  @override
  String get parentPinDisclosure =>
      'الرمز محفوظ مشفَّرًا على هذا الجهاز وتتم مزامنته مع الخادم عند تسجيل الدخول. التحقق على الخادم هو الحد الحقيقي؛ الحماية المحلية تمنع الطفل من فتح المنطقة دون اتصال.';

  @override
  String get biometricUnavailable => 'البصمة / Face ID — غير متاح بعد';

  @override
  String get home => 'الرئيسية';

  @override
  String get search => 'بحث';

  @override
  String get profile => 'ملفي';

  @override
  String get settings => 'الإعدادات';

  @override
  String get settingsSectionPlayback => 'التشغيل';

  @override
  String get settingsSectionDownload => 'التنزيل';

  @override
  String get settingsSectionNotifications => 'الإشعارات';

  @override
  String get settingsSectionGeneral => 'عام';

  @override
  String get settingsSectionAccount => 'الحساب';

  @override
  String get autoplayNextTitle => 'تشغيل تلقائي للحلقة التالية';

  @override
  String get autoplayNextSubtitle =>
      'ينتقل المشغّل إلى الحلقة التالية عند الانتهاء';

  @override
  String get videoQualityTitle => 'جودة الفيديو';

  @override
  String get wifiOnlyTitle => 'التحميل عبر Wi-Fi فقط';

  @override
  String get wifiOnlySubtitle => 'توفير بيانات الهاتف';

  @override
  String get contentNotificationsTitle => 'إشعارات المحتوى الجديد';

  @override
  String get contentNotificationsSubtitle => 'حلقات وأعمال جديدة';

  @override
  String get languageLabel => 'اللغة';

  @override
  String get languageValueArabic => 'العربية';

  @override
  String get appearanceLabel => 'المظهر';

  @override
  String get appearanceValueDark => 'داكن سينمائي';

  @override
  String get settingsDeviceOnlyNotice =>
      'تُحفظ هذه الإعدادات على هذا الجهاز فقط، ولا تُزامن بين أجهزة الأسرة بعد.';

  @override
  String get accountDataTitle => 'بيانات الحساب';

  @override
  String get accountNotLinkedYet => 'لم تُربط بيانات الحساب بعد';

  @override
  String get nameLabel => 'الاسم';

  @override
  String get phoneLabel => 'رقم الهاتف';

  @override
  String get addAction => 'إضافة';

  @override
  String get changeAction => 'تغيير';

  @override
  String get accountEditUnavailable => 'تعديل البيانات غير متاح بعد';

  @override
  String get downloadsTitle => 'التحميلات';

  @override
  String get storageUsedTitle => 'التخزين المستخدم';

  @override
  String get storageComputedWhenEnabled =>
      'حجم التخزين يُحسب عند تفعيل التنزيل';

  @override
  String get noDownloadsTitle => 'لا يوجد تحميلات';

  @override
  String get noDownloadsBody => 'حمّل من زر التحميل في صفحة التفاصيل';

  @override
  String get doneShort => 'تم';

  @override
  String get supportTitle => 'الدعم الفني';

  @override
  String get supportHeadline => 'كيف نساعدك؟';

  @override
  String get supportResponseTime => 'لا توجد مدة استجابة منشورة حاليًا';

  @override
  String get supportChannelPending => 'قناة التواصل قيد الإعداد';

  @override
  String get supportFaqTitle => 'الأسئلة الشائعة';

  @override
  String get supportFaqSubtitle => 'لم تُنشر بعد';

  @override
  String get supportReportTitle => 'الإبلاغ عن مشكلة';

  @override
  String get supportSuggestTitle => 'اقتراح ميزة';

  @override
  String get supportCallTitle => 'اتصل بنا';

  @override
  String get supportCallSubtitle => 'رقم الدعم يُعلن قريباً';

  @override
  String get notAvailableYet => 'غير متاح بعد';

  @override
  String get licensesTitle => 'تراخيص البرمجيات';

  @override
  String get licensesSubtitle => 'الخطوط والحزم المستخدمة';

  @override
  String get logoutTitle => 'تسجيل الخروج';

  @override
  String get logoutConfirmBody =>
      'سيُطلب البريد وكلمة المرور في المرة القادمة، وسيُحذف رمز ولي الأمر من هذا الجهاز.';

  @override
  String get cancel => 'إلغاء';

  @override
  String get retry => 'إعادة المحاولة';

  @override
  String get offlineTitle => 'لا يوجد اتصال';

  @override
  String get offlineMessage => 'تحقق من الإنترنت وحاول مجددًا';

  @override
  String get contentUnavailable => 'المحتوى غير متاح حاليًا';

  @override
  String get authExpired => 'انتهت الجلسة. سجّل الدخول مجددًا';

  @override
  String get biometricReason => 'أكّد هويتك لفتح منطقة ولي الأمر';

  @override
  String get biometricEnableTitle => 'تفعيل الدخول بالبصمة';

  @override
  String get biometricEnablePrompt =>
      'هل تريد استخدام البصمة أو Face ID لفتح منطقة ولي الأمر على هذا الجهاز بدل إدخال الرمز في كل مرة؟';

  @override
  String get notNow => 'ليس الآن';

  @override
  String get enable => 'تفعيل';

  @override
  String get creativeStudioTitle => 'استوديو الإبداع';

  @override
  String get myBoards => 'لوحاتي';

  @override
  String get drawLikeThis => 'ارسم مثلي';

  @override
  String get coloring => 'التلوين';

  @override
  String get tracing => 'التتبع';

  @override
  String get connectDots => 'صل النقاط';

  @override
  String get completeDrawing => 'أكمل الرسمة';

  @override
  String get copyPattern => 'انسخ النمط';

  @override
  String get drawFromPrompt => 'ارسم من الفكرة';

  @override
  String get newBoard => 'لوحة جديدة';

  @override
  String get newBlankBoard => 'لوحة بيضاء فارغة';

  @override
  String get continueDrawing => 'متابعة الرسم';

  @override
  String get startDrawing => 'ابدأ الرسم';

  @override
  String get chooseBoardType => 'اختر نوع اللوحة';

  @override
  String get portrait => 'طولي';

  @override
  String get landscape => 'عرضي';

  @override
  String get square => 'مربع';

  @override
  String get backgroundBlank => 'أبيض';

  @override
  String get backgroundSpace => 'فضاء';

  @override
  String get backgroundUnderwater => 'تحت الماء';

  @override
  String get backgroundGarden => 'حديقة';

  @override
  String get backgroundSky => 'سماء';

  @override
  String get backgroundRoom => 'غرفة';

  @override
  String get backgroundGrid => 'شبكة';

  @override
  String get brush => 'فرشاة';

  @override
  String get color => 'لون';

  @override
  String get brushSize => 'حجم الفرشاة';

  @override
  String get eraser => 'ممحاة';

  @override
  String get undo => 'تراجع';

  @override
  String get redo => 'إعادة';

  @override
  String get clear => 'مسح';

  @override
  String get clearConfirmTitle => 'مسح اللوحة؟';

  @override
  String get clearConfirmBody =>
      'سيتم مسح كل الرسم. لا يمكن التراجع إلا عبر زر التراجع.';

  @override
  String get save => 'حفظ';

  @override
  String get saved => 'محفوظ';

  @override
  String get saving => 'جاري الحفظ';

  @override
  String get unsaved => 'غير محفوظ';

  @override
  String get saveAndExit => 'حفظ وخروج';

  @override
  String get discard => 'تجاهل';

  @override
  String get continueDrawingAction => 'متابعة الرسم';

  @override
  String get referenceShow => 'إظهار المثال';

  @override
  String get referenceHide => 'إخفاء المثال';

  @override
  String get referenceEnlarge => 'تكبير المثال';

  @override
  String get ghostMode => 'خلفية شفافة';

  @override
  String get ghostOpacity => 'شفافية الخلفية';

  @override
  String get compareDrawings => 'قارن الرسمتين';

  @override
  String stepOf(Object current, Object total) {
    return 'الخطوة $current من $total';
  }

  @override
  String get next => 'التالي';

  @override
  String get previous => 'السابق';

  @override
  String get tryToDraw => 'حاول ترسمها';

  @override
  String get awesomeWeSaved => 'رائع! حفظنا رسمتك.';

  @override
  String get chooseColor => 'اختر لونًا';

  @override
  String get colorThePicture => 'لوّن الصورة';

  @override
  String get connectTheDots => 'صل النقاط بالترتيب';

  @override
  String get drawAsYouLike => 'ارسم كما تحب';

  @override
  String get tapDoneWhenFinished => 'اضغط تم عندما تنتهي';

  @override
  String get startHere => 'ابدأ من هنا';

  @override
  String get traceLine => 'تتبّع الخط';

  @override
  String get wellDone => 'أحسنت';

  @override
  String get tryAgain => 'جرّب مرة أخرى';

  @override
  String get categoryAnimals => 'حيوانات';

  @override
  String get categorySpace => 'فضاء';

  @override
  String get categoryNature => 'طبيعة';

  @override
  String get categoryVehicles => 'مركبات';

  @override
  String get categoryHome => 'البيت';

  @override
  String get categoryPatterns => 'زخارف';

  @override
  String get difficultyEasy => 'سهل';

  @override
  String get difficultyMedium => 'متوسط';

  @override
  String get difficultyDetailed => 'مفصل';

  @override
  String get age45 => '4-5';

  @override
  String get age67 => '6-7';

  @override
  String get age89 => '8-9';

  @override
  String boardTitleDefault(Object number) {
    return 'لوحتي $number';
  }

  @override
  String get boardOrientationPortrait => 'طولي';

  @override
  String get boardOrientationLandscape => 'عرضي';

  @override
  String get boardOrientationSquare => 'مربع';

  @override
  String referenceBadge(Object title) {
    return 'من: $title';
  }
}
