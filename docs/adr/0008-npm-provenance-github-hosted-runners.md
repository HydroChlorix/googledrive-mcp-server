# ADR 0008: Enforce GitHub-Hosted Runners for NPM Package Provenance Attestation

## Status
Accepted

## Context
NPM package provenance (introduced via SLSA attestations and Sigstore integration) generates cryptographic proof linking a published npm package directly to its source repository and specific GitHub Actions workflow run.

During the release of version `2.0.1`, package publishing was executed on a self-hosted OCI ARM container runner (`runs-on: [self-hosted, oci, arm64]`). Because NPM Sigstore provenance generation requires running within official GitHub-hosted runners (`ubuntu-latest`) to issue and verify trusted OIDC claims, provenance attestation failed to register, causing the package on npmjs.com to lack the verified Provenance badge.

## Decision
1. **Require GitHub-Hosted Runners for Publishing**: The release workflow (`.github/workflows/publish.yml`) MUST execute on official GitHub-hosted runners (`runs-on: ubuntu-latest`).
2. **Require OIDC & NPM Tokens**: The publish workflow MUST request `id-token: write` permissions and supply `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` during the publication step.
3. **Enforce Provenance Configuration**: `package.json` MUST specify `"provenance": true` inside `"publishConfig"`.

## Consequences
- **Positive**: Every published version of `@hydrochlorix/googledrive-mcp-server` on npmjs.com will feature a verified Provenance badge linking directly to the immutable GitHub Actions build logs and source commit.
- **Negative**: Publishing jobs consume standard GitHub Actions runner minutes (`ubuntu-latest`) instead of self-hosted infrastructure. (Impact is minimal given infrequent release builds).
- **Neutral**: CI test workflows (`node.js.yml`) may remain on self-hosted runners if desired, but publishing is strictly restricted to GitHub-hosted infrastructure.
