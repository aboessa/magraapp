---
name: testing-patterns
description: "Use for behavior-focused unit, widget, integration, and contract tests; test-data factories, fakes, mocking boundaries, and pragmatic red-green-refactor workflows."
license: MIT
compatibility: "Kiro; inspect project-defined scripts before execution and report exact validation scope and results."
metadata:
  provenance: "Adapted from davila7/claude-code-templates"
  source-commit: "20be4bacde02faf6e805f82e86270e894091a797"
  modified: "true"
---

# Testing Patterns

Use this skill when tests are requested, required by the change, or already part of the affected workflow. Favor observable behavior and stable contracts over implementation details.

## Select the smallest useful level

- Unit tests: pure rules, parsing, mappers, formatters, and state transitions.
- Widget/component tests: semantics, rendering states, focus, and user interaction.
- Contract tests: client/server payload assumptions and error mapping.
- Integration tests: critical flows across real boundaries.
- Golden/visual tests: intentional visual contracts with controlled fonts, sizes, and platforms.

Use a small number of higher-level tests for critical journeys and many focused tests for deterministic logic. Do not duplicate the same assertion at every layer.

## Arrange, act, assert

Make each test explain one behavior. Keep setup explicit, perform the user or domain action, then assert outcomes that matter. Avoid arbitrary delays, order-dependent tests, shared mutable fixtures, and assertions against private methods.

## Test data

Create factories with valid defaults and named overrides. Keep fixtures synthetic; never copy production credentials or personal data. Make important differences visible at the call site. Use builders for complex state only when they improve readability.

## Fakes and mocks

Prefer in-memory fakes for repositories and clocks when behavior matters. Mock narrow external boundaries, not every collaborator. Verify outputs and state before call counts; assert calls only when the interaction itself is the contract. Reset or recreate test doubles between tests.

## Async behavior

Await the user-visible result rather than sleeping. Control clocks, retries, streams, and schedulers where possible. Test cancellation and disposal when asynchronous work can outlive a screen.

## Flutter-focused coverage

For a content application, prioritize:

- DTO parsing for valid, missing, malformed, and forward-compatible fields.
- Repository behavior for remote success, drafts/empty results, timeout, and local fallback.
- Loading, data, empty, stale, and retry UI states.
- GoRouter redirects and deep-link recovery.
- Mobile/tablet composition at representative constraints.
- TV initial focus, directional traversal, select/back, dialog restoration, and visible focus.
- RTL, large text, semantics, and reduced-motion alternatives.
- Image/media fallback behavior without real network dependency.

## Red-green-refactor

When TDD is useful:

1. Write a focused failing test that expresses the missing behavior.
2. Confirm it fails for the expected reason.
3. Implement the smallest coherent change.
4. Confirm the targeted test passes.
5. Refactor while keeping behavior green.
6. Run the relevant broader checks.

This is a tool, not a rigid rule. Exploratory prototypes, generated files, configuration, and legacy rescue work may need a different sequence. Never revert working-tree changes destructively just to manufacture a red state.

## Reliable suites

Tests must be deterministic, isolated, readable, and fast enough for their intended stage. Quarantine is not a permanent fix for flakiness. Record platform dependencies and avoid live network calls in unit/widget suites.

## Execution safety

Project test scripts are executable code. Inspect their definitions before running, avoid watch/interactive modes in automation, and do not trigger external environments or paid services unintentionally. Report command, scope, exit status, failures, and skipped checks.

## Attribution

Modified Kiro adaptation based on `testing-patterns` from `davila7/claude-code-templates` at commit `20be4bacde02faf6e805f82e86270e894091a797`. See `../LICENSE-MIT.txt`.
