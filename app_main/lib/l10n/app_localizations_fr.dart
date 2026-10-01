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

  @override
  String get childFormCreateTitle => 'Nouveau profil enfant';

  @override
  String get childFormEditTitle => 'Modifier le profil de l\'enfant';

  @override
  String get childFormCreateSubtitle =>
      'Choisis un personnage de l\'univers Majarra';

  @override
  String get childFormEditSubtitle =>
      'Modifie les informations et les centres d\'intérêt du profil';

  @override
  String get childFormNicknameLabel => 'Nom de l\'enfant';

  @override
  String get childFormNicknameHint => 'ex. : Layla';

  @override
  String get childFormNicknameEmptyError => 'Saisis un nom pour le profil';

  @override
  String get childFormBirthMonthLabel => 'Mois de naissance';

  @override
  String get childFormBirthYearLabel => 'Année de naissance';

  @override
  String get childFormBirthDateReadOnlyLabel => 'Date de naissance';

  @override
  String get childFormBirthDateEditNotice =>
      'Le changement de date de naissance est géré plus tard via le parcours de transition d\'âge, pas depuis cet écran';

  @override
  String get childFormAvatarSectionTitle =>
      'Choisis un personnage de l\'univers Majarra';

  @override
  String childFormAvatarCount(int count) {
    return '$count personnages';
  }

  @override
  String get childFormAvatarSectionSubtitle =>
      'Les mêmes personnages de dessin animé des séries';

  @override
  String get childFormInterestsTitle => 'Centres d\'intérêt';

  @override
  String get childFormInterestsSubtitle =>
      'Choisis ce que ton enfant aime, tu peux en choisir plusieurs';

  @override
  String get childFormLanguageReadOnlyNotice =>
      'Une seule langue est disponible aujourd\'hui ; la liste s\'élargira quand d\'autres traductions seront complètes';

  @override
  String get childFormSaveButtonCreate => 'Créer le profil';

  @override
  String get childFormSaveButtonEdit => 'Enregistrer les modifications';

  @override
  String get childFormCreateErrorGeneric =>
      'Impossible de créer le profil. Vérifie la limite de ton abonnement (4 enfants)';

  @override
  String get childFormEditErrorGeneric =>
      'Impossible d\'enregistrer les modifications';

  @override
  String get interestAbjad => 'Lettres';

  @override
  String get interestArqam => 'Chiffres';

  @override
  String get interestOloom => 'Sciences';

  @override
  String get interestQiyam => 'Valeurs';

  @override
  String get interestQisas => 'Histoires';

  @override
  String get interestMaharat => 'Compétences';

  @override
  String get interestTarikh => 'Histoire';

  @override
  String get interestAlam => 'Notre monde';

  @override
  String get interestIman => 'Foi';

  @override
  String get ageTransitionReviewTitle => 'Révision de la transition d\'âge';

  @override
  String get ageTransitionLoadErrorGeneric =>
      'Impossible de charger l\'état de la transition d\'âge';

  @override
  String get ageTransitionNoChangeTitle => 'Aucun changement pour le moment';

  @override
  String get ageTransitionNoChangeBody =>
      'Le parcours actuel de l\'enfant correspond toujours à son âge calculé. Aucune action n\'est nécessaire pour l\'instant.';

  @override
  String get ageTransitionCurrentTrackLabel => 'Parcours actuel';

  @override
  String get ageTransitionComputedTrackLabel => 'Parcours suggéré';

  @override
  String ageTransitionChangeDescription(String from, String to) {
    return 'Le profil passera du parcours $from au parcours $to. Le contenu affiché s\'adaptera automatiquement au nouveau parcours $to.';
  }

  @override
  String get ageTransitionAcceptButton => 'Confirmer la transition';

  @override
  String get ageTransitionDeferButton => 'Reporter';

  @override
  String ageTransitionAcceptSuccessBody(String track) {
    return 'Le profil a été déplacé vers le parcours $track avec succès.';
  }

  @override
  String ageTransitionDeferSuccessBody(String date) {
    return 'La transition a été reportée jusqu\'au $date.';
  }

  @override
  String ageTransitionDeferAlreadyActiveBody(String date) {
    return 'Un report est déjà actif jusqu\'au $date.';
  }

  @override
  String get ageTransitionErrorGeneric =>
      'Impossible d\'effectuer l\'action. Réessaie';

  @override
  String get ageTrackLabelPreschool => 'Bourgeons';

  @override
  String get ageTrackLabelKids => 'Explorateurs';

  @override
  String get ageTrackLabelJunior => 'Pionniers';

  @override
  String get ageTrackLabelUnknown => 'Non spécifié';

  @override
  String get consentPageTitle => 'Consentements';

  @override
  String get consentPageIntro =>
      'Ces consentements déterminent ce que nous collectons et conservons sur l\'utilisation de votre enfant. Vous pouvez les modifier à tout moment.';

  @override
  String get consentTypeDataCollectionLabel =>
      'Collecte des données d\'utilisation de base';

  @override
  String get consentTypeDataCollectionDescription =>
      'Données de base nécessaires au fonctionnement du compte, comme la connexion et la progression du contenu.';

  @override
  String get consentTypeAnalyticsLabel => 'Analyses d\'utilisation';

  @override
  String get consentTypeAnalyticsDescription =>
      'Données d\'utilisation agrégées qui nous aident à améliorer l\'expérience dans l\'application.';

  @override
  String get consentTypeVoiceLabel => 'Enregistrements vocaux';

  @override
  String get consentTypeVoiceDescription =>
      'Aucune fonctionnalité de l\'application n\'utilise actuellement la voix ; ce consentement est préparé pour une future fonctionnalité vocale.';

  @override
  String get consentTypePersonalizationLabel =>
      'Personnalisation du contenu suggéré';

  @override
  String get consentTypePersonalizationDescription =>
      'Suggestion de contenu basée sur les centres d\'intérêt enregistrés sur le profil de votre enfant.';

  @override
  String get consentTypeChildCreationsLabel =>
      'Enregistrement des dessins de l\'enfant dans le cloud';

  @override
  String get consentTypeChildCreationsDescription =>
      'Enregistrement des dessins de votre enfant dans un espace privé de votre famille, dans le cloud. Jamais publiés ni partagés avec qui que ce soit d\'autre.';

  @override
  String get consentReasonNeverGranted =>
      'Ce consentement n\'a pas encore été accordé';

  @override
  String get consentReasonRevoked => 'Ce consentement a été retiré';

  @override
  String get consentReasonVersionSuperseded =>
      'La politique de ce consentement a changé, un nouveau consentement est nécessaire';

  @override
  String get consentStatusGranted => 'Accordé';

  @override
  String get consentLoadErrorGeneric =>
      'Impossible de charger l\'état des consentements';

  @override
  String get consentWriteErrorGeneric =>
      'Impossible d\'enregistrer la modification. Réessaie';

  @override
  String get consentWriteRequiresParentPin =>
      'Cette modification est un registre parental, et votre famille a déjà un code. Saisissez-le, puis réessayez.';

  @override
  String get consentUnlockAction => 'Saisir le code parental';

  @override
  String get consentContinueButton => 'Continuer';

  @override
  String get onboardingBasicControlsStepTitle => 'Contrôles de base';

  @override
  String get onboardingBasicControlsStepIntro =>
      'Définissez les limites de temps d\'écran et les autorisations pour le profil de votre enfant. Vous pourrez les modifier plus tard depuis l\'espace parent.';

  @override
  String get onboardingContinueButton => 'Continuer';

  @override
  String get onboardingFinishTitle => 'Tout est prêt !';

  @override
  String get onboardingFinishBody =>
      'Vous avez créé le profil de votre enfant et défini les contrôles de base. Vous pouvez commencer maintenant, et modifier tout paramètre plus tard depuis l\'espace parent.';

  @override
  String get onboardingFinishButton => 'Commencer';

  @override
  String get studioBannerDrawLikeMeLabel => 'Dessine comme moi';

  @override
  String get studioBannerConnectDotsLabel => 'Relie les points';

  @override
  String get studioBannerColoringLabel => 'Colorie';

  @override
  String get studioBannerCreativeStudioLabel => 'Studio créatif';

  @override
  String get googlePlayUnavailableOnDevice =>
      'Google Play n\'est pas disponible sur cet appareil.';

  @override
  String get parentDailyLimitTitle => 'Limite quotidienne de temps d\'écran';

  @override
  String get parentDailyLimitOff =>
      'Désactivée — aucune limite de temps d\'écran';

  @override
  String parentDailyLimitOn(int minutes) {
    return 'Activée : $minutes minutes par jour';
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
