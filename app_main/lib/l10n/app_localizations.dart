import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';
import 'app_localizations_fr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
    Locale('fr'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In ar, this message translates to:
  /// **'مجرة'**
  String get appTitle;

  /// No description provided for @loginTitle.
  ///
  /// In ar, this message translates to:
  /// **'أهلاً بك في مجرة'**
  String get loginTitle;

  /// No description provided for @loginSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'مساحة آمنة للخيال ومجرة كاملة للتعلم'**
  String get loginSubtitle;

  /// No description provided for @emailLabel.
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get emailLabel;

  /// No description provided for @passwordLabel.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور'**
  String get passwordLabel;

  /// No description provided for @loginButton.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل دخول'**
  String get loginButton;

  /// No description provided for @enterEmailAndPassword.
  ///
  /// In ar, this message translates to:
  /// **'أدخل البريد وكلمة المرور'**
  String get enterEmailAndPassword;

  /// No description provided for @termsNotice.
  ///
  /// In ar, this message translates to:
  /// **'يمكنك مراجعة معلومات الخصوصية والبيانات قبل المتابعة'**
  String get termsNotice;

  /// No description provided for @registerButton.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء حساب'**
  String get registerButton;

  /// No description provided for @forgotPassword.
  ///
  /// In ar, this message translates to:
  /// **'نسيت كلمة المرور؟'**
  String get forgotPassword;

  /// No description provided for @noAccount.
  ///
  /// In ar, this message translates to:
  /// **'ليس لديك حساب؟'**
  String get noAccount;

  /// No description provided for @hasAccount.
  ///
  /// In ar, this message translates to:
  /// **'لديك حساب؟'**
  String get hasAccount;

  /// No description provided for @createFamilyAccount.
  ///
  /// In ar, this message translates to:
  /// **'أنشئ حساب العائلة'**
  String get createFamilyAccount;

  /// No description provided for @oneAccountPerFamily.
  ///
  /// In ar, this message translates to:
  /// **'حساب واحد لكل العائلة'**
  String get oneAccountPerFamily;

  /// No description provided for @parentNameLabel.
  ///
  /// In ar, this message translates to:
  /// **'اسم ولي الأمر'**
  String get parentNameLabel;

  /// Validation message. The count is enforced by the server in IdentityState.register, so it is passed in rather than written into the translation.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور {count} حرفًا على الأقل'**
  String passwordMinLength(int count);

  /// No description provided for @accountCreatedCheckEmail.
  ///
  /// In ar, this message translates to:
  /// **'تم إنشاء الحساب - تحقق من بريدك'**
  String get accountCreatedCheckEmail;

  /// No description provided for @back.
  ///
  /// In ar, this message translates to:
  /// **'رجوع'**
  String get back;

  /// No description provided for @parentArea.
  ///
  /// In ar, this message translates to:
  /// **'منطقة ولي الأمر'**
  String get parentArea;

  /// No description provided for @createParentPin.
  ///
  /// In ar, this message translates to:
  /// **'أنشئ رمز ولي الأمر'**
  String get createParentPin;

  /// No description provided for @enterParentPin.
  ///
  /// In ar, this message translates to:
  /// **'أدخل رمز ولي الأمر'**
  String get enterParentPin;

  /// No description provided for @savePin.
  ///
  /// In ar, this message translates to:
  /// **'حفظ الرمز'**
  String get savePin;

  /// No description provided for @enter.
  ///
  /// In ar, this message translates to:
  /// **'دخول'**
  String get enter;

  /// No description provided for @pinRangeHint.
  ///
  /// In ar, this message translates to:
  /// **'اختر رمزًا من {min} إلى {max} أرقام يعرفه ولي الأمر فقط'**
  String pinRangeHint(int min, int max);

  /// No description provided for @pinConfirmLabel.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد الرمز'**
  String get pinConfirmLabel;

  /// No description provided for @pinMismatch.
  ///
  /// In ar, this message translates to:
  /// **'الرمزان غير متطابقين'**
  String get pinMismatch;

  /// No description provided for @pinEmpty.
  ///
  /// In ar, this message translates to:
  /// **'أدخل الرمز'**
  String get pinEmpty;

  /// No description provided for @pinIncorrect.
  ///
  /// In ar, this message translates to:
  /// **'رمز غير صحيح'**
  String get pinIncorrect;

  /// No description provided for @pinIncorrectOneLeft.
  ///
  /// In ar, this message translates to:
  /// **'رمز غير صحيح. محاولة واحدة متبقية'**
  String get pinIncorrectOneLeft;

  /// No description provided for @pinIncorrectAttemptsLeft.
  ///
  /// In ar, this message translates to:
  /// **'رمز غير صحيح. {count} محاولات متبقية'**
  String pinIncorrectAttemptsLeft(int count);

  /// label is a pre-formatted duration such as '15 دقيقة'.
  ///
  /// In ar, this message translates to:
  /// **'محاولات كثيرة. حاول بعد {label}'**
  String pinLockedOut(String label);

  /// No description provided for @pinNotEnrolledYet.
  ///
  /// In ar, this message translates to:
  /// **'لم يُنشأ رمز بعد. أنشئ رمزًا الآن.'**
  String get pinNotEnrolledYet;

  /// No description provided for @pinSavedLocallyOnly.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ الرمز محليًا؛ تعذّر حفظه على الخادم: {reason}'**
  String pinSavedLocallyOnly(String reason);

  /// No description provided for @minutesLabel.
  ///
  /// In ar, this message translates to:
  /// **'{count} دقيقة'**
  String minutesLabel(int count);

  /// No description provided for @momentsLabel.
  ///
  /// In ar, this message translates to:
  /// **'لحظات'**
  String get momentsLabel;

  /// No description provided for @serverErrorGeneric.
  ///
  /// In ar, this message translates to:
  /// **'خطأ في الخادم'**
  String get serverErrorGeneric;

  /// No description provided for @serverUnreachable.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الاتصال بالخادم'**
  String get serverUnreachable;

  /// No description provided for @tooManyAttemptsShort.
  ///
  /// In ar, this message translates to:
  /// **'محاولات كثيرة — حاول لاحقًا'**
  String get tooManyAttemptsShort;

  /// No description provided for @sessionExpiredShort.
  ///
  /// In ar, this message translates to:
  /// **'انتهت الجلسة — سجّل الدخول مجددًا'**
  String get sessionExpiredShort;

  /// No description provided for @parentPinDisclosure.
  ///
  /// In ar, this message translates to:
  /// **'الرمز محفوظ مشفَّرًا على هذا الجهاز وتتم مزامنته مع الخادم عند تسجيل الدخول. التحقق على الخادم هو الحد الحقيقي؛ الحماية المحلية تمنع الطفل من فتح المنطقة دون اتصال.'**
  String get parentPinDisclosure;

  /// No description provided for @biometricUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'البصمة / Face ID — غير متاح بعد'**
  String get biometricUnavailable;

  /// No description provided for @pinToggleShow.
  ///
  /// In ar, this message translates to:
  /// **'إظهار الرمز'**
  String get pinToggleShow;

  /// No description provided for @pinToggleHide.
  ///
  /// In ar, this message translates to:
  /// **'إخفاء الرمز'**
  String get pinToggleHide;

  /// No description provided for @pinGrantFailedRetry.
  ///
  /// In ar, this message translates to:
  /// **'تم التحقق من الرمز، لكن لم يتم حفظ الوصول. أعد المحاولة.'**
  String get pinGrantFailedRetry;

  /// No description provided for @pinServerVerificationFooter.
  ///
  /// In ar, this message translates to:
  /// **'يُتحقَّق من الرمز على الخادم، ويُحفظ إثبات الوصول الموقّع في الذاكرة فقط لمدة قصيرة. يُمسح الإثبات عند إغلاق الجلسة أو انتقال التطبيق إلى الخلفية.'**
  String get pinServerVerificationFooter;

  /// No description provided for @pinUnlockingWithBiometric.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ التحقق ببصمتك…'**
  String get pinUnlockingWithBiometric;

  /// No description provided for @home.
  ///
  /// In ar, this message translates to:
  /// **'الرئيسية'**
  String get home;

  /// No description provided for @search.
  ///
  /// In ar, this message translates to:
  /// **'بحث'**
  String get search;

  /// No description provided for @profile.
  ///
  /// In ar, this message translates to:
  /// **'ملفي'**
  String get profile;

  /// No description provided for @settings.
  ///
  /// In ar, this message translates to:
  /// **'الإعدادات'**
  String get settings;

  /// No description provided for @settingsSectionPlayback.
  ///
  /// In ar, this message translates to:
  /// **'التشغيل'**
  String get settingsSectionPlayback;

  /// No description provided for @settingsSectionDownload.
  ///
  /// In ar, this message translates to:
  /// **'التنزيل'**
  String get settingsSectionDownload;

  /// No description provided for @settingsSectionNotifications.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات'**
  String get settingsSectionNotifications;

  /// No description provided for @settingsSectionGeneral.
  ///
  /// In ar, this message translates to:
  /// **'عام'**
  String get settingsSectionGeneral;

  /// No description provided for @settingsSectionAccount.
  ///
  /// In ar, this message translates to:
  /// **'الحساب'**
  String get settingsSectionAccount;

  /// No description provided for @autoplayNextTitle.
  ///
  /// In ar, this message translates to:
  /// **'تشغيل تلقائي للحلقة التالية'**
  String get autoplayNextTitle;

  /// No description provided for @autoplayNextSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'ينتقل المشغّل إلى الحلقة التالية عند الانتهاء'**
  String get autoplayNextSubtitle;

  /// No description provided for @videoQualityTitle.
  ///
  /// In ar, this message translates to:
  /// **'جودة الفيديو'**
  String get videoQualityTitle;

  /// No description provided for @wifiOnlyTitle.
  ///
  /// In ar, this message translates to:
  /// **'التحميل عبر Wi-Fi فقط'**
  String get wifiOnlyTitle;

  /// No description provided for @wifiOnlySubtitle.
  ///
  /// In ar, this message translates to:
  /// **'توفير بيانات الهاتف'**
  String get wifiOnlySubtitle;

  /// No description provided for @contentNotificationsTitle.
  ///
  /// In ar, this message translates to:
  /// **'إشعارات المحتوى الجديد'**
  String get contentNotificationsTitle;

  /// No description provided for @contentNotificationsSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'حلقات وأعمال جديدة'**
  String get contentNotificationsSubtitle;

  /// No description provided for @languageLabel.
  ///
  /// In ar, this message translates to:
  /// **'اللغة'**
  String get languageLabel;

  /// No description provided for @languageValueArabic.
  ///
  /// In ar, this message translates to:
  /// **'العربية'**
  String get languageValueArabic;

  /// No description provided for @appearanceLabel.
  ///
  /// In ar, this message translates to:
  /// **'المظهر'**
  String get appearanceLabel;

  /// No description provided for @appearanceValueDark.
  ///
  /// In ar, this message translates to:
  /// **'داكن سينمائي'**
  String get appearanceValueDark;

  /// No description provided for @settingsDeviceOnlyNotice.
  ///
  /// In ar, this message translates to:
  /// **'تُحفظ هذه الإعدادات على هذا الجهاز فقط، ولا تُزامن بين أجهزة الأسرة بعد.'**
  String get settingsDeviceOnlyNotice;

  /// No description provided for @accountDataTitle.
  ///
  /// In ar, this message translates to:
  /// **'بيانات الحساب'**
  String get accountDataTitle;

  /// No description provided for @accountNotLinkedYet.
  ///
  /// In ar, this message translates to:
  /// **'لم تُربط بيانات الحساب بعد'**
  String get accountNotLinkedYet;

  /// No description provided for @nameLabel.
  ///
  /// In ar, this message translates to:
  /// **'الاسم'**
  String get nameLabel;

  /// No description provided for @phoneLabel.
  ///
  /// In ar, this message translates to:
  /// **'رقم الهاتف'**
  String get phoneLabel;

  /// No description provided for @addAction.
  ///
  /// In ar, this message translates to:
  /// **'إضافة'**
  String get addAction;

  /// No description provided for @changeAction.
  ///
  /// In ar, this message translates to:
  /// **'تغيير'**
  String get changeAction;

  /// No description provided for @accountEditUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'تعديل البيانات غير متاح بعد'**
  String get accountEditUnavailable;

  /// No description provided for @downloadsTitle.
  ///
  /// In ar, this message translates to:
  /// **'التحميلات'**
  String get downloadsTitle;

  /// No description provided for @storageUsedTitle.
  ///
  /// In ar, this message translates to:
  /// **'التخزين المستخدم'**
  String get storageUsedTitle;

  /// No description provided for @storageComputedWhenEnabled.
  ///
  /// In ar, this message translates to:
  /// **'حجم التخزين يُحسب عند تفعيل التنزيل'**
  String get storageComputedWhenEnabled;

  /// No description provided for @noDownloadsTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد تحميلات'**
  String get noDownloadsTitle;

  /// No description provided for @noDownloadsBody.
  ///
  /// In ar, this message translates to:
  /// **'حمّل من زر التحميل في صفحة التفاصيل'**
  String get noDownloadsBody;

  /// No description provided for @doneShort.
  ///
  /// In ar, this message translates to:
  /// **'تم'**
  String get doneShort;

  /// No description provided for @supportTitle.
  ///
  /// In ar, this message translates to:
  /// **'الدعم الفني'**
  String get supportTitle;

  /// No description provided for @supportHeadline.
  ///
  /// In ar, this message translates to:
  /// **'كيف نساعدك؟'**
  String get supportHeadline;

  /// No description provided for @supportResponseTime.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مدة استجابة منشورة حاليًا'**
  String get supportResponseTime;

  /// No description provided for @supportChannelPending.
  ///
  /// In ar, this message translates to:
  /// **'قناة التواصل قيد الإعداد'**
  String get supportChannelPending;

  /// No description provided for @supportFaqTitle.
  ///
  /// In ar, this message translates to:
  /// **'الأسئلة الشائعة'**
  String get supportFaqTitle;

  /// No description provided for @supportFaqSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'لم تُنشر بعد'**
  String get supportFaqSubtitle;

  /// No description provided for @supportReportTitle.
  ///
  /// In ar, this message translates to:
  /// **'الإبلاغ عن مشكلة'**
  String get supportReportTitle;

  /// No description provided for @supportSuggestTitle.
  ///
  /// In ar, this message translates to:
  /// **'اقتراح ميزة'**
  String get supportSuggestTitle;

  /// No description provided for @supportCallTitle.
  ///
  /// In ar, this message translates to:
  /// **'اتصل بنا'**
  String get supportCallTitle;

  /// No description provided for @supportCallSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'رقم الدعم يُعلن قريباً'**
  String get supportCallSubtitle;

  /// No description provided for @notAvailableYet.
  ///
  /// In ar, this message translates to:
  /// **'غير متاح بعد'**
  String get notAvailableYet;

  /// No description provided for @licensesTitle.
  ///
  /// In ar, this message translates to:
  /// **'تراخيص البرمجيات'**
  String get licensesTitle;

  /// No description provided for @licensesSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'الخطوط والحزم المستخدمة'**
  String get licensesSubtitle;

  /// No description provided for @logoutTitle.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج'**
  String get logoutTitle;

  /// No description provided for @logoutConfirmBody.
  ///
  /// In ar, this message translates to:
  /// **'سيُطلب البريد وكلمة المرور في المرة القادمة، وسيُحذف رمز ولي الأمر من هذا الجهاز.'**
  String get logoutConfirmBody;

  /// No description provided for @cancel.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء'**
  String get cancel;

  /// No description provided for @retry.
  ///
  /// In ar, this message translates to:
  /// **'إعادة المحاولة'**
  String get retry;

  /// No description provided for @offlineTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد اتصال'**
  String get offlineTitle;

  /// No description provided for @offlineMessage.
  ///
  /// In ar, this message translates to:
  /// **'تحقق من الإنترنت وحاول مجددًا'**
  String get offlineMessage;

  /// No description provided for @contentUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'المحتوى غير متاح حاليًا'**
  String get contentUnavailable;

  /// No description provided for @authExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت الجلسة. سجّل الدخول مجددًا'**
  String get authExpired;

  /// No description provided for @biometricReason.
  ///
  /// In ar, this message translates to:
  /// **'أكّد هويتك لفتح منطقة ولي الأمر'**
  String get biometricReason;

  /// No description provided for @biometricEnableTitle.
  ///
  /// In ar, this message translates to:
  /// **'تفعيل الدخول بالبصمة'**
  String get biometricEnableTitle;

  /// No description provided for @biometricEnablePrompt.
  ///
  /// In ar, this message translates to:
  /// **'هل تريد استخدام البصمة أو Face ID لفتح منطقة ولي الأمر على هذا الجهاز بدل إدخال الرمز في كل مرة؟'**
  String get biometricEnablePrompt;

  /// No description provided for @notNow.
  ///
  /// In ar, this message translates to:
  /// **'ليس الآن'**
  String get notNow;

  /// No description provided for @enable.
  ///
  /// In ar, this message translates to:
  /// **'تفعيل'**
  String get enable;

  /// No description provided for @creativeStudioTitle.
  ///
  /// In ar, this message translates to:
  /// **'استوديو الإبداع'**
  String get creativeStudioTitle;

  /// No description provided for @myBoards.
  ///
  /// In ar, this message translates to:
  /// **'لوحاتي'**
  String get myBoards;

  /// No description provided for @drawLikeThis.
  ///
  /// In ar, this message translates to:
  /// **'ارسم مثلي'**
  String get drawLikeThis;

  /// No description provided for @coloring.
  ///
  /// In ar, this message translates to:
  /// **'التلوين'**
  String get coloring;

  /// No description provided for @tracing.
  ///
  /// In ar, this message translates to:
  /// **'التتبع'**
  String get tracing;

  /// No description provided for @connectDots.
  ///
  /// In ar, this message translates to:
  /// **'صل النقاط'**
  String get connectDots;

  /// No description provided for @completeDrawing.
  ///
  /// In ar, this message translates to:
  /// **'أكمل الرسمة'**
  String get completeDrawing;

  /// No description provided for @copyPattern.
  ///
  /// In ar, this message translates to:
  /// **'انسخ النمط'**
  String get copyPattern;

  /// No description provided for @drawFromPrompt.
  ///
  /// In ar, this message translates to:
  /// **'ارسم من الفكرة'**
  String get drawFromPrompt;

  /// No description provided for @newBoard.
  ///
  /// In ar, this message translates to:
  /// **'لوحة جديدة'**
  String get newBoard;

  /// No description provided for @newBlankBoard.
  ///
  /// In ar, this message translates to:
  /// **'لوحة بيضاء فارغة'**
  String get newBlankBoard;

  /// No description provided for @continueDrawing.
  ///
  /// In ar, this message translates to:
  /// **'متابعة الرسم'**
  String get continueDrawing;

  /// No description provided for @startDrawing.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ الرسم'**
  String get startDrawing;

  /// No description provided for @chooseBoardType.
  ///
  /// In ar, this message translates to:
  /// **'اختر نوع اللوحة'**
  String get chooseBoardType;

  /// No description provided for @portrait.
  ///
  /// In ar, this message translates to:
  /// **'طولي'**
  String get portrait;

  /// No description provided for @landscape.
  ///
  /// In ar, this message translates to:
  /// **'عرضي'**
  String get landscape;

  /// No description provided for @square.
  ///
  /// In ar, this message translates to:
  /// **'مربع'**
  String get square;

  /// No description provided for @backgroundBlank.
  ///
  /// In ar, this message translates to:
  /// **'أبيض'**
  String get backgroundBlank;

  /// No description provided for @backgroundSpace.
  ///
  /// In ar, this message translates to:
  /// **'فضاء'**
  String get backgroundSpace;

  /// No description provided for @backgroundUnderwater.
  ///
  /// In ar, this message translates to:
  /// **'تحت الماء'**
  String get backgroundUnderwater;

  /// No description provided for @backgroundGarden.
  ///
  /// In ar, this message translates to:
  /// **'حديقة'**
  String get backgroundGarden;

  /// No description provided for @backgroundSky.
  ///
  /// In ar, this message translates to:
  /// **'سماء'**
  String get backgroundSky;

  /// No description provided for @backgroundRoom.
  ///
  /// In ar, this message translates to:
  /// **'غرفة'**
  String get backgroundRoom;

  /// No description provided for @backgroundGrid.
  ///
  /// In ar, this message translates to:
  /// **'شبكة'**
  String get backgroundGrid;

  /// No description provided for @brush.
  ///
  /// In ar, this message translates to:
  /// **'فرشاة'**
  String get brush;

  /// No description provided for @color.
  ///
  /// In ar, this message translates to:
  /// **'لون'**
  String get color;

  /// No description provided for @brushSize.
  ///
  /// In ar, this message translates to:
  /// **'حجم الفرشاة'**
  String get brushSize;

  /// No description provided for @eraser.
  ///
  /// In ar, this message translates to:
  /// **'ممحاة'**
  String get eraser;

  /// No description provided for @undo.
  ///
  /// In ar, this message translates to:
  /// **'تراجع'**
  String get undo;

  /// No description provided for @redo.
  ///
  /// In ar, this message translates to:
  /// **'إعادة'**
  String get redo;

  /// No description provided for @clear.
  ///
  /// In ar, this message translates to:
  /// **'مسح'**
  String get clear;

  /// No description provided for @clearConfirmTitle.
  ///
  /// In ar, this message translates to:
  /// **'مسح اللوحة؟'**
  String get clearConfirmTitle;

  /// No description provided for @clearConfirmBody.
  ///
  /// In ar, this message translates to:
  /// **'سيتم مسح كل الرسم. لا يمكن التراجع إلا عبر زر التراجع.'**
  String get clearConfirmBody;

  /// No description provided for @save.
  ///
  /// In ar, this message translates to:
  /// **'حفظ'**
  String get save;

  /// No description provided for @saved.
  ///
  /// In ar, this message translates to:
  /// **'محفوظ'**
  String get saved;

  /// No description provided for @saving.
  ///
  /// In ar, this message translates to:
  /// **'جاري الحفظ'**
  String get saving;

  /// No description provided for @unsaved.
  ///
  /// In ar, this message translates to:
  /// **'غير محفوظ'**
  String get unsaved;

  /// No description provided for @saveAndExit.
  ///
  /// In ar, this message translates to:
  /// **'حفظ وخروج'**
  String get saveAndExit;

  /// No description provided for @discard.
  ///
  /// In ar, this message translates to:
  /// **'تجاهل'**
  String get discard;

  /// No description provided for @continueDrawingAction.
  ///
  /// In ar, this message translates to:
  /// **'متابعة الرسم'**
  String get continueDrawingAction;

  /// No description provided for @referenceShow.
  ///
  /// In ar, this message translates to:
  /// **'إظهار المثال'**
  String get referenceShow;

  /// No description provided for @referenceHide.
  ///
  /// In ar, this message translates to:
  /// **'إخفاء المثال'**
  String get referenceHide;

  /// No description provided for @referenceEnlarge.
  ///
  /// In ar, this message translates to:
  /// **'تكبير المثال'**
  String get referenceEnlarge;

  /// No description provided for @ghostMode.
  ///
  /// In ar, this message translates to:
  /// **'خلفية شفافة'**
  String get ghostMode;

  /// No description provided for @ghostOpacity.
  ///
  /// In ar, this message translates to:
  /// **'شفافية الخلفية'**
  String get ghostOpacity;

  /// No description provided for @compareDrawings.
  ///
  /// In ar, this message translates to:
  /// **'قارن الرسمتين'**
  String get compareDrawings;

  /// No description provided for @stepOf.
  ///
  /// In ar, this message translates to:
  /// **'الخطوة {current} من {total}'**
  String stepOf(Object current, Object total);

  /// No description provided for @next.
  ///
  /// In ar, this message translates to:
  /// **'التالي'**
  String get next;

  /// No description provided for @previous.
  ///
  /// In ar, this message translates to:
  /// **'السابق'**
  String get previous;

  /// No description provided for @tryToDraw.
  ///
  /// In ar, this message translates to:
  /// **'حاول ترسمها'**
  String get tryToDraw;

  /// No description provided for @awesomeWeSaved.
  ///
  /// In ar, this message translates to:
  /// **'رائع! حفظنا رسمتك.'**
  String get awesomeWeSaved;

  /// No description provided for @chooseColor.
  ///
  /// In ar, this message translates to:
  /// **'اختر لونًا'**
  String get chooseColor;

  /// No description provided for @colorThePicture.
  ///
  /// In ar, this message translates to:
  /// **'لوّن الصورة'**
  String get colorThePicture;

  /// No description provided for @connectTheDots.
  ///
  /// In ar, this message translates to:
  /// **'صل النقاط بالترتيب'**
  String get connectTheDots;

  /// No description provided for @drawAsYouLike.
  ///
  /// In ar, this message translates to:
  /// **'ارسم كما تحب'**
  String get drawAsYouLike;

  /// No description provided for @tapDoneWhenFinished.
  ///
  /// In ar, this message translates to:
  /// **'اضغط تم عندما تنتهي'**
  String get tapDoneWhenFinished;

  /// No description provided for @startHere.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ من هنا'**
  String get startHere;

  /// No description provided for @traceLine.
  ///
  /// In ar, this message translates to:
  /// **'تتبّع الخط'**
  String get traceLine;

  /// No description provided for @wellDone.
  ///
  /// In ar, this message translates to:
  /// **'أحسنت'**
  String get wellDone;

  /// No description provided for @tryAgain.
  ///
  /// In ar, this message translates to:
  /// **'جرّب مرة أخرى'**
  String get tryAgain;

  /// No description provided for @categoryAnimals.
  ///
  /// In ar, this message translates to:
  /// **'حيوانات'**
  String get categoryAnimals;

  /// No description provided for @categorySpace.
  ///
  /// In ar, this message translates to:
  /// **'فضاء'**
  String get categorySpace;

  /// No description provided for @categoryNature.
  ///
  /// In ar, this message translates to:
  /// **'طبيعة'**
  String get categoryNature;

  /// No description provided for @categoryVehicles.
  ///
  /// In ar, this message translates to:
  /// **'مركبات'**
  String get categoryVehicles;

  /// No description provided for @categoryHome.
  ///
  /// In ar, this message translates to:
  /// **'البيت'**
  String get categoryHome;

  /// No description provided for @categoryPatterns.
  ///
  /// In ar, this message translates to:
  /// **'زخارف'**
  String get categoryPatterns;

  /// No description provided for @difficultyEasy.
  ///
  /// In ar, this message translates to:
  /// **'سهل'**
  String get difficultyEasy;

  /// No description provided for @difficultyMedium.
  ///
  /// In ar, this message translates to:
  /// **'متوسط'**
  String get difficultyMedium;

  /// No description provided for @difficultyDetailed.
  ///
  /// In ar, this message translates to:
  /// **'مفصل'**
  String get difficultyDetailed;

  /// No description provided for @age45.
  ///
  /// In ar, this message translates to:
  /// **'4-5'**
  String get age45;

  /// No description provided for @age67.
  ///
  /// In ar, this message translates to:
  /// **'6-7'**
  String get age67;

  /// No description provided for @age89.
  ///
  /// In ar, this message translates to:
  /// **'8-9'**
  String get age89;

  /// No description provided for @boardTitleDefault.
  ///
  /// In ar, this message translates to:
  /// **'لوحتي {number}'**
  String boardTitleDefault(Object number);

  /// No description provided for @boardOrientationPortrait.
  ///
  /// In ar, this message translates to:
  /// **'طولي'**
  String get boardOrientationPortrait;

  /// No description provided for @boardOrientationLandscape.
  ///
  /// In ar, this message translates to:
  /// **'عرضي'**
  String get boardOrientationLandscape;

  /// No description provided for @boardOrientationSquare.
  ///
  /// In ar, this message translates to:
  /// **'مربع'**
  String get boardOrientationSquare;

  /// No description provided for @referenceBadge.
  ///
  /// In ar, this message translates to:
  /// **'من: {title}'**
  String referenceBadge(Object title);

  /// No description provided for @childFormCreateTitle.
  ///
  /// In ar, this message translates to:
  /// **'ملف طفل جديد'**
  String get childFormCreateTitle;

  /// No description provided for @childFormEditTitle.
  ///
  /// In ar, this message translates to:
  /// **'تعديل ملف الطفل'**
  String get childFormEditTitle;

  /// No description provided for @childFormCreateSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'اختر شخصية من عالم مجرة'**
  String get childFormCreateSubtitle;

  /// No description provided for @childFormEditSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'عدّل بيانات الملف واهتماماته'**
  String get childFormEditSubtitle;

  /// No description provided for @childFormNicknameLabel.
  ///
  /// In ar, this message translates to:
  /// **'اسم الطفل'**
  String get childFormNicknameLabel;

  /// No description provided for @childFormNicknameHint.
  ///
  /// In ar, this message translates to:
  /// **'مثال: ليلى'**
  String get childFormNicknameHint;

  /// No description provided for @childFormNicknameEmptyError.
  ///
  /// In ar, this message translates to:
  /// **'اكتب اسمًا للملف'**
  String get childFormNicknameEmptyError;

  /// No description provided for @childFormBirthMonthLabel.
  ///
  /// In ar, this message translates to:
  /// **'شهر الميلاد'**
  String get childFormBirthMonthLabel;

  /// No description provided for @childFormBirthYearLabel.
  ///
  /// In ar, this message translates to:
  /// **'سنة الميلاد'**
  String get childFormBirthYearLabel;

  /// No description provided for @childFormBirthDateReadOnlyLabel.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ الميلاد'**
  String get childFormBirthDateReadOnlyLabel;

  /// No description provided for @childFormBirthDateEditNotice.
  ///
  /// In ar, this message translates to:
  /// **'يُعالَج تغيير تاريخ الميلاد لاحقًا عبر مسار الانتقال العمري، لا من هذه الشاشة'**
  String get childFormBirthDateEditNotice;

  /// No description provided for @childFormAvatarSectionTitle.
  ///
  /// In ar, this message translates to:
  /// **'اختر شخصية من عالم مجرة'**
  String get childFormAvatarSectionTitle;

  /// Count of selectable avatar characters shown next to the picker's section title.
  ///
  /// In ar, this message translates to:
  /// **'{count} شخصية'**
  String childFormAvatarCount(int count);

  /// No description provided for @childFormAvatarSectionSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'نفس شخصيات الكارتون في المسلسلات'**
  String get childFormAvatarSectionSubtitle;

  /// No description provided for @childFormInterestsTitle.
  ///
  /// In ar, this message translates to:
  /// **'الاهتمامات'**
  String get childFormInterestsTitle;

  /// No description provided for @childFormInterestsSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'اختر ما يهم طفلك، يمكن اختيار أكثر من واحد'**
  String get childFormInterestsSubtitle;

  /// No description provided for @childFormLanguageReadOnlyNotice.
  ///
  /// In ar, this message translates to:
  /// **'لغة واحدة متاحة اليوم؛ ستتوسع القائمة عند اكتمال ترجمات أخرى'**
  String get childFormLanguageReadOnlyNotice;

  /// No description provided for @childFormSaveButtonCreate.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء الملف'**
  String get childFormSaveButtonCreate;

  /// No description provided for @childFormSaveButtonEdit.
  ///
  /// In ar, this message translates to:
  /// **'حفظ التغييرات'**
  String get childFormSaveButtonEdit;

  /// No description provided for @childFormCreateErrorGeneric.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر إنشاء الملف. تحقّق من الباقة (حد 4 أطفال)'**
  String get childFormCreateErrorGeneric;

  /// No description provided for @childFormEditErrorGeneric.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر حفظ التغييرات'**
  String get childFormEditErrorGeneric;

  /// No description provided for @interestAbjad.
  ///
  /// In ar, this message translates to:
  /// **'أبجد'**
  String get interestAbjad;

  /// No description provided for @interestArqam.
  ///
  /// In ar, this message translates to:
  /// **'الأرقام'**
  String get interestArqam;

  /// No description provided for @interestOloom.
  ///
  /// In ar, this message translates to:
  /// **'العلوم'**
  String get interestOloom;

  /// No description provided for @interestQiyam.
  ///
  /// In ar, this message translates to:
  /// **'القيم'**
  String get interestQiyam;

  /// No description provided for @interestQisas.
  ///
  /// In ar, this message translates to:
  /// **'القصص'**
  String get interestQisas;

  /// No description provided for @interestMaharat.
  ///
  /// In ar, this message translates to:
  /// **'المهارات'**
  String get interestMaharat;

  /// No description provided for @interestTarikh.
  ///
  /// In ar, this message translates to:
  /// **'التاريخ'**
  String get interestTarikh;

  /// No description provided for @interestAlam.
  ///
  /// In ar, this message translates to:
  /// **'عالمنا'**
  String get interestAlam;

  /// No description provided for @interestIman.
  ///
  /// In ar, this message translates to:
  /// **'الإيمان'**
  String get interestIman;

  /// No description provided for @ageTransitionReviewTitle.
  ///
  /// In ar, this message translates to:
  /// **'مراجعة الانتقال العمري'**
  String get ageTransitionReviewTitle;

  /// No description provided for @ageTransitionLoadErrorGeneric.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل حالة الانتقال العمري'**
  String get ageTransitionLoadErrorGeneric;

  /// No description provided for @ageTransitionNoChangeTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد تغيير حاليًا'**
  String get ageTransitionNoChangeTitle;

  /// No description provided for @ageTransitionNoChangeBody.
  ///
  /// In ar, this message translates to:
  /// **'مسار الطفل الحالي لا يزال مطابقًا لعمره المحسوب. لا حاجة لأي إجراء الآن.'**
  String get ageTransitionNoChangeBody;

  /// No description provided for @ageTransitionCurrentTrackLabel.
  ///
  /// In ar, this message translates to:
  /// **'المسار الحالي'**
  String get ageTransitionCurrentTrackLabel;

  /// No description provided for @ageTransitionComputedTrackLabel.
  ///
  /// In ar, this message translates to:
  /// **'المسار المقترح'**
  String get ageTransitionComputedTrackLabel;

  /// Explains what will happen if the parent accepts the age-track transition, before they confirm (Requirement 12.4).
  ///
  /// In ar, this message translates to:
  /// **'سيتم نقل الملف من مسار {from} إلى مسار {to}. سيتغيّر المحتوى المعروض تلقائيًا ليطابق مسار {to} الجديد.'**
  String ageTransitionChangeDescription(String from, String to);

  /// No description provided for @ageTransitionAcceptButton.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد الانتقال'**
  String get ageTransitionAcceptButton;

  /// No description provided for @ageTransitionDeferButton.
  ///
  /// In ar, this message translates to:
  /// **'تأجيل لاحقًا'**
  String get ageTransitionDeferButton;

  /// No description provided for @ageTransitionAcceptSuccessBody.
  ///
  /// In ar, this message translates to:
  /// **'تم نقل الملف إلى مسار {track} بنجاح.'**
  String ageTransitionAcceptSuccessBody(String track);

  /// No description provided for @ageTransitionDeferSuccessBody.
  ///
  /// In ar, this message translates to:
  /// **'تم تأجيل الانتقال حتى {date}.'**
  String ageTransitionDeferSuccessBody(String date);

  /// No description provided for @ageTransitionDeferAlreadyActiveBody.
  ///
  /// In ar, this message translates to:
  /// **'يوجد تأجيل نشط بالفعل حتى {date}.'**
  String ageTransitionDeferAlreadyActiveBody(String date);

  /// No description provided for @ageTransitionErrorGeneric.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تنفيذ الإجراء. حاول مجددًا'**
  String get ageTransitionErrorGeneric;

  /// No description provided for @ageTrackLabelPreschool.
  ///
  /// In ar, this message translates to:
  /// **'براعم'**
  String get ageTrackLabelPreschool;

  /// No description provided for @ageTrackLabelKids.
  ///
  /// In ar, this message translates to:
  /// **'مستكشفون'**
  String get ageTrackLabelKids;

  /// No description provided for @ageTrackLabelJunior.
  ///
  /// In ar, this message translates to:
  /// **'روّاد'**
  String get ageTrackLabelJunior;

  /// No description provided for @ageTrackLabelUnknown.
  ///
  /// In ar, this message translates to:
  /// **'غير محدد'**
  String get ageTrackLabelUnknown;

  /// No description provided for @consentPageTitle.
  ///
  /// In ar, this message translates to:
  /// **'الموافقات'**
  String get consentPageTitle;

  /// No description provided for @consentPageIntro.
  ///
  /// In ar, this message translates to:
  /// **'هذه الموافقات تحدد ما نجمعه ونحفظه عن استخدام طفلك. يمكنك تغيير أي منها في أي وقت.'**
  String get consentPageIntro;

  /// No description provided for @consentTypeDataCollectionLabel.
  ///
  /// In ar, this message translates to:
  /// **'جمع بيانات الاستخدام الأساسية'**
  String get consentTypeDataCollectionLabel;

  /// No description provided for @consentTypeDataCollectionDescription.
  ///
  /// In ar, this message translates to:
  /// **'بيانات أساسية لتشغيل الحساب، مثل تسجيل الدخول والتقدم في المحتوى.'**
  String get consentTypeDataCollectionDescription;

  /// No description provided for @consentTypeAnalyticsLabel.
  ///
  /// In ar, this message translates to:
  /// **'تحليلات الاستخدام'**
  String get consentTypeAnalyticsLabel;

  /// No description provided for @consentTypeAnalyticsDescription.
  ///
  /// In ar, this message translates to:
  /// **'بيانات استخدام مجمَّعة تساعدنا على تحسين التجربة داخل التطبيق.'**
  String get consentTypeAnalyticsDescription;

  /// No description provided for @consentTypeVoiceLabel.
  ///
  /// In ar, this message translates to:
  /// **'تسجيلات الصوت'**
  String get consentTypeVoiceLabel;

  /// No description provided for @consentTypeVoiceDescription.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد ميزة تعتمد على الصوت في التطبيق حاليًا؛ هذه الموافقة مُعدّة لأي ميزة صوتية مستقبلية.'**
  String get consentTypeVoiceDescription;

  /// No description provided for @consentTypePersonalizationLabel.
  ///
  /// In ar, this message translates to:
  /// **'تخصيص المحتوى المقترح'**
  String get consentTypePersonalizationLabel;

  /// No description provided for @consentTypePersonalizationDescription.
  ///
  /// In ar, this message translates to:
  /// **'اقتراح محتوى بناءً على اهتمامات طفلك المسجَّلة في ملفه.'**
  String get consentTypePersonalizationDescription;

  /// No description provided for @consentTypeChildCreationsLabel.
  ///
  /// In ar, this message translates to:
  /// **'حفظ رسومات الطفل في السحابة'**
  String get consentTypeChildCreationsLabel;

  /// No description provided for @consentTypeChildCreationsDescription.
  ///
  /// In ar, this message translates to:
  /// **'حفظ رسومات طفلك في مساحة خاصة بأسرتك على السحابة. لا تُنشر ولا تُشارك مع أي طرف آخر.'**
  String get consentTypeChildCreationsDescription;

  /// No description provided for @consentReasonNeverGranted.
  ///
  /// In ar, this message translates to:
  /// **'لم تُمنح هذه الموافقة بعد'**
  String get consentReasonNeverGranted;

  /// No description provided for @consentReasonRevoked.
  ///
  /// In ar, this message translates to:
  /// **'تم سحب هذه الموافقة'**
  String get consentReasonRevoked;

  /// No description provided for @consentReasonVersionSuperseded.
  ///
  /// In ar, this message translates to:
  /// **'تغيّرت سياسة هذه الموافقة، وتحتاج موافقة جديدة'**
  String get consentReasonVersionSuperseded;

  /// No description provided for @consentStatusGranted.
  ///
  /// In ar, this message translates to:
  /// **'ممنوحة'**
  String get consentStatusGranted;

  /// No description provided for @consentLoadErrorGeneric.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل حالة الموافقات'**
  String get consentLoadErrorGeneric;

  /// No description provided for @consentWriteErrorGeneric.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر حفظ التغيير. حاول مجددًا'**
  String get consentWriteErrorGeneric;

  /// No description provided for @consentWriteRequiresParentPin.
  ///
  /// In ar, this message translates to:
  /// **'هذا التغيير سجلٌّ يخصّ وليّ الأمر، ولأسرتك رمز مُسجَّل فعلًا. أدخل الرمز ثم أعد المحاولة.'**
  String get consentWriteRequiresParentPin;

  /// No description provided for @consentUnlockAction.
  ///
  /// In ar, this message translates to:
  /// **'أدخل رمز ولي الأمر'**
  String get consentUnlockAction;

  /// No description provided for @consentContinueButton.
  ///
  /// In ar, this message translates to:
  /// **'متابعة'**
  String get consentContinueButton;

  /// No description provided for @onboardingBasicControlsStepTitle.
  ///
  /// In ar, this message translates to:
  /// **'الضوابط الأساسية'**
  String get onboardingBasicControlsStepTitle;

  /// No description provided for @onboardingBasicControlsStepIntro.
  ///
  /// In ar, this message translates to:
  /// **'اضبط حدود الوقت والسماحات لملف طفلك، ويمكنك تعديلها لاحقًا من منطقة ولي الأمر.'**
  String get onboardingBasicControlsStepIntro;

  /// No description provided for @onboardingContinueButton.
  ///
  /// In ar, this message translates to:
  /// **'متابعة'**
  String get onboardingContinueButton;

  /// No description provided for @onboardingFinishTitle.
  ///
  /// In ar, this message translates to:
  /// **'كل شيء جاهز!'**
  String get onboardingFinishTitle;

  /// No description provided for @onboardingFinishBody.
  ///
  /// In ar, this message translates to:
  /// **'أنشأت ملف طفلك وضبطت الضوابط الأساسية. يمكنك البدء الآن، وتعديل أي إعداد لاحقًا من منطقة ولي الأمر.'**
  String get onboardingFinishBody;

  /// No description provided for @onboardingFinishButton.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ الآن'**
  String get onboardingFinishButton;

  /// Screen-reader label for the Draw Like Me catalogue banner image.
  ///
  /// In ar, this message translates to:
  /// **'ارسم مثلي'**
  String get studioBannerDrawLikeMeLabel;

  /// Screen-reader label for the Connect the Dots catalogue banner image.
  ///
  /// In ar, this message translates to:
  /// **'صل النقاط'**
  String get studioBannerConnectDotsLabel;

  /// Screen-reader label for the colouring home banner image.
  ///
  /// In ar, this message translates to:
  /// **'لوّن'**
  String get studioBannerColoringLabel;

  /// Screen-reader label for the creative studio hero banner image.
  ///
  /// In ar, this message translates to:
  /// **'الاستوديو الإبداعي'**
  String get studioBannerCreativeStudioLabel;

  /// Shown to a parent when the device has no usable Google Play billing service.
  ///
  /// In ar, this message translates to:
  /// **'Google Play غير متاح على هذا الجهاز.'**
  String get googlePlayUnavailableOnDevice;

  /// Title of the opt-in switch for the daily screen-time limit (DECIDE-108).
  ///
  /// In ar, this message translates to:
  /// **'حدّ وقت الشاشة اليومي'**
  String get parentDailyLimitTitle;

  /// Subtitle when the parent has not enabled a daily screen-time limit.
  ///
  /// In ar, this message translates to:
  /// **'غير مفعَّل — لا حدّ على وقت الشاشة'**
  String get parentDailyLimitOff;

  /// Subtitle showing the daily screen-time limit the parent enabled.
  ///
  /// In ar, this message translates to:
  /// **'مفعَّل: {minutes} دقيقة يوميًّا'**
  String parentDailyLimitOn(int minutes);

  /// get copy for app_main/lib/features/auth/data/installation_identity.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'متصفح ويب'**
  String get authinstallationidentityGet01;

  /// get copy for app_main/lib/features/auth/data/installation_identity.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'جهاز Android'**
  String get authinstallationidentityGet02;

  /// get copy for app_main/lib/features/auth/data/installation_identity.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'جهاز Apple محمول'**
  String get authinstallationidentityGet03;

  /// get copy for app_main/lib/features/auth/data/installation_identity.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'جهاز Windows'**
  String get authinstallationidentityGet04;

  /// get copy for app_main/lib/features/auth/data/installation_identity.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'جهاز macOS'**
  String get authinstallationidentityGet05;

  /// dispose copy for app_main/lib/features/auth/presentation/pages/register_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أدخل اسم عرض للأسرة'**
  String get authregisterpageDispose01;

  /// dispose copy for app_main/lib/features/auth/presentation/pages/register_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أدخل البريد الإلكتروني'**
  String get authregisterpageDispose02;

  /// dispose copy for app_main/lib/features/auth/presentation/pages/register_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أدخل بريدًا إلكترونيًا صالحًا'**
  String get authregisterpageDispose03;

  /// text copy for app_main/lib/features/auth/presentation/pages/register_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'استخدم {value1} حرفًا على الأقل'**
  String authregisterpageText01(Object value1);

  /// text copy for app_main/lib/features/auth/presentation/pages/register_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'كلمتا المرور غير متطابقتين'**
  String get authregisterpageText02;

  /// loaded copy for app_main/lib/features/details/presentation/series_details_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حلقة واحدة'**
  String get detailsseriesdetailspageLoaded01;

  /// loaded copy for app_main/lib/features/details/presentation/series_details_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'{value1} حلقة'**
  String detailsseriesdetailspageLoaded02(Object value1);

  /// loaded copy for app_main/lib/features/details/presentation/series_details_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ المسلسل'**
  String get detailsseriesdetailspageLoaded03;

  /// loaded copy for app_main/lib/features/details/presentation/series_details_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تمت إزالة المسلسل من المحفوظات'**
  String get detailsseriesdetailspageLoaded04;

  /// get copy for app_main/lib/features/details/presentation/series_details_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مش قادرين نحفظ ده دلوقتي. جرّب تاني'**
  String get detailsseriesdetailspageGet01;

  /// text copy for app_main/lib/features/details/presentation/series_details_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حلو! هنقترح عليك حاجات شبهه'**
  String get detailsseriesdetailspageText01;

  /// get copy for app_main/lib/features/games/engine/block_code_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تقدّم'**
  String get gamesblockcodeengineGet01;

  /// get copy for app_main/lib/features/games/engine/block_code_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'انعطف يسارًا'**
  String get gamesblockcodeengineGet02;

  /// get copy for app_main/lib/features/games/engine/block_code_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'انعطف يمينًا'**
  String get gamesblockcodeengineGet03;

  /// get copy for app_main/lib/features/games/engine/block_code_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'كرّر'**
  String get gamesblockcodeengineGet04;

  /// get copy for app_main/lib/features/games/engine/block_code_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إذا كان الطريق مفتوحًا'**
  String get gamesblockcodeengineGet05;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أسود'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel01;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أبيض'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel02;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'كحلي داكن'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel03;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أحمر'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel04;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'برتقالي محمر'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel05;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'برتقالي'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel06;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ذهبي'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel07;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أصفر'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel08;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أصفر فاتح'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel09;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أخضر'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel10;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أخضر زاهٍ'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel11;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'سماوي'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel12;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أزرق سماوي'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel13;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أزرق'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel14;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أزرق فاتح'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel15;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'نيلي'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel16;

  /// arabicPaletteColorLabel copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بنفسجي فاتح'**
  String get gamesfreedrawsurfaceArabicPaletteColorLabel17;

  /// text copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بنفسجي'**
  String get gamesfreedrawsurfaceText01;

  /// text copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أرجواني'**
  String get gamesfreedrawsurfaceText02;

  /// text copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'وردي'**
  String get gamesfreedrawsurfaceText03;

  /// text copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'وردي فاتح'**
  String get gamesfreedrawsurfaceText04;

  /// text copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'وردي محمر'**
  String get gamesfreedrawsurfaceText05;

  /// text copy for app_main/lib/features/games/engine/free_draw_surface.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أحمر فاتح'**
  String get gamesfreedrawsurfaceText06;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'قطة'**
  String get gamesgameartText01;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'عصفور'**
  String get gamesgameartText02;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'سمكة'**
  String get gamesgameartText03;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'سمكة حمراء'**
  String get gamesgameartText04;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'سمكة زرقاء'**
  String get gamesgameartText05;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أرنب'**
  String get gamesgameartText06;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أسد'**
  String get gamesgameartText07;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بومة'**
  String get gamesgameartText08;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'سلحفاة'**
  String get gamesgameartText09;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'كلب'**
  String get gamesgameartText10;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حصان'**
  String get gamesgameartText11;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'فيل'**
  String get gamesgameartText12;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حوت'**
  String get gamesgameartText13;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'دجاجة'**
  String get gamesgameartText14;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'فراشة'**
  String get gamesgameartText15;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تفاحة'**
  String get gamesgameartText16;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'صاروخ'**
  String get gamesgameartText17;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'شجرة'**
  String get gamesgameartText18;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'وردة'**
  String get gamesgameartText19;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'شمس'**
  String get gamesgameartText20;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'قمر'**
  String get gamesgameartText21;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'هلال ونجمة'**
  String get gamesgameartText22;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'نجمة'**
  String get gamesgameartText23;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'نجوم'**
  String get gamesgameartText24;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بيت'**
  String get gamesgameartText25;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'سيارة'**
  String get gamesgameartText26;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'كرة'**
  String get gamesgameartText27;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مركب'**
  String get gamesgameartText28;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مركب قديم'**
  String get gamesgameartText29;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'هرم'**
  String get gamesgameartText30;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مكتبة'**
  String get gamesgameartText31;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'كتاب'**
  String get gamesgameartText32;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'جبل'**
  String get gamesgameartText33;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بحر'**
  String get gamesgameartText34;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'قوس قزح'**
  String get gamesgameartText35;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'قطار'**
  String get gamesgameartText36;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'طائرة'**
  String get gamesgameartText37;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'دراجة'**
  String get gamesgameartText38;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حقيبة'**
  String get gamesgameartText39;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مصباح'**
  String get gamesgameartText40;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مسجد'**
  String get gamesgameartText41;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'فانوس'**
  String get gamesgameartText42;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'هلال'**
  String get gamesgameartText43;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الهدف'**
  String get gamesgameartText44;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'كوب ملح'**
  String get gamesgameartText45;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'كوكب'**
  String get gamesgameartText46;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أحمر'**
  String get gamesgameartText47;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أزرق'**
  String get gamesgameartText48;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أخضر'**
  String get gamesgameartText49;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أصفر'**
  String get gamesgameartText50;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'دائرة'**
  String get gamesgameartText51;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مربع'**
  String get gamesgameartText52;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مثلث'**
  String get gamesgameartText53;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بناء الأهرام'**
  String get gamesgameartText54;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مكتبة الإسكندرية'**
  String get gamesgameartText55;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تأسيس القاهرة'**
  String get gamesgameartText56;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حفر قناة السويس'**
  String get gamesgameartText57;

  /// text copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بناء السد العالي'**
  String get gamesgameartText58;

  /// fallback copy for app_main/lib/features/games/engine/game_art.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'عنصر مصوّر'**
  String get gamesgameartFallback01;

  /// seed copy for app_main/lib/features/games/engine/game_board_kit.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'٠'**
  String get gamesgameboardkitSeed01;

  /// seed copy for app_main/lib/features/games/engine/game_board_kit.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'١'**
  String get gamesgameboardkitSeed02;

  /// seed copy for app_main/lib/features/games/engine/game_board_kit.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'٢'**
  String get gamesgameboardkitSeed03;

  /// seed copy for app_main/lib/features/games/engine/game_board_kit.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'٣'**
  String get gamesgameboardkitSeed04;

  /// get copy for app_main/lib/features/games/engine/sim_lab_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'المتغيّر {value1}'**
  String gamessimlabengineGet01(Object value1);

  /// unitKey copy for app_main/lib/features/games/engine/sim_lab_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'وحدة'**
  String get gamessimlabengineUnitKey01;

  /// get copy for app_main/lib/features/games/engine/sim_lab_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'النتيجة'**
  String get gamessimlabengineGet02;

  /// get copy for app_main/lib/features/games/engine/sim_lab_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'درجة'**
  String get gamessimlabengineGet03;

  /// text copy for app_main/lib/features/games/engine/sim_lab_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'اتبع تعليمات السلامة مع شخص بالغ.'**
  String get gamessimlabengineText01;

  /// text copy for app_main/lib/features/games/engine/sim_lab_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'توقّع'**
  String get gamessimlabengineText02;

  /// text copy for app_main/lib/features/games/engine/sim_lab_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'جرّب'**
  String get gamessimlabengineText03;

  /// text copy for app_main/lib/features/games/engine/sim_lab_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'فسّر'**
  String get gamessimlabengineText04;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الأول'**
  String get gamestimelinemapengineHijriYearForGregorian01;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الثاني'**
  String get gamestimelinemapengineHijriYearForGregorian02;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الثالث'**
  String get gamestimelinemapengineHijriYearForGregorian03;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الرابع'**
  String get gamestimelinemapengineHijriYearForGregorian04;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الخامس'**
  String get gamestimelinemapengineHijriYearForGregorian05;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'السادس'**
  String get gamestimelinemapengineHijriYearForGregorian06;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'السابع'**
  String get gamestimelinemapengineHijriYearForGregorian07;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الثامن'**
  String get gamestimelinemapengineHijriYearForGregorian08;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'التاسع'**
  String get gamestimelinemapengineHijriYearForGregorian09;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'العاشر'**
  String get gamestimelinemapengineHijriYearForGregorian10;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الحادي عشر'**
  String get gamestimelinemapengineHijriYearForGregorian11;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الثاني عشر'**
  String get gamestimelinemapengineHijriYearForGregorian12;

  /// hijriYearForGregorian copy for app_main/lib/features/games/engine/timeline_map_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الثالث عشر'**
  String get gamestimelinemapengineHijriYearForGregorian13;

  /// arabicFallback copy for app_main/lib/features/games/engine/trace_color_engine.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ الرسم واتبع التعليمة.'**
  String get gamestracecolorengineArabicFallback01;

  /// title copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'هذا المستوى فارغ الآن'**
  String get gameswaveoneenginesTitle01;

  /// message copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'اختر لعبة أخرى وسنجهّز هذا المستوى قريبًا.'**
  String get gameswaveoneenginesMessage01;

  /// text copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الزوج رقم {value1}'**
  String gameswaveoneenginesText01(Object value1);

  /// text copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بطاقة متطابقة: {value1}'**
  String gameswaveoneenginesText02(Object value1);

  /// text copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بطاقة مكشوفة: {value1}، جرّب بطاقة أخرى'**
  String gameswaveoneenginesText03(Object value1);

  /// text copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بطاقة مكشوفة: {value1}'**
  String gameswaveoneenginesText04(Object value1);

  /// text copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بطاقة مقلوبة'**
  String get gameswaveoneenginesText05;

  /// text copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حاول مرة أخرى'**
  String get gameswaveoneenginesText06;

  /// build copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بطاقة مصوّرة'**
  String get gameswaveoneenginesBuild01;

  /// retryMessage copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ليست هنا. جرّب هدفًا آخر.'**
  String get gameswaveoneenginesRetryMessage01;

  /// title copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'هذا المستوى فارغ الآن'**
  String get gameswaveoneenginesTitle02;

  /// message copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد عناصر للمطابقة هنا. جرّب مستوى آخر.'**
  String get gameswaveoneenginesMessage02;

  /// title copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'هذا المستوى فارغ الآن'**
  String get gameswaveoneenginesTitle03;

  /// message copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد عناصر للفرز هنا. جرّب مستوى آخر.'**
  String get gameswaveoneenginesMessage03;

  /// arabicFallback copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'السلة {value1}'**
  String gameswaveoneenginesArabicFallback01(Object value1);

  /// arabicFallback copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'القطعة {value1}'**
  String gameswaveoneenginesArabicFallback02(Object value1);

  /// arabicFallback copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الخطوة {value1}'**
  String gameswaveoneenginesArabicFallback03(Object value1);

  /// panelCaptionForId copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'خطوة مصوّرة'**
  String get gameswaveoneenginesPanelCaptionForId01;

  /// title copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'هذا المستوى فارغ الآن'**
  String get gameswaveoneenginesTitle04;

  /// message copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد خطوات للترتيب هنا. جرّب مستوى آخر.'**
  String get gameswaveoneenginesMessage04;

  /// text copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رجوع'**
  String get gameswaveoneenginesText07;

  /// text copy for app_main/lib/features/games/engine/wave_one_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الخطوة {value1}'**
  String gameswaveoneenginesText08(Object value1);

  /// title copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'هذا المستوى فارغ الآن'**
  String get gameswavetwoenginesTitle01;

  /// message copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد عناصر للعد هنا. جرّب مستوى آخر.'**
  String get gameswavetwoenginesMessage01;

  /// text copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أعد العدّ'**
  String get gameswavetwoenginesText01;

  /// arabicFallback copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'عنصر العدّ'**
  String get gameswavetwoenginesArabicFallback01;

  /// arabicFallback copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الخيار {value1}'**
  String gameswavetwoenginesArabicFallback02(Object value1);

  /// arabicFallback copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'عنصر العدّ'**
  String get gameswavetwoenginesArabicFallback03;

  /// text copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'{value1} رقم {value2}'**
  String gameswavetwoenginesText02(Object value1, Object value2);

  /// label copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'عدد العناصر في الصندوق'**
  String get gameswavetwoenginesLabel01;

  /// text copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أرجع واحدًا'**
  String get gameswavetwoenginesText03;

  /// text copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'انتهيت'**
  String get gameswavetwoenginesText04;

  /// text copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'المجموعة الأولى'**
  String get gameswavetwoenginesText05;

  /// text copy for app_main/lib/features/games/engine/wave_two_engines.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'المجموعة الثانية'**
  String get gameswavetwoenginesText06;

  /// label copy for app_main/lib/features/games/presentation/pages/coloring/coloring_home_v2.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'طيور'**
  String get gamescoloringhomev2Label01;

  /// label copy for app_main/lib/features/games/presentation/pages/coloring/coloring_home_v2.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حيوانات'**
  String get gamescoloringhomev2Label02;

  /// label copy for app_main/lib/features/games/presentation/pages/coloring/coloring_home_v2.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مركبات'**
  String get gamescoloringhomev2Label03;

  /// label copy for app_main/lib/features/games/presentation/pages/coloring/coloring_home_v2.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الفضاء'**
  String get gamescoloringhomev2Label04;

  /// sub copy for app_main/lib/features/games/presentation/pages/coloring/coloring_home_v2_live.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'طيور'**
  String get gamescoloringhomev2liveSub01;

  /// sub copy for app_main/lib/features/games/presentation/pages/coloring/coloring_home_v2_live.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حيوانات'**
  String get gamescoloringhomev2liveSub02;

  /// sub copy for app_main/lib/features/games/presentation/pages/coloring/coloring_home_v2_live.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مركبات'**
  String get gamescoloringhomev2liveSub03;

  /// sub copy for app_main/lib/features/games/presentation/pages/coloring/coloring_home_v2_live.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الفضاء'**
  String get gamescoloringhomev2liveSub04;

  /// title copy for app_main/lib/features/games/presentation/pages/game_route.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'اختر طفلًا أولًا'**
  String get gamesgamerouteTitle01;

  /// body copy for app_main/lib/features/games/presentation/pages/game_route.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الألعاب تُفتح لطفل واحد، حتى يُحفظ تقدّمه في المكان الصحيح.'**
  String get gamesgamerouteBody01;

  /// text copy for app_main/lib/features/games/presentation/pages/game_screen.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'المستوى {value1} من '**
  String gamesgamescreenText01(Object value1);

  /// tooltip copy for app_main/lib/features/games/presentation/pages/game_screen.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'وضع حركي مبسّط'**
  String get gamesgamescreenTooltip01;

  /// text copy for app_main/lib/features/games/presentation/pages/game_screen.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الوضع الحركي المبسّط مفعّل: الطريق أوسع.'**
  String get gamesgamescreenText02;

  /// text copy for app_main/lib/features/games/presentation/pages/game_screen.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أكملت اللعبة'**
  String get gamesgamescreenText03;

  /// text copy for app_main/lib/features/games/presentation/pages/game_screen.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أكملت المستوى'**
  String get gamesgamescreenText04;

  /// text copy for app_main/lib/features/games/presentation/pages/game_screen.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أنهيت كل المستويات. عمل رائع!'**
  String get gamesgamescreenText05;

  /// build copy for app_main/lib/features/home/presentation/home_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مفيش اتصال بالإنترنت'**
  String get homehomepageBuild01;

  /// build copy for app_main/lib/features/home/presentation/home_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تجهيز الرحلة'**
  String get homehomepageBuild02;

  /// text copy for app_main/lib/features/home/presentation/pages/library_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مكتبتي'**
  String get homelibrarypageText01;

  /// tooltip copy for app_main/lib/features/home/presentation/pages/library_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بحث'**
  String get homelibrarypageTooltip01;

  /// label copy for app_main/lib/features/home/presentation/pages/library_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أكمل المشاهدة'**
  String get homelibrarypageLabel01;

  /// label copy for app_main/lib/features/home/presentation/pages/library_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'المحفوظات'**
  String get homelibrarypageLabel02;

  /// label copy for app_main/lib/features/home/presentation/pages/library_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'التحميلات'**
  String get homelibrarypageLabel03;

  /// label copy for app_main/lib/features/home/presentation/pages/library_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رسوماتي'**
  String get homelibrarypageLabel04;

  /// text copy for app_main/lib/features/home/presentation/pages/library_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل المكتبة'**
  String get homelibrarypageText02;

  /// text copy for app_main/lib/features/home/presentation/pages/library_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إعادة المحاولة'**
  String get homelibrarypageText03;

  /// text copy for app_main/lib/features/home/presentation/pages/library_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد حلقات قيد المتابعة'**
  String get homelibrarypageText04;

  /// build copy for app_main/lib/features/home/presentation/pages/play_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مفيش اتصال بالإنترنت. جرّب تاني بعد شوية.'**
  String get homeplaypageBuild01;

  /// text copy for app_main/lib/features/home/presentation/pages/play_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'العب'**
  String get homeplaypageText01;

  /// label copy for app_main/lib/features/home/presentation/widgets/cinematic_hero.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'قصص مجرة المختارة'**
  String get homecinematicheroLabel01;

  /// label copy for app_main/lib/features/home/presentation/widgets/home_destination_spec.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الرئيسية'**
  String get homehomedestinationspecLabel01;

  /// label copy for app_main/lib/features/home/presentation/widgets/home_destination_spec.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'استكشف'**
  String get homehomedestinationspecLabel02;

  /// label copy for app_main/lib/features/home/presentation/widgets/home_destination_spec.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مكتبتي'**
  String get homehomedestinationspecLabel03;

  /// label copy for app_main/lib/features/home/presentation/widgets/home_destination_spec.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ملفي'**
  String get homehomedestinationspecLabel04;

  /// text copy for app_main/lib/features/home/presentation/widgets/home_destination_spec.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'منطقة ولي الأمر'**
  String get homehomedestinationspecText01;

  /// text copy for app_main/lib/features/home/presentation/widgets/home_destination_spec.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'منطقة ولي الأمر - تتطلب حسابًا'**
  String get homehomedestinationspecText02;

  /// text copy for app_main/lib/features/home/presentation/widgets/home_destination_spec.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'منطقة ولي الأمر - PIN / بصمة'**
  String get homehomedestinationspecText03;

  /// get copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إثنين'**
  String get parentparentreportsGet01;

  /// get copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ثلاثاء'**
  String get parentparentreportsGet02;

  /// get copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أربعاء'**
  String get parentparentreportsGet03;

  /// get copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'خميس'**
  String get parentparentreportsGet04;

  /// get copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'جمعة'**
  String get parentparentreportsGet05;

  /// get copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'سبت'**
  String get parentparentreportsGet06;

  /// get copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أحد'**
  String get parentparentreportsGet07;

  /// masteryLevelLabel copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'متقَن'**
  String get parentparentreportsMasteryLevelLabel01;

  /// masteryLevelLabel copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بمساعدة'**
  String get parentparentreportsMasteryLevelLabel02;

  /// masteryLevelLabel copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'قيد التمرّن'**
  String get parentparentreportsMasteryLevelLabel03;

  /// masteryLevelLabel copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مُقدَّم'**
  String get parentparentreportsMasteryLevelLabel04;

  /// masteryLevelLabel copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'محتاج مراجعة'**
  String get parentparentreportsMasteryLevelLabel05;

  /// masteryLevelLabel copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'لم يبدأ'**
  String get parentparentreportsMasteryLevelLabel06;

  /// masteryLevelLabel copy for app_main/lib/features/parent/application/parent_reports.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'قيد التمرّن'**
  String get parentparentreportsMasteryLevelLabel07;

  /// tooltip copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رجوع'**
  String get parentparentdashboardpageTooltip01;

  /// text copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'منطقة ولي الأمر'**
  String get parentparentdashboardpageText01;

  /// tooltip copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الإعدادات'**
  String get parentparentdashboardpageTooltip02;

  /// title copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل ملفات الأطفال'**
  String get parentparentdashboardpageTitle01;

  /// body copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تحقق من الاتصال ثم حاول مرة أخرى.'**
  String get parentparentdashboardpageBody01;

  /// text copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الملف النشط'**
  String get parentparentdashboardpageText02;

  /// text copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تبديل'**
  String get parentparentdashboardpageText03;

  /// text copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'لم يُختر ملف طفل بعد.'**
  String get parentparentdashboardpageText04;

  /// text copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ملف طفل'**
  String get parentparentdashboardpageText05;

  /// text copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'نطاق المكتبة لهذا الملف'**
  String get parentparentdashboardpageText06;

  /// text copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل المكتبة.'**
  String get parentparentdashboardpageText07;

  /// label copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'سلاسل متاحة'**
  String get parentparentdashboardpageLabel01;

  /// label copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حلقات'**
  String get parentparentdashboardpageLabel02;

  /// label copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'أنشطة'**
  String get parentparentdashboardpageLabel03;

  /// text copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل تقرير الأسبوع.'**
  String get parentparentdashboardpageText08;

  /// text copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إعادة'**
  String get parentparentdashboardpageText09;

  /// title copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تقرير الأسبوع'**
  String get parentparentdashboardpageTitle02;

  /// body copy for app_main/lib/features/parent/presentation/pages/parent_dashboard_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مفيش نشاط في آخر 7 أيام.'**
  String get parentparentdashboardpageBody02;

  /// NotificationsCard copy for app_main/lib/features/parent/presentation/widgets/notifications_card.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حلقات جديدة'**
  String get parentnotificationscardNotificationsCard01;

  /// NotificationsCard copy for app_main/lib/features/parent/presentation/widgets/notifications_card.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'لما تنزل حلقة جديدة على مجرة'**
  String get parentnotificationscardNotificationsCard02;

  /// NotificationsCard copy for app_main/lib/features/parent/presentation/widgets/notifications_card.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'وقت الشاشة'**
  String get parentnotificationscardNotificationsCard03;

  /// NotificationsCard copy for app_main/lib/features/parent/presentation/widgets/notifications_card.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'لما يفضل 5 دقايق على وقت الطفل اليومي'**
  String get parentnotificationscardNotificationsCard04;

  /// NotificationsCard copy for app_main/lib/features/parent/presentation/widgets/notifications_card.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تقرير الأسبوع'**
  String get parentnotificationscardNotificationsCard05;

  /// NotificationsCard copy for app_main/lib/features/parent/presentation/widgets/notifications_card.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'كل جمعة: اتفرجوا قد إيه واتعلموا إيه'**
  String get parentnotificationscardNotificationsCard06;

  /// text copy for app_main/lib/features/parent/presentation/widgets/notifications_card.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات اتفعّلت على الموبايل ده'**
  String get parentnotificationscardText01;

  /// text copy for app_main/lib/features/parent/presentation/widgets/notifications_card.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات مقفولة. فعّلها من إعدادات الموبايل لتطبيق مجرة'**
  String get parentnotificationscardText02;

  /// kind copy for app_main/lib/features/parent/presentation/widgets/notifications_card.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مش قادرين نحفظ الإعداد دلوقتي. جرّب تاني'**
  String get parentnotificationscardKind01;

  /// text copy for app_main/lib/features/parent/presentation/widgets/notifications_card.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات'**
  String get parentnotificationscardText03;

  /// text copy for app_main/lib/features/parent/presentation/widgets/notifications_card.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'فعّل الإشعارات على الموبايل ده'**
  String get parentnotificationscardText04;

  /// message copy for app_main/lib/features/planets/presentation/planets_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رجوع'**
  String get planetsplanetspageMessage01;

  /// text copy for app_main/lib/features/planets/presentation/planets_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'كواكب مجرة'**
  String get planetsplanetspageText01;

  /// text copy for app_main/lib/features/planets/presentation/planets_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رحلة عبر عوالم المعرفة والترفيه'**
  String get planetsplanetspageText02;

  /// label copy for app_main/lib/features/playback/presentation/playback_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'العربية'**
  String get playbackplaybackpageLabel01;

  /// text copy for app_main/lib/features/playback/presentation/playback_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تلقائي'**
  String get playbackplaybackpageText01;

  /// message copy for app_main/lib/features/playback/presentation/playback_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'انقطع الاتصال. تحقّق من الإنترنت وحاول مرة أخرى.'**
  String get playbackplaybackpageMessage01;

  /// message copy for app_main/lib/features/playback/presentation/playback_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الفيديو غير متاح حاليًا. حاول لاحقًا.'**
  String get playbackplaybackpageMessage02;

  /// message copy for app_main/lib/features/playback/presentation/playback_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'انتهت الجلسة. سجّل الدخول مجددًا.'**
  String get playbackplaybackpageMessage03;

  /// message copy for app_main/lib/features/playback/presentation/playback_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'هذا المحتوى يتطلب اشتراكًا.'**
  String get playbackplaybackpageMessage04;

  /// text copy for app_main/lib/features/profile/data/legal_documents.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'سياسة الخصوصية'**
  String get profilelegaldocumentsText01;

  /// text copy for app_main/lib/features/profile/data/legal_documents.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'خصوصية الأطفال'**
  String get profilelegaldocumentsText02;

  /// text copy for app_main/lib/features/profile/data/legal_documents.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'شروط الاستخدام'**
  String get profilelegaldocumentsText03;

  /// text copy for app_main/lib/features/profile/data/legal_documents.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حذف الحساب والبيانات'**
  String get profilelegaldocumentsText04;

  /// get copy for app_main/lib/features/profile/data/manual_payment.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'سنة'**
  String get profilemanualpaymentGet01;

  /// get copy for app_main/lib/features/profile/data/manual_payment.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'شهر'**
  String get profilemanualpaymentGet02;

  /// get copy for app_main/lib/features/profile/presentation/pages/devices_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'جهاز غير مسمّى'**
  String get profiledevicespageGet01;

  /// build copy for app_main/lib/features/profile/presentation/pages/legal_document_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الصفحات القانونية'**
  String get profilelegaldocumentpageBuild01;

  /// tooltip copy for app_main/lib/features/profile/presentation/pages/legal_document_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رجوع'**
  String get profilelegaldocumentpageTooltip01;

  /// text copy for app_main/lib/features/profile/presentation/pages/legal_document_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل الصفحة. تأكد من الاتصال وحاول تاني.'**
  String get profilelegaldocumentpageText01;

  /// action copy for app_main/lib/features/profile/presentation/pages/legal_document_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إعادة المحاولة'**
  String get profilelegaldocumentpageAction01;

  /// text copy for app_main/lib/features/profile/presentation/pages/legal_document_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الصفحة دي لسه ماتنشرتش. تقدر تشوف ملخص البيانات '**
  String get profilelegaldocumentpageText02;

  /// text copy for app_main/lib/features/profile/presentation/pages/legal_document_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'اللي التطبيق بيخزّنها وأدوات التحكم فيها.'**
  String get profilelegaldocumentpageText03;

  /// action copy for app_main/lib/features/profile/presentation/pages/legal_document_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ملخص الخصوصية والبيانات'**
  String get profilelegaldocumentpageAction02;

  /// build copy for app_main/lib/features/profile/presentation/pages/legal_document_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الإصدار {value1} · آخر تحديث {value2}'**
  String profilelegaldocumentpageBuild02(Object value1, Object value2);

  /// initState copy for app_main/lib/features/profile/presentation/pages/membership_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذر إتمام عملية الشراء. أعد المحاولة.'**
  String get profilemembershippageInitState01;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'وصلنا طلبك. هنراجع التحويل ونبعتلك إشعار أول ما الاشتراك يتفعّل.'**
  String get profilemanualpaymentsectionText01;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الإيصال اترفع.'**
  String get profilemanualpaymentsectionText02;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء الطلب؟'**
  String get profilemanualpaymentsectionText03;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'لو كنت حوّلت الفلوس فعلًا، سيب الطلب زي ما هو لحد ما نراجعه.'**
  String get profilemanualpaymentsectionText04;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رجوع'**
  String get profilemanualpaymentsectionText05;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء الطلب'**
  String get profilemanualpaymentsectionText06;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'جدّد اشتراكك بالمحفظة أو إنستاباي'**
  String get profilemanualpaymentsectionText07;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ادفع بالمحفظة أو إنستاباي'**
  String get profilemanualpaymentsectionText08;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'آخر طلب اترفض'**
  String get profilemanualpaymentsectionText09;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تقدر تبعت طلب جديد.'**
  String get profilemanualpaymentsectionText10;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'لو جدّدت قبل ما الاشتراك يخلص، المدة الجديدة بتتضاف بعد الحالية.'**
  String get profilemanualpaymentsectionText11;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'جدّد الاشتراك'**
  String get profilemanualpaymentsectionText12;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'اشترك دلوقتي'**
  String get profilemanualpaymentsectionText13;

  /// build copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'طلبك بـ {value1} جنيه ({value2}) '**
  String profilemanualpaymentsectionBuild01(Object value1, Object value2);

  /// build copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تحت المراجعة. هنبعتلك إشعار أول ما يتفعّل.'**
  String get profilemanualpaymentsectionBuild02;

  /// build copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إرفاق صورة الإيصال'**
  String get profilemanualpaymentsectionBuild03;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء الطلب'**
  String get profilemanualpaymentsectionText14;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'1. اختار الباقة'**
  String get profilemanualpaymentsectionText15;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'{value1} · {value2} ج.م / {value3}'**
  String profilemanualpaymentsectionText16(
    Object value1,
    Object value2,
    Object value3,
  );

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'2. اختار وسيلة التحويل'**
  String get profilemanualpaymentsectionText17;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حوّل {value1} جنيه على {value2}:'**
  String profilemanualpaymentsectionText18(Object value1, Object value2);

  /// tooltip copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'نسخ الرقم'**
  String get profilemanualpaymentsectionTooltip01;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الرقم اتنسخ'**
  String get profilemanualpaymentsectionText19;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'باسم: {value1}'**
  String profilemanualpaymentsectionText20(Object value1);

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'3. بعد ما تحوّل، اكتب بيانات التحويل'**
  String get profilemanualpaymentsectionText21;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رقمك أو عنوان إنستاباي اللي حوّلت منه'**
  String get profilemanualpaymentsectionText22;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رقم المحفظة اللي حوّلت منها'**
  String get profilemanualpaymentsectionText23;

  /// labelText copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رقم العملية (اختياري)'**
  String get profilemanualpaymentsectionLabelText01;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'صورة الإيصال (مطلوبة)'**
  String get profilemanualpaymentsectionText24;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'صورة الإيصال (اختياري)'**
  String get profilemanualpaymentsectionText25;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'اتختارت صورة الإيصال'**
  String get profilemanualpaymentsectionText26;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ابعت للمراجعة'**
  String get profilemanualpaymentsectionText27;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الاشتراك بيتفعّل {value1} يوم بعد ما نتأكد من التحويل، وبيوصلك إشعار. '**
  String profilemanualpaymentsectionText28(Object value1);

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مفيش تجديد تلقائي.'**
  String get profilemanualpaymentsectionText29;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'عندك طلب تحت المراجعة بالفعل.'**
  String get profilemanualpaymentsectionText30;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بعت طلبات كتير النهارده. جرّب بكرة أو كلّمنا.'**
  String get profilemanualpaymentsectionText31;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'افتح منطقة الأهل بالرقم السري الأول.'**
  String get profilemanualpaymentsectionText32;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الصورة كبيرة أو نوعها مش مدعوم.'**
  String get profilemanualpaymentsectionText33;

  /// text copy for app_main/lib/features/profile/presentation/widgets/manual_payment_section.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الدفع بالمحفظة مش متاح دلوقتي.'**
  String get profilemanualpaymentsectionText34;

  /// tooltip copy for app_main/lib/features/search/presentation/search_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رجوع'**
  String get searchsearchpageTooltip01;

  /// text copy for app_main/lib/features/tv/application/tv_command_handler.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بيتفرج دلوقتي: {value1} · من {value2}'**
  String tvtvcommandhandlerText01(Object value1, Object value2);

  /// text copy for app_main/lib/features/tv/application/tv_command_handler.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'بيتفرج دلوقتي: {value1}'**
  String tvtvcommandhandlerText02(Object value1);

  /// error copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الكود ٨ حروف وأرقام، زي ABCD-EF23.'**
  String get tvlinktvpageError01;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الكود غير صحيح أو انتهت صلاحيته. اطلب كودًا جديدًا من التلفزيون.'**
  String get tvlinktvpageText01;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر التحقق من الكود. حاول مرة أخرى.'**
  String get tvlinktvpageText02;

  /// error copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الاتصال. تحقّق من الإنترنت.'**
  String get tvlinktvpageError02;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'انتهت صلاحية الكود. اطلب كودًا جديدًا من التلفزيون.'**
  String get tvlinktvpageText03;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تمت الموافقة على هذا الكود بالفعل.'**
  String get tvlinktvpageText04;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'وصلت لحدّ التلفزيونات في باقتك. احذف تلفزيون قديم أو اخرج منه، وبعدين وافق تاني. الكود لسه شغّال.'**
  String get tvlinktvpageText05;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'انتهت صلاحية تأكيد ولي الأمر. أدخل PIN مرة أخرى.'**
  String get tvlinktvpageText06;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّرت الموافقة. حاول مرة أخرى.'**
  String get tvlinktvpageText07;

  /// error copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الاتصال. تحقّق من الإنترنت.'**
  String get tvlinktvpageError03;

  /// build copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ربط تلفزيون'**
  String get tvlinktvpageBuild01;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إدارة الأجهزة'**
  String get tvlinktvpageText08;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'افتح مجرّة على التلفزيون، واكتب الكود اللي ظاهر على الشاشة.'**
  String get tvlinktvpageText09;

  /// labelText copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'كود التلفزيون'**
  String get tvlinktvpageLabelText01;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'متابعة'**
  String get tvlinktvpageText10;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تلفزيون'**
  String get tvlinktvpageText11;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'{value1} · الكود {value2}'**
  String tvlinktvpageText12(Object value1, Object value2);

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الجهاز ده عايز يدخل على حساب عيلتك. وافق بس لو التلفزيون قدامك دلوقتي وإنت اللي طلبت الكود.'**
  String get tvlinktvpageText13;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'موافقة بـ PIN ولي الأمر'**
  String get tvlinktvpageText14;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ده مش جهازي'**
  String get tvlinktvpageText15;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تم ربط التلفزيون. هيفتح لوحده خلال ثواني على شاشة اختيار الطفل.'**
  String get tvlinktvpageText16;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تقدر تشيله في أي وقت من شاشة الأجهزة.'**
  String get tvlinktvpageText17;

  /// text copy for app_main/lib/features/tv/presentation/pages/link_tv_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تمام'**
  String get tvlinktvpageText18;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_pairing_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'محاولات كثيرة. انتظر دقيقة ثم اطلب كودًا جديدًا.'**
  String get tvtvpairingpageText01;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_pairing_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الحصول على كود. تحقّق من اتصال التلفزيون بالإنترنت.'**
  String get tvtvpairingpageText02;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_pairing_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ادخل من موبايلك'**
  String get tvtvpairingpageText03;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_pairing_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'افتح تطبيق مجرّة على موبايل ولي الأمر.'**
  String get tvtvpairingpageText04;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_pairing_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'صوّر الكود بكاميرا الموبايل، أو ادخل: الأجهزة ← ربط تلفزيون.'**
  String get tvtvpairingpageText05;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_pairing_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'اكتب الكود الظاهر هنا، وأكّد برقم PIN ولي الأمر.'**
  String get tvtvpairingpageText06;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_pairing_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الدخول بالبريد وكلمة المرور'**
  String get tvtvpairingpageText07;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_pairing_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تمت الموافقة، جارٍ الدخول…'**
  String get tvtvpairingpageText08;

  /// error copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الاتصال. حاول مرة أخرى.'**
  String get tvtvremotepageError01;

  /// build copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'التلفزيون'**
  String get tvtvremotepageBuild01;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'التلفزيون مش متصل'**
  String get tvtvremotepageText01;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ التشغيل…'**
  String get tvtvremotepageText02;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مستني'**
  String get tvtvremotepageText03;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'شغّال على التلفزيون'**
  String get tvtvremotepageText04;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'متوقف مؤقتًا'**
  String get tvtvremotepageText05;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الحلقة خلصت'**
  String get tvtvremotepageText06;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ما اشتغلتش'**
  String get tvtvremotepageText07;

  /// tooltip copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'رجوع ١٠ ثواني'**
  String get tvtvremotepageTooltip01;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إيقاف مؤقت'**
  String get tvtvremotepageText08;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تشغيل'**
  String get tvtvremotepageText09;

  /// tooltip copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'قدّام ١٠ ثواني'**
  String get tvtvremotepageTooltip02;

  /// text copy for app_main/lib/features/tv/presentation/pages/tv_remote_page.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'إيقاف التشغيل على التلفزيون'**
  String get tvtvremotepageText10;

  /// error copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الوصول للتلفزيونات. تحقّق من الإنترنت.'**
  String get tvtvcastsheetError01;

  /// error copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'اختار ملف الطفل الأول.'**
  String get tvtvcastsheetError02;

  /// error copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الاتصال. حاول مرة أخرى.'**
  String get tvtvcastsheetError03;

  /// build copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'شغّل على التلفزيون'**
  String get tvtvcastsheetBuild01;

  /// text copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مفيش تلفزيون متصل دلوقتي. افتح مجرّة على التلفزيون وتأكد إنه داخل على نفس الحساب.'**
  String get tvtvcastsheetText01;

  /// text copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تحديث'**
  String get tvtvcastsheetText02;

  /// text copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تلفزيون'**
  String get tvtvcastsheetText03;

  /// text copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'شغّال: {value1}'**
  String tvtvcastsheetText04(Object value1);

  /// text copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'شغّال دلوقتي'**
  String get tvtvcastsheetText05;

  /// text copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'متصل'**
  String get tvtvcastsheetText06;

  /// castErrorMessage copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'التلفزيون مش متصل دلوقتي. افتح مجرّة عليه وحاول تاني.'**
  String get tvtvcastsheetCastErrorMessage01;

  /// castErrorMessage copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'التلفزيون ما ردّش. تأكد إنه شغّال ومتصل بالإنترنت.'**
  String get tvtvcastsheetCastErrorMessage02;

  /// castErrorMessage copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'ملف الطفل ده مش موجود على الحساب.'**
  String get tvtvcastsheetCastErrorMessage03;

  /// castErrorMessage copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'وقت الشاشة لليوم خلص للطفل ده.'**
  String get tvtvcastsheetCastErrorMessage04;

  /// castErrorMessage copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'دلوقتي وقت النوم حسب إعدادات ولي الأمر.'**
  String get tvtvcastsheetCastErrorMessage05;

  /// castErrorMessage copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الطفل وصل لحد المشاهدة المتواصلة. استراحة شوية.'**
  String get tvtvcastsheetCastErrorMessage06;

  /// text copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'وصلت لعدد الشاشات المسموح بيه في باقتك.'**
  String get tvtvcastsheetText07;

  /// text copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'الحلقة دي محتاجة اشتراك.'**
  String get tvtvcastsheetText08;

  /// text copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'مفيش حاجة شغالة على التلفزيون.'**
  String get tvtvcastsheetText09;

  /// text copy for app_main/lib/features/tv/presentation/tv_cast_sheet.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'التلفزيون ما قدرش يشغّل الحلقة.'**
  String get tvtvcastsheetText10;

  /// label copy for app_main/lib/features/tv/presentation/tv_receiver_host.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'تلفزيون'**
  String get tvtvreceiverhostLabel01;

  /// text copy for app_main/lib/main.dart; Arabic fallback preserves the current UI.
  ///
  /// In ar, this message translates to:
  /// **'حدث خطأ: {value1}'**
  String mainText01(Object value1);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en', 'fr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
    case 'fr':
      return AppLocalizationsFr();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
