import type { AuditLogger, AuditEventInput } from "./types.js";

export function withAuditLogger<T, R>(
  logger: AuditLogger,
  toolName: string,
  actionFn: (args: T) => Promise<R>,
): (args: T) => Promise<R> {
  return async (args: T): Promise<R> => {
    const startTime = performance.now();
    const parsedArgs = (args && typeof args === "object" ? args : {}) as Record<
      string,
      unknown
    >;

    let status: "SUCCESS" | "DENIED" | "ERROR" = "SUCCESS";
    let errorMessage: string | undefined;
    let fileId: string | undefined;
    let fileName: string | undefined;
    let boundaryPassed = true;
    let boundaryReason: string | undefined;

    if (typeof parsedArgs["fileId"] === "string") {
      fileId = parsedArgs["fileId"];
    }
    if (typeof parsedArgs["name"] === "string") {
      fileName = parsedArgs["name"];
    }

    const saEmail = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] || process.env["GCLOUD_ACCOUNT"];
    const sharedDriveId = process.env["DRIVE_SHARED_DRIVE_ID"];

    try {
      const result = await actionFn(args);
      const executionTimeMs =
        Math.round((performance.now() - startTime) * 100) / 100;

      const eventInput: AuditEventInput = {
        toolName,
        args: parsedArgs,
        executionTimeMs,
        status: "SUCCESS",
        boundaryPassed: true,
      };
      if (saEmail) eventInput.saEmail = saEmail;
      if (sharedDriveId) eventInput.sharedDriveId = sharedDriveId;
      if (fileId) eventInput.fileId = fileId;
      if (fileName) eventInput.fileName = fileName;

      logger.log(eventInput);

      return result;
    } catch (err: unknown) {
      const executionTimeMs =
        Math.round((performance.now() - startTime) * 100) / 100;
      errorMessage = err instanceof Error ? err.message : String(err);

      if (
        errorMessage.toLowerCase().includes("boundary") ||
        errorMessage.toLowerCase().includes("forbidden") ||
        errorMessage.toLowerCase().includes("access denied")
      ) {
        status = "DENIED";
        boundaryPassed = false;
        boundaryReason = errorMessage;
      } else {
        status = "ERROR";
      }

      const eventInput: AuditEventInput = {
        toolName,
        args: parsedArgs,
        executionTimeMs,
        status,
        boundaryPassed,
      };
      if (saEmail) eventInput.saEmail = saEmail;
      if (sharedDriveId) eventInput.sharedDriveId = sharedDriveId;
      if (fileId) eventInput.fileId = fileId;
      if (fileName) eventInput.fileName = fileName;
      if (boundaryReason) eventInput.boundaryReason = boundaryReason;
      if (errorMessage) eventInput.errorMessage = errorMessage;

      logger.log(eventInput);

      throw err;
    }
  };
}
