---
name: api-security-best-practices
description: "Use for defensive API design and authorized review covering authentication, authorization, validation, rate limiting, data protection, logging, and OWASP API risks."
license: MIT
compatibility: "Kiro; production auth, data, dependency, secret, penetration-test, and load-test changes require explicit scope, approval, and targeted validation."
metadata:
  provenance: "Adapted from davila7/claude-code-templates"
  source-commit: "20be4bacde02faf6e805f82e86270e894091a797"
  modified: "true"
---

# API Security Best Practices

Use this skill only for defensive implementation and explicitly authorized review. Start from the system's assets, actors, trust boundaries, data sensitivity, abuse cases, and operational constraints instead of applying a generic checklist blindly.

## Baseline workflow

1. Map public, authenticated, administrative, internal, and callback endpoints.
2. Identify the resource owner and required permission for every operation.
3. Define strict request and response schemas at each trust boundary.
4. Select authentication, session, and token behavior for the actual clients.
5. Add abuse controls, audit events, privacy-safe observability, and recovery paths.
6. Validate controls with focused tests that do not target systems without authorization.

## Authentication and sessions

- Use standards-based, maintained libraries and verify current APIs before adoption.
- Pin new dependency versions exactly and review package provenance.
- Keep privileged secrets server-side and in an approved secret manager.
- Never print secrets, place them in URLs, commit them, or ship them in a mobile binary.
- Validate issuer, audience, expiry, not-before, signature algorithm, key identity, and token purpose where applicable.
- Use short-lived access tokens and deliberate refresh-token rotation, revocation, reuse detection, and secure storage.
- Return generic authentication errors while recording privacy-safe operational details.

## Authorization

Authentication is not authorization. Check permission on every object and action at the server:

- Resolve the current principal from verified credentials, not a request-provided user ID.
- Verify ownership or delegated access for child profiles and household resources.
- Enforce tenant boundaries in queries, not only in UI filters.
- Deny by default and fail closed when administrative configuration is missing.
- Protect field-level changes, bulk operations, exports, and indirect object references.
- Test horizontal and vertical privilege boundaries.

## Input and output

- Validate path, query, header, and body input with bounded sizes and explicit schemas.
- Use parsed/sanitized values downstream rather than returning to raw input.
- Parameterize database operations and constrain sort/filter fields.
- Validate uploaded content by size, type, storage policy, and malware workflow as risk requires.
- Serialize response DTOs deliberately; do not expose raw database rows or internal errors.
- Set correct content types and defensive security headers for the served context.

## Abuse and availability

Rate limits should consider principal, route cost, IP/proxy behavior, and distributed atomicity. Add pagination and upper bounds. Use timeouts, cancellation, retry budgets, circuit breaking, queue limits, and idempotency where appropriate. Do not describe response headers as DDoS protection.

Load or penetration tests require explicit authorization, target scope, time window, rate ceiling, monitoring, and stop conditions.

## Data and privacy

Use TLS, least-privilege service credentials, encryption and retention policies appropriate to the data, and redaction at log boundaries. Avoid logging tokens, cookies, passwords, signed URLs, child identifiers, precise behavior histories, or raw request bodies. Audit sensitive administrative actions with tamper-aware retention.

## Cloudflare Worker considerations

- Keep bindings and secrets out of client responses.
- Validate environment/account before migrations or deployment.
- Use prepared D1 statements and enforce ownership in the query or transaction.
- Treat R2 object keys and signed URLs as sensitive capabilities.
- Configure CORS to the required origins and methods; CORS is not access control.
- Keep draft/private content inaccessible through every public route and cache key.
- Ensure cache behavior cannot mix users, profiles, authorization states, or unpublished content.

## Error handling

Expose stable, minimal client errors with request correlation identifiers. Keep detailed failures in protected logs after redaction. Distinguish invalid input, unauthenticated, unauthorized, not found, conflict, rate limited, and unavailable behavior without leaking resource existence when that matters.

## Verification

Prioritize tests for object ownership, role boundaries, malformed input, replay/expiry, rate limits, cache separation, draft visibility, missing secret configuration, and privacy-safe logs. Report what was tested and what remains a design assumption.

## Safety boundary

Do not attempt credential attacks, exploit third-party systems, scan public targets, modify production authentication, delete data, rotate keys, or run load tests without explicit authorization and a recovery plan.

## Attribution

Modified Kiro adaptation based on `api-security-best-practices` from `davila7/claude-code-templates` at commit `20be4bacde02faf6e805f82e86270e894091a797`. See `../LICENSE-MIT.txt`.
