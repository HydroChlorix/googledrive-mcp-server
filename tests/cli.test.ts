import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("CLI Smoke Test (bundled dist/server.mjs)", () => {
  it("should generate a 64-char hex token when --gen-token is passed to dist/server.mjs", async () => {
    const serverPath = path.resolve(__dirname, "../dist/server.mjs");
    const { stdout, stderr } = await execFileAsync("node", [serverPath, "--gen-token"]);

    expect(stderr).toBe("");
    expect(stdout).toContain("🔑 Generated Secure Dashboard Token:");
    expect(stdout).toContain("MCP_DASHBOARD_TOKEN=");

    // Extract token string matching 64 hex characters
    const hexTokenMatch = stdout.match(/[a-f0-9]{64}/i);
    expect(hexTokenMatch).not.toBeNull();
    expect(hexTokenMatch?.[0]).toHaveLength(64);
  }, 15000);
});
