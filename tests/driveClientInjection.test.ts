import * as fs from "node:fs";
import { pipeline } from "node:stream/promises";
import type { drive_v3 } from "googleapis";
import { describe, expect, it, vi } from "vitest";
import { createFolder, downloadFile, listFiles, uploadTextFile } from "../src/core/drive.js";

vi.mock("node:fs", () => ({
  createWriteStream: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:stream/promises", () => ({
  pipeline: vi.fn(),
}));

describe("Drive Client Dependency Injection Seam", () => {
  const customDriveMock = {
    files: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      export: vi.fn(),
    },
  } as unknown as drive_v3.Drive;

  it("should use injected drive client for listFiles", async () => {
    vi.mocked(customDriveMock.files.list).mockResolvedValue({
      data: {
        files: [{ id: "injected-1", name: "Injected.txt", mimeType: "text/plain" }],
      },
    } as never);

    const result = await listFiles({ pageSize: 5 }, customDriveMock);

    expect(customDriveMock.files.list).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 5 }),
    );
    expect(result).toEqual([{ id: "injected-1", name: "Injected.txt", mimeType: "text/plain" }]);
  });

  it("should use injected drive client for uploadTextFile", async () => {
    vi.mocked(customDriveMock.files.create).mockResolvedValue({
      data: { id: "injected-upload-id", name: "test.txt", mimeType: "text/plain" },
    } as never);

    const result = await uploadTextFile("test.txt", "hello", undefined, customDriveMock);

    expect(customDriveMock.files.create).toHaveBeenCalled();
    expect(result.id).toBe("injected-upload-id");
  });

  it("should use injected drive client for createFolder", async () => {
    vi.mocked(customDriveMock.files.create).mockResolvedValue({
      data: {
        id: "injected-folder-id",
        name: "TestFolder",
        mimeType: "application/vnd.google-apps.folder",
      },
    } as never);

    const result = await createFolder("TestFolder", undefined, customDriveMock);

    expect(customDriveMock.files.create).toHaveBeenCalled();
    expect(result.id).toBe("injected-folder-id");
  });

  it("should use injected drive client for downloadFile", async () => {
    vi.mocked(customDriveMock.files.get).mockImplementation((params: { fields?: string }) => {
      if (params?.fields) {
        return Promise.resolve({
          data: { id: "injected-file", name: "img.jpg", mimeType: "image/jpeg" },
        } as never);
      }
      return Promise.resolve({
        data: { on: vi.fn(), pipe: vi.fn() },
      } as never);
    });

    const mockWriteStream = { write: vi.fn(), end: vi.fn() };
    vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as unknown as fs.WriteStream);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(pipeline).mockResolvedValue(undefined);

    const result = await downloadFile("injected-file", "./img.jpg", customDriveMock);

    expect(customDriveMock.files.get).toHaveBeenCalledWith(
      { fileId: "injected-file", alt: "media", supportsAllDrives: true },
      { responseType: "stream" },
    );
    expect(result).toBe("./img.jpg");
  });
});
