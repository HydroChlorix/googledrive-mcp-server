export interface AuditEventInput {
  toolName: string;
  args?: Record<string, unknown>;
  executionTimeMs: number;
  status: "SUCCESS" | "DENIED" | "ERROR";
  saEmail?: string;
  sharedDriveId?: string;
  fileId?: string;
  fileName?: string;
  boundaryPassed?: boolean;
  boundaryReason?: string;
  errorMessage?: string;
}

export interface AuditEventRecord extends AuditEventInput {
  id: number;
  timestamp: string;
}

export interface AuditQueryParams {
  toolName?: string;
  status?: "SUCCESS" | "DENIED" | "ERROR";
  startDate?: string;
  endDate?: string;
  cursor?: number;
  limit?: number;
}

export interface AuditQueryResult {
  logs: AuditEventRecord[];
  nextCursor?: number;
  totalCount: number;
}

export interface AuditMetricsResult {
  totalCalls: number;
  successCount: number;
  deniedCount: number;
  errorCount: number;
  avgExecutionTimeMs: number;
  toolUsage: Record<string, number>;
  boundaryAlertsCount: number;
}

export interface AuditLogger {
  log(event: AuditEventInput): void;
  logExecution?<T>(
    toolName: string,
    args: Record<string, unknown>,
    actionFn: () => Promise<T>,
  ): Promise<{ result?: T; error?: unknown }>;
  query(params?: AuditQueryParams): Promise<AuditQueryResult>;
  getMetrics?(): Promise<AuditMetricsResult>;
  purge(daysToKeep?: number): Promise<number>;
  close(): Promise<void>;
  on?(event: "log", listener: (record: AuditEventRecord) => void): this;
}
