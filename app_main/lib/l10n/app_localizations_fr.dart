// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

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
  String get creativeStudioTitle => 'Studio Créatif';

  @override
  String get myBoards => 'Mes Tableaux';

  @override
  String get drawLikeThis => 'Dessine comme ça';

  @override
  String get coloring => 'Coloriage';

  @override
  String get tracing => 'Tracé';

  @override
  String get connectDots => 'Relie les points';

  @override
  String get completeDrawing => 'Complète le dessin';

  @override
  String get copyPattern => 'Copie le motif';

  @override
  String get drawFromPrompt => 'Dessine d\'après l\'idée';

  @override
  String get newBoard => 'Nouveau tableau';

  @override
  String get newBlankBoard => 'Tableau vierge';

  @override
  String get continueDrawing => 'Continuer le dessin';

  @override
  String get startDrawing => 'Commencer à dessiner';

  @override
  String get chooseBoardType => 'Choisir le type';

  @override
  String get portrait => 'Portrait';

  @override
  String get landscape => 'Paysage';

  @override
  String get square => 'Carré';

  @override
  String get backgroundBlank => 'Vierge';

  @override
  String get backgroundSpace => 'Espace';

  @override
  String get backgroundUnderwater => 'Sous l\'eau';

  @override
  String get backgroundGarden => 'Jardin';

  @override
  String get backgroundSky => 'Ciel';

  @override
  String get backgroundRoom => 'Chambre';

  @override
  String get backgroundGrid => 'Grille';

  @override
  String get brush => 'Pinceau';

  @override
  String get color => 'Couleur';

  @override
  String get brushSize => 'Taille du pinceau';

  @override
  String get eraser => 'Gomme';

  @override
  String get undo => 'Annuler';

  @override
  String get redo => 'Rétablir';

  @override
  String get clear => 'Effacer';

  @override
  String get clearConfirmTitle => 'Effacer le tableau ?';

  @override
  String get clearConfirmBody =>
      'Cela effacera le dessin. Vous pouvez annuler juste après.';

  @override
  String get save => 'Enregistrer';

  @override
  String get saved => 'Enregistré';

  @override
  String get saving => 'Enregistrement…';

  @override
  String get unsaved => 'Non enregistré';

  @override
  String get saveAndExit => 'Enregistrer et quitter';

  @override
  String get discard => 'Ignorer';

  @override
  String get continueDrawingAction => 'Continuer';

  @override
  String get referenceShow => 'Afficher l\'exemple';

  @override
  String get referenceHide => 'Masquer l\'exemple';

  @override
  String get referenceEnlarge => 'Agrandir l\'exemple';

  @override
  String get ghostMode => 'Fond fantôme';

  @override
  String get ghostOpacity => 'Opacité du fond';

  @override
  String get compareDrawings => 'Comparer les dessins';

  @override
  String stepOf(Object current, Object total) {
    return 'Étape $current sur $total';
  }

  @override
  String get next => 'Suivant';

  @override
  String get previous => 'Précédent';

  @override
  String get tryToDraw => 'Essaie de le dessiner';

  @override
  String get awesomeWeSaved => 'Bravo ! Nous avons enregistré ton dessin.';

  @override
  String get chooseColor => 'Choisis une couleur';

  @override
  String get colorThePicture => 'Colorie l\'image';

  @override
  String get connectTheDots => 'Relie les points dans l\'ordre';

  @override
  String get drawAsYouLike => 'Dessine comme tu veux';

  @override
  String get tapDoneWhenFinished => 'Appuie sur Terminé quand tu as fini';

  @override
  String get startHere => 'Commence ici';

  @override
  String get traceLine => 'Trace la ligne';

  @override
  String get wellDone => 'Bien joué';

  @override
  String get tryAgain => 'Essaie encore';

  @override
  String get categoryAnimals => 'Animaux';

  @override
  String get categorySpace => 'Espace';

  @override
  String get categoryNature => 'Nature';

  @override
  String get categoryVehicles => 'Véhicules';

  @override
  String get categoryHome => 'Maison';

  @override
  String get categoryPatterns => 'Motifs';

  @override
  String get difficultyEasy => 'Facile';

  @override
  String get difficultyMedium => 'Moyen';

  @override
  String get difficultyDetailed => 'Détaillé';

  @override
  String get age45 => '4–5';

  @override
  String get age67 => '6–7';

  @override
  String get age89 => '8–9';

  @override
  String boardTitleDefault(Object number) {
    return 'Mon tableau $number';
  }

  @override
  String get boardOrientationPortrait => 'Portrait';

  @override
  String get boardOrientationLandscape => 'Paysage';

  @override
  String get boardOrientationSquare => 'Carré';

  @override
  String referenceBadge(Object title) {
    return 'De : $title';
  }
}
