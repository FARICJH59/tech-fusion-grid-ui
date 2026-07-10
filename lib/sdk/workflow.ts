import { BaseSdkClient } from "@/lib/sdk/base";
import type { SdkConfig, SdkResponse } from "@/lib/sdk/types";
import type { WorkflowDefinition, WorkflowRun } from "@/lib/runtime/types";

export class HoareWorkflowClient extends BaseSdkClient {
  constructor(config: SdkConfig) {
    super(config);
  }

  createWorkflow(workflow: WorkflowDefinition): Promise<SdkResponse<WorkflowDefinition>> {
    return this.post<WorkflowDefinition>("workflows", workflow);
  }

  runWorkflow(workflowId: string, input?: Record<string, unknown>): Promise<SdkResponse<WorkflowRun>> {
    return this.post<WorkflowRun>(`workflows/${encodeURIComponent(workflowId)}/runs`, input ?? {});
  }

  getWorkflowRun(runId: string): Promise<SdkResponse<WorkflowRun>> {
    return this.get<WorkflowRun>(`workflows/runs/${encodeURIComponent(runId)}`);
  }

  listWorkflowRuns(workflowId?: string): Promise<SdkResponse<WorkflowRun[]>> {
    const suffix = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : "";
    return this.get<WorkflowRun[]>(`workflows/runs${suffix}`);
  }

  cancelWorkflowRun(runId: string): Promise<SdkResponse<{ cancelled: boolean }>> {
    return this.delete<{ cancelled: boolean }>(`workflows/runs/${encodeURIComponent(runId)}`);
  }
}
