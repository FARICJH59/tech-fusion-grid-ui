import type { WorkflowDefinition, WorkflowStep } from "../../packages/agent-sdk/src/workflow";
import { AgentWorkflowError } from "../runtime/agent-errors";
import { AGENT_RUNTIME_EVENT_NAMES, AgentRuntimeEventBus } from "../runtime/agent-events";

export type WorkflowExecutionRequest = {
  workflow: WorkflowDefinition;
  agentId: string;
  tenantId: string;
  input?: Record<string, unknown>;
  executeStep: (step: WorkflowStep, state: Record<string, unknown>) => Promise<unknown>;
  approvalGate?: (step: WorkflowStep) => Promise<boolean>;
};

export type WorkflowStepResult = {
  stepId: string;
  status: "completed" | "skipped" | "failed";
  output?: unknown;
  error?: string;
};

export type WorkflowExecutionResult = {
  workflowId: string;
  status: "completed" | "failed";
  steps: WorkflowStepResult[];
};

export class AgentWorkflowRuntime {
  constructor(private readonly events = new AgentRuntimeEventBus()) {}

  async execute(request: WorkflowExecutionRequest): Promise<WorkflowExecutionResult> {
    const steps = request.workflow.steps;
    const state: Record<string, unknown> = { ...(request.input ?? {}) };
    const completed = new Set<string>();
    const results: WorkflowStepResult[] = [];
    const pending = new Map(steps.map((step) => [step.id, step]));

    while (pending.size > 0) {
      const ready = [...pending.values()].filter((step) => (step.dependsOn ?? []).every((dependency) => completed.has(dependency)));
      if (ready.length === 0) {
        throw new AgentWorkflowError(`Workflow '${request.workflow.id}' is deadlocked.`, { workflowId: request.workflow.id });
      }

      const groups = new Map<string, WorkflowStep[]>();
      for (const step of ready) {
        const group = String(step.metadata?.parallelGroup ?? step.id);
        groups.set(group, [...(groups.get(group) ?? []), step]);
      }

      for (const group of groups.values()) {
        const executed = await Promise.all(group.map((step) => this.executeStep(step, request, state)));
        for (const stepResult of executed) {
          results.push(stepResult);
          pending.delete(stepResult.stepId);
          if (stepResult.status === "completed" || stepResult.status === "skipped") {
            completed.add(stepResult.stepId);
            state[stepResult.stepId] = stepResult.output ?? stepResult.status;
            continue;
          }

          const failedStep = steps.find((step) => step.id === stepResult.stepId);
          const recoveryStepId = failedStep?.metadata?.recoveryStepId;
          if (typeof recoveryStepId === "string") {
            const recoveryStep = steps.find((step) => step.id === recoveryStepId);
            if (recoveryStep) {
              const recoveryResult = await this.executeStep(recoveryStep, request, state);
              results.push(recoveryResult);
              completed.add(recoveryResult.stepId);
              pending.delete(recoveryResult.stepId);
            }
          }

          return {
            workflowId: request.workflow.id,
            status: "failed",
            steps: results,
          };
        }
      }
    }

    return {
      workflowId: request.workflow.id,
      status: "completed",
      steps: results,
    };
  }

  private async executeStep(
    step: WorkflowStep,
    request: WorkflowExecutionRequest,
    state: Record<string, unknown>,
  ): Promise<WorkflowStepResult> {
    const conditionKey = step.metadata?.conditionKey;
    const conditionValue = step.metadata?.conditionValue;
    if (typeof conditionKey === "string" && state[conditionKey] !== conditionValue) {
      return { stepId: step.id, status: "skipped", output: "condition-not-met" };
    }

    if (step.requiresApproval) {
      const approved = await (request.approvalGate?.(step) ?? Promise.resolve(false));
      if (!approved) {
        await this.events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentApprovalRequired, {
          agentId: request.agentId,
          tenantId: request.tenantId,
          payload: { workflowId: request.workflow.id, stepId: step.id },
        });
        return { stepId: step.id, status: "failed", error: "approval-required" };
      }
    }

    try {
      const output = step.type === "event" ? { emitted: step.emits ?? [] } : await request.executeStep(step, state);
      return { stepId: step.id, status: "completed", output };
    } catch (error) {
      return {
        stepId: step.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
