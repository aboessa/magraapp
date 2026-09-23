import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/router/auth_guard.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../child/presentation/pages/child_profile_form_page.dart';
import '../../../child/application/family_children_provider.dart';
import '../../../parent/presentation/pages/parent_dashboard_page.dart';
import '../../application/onboarding_controller.dart';
import '../../domain/onboarding_step.dart';
import 'consent_page.dart';
import '../../../auth/presentation/pages/pin_setup_page.dart';

/// Hosts the first-run onboarding journey (Requirement 8, Component 8 in
/// `design.md`): consent → PIN setup → child profile → basic controls →
/// finish, in that exact order, and reads/writes [OnboardingController] to
/// persist and restore the current step across an app restart
/// (Requirement 8.3).
///
/// ## Why `OnboardingStep.interestsLanguage` renders no page here
///
/// [OnboardingStep] has six values, but this page only hosts widgets for
/// four of them. `ChildProfileFormPage` (task 21) already collects both
/// interests and language as part of its own single form — building a
/// second, separate `interestsLanguage` screen to confirm what the
/// previous screen just collected would be a redundant extra step the task
/// text never actually asked for (it only asked to host `ConsentPage`,
/// `PinSetupPage`, `ChildProfileFormPage`, a basic-controls step, and a
/// start step). `advance()` from `childProfile` is therefore driven
/// directly to `basicControls` by this page, skipping over the unused
/// `interestsLanguage` value in the rendered sequence while leaving it in
/// the enum for any future flow that might want a dedicated screen for it.
///
/// ## Basic controls step
///
/// Reuses [ParentalControlsSection] verbatim (made public in task 32,
/// previously `_ParentalControlsSection` private to
/// `parent_dashboard_page.dart`) rather than building a second, divergent
/// minimal widget — the parent sees exactly the same controls surface here
/// and later in the dashboard, with one implementation to maintain.
///
/// ## Second child onward never reaches this page
///
/// `_guardRedirect` (`app_router.dart`) only routes to `/onboarding` when
/// `AuthGuard.hasCompletedOnboarding == false`. Once any child in the
/// family carries `onboarding_completed_at`, a second/third child is always
/// created through `ChildProfileFormPage` opened alone from
/// `ChildSwitcherPage` — this page is never shown again (Requirement 8.6).
class OnboardingFlowPage extends ConsumerWidget {
  const OnboardingFlowPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final onboarding = ref.watch(onboardingControllerProvider);
    final controller = ref.read(onboardingControllerProvider.notifier);

    switch (onboarding.currentStep) {
      case OnboardingStep.consent:
        return ConsentPage(onContinue: controller.advance);
      case OnboardingStep.pinSetup:
        return PinSetupPage(onComplete: controller.advance);
      case OnboardingStep.childProfile:
      case OnboardingStep.interestsLanguage:
        // `interestsLanguage` is never landed on directly (see class doc);
        // this case only exists so the switch stays exhaustive if a future
        // change ever routes here directly.
        return ChildProfileFormPage(
          isFirstChildInOnboarding: true,
          onCreated: () => controller.goToStep(OnboardingStep.basicControls),
        );
      case OnboardingStep.basicControls:
        return _BasicControlsStep(onContinue: controller.advance);
      case OnboardingStep.finish:
        return const _FinishStep();
    }
  }
}

/// Basic-controls step: the child profile created in the previous step
/// always has an id available by the time this step renders, because
/// [OnboardingFlowPage] only advances here after `ChildProfileFormPage`'s
/// `onCreated` callback fires.
///
/// Reads the newly created child's id from `familyChildrenProvider` rather
/// than threading it through constructor parameters across steps — the
/// freshly invalidated provider (`ChildProfileFormPage._submit` calls
/// `ref.invalidate(familyChildrenProvider)` before firing `onCreated`)
/// already has exactly one child for a first-run family at this point.
class _BasicControlsStep extends ConsumerWidget {
  const _BasicControlsStep({required this.onContinue});

  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final children = ref.watch(familyChildrenProvider);

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: children.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: AppColors.starGold),
            ),
            error: (_, __) => Center(
              child: TextButton(
                onPressed: () => ref.invalidate(familyChildrenProvider),
                child: Text(
                  l10n.retry,
                  style: const TextStyle(color: AppColors.starGold),
                ),
              ),
            ),
            data: (items) {
              final childId = items.isEmpty ? null : items.last.id;
              return Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                    children: [
                      Text(
                        l10n.onboardingBasicControlsStepTitle,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        l10n.onboardingBasicControlsStepIntro,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.mutedText,
                          fontSize: 12.5,
                          height: 1.6,
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (childId != null) ParentalControlsSection(childId: childId),
                      const SizedBox(height: 20),
                      FilledButton(
                        onPressed: onContinue,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.starGold,
                          foregroundColor: AppColors.deepSpace,
                          minimumSize: const Size.fromHeight(52),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: Text(
                          l10n.onboardingContinueButton,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// Closing step (Requirement 8.5): marks the journey complete and lands on
/// the app's normal destination — `/` — the same destination a returning,
/// fully-onboarded family reaches directly without ever seeing this flow.
class _FinishStep extends ConsumerWidget {
  const _FinishStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.celebration_rounded,
                    color: AppColors.starGold,
                    size: 56,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    l10n.onboardingFinishTitle,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 20,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    l10n.onboardingFinishBody,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.mutedText,
                      fontSize: 13,
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () async {
                        await ref.read(onboardingControllerProvider.notifier).complete();
                        ref
                            .read(authGuardProvider)
                            .setOnboardingJourneyInProgress(false);
                        if (context.mounted) context.go('/');
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.starGold,
                        foregroundColor: AppColors.deepSpace,
                        minimumSize: const Size.fromHeight(52),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(
                        l10n.onboardingFinishButton,
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
