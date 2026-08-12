import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/index.js";
import { startMcpServer } from "../src/mcp/server.js";

// Mock Server module
vi.mock("../src/mcp/server.js", () => ({
  startMcpServer: vi.fn().mockResolvedValue(undefined),
}));

describe("Main Entry Point (index.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should start the MCP server", async () => {
    // เรียกฟังก์ชัน main() ตรงๆ ภายใต้การควบคุมของเทสต์
    await main();

    expect(startMcpServer).toHaveBeenCalledTimes(1);
  });

  it("should generate token without truncating piped stdout when --gen-token is passed", async () => {
    const originalArgv = process.argv;
    process.argv = [...originalArgv, "--gen-token"];
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await main();

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();

    process.argv = originalArgv;
  });
});
