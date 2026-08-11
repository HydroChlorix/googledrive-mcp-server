import fs from "node:fs";
import { google } from "googleapis";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 1. Mock googleapis
vi.mock("googleapis", () => {
  const mockDrive = {
    files: { list: vi.fn() },
  };
  return {
    google: {
      auth: {
        GoogleAuth: vi.fn(class {}),
      },
      drive: vi.fn().mockReturnValue(mockDrive),
    },
  };
});

// Mock operationLogger to inspect log calls
vi.mock("../src/core/operationLogger.js", () => ({
  log: vi.fn(),
}));

describe("Auth Module", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  });

  it("should initialize GoogleAuth and return drive client using ADC by default", async () => {
    const { getDriveClient } = await import("../src/core/auth.js");
    const { log } = await import("../src/core/operationLogger.js");

    const client = await getDriveClient();

    expect(google.auth.GoogleAuth).toHaveBeenCalledTimes(1);
    expect(google.drive).toHaveBeenCalledWith(expect.objectContaining({ version: "v3" }));
    expect(client).toBeDefined();
    expect(log).toHaveBeenCalledWith(
      "info",
      "Auth: Initializing using Application Default Credentials (adc).",
      { authMethod: "adc" },
    );
    expect(log).toHaveBeenCalledWith(
      "info",
      "Auth: Google Drive API client initialized successfully using Application Default Credentials (adc).",
      { authMethod: "adc" },
    );
  });

  it("should warn when GOOGLE_APPLICATION_CREDENTIALS file does not exist", async () => {
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "/tmp/non-existent-key.json";
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const { getDriveClient } = await import("../src/core/auth.js");
    const { log } = await import("../src/core/operationLogger.js");

    await getDriveClient();

    expect(log).toHaveBeenCalledWith(
      "warn",
      "Auth: GOOGLE_APPLICATION_CREDENTIALS is set to '/tmp/non-existent-key.json', but file does not exist. Falling back to ADC.",
      expect.objectContaining({
        authMethod: "adc",
        fileExists: false,
        keyPath: "/tmp/non-existent-key.json",
      }),
    );
  });

  it("should log info when GOOGLE_APPLICATION_CREDENTIALS file exists", async () => {
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "/tmp/existing-key.json";
    vi.spyOn(fs, "existsSync").mockReturnValue(true);

    const { getDriveClient } = await import("../src/core/auth.js");
    const { log } = await import("../src/core/operationLogger.js");

    await getDriveClient();

    expect(log).toHaveBeenCalledWith(
      "info",
      "Auth: Service Account JSON key file verified at '/tmp/existing-key.json'.",
      expect.objectContaining({
        authMethod: "service_account_key",
        fileExists: true,
        keyPath: "/tmp/existing-key.json",
      }),
    );
    expect(log).toHaveBeenCalledWith(
      "info",
      "Auth: Google Drive API client initialized successfully using Service Account Key (service_account_key).",
      { authMethod: "service_account_key" },
    );
  });

  it("should return the same client instance on subsequent calls (Singleton)", async () => {
    const { getDriveClient } = await import("../src/core/auth.js");

    const client1 = await getDriveClient();
    const client2 = await getDriveClient();

    expect(google.auth.GoogleAuth).toHaveBeenCalledTimes(1);
    expect(client1).toBe(client2);
  });
});
