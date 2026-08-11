import * as fs from "node:fs";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoundarySafeDriveClient } from "../src/core/DriveClient.js";
import { getDriveClient } from "../src/core/auth.js";

const listFiles: typeof BoundarySafeDriveClient.prototype.listFiles = async (options, client) => {
  const safeClient = await BoundarySafeDriveClient.create(client ?? (await getDriveClient()));
  return safeClient.listFiles(options);
};

const uploadTextFile: typeof BoundarySafeDriveClient.prototype.uploadTextFile = async (
  name,
  content,
  parentId,
  client,
) => {
  const safeClient = await BoundarySafeDriveClient.create(client ?? (await getDriveClient()));
  return safeClient.uploadTextFile(name, content, parentId);
};

const createFolder: typeof BoundarySafeDriveClient.prototype.createFolder = async (
  name,
  parentId,
  client,
) => {
  const safeClient = await BoundarySafeDriveClient.create(client ?? (await getDriveClient()));
  return safeClient.createFolder(name, parentId);
};

const downloadFile: typeof BoundarySafeDriveClient.prototype.downloadFile = async (
  fileId,
  destPath,
  client,
) => {
  const safeClient = await BoundarySafeDriveClient.create(client ?? (await getDriveClient()));
  return safeClient.downloadFile(fileId, destPath);
};

const downloadFileFromUrl: typeof BoundarySafeDriveClient.prototype.downloadFileFromUrl = async (
  url,
  destPath,
  client,
) => {
  const safeClient = await BoundarySafeDriveClient.create(client ?? (await getDriveClient()));
  return safeClient.downloadFileFromUrl(url, destPath);
};

// 1. Mock 모ดูล auth
vi.mock("../src/core/auth.js", () => ({
  getDriveClient: vi.fn(),
}));

// 2. Mock 모ดูล Node.js สำหรับจัดการไฟล์และ Stream
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    createWriteStream: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    lstatSync: vi.fn(() => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    }),
  };
});

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

  const originalSharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;
  const originalRootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDriveClient).mockResolvedValue(mockDriveClient as never);
    process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID = "test-shared-drive-id";
    delete process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  });

  afterEach(() => {
    if (originalSharedDriveId === undefined) {
      delete process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;
    } else {
      process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID = originalSharedDriveId;
    }

    if (originalRootFolderId === undefined) {
      delete process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    } else {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = originalRootFolderId;
    }
  });

  describe("listFiles", () => {
    it("should fail closed without the mandatory Shared Drive boundary", async () => {
      delete process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

      await expect(listFiles({}, mockDriveClient as never)).rejects.toThrow(
        "GOOGLE_DRIVE_SHARED_DRIVE_ID",
      );
      expect(mockDriveClient.files.list).not.toHaveBeenCalled();
    });

    it("should return mapped file list when files exist", async () => {
      mockDriveClient.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: "1",
              name: "Document.txt",
              mimeType: "text/plain",
              driveId: "test-shared-drive-id",
            },
            {
              id: "2",
              name: "Folder",
              mimeType: "application/vnd.google-apps.folder",
              driveId: "test-shared-drive-id",
            },
          ],
        },
      });

      const result = await listFiles({ pageSize: 10 });

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          pageSize: 10,
          fields: "files(id, name, mimeType, driveId, parents, shortcutDetails)",
        }),
      );
      expect(result).toHaveLength(2);
    });

    it("should scope the Google Drive listing to the configured Shared Drive", async () => {
      mockDriveClient.files.list.mockResolvedValue({ data: { files: [] } });

      await listFiles({}, mockDriveClient as never);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          driveId: "test-shared-drive-id",
          corpora: "drive",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        }),
      );
    });

    it("should fail closed when the configured Root Folder is outside the Shared Drive", async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = "root-folder-id";
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "root-folder-id",
          driveId: "other-shared-drive-id",
          mimeType: "application/vnd.google-apps.folder",
        },
      });

      await expect(listFiles({}, mockDriveClient as never)).rejects.toThrow("Root Folder boundary");
      expect(mockDriveClient.files.list).not.toHaveBeenCalled();
    });

    it("should omit files directly outside the configured Root Folder", async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = "root-folder-id";
      mockDriveClient.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: "inside-file",
              name: "Inside.txt",
              mimeType: "text/plain",
              driveId: "test-shared-drive-id",
              parents: ["root-folder-id"],
            },
            {
              id: "outside-file",
              name: "Outside.txt",
              mimeType: "text/plain",
              driveId: "test-shared-drive-id",
              parents: ["other-folder-id"],
            },
          ],
        },
      });
      mockDriveClient.files.get.mockImplementation((params) => {
        if (params.fileId === "root-folder-id") {
          return Promise.resolve({
            data: {
              id: "root-folder-id",
              driveId: "test-shared-drive-id",
              mimeType: "application/vnd.google-apps.folder",
            },
          });
        }

        return Promise.resolve({
          data: {
            id: "other-folder-id",
            driveId: "test-shared-drive-id",
            mimeType: "application/vnd.google-apps.folder",
            parents: [],
          },
        });
      });

      const result = await listFiles({}, mockDriveClient as never);

      expect(result).toEqual([{ id: "inside-file", name: "Inside.txt", mimeType: "text/plain" }]);
    });

    it("should include a descendant below the configured Root Folder", async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = "root-folder-id";
      mockDriveClient.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: "nested-file",
              name: "Nested.txt",
              mimeType: "text/plain",
              driveId: "test-shared-drive-id",
              parents: ["nested-folder-id"],
            },
          ],
        },
      });
      mockDriveClient.files.get.mockImplementation((params) => {
        if (params.fileId === "root-folder-id") {
          return Promise.resolve({
            data: {
              id: "root-folder-id",
              driveId: "test-shared-drive-id",
              mimeType: "application/vnd.google-apps.folder",
            },
          });
        }

        return Promise.resolve({
          data: {
            id: "nested-folder-id",
            driveId: "test-shared-drive-id",
            mimeType: "application/vnd.google-apps.folder",
            parents: ["root-folder-id"],
          },
        });
      });

      const result = await listFiles({}, mockDriveClient as never);

      expect(result).toEqual([{ id: "nested-file", name: "Nested.txt", mimeType: "text/plain" }]);
    });

    it("should hide a Shortcut whose target fails the boundary check", async () => {
      mockDriveClient.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: "rejected-shortcut-id",
              name: "Rejected shortcut",
              mimeType: "application/vnd.google-apps.shortcut",
              driveId: "test-shared-drive-id",
              parents: ["root-folder-id"],
              shortcutDetails: {
                targetId: "outside-target-id",
                targetMimeType: "text/plain",
              },
            },
          ],
        },
      });
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "outside-target-id",
          name: "Outside.txt",
          mimeType: "text/plain",
          driveId: "other-shared-drive-id",
        },
      });

      const result = await listFiles({}, mockDriveClient as never);

      expect(result).toEqual([]);
      expect(result.some((file) => file.id === "outside-target-id")).toBe(false);
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
    it("should fail closed without the mandatory Shared Drive boundary", async () => {
      delete process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

      await expect(
        uploadTextFile("notes.txt", "Hello World", "parent-folder-id", mockDriveClient as never),
      ).rejects.toThrow("GOOGLE_DRIVE_SHARED_DRIVE_ID");
      expect(mockDriveClient.files.create).not.toHaveBeenCalled();
    });

    it("should reject an upload parent outside the configured Root Folder", async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = "root-folder-id";
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "outside-parent-id",
          driveId: "test-shared-drive-id",
          mimeType: "application/vnd.google-apps.folder",
          parents: ["other-folder-id"],
        },
      });

      await expect(
        uploadTextFile("notes.txt", "Hello World", "outside-parent-id", mockDriveClient as never),
      ).rejects.toThrow("Root Folder boundary");
      expect(mockDriveClient.files.create).not.toHaveBeenCalled();
    });

    it("should reject an upload parent from another Shared Drive", async () => {
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "cross-drive-parent-id",
          driveId: "other-shared-drive-id",
          mimeType: "application/vnd.google-apps.folder",
          parents: [],
        },
      });

      await expect(
        uploadTextFile(
          "notes.txt",
          "Hello World",
          "cross-drive-parent-id",
          mockDriveClient as never,
        ),
      ).rejects.toThrow("configured Shared Drive");
      expect(mockDriveClient.files.create).not.toHaveBeenCalled();
    });

    it("should upload text file successfully and return file details", async () => {
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "parent-folder-id",
          driveId: "test-shared-drive-id",
          mimeType: "application/vnd.google-apps.folder",
          parents: [],
        },
      });
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
    it("should fail closed without the mandatory Shared Drive boundary", async () => {
      delete process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

      await expect(
        createFolder("MyNewFolder", "parent-root-id", mockDriveClient as never),
      ).rejects.toThrow("GOOGLE_DRIVE_SHARED_DRIVE_ID");
      expect(mockDriveClient.files.create).not.toHaveBeenCalled();
    });

    it("should create a folder successfully with correct mimeType", async () => {
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "parent-root-id",
          driveId: "test-shared-drive-id",
          mimeType: "application/vnd.google-apps.folder",
          parents: [],
        },
      });
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

    it("should reject a folder parent from another Shared Drive", async () => {
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "cross-drive-parent-id",
          driveId: "other-shared-drive-id",
          mimeType: "application/vnd.google-apps.folder",
          parents: [],
        },
      });

      await expect(
        createFolder("MyNewFolder", "cross-drive-parent-id", mockDriveClient as never),
      ).rejects.toThrow("configured Shared Drive");
      expect(mockDriveClient.files.create).not.toHaveBeenCalled();
    });
  });

  describe("downloadFile", () => {
    it("should fail closed without the mandatory Shared Drive boundary", async () => {
      delete process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

      await expect(
        downloadFile("target-file-id", "./downloads/test-image.jpg", mockDriveClient as never),
      ).rejects.toThrow("GOOGLE_DRIVE_SHARED_DRIVE_ID");
      expect(mockDriveClient.files.get).not.toHaveBeenCalled();
    });

    it("should reject a direct file ID outside the configured Shared Drive", async () => {
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "outside-file-id",
          name: "Outside.txt",
          mimeType: "text/plain",
          driveId: "other-shared-drive-id",
        },
      });

      await expect(
        downloadFile("outside-file-id", "./downloads/outside.txt", mockDriveClient as never),
      ).rejects.toThrow("configured Shared Drive");
      expect(fs.createWriteStream).not.toHaveBeenCalled();
    });

    it("should reject a direct file ID when Shared Drive metadata is missing", async () => {
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "unverifiable-file-id",
          name: "Unverifiable.txt",
          mimeType: "text/plain",
        },
      });

      await expect(
        downloadFile(
          "unverifiable-file-id",
          "./downloads/unverifiable.txt",
          mockDriveClient as never,
        ),
      ).rejects.toThrow("configured Shared Drive");
      expect(fs.createWriteStream).not.toHaveBeenCalled();
    });

    it("should reject a Shortcut that targets a Folder", async () => {
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "folder-shortcut-id",
          name: "Folder shortcut",
          mimeType: "application/vnd.google-apps.shortcut",
          driveId: "test-shared-drive-id",
          shortcutDetails: {
            targetId: "target-folder-id",
            targetMimeType: "application/vnd.google-apps.folder",
          },
        },
      });

      await expect(
        downloadFile("folder-shortcut-id", "./downloads/folder-shortcut", mockDriveClient as never),
      ).rejects.toThrow("Shortcut to a Folder");
      expect(fs.createWriteStream).not.toHaveBeenCalled();
    });

    it("should reject a Shortcut target outside the configured Shared Drive", async () => {
      mockDriveClient.files.get.mockImplementation((params) => {
        if (params.fileId === "cross-drive-shortcut-id") {
          return Promise.resolve({
            data: {
              id: "cross-drive-shortcut-id",
              name: "Cross-drive shortcut",
              mimeType: "application/vnd.google-apps.shortcut",
              driveId: "test-shared-drive-id",
              shortcutDetails: {
                targetId: "cross-drive-target-id",
                targetMimeType: "text/plain",
              },
            },
          });
        }

        return Promise.resolve({
          data: {
            id: "cross-drive-target-id",
            name: "Outside.txt",
            mimeType: "text/plain",
            driveId: "other-shared-drive-id",
          },
        });
      });

      await expect(
        downloadFile(
          "cross-drive-shortcut-id",
          "./downloads/cross-drive.txt",
          mockDriveClient as never,
        ),
      ).rejects.toThrow("configured Shared Drive");
      expect(fs.createWriteStream).not.toHaveBeenCalled();
    });

    it("should reject a recursive Shortcut target", async () => {
      mockDriveClient.files.get.mockImplementation((params) => {
        if (params.fileId === "recursive-shortcut-id") {
          return Promise.resolve({
            data: {
              id: "recursive-shortcut-id",
              name: "Recursive shortcut",
              mimeType: "application/vnd.google-apps.shortcut",
              driveId: "test-shared-drive-id",
              shortcutDetails: {
                targetId: "nested-shortcut-id",
                targetMimeType: "application/vnd.google-apps.shortcut",
              },
            },
          });
        }

        return Promise.resolve({
          data: {
            id: "nested-shortcut-id",
            name: "Nested shortcut",
            mimeType: "application/vnd.google-apps.shortcut",
            driveId: "test-shared-drive-id",
            shortcutDetails: {
              targetId: "target-file-id",
              targetMimeType: "text/plain",
            },
          },
        });
      });

      await expect(
        downloadFile("recursive-shortcut-id", "./downloads/recursive", mockDriveClient as never),
      ).rejects.toThrow("Recursive Shortcut");
      expect(fs.createWriteStream).not.toHaveBeenCalled();
    });

    it("should reject a Shortcut target when its Shared Drive metadata is missing", async () => {
      mockDriveClient.files.get.mockImplementation((params) => {
        if (params.fileId === "unverifiable-shortcut-id") {
          return Promise.resolve({
            data: {
              id: "unverifiable-shortcut-id",
              name: "Unverifiable shortcut",
              mimeType: "application/vnd.google-apps.shortcut",
              driveId: "test-shared-drive-id",
              shortcutDetails: {
                targetId: "unverifiable-target-id",
                targetMimeType: "text/plain",
              },
            },
          });
        }

        return Promise.resolve({
          data: {
            id: "unverifiable-target-id",
            name: "Unverifiable.txt",
            mimeType: "text/plain",
          },
        });
      });

      await expect(
        downloadFile(
          "unverifiable-shortcut-id",
          "./downloads/unverifiable-shortcut",
          mockDriveClient as never,
        ),
      ).rejects.toThrow("configured Shared Drive");
      expect(fs.createWriteStream).not.toHaveBeenCalled();
    });

    it("should resolve one hop to an in-bound Shortcut File", async () => {
      mockDriveClient.files.get.mockImplementation((params) => {
        if (params.fileId === "allowed-shortcut-id") {
          return Promise.resolve({
            data: {
              id: "allowed-shortcut-id",
              name: "Allowed shortcut",
              mimeType: "application/vnd.google-apps.shortcut",
              driveId: "test-shared-drive-id",
              shortcutDetails: {
                targetId: "allowed-target-id",
                targetMimeType: "text/plain",
              },
            },
          });
        }

        if (params.fileId === "allowed-target-id" && params.fields) {
          return Promise.resolve({
            data: {
              id: "allowed-target-id",
              name: "Inside.txt",
              mimeType: "text/plain",
              driveId: "test-shared-drive-id",
            },
          });
        }

        return Promise.resolve({ data: { on: vi.fn(), pipe: vi.fn() } });
      });
      vi.mocked(fs.createWriteStream).mockReturnValue({} as fs.WriteStream);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(pipeline).mockResolvedValue(undefined);

      await downloadFile(
        "allowed-shortcut-id",
        "./downloads/allowed.txt",
        mockDriveClient as never,
      );

      expect(mockDriveClient.files.get).toHaveBeenCalledWith(
        { fileId: "allowed-target-id", alt: "media", supportsAllDrives: true },
        { responseType: "stream" },
      );
    });

    it("should download a standard file and stream it to the local destination", async () => {
      // จำลอง Metadata สำหรับไฟล์ทั่วไป
      mockDriveClient.files.get.mockImplementation((params) => {
        if (params.fields) {
          return Promise.resolve({
            data: {
              id: "target-file-id",
              name: "image.jpg",
              mimeType: "image/jpeg",
              driveId: "test-shared-drive-id",
            },
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
      const expectedDir = path.resolve(process.cwd(), "./downloads");
      const expectedDest = path.resolve(process.cwd(), destPath);

      const result = await downloadFile("target-file-id", destPath);

      expect(fs.existsSync).toHaveBeenCalledWith(expectedDir);
      expect(fs.mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true });

      expect(mockDriveClient.files.get).toHaveBeenCalledWith(
        { fileId: "target-file-id", alt: "media", supportsAllDrives: true },
        { responseType: "stream" },
      );

      expect(result).toBe(expectedDest);
    });

    it("should export a Google Workspace Document to text/plain (ADR-0003)", async () => {
      // จำลอง Metadata สำหรับ Google Docs
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "doc-file-id",
          name: "Project Report",
          mimeType: "application/vnd.google-apps.document",
          driveId: "test-shared-drive-id",
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
      const expectedDest = path.resolve(process.cwd(), destPath);
      const result = await downloadFile("doc-file-id", destPath);

      expect(mockDriveClient.files.export).toHaveBeenCalledWith(
        { fileId: "doc-file-id", mimeType: "text/plain" },
        { responseType: "stream" },
      );

      expect(result).toBe(expectedDest);
    });
  });

  describe("downloadFileFromUrl", () => {
    it("should successfully download a binary file from external URL", async () => {
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "ext-file-123",
          name: "external.png",
          mimeType: "image/png",
        },
      });

      const mockReadStream = { on: vi.fn(), pipe: vi.fn() };
      mockDriveClient.files.get.mockImplementation(async (params) => {
        if (params.alt === "media") {
          return { data: mockReadStream };
        }
        return {
          data: {
            id: "ext-file-123",
            name: "external.png",
            mimeType: "image/png",
          },
        };
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(pipeline).mockResolvedValue(undefined);

      const url = "https://drive.google.com/file/d/ext-file-123/view";
      const destPath = "./downloads/external.png";
      const result = await downloadFileFromUrl(url, destPath);

      expect(result).toBe(path.resolve(process.cwd(), destPath));
    });

    it("should reject downloading shortcuts via URL", async () => {
      mockDriveClient.files.get.mockResolvedValue({
        data: {
          id: "shortcut-id",
          name: "Shortcut",
          mimeType: "application/vnd.google-apps.shortcut",
          shortcutDetails: { targetId: "real-id", targetMimeType: "text/plain" },
        },
      });

      const url = "https://drive.google.com/file/d/shortcut-id/view";
      await expect(downloadFileFromUrl(url, "./downloads/shortcut.txt")).rejects.toThrow(
        "Shortcut files cannot be downloaded via URL.",
      );
    });
  });
});
