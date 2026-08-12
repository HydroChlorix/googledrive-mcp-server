import * as path from "node:path";
import { Readable } from "node:stream";
import type { drive_v3 } from "googleapis";
import { translateDriveError } from "../utils/authErrorAdapter.js";
import { parseDriveUrl, redactDriveUrl } from "../utils/urlParser.js";
import { BoundaryGuard } from "./BoundaryGuard.js";
import { type FileSystemAdapter, defaultFileSystemAdapter } from "./FileSystemAdapter.js";
import { log } from "./operationLogger.js";
import { ResiliencePipeline } from "./resilience.js";

/** Maximum download size in bytes (100 MB). Prevents disk-fill DoS (F-04). */
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface ListFilesOptions {
  pageSize?: number | undefined;
  query?: string | undefined;
}

export class BoundarySafeDriveClient {
  private readonly resilience = new ResiliencePipeline();
  private readonly guard: BoundaryGuard;

  constructor(
    private readonly drive: drive_v3.Drive,
    private readonly sharedDriveId: string,
    rootFolderId: string | undefined,
    private readonly fileSystem: FileSystemAdapter = defaultFileSystemAdapter,
  ) {
    this.guard = new BoundaryGuard(drive, sharedDriveId, rootFolderId);
  }

  public static async create(
    client: drive_v3.Drive,
    fileSystem: FileSystemAdapter = defaultFileSystemAdapter,
  ): Promise<BoundarySafeDriveClient> {
    const sharedDriveId = process.env["GOOGLE_DRIVE_SHARED_DRIVE_ID"]?.trim();
    if (!sharedDriveId) {
      throw new Error(
        "GOOGLE_DRIVE_SHARED_DRIVE_ID is required; refusing to access Google Drive without a configured Shared Drive boundary.",
      );
    }
    const rootFolderId = process.env["GOOGLE_DRIVE_ROOT_FOLDER_ID"]?.trim() || undefined;

    const instance = new BoundarySafeDriveClient(client, sharedDriveId, rootFolderId, fileSystem);
    await instance.guard.assertRootFolderWithinBoundary();
    log(
      "info",
      `Shared Drive: ${sharedDriveId}${rootFolderId ? `, Root Folder: ${rootFolderId}` : ""}`,
    );
    return instance;
  }

  public async listFiles(options: ListFilesOptions = {}): Promise<DriveFile[]> {
    return this.resilience.execute(
      async () => {
        try {
          const { pageSize = 10, query } = options;
          const response = await this.drive.files.list({
            pageSize,
            driveId: this.sharedDriveId,
            corpora: "drive",
            ...(query ? { q: query } : {}),
            fields: "files(id, name, mimeType, driveId, parents, shortcutDetails)",
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });

          const files = response.data.files;
          if (!files || files.length === 0) return [];

          const scopedFiles = (
            await Promise.all(
              files.map(async (file) => {
                try {
                  await this.guard.resolveFileWithinBoundary(file);
                  return file;
                } catch {
                  return undefined;
                }
              }),
            )
          ).filter((f): f is drive_v3.Schema$File => f !== undefined);

          return scopedFiles.map((file) => ({
            id: file.id ?? "unknown-id",
            name: file.name ?? "Untitled",
            mimeType: file.mimeType ?? "unknown",
          }));
        } catch (error) {
          throw translateDriveError(error, "core.listFiles");
        }
      },
      { isRead: true },
    );
  }

  public async uploadTextFile(name: string, content: string, parentId: string): Promise<DriveFile> {
    return this.resilience.execute(
      async () => {
        try {
          await this.guard.assertParentWithinBoundary(parentId);
          const fileMetadata: drive_v3.Schema$File = {
            name,
            mimeType: "text/plain",
            parents: [parentId],
          };
          const media = { mimeType: "text/plain", body: Readable.from([content]) };

          const response = await this.drive.files.create({
            requestBody: fileMetadata,
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
          throw translateDriveError(error, `core.uploadTextFile for ${name}`);
        }
      },
      { isRead: false },
    );
  }

  public async createFolder(name: string, parentId: string): Promise<DriveFile> {
    return this.resilience.execute(
      async () => {
        try {
          await this.guard.assertParentWithinBoundary(parentId);
          const fileMetadata: drive_v3.Schema$File = {
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId],
          };

          const response = await this.drive.files.create({
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
          throw translateDriveError(error, `core.createFolder for ${name}`);
        }
      },
      { isRead: false },
    );
  }

  private async resolveAndStream(
    file: drive_v3.Schema$File,
    fileId: string,
    destPath: string,
  ): Promise<string> {
    const cwd = this.fileSystem.getCwd();
    const resolvedDestPath = this.fileSystem.resolvePath(cwd, destPath);

    // F-03: Use path.sep suffix to prevent prefix-collision bypass
    // e.g. cwd="/home/project" must not allow "/home/project-secrets/key.pem"
    if (resolvedDestPath !== cwd && !resolvedDestPath.startsWith(cwd + path.sep)) {
      throw new Error(
        `Security Error: Path traversal detected. Destination must be within the current working directory (${cwd}). Access to ${resolvedDestPath} is forbidden.`,
      );
    }

    const lastSlash = resolvedDestPath.lastIndexOf("/");
    const dir = lastSlash !== -1 ? resolvedDestPath.slice(0, lastSlash) : "";
    if (dir) {
      this.fileSystem.ensureDir(dir);
    }

    // F-06: Reject symlinks at the destination to prevent write-through attacks
    this.fileSystem.assertNotSymlink(resolvedDestPath);

    const effectiveFileId = file.id ?? fileId;
    const mimeType = file.mimeType ?? "";
    const isWorkspaceDoc =
      mimeType.startsWith("application/vnd.google-apps.") &&
      mimeType !== "application/vnd.google-apps.folder";

    // F-04: Enforce file size limit before streaming (non-Workspace docs only)
    if (!isWorkspaceDoc) {
      const sizeStr = (file as Record<string, unknown>)["size"] as string | undefined;
      const fileSize = sizeStr ? Number.parseInt(sizeStr, 10) : 0;
      if (fileSize > MAX_DOWNLOAD_BYTES) {
        throw new Error(
          `Security Error: File size (${fileSize} bytes) exceeds the maximum allowed download size (${MAX_DOWNLOAD_BYTES} bytes).`,
        );
      }
    }

    const dest = this.fileSystem.createWriteStream(resolvedDestPath);

    if (isWorkspaceDoc) {
      const exportResponse = await this.drive.files.export(
        { fileId: effectiveFileId, mimeType: "text/plain" },
        { responseType: "stream" },
      );
      await this.fileSystem.pipeline(exportResponse.data, dest);
    } else {
      const getResponse = await this.drive.files.get(
        { fileId: effectiveFileId, alt: "media", supportsAllDrives: true },
        { responseType: "stream" },
      );
      await this.fileSystem.pipeline(getResponse.data, dest);
    }

    return resolvedDestPath;
  }

  public async downloadFile(fileId: string, destPath: string): Promise<string> {
    return this.resilience.execute(
      async () => {
        try {
          const metaResponse = await this.drive.files.get({
            fileId,
            fields: "id, name, mimeType, size, driveId, parents, shortcutDetails",
            supportsAllDrives: true,
          });
          const allowedFile = await this.guard.resolveFileWithinBoundary(metaResponse.data);
          return await this.resolveAndStream(allowedFile, fileId, destPath);
        } catch (error) {
          throw translateDriveError(error, `core.downloadFile for ID ${fileId}`);
        }
      },
      { isRead: true },
    );
  }

  public async downloadFileFromUrl(url: string, destPath: string): Promise<string> {
    return this.resilience.execute(
      async () => {
        try {
          const fileId = parseDriveUrl(url);
          const metaResponse = await this.drive.files.get({
            fileId,
            fields: "id, name, mimeType, size, driveId, parents, shortcutDetails",
            supportsAllDrives: true,
          });
          const file = metaResponse.data;

          if (file.shortcutDetails) {
            throw new Error("Shortcut files cannot be downloaded via URL.");
          }

          // F-02: This tool intentionally bypasses BoundaryGuard (ADR-0005).
          // The audit pipeline in McpPipeline.register() logs the execution,
          // including the tool name "drive_download_file_from_url" and args.

          return await this.resolveAndStream(file, fileId, destPath);
        } catch (error) {
          // F-07: Redact full URL from error messages to prevent leaking sensitive query params
          throw translateDriveError(error, `core.downloadFileFromUrl for ${redactDriveUrl(url)}`);
        }
      },
      { isRead: true },
    );
  }
}
