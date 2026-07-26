# Project: googledrive-mcp-server

Google Drive MCP Server (v2.0.0) implemented in TypeScript using Keyless Authentication (ADC/WIF), Biome, Vitest, and the High-Level `McpServer` SDK (`@modelcontextprotocol/sdk/server/mcp.js`).

## Architecture & Code Layout

- **`src/core/auth.ts`**: Handles Google Drive API authentication using Keyless Application Default Credentials (ADC via `GoogleAuth`). Enforces Zero Key Policy (ADR-0001) as a singleton client.
- **`src/core/drive.ts`**: Core Google Drive file operations (`listFiles`, `uploadTextFile`, `createFolder`, `downloadFile`).
- **`src/mcp/server.ts`**: High-level MCP Server (`McpServer`). Registers tools (`drive_list_files`, `drive_upload_text_file`, `drive_create_folder`, `drive_download_file`) with Zod schemas and DRY error handling helper `handleToolExecution`.
- **`src/index.ts`**: Application entry point. Connects `McpServer` to `StdioServerTransport`.

## Automated Tooling & Testing

- **Compiler**: TypeScript 7.x (`tsconfig.json`, `NodeNext` ESM modules)
- **Bundler**: Vite (`vite build` → `dist/server.mjs`)
- **Linter & Formatter**: Biome (`biome.json`, `npm run lint`)
- **Test Runner**: Vitest (`tests/auth.test.ts`, `tests/drive.test.ts`, `tests/index.test.ts`, `tests/server.test.ts`)

## Available MCP Tools

1. `drive_list_files`: List files in Google Drive with optional `pageSize` (max 100) and `query` search string.
2. `drive_upload_text_file`: Upload a text file with `name`, `content`, and optional `parentId`.
3. `drive_create_folder`: Create a new folder with `name` and optional `parentId`.
4. `drive_download_file`: Download a binary/regular file from Google Drive using `fileId` and `destPath`.
