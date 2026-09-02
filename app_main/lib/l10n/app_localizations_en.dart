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
  String get pinToggleShow => 'Show code';

  @override
  String get pinToggleHide => 'Hide code';

  @override
  String get pinGrantFailedRetry =>
      'The code was verified, but access could not be saved. Try again.';

  @override
  String get pinServerVerificationFooter =>
      'The code is verified on the server, and the signed access proof is kept in memory only for a short time. The proof is cleared when the session ends or the app moves to the background.';

  @override
  String get pinUnlockingWithBiometric => 'Verifying with your fingerprint…';

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

  @override
  String get childFormCreateTitle => 'New child profile';

  @override
  String get childFormEditTitle => 'Edit child profile';

  @override
  String get childFormCreateSubtitle =>
      'Pick a character from the Majarra universe';

  @override
  String get childFormEditSubtitle =>
      'Edit the profile\'s details and interests';

  @override
  String get childFormNicknameLabel => 'Child\'s name';

  @override
  String get childFormNicknameHint => 'e.g. Layla';

  @override
  String get childFormNicknameEmptyError => 'Enter a name for the profile';

  @override
  String get childFormBirthMonthLabel => 'Birth month';

  @override
  String get childFormBirthYearLabel => 'Birth year';

  @override
  String get childFormBirthDateReadOnlyLabel => 'Date of birth';

  @override
  String get childFormBirthDateEditNotice =>
      'Changing the birth date is handled later through the age-transition flow, not from this screen';

  @override
  String get childFormAvatarSectionTitle =>
      'Pick a character from the Majarra universe';

  @override
  String childFormAvatarCount(int count) {
    return '$count characters';
  }

  @override
  String get childFormAvatarSectionSubtitle =>
      'The same cartoon characters from the series';

  @override
  String get childFormInterestsTitle => 'Interests';

  @override
  String get childFormInterestsSubtitle =>
      'Pick what your child enjoys, you can select more than one';

  @override
  String get childFormLanguageReadOnlyNotice =>
      'Only one language is available today; the list will grow once other translations are complete';

  @override
  String get childFormSaveButtonCreate => 'Create profile';

  @override
  String get childFormSaveButtonEdit => 'Save changes';

  @override
  String get childFormCreateErrorGeneric =>
      'Could not create the profile. Check your plan\'s limit (4 children)';

  @override
  String get childFormEditErrorGeneric => 'Could not save changes';

  @override
  String get interestAbjad => 'Letters';

  @override
  String get interestArqam => 'Numbers';

  @override
  String get interestOloom => 'Science';

  @override
  String get interestQiyam => 'Values';

  @override
  String get interestQisas => 'Stories';

  @override
  String get interestMaharat => 'Skills';

  @override
  String get interestTarikh => 'History';

  @override
  String get interestAlam => 'Our world';

  @override
  String get interestIman => 'Faith';

  @override
  String get ageTransitionReviewTitle => 'Age transition review';

  @override
  String get ageTransitionLoadErrorGeneric =>
      'Could not load the age-transition status';

  @override
  String get ageTransitionNoChangeTitle => 'No change right now';

  @override
  String get ageTransitionNoChangeBody =>
      'The child\'s current track still matches their computed age. No action is needed now.';

  @override
  String get ageTransitionCurrentTrackLabel => 'Current track';

  @override
  String get ageTransitionComputedTrackLabel => 'Suggested track';

  @override
  String ageTransitionChangeDescription(String from, String to) {
    return 'The profile will move from the $from track to the $to track. The content shown will automatically update to match the new $to track.';
  }

  @override
  String get ageTransitionAcceptButton => 'Confirm transition';

  @override
  String get ageTransitionDeferButton => 'Defer for later';

  @override
  String ageTransitionAcceptSuccessBody(String track) {
    return 'The profile was moved to the $track track successfully.';
  }

  @override
  String ageTransitionDeferSuccessBody(String date) {
    return 'The transition was deferred until $date.';
  }

  @override
  String ageTransitionDeferAlreadyActiveBody(String date) {
    return 'A deferral is already active until $date.';
  }

  @override
  String get ageTransitionErrorGeneric =>
      'Could not complete the action. Try again';

  @override
  String get ageTrackLabelPreschool => 'Sprouts';

  @override
  String get ageTrackLabelKids => 'Explorers';

  @override
  String get ageTrackLabelJunior => 'Pioneers';

  @override
  String get ageTrackLabelUnknown => 'Unspecified';

  @override
  String get consentPageTitle => 'Consents';

  @override
  String get consentPageIntro =>
      'These consents decide what we collect and keep about your child\'s usage. You can change any of them at any time.';

  @override
  String get consentTypeDataCollectionLabel => 'Basic usage data collection';

  @override
  String get consentTypeDataCollectionDescription =>
      'Basic data needed to run the account, such as sign-in and content progress.';

  @override
  String get consentTypeAnalyticsLabel => 'Usage analytics';

  @override
  String get consentTypeAnalyticsDescription =>
      'Aggregated usage data that helps us improve the in-app experience.';

  @override
  String get consentTypeVoiceLabel => 'Voice recordings';

  @override
  String get consentTypeVoiceDescription =>
      'No feature in the app currently uses voice; this consent is prepared for any future voice-based feature.';

  @override
  String get consentTypePersonalizationLabel =>
      'Personalized content suggestions';

  @override
  String get consentTypePersonalizationDescription =>
      'Suggesting content based on the interests recorded on your child\'s profile.';

  @override
  String get consentTypeChildCreationsLabel =>
      'Storing the child\'s drawings in the cloud';

  @override
  String get consentTypeChildCreationsDescription =>
      'Storing your child\'s drawings in a space private to your family, in the cloud. Never published or shared with anyone else.';

  @override
  String get consentReasonNeverGranted =>
      'This consent has not been granted yet';

  @override
  String get consentReasonRevoked => 'This consent was withdrawn';

  @override
  String get consentReasonVersionSuperseded =>
      'This consent\'s policy changed, and a new consent is needed';

  @override
  String get consentStatusGranted => 'Granted';

  @override
  String get consentLoadErrorGeneric => 'Could not load the consent status';

  @override
  String get consentWriteErrorGeneric => 'Could not save the change. Try again';

  @override
  String get consentContinueButton => 'Continue';

  @override
  String get onboardingBasicControlsStepTitle => 'Basic controls';

  @override
  String get onboardingBasicControlsStepIntro =>
      'Set screen-time limits and permissions for your child\'s profile. You can change them later from the parent area.';

  @override
  String get onboardingContinueButton => 'Continue';

  @override
  String get onboardingFinishTitle => 'All set!';

  @override
  String get onboardingFinishBody =>
      'You created your child\'s profile and set the basic controls. You can start now, and change any setting later from the parent area.';

  @override
  String get onboardingFinishButton => 'Start now';
}
