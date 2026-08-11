# Instructions for AI Agents

Keyless authentication via Application Default Credentials (ADC) is strictly enforced (ADR-0001, ADR-0007).

## 🛡️ Security & Authentication

- **Auth Method**: Use Application Default Credentials (ADC) via `gcloud` CLI as the primary authentication method. For automated server/headless environments where Session Control limits apply or WIF is unavailable, using a Service Account JSON key via `GOOGLE_APPLICATION_CREDENTIALS` is an accepted fallback (ADR-0011).
- **Auth Failures**: Direct user to run `gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"` (add `--no-browser` for headless/WSL). If on a server experiencing frequent `invalid_rapt` expiration, suggest configuring `GOOGLE_APPLICATION_CREDENTIALS`.
- **Log Sanitization**: Redact sensitive data from all log output (Operation Log and Audit Trail). Sanitize raw OAuth error responses (`invalid_grant`, `invalid_rapt`, tokens) into sanitized summaries and safe remediation hints. Never persist raw JSON credential bodies or access tokens.

## 🚀 CI/CD & GitHub Actions

- **Runners**: Use `runs-on: [self-hosted, oci, arm64]` by default. Reserve `runs-on: ubuntu-latest` strictly for NPM Publish jobs (required for provenance).
- **Workflow Versions**: Pin actions to `actions/checkout@v5`, `actions/setup-node@v5`, `actions/upload-artifact@v7`, and `actions/download-artifact@v7`.
- **NPM Publishing**: Include `npm install -g npm@latest` before `npm ci` and `npm publish`. Use pre-built `production-build` artifact (`dist/`). Maintain `"prepare": "husky || true"` in `package.json`.

## 🎨 Coding Standards & Quality

- **Formatting**: Biome (`indentWidth: 2`, `lineWidth: 100`). Run `npm run lint` or `npm run format`.
- **TypeScript**: Strict typing ESM (`"type": "module"`). Disallow `any` (`noExplicitAny: error`) and `console.log` (`noConsoleLog: error`). Always include relative file extensions in imports.
- **Testing**: Vitest. Run `npm test` before committing.
- **Execution Command**: Preserve standard package logic using `npx`.
- **Dependency & Build Synchronization**: When adding, updating, or removing packages in `package.json`, update corresponding bundler configuration (`vite.config.ts` `rollupOptions.external`) and imports to maintain build synchronization and prevent runtime CJS/native binding errors.
- **Frontend & Bundled UI**: Bind IIFE-scoped inline HTML handlers to `window`. Close `EventSource` connections and timers on token reset. Debounce stream handlers (300ms) and use `AbortController` on fetch calls to prevent race conditions.

## ⚙️ Configuration & Pre-Flight

- **Mandatory Config**: `GOOGLE_DRIVE_SHARED_DRIVE_ID` must be set in `.env` or `mcp_config.json`.
- **Optional Config**: `GOOGLE_DRIVE_ROOT_FOLDER_ID`, `GOOGLE_DRIVE_MODE=readonly`, `MCP_DASHBOARD_TOKEN=<TOKEN>`.
- **Pre-Flight Verification**:
  - GitHub: Verify with `gh auth status`. Prompt `gh auth login` if unauthenticated.
  - GCP ADC: Verify with `bash scripts/verify-setup.sh` or `gcloud auth application-default print-access-token`.

```json
{
  "command": "npx",
  "args": ["-y", "@hydrochlorix/googledrive-mcp-server"],
  "env": {
    "GOOGLE_DRIVE_SHARED_DRIVE_ID": "<MANDATORY_SHARED_DRIVE_ID>",
    "MCP_DASHBOARD_TOKEN": "<OPTIONAL_DASHBOARD_TOKEN>"
  }
}
```

## 🔍 Diagnostics & Error Resolution

- **`insufficient authentication scopes` / 401 Unauthorized / 403 Forbidden**: Ask user to re-run `gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"` (add `--no-browser` for headless/WSL). Verify target file/folder is shared with Service Account email as Editor/Viewer.
- **Storage Quota Exceeded (Personal Drive Upload)**: Direct user to use a Google Workspace Shared Drive or User OAuth 2.0.

## 📚 Context Pointers & Knowledge Base

- `docs/project.md` — Project architecture & canonical MCP Tool registry.
- `docs/specs/README.md` — Feature specs & `TEMPLATE.md`.
- `docs/adr/` — Architecture Decision Records & domain context (`docs/agents/domain.md`).
- `docs/agents/issue-tracker.md` — GitHub Issue workflows (`gh` CLI).
- `docs/agents/triage-labels.md` — Triage vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`).
