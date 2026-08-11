import { McpServer } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoundarySafeDriveClient } from "../src/core/DriveClient.js";
import { McpServerApplication } from "../src/mcp/McpServerApplication.js";
import type { AuditLogger } from "../src/utils/auditLogger.js";
import { APP_VERSION } from "../src/version.js";

// Mock SDK ของ MCP Server
vi.mock("@modelcontextprotocol/server", () => {
  const mockRegisterTool = vi.fn();
  return {
    McpServer: vi.fn(
      class {
        registerTool = mockRegisterTool;
        connect = vi.fn();
      },
    ),
  };
});

describe("MCP Server Application Initialization", () => {
  const mockDriveClient = {} as BoundarySafeDriveClient;
  const mockAuditLogger = {} as AuditLogger;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize the McpServer with correct name and version", () => {
    new McpServerApplication(mockDriveClient, mockAuditLogger);

    expect(McpServer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "googledrive-mcp-server",
        version: APP_VERSION,
      }),
    );
  });

  it("should register 5 drive tools in readwrite mode by default", () => {
    new McpServerApplication(mockDriveClient, mockAuditLogger);

    const serverInstance = vi.mocked(McpServer).mock.results[0].value;

    expect(serverInstance.registerTool).toHaveBeenCalledTimes(5);
    // Verify that upload and create_folder were registered
    expect(serverInstance.registerTool).toHaveBeenCalledWith(
      "drive_upload_text_file",
      expect.any(Object),
      expect.any(Function),
    );
    expect(serverInstance.registerTool).toHaveBeenCalledWith(
      "drive_create_folder",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("should register only 3 drive tools in read mode", () => {
    new McpServerApplication(mockDriveClient, mockAuditLogger, undefined, undefined, {
      mode: "read",
    });

    const serverInstance = vi.mocked(McpServer).mock.results[0].value;

    expect(serverInstance.registerTool).toHaveBeenCalledTimes(3);
    expect(serverInstance.registerTool).toHaveBeenCalledWith(
      "drive_list_files",
      expect.any(Object),
      expect.any(Function),
    );
    expect(serverInstance.registerTool).toHaveBeenCalledWith(
      "drive_download_file",
      expect.any(Object),
      expect.any(Function),
    );
    expect(serverInstance.registerTool).toHaveBeenCalledWith(
      "drive_download_file_from_url",
      expect.any(Object),
      expect.any(Function),
    );
    // Verify write tools are NOT registered
    expect(serverInstance.registerTool).not.toHaveBeenCalledWith(
      "drive_upload_text_file",
      expect.any(Object),
      expect.any(Function),
    );
    expect(serverInstance.registerTool).not.toHaveBeenCalledWith(
      "drive_create_folder",
      expect.any(Object),
      expect.any(Function),
    );
  });
});
