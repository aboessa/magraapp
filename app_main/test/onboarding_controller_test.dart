import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/onboarding/application/onboarding_controller.dart';
import 'package:majarra/features/onboarding/domain/onboarding_step.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('a fresh controller with no stored preference defaults to consent', () async {
    final preferences = await SharedPreferences.getInstance();
    final controller = OnboardingController(preferences);

    expect(controller.state.currentStep, OnboardingStep.consent);
    expect(controller.state.completed, isFalse);
  });

  test('goToStep updates state and persists the position for recovery', () async {
    final preferences = await SharedPreferences.getInstance();
    final controller = OnboardingController(preferences);

    controller.goToStep(OnboardingStep.childProfile);
    expect(controller.state.currentStep, OnboardingStep.childProfile);

    // Position recovery (Requirement 8.3): a second controller built against
    // the same SharedPreferences instance must resume at the persisted step
    // rather than restarting from `consent`.
    final resumed = OnboardingController(preferences);
    expect(resumed.state.currentStep, OnboardingStep.childProfile);
  });

  test('advance moves to the next step in declaration order and persists it', () async {
    final preferences = await SharedPreferences.getInstance();
    final controller = OnboardingController(preferences);

    controller.advance(); // consent -> pinSetup
    expect(controller.state.currentStep, OnboardingStep.pinSetup);

    final resumed = OnboardingController(preferences);
    expect(resumed.state.currentStep, OnboardingStep.pinSetup);
  });

  test('advance is a no-op on the last step', () async {
    final preferences = await SharedPreferences.getInstance();
    final controller = OnboardingController(preferences)
      ..goToStep(OnboardingStep.finish);

    controller.advance();
    expect(controller.state.currentStep, OnboardingStep.finish);
  });

  test('complete marks the state completed and clears the stored key entirely', () async {
    final preferences = await SharedPreferences.getInstance();
    final controller = OnboardingController(preferences)
      ..goToStep(OnboardingStep.finish);

    await controller.complete();

    expect(controller.state.completed, isTrue);
    // Not merely set to some sentinel value — the key must be genuinely
    // absent so a later launch has no stored step at all.
    expect(preferences.containsKey(onboardingStepPrefsKey), isFalse);
    expect(preferences.getString(onboardingStepPrefsKey), isNull);

    // A fresh read (simulating the next app launch) sees no key either.
    final freshRead = await SharedPreferences.getInstance();
    expect(freshRead.containsKey(onboardingStepPrefsKey), isFalse);
  });
}
