# Product Requirement Document (PRD)

## Project Title
**Keyless Authentication via Workload Identity Federation (WIF) & ADC for Google Drive MCP Server**

## 1. Objective
To elevate the security posture of the Google Drive MCP Server by **permanently deprecating the use of long-lived Service Account Keys (JSON files)**. We are migrating to a Keyless Authentication architecture leveraging **Workload Identity Federation (WIF)** for external environments (e.g., CI/CD, AWS, GitHub Actions) and **Service Account Impersonation (ADC)** for Local Development, drastically mitigating credential leakage risks.

## 2. Architecture & Components
Authentication mechanisms are bifurcated based on the execution environment:

* **Local Development (Windows/Ubuntu WSL):**
    * **Mechanism:** Application Default Credentials (ADC) + Service Account Impersonation
    * **Tool:** Google Cloud CLI (`gcloud`)
    * **Token Type:** Short-lived Access Token (1-hour lifespan) with auto-refresh capabilities via the Google Auth Library.

* **Production / External Server (e.g., GitHub Actions, AWS):**
    * **Mechanism:** Workload Identity Federation (WIF)
    * **Components:** Workload Identity Pool, Identity Provider (IdP), Attribute Mapping
    * **Token Exchange:** External Token -> Google Security Token Service (STS) -> Short-lived Access Token

## 3. Security & IAM Requirements
* **Zero Key Policy:** The creation or downloading of Private Key JSON files from the Service Account console is strictly prohibited.
* **Role Requirements (Local):** The developer's Google Account must possess the `roles/iam.serviceAccountTokenCreator` role to facilitate impersonation.
* **Role Requirements (Production WIF):** External identities (e.g., a specific GitHub Repository) must be granted permission via the Identity Pool to act as a `Workload Identity User` for the target Service Account.

## 4. Implementation Steps (Infrastructure & Config)

### Phase 1: Local Development Setup (Impersonation)
1.  Install the `gcloud` CLI within the host environment (e.g., Ubuntu WSL).
2.  Developers authenticate and bind their identity to the Service Account using:
    ```bash
    gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"
    ```
3.  **MCP Config Update:** Permanently remove the `GOOGLE_APPLICATION_CREDENTIALS` environment variable from local configurations. This forces the Node.js Library to utilize the ADC token generated in step 2.

### Phase 2: Production Setup (WIF)
1.  Establish a **Workload Identity Pool** within Google Cloud IAM.
2.  Configure a **Provider** within the Pool (specifying the IdP type, e.g., OIDC, AWS) and define the Issuer URL.
3.  Define **Attribute Mapping** (e.g., `google.subject` = `assertion.sub`).
4.  Grant Access (bind roles) permitting Principals from the Pool to utilize the Service Account.
5.  Download the **Credential Configuration** file (a routing file devoid of private keys) and deploy it to the external server.
6.  **MCP Config Update (Production):** Set the environment variable to point to this configuration file:
    ```bash
    GOOGLE_APPLICATION_CREDENTIALS="/path/to/wif-credential-config.json"
    ```

## 5. Target MCP Server Configuration (Environment Agnostic)

To seamlessly support both environments, the MCP Server (e.g., Gemini CLI or Hermes) will be configured with a standardized execution command. Authentication handling is delegated entirely to the presence (or absence) of Environment Variables:

```yaml
mcpServers:
  googledrive:
    command: "npx"
    args: 
      - "-y"
      - "mcp-google-drive"
    env:
      # [CRITICAL] For Local Dev: REMOVE this line entirely.
      # For Production: Point this to the wif-credential-config.json file.
      GOOGLE_APPLICATION_CREDENTIALS: "${GOOGLE_APPLICATION_CREDENTIALS_PATH_IF_ANY}"
      
      # The target Folder ID authorized for write access.
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "${GOOGLE_DRIVE_ROOT_FOLDER_ID}"

```

## 6. Acceptance Criteria

1. **Local Test:** Successfully execute commands (e.g., `gemini chat` or agent tools) locally to read/write files in Google Drive without any Service Account JSON Key present on the machine.
2. **Auto-Refresh Test:** Temporary tokens must successfully auto-refresh when a session is left idle for over 1 hour, without throwing 401 Unauthorized errors in the MCP Server.
3. **Production Test (If Applicable):** Successfully run the MCP Server on an external system utilizing exclusively the WIF Credential Config file.
