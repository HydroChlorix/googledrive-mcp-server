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
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
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
      export: vi.fn(),
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
            body: expect.anything(),
          },
        }),
      );
      expect(result.id).toBe("new-id-123");
    });
  });

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

  describe("downloadFile", () => {
    it("should download a standard file and stream it to the local destination", async () => {
      // จำลอง Metadata สำหรับไฟล์ทั่วไป
      mockDriveClient.files.get.mockImplementation((params) => {
        if (params.fields) {
          return Promise.resolve({
            data: { id: "target-file-id", name: "image.jpg", mimeType: "image/jpeg" },
          });
        }
        return Promise.resolve({
          data: { on: vi.fn(), pipe: vi.fn() },
        });
      });

      const mockWriteStream = { write: vi.fn(), end: vi.fn() };
      vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as unknown as fs.WriteStream);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(pipeline).mockResolvedValue(undefined);

      const destPath = "./downloads/test-image.jpg";
      const result = await downloadFile("target-file-id", destPath);

      expect(fs.existsSync).toHaveBeenCalledWith("./downloads");
      expect(fs.mkdirSync).toHaveBeenCalledWith("./downloads", { recursive: true });

      expect(mockDriveClient.files.get).toHaveBeenCalledWith(
        { fileId: "target-file-id", alt: "media", supportsAllDrives: true },
        { responseType: "stream" },
      );

      expect(result).toBe(destPath);
    });

    it("should export a Google Workspace Document to text/plain (ADR-0003)", async () => {
      // จำลอง Metadata สำหรับ Google Docs
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "doc-file-id",
          name: "Project Report",
          mimeType: "application/vnd.google-apps.document",
        },
      });

      const mockExportStream = { on: vi.fn(), pipe: vi.fn() };
      mockDriveClient.files.export.mockResolvedValue({
        data: mockExportStream,
      });

      const mockWriteStream = { write: vi.fn(), end: vi.fn() };
      vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as unknown as fs.WriteStream);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(pipeline).mockResolvedValue(undefined);

      const destPath = "./downloads/report.txt";
      const result = await downloadFile("doc-file-id", destPath);

      expect(mockDriveClient.files.export).toHaveBeenCalledWith(
        { fileId: "doc-file-id", mimeType: "text/plain" },
        { responseType: "stream" },
      );

      expect(result).toBe(destPath);
    });
  });
});
