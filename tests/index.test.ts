import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { type Mock, afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDriveClient } from "../src/auth.js";
import { main as startServer } from "../src/index.js";
import { getFileFromUrl } from "../src/tools.js";

const mockGetDriveClient = vi.fn();
vi.mock("../src/auth.js", () => ({
  getDriveClient: () => mockGetDriveClient(),
}));

const mockSearchFiles = vi.fn();
const mockGetFileContent = vi.fn();
const mockGetFileFromUrl = vi.fn();
const mockCreateFile = vi.fn();
const mockUpdateFile = vi.fn();
const mockGetIdentity = vi.fn().mockResolvedValue("test-user@example.com");

vi.mock("../src/tools.js", () => ({
  searchFiles: (...args: unknown[]) => mockSearchFiles(...args),
  getFileContent: (...args: unknown[]) => mockGetFileContent(...args),
  getFileFromUrl: (...args: unknown[]) => mockGetFileFromUrl(...args),
  createFile: (...args: unknown[]) => mockCreateFile(...args),
  updateFile: (...args: unknown[]) => mockUpdateFile(...args),
  getIdentity: () => mockGetIdentity(),
}));

let listToolsHandler: () => Promise<{
  tools: Array<{
    name: string;
    description: string;
    inputSchema: { properties: Record<string, unknown>; required: string[] };
  }>;
}>;
let callToolHandler: (request: {
  params: { name: string; arguments?: Record<string, unknown> };
}) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

const mockServerInstance = {
  setRequestHandler: vi.fn((schema: unknown, handler: unknown) => {
    if (schema === ListToolsRequestSchema) {
      listToolsHandler = handler as typeof listToolsHandler;
    } else if (schema === CallToolRequestSchema) {
      callToolHandler = handler as typeof callToolHandler;
    }
  }),
  connect: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: vi.fn().mockImplementation(() => mockServerInstance),
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../src/logger.js", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Index.js MCP Server End-to-End Integration", () => {
  let consoleErrorSpy: Mock;

  beforeAll(async () => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetDriveClient.mockResolvedValue({});
    await startServer();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should register get_file_from_url tool in ListToolsRequestSchema", async () => {
    expect(listToolsHandler).toBeDefined();
    const result = await listToolsHandler();
    const tool = result.tools.find((t) => t.name === "get_file_from_url");
    expect(tool).toBeDefined();
    expect(tool?.description).toContain(
      "Read the content of a Google Drive file from a shared URL",
    );
    expect(tool?.inputSchema.properties["url"]).toBeDefined();
    expect(tool?.inputSchema.required).toContain("url");
  });

  it("should handle get_file_from_url call tool request successfully", async () => {
    expect(callToolHandler).toBeDefined();
    const testUrl = "https://docs.google.com/document/d/12345/edit";
    const testContent = "Hello URL file content";

    mockGetFileFromUrl.mockResolvedValue(testContent);

    const response = await callToolHandler({
      params: {
        name: "get_file_from_url",
        arguments: { url: testUrl },
      },
    });

    expect(mockGetFileFromUrl).toHaveBeenCalledWith(testUrl, "test-user@example.com");
    expect(response).toEqual({
      content: [{ type: "text", text: testContent }],
    });
  });

  it("should return isError when get_file_from_url fails", async () => {
    expect(callToolHandler).toBeDefined();
    const testUrl = "invalid-url";

    mockGetFileFromUrl.mockRejectedValue(
      new Error("Bare file ID provided. A full Google Drive URL is required."),
    );

    const response = await callToolHandler({
      params: {
        name: "get_file_from_url",
        arguments: { url: testUrl },
      },
    });

    expect(response).toEqual({
      content: [
        {
          type: "text",
          text: "Error: Bare file ID provided. A full Google Drive URL is required.",
        },
      ],
      isError: true,
    });
  });
});
