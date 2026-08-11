# Specifications Directory (`docs/specs/`)

Folder for storing feature specifications and Product Requirement Documents (PRDs) before starting development.

---

## 🔄 Workflow

```text
1. Design Spec  ──►  2. Break into Issues  ──►  3. Develop & Test  ──►  4. Summarize
 (docs/specs/)        (gh issue create)         (Vitest / Biome)       (docs/project.md)
```

1. **Create New Spec**: Copy [`TEMPLATE.md`](file:///home/ubuntu/github/googledrive-mcp-server/docs/specs/TEMPLATE.md) to create `docs/specs/<feature-name>.md`.
2. **Break into GitHub Issues**: Use the `gh issue create` command from the `## GitHub Issues Breakdown` section in the Spec to create sub-tasks.
3. **Develop and Test**: Implement each Issue and pass the tests (`npm test`).
4. **When Finished (Spec Lifecycle)**:
   - **Do Not Keep Spec Files**: After development is complete, immediately **Merge** all important information (architecture, new features, API contracts) into [docs/project.md](file:///home/ubuntu/github/googledrive-mcp-server/docs/project.md) (SSOT).
   - **Delete the File**: To prevent information drift in the future, delete the Spec file from `docs/specs/` immediately after merging.
   - Document any major technical decisions in `docs/adr/` (if applicable).
