import { describe, expect, it } from "vitest";
import { translateDriveError } from "../src/utils/authErrorAdapter.js";

describe("AuthErrorAdapter Deep Module", () => {
  it("should translate 401/403 status code to actionable gcloud login instructions", () => {
    const error401 = { status: 401, message: "Invalid Credentials" };
    const translated = translateDriveError(error401, "listFiles");

    expect(translated.message).toContain("Authentication / Permission Error (401)");
    expect(translated.message).toContain(
      "gcloud auth application-default login --impersonate-service-account",
    );
  });

  it("should translate 403 forbidden error message to actionable gcloud login instructions", () => {
    const error403 = Object.assign(new Error("The caller does not have permission"), {
      status: 403,
    });
    const translated = translateDriveError(error403, "uploadTextFile");

    expect(translated.message).toContain("Authentication / Permission Error (403)");
    expect(translated.message).toContain("gcloud auth application-default login");
  });

  it("should translate storage quota error to shared drive instructions", () => {
    const quotaError = new Error("Service Accounts do not have storage quota on personal drive");
    const translated = translateDriveError(quotaError, "uploadTextFile");

    expect(translated.message).toContain("Storage Quota Error");
    expect(translated.message).toContain("Google Workspace Shared Drive");
  });

  it("should translate revoked credentials (invalid_grant) error to actionable gcloud login instructions", () => {
    const revokedError = {
      message: "invalid_grant: Bad Request / Could not refresh access token",
      status: 400,
    };
    const translated = translateDriveError(revokedError, "listFiles");

    expect(translated.message).toContain("Authentication / Permission Error (400)");
    expect(translated.message).toContain(
      "gcloud auth application-default login --impersonate-service-account",
    );
  });

  it("should pass through standard error message for generic errors", () => {
    const genericError = new Error("Network timeout");
    const translated = translateDriveError(genericError, "createFolder");

    expect(translated.message).toBe("Failed to execute createFolder: Network timeout");
  });
});
