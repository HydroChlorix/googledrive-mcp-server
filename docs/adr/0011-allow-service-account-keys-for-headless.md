# ADR 0011: Pivot to Least Privilege Key Authentication

## Status

Accepted (Supersedes Zero-Key Policy in architecture)

## Context

Previous architectural decisions ([ADR 0001](0001-strict-zero-key-enforcement.md) and [ADR 0007](0007-remove-gac-inspection.md)) established and refined a strict "Zero Key Policy" that heavily discouraged the use of Service Account JSON keys in favor of Application Default Credentials (ADC) and Workload Identity Federation (WIF).

While ADC with user impersonation works perfectly for local desktop environments, users deploying the MCP server in headless environments (e.g., Raspberry Pi, home labs, or third-party VPS) encountered significant friction. Specifically, Google Workspace "Session Control" policies often revoke ADC tokens (e.g., `invalid_rapt` errors) every 24 hours, causing the server to fail unless a human manually re-authenticates. WIF is often too complex or unsupported for simple self-hosted deployments.

Furthermore, the strict "Zero Key" identity no longer aligns with the realities of server-side operations, where Service Account keys with heavily restricted permissions (Least Privilege) are a standard and secure approach when paired with our Two-Layer Boundary Model.

## Decision

1. We formally pivot the project's identity from "Strict Zero-Key Enforcement" to **"Least Privilege Key Authentication"**.
2. The use of a Service Account JSON key via the `GOOGLE_APPLICATION_CREDENTIALS` environment variable is now officially recognized and documented as a primary supported authentication method, provided the key has minimal IAM roles (Least Privilege) and relies on the project's Boundary Guardrails (Shared Drive / Root Folder).
3. Local development and desktop environments (e.g., Claude Desktop) are still encouraged to use keyless ADC (Service Account Impersonation) for convenience, but the project will no longer stigmatize the use of JSON keys.

## Consequences

- **Positive:** Headless servers and home lab deployments can run 24/7 without being interrupted by Workspace Session Control token expirations. The project identity is more realistic and aligned with standard backend GCP practices.
- **Negative:** Reintroduces the operational risk of storing long-lived Service Account JSON keys on disk. Users must take responsibility for securing these files.
- **Neutral:** No code changes are required, as the existing `google.auth.GoogleAuth` implementation natively supports `GOOGLE_APPLICATION_CREDENTIALS`.
