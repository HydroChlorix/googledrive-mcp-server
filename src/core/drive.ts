import * as fs from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { drive_v3 } from "googleapis";
import { translateDriveError } from "../utils/authErrorAdapter.js";
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
export async function listFiles(
  options: ListFilesOptions = {},
  client?: drive_v3.Drive,
): Promise<DriveFile[]> {
  const drive = client ?? (await getDriveClient());
  const { pageSize = 10, query } = options;

  try {
    const response = await drive.files.list({
      pageSize,
      // ใช้เงื่อนไข: ถ้า query มีค่า ให้แตก object { q: query } เข้าไป, ถ้าไม่มีให้ใส่ object ว่าง
      ...(query ? { q: query } : {}),
      fields: "files(id, name, mimeType)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
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
    throw translateDriveError(error, "core.listFiles");
  }
}

/**
 * อัปโหลดไฟล์ข้อความ (Text-based file) ขึ้น Google Drive
 */
export async function uploadTextFile(
  name: string,
  content: string,
  parentId: string,
  client?: drive_v3.Drive,
): Promise<DriveFile> {
  const drive = client ?? (await getDriveClient());

  // 2. ใช้ Type ที่ Google เตรียมไว้ให้ (Schema$File)
  const fileMetadata: drive_v3.Schema$File = {
    name,
    mimeType: "text/plain",
  };

  fileMetadata.parents = [parentId];

  const media = {
    mimeType: "text/plain",
    body: Readable.from([content]),
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata, // 4. ใช้ requestBody ตามมาตรฐาน API ใหม่
      media: media,
      fields: "id, name, mimeType",
      supportsAllDrives: true,
    });

    const file = response.data;

    return {
      id: file.id ?? "unknown-id",
      name: file.name ?? name,
      mimeType: file.mimeType ?? "text/plain",
    };
  } catch (error) {
    console.error("❌ Error in core.uploadTextFile:", error);
    throw translateDriveError(error, `core.uploadTextFile for ${name}`);
  }
}

/**
 * สร้างโฟลเดอร์ใหม่ใน Google Drive
 */
export async function createFolder(
  name: string,
  parentId: string,
  client?: drive_v3.Drive,
): Promise<DriveFile> {
  const drive = client ?? (await getDriveClient());

  const fileMetadata: drive_v3.Schema$File = {
    name,
    mimeType: "application/vnd.google-apps.folder", // MimeType เฉพาะสำหรับ Folder
  };

  fileMetadata.parents = [parentId];

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name, mimeType",
      supportsAllDrives: true,
    });

    const file = response.data;

    return {
      id: file.id ?? "unknown-id",
      name: file.name ?? name,
      mimeType: file.mimeType ?? "application/vnd.google-apps.folder",
    };
  } catch (error) {
    console.error("❌ Error in core.createFolder:", error);
    throw translateDriveError(error, `core.createFolder for ${name}`);
  }
}

/**
 * ดาวน์โหลดไฟล์จาก Google Drive มาบันทึกลงใน Local File System
 * (รองรับไฟล์ทั่วไป และส่งออกไฟล์ Google Workspace เป็น text/plain อัตโนมัติ ตาม ADR-0003)
 */
export async function downloadFile(
  fileId: string,
  destPath: string,
  client?: drive_v3.Drive,
): Promise<string> {
  const drive = client ?? (await getDriveClient());

  try {
    // 🛡️ SECURITY FIX: Path Traversal Prevention
    // บังคับให้ไฟล์ที่ถูกดาวน์โหลด ต้องอยู่ภายใต้ Current Working Directory ของโปรเซสที่รันอยู่เท่านั้น
    const resolvedDestPath = path.resolve(process.cwd(), destPath);
    if (!resolvedDestPath.startsWith(process.cwd())) {
      throw new Error(
        `Security Error: Path traversal detected. Destination must be within the current working directory (${process.cwd()}). Access to ${resolvedDestPath} is forbidden.`,
      );
    }

    const dir = path.dirname(resolvedDestPath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 1. ตรวจสอบ Metadata เพื่อเช็กว่า เป็น Google Workspace Document หรือไม่ (ADR-0003)
    const metaResponse = await drive.files.get({
      fileId,
      fields: "id, name, mimeType",
      supportsAllDrives: true,
    });

    const mimeType = metaResponse.data.mimeType ?? "";
    const isWorkspaceDoc =
      mimeType.startsWith("application/vnd.google-apps.") &&
      mimeType !== "application/vnd.google-apps.folder";

    const dest = fs.createWriteStream(resolvedDestPath);

    if (isWorkspaceDoc) {
      // 2. ถ้าเป็น Google Docs/Sheets/Slides ให้ส่งออกเป็น text/plain
      const exportResponse = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "stream" },
      );
      await pipeline(exportResponse.data, dest);
    } else {
      // 3. ถ้าเป็นไฟล์ทั่วไป (Binary/Text) ให้ดาวน์โหลดปกติ
      const getResponse = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "stream" },
      );
      await pipeline(getResponse.data, dest);
    }

    return resolvedDestPath;
  } catch (error) {
    console.error(`❌ Error in core.downloadFile for ID ${fileId}:`, error);
    throw translateDriveError(error, `core.downloadFile for ID ${fileId}`);
  }
}
