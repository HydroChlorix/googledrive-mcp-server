# Full Implementation Plan: MCP SDK 2.0 Upgrade & NPM Fixes

This document combines three related plans that were executed during the transition to the new Model Context Protocol 2.0 structure.

---

# Part 1: Upgrade to MCP TypeScript SDK 2.0

## Goal Description

Upgrade `googledrive-mcp-server` from the monolithic `@modelcontextprotocol/sdk@^1.29.0` (v1.x) to the new modular `@modelcontextprotocol/server@2.0.0` package, which aligns with the **2026-07-28 MCP Specification**.

The TypeScript SDK has been restructured from one monolithic package into modular packages:

| Old (v1.x)                          | New (v2.0.0)                              |
|--------------------------------------|-------------------------------------------|
| `@modelcontextprotocol/sdk`          | `@modelcontextprotocol/server` (server)   |
|                                      | `@modelcontextprotocol/client` (client)   |
|                                      | `@modelcontextprotocol/core` (shared)     |

## Impact Analysis

### File-by-File Impact Assessment

| File | Impact Level | Change Required | Reason |
|------|:---:|:---:|--------|
| `package.json` | 🔴 High | ✅ Yes | Remove `@modelcontextprotocol/sdk`, add `@modelcontextprotocol/server` |
| `src/index.ts` | 🔴 High | ✅ Yes | Import path change for `StdioServerTransport` |
| `src/mcp/server.ts` | 🔴 High | ✅ Yes | Import paths for `McpServer` and `StdioServerTransport` |
| `tests/server.test.ts` | 🔴 High | ✅ Yes | Mock paths must match new import paths |
| `tests/index.test.ts` | 🔴 High | ✅ Yes | Mock paths must match new import paths |
| `vite.config.ts` | 🟡 Medium | ✅ Yes | Rollup `external` must reference new package name |

## Proposed Changes

### 1. Dependencies (`package.json`)
```diff
   "dependencies": {
-    "@modelcontextprotocol/sdk": "^1.29.0",
+    "@modelcontextprotocol/server": "^2.0.0",
     "googleapis": "^173.0.0",
     "zod": "^3.23.8"
   },
```

### 2. Source Code (`src/index.ts` & `src/mcp/server.ts`)
```diff
-import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
-import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
+import { McpServer } from "@modelcontextprotocol/server";
+import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
```

### 3. Build Configuration (`vite.config.ts`)
```diff
     rollupOptions: {
-      external: ["googleapis", "@modelcontextprotocol/sdk", "zod", /^node:/],
+      external: ["googleapis", "@modelcontextprotocol/server", "@modelcontextprotocol/core", "zod", /^node:/],
     },
```

---

# Part 2: Fix EBADENGINE Warning

## Goal Description

During `npm install` or `npm audit fix`, npm throws an `EBADENGINE` warning because the user's npm version (`11.12.1`) does not satisfy the `engines.npm` constraint in `package.json` (`<11.10.0 || >=12.0.0`). 

## Proposed Changes

### [MODIFY] `package.json`
Update the `engines.npm` field to allow npm `>=11.12.0`.

```diff
   "engines": {
     "node": ">=20.0.0",
-    "npm": "<11.10.0 || >=12.0.0"
+    "npm": "<11.10.0 || >=11.12.0"
   },
```

---

# Part 3: Approve NPM Install Scripts

## Goal Description

During `npm install`, npm warns about unapproved install scripts from packages like `@biomejs/biome` and `esbuild`. These scripts are necessary for downloading the correct platform-specific binaries for linting and building.

## Proposed Changes

### [MODIFY] `package.json`
Add the `"allowScripts"` section to whitelist the trusted development dependencies so that they can download their binaries without warnings.

```diff
   "devDependencies": {
     "@biomejs/biome": "^1.8.3",
     // ...
     "vitest": "^4.1.10"
-  }
+  },
+  "allowScripts": {
+    "@biomejs/biome": true,
+    "esbuild": true
+  }
```

---

## Final Verification Plan

### Automated Tests
```bash
rtk npm install
rtk npm test
rtk npm run lint
rtk npm run build
```

### Manual Verification
1. **Start server**: `rtk npm start` — verify "🚀 Google Drive MCP Server v2.0.0 is running on stdio" output.
2. Verify that no `EBADENGINE` or `npm warn allow-scripts` warnings appear during installation.

---

# Part 4: Update README.md

## Goal Description

Update the documentation to proudly reflect the new MCP v2.0.0 compliance and add a strict Node.js `>=20.0.0` prerequisite warning to help users avoid engine mismatch errors (`EBADENGINE`).

## Proposed Changes

### [MODIFY] `README.md`
Added MCP v2.0.0 badge and added Node.js prerequisite note to the Quick Start section.

---

# Part 5: Configuration Review (.npmrc & .nvmrc)

## Goal Description

Review `.npmrc` and `.nvmrc` to ensure they align with the project's standards and current environment.

## Conclusion

- **`.npmrc`**: Kept `engine-strict=true` as it correctly secures the environment.
- **`.nvmrc`**: Kept `v22.23.2` to standardize the project on the Node 22 (LTS) release line.
- **No file changes required.**
