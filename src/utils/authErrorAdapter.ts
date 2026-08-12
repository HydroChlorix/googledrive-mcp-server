export function translateDriveError(error: unknown, actionName: string): Error {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  const status =
    (error as { status?: number; code?: number })?.status ??
    (error as { status?: number; code?: number })?.code;

  if (
    status === 401 ||
    status === 403 ||
    message.includes("invalid_grant") ||
    message.includes("Unauthenticated") ||
    message.includes("permission")
  ) {
    const statusText = status ?? "401/403";
    return new Error(
      `❌ Authentication / Permission Error (${statusText}) in ${actionName}:\n👉 Resolution:\n1. Run the gcloud impersonation command to refresh your local ADC credentials:\n   gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"\n2. Verify the Google Drive target folder/file is shared with the Service Account email as Editor/Viewer.`,
    );
  }

  if (message.includes("storage quota") || message.includes("quota Exceeded")) {
    return new Error(
      `❌ Storage Quota Error in ${actionName}:\nService Accounts have 0 Bytes quota on personal Google Drive (@gmail.com) folders.\n👉 Resolution: Use a Google Workspace Shared Drive or upload to a folder owned by a Workspace account.`,
    );
  }

  return new Error(`Failed to execute ${actionName}: ${message}`);
}
