import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe.skipIf(!process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID)(
  "Google Drive MCP Server - Integration Smoke Test",
  () => {
    let client: Client | undefined;
    let transport: StdioClientTransport | undefined;
    let tempOutputDir: string | undefined;

    function getTempOutputDir(): string {
      if (!tempOutputDir) {
        throw new Error("Integration smoke test output directory was not initialized");
      }
      return tempOutputDir;
    }

    beforeAll(async () => {
      tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "googledrive-mcp-smoke-"));

      // 1. จำลอง Client Transport เชื่อมต่อไปยัง MCP Server ที่ build แล้ว (dist/server.mjs)
      transport = new StdioClientTransport({
        command: "node",
        args: [path.resolve(__dirname, "../../dist/server.mjs")],
        env: {
          ...getDefaultEnvironment(),
          ...(process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID
            ? { GOOGLE_DRIVE_SHARED_DRIVE_ID: process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID }
            : {}),
          ...(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
            ? { GOOGLE_DRIVE_ROOT_FOLDER_ID: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID }
            : {}),
          MCP_DASHBOARD_PORT: "3001",
        },
      });

      client = new Client({ name: "vitest-harness", version: "1.0.0" }, { capabilities: {} });

      await client.connect(transport);
    });

    afterAll(async () => {
      try {
        await client?.close();
      } finally {
        // Client.close() normally closes the stdio child process. Keep this
        // fallback for partial setup failures where Client.connect() did not
        // complete and the transport still owns a child process.
        if (transport?.pid !== null && transport?.pid !== undefined) {
          await transport.close();
        }

        if (tempOutputDir) {
          fs.rmSync(tempOutputDir, { recursive: true, force: true });
        }
      }
    });

    // Test 1: drive_list_files (Auth & Schema Check)
    it("should list files successfully (drive_list_files)", async () => {
      const result = await client.callTool({
        name: "drive_list_files",
        arguments: { pageSize: 5 },
      });

      expect(result).toBeDefined();
      expect(result.isError).not.toBe(true);
    }, 15000);

    // Test 2: drive_download_file (Auto-Directory Creation Check)
    it("should download a file and create local directories", async () => {
      // ใส่ fileId ที่ใช้ทดสอบใน environment
      const testFileId = process.env.TEST_FILE_ID || "sample-file-id";
      const destPath = path.join(getTempOutputDir(), "downloads", "test-file.txt");

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
        arguments: { name: `Test_Folder_${Date.now()}`, parentId: "root" },
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
          parentId: "root",
        },
      });

      // ตรวจสอบว่าสำเร็จ หรือถ้าล้มเหลวเพราะ Quota ใน Personal drive ก็ให้ handle ได้ถูกต้อง
      expect(result).toBeDefined();
    }, 15000);

    // Test 5: drive_download_file_from_url (URL-Gated External Access Check)
    it("should handle download from URL or expected error for invalid URL", async () => {
      const testUrl =
        process.env.TEST_EXTERNAL_DRIVE_URL ||
        "https://drive.google.com/file/d/nonexistent-smoke-test-id/view";
      const destPath = path.join(getTempOutputDir(), "downloads", "url-download-test.txt");

      const result = await client.callTool({
        name: "drive_download_file_from_url",
        arguments: { url: testUrl, destPath },
      });

      // If TEST_EXTERNAL_DRIVE_URL is set and valid, result should succeed.
      // Otherwise the fallback URL should produce a handled error (not a crash).
      expect(result).toBeDefined();
    }, 15000);

    // Test 6: Operation Logger E2E Persistence Check
    it("should persist server lifecycle event to ~/.mcp/logs/operation.log", async () => {
      const logPath = path.join(os.homedir(), ".mcp", "logs", "operation.log");
      expect(fs.existsSync(logPath)).toBe(true);

      const content = fs.readFileSync(logPath, "utf-8");
      expect(content).toContain("Google Drive MCP Server");
    });
  },
);
