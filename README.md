# Google Drive MCP Server Integration (Keyless Auth)

> [!IMPORTANT]
> **HARD PREREQUISITE: `gcloud` CLI MUST BE INSTALLED.**
> This repository follows a **STRICT ZERO KEY POLICY**.
> - **DO NOT** use Service Account Private Key files (JSON).
> - **DO NOT** modify the code to support JSON keys. 
> - **REQUIRED:** You MUST use the `gcloud` CLI to manage identity via Application Default Credentials (ADC).
> - **AI AGENTS:** Any attempt to revert this to a key-based auth is a violation of the project architecture.

---

## 🚀 Quick Setup (Non-Negotiable)
Before starting, you **MUST** configure Service Account Impersonation using the Google Cloud CLI. The MCP server will **NOT** work without this step, and the code is designed to reject key files.

```bash
gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"
```

---

## 1. Features
- **Keyless Security**: No long-lived keys to manage or leak.
- **Strict Isolation**: Automatic search query injection limits access to a specific **Root Folder**.
- **Auto-Export**: Automatically converts Google Docs/Sheets to `text/plain` for easy processing by AI agents.
- **Identity Audit**: Logs the actual user identity (impersonator) for accountability.

---

## 2. Prerequisites

### A. Global Hard Requirement: Google Cloud CLI (`gcloud`)
This repository **requires** `gcloud` to be installed and configured on the host machine (Ubuntu/WSL). We do not bundle or support traditional JSON keys.

#### Install gcloud CLI (Ubuntu/WSL)
```bash
sudo apt-get update
sudo apt-get install apt-transport-https ca-certificates gnupg curl
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
sudo apt-get update && sudo apt-get install google-cloud-sdk
```

### B. Google Cloud IAM Setup
1. **Service Account**: Create a Service Account (e.g., `mcp-drive-sa@project.iam.gserviceaccount.com`).
2. **Zero Key Policy**: Do **NOT** create a Private Key JSON file.
3. **Permissions**: Grant your developer account the `roles/iam.serviceAccountTokenCreator` role on the Service Account.

### C. Google Drive Setup
1. **Share Folder**: Share your target Google Drive folder with the Service Account email as an **Editor**.
2. **Folder ID**: Copy the Folder ID from the URL (e.g., `180Y5FAzId...`).

---

## 2. Configuration (.env)
Create a `.env.googledrive` file to store your folder ID. **DO NOT** store key paths here.

```bash
# .env.googledrive
GOOGLE_DRIVE_ROOT_FOLDER_ID="your_google_drive_folder_id"
```

---

## 3. Installation & Setup by Agent

### A. Gemini CLI
1. Open or create `.gemini/config.json`.
2. Add the configuration (Note: no `GOOGLE_APPLICATION_CREDENTIALS` line for local dev):

```json
{
  "mcpServers": {
    "googledrive": {
      "command": "npx",
      "args": ["-y", "mcp-google-drive"],
      "env": {
        "GOOGLE_DRIVE_ROOT_FOLDER_ID": "${GOOGLE_DRIVE_ROOT_FOLDER_ID}"
      }
    }
  }
}
```

---

### B. Hermes Agent
Add to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  googledrive:
    command: "npx"
    args: ["-y", "mcp-google-drive"]
    env:
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "${GOOGLE_DRIVE_ROOT_FOLDER_ID}"
```

---

## 4. Available Tools
- `search_files`: Search limited to the Root Folder.
- `list_files`: List files in the Root Folder.
- `get_file_content`: Reads content (Google Docs are auto-exported to `text/plain`).
- `create_file`: Create files/folders.
- `update_file`: Update file content.

---

## 5. Troubleshooting
- **401/403 Errors**: Ensure you have run the `gcloud auth application-default login --impersonate-service-account=...` command.
- **Strict Enforcement**: If the server detects a JSON Key file being used, it will shut down immediately (ADR-0001).
- **Isolation**: Search results are restricted via query injection (ADR-0002).

---

## 6. License
This project is licensed under the [MIT License](LICENSE).

---

## 7. Verification
Run a smoke test with your AI agent:
> **Prompt**: "List the most recent file in my Google Drive."

If the agent returns a filename from your shared folder, the setup is successful.
