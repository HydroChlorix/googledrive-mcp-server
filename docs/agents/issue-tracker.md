# Issue Tracker Instructions

This project uses **GitHub Issues** as its issue tracker.

When skills like `to-issues` or `to-prd` interact with the issue tracker, you should use the GitHub CLI (`gh`).

## Creating issues

Use `gh issue create` to create issues.

```bash
gh issue create --title "<Title>" --body-file <path-to-body> --label <label-name>
```

Always use `--body-file` pointing to a temporary file rather than passing the body inline, as issue bodies are often long and contain markdown formatting that breaks shell escaping.

## Reading issues

Use `gh issue view` to read issues.

```bash
gh issue view <issue-number> --json title,body,state,labels,comments
```

Use `gh issue list` to search for issues.

```bash
gh issue list --state open --label <label-name>
```

## Adding comments

Use `gh issue comment` to add comments to an issue.

```bash
gh issue comment <issue-number> --body-file <path-to-body>
```

## Agentic Testing & Automated Bug Reports (Hermes)

When an automated tester agent (e.g., Hermes) encounters a bug, it must create an issue using the `gh` CLI so the CI/CD pipeline can intercept it as a webhook.

**Mandatory Requirements for Automated Bug Reports:**
1. You MUST include the labels `bug` and `reported-by-agent`.
2. The issue body MUST include a structured JSON codeblock named `agent_payload` at the very end.

**Example Command:**
```bash
gh issue create --title "Bug: Upload failed with 403" --body-file payload.md --label "bug,reported-by-agent"
```

**Example `payload.md` format:**
```markdown
Hermes encountered an authentication error during the upload text file test.

### Details
The server responded with a 403 Forbidden.

```json
{
  "reporter": "hermes-agent",
  "test_suite": "mcp-smoke",
  "error_code": 403,
  "action_required": "triage"
}
```
```
