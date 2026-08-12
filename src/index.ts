#!/usr/bin/env node
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { registerCrashReporter, reportCrash } from "./core/operationLogger.js";
import { startMcpServer } from "./mcp/server.js";

// Register process-level crash reporter at the earliest point
registerCrashReporter();

// Auto-load .env when running locally if file exists
if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore error if loading fails
  }
}

export async function main(): Promise<void> {
  if (process.argv.includes("--gen-token") || process.argv.includes("gen-token")) {
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(32).toString("hex");
    const output = [
      "🔑 Generated Secure Dashboard Token:",
      token,
      "",
      "To use a persistent token, add this to your environment or mcp_config.json:",
      `MCP_DASHBOARD_TOKEN=${token}`,
      "",
    ].join("\n");
    await new Promise<void>((resolve, reject) => {
      process.stdout.write(output, (error) => (error ? reject(error) : resolve()));
    });
    return;
  }

  try {
    await startMcpServer();
  } catch (error) {
    reportCrash(error);
    process.exit(1);
  }
}

// ตรวจสอบว่าถ้าไฟล์นี้ถูกรันโดยตรง (ไม่ใช่ถูกเรียกผ่าน Unit Test) ค่อยสั่งรัน main()
const isMain =
  process.argv[1] &&
  (() => {
    try {
      return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
    } catch {
      return false;
    }
  })();

if (isMain) {
  main();
}
