# Original User Request

## Initial Request — 2026-06-12T19:31:17Z

Implement the `get_file_from_url` MCP tool for the Google Drive MCP Server — a new tool that lets AI agents read externally shared Google Drive files by accepting a full Google Drive URL, bypassing Root Folder isolation per ADR-0005.

Working directory: /home/ubuntu/github/googledrive-mcp-server

## Requirements

### R1. Extract a shared file-content-fetching helper (Issue #11)
The metadata-fetch + MIME-type check + Auto-Text Export logic currently inside `getFileContent` must be extracted into a reusable internal helper. `getFileContent` must continue to enforce Root Folder isolation (ADR-0002) before delegating to the helper. Existing behavior must not change.

### R2. Build a URL parser for Google Drive links (Issue #12)
A new module must parse a Google Drive URL string and return the file ID. Supported patterns: `drive.google.com/file/d/{id}/view`, `drive.google.com/open?id={id}`, `docs.google.com/document/d/{id}/edit`, `docs.google.com/spreadsheets/d/{id}/edit`, `docs.google.com/presentation/d/{id}/edit`. Query parameters must be stripped. Bare file IDs and folder URLs must be rejected with clear error messages.

### R3. Wire up the `get_file_from_url` tool end-to-end (Issue #13)
A new MCP tool `get_file_from_url` must be registered and functional. It accepts a `url` parameter, uses the URL parser (R2) and shared helper (R1), applies Auto-Text Export for Google Workspace files (ADR-0003), audit-logs the access (ADR-0004), and deliberately skips Root Folder isolation (ADR-0005). Blocked by R1 and R2.

## Acceptance Criteria

### URL Parser
- [ ] All 5 URL patterns extract the correct file ID
- [ ] Query parameters (`?mcp_token=...`, `?usp=sharing`, etc.) are stripped
- [ ] Bare file IDs (not URLs) throw a descriptive error
- [ ] Folder URLs (`/drive/folders/...`) throw a descriptive error
- [ ] Non-Google-Drive URLs throw a descriptive error
- [ ] Unit tests cover all patterns and all rejection cases

### Refactor
- [ ] Shared helper exists and handles fetch + export logic
- [ ] `getFileContent` delegates to it after Root Folder check
- [ ] All existing tests pass with no behavioral change

### End-to-End Tool
- [ ] Tool appears in `ListToolsRequestSchema` response
- [ ] Calling with a valid `drive.google.com/file/d/{id}/view` URL returns file content
- [ ] Google Workspace URLs auto-export to plain text
- [ ] No Root Folder check is performed
- [ ] Access is audit-logged
- [ ] Invalid URLs return clear error messages (not unhandled crashes)

## Project Constraints

- **Auth**: Must use ADC only. Do NOT use JSON keys, do NOT modify `src/auth.js` security checks. See `AGENTS.md`.
- **No root folder bypass for existing tools**: Only `get_file_from_url` may skip the Root Folder check.
- **ADR compliance**: ADR-0001 (Zero Key), ADR-0002 (Root Folder Isolation), ADR-0003 (Auto-Text Export), ADR-0004 (Identity-Rich Logs), ADR-0005 (External Shared File Access).
- **Issue order**: Implement R1 and R2 in parallel, then R3.
