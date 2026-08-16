import type { ApplicationResource, InfrastructureNode, TenantResource } from "@/lib/hoare/control-plane/types";
import type { BuilderResourceStore } from "./resource-resolver";

export class InMemoryBuilderResourceStore implements BuilderResourceStore {
  private readonly tenants = new Map<string, TenantResource>();
  private readonly applications = new Map<string, ApplicationResource>();
  private readonly nodes = new Map<string, InfrastructureNode>();

  addTenant(resource: TenantResource): void { this.tenants.set(resource.id, resource); }
  addApplication(resource: ApplicationResource): void { this.applications.set(resource.id, resource); }
  addInfrastructureNode(resource: InfrastructureNode): void { this.nodes.set(resource.id, resource); }

  async getTenant(id: string): Promise<TenantResource | null> {
    return this.tenants.get(id) ?? null;
  }

  async getApplication(tenantId: string, name: string): Promise<ApplicationResource | null> {
    return [...this.applications.values()].find((item) => item.tenantId === tenantId && item.name === name) ?? null;
  }

  async getInfrastructureNode(_tenantId: string, name: string): Promise<InfrastructureNode | null> {
    return [...this.nodes.values()].find((item) => item.name === name) ?? null;
  }
}
