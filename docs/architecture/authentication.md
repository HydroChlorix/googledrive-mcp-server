# Least Privilege Key Authentication Architecture

This document explains the authentication terms and deployment flows used by the Google Drive MCP server. Authentication determines **who** can call Google APIs; the Shared Drive and Root Folder boundaries determine **which data** the application may use.

## Terms

### ADC — Application Default Credentials

Application Default Credentials (ADC) is the Google authentication mechanism used by client libraries to discover credentials from the runtime environment. The MCP server delegates credential resolution to the Google Auth SDK and does not inspect or parse credential files itself.

ADC is a credential lookup mechanism, not a permission boundary. The resolved identity still needs the required Google Cloud and Google Drive permissions.

### WIF — Workload Identity Federation

Workload Identity Federation (WIF) allows an external workload, such as GitHub Actions, AWS, or OCI, to obtain short-lived Google credentials without using a long-lived Service Account JSON key.

WIF establishes a trusted relationship between an external identity provider and Google Cloud. The external workload can then impersonate an authorized Service Account according to the configured IAM policy.

### Service Account Impersonation

Service Account Impersonation allows an authenticated human or workload identity to request a short-lived access token that acts as a Google Service Account. The caller needs the appropriate IAM permission, commonly `roles/iam.serviceAccountTokenCreator`, on the target Service Account.

Impersonation is the identity flow. ADC is how the application discovers the resulting credentials. WIF is one way an external workload obtains the identity needed for that flow.

## Supported deployment flows

### Local development

```text
Developer identity
    │
    └─ gcloud ADC login with Service Account impersonation
            │
            └─ ADC credentials
                    │
                    └─ MCP server → Google Drive API
```

The local operator must authenticate before starting the MCP server:

```bash
# Desktop (GUI)
gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"

# Headless (WSL / SSH / Remote Server)
gcloud auth application-default login --no-browser --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"
```

### External workload / production

```text
External workload identity
    │
    └─ WIF trust relationship
            │
            └─ Short-lived Google credentials
                    │
                    └─ Service Account impersonation
                            │
                            └─ MCP workload → Google Drive API
```

The exact WIF provider and IAM configuration depends on the hosting platform. The application should still consume credentials through the standard Google Auth / ADC path.

## Least Privilege Key policy

The project originally encouraged Keyless Authentication to avoid Service Account private-key JSON files on developer machines. For local environments, short-lived credentials obtained through ADC or impersonation remain a supported and secure method.

However, per **ADR-0011**, using a long-lived Service Account JSON key via the `GOOGLE_APPLICATION_CREDENTIALS` environment variable is formally accepted as a fallback method for headless servers or home labs where Google Workspace Session Control policies cause ADC to expire prematurely (e.g., `invalid_rapt` errors).

If using this fallback, users are responsible for the physical security of the `.json` file on their servers.

## Authentication is separate from data boundary

Authentication answers:

> Which Google identity is making this API request?

The application boundary answers:

> Which data may this MCP instance use?

For V1, both must pass:

1. Google Cloud and Google Drive permissions authorize the identity.
2. The configured Shared Drive is the mandatory hard boundary.
3. An optional Root Folder narrows the boundary within that Shared Drive.

Having Google Drive permission to another Shared Drive does not allow the MCP instance to use that data.

## Troubleshooting

### Authentication or permission errors

Do not create or request a Service Account JSON key. Re-authenticate through the approved ADC/impersonation flow and verify that the target Service Account has the required Google Drive permission.

### Upload quota errors

Service Accounts do not have storage quota in a personal `@gmail.com` My Drive. Use a Google Workspace Shared Drive for Service Account-owned uploads, or use a separately designed user OAuth flow in a future architecture.

## Related documents

- [Least Privilege Security Model](least-privilege-model.md)
- [V1 Boundary Model](boundary-model.md)
- [ADR-0001: Strict Zero Key Enforcement](../adr/0001-strict-zero-key-enforcement.md) — superseded
- [ADR-0007: Removal of Custom Credential Inspection](../adr/0007-remove-gac-inspection.md) — removed active enforcement
- [ADR-0011: Pivot to Least Privilege Key Authentication](../adr/0011-allow-service-account-keys-for-headless.md) — current architecture decision
- [Use Cases & Product Roadmap](../usecase.md)
