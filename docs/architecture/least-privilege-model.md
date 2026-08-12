# Least Privilege Security Model

This document explains the security design behind the **Least Privilege Key** authentication model. While [ADR 0011](../adr/0011-allow-service-account-keys-for-headless.md) allows the use of Service Account JSON keys for automated servers, using them safely requires understanding and implementing the Principle of Least Privilege.

## 1. The Risk of Over-Privileged Keys

When developers create a Service Account in Google Cloud Platform (GCP), they are often prompted to assign it an IAM role (e.g., `Editor` or `Owner` on the project).

If a Service Account JSON key with Project-level `Editor` rights is leaked, the attacker gains full control over your Google Cloud infrastructure. They can:

- Spin up expensive Compute Engine instances (cryptojacking).
- Delete or ransom Cloud Storage buckets.
- Access other Google APIs enabled on the project.

Because MCP servers often run in home labs, headless VPS environments, or are distributed as desktop apps, the risk of credential exposure is non-trivial.

## 2. The Implementation (How-to)

To eliminate the GCP infrastructure risk, this project advocates for **Zero-Role Service Accounts**. You restrict the Service Account so that it has absolutely no power in Google Cloud, but just enough permission in Google Workspace to access the specific Shared Drive.

### Step-by-step Setup

1. **Create the Service Account**: In GCP Console, create a new Service Account.
2. **Skip IAM Roles**: When asked to grant this service account access to the project (Step 2 in the GCP UI), **leave it completely blank and skip it**. Do not assign `Viewer`, `Editor`, or any other role.
3. **Generate the Key**: Generate and download the JSON key.
4. **Grant Workspace Access**: Treat the Service Account's email address (e.g., `mcp-bot@your-project.iam.gserviceaccount.com`) like a normal human user. Go to Google Drive, right-click your target **Shared Drive**, select "Manage Members", and invite the Service Account email.
   - Assign **Viewer** if you run the MCP in read-only mode.
   - Assign **Contributor** if you want the MCP to create and upload files.

By doing this, the Service Account key is entirely useless for GCP infrastructure attacks. Its only capability in the entire world is reading/writing to that single Shared Drive folder.

## 3. Defense in Depth (Synergy with Boundaries)

When you combine Google's IAM Least Privilege with the MCP server's application-level guardrails, you achieve Defense in Depth:

1. **Google-Level Constraint**: The JSON key can only access the Shared Drive. It cannot access GCP infrastructure or other Shared Drives.
2. **Application-Level Constraint ([Boundary Guard](boundary-model.md))**: The MCP server strictly validates that every read/write operation is mathematically inside the `GOOGLE_DRIVE_SHARED_DRIVE_ID` (and optionally `GOOGLE_DRIVE_ROOT_FOLDER_ID`). It prevents path traversal or ID-spoofing attacks from a malicious or hallucinating LLM.
3. **Execution-Level Constraint**: Setting `GOOGLE_DRIVE_MODE="readonly"` physically removes the write tools from the MCP server, preventing the LLM from mutating data even if the Service Account has Contributor rights.

This multi-layered approach ensures that even if a JSON key is exposed, or the AI Assistant goes rogue, the blast radius is strictly contained to the designated sandbox.
