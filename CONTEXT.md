# Context: Google Drive MCP Server Integration

## Glossary

### Service Account

A Google Cloud identity intended for automated workflows and server-to-server interactions. In this project, it is authenticated using Keyless methods (ADC/WIF) to bypass User OAuth requirements while maintaining a Zero Key Policy.

### Keyless Authentication

An authentication architecture that eliminates the use of Private Key JSON files. It relies on Application Default Credentials (ADC) for local environments or Workload Identity Federation (WIF) for production, enhancing security and mitigating credential leak risks.

### Service Account Impersonation

The process where a user (developer) leverages their own identity to request a short-lived access token on behalf of a Service Account. This requires the `roles/iam.serviceAccountTokenCreator` IAM role.

### Transparent ADC

A strategy for utilizing Application Default Credentials where the MCP Server codebase does not explicitly specify the Service Account email or load key files directly. Instead, it seamlessly adopts the identity configured in the environment (e.g., via gcloud impersonation).

### Strict Zero Key Policy

A project policy that forbids long-lived Service Account private-key JSON files. The MCP Server delegates credential resolution to the native Google Auth SDK and does not inspect or parse credential files; ADC, impersonation, and WIF provide the supported keyless authentication paths.

### Permission-Based Drive Access

Google Drive permissions are necessary for access, but they are not the complete V1 application boundary. The MCP server additionally requires the requested file to belong to its configured Shared Drive. The Service Account may have broader Google Drive permissions, but the MCP instance must not use them outside its single-tenant boundary.

### Explicit Auth Feedback

An error handling strategy where the MCP Server returns clear, actionable messages to the AI Agent upon authentication failure, enabling the Agent to instruct the user to run the appropriate `gcloud` command to refresh tokens.

### User-Friendly Auth Errors

An error handling strategy where the MCP Server provides step-by-step resolution guidance (e.g., the specific `gcloud` command to execute) when it detects authentication failures or expired tokens.

### Auto-Text Export

A file handling strategy for Google Workspace documents (Docs, Sheets, Slides). When `get_file_content` is invoked, the MCP Server automatically converts the content to `text/plain`, allowing AI Agents to process the data immediately without managing complex export MIME types.

### Identity-Rich Logs

A logging strategy that captures and includes the identity of the actual user (User Email) impersonating the Service Account during operations. This enables accurate audit trails to determine who initiated specific actions within Google Drive.

### Local MCP Server

The `mcp-google-drive` package executed locally within the environment (WSL/Ubuntu) using `npx`. It translates MCP tool calls into Google Drive API requests.

### Core Tools

The canonical list of available MCP tools provided by this server is maintained in [`docs/project.md`](docs/project.md) under the "Available MCP Tools" section.

### Editor Permission

The specific Google Drive sharing level granted to the Service Account's email address by the folder owner. This permission is necessary for the server to perform file creation and updates.

### Principle of Least Privilege

The security practice of ensuring the Service Account has no global IAM roles in Google Cloud Console, with access restricted solely through Drive-level folder sharing.

### Global Circuit Breaker

A process-local admission-control mechanism shared by every Drive tool. It temporarily rejects Drive operations after repeated classified transient failures to protect the shared Drive quota.

### Single-Tenant Boundary

The V1 application boundary in which one MCP instance serves one Department through one Service Account and one configured Shared Drive. The Shared Drive is the hard tenant boundary. An optional Root Folder can narrow the effective project boundary inside that Shared Drive.

### Boundary Check

An application-level authorization check that verifies a requested file belongs to the configured Shared Drive and, when configured, is a descendant of the Root Folder before the MCP server reads or writes it. The check applies to search results, direct file IDs, and Shortcut Targets.

### Two-Layer Boundary

The V1 boundary has two layers: the configured Shared Drive is the mandatory hard boundary, and the optional Root Folder is a narrower project boundary within it. A target must pass both checks when the Root Folder is configured; a target outside the Shared Drive is always rejected.

### Shortcut Defense

The V1 policy for Google Drive Shortcuts: resolve at most one hop, support File Targets only, reject Targets outside the configured Shared Drive, omit rejected Shortcuts from listings, and fail closed when the Target or its boundary cannot be verified.

### Logical Operation

One MCP-requested Drive operation, including its bounded retry attempts. Circuit failure counting treats the logical operation as one unit rather than counting each retry attempt separately.

### Transient Failure

For the circuit-breaker policy, an HTTP `429`, an HTTP `403` with reason `rateLimitExceeded` or `userRateLimitExceeded`, or an HTTP `500`, `502`, `503`, or `504` response. Authentication, permission, validation, not-found, and storage-quota errors are not transient for this policy.

### Circuit State

The global breaker state: `closed` admits work, `open` rejects work during cooldown, and `half-open` permits one recovery probe.

### Recovery Probe

The single Drive request permitted after the global circuit's 60-second cooldown. Success closes the circuit; a classified transient failure starts another cooldown.

### Admission Error

A local MCP error returned before a Drive API call is made, such as `CIRCUIT_OPEN`, `CONCURRENCY_LIMITED`, or `QUEUE_TIMEOUT`.

### Operation Logger

A structured NDJSON logging module (`src/core/operationLogger.ts`) that centralizes all process output. Replaces direct `console.error()` calls throughout the codebase. Exposes three functions: `log(level, message, meta?)` for lifecycle events, `registerCrashReporter()` for passive `uncaughtException`/`unhandledRejection` handlers, and `reportCrash(error)` for explicit catch blocks. Automatically sanitizes raw OAuth JSON responses and tokens into clean summaries and safe `hint` remediation steps. All writes are synchronous (`fs.appendFileSync`) to guarantee durability during crashes. Writes to both the Operation Log (NDJSON file) and stderr (human-readable). See ADR-0012.

### Operation Log

The NDJSON file at `~/.mcp/logs/operation.log` that captures all process lifecycle events — startup configuration, warnings, errors, and crashes. Append-only, designed for `tail -f` consumption by Antigravity or other log-shipping agents. Not to be confused with the SQLite Audit Trail, which records tool-level execution events. Multi-instance safe via `O_APPEND` semantics for single-line writes.
