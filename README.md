# Google Drive MCP Server Integration (Service Account)

> [!IMPORTANT]
> **FOR AI AGENTS (Hermes, Claude, etc.):** 
> This is a **Node.js-based Local MCP Server**. 
> - **DO NOT** use Python or `pip install`.
> - **DO NOT** use OAuth 2.0 (Client ID/Secret).
> - **USE** a Google Cloud **Service Account (JSON Key)**.
> - **USE** `npx -y mcp-google-drive` as the command.

---

## 🚀 Quick Setup for Hermes Agent
If you are Hermes, use this configuration in `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  googledrive:
    command: "npx"
    args: ["-y", "mcp-google-drive"]
    env:
      GOOGLE_SERVICE_ACCOUNT_KEY: "/absolute/path/to/your/service-account-key.json"
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "your_folder_id_here"
```

---

## 1. Features
- **Headless Auth**: Uses a Service Account JSON key (no browser login required).
- **Isolation**: Restricted access to a specific **Root Folder**.
- **Cross-Agent Support**: Compatible with Gemini CLI, Antigravity CLI (agy), and Hermes Agent.

---

## 1. Prerequisites
1. **Google Cloud Service Account**:
   - Create a Service Account in the [Google Cloud Console](https://console.cloud.google.com/).
   - Download the **JSON Private Key**.
   - Note the Service Account Email (e.g., `account-name@project-id.iam.gserviceaccount.com`).
2. **Google Drive Setup**:
   - Create a folder in Google Drive.
   - **Share** the folder with the Service Account email as an **Editor**.
   - Copy the **Folder ID** from the URL (e.g., `180Y5FAzId...`).

---

## 2. Configuration (.env)
Create a `.env.googledrive` file in the root directory to store your credentials:

```bash
# .env.googledrive
GOOGLE_SERVICE_ACCOUNT_KEY="/path/to/your/service-account-key.json"
GOOGLE_DRIVE_ROOT_FOLDER_ID="your_google_drive_folder_id"
```

---

## 3. Installation & Setup by Agent

### A. Gemini CLI
1. Open or create `.gemini/config.json`.
2. Add the `googledrive` server configuration:

```json
{
  "mcpServers": {
    "googledrive": {
      "command": "npx",
      "args": ["-y", "mcp-google-drive"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY": "${GOOGLE_SERVICE_ACCOUNT_KEY}",
        "GOOGLE_DRIVE_ROOT_FOLDER_ID": "${GOOGLE_DRIVE_ROOT_FOLDER_ID}"
      }
    }
  }
}
```
3. **Usage**:
   Load env vars and start the CLI:
   ```bash
   export $(cat .env.googledrive | xargs) && gemini
   ```
   *Ask: "List files in my Google Drive folder"*

---

### B. Antigravity CLI (`agy`)
Antigravity often uses the same MCP configuration structure as Gemini CLI.

1. Ensure your `.env.googledrive` is loaded.
2. Run `agy` with the environment:
   ```bash
   export $(cat .env.googledrive | xargs) && agy
   ```
3. **Usage**:
   *Ask: "Create a new file called 'hello.txt' in Drive with content 'Hello World'"*

---

### C. Hermes Agent
1. Open your Hermes config file (typically `~/.hermes/config.yaml`).
2. Add the following to the `mcp_servers` section:

```yaml
mcp_servers:
  googledrive:
    command: "npx"
    args: ["-y", "mcp-google-drive"]
    env:
      GOOGLE_SERVICE_ACCOUNT_KEY: "${GOOGLE_SERVICE_ACCOUNT_KEY}"
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "${GOOGLE_DRIVE_ROOT_FOLDER_ID}"
```
3. **Usage**:
   Start Hermes with the environment variables:
   ```bash
   export $(cat .env.googledrive | xargs) && hermes chat
   ```
   *Test connection: `hermes mcp test googledrive`*

---

## 4. Available Tools
- `search_files`: Search for files using Google Drive query syntax.
- `list_files`: List all files visible to the Service Account.
- `get_file_content`: Read content/export Google Docs (use `mimeType: "text/plain"` for Docs).
- `create_file`: Create a new file or folder.
- `update_file`: Update existing file content.

---

## 5. Troubleshooting
- **404 Errors**: Ensure the folder ID is correct and the Service Account has **Editor** permissions.
- **Auth Errors**: Verify the path in `GOOGLE_SERVICE_ACCOUNT_KEY` is absolute and points to a valid JSON file.
- **Binary vs Doc**: When reading Google Docs, always specify a export `mimeType` (e.g., `text/plain`).

---

## 6. License
This project is licensed under the [MIT License](LICENSE).

---

## 7. Verification
To ensure your MCP server is working correctly, you can perform a simple "smoke test":

1. Start your AI agent (Gemini, Hermes, etc.) with this MCP server configured.
2. Ask the agent: **"List the most recent file in my Google Drive."**
3. **Success**: The agent should return the name of a file from your shared folder.
4. **Troubleshooting**: If it fails, check your `.env.googledrive` paths and Service Account permissions.
