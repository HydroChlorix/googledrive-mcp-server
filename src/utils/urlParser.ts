/**
 * Parses a Google Drive URL and extracts the file ID.
 * Supports file/d/{id}, document/d/{id}, spreadsheets/d/{id}, presentation/d/{id}, and open?id={id}
 *
 * Security: Only accepts URLs from known Google Drive / Workspace domains (F-01, F-08).
 */

const ALLOWED_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "sheets.google.com",
  "slides.google.com",
]);

export function parseDriveUrl(url: string): string {
  if (!url || typeof url !== "string") {
    throw new Error("Invalid Google Drive URL format: URL must be a non-empty string");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid Google Drive URL format: URL must be a valid URL");
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(
      "Invalid Google Drive URL format: URL must be from a Google Drive or Google Workspace domain",
    );
  }

  // Match /d/{fileId} pattern
  const dMatch = url.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch?.[1]) {
    return dMatch[1];
  }

  // Match open?id={fileId} pattern
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) {
    return idMatch[1];
  }

  throw new Error("Invalid Google Drive URL format");
}

/**
 * Redacts a Google Drive URL for safe inclusion in error messages (F-07).
 * Returns only the hostname + extracted file ID (or "[unparseable]" on failure).
 */
export function redactDriveUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    try {
      const fileId = parseDriveUrl(url);
      return `${hostname}/.../${fileId}`;
    } catch {
      return `${hostname}/[unparseable-path]`;
    }
  } catch {
    return "[invalid-url]";
  }
}
