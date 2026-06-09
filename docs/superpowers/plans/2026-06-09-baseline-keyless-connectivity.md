# Baseline Keyless Connectivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the foundation for the Google Drive MCP server using Application Default Credentials (ADC) instead of hardcoded JSON keys.

**Architecture:** Initialize a basic Node.js MCP server that authenticates with the Google Drive API using the `GoogleAuth` class from the `googleapis` package. This class automatically detects and uses ADC (impersonated credentials) provided by the local environment.

**Tech Stack:** Node.js, `@modelcontextprotocol/sdk`, `googleapis`

---

### Task 1: Project Setup and Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install googleapis package**

Run: `npm install googleapis`
Expected: `googleapis` is added to `dependencies` in `package.json`.

- [ ] **Step 2: Install testing framework**

Run: `npm install --save-dev jest`
Expected: `jest` is added to `devDependencies`.

- [ ] **Step 3: Add test script to package.json**

Modify `package.json` to replace the placeholder test script with Jest.

```json
  "scripts": {
    "test": "jest"
  },
```

- [ ] **Step 4: Commit setup**

```bash
git add package.json package-lock.json
git commit -m "chore: setup project dependencies for google drive integration"
```

### Task 2: Implement Keyless Auth Client

**Files:**
- Create: `src/auth.js`
- Create: `tests/auth.test.js`

- [ ] **Step 1: Write the auth client test**

Create `tests/auth.test.js`:

```javascript
const { getDriveClient } = require('../src/auth');

describe('Auth Client', () => {
  it('should initialize Drive client using GoogleAuth (ADC)', async () => {
    // We just want to ensure it instantiates without throwing errors
    // and returns an object with the drive API methods.
    const drive = await getDriveClient();
    expect(drive).toBeDefined();
    expect(typeof drive.files.list).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because `src/auth.js` does not exist.

- [ ] **Step 3: Write minimal implementation using ADC**

Create `src/auth.js`:

```javascript
const { google } = require('googleapis');

/**
 * Initializes and returns a Google Drive API client using Application Default Credentials (ADC).
 * This relies on the environment having valid ADC (e.g., via gcloud auth application-default login).
 */
async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
    // By NOT providing a keyFile or credentials object, we force the use of ADC.
  });

  const authClient = await auth.getClient();
  
  return google.drive({ version: 'v3', auth: authClient });
}

module.exports = {
  getDriveClient
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (Assuming the local environment has ADC configured. If the CI/test environment doesn't have ADC, the test might fail with "Could not load the default credentials". In that case, mock `GoogleAuth` for the test).

*Self-correction during planning: It's better to mock `GoogleAuth` in the test to ensure it runs reliably regardless of local environment setup.*

Update `tests/auth.test.js` to mock `googleapis`:

```javascript
const { google } = require('googleapis');
const { getDriveClient } = require('../src/auth');

jest.mock('googleapis', () => {
  const mockGetClient = jest.fn().mockResolvedValue('mock-auth-client');
  const mockGoogleAuth = jest.fn().mockImplementation(() => ({
    getClient: mockGetClient
  }));
  const mockDrive = jest.fn().mockReturnValue({
    files: { list: jest.fn() }
  });

  return {
    google: {
      auth: { GoogleAuth: mockGoogleAuth },
      drive: mockDrive
    }
  };
});

describe('Auth Client', () => {
  it('should initialize GoogleAuth without explicit credentials (relying on ADC)', async () => {
    const drive = await getDriveClient();
    
    expect(google.auth.GoogleAuth).toHaveBeenCalledWith({
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    
    expect(google.drive).toHaveBeenCalledWith({
      version: 'v3',
      auth: 'mock-auth-client'
    });
    
    expect(drive).toBeDefined();
    expect(typeof drive.files.list).toBe('function');
  });
});
```

- [ ] **Step 5: Run mocked test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit auth client**

```bash
git add src/auth.js tests/auth.test.js
git commit -m "feat: implement ADC-based keyless auth client"
```

### Task 3: Basic MCP Server Entrypoint

**Files:**
- Create: `index.js`

- [ ] **Step 1: Write basic MCP server setup**

Create `index.js` to export a basic MCP server structure that initializes the drive client.

```javascript
#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { getDriveClient } = require('./src/auth.js');

async function main() {
  console.error("Starting Google Drive MCP Server (Keyless Auth)...");
  
  try {
    // Verify we can get a client (this will throw if ADC is not configured properly)
    // Note: We don't make an API call yet, just initialize the client wrapper.
    const driveClient = await getDriveClient();
    console.error("Successfully initialized Google Drive client via ADC.");

    const server = new Server(
      {
        name: "googledrive-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Server connected to stdio transport.");

  } catch (error) {
    console.error("Failed to start server:");
    console.error(error.message);
    process.exit(1);
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Make index.js executable**

Run: `chmod +x index.js`

- [ ] **Step 3: Commit entrypoint**

```bash
git add index.js
git commit -m "feat: initialize basic MCP server entrypoint"
```
