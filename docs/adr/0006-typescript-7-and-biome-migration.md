# ADR 0006: TypeScript 7 & Biome Unified Tooling Stack Migration

## Status

Accepted

## Context

The `googledrive-mcp-server` codebase was originally implemented in JavaScript (CommonJS/Node.js). As the codebase expanded with more complex Drive API payloads and MCP schemas, type safety, code formatting consistency, and module modernizations became necessary. We needed a modern, low-overhead blueprint for upgrading the codebase while maintaining maximum compiler strictness and high execution performance.

## Decision

We will migrate `googledrive-mcp-server` from JavaScript to **TypeScript 7** using a unified **Biome + Vitest** toolchain:

1. **TypeScript 7.x (`tsconfig.json`)**:
   - Target `ES2023`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`.
   - Enable `"strict": true` alongside modern flags (`isolatedModules`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `erasableSyntaxOnly`).
   - Build source `.ts` files into the production bundle under `dist/` via the repository's Vite build, with `package.json` pointing to `dist/server.mjs`.
2. **ES Modules (ESM)**:
   - Set `"type": "module"` in `package.json`, standardizing on native `import`/`export` syntax.
3. **Unified Tooling (Biome - Path B)**:
   - Use `biome.json` for unified linting and code formatting, replacing ESLint and Prettier.
   - Enforce `"noExplicitAny": "error"`, requiring strict interface contracts (`DriveFileMetadata`, etc.) for Drive API payloads and MCP schemas.
4. **Test Runner (Vitest)**:
   - Replace `jest` with `vitest` for zero-configuration, native ES module and TypeScript test execution.

## Considered Options

- **Path A (Oxlint + Prettier + Jest with ts-jest)** — rejected due to multi-config overhead (3 separate config files) and Jest ESM transformation complexity.
- **Direct TS Execution (tsx / experimental-strip-types)** — rejected to ensure `dist/` production builds remain 100% compatible across standard Node.js 18+ runtimes without experimental flags.
- **CommonJS Preservation** — rejected in favor of native ESM standards.

## Consequences

- **Positive:** Full compile-time type safety for Google Drive API and MCP SDK contracts, zero explicit `any` usage, ultra-fast unified linting/formatting via Biome, and zero-transform ESM testing via Vitest.
- **Negative:** Requires the Vite build step (`npm run build`) before distribution or local `npx` execution.
- **Neutral:** Test suite updated to Vitest API (`vi.fn()`, `vitest` CLI).
