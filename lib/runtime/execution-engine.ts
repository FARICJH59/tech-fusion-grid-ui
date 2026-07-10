import { randomUUID } from "node:crypto";
import { createRuntimeContext, type RuntimeContext } from "@/lib/runtime/context";
import type { IEventBus, RuntimeEventType } from "@/lib/runtime/event-bus";
import { appMetrics } from "@/lib/telemetry/metrics";
import type { AgentRegistry } from "@/lib/runtime/agent-registry";
import type { ExecutionQueue } from "@/lib/runtime/execution-queue";
import type { ToolRegistry } from "@/lib/runtime/tool-registry";
import type { WorkflowRegistry } from "@/lib/runtime/workflow-registry";
import type {
  AgentInput,
  ExecutionRequest,
  ExecutionResult,
  ExecutionStatus,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStatus,
  WorkflowStep,
  WorkflowStepRun,
} from "@/lib/runtime/types";
import { retry, type RetryOptions } from "@/lib/utils/retry";
import { withIdempotency } from "@/lib/utils/idempotency";
import { deadLetter } from "@/lib/utils/dead-letter";

export class ExecutionEngine {
  /** Bounded in-memory idempotency store (FIFO eviction) used when Redis is absent. */
  private static readonly MAX_IDEMPOTENT_ENTRIES = 500;
  private readonly idempotentResults = new Map<string, ExecutionResult>();

  constructor(
    private readonly registries: { agents: AgentRegistry; tools: ToolRegistry; workflows: WorkflowRegistry },
    private readonly bus: IEventBus,
    private readonly queue: ExecutionQueue,
  ) {}

  async execute(req: ExecutionRequest, ctx: RuntimeContext): Promise<ExecutionResult> {
    const request: ExecutionRequest = { ...req, id: req.id ?? randomUUID() };
    const startedAt = new Date().toISOString();

    this.emitEvent("execution.started", request.tenantId, ctx.correlationId, {
      executionId: request.id ?? "unknown",
      type: request.type,
      targetId: request.targetId,
    });

    let attempts = 0;

    const invoke = async (): Promise<ExecutionResult> => {
      attempts += 1;
      const output = await this.runTarget(request, ctx);
      const completedAt = new Date().toISOString();
      return {
        id: request.id ?? randomUUID(),
        status: "completed",
        output,
        startedAt,
        completedAt,
        durationMs: Date.parse(completedAt) - Date.parse(startedAt),
        attempts,
      };
    };

    try {
      const runner = async (): Promise<ExecutionResult> => retry(
        async () => this.runWithTimeout(invoke, request.timeoutMs),
        {
          maxAttempts: (request.retries ?? 0) + 1,
          baseDelayMs: 200,
          onRetry: (error, attempt, delayMs) => {
            ctx.logger.warn("[runtime/execution-engine] Retrying execution", {
              executionId: request.id,
              attempt,
              delayMs,
              error: error instanceof Error ? error.message : String(error),
            });
          },
          isRetryable: (error) => !this.isNotFoundError(error),
        },
      );

      // When Redis is available: delegate to the TTL-bounded Redis-backed store.
      // When Redis is absent: use a bounded in-memory map (FIFO eviction at 500
      // entries) so idempotency still works in single-process / test environments.
      // The composite key uses \0 (null byte) as delimiter to prevent collision
      // if tenantId or idempotencyKey contains the separator character.
      const result = request.idempotencyKey
        ? process.env.REDIS_URL
          ? (await withIdempotency(request.idempotencyKey, request.tenantId, runner)).data
          : await this.withInMemoryIdempotency(
              `${request.tenantId}\0${request.idempotencyKey}`,
              runner,
            )
        : await runner();

      this.emitEvent("execution.completed", request.tenantId, ctx.correlationId, {
        executionId: result.id,
        targetId: request.targetId,
        attempts: result.attempts,
      });

      return result;
    } catch (error) {
      const completedAt = new Date().toISOString();
      const status = this.toFailureStatus(error);
      const result: ExecutionResult = {
        id: request.id ?? randomUUID(),
        status,
        error: error instanceof Error ? error.message : String(error),
        startedAt,
        completedAt,
        durationMs: Date.parse(completedAt) - Date.parse(startedAt),
        attempts,
      };

      this.emitEvent("execution.failed", request.tenantId, ctx.correlationId, {
        executionId: result.id,
        targetId: request.targetId,
        error: result.error ?? "Unknown execution error",
      });

      await deadLetter({
        queue: "runtime.executions",
        tenantId: request.tenantId,
        payload: request,
        error,
        source: "execution-engine",
        idempotencyKey: request.idempotencyKey,
      });

      return result;
    }
  }

  async executeWorkflow(def: WorkflowDefinition, tenantId: string, correlationId: string): Promise<WorkflowRun> {
    const startedAt = new Date().toISOString();
    const run: WorkflowRun = {
      runId: randomUUID(),
      workflowId: def.id,
      tenantId,
      status: "running",
      startedAt,
      steps: [],
    };

    const workflowContext = createRuntimeContext(tenantId, correlationId, {
      getAgent: (id) => this.registries.agents.get(id),
      getTool: (id, version) => this.registries.tools.get(id, version),
      getWorkflow: (id) => this.registries.workflows.get(id),
      emit: (event) => this.bus.emit(event),
    });

    let halted = false;

    for (const step of def.steps) {
      const stepRun = await this.executeWorkflowStep(step, workflowContext);
      run.steps.push(stepRun);

      if (stepRun.status === "failed" || stepRun.status === "timeout") {
        const policy = step.onError ?? "stop";
        if (policy === "dead-letter") {
          await deadLetter({
            queue: "runtime.workflow-steps",
            tenantId,
            payload: {
              workflowId: def.id,
              stepId: step.id,
              stepName: step.name,
            },
            error: stepRun.error ?? "Unknown workflow step error",
            source: "execution-engine.workflow",
          });
        }

        if (policy === "stop") {
          halted = true;
          run.status = stepRun.status;
          break;
        }
      }
    }

    run.status = halted ? run.status : "completed";
    run.completedAt = new Date().toISOString();

    this.emitEvent("workflow.completed", tenantId, correlationId, {
      runId: run.runId,
      workflowId: def.id,
      status: run.status,
      steps: run.steps.length,
    });

    return run;
  }

  async processNext(ctx: RuntimeContext): Promise<ExecutionResult | null> {
    const next = this.queue.dequeue();
    if (!next) {
      return null;
    }
    return this.execute(next, ctx);
  }

  private async runTarget(req: ExecutionRequest, ctx: RuntimeContext): Promise<unknown> {
    if (req.type === "agent") {
      const agent = this.registries.agents.get(req.targetId);
      if (!agent) {
        throw new Error(`Agent '${req.targetId}' not found`);
      }
      return agent.execute(req.input as AgentInput, ctx);
    }

    if (req.type === "tool") {
      const tool = this.registries.tools.get(req.targetId, req.targetVersion);
      if (!tool) {
        throw new Error(`Tool '${req.targetId}${req.targetVersion ? `@${req.targetVersion}` : ""}' not found`);
      }
      const output = await tool.execute(req.input, ctx);
      this.emitEvent("tool.executed", req.tenantId, ctx.correlationId, {
        toolId: tool.id,
        toolVersion: tool.version,
      });
      return output;
    }

    const workflow = this.registries.workflows.get(req.targetId);
    if (!workflow) {
      throw new Error(`Workflow '${req.targetId}' not found`);
    }
    return this.executeWorkflow(workflow, req.tenantId, ctx.correlationId);
  }

  private async executeWorkflowStep(step: WorkflowStep, ctx: RuntimeContext): Promise<WorkflowStepRun> {
    const startedAt = new Date().toISOString();
    const tool = this.registries.tools.get(step.toolId, step.toolVersion);

    if (!tool) {
      return {
        stepId: step.id,
        status: "failed",
        startedAt,
        completedAt: new Date().toISOString(),
        error: `Tool '${step.toolId}${step.toolVersion ? `@${step.toolVersion}` : ""}' not found`,
      };
    }

    try {
      const output = await retry(
        async () => this.runWithTimeout(() => tool.execute(step.input ?? {}, ctx), step.timeoutMs),
        this.normalizeRetryOptions(step.retryOptions),
      );

      this.emitEvent("tool.executed", ctx.tenantId, ctx.correlationId, {
        toolId: tool.id,
        toolVersion: tool.version,
        stepId: step.id,
      });

      return {
        stepId: step.id,
        status: "completed",
        startedAt,
        completedAt: new Date().toISOString(),
        output,
      };
    } catch (error) {
      return {
        stepId: step.id,
        status: this.toWorkflowFailureStatus(error),
        startedAt,
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private normalizeRetryOptions(options?: RetryOptions): RetryOptions {
    return {
      maxAttempts: options?.maxAttempts ?? 1,
      baseDelayMs: options?.baseDelayMs ?? 200,
      maxDelayMs: options?.maxDelayMs,
      jitter: options?.jitter,
      isRetryable: options?.isRetryable,
      onRetry: options?.onRetry,
    };
  }

  private emitEvent(
    type: RuntimeEventType,
    tenantId: string,
    correlationId: string | undefined,
    payload: Record<string, unknown>,
  ): void {
    this.bus.emit({
      type,
      tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      payload,
    });
    appMetrics.incrementExecutionEvent({ type, tenantId });
  }

  private async runWithTimeout<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) {
      return fn();
    }

    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private isNotFoundError(error: unknown): boolean {
    return error instanceof Error && /not found/i.test(error.message);
  }

  private toFailureStatus(error: unknown): ExecutionStatus {
    return error instanceof Error && /timed out/i.test(error.message) ? "timeout" : "failed";
  }

  private toWorkflowFailureStatus(error: unknown): WorkflowStatus {
    return error instanceof Error && /timed out/i.test(error.message) ? "timeout" : "failed";
  }

  /**
   * In-memory idempotency guard used when Redis is absent.
   * Bounded to MAX_IDEMPOTENT_ENTRIES entries; evicts the oldest entry (FIFO)
   * when capacity is reached — prevents unbounded memory growth.
   */
  private async withInMemoryIdempotency(
    compositeKey: string,
    action: () => Promise<ExecutionResult>,
  ): Promise<ExecutionResult> {
    const cached = this.idempotentResults.get(compositeKey);
    if (cached) return cached;

    const result = await action();

    // FIFO eviction at capacity
    if (this.idempotentResults.size >= ExecutionEngine.MAX_IDEMPOTENT_ENTRIES) {
      const firstKey = this.idempotentResults.keys().next().value;
      if (firstKey !== undefined) {
        this.idempotentResults.delete(firstKey);
      }
    }
    this.idempotentResults.set(compositeKey, result);
    return result;
  }
}
