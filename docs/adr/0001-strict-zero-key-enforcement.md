# ADR 0001: Strict Zero Key Enforcement

## Status
Superseded by [ADR 0007](0007-remove-gac-inspection.md)


## Context
The Google Drive MCP Server project aims to elevate its security posture by permanently deprecating the use of long-lived Service Account JSON Keys (Zero Key Policy). This reduces the risk of credential leakage by transitioning entirely to Keyless Authentication (ADC/WIF).

Although the standard Google Auth Library accepts both JSON files and Keyless Configurations, we require strict enforcement measures to prevent human errors where developers might inadvertently introduce JSON keys in local or production environments.

## Decision
We will implement runtime logic within the MCP Server to inspect the credential configuration before initialization:
1. If `GOOGLE_APPLICATION_CREDENTIALS` is defined, the server will synchronously load and inspect the file content.
2. If the field `"private_key"` is detected (indicating a Service Account JSON Key), the server will immediately terminate execution (Shutdown).
3. The server will output a clear error message stating: "The use of JSON Keys violates project security policies. Please use ADC or WIF exclusively."

## Consequences
- **Positive:** Guarantees 100% compliance with the Zero Key Policy and organizational security standards by physically preventing key usage.
- **Negative:** Developers accustomed to legacy JSON key workflows may experience initial friction and must invest time in configuring ADC (Impersonation).
- **Neutral:** Requires additional custom credential inspection logic during the server setup phase.
