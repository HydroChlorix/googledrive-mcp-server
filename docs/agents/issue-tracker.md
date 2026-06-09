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
