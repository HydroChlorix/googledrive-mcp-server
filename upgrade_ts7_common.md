# Generic Upgrade Guide: TypeScript 7 & Maximum Strictness

A reusable, project-agnostic blueprint for upgrading Node.js / TypeScript projects to **TypeScript 7.x**, enforcing maximum `tsconfig.json` compiler strictness, blocking explicit `any` usage, and standardizing code formatting.

---

## 📋 Overview & Stack Matrix

Before starting, choose the code quality stack that fits your target project:

| Component        | **Path A: Modular (Recommended for Existing Codebases)** | **Path B: Unified (Recommended for New Codebases)** |
| :--------------- | :------------------------------------------------------- | :-------------------------------------------------- |
| **Compiler**     | TypeScript 7.x (`^7.0.0`)                                | TypeScript 7.x (`^7.0.0`)                           |
| **Linter**       | **Oxlint** (`oxlint.json`)                               | **Biome** (`biome.json`)                            |
| **Formatter**    | **Prettier** (`.prettierrc`)                             | **Biome** (`biome.json`)                            |
| **Config Files** | 3 files (`tsconfig.json`, `oxlint.json`, `.prettierrc`)  | 2 files (`tsconfig.json`, `biome.json`)             |

---

## ⚙️ Phase 1: Prerequisites & Dependencies

### System Requirements

- **Node.js**: `>= 18.0.0` (required for ES2023 target and modern type stripping).
- **TypeScript**: `^7.0.0`

### Package Setup (`package.json`)

Update your `devDependencies` depending on the chosen stack:

#### Path A: Oxlint + Prettier

```json
{
  "devDependencies": {
    "oxlint": "^1.67.0",
    "prettier": "^3.5.0",
    "typescript": "^7.0.0"
  }
}
```

#### Path B: Biome (Unified)

```json
{
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "typescript": "^7.0.0"
  }
}
```

> 💡 **Tip**: Ensure `@types/node` matches your target Node.js major runtime (e.g. `"@types/node": "^24.0.0"` for Node 24).

---

## 🛠️ Phase 2: Compiler Strictness (`tsconfig.json`)

Enable `"strict": true` and apply modern maximum strictness settings:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,

    /* Maximum Strictness Flags */
    "isolatedModules": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitOverride": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "erasableSyntaxOnly": true
  }
}
```

### Compiler Flag Reference

| Flag                                 | Purpose / Benefit                                                                              |
| :----------------------------------- | :--------------------------------------------------------------------------------------------- |
| `target: "ES2023"`                   | Uses modern ES features natively supported in Node.js 18+.                                     |
| `isolatedModules`                    | Ensures each file can be transpiled safely by single-file tools (Oxlint, Biome, Vitest).       |
| `noPropertyAccessFromIndexSignature` | Requires bracket notation (`obj["key"]`) for index signatures to prevent unsafe access.        |
| `noImplicitOverride`                 | Mandates explicit `override` keyword when subclassing methods.                                 |
| `allowUnreachableCode: false`        | Throws compile errors on dead / unreachable code.                                              |
| `allowUnusedLabels: false`           | Disallows dangling unused code labels.                                                         |
| `erasableSyntaxOnly` _(TS 5.8+)_     | Restricts syntax to features removable by native Node.js type stripping without runtime logic. |

---

## 🎨 Phase 3: Tooling Configuration

Select **Path A** or **Path B** based on your project requirements.

### Path A: Oxlint + Prettier Setup

#### 1. `oxlint.json` (Block explicit `any`)

```json
{
  "rules": {
    "typescript/no-explicit-any": "error"
  }
}
```

#### 2. `.prettierrc` (Formatting rules)

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

#### 3. `.prettierignore` (Ignore patterns)

```gitignore
node_modules
dist
build
coverage
package-lock.json
pnpm-lock.yaml
yarn.lock
```

---

### Path B: Biome Setup (Unified Linter + Formatter)

Create a single **`biome.json`** file in your project root:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExplicitAny": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      "build",
      "coverage",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock"
    ]
  }
}
```

---

## 🚀 Phase 4: Step-by-Step Execution Plan

### 1. Branching

Create a dedicated feature branch:

```bash
git checkout main # or develop / integration branch
git checkout -b feature/upgrade-ts-7
```

> _(Note: Prefix commands with `rtk` if using the RTK CLI proxy)._

### 2. File Updates

Update configuration files according to your selected path:

- `package.json`
- `tsconfig.json`
- `oxlint.json` + `.prettierrc` _(Path A)_ **OR** `biome.json` _(Path B)_

### 3. Install Packages

```bash
npm install # or pnpm install / yarn install / bun install
```

### 4. Verification & Remediation Workflow

#### For Path A (Oxlint + Prettier):

1. **Format codebase**:
   ```bash
   npx prettier --write "src/**/*.ts" "tests/**/*.ts"
   ```
2. **Type-Check**:
   ```bash
   npm run build # or npx tsc -p tsconfig.json
   ```
3. **Lint Check**:
   ```bash
   npm run check-lint # or npx oxlint src/ --deny-warnings
   ```
4. **Run Unit Tests**:
   ```bash
   npm test
   ```

#### For Path B (Biome):

1. **Format & Lint codebase**:
   ```bash
   npx @biomejs/biome check --write .
   ```
2. **Type-Check**:
   ```bash
   npm run build # or npx tsc -p tsconfig.json
   ```
3. **Run Unit Tests**:
   ```bash
   npm test
   ```

---

## ✅ Phase 5: Post-Upgrade Verification Checklist

- [ ] All packages installed with zero peer dependency conflicts.
- [ ] Formatting and lint checks pass cleanly with 0 errors/warnings.
- [ ] Type check (`npx tsc --noEmit`) returns 0 errors.
- [ ] Full test suite passes green.
- [ ] Feature branch committed and PR submitted to primary integration branch.
