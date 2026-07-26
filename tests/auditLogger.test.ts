import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { AuditLogger, getExecutionIdentity } from "../src/utils/auditLogger.js";

import type { AuditEvent } from "../src/utils/auditLogger.js";

function createMemorySink(): { sink: PassThrough; getLogs: () => AuditEvent[] } {
  const sink = new PassThrough();
  const logs: AuditEvent[] = [];
  let buffer = "";

  sink.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("[AUDIT] ")) {
        try {
          logs.push(JSON.parse(line.replace("[AUDIT] ", "")) as AuditEvent);
        } catch {
          // ignore unparseable
        }
      }
    }
  });

  return {
    sink,
    getLogs: () => logs,
  };
}

describe("AuditLogger Deep Module", () => {
  it("should sanitize sensitive fields like 'content' and 'token'", () => {
    const logger = new AuditLogger();

    const rawPayload = {
      name: "secret_file.txt",
      content: "Super confidential text data",
      authToken: "secret_12345",
      nested: {
        password: "my_password",
        normalField: 123,
      },
    };

    const sanitized = logger.sanitizePayload(rawPayload) as {
      name: string;
      content: string;
      authToken: string;
      nested: {
        password: string;
        normalField: number;
      };
    };

    expect(sanitized.name).toBe("secret_file.txt");
    expect(sanitized.content).toBe("[REDACTED - 28 chars]");
    expect(sanitized.authToken).toBe("[REDACTED]");
    expect(sanitized.nested.password).toBe("[REDACTED]");
    expect(sanitized.nested.normalField).toBe(123);
  });

  it("should resolve identity context from environment variables (ADR-0004)", () => {
    process.env.GOOGLE_IMPERSONATED_USER = "developer@company.com";
    try {
      const identity = getExecutionIdentity();
      expect(identity.impersonatedAccount).toBe("developer@company.com");
      expect(identity.user).toBeDefined();
    } finally {
      delete process.env.GOOGLE_IMPERSONATED_USER;
    }
  });

  it("should write audit event with identity context to specified stream sink in NDJSON format", () => {
    const { sink, getLogs } = createMemorySink();
    const logger = new AuditLogger({ sink });

    logger.writeEvent({
      timestamp: "2026-07-26T15:00:00.000Z",
      eventId: "test-uuid-1",
      tool: "drive_list_files",
      identity: { user: "test-user", impersonatedAccount: "sa@proj.iam.gserviceaccount.com" },
      params: { pageSize: 10 },
      status: "SUCCESS",
      durationMs: 15.5,
    });

    const logs = getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].identity).toEqual({
      user: "test-user",
      impersonatedAccount: "sa@proj.iam.gserviceaccount.com",
    });
    expect(logs[0].tool).toBe("drive_list_files");
  });

  it("should log execution result and timing for successful action with identity", async () => {
    const { sink, getLogs } = createMemorySink();
    const logger = new AuditLogger({ sink });

    const { result, error } = await logger.logExecution(
      "drive_create_folder",
      { name: "My Folder" },
      async () => {
        return { id: "folder-123", name: "My Folder" };
      },
    );

    expect(error).toBeUndefined();
    expect(result).toEqual({ id: "folder-123", name: "My Folder" });

    const logs = getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].tool).toBe("drive_create_folder");
    expect(logs[0].status).toBe("SUCCESS");
    expect(logs[0].identity).toBeDefined();
    expect(logs[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(logs[0].eventId).toBeDefined();
  });

  it("should log execution error and timing when action throws", async () => {
    const { sink, getLogs } = createMemorySink();
    const logger = new AuditLogger({ sink });

    const { result, error } = await logger.logExecution(
      "drive_download_file",
      { fileId: "invalid-id", destPath: "./out.bin" },
      async () => {
        throw new Error("File not found on Google Drive");
      },
    );

    expect(result).toBeUndefined();
    expect(error).toBeInstanceOf(Error);

    const logs = getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].tool).toBe("drive_download_file");
    expect(logs[0].status).toBe("ERROR");
    expect(logs[0].error).toBe("File not found on Google Drive");
  });
});
