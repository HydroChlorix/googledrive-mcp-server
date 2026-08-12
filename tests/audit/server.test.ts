import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteAuditLogger } from "../../src/audit/SqliteAuditLogger.js";
import { createDashboardApp, startDashboardServer } from "../../src/audit/server.js";

describe("Dashboard Hono Server", () => {
  let tempDbPath: string;
  let logger: SqliteAuditLogger;

  beforeEach(() => {
    tempDbPath = path.join(
      os.tmpdir(),
      `test-server-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );
    logger = new SqliteAuditLogger(tempDbPath);
  });

  afterEach(async () => {
    await logger.close();
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it("should reject requests without valid token", async () => {
    const app = createDashboardApp(logger, "secret-token");
    const res = await app.request("/api/audit/logs");
    expect(res.status).toBe(401);
  });

  it("should allow requests with valid bearer token", async () => {
    logger.log({
      toolName: "drive_list_files",
      executionTimeMs: 12,
      status: "SUCCESS",
    });

    const app = createDashboardApp(logger, "secret-token");
    const res = await app.request("/api/audit/logs", {
      headers: {
        Authorization: "Bearer secret-token",
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { logs: unknown[]; totalCount: number };
    expect(body.totalCount).toBe(1);
  });

  it("should return metrics endpoint data including server mode", async () => {
    logger.log({
      toolName: "drive_upload_text_file",
      executionTimeMs: 40,
      status: "SUCCESS",
    });

    const app = createDashboardApp(logger, "secret-token", undefined, { mode: "read" });
    const res = await app.request("/api/audit/metrics?token=secret-token");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { totalCalls: number; successCount: number; mode?: string };
    expect(body.totalCalls).toBe(1);
    expect(body.successCount).toBe(1);
    expect(body.mode).toBe("read");
  });

  it("should prevent path traversal attacks when serving static files", async () => {
    const tempDir = path.join(os.tmpdir(), `test-ui-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, "index.html"), "<h1>Dashboard</h1>");

    const app = createDashboardApp(logger, "secret-token", tempDir);
    const res = await app.request("/../../etc/passwd");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("root:x:0:0");
    expect(text).toContain("Dashboard");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should allow SSE stream connection with valid bearer token or query param", async () => {
    const app = createDashboardApp(logger, "secret-token");

    const resHeader = await app.request("/api/audit/stream", {
      headers: {
        Authorization: "Bearer secret-token",
      },
    });
    expect(resHeader.status).toBe(200);

    const resQuery = await app.request("/api/audit/stream?token=secret-token");
    expect(resQuery.status).toBe(200);
  });

  it("should serve embedded dashboard SPA HTML at root endpoint", async () => {
    const app = createDashboardApp(logger, "secret-token");
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Google Drive MCP Audit Dashboard");
    expect(html).toContain("sessionStorage");
    expect(html).toContain("history.replaceState");
  });

  it("should enforce HTTP Security Headers across endpoints", async () => {
    const app = createDashboardApp(logger, "secret-token");
    const res = await app.request("/");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("should rate limit excessive failed authentication attempts (429 Too Many Requests)", async () => {
    const app = createDashboardApp(logger, "secret-token");

    // Execute 5 failed auth attempts
    for (let i = 0; i < 5; i++) {
      const res = await app.request("/api/audit/logs");
      expect(res.status).toBe(401);
    }

    // 6th attempt should be blocked with HTTP 429
    const blockedRes = await app.request("/api/audit/logs");
    expect(blockedRes.status).toBe(429);
    const body = (await blockedRes.json()) as { error: string };
    expect(body.error).toContain("Too many failed authentication attempts");
  });

  it("should respect MCP_DASHBOARD_ENABLED=false", () => {
    const res = startDashboardServer(logger, { enabled: false });
    expect(res).toBeNull();
  });
});
