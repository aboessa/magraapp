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
