---
name: test-googledrive-mcp
description: Execute unified verification and testing for Core MCP Drive APIs, Audit Dashboard UI, Operation Logger, REST/SSE APIs, CLI Token Generator, or the Full Suite on a selected NPM package version or GitHub release/tag of @hydrochlorix/googledrive-mcp-server.
---

Goal:
Execute comprehensive automated verification and health testing on `@hydrochlorix/googledrive-mcp-server`. Supports targeting Core Drive APIs, Audit & Governance Dashboard, Operation Logger & Crash Reporter, or the Full Verification Suite (`npm run test:all`).

## Repositories

Skill repository (the repository that contains this skill):
https://github.com/HydroChlorix/skills

Skill path:
`skills/test-googledrive-mcp/SKILL.md`

Skill version:
Use the `main` branch by default. A branch, tag, or commit specified for the skill repository selects which version of this `SKILL.md` to load or update.

Tested project repository (the project that this skill tests):
https://github.com/HydroChlorix/googledrive-mcp-server

Tested project version:
The selected NPM version or GitHub release/tag determines which version of `googledrive-mcp-server` to install, build, and test. This is separate from the skill version.

When the user asks to update this skill, update only the skill repository version:

1. Load `skills/test-googledrive-mcp/SKILL.md` from the skill repository. Use the requested skill branch, tag, or commit; use `main` when none is specified.
2. Check the tested project repository for current commands, test scopes, and configuration.
3. Compare the tested project's current behavior with this skill.
4. Update this skill while preserving its version-selection and verification requirements.
5. Report both source refs and the changes applied.

Workflow:

0. Data Source and Version Selection (Required Before Testing):
   - Ask exactly: `Please select the Data Source for testing: [NPM / GitHub]`.
   - Wait for `NPM` or `Github`. Continue only after receiving a valid selection.
   - For **NPM**:
     * Run `npm view @hydrochlorix/googledrive-mcp-server versions --json`.
     * Show the available published versions and wait for the user to select one or enter a version explicitly. Do not silently choose `latest`.
     * Verify the exact selection with `npm view @hydrochlorix/googledrive-mcp-server@<version> version`.
     * Install the exact version with `npm install @hydrochlorix/googledrive-mcp-server@<version>`.
     * Record the selected package version in the final summary.
     * Use only the installed package. Skip steps 1 and 2, then continue at step 3.
   - For **GitHub**:
     * Verify GitHub CLI authentication with `gh auth status`.
     * Use tags as the authoritative list of checkoutable versions: `gh api repos/HydroChlorix/googledrive-mcp-server/tags --paginate --jq '.[].name'`.
     * Use `gh release list --repo HydroChlorix/googledrive-mcp-server --limit 100` as supplemental metadata to identify official releases and prereleases. Do not treat release names as a separate version list.
     * Prefer SemVer tags such as `v1.2.0` or `v1.2.0-beta.1`; clearly label or exclude non-version tags such as `dev`, `staging`, or `latest`.
     * Show the available tags and wait for the user to select one or enter a tag explicitly. Preserve any `v` prefix.
     * Verify the exact selected tag with `gh api repos/HydroChlorix/googledrive-mcp-server/git/ref/tags/<version>`.
     * Clone into a dedicated temporary workspace with `gh repo clone HydroChlorix/googledrive-mcp-server <temporary-workdir>` and run `git -C <temporary-workdir> checkout <version>`.
     * Run `npm install` and `npm run build` in the checked-out workspace before starting the server.
     * Record the selected tag and resolved commit SHA in the final summary.
     * Ask the user to select the test scope (`all`, `core`, `dashboard`, or `logger`), then continue at step 1.
   - If any CLI lookup, authentication, version verification, clone, checkout, install, or build fails, report the failure and wait for a corrected selection or environment. Do not start testing.

   MCP server configuration (required before step 3):
   - Ask the user for `GOOGLE_DRIVE_SHARED_DRIVE_ID`. Accept `GOOGLE_DRIVE_ROOT_FOLDER_ID` as optional; omit that key when no root folder is requested.
   - For NPM, prepare:
     ```json
     {
       "mcpServers": {
         "googledrive": {
           "command": "npx",
           "args": ["-y", "@hydrochlorix/googledrive-mcp-server@<verified-version>"],
           "env": {
             "GOOGLE_DRIVE_SHARED_DRIVE_ID": "<YOUR_SHARED_DRIVE_ID>",
             "GOOGLE_DRIVE_ROOT_FOLDER_ID": "<OPTIONAL_ROOT_FOLDER_ID>"
           }
         }
       }
     }
     ```
   - For GitHub, prepare:
     ```json
     {
       "mcpServers": {
         "googledrive": {
           "command": "node",
           "args": ["dist/server.mjs"],
           "cwd": "<CHECKED_OUT_WORKSPACE>",
           "env": {
             "GOOGLE_DRIVE_SHARED_DRIVE_ID": "<YOUR_SHARED_DRIVE_ID>",
             "GOOGLE_DRIVE_ROOT_FOLDER_ID": "<OPTIONAL_ROOT_FOLDER_ID>"
           }
         }
       }
     }
     ```
   - Confirm the selected source/version, required shared-drive ID, optional root-folder ID, launch command, and workspace. Start E2E only after the MCP server starts successfully with this configuration.
   - If the selected source is GitHub, also confirm the resolved commit SHA before starting E2E testing.

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
   - Before the matrix, report the selected source, exact package version or tag, and (for GitHub) resolved commit SHA.
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

   - State **Ready for Release: READY** only when every applicable check passes; otherwise state **Ready for Release: NOT READY** and identify each failed or skipped check.
