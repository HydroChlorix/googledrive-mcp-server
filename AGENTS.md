# Instructions for AI Agents (Hermes, Claude, Gemini, etc.)

You are integrating a Google Drive MCP server into your environment using **Keyless Authentication**. This repository follows a **Zero Key Policy**, meaning no Service Account JSON keys should be used in Local Development or Production.

## 🛑 STRICT CONSTRAINTS
- **TECH STACK**: This is NOT a Python project. DO NOT use `pip` or look for `requirements.txt`.
- **AUTH METHOD**: **DO NOT** use Service Account JSON Keys. This project uses **Application Default Credentials (ADC)** via Service Account Impersonation for Local Dev, and **Workload Identity Federation (WIF)** for Production.
- **EXECUTION**: Use `npx -y mcp-google-drive` to run the server.

## 🛠️ HOW TO CONFIGURE ME

### 1. Local Development (Ubuntu/WSL)
Before running the MCP server, the user must perform Service Account Impersonation using the Google Cloud CLI (`gcloud`):

```bash
gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"
```

### 2. Configuration (Hermes Agent / Gemini CLI)
In your configuration file, **DO NOT** set `GOOGLE_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS` for local development. The server will automatically use the ADC token.

#### Gemini CLI (`.gemini/config.json`)
```json
{
  "mcpServers": {
    "googledrive": {
      "command": "npx",
      "args": ["-y", "mcp-google-drive"],
      "env": {
        "GOOGLE_DRIVE_ROOT_FOLDER_ID": "your_folder_id_here"
      }
    }
  }
}
```

#### Hermes Agent (`~/.hermes/config.yaml`)
```yaml
mcp_servers:
  googledrive:
    command: "npx"
    args: ["-y", "mcp-google-drive"]
    env:
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "your_folder_id_here"
```

## 🔍 VERIFICATION & ERROR HANDLING
- **Smoke Test**: Ask the agent: "List the most recent file in my Google Drive."
- **Auth Errors**: If you receive a 401 or 403 error, explicitly ask the user to re-run the `gcloud auth application-default login --impersonate-service-account=...` command in their terminal.

## 🛠️ AVAILABLE TOOLS
- `list_files`
- `search_files`
- `create_file`
- `get_file_content` (Auto-exports Google Docs to `text/plain`)
- `update_file`

## Agent skills

### Issue tracker
GitHub Issues via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels
Canonical roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs
Single-context layout with `CONTEXT.md` and `docs/adr/` at the root. See `docs/agents/domain.md`.
