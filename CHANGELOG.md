# Changelog

## [2.4.0] - 2026-08-12

### ⚠️ Breaking Changes

- **logging**: Direct `console.error()` calls have been **eliminated** throughout the application codebase and centralized through a structured Operation Logger (`src/core/operationLogger.ts`). Process lifecycle logs are written to `~/.mcp/logs/operation.log` (NDJSON format) and formatted `[LEVEL] message` output to `stderr`.

### Features

- **core**: implement Operation Logger, Audit Dashboard, and Least Privilege Key Authentication
- **auth**: verify GOOGLE_APPLICATION_CREDENTIALS key file existence and log status with remediation hint
- **auth**: specify explicit active authMethod in final initialization log message
- **auth**: detect precise credential type in JSON file logging
- **script**: enhance verify-setup.sh with SA key check, boundary validation, and log directory verification
- **logger**: Added process-level Operation Logger with synchronous NDJSON persistence, `uncaughtException`/`unhandledRejection` crash reporter, and dual-destination output.
- **security**: Added automated log sanitization and secret redaction. Raw OAuth JSON error strings (`invalid_grant`, `invalid_rapt`, tokens) are stripped and sanitized into human-readable messages with actionable `hint` remediation steps.

### Bug Fixes

- **auth**: update service account email placeholder in authentication hints and error messages

## [2.3.3] - 2026-08-07

### Bug Fixes

- **ci**: Add `npm install -g npm@latest` step before publish to fix scoped package provenance publishing bug in npm 10.x.

## [2.3.2] - 2026-08-07

### Bug Fixes

- **ci**: Add `npm ci --ignore-scripts` to publish job and update `prepare` script to handle missing husky gracefully during NPM publish.

## [2.3.1] - 2026-08-07

### Bug Fixes

- **ci**: Add build step to verify job in publish workflow so integration tests find `dist/server.mjs`.
- **ci**: Update agent-triage runner to `[self-hosted, oci, arm64]`.

## [2.3.0] - 2026-08-07

### Features

- **core**: Enforce strictly required `parentId` for `uploadTextFile` and `createFolder` tools/functions to prevent orphaned files in Service Account root drive.
- **ci**: Enhance workflows with pre-publish validation, security checks for downloads, and automated bug triage for agent-generated issues.
