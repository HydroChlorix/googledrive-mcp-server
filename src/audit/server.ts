import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { SqliteAuditLogger } from "./SqliteAuditLogger.js";
import type { AuditEventRecord, AuditQueryParams } from "./types.js";
import { getDashboardHtml } from "./ui.js";
import { log } from "../core/operationLogger.js";

export interface DashboardServerOptions {
  port?: number;
  token?: string;
  enabled?: boolean;
  distPath?: string;
  mode?: "read" | "readwrite";
}

export function createDashboardApp(
  logger: SqliteAuditLogger,
  requiredToken: string,
  distPath?: string,
  options?: { mode?: "read" | "readwrite" },
): Hono {
  const app = new Hono();

  // Global Security Headers Middleware
  app.use("*", async (c, next) => {
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self';",
    );
    c.header("X-Frame-Options", "DENY");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    await next();
  });

  // Rate limiter tracker for failed auth attempts
  const authFailureTracker = new Map<string, { count: number; resetTime: number }>();
  const MAX_TRACKER_ENTRIES = 1000;

  const getClientIp = (c: { req: { header: (n: string) => string | undefined } }): string => {
    if (process.env["TRUST_PROXY"] === "true") {
      const forwarded = c.req.header("x-forwarded-for");
      if (forwarded) return forwarded.split(",")[0]?.trim() || "127.0.0.1";
    }
    return "127.0.0.1";
  };

  // Timing-safe token comparison helper
  const isTokenValid = (token: string | undefined, expectedToken: string): boolean => {
    if (!token) return false;
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expectedToken);
    if (tokenBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  };

  // Authentication Middleware
  app.use("/api/*", async (c, next) => {
    const clientIp = getClientIp(c);
    const now = Date.now();
    const tracker = authFailureTracker.get(clientIp);

    if (tracker && tracker.resetTime <= now) {
      authFailureTracker.delete(clientIp);
    }

    const authHeader = c.req.header("Authorization");
    const queryToken = c.req.query("token");

    let token = queryToken;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    // If valid token is supplied, allow access and clear failure tracking
    if (isTokenValid(token, requiredToken)) {
      authFailureTracker.delete(clientIp);
      return await next();
    }

    // If invalid token, check rate limiter
    const activeTracker = authFailureTracker.get(clientIp);
    if (activeTracker && activeTracker.resetTime > now && activeTracker.count >= 5) {
      return c.json(
        { error: "Too many failed authentication attempts. Please try again later." },
        429,
      );
    }

    if (authFailureTracker.size >= MAX_TRACKER_ENTRIES && !authFailureTracker.has(clientIp)) {
      const firstKey = authFailureTracker.keys().next().value;
      if (firstKey) authFailureTracker.delete(firstKey);
    }
    const current = activeTracker || { count: 0, resetTime: now + 60000 };
    current.count += 1;
    authFailureTracker.set(clientIp, current);
    return c.json({ error: "Unauthorized: Invalid or missing token" }, 401);
  });

  // REST: Get Paginated Logs
  app.get("/api/audit/logs", async (c) => {
    const toolName = c.req.query("toolName");
    const statusStr = c.req.query("status");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const cursorStr = c.req.query("cursor");
    const limitStr = c.req.query("limit");

    const status =
      statusStr === "SUCCESS" || statusStr === "DENIED" || statusStr === "ERROR"
        ? statusStr
        : undefined;

    const queryOptions: AuditQueryParams = {
      limit: limitStr ? Number(limitStr) : 20,
    };
    if (toolName) queryOptions.toolName = toolName;
    if (status) queryOptions.status = status;
    if (startDate) queryOptions.startDate = startDate;
    if (endDate) queryOptions.endDate = endDate;
    if (cursorStr) queryOptions.cursor = Number(cursorStr);

    const result = await logger.query(queryOptions);

    return c.json(result);
  });

  // REST: Get Dashboard Metrics
  app.get("/api/audit/metrics", async (c) => {
    const metrics = await logger.getMetrics();
    const mode =
      options?.mode ??
      (process.env["GOOGLE_DRIVE_MODE"] === "readonly" ? "read" : "readwrite");
    return c.json({ ...metrics, mode });
  });

  // SSE: Real-time Audit Events Stream
  app.get("/api/audit/stream", (c) => {
    return streamSSE(c, async (stream) => {
      const listener = (record: AuditEventRecord) => {
        stream.writeSSE({
          data: JSON.stringify(record),
          event: "audit-event",
        });
      };

      logger.on("log", listener);

      stream.onAbort(() => {
        logger.off("log", listener);
      });

      // Keep-alive interval
      while (!stream.aborted) {
        await stream.sleep(15000);
        await stream.writeSSE({ data: "", event: "ping" }).catch(() => {});
      }
    });
  });

  // Static Dashboard SPA serving
  const uiPath = distPath || path.join(process.cwd(), "dist", "ui");
  const resolvedUiPath = path.resolve(uiPath);
  app.get("/*", async (c) => {
    if (fs.existsSync(resolvedUiPath)) {
      const relPath = c.req.path === "/" ? "index.html" : c.req.path.slice(1);
      const filePath = path.resolve(resolvedUiPath, relPath);

      const isWithinBoundary =
        filePath === resolvedUiPath ||
        filePath.startsWith(resolvedUiPath + path.sep);

      if (
        isWithinBoundary &&
        fs.existsSync(filePath) &&
        fs.statSync(filePath).isFile()
      ) {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const mimeTypes: Record<string, string> = {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".svg": "image/svg+xml",
        };
        return c.body(content, 200, {
          "Content-Type": mimeTypes[ext] || "application/octet-stream",
        });
      }

      // Fallback to index.html for SPA routing
      const indexPath = path.join(resolvedUiPath, "index.html");
      if (fs.existsSync(indexPath)) {
        return c.html(fs.readFileSync(indexPath, "utf-8"));
      }
    }

    // Default embedded Single Page Application dashboard
    return c.html(getDashboardHtml());
  });

  return app;
}

export function startDashboardServer(
  logger: SqliteAuditLogger,
  options: DashboardServerOptions = {},
): { app: Hono; server: ReturnType<typeof serve>; token: string; port: number } | null {
  const isEnabled =
    options.enabled ?? process.env["MCP_DASHBOARD_ENABLED"] !== "false";
  if (!isEnabled) {
    log("info", "Dashboard Server disabled via MCP_DASHBOARD_ENABLED=false");
    return null;
  }

  const port =
    options.port ??
    (process.env["MCP_DASHBOARD_PORT"]
      ? Number(process.env["MCP_DASHBOARD_PORT"])
      : 3001);

  const token =
    options.token ??
    process.env["MCP_DASHBOARD_TOKEN"] ??
    crypto.randomBytes(32).toString("hex");

  const app = createDashboardApp(
    logger,
    token,
    options.distPath,
    options.mode ? { mode: options.mode } : undefined,
  );

  const server = serve({
    fetch: app.fetch,
    port,
  });

  log("info", `📊 Audit Dashboard running at http://127.0.0.1:${port}?token=${token}`);

  return {
    app,
    server,
    token,
    port,
  };
}
