import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log, registerCrashReporter, reportCrash } from "../src/core/operationLogger.js";

describe("Operation Logger Module", () => {
  let tmpHomeDir: string;
  let originalHomedir: typeof os.homedir;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-oplogger-test-"));
    originalHomedir = os.homedir;
    vi.spyOn(os, "homedir").mockReturnValue(tmpHomeDir);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(tmpHomeDir)) {
      fs.rmSync(tmpHomeDir, { recursive: true, force: true });
    }
  });

  describe("log()", () => {
    it("should create directory and write valid NDJSON line for each level", () => {
      const levels = ["info", "warn", "error", "fatal"] as const;

      for (const level of levels) {
        log(level, `Test message for ${level}`);
      }

      const logPath = path.join(tmpHomeDir, ".mcp", "logs", "operation.log");
      expect(fs.existsSync(logPath)).toBe(true);

      const content = fs.readFileSync(logPath, "utf-8").trim().split("\n");
      expect(content).toHaveLength(4);

      for (let i = 0; i < levels.length; i++) {
        const entry = JSON.parse(content[i] as string);
        expect(entry.level).toBe(levels[i]);
        expect(entry.message).toBe(`Test message for ${levels[i]}`);
        expect(entry.pid).toBe(process.pid);
        expect(entry.hostname).toBe(os.hostname());
        expect(typeof entry.timestamp).toBe("string");
        expect(new Date(entry.timestamp).toString()).not.toBe("Invalid Date");
      }
    });

    it("should write human-readable line to stderr", () => {
      log("info", "Hello world");
      expect(stderrSpy).toHaveBeenCalledWith("[INFO] Hello world\n");
    });

    it("should merge meta fields into root of NDJSON payload", () => {
      log("info", "Boundary initialized", {
        sharedDriveId: "drive123",
        rootFolderId: "folder456",
      });

      const logPath = path.join(tmpHomeDir, ".mcp", "logs", "operation.log");
      const content = fs.readFileSync(logPath, "utf-8").trim();
      const entry = JSON.parse(content);

      expect(entry.sharedDriveId).toBe("drive123");
      expect(entry.rootFolderId).toBe("folder456");
      expect(entry.message).toBe("Boundary initialized");
    });

    it("should handle write errors gracefully without throwing", () => {
      // Mock fs.appendFileSync to throw
      vi.spyOn(fs, "appendFileSync").mockImplementation(() => {
        throw new Error("Disk full");
      });

      expect(() => log("info", "Test fallback")).not.toThrow();
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("Operation Logger failed to write log entry: Disk full"),
      );
    });
  });

  describe("reportCrash()", () => {
    it("should normalize Error object and log with fatal level by default", () => {
      const testErr = new Error("Auth failed");
      testErr.name = "GaxiosError";

      reportCrash(testErr);

      const logPath = path.join(tmpHomeDir, ".mcp", "logs", "operation.log");
      const content = fs.readFileSync(logPath, "utf-8").trim();
      const entry = JSON.parse(content);

      expect(entry.level).toBe("fatal");
      expect(entry.message).toBe("Process error: Auth failed");
      expect(entry.error).toBeDefined();
      expect(entry.error.name).toBe("GaxiosError");
      expect(entry.error.message).toBe("Auth failed");
      expect(typeof entry.error.stack).toBe("string");
    });

    it("should allow overriding log level to error", () => {
      const testErr = new Error("Non-fatal issue");
      reportCrash(testErr, "error");

      const logPath = path.join(tmpHomeDir, ".mcp", "logs", "operation.log");
      const content = fs.readFileSync(logPath, "utf-8").trim();
      const entry = JSON.parse(content);

      expect(entry.level).toBe("error");
    });

    it("should normalize non-Error throws (string, object, undefined)", () => {
      reportCrash("String error message");

      const logPath = path.join(tmpHomeDir, ".mcp", "logs", "operation.log");
      const content = fs.readFileSync(logPath, "utf-8").trim().split("\n");
      const entry = JSON.parse(content[0] as string);

      expect(entry.error.name).toBe("UnknownError");
      expect(entry.error.message).toBe("String error message");
    });

    it("should sanitize Gaxios/ADC auth errors and attach remediation hint", () => {
      const gaxiosErr = new Error(
        'unable to impersonate: Error: {"error":"invalid_grant","error_description":"reauth related error (invalid_rapt)"}',
      );
      reportCrash(gaxiosErr);

      const logPath = path.join(tmpHomeDir, ".mcp", "logs", "operation.log");
      const content = fs.readFileSync(logPath, "utf-8").trim();
      const entry = JSON.parse(content);

      expect(entry.message).toContain("Google Authentication Failed");
      expect(entry.hint).toContain("gcloud auth application-default login");
      expect(entry.message).not.toContain("invalid_grant");
    });
  });

  describe("registerCrashReporter()", () => {
    it("should register uncaughtException and unhandledRejection handlers", () => {
      const processOnSpy = vi.spyOn(process, "on");

      registerCrashReporter();

      expect(processOnSpy).toHaveBeenCalledWith("uncaughtException", expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith("unhandledRejection", expect.any(Function));
    });
  });
});
