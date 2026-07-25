import * as fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDriveClient } from "../src/core/auth.js";
import { createFolder, downloadFile, listFiles, uploadTextFile } from "../src/core/drive.js";

// 1. Mock 모ดูล auth
vi.mock("../src/core/auth.js", () => ({
  getDriveClient: vi.fn(),
}));

// 2. Mock 모ดูล Node.js สำหรับจัดการไฟล์และ Stream
vi.mock("node:fs", () => ({
  createWriteStream: vi.fn(),
}));

vi.mock("node:stream/promises", () => ({
  pipeline: vi.fn(),
}));

describe("Google Drive Core Module", () => {
  // เพิ่ม mock สำหรับ get (ใช้ใน downloadFile)
  const mockDriveClient = {
    files: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDriveClient).mockResolvedValue(mockDriveClient as never);
  });

  describe("listFiles", () => {
    it("should return mapped file list when files exist", async () => {
      mockDriveClient.files.list.mockResolvedValue({
        data: {
          files: [
            { id: "1", name: "Document.txt", mimeType: "text/plain" },
            { id: "2", name: "Folder", mimeType: "application/vnd.google-apps.folder" },
          ],
        },
      });

      const result = await listFiles({ pageSize: 10 });

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          pageSize: 10,
          fields: "files(id, name, mimeType)",
        }),
      );
      expect(result).toHaveLength(2);
    });

    it("should return an empty array if no files found", async () => {
      mockDriveClient.files.list.mockResolvedValue({
        data: { files: [] },
      });

      const result = await listFiles();
      expect(result).toEqual([]);
    });
  });

  describe("uploadTextFile", () => {
    it("should upload text file successfully and return file details", async () => {
      mockDriveClient.files.create.mockResolvedValue({
        data: { id: "new-id-123", name: "notes.txt", mimeType: "text/plain" },
      });

      const result = await uploadTextFile("notes.txt", "Hello World", "parent-folder-id");

      expect(mockDriveClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            name: "notes.txt",
            mimeType: "text/plain",
            parents: ["parent-folder-id"],
          },
          media: {
            mimeType: "text/plain",
            body: "Hello World",
          },
        }),
      );
      expect(result.id).toBe("new-id-123");
    });
  });

  // ---------------------------------------------------------
  // เพิ่ม Test สำหรับ createFolder
  // ---------------------------------------------------------
  describe("createFolder", () => {
    it("should create a folder successfully with correct mimeType", async () => {
      mockDriveClient.files.create.mockResolvedValue({
        data: {
          id: "folder-id-456",
          name: "MyNewFolder",
          mimeType: "application/vnd.google-apps.folder",
        },
      });

      const result = await createFolder("MyNewFolder", "parent-root-id");

      expect(mockDriveClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            name: "MyNewFolder",
            mimeType: "application/vnd.google-apps.folder",
            parents: ["parent-root-id"],
          },
          fields: "id, name, mimeType",
        }),
      );

      expect(result).toEqual({
        id: "folder-id-456",
        name: "MyNewFolder",
        mimeType: "application/vnd.google-apps.folder",
      });
    });
  });

  // ---------------------------------------------------------
  // เพิ่ม Test สำหรับ downloadFile
  // ---------------------------------------------------------
  describe("downloadFile", () => {
    it("should download a file and stream it to the local destination", async () => {
      // จำลอง Stream object ที่คืนมาจาก Google Drive API
      const mockResponseStream = { on: vi.fn(), pipe: vi.fn() };
      mockDriveClient.files.get.mockResolvedValue({
        data: mockResponseStream,
      });

      // จำลอง WriteStream ของระบบไฟล์ Local
      const mockWriteStream = { write: vi.fn(), end: vi.fn() };
      vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as unknown as fs.WriteStream);

      // จำลองว่า pipeline ทำงานเสร็จสมบูรณ์แบบไม่ติดขัด
      vi.mocked(pipeline).mockResolvedValue(undefined);

      const destPath = "./downloads/test-image.jpg";
      const result = await downloadFile("target-file-id", destPath);

      // ตรวจสอบว่าเรียก API โดยระบุ alt: 'media' และ responseType: 'stream'
      expect(mockDriveClient.files.get).toHaveBeenCalledWith(
        { fileId: "target-file-id", alt: "media" },
        { responseType: "stream" },
      );

      // ตรวจสอบว่าเปิดไฟล์ปลายทางถูกต้อง
      expect(fs.createWriteStream).toHaveBeenCalledWith(destPath);

      // ตรวจสอบว่าจับคู่ข้อมูลจาก Response ลง Local File ถูกต้อง
      expect(pipeline).toHaveBeenCalledWith(mockResponseStream, mockWriteStream);

      // ตรวจสอบผลลัพธ์
      expect(result).toBe(destPath);
    });
  });
});
