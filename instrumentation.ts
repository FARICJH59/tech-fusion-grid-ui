/**
 * Next.js instrumentation hook — runs once on server startup.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initTelemetry } = await import("@/lib/telemetry/otel");
    initTelemetry();

    const { registerShutdownHooks, onShutdown } = await import("@/lib/utils/shutdown");
    registerShutdownHooks({ timeoutMs: 10_000 });

    // Register dependency cleanup tasks
    if (process.env.REDIS_URL) {
      const { getRedis } = await import("@/lib/redis");
      onShutdown("redis", async () => {
        try {
          await getRedis().quit();
        } catch {
          // ignore errors during shutdown
        }
      });
    }

    if (process.env.MQTT_URL) {
      const { mqttClient } = await import("@/lib/mqtt");
      onShutdown("mqtt", async () => {
        try {
          mqttClient.disconnect();
        } catch {
          // ignore errors during shutdown
        }
      });
    }
  }
}
