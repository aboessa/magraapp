// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Majarra';

  @override
  String get loginTitle => 'Welcome to Majarra';

  @override
  String get loginSubtitle => 'A safe space for imagination';

  @override
  String get emailLabel => 'Email';

  @override
  String get passwordLabel => 'Password';

  @override
  String get loginButton => 'Sign in';

  @override
  String get enterEmailAndPassword => 'Enter your email and password';

  @override
  String get termsNotice =>
      'You can review the privacy and data information before continuing';

  @override
  String get registerButton => 'Create account';

  @override
  String get forgotPassword => 'Forgot password?';

  @override
  String get noAccount => 'No account?';

  @override
  String get hasAccount => 'Have an account?';

  @override
  String get createFamilyAccount => 'Create family account';

  @override
  String get oneAccountPerFamily => 'One account for the whole family';

  @override
  String get parentNameLabel => 'Parent name';

  @override
  String passwordMinLength(int count) {
    return 'Password must be at least $count characters';
  }

  @override
  String get accountCreatedCheckEmail => 'Account created - check your email';

  @override
  String get back => 'Back';

  @override
  String get parentArea => 'Parent area';

  @override
  String get createParentPin => 'Create parent PIN';

  @override
  String get enterParentPin => 'Enter parent PIN';

  @override
  String get savePin => 'Save PIN';

  @override
  String get enter => 'Enter';

  @override
  String pinRangeHint(int min, int max) {
    return 'Choose a $min to $max digit code only the parent knows';
  }

  @override
  String get pinConfirmLabel => 'Confirm code';

  @override
  String get pinMismatch => 'The codes do not match';

  @override
  String get pinEmpty => 'Enter the code';

  @override
  String get pinIncorrect => 'Incorrect code';

  @override
  String get pinIncorrectOneLeft => 'Incorrect code. One attempt remaining';

  @override
  String pinIncorrectAttemptsLeft(int count) {
    return 'Incorrect code. $count attempts remaining';
  }

  @override
  String pinLockedOut(String label) {
    return 'Too many attempts. Try again in $label';
  }

  @override
  String get pinNotEnrolledYet =>
      'No code has been created yet. Create one now.';

  @override
  String pinSavedLocallyOnly(String reason) {
    return 'Code saved on this device; it could not be saved on the server: $reason';
  }

  @override
  String minutesLabel(int count) {
    return '$count minutes';
  }

  @override
  String get momentsLabel => 'a moment';

  @override
  String get serverErrorGeneric => 'Server error';

  @override
  String get serverUnreachable => 'Could not reach the server';

  @override
  String get tooManyAttemptsShort => 'Too many attempts — try again later';

  @override
  String get sessionExpiredShort => 'Session expired — sign in again';

  @override
  String get parentPinDisclosure =>
      'The code is stored encrypted on this device and synced to the server when you sign in. Server verification is the real boundary; the local check stops a child opening this area while offline.';

  @override
  String get biometricUnavailable =>
      'Fingerprint / Face ID — not available yet';

  @override
  String get home => 'Home';

  @override
  String get search => 'Search';

  @override
  String get profile => 'Profile';

  @override
  String get settings => 'Settings';

  @override
  String get settingsSectionPlayback => 'Playback';

  @override
  String get settingsSectionDownload => 'Downloads';

  @override
  String get settingsSectionNotifications => 'Notifications';

  @override
  String get settingsSectionGeneral => 'General';

  @override
  String get settingsSectionAccount => 'Account';

  @override
  String get autoplayNextTitle => 'Autoplay next episode';

  @override
  String get autoplayNextSubtitle =>
      'The player moves to the next episode when one ends';

  @override
  String get videoQualityTitle => 'Video quality';

  @override
  String get wifiOnlyTitle => 'Download over Wi-Fi only';

  @override
  String get wifiOnlySubtitle => 'Saves mobile data';

  @override
  String get contentNotificationsTitle => 'New content notifications';

  @override
  String get contentNotificationsSubtitle => 'New episodes and titles';

  @override
  String get languageLabel => 'Language';

  @override
  String get languageValueArabic => 'Arabic';

  @override
  String get appearanceLabel => 'Appearance';

  @override
  String get appearanceValueDark => 'Cinematic dark';

  @override
  String get settingsDeviceOnlyNotice =>
      'These settings are stored on this device only and are not synced across family devices yet.';

  @override
  String get accountDataTitle => 'Account details';

  @override
  String get accountNotLinkedYet => 'Account details are not linked yet';

  @override
  String get nameLabel => 'Name';

  @override
  String get phoneLabel => 'Phone number';

  @override
  String get addAction => 'Add';

  @override
  String get changeAction => 'Change';

  @override
  String get accountEditUnavailable => 'Editing details is not available yet';

  @override
  String get downloadsTitle => 'Downloads';

  @override
  String get storageUsedTitle => 'Storage used';

  @override
  String get storageComputedWhenEnabled =>
      'Storage size is calculated once downloads are enabled';

  @override
  String get noDownloadsTitle => 'No downloads';

  @override
  String get noDownloadsBody => 'Download from the button on a details page';

  @override
  String get doneShort => 'Done';

  @override
  String get supportTitle => 'Support';

  @override
  String get supportHeadline => 'How can we help?';

  @override
  String get supportResponseTime => 'No response time is currently published';

  @override
  String get supportChannelPending => 'Contact channel is being set up';

  @override
  String get supportFaqTitle => 'Frequently asked questions';

  @override
  String get supportFaqSubtitle => 'Not published yet';

  @override
  String get supportReportTitle => 'Report a problem';

  @override
  String get supportSuggestTitle => 'Suggest a feature';

  @override
  String get supportCallTitle => 'Call us';

  @override
  String get supportCallSubtitle => 'Support number announced soon';

  @override
  String get notAvailableYet => 'Not available yet';

  @override
  String get licensesTitle => 'Software licences';

  @override
  String get licensesSubtitle => 'Fonts and packages used';

  @override
  String get logoutTitle => 'Sign out';

  @override
  String get logoutConfirmBody =>
      'You will be asked for your email and password next time, and the parent PIN will be removed from this device.';

  @override
  String get cancel => 'Cancel';

  @override
  String get retry => 'Retry';

  @override
  String get offlineTitle => 'No connection';

  @override
  String get offlineMessage => 'Check your internet and try again';

  @override
  String get contentUnavailable => 'Content is currently unavailable';

  @override
  String get authExpired => 'Session expired. Please sign in again';

  @override
  String get biometricReason => 'Confirm your identity to open the parent area';

  @override
  String get biometricEnableTitle => 'Enable biometric unlock';

  @override
  String get biometricEnablePrompt =>
      'Use fingerprint or Face ID to open the parent area on this device instead of entering the code each time?';

  @override
  String get notNow => 'Not now';

  @override
  String get enable => 'Enable';

  @override
  String get creativeStudioTitle => 'Creative Studio';

  @override
  String get myBoards => 'My Boards';

  @override
  String get drawLikeThis => 'Draw Like This';

  @override
  String get coloring => 'Coloring';

  @override
  String get tracing => 'Tracing';

  @override
  String get connectDots => 'Connect the Dots';

  @override
  String get completeDrawing => 'Complete the Drawing';

  @override
  String get copyPattern => 'Copy the Pattern';

  @override
  String get drawFromPrompt => 'Draw from Prompt';

  @override
  String get newBoard => 'New Board';

  @override
  String get newBlankBoard => 'Blank Board';

  @override
  String get continueDrawing => 'Continue Drawing';

  @override
  String get startDrawing => 'Start Drawing';

  @override
  String get chooseBoardType => 'Choose board type';

  @override
  String get portrait => 'Portrait';

  @override
  String get landscape => 'Landscape';

  @override
  String get square => 'Square';

  @override
  String get backgroundBlank => 'Blank';

  @override
  String get backgroundSpace => 'Space';

  @override
  String get backgroundUnderwater => 'Underwater';

  @override
  String get backgroundGarden => 'Garden';

  @override
  String get backgroundSky => 'Sky';

  @override
  String get backgroundRoom => 'Room';

  @override
  String get backgroundGrid => 'Grid';

  @override
  String get brush => 'Brush';

  @override
  String get color => 'Color';

  @override
  String get brushSize => 'Brush size';

  @override
  String get eraser => 'Eraser';

  @override
  String get undo => 'Undo';

  @override
  String get redo => 'Redo';

  @override
  String get clear => 'Clear';

  @override
  String get clearConfirmTitle => 'Clear board?';

  @override
  String get clearConfirmBody =>
      'This will clear the drawing. You can undo right after.';

  @override
  String get save => 'Save';

  @override
  String get saved => 'Saved';

  @override
  String get saving => 'Saving…';

  @override
  String get unsaved => 'Unsaved';

  @override
  String get saveAndExit => 'Save and exit';

  @override
  String get discard => 'Discard';

  @override
  String get continueDrawingAction => 'Continue';

  @override
  String get referenceShow => 'Show example';

  @override
  String get referenceHide => 'Hide example';

  @override
  String get referenceEnlarge => 'Enlarge example';

  @override
  String get ghostMode => 'Ghost background';

  @override
  String get ghostOpacity => 'Ghost opacity';

  @override
  String get compareDrawings => 'Compare drawings';

  @override
  String stepOf(Object current, Object total) {
    return 'Step $current of $total';
  }

  @override
  String get next => 'Next';

  @override
  String get previous => 'Previous';

  @override
  String get tryToDraw => 'Try to draw it';

  @override
  String get awesomeWeSaved => 'Awesome! We saved your drawing.';

  @override
  String get chooseColor => 'Choose a color';

  @override
  String get colorThePicture => 'Color the picture';

  @override
  String get connectTheDots => 'Connect the dots in order';

  @override
  String get drawAsYouLike => 'Draw as you like';

  @override
  String get tapDoneWhenFinished => 'Tap Done when finished';

  @override
  String get startHere => 'Start here';

  @override
  String get traceLine => 'Trace the line';

  @override
  String get wellDone => 'Well done';

  @override
  String get tryAgain => 'Try again';

  @override
  String get categoryAnimals => 'Animals';

  @override
  String get categorySpace => 'Space';

  @override
  String get categoryNature => 'Nature';

  @override
  String get categoryVehicles => 'Vehicles';

  @override
  String get categoryHome => 'Home';

  @override
  String get categoryPatterns => 'Patterns';

  @override
  String get difficultyEasy => 'Easy';

  @override
  String get difficultyMedium => 'Medium';

  @override
  String get difficultyDetailed => 'Detailed';

  @override
  String get age45 => '4–5';

  @override
  String get age67 => '6–7';

  @override
  String get age89 => '8–9';

  @override
  String boardTitleDefault(Object number) {
    return 'My Board $number';
  }

  @override
  String get boardOrientationPortrait => 'Portrait';

  @override
  String get boardOrientationLandscape => 'Landscape';

  @override
  String get boardOrientationSquare => 'Square';

  @override
  String referenceBadge(Object title) {
    return 'From: $title';
  }
}
