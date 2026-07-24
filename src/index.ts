#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getDriveClient } from "./auth.js";
import logger from "./logger.js";
import {
  createFile,
  getFileContent,
  getFileFromUrl,
  getIdentity,
  searchFiles,
  updateFile,
} from "./tools.js";

export async function main() {
  logger.info("Starting Google Drive MCP Server (Keyless Auth)...");

  try {
    await getDriveClient();
    logger.info("Successfully initialized Google Drive client via ADC.");

    const server = new Server(
      {
        name: "googledrive-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "search_files",
            description: "Search for files in the designated Google Drive root folder.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query string (e.g., \"name contains 'report'\").",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "get_file_content",
            description:
              "Read the content of a file. Google Workspace documents will be exported as plain text automatically.",
            inputSchema: {
              type: "object",
              properties: {
                fileId: {
                  type: "string",
                  description: "The ID of the file to read.",
                },
              },
              required: ["fileId"],
            },
          },
          {
            name: "get_file_from_url",
            description:
              "Read the content of a Google Drive file from a shared URL. Supports Drive, Docs, Sheets, and Slides links.",
            inputSchema: {
              type: "object",
              properties: {
                url: { type: "string", description: "A Google Drive URL" },
              },
              required: ["url"],
            },
          },
          {
            name: "create_file",
            description: "Create a new file in the root folder.",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "The name of the new file.",
                },
                content: {
                  type: "string",
                  description: "The text content of the file.",
                },
                mimeType: {
                  type: "string",
                  description: "Optional MIME type (defaults to text/plain).",
                },
              },
              required: ["name", "content"],
            },
          },
          {
            name: "update_file",
            description: "Update the content of an existing file.",
            inputSchema: {
              type: "object",
              properties: {
                fileId: {
                  type: "string",
                  description: "The ID of the file to update.",
                },
                content: {
                  type: "string",
                  description: "The new text content.",
                },
              },
              required: ["fileId", "content"],
            },
          },
        ],
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const identity = await getIdentity();
      const args = request.params.arguments || {};

      try {
        switch (request.params.name) {
          case "search_files": {
            const query = (args["query"] as string) || "";
            const files = await searchFiles(query, identity);
            return {
              content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
            };
          }
          case "get_file_content": {
            const fileId = (args["fileId"] as string) || "";
            const content = await getFileContent(fileId, identity);
            return {
              content: [{ type: "text", text: content }],
            };
          }
          case "get_file_from_url": {
            const url = (args["url"] as string) || "";
            const content = await getFileFromUrl(url, identity);
            return {
              content: [{ type: "text", text: content }],
            };
          }
          case "create_file": {
            const name = (args["name"] as string) || "";
            const contentArg = (args["content"] as string) || "";
            const mimeType = (args["mimeType"] as string) || "text/plain";
            const file = await createFile(name, contentArg, mimeType, identity);
            return {
              content: [{ type: "text", text: JSON.stringify(file, null, 2) }],
            };
          }
          case "update_file": {
            const fileId = (args["fileId"] as string) || "";
            const contentArg = (args["content"] as string) || "";
            const file = await updateFile(fileId, contentArg, identity);
            return {
              content: [{ type: "text", text: JSON.stringify(file, null, 2) }],
            };
          }
          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error: unknown) {
        const err = error as Error;
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("MCP Server connected to stdio transport.");
  } catch (error: unknown) {
    const err = error as Error;
    logger.error("Failed to start server:");
    logger.error(err.message);
    process.exit(1);
  }
}

// Only invoke main when run directly
if (process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts")) {
  main().catch((err) => logger.error(err));
}
