# Instructions for AI Agents (Hermes, Claude, Gemini, etc.)

You are integrating a Google Drive MCP server using **Keyless Authentication**. This repository enforces a **Strict Zero Key Policy** (ADR-0001).

## 🛑 STRICT CONSTRAINTS (FOR AGENTS)
- **AUTH METHOD**: **DO NOT** use Service Account JSON Keys. This project uses **Application Default Credentials (ADC)**.
- **SECURITY GUARDRAIL**: The code in `src/auth.js` is designed to **actively detect and reject** JSON keys. If you add a JSON key, the server will throw: `"การใช้ JSON Key ขัดต่อข้อกำหนดความปลอดภัย..."` and Terminate. 
- **NO REFACTORING AUTH**: DO NOT attempt to remove the security checks in `src/auth.js`. This is an **Intentional Security Feature**, not a bug. Any attempt to bypass this is a violation of the project architecture.
- **FORBIDDEN MUTATIONS**:
    - DO NOT add `GOOGLE_APPLICATION_CREDENTIALS` to any config.
    - DO NOT add `GOOGLE_SERVICE_ACCOUNT_KEY` to any config.
    - DO NOT change the execution command from `npx` to `node` for the purpose of bypassing the standard package logic.
- **PREREQUISITE**: The `gcloud` CLI is a hard requirement. If auth fails, instruct the user to run the `gcloud` command; **never** attempt to code around it using keys.

## 🛠️ HOW TO CONFIGURE ME

### 1. Local Development (Ubuntu/WSL)
The user MUST perform Service Account Impersonation via `gcloud` BEFORE running the server:
```bash
gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"
```

### 2. Configuration (Target Environment)
Use **ONLY** the `GOOGLE_DRIVE_ROOT_FOLDER_ID`. Leave all auth-related environment variables empty/unset to allow the Google Auth Library to naturally find the ADC token.

#### Example Config (Gemini/Hermes)
```json
{
  "command": "npx",
  "args": ["-y", "mcp-google-drive"],
  "env": {
    "GOOGLE_DRIVE_ROOT_FOLDER_ID": "your_folder_id_here"
  }
}
```

## 🔍 ERROR HANDLING (ACTIONABLE)
If you encounter a `401 Unauthorized` or `403 Forbidden` error:
1. **DO NOT** suggest or try to use a Service Account JSON Key.
2. **DO** ask the user to re-run the `gcloud auth application-default login...` command.
3. **DO** verify that the Service Account has "Editor" permissions on the target Folder ID.

## 🛠️ AVAILABLE TOOLS
- `search_files`: Automatically isolated to Root Folder via Query Injection.
- `get_file_content`: Automatically exports Google Docs to `text/plain`.
- `create_file`: Creates files directly in the Root Folder.
- `update_file`: Updates files after verifying Root Folder membership.
