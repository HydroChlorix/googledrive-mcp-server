import type { drive_v3 } from "googleapis";
import { getDriveClient } from "./auth.js";
import { extractFileId } from "./url-parser.js";

export interface DriveFileExportResult {
  mimeType: string;
  name: string;
  parents: string[];
  content: string;
}

export interface DriveApiError extends Error {
  code?: number;
  response?: {
    status?: number;
  };
}

/**
 * Extracts identity from environment or drive client.
 */
export async function getIdentity(): Promise<string> {
  return process.env.IMPERSONATED_USER_EMAIL || "Impersonated Service Account Session";
}

/**
 * Executes a search query in Google Drive, restricted to the Root Folder.
 */
export async function searchFiles(
  query: string,
  identity?: string,
): Promise<drive_v3.Schema$File[]> {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is not set in environment variables.");
  }

  // ADR 0002: Root Folder Isolation
  const isolatedQuery = `(${query}) and '${rootFolderId}' in parents`;

  // ADR 0004: Identity-Rich Logging
  console.error(
    `[Audit] User ${identity || "Unknown"} executing search_files with isolated query: ${isolatedQuery}`,
  );

  const drive = await getDriveClient();
  const res = await drive.files.list({
    q: isolatedQuery,
    fields: "files(id, name, mimeType, modifiedTime)",
    spaces: "drive",
  });

  return res.data.files || [];
}

/**
 * Fetches a Drive file's metadata and exports its content as plain text.
 */
export async function fetchAndExportContent(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<DriveFileExportResult> {
  // Step 1: fetch metadata (mimeType drives export vs raw download)
  const metaRes = await drive.files.get({
    fileId: fileId,
    fields: "mimeType, name, parents",
  });
  const mimeType = metaRes.data.mimeType || "";
  const name = metaRes.data.name || "";
  const parents = metaRes.data.parents || [];

  // Step 3: ADR 0003 Auto-Text Export for Google Workspace files, raw download otherwise
  let content: string;
  if (mimeType.startsWith("application/vnd.google-apps.")) {
    const exportRes = await drive.files.export({
      fileId: fileId,
      mimeType: "text/plain",
    });
    content = typeof exportRes.data === "string" ? exportRes.data : JSON.stringify(exportRes.data);
  } else {
    const getRes = await drive.files.get({
      fileId: fileId,
      alt: "media",
    });
    content = typeof getRes.data === "string" ? getRes.data : JSON.stringify(getRes.data);
  }

  return { mimeType, name, parents, content };
}

/**
 * Retrieves file content, automatically exporting Google Workspace files as plain text.
 */
export async function getFileContent(fileId: string, identity?: string): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  console.error(
    `[Audit] User ${identity || "Unknown"} executing get_file_content for fileId: ${fileId}`,
  );

  const drive = await getDriveClient();

  // ADR 0002: perform Root Folder check BEFORE delegating to the helper.
  const guardRes = await drive.files.get({
    fileId: fileId,
    fields: "mimeType, name, parents",
  });
  const parents = guardRes.data.parents || [];
  if (rootFolderId && !parents.includes(rootFolderId)) {
    throw new Error("Access Denied: File is outside the designated Root Folder.");
  }

  // Delegate the metadata + content work to the shared helper.
  return await fetchAndExportContent(drive, fileId).then((r) => r.content);
}

/**
 * Reads a Google Drive file from a shared URL.
 */
export async function getFileFromUrl(url: string, identity?: string): Promise<string> {
  const fileId = extractFileId(url);

  console.error(
    `[Audit] User ${identity || "Unknown"} executing get_file_from_url for url: ${url} (resolved fileId: ${fileId})`,
  );

  const drive = await getDriveClient();
  try {
    const result = await fetchAndExportContent(drive, fileId);
    return result.content;
  } catch (apiErr: unknown) {
    const err = apiErr as DriveApiError;
    const status = err.code || err.response?.status;
    const original = err.message || String(err);
    if (status === 403) {
      throw new Error(
        `Access Denied: Service Account cannot read fileId ${fileId}. Share the file with the Service Account's email address via Drive's "Share" button, or revoke restricted-link sharing. Original error: ${original}`,
      );
    }
    if (status === 404) {
      throw new Error(
        `File Not Found: fileId ${fileId} could not be located. The link may be stale, the file may be in trash, or sharing may be restricted. Original error: ${original}`,
      );
    }
    throw apiErr;
  }
}

/**
 * Creates a new file inside the Root Folder.
 */
export async function createFile(
  name: string,
  content: string,
  mimeType = "text/plain",
  identity?: string,
): Promise<drive_v3.Schema$File> {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is not set in environment variables.");
  }

  console.error(`[Audit] User ${identity || "Unknown"} executing create_file: ${name}`);

  const drive = await getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: name,
      mimeType: mimeType,
      parents: [rootFolderId],
    },
    media: {
      mimeType: mimeType,
      body: content,
    },
    fields: "id, name, mimeType",
  });

  return res.data;
}

/**
 * Updates an existing file's content.
 */
export async function updateFile(
  fileId: string,
  content: string,
  identity?: string,
): Promise<drive_v3.Schema$File> {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  console.error(
    `[Audit] User ${identity || "Unknown"} executing update_file for fileId: ${fileId}`,
  );

  const drive = await getDriveClient();

  const metaRes = await drive.files.get({
    fileId: fileId,
    fields: "parents",
  });

  const parents = metaRes.data.parents || [];
  if (rootFolderId && !parents.includes(rootFolderId)) {
    throw new Error("Access Denied: File is outside the designated Root Folder.");
  }

  const res = await drive.files.update({
    fileId: fileId,
    media: {
      body: content,
    },
    fields: "id, name, modifiedTime",
  });

  return res.data;
}
