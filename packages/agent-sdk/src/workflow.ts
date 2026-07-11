export const WORKFLOW_STEP_TYPES = ["task", "tool", "agent", "approval", "event"] as const;
export const WORKFLOW_EVENT_TYPES = [
  "workflow.started",
  "workflow.completed",
  "workflow.failed",
  "step.started",
  "step.completed",
  "approval.requested",
  "event.emitted",
] as const;

export type WorkflowStepType = (typeof WORKFLOW_STEP_TYPES)[number];
export type WorkflowEventType = (typeof WORKFLOW_EVENT_TYPES)[number];

export type WorkflowStep = {
  id: string;
  name: string;
  type: WorkflowStepType;
  description?: string;
  dependsOn?: string[];
  toolId?: string;
  agentId?: string;
  requiresApproval?: boolean;
  emits?: string[];
  metadata?: Record<string, unknown>;
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  version: string;
  description: string;
  collaborationMode: "single-agent" | "multi-agent";
  approvalMode: "none" | "manual" | "policy-based";
  eventStrategy: "emit-per-step" | "summary-only";
  steps: WorkflowStep[];
};

export type WorkflowEvent = {
  id: string;
  workflowId: string;
  stepId?: string;
  type: WorkflowEventType;
  timestamp: string;
  payload: Record<string, unknown>;
};

export type WorkflowValidationResult = {
  valid: boolean;
  errors: string[];
};

export class WorkflowRegistry {
  private readonly workflows = new Map<string, WorkflowDefinition>();

  register(workflow: WorkflowDefinition): WorkflowValidationResult {
    const validation = this.validate(workflow);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }
    this.workflows.set(workflow.id, workflow);
    return validation;
  }

  get(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  list(): WorkflowDefinition[] {
    return [...this.workflows.values()];
  }

  validate(workflow: WorkflowDefinition): WorkflowValidationResult {
    const errors: string[] = [];
    const stepIds = new Set<string>();

    if (workflow.steps.length === 0) {
      errors.push("Workflow must define at least one step.");
    }

    for (const step of workflow.steps) {
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate workflow step '${step.id}'.`);
      }
      stepIds.add(step.id);

      if (step.type === "tool" && !step.toolId) {
        errors.push(`Workflow step '${step.id}' must reference a tool.`);
      }
      if (step.type === "agent" && !step.agentId) {
        errors.push(`Workflow step '${step.id}' must reference an agent.`);
      }
      if (step.requiresApproval && workflow.approvalMode === "none") {
        errors.push(`Workflow step '${step.id}' cannot require approval when approvalMode is 'none'.`);
      }
    }

    for (const step of workflow.steps) {
      for (const dependency of step.dependsOn ?? []) {
        if (!stepIds.has(dependency)) {
          errors.push(`Workflow step '${step.id}' depends on unknown step '${dependency}'.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
