---
name: test-googledrive-mcp
description: Execute unified verification & testing (Core MCP Drive APIs, Audit Dashboard UI, Operation Logger, REST/SSE APIs, CLI Token Generator, or Full Suite) on local repository or published NPM versions of @hydrochlorix/googledrive-mcp-server.
---

Goal:
Execute comprehensive automated verification and health testing on `@hydrochlorix/googledrive-mcp-server`. Supports targeting Core Drive APIs, Audit & Governance Dashboard, Operation Logger & Crash Reporter, or the Full Verification Suite (`npm run test:all`).

Workflow:

1. Target Scope Selection:
   - Determine target scope from prompt parameters (`all` [default], `core`, `dashboard`, or `logger`):
     * **Full Suite (`all`)**: Runs `npm run test:all` (Lint, Build, Unit/Integration tests, Audit Dashboard, Operation Logger, & CLI tests).
     * **Core MCP (`core`)**: Runs `npm test` and native tool calls (`drive_list_files`, `drive_upload_text_file`, `drive_download_file`).
     * **Audit Dashboard (`dashboard`)**: Runs `npm run test:dashboard` (REST/SSE APIs, Web UI HTML, Bearer Auth, `--gen-token` CLI).
     * **Operation Logger (`logger`)**: Runs `tests/operationLogger.test.ts` (NDJSON logging, dual output to `stderr`, crash reporting, and secret sanitization).

2. Automated Test Suite Execution:
   - Run `npm run test:all` (or specific sub-suite).
   - Verify CLI Token Generator via `node dist/server.mjs --gen-token` (assert exit 0 and 64-char hex token).
   - Assert all tests in Vitest pass (0 failures).

3. Direct Tool & E2E Verification (When Testing Core MCP Direct Calls):
   - Perform sequential native tool verification:
     * `drive_create_folder`: Create folder `<target>-<timestamp>`.
     * `drive_list_files`: Assert created folder is listed.
     * `drive_upload_text_file`: Upload `hello-<timestamp>.txt` and capture `fileId`.
     * `drive_download_file`: Download file using captured `fileId`.
     * `drive_download_file_from_url`: Verify external URL downloading.
   - Readonly Mode: Test `GOOGLE_DRIVE_MODE=readonly` (write tools forbidden, read tools allowed).

4. Operation Logger & Sanitization Verification:
   - File Existence: Assert `~/.mcp/logs/operation.log` is created.
   - Format Validation: Assert file entries are valid NDJSON (one JSON object per line with `timestamp`, `level`, `message`, `pid`, `hostname`).
   - Secret Redaction: Verify raw OAuth error payloads (`invalid_grant`, `invalid_rapt`, tokens) are sanitized into clean summaries and safe `hint` remediation steps.

5. Audit Dashboard & Security Verification:
   - SPA Web UI (`GET /`): HTTP 200 OK.
   - Security Enforcement: HTTP 401 Unauthorized on unauthenticated or invalid token requests.
   - Authorized REST APIs: HTTP 200 OK for `GET /api/audit/logs` and `GET /api/audit/metrics`.
   - Real-Time SSE Stream: HTTP 200 OK for `GET /api/audit/stream?token=<TOKEN>`.

6. Final Summary Matrix & Readiness Verdict:
   - Output test results matrix:

| Sub-System / Component | Test Suite / Target Route | Status | Details |
| --- | --- | --- | --- |
| Code Quality & Lint | `npm run lint` | PASS / FAIL | Biome & Markdownlint passed |
| Production Build | `npm run build` | PASS / FAIL | Vite bundle dist/server.mjs built |
| Core Unit/Integration | `npm test` | PASS / FAIL | Vitest test suite passed |
| Operation Logger | `tests/operationLogger.test.ts` | PASS / FAIL | NDJSON logging & secret sanitization verified |
| Audit Dashboard APIs | `npm run test:dashboard` | PASS / FAIL | REST endpoints & SSE stream verified |
| CLI Token Generator | `--gen-token` | PASS / FAIL | 64-char hex token generated |
| Direct Tool E2E Flow | `drive_*` tools | PASS / FAIL | End-to-end folder/file lifecycle |

- **Release Readiness Verdict**: Clearly state **Ready for Release: READY / NOT READY** with details.
