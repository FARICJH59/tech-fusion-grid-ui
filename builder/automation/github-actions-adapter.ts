export interface WorkflowDispatchRequest {
  workflow: string;
  ref: string;
  inputs?: Readonly<Record<string, string>>;
  tenantId: string;
  correlationId: string;
}

export interface WorkflowRun {
  id: number | string;
  workflow: string;
  status: "queued" | "running" | "completed";
  conclusion?: "success" | "failure" | "cancelled" | "neutral";
}

export interface GitHubActionsClient {
  dispatch(request: WorkflowDispatchRequest): Promise<WorkflowRun>;
  status(runId: number | string): Promise<WorkflowRun>;
}

/**
 * GitHub Actions is an execution adapter, not HOARE's control plane.
 * Authorization, environment policy, identity, provenance and release gates
 * remain outside this adapter.
 */
export class GitHubActionsAdapter {
  constructor(private readonly client: GitHubActionsClient) {}

  dispatch(request: WorkflowDispatchRequest): Promise<WorkflowRun> {
    if (!request.tenantId || !request.correlationId) throw new Error("WORKFLOW_CONTEXT_REQUIRED");
    if (!request.workflow || !request.ref) throw new Error("WORKFLOW_TARGET_REQUIRED");
    return this.client.dispatch(request);
  }

  status(runId: number | string): Promise<WorkflowRun> {
    return this.client.status(runId);
  }
}
