import { log } from "./operationLogger.js";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  public state: CircuitState = "CLOSED";
  public consecutiveFailures = 0;
  public openUntil = 0;
  private readonly cooldownMs = 60000;

  public reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.openUntil = 0;
  }

  public checkAdmission(now: number, activeCount: number, queueLength: number): void {
    if (this.state === "OPEN") {
      if (now < this.openUntil) {
        throw new Error("CIRCUIT_OPEN");
      }
      this.state = "HALF_OPEN";
    } else if (this.state === "HALF_OPEN") {
      if (activeCount > 0 || queueLength > 0) {
        throw new Error("CIRCUIT_OPEN");
      }
    }
  }

  public recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
    }
    this.consecutiveFailures = 0;
  }

  public recordFailure(now: number): void {
    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.openUntil = now + this.cooldownMs;
      log("warn", "Circuit breaker OPEN after failure in HALF_OPEN state");
    } else {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= 3) {
        this.state = "OPEN";
        this.openUntil = now + this.cooldownMs;
        log("warn", `Circuit breaker OPEN after ${this.consecutiveFailures} transient failures`);
      }
    }
  }
}

interface QueuedTask {
  resolve: () => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
}

export class AdmissionQueue {
  private queue: QueuedTask[] = [];
  private readonly maxQueueSize = 5;
  private readonly timeoutMs = 30000;

  public reset(): void {
    this.queue = [];
  }

  public get length(): number {
    return this.queue.length;
  }

  public enqueue(now: number, enqueueFn: (task: QueuedTask) => void): void {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error("CONCURRENCY_LIMITED");
    }
    enqueueFn({ resolve: () => {}, reject: () => {}, enqueuedAt: now });
  }

  public async waitInQueue(now: number): Promise<void> {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error("CONCURRENCY_LIMITED");
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, enqueuedAt: now });
    });
  }

  public pump(now: number, activeCount: number, onAdmitted: () => void): void {
    if (activeCount > 0) return;
    if (this.queue.length === 0) return;

    const next = this.queue.shift();
    if (!next) return;

    if (now - next.enqueuedAt > this.timeoutMs) {
      next.reject(new Error("QUEUE_TIMEOUT"));
      // Recursively pump
      this.pump(now, activeCount, onAdmitted);
      return;
    }

    onAdmitted();
    next.resolve();
  }
}
