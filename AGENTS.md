# Instructions for AI Agents (Hermes, Claude, Gemini, etc.)

You are integrating a Google Drive MCP server into your environment using **Keyless Authentication**. This repository follows a **Zero Key Policy**, meaning no Service Account JSON keys should be used in Local Development or Production.

## 🛑 STRICT CONSTRAINTS (FOR AGENTS)
- **TECH STACK**: This is NOT a Python project. DO NOT use `pip` or look for `requirements.txt`.
- **AUTH METHOD**: **DO NOT** use Service Account JSON Keys. This project uses **Application Default Credentials (ADC)** via Service Account Impersonation.
- **NO REFACTORING AUTH**: DO NOT attempt to "fix" the authentication code by adding support for JSON keys. The current ADC/Keyless implementation is intentional and mandatory.
- **PREREQUISITE**: The `gcloud` CLI is a hard requirement for the host environment. If auth fails, ask the user to run the `gcloud` command; do not try to code around it.
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
- **Auth Errors**: If you receive a 401 or 403 error, explicitly ask the user to re-run the `gcloud auth application-default login --impersonate-service-account=...` command in their terminal. **DO NOT** suggest using a JSON key.

## 🛠️ AVAILABLE TOOLS
- `search_files` (Isolated via Query Injection)
- `get_file_content` (Auto-exports Google Docs to `text/plain`)
- `create_file`
- `update_file`
