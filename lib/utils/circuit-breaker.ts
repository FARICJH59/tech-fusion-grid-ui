/**
 * Circuit breaker implementation.
 *
 * Prevents cascading failures by stopping calls to a failing dependency once
 * the error threshold is crossed.  After a configurable cool-down window the
 * breaker moves to HALF_OPEN and allows a single probe request to determine
 * whether the dependency has recovered.
 *
 * States:
 *   CLOSED     — normal operation; errors are counted.
 *   OPEN       — all calls fail-fast; dependency is considered down.
 *   HALF_OPEN  — one probe is allowed; success → CLOSED, failure → OPEN.
 *
 * Usage:
 *   const breaker = new CircuitBreaker("redis", { failureThreshold: 5 });
 *   const result = await breaker.execute(() => client.ping());
 */

export type CircuitBreakerOptions = {
  /** Number of consecutive failures before tripping to OPEN. Default: 5 */
  failureThreshold?: number;
  /** Milliseconds to wait in OPEN state before moving to HALF_OPEN. Default: 30_000 */
  resetTimeoutMs?: number;
  /** Called whenever the state changes. */
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
};

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreakerOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker '${name}' is OPEN — calls are blocked`);
    this.name = "CircuitBreakerOpenError";
  }
}

export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;

  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.onStateChange = options.onStateChange;
  }

  get currentState(): CircuitState {
    return this.state;
  }

  /**
   * Execute `fn` through the circuit breaker.
   * Throws `CircuitBreakerOpenError` when the breaker is OPEN.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.tick();

    if (this.state === "OPEN") {
      throw new CircuitBreakerOpenError(this.name);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  /** Return a snapshot of breaker state for health reporting. */
  getSnapshot(): { name: string; state: CircuitState; consecutiveFailures: number } {
    return {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /** Manual reset — moves breaker to CLOSED regardless of current state. */
  reset(): void {
    this.transition("CLOSED");
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private tick(): void {
    if (this.state === "OPEN" && this.openedAt !== null) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.resetTimeoutMs) {
        this.transition("HALF_OPEN");
      }
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.transition("CLOSED");
    }
    this.consecutiveFailures = 0;
  }

  private onFailure(): void {
    this.consecutiveFailures++;
    if (this.state === "HALF_OPEN") {
      // Probe failed — stay OPEN
      this.openedAt = Date.now();
      this.transition("OPEN");
    } else if (this.consecutiveFailures >= this.failureThreshold) {
      this.openedAt = Date.now();
      this.transition("OPEN");
    }
  }

  private transition(next: CircuitState): void {
    if (this.state === next) return;
    const prev = this.state;
    this.state = next;
    this.onStateChange?.(this.name, prev, next);
  }
}
