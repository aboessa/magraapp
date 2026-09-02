/// The ordered steps of the first-run onboarding journey.
///
/// See Requirement 8.2 in
/// `.kiro/specs/app-foundation-family-journey/requirements.md`: a new
/// account with no completed child profile is walked through these steps in
/// this exact order before it can reach its normal destination.
///
/// Declaration order IS the intended sequence — [OnboardingController]
/// relies on `OnboardingStep.values` being in this order to compute the
/// "next" step.
enum OnboardingStep {
  /// Reviewing and granting/withdrawing the parental consents surfaced by
  /// `GET /family/consents` (Requirement 9, built by `ConsentPage`).
  consent,

  /// Setting the family's parent PIN for the first time (no PIN exists yet
  /// — this is the "setup", not the "unlock", flow; see `PinSetupPage`).
  pinSetup,

  /// Creating the first child profile (nickname, birth month/year, avatar).
  childProfile,

  /// Picking the child's interests and content language.
  interestsLanguage,

  /// Confirming the basic parental controls before the first session.
  basicControls,

  /// The closing step — reached right before the journey is marked
  /// complete and the persisted position is cleared.
  finish,
}
