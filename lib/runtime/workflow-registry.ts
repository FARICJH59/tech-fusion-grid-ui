import type { WorkflowDefinition, WorkflowId } from "@/lib/runtime/types";

export class WorkflowRegistry {
  private readonly workflows = new Map<WorkflowId, WorkflowDefinition>();

  register(def: WorkflowDefinition): void {
    if (this.workflows.has(def.id)) {
      throw new Error(`Workflow '${def.id}' is already registered`);
    }
    this.workflows.set(def.id, def);
  }

  deregister(id: WorkflowId): boolean {
    return this.workflows.delete(id);
  }

  get(id: WorkflowId): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  list(tenantId?: string): WorkflowDefinition[] {
    const values = [...this.workflows.values()];
    if (!tenantId) {
      return values;
    }
    return values.filter((workflow) => workflow.tenantId === undefined || workflow.tenantId === tenantId);
  }

  count(): number {
    return this.workflows.size;
  }
}
