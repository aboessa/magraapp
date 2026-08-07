---
name: verification-before-completion
description: "Use before completion or correctness claims to obtain fresh relevant evidence, inspect complete results, and report failures, unverified areas, and validation limits."
license: MIT
compatibility: "Kiro; choose safe scoped validation and avoid destructive reverts, arbitrary scripts, coercive language, or turn-specific evidence rules."
metadata:
  provenance: "Adapted from davila7/claude-code-templates"
  source-commit: "20be4bacde02faf6e805f82e86270e894091a797"
  modified: "true"
---

# Verification Before Completion

A completion claim is a factual statement. Support it with fresh, relevant evidence from the current task and distinguish implementation from verification.

## Evidence loop

Before saying work is complete:

1. Re-read the user's concrete success criteria.
2. Inspect the actual changed files or resulting artifact.
3. Select the smallest commands or manual checks that directly exercise the change.
4. Confirm the commands are safe, non-interactive, and scoped appropriately.
5. Run them and inspect the full result, including exit status and skipped work.
6. Fix relevant failures and repeat the affected check.
7. Report exact evidence and clearly name anything not verified.

A zero exit code proves only what that command checked. Static analysis does not prove runtime UX; a build does not prove API authorization; a screenshot does not prove focus traversal.

## Match claim to evidence

- Formatting claim: formatter check for changed files.
- Type/static correctness: analyzer or type checker covering affected code.
- Behavior fix: targeted test or reproducible before/after scenario.
- Build claim: build command for the named target and configuration.
- Accessibility claim: semantics plus real keyboard/screen-reader/manual checks as applicable.
- Responsive/TV claim: representative viewport and input traversal checks.
- Deployment claim: explicit target, deployment output, version, and safe health check.
- Requirement claim: criterion-by-criterion inspection of the produced result.

## Delegated work

Treat sub-agent output as useful evidence about what it inspected, not automatic proof of the final workspace. When delegated work modifies files or external resources, validate the integrated result at the appropriate boundary.

## Failures and limits

Do not hide warnings, truncate decisive errors, or reinterpret skipped checks as passes. If a check cannot run because a tool, credential, device, service, or asset is unavailable, state that constraint and provide the next-best check.

Use precise language:

- “Implemented; `flutter analyze` passes.”
- “Build not verified because the Android SDK is unavailable.”
- “API fallback was unit-checked; live draft content remains unavailable.”

Avoid unsupported “fully fixed,” “production ready,” “all good,” or equivalent claims.

## Working-tree safety

Do not use destructive reset, clean, checkout, or ad-hoc revert cycles to prove a test can fail. Capture a pre-fix failure when available, use a focused test, or use an isolated temporary strategy that cannot discard user work.

## Attribution

Modified Kiro adaptation based on `verification-before-completion` from `davila7/claude-code-templates` at commit `20be4bacde02faf6e805f82e86270e894091a797`. Coercive and tool-specific upstream language was intentionally removed. See `../LICENSE-MIT.txt`.
