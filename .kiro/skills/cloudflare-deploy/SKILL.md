---
name: cloudflare-deploy
description: "Use to plan or perform explicitly authorized Cloudflare Workers, Pages, storage, networking, security, and infrastructure deployments after confirming target, cost, exposure, and rollback."
license: Apache-2.0
compatibility: "Kiro; requires reviewed Wrangler tooling, network access, least-privilege authentication, and explicit confirmation before login, deploy, exposure, routing, migration, deletion, or permission escalation."
metadata:
  original-author: "openai"
  provenance: "Adapted from davila7/claude-code-templates"
  source-commit: "20be4bacde02faf6e805f82e86270e894091a797"
  modified: "true"
---

# Cloudflare Deploy

Use this skill for Cloudflare operations only when the requested target and impact are clear. Planning, local validation, and read-only inspection do not authorize a deployment.

## Mandatory deployment gate

Immediately before an operation that authenticates, publishes, exposes a service, changes routing, migrates data, deletes data, modifies infrastructure, or can incur cost, present:

- Cloudflare account and project/service name.
- Environment and exact command or API operation.
- Resources and bindings affected.
- Public exposure, traffic, data, and cost implications.
- Validation and rollback plan.
- Whether the change is reversible and what may be lost.

Wait for explicit user confirmation. Do not infer approval from an earlier discussion or from permission to edit local files.

## Inspect first

- Read existing Wrangler and package configuration before proposing commands.
- Determine whether tooling is already installed and pinned.
- Confirm compatibility with the current Worker/runtime configuration.
- Inspect project scripts before invoking them.
- Resolve account IDs, routes, databases, buckets, queues, and environments from trusted local configuration without printing secrets.

Do not install or execute an unpinned package through `npx` by default. Do not change permissions simply because a network command failed.

## Authentication and secrets

Use least-privilege, environment-specific credentials. Never print, echo, log, commit, paste into command arguments, or return `CLOUDFLARE_API_TOKEN` or other secrets. Prefer the project's established secret workflow. Authentication flows write persistent credentials and therefore require approval.

Redact account details and signed URLs from shared logs where appropriate. Do not transmit project source, user data, or secrets to unrelated services.

## Workers and bindings

Validate:

- Runtime compatibility and module format.
- Environment-specific variables and secret bindings.
- D1 database IDs and migration state.
- R2 bucket and object visibility.
- KV, Queue, Durable Object, and service bindings.
- Routes, custom domains, CORS, caching, and draft/private-content behavior.
- Resource limits, observability, and failure handling.

Treat data migrations separately from code deployment. Back up or define recovery for destructive schema/data changes.

## Pre-deploy checks

Run only safe, relevant checks already available in the project: static analysis, targeted tests, local build, Wrangler configuration validation/dry-run where supported, and a diff review. Confirm no secret or unintended asset is in the deployment bundle.

## Deploy and verify

After explicit approval:

1. Execute the exact confirmed non-interactive command.
2. Inspect full output and capture the deployment identifier/version.
3. Perform a minimal health check against the confirmed public endpoint.
4. Verify security-critical behavior such as admin fail-closed and draft privacy when affected.
5. Report the target, version, checks, and rollback path without exposing credentials.

Do not claim deployment success from local build output alone.

## Rollback

Prefer a documented version rollback over ad-hoc edits. Avoid deleting production resources as a rollback unless explicitly approved and data loss is understood. If automated rollback is unavailable, state the manual recovery steps before deployment.

## Attribution

Modified Kiro adaptation based on `cloudflare-deploy` from `davila7/claude-code-templates` at commit `20be4bacde02faf6e805f82e86270e894091a797`, preserving upstream author metadata. This component is covered by Apache-2.0; see `../LICENSE-APACHE-2.0.txt`. No upstream reference files were imported.
