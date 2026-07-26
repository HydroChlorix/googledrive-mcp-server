import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 1. Mock SDK ของ MCP Server
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  const mockTool = vi.fn();
  return {
    McpServer: vi.fn(
      class {
        tool = mockTool;
        connect = vi.fn();
      },
    ),
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

  it("should initialize the McpServer with correct name and version", async () => {
    await import("../src/mcp/server.js");

    expect(McpServer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "googledrive-mcp-server",
        version: "2.0.0",
      }),
    );
  });

  it("should register 4 drive tools", async () => {
    await import("../src/mcp/server.js");

    const serverInstance = vi.mocked(McpServer).mock.results[0].value;

    expect(serverInstance.tool).toHaveBeenCalledTimes(4);
    expect(serverInstance.tool).toHaveBeenNthCalledWith(
      1,
      "drive_list_files",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );
    expect(serverInstance.tool).toHaveBeenNthCalledWith(
      2,
      "drive_upload_text_file",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );
    expect(serverInstance.tool).toHaveBeenNthCalledWith(
      3,
      "drive_create_folder",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );
    expect(serverInstance.tool).toHaveBeenNthCalledWith(
      4,
      "drive_download_file",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );
  });
});
