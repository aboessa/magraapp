---
name: flutter-expert
description: "Use for Flutter and Dart architecture, implementation, performance, accessibility, testing, and multi-platform delivery; verify target SDK versions and platform constraints first."
license: MIT
compatibility: "Kiro; normal approval is required for dependencies, credentials, deployment, code signing, cloud changes, or authorized security testing."
metadata:
  provenance: "Adapted from davila7/claude-code-templates"
  source-commit: "20be4bacde02faf6e805f82e86270e894091a797"
  modified: "true"
---

# Flutter Expert

Use this skill to design and implement maintainable Flutter applications across mobile, tablet, desktop, web, and TV-like form factors.

## Start with constraints

Before changing code, establish:

- The installed Flutter and Dart versions from local tooling.
- Supported platforms, minimum OS versions, orientations, and screen classes.
- Input modes: touch, mouse, keyboard, remote/D-pad, and accessibility services.
- Offline, localization, authentication, media, and performance requirements.
- Existing architecture and package conventions. Preserve them unless a change has a clear benefit.

Do not infer TV from viewport width alone. Keep layout class, platform capability, and active input mode as separate concepts.

## Architecture

Prefer feature-oriented boundaries with explicit layers:

1. Presentation: widgets, routes, focus behavior, and view state.
2. Application: use cases and state orchestration.
3. Domain: stable models and business rules without Flutter dependencies.
4. Data: API DTOs, mappers, repositories, cache, and local fallbacks.

Keep wire-format DTOs separate from domain models. Parse untrusted API data defensively and preserve a useful local fallback when remote content is unavailable or unpublished.

Use dependency injection through the project's chosen state-management system. Avoid global mutable state, service locators hidden inside widgets, and business logic in `build` methods.

## Widgets and state

- Keep widgets focused and immutable where practical.
- Use `const` only where it is semantically correct.
- Represent loading, data, empty, stale, and error states deliberately.
- Scope rebuilds narrowly and profile before adding memoization or caching.
- Cancel or dispose controllers, subscriptions, timers, and focus nodes.
- Guard asynchronous UI updates after disposal.
- Use stable keys only when identity matters.

For Riverpod, model dependencies as providers, keep network/cache logic out of widgets, and use family/auto-dispose behavior intentionally rather than by default.

## Responsive and adaptive UI

- Base breakpoints on content needs, not named devices alone.
- Preserve readable line lengths, safe areas, and minimum interaction sizes.
- Use slivers or lazy builders for long collections.
- Treat TV as a dedicated interaction shell with deterministic focus traversal, visible focus, remote-friendly actions, and safe overscan margins.
- Respect text scaling and avoid fixed-height containers around text.
- Test portrait, landscape, split-screen, and large text where supported.

## Navigation

Use declarative routing when the project already supports it. Keep route data serializable, validate deep links, and make back behavior predictable on every platform. A TV shell may share destinations with mobile while using different navigation chrome and focus policy.

## Networking and media

- Set finite timeouts and map transport errors into typed failures.
- Do not log credentials, tokens, child identifiers, personal data, or signed media URLs.
- Never embed privileged server secrets in a Flutter binary.
- Validate schemes and hosts before opening external URLs.
- Handle image and media failure with local placeholders and accessible labels.
- Avoid autoplay unless the product explicitly requires it; respect reduced motion and data constraints.

## Performance

Measure in profile mode on representative hardware. Investigate frame timing, image decode size, list virtualization, shader work, allocation churn, and startup before optimizing. Do not claim a performance improvement from code inspection alone.

## Accessibility and localization

Provide semantics, logical reading order, visible focus, sufficient contrast, captions/transcripts where applicable, reduced-motion behavior, locale-aware formatting, and RTL-aware directional layout. Do not disable text scaling to make a layout fit.

## Validation

Choose checks appropriate to the change:

- `dart format` for changed Dart files.
- `flutter analyze` for static analysis.
- Targeted unit or widget tests for changed behavior.
- A non-watch build or smoke run for affected platforms when feasible.
- Manual keyboard/D-pad and screen-size checks for navigation changes.

Report the exact commands, outcomes, and anything not verified. Never equate a successful command with fulfillment of every product requirement.

## Safety

Verify package names, current APIs, and exact versions before adding dependencies. Obtain explicit approval before authentication, deployment, production data changes, code signing, store submission, cloud resource changes, or security testing outside a local authorized target.

## Attribution

Modified Kiro adaptation based on `flutter-expert` from `davila7/claude-code-templates` at commit `20be4bacde02faf6e805f82e86270e894091a797`. See `../LICENSE-MIT.txt`.
