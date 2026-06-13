#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { getDriveClient } = require('./src/auth.js');
const { searchFiles, getFileContent, getFileFromUrl, createFile, updateFile, getIdentity } = require('./src/tools.js');
const logger = require('./src/logger.js');

async function main() {
  logger.info("Starting Google Drive MCP Server (Keyless Auth)...");
  
  try {
    // Verify we can get a client (this will throw if ADC is not configured properly)
    const driveClient = await getDriveClient();
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
      }
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
                query: { type: "string", description: "The search query string (e.g., \"name contains 'report'\")." }
              },
              required: ["query"]
            }
          },
          {
            name: "get_file_content",
            description: "Read the content of a file. Google Workspace documents will be exported as plain text automatically.",
            inputSchema: {
              type: "object",
              properties: {
                fileId: { type: "string", description: "The ID of the file to read." }
              },
              required: ["fileId"]
            }
          },
          {
            name: "get_file_from_url",
            description: "Read the content of a Google Drive file from a shared URL. Supports Drive, Docs, Sheets, and Slides links.",
            inputSchema: {
              type: "object",
              properties: {
                url: { type: "string", description: "A Google Drive URL" }
              },
              required: ["url"]
            }
          },
          {
            name: "create_file",
            description: "Create a new file in the root folder.",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "The name of the new file." },
                content: { type: "string", description: "The text content of the file." },
                mimeType: { type: "string", description: "Optional MIME type (defaults to text/plain)." }
              },
              required: ["name", "content"]
            }
          },
          {
            name: "update_file",
            description: "Update the content of an existing file.",
            inputSchema: {
              type: "object",
              properties: {
                fileId: { type: "string", description: "The ID of the file to update." },
                content: { type: "string", description: "The new text content." }
              },
              required: ["fileId", "content"]
            }
          }
        ]
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const identity = await getIdentity();
      
      try {
        switch (request.params.name) {
          case "search_files": {
            const files = await searchFiles(request.params.arguments.query, identity);
            return {
              content: [{ type: "text", text: JSON.stringify(files, null, 2) }]
            };
          }
          case "get_file_content": {
            const content = await getFileContent(request.params.arguments.fileId, identity);
            return {
              content: [{ type: "text", text: content }]
            };
          }
          case "get_file_from_url": {
            const content = await getFileFromUrl(request.params.arguments.url, identity);
            return {
              content: [{ type: "text", text: content }]
            };
          }
          case "create_file": {
            const { name, content, mimeType } = request.params.arguments;
            const file = await createFile(name, content, mimeType, identity);
            return {
              content: [{ type: "text", text: JSON.stringify(file, null, 2) }]
            };
          }
          case "update_file": {
            const { fileId, content } = request.params.arguments;
            const file = await updateFile(fileId, content, identity);
            return {
              content: [{ type: "text", text: JSON.stringify(file, null, 2) }]
            };
          }
          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        };
      }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("MCP Server connected to stdio transport.");

  } catch (error) {
    logger.error("Failed to start server:");
    logger.error(error.message);
    process.exit(1);
  }
}

main().catch((err) => logger.error(err));
