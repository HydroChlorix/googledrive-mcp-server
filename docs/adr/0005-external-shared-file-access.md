# ADR 0005: External Shared File Access via URL-Gated Read-Only Tool

## Status

Approved

## Context

The V1 MCP server enforces the two-layer boundary in ADR-0009 for all standard tools. Real-world workflows require reading external Google Drive links provided directly by users. These files live outside the configured Shared Drive and Root Folder, requiring a separately governed capability.

## Decision

Implement a dedicated tool `drive_download_file_from_url` operating under strict safety constraints:

1. **Tool Name & Parameters**: `drive_download_file_from_url` accepting `url` (string) and `destPath` (string).
2. **URL-Gated Only**: The tool parses file ID strictly from full Google Drive URLs (e.g. `https://drive.google.com/file/d/{id}/view`, `https://docs.google.com/document/d/{id}/edit`). Bare file IDs are rejected to prevent bypass of standard boundary checks.
3. **Read-Only Local Download**: Downloads file content to `destPath`. Path traversal security enforced (must resolve within current working directory).
4. **Auto-Text Export**: Reuses Workspace document conversion logic (ADR-0003) to export Docs/Sheets/Slides as `text/plain`.
5. **No Shortcut Resolution**: If the target URL resolves to a Google Drive Shortcut, it is rejected (fail-closed) to preserve strict boundary predictability.
6. **Resilience Integration**: Wrapped in `executeWithResilience` (isRead: true) sharing the global circuit breaker and admission queue.

## Considered Options

- **Modify `downloadFile` to optionally skip boundary checks** — rejected because it blurs the single-tenant boundary (ADR-0009).
- **Return raw text payload directly in MCP response** — rejected in favor of consistent local file output matching `drive_download_file`.

## Consequences

- **Positive**: Enables safe, explicit reading of external link-shared Google Drive files without compromising standard tool boundary enforcement.
- **Negative**: Adds an intentional seam operating outside the configured Shared Drive boundary.
- **Neutral**: Limited strictly by Google Drive permissions granted to the link or Service Account.
