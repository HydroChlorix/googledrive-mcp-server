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

  it("should generate token and exit 0 when --gen-token flag is passed", async () => {
    const originalArgv = process.argv;
    process.argv = [...originalArgv, "--gen-token"];
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await main();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("🔑 Generated Secure Dashboard Token:"),
    );
    expect(process.exit).toHaveBeenCalledWith(0);

    process.argv = originalArgv;
  });
});
