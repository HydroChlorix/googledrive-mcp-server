# Product Requirement Document (PRD)

## Project Title
**Local Google Drive MCP Server Integration via Service Account for Gemini CLI**

## 1. Objective
Transition the architecture from a Cloud-Hosted Remote MCP (limited by User OAuth) to a **Local MCP Server** running via command execution for **Gemini CLI**. The system will use a **Google Cloud Service Account (JSON Key)** for authentication to enable headless/autonomous workflows without requiring web browser-based verification.

## 2. Architecture & Components
* **MCP Client:** Gemini CLI (Running in a Local Environment such as Windows 11 or Ubuntu WSL).
* **Local MCP Server:** `mcp-google-drive` (Running via Node.js Runtime).
* **Authentication:** Google Cloud Service Account (JWT via a Private Key JSON file).
* **Target API:** Standard Google Drive API v3 (Direct interaction, not via Remote Drive MCP API).

## 3. Core Functional Requirements (Skills/Tools)
Gemini CLI must have full access to file management capabilities via these 4 core tools within the target folder scope:
1.  **`search_files`** (PRD: `drive_search`): Search for files or folders to retrieve File IDs or Parent Folder IDs.
2.  **`get_file_content`** (PRD: `drive_read_file`): Read file contents (Text/Data/Source) for processing.
3.  **`create_file`** (PRD: `drive_create_file`): Create new files in a specified folder (e.g., summary reports or system files).
4.  **`update_file`** (PRD: `drive_update_file`): Edit or append content to existing files.

## 4. Security & Access Control (Best Practices)
* **Principle of Least Privilege:** The Service Account must have **no IAM roles** in the Google Cloud Console for maximum security.
* **Data Isolation:** Access is restricted via Google Drive sharing mechanisms. The folder owner must grant **Editor** permissions to the Service Account's email address only for the specific designated folders.

## 5. Configuration Requirements & Strict Constraints

### ⚠️ [CRITICAL] Path Configuration
* **Do not modify or change existing path structures.** Use the paths already set up in the system, as they are already mapped correctly between Windows and WSL environments.
* The credentials variable must point accurately to the original JSON Key path.

### 📄 Target Config Layout for Gemini CLI
When writing or modifying the configuration for Gemini CLI, use the `command` execution structure and pass environment variables as follows:

```yaml
mcpServers:
  googledrive:
    # Run the Local Server via npx for Gemini CLI
    command: "npx"
    args: 
      - "-y"
      - "mcp-google-drive"
    env:
      # [CRITICAL] Do not change this path; use the existing system path.
      GOOGLE_SERVICE_ACCOUNT_KEY: "/path/to/existing/credentials.json"
      
      # Root folder ID shared with the Service Account.
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "${GOOGLE_DRIVE_ROOT_FOLDER_ID}"
```
