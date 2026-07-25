import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 1. Mock SDK ของ MCP Server
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => {
  const mockSetRequestHandler = vi.fn();
  return {
    Server: vi.fn().mockImplementation(() => ({
      setRequestHandler: mockSetRequestHandler,
      onerror: vi.fn(),
    })),
    CallToolRequestSchema: {},
    ListToolsRequestSchema: {},
  };
});

// Mock Core Functions ของ Drive เพื่อไม่ให้ถูกเรียกจริงๆ
vi.mock("../src/core/drive.js", () => ({
  listFiles: vi.fn(),
  uploadTextFile: vi.fn(),
  createFolder: vi.fn(),
  downloadFile: vi.fn(),
}));

describe("MCP Server Initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should initialize the MCP Server with correct name and version", async () => {
    // ใช้ dynamic import เพื่อโหลดไฟล์เซิร์ฟเวอร์
    await import("../src/mcp/server.js");

    // ตรวจสอบว่าคลาส Server ถูกเรียกสร้างด้วยชื่อและเวอร์ชันที่ถูกต้อง
    expect(Server).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "googledrive-mcp-server",
        version: "2.0.0", // ตรวจสอบเวอร์ชันให้ตรงกับที่เราตั้งไว้
      }),
      expect.objectContaining({
        capabilities: {
          tools: {},
        },
      }),
    );
  });

  it("should register handlers for ListTools and CallTool", async () => {
    await import("../src/mcp/server.js");

    // ดึง instance จำลองของ Server ที่ถูกสร้างขึ้นมา
    const serverInstance = vi.mocked(Server).mock.results[0].value;

    // ตรวจสอบว่าได้ตั้งค่า Handler (setRequestHandler) อย่างน้อย 2 ตัว
    expect(serverInstance.setRequestHandler).toHaveBeenCalledTimes(2);
  });
});
