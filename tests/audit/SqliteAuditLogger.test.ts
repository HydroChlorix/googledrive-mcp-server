import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteAuditLogger } from "../../src/audit/SqliteAuditLogger.js";

describe("SqliteAuditLogger", () => {
  let tempDbPath: string;
  let logger: SqliteAuditLogger;

  beforeEach(() => {
    tempDbPath = path.join(
      os.tmpdir(),
      `test-audit-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );
    logger = new SqliteAuditLogger(tempDbPath);
  });

  afterEach(async () => {
    await logger.close();
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it("should log event with low latency and query it back", async () => {
    const start = performance.now();
    logger.log({
      toolName: "drive_list_files",
      args: { pageSize: 10 },
      executionTimeMs: 15.5,
      status: "SUCCESS",
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50); // Fast sync push

    const result = await logger.query({ toolName: "drive_list_files" });
    expect(result.logs.length).toBe(1);
    expect(result.logs[0]?.toolName).toBe("drive_list_files");
    expect(result.logs[0]?.status).toBe("SUCCESS");
  });

  it("should emit log event for real-time listeners", async () => {
    let receivedTool = "";
    logger.on("log", (record) => {
      receivedTool = record.toolName;
    });

    logger.log({
      toolName: "drive_upload_text_file",
      args: { name: "test.txt" },
      executionTimeMs: 42,
      status: "SUCCESS",
    });

    expect(receivedTool).toBe("drive_upload_text_file");
  });

  it("should calculate metrics correctly", async () => {
    logger.log({
      toolName: "drive_list_files",
      executionTimeMs: 10,
      status: "SUCCESS",
    });
    logger.log({
      toolName: "drive_download_file",
      executionTimeMs: 30,
      status: "DENIED",
      boundaryPassed: false,
    });

    const metrics = await logger.getMetrics();
    expect(metrics.totalCalls).toBe(2);
    expect(metrics.successCount).toBe(1);
    expect(metrics.deniedCount).toBe(1);
    expect(metrics.boundaryAlertsCount).toBe(1);
  });

  it("should query logs correctly when filtering by YYYY-MM-DD date range", async () => {
    logger.log({
      toolName: "drive_list_files",
      executionTimeMs: 10,
      status: "SUCCESS",
    });

    const todayStr = new Date().toISOString().split("T")[0];
    const result = await logger.query({
      startDate: todayStr,
      endDate: todayStr,
    });

    expect(result.logs.length).toBe(1);
  });
});
