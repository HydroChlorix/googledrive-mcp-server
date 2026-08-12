import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteAuditLogger } from "../../src/audit/SqliteAuditLogger.js";
import { withAuditLogger } from "../../src/audit/middleware.js";

describe("withAuditLogger middleware", () => {
  let tempDbPath: string;
  let logger: SqliteAuditLogger;

  beforeEach(() => {
    tempDbPath = path.join(
      os.tmpdir(),
      `test-middleware-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );
    logger = new SqliteAuditLogger(tempDbPath);
  });

  afterEach(async () => {
    await logger.close();
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it("should wrap actionFn, execute it and log SUCCESS", async () => {
    const fn = async (args: { name: string }) => `Hello ${args.name}`;
    const wrapped = withAuditLogger(logger, "test_tool", fn);

    const res = await wrapped({ name: "World" });
    expect(res).toBe("Hello World");

    const queryRes = await logger.query({ toolName: "test_tool" });
    expect(queryRes.logs.length).toBe(1);
    expect(queryRes.logs[0]?.status).toBe("SUCCESS");
  });

  it("should classify boundary denied errors as DENIED", async () => {
    const fn = async () => {
      throw new Error("File outside Shared Drive boundary");
    };
    const wrapped = withAuditLogger(logger, "test_tool", fn);

    await expect(wrapped({})).rejects.toThrow("boundary");

    const queryRes = await logger.query({ toolName: "test_tool" });
    expect(queryRes.logs.length).toBe(1);
    expect(queryRes.logs[0]?.status).toBe("DENIED");
    expect(queryRes.logs[0]?.boundaryPassed).toBe(false);
  });
});
