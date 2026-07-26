# Context: Google Drive MCP Server Integration

## Glossary

### Service Account
A Google Cloud identity intended for automated workflows and server-to-server interactions. In this project, it is authenticated using Keyless methods (ADC/WIF) to bypass User OAuth requirements while maintaining a Zero Key Policy.

### Keyless Authentication
An authentication architecture that eliminates the use of Private Key JSON files. It relies on Application Default Credentials (ADC) for local environments or Workload Identity Federation (WIF) for production, enhancing security and mitigating credential leak risks.

### Service Account Impersonation
The process where a user (developer) leverages their own identity to request a short-lived access token on behalf of a Service Account. This requires the `roles/iam.serviceAccountTokenCreator` IAM role.

### Transparent ADC
A strategy for utilizing Application Default Credentials where the MCP Server codebase does not explicitly specify the Service Account email or load key files directly. Instead, it seamlessly adopts the identity configured in the environment (e.g., via gcloud impersonation).

### Strict Zero Key Enforcement
A runtime security measure where the MCP Server actively inspects the credential configuration and immediately terminates execution if a long-lived Private Key (JSON Key) is detected, ensuring strict adherence to the Zero Key Policy.

### Permission-Based Drive Access
Access control is managed dynamically at the Google Drive permission level. Any folder or file explicitly shared with the Service Account email address is immediately accessible by the MCP server without requiring environment variable configuration.

### Explicit Auth Feedback
An error handling strategy where the MCP Server returns clear, actionable messages to the AI Agent upon authentication failure, enabling the Agent to instruct the user to run the appropriate `gcloud` command to refresh tokens.

### User-Friendly Auth Errors
An error handling strategy where the MCP Server provides step-by-step resolution guidance (e.g., the specific `gcloud` command to execute) when it detects authentication failures or expired tokens.

### Auto-Text Export
A file handling strategy for Google Workspace documents (Docs, Sheets, Slides). When `get_file_content` is invoked, the MCP Server automatically converts the content to `text/plain`, allowing AI Agents to process the data immediately without managing complex export MIME types.

### Identity-Rich Logs
A logging strategy that captures and includes the identity of the actual user (User Email) impersonating the Service Account during operations. This enables accurate audit trails to determine who initiated specific actions within Google Drive.

### Local MCP Server
The `mcp-google-drive` package executed locally within the environment (WSL/Ubuntu) using `npx`. It translates MCP tool calls into Google Drive API requests.

### Core Tools
The server provides the following tools:
* `drive_list_files`
* `drive_upload_text_file`
* `drive_create_folder`
* `drive_download_file`

### Editor Permission
The specific Google Drive sharing level granted to the Service Account's email address by the folder owner. This permission is necessary for the server to perform file creation and updates.

### Principle of Least Privilege
The security practice of ensuring the Service Account has no global IAM roles in Google Cloud Console, with access restricted solely through Drive-level folder sharing.
