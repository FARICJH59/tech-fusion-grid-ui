/**
 * Retry with exponential backoff and optional jitter.
 *
 * Usage:
 *   const result = await retry(() => fetchFromExternalService(), {
 *     maxAttempts: 5,
 *     baseDelayMs: 200,
 *   });
 */

export type RetryOptions = {
  /** Total number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Base delay in milliseconds before the first retry. Default: 200 */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds. Default: 30_000 */
  maxDelayMs?: number;
  /** Jitter factor (0–1). Adds up to `jitter * delay` random ms. Default: 0.15 */
  jitter?: number;
  /** Predicate to decide whether a particular error is retryable. Default: always true */
  isRetryable?: (err: unknown, attempt: number) => boolean;
  /** Called before each retry. Useful for logging. */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
};

/**
 * Execute `fn`, retrying with exponential backoff on failure.
 *
 * @param fn      - Async function to execute.
 * @param options - Retry configuration.
 * @returns The resolved value of `fn`.
 * @throws The last error after all attempts are exhausted.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 200,
    maxDelayMs = 30_000,
    jitter = 0.15,
    isRetryable = () => true,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts || !isRetryable(err, attempt)) {
        throw err;
      }

      const exponential = baseDelayMs * 2 ** (attempt - 1);
      const capped = Math.min(exponential, maxDelayMs);
      const delay = capped + Math.random() * jitter * capped;

      onRetry?.(err, attempt, Math.round(delay));

      await sleep(delay);
    }
  }

  // Unreachable — TypeScript needs this
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a retry function pre-configured with fixed options.
 */
export function createRetry(defaults: RetryOptions): <T>(fn: () => Promise<T>, overrides?: RetryOptions) => Promise<T> {
  return <T>(fn: () => Promise<T>, overrides: RetryOptions = {}) =>
    retry(fn, { ...defaults, ...overrides });
}
