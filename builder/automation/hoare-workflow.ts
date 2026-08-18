export type WorkflowEnvironment = "development" | "staging" | "production";

export type WorkflowTrigger =
  | { type: "customer.intent"; intent: string }
  | { type: "schedule"; expression: string }
  | { type: "event"; name: string };

export interface WorkflowAction {
  id: string;
  action: string;
  version: string;
  with?: Readonly<Record<string, unknown>>;
  needs?: readonly string[];
  risk?: "low" | "medium" | "high" | "critical";
}

export interface HoareWorkflow {
  name: string;
  version: string;
  description?: string;
  trigger: WorkflowTrigger;
  inputs?: Readonly<Record<string, unknown>>;
  environment: WorkflowEnvironment;
  policy: string;
  identity?: string;
  executionTarget?: string;
  actions: readonly WorkflowAction[];
  concurrency?: {
    key: string;
    cancelInProgress?: boolean;
  };
  approvals?: readonly string[];
  verification?: readonly string[];
  rollback?: string;
  observability?: readonly string[];
}

export function validateHoareWorkflow(workflow: HoareWorkflow): void {
  if (!workflow.name || !workflow.version) throw new Error("WORKFLOW_ID_REQUIRED");
  if (!workflow.policy) throw new Error("WORKFLOW_POLICY_REQUIRED");
  if (!workflow.actions.length) throw new Error("WORKFLOW_ACTIONS_REQUIRED");

  const ids = new Set<string>();
  for (const action of workflow.actions) {
    if (!action.id || !action.action || !action.version) {
      throw new Error("WORKFLOW_ACTION_CONTRACT_INVALID");
    }
    if (ids.has(action.id)) throw new Error(`WORKFLOW_DUPLICATE_ACTION:${action.id}`);
    ids.add(action.id);
  }

  for (const action of workflow.actions) {
    for (const dependency of action.needs ?? []) {
      if (!ids.has(dependency)) throw new Error(`WORKFLOW_UNKNOWN_DEPENDENCY:${dependency}`);
    }
  }
}

/**
 * Native HOARE workflow model. Execution adapters translate this contract into
 * GitHub Actions, direct cloud APIs, Kubernetes jobs, private runners, or edge execution.
 */
export class HoareWorkflowRegistry {
  private readonly workflows = new Map<string, HoareWorkflow>();

  register(workflow: HoareWorkflow): this {
    validateHoareWorkflow(workflow);
    const key = `${workflow.name}@${workflow.version}`;
    if (this.workflows.has(key)) throw new Error(`WORKFLOW_ALREADY_REGISTERED:${key}`);
    this.workflows.set(key, workflow);
    return this;
  }

  get(name: string, version: string): HoareWorkflow {
    const workflow = this.workflows.get(`${name}@${version}`);
    if (!workflow) throw new Error(`WORKFLOW_NOT_REGISTERED:${name}@${version}`);
    return workflow;
  }
}
