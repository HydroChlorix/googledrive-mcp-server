import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull(),
  toolName: text("toolName").notNull(),
  args: text("args"),
  executionTimeMs: real("executionTimeMs").notNull(),
  status: text("status").notNull(),
  saEmail: text("saEmail"),
  sharedDriveId: text("sharedDriveId"),
  fileId: text("fileId"),
  fileName: text("fileName"),
  boundaryPassed: integer("boundaryPassed"),
  boundaryReason: text("boundaryReason"),
  errorMessage: text("errorMessage"),
});
