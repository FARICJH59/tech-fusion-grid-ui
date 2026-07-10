/**
 * Graceful shutdown utilities.
 *
 * Registers SIGTERM / SIGINT handlers that run all registered cleanup tasks
 * in reverse order before exiting.  Gives each task a configurable timeout
 * and exits with code 0 on clean shutdown or code 1 on timeout/error.
 *
 * Usage:
 *   import { onShutdown, registerShutdownHooks } from "@/lib/utils/shutdown";
 *
 *   // Register hooks as early as possible (e.g. in instrumentation.ts)
 *   registerShutdownHooks();
 *
 *   // Register cleanup tasks from anywhere in the codebase
 *   onShutdown("redis", async () => { await redisClient.quit(); });
 *   onShutdown("mqtt",  async () => { await mqttClient.disconnect(); });
 */

type ShutdownHandler = () => Promise<void>;

type ShutdownEntry = {
  name: string;
  handler: ShutdownHandler;
};

const handlers: ShutdownEntry[] = [];
let hooksRegistered = false;

/**
 * Register a named cleanup function that runs during shutdown.
 * Handlers are executed in reverse registration order (LIFO).
 */
export function onShutdown(name: string, handler: ShutdownHandler): void {
  handlers.push({ name, handler });
}

/**
 * Register SIGTERM and SIGINT process signal handlers (idempotent).
 * Call once during application bootstrap.
 */
export function registerShutdownHooks(options: { timeoutMs?: number } = {}): void {
  if (hooksRegistered) return;
  hooksRegistered = true;

  const { timeoutMs = 10_000 } = options;

  const shutdown = async (signal: string): Promise<void> => {
    console.info(`[shutdown] ${signal} received — starting graceful shutdown`);

    const deadline = setTimeout(() => {
      console.error("[shutdown] Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, timeoutMs);

    // Run handlers in reverse order (last-registered → first-run)
    for (const entry of [...handlers].reverse()) {
      try {
        console.info(`[shutdown] Running handler: ${entry.name}`);
        await entry.handler();
      } catch (err) {
        console.error(
          `[shutdown] Handler '${entry.name}' failed:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    clearTimeout(deadline);
    console.info("[shutdown] Graceful shutdown complete");
    process.exit(0);
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT",  () => void shutdown("SIGINT"));
}

/**
 * Clear all registered handlers (useful in tests).
 */
export function clearShutdownHandlers(): void {
  handlers.length = 0;
  hooksRegistered = false;
}
