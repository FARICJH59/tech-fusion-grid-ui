import type { Agent } from "../../packages/agent-sdk/src/agent";
import type { AgentExecutionContext } from "../../packages/agent-sdk/src/context";
import { ToolRegistry, type ToolExecutionRecord } from "../../packages/agent-sdk/src/tool";
import { AgentExecutionError } from "./agent-errors";
import { AGENT_RUNTIME_EVENT_NAMES, AgentRuntimeEventBus } from "./agent-events";
import { AgentSecurityRuntime } from "../security/security-runtime";
import { AgentWorkflowRuntime, type WorkflowExecutionResult } from "../workflows/workflow-runtime";

export type AgentToolCall = {
  toolId: string;
  input: unknown;
};

export type AgentExecutionHandler = (input: {
  agent: Agent;
  context: AgentExecutionContext;
  payload?: unknown;
}) => Promise<unknown>;

export type AgentExecutionRequest = {
  agent: Agent;
  tenantId: string;
  context: AgentExecutionContext;
  payload?: unknown;
  workflowId?: string;
  toolCalls?: AgentToolCall[];
  handler?: AgentExecutionHandler;
  resultValidator?: (result: unknown) => boolean;
};

export type AgentExecutionResult = {
  agentId: string;
  status: "completed" | "failed";
  output?: unknown;
  toolResults: ToolExecutionRecord<unknown>[];
  workflowResult?: WorkflowExecutionResult;
  durationMs: number;
  error?: string;
};

export class AgentExecutor {
  constructor(
    readonly tools = new ToolRegistry(),
    private readonly security = new AgentSecurityRuntime(),
    private readonly events = new AgentRuntimeEventBus(),
    private readonly workflows = new AgentWorkflowRuntime(),
  ) {}

  registerTool = this.tools.register.bind(this.tools);

  async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const startedAt = Date.now();
    const toolResults: ToolExecutionRecord<unknown>[] = [];
    await this.events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentExecutionStarted, {
      agentId: request.agent.identity.id,
      tenantId: request.tenantId,
      correlationId: request.context.correlationId,
      payload: {
        workflowId: request.workflowId,
        toolCalls: request.toolCalls?.map((call) => call.toolId) ?? [],
      },
    });

    try {
      for (const toolCall of request.toolCalls ?? []) {
        const tool = this.tools.get(toolCall.toolId);
        if (!tool) {
          throw new AgentExecutionError(`Tool '${toolCall.toolId}' is not registered.`);
        }

        for (const permission of tool.permissions) {
          const authorization = await this.security.authorize({
            agentId: request.agent.identity.id,
            tenantId: request.tenantId,
            action: permission.action,
            resource: permission.resource,
            context: request.context,
            requiredRole: permission.requiredRole,
            attributes: permission.attributes,
            riskLevel: permission.riskLevel,
            approvalRequired: permission.approvalRequired,
            budgetLimitUsd: request.context.budget?.maxCostUsd,
          });
          if (!authorization.allowed) {
            throw new AgentExecutionError(authorization.reason);
          }
        }

        toolResults.push(await this.tools.execute(toolCall.toolId, toolCall.input, request.context));
      }

      const workflow = request.workflowId
        ? request.agent.workflows.find((candidate) => candidate.id === request.workflowId)
        : undefined;

      const workflowResult = workflow
        ? await this.workflows.execute({
            workflow,
            agentId: request.agent.identity.id,
            tenantId: request.tenantId,
            input: { payload: request.payload },
            executeStep: async (step) => {
              if (step.type === "tool" && step.toolId) {
                const result = await this.tools.execute(step.toolId, request.payload, request.context);
                toolResults.push(result as ToolExecutionRecord<unknown>);
                return result.output;
              }
              return { step: step.id, payload: request.payload };
            },
            approvalGate: async (step) => {
              const auth = await this.security.authorize({
                agentId: request.agent.identity.id,
                tenantId: request.tenantId,
                action: `workflow:${step.id}`,
                resource: workflow.id,
                context: request.context,
                requiredRole: "operator",
                approvalRequired: true,
              });
              return auth.allowed;
            },
          })
        : undefined;

      const output = request.handler
        ? await request.handler({ agent: request.agent, context: request.context, payload: request.payload })
        : workflowResult ?? { ok: true };

      if (request.resultValidator && !request.resultValidator(output)) {
        throw new AgentExecutionError("Agent result validation failed.");
      }

      const result: AgentExecutionResult = {
        agentId: request.agent.identity.id,
        status: workflowResult?.status === "failed" ? "failed" : "completed",
        output,
        workflowResult,
        toolResults,
        durationMs: Date.now() - startedAt,
      };

      if (result.status === "failed") {
        throw new AgentExecutionError("Workflow execution failed.", { workflowId: workflowResult?.workflowId });
      }

      await this.events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentExecutionCompleted, {
        agentId: request.agent.identity.id,
        tenantId: request.tenantId,
        correlationId: request.context.correlationId,
        payload: {
          durationMs: result.durationMs,
          toolCalls: toolResults.length,
        },
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentExecutionFailed, {
        agentId: request.agent.identity.id,
        tenantId: request.tenantId,
        correlationId: request.context.correlationId,
        payload: { error: message },
      });
      return {
        agentId: request.agent.identity.id,
        status: "failed",
        toolResults,
        durationMs: Date.now() - startedAt,
        error: message,
      };
    }
  }
}
