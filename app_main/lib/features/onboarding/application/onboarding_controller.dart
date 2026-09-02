import 'dart:async' show unawaited;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../downloads/application/download_providers.dart' show sharedPreferencesProvider;
import '../domain/onboarding_step.dart';

/// The `SharedPreferences` key the current in-progress step is stored under
/// (Requirement 8.3 — position recovery).
///
/// Versioned (`_v1`) so a future change to how the step is encoded can pick
/// a new key instead of misreading an old value.
const String onboardingStepPrefsKey = 'onboarding_step_v1';

/// State of the onboarding journey **as far as this controller alone can
/// tell**.
///
/// [currentStep] is only meaningful while the journey is in progress. Both
/// "never started" and "already completed" resolve to the same default
/// (`OnboardingStep.consent`, [completed] == false) once no key is stored —
/// see the boundary note on [OnboardingController] for why this class does
/// not (and cannot) disambiguate the two on its own.
class OnboardingState {
  const OnboardingState({
    required this.currentStep,
    this.completed = false,
  });

  /// The step to resume at, restored from `SharedPreferences` at
  /// construction time.
  final OnboardingStep currentStep;

  /// True once [OnboardingController.complete] has run for this journey.
  ///
  /// Only becomes true within the lifetime of the controller instance that
  /// called it — a brand new controller created afterwards (e.g. after an
  /// app restart) has no stored key to read `completed` back from, and
  /// legitimately has no way to distinguish that case from "never started".
  /// See the class-level boundary note on [OnboardingController].
  final bool completed;
}

/// Persists and restores which step of the first-run onboarding journey the
/// current family is on (Requirements 8.2, 8.3).
///
/// ## Scope boundary — what this controller does NOT decide
///
/// This controller only remembers a **step position** under
/// [onboardingStepPrefsKey]. It has no knowledge of whether a child profile
/// already carries `onboardingCompletedAt` (that signal lives in
/// `ChildState`, see `features/child/application/child_provider.dart`) and
/// therefore cannot decide, by itself, whether the onboarding flow should be
/// shown *at all* for the current account. That routing decision — "does
/// this family need onboarding, or does it go straight to its normal
/// destination" (Requirement 8.1, 8.5) — belongs to whatever screen hosts
/// the flow (`OnboardingFlowPage`, a later task), which reads both this
/// controller's [OnboardingState.currentStep] *and* the family's child list.
///
/// Concretely: after [complete] runs, the stored key is removed, so a fresh
/// [OnboardingController] instance restores to `OnboardingStep.consent` with
/// `completed: false` — identical to a family that never started the
/// journey. That ambiguity is intentional and acceptable, because the
/// consumer's "should I show onboarding" check is expected to be driven by
/// `onboardingCompletedAt`, not by asking this controller.
class OnboardingController extends StateNotifier<OnboardingState> {
  OnboardingController(this._preferences)
    : super(OnboardingState(currentStep: _restoreStep(_preferences)));

  final SharedPreferences _preferences;

  static OnboardingStep _restoreStep(SharedPreferences preferences) {
    final stored = preferences.getString(onboardingStepPrefsKey);
    return OnboardingStep.values.firstWhere(
      (step) => step.name == stored,
      orElse: () => OnboardingStep.consent,
    );
  }

  /// Moves to [step] and persists it immediately, so the position survives
  /// the app being closed mid-journey (Requirement 8.3).
  ///
  /// Stores the enum's `.name` (e.g. `'pinSetup'`), never `.index` — an
  /// index would silently point at the wrong step if a step is ever
  /// inserted into [OnboardingStep] later.
  void goToStep(OnboardingStep step) {
    state = OnboardingState(currentStep: step, completed: state.completed);
    unawaited(_preferences.setString(onboardingStepPrefsKey, step.name));
  }

  /// Moves to the step declared right after [OnboardingState.currentStep]
  /// in [OnboardingStep.values]. A no-op if already on the last step
  /// (`finish`) — callers finishing the journey should call [complete]
  /// instead.
  void advance() {
    final values = OnboardingStep.values;
    final nextIndex = values.indexOf(state.currentStep) + 1;
    if (nextIndex >= values.length) return;
    goToStep(values[nextIndex]);
  }

  /// Marks the journey as finished and clears the persisted position
  /// entirely (not merely setting it to `finish`), so a later launch finds
  /// no key at all — the "in-progress vs done" distinction the hosting
  /// screen relies on together with `onboardingCompletedAt`.
  Future<void> complete() async {
    state = OnboardingState(currentStep: state.currentStep, completed: true);
    await _preferences.remove(onboardingStepPrefsKey);
  }
}

final onboardingControllerProvider =
    StateNotifierProvider<OnboardingController, OnboardingState>(
      (ref) => OnboardingController(ref.watch(sharedPreferencesProvider)),
    );
