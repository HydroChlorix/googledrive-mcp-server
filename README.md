# Google Drive MCP Server Integration (Keyless Auth)

Model Context Protocol (MCP) server providing seamless, secure Google Drive integration for AI agents (Gemini, Hermes, Claude, Cursor) using **Keyless Authentication (Application Default Credentials / ADC)**.

> [!IMPORTANT]
> **KEYLESS AUTHENTICATION (ADR-0007)**
> - **DO NOT** use Service Account Private Key files (`.json`).
> - **REQUIRED:** Authentication uses gcloud Application Default Credentials. Run: `gcloud auth application-default login [--impersonate-service-account=...]`
> - The server relies 100% natively on Google Auth Application Default Credentials (ADC) and does **not** read `GOOGLE_APPLICATION_CREDENTIALS` directly.

---

## 🌟 Key Features

- 🛡️ **Keyless Security**: Eliminates long-lived private keys. Uses short-lived Google Cloud access tokens.
- 🎯 **Zero-Config Access Control**: Accessible files and folders are determined dynamically by sharing folders/files with the Service Account email directly in Google Drive.
- 🏢 **Google Workspace & Shared Drive Support**: Full support for enterprise Shared Drives (`supportsAllDrives: true`) for 24/7 background automation.
- 📂 **Auto-Directory Creation**: Automatically creates missing local destination folders when downloading files.
- 📄 **Auto-Text Export**: Automatically converts Google Workspace Docs/Sheets to `text/plain` for easy processing by AI agents.
- 🔍 **Identity Audit**: Logs the actual human user identity (impersonator) for complete auditability.

---

## 🚀 Quick Start (3-Step Setup)

### Step 1: One-Time Google Cloud IAM Setup

1. **Set Active Project & Enable Required APIs**:
   ```bash
   gcloud config set project <PROJECT_ID>
   gcloud services enable drive.googleapis.com iamcredentials.googleapis.com --project="<PROJECT_ID>"
   ```

2. **Create a Service Account** (e.g. `mcp-drive-sa@<PROJECT_ID>.iam.gserviceaccount.com`). *Do NOT create or download a JSON key!*

3. **Grant Impersonation Permission to Your Account**:
   Grant your user account the `Service Account Token Creator` role on the Service Account:
   ```bash
   gcloud iam service-accounts add-iam-policy-binding <SERVICE_ACCOUNT_EMAIL> \
       --member="user:<YOUR_WORKSPACE_EMAIL>" \
       --role="roles/iam.serviceAccountTokenCreator" \
       --project="<PROJECT_ID>"
   ```

---

### Step 2: Share Google Drive Folder

1. Open Google Drive (Google Workspace Shared Drive recommended).
2. Share target folders or Shared Drives with your Service Account email (e.g. `mcp-drive-sa@...`) as **Content Manager** or **Editor**.
3. **No extra MCP config required!** The server dynamically accesses whatever folders you share with it.

---

### Step 3: Authenticate & Run

1. **Authenticate gcloud CLI**:
   ```bash
   gcloud auth login
   ```

2. **Login Application Default Credentials (ADC) with Impersonation**:
   ```bash
   gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"
   ```

3. **Verify Setup**:
   ```bash
   ./scripts/verify-setup.sh
   ```

---

## 🛠️ Available MCP Tools

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| **`drive_list_files`** | `pageSize` (optional, max 100)<br>`query` (optional string) | List files and folders in Google Drive accessible to the Service Account. |
| **`drive_upload_text_file`** | `name` (required)<br>`content` (required)<br>`parentId` (optional) | Upload a text file to Google Drive. *(Note: Requires Google Workspace Shared Drive for storage quota)*. |
| **`drive_create_folder`** | `name` (required)<br>`parentId` (optional) | Create a new folder in Google Drive. |
| **`drive_download_file`** | `fileId` (required)<br>`destPath` (required) | Download a binary or regular file to the local file system (automatically creates missing local destination folders). |

---

## ⚙️ AI Agent Configurations

No environment variables are required in the agent configuration (`env` is empty).

### Gemini CLI (`.gemini/config.json`)
```json
{
  "mcpServers": {
    "googledrive": {
      "command": "npx",
      "args": ["-y", "@hydrochlorix/googledrive-mcp-server"]
    }
  }
}
```

### Hermes Agent (`~/.hermes/config.yaml`)
```yaml
mcp_servers:
  googledrive:
    command: "npx"
    args: ["-y", "@hydrochlorix/googledrive-mcp-server"]
```

### Claude Desktop / Cursor (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "googledrive": {
      "command": "npx",
      "args": ["-y", "@hydrochlorix/googledrive-mcp-server"]
    }
  }
}
```

---

## ❓ Troubleshooting & Limitations

### 1. `PERMISSION_DENIED` / `iam.serviceAccounts.getAccessToken` Errors
If you encounter permission denied errors during impersonation:
1. Ensure `gcloud auth login` was run with your workspace email.
2. Ensure you executed the IAM policy binding command in Step 1:
   ```bash
   gcloud iam service-accounts add-iam-policy-binding <SERVICE_ACCOUNT_EMAIL> \
       --member="user:<YOUR_WORKSPACE_EMAIL>" \
       --role="roles/iam.serviceAccountTokenCreator" \
       --project="<PROJECT_ID>"
   ```
3. Re-run `gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"`.

### 2. Service Account Storage Quota on Personal (`@gmail.com`) Drives
- **Service Accounts have 0 Bytes personal storage quota**.
- **Supported on `@gmail.com`**: `drive_list_files`, `drive_download_file`, and `drive_create_folder` (folders consume 0 Bytes quota).
- **Upload Limitation**: `drive_upload_text_file` to a personal `@gmail.com` folder will fail with `Service Accounts do not have storage quota` because file ownership defaults to the Service Account.
- **Recommended Solution**: Use a **Google Workspace Shared Drive** (where storage quota belongs to the Shared Drive) for seamless 100% upload support.

---

## 🧪 Verification & Smoke Test

To verify your setup:
1. Start your AI agent with this MCP server configured.
2. Prompt the agent: **"List the most recent files in my Google Drive."**
3. **Success**: The agent returns the list of files from your shared Drive folder.

---

## 📜 License
This project is licensed under the [MIT License](LICENSE).
