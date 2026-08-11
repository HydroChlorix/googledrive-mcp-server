import { AdmissionQueue, CircuitBreaker } from "./ResilienceAdapters.js";

/**
 * Determines if an error returned from Google Drive API is considered transient.
 *
 * According to ADR-0008, the following are transient:
 * - 429 Too Many Requests
 * - 403 Forbidden with reason 'rateLimitExceeded' or 'userRateLimitExceeded'
 * - 500-504 Server Errors
 *
 * @param error - The error object to classify
 * @returns true if transient, false otherwise
 */
export function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as Record<string, unknown>;
  const status = err["status"];
  if (typeof status !== "number") {
    return false;
  }

  // 429 Too Many Requests
  if (status === 429) {
    return true;
  }

  // 500-504 Server Errors
  if (status >= 500 && status <= 504) {
    return true;
  }

  // 403 Forbidden with specific rate limit reasons
  const errors = err["errors"];
  if (status === 403 && Array.isArray(errors)) {
    const isRateLimit = errors.some((e: unknown) => {
      if (typeof e !== "object" || e === null) return false;
      const reason = (e as Record<string, unknown>)["reason"];
      return reason === "rateLimitExceeded" || reason === "userRateLimitExceeded";
    });
    if (isRateLimit) {
      return true;
    }
  }

  return false;
}

export interface ResilienceOptions {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  isRead?: boolean;
  jitter?: () => number;
}

export class ResiliencePipeline {
  private circuit = new CircuitBreaker();
  private admissionQueue = new AdmissionQueue();
  private activeCount = 0;

  private pumpQueue(nowTime: number) {
    this.admissionQueue.pump(nowTime, this.activeCount, () => {
      this.activeCount++;
    });
  }

  public async execute<T>(operation: () => Promise<T>, options?: ResilienceOptions): Promise<T> {
    const nowFn = options?.now || Date.now;
    const isRead = options?.isRead === true;
    const sleepFn = options?.sleep || ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    const jitterFn = options?.jitter || Math.random;

    // Admission check
    this.circuit.checkAdmission(nowFn(), this.activeCount, this.admissionQueue.length);

    if (this.activeCount > 0) {
      await this.admissionQueue.waitInQueue(nowFn());

      // Check circuit again after waiting in queue
      try {
        this.circuit.checkAdmission(nowFn(), 0, 0); // we act as if we are the only one, wait, we are admitted.
      } catch (err) {
        this.activeCount--;
        this.pumpQueue(nowFn());
        throw err;
      }
    } else {
      this.activeCount++;
    }

    try {
      let attempts = 0;
      const deadline = nowFn() + 5000;

      while (true) {
        try {
          const result = await operation();
          this.circuit.recordSuccess();
          return result;
        } catch (error) {
          if (!isTransientError(error)) {
            throw error;
          }

          if (!isRead || attempts >= 2 || nowFn() >= deadline) {
            this.circuit.recordFailure(nowFn());
            throw error;
          }

          // Retry logic
          attempts++;
          const errObj = error as Record<string, unknown>;
          let delay = Math.min(2 ** (attempts - 1) * 1000 + jitterFn() * 1000, 2000);

          const responseObj = errObj["response"] as Record<string, unknown> | undefined;
          const headers = errObj["headers"] || responseObj?.["headers"];
          if (headers && typeof headers === "object" && "retry-after" in headers) {
            const retryAfterStr = String((headers as Record<string, unknown>)["retry-after"]);
            const retryAfterSec = Number.parseInt(retryAfterStr, 10);
            if (!Number.isNaN(retryAfterSec)) {
              delay = Math.min(retryAfterSec * 1000, 2000);
            }
          }

          await sleepFn(delay);
          if (nowFn() >= deadline) {
            throw error;
          }
        }
      }
    } finally {
      this.activeCount--;
      this.pumpQueue(nowFn());
    }
  }
}
