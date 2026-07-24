/**
 * Google Drive URL Parser
 *
 * Extracts a Google Drive file ID from a full Google Drive URL.
 *
 * Per URL-Gated Access (CONTEXT.md), bare file IDs are intentionally
 * rejected — callers must pass a full URL so the source/identity of the
 * request is auditable.
 */

const PATH_ID_REGEX =
  /^(?:https?:\/\/)?(?:drive|docs)\.google\.com\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/i;

const OPEN_ID_REGEX =
  /^(?:https?:\/\/)?drive\.google\.com\/open\?(?:[^#\s]*&)?id=([a-zA-Z0-9_-]+)/i;

const FOLDER_REGEX = /\/drive\/folders\//;

/**
 * Extracts the file ID from a recognized Google Drive URL.
 *
 * @param url A full Google Drive URL (http or https).
 * @returns The extracted file ID.
 * @throws {Error} When the input is not a recognized Google Drive file URL.
 */
export function extractFileId(url: string): string {
  if (typeof url !== "string" || url.trim() === "") {
    throw new Error("Expected a Google Drive URL like https://drive.google.com/file/d/.../view");
  }

  const trimmed = url.trim();

  // URL-Gated Access: must be a full URL with a scheme. Bare file IDs
  // (e.g. "1AbC...") are intentionally rejected.
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      "Expected a full Google Drive URL. Bare file IDs are not accepted (URL-Gated Access).",
    );
  }

  // Folder URLs are out of scope for this server.
  if (FOLDER_REGEX.test(trimmed)) {
    throw new Error(
      "Folder URLs are not supported. Expected a file URL like https://drive.google.com/file/d/.../view",
    );
  }

  // Patterns 1, 3, 4, 5: /file/d/{id}, /document/d/{id}, /spreadsheets/d/{id}, /presentation/d/{id}
  const pathMatch = trimmed.match(PATH_ID_REGEX);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  // Pattern 2: /open?id={id} (query string is required for this shape)
  const openMatch = trimmed.match(OPEN_ID_REGEX);
  if (openMatch?.[1]) {
    return openMatch[1];
  }

  // Not a recognized Google Drive file URL.
  throw new Error("Expected a Google Drive URL like https://drive.google.com/file/d/.../view");
}
