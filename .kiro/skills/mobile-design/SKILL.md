---
name: mobile-design
description: "Use for touch-first and platform-aware mobile UX across iOS, Android, Flutter, React Native, SwiftUI, and Kotlin; establish devices, input, accessibility, and offline constraints first."
license: MIT
compatibility: "Kiro; no audit script is bundled or auto-executed, and heuristic checks must not be treated as compliance evidence."
metadata:
  provenance: "Adapted from davila7/claude-code-templates"
  source-commit: "20be4bacde02faf6e805f82e86270e894091a797"
  modified: "true"
---

# Mobile Design

Use this skill for product and implementation decisions that make an interface feel native, usable, and resilient rather than merely scaled to a phone viewport.

## Discovery

Confirm before designing:

- Audience, age range, core tasks, and expected session length.
- Supported phones, tablets, orientations, and TV targets.
- Touch, keyboard, pointer, remote/D-pad, and assistive input needs.
- Connectivity and offline expectations.
- Content density, localization, RTL, text scaling, and reduced motion.
- Existing design tokens and platform conventions.

Ask only questions that materially change the implementation. When information is unavailable, state a reversible assumption.

## Interaction principles

- Make primary actions reachable and visually dominant.
- Give interactive controls a generous hit region without relying on tiny icons.
- Provide pressed, selected, focused, disabled, loading, and error states.
- Never make gesture-only behavior the sole way to complete a task.
- Preserve user work through interruption, rotation, backgrounding, and recoverable failures.
- Use haptics sparingly and only where supported and appropriate.
- Avoid surprise autoplay, flashing, and motion that ignores user preferences.

Minimum dimensions are guidance, not a substitute for testing with real users and accessibility settings.

## Layout

Build from content constraints:

- Use safe areas and account for system bars, cutouts, hinges, and keyboards.
- Let typography scale; avoid fixed heights around labels.
- Constrain line length on tablets instead of stretching phone layouts.
- Recompose navigation and content hierarchy at meaningful breakpoints.
- Keep directional properties RTL-aware (`start`/`end`) unless a physical direction is intentional.
- Reserve TV overscan-safe margins and larger spatial rhythm in a dedicated TV shell.

Do not identify a platform or TV device from width alone. Layout class, platform capability, and current input mode must be independently represented.

## Navigation and continuity

Use a small, stable top-level information architecture. Preserve state when switching destinations where users expect continuity. Back must dismiss transient UI before leaving the current context, and deep links must land in a valid, recoverable state.

For TV, define initial focus, traversal order, focus restoration after dialogs/routes, and a clearly visible focused state. Ensure every action is possible with directional input plus select/back.

## Visual system

Use semantic color and typography tokens rather than scattered literals. Validate contrast in normal, focused, selected, disabled, and image-overlay states. Dark cinematic surfaces still need readable text and distinct focus rings.

Images should declare aspect ratio, reserve layout space, use suitable decode sizes, and have meaningful fallbacks. Decorative imagery should not obscure labels or become required to understand navigation.

## Perceived performance

- Show stable skeletons or placeholders only when they reduce uncertainty.
- Prefer lazy collections for long feeds.
- Keep animations purposeful, interruptible, and short enough for repeated navigation.
- Cache deliberately with freshness and storage limits.
- Design explicit empty, offline, stale, partial, and retry states.

Profile before prescribing framework-specific optimizations. Rules such as unconditional memoization, fixed item extents, or native-driver animation are not universal.

## Review checklist

1. Can the core task be completed with touch and without gestures?
2. Does large text remain readable without clipping?
3. Are focus and selection distinct on keyboard/remote?
4. Is RTL order correct, including icons with directional meaning?
5. Are loading, empty, offline, and error states actionable?
6. Does the tablet layout improve composition rather than merely enlarge it?
7. Does the TV experience work from a typical viewing distance?
8. Is sensitive information absent from logs, screenshots, and client-side secrets?
9. Was behavior checked on representative viewport and input combinations?

## Tooling safety

Do not run downloaded audit scripts without reading them first. Project lint or test scripts are executable code; inspect their definitions and run only safe, relevant, non-watch commands. Do not install global or unpinned tooling merely to produce a design score.

## Attribution

Modified Kiro adaptation based on `mobile-design` from `davila7/claude-code-templates` at commit `20be4bacde02faf6e805f82e86270e894091a797`. The upstream heuristic script was intentionally omitted after review. See `../LICENSE-MIT.txt`.
