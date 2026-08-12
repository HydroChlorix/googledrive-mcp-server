# Project Specification & Architecture: googledrive-mcp-server

Google Drive MCP Server (v2.4.0) implemented in TypeScript using Least Privilege Key Authentication (ADC/WIF/JSON), Biome, Vitest, `@modelcontextprotocol/server`, and Embedded Hono Audit Dashboard.

## Architecture & Code Layout

> [!NOTE]
> This section provides a high-level layout. For deep-dive architectural decisions, please read [`docs/architecture/authentication.md`](docs/architecture/authentication.md), [`docs/architecture/boundary-model.md`](docs/architecture/boundary-model.md), and [`docs/architecture/observability-and-logging.md`](docs/architecture/observability-and-logging.md).

- **`src/core/auth.ts`**: Handles Google Drive API authentication using `GoogleAuth`. Supports Least Privilege Key Policy (ADR-0011) as a singleton client via ADC or JSON keys.
- **`src/core/DriveClient.ts`**: Core `BoundarySafeDriveClient` enforcing Shared Drive and Root Folder boundary checks for all Drive file operations (`listFiles`, `uploadTextFile`, `createFolder`, `downloadFile`, `downloadFileFromUrl`).
- **`src/core/BoundaryGuard.ts`**: Verifies targets against Shared Drive and Root Folder boundaries.
- **`src/core/ResilienceAdapters.ts`**: Circuit breaker and concurrency rate-limiting adapters.
- **`src/audit/types.ts`**: Audit log data types (`AuditEventInput`, `AuditEventRecord`, `AuditQueryParams`, `AuditQueryResult`, `AuditMetricsResult`, `AuditLogger`).
- **`src/audit/SqliteAuditLogger.ts`**: SQLite audit logger using `~/.mcp/audit.db` in WAL mode with async ring-buffer queue (<10ms overhead), circuit breaker (100k rows threshold), EventEmitter for SSE, and graceful shutdown.
- **`src/audit/middleware.ts`**: Higher-order interceptor wrapping tool executions for latency, metadata extraction, and status classification (`SUCCESS`, `DENIED`, `ERROR`).
- **`src/audit/server.ts`**: Embedded Hono dashboard server (default port 3001) with Dual-Transport Token Authentication, Rate Limiting, HTTP Security Headers (CSP, X-Frame-Options), REST routes (`/api/audit/logs`, `/api/audit/metrics`), SSE real-time stream (`/api/audit/stream`), and Embedded SPA UI serving (`src/audit/ui.ts`).
- **`src/audit/ui.ts`**: Single Page Application (SPA) dashboard UI with `sessionStorage` token caching, `history.replaceState` URL scrubbing, interactive Token Modal, filter controls (Tool Name, Status, Date Range), cursor-based pagination, expandable execution details, and `escapeHtml` DOM XSS protection.
- **`src/mcp/McpServerApplication.ts`**: High-level MCP Server application using Dependency Injection. Registers tools with Zod schemas and connects to transport.
- **`src/mcp/server.ts`**: MCP Server starter initializing dependencies, `SqliteAuditLogger`, dashboard server, and `McpServerApplication`.
- **`src/index.ts`**: Application entry point with `--gen-token` CLI generator and stdio transport launcher.
- **`src/core/operationLogger.ts`**: Structured NDJSON Operation Logger replacing all direct `console.error()` calls. Provides `log(level, message, meta?)` for lifecycle events, `registerCrashReporter()` for passive process-level crash handlers, and `reportCrash(error)` for explicit catch blocks. Writes to `~/.mcp/logs/operation.log` (NDJSON) and `stderr` (human-readable). Sync I/O only.

## Feature & Milestone Inventory

| Feature | Description | Status |
| --- | --- | --- |
| **Least Privilege Key** | Authentication via `GoogleAuth` (ADC or JSON keys) | COMPLETED |
| **Two-Layer Boundary** | Shared Drive ID & Root Folder ID boundary verification | COMPLETED |
| **Resilience Breaker** | Circuit breaker & concurrency rate limiting | COMPLETED |
| **SQLite Audit Logging** | `SqliteAuditLogger` at `~/.mcp/audit.db` in WAL mode | COMPLETED |
| **Audit Middleware** | Latency measurement and metadata extraction interceptor | COMPLETED |
| **Embedded REST & SSE Server** | Hono server on port 3001 with Token Auth, Security Headers, Rate Limiting, REST APIs, and SSE stream | COMPLETED |
| **Audit Dashboard SPA** | Embedded Web SPA in `src/audit/ui.ts` with real-time stream, metrics, filtering, paging, and 401 modal | COMPLETED |
| **CLI Token Generator** | `--gen-token` flag to generate cryptographically secure 256-bit tokens | COMPLETED |
| **McpServerApplication DI** | Decoupled pipeline with constructor dependency injection | COMPLETED |
| **Operation Logger** | Structured NDJSON lifecycle logging to `~/.mcp/logs/operation.log` with crash reporter | COMPLETED |

## Interface Contracts

### `SqliteAuditLogger` ↔ `AuditLogger` interface (`src/audit/types.ts`)

- `constructor(dbPath?: string)`: Default `dbPath` resolves `~/.mcp/audit.db` via `os.homedir()`.
- `log(event: AuditEventInput): void`: Synchronously pushes event into in-memory queue (<10ms overhead).
- `logExecution(toolName, args, actionFn)`: Wraps action execution and records structured log.
- `query(params: AuditQueryParams): Promise<AuditQueryResult>`: Queries `audit_logs` table with filtering by `toolName`, `status`, YYYY-MM-DD date ranges (normalized to UTC), and pagination via `cursor`.
- `getMetrics(): Promise<AuditMetricsResult>`: Aggregates total calls, success rate, denied count, average latency, and tool usage.
- `purge(daysToKeep?: number): Promise<number>`: Deletes records older than `daysToKeep`.
- `close(): Promise<void>`: Flushes ring-buffer events to disk and closes SQLite connection.

### Dashboard REST & SSE Server (`src/audit/server.ts`)

- `GET /api/audit/logs`: Query parameters `toolName`, `status`, `startDate`, `endDate`, `cursor`, `limit`.
- `GET /api/audit/metrics`: Summary statistics and security alerts count.
- `GET /api/audit/stream`: Server-Sent Events (SSE) streaming live `audit` events to dashboard UI.

## Automated Tooling & Testing

- **Compiler**: TypeScript 7.x (`tsconfig.json`, `NodeNext` ESM modules)
- **Bundler**: Vite (`vite build` → `dist/server.mjs`)
- **Linter & Formatter**: Biome (`biome.json`, `npm run lint`)
- **Test Runner**: Vitest (`npm test`, `npm run test:dashboard`, `npm run test:all` — including `tests/cli.test.ts`, `tests/audit/`, `tests/auth.test.ts`, `tests/drive.test.ts`, `tests/server.test.ts`, `tests/resilience.test.ts`)

## Available MCP Tools

1. **(Read)** `drive_list_files`: List files in Google Drive with optional `pageSize` (max 100) and `query` search string.
2. **(Write)** `drive_upload_text_file`: Upload a text file with `name`, `content`, and strictly required `parentId`.
3. **(Write)** `drive_create_folder`: Create a new folder with `name` and strictly required `parentId`.
4. **(Read)** `drive_download_file`: Download a binary/regular file from Google Drive using `fileId` and `destPath`.
5. **(Read)** `drive_download_file_from_url`: Download a file from an external Google Drive URL to local file system.

*Note: Write tools are completely unregistered if the server is started with `GOOGLE_DRIVE_MODE=readonly`.*
