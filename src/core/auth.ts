import fs from "node:fs";
import { type drive_v3, google } from "googleapis";
import { log } from "./operationLogger.js";

// Scope definition for Google Drive API
const SCOPES = ["https://www.googleapis.com/auth/drive"];

// Singleton instance for Google Drive Client
let driveClientInstance: drive_v3.Drive | null = null;

export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (driveClientInstance) {
    return driveClientInstance;
  }

  try {
    const keyPath = process.env["GOOGLE_APPLICATION_CREDENTIALS"]?.trim();

    if (keyPath) {
      if (fs.existsSync(keyPath)) {
        log("info", `Auth: Service Account JSON key file verified at '${keyPath}'.`, {
          authMethod: "service_account_key",
          keyPath,
          fileExists: true,
        });
      } else {
        log(
          "warn",
          `Auth: GOOGLE_APPLICATION_CREDENTIALS is set to '${keyPath}', but file does not exist.`,
          {
            authMethod: "adc_fallback",
            keyPath,
            fileExists: false,
            hint: 'Verify file path or run: gcloud auth application-default login --impersonate-service-account="YOUR_SERVICE_ACCOUNT_EMAIL"',
          },
        );
      }
    } else {
      log("info", "Auth: Initializing using Application Default Credentials (ADC).", {
        authMethod: "adc",
      });
    }

    // Uses Keyless Application Default Credentials (ADC) / Key File natively
    const auth = new google.auth.GoogleAuth({
      scopes: SCOPES,
    });

    driveClientInstance = google.drive({ version: "v3", auth });

    log("info", "Auth: Google Drive API client initialized successfully.");

    return driveClientInstance;
  } catch (error) {
    log("error", `Auth failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
