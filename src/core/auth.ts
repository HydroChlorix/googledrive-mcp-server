import { type drive_v3, google } from "googleapis";

// 1. กำหนดสิทธิ์ที่ต้องการ (Scopes)
// แนะนำให้ใช้สิทธิ์แบบกว้างสำหรับการทำ Agent แต่ถ้าอยากจำกัดความปลอดภัย สามารถเปลี่ยนเป็น '.../drive.readonly' ได้
const SCOPES = ["https://www.googleapis.com/auth/drive"];

// ตัวแปรเก็บ Instance ของ Drive Client ไว้ใช้ซ้ำ (Singleton)
let driveClientInstance: drive_v3.Drive | null = null;

export async function getDriveClient(): Promise<drive_v3.Drive> {
  // ถ้ามี Client อยู่แล้ว ให้ Return กลับไปเลย ไม่ต้อง Auth ใหม่
  if (driveClientInstance) {
    return driveClientInstance;
  }

  try {
    // 2. ใช้ GoogleAuth ซึ่งเป็นมาตรฐานใหม่
    // มันจะวิ่งหาไฟล์ Key อัตโนมัติจาก Environment Variable: GOOGLE_APPLICATION_CREDENTIALS
    const auth = new google.auth.GoogleAuth({
      scopes: SCOPES,
      // 💡 หรือถ้าจะฮาร์ดโค้ดพาธไฟล์ (เช่น ตอนพัฒนา) สามารถปลดคอมเมนต์บรรทัดล่างนี้ได้
      // keyFile: './credentials.json',
    });

    // 3. สร้าง Drive Client
    driveClientInstance = google.drive({ version: "v3", auth });

    console.error("✅ Google Drive API client initialized successfully.");

    return driveClientInstance;
  } catch (error) {
    console.error("❌ Failed to initialize Google Drive client:", error);
    throw error;
  }
}
