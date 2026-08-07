---
name: accessibility
description: "Use to audit and improve semantics, keyboard and screen-reader behavior, focus, contrast, motion, forms, media, and WCAG conformance; confirm the applicable standard and platform."
license: MIT
compatibility: "Kiro; prefer existing pinned tools and obtain approval before installing scanners or testing network or authenticated targets."
metadata:
  original-author: "web-quality-skills"
  original-version: "1.0"
  provenance: "Adapted from davila7/claude-code-templates"
  source-commit: "20be4bacde02faf6e805f82e86270e894091a797"
  modified: "true"
---

# Accessibility

Use this skill to make accessibility part of architecture, implementation, and validation rather than a final visual audit.

## Establish scope

Confirm the platform, assistive technologies, input methods, audience, content type, and required WCAG version or jurisdiction. WCAG guidance is not legal advice. When no requirement is specified, use WCAG 2.2 AA as a practical review baseline while respecting platform conventions.

## Core review

### Perceivable

- Provide text alternatives for meaningful images; mark decorative imagery accordingly.
- Supply captions and, where appropriate, transcripts or audio description for media.
- Ensure text and essential UI states retain sufficient contrast over solid and image backgrounds.
- Do not encode status or meaning by color alone.
- Support text scaling, zoom, reflow, and orientation without clipping essential content.

### Operable

- Make every action available through keyboard or remote where those inputs are supported.
- Use logical focus order, visible focus, predictable traversal, and focus restoration.
- Avoid keyboard traps. Modal surfaces must contain focus while open and restore it on close.
- Provide alternatives to complex gestures and enough target spacing for touch.
- Respect reduced-motion settings and avoid flashing content.
- Give users control over autoplay and time limits.

### Understandable

- Use clear labels, instructions, validation, and recovery guidance.
- Keep navigation and control behavior consistent.
- Identify language and direction correctly.
- Preserve user input after validation errors when safe.

### Robust

- Prefer native semantic controls before recreating behavior.
- Expose role, name, value, state, and relationships to assistive technology.
- Announce important dynamic changes without overwhelming users.
- Ensure custom widgets implement expected actions and focus behavior.

## Flutter guidance

- Use `Semantics`, `MergeSemantics`, and `ExcludeSemantics` intentionally.
- Add semantic labels only when visible text is insufficient; avoid duplicate announcements.
- Use `Focus`, `FocusTraversalGroup`, shortcuts, and actions for non-touch navigation.
- Keep tap targets generous and separate visual size from hit-test size where needed.
- Respect `MediaQuery.disableAnimationsOf`, accessible navigation settings, and text scaling.
- Do not hide content from semantics merely to silence a test.

## Children and media products

Use concrete language, forgiving interactions, persistent orientation cues, clear parental boundaries, and non-punitive errors. Avoid manipulative urgency. Ensure focus indicators and labels are understandable from TV viewing distance. Media controls need names, state, elapsed/remaining context when useful, captions, and remote-friendly operation.

## Validation

Combine methods:

1. Static and framework checks.
2. Keyboard/D-pad traversal.
3. Screen reader smoke testing on target platforms.
4. Large text, RTL, reduced motion, and high-contrast checks.
5. Contrast measurement for actual rendered colors and overlays.
6. User testing where risk and audience justify it.

Automated scanners find only a subset of barriers. Record tested platforms, settings, results, and remaining limitations.

## Tool safety

Do not install global or unpinned audit packages automatically. Before scanning a URL, confirm authorization and whether it contains private content, cookies, or user data. Prefer local or project-pinned tooling.

## Attribution

Modified Kiro adaptation based on `accessibility` from `davila7/claude-code-templates` at commit `20be4bacde02faf6e805f82e86270e894091a797`, preserving upstream author metadata. See `../LICENSE-MIT.txt`.
