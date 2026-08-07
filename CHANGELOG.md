# Changelog

## [2.3.3] - 2026-08-07

### Bug Fixes
- **ci**: Add `npm install -g npm@latest` step before publish to fix scoped package provenance publishing bug in npm 10.x.

## [2.3.2] - 2026-08-07

### Bug Fixes
- **ci**: Add `npm ci --ignore-scripts` to publish job and update `prepare` script to handle missing husky gracefully during NPM publish.

## [2.3.1] - 2026-08-07

### Bug Fixes
- **ci**: Add build step to verify job in publish workflow so integration tests find `dist/server.mjs`.
- **ci**: Update agent-triage runner to `[self-hosted, oci, arm64]`.

## [2.3.0] - 2026-08-07

### Features
- **core**: Enforce strictly required `parentId` for `uploadTextFile` and `createFolder` tools/functions to prevent orphaned files in Service Account root drive.
- **ci**: Enhance workflows with pre-publish validation, security checks for downloads, and automated bug triage for agent-generated issues.
