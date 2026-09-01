import type { BuilderResourceStore } from "./resource-resolver";
import {
  getApplication,
  getInfrastructureNode,
  getTenant,
} from "@/lib/hoare/control-plane/catalog";

export const controlPlaneCatalogStore: BuilderResourceStore = {
  async getTenant(id) {
    return getTenant(id);
  },
  async getApplication(tenantId, name) {
    return getApplication(tenantId, name);
  },
  async getInfrastructureNode(_tenantId, name) {
    return getInfrastructureNode(name);
  },
};
