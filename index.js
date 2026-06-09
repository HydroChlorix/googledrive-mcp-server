#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { getDriveClient } = require('./src/auth.js');

async function main() {
  console.error("Starting Google Drive MCP Server (Keyless Auth)...");
  
  try {
    // Verify we can get a client (this will throw if ADC is not configured properly)
    // Note: We don't make an API call yet, just initialize the client wrapper.
    const driveClient = await getDriveClient();
    console.error("Successfully initialized Google Drive client via ADC.");

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

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Server connected to stdio transport.");

  } catch (error) {
    console.error("Failed to start server:");
    console.error(error.message);
    process.exit(1);
  }
}

main().catch(console.error);
