# ADR 0003: Automatic Text Export for Google Workspace Files

## Status

Accepted

## Context

Google Workspace files (such as Google Docs, Sheets, and Slides) cannot be downloaded directly in a binary format like standard files. They require an explicit `export` operation specifying the desired MIME type. Allowing AI Agents to manage this complex process manually introduces friction and increases the likelihood of errors due to incorrect MIME type specification.

## Decision

We will centralize the Google Workspace file handling logic within the MCP Server:

1. Upon invoking the file-content download operation, currently exposed as `drive_download_file`, the server will first inspect the target file's metadata.
2. If the origin MIME type indicates a Google Workspace file (e.g., starts with `application/vnd.google-apps.`), the server will dynamically switch from the `files.get` API to the `files.export` API.
3. The server will forcefully enforce an export to `text/plain`, guaranteeing that the AI Agent receives immediate, text-ready content for processing.
4. Standard files (binary/text) will continue to utilize the standard download flow.

## Consequences

- **Positive:** Ensures AI Agents experience consistent file handling capabilities across all Drive assets, drastically simplifying prompts and reducing cognitive load.
- **Negative:** Rich formatting data (e.g., bold text, colors, complex table structures) will be lost during the conversion to plain text.
- **Neutral:** Necessitates the implementation of MIME type detection and branching API invocation logic within the codebase.
