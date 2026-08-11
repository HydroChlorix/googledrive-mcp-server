import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { desc, sql, eq, and, lte, gte, lt } from "drizzle-orm";
import { auditLogs } from "./schema.js";
import type {
  AuditLogger,
  AuditMetricsResult,
  AuditEventInput,
  AuditEventRecord,
  AuditQueryParams,
  AuditQueryResult,
} from "./types.js";
import { withAuditLogger } from "./middleware.js";
import { log } from "../core/operationLogger.js";

const HARD_ROW_LIMIT = 100_000;
const PURGE_TARGET_ROW_COUNT = 80_000;

export class SqliteAuditLogger extends EventEmitter implements AuditLogger {
  private sqlite: Database.Database;
  private db: BetterSQLite3Database;
  private queue: AuditEventRecord[] = [];
  private isFlushing = false;
  private isClosed = false;
  private nextId = 1;
  private sigtermHandler?: () => void;
  private sigintHandler?: () => void;

  constructor(dbPath?: string) {
    super();
    const targetPath = dbPath ?? path.join(os.homedir(), ".mcp", "audit.db");
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.sqlite = new Database(targetPath);
    this.sqlite.pragma("journal_mode = WAL");
    this.db = drizzle(this.sqlite);
    
    this.initDatabase();
    this.setupGracefulShutdown();
  }

  private initDatabase(): void {
    // Keep using raw SQL for zero-setup migrations
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        toolName TEXT NOT NULL,
        args TEXT,
        executionTimeMs REAL NOT NULL,
        status TEXT NOT NULL,
        saEmail TEXT,
        sharedDriveId TEXT,
        fileId TEXT,
        fileName TEXT,
        boundaryPassed INTEGER,
        boundaryReason TEXT,
        errorMessage TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_toolName ON audit_logs(toolName);
    `);
  }

  private setupGracefulShutdown(): void {
    this.sigtermHandler = () => {
      this.close().catch(() => {});
    };
    this.sigintHandler = () => {
      this.close().catch(() => {});
    };
    process.once("SIGTERM", this.sigtermHandler);
    process.once("SIGINT", this.sigintHandler);
  }

  public log(input: AuditEventInput): void {
    if (this.isClosed) return;

    const record: AuditEventRecord = {
      ...input,
      id: this.nextId++,
      timestamp: new Date().toISOString(),
    };

    this.emit("log", record);
    this.queue.push(record);
    this.scheduleFlush();
  }

  public async logExecution<T>(
    toolName: string,
    args: Record<string, unknown>,
    actionFn: () => Promise<T>,
  ): Promise<{ result?: T; error?: unknown }> {
    const wrapped = withAuditLogger<Record<string, unknown>, T>(
      this,
      toolName,
      () => actionFn(),
    );
    try {
      const result = await wrapped(args);
      return { result };
    } catch (error) {
      return { error };
    }
  }

  private scheduleFlush(): void {
    if (this.isFlushing || this.queue.length === 0) return;
    this.isFlushing = true;

    setImmediate(() => {
      this.flushQueue().finally(() => {
        this.isFlushing = false;
        if (this.queue.length > 0) {
          this.scheduleFlush();
        }
      });
    });
  }

  private async flushQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);

    try {
      const insertData = batch.map(item => ({
        timestamp: item.timestamp,
        toolName: item.toolName,
        args: item.args ? JSON.stringify(item.args) : null,
        executionTimeMs: item.executionTimeMs,
        status: item.status,
        saEmail: item.saEmail ?? null,
        sharedDriveId: item.sharedDriveId ?? null,
        fileId: item.fileId ?? null,
        fileName: item.fileName ?? null,
        boundaryPassed: item.boundaryPassed === undefined ? null : (item.boundaryPassed ? 1 : 0),
        boundaryReason: item.boundaryReason ?? null,
        errorMessage: item.errorMessage ?? null,
      }));

      // better-sqlite3 is synchronous, but we wrap in a promise to keep the async API
      await new Promise<void>((resolve) => {
        this.sqlite.transaction(() => {
          this.db.insert(auditLogs).values(insertData).run();
        })();
        resolve();
      });

      await this.checkCircuitBreaker();
    } catch (err) {
      log("error", `Failed to flush audit queue: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async checkCircuitBreaker(): Promise<void> {
    try {
      const result = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(auditLogs);
      
      const count = result[0]?.count ?? 0;

      if (count >= HARD_ROW_LIMIT) {
        const deleteCount = count - PURGE_TARGET_ROW_COUNT;
        
        // Delete oldest records
        await new Promise<void>((resolve) => {
          this.sqlite.prepare(`
            DELETE FROM audit_logs 
            WHERE id IN (
              SELECT id FROM audit_logs ORDER BY id ASC LIMIT ?
            )
          `).run(deleteCount);
          resolve();
        });
      }
    } catch (err) {
      log("error", `Failed to check circuit breaker: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public async query(params: AuditQueryParams = {}): Promise<AuditQueryResult> {
    await this.flushQueue();

    const filters = [];
    if (params.toolName) filters.push(eq(auditLogs.toolName, params.toolName));
    if (params.status) filters.push(eq(auditLogs.status, params.status));
    if (params.startDate) {
      const normalizedStart = params.startDate.includes("T") ? params.startDate : `${params.startDate}T00:00:00.000Z`;
      filters.push(gte(auditLogs.timestamp, normalizedStart));
    }
    if (params.endDate) {
      const normalizedEnd = params.endDate.includes("T") ? params.endDate : `${params.endDate}T23:59:59.999Z`;
      filters.push(lte(auditLogs.timestamp, normalizedEnd));
    }
    if (params.cursor) filters.push(lt(auditLogs.id, params.cursor));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const limit = params.limit ?? 20;

    const countResult = await this.db
      .select({ total: sql<number>`COUNT(*)` })
      .from(auditLogs)
      .where(whereClause);
      
    const totalCount = countResult[0]?.total ?? 0;

    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.id))
      .limit(limit);

    const logs: AuditEventRecord[] = rows.map((row) => {
      const record: AuditEventRecord = {
        id: row.id,
        timestamp: row.timestamp,
        toolName: row.toolName,
        executionTimeMs: row.executionTimeMs,
        status: row.status as "SUCCESS" | "DENIED" | "ERROR",
      };

      if (row.args) record.args = JSON.parse(row.args) as Record<string, unknown>;
      if (row.saEmail) record.saEmail = row.saEmail;
      if (row.sharedDriveId) record.sharedDriveId = row.sharedDriveId;
      if (row.fileId) record.fileId = row.fileId;
      if (row.fileName) record.fileName = row.fileName;
      if (row.boundaryPassed !== null) record.boundaryPassed = row.boundaryPassed === 1;
      if (row.boundaryReason) record.boundaryReason = row.boundaryReason;
      if (row.errorMessage) record.errorMessage = row.errorMessage;

      return record;
    });

    const lastItem = logs[logs.length - 1];
    const nextCursor = logs.length === limit && lastItem ? lastItem.id : undefined;

    return {
      logs,
      totalCount,
      ...(nextCursor !== undefined && { nextCursor }),
    };
  }

  public async getMetrics(): Promise<AuditMetricsResult> {
    await this.flushQueue();

    const [metricsResult, toolUsageResult] = await Promise.all([
      this.db
        .select({
          totalCalls: sql<number>`COUNT(*)`,
          successCount: sql<number>`SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END)`,
          deniedCount: sql<number>`SUM(CASE WHEN status = 'DENIED' THEN 1 ELSE 0 END)`,
          errorCount: sql<number>`SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END)`,
          totalExecutionTimeMs: sql<number>`SUM(executionTimeMs)`,
          boundaryAlertsCount: sql<number>`SUM(CASE WHEN boundaryPassed = 0 OR status = 'DENIED' THEN 1 ELSE 0 END)`,
        })
        .from(auditLogs),
      
      this.db
        .select({
          toolName: auditLogs.toolName,
          count: sql<number>`COUNT(*)`,
        })
        .from(auditLogs)
        .groupBy(auditLogs.toolName)
    ]);

    const metricsRow = metricsResult[0] || {
      totalCalls: 0,
      successCount: 0,
      deniedCount: 0,
      errorCount: 0,
      totalExecutionTimeMs: 0,
      boundaryAlertsCount: 0
    };

    const totalCalls = metricsRow.totalCalls || 0;
    const totalExecutionTimeMs = metricsRow.totalExecutionTimeMs || 0;
    const avgExecutionTimeMs = totalCalls > 0 ? Math.round((totalExecutionTimeMs / totalCalls) * 100) / 100 : 0;

    const toolUsage: Record<string, number> = {};
    for (const row of toolUsageResult) {
      toolUsage[row.toolName] = row.count;
    }

    return {
      totalCalls,
      successCount: metricsRow.successCount || 0,
      deniedCount: metricsRow.deniedCount || 0,
      errorCount: metricsRow.errorCount || 0,
      avgExecutionTimeMs,
      toolUsage,
      boundaryAlertsCount: metricsRow.boundaryAlertsCount || 0,
    };
  }

  public async purge(daysToKeep = 30): Promise<number> {
    await this.flushQueue();

    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

    const result = await new Promise<{ changes: number }>((resolve) => {
      const stmt = this.sqlite.prepare("DELETE FROM audit_logs WHERE timestamp < ?");
      const info = stmt.run(cutoffDate);
      resolve({ changes: info.changes });
    });

    return result.changes;
  }

  public async close(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;

    if (this.sigtermHandler) process.removeListener("SIGTERM", this.sigtermHandler);
    if (this.sigintHandler) process.removeListener("SIGINT", this.sigintHandler);

    await this.flushQueue();

    this.sqlite.close();
  }
}
