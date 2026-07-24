import fs from "node:fs";
import { type drive_v3, google } from "googleapis";

/**
 * Initializes and returns a Google Drive API client using Application Default Credentials (ADC).
 * This relies on the environment having valid ADC (e.g., via gcloud auth application-default login).
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  // ADR 0001: Strict Zero Key Enforcement
  const credPath = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  if (credPath) {
    try {
      const credsContent = fs.readFileSync(credPath, "utf8");
      const creds = JSON.parse(credsContent) as { private_key?: string };
      if (creds.private_key) {
        throw new Error("การใช้ JSON Key ขัดต่อข้อกำหนดความปลอดภัยของโปรเจกต์ โปรดใช้ ADC หรือ WIF เท่านั้น");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("การใช้ JSON Key")) {
        throw err;
      }
      // Ignore other errors (e.g., file not found, invalid JSON) as they will be handled by GoogleAuth
    }
  }

  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive"],
    // By NOT providing a keyFile or credentials object, we force the use of ADC.
  });

  const authClient = await auth.getClient();

  return google.drive({
    version: "v3",
    auth: authClient as unknown as Parameters<typeof google.drive>[0]["auth"],
  });
}
