import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ResilienceOptions,
  ResiliencePipeline,
  isTransientError,
} from "../src/core/resilience";

let pipeline = new ResiliencePipeline();
function resetResilienceState() {
  pipeline = new ResiliencePipeline();
}
function executeWithResilience<T>(op: () => Promise<T>, opts?: ResilienceOptions) {
  return pipeline.execute(op, opts);
}

describe("Transient Error Classification", () => {
  beforeEach(() => {
    resetResilienceState();
  });

  it("classifies 429 as transient", () => {
    const error = { status: 429 };
    expect(isTransientError(error)).toBe(true);
  });

  it("classifies 403 with rateLimitExceeded as transient", () => {
    const error = {
      status: 403,
      errors: [{ reason: "rateLimitExceeded" }],
    };
    expect(isTransientError(error)).toBe(true);
  });

  it("classifies 403 with userRateLimitExceeded as transient", () => {
    const error = {
      status: 403,
      errors: [{ reason: "userRateLimitExceeded" }],
    };
    expect(isTransientError(error)).toBe(true);
  });

  it("classifies 500-504 as transient", () => {
    for (const status of [500, 501, 502, 503, 504]) {
      expect(isTransientError({ status })).toBe(true);
    }
  });

  it("classifies generic 403 as non-transient", () => {
    const error = { status: 403 };
    expect(isTransientError(error)).toBe(false);

    const error2 = {
      status: 403,
      errors: [{ reason: "forbidden" }],
    };
    expect(isTransientError(error2)).toBe(false);
  });

  it("classifies 401 as non-transient", () => {
    expect(isTransientError({ status: 401 })).toBe(false);
  });

  it("classifies 404 as non-transient", () => {
    expect(isTransientError({ status: 404 })).toBe(false);
  });
});

describe("Resilience Seam", () => {
  beforeEach(() => {
    resetResilienceState();
  });

  it("executes a logical Drive operation successfully with injected sleep", async () => {
    const operation = vi.fn().mockResolvedValue("success");
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await executeWithResilience(operation, { sleep });
    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("propagates errors from the logical operation", async () => {
    const error = new Error("operation failed");
    const operation = vi.fn().mockRejectedValue(error);
    await expect(executeWithResilience(operation)).rejects.toThrow("operation failed");
  });
});

describe("FIFO Admission Queue", () => {
  beforeEach(() => {
    resetResilienceState();
  });

  it("permits one active Drive request and queues up to five", async () => {
    let activeCount = 0;
    let maxActiveCount = 0;
    const resolvers: (() => void)[] = [];

    const operation = vi.fn().mockImplementation(async () => {
      activeCount++;
      if (activeCount > maxActiveCount) maxActiveCount = activeCount;
      await new Promise<void>((resolve) => resolvers.push(resolve));
      activeCount--;
      return "done";
    });

    const promises = Array.from({ length: 6 }).map(() => executeWithResilience(operation));

    // First operation is active, rest are queued
    expect(activeCount).toBe(1);

    // Resolve all one by one
    for (let i = 0; i < 6; i++) {
      // wait until a resolver is available (when an operation becomes active)
      while (resolvers.length === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
      const resolveFn = resolvers.shift();
      if (resolveFn) resolveFn();
    }

    await Promise.all(promises);

    expect(operation).toHaveBeenCalledTimes(6);
    expect(maxActiveCount).toBe(1);
  });

  it("returns CONCURRENCY_LIMITED when queue exceeds 5", async () => {
    const resolvers: (() => void)[] = [];
    const operation = vi.fn().mockImplementation(async () => {
      await new Promise<void>((r) => resolvers.push(r));
      return "done";
    });

    // 1 active + 5 queued = 6 allowed, 7th is rejected
    const promises = Array.from({ length: 7 }).map(() =>
      executeWithResilience(operation).catch((e) => (e as Error).message),
    );

    // wait a tick
    await Promise.resolve();
    const result7 = await promises[6];

    expect(result7).toContain("CONCURRENCY_LIMITED");
    expect(operation).toHaveBeenCalledTimes(1);

    // cleanup
    for (let i = 0; i < 6; i++) {
      while (resolvers.length === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
      const resolveActive = resolvers.shift();
      if (resolveActive) resolveActive();
    }
    await Promise.all(promises.slice(0, 6));
  });

  it("returns QUEUE_TIMEOUT when waiting longer than 30 seconds", async () => {
    let nowTime = 0;

    let resolveActive: (() => void) | undefined;
    const operationWithResolve = vi.fn().mockImplementation(async () => {
      await new Promise<void>((r) => {
        resolveActive = r;
      });
      return "done";
    });

    nowTime = 0;
    const active = executeWithResilience(operationWithResolve, { now: () => nowTime });

    nowTime = 10;
    const queued = executeWithResilience(operationWithResolve, { now: () => nowTime }).catch(
      (e) => e.message,
    );

    // wait a tick to ensure active is running and next is queued
    await Promise.resolve();

    nowTime = 32000; // > 30s later
    if (resolveActive) resolveActive(); // finish active, which pumps queue

    const result = await queued;
    expect(result).toContain("QUEUE_TIMEOUT");
    await active;
  });
});

describe("Circuit Breaker", () => {
  beforeEach(() => {
    resetResilienceState();
  });

  it("opens circuit after 3 consecutive transient failures and allows half-open probe", async () => {
    let nowTime = 0;
    const options = { now: () => nowTime };

    const transientError = { status: 500 };
    const successOp = vi.fn().mockResolvedValue("success");
    const failOp = vi.fn().mockRejectedValue(transientError);

    // 1st failure
    await expect(executeWithResilience(failOp, options)).rejects.toEqual(transientError);
    // 2nd failure
    await expect(executeWithResilience(failOp, options)).rejects.toEqual(transientError);
    // 3rd failure (trips circuit)
    await expect(executeWithResilience(failOp, options)).rejects.toEqual(transientError);

    // Circuit is OPEN now. Next call should throw CIRCUIT_OPEN immediately
    await expect(executeWithResilience(successOp, options)).rejects.toThrow("CIRCUIT_OPEN");

    // Non-transient error doesn't reset or trigger (we simulate this before tripping, but circuit is already open here)

    // Advance time by 60s
    nowTime = 60001;

    // Exactly one probe should be admitted (half-open)
    // Create a slow success operation to test concurrency limits during half-open
    let resolveProbe: () => void;
    const slowSuccessOp = vi.fn().mockImplementation(async () => {
      await new Promise<void>((r) => {
        resolveProbe = r;
      });
      return "success";
    });

    const probePromise = executeWithResilience(slowSuccessOp, options);

    // Wait a tick for it to enter the seam
    await Promise.resolve();

    // A concurrent request during half-open should be rejected immediately (still open)
    await expect(executeWithResilience(successOp, options)).rejects.toThrow("CIRCUIT_OPEN");

    // Resolve the probe successfully
    if (resolveProbe) resolveProbe();
    await expect(probePromise).resolves.toBe("success");

    // Circuit should be closed now
    await expect(executeWithResilience(successOp, options)).resolves.toBe("success");
  });
  it("resets failure counter on success and ignores non-transient errors", async () => {
    const options = { now: () => 0 };
    const transientError = { status: 500 };
    const nonTransientError = { status: 404 };

    const successOp = vi.fn().mockResolvedValue("ok");
    const failTransient = vi.fn().mockRejectedValue(transientError);
    const failNonTransient = vi.fn().mockRejectedValue(nonTransientError);

    // 2 transient failures
    await expect(executeWithResilience(failTransient, options)).rejects.toEqual(transientError);
    await expect(executeWithResilience(failTransient, options)).rejects.toEqual(transientError);

    // Non-transient failure (should not affect counter)
    await expect(executeWithResilience(failNonTransient, options)).rejects.toEqual(
      nonTransientError,
    );

    // Success (resets counter to 0)
    await expect(executeWithResilience(successOp, options)).resolves.toBe("ok");

    // Now takes 3 more transient failures to open
    await expect(executeWithResilience(failTransient, options)).rejects.toEqual(transientError);
    await expect(executeWithResilience(failTransient, options)).rejects.toEqual(transientError);

    // Circuit still closed
    await expect(executeWithResilience(successOp, options)).resolves.toBe("ok");
  });
});

describe("Bounded Read Retry", () => {
  beforeEach(() => {
    resetResilienceState();
  });

  it("retries reads up to 2 times for transient errors", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const nowTime = 0;
    const options = { now: () => nowTime, sleep, isRead: true, jitter: () => 0 };

    const transientError = { status: 500 };
    const operation = vi
      .fn()
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce("success");

    const result = await executeWithResilience(operation, options);
    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("fails after 3 attempts (1 initial + 2 retries)", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const options = { now: () => 0, sleep, isRead: true, jitter: () => 0 };

    const transientError = { status: 500 };
    const operation = vi.fn().mockRejectedValue(transientError);

    await expect(executeWithResilience(operation, options)).rejects.toEqual(transientError);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry for non-transient errors", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const options = { now: () => 0, sleep, isRead: true, jitter: () => 0 };

    const error = { status: 404 };
    const operation = vi.fn().mockRejectedValue(error);

    await expect(executeWithResilience(operation, options)).rejects.toEqual(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not retry mutating operations", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const options = { now: () => 0, sleep, isRead: false, jitter: () => 0 };

    const transientError = { status: 500 };
    const operation = vi.fn().mockRejectedValue(transientError);

    await expect(executeWithResilience(operation, options)).rejects.toEqual(transientError);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("stops retrying if deadline is exceeded", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    let nowTime = 0;
    // Advance time past 5s during the first operation
    const options = {
      now: () => nowTime,
      sleep,
      isRead: true,
      jitter: () => 0,
    };

    const transientError = { status: 500 };
    const operation = vi.fn().mockImplementation(async () => {
      nowTime += 5001; // exceeds 5000ms deadline
      throw transientError;
    });

    await expect(executeWithResilience(operation, options)).rejects.toEqual(transientError);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
