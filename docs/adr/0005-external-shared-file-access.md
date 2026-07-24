# ADR 0005: External Shared File Access via URL-Gated Read-Only Tool

## Status
Accepted

## Context
The MCP server enforces Root Folder Isolation (ADR-0002) for all existing tools. A new use case emerged: users receive Google Drive links from external parties (via Messenger, email, etc.) and want the AI agent to read those files. These files are "Anyone with the link can view" but live outside the Root Folder, so existing tools reject them.

## Decision
We will add a new tool `get_file_from_url` that deliberately bypasses Root Folder Isolation under strict constraints:
1. **URL-Gated**: The tool accepts only full Google Drive URLs, not bare file IDs. This prevents it from becoming an escape hatch for Root Folder bypass.
2. **Read-only**: No create or update operations on external files.
3. **Separate tool**: Implemented as a distinct tool rather than modifying `get_file_content`, keeping the existing security boundary untouched.
4. **Auto-Text Export**: Reuses the same Google Workspace → plain text export logic (ADR-0003).

## Considered Options
- **Modify `get_file_content` to optionally skip Root Folder check** — rejected because it blurs the security boundary and makes the AI agent's tool selection ambiguous.
- **Require file owners to share with Service Account** — rejected because it's impractical for ad-hoc link sharing from external parties.

## Consequences
- **Positive:** AI agents can now read any link-shared Google Drive file the user provides, covering a common real-world workflow.
- **Negative:** Introduces a tool that operates outside Root Folder Isolation. The URL-gating constraint mitigates but does not eliminate the expanded access surface.
- **Neutral:** The Service Account can only read files that are "Anyone with the link" or explicitly shared with it — no privilege escalation occurs.
