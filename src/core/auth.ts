import { type drive_v3, google } from "googleapis";
import { log } from "./operationLogger.js";

// 1. Scope definition for Google Drive API
const SCOPES = ["https://www.googleapis.com/auth/drive"];

// Singleton instance for Google Drive Client
let driveClientInstance: drive_v3.Drive | null = null;

export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (driveClientInstance) {
    return driveClientInstance;
  }

  try {
    // Uses Keyless Application Default Credentials (ADC) natively
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
