import { describe, expect, it } from "vitest";
import { NodeFileSystemAdapter } from "../src/core/FileSystemAdapter.js";

describe("NodeFileSystemAdapter Unit Tests", () => {
  const adapter = new NodeFileSystemAdapter();

  it("should get current working directory", () => {
    expect(adapter.getCwd()).toBe(process.cwd());
  });

  it("should resolve path correctly", () => {
    const resolved = adapter.resolvePath(process.cwd(), "./downloads/test.txt");
    expect(resolved).toContain("downloads/test.txt");
  });
});
