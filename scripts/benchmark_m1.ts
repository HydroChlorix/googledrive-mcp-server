import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { SqliteAuditLogger } from "../src/audit/SqliteAuditLogger.js";
import type { AuditEventInput } from "../src/audit/types.js";

async function runEmpiricalBenchmark() {
  const testDbPath = path.join(
    os.tmpdir(),
    `emp-audit-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
  const logger = new SqliteAuditLogger({
    dbPath: testDbPath,
    flushIntervalMs: 50,
    batchSize: 100,
  });

  const sampleEvent: AuditEventInput = {
    sessionId: "emp-sess-001",
    agentId: "emp-agent-007",
    toolName: "drive_upload_text_file",
    fileId: "file-xyz-789",
    fileName: "confidential.docx",
    status: "SUCCESS",
    executionTimeMs: 15.6,
    saEmail: "audit-sa@corp.internal",
    sharedDriveId: "drive-internal-001",
    boundaryPassed: true,
  };
  const N = 1000;
  const latenciesMs: number[] = new Array(N);

  const startSeq = performance.now();
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    logger.log({
      ...sampleEvent,
      sessionId: `seq-${i}`,
    });
    const t1 = performance.now();
    latenciesMs[i] = t1 - t0;
  }
  const totalSeqTimeMs = performance.now() - startSeq;

  latenciesMs.sort((a, b) => a - b);
  const minLat = latenciesMs[0]!;
  const maxLat = latenciesMs[N - 1]!;
  const sumLat = latenciesMs.reduce((a, b) => a + b, 0);
  const meanLat = sumLat / N;
  const p50Lat = latenciesMs[Math.floor(N * 0.5)]!;
  const p95Lat = latenciesMs[Math.floor(N * 0.95)]!;
  const p99Lat = latenciesMs[Math.floor(N * 0.99)]!;

  const pass10ms = meanLat < 10.0 && p99Lat < 10.0;
  const passTarget1ms = meanLat < 1.0;

  // Track event loop delay via background timer
  let eventLoopLagMaxMs = 0;
  let eventLoopChecks = 0;
  const timerStart = performance.now();

  // High-frequency monitor checking lag every 5ms
  const monitorInterval = setInterval(() => {
    const now = performance.now();
    const expected = timerStart + eventLoopChecks * 5;
    const lag = now - expected;
    if (lag > eventLoopLagMaxMs) {
      eventLoopLagMaxMs = lag;
    }
    eventLoopChecks++;
  }, 5);

  const burstWorkers = 10;
  const callsPerWorker = 100;
  const burstLatenciesMs: number[] = [];

  const burstStart = performance.now();
  await Promise.all(
    Array.from({ length: burstWorkers }).map(async (_, wIdx) => {
      for (let c = 0; c < callsPerWorker; c++) {
        const b0 = performance.now();
        logger.log({
          ...sampleEvent,
          sessionId: `burst-w${wIdx}-c${c}`,
        });
        const b1 = performance.now();
        burstLatenciesMs.push(b1 - b0);
      }
    }),
  );
  const burstTimeMs = performance.now() - burstStart;
  clearInterval(monitorInterval);

  burstLatenciesMs.sort((a, b) => a - b);
  const burstMean = burstLatenciesMs.reduce((a, b) => a + b, 0) / burstLatenciesMs.length;
  const burstP99 = burstLatenciesMs[Math.floor(burstLatenciesMs.length * 0.99)]!;
  const drainStart = performance.now();
  const queryResult = await logger.query({ limit: 500 });
  const drainTimeMs = performance.now() - drainStart;

  // Flush remaining and close logger handle safely
  await logger.close();

  // Re-open with reader logger to check total persisted record count
  const verifierLogger = new SqliteAuditLogger({ dbPath: testDbPath });
  const totalLogsInDb = await verifierLogger.query({ limit: 500 });
  await verifierLogger.close();

  // Clean up test DB file
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch {}
  }
  const memLogger = new SqliteAuditLogger({ dbPath: ":memory:" });
  const memLatencies: number[] = new Array(1000);

  const startMem = performance.now();
  for (let i = 0; i < 1000; i++) {
    const m0 = performance.now();
    memLogger.log({ ...sampleEvent, sessionId: `mem-${i}` });
    const m1 = performance.now();
    memLatencies[i] = m1 - m0;
  }
  const totalMemTime = performance.now() - startMem;
  memLatencies.sort((a, b) => a - b);
  const memMean = memLatencies.reduce((a, b) => a + b, 0) / 1000;
  const memP99 = memLatencies[Math.floor(1000 * 0.99)]!;

  const memQuery = await memLogger.query({ limit: 10 });
  await memLogger.close();
}

runEmpiricalBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
