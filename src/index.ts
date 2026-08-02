#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./mcp/server.js";

export async function main(): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🚀 Google Drive MCP Server v2.0.0 is running on stdio");
  } catch (error) {
    console.error("❌ Fatal error: Failed to start MCP Server", error);
    process.exit(1);
  }
}

// ตรวจสอบว่าถ้าไฟล์นี้ถูกรันโดยตรง (ไม่ใช่ถูกเรียกผ่าน Unit Test) ค่อยสั่งรัน main()
const isMain =
  process.argv[1] &&
  (() => {
    try {
      return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
    } catch {
      return false;
    }
  })();

if (isMain) {
  main();
}
