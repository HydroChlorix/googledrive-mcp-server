# Instructions for AI Agents (Hermes, Claude, Gemini, etc.)

You are integrating a Google Drive MCP server using **Keyless Authentication**. This repository enforces a **Strict Zero Key Policy** (ADR-0001).

## 🛑 STRICT CONSTRAINTS (FOR AGENTS)
- **AUTH METHOD**: **DO NOT** use Service Account JSON Keys. This project uses **Application Default Credentials (ADC)**.
- **SECURITY GUARDRAIL**: This server relies natively on Application Default Credentials (ADC) without custom credential file/env inspection (ADR-0007).
- **FORBIDDEN MUTATIONS**:
    - DO NOT change the execution command from `npx` to `node` for the purpose of bypassing the standard package logic.
- **PREREQUISITE**: The `gcloud` CLI is a hard requirement. If auth fails, instruct the user to run the `gcloud` command; **never** attempt to code around it using keys.

## 🛠️ HOW TO CONFIGURE ME

### 1. Local Development (Ubuntu/WSL)
The user MUST perform Service Account Impersonation via `gcloud` BEFORE running the server:
```bash
gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"
```

### 2. Configuration (Target Environment)
No environment variables are required. Leave all auth-related and folder environment variables empty/unset. Access control is fully permission-based (determined by which folders are shared with the Service Account email in Google Drive).

#### Example Config (Gemini/Hermes)
```json
{
  "command": "npx",
  "args": ["-y", "googledrive-mcp-server"]
}
```

## 🔍 ERROR HANDLING (ACTIONABLE)
1. **401 Unauthorized / 403 Forbidden**:
   - **DO NOT** suggest or try to use a Service Account JSON Key.
   - **DO** ask the user to re-run the `gcloud auth application-default login...` command.
   - **DO** verify that the target Folder/File has been shared with the Service Account email as "Editor" or "Viewer".
2. **"Service Accounts do not have storage quota" Error**:
   - Occurs when attempting `drive_upload_text_file` to a Personal (`@gmail.com`) Drive folder.
   - Explain to the user that Service Accounts have 0 Bytes quota on personal drives.
   - Recommend using a **Google Workspace Shared Drive** or User OAuth 2.0 for file uploads.

## 🛠️ AVAILABLE TOOLS
- `drive_list_files`: List files in Google Drive. Accepts optional `pageSize` (max 100) and `query` search string.
- `drive_upload_text_file`: Upload a text file to Google Drive with `name`, `content`, and optional `parentId`.
- `drive_create_folder`: Create a new folder in Google Drive with `name` and optional `parentId`.
- `drive_download_file`: Download a binary or regular file from Google Drive to local file system using `fileId` and `destPath`.

## Agent skills

### Issue tracker

Tracked via GitHub Issues using `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.
