import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { SqliteAuditLogger } from "../audit/SqliteAuditLogger.js";
import { startDashboardServer } from "../audit/server.js";
import { BoundarySafeDriveClient } from "../core/DriveClient.js";
import { getDriveClient } from "../core/auth.js";
import { log } from "../core/operationLogger.js";
import { APP_VERSION } from "../version.js";
import { McpServerApplication } from "./McpServerApplication.js";

export { McpServerApplication };

export async function startMcpServer(): Promise<void> {
  const googleDriveClient = await getDriveClient();
  const safeDriveClient = await BoundarySafeDriveClient.create(googleDriveClient);

  const mode = process.env["GOOGLE_DRIVE_MODE"] === "readonly" ? "read" : "readwrite";
  const sqliteAuditLogger = new SqliteAuditLogger();
  startDashboardServer(sqliteAuditLogger, { mode });

  const app = new McpServerApplication(safeDriveClient, sqliteAuditLogger, undefined, undefined, {
    mode,
  });

  const transport = new StdioServerTransport();
  await app.connect(transport);
  log("info", `🚀 Google Drive MCP Server v${APP_VERSION} [${mode}] started`);
  if (mode === "read") {
    log("warn", "Write tools disabled (GOOGLE_DRIVE_MODE=readonly)");
  }
}
