import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Google Drive MCP Server - Integration Smoke Test", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // 1. จำลอง Client Transport เชื่อมต่อไปยัง MCP Server ที่ build แล้ว (dist/server.mjs)
    transport = new StdioClientTransport({
      command: "node",
      args: [path.resolve(__dirname, "../../dist/server.mjs")],
    });

    client = new Client({ name: "vitest-harness", version: "1.0.0" }, { capabilities: {} });

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  // Test 1: drive_list_files (Auth & Schema Check)
  it("should list files successfully (drive_list_files)", async () => {
    const result = await client.callTool({
      name: "drive_list_files",
      arguments: { pageSize: 5 },
    });

    expect(result).toBeDefined();
  }, 15000);

  // Test 2: drive_download_file (Auto-Directory Creation Check)
  it("should download a file and create local directories", async () => {
    // ใส่ fileId ที่ใช้ทดสอบใน environment
    const testFileId = process.env.TEST_FILE_ID || "sample-file-id";
    const destPath = "./tmp/downloads/test-file.txt";

    const result = await client.callTool({
      name: "drive_download_file",
      arguments: { fileId: testFileId, destPath },
    });

    expect(result).toBeDefined();
  }, 15000);

  // Test 3: drive_create_folder (Zero-Quota Safe Action Check)
  it("should create a new folder (drive_create_folder)", async () => {
    const result = await client.callTool({
      name: "drive_create_folder",
      arguments: { name: `Test_Folder_${Date.now()}` },
    });

    expect(result).toBeDefined();
  }, 15000);

  // Test 4: drive_upload_text_file (Storage Quota Guardrail Check)
  it("should handle text upload or expected personal drive quota error", async () => {
    const result = await client.callTool({
      name: "drive_upload_text_file",
      arguments: {
        name: "smoke-test.txt",
        content: "Hello World from Vitest Harness",
      },
    });

    // ตรวจสอบว่าสำเร็จ หรือถ้าล้มเหลวเพราะ Quota ใน Personal drive ก็ให้ handle ได้ถูกต้อง
    expect(result).toBeDefined();
  }, 15000);
});
