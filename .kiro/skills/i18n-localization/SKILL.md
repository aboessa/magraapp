---
name: i18n-localization
description: "Use for internationalization and localization architecture, translation catalogs, locale-aware formatting and pluralization, fallback behavior, and bidirectional or RTL interfaces."
license: MIT
compatibility: "Kiro; no heuristic checker is bundled, and automated string scans must not be presented as proof of translation completeness."
metadata:
  provenance: "Adapted from davila7/claude-code-templates"
  source-commit: "20be4bacde02faf6e805f82e86270e894091a797"
  modified: "true"
---

# Internationalization and Localization

Use this skill to design localization into models and UI rather than replacing strings after implementation.

## Establish requirements

Confirm supported locales, default and fallback locale, translation ownership, content source, plural rules, number/date/calendar requirements, RTL behavior, font coverage, and whether locale follows system or profile settings.

Separate application chrome translations from editorial/API content. Define what happens when either is missing.

## Message design

- Use stable semantic keys, not English sentences as identifiers.
- Keep user-facing messages in catalogs; internal identifiers and diagnostics need different treatment.
- Use named placeholders with translator context.
- Use locale plural/select rules rather than string concatenation.
- Keep markup and interpolation constrained and safe.
- Preserve placeholders and required whitespace intentionally.
- Detect missing, extra, empty, and malformed messages during validation.

Do not assume one base locale from filesystem order. Configure it explicitly.

## Formatting

Use locale-aware libraries for numbers, compact values, currency, percentages, dates, times, durations, and relative time. Store canonical data, then format for display. Do not parse localized display strings as durable storage values.

## RTL and bidirectionality

Arabic support requires more than mirroring the screen:

- Use directional `start`/`end` layout properties where direction is semantic.
- Mirror directional navigation icons; do not mirror universal media symbols or brand marks automatically.
- Validate mixed Arabic, Latin, numbers, punctuation, and URLs.
- Keep focus traversal and reading order logical in RTL.
- Test clipping and baseline behavior with the actual Arabic font.
- Localize alignment without reversing chronological or media semantics incorrectly.

## Flutter guidance

Use Flutter localization generation and `intl` when they fit the project. Keep locale state above routed content, declare supported locales, and provide delegates intentionally. Avoid resolving translated strings in repositories or domain models that should remain locale-neutral.

Prefer widgets and padding that respect `Directionality`. Test `TextScaler`, Arabic glyph coverage, line height, and fallback fonts on each target. Do not bundle a font whose redistribution license has not been verified.

## Remote content

Treat API locale fields as untrusted data. Define fallback order explicitly, preserve content IDs across translations, and distinguish “not translated” from “not published.” A missing translation must not accidentally expose draft content from another locale.

## Validation

Check:

1. Every configured locale parses successfully.
2. Required keys and placeholders match the base contract.
3. Plural/select cases cover locale rules.
4. Missing and fallback behavior is visible and intentional.
5. Arabic and mixed-direction text render correctly at large scale.
6. Dates, times, numbers, and durations match locale expectations.
7. Screen-reader order and D-pad traversal remain logical in RTL.

Regex-only hardcoded-string scans are heuristic and cannot prove completeness. Report their scope and exclusions if used.

## Attribution

Modified Kiro adaptation based on `i18n-localization` from `davila7/claude-code-templates` at commit `20be4bacde02faf6e805f82e86270e894091a797`. The upstream heuristic script was intentionally omitted after review. See `../LICENSE-MIT.txt`.
