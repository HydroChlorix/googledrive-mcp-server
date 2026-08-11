# 10. Upgrade to MCP SDK 2.0 and Module Restructuring

* **Status**: Accepted
* **Date**: 2026-07-28

## Context

The Model Context Protocol (MCP) TypeScript SDK transitioned from the monolithic `@modelcontextprotocol/sdk` (v1.x) to modular packages (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`, `@modelcontextprotocol/core`) complying with the **2026-07-28 MCP Specification v2.0.0**.

Additionally, npm installation threw `EBADENGINE` warnings due to strict npm engine constraints, and unapproved binary install scripts for `@biomejs/biome` and `esbuild` were causing warnings.

## Decision

1. **SDK Upgrade**: Replaced `@modelcontextprotocol/sdk` with `@modelcontextprotocol/server` (`^2.0.0`) and updated all import paths (`@modelcontextprotocol/server`, `@modelcontextprotocol/server/stdio`).
2. **Engine Constraints**: Updated `package.json` `engines.npm` to allow npm `>=11.12.0`.
3. **Allow Scripts**: Configured `"allowScripts"` in `package.json` for `@biomejs/biome` and `esbuild` to download platform binaries cleanly.
4. **Vite Rollup External**: Updated `vite.config.ts` external patterns for `@modelcontextprotocol/server` and `@modelcontextprotocol/core`.

## Consequences

* Full compliance with the MCP v2.0.0 specification.
* Clean `npm install` execution without `EBADENGINE` or unapproved script warnings.
* Preserved zero-key authentication and boundary control security guarantees.
