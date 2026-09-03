import type { Agent } from "../../packages/agent-sdk/src/agent";
import type { AgentExecutionContext } from "../../packages/agent-sdk/src/context";
import { ToolRegistry, type ToolExecutionRecord } from "../../packages/agent-sdk/src/tool";
import { AgentExecutionError } from "./agent-errors";
import { AGENT_RUNTIME_EVENT_NAMES, AgentRuntimeEventBus } from "./agent-events";
import { AgentSecurityRuntime } from "../security/security-runtime";
import { AgentWorkflowRuntime, type WorkflowExecutionResult } from "../workflows/workflow-runtime";
import type { TcxExecutionFenceController } from "../../lib/hoare/execution/tcx-execution-fence";

export type AgentToolCall = { toolId: string; input: unknown };
export type AgentExecutionHandler = (input: { agent: Agent; context: AgentExecutionContext; payload?: unknown }) => Promise<unknown>;
export type AgentExecutionRequest = {
  agent: Agent; tenantId: string; context: AgentExecutionContext; payload?: unknown; workflowId?: string;
  toolCalls?: AgentToolCall[]; handler?: AgentExecutionHandler; resultValidator?: (result: unknown) => boolean;
  retryPolicy?: { maxRetries?: number; backoffMs?: number };
  tcxExecution?: { transactionId: string; attemptId: string; fenceController: TcxExecutionFenceController };
};
export type AgentExecutionResult = {
  agentId: string; status: "completed" | "failed"; output?: unknown;
  toolResults: ToolExecutionRecord<unknown>[]; workflowResult?: WorkflowExecutionResult; durationMs: number; error?: string;
};
export type AgentExecutionTrace = {
  executionId: string; agentId: string; tenantId: string; status: "running" | "completed" | "failed";
  attempts: number; startedAt: string; completedAt?: string; error?: string;
};

export class AgentExecutor {
  private readonly asyncExecutions = new Map<string, Promise<AgentExecutionResult>>();
  private readonly asyncResults = new Map<string, AgentExecutionResult>();
  private readonly traces = new Map<string, AgentExecutionTrace>();
  constructor(
    readonly tools = new ToolRegistry(), private readonly security = new AgentSecurityRuntime(),
    private readonly events = new AgentRuntimeEventBus(), private readonly workflows = new AgentWorkflowRuntime(),
  ) {}
  registerTool = this.tools.register.bind(this.tools);

  async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const executionId = `${request.agent.identity.id}:${request.context.requestId}`;
    const trace: AgentExecutionTrace = { executionId, agentId: request.agent.identity.id, tenantId: request.tenantId, status: "running", attempts: 0, startedAt: new Date().toISOString() };
    this.traces.set(executionId, trace);
    const maxRetries = Math.max(0, request.retryPolicy?.maxRetries ?? 0);
    const backoffMs = Math.max(0, request.retryPolicy?.backoffMs ?? 0);
    let attempt = 0; let lastResult: AgentExecutionResult | undefined;
    while (attempt <= maxRetries) {
      trace.attempts = attempt + 1; lastResult = await this.executeAttempt(request);
      if (lastResult.status === "completed") { trace.status = "completed"; trace.completedAt = new Date().toISOString(); return lastResult; }
      attempt += 1;
      if (attempt <= maxRetries && backoffMs > 0) await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
    trace.status = "failed"; trace.completedAt = new Date().toISOString(); trace.error = lastResult?.error;
    return lastResult ?? { agentId: request.agent.identity.id, status: "failed", toolResults: [], durationMs: 0, error: "Unknown execution failure." };
  }

  executeAsync(request: AgentExecutionRequest): { executionId: string } {
    const executionId = `${request.agent.identity.id}:${request.context.requestId}`;
    const task = this.execute(request).then((result) => { this.asyncResults.set(executionId, result); this.asyncExecutions.delete(executionId); return result; });
    this.asyncExecutions.set(executionId, task); return { executionId };
  }
  async readAsyncResult(executionId: string): Promise<{ status: "running" | "completed"; result?: AgentExecutionResult; trace?: AgentExecutionTrace }> {
    if (this.asyncExecutions.has(executionId)) return { status: "running", trace: this.traces.get(executionId) };
    return { status: "completed", result: this.asyncResults.get(executionId), trace: this.traces.get(executionId) };
  }
  listTraces(agentId?: string): AgentExecutionTrace[] { const traces = [...this.traces.values()]; return agentId ? traces.filter((item) => item.agentId === agentId) : traces; }

  private assertExecutionActive(request: AgentExecutionRequest): void {
    const tcx = request.tcxExecution; if (!tcx) return;
    tcx.fenceController.assertActive(tcx.transactionId, tcx.attemptId);
  }

  private async executeAttempt(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const startedAt = Date.now(); const toolResults: ToolExecutionRecord<unknown>[] = [];
    await this.events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentExecutionStarted, { agentId: request.agent.identity.id, tenantId: request.tenantId, correlationId: request.context.correlationId, payload: { workflowId: request.workflowId, toolCalls: request.toolCalls?.map((call) => call.toolId) ?? [] } });
    try {
      this.assertExecutionActive(request);
      for (const toolCall of request.toolCalls ?? []) {
        this.assertExecutionActive(request); const tool = this.tools.get(toolCall.toolId);
        if (!tool) throw new AgentExecutionError(`Tool '${toolCall.toolId}' is not registered.`);
        for (const permission of tool.permissions) {
          this.assertExecutionActive(request);
          const authorization = await this.security.authorize({ agentId: request.agent.identity.id, tenantId: request.tenantId, action: permission.action, resource: permission.resource, context: request.context, requiredRole: permission.requiredRole, attributes: permission.attributes, riskLevel: permission.riskLevel, approvalRequired: permission.approvalRequired, budgetLimitUsd: request.context.budget?.maxCostUsd });
          this.assertExecutionActive(request); if (!authorization.allowed) throw new AgentExecutionError(authorization.reason);
        }
        this.assertExecutionActive(request); toolResults.push(await this.tools.execute(toolCall.toolId, toolCall.input, request.context)); this.assertExecutionActive(request);
      }
      const workflow = request.workflowId ? request.agent.workflows.find((candidate) => candidate.id === request.workflowId) : undefined;
      const workflowResult = workflow ? await this.workflows.execute({
        workflow, agentId: request.agent.identity.id, tenantId: request.tenantId, input: { payload: request.payload },
        executeStep: async (step) => {
          this.assertExecutionActive(request);
          if (step.type === "tool" && step.toolId) { const result = await this.tools.execute(step.toolId, request.payload, request.context); this.assertExecutionActive(request); toolResults.push(result as ToolExecutionRecord<unknown>); return result.output; }
          return { step: step.id, payload: request.payload };
        },
        approvalGate: async (step) => {
          this.assertExecutionActive(request);
          const auth = await this.security.authorize({ agentId: request.agent.identity.id, tenantId: request.tenantId, action: `workflow:${step.id}`, resource: workflow.id, context: request.context, requiredRole: "operator", approvalRequired: true });
          this.assertExecutionActive(request); return auth.allowed;
        },
      }) : undefined;
      this.assertExecutionActive(request);
      const output = request.handler ? await request.handler({ agent: request.agent, context: request.context, payload: request.payload }) : workflowResult ?? { ok: true };
      this.assertExecutionActive(request);
      if (request.resultValidator && !request.resultValidator(output)) throw new AgentExecutionError("Agent result validation failed.");
      const result: AgentExecutionResult = { agentId: request.agent.identity.id, status: workflowResult?.status === "failed" ? "failed" : "completed", output, workflowResult, toolResults, durationMs: Date.now() - startedAt };
      if (result.status === "failed") throw new AgentExecutionError("Workflow execution failed.", { workflowId: workflowResult?.workflowId });
      await this.events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentExecutionCompleted, { agentId: request.agent.identity.id, tenantId: request.tenantId, correlationId: request.context.correlationId, payload: { durationMs: result.durationMs, toolCalls: toolResults.length } });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentExecutionFailed, { agentId: request.agent.identity.id, tenantId: request.tenantId, correlationId: request.context.correlationId, payload: { error: message } });
      return { agentId: request.agent.identity.id, status: "failed", toolResults, durationMs: Date.now() - startedAt, error: message };
    }
  }
}
