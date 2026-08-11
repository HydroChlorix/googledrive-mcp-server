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

  it("should log info when GOOGLE_APPLICATION_CREDENTIALS file exists (service_account)", async () => {
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "/tmp/existing-key.json";
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({ type: "service_account" }));

    const { getDriveClient } = await import("../src/core/auth.js");
    const { log } = await import("../src/core/operationLogger.js");

    await getDriveClient();

    expect(log).toHaveBeenCalledWith(
      "info",
      "Auth: Credentials JSON file verified at '/tmp/existing-key.json' (type: service_account_key).",
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

  it("should log info when GOOGLE_APPLICATION_CREDENTIALS file exists (impersonated_service_account)", async () => {
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "/tmp/impersonated.json";
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({ type: "impersonated_service_account" }),
    );

    const { getDriveClient } = await import("../src/core/auth.js");
    const { log } = await import("../src/core/operationLogger.js");

    await getDriveClient();

    expect(log).toHaveBeenCalledWith(
      "info",
      "Auth: Credentials JSON file verified at '/tmp/impersonated.json' (type: impersonated_adc).",
      expect.objectContaining({
        authMethod: "impersonated_adc",
        fileExists: true,
        keyPath: "/tmp/impersonated.json",
      }),
    );
    expect(log).toHaveBeenCalledWith(
      "info",
      "Auth: Google Drive API client initialized successfully using Impersonated Service Account ADC (impersonated_adc).",
      { authMethod: "impersonated_adc" },
    );
  });

  it("should log info when GOOGLE_APPLICATION_CREDENTIALS file exists (authorized_user)", async () => {
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "/tmp/user_adc.json";
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({ type: "authorized_user" }));

    const { getDriveClient } = await import("../src/core/auth.js");
    const { log } = await import("../src/core/operationLogger.js");

    await getDriveClient();

    expect(log).toHaveBeenCalledWith(
      "info",
      "Auth: Credentials JSON file verified at '/tmp/user_adc.json' (type: user_adc).",
      expect.objectContaining({
        authMethod: "user_adc",
        fileExists: true,
        keyPath: "/tmp/user_adc.json",
      }),
    );
    expect(log).toHaveBeenCalledWith(
      "info",
      "Auth: Google Drive API client initialized successfully using User ADC (user_adc).",
      { authMethod: "user_adc" },
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
