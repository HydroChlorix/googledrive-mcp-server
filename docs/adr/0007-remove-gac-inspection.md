# ADR 0007: Complete Deprecation and Removal of Custom Credential Inspection Logic

## Status

Accepted (Fully Supersedes ADR 0001)

## Context

See the [Keyless Authentication Architecture](../architecture/authentication.md) for the definitions of ADC, WIF, and Service Account Impersonation.

ADR 0001 originally introduced custom runtime checks in `verifyZeroKeyPolicy()` to inspect environment variables (`GOOGLE_SERVICE_ACCOUNT_KEY` and `GOOGLE_APPLICATION_CREDENTIALS`) and parse file contents for `"private_key"` strings.

However, keyless authentication architecture relies natively on Google Cloud Application Default Credentials (ADC) and Workload Identity Federation (WIF) managed directly by the Google Auth SDK (`google.auth.GoogleAuth`). Custom environment variable inspection and file parsing added redundant runtime overhead, maintenance complexity, and friction without providing additional security over native Google Auth SDK resolution.

## Decision

1. We formally **supersede ADR 0001 in its entirety**.
2. The MCP server completely removes all custom credential inspection logic (`verifyZeroKeyPolicy()`) and no longer checks or inspects `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_SERVICE_ACCOUNT_KEY`.
3. The server relies 100% on standard, native Google Auth SDK (`google.auth.GoogleAuth`) for keyless authentication and ADC resolution.

## Consequences

- **Positive:** Cleaner, simpler codebase with zero runtime file I/O or custom env checking during server initialization. Standard Google Auth SDK handles authentication natively.
- **Negative:** None.
- **Neutral:** Authentication security is governed by Google Cloud IAM and native ADC resolution. Drive permissions remain necessary for access, while application-level scope is additionally governed by the two-layer boundary in ADR-0009.
