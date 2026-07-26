import crypto from "node:crypto";
import type { Writable } from "node:stream";

export interface ExecutionIdentity {
  user?: string;
  impersonatedAccount?: string;
  subject?: string;
}

export interface AuditEvent {
  timestamp: string;
  eventId: string;
  tool: string;
  identity?: ExecutionIdentity;
  params: Record<string, unknown>;
  status: "SUCCESS" | "ERROR";
  durationMs: number;
  error?: string;
}

export interface AuditLoggerOptions {
  sink?: Writable;
}

export function getExecutionIdentity(): ExecutionIdentity {
  const user = process.env["USER"] ?? process.env["USERNAME"] ?? "unknown-user";
  const impersonatedAccount =
    process.env["GOOGLE_IMPERSONATED_USER"] ?? process.env["GCLOUD_ACCOUNT"];
  const subject = process.env["GITHUB_REPOSITORY"]
    ? `${process.env["GITHUB_REPOSITORY"]}@${process.env["GITHUB_REF_NAME"] ?? "main"}`
    : undefined;

  return {
    user,
    ...(impersonatedAccount ? { impersonatedAccount } : {}),
    ...(subject ? { subject } : {}),
  };
}

export class AuditLogger {
  private sink: Writable;

  constructor(options: AuditLoggerOptions = {}) {
    this.sink = options.sink ?? process.stderr;
  }

  public sanitizePayload(val: unknown, depth = 0): unknown {
    if (depth > 5) return "[TRUNCATED_DEPTH]";
    if (val === null || val === undefined) return val;

    if (typeof val === "string") {
      return val;
    }

    if (Array.isArray(val)) {
      return val.map((item) => this.sanitizePayload(item, depth + 1));
    }

    if (typeof val === "object") {
      const sanitized: Record<string, unknown> = {};
      for (const [key, keyVal] of Object.entries(val as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === "content" && typeof keyVal === "string") {
          sanitized[key] = `[REDACTED - ${keyVal.length} chars]`;
        } else if (
          lowerKey.includes("token") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("password")
        ) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = this.sanitizePayload(keyVal, depth + 1);
        }
      }
      return sanitized;
    }

    return val;
  }

  public writeEvent(event: AuditEvent): void {
    try {
      const sanitizedParams = this.sanitizePayload(event.params) as Record<string, unknown>;
      const record = {
        ...event,
        identity: event.identity ?? getExecutionIdentity(),
        params: sanitizedParams,
      };
      const line = `[AUDIT] ${JSON.stringify(record)}\n`;
      this.sink.write(line);
    } catch {
      // Fail-safe: guarantee audit log writing never crashes execution
    }
  }

  public async logExecution<T>(
    toolName: string,
    args: Record<string, unknown>,
    actionFn: () => Promise<T>,
  ): Promise<{ result?: T; error?: unknown }> {
    const startTime = performance.now();
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const identity = getExecutionIdentity();

    try {
      const result = await actionFn();
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      this.writeEvent({
        timestamp,
        eventId,
        tool: toolName,
        identity,
        params: args,
        status: "SUCCESS",
        durationMs,
      });
      return { result };
    } catch (error) {
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.writeEvent({
        timestamp,
        eventId,
        tool: toolName,
        identity,
        params: args,
        status: "ERROR",
        durationMs,
        error: errorMessage,
      });
      return { error };
    }
  }
}

export const defaultAuditLogger: AuditLogger = new AuditLogger();
