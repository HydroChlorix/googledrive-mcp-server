# ADR 0009: Single-Tenant Two-Layer Boundary and Shortcut Defense

## Status

Accepted and implemented for V1

## Context

The initial multi-department Service Account model creates a large blast radius: a single MCP instance could potentially reach every Shared Drive to which its Service Account is granted access. Google Drive permissions alone do not express the application's intended Department boundary, and a permitted Shortcut can point to content outside that boundary.

There are two different scopes that must not be conflated:

- **Shared Drive boundary:** the hard Department/tenant boundary. Nothing outside this Shared Drive is allowed.
- **Root Folder boundary:** an optional narrower project boundary inside that Shared Drive. When configured, only descendants of the Root Folder are allowed.

The first version will therefore optimize for a clear, single-tenant security model rather than supporting shared Service Accounts across departments.

## Decision

For V1:

1. One MCP instance serves one Department and uses one Service Account.
2. The Service Account is associated with one Department Shared Drive.
3. The Shared Drive ID is mandatory configuration for the MCP instance.
4. A Root Folder ID may narrow the boundary within that Shared Drive. If no Root Folder is configured, the effective scope is the entire configured Shared Drive.
5. Search, read, and write operations must verify the Shared Drive boundary and, when configured, the Root Folder boundary.
6. Direct `fileId` requests receive the same Boundary Check as search results.
7. Shortcut resolution is limited to one hop and supports shortcuts to Files only; Folder shortcuts are out of scope.
8. A Shortcut Target must belong to the configured Shared Drive and, when configured, the Root Folder hierarchy. Cross-Shared-Drive or out-of-Root Targets are rejected.
9. If the Target, parent hierarchy, Shared Drive, or Root Folder membership cannot be verified, the operation fails closed and does not read or write the Target.
10. Shortcuts that fail either Boundary Check are omitted from list/search results and their `targetId` is not exposed.
11. External URL-gated read-only access is out of scope for V1 and remains a separate future capability.
12. The recommended least-privilege role is `Viewer` for read-only deployments and `Contributor` when file creation or upload is required.

The following are explicitly unsupported in V1:

- One Service Account serving multiple departments.
- One MCP instance spanning multiple Shared Drives.
- Agent-selected boundary changes.
- Recursive Shortcut resolution.
- Shortcut-to-Folder traversal.
- External URL-gated reads.

## Consequences

### Positive

- The application boundary is deterministic and layered: one MCP instance maps to one Department Shared Drive, optionally narrowed to one Root Folder.
- Shared Service Account blast radius and cross-department routing complexity are deferred.
- Shortcut traversal cannot silently extend the configured Department boundary.
- Fail-closed behavior avoids treating temporary API or permission uncertainty as authorization.

### Negative

- Organizations using one Service Account across multiple departments need separate MCP configurations and Service Accounts for V1.
- Shortcut-to-Folder workflows are not supported.
- A mandatory Shared Drive boundary configuration is required even though authentication itself remains keyless and uses ADC. A Root Folder can provide additional project-level isolation.
- External link-based reading requires a future, separately governed capability.

## Rejected Alternatives

- **Use Google Drive permissions as the only boundary:** rejected because a Shared Service Account may have access to multiple departments and permissions do not encode the MCP instance's intended tenant.
- **Support one Service Account across multiple departments in V1:** rejected because it materially increases blast radius and requires routing and allowlist policy that is outside the first scope.
- **Recursively follow Shortcuts:** rejected because it increases API cost and introduces cycle/depth handling without improving the V1 boundary model.
- **Allow a Shortcut when the Shortcut object itself is in-bound:** rejected because the Target may be outside the Department boundary.
