# ADR 0002: Root Folder Isolation via Search Query Injection

## Status

Superseded for V1 by [ADR-0009](0009-single-tenant-boundary-and-shortcut-defense.md)

## Context

The Google Drive API permits "Global Search" operations, which could inadvertently expose or allow modifications to files outside the intended project scope, even if IAM roles restrict access solely to the Service Account. Implementing client-side logic to isolate access significantly mitigates the risk of an AI Agent generating overly broad or malicious queries.

## Decision

This ADR's Root Folder idea remains part of the V1 two-layer boundary, but its Root Folder-only model is superseded by ADR-0009. The V1 boundary is:

1. **Shared Drive boundary:** the requested item must belong to the configured Shared Drive.
2. **Root Folder boundary:** when a Root Folder is configured, the requested item must also be a descendant of that Root Folder.

The implementation of the superseding ADR-0009 enforces the narrower boundary at the application level through Shared Drive-scoped listing plus metadata and parent-hierarchy validation. Search-query injection is not the normative V1 mechanism:

1. Every list operation is scoped to the configured Shared Drive. Results are filtered fail-closed against the Root Folder hierarchy when configured.
2. When a Root Folder is configured, the system does not expose any capability for the AI Agent to define search scopes outside that designated Root Folder.
3. For read and write operations, the server proactively verifies that the requested File ID or parent resides within the configured Shared Drive and, when configured, within the Root Folder hierarchy before proceeding.

## Consequences

- **Positive:** Prevents AI Agents from accessing irrelevant or sensitive data (Data Leakage), even in the event of malformed or hallucinated prompts.
- **Negative:** Relocating the Shared Drive or Root Folder requires updating boundary configuration and restarting the MCP Server.
- **Neutral:** Requires robust string manipulation and query building logic within the codebase.
