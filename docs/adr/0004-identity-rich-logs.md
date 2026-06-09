# ADR 0004: Identity-Rich Logging for Impersonated Sessions

## Status
Accepted

## Context
When utilizing Service Account Impersonation (Keyless Auth), multiple developers access Google Drive through a singular, shared identity (the Service Account). Consequently, standard Google Drive Audit Logs only attribute actions to the Service Account, making it nearly impossible to identify the actual developer responsible for erroneous edits or security violations.

## Decision
We will implement an Identity-Rich logging strategy within the MCP Server:
1. Every Tool Call execution will extract identity data from the active Access Token (e.g., the email address of the developer who executed `gcloud login`).
2. This identity data will be consistently logged alongside operational details (Tool Name, File ID, Parameters) in the MCP Server's standard output.
3. In production environments utilizing WIF, the system will attempt to log the Subject of the External Identity Provider (e.g., the GitHub Repository or Workflow URL).

## Consequences
- **Positive:** Dramatically improves accountability and transparency regarding shared resource usage, accelerating debugging and forensic analysis.
- **Negative:** Introduces minor processing overhead for identity extraction and increases overall log volume.
- **Neutral:** Requires careful handling to comply with organizational Privacy policies concerning Personally Identifiable Information (PII).