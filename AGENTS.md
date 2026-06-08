# Instructions for AI Agents (Hermes, Claude, Gemini, etc.)

You are integrating a Google Drive MCP server into your environment. This repository provides a specific configuration for a **Local MCP Server** using a **Google Cloud Service Account**.

## 🛑 STRICT CONSTRAINTS
- **TECH STACK**: This is NOT a Python project. DO NOT use `pip` or look for `requirements.txt`.
- **AUTH METHOD**: DO NOT use OAuth 2.0 (Client ID/Secret). This project uses a **Service Account JSON Key**.
- **EXECUTION**: Use `npx -y mcp-google-drive` to run the server.

## 🛠️ HOW TO CONFIGURE ME

### 1. Identify the Credentials
- Ask the user for the absolute path to their **Service Account JSON Key**.
- Ask the user for the **Google Drive Folder ID** that has been shared with the Service Account email.

### 2. Configuration (Hermes Agent)
Add this to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  googledrive:
    command: "npx"
    args: ["-y", "mcp-google-drive"]
    env:
      GOOGLE_SERVICE_ACCOUNT_KEY: "/path/to/key.json"
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "folder_id"
```

### 3. Configuration (Gemini/Claude CLI)
Use the `mcpServers` block:

```json
{
  "mcpServers": {
    "googledrive": {
      "command": "npx",
      "args": ["-y", "mcp-google-drive"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY": "/path/to/key.json",
        "GOOGLE_DRIVE_ROOT_FOLDER_ID": "folder_id"
      }
    }
  }
}
```

## 🔍 VERIFICATION
After configuration, you should see these tools available:
- `list_files`
- `search_files`
- `create_file`
- `get_file_content`
- `update_file`
