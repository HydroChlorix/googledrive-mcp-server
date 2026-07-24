# Project: google-drive-mcp-server-url-tool

## Architecture
- `src/tools.js` handles file operations. It imports `src/auth.js` for authenticating the google client.
- `src/urlParser.js` is a new module to extract the Google Drive File ID from Google Drive URLs and documents.
- `index.js` handles MCP Protocol. It defines standard tools and handles tool calls by calling functions in `src/tools.js` and `src/urlParser.js`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | R1: Fetch Helper | Extract content-fetching/exporting logic from getFileContent to a shared internal helper function. | none | DONE |
| 2 | R2: URL Parser | Create src/urlParser.js to extract file ID from 5 URL patterns, rejecting bare IDs and folders. | none | DONE |
| 3 | R3: Wire-Up & Integration | Register get_file_from_url tool in index.js, utilizing R1 and R2. Add tests and E2E verification. | M1, M2 | DONE |

## Interface Contracts
### `src/urlParser.js` ↔ `index.js` / `src/tools.js`
- `parseDriveUrl(url)`: returns `fileId` (string). Throws clear, descriptive Error if input is invalid, a folder, a bare file ID, or a non-Google-Drive URL.

### `src/tools.js` ↔ `index.js`
- `fetchDriveFileContent(fileId, identity)`: internal helper to fetch file metadata, perform auto-text export (ADR-0003) for Google Workspace files, and read content for normal files. No Root Folder checks. Returns string content.
- `getFileContent(fileId, identity)`: existing tool handler. Continues to enforce Root Folder check, then calls `fetchDriveFileContent(fileId, identity)`.
- `getFileContentFromUrl(url, identity)`: new function for get_file_from_url tool. Parses URL using `parseDriveUrl`, then calls `fetchDriveFileContent(fileId, identity)`. Logs identity-rich logs (ADR-0004).

## Code Layout
- `src/auth.js`: Keyless auth logic (ADC/WIF). Checks for JSON key files and fails if detected (ADR-0001).
- `src/logger.js`: Logging utilities.
- `src/tools.js`: Google Drive file actions (search, get content, create, update, get identity, new fetch helper).
- `src/urlParser.js`: Google Drive URL parsing logic.
- `index.js`: MCP server setup and tool handler registrations.
- `tests/tools.test.js`: Tools unit tests.
- `tests/urlParser.test.js`: URL parser unit tests.
