import type { ApplicationResource, InfrastructureNode, TenantResource } from "@/lib/hoare/control-plane/types";
import type { BuilderPlan } from "./types";
import type { BuildOperation } from "./executor";

export interface BuilderResourceStore {
  getTenant(id: string): Promise<TenantResource | null>;
  getApplication(tenantId: string, name: string): Promise<ApplicationResource | null>;
  getInfrastructureNode(tenantId: string, name: string): Promise<InfrastructureNode | null>;
}

export class BuilderResourceResolver {
  constructor(private readonly store: BuilderResourceStore) {}

  async resolveTenant(plan: BuilderPlan): Promise<TenantResource> {
    const tenant = await this.store.getTenant(plan.intent.tenantId);
    if (!tenant) throw new Error(`Tenant ${plan.intent.tenantId} was not found`);
    if (tenant.status !== "active") throw new Error(`Tenant ${tenant.id} is not active`);
    return tenant;
  }

  async resolveApplication(operation: BuildOperation, plan: BuilderPlan): Promise<ApplicationResource> {
    const tenant = await this.resolveTenant(plan);
    const application = await this.store.getApplication(tenant.id, operation.resource);
    if (!application) throw new Error(`Application ${operation.resource} was not found for tenant ${tenant.id}`);
    if (application.tenantId !== tenant.id) throw new Error(`Application ${application.id} is outside tenant ${tenant.id}`);
    return application;
  }

  async resolveInfrastructure(operation: BuildOperation, plan: BuilderPlan): Promise<InfrastructureNode> {
    const tenant = await this.resolveTenant(plan);
    const node = await this.store.getInfrastructureNode(tenant.id, operation.resource);
    if (!node) throw new Error(`Infrastructure node ${operation.resource} was not found for tenant ${tenant.id}`);
    if (node.status !== "online") throw new Error(`Infrastructure node ${node.id} is not online`);
    return node;
  }
}
