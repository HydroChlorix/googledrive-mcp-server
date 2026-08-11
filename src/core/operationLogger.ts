import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type LogLevel = "info" | "warn" | "error" | "fatal";

export interface NormalizedError {
  name: string;
  message: string;
  stack: string;
}

function getLogPath(): string {
  return path.join(os.homedir(), ".mcp", "logs", "operation.log");
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || String(error),
      stack: error.stack || "",
    };
  }
  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    return {
      name: typeof errObj["name"] === "string" ? errObj["name"] : "ObjectError",
      message: typeof errObj["message"] === "string" ? errObj["message"] : JSON.stringify(error),
      stack: typeof errObj["stack"] === "string" ? errObj["stack"] : "",
    };
  }
  return {
    name: "UnknownError",
    message: String(error),
    stack: "",
  };
}

/**
 * Write a structured log entry to both operation.log (NDJSON) and stderr (human-readable).
 * Replaces all direct console.error() usage in the codebase.
 * All writes are synchronous.
 */
export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const pid = process.pid;
  const hostname = os.hostname();

  const payload: Record<string, unknown> = {
    timestamp,
    level,
    message,
    pid,
    hostname,
    ...meta,
  };

  const logPath = getLogPath();
  const logDir = path.dirname(logPath);

  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`);
  } catch (err) {
    process.stderr.write(
      `[FATAL] Operation Logger failed to write log entry: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }

  const hintMsg = typeof meta?.["hint"] === "string" ? `\n  Hint: ${meta["hint"]}` : "";
  process.stderr.write(`[${level.toUpperCase()}] ${message}${hintMsg}\n`);
}

const AUTH_HINT =
  "Run 'gcloud auth application-default login --impersonate-service-account=\"<SERVICE_ACCOUNT_EMAIL>\"' (add --no-browser for headless/WSL).";

const AUTH_ERROR_GROUPS = [
  {
    matchers: ["invalid_grant", "invalid_rapt", "unable to impersonate"],
    cleanMessage:
      "Google Authentication Failed: ADC token expired or re-authentication required (invalid_rapt).",
  },
  {
    matchers: [
      "insufficient authentication scopes",
      "insufficientPermissions",
      "insufficient_scope",
    ],
    cleanMessage: "Google Authentication Failed: Request had insufficient authentication scopes.",
  },
  {
    matchers: ["Unauthenticated", "invalid_token"],
    cleanMessage: "Google Authentication Failed: Invalid or missing OAuth credentials.",
  },
];

function sanitizeAuthError(error: unknown): { cleanMessage: string; hint?: string } | null {
  const rawMessage = error instanceof Error ? error.message : String(error);

  for (const group of AUTH_ERROR_GROUPS) {
    if (group.matchers.some((m) => rawMessage.includes(m))) {
      return {
        cleanMessage: group.cleanMessage,
        hint: AUTH_HINT,
      };
    }
  }

  return null;
}

/**
 * Write a crash entry from an existing catch block.
 * Normalizes error -> calls log(). Does NOT call process.exit().
 */
export function reportCrash(error: unknown, level: "error" | "fatal" = "fatal"): void {
  const normErr = normalizeError(error);
  const authInfo = sanitizeAuthError(error);

  if (authInfo) {
    normErr.message = authInfo.cleanMessage;
    log(level, `Process error: ${authInfo.cleanMessage}`, {
      hint: authInfo.hint,
      error: normErr,
    });
  } else {
    log(level, `Process error: ${normErr.message}`, {
      error: normErr,
    });
  }
}

let registered = false;

/**
 * Register passive handlers for uncaughtException and unhandledRejection.
 * Must be called FIRST in src/index.ts, before any async work.
 * Handlers call log() then process.exit(1).
 */
export function registerCrashReporter(): void {
  if (registered) return;
  registered = true;

  process.on("uncaughtException", (error: Error) => {
    try {
      reportCrash(error, "fatal");
    } catch {
      process.stderr.write(
        `[FATAL] Uncaught exception (log write failed): ${error?.message || String(error)}\n`,
      );
    }
    process.exit(1);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    try {
      reportCrash(reason, "error");
    } catch {
      process.stderr.write(
        `[ERROR] Unhandled rejection (log write failed): ${reason instanceof Error ? reason.message : String(reason)}\n`,
      );
    }
    process.exit(1);
  });
}
