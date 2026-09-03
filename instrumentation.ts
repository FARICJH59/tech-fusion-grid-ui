/**
 * Next.js instrumentation hook — runs once on server startup.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

let executionWorkerStarted = false;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { initTelemetry } = await import("@/lib/telemetry/otel");
  initTelemetry();

  // Keep the long-lived execution worker explicitly deployment-controlled.
  // Serverless deployments can leave this disabled and run the same worker
  // as a dedicated process instead.
  if (process.env.HOARE_EXECUTION_WORKER_ENABLED !== "true" || executionWorkerStarted) return;
  executionWorkerStarted = true;

  const { streamProcessor } = await import("@/lib/events/stream-processor");
  const { executionTransactionDispatcher } = await import("@/lib/hoare/execution/transaction-dispatcher");
  const { ExecutionEvidenceTransport } = await import("@/lib/hoare/execution/evidence-transport");
  const { RedisExecutionTransactionRepository } = await import("@/lib/hoare/execution/redis-transaction-repository");

  const repository = new RedisExecutionTransactionRepository();
  executionTransactionDispatcher.register();
  const evidenceTransport = new ExecutionEvidenceTransport(repository);
  evidenceTransport.start();
  await streamProcessor.start({ consumerGroup: process.env.HOARE_EXECUTION_CONSUMER_GROUP ?? "ops" });

  console.info("[HOARE] execution transaction worker started");
}
