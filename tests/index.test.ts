import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/index.js";

// Mock Stdio Transport
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(class {}),
}));

// Mock Server
vi.mock("../src/mcp/server.js", () => ({
  server: {
    connect: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Main Entry Point (index.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize transport and connect the server", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // เรียกฟังก์ชัน main() ตรงๆ ภายใต้การควบคุมของเทสต์
    await main();

    expect(StdioServerTransport).toHaveBeenCalledTimes(1);

    const { server } = await import("../src/mcp/server.js");
    expect(server.connect).toHaveBeenCalledTimes(1);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("is running on stdio"));
  });
});
