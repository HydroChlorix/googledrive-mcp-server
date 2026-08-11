import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export type Transport = Parameters<McpServer["connect"]>[0];

import type { AuditLogger } from "../audit/types.js";
import type { BoundarySafeDriveClient } from "../core/DriveClient.js";
import { APP_VERSION } from "../version.js";

/**
 * A deep module that wraps MCP Tool registration, execution, error mapping, and audit logging.
 */
class McpPipeline {
  constructor(
    private readonly mcpServer: McpServer,
    private readonly auditLogger: AuditLogger,
  ) {}

  public register<T, S extends z.ZodRawShape>(
    name: string,
    description: string,
    schema: z.ZodObject<S>,
    actionFn: (args: z.infer<z.ZodObject<S>>) => Promise<T>,
    formatSuccess?: (result: T) => string,
  ) {
    this.mcpServer.registerTool(
      name,
      {
        description,
        inputSchema: schema,
      },
      async (args: z.infer<z.ZodObject<S>>) => {
        const execution = this.auditLogger.logExecution
          ? await this.auditLogger.logExecution(name, args as Record<string, unknown>, () =>
              actionFn(args),
            )
          : { result: await actionFn(args), error: undefined };
        const { result, error } = execution;

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
      },
    );
  }
}

export class McpServerApplication {
  private readonly mcpServer: McpServer;
  private readonly pipeline: McpPipeline;

  private readonly mode: "read" | "readwrite";

  constructor(
    private readonly driveClient: BoundarySafeDriveClient,
    private readonly auditLogger: AuditLogger,
    name = "googledrive-mcp-server",
    version: string = APP_VERSION,
    options: { mode?: "read" | "readwrite" } = {},
  ) {
    this.mcpServer = new McpServer({ name, version });
    this.pipeline = new McpPipeline(this.mcpServer, this.auditLogger);
    this.mode = options.mode || "readwrite";
    this.registerTools();
  }

  private registerTools() {
    this.pipeline.register(
      "drive_list_files",
      "List files in Google Drive. You can specify pageSize (max 100) and a search query.",
      z.object({
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
      }),
      (args) => this.driveClient.listFiles(args),
    );

    if (this.mode !== "read") {
      this.pipeline.register(
        "drive_upload_text_file",
        "Upload a text file to Google Drive",
        z.object({
          name: z.string().min(1, "File name is required").describe("Name of the file"),
          content: z
            .string()
            .min(1, "File content cannot be empty")
            .describe("Text content of the file"),
          parentId: z
            .string()
            .min(1, "Parent Folder ID is strictly required to prevent orphaned files")
            .describe("ID of the parent folder"),
        }),
        (args) => this.driveClient.uploadTextFile(args.name, args.content, args.parentId),
        (file) => `✅ Successfully uploaded file:\n${JSON.stringify(file, null, 2)}`,
      );

      this.pipeline.register(
        "drive_create_folder",
        "Create a new folder in Google Drive",
        z.object({
          name: z.string().min(1, "Folder name is required").describe("Name of the new folder"),
          parentId: z
            .string()
            .min(1, "Parent Folder ID is strictly required to prevent orphaned files")
            .describe("ID of the parent folder"),
        }),
        (args) => this.driveClient.createFolder(args.name, args.parentId),
        (folder) => `✅ Successfully created folder:\n${JSON.stringify(folder, null, 2)}`,
      );
    }

    this.pipeline.register(
      "drive_download_file",
      "Download a binary or regular file from Google Drive to the local file system (Note: Cannot download Google Docs/Sheets directly).",
      z.object({
        fileId: z.string().min(1, "File ID is required").describe("ID of the file to download"),
        destPath: z
          .string()
          .min(1, "Destination path (Local) is required")
          .describe("Local destination path (e.g. ./downloads/image.jpg)"),
      }),
      (args) => this.driveClient.downloadFile(args.fileId, args.destPath),
      (savedPath) => `✅ Successfully downloaded file to local path:\n${savedPath}`,
    );

    this.pipeline.register(
      "drive_download_file_from_url",
      "Download a file from an external Google Drive URL to the local file system.",
      z.object({
        url: z
          .string()
          .min(1, "Google Drive URL is required")
          .describe("Full Google Drive file/document URL"),
        destPath: z
          .string()
          .min(1, "Destination path (Local) is required")
          .describe("Local destination path (e.g. ./downloads/doc.txt)"),
      }),
      (args) => this.driveClient.downloadFileFromUrl(args.url, args.destPath),
      (savedPath) => `✅ Successfully downloaded file from URL to local path:\n${savedPath}`,
    );
  }

  public async connect(transport: Transport): Promise<void> {
    await this.mcpServer.connect(transport);
  }

  public getMcpServer(): McpServer {
    return this.mcpServer;
  }
}
