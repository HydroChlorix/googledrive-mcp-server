import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createFolder, downloadFile, listFiles, uploadTextFile } from "../core/drive.js";

import { defaultAuditLogger } from "../utils/auditLogger.js";

export const server: McpServer = new McpServer({
  name: "googledrive-mcp-server",
  version: "2.0.0",
});

async function handleToolExecution<T>(
  toolName: string,
  args: Record<string, unknown>,
  actionFn: () => Promise<T>,
  formatSuccess?: (result: T) => string,
) {
  const { result, error } = await defaultAuditLogger.logExecution(toolName, args, actionFn);

  if (error !== undefined) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: `❌ Execution Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  const text = formatSuccess
    ? formatSuccess(result as T)
    : typeof result === "string"
      ? result
      : JSON.stringify(result, null, 2);

  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}

server.tool(
  "drive_list_files",
  "List files in Google Drive. You can specify pageSize (max 100) and a search query.",
  {
    pageSize: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Number of files to return (default 10)"),
    query: z
      .string()
      .optional()
      .describe('Google Drive search query string (e.g. name contains "report")'),
  },
  async (args) => handleToolExecution("drive_list_files", args, () => listFiles(args)),
);

server.tool(
  "drive_upload_text_file",
  "Upload a text file to Google Drive",
  {
    name: z.string().min(1, "File name is required").describe("Name of the file"),
    content: z.string().min(1, "File content cannot be empty").describe("Text content of the file"),
    parentId: z.string().optional().describe("Optional ID of the parent folder"),
  },
  async (args) =>
    handleToolExecution(
      "drive_upload_text_file",
      args,
      () => uploadTextFile(args.name, args.content, args.parentId),
      (file) => `✅ Successfully uploaded file:\n${JSON.stringify(file, null, 2)}`,
    ),
);

server.tool(
  "drive_create_folder",
  "Create a new folder in Google Drive",
  {
    name: z.string().min(1, "Folder name is required").describe("Name of the new folder"),
    parentId: z.string().optional().describe("Optional ID of the parent folder"),
  },
  async (args) =>
    handleToolExecution(
      "drive_create_folder",
      args,
      () => createFolder(args.name, args.parentId),
      (folder) => `✅ Successfully created folder:\n${JSON.stringify(folder, null, 2)}`,
    ),
);

server.tool(
  "drive_download_file",
  "Download a binary or regular file from Google Drive to the local file system (Note: Cannot download Google Docs/Sheets directly).",
  {
    fileId: z.string().min(1, "File ID is required").describe("ID of the file to download"),
    destPath: z
      .string()
      .min(1, "Destination path (Local) is required")
      .describe("Local destination path (e.g. ./downloads/image.jpg)"),
  },
  async (args) =>
    handleToolExecution(
      "drive_download_file",
      args,
      () => downloadFile(args.fileId, args.destPath),
      (savedPath) => `✅ Successfully downloaded file to local path:\n${savedPath}`,
    ),
);

export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 Google Drive MCP Server v2.0.0 is running on stdio");
}
