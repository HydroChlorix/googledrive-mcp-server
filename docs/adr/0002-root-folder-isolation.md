# ADR 0002: Root Folder Isolation via Search Query Injection

## Status
Accepted

## Context
The Google Drive API permits "Global Search" operations, which could inadvertently expose or allow modifications to files outside the intended project scope, even if IAM roles restrict access solely to the Service Account. Implementing client-side logic to isolate access significantly mitigates the risk of an AI Agent generating overly broad or malicious queries.

## Decision
We will enforce strict isolation at the MCP Server level using a **Search Query Injection** technique:
1. Every invocation of the `search_files` tool will automatically append the condition `'<ROOT_FOLDER_ID>' in parents` to the Google Drive API `q` (Query) parameter.
2. The system will not expose any capability for the AI Agent to define search scopes outside this designated Root Folder.
3. For `get_file_content` and `update_file` operations, the server will proactively verify that the requested File ID resides within the Root Folder hierarchy before proceeding.

## Consequences
- **Positive:** Prevents AI Agents from accessing irrelevant or sensitive data (Data Leakage), even in the event of malformed or hallucinated prompts.
- **Negative:** Relocating the Root Folder requires restarting the MCP Server with updated environment variables.
- **Neutral:** Requires robust string manipulation and query building logic within the codebase.