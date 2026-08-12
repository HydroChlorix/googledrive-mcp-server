import type { drive_v3 } from "googleapis";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BoundaryGuard } from "../src/core/BoundaryGuard.js";

describe("BoundaryGuard Unit Tests", () => {
  const mockDrive = {
    files: {
      get: vi.fn(),
    },
  } as unknown as drive_v3.Drive;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assertRootFolderWithinBoundary", () => {
    it("should pass when rootFolderId is undefined", async () => {
      const guard = new BoundaryGuard(mockDrive, "shared-drive-1", undefined);
      await expect(guard.assertRootFolderWithinBoundary()).resolves.toBeUndefined();
    });

    it("should pass when rootFolder belongs to configured Shared Drive", async () => {
      const guard = new BoundaryGuard(mockDrive, "shared-drive-1", "root-123");
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: {
          id: "root-123",
          driveId: "shared-drive-1",
          mimeType: "application/vnd.google-apps.folder",
        },
      } as never);

      await expect(guard.assertRootFolderWithinBoundary()).resolves.toBeUndefined();
    });

    it("should fail when rootFolder belongs to a different Shared Drive", async () => {
      const guard = new BoundaryGuard(mockDrive, "shared-drive-1", "root-123");
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: {
          id: "root-123",
          driveId: "shared-drive-2",
          mimeType: "application/vnd.google-apps.folder",
        },
      } as never);

      await expect(guard.assertRootFolderWithinBoundary()).rejects.toThrow(
        "outside the configured Root Folder boundary",
      );
    });
  });

  describe("resolveFileWithinBoundary", () => {
    it("should throw error if file is outside configured Shared Drive", async () => {
      const guard = new BoundaryGuard(mockDrive, "shared-drive-1", undefined);
      const file = { id: "f1", driveId: "shared-drive-2" };

      await expect(guard.resolveFileWithinBoundary(file)).rejects.toThrow(
        "outside the configured Shared Drive boundary",
      );
    });

    it("should return file if file is within configured Shared Drive", async () => {
      const guard = new BoundaryGuard(mockDrive, "shared-drive-1", undefined);
      const file = { id: "f1", driveId: "shared-drive-1", mimeType: "text/plain" };

      const result = await guard.resolveFileWithinBoundary(file);
      expect(result).toEqual(file);
    });
  });
});
