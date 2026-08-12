import * as fs from "node:fs";
import * as path from "node:path";
import type { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface FileSystemAdapter {
  resolvePath(...paths: string[]): string;
  getCwd(): string;
  ensureDir(dirPath: string): void;
  createWriteStream(destPath: string): Writable;
  /** F-06: Throw if destPath is a symlink to prevent write-through attacks. */
  assertNotSymlink(destPath: string): void;
  pipeline(
    source: NodeJS.ReadableStream | ReadableStream | Record<string, unknown>,
    destination: Writable,
  ): Promise<void>;
}

export class NodeFileSystemAdapter implements FileSystemAdapter {
  public resolvePath(...paths: string[]): string {
    return path.resolve(...paths);
  }

  public getCwd(): string {
    return process.cwd();
  }

  public ensureDir(dirPath: string): void {
    if (dirPath && !fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  public createWriteStream(destPath: string): Writable {
    return fs.createWriteStream(destPath);
  }

  public assertNotSymlink(destPath: string): void {
    try {
      const stat = fs.lstatSync(destPath);
      if (stat.isSymbolicLink()) {
        throw new Error(
          `Security Error: Destination path is a symlink. Refusing to write to ${destPath}.`,
        );
      }
    } catch (error) {
      // File doesn't exist yet — that's fine, no symlink risk
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }

  public async pipeline(
    source: NodeJS.ReadableStream | ReadableStream | Record<string, unknown>,
    destination: Writable,
  ): Promise<void> {
    await pipeline(source as NodeJS.ReadableStream, destination);
  }
}

export const defaultFileSystemAdapter: FileSystemAdapter = new NodeFileSystemAdapter();
