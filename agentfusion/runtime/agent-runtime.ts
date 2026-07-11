import type { Agent } from "../../packages/agent-sdk/src/agent";
import type { AgentExecutionContext } from "../../packages/agent-sdk/src/context";
import { AgentEvaluationRuntime } from "../evaluation/evaluation-runtime";
import { AgentLifecycleManager } from "../lifecycle/agent-lifecycle";
import { AgentMemoryRuntime } from "../memory/memory-runtime";
import { AgentFusionRegistry } from "../registry/agent-registry";
import { AgentSecurityRuntime } from "../security/security-runtime";
import { createAgentExecutionContext, type AgentContextInput } from "./agent-context";
import { AgentExecutor, type AgentExecutionHandler, type AgentExecutionRequest } from "./agent-executor";
import { AgentValidationError } from "./agent-errors";
import { AgentRuntimeEventBus } from "./agent-events";

export type AgentLoadRequest = {
  tenantId: string;
  agent: Agent;
  context: AgentExecutionContext;
  metadata?: Record<string, unknown>;
};

export type AgentRuntimeStatus = {
  activeAgents: number;
  registeredAgents: number;
  pausedAgents: number;
  disabledAgents: number;
  approvalsPending: number;
  executions: number;
  failures: number;
  averageLatencyMs: number;
  evaluationScores: { agentId: string; qualityScore: number }[];
  resourceUsage: { agentId: string; tokenUsage: number }[];
};

export class AgentRuntime {
  private readonly executions: {
    agentId: string;
    tenantId: string;
    success: boolean;
    durationMs: number;
    tokenUsage: number;
  }[] = [];
  private readonly handlers = new Map<string, AgentExecutionHandler>();

  constructor(
    readonly registry = new AgentFusionRegistry(),
    readonly events = new AgentRuntimeEventBus(),
    readonly security = new AgentSecurityRuntime(undefined, undefined, undefined),
    readonly lifecycle = new AgentLifecycleManager(registry, security, events),
    readonly memory = new AgentMemoryRuntime(),
    readonly evaluation = new AgentEvaluationRuntime(),
    readonly executor = new AgentExecutor(undefined, security, events),
  ) {}

  async loadAgent(request: AgentLoadRequest) {
    return this.lifecycle.registerAgent(request.agent, request.tenantId, request.context);
  }

  async validateAgent(agent: Agent, tenantId: string, context: AgentExecutionContext) {
    const validation = this.registry.validate(agent);
    if (!validation.valid) {
      throw new AgentValidationError(validation.errors.join("; "));
    }
    return this.lifecycle.validateAgent(agent.identity.id, tenantId, context, agent.identity.version);
  }

  registerExecutionHandler(agentId: string, handler: AgentExecutionHandler): void {
    this.handlers.set(agentId, handler);
  }

  createContext(agent: Agent, input: AgentContextInput) {
    return createAgentExecutionContext(agent, input);
  }

  async executeAgent(
    request: Omit<AgentExecutionRequest, "agent" | "handler"> & { agentId: string; version?: string },
  ) {
    const agent = this.registry.getAgent(request.tenantId, request.agentId, request.version);
    if (!agent) {
      throw new AgentValidationError(`Unknown agent '${request.agentId}'.`);
    }

    const handler = this.handlers.get(request.agentId);
    const result = await this.executor.execute({
      ...request,
      agent,
      handler,
    });

    const tokenUsage = Number(request.context.metadata?.tokenUsage ?? 0);
    this.executions.unshift({
      agentId: request.agentId,
      tenantId: request.tenantId,
      success: result.status === "completed",
      durationMs: result.durationMs,
      tokenUsage,
    });

    this.evaluation.recordExecution({
      agentId: request.agentId,
      success: result.status === "completed",
      latencyMs: result.durationMs,
      toolCalls: result.toolResults.length,
      toolFailures: result.status === "completed" ? 0 : 1,
      tokenUsage,
      costUsd: Number(request.context.metadata?.costUsd ?? 0),
    });

    await this.memory.writeAgentHistory({
      key: `${request.agentId}:${request.context.requestId}`,
      value: result,
      tenantId: request.tenantId,
      agentId: request.agentId,
      sessionId: request.context.sessionId,
      tags: [result.status],
      updatedAt: new Date().toISOString(),
    });

    return result;
  }

  status(tenantId?: string): AgentRuntimeStatus {
    const records = this.registry.list(tenantId);
    const executionSlice = tenantId ? this.executions.filter((item) => item.tenantId === tenantId) : this.executions;
    const averageLatencyMs = executionSlice.length === 0
      ? 0
      : executionSlice.reduce((sum, item) => sum + item.durationMs, 0) / executionSlice.length;

    return {
      activeAgents: records.filter((record) => record.status === "ACTIVE").length,
      registeredAgents: records.length,
      pausedAgents: records.filter((record) => record.status === "PAUSED").length,
      disabledAgents: records.filter((record) => record.status === "DISABLED").length,
      approvalsPending: this.security.listAudit(tenantId).filter((entry) => entry.decision === "require-approval").length,
      executions: executionSlice.length,
      failures: executionSlice.filter((item) => !item.success).length,
      averageLatencyMs,
      evaluationScores: records
        .map((record) => this.evaluation.performanceHistory(record.agentId))
        .filter((item) => item.executions > 0)
        .map((item) => ({ agentId: item.agentId, qualityScore: item.qualityScore })),
      resourceUsage: records.map((record) => ({
        agentId: record.agentId,
        tokenUsage: executionSlice
          .filter((item) => item.agentId === record.agentId)
          .reduce((sum, item) => sum + item.tokenUsage, 0),
      })),
    };
  }
}
