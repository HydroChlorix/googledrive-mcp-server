import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createFolder, downloadFile, listFiles, uploadTextFile } from "../core/drive.js";

export const server: McpServer = new McpServer({
  name: "googledrive-mcp-server",
  version: "2.0.0",
});

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
  async (args) => {
    try {
      const files = await listFiles(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(files, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `❌ Execution Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "drive_upload_text_file",
  "Upload a text file to Google Drive",
  {
    name: z.string().min(1, "File name is required").describe("Name of the file"),
    content: z.string().min(1, "File content cannot be empty").describe("Text content of the file"),
    parentId: z.string().optional().describe("Optional ID of the parent folder"),
  },
  async (args) => {
    try {
      const file = await uploadTextFile(args.name, args.content, args.parentId);
      return {
        content: [
          {
            type: "text",
            text: `✅ Successfully uploaded file:\n${JSON.stringify(file, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `❌ Execution Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "drive_create_folder",
  "Create a new folder in Google Drive",
  {
    name: z.string().min(1, "Folder name is required").describe("Name of the new folder"),
    parentId: z.string().optional().describe("Optional ID of the parent folder"),
  },
  async (args) => {
    try {
      const folder = await createFolder(args.name, args.parentId);
      return {
        content: [
          {
            type: "text",
            text: `✅ Successfully created folder:\n${JSON.stringify(folder, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `❌ Execution Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
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
  async (args) => {
    try {
      const savedPath = await downloadFile(args.fileId, args.destPath);
      return {
        content: [
          {
            type: "text",
            text: `✅ Successfully downloaded file to local path:\n${savedPath}`,
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `❌ Execution Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 Google Drive MCP Server v2.0.0 is running on stdio");
}
