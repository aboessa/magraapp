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

  @override
  String get authinstallationidentityGet01 => 'متصفح ويب';

  @override
  String get authinstallationidentityGet02 => 'جهاز Android';

  @override
  String get authinstallationidentityGet03 => 'جهاز Apple محمول';

  @override
  String get authinstallationidentityGet04 => 'جهاز Windows';

  @override
  String get authinstallationidentityGet05 => 'جهاز macOS';

  @override
  String get authregisterpageDispose01 => 'أدخل اسم عرض للأسرة';

  @override
  String get authregisterpageDispose02 => 'أدخل البريد الإلكتروني';

  @override
  String get authregisterpageDispose03 => 'أدخل بريدًا إلكترونيًا صالحًا';

  @override
  String authregisterpageText01(Object value1) {
    return 'استخدم $value1 حرفًا على الأقل';
  }

  @override
  String get authregisterpageText02 => 'كلمتا المرور غير متطابقتين';

  @override
  String get detailsseriesdetailspageLoaded01 => 'حلقة واحدة';

  @override
  String detailsseriesdetailspageLoaded02(Object value1) {
    return '$value1 حلقة';
  }

  @override
  String get detailsseriesdetailspageLoaded03 => 'تم حفظ المسلسل';

  @override
  String get detailsseriesdetailspageLoaded04 =>
      'تمت إزالة المسلسل من المحفوظات';

  @override
  String get detailsseriesdetailspageGet01 =>
      'مش قادرين نحفظ ده دلوقتي. جرّب تاني';

  @override
  String get detailsseriesdetailspageText01 => 'حلو! هنقترح عليك حاجات شبهه';

  @override
  String get gamesblockcodeengineGet01 => 'تقدّم';

  @override
  String get gamesblockcodeengineGet02 => 'انعطف يسارًا';

  @override
  String get gamesblockcodeengineGet03 => 'انعطف يمينًا';

  @override
  String get gamesblockcodeengineGet04 => 'كرّر';

  @override
  String get gamesblockcodeengineGet05 => 'إذا كان الطريق مفتوحًا';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel01 => 'أسود';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel02 => 'أبيض';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel03 => 'كحلي داكن';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel04 => 'أحمر';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel05 => 'برتقالي محمر';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel06 => 'برتقالي';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel07 => 'ذهبي';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel08 => 'أصفر';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel09 => 'أصفر فاتح';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel10 => 'أخضر';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel11 => 'أخضر زاهٍ';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel12 => 'سماوي';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel13 => 'أزرق سماوي';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel14 => 'أزرق';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel15 => 'أزرق فاتح';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel16 => 'نيلي';

  @override
  String get gamesfreedrawsurfaceArabicPaletteColorLabel17 => 'بنفسجي فاتح';

  @override
  String get gamesfreedrawsurfaceText01 => 'بنفسجي';

  @override
  String get gamesfreedrawsurfaceText02 => 'أرجواني';

  @override
  String get gamesfreedrawsurfaceText03 => 'وردي';

  @override
  String get gamesfreedrawsurfaceText04 => 'وردي فاتح';

  @override
  String get gamesfreedrawsurfaceText05 => 'وردي محمر';

  @override
  String get gamesfreedrawsurfaceText06 => 'أحمر فاتح';

  @override
  String get gamesgameartText01 => 'قطة';

  @override
  String get gamesgameartText02 => 'عصفور';

  @override
  String get gamesgameartText03 => 'سمكة';

  @override
  String get gamesgameartText04 => 'سمكة حمراء';

  @override
  String get gamesgameartText05 => 'سمكة زرقاء';

  @override
  String get gamesgameartText06 => 'أرنب';

  @override
  String get gamesgameartText07 => 'أسد';

  @override
  String get gamesgameartText08 => 'بومة';

  @override
  String get gamesgameartText09 => 'سلحفاة';

  @override
  String get gamesgameartText10 => 'كلب';

  @override
  String get gamesgameartText11 => 'حصان';

  @override
  String get gamesgameartText12 => 'فيل';

  @override
  String get gamesgameartText13 => 'حوت';

  @override
  String get gamesgameartText14 => 'دجاجة';

  @override
  String get gamesgameartText15 => 'فراشة';

  @override
  String get gamesgameartText16 => 'تفاحة';

  @override
  String get gamesgameartText17 => 'صاروخ';

  @override
  String get gamesgameartText18 => 'شجرة';

  @override
  String get gamesgameartText19 => 'وردة';

  @override
  String get gamesgameartText20 => 'شمس';

  @override
  String get gamesgameartText21 => 'قمر';

  @override
  String get gamesgameartText22 => 'هلال ونجمة';

  @override
  String get gamesgameartText23 => 'نجمة';

  @override
  String get gamesgameartText24 => 'نجوم';

  @override
  String get gamesgameartText25 => 'بيت';

  @override
  String get gamesgameartText26 => 'سيارة';

  @override
  String get gamesgameartText27 => 'كرة';

  @override
  String get gamesgameartText28 => 'مركب';

  @override
  String get gamesgameartText29 => 'مركب قديم';

  @override
  String get gamesgameartText30 => 'هرم';

  @override
  String get gamesgameartText31 => 'مكتبة';

  @override
  String get gamesgameartText32 => 'كتاب';

  @override
  String get gamesgameartText33 => 'جبل';

  @override
  String get gamesgameartText34 => 'بحر';

  @override
  String get gamesgameartText35 => 'قوس قزح';

  @override
  String get gamesgameartText36 => 'قطار';

  @override
  String get gamesgameartText37 => 'طائرة';

  @override
  String get gamesgameartText38 => 'دراجة';

  @override
  String get gamesgameartText39 => 'حقيبة';

  @override
  String get gamesgameartText40 => 'مصباح';

  @override
  String get gamesgameartText41 => 'مسجد';

  @override
  String get gamesgameartText42 => 'فانوس';

  @override
  String get gamesgameartText43 => 'هلال';

  @override
  String get gamesgameartText44 => 'الهدف';

  @override
  String get gamesgameartText45 => 'كوب ملح';

  @override
  String get gamesgameartText46 => 'كوكب';

  @override
  String get gamesgameartText47 => 'أحمر';

  @override
  String get gamesgameartText48 => 'أزرق';

  @override
  String get gamesgameartText49 => 'أخضر';

  @override
  String get gamesgameartText50 => 'أصفر';

  @override
  String get gamesgameartText51 => 'دائرة';

  @override
  String get gamesgameartText52 => 'مربع';

  @override
  String get gamesgameartText53 => 'مثلث';

  @override
  String get gamesgameartText54 => 'بناء الأهرام';

  @override
  String get gamesgameartText55 => 'مكتبة الإسكندرية';

  @override
  String get gamesgameartText56 => 'تأسيس القاهرة';

  @override
  String get gamesgameartText57 => 'حفر قناة السويس';

  @override
  String get gamesgameartText58 => 'بناء السد العالي';

  @override
  String get gamesgameartFallback01 => 'عنصر مصوّر';

  @override
  String get gamesgameboardkitSeed01 => '٠';

  @override
  String get gamesgameboardkitSeed02 => '١';

  @override
  String get gamesgameboardkitSeed03 => '٢';

  @override
  String get gamesgameboardkitSeed04 => '٣';

  @override
  String gamessimlabengineGet01(Object value1) {
    return 'المتغيّر $value1';
  }

  @override
  String get gamessimlabengineUnitKey01 => 'وحدة';

  @override
  String get gamessimlabengineGet02 => 'النتيجة';

  @override
  String get gamessimlabengineGet03 => 'درجة';

  @override
  String get gamessimlabengineText01 => 'اتبع تعليمات السلامة مع شخص بالغ.';

  @override
  String get gamessimlabengineText02 => 'توقّع';

  @override
  String get gamessimlabengineText03 => 'جرّب';

  @override
  String get gamessimlabengineText04 => 'فسّر';

  @override
  String get gamestimelinemapengineHijriYearForGregorian01 => 'الأول';

  @override
  String get gamestimelinemapengineHijriYearForGregorian02 => 'الثاني';

  @override
  String get gamestimelinemapengineHijriYearForGregorian03 => 'الثالث';

  @override
  String get gamestimelinemapengineHijriYearForGregorian04 => 'الرابع';

  @override
  String get gamestimelinemapengineHijriYearForGregorian05 => 'الخامس';

  @override
  String get gamestimelinemapengineHijriYearForGregorian06 => 'السادس';

  @override
  String get gamestimelinemapengineHijriYearForGregorian07 => 'السابع';

  @override
  String get gamestimelinemapengineHijriYearForGregorian08 => 'الثامن';

  @override
  String get gamestimelinemapengineHijriYearForGregorian09 => 'التاسع';

  @override
  String get gamestimelinemapengineHijriYearForGregorian10 => 'العاشر';

  @override
  String get gamestimelinemapengineHijriYearForGregorian11 => 'الحادي عشر';

  @override
  String get gamestimelinemapengineHijriYearForGregorian12 => 'الثاني عشر';

  @override
  String get gamestimelinemapengineHijriYearForGregorian13 => 'الثالث عشر';

  @override
  String get gamestracecolorengineArabicFallback01 =>
      'ابدأ الرسم واتبع التعليمة.';

  @override
  String get gameswaveoneenginesTitle01 => 'هذا المستوى فارغ الآن';

  @override
  String get gameswaveoneenginesMessage01 =>
      'اختر لعبة أخرى وسنجهّز هذا المستوى قريبًا.';

  @override
  String gameswaveoneenginesText01(Object value1) {
    return 'الزوج رقم $value1';
  }

  @override
  String gameswaveoneenginesText02(Object value1) {
    return 'بطاقة متطابقة: $value1';
  }

  @override
  String gameswaveoneenginesText03(Object value1) {
    return 'بطاقة مكشوفة: $value1، جرّب بطاقة أخرى';
  }

  @override
  String gameswaveoneenginesText04(Object value1) {
    return 'بطاقة مكشوفة: $value1';
  }

  @override
  String get gameswaveoneenginesText05 => 'بطاقة مقلوبة';

  @override
  String get gameswaveoneenginesText06 => 'حاول مرة أخرى';

  @override
  String get gameswaveoneenginesBuild01 => 'بطاقة مصوّرة';

  @override
  String get gameswaveoneenginesRetryMessage01 => 'ليست هنا. جرّب هدفًا آخر.';

  @override
  String get gameswaveoneenginesTitle02 => 'هذا المستوى فارغ الآن';

  @override
  String get gameswaveoneenginesMessage02 =>
      'لا توجد عناصر للمطابقة هنا. جرّب مستوى آخر.';

  @override
  String get gameswaveoneenginesTitle03 => 'هذا المستوى فارغ الآن';

  @override
  String get gameswaveoneenginesMessage03 =>
      'لا توجد عناصر للفرز هنا. جرّب مستوى آخر.';

  @override
  String gameswaveoneenginesArabicFallback01(Object value1) {
    return 'السلة $value1';
  }

  @override
  String gameswaveoneenginesArabicFallback02(Object value1) {
    return 'القطعة $value1';
  }

  @override
  String gameswaveoneenginesArabicFallback03(Object value1) {
    return 'الخطوة $value1';
  }

  @override
  String get gameswaveoneenginesPanelCaptionForId01 => 'خطوة مصوّرة';

  @override
  String get gameswaveoneenginesTitle04 => 'هذا المستوى فارغ الآن';

  @override
  String get gameswaveoneenginesMessage04 =>
      'لا توجد خطوات للترتيب هنا. جرّب مستوى آخر.';

  @override
  String get gameswaveoneenginesText07 => 'رجوع';

  @override
  String gameswaveoneenginesText08(Object value1) {
    return 'الخطوة $value1';
  }

  @override
  String get gameswavetwoenginesTitle01 => 'هذا المستوى فارغ الآن';

  @override
  String get gameswavetwoenginesMessage01 =>
      'لا توجد عناصر للعد هنا. جرّب مستوى آخر.';

  @override
  String get gameswavetwoenginesText01 => 'أعد العدّ';

  @override
  String get gameswavetwoenginesArabicFallback01 => 'عنصر العدّ';

  @override
  String gameswavetwoenginesArabicFallback02(Object value1) {
    return 'الخيار $value1';
  }

  @override
  String get gameswavetwoenginesArabicFallback03 => 'عنصر العدّ';

  @override
  String gameswavetwoenginesText02(Object value1, Object value2) {
    return '$value1 رقم $value2';
  }

  @override
  String get gameswavetwoenginesLabel01 => 'عدد العناصر في الصندوق';

  @override
  String get gameswavetwoenginesText03 => 'أرجع واحدًا';

  @override
  String get gameswavetwoenginesText04 => 'انتهيت';

  @override
  String get gameswavetwoenginesText05 => 'المجموعة الأولى';

  @override
  String get gameswavetwoenginesText06 => 'المجموعة الثانية';

  @override
  String get gamescoloringhomev2Label01 => 'طيور';

  @override
  String get gamescoloringhomev2Label02 => 'حيوانات';

  @override
  String get gamescoloringhomev2Label03 => 'مركبات';

  @override
  String get gamescoloringhomev2Label04 => 'الفضاء';

  @override
  String get gamescoloringhomev2liveSub01 => 'طيور';

  @override
  String get gamescoloringhomev2liveSub02 => 'حيوانات';

  @override
  String get gamescoloringhomev2liveSub03 => 'مركبات';

  @override
  String get gamescoloringhomev2liveSub04 => 'الفضاء';

  @override
  String get gamesgamerouteTitle01 => 'اختر طفلًا أولًا';

  @override
  String get gamesgamerouteBody01 =>
      'الألعاب تُفتح لطفل واحد، حتى يُحفظ تقدّمه في المكان الصحيح.';

  @override
  String gamesgamescreenText01(Object value1) {
    return 'المستوى $value1 من ';
  }

  @override
  String get gamesgamescreenTooltip01 => 'وضع حركي مبسّط';

  @override
  String get gamesgamescreenText02 =>
      'الوضع الحركي المبسّط مفعّل: الطريق أوسع.';

  @override
  String get gamesgamescreenText03 => 'أكملت اللعبة';

  @override
  String get gamesgamescreenText04 => 'أكملت المستوى';

  @override
  String get gamesgamescreenText05 => 'أنهيت كل المستويات. عمل رائع!';

  @override
  String get homehomepageBuild01 => 'مفيش اتصال بالإنترنت';

  @override
  String get homehomepageBuild02 => 'تعذّر تجهيز الرحلة';

  @override
  String get homelibrarypageText01 => 'مكتبتي';

  @override
  String get homelibrarypageTooltip01 => 'بحث';

  @override
  String get homelibrarypageLabel01 => 'أكمل المشاهدة';

  @override
  String get homelibrarypageLabel02 => 'المحفوظات';

  @override
  String get homelibrarypageLabel03 => 'التحميلات';

  @override
  String get homelibrarypageLabel04 => 'رسوماتي';

  @override
  String get homelibrarypageText02 => 'تعذّر تحميل المكتبة';

  @override
  String get homelibrarypageText03 => 'إعادة المحاولة';

  @override
  String get homelibrarypageText04 => 'لا توجد حلقات قيد المتابعة';

  @override
  String get homeplaypageBuild01 => 'مفيش اتصال بالإنترنت. جرّب تاني بعد شوية.';

  @override
  String get homeplaypageText01 => 'العب';

  @override
  String get homecinematicheroLabel01 => 'قصص مجرة المختارة';

  @override
  String get homehomedestinationspecLabel01 => 'الرئيسية';

  @override
  String get homehomedestinationspecLabel02 => 'استكشف';

  @override
  String get homehomedestinationspecLabel03 => 'مكتبتي';

  @override
  String get homehomedestinationspecLabel04 => 'ملفي';

  @override
  String get homehomedestinationspecText01 => 'منطقة ولي الأمر';

  @override
  String get homehomedestinationspecText02 => 'منطقة ولي الأمر - تتطلب حسابًا';

  @override
  String get homehomedestinationspecText03 => 'منطقة ولي الأمر - PIN / بصمة';

  @override
  String get parentparentreportsGet01 => 'إثنين';

  @override
  String get parentparentreportsGet02 => 'ثلاثاء';

  @override
  String get parentparentreportsGet03 => 'أربعاء';

  @override
  String get parentparentreportsGet04 => 'خميس';

  @override
  String get parentparentreportsGet05 => 'جمعة';

  @override
  String get parentparentreportsGet06 => 'سبت';

  @override
  String get parentparentreportsGet07 => 'أحد';

  @override
  String get parentparentreportsMasteryLevelLabel01 => 'متقَن';

  @override
  String get parentparentreportsMasteryLevelLabel02 => 'بمساعدة';

  @override
  String get parentparentreportsMasteryLevelLabel03 => 'قيد التمرّن';

  @override
  String get parentparentreportsMasteryLevelLabel04 => 'مُقدَّم';

  @override
  String get parentparentreportsMasteryLevelLabel05 => 'محتاج مراجعة';

  @override
  String get parentparentreportsMasteryLevelLabel06 => 'لم يبدأ';

  @override
  String get parentparentreportsMasteryLevelLabel07 => 'قيد التمرّن';

  @override
  String get parentparentdashboardpageTooltip01 => 'رجوع';

  @override
  String get parentparentdashboardpageText01 => 'منطقة ولي الأمر';

  @override
  String get parentparentdashboardpageTooltip02 => 'الإعدادات';

  @override
  String get parentparentdashboardpageTitle01 => 'تعذّر تحميل ملفات الأطفال';

  @override
  String get parentparentdashboardpageBody01 =>
      'تحقق من الاتصال ثم حاول مرة أخرى.';

  @override
  String get parentparentdashboardpageText02 => 'الملف النشط';

  @override
  String get parentparentdashboardpageText03 => 'تبديل';

  @override
  String get parentparentdashboardpageText04 => 'لم يُختر ملف طفل بعد.';

  @override
  String get parentparentdashboardpageText05 => 'ملف طفل';

  @override
  String get parentparentdashboardpageText06 => 'نطاق المكتبة لهذا الملف';

  @override
  String get parentparentdashboardpageText07 => 'تعذّر تحميل المكتبة.';

  @override
  String get parentparentdashboardpageLabel01 => 'سلاسل متاحة';

  @override
  String get parentparentdashboardpageLabel02 => 'حلقات';

  @override
  String get parentparentdashboardpageLabel03 => 'أنشطة';

  @override
  String get parentparentdashboardpageText08 => 'تعذّر تحميل تقرير الأسبوع.';

  @override
  String get parentparentdashboardpageText09 => 'إعادة';

  @override
  String get parentparentdashboardpageTitle02 => 'تقرير الأسبوع';

  @override
  String get parentparentdashboardpageBody02 => 'مفيش نشاط في آخر 7 أيام.';

  @override
  String get parentnotificationscardNotificationsCard01 => 'حلقات جديدة';

  @override
  String get parentnotificationscardNotificationsCard02 =>
      'لما تنزل حلقة جديدة على مجرة';

  @override
  String get parentnotificationscardNotificationsCard03 => 'وقت الشاشة';

  @override
  String get parentnotificationscardNotificationsCard04 =>
      'لما يفضل 5 دقايق على وقت الطفل اليومي';

  @override
  String get parentnotificationscardNotificationsCard05 => 'تقرير الأسبوع';

  @override
  String get parentnotificationscardNotificationsCard06 =>
      'كل جمعة: اتفرجوا قد إيه واتعلموا إيه';

  @override
  String get parentnotificationscardText01 =>
      'الإشعارات اتفعّلت على الموبايل ده';

  @override
  String get parentnotificationscardText02 =>
      'الإشعارات مقفولة. فعّلها من إعدادات الموبايل لتطبيق مجرة';

  @override
  String get parentnotificationscardKind01 =>
      'مش قادرين نحفظ الإعداد دلوقتي. جرّب تاني';

  @override
  String get parentnotificationscardText03 => 'الإشعارات';

  @override
  String get parentnotificationscardText04 => 'فعّل الإشعارات على الموبايل ده';

  @override
  String get planetsplanetspageMessage01 => 'رجوع';

  @override
  String get planetsplanetspageText01 => 'كواكب مجرة';

  @override
  String get planetsplanetspageText02 => 'رحلة عبر عوالم المعرفة والترفيه';

  @override
  String get playbackplaybackpageLabel01 => 'العربية';

  @override
  String get playbackplaybackpageText01 => 'تلقائي';

  @override
  String get playbackplaybackpageMessage01 =>
      'انقطع الاتصال. تحقّق من الإنترنت وحاول مرة أخرى.';

  @override
  String get playbackplaybackpageMessage02 =>
      'الفيديو غير متاح حاليًا. حاول لاحقًا.';

  @override
  String get playbackplaybackpageMessage03 =>
      'انتهت الجلسة. سجّل الدخول مجددًا.';

  @override
  String get playbackplaybackpageMessage04 => 'هذا المحتوى يتطلب اشتراكًا.';

  @override
  String get profilelegaldocumentsText01 => 'سياسة الخصوصية';

  @override
  String get profilelegaldocumentsText02 => 'خصوصية الأطفال';

  @override
  String get profilelegaldocumentsText03 => 'شروط الاستخدام';

  @override
  String get profilelegaldocumentsText04 => 'حذف الحساب والبيانات';

  @override
  String get profilemanualpaymentGet01 => 'سنة';

  @override
  String get profilemanualpaymentGet02 => 'شهر';

  @override
  String get profiledevicespageGet01 => 'جهاز غير مسمّى';

  @override
  String get profilelegaldocumentpageBuild01 => 'الصفحات القانونية';

  @override
  String get profilelegaldocumentpageTooltip01 => 'رجوع';

  @override
  String get profilelegaldocumentpageText01 =>
      'تعذّر تحميل الصفحة. تأكد من الاتصال وحاول تاني.';

  @override
  String get profilelegaldocumentpageAction01 => 'إعادة المحاولة';

  @override
  String get profilelegaldocumentpageText02 =>
      'الصفحة دي لسه ماتنشرتش. تقدر تشوف ملخص البيانات ';

  @override
  String get profilelegaldocumentpageText03 =>
      'اللي التطبيق بيخزّنها وأدوات التحكم فيها.';

  @override
  String get profilelegaldocumentpageAction02 => 'ملخص الخصوصية والبيانات';

  @override
  String profilelegaldocumentpageBuild02(Object value1, Object value2) {
    return 'الإصدار $value1 · آخر تحديث $value2';
  }

  @override
  String get profilemembershippageInitState01 =>
      'تعذر إتمام عملية الشراء. أعد المحاولة.';

  @override
  String get profilemanualpaymentsectionText01 =>
      'وصلنا طلبك. هنراجع التحويل ونبعتلك إشعار أول ما الاشتراك يتفعّل.';

  @override
  String get profilemanualpaymentsectionText02 => 'الإيصال اترفع.';

  @override
  String get profilemanualpaymentsectionText03 => 'إلغاء الطلب؟';

  @override
  String get profilemanualpaymentsectionText04 =>
      'لو كنت حوّلت الفلوس فعلًا، سيب الطلب زي ما هو لحد ما نراجعه.';

  @override
  String get profilemanualpaymentsectionText05 => 'رجوع';

  @override
  String get profilemanualpaymentsectionText06 => 'إلغاء الطلب';

  @override
  String get profilemanualpaymentsectionText07 =>
      'جدّد اشتراكك بالمحفظة أو إنستاباي';

  @override
  String get profilemanualpaymentsectionText08 => 'ادفع بالمحفظة أو إنستاباي';

  @override
  String get profilemanualpaymentsectionText09 => 'آخر طلب اترفض';

  @override
  String get profilemanualpaymentsectionText10 => 'تقدر تبعت طلب جديد.';

  @override
  String get profilemanualpaymentsectionText11 =>
      'لو جدّدت قبل ما الاشتراك يخلص، المدة الجديدة بتتضاف بعد الحالية.';

  @override
  String get profilemanualpaymentsectionText12 => 'جدّد الاشتراك';

  @override
  String get profilemanualpaymentsectionText13 => 'اشترك دلوقتي';

  @override
  String profilemanualpaymentsectionBuild01(Object value1, Object value2) {
    return 'طلبك بـ $value1 جنيه ($value2) ';
  }

  @override
  String get profilemanualpaymentsectionBuild02 =>
      'تحت المراجعة. هنبعتلك إشعار أول ما يتفعّل.';

  @override
  String get profilemanualpaymentsectionBuild03 => 'إرفاق صورة الإيصال';

  @override
  String get profilemanualpaymentsectionText14 => 'إلغاء الطلب';

  @override
  String get profilemanualpaymentsectionText15 => '1. اختار الباقة';

  @override
  String profilemanualpaymentsectionText16(
    Object value1,
    Object value2,
    Object value3,
  ) {
    return '$value1 · $value2 ج.م / $value3';
  }

  @override
  String get profilemanualpaymentsectionText17 => '2. اختار وسيلة التحويل';

  @override
  String profilemanualpaymentsectionText18(Object value1, Object value2) {
    return 'حوّل $value1 جنيه على $value2:';
  }

  @override
  String get profilemanualpaymentsectionTooltip01 => 'نسخ الرقم';

  @override
  String get profilemanualpaymentsectionText19 => 'الرقم اتنسخ';

  @override
  String profilemanualpaymentsectionText20(Object value1) {
    return 'باسم: $value1';
  }

  @override
  String get profilemanualpaymentsectionText21 =>
      '3. بعد ما تحوّل، اكتب بيانات التحويل';

  @override
  String get profilemanualpaymentsectionText22 =>
      'رقمك أو عنوان إنستاباي اللي حوّلت منه';

  @override
  String get profilemanualpaymentsectionText23 => 'رقم المحفظة اللي حوّلت منها';

  @override
  String get profilemanualpaymentsectionLabelText01 => 'رقم العملية (اختياري)';

  @override
  String get profilemanualpaymentsectionText24 => 'صورة الإيصال (مطلوبة)';

  @override
  String get profilemanualpaymentsectionText25 => 'صورة الإيصال (اختياري)';

  @override
  String get profilemanualpaymentsectionText26 => 'اتختارت صورة الإيصال';

  @override
  String get profilemanualpaymentsectionText27 => 'ابعت للمراجعة';

  @override
  String profilemanualpaymentsectionText28(Object value1) {
    return 'الاشتراك بيتفعّل $value1 يوم بعد ما نتأكد من التحويل، وبيوصلك إشعار. ';
  }

  @override
  String get profilemanualpaymentsectionText29 => 'مفيش تجديد تلقائي.';

  @override
  String get profilemanualpaymentsectionText30 =>
      'عندك طلب تحت المراجعة بالفعل.';

  @override
  String get profilemanualpaymentsectionText31 =>
      'بعت طلبات كتير النهارده. جرّب بكرة أو كلّمنا.';

  @override
  String get profilemanualpaymentsectionText32 =>
      'افتح منطقة الأهل بالرقم السري الأول.';

  @override
  String get profilemanualpaymentsectionText33 =>
      'الصورة كبيرة أو نوعها مش مدعوم.';

  @override
  String get profilemanualpaymentsectionText34 =>
      'الدفع بالمحفظة مش متاح دلوقتي.';

  @override
  String get searchsearchpageTooltip01 => 'رجوع';

  @override
  String tvtvcommandhandlerText01(Object value1, Object value2) {
    return 'بيتفرج دلوقتي: $value1 · من $value2';
  }

  @override
  String tvtvcommandhandlerText02(Object value1) {
    return 'بيتفرج دلوقتي: $value1';
  }

  @override
  String get tvlinktvpageError01 => 'الكود ٨ حروف وأرقام، زي ABCD-EF23.';

  @override
  String get tvlinktvpageText01 =>
      'الكود غير صحيح أو انتهت صلاحيته. اطلب كودًا جديدًا من التلفزيون.';

  @override
  String get tvlinktvpageText02 => 'تعذّر التحقق من الكود. حاول مرة أخرى.';

  @override
  String get tvlinktvpageError02 => 'تعذّر الاتصال. تحقّق من الإنترنت.';

  @override
  String get tvlinktvpageText03 =>
      'انتهت صلاحية الكود. اطلب كودًا جديدًا من التلفزيون.';

  @override
  String get tvlinktvpageText04 => 'تمت الموافقة على هذا الكود بالفعل.';

  @override
  String get tvlinktvpageText05 =>
      'وصلت لحدّ التلفزيونات في باقتك. احذف تلفزيون قديم أو اخرج منه، وبعدين وافق تاني. الكود لسه شغّال.';

  @override
  String get tvlinktvpageText06 =>
      'انتهت صلاحية تأكيد ولي الأمر. أدخل PIN مرة أخرى.';

  @override
  String get tvlinktvpageText07 => 'تعذّرت الموافقة. حاول مرة أخرى.';

  @override
  String get tvlinktvpageError03 => 'تعذّر الاتصال. تحقّق من الإنترنت.';

  @override
  String get tvlinktvpageBuild01 => 'ربط تلفزيون';

  @override
  String get tvlinktvpageText08 => 'إدارة الأجهزة';

  @override
  String get tvlinktvpageText09 =>
      'افتح مجرّة على التلفزيون، واكتب الكود اللي ظاهر على الشاشة.';

  @override
  String get tvlinktvpageLabelText01 => 'كود التلفزيون';

  @override
  String get tvlinktvpageText10 => 'متابعة';

  @override
  String get tvlinktvpageText11 => 'تلفزيون';

  @override
  String tvlinktvpageText12(Object value1, Object value2) {
    return '$value1 · الكود $value2';
  }

  @override
  String get tvlinktvpageText13 =>
      'الجهاز ده عايز يدخل على حساب عيلتك. وافق بس لو التلفزيون قدامك دلوقتي وإنت اللي طلبت الكود.';

  @override
  String get tvlinktvpageText14 => 'موافقة بـ PIN ولي الأمر';

  @override
  String get tvlinktvpageText15 => 'ده مش جهازي';

  @override
  String get tvlinktvpageText16 =>
      'تم ربط التلفزيون. هيفتح لوحده خلال ثواني على شاشة اختيار الطفل.';

  @override
  String get tvlinktvpageText17 => 'تقدر تشيله في أي وقت من شاشة الأجهزة.';

  @override
  String get tvlinktvpageText18 => 'تمام';

  @override
  String get tvtvpairingpageText01 =>
      'محاولات كثيرة. انتظر دقيقة ثم اطلب كودًا جديدًا.';

  @override
  String get tvtvpairingpageText02 =>
      'تعذّر الحصول على كود. تحقّق من اتصال التلفزيون بالإنترنت.';

  @override
  String get tvtvpairingpageText03 => 'ادخل من موبايلك';

  @override
  String get tvtvpairingpageText04 => 'افتح تطبيق مجرّة على موبايل ولي الأمر.';

  @override
  String get tvtvpairingpageText05 =>
      'صوّر الكود بكاميرا الموبايل، أو ادخل: الأجهزة ← ربط تلفزيون.';

  @override
  String get tvtvpairingpageText06 =>
      'اكتب الكود الظاهر هنا، وأكّد برقم PIN ولي الأمر.';

  @override
  String get tvtvpairingpageText07 => 'الدخول بالبريد وكلمة المرور';

  @override
  String get tvtvpairingpageText08 => 'تمت الموافقة، جارٍ الدخول…';

  @override
  String get tvtvremotepageError01 => 'تعذّر الاتصال. حاول مرة أخرى.';

  @override
  String get tvtvremotepageBuild01 => 'التلفزيون';

  @override
  String get tvtvremotepageText01 => 'التلفزيون مش متصل';

  @override
  String get tvtvremotepageText02 => 'جارٍ التشغيل…';

  @override
  String get tvtvremotepageText03 => 'مستني';

  @override
  String get tvtvremotepageText04 => 'شغّال على التلفزيون';

  @override
  String get tvtvremotepageText05 => 'متوقف مؤقتًا';

  @override
  String get tvtvremotepageText06 => 'الحلقة خلصت';

  @override
  String get tvtvremotepageText07 => 'ما اشتغلتش';

  @override
  String get tvtvremotepageTooltip01 => 'رجوع ١٠ ثواني';

  @override
  String get tvtvremotepageText08 => 'إيقاف مؤقت';

  @override
  String get tvtvremotepageText09 => 'تشغيل';

  @override
  String get tvtvremotepageTooltip02 => 'قدّام ١٠ ثواني';

  @override
  String get tvtvremotepageText10 => 'إيقاف التشغيل على التلفزيون';

  @override
  String get tvtvcastsheetError01 =>
      'تعذّر الوصول للتلفزيونات. تحقّق من الإنترنت.';

  @override
  String get tvtvcastsheetError02 => 'اختار ملف الطفل الأول.';

  @override
  String get tvtvcastsheetError03 => 'تعذّر الاتصال. حاول مرة أخرى.';

  @override
  String get tvtvcastsheetBuild01 => 'شغّل على التلفزيون';

  @override
  String get tvtvcastsheetText01 =>
      'مفيش تلفزيون متصل دلوقتي. افتح مجرّة على التلفزيون وتأكد إنه داخل على نفس الحساب.';

  @override
  String get tvtvcastsheetText02 => 'تحديث';

  @override
  String get tvtvcastsheetText03 => 'تلفزيون';

  @override
  String tvtvcastsheetText04(Object value1) {
    return 'شغّال: $value1';
  }

  @override
  String get tvtvcastsheetText05 => 'شغّال دلوقتي';

  @override
  String get tvtvcastsheetText06 => 'متصل';

  @override
  String get tvtvcastsheetCastErrorMessage01 =>
      'التلفزيون مش متصل دلوقتي. افتح مجرّة عليه وحاول تاني.';

  @override
  String get tvtvcastsheetCastErrorMessage02 =>
      'التلفزيون ما ردّش. تأكد إنه شغّال ومتصل بالإنترنت.';

  @override
  String get tvtvcastsheetCastErrorMessage03 =>
      'ملف الطفل ده مش موجود على الحساب.';

  @override
  String get tvtvcastsheetCastErrorMessage04 =>
      'وقت الشاشة لليوم خلص للطفل ده.';

  @override
  String get tvtvcastsheetCastErrorMessage05 =>
      'دلوقتي وقت النوم حسب إعدادات ولي الأمر.';

  @override
  String get tvtvcastsheetCastErrorMessage06 =>
      'الطفل وصل لحد المشاهدة المتواصلة. استراحة شوية.';

  @override
  String get tvtvcastsheetText07 => 'وصلت لعدد الشاشات المسموح بيه في باقتك.';

  @override
  String get tvtvcastsheetText08 => 'الحلقة دي محتاجة اشتراك.';

  @override
  String get tvtvcastsheetText09 => 'مفيش حاجة شغالة على التلفزيون.';

  @override
  String get tvtvcastsheetText10 => 'التلفزيون ما قدرش يشغّل الحلقة.';

  @override
  String get tvtvreceiverhostLabel01 => 'تلفزيون';

  @override
  String mainText01(Object value1) {
    return 'حدث خطأ: $value1';
  }
}
