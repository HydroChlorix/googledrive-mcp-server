# 📊 Observability, Logging, and Audit Architecture

This document specifies the dual-layer observability architecture of `@hydrochlorix/googledrive-mcp-server`.

```text
               AI Assistant / Process Lifecycle Events / MCP Tool Calls
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
  Process Lifecycle Events                                   MCP Tool Calls
 (Startup, Crashes, Circuit Breaker)                    (drive_list_files, upload, etc.)
           │                                                         │
           ▼                                                         ▼
Operation Logger (`src/core/operationLogger.ts`)       Audit Interceptor (`src/audit/middleware.ts`)
           │                                                         │
   [Sanitize Secrets]                                       [Measure Latency & Status]
   (Strip raw OAuth JSON & Tokens)                                   │
           │                                                         ▼
   ┌───────┴───────┐                               SqliteAuditLogger (`src/audit/SqliteAuditLogger.ts`)
   ▼               ▼                                                 │
stderr          operation.log                                        ▼
(Human text)    (NDJSON File)                                   audit.db (SQLite WAL)
                `~/.mcp/logs/operation.log`                           │
                   │                                        ┌────────┴────────┐
                   ▼                                        ▼                 ▼
             Subscribers                       Embedded REST API       SSE Live Stream
          (Antigravity / `tail -f`)               `/api/audit/logs`      `/api/audit/stream`
                                                            └────────┬────────┘
                                                                     ▼
                                                             Glassmorphism SPA
                                                          `http://127.0.0.1:3001`
```

---

## 1. Dual-Layer Logging Philosophy

The server enforces a strict architectural boundary between **process lifecycle events** and **tool execution audit events**:

| Layer | Component | Destination | Storage Engine | Write Strategy | Primary Consumers |
| --- | --- | --- | --- | --- | --- |
| **Operation Log** | `operationLogger.ts` | `~/.mcp/logs/operation.log` + `stderr` | Append-only NDJSON | **Synchronous** (`appendFileSync`) | AI Agents (`tail -f`), Antigravity, Terminal |
| **Audit Trail** | `SqliteAuditLogger.ts` | `~/.mcp/audit.db` | SQLite WAL Mode | **Asynchronous** (Ring-Buffer Queue) | Dashboard SPA UI, Security Auditors, REST API |

---

## 2. Operation Logger (Process Lifecycle & Crashes)

Defined in [`ADR-0012`](../adr/0012-process-level-crash-reporter.md) and implemented in [`src/core/operationLogger.ts`](../../src/core/operationLogger.ts).

### Key Responsibilities

- **Lifecycle Tracking**: Records startup configuration (Shared Drive ID, Root Folder ID boundary), authentication status, and circuit breaker state transitions.
- **Crash Reporting**: Intercepts `uncaughtException` and `unhandledRejection` via `registerCrashReporter()`.
- **Zero-Dependency Durability**: Writes synchronously via `fs.appendFileSync` to prevent log loss during fatal process crashes.
- **Multi-Instance Safety**: Utilizes POSIX `O_APPEND` atomic write semantics for single-line NDJSON entries (writes <= 4096 bytes).

### Log Schema (NDJSON)

```json
{
  "timestamp": "2026-08-11T07:35:51.131Z",
  "level": "info | warn | error | fatal",
  "message": "Human-readable event summary",
  "pid": 285913,
  "hostname": "HARVESTER-OMEN",
  "hint": "Optional actionable remediation command for agents",
  "error": {
    "name": "ErrorName",
    "message": "Sanitized error message",
    "stack": "Call stack traceback"
  }
}
```

---

## 3. SQLite Audit Logger (Tool Execution Governance)

Defined in [`ADR-0004`](../adr/0004-identity-rich-logs.md) and implemented in [`src/audit/SqliteAuditLogger.ts`](../../src/audit/SqliteAuditLogger.ts).

### Key Responsibilities

- **Interception**: Intercepts every MCP tool call via [`src/audit/middleware.ts`](../../src/audit/middleware.ts) (`withAuditLogger`).
- **Metadata Extraction**: Records `toolName`, `arguments`, `status` (`SUCCESS`, `DENIED`, `ERROR`), `latencyMs`, and error tracebacks.
- **Low Overhead**: Uses an in-memory ring-buffer queue to flush entries asynchronously (<10ms execution overhead).
- **Self-Cleaning Circuit Breaker**: Automatically purges oldest records down to 80k rows when the SQLite database exceeds 100k rows.

---

## 4. Security & Sanitization Boundary

Logging components enforce **Zero Secret Exposure**:

1. **OAuth & Credential Masking (`sanitizeAuthError`)**:
   - Intercepts raw Gaxios / Google Auth errors (`invalid_grant`, `invalid_rapt`, `unable to impersonate`).
   - Strips raw JSON response bodies and access tokens.
   - Replaces raw messages with sanitized summaries and appends safe, actionable `hint` remediation steps (`gcloud auth application-default login ...`).

2. **URL Parameter Redaction (`redactDriveUrl`)**:
   - Strips sensitive token parameters from Google Drive URLs before logging.

3. **DOM XSS Defense (`escapeHtml`)**:
   - Escapes HTML entities (`&`, `<`, `>`, `"`, `'`) when rendering audit payloads inside the embedded Dashboard SPA UI.

---

## 5. Log Consumption & Observability Interfaces

- **Live Process Monitoring**:

  ```bash
  tail -f ~/.mcp/logs/operation.log
  ```

- **Embedded Governance Dashboard**:
  Navigating to `http://127.0.0.1:3001?token=<TOKEN>` streams live audit events via SSE (`/api/audit/stream`) and provides REST API metrics endpoints (`/api/audit/metrics`).
