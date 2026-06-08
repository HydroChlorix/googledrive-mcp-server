# Context: Google Drive MCP Server Integration

## Glossary

### Service Account
A Google Cloud identity intended for automated workflows and server-to-server interactions. In this project, it is authenticated using a Private Key JSON file and is used to bypass User OAuth requirements.

### Root Folder
The designated Google Drive folder (identified by `GOOGLE_DRIVE_ROOT_FOLDER_ID`) that serves as the isolated workspace for the MCP server. All operations are restricted to this folder and its sub-directories.

### Local MCP Server
The `mcp-google-drive` package executed locally within the environment (WSL/Ubuntu) using `npx`. It translates MCP tool calls into Google Drive API requests.

### Core Tools
The server provides the following tools (mapped from PRD requirements):
* `search_files` (PRD: `drive_search`)
* `get_file_content` (PRD: `drive_read_file`)
* `create_file` (PRD: `drive_create_file`)
* `update_file` (PRD: `drive_update_file`)

### Editor Permission
The specific Google Drive sharing level granted to the Service Account's email address by the folder owner. This permission is necessary for the server to perform file creation and updates.

### Principle of Least Privilege
The security practice of ensuring the Service Account has no global IAM roles in Google Cloud Console, with access restricted solely through Drive-level folder sharing.
