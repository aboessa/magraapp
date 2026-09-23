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
  String get pinToggleShow => 'إظهار الرمز';

  @override
  String get pinToggleHide => 'إخفاء الرمز';

  @override
  String get pinGrantFailedRetry =>
      'تم التحقق من الرمز، لكن لم يتم حفظ الوصول. أعد المحاولة.';

  @override
  String get pinServerVerificationFooter =>
      'يُتحقَّق من الرمز على الخادم، ويُحفظ إثبات الوصول الموقّع في الذاكرة فقط لمدة قصيرة. يُمسح الإثبات عند إغلاق الجلسة أو انتقال التطبيق إلى الخلفية.';

  @override
  String get pinUnlockingWithBiometric => 'جارٍ التحقق ببصمتك…';

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

  @override
  String get childFormCreateTitle => 'ملف طفل جديد';

  @override
  String get childFormEditTitle => 'تعديل ملف الطفل';

  @override
  String get childFormCreateSubtitle => 'اختر شخصية من عالم مجرة';

  @override
  String get childFormEditSubtitle => 'عدّل بيانات الملف واهتماماته';

  @override
  String get childFormNicknameLabel => 'اسم الطفل';

  @override
  String get childFormNicknameHint => 'مثال: ليلى';

  @override
  String get childFormNicknameEmptyError => 'اكتب اسمًا للملف';

  @override
  String get childFormBirthMonthLabel => 'شهر الميلاد';

  @override
  String get childFormBirthYearLabel => 'سنة الميلاد';

  @override
  String get childFormBirthDateReadOnlyLabel => 'تاريخ الميلاد';

  @override
  String get childFormBirthDateEditNotice =>
      'يُعالَج تغيير تاريخ الميلاد لاحقًا عبر مسار الانتقال العمري، لا من هذه الشاشة';

  @override
  String get childFormAvatarSectionTitle => 'اختر شخصية من عالم مجرة';

  @override
  String childFormAvatarCount(int count) {
    return '$count شخصية';
  }

  @override
  String get childFormAvatarSectionSubtitle =>
      'نفس شخصيات الكارتون في المسلسلات';

  @override
  String get childFormInterestsTitle => 'الاهتمامات';

  @override
  String get childFormInterestsSubtitle =>
      'اختر ما يهم طفلك، يمكن اختيار أكثر من واحد';

  @override
  String get childFormLanguageReadOnlyNotice =>
      'لغة واحدة متاحة اليوم؛ ستتوسع القائمة عند اكتمال ترجمات أخرى';

  @override
  String get childFormSaveButtonCreate => 'إنشاء الملف';

  @override
  String get childFormSaveButtonEdit => 'حفظ التغييرات';

  @override
  String get childFormCreateErrorGeneric =>
      'تعذّر إنشاء الملف. تحقّق من الباقة (حد 4 أطفال)';

  @override
  String get childFormEditErrorGeneric => 'تعذّر حفظ التغييرات';

  @override
  String get interestAbjad => 'أبجد';

  @override
  String get interestArqam => 'الأرقام';

  @override
  String get interestOloom => 'العلوم';

  @override
  String get interestQiyam => 'القيم';

  @override
  String get interestQisas => 'القصص';

  @override
  String get interestMaharat => 'المهارات';

  @override
  String get interestTarikh => 'التاريخ';

  @override
  String get interestAlam => 'عالمنا';

  @override
  String get interestIman => 'الإيمان';

  @override
  String get ageTransitionReviewTitle => 'مراجعة الانتقال العمري';

  @override
  String get ageTransitionLoadErrorGeneric =>
      'تعذّر تحميل حالة الانتقال العمري';

  @override
  String get ageTransitionNoChangeTitle => 'لا يوجد تغيير حاليًا';

  @override
  String get ageTransitionNoChangeBody =>
      'مسار الطفل الحالي لا يزال مطابقًا لعمره المحسوب. لا حاجة لأي إجراء الآن.';

  @override
  String get ageTransitionCurrentTrackLabel => 'المسار الحالي';

  @override
  String get ageTransitionComputedTrackLabel => 'المسار المقترح';

  @override
  String ageTransitionChangeDescription(String from, String to) {
    return 'سيتم نقل الملف من مسار $from إلى مسار $to. سيتغيّر المحتوى المعروض تلقائيًا ليطابق مسار $to الجديد.';
  }

  @override
  String get ageTransitionAcceptButton => 'تأكيد الانتقال';

  @override
  String get ageTransitionDeferButton => 'تأجيل لاحقًا';

  @override
  String ageTransitionAcceptSuccessBody(String track) {
    return 'تم نقل الملف إلى مسار $track بنجاح.';
  }

  @override
  String ageTransitionDeferSuccessBody(String date) {
    return 'تم تأجيل الانتقال حتى $date.';
  }

  @override
  String ageTransitionDeferAlreadyActiveBody(String date) {
    return 'يوجد تأجيل نشط بالفعل حتى $date.';
  }

  @override
  String get ageTransitionErrorGeneric => 'تعذّر تنفيذ الإجراء. حاول مجددًا';

  @override
  String get ageTrackLabelPreschool => 'براعم';

  @override
  String get ageTrackLabelKids => 'مستكشفون';

  @override
  String get ageTrackLabelJunior => 'روّاد';

  @override
  String get ageTrackLabelUnknown => 'غير محدد';

  @override
  String get consentPageTitle => 'الموافقات';

  @override
  String get consentPageIntro =>
      'هذه الموافقات تحدد ما نجمعه ونحفظه عن استخدام طفلك. يمكنك تغيير أي منها في أي وقت.';

  @override
  String get consentTypeDataCollectionLabel => 'جمع بيانات الاستخدام الأساسية';

  @override
  String get consentTypeDataCollectionDescription =>
      'بيانات أساسية لتشغيل الحساب، مثل تسجيل الدخول والتقدم في المحتوى.';

  @override
  String get consentTypeAnalyticsLabel => 'تحليلات الاستخدام';

  @override
  String get consentTypeAnalyticsDescription =>
      'بيانات استخدام مجمَّعة تساعدنا على تحسين التجربة داخل التطبيق.';

  @override
  String get consentTypeVoiceLabel => 'تسجيلات الصوت';

  @override
  String get consentTypeVoiceDescription =>
      'لا توجد ميزة تعتمد على الصوت في التطبيق حاليًا؛ هذه الموافقة مُعدّة لأي ميزة صوتية مستقبلية.';

  @override
  String get consentTypePersonalizationLabel => 'تخصيص المحتوى المقترح';

  @override
  String get consentTypePersonalizationDescription =>
      'اقتراح محتوى بناءً على اهتمامات طفلك المسجَّلة في ملفه.';

  @override
  String get consentTypeChildCreationsLabel => 'حفظ رسومات الطفل في السحابة';

  @override
  String get consentTypeChildCreationsDescription =>
      'حفظ رسومات طفلك في مساحة خاصة بأسرتك على السحابة. لا تُنشر ولا تُشارك مع أي طرف آخر.';

  @override
  String get consentReasonNeverGranted => 'لم تُمنح هذه الموافقة بعد';

  @override
  String get consentReasonRevoked => 'تم سحب هذه الموافقة';

  @override
  String get consentReasonVersionSuperseded =>
      'تغيّرت سياسة هذه الموافقة، وتحتاج موافقة جديدة';

  @override
  String get consentStatusGranted => 'ممنوحة';

  @override
  String get consentLoadErrorGeneric => 'تعذّر تحميل حالة الموافقات';

  @override
  String get consentWriteErrorGeneric => 'تعذّر حفظ التغيير. حاول مجددًا';

  @override
  String get consentWriteRequiresParentPin =>
      'هذا التغيير سجلٌّ يخصّ وليّ الأمر، ولأسرتك رمز مُسجَّل فعلًا. أدخل الرمز ثم أعد المحاولة.';

  @override
  String get consentUnlockAction => 'أدخل رمز ولي الأمر';

  @override
  String get consentContinueButton => 'متابعة';

  @override
  String get onboardingBasicControlsStepTitle => 'الضوابط الأساسية';

  @override
  String get onboardingBasicControlsStepIntro =>
      'اضبط حدود الوقت والسماحات لملف طفلك، ويمكنك تعديلها لاحقًا من منطقة ولي الأمر.';

  @override
  String get onboardingContinueButton => 'متابعة';

  @override
  String get onboardingFinishTitle => 'كل شيء جاهز!';

  @override
  String get onboardingFinishBody =>
      'أنشأت ملف طفلك وضبطت الضوابط الأساسية. يمكنك البدء الآن، وتعديل أي إعداد لاحقًا من منطقة ولي الأمر.';

  @override
  String get onboardingFinishButton => 'ابدأ الآن';

  @override
  String get studioBannerDrawLikeMeLabel => 'ارسم مثلي';

  @override
  String get studioBannerConnectDotsLabel => 'صل النقاط';

  @override
  String get studioBannerColoringLabel => 'لوّن';

  @override
  String get studioBannerCreativeStudioLabel => 'الاستوديو الإبداعي';

  @override
  String get googlePlayUnavailableOnDevice =>
      'Google Play غير متاح على هذا الجهاز.';

  @override
  String get parentDailyLimitTitle => 'حدّ وقت الشاشة اليومي';

  @override
  String get parentDailyLimitOff => 'غير مفعَّل — لا حدّ على وقت الشاشة';

  @override
  String parentDailyLimitOn(int minutes) {
    return 'مفعَّل: $minutes دقيقة يوميًّا';
  }
}
