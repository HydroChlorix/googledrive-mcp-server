# Version Upgrade to v1.1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump the package version from `1.0.0` to `1.1.1` in [package.json](file:///home/ubuntu/github/googledrive-mcp-server/package.json) and [package-lock.json](file:///home/ubuntu/github/googledrive-mcp-server/package-lock.json), merge development changes into `main`, and create a new GitHub release tag `v1.1.1` with auto-generated release notes.

**Tech Stack:** Node.js, Git, GitHub CLI (`gh`)

---

### Task 1: Version Bumping and Local Verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Bump package version using npm CLI**
  
  Run: `npm version 1.1.1 --no-git-tag-version`
  Expected: Both `package.json` and `package-lock.json` versions are updated to `1.1.1`.

- [x] **Step 2: Run local verification**
  
  Run: `npm run build && npm run lint && npm test`
  Expected: Build finishes without error, linter reports no issues, and all 60 tests pass.

- [x] **Step 3: Commit the version bump on develop**
  
  Run:
  ```bash
  git add package.json package-lock.json
  git commit -m "chore: bump version to 1.1.1"
  ```
  Expected: Version bump is committed.

- [x] **Step 4: Push to origin/develop**
  
  Run: `git push origin develop`
  Expected: Branch `develop` is pushed to remote.

---

### Task 2: Merge and Release Tagging

- [x] **Step 1: Switch to main branch**
  
  Run: `git checkout main`
  Expected: Working tree switches to `main`.

- [x] **Step 2: Merge develop into main**
  
  Run: `git merge develop --ff-only`
  Expected: Fast-forward merges develop into main, ensuring both branches point to the exact same commit (i.e. `develop = main`).

- [x] **Step 3: Push main branch to remote**
  
  Run: `git push origin main`
  Expected: Remote `main` is updated.

- [x] **Step 4: Tag release and push tag**
  
  Run:
  ```bash
  git tag -a v1.1.1 -m "Final state before v2.0.0 rewrite"
  git push origin v1.1.1
  ```
  Expected: Git tag `v1.1.1` is pushed to remote.

---

### Task 3: Create GitHub Release

- [x] **Step 1: Create release using GitHub CLI**
  
  Run: `gh release create v1.1.1 --generate-notes`
  Expected: GitHub release for tag `v1.1.1` is successfully created on remote repository.

- [x] **Step 2: Return to develop branch**
  
  Run: `git checkout develop`
  Expected: Working tree switches back to `develop`.
