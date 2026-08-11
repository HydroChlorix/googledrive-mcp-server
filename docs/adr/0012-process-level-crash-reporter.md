# ADR 0012: Structured Operation Logger with NDJSON Persistence

## Status

Accepted

## Context

The MCP server process has two visibility gaps:

1. **Crash blindness** — Process-level crashes (`uncaughtException`, `unhandledRejection`) and caught startup failures (e.g., `GaxiosError: invalid_rapt` from expired ADC tokens) are printed to `stderr` via scattered `console.error()` calls and lost when the terminal or AI client closes.

2. **Operational blindness** — Startup configuration, auth method, circuit breaker state changes, and mode warnings have no structured, machine-readable representation. An agent subscribing to the server's lifecycle cannot act on events it cannot parse.

The existing SQLite Audit Trail ([ADR-0004](0004-identity-rich-logs.md)) captures **tool-level** execution events but does not cover process lifecycle events. These are distinct concerns: audit logging records what the server *did*; the operation log records how the server *is*.

## Decision

### 1. Module and Interface

A new **Operation Logger** module at `src/core/operationLogger.ts` exposes three functions:

- **`log(level, message, meta?)`** — General-purpose structured log. Writes a single NDJSON line to `~/.mcp/logs/operation.log` AND a human-readable line to `stderr`. Replaces all direct `console.error()` calls in the codebase.

- **`registerCrashReporter()`** — Registers `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers. Called as the first operation in `src/index.ts`. Handler calls `log("fatal"/"error", ...)` then `process.exit(1)`.

- **`reportCrash(error, level?)`** — Convenience wrapper for existing catch blocks. Normalizes the error and calls `log()`. Does NOT call `process.exit()` — caller controls exit.

### 2. Log Levels

| Level | Meaning | Example |
| --- | --- | --- |
| `info` | Normal lifecycle event | Server started, auth method, boundary config |
| `warn` | Degraded state, recoverable | Circuit breaker OPEN, readonly mode |
| `error` | `unhandledRejection`, caught failure | Promise rejection |
| `fatal` | `uncaughtException`, startup crash | GaxiosError auth failure |

### 3. Synchronous-Only I/O

All levels use `fs.appendFileSync`. Rationale:

- `fatal`/`error` handlers run during process death — async may not complete.
- `info`/`warn` events are sparse (startup: ~5 calls; runtime: occasional circuit breaker). Sync I/O on sparse events does not measurably impact the event loop.
- Eliminates async write interleaving where concurrent `appendFile` calls could corrupt NDJSON lines.
- Simplifies the implementation to a single code path.

### 4. Dual Output

Every `log()` call writes to two destinations:

- **File** (`~/.mcp/logs/operation.log`): NDJSON format for machine consumption.
- **stderr**: Human-readable format (`[LEVEL] message`) for terminal visibility. Uses `process.stderr.write()` internally — the rest of the codebase never calls `console.error()` directly.

### 5. Self-Protection

The crash handler wraps its own file write in a try-catch. If `appendFileSync` fails (e.g., disk full, permission denied), it falls back to `process.stderr.write()` and exits immediately. This prevents infinite recursion where a write failure in the `uncaughtException` handler triggers another `uncaughtException`.

### 6. Multi-Instance Safety

Multiple MCP server instances (e.g., Claude Desktop + Cursor) may write to the same `operation.log` concurrently. This is safe because:

- Files are opened with `O_APPEND` (via `appendFileSync`).
- Each write is a single NDJSON line, well under the POSIX `PIPE_BUF` threshold (4096 bytes).
- POSIX guarantees atomic append for writes ≤ `PIPE_BUF`.

### 7. NDJSON Schema

```json
{
  "timestamp": "ISO-8601",
  "level": "info | warn | error | fatal",
  "message": "Human-readable summary",
  "pid": 12345,
  "hostname": "string"
}
```

Crash entries add an `error` object: `{ name, message, stack }`. The `meta` parameter spreads additional fields into the root.

### 8. No New Dependencies

Implementation uses only Node.js built-in modules (`node:fs`, `node:path`, `node:os`). No Pino, Winston, or other logging libraries.

### 9. Log Sanitization & Sensitive Data Redaction

All log output sanitizes raw error payloads to prevent accidental credential or OAuth token leakage:

- Raw OAuth errors (`invalid_grant`, `invalid_rapt`, `unable to impersonate`) are intercepted by `sanitizeAuthError()`.
- Raw JSON response bodies and tokens are stripped and replaced with clean summaries (`Google Authentication Failed: ADC token expired or re-authentication required (invalid_rapt).`).
- Actionable, non-sensitive remediation instructions are attached in a `hint` field (`Run 'gcloud auth application-default login --impersonate-service-account="<EMAIL>"'`).
- Zero external libraries are used for sanitization; pattern matching and string transformation use native TypeScript built-ins.

## Consequences

- **Positive:** Every process lifecycle event is durably recorded. Antigravity can subscribe via `tail -f` and act on structured errors in real time.
- **Positive:** `console.error()` is eliminated from application code, centralizing all output through a single module with consistent format.
- **Positive:** Zero new dependencies. Sync-only I/O eliminates async interleaving and guarantees crash-time durability.
- **Positive:** Log output is automatically sanitized against OAuth JSON token and credential leaks.
- **Positive:** Multi-instance safe via POSIX append semantics.
- **Negative:** Sync I/O blocks the event loop during writes. Acceptable because event volume is extremely low (~5 at startup, occasional at runtime).
- **Neutral:** The Operation Log grows unbounded. Log rotation is the user's responsibility (`logrotate`, manual truncation).
