# Implementation Plan: Fix NPM Package Provenance Attestation

Fix NPM Package Provenance attestation for `@hydrochlorix/googledrive-mcp-server` so published packages display the verified Provenance badge on npmjs.com.

## Goal Description
When building and publishing version `2.0.1` to NPM, the package was built on a self-hosted OCI container runner rather than a native GitHub-hosted runner (`ubuntu-latest`). Consequently, NPM Sigstore/SLSA provenance attestation failed to register, leaving the package without the verified provenance badge (as seen on https://www.npmjs.com/package/@hydrochlorix/googledrive-mcp-server/v/2.0.1).

This plan fixes the issue by:
1. Migrating `.github/workflows/publish.yml` to use official GitHub-hosted runners (`ubuntu-latest`).
2. Enforcing provenance in `package.json` under `publishConfig.provenance: true`.
3. Ensuring OIDC `id-token: write` permissions and `NODE_AUTH_TOKEN` environment variable are correctly configured for NPM publication.
4. Documenting the architectural decision in an ADR (`docs/adr/0008-npm-provenance-github-hosted-runners.md`).

---

## User Review Required

> [!IMPORTANT]
> **Runner Migration**: The publish workflow (`publish.yml`) will switch from `runs-on: [self-hosted, oci, arm64]` to `runs-on: ubuntu-latest`. NPM Provenance requires official GitHub-hosted runners to generate trusted Sigstore OIDC build attestations.

> [!NOTE]
> **NPM Repository Secret**: Ensure the GitHub repository secret `NPM_TOKEN` (or `NPM_AUTH_TOKEN`) is configured in the GitHub repository settings for automated publication.

---

## Open Questions

1. **CI Workflow (`node.js.yml`) Runner**: Should `node.js.yml` (regular CI tests on PR/push) also be updated to `ubuntu-latest`, or remain on `[self-hosted, oci, arm64]`?
   - *Recommendation*: Keep `node.js.yml` on `ubuntu-latest` or matrix test across `ubuntu-latest` for consistent builds.

---

## Proposed Changes

### Configuration & Workflows

#### [MODIFY] [package.json](file:///home/ubuntu/github/googledrive-mcp-server/package.json)
- Add `"provenance": true` inside `publishConfig`.

```diff
   "publishConfig": {
     "access": "public",
-    "registry": "https://registry.npmjs.org/"
+    "registry": "https://registry.npmjs.org/",
+    "provenance": true
   },
```

---

#### [MODIFY] [.github/workflows/publish.yml](file:///home/ubuntu/github/googledrive-mcp-server/.github/workflows/publish.yml)
- Change runner from `[self-hosted, oci, arm64]` to `ubuntu-latest`.
- Add `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` env var to `npm publish` step.
- Verify `id-token: write` and `contents: read` permissions.

```diff
 jobs:
   publish:
-    runs-on: [self-hosted, oci, arm64]
+    runs-on: ubuntu-latest
     permissions:
       contents: read
       id-token: write
     steps:
       - uses: actions/checkout@v5
       - uses: actions/setup-node@v5
         with:
           node-version: '22.x'
           registry-url: 'https://registry.npmjs.org'
       - run: npm ci
       - run: npm run build
       - run: npm test
-      - run: npm install -g npm@latest
-      - run: npm publish --provenance --access public
+      - run: npm publish --provenance --access public
+        env:
+          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

### Documentation

#### [NEW] [docs/adr/0008-npm-provenance-github-hosted-runners.md](file:///home/ubuntu/github/googledrive-mcp-server/docs/adr/0008-npm-provenance-github-hosted-runners.md)
- Record decision to enforce NPM Provenance publishing on `ubuntu-latest` GitHub-hosted runners.

---

## Verification Plan

### Automated Tests
1. Run local linting & standard tests:
   ```bash
   npm run lint
   npm test
   npm run build
   ```
2. Validate workflow syntax and `package.json` format:
   ```bash
   npx biome check .
   ```

### Manual Verification (Post-Merge / Release)
1. Trigger `publish.yml` workflow dispatch or publish a release draft.
2. Verify GitHub Action job logs show successful Sigstore OIDC token generation:
   `npm notice Publishing with provenance statements`
3. Inspect published package page on npm (e.g., `https://www.npmjs.com/package/@hydrochlorix/googledrive-mcp-server`) and verify the **Provenance** badge appears with link to GitHub Actions build log.
