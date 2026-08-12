# 📁 Google Drive MCP Server (Least Privilege Key)

<div align="center">

**Enterprise-grade Google Drive integration for AI assistants — seamless Shared Drive boundary control, Least Privilege Key Authentication, and real-time audit logging for Gemini, Claude, Cursor, and more.**

[![npm version](https://img.shields.io/npm/v/@hydrochlorix/googledrive-mcp-server?style=flat-square&logo=npm)](https://www.npmjs.com/package/@hydrochlorix/googledrive-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@hydrochlorix/googledrive-mcp-server?style=flat-square&logo=npm&label=downloads%2Fmo)](https://www.npmjs.com/package/@hydrochlorix/googledrive-mcp-server)
[![Node.js Version](https://img.shields.io/node/v/@hydrochlorix/googledrive-mcp-server?style=flat-square&logo=nodedotjs)](https://www.npmjs.com/package/@hydrochlorix/googledrive-mcp-server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Biome Formatted](https://img.shields.io/badge/Code_Style-Biome-60a5fa?style=flat-square&logo=biome)](https://biomejs.dev/)
[![Least Privilege Key](https://img.shields.io/badge/Auth-Least_Privilege_Key-4285F4?style=flat-square&logo=googlecloud&logoColor=white)](docs/architecture/authentication.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![MCP Spec Version](https://img.shields.io/badge/MCP_Spec-v2.0.0-green?style=flat-square)](https://modelcontextprotocol.io)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy_Me_A_Coffee-Donate-FFDD00?style=flat-square&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/hydrochlorix)

An [MCP server](https://modelcontextprotocol.io) providing secure Google Drive access to AI assistants using **Least Privilege Key Authentication**, **Application Default Credentials (ADC)**, and **Service Account Impersonation**.

</div>

---

## ⚡ Quick Start

Add to your MCP client configuration (e.g., `claude_desktop_config.json`, `mcp_config.json`, or Cursor):

```json
{
  "mcpServers": {
    "googledrive": {
      "command": "npx",
      "args": ["-y", "@hydrochlorix/googledrive-mcp-server"],
      "env": {
        "GOOGLE_DRIVE_SHARED_DRIVE_ID": "<YOUR_SHARED_DRIVE_ID>",
        "GOOGLE_DRIVE_ROOT_FOLDER_ID": "<OPTIONAL_ROOT_FOLDER_ID>"
      }
    }
  }
}
```

> [!CAUTION]
> **MANDATORY BOUNDARY (v2.3.0+)**
> `GOOGLE_DRIVE_SHARED_DRIVE_ID` is **MANDATORY**. The server will refuse to start without a configured Shared Drive boundary. `GOOGLE_DRIVE_ROOT_FOLDER_ID` is optional for further narrowing the boundary.
>
> [!WARNING]
> **STRUCTURED OPERATION LOGGING (v2.4.0+)**
> Direct `console.error()` calls have been **eliminated**. All process lifecycle events and crash tracebacks are written to a persistent NDJSON file at `~/.mcp/logs/operation.log` with clean `[LEVEL] message` output on `stderr`. Raw OAuth JSON responses (`invalid_grant`, `invalid_rapt`) are automatically sanitized into human-readable messages with actionable `hint` remediation steps.

---

## ✨ Features

- 🛡️ **Least Privilege Key Security**: Supports Service Account JSON keys alongside Application Default Credentials (ADC) while strongly enforcing Drive and Root Folder boundaries.
- 🎯 **Two-Layer Boundary Control**: Combined mandatory Shared Drive boundary with an optional narrower Root Folder boundary (`GOOGLE_DRIVE_ROOT_FOLDER_ID`).
- 🏢 **Google Workspace Shared Drive Support**: Full support for enterprise Shared Drives (`supportsAllDrives: true`) for 24/7 automation.
- 📋 **Structured Operation Logger**: Machine-readable NDJSON process log (`~/.mcp/logs/operation.log`) with crash reporting, zero-dependency sync durability, and automatic credential sanitization.
- 📂 **Automatic Local Destination Folders**: Missing local directory structures are created automatically when downloading files.
- 📄 **Auto-Text Workspace Docs Export**: Automatically converts Google Workspace Docs/Sheets to plain text (`text/plain`) for immediate consumption by LLMs.
- 📊 **Real-time Audit Dashboard**: Built-in SQLite WAL logger (`~/.mcp/audit.db`), REST API, SSE streaming, and a glassmorphism web SPA dashboard (default `http://127.0.0.1:3001`).
- 🔒 **Read-only Enforcement**: Option to restrict tool registration to read-only tools via `GOOGLE_DRIVE_MODE="readonly"`.

---

## 💡 Why @hydrochlorix/googledrive-mcp-server?

| Feature | Legacy SA Key JSON | OAuth 2.0 Client Secret | **@hydrochlorix/googledrive-mcp-server** |
| :--- | :---: | :---: | :---: |
| **Authentication** | Long-lived Private Key | User Refresh Tokens | **Least Privilege Key / ADC / Impersonation** |
| **Credentials on Disk** | ⚠️ High Risk (`.json`) | ⚠️ Plaintext Tokens | **✓ Supported (Keyless or Key-based)** |
| **Shared Drive Support** | Partial | Partial | **✓ Full Enterprise Support** |
| **Boundary Guardrail** | ✗ None | ✗ None | **✓ Shared Drive + Root Folder Boundary** |
| **Audit & Logging** | ✗ Console Log | ✗ Console Log | **✓ Embedded Dashboard & SQLite Engine** |
| **Read-Only Mode** | ✗ Manual Code Edit | ✗ Scope Editing | **✓ Environment Variable (`GOOGLE_DRIVE_MODE`)** |

---

## 🏗️ How It Works

```text
AI Assistant (e.g. Gemini / Claude / Cursor)
       │  MCP Protocol (stdio)
       ▼
googledrive-mcp-server (Node.js Process)
       │  Google Auth Application Default Credentials (ADC)
       ▼
Google Cloud IAM (Service Account Impersonation)
       │  Short-Lived Access Token (OAuth2)
       ▼
Google Drive API v3 (Shared Drive Boundary Enforcement)
```

---

## 🛠️ Tools

### 1. `drive_list_files` (Read)

List files and folders in Google Drive within configured boundaries.

- `pageSize` *(number, optional)*: Maximum number of items to return (1-100, default: 10).
- `query` *(string, optional)*: Search query string (e.g. `name contains 'Report'`).

### 2. `drive_download_file` (Read)

Download a file from Google Drive to local disk.

- `fileId` *(string, required)*: The ID of the file to download.
- `destPath` *(string, required)*: Local file path where the file will be saved. Missing parent directories are created automatically.

### 3. `drive_download_file_from_url` (Read)

Download a file using a public/shared Google Drive URL.

- `url` *(string, required)*: Full Google Drive shareable link.
- `destPath` *(string, required)*: Local file destination path.

### 4. `drive_create_folder` (Write)

Create a new folder inside Google Drive.

- `name` *(string, required)*: Name of the folder.
- `parentId` *(string, required)*: Parent folder ID within boundary.

### 5. `drive_upload_text_file` (Write)

Upload a text file to Google Drive.

- `name` *(string, required)*: File name.
- `content` *(string, required)*: Text file contents.
- `parentId` *(string, required)*: Parent folder ID within Shared Drive.

*Note: Setting `GOOGLE_DRIVE_MODE="readonly"` hides write tools (`drive_create_folder`, `drive_upload_text_file`).*

---

## 🚀 Setup & Authentication (3 Steps)

### Step 1: One-Time Google Cloud IAM Setup

```bash
gcloud config set project <PROJECT_ID>
gcloud services enable drive.googleapis.com iamcredentials.googleapis.com --project="<PROJECT_ID>"

# Grant Impersonation Permission to your user account
gcloud iam service-accounts add-iam-policy-binding <SERVICE_ACCOUNT_EMAIL> \
    --member="user:<YOUR_WORKSPACE_EMAIL>" \
    --role="roles/iam.serviceAccountTokenCreator" \
    --project="<PROJECT_ID>"
```

### Step 2: Configure Shared Drive Permissions

Add your Service Account email (`<SERVICE_ACCOUNT_EMAIL>`) as a member of your target Google Workspace Shared Drive (**Viewer** for read-only, **Contributor** for write access).

### Step 3: Authenticate (Choose A or B)

**Option A: Local Desktop (ADC / Impersonation)**
Run Application Default Credentials (ADC) login with impersonation:

```bash
# Desktop (GUI)
gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"

# Headless (WSL / SSH)
gcloud auth application-default login --no-browser --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"
```

Verify setup:

```bash
gcloud auth application-default print-access-token
```

**Option B: Server / 24-7 Headless (Least Privilege Key)**
For servers where session controls cause ADC to expire daily, use a Service Account JSON Key:

1. Ensure your Service Account has **no project-level IAM roles** (this enforces [Least Privilege](docs/architecture/least-privilege-model.md)). It only needs to be invited directly to the target Google Workspace Shared Drive.
2. Download the JSON key file to your server.
3. Set the environment variable in your MCP client config or shell:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account-key.json"
```

---

## 📊 Real-Time Audit & Governance Dashboard

Logs all MCP tool calls to SQLite (`~/.mcp/audit.db`) with zero performance overhead.

- **Dashboard Web UI**: `http://127.0.0.1:3001?token=<TOKEN>`
- **REST Logs API**: `GET http://127.0.0.1:3001/api/audit/logs`
- **SSE Stream**: `GET http://127.0.0.1:3001/api/audit/stream`
- **Environment Options**:
  - `MCP_DASHBOARD_ENABLED=false` — Disable dashboard server.
  - `MCP_DASHBOARD_PORT=3001` — Change HTTP port.
  - `MCP_DASHBOARD_TOKEN=<CUSTOM_TOKEN>` — Set authentication token.
- **Generate Token**: Run `npx -- @hydrochlorix/googledrive-mcp-server --gen-token` (or locally: `npm run build && node dist/server.mjs --gen-token`) to securely generate a 256-bit token.

### Dashboard Setup and Login

1. Generate a token. For an installed or published package:

   ```bash
   npx -y @hydrochlorix/googledrive-mcp-server --gen-token
   ```

   For a local checkout:

   ```bash
   npm run build
   node dist/server.mjs --gen-token
   ```

2. Copy the generated `MCP_DASHBOARD_TOKEN` value into the environment of the MCP server. For example:

   ```json
   {
     "mcpServers": {
       "googledrive": {
         "command": "npx",
         "args": ["-y", "@hydrochlorix/googledrive-mcp-server"],
         "env": {
           "GOOGLE_DRIVE_SHARED_DRIVE_ID": "<SHARED_DRIVE_ID>",
           "MCP_DASHBOARD_TOKEN": "<GENERATED_TOKEN>"
         }
       }
     }
   }
   ```

   Alternatively, set `MCP_DASHBOARD_TOKEN` in `.env` or in the shell that starts the server. Do not commit the token to Git or share it in logs.

3. Restart the MCP server. The dashboard listens on `http://127.0.0.1:3001` by default.

4. Open `http://127.0.0.1:3001` and enter the generated token in the login dialog. The token is stored only in the browser session and is removed when the session is cleared.

5. To call the REST API directly, send the token as a Bearer token:

   ```bash
   curl -H "Authorization: Bearer <GENERATED_TOKEN>" \
     http://127.0.0.1:3001/api/audit/logs
   ```

`MCP_DASHBOARD_TOKEN` protects the audit dashboard only. Google Drive access still requires ADC or the documented Service Account JSON fallback. If the dashboard is disabled with `MCP_DASHBOARD_ENABLED=false`, port 3001 is not opened.

---

## 💻 Development & Testing

- **Development Mode**: `npm run dev`
- **Build Production**: `npm run build`
- **Run Full Suite (Lint, Build & All Tests)**: `npm run test:all`
- **Run Unit Tests**: `npm test`
- **Run Dashboard & Security Tests**: `npm run test:dashboard`

---

## ❓ Troubleshooting

- **`insufficient authentication scopes` or 401/403 Permission Denied**: Re-run `gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"` (add `--no-browser` for headless/WSL).
- **`invalid_rapt` Reauthentication Error / Token Expiration**: Token expiration is typically governed by your Google Workspace Admin's Session Control policies.
  - **Local/Desktop**: Perform a clean reset using `gcloud auth revoke --all` followed by `gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"`.
  - **Server/Headless**: If you need 24/7 uptime without manual re-auth, you may use a Service Account JSON Key as a fallback (ADR-0011) by setting `export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"`.
- **Service Account Storage Quota Error**: Service accounts do not have personal Drive storage quota. Ensure uploads target a Google Workspace **Shared Drive**.

---

## 💖 Support

If this project helped you, please consider supporting its development!

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217" height="60">](https://www.buymeacoffee.com/hydrochlorix)

---

## 📜 License

Distributed under the [MIT License](LICENSE).
