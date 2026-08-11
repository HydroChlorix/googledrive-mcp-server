# ADR 0008: Global AI Circuit Breaker for Drive Rate-Limit Protection

## Status

Accepted and implemented for V1

## Context

The local MCP server can receive bursts of AI-generated Drive tool calls. Those calls share the local process and Drive identity/quota. Blind retries and unrestricted concurrency can amplify transient failures until the shared quota is exhausted.

Google Drive identifies `429`, selected quota-related `403` reasons, and `500`–`504` responses as errors that may be handled with exponential backoff. The existing server has no shared retry, concurrency, admission, or circuit-state policy.

The server must preserve its ADC/keyless authentication, strict zero-key policy, stdio transport, and existing tool boundaries.

## Decision

Implement one global resilience boundary per local MCP process with these v1 rules:

1. **Primary objective:** protect shared Drive quota from exhaustion.
2. **Scope:** one global circuit across all Drive tools; no per-tool circuits.
3. **Concurrency:** allow one Drive request at a time. Queue up to five additional requests in FIFO order.
4. **Queue admission:** a full queue returns `CONCURRENCY_LIMITED`. A queued request waits at most 30 seconds, then returns `QUEUE_TIMEOUT`. Queued requests recheck circuit state before invoking Drive.
5. **Retry:** retry reads only, at most two times after the initial attempt, with truncated exponential backoff and jitter. The logical operation has a total 5-second deadline. Honor `Retry-After` up to a 2-second cap.
6. **Write safety:** uploads, folder creation, and other mutating operations are not automatically retried unless a future operation explicitly guarantees idempotency.
7. **Transient classification:** retry/count only `429`, `403` with reason `rateLimitExceeded` or `userRateLimitExceeded`, and `500`, `502`, `503`, or `504`. Do not retry or count generic permission/authentication, validation, not-found, or storage-quota errors.
8. **Opening:** after three consecutive logical operations fail with classified transient errors, open the global circuit. Retry attempts count as one logical operation. A successful logical operation resets the consecutive-failure counter; non-transient errors neither increment nor reset it.
9. **Recovery:** remain open for 60 seconds, then allow exactly one half-open probe. A successful probe closes and resets the circuit. A transiently failed probe starts another 60-second cooldown. Concurrent calls cannot create additional probes.
10. **MCP error contract:** locally rejected calls return stable codes such as `CIRCUIT_OPEN`, `CONCURRENCY_LIMITED`, or `QUEUE_TIMEOUT`, with concise guidance and retry-after duration where applicable.
11. **Observability:** emit structured state-transition logs with operation/tool, retry count, upstream status/reason when available, and cooldown. Do not add a diagnostic MCP tool or metrics backend in v1, and do not log tokens or sensitive payloads.

## Consequences

### Positive

- Shared quota is protected before unrestricted bursts can continue.
- Retry amplification is bounded.
- The state machine and MCP behavior are deterministic and testable with fake time and mocked Drive calls.
- Mutating operations cannot be duplicated by automatic retries under the current non-idempotent contract.

### Negative

- One noisy operation can temporarily block unrelated tools.
- Serial execution and a five-entry queue reduce throughput.
- A short transient outage may open the circuit after only three failed logical operations.
- Writes may fail during transient upstream errors instead of being retried.

### Neutral

- This is process-local protection; it does not coordinate quota usage across multiple MCP processes.
- The circuit breaker does not increase Google quota or solve permanent permission, authentication, validation, not-found, or storage-quota failures.

## Alternatives considered

- **Per-tool circuits:** rejected for v1 because shared quota can still be exhausted by other tools.
- **Unrestricted concurrency:** rejected because a circuit breaker only reacts after a burst has already reached Drive.
- **Retry all operations:** rejected because non-idempotent writes can create duplicate side effects.
- **Unbounded queue:** rejected because stale requests and memory growth are uncontrolled.

## References

- [Google Drive API: Resolve errors](https://developers.google.com/workspace/drive/api/guides/handle-errors)
- [Google Drive API: Usage limits](https://developers.google.com/workspace/drive/api/guides/limits)
