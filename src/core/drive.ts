import * as fs from "node:fs";
import { pipeline } from "node:stream/promises";
import type { drive_v3 } from "googleapis";
import { getDriveClient } from "./auth.js";

// 1. นิยามโครงสร้างข้อมูลที่จะส่งกลับ
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface ListFilesOptions {
  pageSize?: number | undefined;
  query?: string | undefined;
}

/**
 * ดึงรายการไฟล์จาก Google Drive
 */
export async function listFiles(options: ListFilesOptions = {}): Promise<DriveFile[]> {
  const drive = await getDriveClient();
  const { pageSize = 10, query } = options;

  try {
    const response = await drive.files.list({
      pageSize,
      // ใช้เงื่อนไข: ถ้า query มีค่า ให้แตก object { q: query } เข้าไป, ถ้าไม่มีให้ใส่ object ว่าง
      ...(query ? { q: query } : {}),
      fields: "files(id, name, mimeType)",
    });

    const files = response.data.files;

    if (!files || files.length === 0) {
      return [];
    }

    return files.map((file) => ({
      id: file.id ?? "unknown-id",
      name: file.name ?? "Untitled",
      mimeType: file.mimeType ?? "unknown",
    }));
  } catch (error) {
    console.error("❌ Error in core.listFiles:", error);
    throw new Error("Failed to list files from Google Drive");
  }
}

/**
 * อัปโหลดไฟล์ข้อความ (Text-based file) ขึ้น Google Drive
 */
export async function uploadTextFile(
  name: string,
  content: string,
  parentId?: string,
): Promise<DriveFile> {
  const drive = await getDriveClient();

  // 2. ใช้ Type ที่ Google เตรียมไว้ให้ (Schema$File)
  const fileMetadata: drive_v3.Schema$File = {
    name,
    mimeType: "text/plain",
  };

  // 3. สามารถใช้ Dot notation ได้ปกติ เพราะ Type ถูกต้องแล้ว
  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const media = {
    mimeType: "text/plain",
    body: content,
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata, // 4. ใช้ requestBody ตามมาตรฐาน API ใหม่
      media: media,
      fields: "id, name, mimeType",
    });

    const file = response.data;

    return {
      id: file.id ?? "unknown-id",
      name: file.name ?? name,
      mimeType: file.mimeType ?? "text/plain",
    };
  } catch (error) {
    console.error("❌ Error in core.uploadTextFile:", error);
    throw new Error(`Failed to upload file: ${name}`);
  }
}
/**
 * สร้างโฟลเดอร์ใหม่ใน Google Drive
 */
export async function createFolder(name: string, parentId?: string): Promise<DriveFile> {
  const drive = await getDriveClient();

  const fileMetadata: drive_v3.Schema$File = {
    name,
    mimeType: "application/vnd.google-apps.folder", // MimeType เฉพาะสำหรับ Folder
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name, mimeType",
    });

    const file = response.data;

    return {
      id: file.id ?? "unknown-id",
      name: file.name ?? name,
      mimeType: file.mimeType ?? "application/vnd.google-apps.folder",
    };
  } catch (error) {
    console.error("❌ Error in core.createFolder:", error);
    throw new Error(`Failed to create folder: ${name}`);
  }
}

/**
 * ดาวน์โหลดไฟล์จาก Google Drive มาบันทึกลงใน Local File System
 * (รองรับเฉพาะไฟล์ทั่วไป เช่น รูปภาพ, วิดีโอ, PDF, Text. ไม่รองรับ Google Docs/Sheets)
 */
export async function downloadFile(fileId: string, destPath: string): Promise<string> {
  const drive = await getDriveClient();

  try {
    // กำหนด responseType เป็น stream เพื่อไม่ให้กิน Memory หากไฟล์ใหญ่
    const response = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });

    const dest = fs.createWriteStream(destPath);

    // โอนถ่ายข้อมูลจาก API ลงไฟล์ตรงๆ
    await pipeline(response.data, dest);

    return destPath;
  } catch (error) {
    console.error(`❌ Error in core.downloadFile for ID ${fileId}:`, error);
    throw new Error(`Failed to download file ID: ${fileId}`);
  }
}
