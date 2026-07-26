import { type drive_v3, google } from "googleapis";

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

    console.error("✅ Google Drive API client initialized successfully.");

    return driveClientInstance;
  } catch (error) {
    console.error("❌ Failed to initialize Google Drive client:", error);
    throw error;
  }
}
