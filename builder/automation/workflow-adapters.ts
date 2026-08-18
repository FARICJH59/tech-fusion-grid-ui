import type { ExecutionPlan, WorkflowCompiler } from "./workflow-compiler";
import type { HoareWorkflow } from "./hoare-workflow";

abstract class BaseAdapter implements WorkflowCompiler {
  abstract readonly name: string;
  abstract supports(target: string): boolean;

  async compile(workflow: HoareWorkflow): Promise<ExecutionPlan> {
    return {
      adapter: this.name,
      workflow,
      actions: workflow.actions.map((action) => action.id),
    };
  }
}

export class GitHubActionsWorkflowAdapter extends BaseAdapter {
  readonly name = "github-actions";
  supports(target: string): boolean {
    return target === "github-actions";
  }
}

export class GcpWorkflowAdapter extends BaseAdapter {
  readonly name = "gcp";
  supports(target: string): boolean {
    return target === "gcp";
  }
}

export class AwsWorkflowAdapter extends BaseAdapter {
  readonly name = "aws";
  supports(target: string): boolean {
    return target === "aws";
  }
}

export class AzureWorkflowAdapter extends BaseAdapter {
  readonly name = "azure";
  supports(target: string): boolean {
    return target === "azure";
  }
}

export class KubernetesWorkflowAdapter extends BaseAdapter {
  readonly name = "kubernetes";
  supports(target: string): boolean {
    return target === "kubernetes";
  }
}
