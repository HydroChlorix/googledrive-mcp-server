import type { drive_v3 } from "googleapis";

export class BoundaryGuard {
  constructor(
    private readonly drive: drive_v3.Drive,
    private readonly sharedDriveId: string,
    private readonly rootFolderId: string | undefined,
  ) {}

  public async assertRootFolderWithinBoundary(): Promise<void> {
    if (!this.rootFolderId) return;
    const response = await this.drive.files.get({
      fileId: this.rootFolderId,
      fields: "id, driveId, mimeType",
      supportsAllDrives: true,
    });
    const rootFolder = response.data;
    if (
      rootFolder.id !== this.rootFolderId ||
      rootFolder.driveId !== this.sharedDriveId ||
      rootFolder.mimeType !== "application/vnd.google-apps.folder"
    ) {
      throw new Error("Configured Root Folder is outside the configured Root Folder boundary.");
    }
  }

  public async hasRootFolderAncestor(file: drive_v3.Schema$File): Promise<boolean> {
    if (!this.rootFolderId) return true;
    const pendingParents = [...(file.parents ?? [])];
    const visited = new Set<string>();

    while (pendingParents.length > 0) {
      const parentId = pendingParents.pop();
      if (!parentId || visited.has(parentId)) continue;
      if (parentId === this.rootFolderId) return true;

      visited.add(parentId);
      const response = await this.drive.files.get({
        fileId: parentId,
        fields: "id, driveId, parents",
        supportsAllDrives: true,
      });
      const parent = response.data;

      if (!parent.id || parent.driveId !== this.sharedDriveId) return false;
      pendingParents.push(...(parent.parents ?? []));
    }
    return false;
  }

  public async resolveFileWithinBoundary(
    file: drive_v3.Schema$File,
    allowShortcut = true,
  ): Promise<drive_v3.Schema$File> {
    if (!file.id || file.driveId !== this.sharedDriveId) {
      throw new Error("Requested file is outside the configured Shared Drive boundary.");
    }

    if (
      this.rootFolderId &&
      file.id !== this.rootFolderId &&
      !file.parents?.includes(this.rootFolderId) &&
      !(await this.hasRootFolderAncestor(file))
    ) {
      throw new Error("Requested file is outside the configured Root Folder boundary.");
    }

    if (file.shortcutDetails) {
      if (!allowShortcut) throw new Error("Recursive Shortcut resolution is not supported.");
      const targetId = file.shortcutDetails.targetId;
      const targetMimeType = file.shortcutDetails.targetMimeType;
      if (!targetId || !targetMimeType) throw new Error("Shortcut target cannot be verified.");
      if (targetMimeType === "application/vnd.google-apps.folder") {
        throw new Error("Shortcut to a Folder is not supported.");
      }

      const targetResponse = await this.drive.files.get({
        fileId: targetId,
        fields: "id, name, mimeType, driveId, parents, shortcutDetails",
        supportsAllDrives: true,
      });
      return this.resolveFileWithinBoundary(targetResponse.data, false);
    }

    return file;
  }

  public async assertParentWithinBoundary(parentId: string): Promise<void> {
    const response = await this.drive.files.get({
      fileId: parentId,
      fields: "id, driveId, mimeType, parents",
      supportsAllDrives: true,
    });
    const parent = response.data;
    if (parent.id !== parentId || parent.mimeType !== "application/vnd.google-apps.folder") {
      throw new Error("Requested parent is not a verifiable Google Drive folder.");
    }
    await this.resolveFileWithinBoundary(parent);
  }
}
