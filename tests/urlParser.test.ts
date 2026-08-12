import { describe, expect, it } from "vitest";
import { parseDriveUrl } from "../src/utils/urlParser.js";

describe("parseDriveUrl", () => {
  it("should extract fileId from a standard Google Drive file URL", () => {
    const url = "https://drive.google.com/file/d/1lboHKtHQ8VRotJAti01_CEULKNVCMDvR/view";
    const result = parseDriveUrl(url);
    expect(result).toBe("1lboHKtHQ8VRotJAti01_CEULKNVCMDvR");
  });

  it("should extract fileId from a Google Docs URL", () => {
    const url = "https://docs.google.com/document/d/1abc123/edit";
    const result = parseDriveUrl(url);
    expect(result).toBe("1abc123");
  });

  it("should extract fileId from a Google Sheets URL", () => {
    const url = "https://sheets.google.com/spreadsheets/d/2def456/edit";
    const result = parseDriveUrl(url);
    expect(result).toBe("2def456");
  });

  it("should extract fileId from a Google Slides URL", () => {
    const url = "https://slides.google.com/presentation/d/3ghi789/edit";
    const result = parseDriveUrl(url);
    expect(result).toBe("3ghi789");
  });

  it("should extract fileId from an open?id= URL", () => {
    const url = "https://drive.google.com/open?id=4jkl012";
    const result = parseDriveUrl(url);
    expect(result).toBe("4jkl012");
  });

  it("should reject URLs from non-Google hosts with path injection", () => {
    const url = "https://evil.com/file/d/INJECTED/view";
    expect(() => parseDriveUrl(url)).toThrow(
      "Invalid Google Drive URL format: URL must be from a Google Drive or Google Workspace domain",
    );
  });

  it("should reject URLs from non-Google hosts with query param injection", () => {
    const url = "https://evil.com/page?id=INJECTED";
    expect(() => parseDriveUrl(url)).toThrow(
      "Invalid Google Drive URL format: URL must be from a Google Drive or Google Workspace domain",
    );
  });

  it("should reject empty strings", () => {
    // Note: the implementation expects `url` as a parameter, so casting "" as unknown as string is not needed for TS if it's already a string.
    expect(() => parseDriveUrl("")).toThrow(
      "Invalid Google Drive URL format: URL must be a non-empty string",
    );
  });

  it("should reject non-URL strings", () => {
    expect(() => parseDriveUrl("invalid-url")).toThrow(
      "Invalid Google Drive URL format: URL must be a valid URL",
    );
  });

  it("should reject valid Google URLs without a file ID pattern", () => {
    const url = "https://drive.google.com/";
    expect(() => parseDriveUrl(url)).toThrow("Invalid Google Drive URL format");
  });
});
