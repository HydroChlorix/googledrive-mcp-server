import fs from "node:fs";
import { type drive_v3, google } from "googleapis";
import { log } from "./operationLogger.js";

// Scope definition for Google Drive API
const SCOPES = ["https://www.googleapis.com/auth/drive"];

// Singleton instance for Google Drive Client
let driveClientInstance: drive_v3.Drive | null = null;

export type CredentialType = "service_account_key" | "impersonated_adc" | "user_adc" | "adc";

export function detectCredentialType(keyPath: string): CredentialType {
  try {
    const fileContent = fs.readFileSync(keyPath, "utf-8");
    const parsed = JSON.parse(fileContent);
    switch (parsed?.type) {
      case "service_account":
        return "service_account_key";
      case "impersonated_service_account":
        return "impersonated_adc";
      case "authorized_user":
        return "user_adc";
      default:
        return "service_account_key";
    }
  } catch {
    return "service_account_key";
  }
}

export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (driveClientInstance) {
    return driveClientInstance;
  }

  try {
    const keyPath = process.env["GOOGLE_APPLICATION_CREDENTIALS"]?.trim();
    let authMethod: CredentialType = "adc";

    if (keyPath) {
      if (fs.existsSync(keyPath)) {
        authMethod = detectCredentialType(keyPath);

        log("info", `Auth: Credentials JSON file verified at '${keyPath}' (type: ${authMethod}).`, {
          authMethod,
          keyPath,
          fileExists: true,
        });
      } else {
        log(
          "warn",
          `Auth: GOOGLE_APPLICATION_CREDENTIALS is set to '${keyPath}', but file does not exist. Falling back to ADC.`,
          {
            authMethod: "adc",
            keyPath,
            fileExists: false,
            hint: 'Verify file path or run: gcloud auth application-default login --impersonate-service-account="YOUR_SERVICE_ACCOUNT_EMAIL"',
          },
        );
      }
    } else {
      log("info", "Auth: Initializing using Application Default Credentials (adc).", {
        authMethod: "adc",
      });
    }

    // Uses Keyless Application Default Credentials (ADC) / Key File natively
    const auth = new google.auth.GoogleAuth({
      scopes: SCOPES,
    });

    driveClientInstance = google.drive({ version: "v3", auth });

    const activeModeLabel =
      authMethod === "service_account_key"
        ? "Service Account Key (service_account_key)"
        : authMethod === "impersonated_adc"
          ? "Impersonated Service Account ADC (impersonated_adc)"
          : authMethod === "user_adc"
            ? "User ADC (user_adc)"
            : "Application Default Credentials (adc)";

    log(
      "info",
      `Auth: Google Drive API client initialized successfully using ${activeModeLabel}.`,
      { authMethod },
    );

    return driveClientInstance;
  } catch (error) {
    log("error", `Auth failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
