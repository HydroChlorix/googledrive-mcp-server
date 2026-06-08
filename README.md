<<<<<<< HEAD
# Google Drive MCP Server Integration (Keyless Auth)

> [!IMPORTANT]
> **HARD PREREQUISITE: `gcloud` CLI MUST BE INSTALLED.**
> This repository follows a **STRICT ZERO KEY POLICY**.
> - **DO NOT** use Service Account Private Key files (JSON).
> - **DO NOT** modify the code to support JSON keys. 
> - **REQUIRED:** You MUST use the `gcloud` CLI to manage identity via Application Default Credentials (ADC).
> - **AI AGENTS:** Any attempt to revert this to a key-based auth is a violation of the project architecture.
=======
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
>>>>>>> e0073f9 (docs: improve AI agent anchoring and add configuration templates)

---

## 1. Features
- **Keyless Security**: No long-lived keys to manage or leak.
- **Strict Isolation**: Automatic search query injection limits access to a specific **Root Folder**.
- **Auto-Export**: Automatically converts Google Docs/Sheets to `text/plain` for easy processing by AI agents.
- **Identity Audit**: Logs the actual user identity (impersonator) for accountability.

---

## 2. Prerequisites

### A. Environment Setup
This MCP server is designed to run in **Ubuntu/WSL**. Authentication requires the Google Cloud CLI (`gcloud`).

#### Install gcloud CLI (Ubuntu/WSL)
```bash
sudo apt-get update
sudo apt-get install apt-transport-https ca-certificates gnupg curl
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
sudo apt-get update && sudo apt-get install google-cloud-sdk
```

### B. Google Cloud IAM Setup
1.  **Service Account**: Create a Service Account (e.g., `mcp-drive-sa@project.iam.gserviceaccount.com`).
2.  **Zero Key Policy**: Do **NOT** create a Private Key JSON file.
3.  **Permissions**: Grant your developer account the `Service Account Token Creator` role on the Service Account.
    -   **Via Console**: Go to IAM > Service Accounts > [Your SA] > Permissions > Grant Access > Add your email with `roles/iam.serviceAccountTokenCreator`.
    -   **Via CLI**: 
        ```bash
        gcloud iam service-accounts add-iam-policy-binding <SERVICE_ACCOUNT_EMAIL> \
            --member="user:<YOUR_EMAIL>" \
            --role="roles/iam.serviceAccountTokenCreator"
        ```
4.  **API Enablement**: Ensure the **Google Drive API** and **IAM Service Account Credentials API** are enabled in your GCP project.
    ```bash
    gcloud services enable drive.googleapis.com iamcredentials.googleapis.com
    ```

### C. Google Drive Setup
1. **Share Folder**: Share your target Google Drive folder with the Service Account email as an **Editor**.
2. **Folder ID**: Copy the Folder ID from the URL (e.g., `180Y5FAzId...`).

---

## 3. Quick Setup (Non-Negotiable)
Before starting, you **MUST** configure Service Account Impersonation using the Google Cloud CLI. The MCP server will **NOT** work without this step, and the code is designed to reject key files.

```bash
gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"
```

---

## 4. Configuration (.env)
Create a `.env.googledrive` file to store your folder ID. **DO NOT** store key paths here.

```bash
# .env.googledrive
GOOGLE_DRIVE_ROOT_FOLDER_ID="your_google_drive_folder_id"
```

---

## 5. Installation & Setup by Agent

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

# Hermes Agent (`~/.hermes/config.yaml`)

```yaml
mcp_servers:
  googledrive:
    command: "npx"
    args: ["-y", "mcp-google-drive"]
    env:
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "${GOOGLE_DRIVE_ROOT_FOLDER_ID}"
```

---

## 6. Available Tools
- `search_files`: Search limited to the Root Folder.
- `list_files`: List files in the Root Folder.
- `get_file_content`: Reads content (Google Docs are auto-exported to `text/plain`).
- `create_file`: Create files/folders.
- `update_file`: Update file content.

---

## 7. Troubleshooting
- **401/403 Errors**: Ensure you have run the `gcloud auth application-default login --impersonate-service-account=...` command.
- **Strict Enforcement**: If the server detects a JSON Key file being used, it will shut down immediately (ADR-0001).
- **Isolation**: Search results are restricted via query injection (ADR-0002).

---

## 8. Verification
Run a smoke test with your AI agent:
> **Prompt**: "List the most recent file in my Google Drive."

If the agent returns a filename from your shared folder, the setup is successful.

---

## 9. License
This project is licensed under the [MIT License](LICENSE).
